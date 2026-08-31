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
  const KEYS = ["data-action", "data-online-action", "data-id", "data-index", "data-mode", "data-block"];

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
    olvidaDialogos(container);
    const activo = document.activeElement;
    const dentro = activo && activo !== container && container.contains(activo);
    const clave = dentro ? selectorFor(activo) : null;
    const primero = paint.screen === undefined;
    const cambioDePantalla = screen !== paint.screen;
    const cartaElegida = container.querySelector(".hand-card.selected")?.dataset.id || null;
    const confirmacionAnterior = container.querySelector(".slot-confirm")?.dataset.index ?? null;
    actualizaAnclas(container);
    paint.screen = screen;

    container.innerHTML = html;
    // La entrada visual se limita a cambios de pantalla: una jugada repinta la mesa
    // muchas veces y no debe convertir cada toque en una animación.
    if (!primero && cambioDePantalla) container.firstElementChild?.classList.add("screen-enter");
    // Dentro de una partida no se anima el repintado entero: solo el elemento que acaba
    // de cambiar de estado. Así el movimiento explica la acción en lugar de decorar cada
    // toque con el mismo efecto.
    if (!cambioDePantalla) {
      const nuevaCarta = container.querySelector(".hand-card.selected");
      if (nuevaCarta && nuevaCarta.dataset.id !== cartaElegida) nuevaCarta.classList.add("selection-enter");
      const nuevaConfirmacion = container.querySelector(".slot-confirm");
      if (nuevaConfirmacion && nuevaConfirmacion.dataset.index !== confirmacionAnterior) nuevaConfirmacion.classList.add("placement-enter");
    }
    restauraAnclas(container);
    if (primero) return;
    if (cambioDePantalla) {
      // Sin preventScroll: al cambiar de pantalla queremos que suba al titular.
      if (focus(container.querySelector("[data-focus]"))) return;
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

  function focusables(modal) {
    return [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && !el.hasAttribute("hidden"));
  }

  function openDialog(overlay, cerrable) {
    if (!overlay) return;
    const modal = overlay.querySelector(".modal") || overlay;
    overlay.classList.add("dialog-enter");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");
    const titulo = modal.querySelector("h1, h2, h3");
    if (titulo) {
      if (!titulo.id) titulo.id = `dialogo-${++dialogos}`;
      modal.setAttribute("aria-labelledby", titulo.id);
    }

    const previo = document.activeElement;
    // Una guía larga debe abrir por su título, no desplazarse hasta «Entendido».
    const lectura = titulo && modal.querySelector(".guide-content");
    if (lectura) titulo.setAttribute("tabindex", "-1");
    focus(lectura ? titulo : (focusables(modal)[0] || modal), { preventScroll: true });

    function onKey(event) {
      if (pila.length && pila[pila.length - 1].overlay !== overlay) return;
      if (event.key === "Escape") {
        if (cerrable) { event.preventDefault(); closeDialog(); }
        return;
      }
      if (event.key !== "Tab") return;
      const lista = focusables(modal);
      if (!lista.length) { event.preventDefault(); return; }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!lista.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? ultimo : primero).focus(); }
      else if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
    }
    document.addEventListener("keydown", onKey);
    pila.push({ overlay, previo, onKey });
  }

  // Cierra el diálogo de arriba y devuelve el foco a quien lo abrió.
  function closeDialog() {
    const dialogo = pila.pop();
    if (!dialogo) return;
    document.removeEventListener("keydown", dialogo.onKey);
    const anteriorEnPila = pila[pila.length - 1];
    const termina = () => {
      if (!dialogo.overlay.isConnected) return;
      dialogo.overlay.remove();
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
      document.removeEventListener("keydown", pila[i].onKey);
      pila.splice(i, 1);
    }
  }

  window.CONTINUUM = window.CONTINUUM || {};
  window.CONTINUUM.paint = paint;
  window.CONTINUUM.announce = announce;
  window.CONTINUUM.openDialog = openDialog;
  window.CONTINUUM.closeDialog = closeDialog;
})();
