// Presentación compartida: nunca escribe el estado ni decide el resultado de una jugada.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const playing = new Set(['game', 'solo', 'cifras', 'online-game', 'pass', 'pulse-pass', 'final-local', 'online-final', 'comp-intro', 'tournament-intro', 'online-competition-intro']);
  const board = new Set(['game', 'solo', 'online-game']);
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const icons = {
    back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
    book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-3 1-3 3 2 2-1 4 3 2 3-1 3 4 3-2 1-3 4-2-1-4-3-1-1-4Z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  function header(back = '', menu = '', inGame = false) {
    return `<header class="topbar atlas-topbar${inGame ? ' atlas-game-topbar' : ''}">
      ${back ? `<button class="icon-btn atlas-back" ${back} aria-label="Volver a la pantalla anterior">${icon('back')}</button>` : '<span></span>'}
      ${inGame ? '<span></span>' : '<div class="brand">Continuum</div>'}
      ${menu ? `<button class="icon-btn atlas-menu" ${menu} aria-label="Opciones de la partida" aria-haspopup="dialog">${icon('more')}</button>` : '<span></span>'}
    </header>`;
  }
  function nav(screen) {
    return `<nav class="home-nav atlas-nav" aria-label="Menú principal">${[
      ['home-top', 'home', 'Inicio', 'home'], ['home-encyclopedia', 'book', 'Enciclopedia', 'enciclopedia'],
      ['rules', 'guide', 'Guía', 'guide'], ['perfil', 'profile', 'Perfil', 'perfil'], ['settings', 'settings', 'Ajustes', 'settings']
    ].map(([action, symbol, label, current]) => `<button aria-label="${label}" ${action === 'settings' ? 'data-settings-action="open"' : `data-action="${action}"`}${screen === current ? ' aria-current="page"' : ''}><span>${icon(symbol)}</span><small>${label}</small></button>`).join('')}</nav>`;
  }
  function deckIntro(modeKey, cover) {
    const mode = CT.mode(modeKey), block = CT.blockOf(modeKey);
    // Muestras fijas repartidas por el mazo: no usan la mano, el reparto ni valores ocultos.
    const illustrated = mode.cards.filter(card => CT.cardArt(modeKey, card));
    const samples = [...new Set([illustrated[0], illustrated[Math.floor(illustrated.length / 2)], illustrated.at(-1)].filter(Boolean))];
    return `<section class="mode-masthead atlas-intro" data-depth-scene>
      <div class="atlas-landscape"><img src="${cover}" alt="" decoding="async" fetchpriority="high"></div>
      <div class="atlas-intro-copy"><div class="eyebrow">${CT.escapeHtml(block.name)}</div><h1 data-focus tabindex="-1">${CT.escapeHtml(mode.name)}</h1><p>${CT.escapeHtml(mode.blurb)}</p></div>
      <div class="atlas-specimens" aria-label="Una muestra de las ilustraciones del mazo">${samples.map(card => `<figure>${CT.animalArt(modeKey, card)}<figcaption>${CT.escapeHtml(card.title)}</figcaption></figure>`).join('')}</div>
    </section>`;
  }
  function confirmExit(message, proceed, title = '¿Salir de la partida?', label = 'Guardar y salir') {
    const app = document.getElementById('app');
    if (app.querySelector('[data-exit-dialog]')) return;
    const layer = document.createElement('div'); layer.className = 'overlay'; layer.dataset.exitDialog = '';
    layer.innerHTML = `<div class="modal"><h2>${CT.escapeHtml(title)}</h2><p>${CT.escapeHtml(message)}</p><div class="actions"><button class="btn btn-primary" data-exit-stay>Seguir jugando</button><button class="btn btn-secondary" data-exit-confirm>${CT.escapeHtml(label)}</button></div></div>`;
    layer.querySelector('[data-exit-stay]').addEventListener('click', () => CT.closeDialog());
    layer.querySelector('[data-exit-confirm]').addEventListener('click', () => { CT.closeDialog(); proceed(); });
    app.append(layer); CT.openDialog(layer, true);
  }
  let finalCards = [];
  function captureBoard(container) {
    const cards = [...container.querySelectorAll('.timeline .timeline-card')];
    if (cards.length) finalCards = cards.slice(-7).map(card => card.cloneNode(true));
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
  }
  function mount(container, screen) {
    if (['solo-end', 'winner', 'online-winner', 'comp-end'].includes(screen)) atlasFinal(container);
    if (screen === 'home') finalCards = [];

    surfaceNav.clear();
    const inGame = playing.has(screen);
    container.classList.toggle('atlas-playing', inGame);
    container.classList.toggle('atlas-board', board.has(screen));
    // El fondo de la enciclopedia es una instantánea inerte; su barra no es la real.
    container.querySelectorAll('.enc-background .home-nav').forEach(el => el.remove());
    if (inGame) container.querySelectorAll('.home-nav').forEach(el => el.remove());
    else if (!container.querySelector('.home-nav')) {
      const destination = container.querySelector('.enc-modal') || container.querySelector('.shell') || container;
      destination.insertAdjacentHTML('beforeend', nav(screen));
    }
    container.classList.toggle('atlas-has-nav', !inGame);
    if (board.has(screen)) {
      const lives = container.querySelector('.solo-lives');
      const counters = container.querySelector('.game-head');
      if (lives && counters) counters.insertBefore(lives, counters.querySelector('.deck-count'));
      const wrap = container.querySelector('.timeline-wrap');
      const zoom = container.querySelector('.timeline-zoom');
      const timelineHeading = wrap?.parentElement.querySelector('.hand-title');
      if (timelineHeading && zoom) {
        timelineHeading.classList.add('timeline-toolbar');
        const caption = document.createElement('div'); caption.className = 'timeline-caption';
        caption.append(...timelineHeading.childNodes);
        timelineHeading.append(caption, zoom);
      }
      const hand = container.querySelector('.hand');
      if (hand) {
        hand.closest('section')?.classList.add('atlas-hand-section');
        // Se desplaza la mano cuando hay más de cuatro; nunca se eliminan cartas.
        hand.classList.toggle('atlas-hand-many', hand.children.length > 4);
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
        if (confirm) { confirm.textContent = 'Confirmar'; actions.append(confirm); }
        if (cancel) { cancel.textContent = 'Cambiar'; actions.append(cancel); }
        dock.setAttribute('role', 'group');
        dock.setAttribute('aria-label', 'Confirmar la posición elegida');
        dock.append(status, actions);
      } else {
        dock.innerHTML = `<span class="placement-instruction">${screen === 'solo' ? 'Toca un hueco de la línea para colocar tu carta' : 'Elige una carta y un hueco de la línea'}</span>`;
      }
      const shell = container.querySelector('.shell');
      const timelineSection = container.querySelector('.timeline-wrap')?.closest('section');
      // Cuando hay una decisión pendiente, sus mandos pertenecen a la línea y quedan
      // justo después de ella. En el flujo no cubren la carta ni dependen del alto de la
      // barra del navegador. La instrucción sin botones sigue cerrando la página.
      if (slot && timelineSection) timelineSection.insertAdjacentElement('afterend', dock);
      else shell?.append(dock);
    }
    refreshDepth();
  }
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
      document.querySelectorAll('#app .home-gallery-shell .gallery-panel').forEach(panel => {
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
  CT.UI = {isPlaying: screen => playing.has(screen), header, nav, deckIntro, mount, captureBoard, compactResult, confirmExit, reveal, openSurface, closeSurface, requestDepth,
    updateEffects() { refreshDepth(); CT.Ambience?.sync(true); }};
})();
