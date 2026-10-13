// Deslizar de izquierda a derecha vuelve a la pantalla de detrás, como en el resto del
// sistema. El gesto no decide a dónde se vuelve: llama al mismo «atrás» que el botón
// «Volver» de cada pantalla y que el botón/gesto Atrás de Android, así que los tres
// caminos no pueden acabar en sitios distintos.
//
// Como en iOS, la pantalla sigue al dedo mientras se arrastra: se aparta hacia la derecha
// y, al soltar, o termina de irse (y entonces se vuelve) o regresa a su sitio. Qué se
// mueve lo dice quien activa el gesto (`surface`): el diálogo de encima, la pantalla
// entera o nada, si desde ahí no se puede volver (en el inicio o en plena partida).
//
// Y como en iOS, por el hueco que deja asoma la pantalla a la que se vuelve: entra desde
// un poco a la izquierda (más despacio que el dedo, en paralaje), en penumbra que se
// aclara al avanzar, con la sombra del borde de la pantalla que se va encima. Esa
// pantalla de detrás es una copia de cómo se dejó: este archivo guarda los nodos de cada
// pantalla al salir de ella, y quien activa el gesto puede decir (`destination`) cuál
// pintará «Volver». Si no hay copia, asoma solo el fondo en penumbra, nunca un vacío.
//
// Vive aparte de drag.js porque no se pisan: en pantalla táctil una carta solo se levanta
// manteniéndola pulsada, y un deslizamiento que empieza antes ya es de este archivo. Los
// dos escuchan al documento, así que se registra una sola vez y sobrevive a los repintados.
(function () {
  "use strict";

  // Cuándo un movimiento es un «atrás». Los umbrales son exigentes a propósito: un falso
  // positivo aquí no es un adorno de más, es una pantalla que se va sin que nadie la
  // haya pedido.
  const LOCK_X = 10;      // a partir de aquí, si es claramente horizontal, la pantalla sigue al dedo
  const MIN_X = 78;       // recorrido horizontal mínimo para volver, en píxeles
  const MAX_Y = 56;       // desvío vertical que, antes de engancharse, delata un desplazamiento
  const RATIO = 1.8;      // cuánto más horizontal que vertical tiene que ser el recorrido
  const MAX_TIME = 1000;  // sin la pantalla enganchada, un gesto lento es indecisión
  const SHARE = 0.33;     // arrastrar un tercio del ancho basta para volver aunque se suelte despacio
  const FLING = 0.35;     // px/ms: un gesto rápido vuelve aunque sea más corto
  const SETTLE_MIN = 120; // ms para terminar de irse o para volver a su sitio: según lo que
  const SETTLE_MAX = 280; // falte y la velocidad del dedo al soltar, entre estos dos
  const PARALLAX = 0.3;   // la pantalla de detrás arranca desplazada un 30 % del ancho
  const HISTORY = 8;      // pantallas de las que se guarda copia para asomar detrás

  // Lo que se queda el gesto antes de que pueda contar como «atrás»: los controles en los
  // que el dedo ya hace algo horizontal —un deslizador, un campo del que seleccionar
  // texto, la lista de un desplegable— porque ahí el movimiento es de ellos.
  const CONTROLS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

  let gesture = null;
  let goBack = null;
  let surface = null;
  let destination = null;

  // Una tira que se puede desplazar a los lados —la línea temporal, el marcador, la tabla
  // de resultados— también se queda el gesto: ahí el dedo mueve contenido, no navega. Se
  // comprueba el desbordamiento real y no solo el estilo, porque `overflow-x: clip` de
  // `#app` desborda sin desplazarse y si no, se comería todos los gestos de la aplicación.
  function scroller(node) {
    const overflow = node.ownerDocument.defaultView?.getComputedStyle(node).overflowX;
    return (overflow === "auto" || overflow === "scroll") && node.scrollWidth - node.clientWidth > 2;
  }

  function blocked(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest(CONTROLS) || target.closest('.hand-fan, .hand-fan-controls')) return true;
    for (let node = target; node; node = node.parentElement) {
      if (scroller(node)) return true;
    }
    return false;
  }

  const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---------------------------------------------------------------------------
  // Lo que se ve mientras se arrastra
  //
  // Un diálogo es un elemento fijo y se desplaza tal cual. La pantalla no: el documento
  // es quien se desplaza, y desplazar con `translate` el contenedor de la pantalla
  // convertiría sus elementos fijos —la barra de abajo, la veladura— en hijos de ese
  // contenedor, y saltarían al final de una página de miles de píxeles. Por eso el
  // contenedor se mueve con `left` (no crea ese ámbito) y cada elemento fijo de dentro
  // se mueve con su propio `translate`, que se suma a la transformación que ya tuviera.
  function fixedInside(root) {
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (getComputedStyle(node).position === "fixed") found.push(node);
    }
    return found;
  }

  function track(target) {
    const pieces = [];
    const keep = (node, prop) => pieces.push({ node, prop, value: node.style.getPropertyValue(prop), priority: node.style.getPropertyPriority(prop) });
    if (target.id === "app") {
      for (const child of target.children) {
        if (child.matches(".overlay, script, style")) continue;
        const position = getComputedStyle(child).position;
        if (position === "fixed") { keep(child, "translate"); pieces.at(-1).move = "translate"; continue; }
        keep(child, "left");
        pieces.at(-1).move = "left";
        if (position === "static") { keep(child, "position"); child.style.position = "relative"; }
        for (const fixed of fixedInside(child)) { keep(fixed, "translate"); pieces.at(-1).move = "translate"; }
      }
    } else {
      keep(target, "translate");
      pieces.at(-1).move = "translate";
    }
    pieces.forEach(piece => { if (piece.move) piece.node.style.willChange = piece.move; });
    // Dentro de la mesa a escala (mesa-escala.js) las medidas son puntos de la mesa: el dedo
    // recorre `dx` píxeles de pantalla, que allí dentro son `dx / escala`.
    const mesa = window.CONTINUUM.Mesa;
    const escala = mesa?.activa() && target.closest?.("#app") ? mesa.escala() : 1;
    // Detrás de un diálogo ya está la pantalla de verdad; detrás de la pantalla, la copia.
    const behind = target.id === "app" ? peek(target) : null;
    return {
      target, pieces, behind, dx: 0,
      set(dx) {
        this.dx = dx;
        const paso = dx / escala;
        for (const piece of pieces) {
          if (piece.move === "left") piece.node.style.left = `${paso}px`;
          else if (piece.move === "translate") piece.node.style.translate = `${paso}px 0`;
        }
        behind?.set(dx);
      },
      restore() {
        behind?.remove();
        for (const piece of pieces) {
          if (piece.value) piece.node.style.setProperty(piece.prop, piece.value, piece.priority);
          else piece.node.style.removeProperty(piece.prop);
          piece.node.style.removeProperty("will-change");
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Lo que asoma detrás
  //
  // Cada vez que cambia la pantalla se guardan los nodos que salen —ya pintados, con sus
  // imágenes— junto con su nombre y hasta dónde se había bajado. Funciona
  // como una pila: entrar en una pantalla nueva apila la que se deja; volver a una que ya
  // estaba en la pila descarta lo de encima, y el inicio la vacía, igual que el rastro
  // de «Volver» de app.js. Retos rápidos navega por dentro y cuenta como una sola.
  const group = name => name?.startsWith("quick-") ? "quick" : name;
  let stack = [];
  let shown = null;
  let lastTop = 0;
  let observer = null;

  function enter(left, now, nodes) {
    const back = stack.findIndex(entry => group(entry.screen) === group(now));
    if (back >= 0) stack.length = back;
    else if (left && nodes?.length) stack.push({ screen: left, nodes, top: lastTop });
    if (stack.length > HISTORY) stack.shift();
    if (group(now) === "home") stack = [];
  }

  // El lote se recorre en orden, porque en un mismo turno pueden pasar varias pantallas.
  // Los nodos que salen antes de cambiar `data-screen` son de la pantalla que había;
  // los que salen justo después (a11y.js cambia primero el atributo), de la que se dejó.
  function observed(records) {
    // La página puede haberse cerrado entre el cambio y este aviso.
    if (typeof document === "undefined" || !document?.documentElement) return;
    const app = document.getElementById("app");
    if (!app) return;
    const changes = records.filter(record => record.type === "attributes");
    let leaving = null, removed = null, seen = 0;
    for (const record of records) {
      if (record.type === "attributes") {
        seen++;
        const now = seen < changes.length ? changes[seen].oldValue : app.dataset.screen;
        if (!now || group(now) === group(shown)) continue;
        if (leaving) enter(leaving, shown, null);
        if (removed) { enter(shown, now, removed); leaving = null; }
        else leaving = shown;
        removed = null;
        shown = now;
        continue;
      }
      const nodes = [...record.removedNodes].filter(node => node instanceof Element && !node.matches(".overlay, script, style"));
      if (!nodes.length) continue;
      if (leaving) { enter(leaving, shown, nodes); leaving = null; }
      else removed = nodes;
    }
    if (leaving) enter(leaving, shown, null);
    scheduleRefresh();
  }

  // La copia que asoma: la que dice quien activa el gesto o, si no lo sabe, la última que
  // se dejó. Si dice una pantalla de la que no hay copia (o `false`, que no lo sabe pero
  // no será la última), no se adivina: mejor el fondo solo que una pantalla equivocada.
  function snapshotBehind(app) {
    // Un cambio de pantalla de este mismo turno puede no haber llegado todavía al observador.
    const pending = observer?.takeRecords() || [];
    if (pending.length) observed(pending);
    const current = group(app.dataset.screen);
    const wanted = destination?.();
    if (wanted === false) return null;
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (group(entry.screen) === current) continue;
      if (!wanted || group(entry.screen) === group(wanted)) return entry;
    }
    return null;
  }

  // La capa de detrás va justo después de `#app`, fija y a pantalla completa, recortada
  // al hueco que va dejando el dedo: así nunca se superpone a la pantalla que se va,
  // aunque esta sea transparente sobre el fondo. Dentro lleva otro `#app` con el
  // nombre de esa pantalla, para que le sigan valiendo los estilos (casi todos
  // cuelgan de `#app[data-screen=…]`); al ir detrás del de verdad, `getElementById` y
  // `querySelector` siguen encontrando el original. Es inerte y no la lee nadie.
  function peek(app) {
    const snapshot = snapshotBehind(app);
    const layer = document.createElement("div");
    layer.className = "swipe-peek";
    layer.setAttribute("aria-hidden", "true");
    layer.inert = true;
    layer.style.cssText = "position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; isolation: isolate; contain: strict;";
    // La página se desplaza sola (paralaje) y es a la vez el marco de lo fijo de la copia
    // —la barra de abajo—, que así queda abajo del todo y se mueve con ella.
    const page = document.createElement("div");
    page.className = "swipe-peek-page";
    page.style.cssText = "position: absolute; inset: 0; overflow: hidden; will-change: translate;";
    if (snapshot) {
      const copy = document.createElement(app.tagName);
      // Los atributos de `#app` son los de ahora (plataforma, aparato…) con la pantalla de
      // la copia; lo que es de un momento, como la entrada al inicio, no se lleva.
      for (const { name, value } of app.attributes) if (name !== "style") copy.setAttribute(name, value);
      copy.dataset.screen = snapshot.screen;
      copy.classList.remove("home-transition-enter");
      copy.append(...snapshot.nodes.map(node => node.cloneNode(true)));
      // Lo que estaba entrando al dejarla, en la copia ya ha entrado.
      copy.querySelectorAll(".motion-entering, .screen-enter, .screen-return").forEach(node => node.classList.remove("motion-entering", "screen-enter", "screen-return"));
      page.append(copy);
    }
    // La penumbra, con la sombra que proyecta encima el borde de la pantalla que se va.
    const shade = document.createElement("div");
    shade.className = "swipe-peek-shade";
    shade.style.cssText = "position: absolute; inset: 0; will-change: translate, opacity;" +
      "background: linear-gradient(to left, rgba(40, 24, 8, .34), rgba(40, 24, 8, .13) 24px, rgba(40, 24, 8, .1) 60%, rgba(40, 24, 8, .1));";
    layer.append(page, shade);
    app.after(layer);
    if (snapshot) page.scrollTop = snapshot.top;
    return {
      snapshot,
      set(dx) {
        const width = window.innerWidth || 1;
        const progress = Math.min(1, Math.max(0, dx / width));
        layer.style.clipPath = `inset(0 ${Math.max(0, width - dx)}px 0 0)`;
        page.style.translate = `${-(1 - progress) * width * PARALLAX}px 0`;
        shade.style.translate = `${dx - width}px 0`;
        shade.style.opacity = String(1 - progress);
      },
      remove() { layer.remove(); }
    };
  }

  // Anima el desplazamiento desde donde lo dejó el dedo hasta `to`, fotograma a fotograma
  // (un `left` no se puede animar con una transición sin dejarla puesta para siempre).
  // Dura lo que tardaría el dedo en recorrer lo que falta a la velocidad con que se soltó,
  // dentro de unos límites: un gesto rápido termina rápido y uno pausado, con calma.
  function settle(view, to, done, speed = 0) {
    const from = view.dx;
    if (reduced() || typeof requestAnimationFrame !== "function" || from === to) { view.set(to); done(); return; }
    const pace = Math.max(Math.abs(Number.isFinite(speed) ? speed : 10), 1.1);
    const duration = Math.min(SETTLE_MAX, Math.max(SETTLE_MIN, Math.abs(to - from) / pace));
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      view.set(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // El gesto

  function onDown(event) {
    gesture = null;
    if (!goBack) return;
    // Con ratón no: para eso están los botones de la pantalla, y el arrastre del ratón es
    // el que coloca cartas en drag.js. Un segundo dedo —una pinza para acercar una
    // ilustración— tampoco navega a ningún sitio.
    if (event.pointerType === "mouse" || event.isPrimary === false) return;
    if (blocked(event.target)) return;
    gesture = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, drift: 0, start: Date.now(),
      samples: [{ x: event.clientX, t: Date.now() }], view: null, dead: false
    };
  }

  function move(x, y) {
    if (!gesture || gesture.dead) return;
    gesture.x = x;
    gesture.y = y;
    const now = Date.now();
    gesture.samples.push({ x, t: now });
    while (gesture.samples.length > 2 && now - gesture.samples[0].t > 100) gesture.samples.shift();
    const dx = x - gesture.startX;
    if (gesture.view) { gesture.view.set(Math.max(0, dx)); return; }
    // El desvío máximo alcanzado, no el final: un gesto que baja y vuelve a subir es un
    // desplazamiento con la mano torcida, y acabaría pareciendo una línea recta.
    gesture.drift = Math.max(gesture.drift, Math.abs(y - gesture.startY));
    // Antes de engancharse, un desplazamiento vertical decide que esto no es un «atrás».
    if (gesture.drift > MAX_Y) { gesture.dead = true; return; }
    // Mientras se arrastra una carta, el movimiento es suyo.
    if (document.body.classList.contains("dragging-card")) return;
    if (dx < LOCK_X || dx < gesture.drift * RATIO) return;
    // Claramente hacia la derecha: la pantalla (o el diálogo) se engancha al dedo, si desde
    // aquí se puede volver. Si no, el gesto sigue valiendo como antes, sin moverse nada.
    const target = surface?.();
    if (target) {
      gesture.view = track(target);
      gesture.view.set(dx);
    }
  }

  function onMove(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    move(event.clientX, event.clientY);
  }

  // Con la pantalla enganchada, el dedo ya no desplaza la página: se cancela el
  // desplazamiento del navegador, que si no retiraría el puntero a mitad de gesto. Si aun
  // así lo retira, el dedo se sigue con los eventos táctiles hasta que se levante.
  function onTouchMove(event) {
    if (!gesture?.view) return;
    if (event.cancelable) event.preventDefault();
    if (gesture.cancelled) { const touch = event.touches[0]; if (touch) move(touch.clientX, touch.clientY); }
  }
  function onTouchEnd(event) {
    if (!gesture?.cancelled || event.touches.length) return;
    finish(gesture.x, gesture.y);
  }

  function velocity(gesto) {
    const first = gesto.samples[0], last = gesto.samples.at(-1);
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : Infinity;
  }

  // Se resuelve igual al cancelar: hay navegadores que retiran el puntero en cuanto
  // deciden que el dedo está desplazando la página, y para entonces el recorrido ya está
  // hecho. Si la pantalla iba enganchada, se espera a que se levante el dedo.
  function onUp(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    // Si el navegador retira el puntero con la pantalla enganchada y el gesto aún no
    // basta para volver, el dedo se sigue con los eventos táctiles hasta que se levante.
    if (event.type === "pointercancel" && gesture.view && "ontouchend" in document && !decide(gesture, gesture.x, gesture.y)) {
      gesture.cancelled = true;
      return;
    }
    // Al soltar vale la posición del propio evento; al cancelar, la última que se vio.
    const x = event.type === "pointerup" ? event.clientX : gesture.x;
    const y = event.type === "pointerup" ? event.clientY : gesture.y;
    finish(x, y);
  }

  function finish(x, y) {
    const gesto = gesture;
    gesture = null;
    if (!gesto) return;
    const view = gesto.view;
    if (view) view.set(Math.max(0, x - gesto.startX));
    const speed = velocity(gesto);
    if (!decide(gesto, x, y)) {
      if (view) settle(view, 0, () => view.restore(), speed);
      return;
    }
    // Tras el gesto el navegador puede disparar un clic sobre lo que hubiera bajo el dedo,
    // y en la pantalla nueva ese clic no significa nada. Se ignora uno, y el oyente se
    // retira en el mismo turno para no comerse el siguiente clic de verdad. Igual que en
    // drag.js: no todos los navegadores lo disparan, así que no se puede esperar sentado.
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
    window.CONTINUUM.Sonidos?.atras?.();
    if (!view) { goBack(); return; }
    settle(view, window.innerWidth, () => {
      const screenBefore = document.getElementById("app")?.dataset.screen;
      goBack();
      landed(view, screenBefore);
    }, speed);
  }

  function decide(gesto, x, y) {
    // Arrastrar una carta hasta un hueco es un recorrido horizontal como cualquier otro:
    // si además contara como «atrás», colocar una carta hacia la derecha se llevaría la
    // pantalla por delante. Mientras haya una carta en el dedo, aquí no hay gesto.
    if (document.body.classList.contains("dragging-card")) return false;
    const dx = x - gesto.startX;
    if (dx < MIN_X) return false;                   // hacia la izquierda, o demasiado corto
    if (gesto.view) {
      // Enganchada, la pantalla vuelve si se ha llevado lejos o se ha soltado con impulso
      // hacia la derecha; si el dedo regresaba hacia la izquierda, se queda.
      const speed = velocity(gesto);
      return dx >= window.innerWidth * SHARE ? speed > -FLING : speed >= FLING;
    }
    const drift = Math.max(gesto.drift, Math.abs(y - gesto.startY));
    if (drift > MAX_Y || dx < drift * RATIO) return false;  // fue un desplazamiento, no un «atrás»
    return Date.now() - gesto.start <= MAX_TIME;
  }

  // Tras volver, lo que se apartó desaparece con la pantalla de detrás. Si no se ha ido
  // —una salida que pregunta antes, o un paso obligado— regresa a su sitio.
  function landed(view, screenBefore) {
    setTimeout(() => {
      const app = document.getElementById("app");
      const dialog = view.target.id !== "app";
      const gone = dialog
        ? !view.target.isConnected || window.CONTINUUM.topDialog?.()?.overlay !== view.target
        : app?.dataset.screen !== screenBefore || view.pieces.every(piece => !piece.node.isConnected);
      if (gone) {
        // Un diálogo que se cierra se desvanece donde está, fuera de la pantalla; lo que ya
        // no está en el documento no necesita volver a ningún sitio. La copia de detrás se
        // retira ahora, con la pantalla de verdad ya pintada debajo.
        if (!dialog) view.restore();
        return;
      }
      settle(view, 0, () => view.restore());
    }, 60);
  }

  function swallow(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Donde el gesto puede volver, la flecha de arriba sobra en una pantalla táctil: CSS la
  // oculta (sin sacarla del documento, que sigue sirviendo a los lectores de pantalla, al
  // teclado, al botón Atrás de Android y al propio gesto, que la pulsa) mientras `<html>`
  // lleve esta marca. Se recalcula al cambiar de pantalla y al abrir o cerrar un diálogo.
  let pending = false;
  function refresh() {
    pending = false;
    // La página puede haberse cerrado entre el cambio y este recálculo.
    if (typeof document === "undefined" || !document?.documentElement) return;
    document.documentElement.classList.toggle("swipe-back-ready", !!(goBack && surface?.()));
  }
  function scheduleRefresh() {
    if (pending) return;
    pending = true;
    Promise.resolve().then(refresh);
  }
  function watch() {
    const app = document.getElementById("app");
    if (!app || typeof MutationObserver !== "function") return;
    observer = new MutationObserver(observed);
    observer.observe(app, { childList: true, attributes: true, attributeFilter: ["data-screen"], attributeOldValue: true });
    shown = app.dataset.screen || null;
    lastTop = window.scrollY || 0;
    // El evento llega un fotograma después del desplazamiento: cuando se cambia de pantalla
    // y se sube arriba del todo, aquí todavía queda la altura de la que se deja.
    window.addEventListener("scroll", () => { lastTop = window.scrollY || 0; }, { passive: true });
    scheduleRefresh();
  }

  // Los oyentes van en el documento y en fase de captura, para que el gesto no dependa de
  // que ninguna pantalla deje pasar el evento hacia arriba. `target` es opcional: sin él
  // el gesto funciona igual, solo que la pantalla no sigue al dedo. `back` también: dice
  // a qué pantalla llevará «Volver» (su `data-screen`), `null` si no lo sabe y `false`
  // si no lo sabe pero no es la última que se dejó.
  function enableSwipeBack(handler, target = null, back = null) {
    goBack = handler;
    surface = target;
    destination = back;
    scheduleRefresh();
    if (enableSwipeBack.installed) return;
    enableSwipeBack.installed = true;
    watch();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("touchcancel", onTouchEnd, true);
  }

  window.CONTINUUM = window.CONTINUUM || {};
  window.CONTINUUM.enableSwipeBack = enableSwipeBack;
})();
