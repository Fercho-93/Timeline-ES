// Arrastrar una carta hasta un hueco, como alternativa a tocar la carta y luego el hueco.
// Las dos formas conviven: un toque corto sigue seleccionando.
//
// Se usa Pointer Events y no la API de arrastre de HTML5, que no existe en los
// navegadores móviles. Y el arranque del gesto es distinto según el dispositivo:
//
// - Con ratón basta mover unos píxeles, que es lo natural en un escritorio.
// - Con el dedo hace falta mantener pulsado un instante. Si empezáramos al primer
//   movimiento habría que renunciar al desplazamiento de la página con el dedo sobre
//   una carta, y las cartas ocupan media pantalla. Con la pulsación previa, un
//   deslizamiento rápido sigue moviendo la página y solo la pulsación sostenida arrastra.
(function () {
  "use strict";

  const MOVE_THRESHOLD = 8;   // píxeles que hay que moverse para que sea un arrastre
  const TOUCH_HOLD = 160;     // milisegundos de pulsación antes de arrastrar con el dedo
  const EDGE = 56;            // margen en el que la línea temporal se desplaza sola
  const EDGE_STEP = 14;
  const GHOST_WIDTH = 150;    // la copia que sigue al dedo va encogida, para no tapar la línea
  const LIFT = 16;            // y por encima del dedo, que si no lo tapa él

  let session = null;

  function cleanup() {
    if (!session) return;
    clearTimeout(session.timer);
    cancelAnimationFrame(session.frame);
    session.ghost?.remove();
    session.card.classList.remove("dragging", "armed");
    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
    document.body.classList.remove("dragging-card");
    session = null;
  }

  function slotUnder(x, y) {
    if (!session) return null;
    session.ghost.style.visibility = "hidden";
    const target = document.elementFromPoint(x, y);
    session.ghost.style.visibility = "";
    return target?.closest(session.slotSelector) || null;
  }

  // Al arrastrar hacia un borde de la línea temporal, esta se desplaza sola: la línea es
  // más ancha que la pantalla y si no, los huecos del extremo quedarían fuera de alcance.
  function autoScroll() {
    if (!session || !session.dragging) return;
    const wrap = document.querySelector(".timeline-wrap");
    if (wrap && wrap.scrollWidth > wrap.clientWidth) {
      const box = wrap.getBoundingClientRect();
      if (session.y > box.top && session.y < box.bottom) {
        if (session.x < box.left + EDGE) wrap.scrollLeft -= EDGE_STEP;
        else if (session.x > box.right - EDGE) wrap.scrollLeft += EDGE_STEP;
      }
    }
    session.frame = requestAnimationFrame(autoScroll);
  }

  function startDrag() {
    const { card } = session;
    const ghost = card.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.classList.remove("dragging", "armed");
    ghost.removeAttribute("disabled");
    ghost.style.width = `${Math.min(card.getBoundingClientRect().width, GHOST_WIDTH)}px`;
    document.body.appendChild(ghost);

    const ghostBox = ghost.getBoundingClientRect();
    session.ghost = ghost;
    session.ghostWidth = ghostBox.width;
    session.ghostHeight = ghostBox.height;
    session.dragging = true;
    card.classList.add("dragging");
    card.classList.remove("armed");
    document.body.classList.add("dragging-card");

    // Los huecos están desactivados mientras no hay carta elegida. Se habilitan aquí y no
    // repintando la pantalla, porque repintar en mitad del gesto destruiría el destino.
    document.querySelectorAll(`${session.slotSelector}[disabled]`).forEach(slot => { slot.disabled = false; });

    moveGhost();
    session.frame = requestAnimationFrame(autoScroll);
  }

  // La copia va centrada sobre el puntero y algo por encima, y nunca se sale de la
  // pantalla: en un móvil estrecho, arrastrar al primer hueco la dejaría medio fuera.
  function moveGhost() {
    const { ghostWidth: w, ghostHeight: h } = session;
    const left = Math.min(Math.max(4, session.x - w / 2), window.innerWidth - w - 4);
    const top = Math.min(Math.max(4, session.y - h - LIFT), window.innerHeight - h - 4);
    session.ghost.style.left = `${left}px`;
    session.ghost.style.top = `${top}px`;
    const slot = slotUnder(session.x, session.y);
    if (slot !== session.slot) {
      session.slot?.classList.remove("drop-target");
      slot?.classList.add("drop-target");
      session.slot = slot;
    }
  }

  function onPointerDown(event) {
    if (session || event.button > 0) return;
    const card = event.target.closest(this.cardSelector);
    if (!card || card.disabled) return;
    const cardId = Number(card.dataset.id);
    if (!Number.isFinite(cardId)) return;

    session = {
      card, cardId, pointerId: event.pointerId,
      slotSelector: this.slotSelector, onDrop: this.onDrop,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      armed: event.pointerType === "mouse", dragging: false, slot: null, ghost: null, timer: 0, frame: 0
    };

    if (!session.armed) {
      session.timer = setTimeout(() => {
        if (!session || session.dragging) return;
        session.armed = true;
        session.card.classList.add("armed");
        try { session.card.setPointerCapture(session.pointerId); } catch { /* el puntero ya no está */ }
      }, TOUCH_HOLD);
    }
  }

  function onPointerMove(event) {
    if (!session || event.pointerId !== session.pointerId) return;
    session.x = event.clientX;
    session.y = event.clientY;
    const moved = Math.hypot(session.x - session.startX, session.y - session.startY);

    if (!session.dragging) {
      // Con el dedo, moverse antes de que la pulsación cuaje significa desplazar la
      // página: se abandona el gesto y el navegador sigue con lo suyo.
      if (!session.armed) { if (moved > MOVE_THRESHOLD) cleanup(); return; }
      if (moved <= MOVE_THRESHOLD) return;
      event.preventDefault();
      try { session.card.setPointerCapture(session.pointerId); } catch { /* el puntero ya no está */ }
      startDrag();
      return;
    }
    event.preventDefault();
    moveGhost();
  }

  function onPointerUp(event) {
    if (!session || event.pointerId !== session.pointerId) return;
    const { dragging, slot, cardId, onDrop } = session;
    cleanup();
    if (!dragging) return;          // fue un toque: que siga su curso y seleccione
    // Tras un arrastre el navegador suele disparar un clic sobre lo que haya debajo; se
    // ignora, para que soltar fuera de un hueco no acabe seleccionando otra cosa. Pero
    // no siempre lo dispara, según dónde empezara y acabara el gesto, así que el oyente
    // se retira solo en cuanto pasa el turno: si se quedara esperando se comería el
    // siguiente clic de verdad, que es el de confirmar la jugada.
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
    // Soltar fuera de un hueco no es un error: la carta se queda elegida, como si se
    // hubiera tocado. Repintar además devuelve los huecos a su estado real.
    onDrop(cardId, slot ? Number(slot.dataset.index) : null);
  }

  function swallow(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Se llama después de cada repintado. Los oyentes van en el documento, así que se
  // registran una sola vez y siguen valiendo aunque la pantalla se vuelva a pintar entera.
  function enableDrag(options) {
    if (enableDrag.installed) { enableDrag.options = options; return; }
    enableDrag.installed = true;
    enableDrag.options = options;
    const at = name => event => {
      if (!enableDrag.options) return;
      ({ down: onPointerDown, move: onPointerMove, up: onPointerUp })[name].call(enableDrag.options, event);
    };
    // Con el dedo no basta con cancelar el `pointermove`: el navegador decide desplazar
    // la página a partir del evento táctil, así que hay que frenar ese. Solo se frena
    // cuando la pulsación ya ha cuajado; antes, deslizar sigue moviendo la página.
    document.addEventListener("touchmove", event => {
      if (session && (session.armed || session.dragging) && event.cancelable) event.preventDefault();
    }, { passive: false });
    document.addEventListener("pointerdown", at("down"));
    document.addEventListener("pointermove", at("move"), { passive: false });
    document.addEventListener("pointerup", at("up"));
    document.addEventListener("pointercancel", () => cleanup());
  }

  window.CONTINUUM = window.CONTINUUM || {};
  window.CONTINUUM.enableDrag = enableDrag;
})();
