// Presentación compartida: nunca escribe el estado ni decide el resultado de una jugada.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const playing = new Set(['game', 'solo', 'cifras', 'online-game', 'local-game', 'pass', 'pulse-pass', 'final-local', 'online-final', 'comp-intro', 'tournament-intro', 'online-competition-intro', 'quick-game', 'quick-lobby']);
  const board = new Set(['game', 'solo', 'online-game', 'local-game', 'quick-game']);
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const icons = {
    back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
    // Mano que va a pulsar: índice extendido, pulgar abierto y el resto cerrado.
    press: '<path d="M9 12V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 11V9.5a1.5 1.5 0 0 1 3 0V12"/><path d="M15 12v-1a1.5 1.5 0 0 1 3 0v2"/><path d="M18 13v-.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2.2a5 5 0 0 1-4-2L4.6 14.9a1.5 1.5 0 0 1 2.3-1.9L9 15.2"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
    book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
    atlas: '<path d="m12 2 2 8 8 2-8 2-2 8-2-8-8-2 8-2Z"/><path d="m5 5 7 5 7-5-5 7 5 7-7-5-7 5 5-7Z" stroke-width=".7" opacity=".6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
    profile: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5.5 21v-1.5a6.5 6.5 0 0 1 13 0V21"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const menuIcons = {
    home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/><path d="M7 11v8m10-8v8M10 7l2-2 2 2" stroke-width=".6"/>',
    atlas: '<path d="m12 1 2.4 7.6L20 4l-4.6 5.6L23 12l-7.6 2.4L20 20l-5.6-4.6L12 23l-2.4-7.6L4 20l4.6-5.6L1 12l7.6-2.4L4 4l5.6 4.6Z"/><path d="m12 1 0 11L23 12M12 23V12H1m3-8 8 8 8 8M20 4l-8 8-8 8" stroke-width=".65"/><path d="m12 4 1.4 6.6L20 12l-6.6 1.4L12 20l-1.4-6.6L4 12l6.6-1.4Z" stroke-width=".65"/>',
    book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2ZM3 6H1v15c4-1 7-1 11 2 4-3 7-3 11-2V6h-2"/><path d="m5 7 5 1m-5 2 5 1m-5 2 5 1m-5 2 5 1m4-8 5-1m-5 4 5-1m-5 4 5-1m-5 4 5-1" stroke-width=".7"/>',
    settings: '<path d="m9 2-.5 3-2 1-2.6-1.2-2 3.4L4 10v3l-2.1 1.8 2 3.4L6.5 17l2 1L9 22h6l.5-4 2-1 2.6 1.2 2-3.4L20 13v-3l2.1-1.8-2-3.4L17.5 6l-2-1L15 2Z"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3.5"/><path d="M10 10h4v4h-4Z" stroke-width=".7"/>'
  };
  const menuIcon = name => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${menuIcons[name]}</svg>`;
  // `help`, si lo hay, son los atributos de un botón de guía propio de la pantalla.
  function header(back = '', menu = '', inGame = false, title = '', help = '') {
    // La tercera columna es una fila propia, no una sola celda: así aloja los botones de
    // guía y de menú, sin que ninguno de los dos tenga que adivinar el sitio del otro.
    return `<header class="topbar atlas-topbar${inGame ? ' atlas-game-topbar' : ''}">
      ${back ? `<button class="icon-btn atlas-back" ${back} aria-label="Volver a la pantalla anterior">${icon('back')}</button>` : '<span></span>'}
      ${inGame ? (title ? `<div class="topbar-title">${title}</div>` : '<span></span>') : '<div class="brand">Continuum</div>'}
      <div class="atlas-topbar-actions">${help ? `<button class="icon-btn atlas-help" ${help} aria-label="Cómo se juega">${icon('guide')}</button>` : ''}${menu ? `<button class="icon-btn atlas-menu" ${menu} aria-label="Opciones de la partida" aria-haspopup="dialog">${icon('more')}</button>` : ''}</div>
    </header>`;
  }
  function nav(screen) {
    return `<nav class="home-nav atlas-nav" aria-label="Menú principal">${[
      ['home-top', 'home', 'Inicio', ['home']], ['perfil', 'atlas', 'Atlas', ['perfil']], ['rules', 'book', 'Guía', ['guide']], ['settings', 'settings', 'Ajustes', ['settings']]
    ].map(([action, symbol, label, current]) => `<button type="button" aria-label="${label}" ${action === 'settings' ? 'data-settings-action="open"' : `data-action="${action}"`}${current.includes(screen) ? ' aria-current="page"' : ''}><span>${menuIcon(symbol)}</span><small>${label}</small></button>`).join('')}</nav>`;
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
  // Pista mínima en la esquina inferior derecha de la carta activa: cómo se coloca. Es decorativa
  // (el párrafo de ayuda de cada mesa ya lo explica), por eso queda fuera del árbol de accesibilidad.
  function handHint(card) {
    if (card.querySelector(':scope > .card-hint')) return;
    card.insertAdjacentHTML('beforeend', `<span class="card-hint" aria-hidden="true">${icon('press')}<small>Arrastra o pulsa +</small></span>`);
  }
  function mountHandFan(hand) {
    const cards = [...hand.querySelectorAll('.hand-card')];
    cards.forEach(handHint);
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
    // Un carrusel: las cartas dan la vuelta, así que no hay un extremo. Cada una se coloca por su posición
    // respecto a la del centro, en «cartas»: entera en reposo y con decimales mientras el dedo arrastra o el giro
    // se asienta. `lo` es donde empieza la vuelta, siempre entre dos posiciones de reposo, para que ninguna carta
    // quede justo en la costura (con un número par de cartas no cabe una simétrica).
    const total = cards.length;
    const RANGE = 4;
    const lo = total % 2 ? -total / 2 : -total / 2 + .5;
    const wrap = position => (((position - lo) % total) + total) % total + lo;
    const distance = (index, active) => wrap(index - active);
    const pending = hand.classList.contains('hand-placement-pending');
    // El paso entre cartas se lee del propio CSS (la traslación de una carta en reposo),
    // para que el arrastre y la postura final coincidan en cualquier tamaño de pantalla.
    let step = Math.min(CT.Mesa.ancho() * .147, 54.6);
    // La postura de una carta a `position` cartas del centro. Hasta dos cartas el abanico se abre como
    // siempre; más allá el fondo se va apilando —cada carta asoma un poco por detrás de la anterior, más
    // pequeña y más oscura (sin transparencia, que dejaría ver el texto de las de atrás)— para que se vea que
    // quedan más por descubrir al girar. En los extremos de lo visible (y en la costura de la vuelta) la carta
    // se desvanece, así que entrar y salir no da saltos.
    const pose = position => {
      const away = Math.abs(position), side = Math.sign(position);
      const lean = away <= 2 ? away : away <= 3 ? 2 + (away - 2) * .5 : 2.5 + (away - 3) * .4;
      const depth = away <= 2 ? away : 2 + (away - 2) * .6;
      const drop = away <= 2 ? away : 2 + (away - 2) * .4;
      const seam = Math.min(position - lo, lo + total - position);
      const visible = Math.max(0, Math.min(1, (RANGE + .5 - away) / .5, seam / .5));
      // Con una colocación pendiente toda la mano queda tenue; si no, las cartas son opacas y lo que las
      // jerarquiza es la escala y lo oscuras que sean.
      const base = pending ? .8 : 1;
      return {
        transform: `translateX(${side * lean * step}px) translateY(${drop * 11.2}px) rotate(${side * lean * 4}deg) scale(${1 - depth * .14})`,
        opacity: String(+(base * visible).toFixed(3)), z: String(Math.round(100 - away * 10)), visible: visible > .01,
        filter: away > .05 ? `brightness(${(1 - Math.min(away, 2) * .035 - Math.max(0, away - 2) * .08).toFixed(3)})` : 'none'
      };
    };
    const paint = (card, position) => {
      const next = pose(position);
      card.style.transform = next.transform; card.style.opacity = next.opacity; card.style.zIndex = next.z;
      if (next.filter !== 'none' || card.style.filter) card.style.filter = next.filter === 'none' ? '' : next.filter;
      card.classList.toggle('fan-center', Math.abs(position) < .5);
      card.classList.toggle('fan-away', !next.visible);
    };
    // Un muelle: pasa un poco de su sitio y vuelve. Es lo que da peso a las cartas.
    const spring = t => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2);
    // Anima una carta de una posición a otra pasando por las de en medio, que pueden cruzar la costura de la
    // vuelta: por eso se muestrea la trayectoria en vez de dar solo los dos extremos.
    const travel = (card, from, to, duration) => {
      if (!card.animate || from === to) return;
      const count = Math.max(8, Math.round(duration / 16)), frames = [];
      for (let i = 0; i <= count; i++) {
        const next = pose(wrap(from + (to - from) * spring(i / count)));
        frames.push({transform: next.transform, opacity: next.opacity, zIndex: next.z, filter: next.filter, visibility: next.visible ? 'visible' : 'hidden', offset: i / count});
      }
      card.animate(frames, {duration, easing: 'linear'});
    };
    const offsets = new Map();
    cards.forEach((card, index) => {
      const offset = distance(index, center);
      card.style.setProperty('--fan-offset', offset);
      card.style.setProperty('--fan-depth', Math.abs(offset));
      card.tabIndex = index === center && enabled ? 0 : -1;
      card.setAttribute('aria-label', `${card.querySelector('strong')?.textContent || 'Carta'}. ${index + 1} de ${cards.length}`);
      offsets.set(card.dataset.id, offset);
    });
    const sample = cards.find(card => offsets.get(card.dataset.id));
    if (sample && typeof DOMMatrixReadOnly === 'function') {
      sample.style.removeProperty('transform');
      const moved = new DOMMatrixReadOnly(getComputedStyle(sample).transform).e / offsets.get(sample.dataset.id);
      if (Number.isFinite(moved) && Math.abs(moved) > 1) step = Math.abs(moved);
    }
    cards.forEach(card => paint(card, offsets.get(card.dataset.id)));
    if (!reduced() && previousFan?.key === key && previousFan.center !== center) {
      // Cambió la carta del centro (deslizar, flechas o tocar otra): cada carta sale de donde estaba,
      // incluido lo que el dedo ya la había arrastrado, y recorre las cartas que hagan falta, con rebote.
      const delta = center - previousFan.center;
      const moved = previousFan.steps !== null && (((previousFan.steps - delta) % total) + total) % total === 0 ? previousFan.steps : wrap(delta);
      const duration = Math.min(900, 400 + 90 * Math.max(0, Math.abs(moved) - 1));
      cards.forEach(card => {
        const before = previousFan.offsets.get(card.dataset.id);
        if (before === undefined) return;
        travel(card, before + (previousFan.drag || 0), before - moved, duration);
      });
    // Salió una carta de la mano: las demás se recolocan y se asientan con un rebote.
    } else if (!reduced() && previousFan && previousFan.key !== key && cards.some(card => previousFan.offsets.has(card.dataset.id))) {
      cards.forEach(card => {
        const offset = offsets.get(card.dataset.id), before = previousFan.offsets.get(card.dataset.id);
        if (Math.abs(offset) > RANGE) return;
        // Una carta que no estaba a la vista, o que tendría que cruzar el abanico entero, entra con un fundido.
        if (before === undefined || Math.abs(before - offset) > 3) { card.animate?.([{opacity: 0}, {opacity: pose(offset).opacity}], {duration: 360, easing: 'ease-out'}); return; }
        travel(card, before, offset, 460);
      });
    }
    previousFan = {key, center, offsets, drag: 0, steps: null};
    if (cards.length === 1) return;
    const controls = document.createElement('div');
    controls.className = 'hand-fan-controls';
    controls.innerHTML = `<button type="button" aria-label="Carta anterior" data-fan-step="-1">‹</button><span>${center + 1} / ${cards.length}</span><button type="button" aria-label="Carta siguiente" data-fan-step="1">›</button>`;
    hand.insertAdjacentElement('afterend', controls);
    // Mueve el centro `steps` cartas (con signo): se elige la que quede en el centro. Si es la misma
    // carta (una vuelta entera) no hay nada que elegir. Devuelve si se eligió otra.
    const select = steps => {
      if (!enabled || !hand.isConnected) return false;
      const target = (((center + steps) % total) + total) % total;
      if (target === center) return false;
      if (previousFan) previousFan.steps = steps;
      cards[target].click();
      return true;
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
    // Mientras el dedo arrastra en horizontal, el abanico entero lo sigue 1 a 1: cada carta recorre su
    // arco y pasa a la posición de al lado, sin tope. `drag` son cartas, con el signo del dedo.
    let drag = 0;
    const dragTo = value => {
      drag = value;
      cards.forEach(card => paint(card, wrap(offsets.get(card.dataset.id) + value)));
    };
    // Suelta el abanico en `target` cartas (entero): vuelve a su sitio o sigue girando por inercia. Sin
    // repintar la mano, así que los estilos quedan ya en su postura final y la animación solo recorre el camino.
    const settle = (from, target) => {
      cards.forEach(card => card.getAnimations?.().forEach(animation => animation.cancel()));
      cards.forEach(card => paint(card, offsets.get(card.dataset.id)));
      drag = 0;
      if (reduced()) return;
      const duration = Math.min(900, 380 + 90 * Math.max(0, Math.abs(target) - 1));
      cards.forEach(card => travel(card, offsets.get(card.dataset.id) + from, offsets.get(card.dataset.id) + target, duration));
    };
    // Las flechas están encima de las cartas de los lados: deslizar empezando en una también gira el abanico.
    const onFan = (type, handler, options) => { hand.addEventListener(type, handler, options); controls.addEventListener(type, handler, options); };
    onFan('pointerdown', event => {
      if (!enabled || event.pointerType === 'mouse' || event.isPrimary === false) return;
      gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false, samples: [{t: event.timeStamp, x: event.clientX}]};
      hand.classList.add('fan-touch');
    });
    onFan('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (document.body.classList.contains('dragging-card')) { gesture = null; return; }
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (!gesture.horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        gesture.horizontal = true;
        hand.setPointerCapture?.(event.pointerId);
        // Si el giro anterior aún se estaba asentando, se corta: el dedo coge el abanico donde ya está.
        cards.forEach(card => card.getAnimations?.().forEach(animation => animation.cancel()));
      }
      // La velocidad se mide con lo último que hizo el dedo (unos 100 ms), no con todo el recorrido.
      gesture.samples.push({t: event.timeStamp, x: event.clientX});
      while (gesture.samples.length > 2 && event.timeStamp - gesture.samples[0].t > 100) gesture.samples.shift();
      if (gesture.horizontal) {
        event.preventDefault();
        if (!reduced()) dragTo(dx / CT.Mesa.escala() / step);
      }
    }, {passive: false});
    onFan('pointerup', event => {
      const move = gesture; gesture = null;
      hand.classList.remove('fan-touch');
      if (!move || event.pointerId !== move.id || !move.horizontal || document.body.classList.contains('dragging-card')) {
        if (drag) settle(drag, 0);
        return;
      }
      event.preventDefault();
      // Evita que el clic sintético del dedo seleccione otra carta tras repintar.
      const swallow = click => { if (click.isTrusted) { click.preventDefault(); click.stopImmediatePropagation(); } };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 350);
      const dx = event.clientX - move.x, unit = CT.Mesa.escala() * step;
      const first = move.samples[0], last = move.samples[move.samples.length - 1];
      const speed = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
      // Hasta dónde llegaría el abanico con la inercia del dedo (la de unos 120 ms más), redondeado a una
      // carta entera: así queda una carta en el centro, y un gesto lento y corto vuelve a su sitio.
      const here = reduced() ? dx / unit : drag;
      let carried = Math.round(here + speed / unit * 120);
      if (carried === 0 && Math.abs(dx) >= 35) carried = Math.sign(dx);
      carried = Math.max(-12, Math.min(12, carried));
      // Los dedos van hacia el lado contrario al de las cartas que llegan: arrastrar a la izquierda trae las siguientes.
      // El repintado de la mano llega dentro de `select`: lo que el dedo ya movió tiene que estar apuntado antes.
      if (carried !== 0 && previousFan) previousFan.drag = drag;
      if (carried === 0 || !select(-carried)) {
        if (previousFan) previousFan.drag = 0;
        settle(drag, carried);
      }
    });
    onFan('pointercancel', () => {
      gesture = null; hand.classList.remove('fan-touch');
      if (drag) settle(drag, 0);
    });
  }
  // Ajusta la mesa según el espacio visible real. Safari puede cambiar la altura al
  // plegar sus barras; las clases se recalculan sin tocar el zoom elegido ni el estado.
  let boardFitFrame = 0;
  let heldHand = null;
  // El ancho del abanico se decide la primera vez que se mide la mesa y se conserva mientras
  // sigan la misma pantalla y el mismo tamaño de ventana: si cada repintado lo recalculara,
  // pasar de una carta a otra podía encoger o agrandar la mano según lo que midiera ese
  // instante (la animación a medias, el aviso de colocar), y la mano bailaba de tamaño.
  let fanHold = null;
  const mesaCaja = el => CT.Mesa.caja(el);
  function fitBoard(container) {
    // Sin fotogramas (pruebas en jsdom) no hay nada que medir.
    if (!board.has(container.dataset.screen) || CT.Mesa.ancho() > 699 || typeof window.requestAnimationFrame !== 'function') {
      delete container.dataset.boardFit;
      return;
    }
    cancelAnimationFrame(boardFitFrame);
    boardFitFrame = requestAnimationFrame(() => {
      if (!container.classList.contains('atlas-board')) return;
      const shell = container.querySelector(':scope > .shell');
      if (!shell) return;
      // Las cartas que entran en la mano al pasar el móvil vuelan desde abajo de la pantalla:
      // mientras vuelan agrandan el alto de la mesa, y medirla así la daba por llena y
      // encogía la carta de la línea toda la jugada. Se mide con cada carta en su sitio.
      container.classList.add('mesa-midiendo');
      // En puntos de la mesa: dentro de la partida, los del iPhone de referencia (mesa-escala.js).
      const available = CT.Mesa.alto();
      const top = mesaCaja(shell).top + CT.Mesa.desplazado();
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
      container.classList.remove('board-card-expanded', 'board-hand-expanded', 'board-hand-air', 'board-hand-hold');
      container.style.removeProperty('--board-hand-hold');
      container.style.removeProperty('--optimal-timeline-width');
      container.style.removeProperty('--optimal-hand-width');
      container.style.removeProperty('--optimal-fan-card');
      container.style.removeProperty('--board-hand-air');
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
          const start = Math.floor(mesaCaja(card).width);
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
            container.style.setProperty('--board-image-height', `${Math.max(64, Math.floor(mesaCaja(visual).height - excess - 4))}px`);
            container.classList.add('board-image-condensed');
          }
        }
      }
      if (!fits() && container.dataset.boardFit === 'normal') container.dataset.boardFit = 'compact';
      if (!fits() && container.dataset.boardFit === 'compact') container.dataset.boardFit = 'tight';
      // Aprovecha el papel libre dentro de la línea. Primero crece la carta de la línea,
      // como siempre; con lo que quede crece tu carta (o el abanico de la mano), para que la
      // mesa quede repartida entre la mano y la línea en vez de dejar papel vacío abajo.
      // Todo de forma progresiva y sin sacar ningún mando de la vista.
      if (!shrunk && fits() && CT.Mesa.ancho() >= 375) {
        const section = shell.querySelector('.board-timeline-section');
        const card = section?.querySelector('.timeline .timeline-card');
        if (card) {
          const gap = Math.min(mesaCaja(section).bottom, available) - mesaCaja(card).bottom;
          const base = mesaCaja(card).width;
          const growth = Math.min(38, Math.max(0, Math.floor((gap - 25) / 1.5)));
          if (growth >= 5) {
            container.classList.add('board-card-expanded');
            let expanded = false;
            for (let amount = growth; amount >= 0; amount -= 2) {
              container.style.setProperty('--optimal-timeline-width', `${base + amount}px`);
              if (fits() && mesaCaja(card).bottom <= available - 8) {
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
      // Con lo que la línea deja libre, crece tu carta (o el abanico de la mano).
      const fanCard = shell.querySelector('.atlas-hand-section .hand.hand-fan .hand-card');
      const fanKey = fanCard ? `${container.dataset.screen}:${CT.Mesa.ancho()}x${CT.Mesa.alto()}` : null;
      if (fanKey && fanHold?.key === fanKey) {
        if (fanHold.width) { container.classList.add('board-hand-expanded'); container.style.setProperty('--optimal-fan-card', fanHold.width); }
      } else if (!shrunk && fits() && CT.Mesa.ancho() >= 375) {
        const section = shell.querySelector('.board-timeline-section');
        const card = section?.querySelector('.timeline .timeline-card');
        if (card) growHand(container, shell, section, card, available, fits);
      }
      if (fanKey && fanHold?.key !== fanKey) fanHold = { key: fanKey, width: container.style.getPropertyValue('--optimal-fan-card') || '' };
      // Al elegir hueco, tu carta pasa a la línea como vista previa: su sitio en la mano
      // conserva el alto que tenía para que la línea no suba de golpe.
      const handSection = shell.querySelector(':scope > :is(.atlas-hand-section, .board-focus-card)');
      const previewing = !!handSection?.querySelector('.provisional-hand-note');
      // Si ahora no cabe entero (aparece el botón de colocar), guarda todo el que quepa.
      if (previewing && heldHand?.screen === container.dataset.screen) {
        const now = mesaCaja(handSection).height;
        container.classList.add('board-hand-hold');
        let held = false;
        for (let height = heldHand.height; height > now + 8; height -= 8) {
          container.style.setProperty('--board-hand-hold', `${height}px`);
          if (fits()) { held = true; break; }
        }
        if (!held) { container.classList.remove('board-hand-hold'); container.style.removeProperty('--board-hand-hold'); }
      }
      // El papel que aún sobre bajo la línea pasa alrededor de la mano: la línea baja y las
      // dos mitades de la mesa quedan equilibradas en vez de dejar un hueco abajo.
      if (!shrunk && !previewing && fits()) {
        const section = shell.querySelector('.board-timeline-section');
        const card = section?.querySelector('.timeline .timeline-card');
        const spare = card ? Math.floor(freeBelow(section, card, available) - 30) : 0;
        if (spare >= 16) {
          container.classList.add('board-hand-air');
          container.style.setProperty('--board-hand-air', `${Math.floor(spare / 2)}px`);
          if (!fits()) { container.classList.remove('board-hand-air'); container.style.removeProperty('--board-hand-air'); }
        }
      }
      if (handSection && !previewing && handSection.querySelector('.hand-card')) heldHand = { screen: container.dataset.screen, height: Math.round(mesaCaja(handSection).height) };
      container.classList.remove('mesa-midiendo');
    });
  }
  // Papel libre bajo la carta de la línea, dentro de su recuadro y de la pantalla.
  const freeBelow = (section, card, available) => Math.min(mesaCaja(section).bottom, available) - mesaCaja(card).bottom;
  function growHand(container, shell, section, card, available, fits) {
    const solo = shell.querySelector('.board-focus-card .hand-solo .hand-card');
    const fan = shell.querySelector('.atlas-hand-section .hand.hand-fan .hand-card');
    const target = solo || fan;
    const share = (freeBelow(section, card, available) - 30) / 2;
    if (!target || share < 12) return;
    const base = mesaCaja(target).width;
    // `solo` es 3:4 y el abanico 2:3: cada píxel de ancho suma 4/3 o 3/2 de alto.
    const ratio = solo ? 4 / 3 : 3 / 2;
    // En el abanico, la carta más lejana del centro queda a 1,1 anchos, mide 0,72 y va
    // girada: su borde tiene que seguir dentro de la pantalla.
    // Tu carta no pasa de un cuarto del alto en pantallas bajas, ni de un tercio largo en las altas.
    const tallest = available * (available <= 740 ? 0.25 : 0.32);
    const limit = solo ? Math.min(CT.Mesa.ancho() * 0.5, 210, tallest / ratio) : Math.min((CT.Mesa.ancho() / 2 - 10) / 1.6, 150);
    const wanted = Math.min(limit, base + Math.floor(share / ratio));
    if (wanted < base + 6) return;
    const property = solo ? '--optimal-hand-width' : '--optimal-fan-card';
    container.classList.add('board-hand-expanded');
    for (let width = wanted; width > base; width -= 4) {
      container.style.setProperty(property, `${width}px`);
      if (fits() && freeBelow(section, card, available) >= 30) return;
    }
    container.classList.remove('board-hand-expanded');
    container.style.removeProperty(property);
  }
  window.addEventListener('resize', () => {
    fitBoard(document.getElementById('app'));
    scheduleCardText();
  }, {passive: true});
  window.visualViewport?.addEventListener('resize', () => {
    fitBoard(document.getElementById('app'));
    scheduleCardText();
  }, {passive: true});

  // Acabado común de los formularios: solo decoración; conserva los controles,
  // sus nodos, identificadores y eventos, y no interviene en partidas ni esperas.
  function decorateSetup(container, screen) {
    const screens = new Set(['setup', 'solo-home', 'duel-home', 'competition-menu',
      'competition-friends', 'friends-join', 'hub-online-create', 'online-entry',
      'local-entrada', 'local-unirse', 'quick-challenges']);
    if (!screens.has(screen)) return;
    const candidates = container.querySelectorAll('.setup-section .panel, .online-entry-grid > .online-form, .public-create');
    const usedArt = new Set([...container.querySelectorAll('img[src]')].map(image => image.getAttribute('src').split('/').pop()));
    candidates.forEach(panel => {
      if (panel.closest('.quick-free-setup') || panel.classList.contains('setup-art-panel') || panel.matches('details:not(.solo-fold)')) return;
      if (!panel.matches('.online-form, .solo-panel-maraton, .solo-fold') && !panel.querySelector('input:not([type="hidden"]), select, textarea:not([hidden]), .segmented, .setup-block')) return;
      panel.classList.add('setup-art-panel');
      const quick = !!panel.closest('.quick-shell');
      const competition = screen.startsWith('competition');
      const alone = screen === 'solo-home';
      const joining = screen === 'friends-join' || screen === 'local-unirse' || panel.matches('[data-online-form="join"], [data-local-form="join-offer"]');
      const scene = document.documentElement.dataset.scene;
      const collectionArt = ['history', 'entertainment', 'science', 'nature', 'geography', 'mixed'].includes(scene)
        ? `hero-${scene}-400.webp` : 'menu-collections.webp';
      const choices = quick ? ['hero-quick-400.webp', 'hero-mixed-400.webp', 'voyage-duels-v1.webp']
        : competition ? ['hero-mixed-400.webp', 'voyage-collection-v1.webp']
        : alone ? [collectionArt, 'saved-journey-v1.webp', 'voyage-collection-v1.webp']
        : screen.startsWith('local-') ? ['menu-wifi.webp', 'voyage-duels-v1.webp']
        : ['menu-private.webp', 'voyage-duels-v1.webp', 'menu-collections.webp'];
      const art = choices.find(file => !usedArt.has(file)) || 'hero-geography-400.webp';
      usedArt.add(art);
      const kicker = competition ? 'Cada ronda cuenta' : alone ? 'A tu ritmo' : joining ? 'Tu sitio en la mesa' : 'La mesa os espera';
      panel.style.setProperty('--setup-illustration', `url("assets/${art}")`);
      if (panel.matches('.solo-fold')) return; // el desplegable ya conserva su cabecera
      let head = panel.querySelector(':scope > .solo-panel-head');
      const heading = head?.querySelector('h3') || panel.querySelector(':scope > h3');
      if (!head) { head = document.createElement('div'); head.className = 'solo-panel-head'; panel.prepend(head); }
      head.classList.add('setup-art-head');
      const image = document.createElement('img');
      image.className = 'setup-art-image'; image.src = `assets/${art}`;
      image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.decoding = 'async';
      const copy = document.createElement('div'); copy.className = 'setup-art-copy';
      const label = document.createElement('span'); label.className = 'setup-art-kicker'; label.textContent = kicker;
      const title = heading || document.createElement('h3');
      if (!heading) title.textContent = joining ? 'Únete a la partida' : screen === 'hub-online-create' ? 'Prepara tu mesa' : screen === 'setup' ? 'Prepara la partida' : 'Elegid vuestra partida';
      copy.append(label, title); head.append(image, copy);
    });
  }

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
    decorateSetup(container, screen);

    surfaceNav.clear();
    const inGame = playing.has(screen);
    container.classList.toggle('atlas-playing', inGame);
    container.classList.toggle('atlas-board', board.has(screen));
    CT.Mesa.aplica(container, board.has(screen));
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
      // El zoom vive en el menú ⋯ de la partida: la barra de arriba queda solo
      // con volver, el título y el menú. Sin menú (algunas salas), el zoom sigue en la línea.
      const menuButton = container.querySelector(':is(.topbar, .atlas-topbar) :is(.atlas-topbar-actions, .topbar-actions) > button');
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
    if (screen === 'game' && CT.Mesa.ancho() <= 699) window.requestAnimationFrame?.(() => {
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
  // Al abrir el menú ⋯ de una partida se añade arriba un bloque «Vista» con el zoom.
  // Se engancha a cualquier menú de la barra superior, sea cual sea la modalidad.
  document.addEventListener('click', event => {
    const opener = event.target.closest?.('#app.atlas-menu-tools :is(.atlas-topbar-actions, .topbar-actions) > button');
    if (!opener) return;
    setTimeout(() => {
      const modal = [...document.querySelectorAll('#app > .overlay .modal')].at(-1);
      if (!modal || modal.querySelector('.menu-view-tools')) return;
      const zoom = document.querySelector('#app .timeline-zoom');
      const levels = zoom ? [...zoom.querySelectorAll('.zoom-menu [data-zoom-level]')] : [];
      if (!levels.length) return;
      const block = document.createElement('div');
      block.className = 'menu-view-tools';
      block.innerHTML = `${levels.length ? `<div class="menu-view-row"><span>Zoom de las cartas</span><div class="menu-view-zoom" role="group" aria-label="Zoom de las cartas">${levels.map(b => `<button type="button" data-zoom-level="${b.dataset.zoomLevel}" aria-pressed="${b.getAttribute('aria-pressed')}">${b.textContent}</button>`).join('')}</div></div>` : ''}`;
      block.addEventListener('click', e => {
        const level = e.target.closest('[data-zoom-level]');
        if (level) setTimeout(() => block.querySelectorAll('[data-zoom-level]').forEach(b => b.setAttribute('aria-pressed', String(b === level))), 0);
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
    updateEffects() { refreshDepth(); }};
})();
