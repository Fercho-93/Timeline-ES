// Presentación compartida: nunca escribe el estado ni decide el resultado de una jugada.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const playing = new Set(['game', 'solo', 'cifras', 'online-game', 'local-game', 'pass', 'pulse-pass', 'final-local', 'online-final', 'comp-intro', 'tournament-intro', 'online-competition-intro', 'quick-game', 'quick-lobby']);
  const board = new Set(['game', 'solo', 'online-game', 'local-game', 'quick-game']);
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const icons = {
    back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
    book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
    atlas: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
    profile: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5.5 21v-1.5a6.5 6.5 0 0 1 13 0V21"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  function header(back = '', menu = '', inGame = false, title = '') {
    // La tercera columna es una fila propia, no una sola celda: así aloja el interruptor
    // de sonido y, cuando lo hay, el botón de menú, sin que ninguno de los dos tenga que
    // adivinar el sitio del otro.
    return `<header class="topbar atlas-topbar${inGame ? ' atlas-game-topbar' : ''}">
      ${back ? `<button class="icon-btn atlas-back" ${back} aria-label="Volver a la pantalla anterior">${icon('back')}</button>` : '<span></span>'}
      ${inGame ? (title ? `<div class="topbar-title">${title}</div>` : '<span></span>') : '<div class="brand">Continuum</div>'}
      <div class="atlas-topbar-actions"><i data-sound-slot></i>${menu ? `<button class="icon-btn atlas-menu" ${menu} aria-label="Opciones de la partida" aria-haspopup="dialog">${icon('more')}</button>` : ''}</div>
    </header>`;
  }
  function nav(screen) {
    return `<nav class="home-nav atlas-nav" aria-label="Menú principal">${[
      ['home-top', 'home', 'Inicio', ['home']], ['perfil', 'atlas', 'Atlas', ['perfil']], ['rules', 'guide', 'Guía', ['guide']], ['settings', 'settings', 'Ajustes', ['settings']]
    ].map(([action, symbol, label, current]) => `<button aria-label="${label}" ${action === 'settings' ? 'data-settings-action="open"' : `data-action="${action}"`}${current.includes(screen) ? ' aria-current="page"' : ''}><span>${icon(symbol)}</span><small>${label}</small></button>`).join('')}</nav>`;
  }
  // `discard` es opcional: cuando lo hay, añade un tercer botón para salir sin guardar
  // nada, sin pasar por el guardado que hace `proceed`. Vive en el mismo diálogo que
  // «Guardar y salir» para que salir de una partida ofrezca siempre las dos salidas
  // juntas, en vez de esconder la de no guardar en otro menú.
  function confirmExit(message, proceed, title = '¿Salir de la partida?', label = 'Guardar y salir', discard = null) {
    const app = document.getElementById('app');
    if (app.querySelector('[data-exit-dialog]')) return;
    const layer = document.createElement('div'); layer.className = 'overlay'; layer.dataset.exitDialog = '';
    layer.innerHTML = `<div class="modal"><h2>${CT.escapeHtml(title)}</h2><p>${CT.escapeHtml(message)}</p><div class="actions exit-actions"><button class="btn btn-primary btn-block" data-exit-stay>Seguir jugando</button><button class="btn btn-secondary btn-block" data-exit-confirm>${CT.escapeHtml(label)}</button>${discard ? `<button class="btn btn-ghost btn-block exit-discard" data-exit-discard>${CT.escapeHtml(discard.label)}</button>` : ''}</div></div>`;
    layer.querySelector('[data-exit-stay]').addEventListener('click', () => CT.closeDialog());
    layer.querySelector('[data-exit-confirm]').addEventListener('click', () => { CT.closeDialog(); proceed(); });
    layer.querySelector('[data-exit-discard]')?.addEventListener('click', () => { CT.closeDialog(); discard.proceed(); });
    app.append(layer); CT.openDialog(layer, true);
  }
  // Pregunta con el estilo del juego en lugar del `confirm()` del navegador (blanco, sin
  // estilo y bloqueado en algunas vistas web). «Quedarse» es siempre la opción principal;
  // cada acción cierra el diálogo antes de ejecutarse. `kind: 'ghost'` marca la salida más
  // drástica, con el mismo aspecto que «Salir sin guardar».
  function askDialog({ title = '¿Seguro?', message = '', stay = 'Cancelar', actions = [] } = {}) {
    const app = document.getElementById('app');
    if (!app || app.querySelector('[data-exit-dialog]')) return;
    const layer = document.createElement('div'); layer.className = 'overlay'; layer.dataset.exitDialog = '';
    layer.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true"><h2>${CT.escapeHtml(title)}</h2>${message ? `<p>${CT.escapeHtml(message)}</p>` : ''}<div class="actions exit-actions"><button class="btn btn-primary btn-block" data-ask-stay>${CT.escapeHtml(stay)}</button>${actions.map((action, i) => `<button class="btn ${action.kind === 'ghost' ? 'btn-ghost exit-discard' : 'btn-secondary'} btn-block" data-ask-action="${i}">${CT.escapeHtml(action.label)}</button>`).join('')}</div></div>`;
    layer.querySelector('[data-ask-stay]').addEventListener('click', () => CT.closeDialog());
    layer.querySelectorAll('[data-ask-action]').forEach(button => button.addEventListener('click', () => { CT.closeDialog(); actions[Number(button.dataset.askAction)].proceed(); }));
    app.append(layer); CT.openDialog(layer, true);
  }
  // Pulso, segundo paso: quien reta elige de su mano la carta que pasaría al rival si acierta él y falla
  // el rival. Se elige antes de colocar y ya no se cambia. `cards` es [{ id, title }].
  function pulseGiftDialog({ cards = [], targetName = 'tu rival', onPick } = {}) {
    const app = document.getElementById('app');
    if (!app || !cards.length) return;
    const layer = document.createElement('div'); layer.className = 'overlay'; layer.dataset.pulseGiftDialog = '';
    layer.innerHTML = `<div class="modal"><div class="eyebrow">Pulso</div><h2>¿Qué carta podrías pasar?</h2><p class="lead" style="margin-inline:auto">Si aciertas tú y falla ${CT.escapeHtml(targetName)}, se la pasas. La eliges ahora, antes de colocar, y no se cambia.</p><div class="actions" style="display:grid;margin-top:6px">${cards.map((card, i) => `<button class="btn btn-secondary btn-block" data-pulse-gift="${i}"><b>${CT.escapeHtml(card.title)}</b></button>`).join('')}</div><button class="btn btn-ghost btn-block" style="margin-top:10px" data-pulse-gift-cancel>Mejor no</button></div>`;
    layer.querySelector('[data-pulse-gift-cancel]').addEventListener('click', () => CT.closeDialog());
    layer.querySelectorAll('[data-pulse-gift]').forEach(button => button.addEventListener('click', () => { CT.closeDialog(); onPick?.(cards[Number(button.dataset.pulseGift)].id); }));
    app.append(layer); CT.openDialog(layer, true);
  }
  // El caso más común: aceptar o cancelar.
  function confirmDialog(message, proceed, { title = '¿Seguro?', confirmLabel = 'Aceptar', cancelLabel = 'Cancelar' } = {}) {
    askDialog({ title, message, stay: cancelLabel, actions: [{ label: confirmLabel, proceed }] });
  }
  let finalCards = [];
  function captureBoard(container) {
    const cards = [...container.querySelectorAll('.timeline .timeline-card')];
    if (cards.length) finalCards = cards.slice(-7).map(card => card.cloneNode(true));
    captureHand(container);
  }

  // ── Cambio de turno con la mano que pasa ─────────────────────────────────────────
  // Al pasar el móvil, la mano de quien acaba baja y sale de la pantalla mientras sube
  // la tarjeta del siguiente; al empezar su turno, su mano sube desde abajo. Las cartas
  // solo tienen su aspecto dentro de la mesa (sus reglas dependen de #app.atlas-board),
  // así que para verlas caer sobre la pantalla de paso se copian con su estilo ya
  // calculado: son un recuerdo de la mesa, no la mesa.
  let lastScreen = null, outgoingHand = null;
  const HAND_STYLE = ['width', 'height', 'box-sizing', 'padding', 'margin', 'border', 'border-radius', 'background-color',
    'background-image', 'background-size', 'background-position', 'background-repeat', 'box-shadow', 'color', 'font-family',
    'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'display',
    'flex-direction', 'align-items', 'align-content', 'justify-content', 'justify-items', 'place-items', 'gap', 'position',
    'top', 'right', 'bottom', 'left', 'overflow', 'opacity', 'object-fit', 'max-width', 'max-height', 'min-height',
    'outline', 'outline-offset', 'white-space', 'overflow-wrap', '-webkit-line-clamp', '-webkit-box-orient', 'z-index',
    'justify-self', 'align-self', 'grid-template-columns', 'grid-template-rows', 'grid-area', 'flex', 'order', 'filter',
    'object-position', 'aspect-ratio', 'min-width', 'margin-inline', 'translate', 'scale'];
  function frozenCopy(source) {
    const copy = source.cloneNode(true);
    const pairs = [[source, copy]];
    const originals = source.querySelectorAll('*'), copies = copy.querySelectorAll('*');
    originals.forEach((node, i) => pairs.push([node, copies[i]]));
    pairs.forEach(([from, to], i) => {
      const style = getComputedStyle(from);
      to.removeAttribute('id'); to.removeAttribute('class');
      HAND_STYLE.forEach(name => to.style.setProperty(name, style.getPropertyValue(name)));
      // La postura de la carta la pone el vuelo; la de lo que lleva dentro se conserva.
      if (i) to.style.setProperty('transform', style.getPropertyValue('transform'));
    });
    return copy;
  }
  // Se guarda la última mano visible de la mesa. Al llegar la pantalla de paso la mano
  // ya está oculta tras el resultado, así que vale la foto del repintado anterior. Solo se
  // rehace cuando cambian las cartas: copiar estilos en cada toque sería trabajo de más.
  function captureHand(container) {
    if (lastScreen !== 'game' || reduced() || typeof DOMMatrixReadOnly !== 'function') { outgoingHand = null; return; }
    const cards = [...container.querySelectorAll('.hand .hand-card')]
      .filter(card => getComputedStyle(card).visibility !== 'hidden' && card.getBoundingClientRect().width);
    if (!cards.length) return;
    const key = cards.map(card => card.dataset.id).join('|');
    if (outgoingHand?.key === key) return;
    outgoingHand = {key, cards: cards.slice(0, 7).map(card => {
      const box = card.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform);
      return {copy: frozenCopy(card), box, width: card.offsetWidth, height: card.offsetHeight,
        angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, scale: Math.hypot(matrix.a, matrix.b) || 1};
    })};
  }
  function handOff(container, screen) {
    const previous = lastScreen;
    lastScreen = screen;
    if (reduced()) return;
    if (screen !== 'game' && screen !== 'pass') outgoingHand = null;
    if (screen === 'pass' && previous === 'game' && outgoingHand) {
      const leaving = outgoingHand; outgoingHand = null;
      const layer = document.createElement('div');
      layer.className = 'hand-handoff'; layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
      const flights = leaving.cards.map(({copy, box, width, height, angle, scale}, i) => {
        Object.assign(copy.style, {position: 'fixed', margin: '0', zIndex: '90', pointerEvents: 'none',
          left: `${box.left + box.width / 2 - width / 2}px`, top: `${box.top + box.height / 2 - height / 2}px`,
          width: `${width}px`, height: `${height}px`});
        layer.append(copy);
        const start = `rotate(${angle}deg) scale(${scale})`;
        const drift = (i - (leaving.cards.length - 1) / 2) * 26;
        return copy.animate([
          {transform: `translateY(0) ${start}`, opacity: 1},
          {transform: `translateY(-14px) ${start}`, opacity: 1, offset: .18},
          {transform: `translate(${drift}px, ${window.innerHeight - box.top + 40}px) rotate(${angle + drift / 3}deg) scale(${scale * .92})`, opacity: .9}
        ], {duration: 640, delay: i * 55, easing: 'cubic-bezier(.45,0,.75,.4)', fill: 'both'});
      });
      Promise.all(flights.map(flight => flight.finished)).then(() => layer.remove(), () => layer.remove());
      container.querySelector('.pass-card')?.classList.add('turn-arrive');
      return;
    }
    if (screen === 'game' && previous === 'pass') {
      (window.requestAnimationFrame || (fn => setTimeout(fn, 0)))(() => {
        const cards = [...container.querySelectorAll('.hand .hand-card')]
          .filter(card => getComputedStyle(card).visibility !== 'hidden');
        cards.forEach((card, i) => card.animate?.([
          {translate: `0 ${window.innerHeight * .6}px`, rotate: `${(i % 2 ? 1 : -1) * 9}deg`, opacity: 0},
          {translate: '0 0', rotate: '0deg', opacity: 1}
        ], {duration: 620, delay: 120 + i * 70, easing: 'cubic-bezier(.3,1.35,.5,1)', fill: 'backwards'}));
      });
    }
  }
  function atlasFinal(container) {
    const panel = container.querySelector('.pass-screen .panel, .panel');
    if (!panel || panel.querySelector('.atlas-final-fan')) return;
    panel.classList.add('atlas-final-page');
    const fan = document.createElement('div');
    fan.className = 'atlas-final-fan'; fan.setAttribute('aria-hidden', 'true'); fan.inert = true;
    finalCards.forEach((source, index) => {
      const card = source.cloneNode(true);
      card.removeAttribute('style'); card.classList.remove('card-fitting', 'is-flipped');
      card.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      card.removeAttribute('id'); card.removeAttribute('tabindex');
      card.style.setProperty('--fan-angle', `${(index - (finalCards.length - 1) / 2) * 10}deg`);
      card.style.setProperty('--fan-x', `${(index - (finalCards.length - 1) / 2) * 22}px`);
      card.style.setProperty('--fan-start', `${(index - (finalCards.length - 1) / 2) * 95}px`);
      fan.append(card);
    });
    if (finalCards.length) panel.prepend(fan);
    lightScore(panel, fan);
  }
  // La puntuación se ilumina por partes, como el recuento de Calico o de Wingspan: cuando
  // el abanico ya se ha reunido, cada carta se levanta y se dora una tras otra, y el
  // contador sube al mismo ritmo hasta la cifra final, que se sella. Es solo la manera de
  // contarlo: la cifra es la de siempre y al terminar queda exactamente igual.
  function lightScore(panel, fan) {
    const score = panel.querySelector('.final-score strong');
    const cards = [...fan.children];
    const target = Number(score?.textContent);
    if (reduced() || !cards.length) return;
    const counts = score && Number.isInteger(target) && target > 0;
    const original = score?.textContent;
    if (counts) { score.textContent = '0'; score.setAttribute('aria-hidden', 'true'); }
    const start = 820, gap = Math.max(150, Math.min(300, 1900 / cards.length));
    cards.forEach((card, i) => setTimeout(() => {
      if (!card.isConnected) return;
      card.classList.add('final-lit');
      if (counts && score.isConnected) {
        score.textContent = String(Math.round(target * (i + 1) / cards.length));
        score.animate?.([{transform: 'scale(1.18)'}, {transform: 'none'}], {duration: 220, easing: 'ease-out'});
      }
    }, start + i * gap));
    setTimeout(() => {
      if (!score?.isConnected) return;
      score.textContent = original; score.removeAttribute('aria-hidden');
      score.closest('.final-score')?.classList.add('final-score-sealed');
    }, start + cards.length * gap + 120);
  }
  function scrollVeil(surface, scroller = surface) {
    let veil = surface.querySelector(':scope > .atlas-scroll-veil');
    if (!veil) {
      veil = document.createElement('div');
      veil.className = 'atlas-scroll-veil';
      veil.setAttribute('aria-hidden', 'true');
      surface.prepend(veil);
    }
    const update = () => veil.classList.toggle('is-visible', scroller.scrollTop > 8);
    scroller.addEventListener('scroll', update, {passive: true});
    update();
    return veil;
  }
  function refreshProfileVeil() {
    const veil = document.querySelector('#app[data-screen="perfil"] .atlas-profile-veil');
    veil?.classList.toggle('is-visible', window.scrollY > 8);
  }
  window.addEventListener('scroll', refreshProfileVeil, {passive: true});
  // Convierte cada modo de solitario en un desplegable: cerrados de entrada, con un único
  // abierto a la vez. Vive aquí, y no en quien pinta la pantalla, para que ya estén
  // plegados antes de que cualquier transición fotografíe el destino.
  // Con una sola opción en pantalla no hay nada entre lo que elegir: se deja abierta.
  function foldSoloPanels(container) {
    const panels = container.querySelectorAll(".solo-panel:not(.solo-fold)");
    if (panels.length + container.querySelectorAll(".solo-fold").length < 2) return;
    panels.forEach(panel => {
      const details = document.createElement("details");
      details.className = "panel solo-panel solo-fold";
      details.name = "solo-options";
      const summary = document.createElement("summary");
      const heading = panel.querySelector(".solo-panel-head");
      const kind = panel.querySelector('[data-action="start-free"]') ? 'free' : panel.querySelector('[data-action="start-duel"]') ? 'duel' : 'daily';
      details.dataset.soloKind = kind;
      const marks = {daily:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',free:'<rect x="7" y="4" width="13" height="17" rx="2"/><path d="M4 17V3h12M11 9h5m-5 4h5"/>',duel:'<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1"/>'};
      const mark = document.createElement('span'); mark.className = 'solo-option-mark'; mark.setAttribute('aria-hidden','true');
      mark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${marks[kind]}</svg>`;
      summary.append(mark);
      const copy = document.createElement('span'); copy.className = 'solo-option-copy'; copy.append(...heading.childNodes);
      const caption = document.createElement('small'); caption.textContent = {daily:'Un reto distinto cada día',free:'A tu ritmo y a tu nivel',duel:'Las mismas cartas, otro rival'}[kind]; copy.append(caption); summary.append(copy);
      heading.remove();
      details.append(summary);
      const body = document.createElement("div");
      body.className = "solo-fold-body";
      body.append(...panel.childNodes);
      details.append(body);
      panel.replaceWith(details);
      details.addEventListener("toggle", () => {
        if (details.open) {
          container.querySelectorAll(".solo-fold").forEach(other => { if (other !== details) other.open = false; });
          (window.requestAnimationFrame || (fn => setTimeout(fn, 0)))(() => { if (details.isConnected && details.open) details.scrollIntoView?.({block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); });
        }
      });
    });
  }
  let previousFan = null;
  const cardTextSelector = '.hand-card > strong, .timeline-card h3, .timeline-card .card-content p, .slot-confirm-card strong, .card-category';
  function fitCardText(container) {
    if (!container) return;
    container.querySelectorAll(cardTextSelector).forEach(text => {
      text.style.removeProperty('font-size');
      if (!text.clientWidth || !text.clientHeight) return; // cartas ocultas
      const base = parseFloat(getComputedStyle(text).fontSize);
      const card = text.closest('.hand-card');
      const availableHeight = card && text.offsetParent === card
        ? Math.max(1, card.clientHeight - text.offsetTop - parseFloat(getComputedStyle(card).paddingBottom || 0))
        : Infinity;
      const fits = () => text.scrollWidth <= text.clientWidth && text.scrollHeight <= Math.min(text.clientHeight, availableHeight);
      if (!base || fits()) return;
      // Busca el mayor tamaño que permite saltar entre palabras, sin desbordar el recuadro.
      let low = 1, high = base;
      for (let step = 0; step < 10; step++) {
        const size = (low + high) / 2;
        text.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      text.style.fontSize = `${low}px`;
    });
  }
  let cardTextFrame = 0;
  function scheduleCardText(container = document.getElementById('app')) {
    if (!window.requestAnimationFrame) { fitCardText(container); return; }
    window.cancelAnimationFrame?.(cardTextFrame);
    cardTextFrame = window.requestAnimationFrame(() => fitCardText(container));
  }
  window.addEventListener('resize', () => scheduleCardText(), {passive: true});
  window.visualViewport?.addEventListener('resize', () => scheduleCardText(), {passive: true});
  document.fonts?.ready.then(() => scheduleCardText());
  // Una carta girada revela otro texto que también necesita medirse cuando ya es visible.
  document.addEventListener('click', event => {
    if (event.target.closest?.('.timeline-card, .hand-card, [data-text-size]')) scheduleCardText();
  });
  function mountHandFan(hand) {
    const cards = [...hand.querySelectorAll('.hand-card')];
    // La carta activa está en la línea; centrar otra en el abanico no la selecciona.
    hand.classList.toggle('hand-placement-pending', !!hand.closest('#app')?.querySelector('.slot-confirm'));
    // Una mano de varias cartas conserva su formato de abanico hasta la última.
    if (hand.classList.contains('hand-solo') || cards.length === 0) return;
    hand.classList.add('hand-fan');
    hand.setAttribute('role', 'group');
    hand.setAttribute('aria-label', cards.length === 1 ? 'Última carta en mano.' : 'Cartas en mano. Desliza a los lados para elegir.');
    const chosen = cards.findIndex(card => card.classList.contains('selected'));
    const center = Math.max(0, chosen);
    const enabled = cards.some(card => !card.disabled);
    const key = cards.map(card => card.dataset.id).join('|');
    const distance = (index, active) => {
      let delta = index - active;
      if (delta > cards.length / 2) delta -= cards.length;
      if (delta < -cards.length / 2) delta += cards.length;
      return delta;
    };
    // El paso entre cartas se lee del propio CSS (la traslación de una carta en reposo),
    // para que el arrastre y la postura final coincidan en cualquier tamaño de pantalla.
    // La postura reproduce la regla de edition.css: traslación, caída, giro y escala.
    let step = Math.min(window.innerWidth * .147, 54.6);
    const pose = offset => `translateX(${offset * step}px) translateY(${Math.abs(offset) * 11.2}px) rotate(${offset * 6}deg) scale(${Math.max(.5, 1 - Math.abs(offset) * .14)})`;
    // Un muelle: pasa un poco de su sitio y vuelve. Es lo que da peso a las cartas.
    const SPRING = 'cubic-bezier(.3,1.45,.5,1)';
    const offsets = new Map();
    cards.forEach((card, index) => {
      const offset = distance(index, center);
      card.style.setProperty('--fan-offset', offset);
      card.style.setProperty('--fan-depth', Math.abs(offset));
      card.style.zIndex = String(10 - Math.abs(offset));
      card.classList.toggle('fan-center', index === center);
      card.classList.toggle('fan-away', Math.abs(offset) > 2);
      card.tabIndex = index === center && enabled ? 0 : -1;
      card.setAttribute('aria-label', `${card.querySelector('strong')?.textContent || 'Carta'}. ${index + 1} de ${cards.length}`);
      offsets.set(card.dataset.id, offset);
    });
    const sample = cards.find(card => offsets.get(card.dataset.id));
    if (sample && typeof DOMMatrixReadOnly === 'function') {
      const moved = new DOMMatrixReadOnly(getComputedStyle(sample).transform).e / offsets.get(sample.dataset.id);
      if (Number.isFinite(moved) && Math.abs(moved) > 1) step = Math.abs(moved);
    }
    if (!reduced()) cards.forEach(card => {
      const offset = offsets.get(card.dataset.id);
      if (Math.abs(offset) > 2) return;
      // Cambió la carta del centro (deslizar o flechas): cada carta sale de donde estaba,
      // incluido lo que el dedo ya la había arrastrado, y llega con rebote.
      if (previousFan?.key === key && previousFan.center !== center) {
        const before = previousFan.offsets.get(card.dataset.id) + (previousFan.drag || 0);
        card.animate?.([{transform: pose(before)}, {transform: pose(offset)}], {duration: 420, easing: SPRING});
      // Salió una carta de la mano: las demás se recolocan y se asientan con un rebote.
      } else if (previousFan && previousFan.key !== key && previousFan.offsets.has(card.dataset.id)) {
        const before = previousFan.offsets.get(card.dataset.id);
        if (before !== offset) card.animate?.([{transform: pose(before)}, {transform: pose(offset)}], {duration: 460, easing: SPRING});
      }
    });
    previousFan = {key, center, offsets, drag: 0};
    if (cards.length === 1) return;
    const controls = document.createElement('div');
    controls.className = 'hand-fan-controls';
    controls.innerHTML = `<button type="button" aria-label="Carta anterior" data-fan-step="-1">‹</button><span>${center + 1} / ${cards.length}</span><button type="button" aria-label="Carta siguiente" data-fan-step="1">›</button>`;
    hand.insertAdjacentElement('afterend', controls);
    const select = direction => {
      if (!enabled || !hand.isConnected) return;
      cards[(center + direction + cards.length) % cards.length].click();
    };
    controls.querySelectorAll('button').forEach(button => {
      button.disabled = !enabled;
      button.addEventListener('click', () => select(Number(button.dataset.fanStep)));
    });
    hand.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      select(event.key === 'ArrowLeft' ? -1 : 1);
      document.querySelector('.hand-fan .fan-center')?.focus({preventScroll: true});
    });
    let gesture = null;
    // Mientras el dedo arrastra en horizontal, el abanico entero lo sigue: cada carta se
    // desplaza por su arco hacia la posición de al lado. Más allá de una carta cede cada
    // vez menos, como una goma.
    const dragTo = drag => {
      cards.forEach(card => {
        const offset = offsets.get(card.dataset.id);
        if (Math.abs(offset) > 3) return;
        card.style.transition = 'none';
        card.style.transform = pose(offset + drag);
      });
    };
    const settle = from => {
      cards.forEach(card => card.style.removeProperty('transition'));
      if (reduced()) { cards.forEach(card => card.style.removeProperty('transform')); return; }
      cards.forEach(card => {
        const offset = offsets.get(card.dataset.id);
        if (Math.abs(offset) > 3) return;
        card.style.removeProperty('transform');
        card.animate?.([{transform: pose(offset + from)}, {transform: pose(offset)}], {duration: 380, easing: SPRING});
      });
    };
    const rubber = value => {
      const limit = 1, sign = Math.sign(value), abs = Math.abs(value);
      return abs <= limit ? value : sign * (limit + (1 - 1 / ((abs - limit) * 1.5 + 1)) * .4);
    };
    hand.addEventListener('pointerdown', event => {
      if (!enabled || event.pointerType === 'mouse' || event.isPrimary === false) return;
      gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false, drag: 0};
      hand.classList.add('fan-touch');
    });
    hand.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (document.body.classList.contains('dragging-card')) { gesture = null; return; }
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (!gesture.horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        gesture.horizontal = true;
        hand.setPointerCapture?.(event.pointerId);
      }
      if (gesture.horizontal) {
        event.preventDefault();
        if (!reduced()) { gesture.drag = rubber(dx / step); dragTo(gesture.drag); }
      }
    }, {passive: false});
    hand.addEventListener('pointerup', event => {
      const move = gesture; gesture = null;
      hand.classList.remove('fan-touch');
      if (!move || event.pointerId !== move.id || !move.horizontal || document.body.classList.contains('dragging-card')) {
        if (move?.drag) settle(move.drag);
        return;
      }
      const dx = event.clientX - move.x;
      // Poco recorrido: el abanico vuelve a su sitio con un rebote, sin cambiar de carta.
      if (Math.abs(dx) < 35) { settle(move.drag); return; }
      // La carta nueva arranca desde donde el dedo dejó el abanico.
      if (previousFan) previousFan.drag = move.drag;
      event.preventDefault();
      // Evita que el clic sintético del dedo seleccione otra carta tras repintar.
      const swallow = click => { if (click.isTrusted) { click.preventDefault(); click.stopImmediatePropagation(); } };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 350);
      select(dx < 0 ? 1 : -1);
    });
    hand.addEventListener('pointercancel', () => {
      if (gesture?.drag) settle(gesture.drag);
      gesture = null; hand.classList.remove('fan-touch');
    });
  }
  // Ajusta la mesa según el espacio visible real. Safari puede cambiar la altura al
  // plegar sus barras; las clases se recalculan sin tocar el zoom elegido ni el estado.
  let boardFitFrame = 0;
  function fitBoard(container) {
    if (!board.has(container.dataset.screen) || window.innerWidth > 699) {
      delete container.dataset.boardFit;
      return;
    }
    cancelAnimationFrame(boardFitFrame);
    boardFitFrame = requestAnimationFrame(() => {
      if (!container.classList.contains('atlas-board')) return;
      const shell = container.querySelector(':scope > .shell');
      if (!shell) return;
      const available = window.visualViewport?.height || window.innerHeight;
      const top = shell.getBoundingClientRect().top + window.scrollY;
      // El marco de la línea se redimensiona en un observador asíncrono: sin ajustarlo aquí, cada
      // medida se hacía con el alto de la carta anterior y la mesa parecía no caber.
      const syncFrame = () => {
        const line = shell.querySelector('.board-timeline-section .timeline');
        const frame = line?.parentElement;
        if (!frame?.classList.contains('timeline-scale-frame')) return;
        const scale = Number(line.style.getPropertyValue('--timeline-scale')) || 1;
        frame.style.width = `${line.offsetWidth * scale}px`;
        frame.style.height = `${line.offsetHeight * scale}px`;
      };
      const fits = () => { syncFrame(); return top + shell.scrollHeight <= available; };
      container.classList.remove('board-card-expanded');
      container.style.removeProperty('--optimal-timeline-width');
      container.dataset.boardFit = 'normal';
      if (!fits()) container.dataset.boardFit = 'compact';
      if (!fits()) container.dataset.boardFit = 'tight';
      // Un título largo puede añadir líneas incluso en la mesa compacta. La lámina no se
      // recorta ni se estrecha: se reduce la carta entera (siempre 2:3) hasta que la mesa
      // cabe sin desplazarse.
      container.classList.remove('board-image-condensed');
      container.style.removeProperty('--board-image-height');
      let shrunk = false;
      if (!fits() && container.dataset.boardFit === 'tight') {
        const card = shell.querySelector('.board-timeline-section .timeline .timeline-card');
        if (card) {
          const start = Math.floor(card.getBoundingClientRect().width);
          container.classList.add('board-card-expanded');
          // Un título largo hace más líneas al estrechar la carta: se busca el ancho más
          // grande con el que la mesa cabe y, si ninguno cabe, el que menos sobra.
          let best = { width: start, over: Infinity };
          for (let width = start; width >= 60; width -= 2) {
            container.style.setProperty('--optimal-timeline-width', `${width}px`);
            syncFrame();
            const over = top + shell.scrollHeight - available;
            if (over < best.over) best = { width, over };
            if (fits()) { best = { width, over: -1 }; break; }
          }
          container.style.setProperty('--optimal-timeline-width', `${best.width}px`);
          shrunk = true;
          // Solo en pantallas muy bajas, cuando ni la carta más pequeña cabe, la lámina cede
          // altura: es el último recurso, para no obligar a desplazarse.
          syncFrame();
          const excess = Math.ceil(top + shell.scrollHeight - available);
          const visual = card.querySelector('.card-visual:has(.animal-card-art)');
          if (excess > 2 && visual) {
            container.style.setProperty('--board-image-height', `${Math.max(64, Math.floor(visual.getBoundingClientRect().height - excess - 4))}px`);
            container.classList.add('board-image-condensed');
          }
        }
      }
      if (!fits() && container.dataset.boardFit === 'normal') container.dataset.boardFit = 'compact';
      if (!fits() && container.dataset.boardFit === 'compact') container.dataset.boardFit = 'tight';
      // Aprovecha el papel libre dentro de la línea. La carta crece de forma
      // progresiva y se detiene antes de desplazar cualquier mando fuera de vista.
      if (!shrunk && fits() && window.innerWidth >= 375) {
        const section = shell.querySelector('.board-timeline-section');
        const card = section?.querySelector('.timeline .timeline-card');
        if (card) {
          const gap = Math.min(section.getBoundingClientRect().bottom, available) - card.getBoundingClientRect().bottom;
          const base = card.getBoundingClientRect().width;
          const growth = Math.min(38, Math.max(0, Math.floor((gap - 25) / 1.5)));
          if (growth >= 5) {
            container.classList.add('board-card-expanded');
            let expanded = false;
            for (let amount = growth; amount >= 0; amount -= 2) {
              container.style.setProperty('--optimal-timeline-width', `${base + amount}px`);
              if (fits() && card.getBoundingClientRect().bottom <= available - 8) {
                expanded = true;
                break;
              }
            }
            if (!expanded) {
              container.classList.remove('board-card-expanded');
              container.style.removeProperty('--optimal-timeline-width');
            }
          }
        }
      }
    });
  }
  window.addEventListener('resize', () => {
    fitBoard(document.getElementById('app'));
    scheduleCardText();
  }, {passive: true});
  window.visualViewport?.addEventListener('resize', () => {
    fitBoard(document.getElementById('app'));
    scheduleCardText();
  }, {passive: true});

  function mount(container, screen) {
    handOff(container, screen);
    if (['solo-end', 'winner', 'online-winner', 'comp-end'].includes(screen)) atlasFinal(container);
    if (screen === 'home') finalCards = [];
    // Se pliega aquí, antes de que la cámara fotografíe el destino (más abajo, en
    // a11y.js), y no después de pintar: si el plegado llegara tarde, el viaje mostraría
    // los paneles abiertos y, al terminar, la pantalla real —ya plegada— sustituiría de
    // golpe a lo que se acababa de enseñar. Eso es lo que se veía como una pantalla que
    // se abre y se cierra sola.
    if (screen === 'solo-home') foldSoloPanels(container);

    surfaceNav.clear();
    const inGame = playing.has(screen);
    container.classList.toggle('atlas-playing', inGame);
    container.classList.toggle('atlas-board', board.has(screen));
    if (screen === 'perfil') {
      const veil = document.createElement('div');
      veil.className = 'atlas-scroll-veil atlas-profile-veil';
      veil.setAttribute('aria-hidden', 'true');
      container.querySelector('.shell')?.append(veil);
      refreshProfileVeil();
    }
    // El fondo de la enciclopedia es una instantánea inerte; su barra no es la real.
    container.querySelectorAll('.enc-background .home-nav').forEach(el => el.remove());
    // La bienvenida tampoco lleva barra: hasta tener nombre no hay a dónde ir.
    if (inGame || container.querySelector('.bienvenida-shell')) container.querySelectorAll('.home-nav').forEach(el => el.remove());
    else if (!container.querySelector('.home-nav')) {
      const destination = container.querySelector('.enc-modal') || container.querySelector('.shell') || container;
      destination.insertAdjacentHTML('beforeend', nav(screen));
    }
    container.classList.toggle('atlas-has-nav', !inGame && !container.querySelector('.bienvenida-shell'));
    // Cabecera limpia en todas las mesas (como Retos rápidos): el nombre de la partida sube a la
    // barra superior y debajo queda una sola franja con los contadores.
    if (board.has(screen) && !container.querySelector('.quick-shell')) {
      const head = container.querySelector(':scope > .shell > .game-head');
      const label = head?.querySelector('.turn-label');
      const middle = container.querySelector('.atlas-topbar > span:nth-child(2)');
      if (head && label && middle) {
        const title = document.createElement('div');
        title.className = 'topbar-title';
        title.setAttribute('aria-hidden', 'true');
        title.textContent = label.textContent;
        middle.replaceWith(title);
        label.classList.add('solo-lectores');
        head.classList.add('game-head-slim');
        // Con marcador de jugadores, el nombre de quien juega ya se ve en su píldora.
        const roster = container.querySelector(':scope > .shell > .scoreboard-panel');
        if (roster) {
          head.querySelector('.turn-name')?.classList.add('solo-lectores');
          head.append(roster);
        }
      }
      container.querySelectorAll('.atlas-hand-section .hand-title small, :scope > .shell > section > .hand-title small').forEach(el => el.classList.add('solo-lectores'));
    }
    if (board.has(screen)) {
      const lives = container.querySelector('.solo-lives');
      const counters = container.querySelector('.game-head');
      if (lives && counters) counters.insertBefore(lives, counters.querySelector(':scope > .game-head-side') || counters.querySelector(':scope > .deck-count'));
      const wrap = container.querySelector('.timeline-wrap');
      const zoom = container.querySelector('.timeline-zoom');
      const timelineHeading = wrap?.parentElement.querySelector('.hand-title');
      if (timelineHeading) timelineHeading.classList.add('timeline-toolbar');
      // La lupa del zoom va en la barra superior, junto al sonido y el menú: es un ajuste de
      // vista, no parte del tablero, y así no descuadra la cabecera de la línea.
      // El zoom y el sonido viven en el menú ⋯ de la partida: la barra de arriba queda solo
      // con volver, el título y el menú. Sin menú (algunas salas), el zoom sigue en la línea.
      const menuButton = container.querySelector(':is(.topbar, .atlas-topbar) :is(.atlas-topbar-actions, .topbar-actions) > button:not(#ambience-toggle)');
      container.classList.toggle('atlas-menu-tools', !!menuButton);
      if (zoom && !menuButton && timelineHeading) timelineHeading.append(zoom);
      const hand = container.querySelector('.hand');
      if (hand) {
        hand.closest('section')?.classList.add('atlas-hand-section');
        // Se desplaza la mano cuando hay más de cuatro; nunca se eliminan cartas.
        hand.classList.toggle('atlas-hand-many', hand.children.length > 4);
        mountHandFan(hand);
        const hint = hand.parentElement.querySelector('.hint');
        if (hint) hint.hidden = true;
      }
      const slot = container.querySelector('.slot-confirm');
      const dock = document.createElement('div'); dock.className = 'placement-dock';
      if (slot) {
        slot.setAttribute('aria-label', 'Posición elegida');
        const confirm = slot.querySelector('.btn-primary'), cancel = slot.querySelector('.btn-ghost');
        const status = document.createElement('div'); status.className = 'placement-dock-status';
        status.innerHTML = '<span aria-hidden="true">✓</span><strong>Posición elegida</strong>';
        const actions = document.createElement('div'); actions.className = 'placement-dock-actions';
        if (confirm) { confirm.textContent = 'Colocar carta →'; actions.append(confirm); }
        if (cancel) { cancel.textContent = 'Cambiar'; actions.append(cancel); }
        dock.setAttribute('role', 'group');
        dock.setAttribute('aria-label', 'Confirmar la posición elegida');
        dock.append(status, actions);
        previewCard(slot);
      }
      const timelineSection = container.querySelector('.timeline-wrap')?.closest('section');
      // Cuando hay una decisión pendiente, sus mandos pertenecen a la línea y quedan
      // justo después de ella. En el flujo no cubren la carta ni dependen del alto de la
      // barra del navegador. Antes de elegir hueco no se añade un panel redundante.
      if (slot && timelineSection) timelineSection.insertAdjacentElement('afterend', dock);
    }
    refreshDepth();
    fitBoard(container);
    scheduleCardText(container);
    if (screen === 'game' && window.innerWidth <= 699) requestAnimationFrame(() => {
      const roster = container.querySelector('.scoreboard-panel .scoreboard');
      const active = roster?.querySelector('.score.active');
      if (!roster?.isConnected || !active || roster.scrollWidth <= roster.clientWidth) return;
      // Mantén a quien juega junto al participante anterior al pasar el móvil.
      roster.scrollLeft = Math.max(0, active.offsetLeft - roster.children[1].offsetLeft);
    });
  }
  // La vista previa del hueco elegido es la propia carta, boca abajo como en la mano,
  // posada en la línea. Debajo, el tramo que ocupa: las fechas de sus dos vecinas. Es lo
  // que de verdad se decide al elegir hueco y no revela nada que no esté ya a la vista.
  function neighbourValue(slot, step) {
    for (let node = slot[step]; node; node = node[step]) {
      if (!node.matches('.timeline-card')) continue;
      return node.querySelector('.year')?.textContent.trim() || '';
    }
    return '';
  }
  function previewCard(slot) {
    const title = slot.querySelector('strong')?.textContent.trim();
    if (!title) return;
    const before = neighbourValue(slot, 'previousElementSibling');
    const after = neighbourValue(slot, 'nextElementSibling');
    const range = before && after ? `<small>Entre</small><b>${CT.escapeHtml(before)}</b><i aria-hidden="true"></i><b>${CT.escapeHtml(after)}</b>`
      : after ? `<small>Antes de</small><b>${CT.escapeHtml(after)}</b>`
      : before ? `<small>Después de</small><b>${CT.escapeHtml(before)}</b>` : '';
    const card = document.createElement('div');
    card.className = 'slot-confirm-card preview-card';
    card.innerHTML = `<span class="preview-card-face" aria-hidden="true"><img class="reverso-emblema" src="assets/continuum-emblem-800.webp" alt="" width="800" height="533" decoding="async"></span><strong>${CT.escapeHtml(title)}</strong>${range ? `<p class="preview-range">${range}</p>` : ''}`;
    slot.replaceChildren(card);
    slot.classList.add('has-preview-card');
    const where = before && after ? `entre ${before} y ${after}` : after ? `antes de ${after}` : before ? `después de ${before}` : '';
    slot.setAttribute('aria-label', `Posición elegida${where ? `: ${where}` : ''}`);
  }
  // Al abrir el menú ⋯ de una partida se añade arriba un bloque «Vista» con el zoom y la
  // música. Se engancha a cualquier menú de la barra superior, sea cual sea la modalidad.
  document.addEventListener('click', event => {
    const opener = event.target.closest?.('#app.atlas-menu-tools :is(.atlas-topbar-actions, .topbar-actions) > button:not(#ambience-toggle)');
    if (!opener) return;
    setTimeout(() => {
      const modal = [...document.querySelectorAll('#app > .overlay .modal')].at(-1);
      if (!modal || modal.querySelector('.menu-view-tools')) return;
      const zoom = document.querySelector('#app .timeline-zoom');
      const levels = zoom ? [...zoom.querySelectorAll('.zoom-menu [data-zoom-level]')] : [];
      const on = () => CT.effectPrefs?.().ambience === true;
      const block = document.createElement('div');
      block.className = 'menu-view-tools';
      block.innerHTML = `${levels.length ? `<div class="menu-view-row"><span>Zoom de las cartas</span><div class="menu-view-zoom" role="group" aria-label="Zoom de las cartas">${levels.map(b => `<button type="button" data-zoom-level="${b.dataset.zoomLevel}" aria-pressed="${b.getAttribute('aria-pressed')}">${b.textContent}</button>`).join('')}</div></div>` : ''}<div class="menu-view-row"><span>Música</span><button type="button" class="menu-view-sound" aria-pressed="${on()}">${on() ? 'Activada' : 'Desactivada'}</button></div>`;
      block.addEventListener('click', e => {
        const level = e.target.closest('[data-zoom-level]');
        if (level) setTimeout(() => block.querySelectorAll('[data-zoom-level]').forEach(b => b.setAttribute('aria-pressed', String(b === level))), 0);
        const sound = e.target.closest('.menu-view-sound');
        if (sound) {
          CT.setAmbience?.(!on());
          sound.setAttribute('aria-pressed', String(on()));
          sound.textContent = on() ? 'Activada' : 'Desactivada';
        }
      });
      const title = modal.querySelector('h2');
      if (title) title.after(block); else modal.prepend(block);
    }, 0);
  });
  const surfaceNav = new Map();
  function openSurface(modal) {
    if (playing.has(document.getElementById('app').dataset.screen)) return;
    if (!modal.matches('.rules, .settings-modal')) return;
    const navigation = document.querySelector('#app .home-nav');
    if (navigation && !modal.contains(navigation)) {
      surfaceNav.set(modal, {navigation, parent: navigation.parentElement, next: navigation.nextSibling,
        active: navigation.querySelector('[aria-current]')});
      navigation.querySelectorAll('[aria-current]').forEach(el => el.removeAttribute('aria-current'));
      const action = modal.matches('.rules') ? '[data-action="rules"]' : '[data-settings-action="open"]';
      navigation.querySelector(action)?.setAttribute('aria-current','page');
      modal.append(navigation);
    } else if (navigation && modal.contains(navigation) && !surfaceNav.has(modal)) {
      // `mount` puede haber colocado la barra dentro del modal antes de llegar aquí.
      // Guardamos igualmente el shell que queda debajo para devolverla al comenzar
      // el cierre, sincronizada con la salida del resto de la superficie.
      const background = modal.closest('.overlay')?.previousElementSibling;
      const parent = background?.querySelector('.shell') || document.querySelector('#app > .shell');
      if (parent) surfaceNav.set(modal, {
        navigation,
        parent,
        next: null,
        active: navigation.querySelector('[aria-current]')
      });
    }
    const close = modal.querySelector('.guide-close, .settings-close, [data-action="enc-back"]');
    scrollVeil(modal);
    refreshDepth();
    if (close) { if (!close.hasAttribute('aria-label')) close.setAttribute('aria-label','Volver a la pantalla anterior'); close.innerHTML = icon('back'); close.classList.add('atlas-dialog-back'); }
  }
  function closeSurface(modal) {
    const saved = surfaceNav.get(modal); if (!saved) return;
    for (const [other, target] of surfaceNav) {
      if (other !== modal && modal.contains(target.parent)) { target.parent = saved.parent; target.next = saved.next; target.active = saved.active; }
    }
    if (saved.navigation.closest('.modal') === modal && saved.parent.isConnected) {
      saved.parent.insertBefore(saved.navigation, saved.next?.parentNode === saved.parent ? saved.next : null);
      saved.navigation.querySelectorAll('[aria-current]').forEach(el => el.removeAttribute('aria-current'));
      saved.active?.setAttribute('aria-current','page');
    }
    surfaceNav.delete(modal);
    setTimeout(refreshDepth, 0);
  }
  function compactResult(overlay) {
    if (!overlay.hasAttribute('data-result-card')) return false;
    const modal = overlay.querySelector('.modal');
    if (!modal || modal.classList.contains('pulse-duel-modal')) return false;
    if (modal.classList.contains('board-result')) return true;
    overlay.classList.add('board-result-layer'); modal.classList.add('board-result');
    const title = modal.querySelector('h2'), reveal = modal.querySelector('.reveal');
    const summary = document.createElement('div'); summary.className = 'result-summary';
    const label = document.createElement('b');
    label.textContent = modal.classList.contains('success') ? '✓ Bien colocado' : '× No encaja ahí';
    const date = document.createElement('span'); date.className = 'year'; date.textContent = reveal?.querySelector('.year')?.textContent || '';
    summary.append(label, date); modal.prepend(summary);
    const details = document.createElement('details'); details.className = 'result-history';
    const toggle = document.createElement('summary'); toggle.textContent = 'Ver historia'; details.append(toggle);
    if (reveal) details.append(reveal);
    [...modal.children].filter(el => el.tagName === 'P').forEach(el => details.append(el));
    if (title) title.after(details); else summary.after(details);
    return true;
  }
  function reveal(modal) {
    const value = modal?.querySelector('.result-summary, .reveal');
    if (value && !reduced()) {
      value.classList.add('atlas-reveal');
      const year = value.querySelector('.year');
      if (year && !year.classList.contains('date-ink')) {
        year.classList.add('date-ink');
        year.addEventListener('animationend', event => {
          if (event.animationName === 'date-ink-stamp' && year.isConnected) CT.Effects?.stamp?.();
        }, {once: true});
      }
    }
  }

  // Las capas que leen la profundidad, en el mismo orden en que edition.css las dibuja:
  // el paisaje y las láminas del atlas, y el fondo y el dibujo de cada portada. La lista
  // está aquí y no marcada con una clase porque la fórmula de cada capa vive en la hoja:
  // esto es el índice de esas reglas. Si allí aparece una capa nueva, aquí se añade su
  // selector. Las variables se escriben en la capa y no en la portada a propósito —
  // están declaradas sin herencia, así que ponerlas arriba ya no llegaría abajo, y esa
  // es justo la razón de que una escritura no recalcule toda la portada.
  const DEPTH_LAYERS = '.atlas-landscape img, .atlas-specimens, .panel-backdrop img, .panel-art img';

  // Volver a escribir una variable con el valor que ya tenía cuesta lo mismo que
  // cambiarla. Con el móvil quieto sobre la mesa el giroscopio sigue avisando, y sin esta
  // comparación cada aviso repintaría lo mismo otra vez.
  function setVar(node, name, value) {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  }

  // Un único listener de orientación, conectado solo con permiso y en las portadas.
  let depthListening = false, depthFrame = 0, origin = null, tilt = {x: 0, y: 0};
  function depthTarget() {
    const app = document.getElementById('app');
    if (!app || playing.has(app.dataset.screen) || app.querySelector('.overlay')) return null;
    return app.querySelector('[data-depth-scene]') || app.querySelector('.gallery-panel.active') || app.querySelector('.gallery-panel');
  }
  function onTilt(event) {
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    origin ||= {beta: event.beta, gamma: event.gamma};
    tilt = {x: Math.max(-1, Math.min(1, (event.gamma - origin.gamma) / 18)), y: Math.max(-1, Math.min(1, (event.beta - origin.beta) / 18))};
    if (depthFrame) return;
    depthFrame = requestAnimationFrame(() => {
      depthFrame = 0;
      const scene = depthTarget();
      if (!scene) return;
      const scenes = scene.matches('.gallery-panel')
        ? document.querySelectorAll('#app .gallery-panel') : [scene];
      // Dos decimales: por debajo de eso el desplazamiento no se ve, y redondear es lo
      // que hace que un móvil casi quieto deje de escribir en cada aviso.
      const x = `${(tilt.x * 7).toFixed(2)}px`, y = `${(tilt.y * 5).toFixed(2)}px`;
      const rx = `${(-tilt.y * 2).toFixed(2)}deg`, ry = `${(tilt.x * 2.5).toFixed(2)}deg`;
      scenes.forEach(target => {
        const rect = target.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        target.querySelectorAll(DEPTH_LAYERS).forEach(layer => {
          setVar(layer, '--depth-x', x);
          setVar(layer, '--depth-y', y);
        });
        // El giro sí lo usa la portada en su propia regla, así que ahí se queda.
        setVar(target, '--cover-rx', rx);
        setVar(target, '--cover-ry', ry);
      });
    });
  }
  function refreshDepth() {
    const enabled = CT.effectPrefs?.().depth && !reduced() && !document.hidden && !!depthTarget();
    if (enabled && !depthListening) { origin = null; window.addEventListener('deviceorientation', onTilt, {passive: true}); depthListening = true; }
    else if (!enabled && depthListening) {
      window.removeEventListener('deviceorientation', onTilt); depthListening = false; origin = null;
      cancelAnimationFrame(depthFrame); depthFrame = 0;
      document.querySelectorAll('[data-depth-scene], .gallery-panel').forEach(scene => {
        scene.style.removeProperty('--cover-rx');
        scene.style.removeProperty('--cover-ry');
        scene.querySelectorAll(DEPTH_LAYERS).forEach(layer => {
          layer.style.removeProperty('--depth-x');
          layer.style.removeProperty('--depth-y');
          layer.style.removeProperty('--scene-scroll');
        });
      });
    }
  }
  // Fondo y dibujo recorren distancias distintas al desplazarse por la galería.
  // Sin sensores ni animación permanente; un solo frame por evento de scroll.
  let galleryScrollFrame = 0;
  function scrollGalleryDepth() {
    if (galleryScrollFrame || reduced() || document.hidden) return;
    galleryScrollFrame = requestAnimationFrame(() => {
      galleryScrollFrame = 0;
      if (reduced() || !depthTarget()) return;
      document.querySelectorAll('#app .home-gallery-shell .gallery-panel:not(.mode-inline-drawer .gallery-panel)').forEach(panel => {
        const rect = panel.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const offset = Math.max(-6, Math.min(6, (rect.top + rect.height / 2 - window.innerHeight / 2) * .025));
        const valor = `${offset.toFixed(2)}px`;
        panel.querySelectorAll(DEPTH_LAYERS).forEach(layer => setVar(layer, '--scene-scroll', valor));
      });
    });
  }
  window.addEventListener('scroll', scrollGalleryDepth, {passive: true});
  async function requestDepth() {
    try {
      if (!window.DeviceOrientationEvent) return false;
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') return await window.DeviceOrientationEvent.requestPermission() === 'granted';
      return true;
    } catch { return false; }
  }
  document.addEventListener('visibilitychange', refreshDepth);
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', refreshDepth);
  CT.UI = {isPlaying: screen => playing.has(screen), header, nav, mount, captureBoard, compactResult, confirmExit, askDialog, confirmDialog, pulseGiftDialog, reveal, openSurface, closeSurface, requestDepth,
    updateEffects() { refreshDepth(); CT.Ambience?.sync(true); }};
})();
