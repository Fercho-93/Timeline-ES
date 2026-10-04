(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const KEY = 'continuum-cronista-v1';
  const boards = new Set(['game', 'solo', 'cifras', 'online-game', 'local-game', 'quick-game', 'final-local', 'online-final']);
  const endings = new Set(['solo-end', 'winner', 'online-winner', 'comp-end']);
  const turns = new Set(['pass', 'pulse-pass', 'comp-intro', 'tournament-intro', 'online-competition-intro', 'quick-lobby']);
  const words = {
    idle: 'Cada carta guarda una historia. Te acompaño.',
    thinking: 'Observa las cartas y encuentra su lugar.',
    writing: 'Pluma preparada… tú decides dónde encaja.',
    success: '¡Bien colocado! Lo anoto en nuestra crónica.',
    streak: '¡Tres aciertos seguidos! Tu crónica toma vuelo.',
    failure: 'También se aprende al fallar. Seguimos escribiendo.',
    turn: 'Nueva página, nuevo turno. Tu historia continúa.',
    finished: 'Una crónica más en el archivo. Gracias por jugar.',
    greeting: 'Soy el búho cronista. Tú juegas, yo guardo la historia.'
  };
  // Atlas original de seis poses: conserva la anatomía y el plumaje entre reacciones.
  const artwork = '<span class="cronista-art" aria-hidden="true"><span class="cronista-sprite-rest"></span><span class="cronista-sprite"></span><span class="cronista-aura"></span><span class="cronista-ink"></span><span class="cronista-feathers">' + Array.from({length: 8}, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</span></span>';
  let node, screen, timer, motion, streak = 0, state = 'idle', message = words.idle, collapsed = false;
  try { collapsed = CT.Storage?.getItem(KEY) === 'hidden'; } catch { /* Preferencia opcional. */ }

  function update() {
    if (!node) return;
    node.dataset.mood = state;
    node.classList.toggle('cronista-collapsed', collapsed);
    node.querySelector('.cronista-message').textContent = message;
    const toggle = node.querySelector('[data-cronista-toggle]');
    toggle.textContent = collapsed ? 'Mostrar' : 'Ocultar';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar búho cronista' : 'Ocultar búho cronista');
  }
  function react(mood, text, duration = 4200) {
    clearTimeout(timer);
    state = mood; message = text || words[mood] || words.idle;
    update();
    playReaction();
    if (duration) timer = setTimeout(() => { state = 'idle'; message = words.idle; stopReaction(); update(); }, duration);
  }
  function stopReaction() {
    motion?.cancel(); motion = null;
    node?.classList.remove('cronista-reacting');
  }
  function playReaction() {
    stopReaction();
    if (!node || collapsed || document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Un fotograma distinto reinicia incluso dos aciertos consecutivos, sin mover la mesa.
    void node.offsetWidth;
    node.classList.add('cronista-reacting');
    const flight = state === 'streak';
    const art = node.querySelector(flight ? '.cronista-sprite' : '.cronista-art');
    const celebration = ['success', 'finished', 'greeting'].includes(state);
    const frames = flight ? [
      {transform:'translate(0, 0) scale(1)'},
      {transform:'translate(-6px, -22px) scale(1.12) rotate(-5deg)', offset:.3},
      {transform:'translate(-4px, -34px) scale(1.14) rotate(4deg)', offset:.6},
      {transform:'translate(0, 0) scale(1)'}
    ] : celebration ? [
      {transform:'translateY(0) scale(1)'},
      {transform:'translateY(-12px) scale(1.12)', offset:.35},
      {transform:'translateY(-3px) scale(1.05)', offset:.75},
      {transform:'translateY(0) scale(1)'}
    ] : [
      {transform:'rotate(0)'}, {transform:'rotate(-3deg) translateY(2px)'}, {transform:'rotate(0)'}
    ];
    motion = art.animate?.(frames, {duration: flight ? 1900 : celebration ? 1300 : 700, easing:'cubic-bezier(.22,.61,.36,1)'});
    motion?.finished?.catch(() => {});
  }
  function mount(container, nextScreen) {
    const active = boards.has(nextScreen) || endings.has(nextScreen) || turns.has(nextScreen);
    if (screen !== nextScreen) {
      const continuing = boards.has(screen) || turns.has(screen);
      clearTimeout(timer); stopReaction();
      if (!active || (!continuing && boards.has(nextScreen))) streak = 0;
      state = endings.has(nextScreen) ? 'finished' : turns.has(nextScreen) ? 'turn' : 'idle';
      message = words[state]; screen = nextScreen;
    }
    if (!active) { node?.remove(); node = null; return; }
    const host = container.querySelector('.shell') || container.firstElementChild;
    if (!host) return;
    // Un único nodo sobrevive a los repintados; los resultados lo trasladan a su ficha.
    if (!node) {
      node = document.createElement('aside'); node.className = 'cronista';
      node.setAttribute('aria-label', 'Búho cronista');
      node.innerHTML = `<button type="button" class="cronista-greet" data-cronista-greet aria-label="Saludar al búho cronista">${artwork}</button><div class="cronista-copy"><span class="cronista-name">El cronista</span><p class="cronista-message"></p></div><button type="button" class="cronista-toggle" data-cronista-toggle></button>`;
    }
    container.querySelectorAll('.cronista').forEach(el => { if (el !== node) el.remove(); });
    host.append(node); update();
    if (['finished', 'turn'].includes(state)) playReaction();
  }
  function reveal(modal) {
    if (!node || !modal?.querySelector('.reveal, .result-summary')) return;
    modal.append(node); update(); playReaction();
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  reduced?.addEventListener?.('change', event => { if (event.matches) stopReaction(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopReaction(); });
  CT.Companion = {
    mount, reveal,
    roundEnd(final) { react(final ? 'finished' : 'turn', undefined, 0); },
    feedback(correct) {
      streak = correct ? streak + 1 : 0;
      react(correct ? streak >= 3 && streak % 3 === 0 ? 'streak' : 'success' : 'failure');
    }
  };
  document.addEventListener('click', event => {
    const target = event.target.closest?.('button');
    if (!target || target.disabled) return;
    if (target.hasAttribute('data-cronista-toggle')) {
      collapsed = !collapsed;
      try { CT.Storage?.setItem(KEY, collapsed ? 'hidden' : 'visible'); } catch { /* Sigue funcionando sin almacenamiento. */ }
      if (collapsed) stopReaction();
      update(); return;
    }
    if (target.hasAttribute('data-cronista-greet')) { react('greeting'); return; }
    if (!node || collapsed) return;
    const action = target.dataset.action || target.dataset.onlineAction || target.dataset.quick;
    if (['select-card', 'select'].includes(action)) react('thinking');
    else if (['solo-place', 'place', 'slot'].includes(action)) react('writing');
  });
})();
