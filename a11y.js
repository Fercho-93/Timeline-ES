// Lo que hace falta para poder jugar con teclado o con lector de pantalla. La aplicación
// repinta la pantalla entera en cada acción, y eso, que es cómodo de programar, tiene dos
// efectos que sin remedio dejan fuera a mucha gente:
//
// - El foco del teclado se pierde en cada jugada, porque el elemento que lo tenía deja de
//   existir. Sin esto, tras elegir una carta hay que volver a tabular desde el principio.
// - Nada se anuncia. Un lector de pantalla no ve que la línea temporal ha cambiado si el
//   cambio no pasa por una región viva o por el foco.
//
// De ahí las tres piezas de este archivo: pintar conservando el foco, anunciar por una
// región que sí sobrevive al repintado, y convertir las capas en diálogos de verdad.
(function () {
  "use strict";

  // Atributos que identifican a un elemento entre dos repintados. Son los mismos que usan
  // los dos motores para saber en qué se ha pulsado, así que si el elemento vuelve a
  // pintarse, vuelve con ellos.
  const KEYS = ["data-action", "data-online-action", "data-id", "data-index", "data-mode", "data-block", "data-timeline-zoom"];

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return `#${el.id}`;
    const parts = KEYS.filter(name => el.hasAttribute(name))
      .map(name => `[${name}="${el.getAttribute(name).replace(/["\\]/g, "\\$&")}"]`);
    return parts.length ? parts.join("") : null;
  }

  function focus(el, options) {
    if (!el) return false;
    el.focus(options);
    return document.activeElement === el;
  }

  // La línea temporal (y su mapa) se recorren con el dedo o con el ratón, sin pasar por
  // el foco, así que su posición se guarda aparte. Se ancla a la carta que hubiera más a
  // la izquierda, no al número de píxel: si la nueva carta entra antes de esa posición,
  // el desplazamiento absoluto ya no señalaría al mismo sitio, señalaría a la carta de al
  // lado. Solo se ancla cuando de verdad había algo desplazado; un `scrollLeft` en cero
  // ya vuelve a cero solo, que es el comportamiento correcto al entrar en la pantalla.
  //
  // El ancla se guarda fuera de cualquier pintado concreto, porque en la partida local
  // cada turno pasa por la pantalla de «pásale el móvil», que no tiene línea temporal.
  // Si el ancla solo viviera dentro de un pintado, se perdería justo ahí: se capturaría
  // al salir de la partida, no encontraría dónde restaurarla en la pantalla de paso, y
  // ya no quedaría nada que restaurar al volver a entrar. Guardándola aparte, una
  // pantalla sin línea simplemente la deja pasar de largo hasta la siguiente que sí
  // tenga una.
  const SCROLL_ANCHORS = [".timeline-wrap", ".timeline-map"];
  let anclas = SCROLL_ANCHORS.map(() => null);

  function posicion(el, wrap) {
    return el.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft;
  }

  function actualizaAnclas(container) {
    anclas = SCROLL_ANCHORS.map((selector, i) => {
      const wrap = container.querySelector(selector);
      if (!wrap) return anclas[i]; // esta pantalla no tiene línea: se conserva la última ancla conocida
      if (wrap.scrollLeft <= 0) return null;
      let anchor = null;
      for (const hijo of wrap.querySelectorAll("[data-id]")) {
        if (posicion(hijo, wrap) > wrap.scrollLeft) break;
        anchor = hijo;
      }
      return anchor ? { selector, id: anchor.dataset.id, delta: wrap.scrollLeft - posicion(anchor, wrap) } : null;
    });
  }

  function restauraAnclas(container) {
    anclas.forEach(ancla => {
      if (!ancla) return;
      const wrap = container.querySelector(ancla.selector);
      const hijo = wrap?.querySelector(`[data-id="${ancla.id}"]`);
      if (wrap && hijo) wrap.scrollLeft = posicion(hijo, wrap) + ancla.delta;
    });
  }

  // Una sola transición por selector; una pulsación rápida parte de la altura visible
  // actual. Nunca se aplaza el cambio de estado ni se deja una altura fija al acabar.
  const resizing = new WeakMap();
  function resizeContent(container, from) {
    resizing.get(container)?.cancel();
    resizing.delete(container);
    const to = container.getBoundingClientRect().height;
    if (Math.abs(to - from) >= 1) window.CONTINUUM.Effects?.transition?.(to > from ? 'expand' : 'close');
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !container.animate) return;
    container.classList.add("motion-managed");
    if (Math.abs(to - from) < 1) return;
    const animation = container.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 420, easing: "cubic-bezier(.22,.61,.36,1)"
    });
    resizing.set(container, animation);
    animation.finished.then(() => {
      if (resizing.get(container) === animation) resizing.delete(container);
    }).catch(() => {});
  }

  let homePosition = null;
  function restoreWindowPosition(top) {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("scroll-behavior");
    const priority = root.style.getPropertyPriority("scroll-behavior");
    // La portada usa desplazamiento suave para los enlaces internos. Safari puede
    // heredarlo incluso cuando scrollTo recibe `behavior: "instant"`, y entonces deja
    // ver primero el principio de Inicio antes de viajar hasta la posición guardada.
    // La anulación en línea se aplica y se retira dentro del mismo pintado: el usuario
    // llega directamente al punto anterior sin cambiar el resto de desplazamientos.
    root.style.setProperty("scroll-behavior", "auto", "important");
    window.scrollTo(0, top);
    if (previous) root.style.setProperty("scroll-behavior", previous, priority);
    else root.style.removeProperty("scroll-behavior");
  }
  const MOTION = { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' };
  const surfaceMotions = new Map();
  let primaryNavigationMotion = null;
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#app .home-nav button');
    if (button) primaryNavigationMotion = {
      dialog: button.matches('[data-action="home-encyclopedia"], [data-action="rules"], [data-settings-action]')
    };
  }, true);
  const primaryNavigationActive = () => !!primaryNavigationMotion;
  const preparationDepth = { home: 0, "play-menu": 1, "competition-menu": 1, setup: 2, "solo-home": 2, "duelo-intro": 3, "duelo-invalido": 3, "comp-intro": 2, "tournament-intro": 2, "online-competition-intro": 2, "online-loading": 2, "online-error": 2, "online-entry": 3, "online-lobby": 4 };

  // Una sola entrada por superficie. La marca permanece al terminar para que CSS
  // no reactive una segunda entrada cuando se retira el estado transitorio.
  function unrollSheet(sheet, collection = false, silent = false) {
    if (!sheet) return;
    if (!silent) window.CONTINUUM.Effects?.transition?.('unroll');
    surfaceMotions.get(sheet)?.();
    sheet.classList.add('motion-managed');
    if (!sheet.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    sheet.classList.add('motion-entering');
    const children = [...sheet.children].filter(child =>
      !child.matches('.home-nav, .atlas-scroll-veil, style, script, .solo-lectores'));
    // Los botones de navegación permanecen estables y se conserva su anclaje fijo.
    const targets = children.length ? children : [sheet];
    const animations = targets.map(target => target.animate([
      { opacity: 0 }, { opacity: 1 }
    ], { ...MOTION, fill: 'backwards' }));
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      if (surfaceMotions.get(sheet) === cancel) {
        surfaceMotions.delete(sheet);
        sheet.classList.remove('motion-entering');
      }
    };
    const cancel = () => { animations.forEach(animation => animation.cancel()); cleanup(); };
    surfaceMotions.set(sheet, cancel);
    Promise.all(animations.map(animation => animation.finished)).then(cleanup, cleanup);
    return cancel;
  }
  function cancelSurfaceMotions(container) {
    for (const [sheet, cancel] of surfaceMotions) {
      if (!sheet.isConnected || container.contains(sheet)) cancel();
    }
  }

  function inkWave(anchor, kind = 'success') {
    const timeline = anchor?.closest('.timeline');
    if (!timeline) return () => {};
    const wave = document.createElement('span');
    wave.className = `timeline-ink-wave ink-${kind}`;
    wave.setAttribute('aria-hidden', 'true');
    const box = anchor.getBoundingClientRect(), line = timeline.getBoundingClientRect();
    wave.style.left = `${Math.max(0, box.left - line.left + box.width / 2)}px`;
    timeline.append(wave);
    const timer = setTimeout(() => wave.remove(), 1150);
    return () => { clearTimeout(timer); wave.remove(); };
  }

  // Un mismo gesto físico para ambas llegadas: elevar, viajar y posar el papel.
  // Las coordenadas pertenecen a la línea ya escalada: compensar su zoom evita
  // que el recorrido cambie al elegir 80/100/120%.
  function seatCard(card, {dx = 0, dy = 90, automatic = false, duration = 920} = {}) {
    const angle = automatic ? 7 : -5;
    const shadow = getComputedStyle(card).boxShadow;
    const transform = (x, y, tilt, size) => `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg) scale(${size})`;
    const animations = [card.animate([
      {transform: transform(dx, dy, angle, .9), opacity: 0, boxShadow: '0 16px 28px #39240b30', offset: 0},
      {transform: 'none', opacity: 1, boxShadow: shadow, offset: 1}
      // `backwards` es lo que impide verla dos veces: quien reparte la hace visible justo
      // antes de animarla, y sin rellenar hacia atrás queda un instante en el que la carta
      // ya está pintada en su sitio y todavía no ha empezado a viajar hasta él.
    ], {duration, easing: 'cubic-bezier(.25,.65,.3,1)', fill: 'backwards'})];
    const cards = [...card.parentElement.querySelectorAll('.timeline-card')];
    const at = cards.indexOf(card);
    [cards[at - 1], cards[at + 1]].forEach((neighbor, i) => {
      if (neighbor?.animate) animations.push(neighbor.animate([
        {transform: `translateX(${i === 0 ? 20 : -20}px)`, offset: 0},
        {transform: 'none', offset: 1}
      ], {duration, easing: 'cubic-bezier(.25,.65,.3,1)'}));
    });
    card.classList.add('card-fitting');
    card.querySelector('.year')?.classList.add('date-ink');
    const clearWave = automatic ? () => {} : inkWave(card);
    const clean = () => {
      card.classList.remove('card-fitting');
      card.querySelector('.year')?.classList.remove('date-ink');
    };
    Promise.all(animations.map(animation => animation.finished)).then(clean, clean);
    return () => { animations.forEach(animation => animation.cancel()); clearWave(); clean(); };
  }
  // Una llegada termina antes de que empiece la siguiente.
  const TURNO = 1040;
  let cancelDeal = null;
  function dealIn(cards, { seguir = null, delay = 0 } = {}) {
    const lista = [...cards].filter(card => card?.isConnected);
    if (!lista.length) return;
    if (delay > 0 && lista.every(card => typeof card.animate === 'function')) {
      cancelDeal?.();
      const shell = lista[0].closest('.shell');
      const wasInert = shell?.inert;
      if (shell) shell.inert = true;
      lista.forEach(card => { card.style.visibility = 'hidden'; });
      const restore = () => {
        lista.forEach(card => { card.style.visibility = ''; });
        if (shell) shell.inert = wasInert || false;
      };
      const timer = setTimeout(() => {
        cancelDeal = null; restore();
        if (lista.every(card => card.isConnected)) dealIn(lista, {seguir});
      }, delay);
      cancelDeal = () => { clearTimeout(timer); restore(); cancelDeal = null; };
      return;
    }
    window.CONTINUUM.Effects?.transition?.('deal');
    // Con movimiento reducido no hay recorrido, pero la vista sí va hasta la última: saber
    // dónde ha caído la carta no es decoración, es la mitad de la información.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !lista.every(card => typeof card.animate === 'function')) { seguir?.(lista[lista.length - 1]); return; }
    cancelDeal?.();
    const timers = [], arrivals = [];
    cancelDeal = () => {
      timers.forEach(clearTimeout); arrivals.forEach(cancel => cancel());
      lista.forEach(card => { card.style.visibility = ''; });
      cancelDeal = null;
    };
    lista.forEach((card, orden) => {
      card.style.visibility = 'hidden';
      const entra = () => {
        if (!card.isConnected) return;
        if (orden > 0) window.CONTINUUM.Effects?.transition?.('deal');
        seguir?.(card);
        const wrap = card.closest('.timeline-wrap');
        if (wrap) {
          const box = card.getBoundingClientRect(), view = wrap.getBoundingClientRect();
          wrap.scrollLeft += box.left - view.left - (view.width - box.width) / 2;
        }
        card.style.visibility = '';
        const box = card.getBoundingClientRect();
        if (!box.width) return;
        const scale = parseFloat(card.closest('.timeline')?.style.getPropertyValue('--timeline-scale')) || 1;
        const dx = Math.max(-120, Math.min(120, (window.innerWidth / 2 - (box.left + box.width / 2)) / scale + 60));
        arrivals.push(seatCard(card, {dx, dy: -72 / scale, automatic: true}));
      };
      if (orden === 0) entra();
      else timers.push(setTimeout(entra, orden * TURNO));
    });
  }

  // Pinta y decide dónde queda el foco:
  //
  // - Al cambiar de pantalla, en su titular. Así el lector lee dónde está, y quien usa
  //   teclado empieza a tabular desde arriba y no desde el principio del documento.
  // - Dentro de la misma pantalla, en el mismo elemento que lo tenía, si sigue existiendo.
  // - Si ha desaparecido —el hueco que acabas de elegir se convierte en la confirmación—,
  //   en lo que la pantalla marque como continuación natural.
  //
  // El primer pintado no toca el foco: nadie lo tenía y moverlo al entrar sería una
  // sorpresa desagradable.
  function paint(container, html, screen) {
    cancelDeal?.();
    cancelSurfaceMotions(container);
    const previousDepth = preparationDepth[paint.screen];
    const nextDepth = preparationDepth[screen];
    const changed = paint.screen !== screen;
    const quietPrimaryNavigation = primaryNavigationActive();
    const closingEncyclopedia = paint.screen === "enciclopedia" && changed;
    const encyclopediaBackground = closingEncyclopedia
      ? container.querySelector(`.enc-background[data-background-screen="${screen}"]`)
      : null;
    if (changed) resultPreview = null;
    const backwards = nextDepth !== undefined && nextDepth < previousDepth;
    container.dataset.screen = screen;
    olvidaDialogos(container);
    const activo = document.activeElement;
    const dentro = activo && activo !== container && container.contains(activo);
    const clave = dentro ? selectorFor(activo) : null;
    const previousWindowTop = window.scrollY;
    const primero = paint.screen === undefined;
    const cambioDePantalla = screen !== paint.screen;
    const vuelve = screen === "home" ||
      (screen === "solo-home" && ["solo", "solo-end", "review"].includes(paint.screen)) ||
      (screen === "online-entry" && !["home", "online-loading"].includes(paint.screen));
    if (cambioDePantalla && paint.screen === "home") {
      homePosition = { top: window.scrollY, focus: clave };
    }
    const cartaElegida = container.querySelector(".hand-card.selected")?.dataset.id || null;
    const confirmacionAnterior = container.querySelector(".slot-confirm")?.dataset.index ?? null;
    const oldFinal = container.querySelector('.final-results')?.textContent;
    const oldQuestion = container.querySelector('.final-card')?.textContent;
    const hadFinalForm = !!container.querySelector('.final-form');
    actualizaAnclas(container);
    paint.screen = screen;

    window.CONTINUUM.UI?.captureBoard?.(container);
    // La enciclopedia conserva debajo una copia ya cargada de la pantalla de origen.
    // Si volvemos justo a esa pantalla, movemos sus nodos en vez de destruirlos y crear
    // otros: las imágenes permanecen decodificadas y no aparece un fotograma oscuro.
    if (encyclopediaBackground) container.replaceChildren(...encyclopediaBackground.childNodes);
    else container.innerHTML = html;
    // Una instantánea de Enciclopedia puede contener una clase de entrada activa:
    // es estado transitorio del nodo original, no del fondo restaurado.
    container.querySelectorAll('.motion-entering').forEach(node => node.classList.remove('motion-entering'));
    // Los menús también se repintan al abrir una opción: su cabecera no debe volver
    // a animarse en cada repintado de la misma pantalla.
    container.querySelectorAll(':scope > .shell').forEach(node => node.classList.add('motion-managed'));
    window.CONTINUUM.UI?.mount(container, screen);
    if (!primero && cambioDePantalla && !quietPrimaryNavigation) {
      const kind = ['winner', 'online-winner', 'solo-end', 'comp-end'].includes(screen) ? 'end'
        : ['pass', 'pulse-pass', 'comp-intro', 'tournament-intro', 'online-competition-intro'].includes(screen) ? 'turn'
        : vuelve || (nextDepth !== undefined && nextDepth < previousDepth) ? 'back' : 'page';
      window.CONTINUUM.Effects?.transition?.(kind);
    }
    // Solo los cambios de pantalla entran de nuevo; repintar una jugada conserva
    // la mesa estable. El controlador común toma posesión tras restaurar el foco.
    if (!primero && cambioDePantalla && screen !== "enciclopedia") {
      container.firstElementChild?.classList.add("screen-enter");
      if (vuelve || backwards) container.firstElementChild?.classList.add("screen-return");
    }
    // Dentro de una partida no se anima el repintado entero: solo el elemento que acaba
    // de cambiar de estado. Así el movimiento explica la acción en lugar de decorar cada
    // toque con el mismo efecto.
    if (!cambioDePantalla) {
      const nuevaCarta = container.querySelector(".hand-card.selected");
      if (nuevaCarta && nuevaCarta.dataset.id !== cartaElegida) {
        nuevaCarta.classList.add("selection-enter");
        window.CONTINUUM.Effects?.transition?.(screen === 'solo' && cartaElegida ? 'deal' : 'select');
      }
      const nuevaConfirmacion = container.querySelector(".slot-confirm");
      if (nuevaConfirmacion && nuevaConfirmacion.dataset.index !== confirmacionAnterior) {
        nuevaConfirmacion.classList.add("placement-enter");
        window.CONTINUUM.Effects?.transition?.('place');
      } else if (!nuevaConfirmacion && confirmacionAnterior !== null) window.CONTINUUM.Effects?.transition?.('return');
      const newFinal = container.querySelector('.final-results')?.textContent;
      const newQuestion = container.querySelector('.final-card')?.textContent;
      if (newFinal && newFinal !== oldFinal) window.CONTINUUM.Effects?.transition?.('flip');
      else if (newQuestion && newQuestion !== oldQuestion) window.CONTINUUM.Effects?.transition?.('deal');
      else if (hadFinalForm && !container.querySelector('.final-form')) window.CONTINUUM.Effects?.transition?.('place');
    }
    const confirmation = container.querySelector(".slot-confirm");
    const newConfirmation = confirmation && confirmation.dataset.index !== confirmacionAnterior;
    // Confirmar vuelve al tamaño legible y conserva el hueco elegido, también
    // en los extremos. Se resuelve antes de devolver el foco al botón.
    window.CONTINUUM.applyTimelineZoom?.(container, cambioDePantalla || !!newConfirmation);
    restauraAnclas(container);
    if (newConfirmation) {
      const wrap = container.querySelector(".timeline-wrap");
      if (wrap) {
        const target = confirmation.getBoundingClientRect();
        const frame = wrap.getBoundingClientRect();
        wrap.scrollLeft += target.left - frame.left - (frame.width - target.width) / 2;
      }
    }
    if (quietPrimaryNavigation && !primaryNavigationMotion?.dialog) primaryNavigationMotion = null;
    if (primero) return;
    if (cambioDePantalla) {
      // El foco anuncia la pantalla, pero no decide dónde empieza la vista. En móvil
      // el titular de Inicio está debajo de la galería; enfocarlo saltaba la portada.
      const regreso = screen === "home" && homePosition;
      const conservaFondo = screen === "enciclopedia";
      const destino = regreso?.focus && container.querySelector(regreso.focus);
      focus(destino || container.querySelector("[data-focus]"), { preventScroll: true });
      const top = regreso ? regreso.top : conservaFondo ? previousWindowTop : 0;
      // Al reconstruir Inicio el navegador puede conservar todavía el valor antiguo y
      // reajustarlo a cero al terminar el layout. Por eso, cuando hay un regreso guardado,
      // reafirmamos siempre la posición aunque en este instante parezca coincidir.
      if (regreso || conservaFondo || window.scrollY !== top || window.scrollX !== 0) restoreWindowPosition(top);
      if (screen !== "enciclopedia") unrollSheet(container.firstElementChild, false, true);
      return;
    }
    // Quien no tenía el foco dentro tampoco lo recibe ahora: mover el foco a alguien que
    // estaba mirando y no navegando es más molesto que útil.
    if (!dentro) return;
    if (clave && focus(container.querySelector(clave), { preventScroll: true })) return;
    focus(container.querySelector("[data-autofocus]"), { preventScroll: true }) ||
      focus(container.querySelector("[data-focus]"), { preventScroll: true });
  }

  // Una región viva tiene que estar en el documento *antes* de cambiar de texto, y
  // sobrevivir al repintado, así que vive fuera de la pantalla del juego.
  function announce(text) {
    let region = document.getElementById("anuncio");
    if (!region) {
      region = document.createElement("p");
      region.id = "anuncio";
      region.className = "solo-lectores";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    // Repetir el mismo texto no dispara el anuncio; se vacía primero.
    region.textContent = "";
    setTimeout(() => { region.textContent = text; }, 50);
  }

  // Las capas del juego son diálogos de verdad, no adornos: se anuncian como tales, el
  // foco entra dentro, el tabulador no se escapa por detrás y Escape cierra lo que se
  // pueda cerrar. Al cerrarse, el foco vuelve de donde vino.
  //
  // Se apilan porque el QR de la sala se abre encima del menú de la sala. Solo el de
  // arriba escucha a Escape y solo él se cierra.
  const pila = [];
  let dialogos = 0;
  let resultPreview = null;

  function focusables(modal) {
    return [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && !el.hasAttribute("hidden"));
  }

  function openDialog(overlay, cerrable, onClose) {
    if (!overlay || pila.some(dialog => dialog.overlay === overlay)) return;
    // Enseñar primero la carta colocada. La capa transparente bloquea otra jugada
    // mientras el foco espera aquí; el diálogo y su revelado arrancan al terminar.
    const id = overlay.dataset.resultCard;
    const card = id && [...document.querySelectorAll('.timeline-card[data-id]')].find(el => el.dataset.id === id);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const correctionId = overlay.dataset.correctionCard;
    const correctSlot = correctionId && document.querySelector('.slot-correct');
    if (correctSlot && correctSlot.animate && !reduce && !overlay.dataset.resultReady) {
      const key = `error:${correctionId}:${overlay.dataset.attemptedSlot}:${overlay.dataset.correctSlot}`;
      if (resultPreview?.id !== key) resultPreview = {id: key, until: performance.now() + 1350};
      const remaining = resultPreview.until - performance.now();
      if (remaining > 0) {
        overlay.classList.add('result-preview');
        overlay.setAttribute('tabindex', '-1');
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', 'Mostrando la posición correcta');
        focus(overlay, {preventScroll: true});
        const wrap = correctSlot.closest('.timeline-wrap');
        window.CONTINUUM.scrollToElement?.(wrap, correctSlot);
        if (wrap) {
          const box = correctSlot.getBoundingClientRect(), view = wrap.getBoundingClientRect();
          wrap.scrollLeft += box.left - view.left - (view.width - box.width) / 2;
        }
        const attempted = document.querySelector(`.slot[data-index="${overlay.dataset.attemptedSlot}"]`);
        const from = attempted?.getBoundingClientRect() || correctSlot.getBoundingClientRect();
        const to = correctSlot.getBoundingClientRect();
        const lesson = document.createElement('div');
        lesson.className = 'placement-correction-card'; lesson.setAttribute('aria-hidden', 'true');
        const heading = overlay.querySelector('h2')?.cloneNode(true);
        heading?.querySelectorAll('.solo-lectores').forEach(node => node.remove());
        lesson.innerHTML = `<small>Su posición era</small><b>${heading?.textContent?.trim() || ''}</b><span>${overlay.querySelector('.year')?.textContent || ''}</span>`;
        document.body.append(lesson);
        const w = 126, h = 78;
        const clampX = x => Math.max(6, Math.min(window.innerWidth - w - 6, x));
        const clampY = y => Math.max(6, Math.min(window.innerHeight - h - 6, y));
        const startX = clampX(from.left + from.width / 2 - w / 2), startY = clampY(from.top + from.height / 2 - h / 2);
        const endX = clampX(to.left + to.width / 2 - w / 2), endY = clampY(to.top + to.height / 2 - h / 2);
        const flight = lesson.animate([
          {transform:`translate3d(${startX}px,${startY}px,0) rotate(-4deg) scale(.88)`,opacity:.35},
          {transform:`translate3d(${startX}px,${startY - 12}px,0) rotate(-3deg) scale(1)`,opacity:1,offset:.22},
          {transform:`translate3d(${endX}px,${endY}px,0) rotate(0) scale(.94)`,opacity:1,offset:.78},
          {transform:`translate3d(${endX}px,${endY}px,0) rotate(0) scale(.9)`,opacity:0}
        ], {duration:Math.min(1120, remaining),easing:'cubic-bezier(.2,.72,.22,1)',fill:'forwards'});
        correctSlot.classList.add('correction-target');
        const clearWave = inkWave(correctSlot, 'error');
        const onKey = event => { if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') event.preventDefault(); };
        document.addEventListener('keydown', onKey);
        const clean = () => { lesson.remove(); correctSlot.classList.remove('correction-target'); clearWave(); };
        const pending = {overlay, previo: document.activeElement, onKey, cerrable: false, cancelRoll: () => { clearTimeout(timer); flight.cancel(); clean(); }};
        pila.push(pending);
        const timer = setTimeout(() => {
          const index = pila.indexOf(pending); if (index >= 0) pila.splice(index, 1);
          document.removeEventListener('keydown', onKey); clean();
          if (!overlay.isConnected) return;
          overlay.classList.remove('result-preview'); overlay.removeAttribute('role'); overlay.removeAttribute('aria-label');
          overlay.dataset.resultReady = 'true'; openDialog(overlay, cerrable, onClose);
        }, remaining);
        return;
      }
    }
    if (card && card.animate && !reduce && !overlay.dataset.resultReady) {
      if (resultPreview?.id !== id) resultPreview = {id, until: performance.now() + 1100};
      const remaining = resultPreview.until - performance.now();
      if (remaining > 0) {
        overlay.classList.add('result-preview');
        overlay.setAttribute('tabindex', '-1');
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', '¡Bien colocado!');
        focus(overlay, {preventScroll: true});
        window.CONTINUUM.scrollToElement?.(card.closest('.timeline-wrap'), card);
        const animations = [];
        const wrap = card.closest('.timeline-wrap');
        // Centrar antes del movimiento evita sumar dos desplazamientos a la vez.
        if (wrap) {
          const box = card.getBoundingClientRect(), view = wrap.getBoundingClientRect();
          wrap.scrollLeft += box.left - view.left - (view.width - box.width) / 2;
        }
        const scale = parseFloat(card.closest('.timeline')?.style.getPropertyValue('--timeline-scale')) || 1;
        const box = card.getBoundingClientRect();
        const hand = document.querySelector('.hand-card.selected')?.getBoundingClientRect();
        const dx = hand ? Math.max(-180, Math.min(180, (hand.left - box.left) / scale)) : 0;
        const dy = hand ? Math.max(60, Math.min(180, (hand.top - box.top) / scale)) : 90;
        const cancelArrival = seatCard(card, {dx, dy, duration: Math.min(920, remaining)});
        animations.push({cancel: cancelArrival});
        const onKey = event => { if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') event.preventDefault(); };
        document.addEventListener('keydown', onKey);
        const pending = {overlay, previo: document.activeElement, onKey, cerrable: false, cancelRoll: () => { clearTimeout(timer); animations.forEach(animation => animation.cancel()); card.classList.remove('card-fitting'); card.querySelector('.year')?.classList.remove('date-ink'); }};
        pila.push(pending);
        const timer = setTimeout(() => {
          const index = pila.indexOf(pending);
          if (index >= 0) pila.splice(index, 1);
          document.removeEventListener('keydown', onKey);
          if (!overlay.isConnected) return;
          card.classList.remove('card-fitting'); card.querySelector('.year')?.classList.remove('date-ink');
          overlay.classList.remove('result-preview');
          overlay.removeAttribute('role');
          overlay.removeAttribute('aria-label');
          overlay.dataset.resultReady = 'true';
          openDialog(overlay, cerrable, onClose);
        }, remaining);
        return;
      }
    }
    const compact = window.CONTINUUM.UI?.compactResult?.(overlay);
    const quietPrimaryNavigation = primaryNavigationActive();
    if (quietPrimaryNavigation) primaryNavigationMotion = null;
    if (!quietPrimaryNavigation && !pila.some(dialog => dialog.overlay === overlay)) window.CONTINUUM.Effects?.transition?.('open');
    const modal = overlay.querySelector(".modal") || overlay;
    window.CONTINUUM.UI?.reveal(modal);
    const openingFocus = document.activeElement;
    window.CONTINUUM.UI?.openSurface(modal);
    // Marcar y arrancar el desenrollado antes de activar `dialog-enter` evita que el
    // navegador llegue a pintar primero la animación CSS y después la animación JS.
    const cancelRoll = unrollSheet(modal, false, true);
    overlay.classList.add("dialog-enter");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", compact ? "false" : "true");
    modal.setAttribute("tabindex", "-1");
    const titulo = modal.querySelector("h1, h2, h3");
    if (titulo) {
      if (!titulo.id) titulo.id = `dialogo-${++dialogos}`;
      modal.setAttribute("aria-labelledby", titulo.id);
    }

    if (compact) modal.scrollIntoView?.({block: "nearest", behavior: "auto"});
    const previo = openingFocus;
    // Una guía larga debe abrir por su título, no desplazarse hasta «Entendido».
    const lectura = titulo && modal.querySelector(".guide-content");
    if (lectura) titulo.setAttribute("tabindex", "-1");
    focus(lectura ? titulo : (modal.querySelector("[data-dialog-focus]") || focusables(modal)[0] || modal), { preventScroll: true });

    function onKey(event) {
      if (pila.length && pila[pila.length - 1].overlay !== overlay) return;
      if (event.key === "Escape") {
        if (cerrable) { event.preventDefault(); closeDialog(); }
        return;
      }
      if (compact || event.key !== "Tab") return;
      const lista = focusables(modal);
      if (!lista.length) { event.preventDefault(); return; }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!lista.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? ultimo : primero).focus(); }
      else if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
    }
    document.addEventListener("keydown", onKey);
    pila.push({ overlay, previo, onKey, cerrable, cancelRoll, onClose });
  }

  // Mismo criterio que Escape, para el botón/gesto Atrás de Android: si hay un diálogo
  // descartable encima, lo cierra; si es un paso obligado, se queda quieto pero igualmente
  // se come la pulsación, para no dejar que atraviese el diálogo y navegue por debajo.
  function backPressed() {
    if (!pila.length) return false;
    if (pila[pila.length - 1].cerrable) closeDialog();
    return true;
  }

  // Cierra el diálogo de arriba y devuelve el foco a quien lo abrió.
  function closeDialog() {
    const dialogo = pila.pop();
    if (!dialogo) return;
    // La enciclopedia vuelve a su pantalla desde onClose; ese pintado da la
    // respuesta de navegación sin añadir primero otro sonido de cierre.
    if (!dialogo.onClose) window.CONTINUUM.Effects?.transition?.('close');
    dialogo.cancelRoll?.();
    document.removeEventListener("keydown", dialogo.onKey);
    const anteriorEnPila = pila[pila.length - 1];
    const termina = () => {
      if (!dialogo.overlay.isConnected) return;
      window.CONTINUUM.UI?.closeSurface(dialogo.overlay.querySelector(".modal"));
      dialogo.overlay.remove();
      dialogo.onClose?.();
      // Un diálogo nuevo puede haberse abierto durante la salida: el cierre anterior no
      // debe quitarle el foco. Tampoco dejamos controles accionables mientras salen.
      if (pila[pila.length - 1] === anteriorEnPila && dialogo.previo?.isConnected) dialogo.previo.focus({ preventScroll: true });
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // jsdom y navegadores antiguos no exponen getAnimations: en ellos se mantiene el
    // cierre inmediato. En navegadores actuales se deja respirar la salida 160 ms.
    if (reduce || typeof dialogo.overlay.getAnimations !== "function") { termina(); return; }
    dialogo.overlay.classList.remove("dialog-enter");
    dialogo.overlay.classList.add("dialog-exit");
    dialogo.overlay.inert = true;
    dialogo.overlay.addEventListener("animationend", event => {
      if (event.target === dialogo.overlay && event.animationName === "veil-out") termina();
    });
    setTimeout(termina, 220);
  }

  // Un repintado se lleva por delante las capas que viven dentro. No hay nada que cerrar
  // ni foco que devolver —de eso se encarga `paint`—, solo hay que soltar los oyentes.
  function olvidaDialogos(container) {
    for (let i = pila.length - 1; i >= 0; i--) {
      if (!container.contains(pila[i].overlay)) continue;
      pila[i].cancelRoll?.();
      document.removeEventListener("keydown", pila[i].onKey);
      pila.splice(i, 1);
    }
  }

  // Una carta ya colocada en la línea no se puede volver a jugar, así que tocarla no
  // tiene otra jugada posible que enseñar su explicación. Se da la vuelta con una
  // pequeña animación y no con un repintado: cambiar de estado del juego por mirar una
  // carta sería spam en el historial de partida, y además perdería el resto de la mano.
  function toggleFlip(carta) {
    if (carta.classList.contains("flip-anim")) return;
    window.CONTINUUM.Effects?.transition?.('flip');
    const giraHaciaAtras = !carta.classList.contains("is-flipped");
    carta.setAttribute("aria-pressed", String(giraHaciaAtras));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { carta.classList.toggle("is-flipped", giraHaciaAtras); return; }
    carta.classList.add("flip-anim");
    setTimeout(() => carta.classList.toggle("is-flipped", giraHaciaAtras), 200);
    setTimeout(() => carta.classList.remove("flip-anim"), 400);
  }
  document.addEventListener("click", event => {
    const carta = event.target.closest(".card-flippable");
    if (carta) toggleFlip(carta);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const carta = event.target.closest?.(".card-flippable");
    if (!carta) return;
    event.preventDefault();
    toggleFlip(carta);
  });

  window.CONTINUUM = window.CONTINUUM || {};
  window.CONTINUUM.paint = paint;
  window.CONTINUUM.dealIn = dealIn;
  window.CONTINUUM.unrollCollection = sheet => unrollSheet(sheet?.closest('.collection-entry') || sheet, true);
  window.CONTINUUM.resizeContent = resizeContent;
  window.CONTINUUM.announce = announce;
  window.CONTINUUM.openDialog = openDialog;
  window.CONTINUUM.closeDialog = closeDialog;
  window.CONTINUUM.backPressed = backPressed;
})();
