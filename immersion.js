// Presentación compartida: nunca escribe el estado ni decide el resultado de una jugada.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const playing = new Set(['game', 'solo', 'cifras', 'online-game', 'pass', 'pulse-pass', 'final-local', 'online-final', 'comp-intro', 'tournament-intro', 'online-competition-intro', 'quick-game', 'quick-lobby']);
  const board = new Set(['game', 'solo', 'online-game', 'quick-game']);
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const icons = {
    back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
    book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
    profile: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5.5 21v-1.5a6.5 6.5 0 0 1 13 0V21"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/>',
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
      ['home-top', 'home', 'Inicio', ['home']], ['rules', 'guide', 'Guía', ['guide']], ['settings', 'settings', 'Ajustes', ['settings']]
    ].map(([action, symbol, label, current]) => `<button aria-label="${label}" ${action === 'settings' ? 'data-settings-action="open"' : `data-action="${action}"`}${current.includes(screen) ? ' aria-current="page"' : ''}><span>${icon(symbol)}</span><small>${label}</small></button>`).join('')}</nav>`;
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
  function mount(container, screen) {
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
