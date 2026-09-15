// Presentación compartida: nunca escribe el estado ni decide el resultado de una jugada.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const playing = new Set(['game', 'solo', 'online-game', 'pass', 'pulse-pass', 'final-local', 'online-final', 'comp-intro', 'tournament-intro', 'online-competition-intro']);
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
  function mount(container, screen) {
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
      const wrap = container.querySelector('.timeline-wrap');
      const zoom = container.querySelector('.timeline-zoom');
      if (wrap && zoom) wrap.after(zoom);
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
        if (confirm) { confirm.textContent = 'Confirmar posición'; dock.append(confirm); }
        if (cancel) { cancel.textContent = 'Cambiar posición'; dock.append(cancel); }
      } else {
        dock.innerHTML = `<button class="btn btn-primary btn-block" disabled>Confirmar posición</button><span class="placement-instruction">${screen === 'solo' ? 'Toca un hueco de la línea para colocar tu carta' : 'Elige una carta y un hueco de la línea'}</span>`;
      }
      container.querySelector('.shell')?.append(dock);
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
  function reveal(modal) {
    const value = modal?.querySelector('.reveal');
    if (value && !reduced()) value.classList.add('atlas-reveal');
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
      scenes.forEach(target => {
        const rect = target.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        target.style.setProperty('--depth-x', `${tilt.x * 7}px`);
        target.style.setProperty('--depth-y', `${tilt.y * 5}px`);
        target.style.setProperty('--cover-rx', `${-tilt.y * 2}deg`);
        target.style.setProperty('--cover-ry', `${tilt.x * 2.5}deg`);
      });
    });
  }
  function refreshDepth() {
    const enabled = CT.effectPrefs?.().depth && !reduced() && !document.hidden && !!depthTarget();
    if (enabled && !depthListening) { origin = null; window.addEventListener('deviceorientation', onTilt, {passive: true}); depthListening = true; }
    else if (!enabled && depthListening) {
      window.removeEventListener('deviceorientation', onTilt); depthListening = false; origin = null;
      cancelAnimationFrame(depthFrame); depthFrame = 0;
      document.querySelectorAll('[data-depth-scene], .gallery-panel').forEach(scene => { scene.style.removeProperty('--depth-x'); scene.style.removeProperty('--depth-y'); scene.style.removeProperty('--cover-rx'); scene.style.removeProperty('--cover-ry'); });
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
        panel.style.setProperty('--scene-scroll', `${offset}px`);
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
  // Papel sintetizado de 130 ms y una grabación de guitarra, ambos optativos.
  let audio, ambient = [], guitarBuffer, audioStarted = false;
  let ambientRequest = 0, ambientLoading = false, pageActive = true;
  function context() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    audio ||= new Audio();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    audioStarted = true;
    return audio;
  }
  function paper() {
    if (!CT.effectPrefs?.().sound || document.hidden) return;
    try {
      const ctx = context(); if (!ctx) return;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .13), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .12;
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1300;
      gain.gain.setValueAtTime(.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .13);
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start(); source.stop(ctx.currentTime + .14);
    } catch { /* Un efecto nunca interrumpe el juego. */ }
  }
  // Composición original con muestras de guitarra acústica real. Se descarga y
  // decodifica una vez; el service worker la conserva también sin conexión.
  function guitarLoop(ctx) {
    if (!guitarBuffer) {
      guitarBuffer = fetch('assets/audio/entre-paginas.mp3')
        .then(response => {
          if (!response.ok) throw new Error('Audio unavailable');
          return response.arrayBuffer();
        })
        .then(data => ctx.decodeAudioData(data))
        .catch(error => { guitarBuffer = null; throw error; });
    }
    return guitarBuffer;
  }
  function stopAmbient(immediate = false) {
    ++ambientRequest; ambientLoading = false;
    const nodes = ambient; ambient = [];
    nodes.forEach(({source,gain}) => {
      try {
        if (immediate) { source.stop(); source.disconnect(); gain.disconnect(); }
        else {
          gain.gain.cancelScheduledValues(audio.currentTime);
          gain.gain.setTargetAtTime(0,audio.currentTime,.06);
          source.stop(audio.currentTime + .3);
        }
      } catch { source.disconnect(); gain.disconnect(); }
    });
  }
  async function syncAmbient(fromGesture = false) {
    const enabled = CT.effectPrefs?.().ambience && !document.hidden && pageActive;
    if (!enabled) { stopAmbient(document.hidden); return; }
    if (ambient.length || ambientLoading || (!fromGesture && !audioStarted)) return;
    const request = ++ambientRequest;
    try {
      const ctx = context(); if (!ctx) return;
      ambientLoading = true;
      const buffer = await guitarLoop(ctx);
      if (request !== ambientRequest || !CT.effectPrefs?.().ambience || document.hidden || !pageActive) return;
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.setValueAtTime(0,ctx.currentTime);
      gain.gain.linearRampToValueAtTime(.12,ctx.currentTime + 1.5);
      source.connect(gain); gain.connect(ctx.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      ambient = [{source,gain}]; source.start();
    } catch { if (request === ambientRequest) stopAmbient(true); }
    finally { if (request === ambientRequest) ambientLoading = false; }
  }
  document.addEventListener('visibilitychange', () => { refreshDepth(); syncAmbient(); });
  window.addEventListener('pagehide', () => { pageActive = false; stopAmbient(true); });
  window.addEventListener('pageshow', () => { pageActive = true; syncAmbient(); });
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', refreshDepth);
  document.addEventListener('click', event => {
    if (event.target.closest('.gallery-panel, .game-row, .play-choice, .hand-card:not(:disabled), [data-action="confirm-place"], [data-online-action="confirm-place"]')) paper();
    syncAmbient(true);
  }, true);
  CT.UI = {isPlaying: screen => playing.has(screen), header, nav, deckIntro, mount, confirmExit, reveal, openSurface, closeSurface, requestDepth,
    updateEffects() { refreshDepth(); syncAmbient(true); }};
})();
