// Deslizar de izquierda a derecha vuelve a la pantalla de detrás, como en el resto del
// sistema. El gesto no decide a dónde se vuelve: llama al mismo «atrás» que el botón
// «Volver» de cada pantalla y que el botón/gesto Atrás de Android, así que los tres
// caminos no pueden acabar en sitios distintos.
//
// Vive aparte de drag.js porque no se pisan: el arrastre de cartas es solo de ratón (en
// pantalla táctil, deslizar desplaza y tocar selecciona) y esto es solo de dedo. Los dos
// escuchan al documento, así que se registra una sola vez y sobrevive a los repintados.
(function () {
  "use strict";

  // Un gesto de volver es largo, claramente horizontal y hacia la derecha. Los umbrales
  // son exigentes a propósito: un falso positivo aquí no es un adorno de más, es una
  // pantalla que se va sin que nadie la haya pedido.
  const MIN_X = 78;       // recorrido horizontal mínimo del dedo, en píxeles
  const MAX_Y = 56;       // desvío vertical que ya delata un desplazamiento de la página
  const RATIO = 1.8;      // cuánto más horizontal que vertical tiene que ser el recorrido
  const MAX_TIME = 1000;  // un arrastre lento no es un gesto de navegación, es indecisión

  // Lo que se queda el gesto antes de que pueda contar como «atrás»: los controles en los
  // que el dedo ya hace algo horizontal —un deslizador, un campo del que seleccionar
  // texto, la lista de un desplegable— porque ahí el movimiento es de ellos.
  const CONTROLS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

  let gesture = null;
  let goBack = null;

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
    if (target.closest(CONTROLS)) return true;
    for (let node = target; node; node = node.parentElement) {
      if (scroller(node)) return true;
    }
    return false;
  }

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
      x: event.clientX, y: event.clientY, drift: 0, start: Date.now()
    };
  }

  function onMove(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    // El desvío máximo alcanzado, no el final: un gesto que baja y vuelve a subir es un
    // desplazamiento con la mano torcida, y acabaría pareciendo una línea recta.
    gesture.drift = Math.max(gesture.drift, Math.abs(event.clientY - gesture.startY));
  }

  // Se resuelve igual al cancelar: hay navegadores que retiran el puntero en cuanto
  // deciden que el dedo está desplazando la página, y para entonces el recorrido ya está
  // hecho. Si no cumple los umbrales, cancelar sigue sin hacer nada.
  function onUp(event) {
    const gesto = gesture;
    gesture = null;
    if (!gesto || event.pointerId !== gesto.id) return;
    // Arrastrar una carta hasta un hueco es un recorrido horizontal como cualquier otro:
    // si además contara como «atrás», colocar una carta hacia la derecha se llevaría la
    // pantalla por delante. Mientras haya una carta en el dedo, aquí no hay gesto.
    if (document.body.classList.contains("dragging-card")) return;
    // Al soltar vale la posición del propio evento; al cancelar, la última que se vio.
    const x = event.type === "pointerup" ? event.clientX : gesto.x;
    const y = event.type === "pointerup" ? event.clientY : gesto.y;
    const dx = x - gesto.startX;
    const drift = Math.max(gesto.drift, Math.abs(y - gesto.startY));
    if (dx < MIN_X) return;                        // hacia la izquierda, o demasiado corto
    if (drift > MAX_Y || dx < drift * RATIO) return;  // fue un desplazamiento, no un «atrás»
    if (Date.now() - gesto.start > MAX_TIME) return;
    // Tras el gesto el navegador puede disparar un clic sobre lo que hubiera bajo el dedo,
    // y en la pantalla nueva ese clic no significa nada. Se ignora uno, y el oyente se
    // retira en el mismo turno para no comerse el siguiente clic de verdad. Igual que en
    // drag.js: no todos los navegadores lo disparan, así que no se puede esperar sentado.
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
    goBack();
  }

  function swallow(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Los oyentes van en el documento y en fase de captura, para que el gesto no dependa de
  // que ninguna pantalla deje pasar el evento hacia arriba.
  function enableSwipeBack(handler) {
    goBack = handler;
    if (enableSwipeBack.installed) return;
    enableSwipeBack.installed = true;
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  }

  window.CONTINUUM = window.CONTINUUM || {};
  window.CONTINUUM.enableSwipeBack = enableSwipeBack;
})();
