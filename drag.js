// Arrastrar una carta hasta un hueco. Con ratón, desde el primer movimiento.
//
// Con el dedo hay que mantener la carta pulsada un momento antes de arrastrarla, y ese
// momento es justo lo que deja intacto el desplazamiento de la página: si el dedo se
// mueve antes de que la carta se levante, manda el desplazamiento y aquí no pasa nada.
// Solo cuando la carta ya está levantada se le quita el gesto al navegador, y para
// entonces no había ningún desplazamiento en marcha que interrumpir: el dedo llevaba
// quieto toda la espera. Tocar sin más sigue eligiendo la carta, y los huecos «+»
// siguen estando ahí para quien prefiera colocar tocando.
(function () {
  "use strict";

  const MOVE_THRESHOLD = 8;   // píxeles que hay que moverse para que sea un arrastre
  const HOLD = 300;           // lo que hay que mantener pulsada la carta para levantarla
  const HOLD_SLOP = 10;       // cuánto se le perdona al dedo mientras espera, sin cancelar
  const EDGE = 56;            // margen en el que la línea temporal se desplaza sola
  const EDGE_STEP = 14;
  const GHOST_WIDTH = 150;    // la copia que sigue al dedo va encogida, para no tapar la línea
  const LIFT = 16;            // y por encima del dedo, que si no lo tapa él
  const MARGIN = 4;           // aire mínimo entre la copia y el borde de la pantalla
  const RUBBER = .55;         // cuánto cede el borde cuando el dedo empuja más allá
  const VELOCITY_DECAY = .55; // peso del movimiento anterior al estimar la velocidad
  const STILL_MS = 90;        // un dedo parado este rato suelta sin inercia ninguna
  const LEAD_MS = 55;         // el tramo de inercia que la copia conserva al soltarla
  const LEAD_MAX = 56;        // y hasta dónde se le permite llegar
  const SETTLE_SLOT = 190;    // aterrizar en un hueco es respuesta del sistema: rápida
  const SETTLE_BACK = 260;    // volver a la mano es un desenlace: algo más largo
  const EASE_OUT = "cubic-bezier(.22, .61, .36, 1)";  // el mismo --ease-out de styles.css

  let session = null;
  let settling = null;        // la copia que aún está aterrizando del arrastre anterior

  const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // Un borde que cede en vez de frenar en seco. Cuanto más empuja el dedo más allá del
  // límite, menos avanza la copia, sin llegar nunca a despegarse del todo del dedo.
  function rubber(overshoot, dimension) {
    if (overshoot <= 0 || dimension <= 0) return 0;
    return (1 - 1 / (overshoot * RUBBER / dimension + 1)) * dimension;
  }

  // Mantiene la copia dentro de la pantalla, pero por resistencia y no por tope.
  function band(value, min, max, dimension) {
    if (value < min) return min - rubber(min - value, dimension);
    if (value > max) return max + rubber(value - max, dimension);
    return value;
  }

  // Cancelar una animación avisa de que ha terminado, y ese aviso vuelve aquí a retirar
  // la misma copia: se suelta la referencia antes de cancelar para que el segundo paso no
  // se encuentre con el trabajo ya hecho.
  function dropSettling() {
    const pendiente = settling;
    if (!pendiente) return;
    settling = null;
    pendiente.animation?.cancel();
    pendiente.node.remove();
  }

  function cleanup() {
    if (!session) return;
    clearTimeout(session.timer);
    cancelAnimationFrame(session.frame);
    // Si el gesto terminó soltando, la copia ya se ha cedido al aterrizaje y aquí no
    // queda nada que quitar. En cualquier otro final (cancelación, interrupción del
    // sistema) sigue siendo nuestra y se va sin ceremonia.
    session.ghost?.remove();
    session.enabledSlots?.forEach(slot => { if (slot.isConnected) slot.disabled = true; });
    session.card.classList.remove("dragging", "armed", "holding");
    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
    document.body.classList.remove("dragging-card");
    session = null;
  }

  function slotUnder(x, y) {
    if (!session || typeof document.elementFromPoint !== "function") return null;
    // La copia ya tiene pointer-events:none: no hace falta ocultarla (ni forzar un
    // repintado extra) en cada frame para encontrar el hueco que hay debajo.
    const target = document.elementFromPoint(x, y);
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
        // El desplazamiento crece con lo dentro del margen que esté el dedo, en vez de
        // arrancar de golpe a toda velocidad al rozarlo. Al cuadrado, para que rozar el
        // margen apenas mueva la tira y solo el extremo la dispare: así se puede apuntar
        // a un hueco cercano al borde sin que la línea se escape por debajo.
        const depth = edgeDepth(session.x, box);
        if (depth) wrap.scrollLeft += EDGE_STEP * depth * Math.abs(depth);
      }
    }
    moveGhost();
    session.frame = requestAnimationFrame(autoScroll);
  }

  function startDrag() {
    const { card } = session;
    const ghost = card.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.classList.remove("dragging", "armed", "holding", "selected", "selection-enter");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("tabindex", "-1");
    ghost.removeAttribute("disabled");
    const box=card.getBoundingClientRect();
    const scale=Math.min(1,GHOST_WIDTH / Math.max(1,box.width));
    // La copia sale de #app: conservar sus estilos calculados evita que la lámina
    // recupere su tamaño natural al perder los selectores del tablero.
    const sources=[card,...card.querySelectorAll('*')], copies=[ghost,...ghost.querySelectorAll('*')];
    sources.forEach((source,i)=>{
      const computed=getComputedStyle(source);
      for(const property of Array.from(computed)) copies[i].style.setProperty(property,computed.getPropertyValue(property));
    });
    Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',width:`${box.width}px`,height:`${box.height}px`,minWidth:'0',minHeight:'0',margin:'0',overflow:'hidden',transform:`scale(${scale})`,transformOrigin:'top left',pointerEvents:'none',zIndex:'60',transition:'none',animation:'none'});
    document.body.appendChild(ghost);

    const ghostBox = ghost.getBoundingClientRect();
    session.ghost = ghost;
    session.ghostScale = scale;
    session.ghostWidth = ghostBox.width;
    session.ghostHeight = ghostBox.height;
    session.dragging = true;
    card.classList.add("dragging");
    card.classList.remove("armed");
    document.body.classList.add("dragging-card");

    // Los huecos están desactivados mientras no hay carta elegida. Se habilitan aquí y no
    // repintando la pantalla, porque repintar en mitad del gesto destruiría el destino.
    session.enabledSlots = [...document.querySelectorAll(`${session.slotSelector}[disabled]`)];
    session.enabledSlots.forEach(slot => { slot.disabled = false; });

    moveGhost();
    session.frame = requestAnimationFrame(autoScroll);
  }

  // Cuánto se ha metido el puntero en el margen que desplaza la tira: de 0 en el borde
  // del margen a ±1 en el extremo. El signo dice hacia dónde.
  function edgeDepth(x, box) {
    if (x < box.left + EDGE) return -Math.min(1, (box.left + EDGE - x) / EDGE);
    if (x > box.right - EDGE) return Math.min(1, (x - (box.right - EDGE)) / EDGE);
    return 0;
  }

  // La copia va centrada sobre el puntero y algo por encima. Al llegar al borde de la
  // pantalla no se queda clavada: sigue cediendo cada vez menos, como si tirara de una
  // goma. Un tope seco parece que la copia se ha enganchado en algo; así se entiende que
  // es el borde y no un fallo, y no hace falta que la copia se salga para saberlo.
  function ghostPosition() {
    const { ghostWidth: w, ghostHeight: h } = session;
    return {
      left: band(session.x - w / 2, MARGIN, window.innerWidth - w - MARGIN, w),
      top: band(session.y - h - LIFT, MARGIN, window.innerHeight - h - MARGIN, h)
    };
  }

  function moveGhost() {
    const { left, top } = ghostPosition();
    // La copia ya viene encogida desde `startDrag` para no tapar la línea, y su escala
    // tiene que acompañar a cada movimiento o recuperaría su tamaño natural.
    session.ghost.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(-1.5deg) scale(${session.ghostScale})`;
    const slot = slotUnder(session.x, session.y);
    if (slot !== session.slot) {
      session.slot?.classList.remove("drop-target");
      slot?.classList.add("drop-target");
      session.slot = slot;
    }
  }

  // Al soltar, la copia deja de seguir al dedo pero no se desvanece en el aire: llega
  // al hueco elegido, o vuelve a la mano si no se eligió ninguno. Ese recorrido es lo
  // que dice dónde ha ido la carta; sin él, soltar fuera de un hueco parecía perderla.
  // Arranca con el resto de la velocidad que traía el dedo, para que no frene en seco.
  function settle(ghost, from, target, medida, velocity, duration) {
    // La copia de un gesto terminado deja de llamarse como la de uno vivo: así el resto
    // del programa (y quien lea la pantalla) no las confunde.
    ghost.classList.replace("drag-ghost", "drag-settle");
    // Sin animaciones —por preferencia del sistema o porque el navegador no las ofrece—
    // la copia se va en el acto. El estado final de la partida es exactamente el mismo.
    if (!target || reduced() || typeof ghost.animate !== "function") { ghost.remove(); return; }
    // El recorrido habla el mismo idioma que `moveGhost`: posición de la esquina superior
    // izquierda y escala encima. Por eso el centrado usa el tamaño que la copia ocupa en
    // pantalla —ya encogido— y no el que tendría a tamaño natural.
    const to = {
      left: target.left + target.width / 2 - medida.width / 2,
      top: target.top + target.height / 2 - medida.height / 2
    };
    const lead = d => Math.max(-LEAD_MAX, Math.min(LEAD_MAX, d * LEAD_MS));
    const escala = medida.scale;
    const at = (x, y, rot, factor) => `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${escala * factor})`;
    const animation = ghost.animate([
      { transform: at(from.left, from.top, -1.5, 1), opacity: 1 },
      { transform: at(from.left + lead(velocity.x), from.top + lead(velocity.y), -1.1, .98), opacity: .92, offset: .22 },
      { transform: at(to.left, to.top, 0, .92), opacity: 0 }
    ], { duration, easing: EASE_OUT, fill: "forwards" });
    settling = { node: ghost, animation };
    const done = () => { if (settling?.node === ghost) { ghost.remove(); settling = null; } };
    animation.addEventListener?.("finish", done);
    animation.addEventListener?.("cancel", done);
  }

  function onPointerDown(event) {
    if (session || event.button > 0) return;
    if (event.isPrimary === false) return;   // un segundo dedo no arrastra nada
    const card = event.target.closest(this.cardSelector);
    if (!card || card.disabled) return;
    const cardId = Number(card.dataset.id);
    if (!Number.isFinite(cardId)) return;

    const raton = event.pointerType === "mouse";
    session = {
      card, cardId, pointerId: event.pointerId,
      slotSelector: this.slotSelector, onDrop: this.onDrop,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      armed: raton, dragging: false, slot: null, ghost: null, timer: 0, frame: 0,
      // Velocidad del puntero en px/ms, suavizada entre eventos, y cuándo se midió.
      vx: 0, vy: 0, moveT: event.timeStamp
    };
    // Empezar un arrastre interrumpe el aterrizaje del anterior: dos copias en pantalla
    // a la vez no cuentan ninguna historia.
    dropSettling();
    // Con el dedo, la carta se levanta al mantenerla pulsada. Hasta que eso pasa, el
    // navegador es dueño del gesto y desplazar la página funciona como siempre.
    if (raton) return;
    card.classList.add("holding");
    session.timer = setTimeout(() => {
      if (!session) return;
      session.armed = true;
      session.card.classList.remove("holding");
      // Un toque corto avisa de que la carta ya va en el dedo; sin él no hay manera de
      // saber que ha terminado la espera sin mirar fijamente la pantalla.
      window.CONTINUUM.Effects?.tap?.();
      try { session.card.setPointerCapture(session.pointerId); } catch { /* el puntero ya no está */ }
      startDrag();
    }, HOLD);
  }

  function onPointerMove(event) {
    if (!session || event.pointerId !== session.pointerId) return;
    // La velocidad se estima antes de mover nada, con la distancia recorrida desde el
    // evento anterior. Se suaviza entre muestras porque un dedo real llega a saltos y un
    // único evento tardío daría una velocidad absurda justo al soltar.
    const dt = event.timeStamp - session.moveT;
    if (dt > 0) {
      const w = VELOCITY_DECAY;
      session.vx = session.vx * w + ((event.clientX - session.x) / dt) * (1 - w);
      session.vy = session.vy * w + ((event.clientY - session.y) / dt) * (1 - w);
      session.moveT = event.timeStamp;
    }
    session.x = event.clientX;
    session.y = event.clientY;
    const moved = Math.hypot(session.x - session.startX, session.y - session.startY);

    if (!session.armed) {
      // Moverse durante la espera es desplazar la página, no arrastrar: se suelta la
      // carta y no se vuelve a intentar hasta el siguiente toque. El margen es pequeño
      // porque un dedo quieto nunca lo está del todo.
      if (moved > HOLD_SLOP) cleanup();
      return;
    }
    if (!session.dragging) {
      if (moved <= MOVE_THRESHOLD) return;
      event.preventDefault();
      try { session.card.setPointerCapture(session.pointerId); } catch { /* el puntero ya no está */ }
      startDrag();
      return;
    }
    event.preventDefault();
    // El frame de autoScroll dibuja la última posición una vez por refresco, aunque el
    // móvil emita varios pointermove. También actualiza el destino al desplazar la tira.
  }

  // Lo que de verdad impide que la página se desplace bajo una carta ya levantada: el
  // navegador solo respeta `preventDefault` en el primer `touchmove` del gesto, y aquí
  // llega intacto porque durante la espera el dedo no se movió. `pointermove` no sirve
  // para esto: el navegador no lo deja cancelar una vez ha decidido desplazar.
  function onTouchMove(event) {
    if (session?.armed && event.cancelable) event.preventDefault();
  }

  function onPointerUp(event) {
    if (!session || event.pointerId !== session.pointerId) return;
    let ghost = null, from = null, target = null, medida = null, velocity = { x: 0, y: 0 }, duration = 0;
    if (session.dragging) {
      session.x = event.clientX;
      session.y = event.clientY;
      moveGhost(); // no depende de que llegue otro frame entre el último movimiento y soltar
      // El destino se mide ahora, antes de que `onDrop` repinte la partida y se lleve por
      // delante el hueco al que la copia tiene que llegar.
      target = (session.slot || session.card).getBoundingClientRect();
      duration = session.slot ? SETTLE_SLOT : SETTLE_BACK;
      from = ghostPosition();
      // La sesión se borra en `cleanup`, así que lo que el recorrido necesite se copia ya.
      medida = { width: session.ghostWidth, height: session.ghostHeight, scale: session.ghostScale };
      // Un dedo que llevaba un rato quieto suelta sin inercia, por mucho que antes
      // hubiera venido lanzado: la carta se posa donde se dejó, no sale disparada.
      if (event.timeStamp - session.moveT < STILL_MS) velocity = { x: session.vx, y: session.vy };
      ghost = session.ghost;
      session.ghost = null;   // deja de ser del gesto: a partir de aquí solo aterriza
    }
    const { dragging, slot, cardId, onDrop } = session;
    cleanup();
    if (ghost) settle(ghost, from, target, medida, velocity, duration);
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
    document.addEventListener("pointerdown", at("down"));
    document.addEventListener("pointermove", at("move"), { passive: false });
    document.addEventListener("pointerup", at("up"));
    document.addEventListener("pointercancel", () => { dropSettling(); cleanup(); });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
  }

  window.CONTINUUM = window.CONTINUUM || {};
  window.CONTINUUM.enableDrag = enableDrag;
})();
