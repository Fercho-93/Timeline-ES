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
    paint.screen = screen;

    container.innerHTML = html;
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
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");
    const titulo = modal.querySelector("h1, h2, h3");
    if (titulo) {
      if (!titulo.id) titulo.id = `dialogo-${++dialogos}`;
      modal.setAttribute("aria-labelledby", titulo.id);
    }

    const previo = document.activeElement;
    focus(focusables(modal)[0] || modal);

    function onKey(event) {
      if (pila.length && pila[pila.length - 1].overlay !== overlay) return;
      if (event.key === "Escape") {
        if (cerrable) { event.preventDefault(); closeDialog(); }
        return;
      }
      if (event.key !== "Tab") return;
      const lista = focusables(modal);
      if (lista.length < 2) { event.preventDefault(); return; }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
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
    dialogo.overlay.remove();
    if (dialogo.previo && dialogo.previo.isConnected) dialogo.previo.focus({ preventScroll: true });
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
