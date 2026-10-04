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
  // Dibujo vectorial propio: cada parte puede moverse sin descargar sprites.
  const artwork = `<svg class="cronista-art" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
    <ellipse cx="80" cy="147" rx="55" ry="6" fill="#503523" opacity=".15"/>
    <g class="cronista-book" stroke="#654329" stroke-width="2.5" stroke-linejoin="round">
      <path d="M29 128q25-10 51 0q26-10 51 0v17q-26-7-51 0q-26-7-51 0Z" fill="#a76d3b"/>
      <path d="M31 122q25-8 49 2q25-10 49-2v18q-25-7-49 2q-25-9-49-2Z" fill="#ead5a5"/>
      <path d="M80 125v16m-39-11 26 2m-25 4 23 2m28-6 25-2m-24 8 23-2" fill="none" opacity=".55"/>
    </g>
    <g class="cronista-body">
      <path d="M45 60Q31 119 64 129h33q31-10 20-69Z" fill="#99633d" stroke="#503523" stroke-width="3"/>
      <ellipse cx="81" cy="97" rx="26" ry="31" fill="#dcc08a"/>
      <path d="m67 93 5 5 5-5m7 10 5 5 5-5m-25 9 5 5 5-5" fill="none" stroke="#a2784b" stroke-width="2"/>
      <g class="cronista-wing-left"><path d="M47 70q-26 20-7 47q18-8 21-36" fill="#795037" stroke="#503523" stroke-width="3"/><path d="m42 87 6 17m-10-8 5 14" stroke="#c0935e" stroke-width="2"/></g>
      <g class="cronista-wing-right"><path d="M113 72q25 15 12 43q-17-4-24-28" fill="#795037" stroke="#503523" stroke-width="3"/></g>
      <path d="m65 126-7 5m10-5v7m27-7v7m3-7 7 5" stroke="#b87a36" stroke-width="4" stroke-linecap="round"/>
      <g class="cronista-head">
        <path d="m42 46-3-27 25 13q17-6 33 0l26-13-4 29q7 42-39 43q-45-1-38-45Z" fill="#a57449" stroke="#503523" stroke-width="3"/>
        <path d="M80 43q-24-21-36 6q-10 30 36 36q46-6 36-36Q104 22 80 43Z" fill="#eedab0"/>
        <g class="cronista-eyes">
          <ellipse cx="61" cy="57" rx="13" ry="15" fill="#fcf3d6"/><ellipse cx="99" cy="57" rx="13" ry="15" fill="#fcf3d6"/>
          <g class="cronista-pupils" fill="#392b22"><ellipse cx="63" cy="58" rx="6" ry="9"/><ellipse cx="97" cy="58" rx="6" ry="9"/></g>
          <g fill="#fff8e9"><circle cx="65" cy="54" r="2.5"/><circle cx="99" cy="54" r="2.5"/></g>
        </g>
        <g fill="none" stroke="#715133" stroke-width="3"><circle cx="61" cy="58" r="18"/><circle cx="99" cy="58" r="18"/><path d="M79 56h2m-38 0-5-4m79 4 6-4"/></g>
        <path d="m73 73 7 11 7-11q-7-8-14 0Z" fill="#c58a38" stroke="#805125" stroke-width="2"/>
        <path d="m51 33 12 3m34 0 12-3" fill="none" stroke="#503523" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g class="cronista-quill" stroke="#654329" stroke-width="2" stroke-linejoin="round">
        <path d="M117 120q-6-29 17-64q15 28-12 53Z" fill="#eee0bb"/>
        <path d="m116 133 19-71m-9 32 9-5m-12 15 9-4" fill="none"/>
      </g>
    </g>
    <g class="cronista-sparkles" fill="#b88136"><path d="m25 41 3-8 3 8 8 3-8 3-3 8-3-8-8-3Zm105-13 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/></g>
  </svg>`;
  let node, screen, timer, streak = 0, state = 'idle', message = words.idle, collapsed = false;
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
    if (duration) timer = setTimeout(() => { state = 'idle'; message = words.idle; update(); }, duration);
  }
  function mount(container, nextScreen) {
    const active = boards.has(nextScreen) || endings.has(nextScreen) || turns.has(nextScreen);
    if (screen !== nextScreen) {
      const continuing = boards.has(screen) || turns.has(screen);
      clearTimeout(timer);
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
  }
  function reveal(modal) {
    if (!node || !modal?.querySelector('.reveal, .result-summary')) return;
    modal.append(node); update();
  }
  CT.Companion = {
    mount, reveal,
    roundEnd(final) { react(final ? 'finished' : 'turn', undefined, 0); },
    feedback(correct) {
      streak = correct ? streak + 1 : 0;
      react(correct ? streak === 3 ? 'streak' : 'success' : 'failure');
    }
  };
  document.addEventListener('click', event => {
    const target = event.target.closest?.('button');
    if (!target || target.disabled) return;
    if (target.hasAttribute('data-cronista-toggle')) {
      collapsed = !collapsed;
      try { CT.Storage?.setItem(KEY, collapsed ? 'hidden' : 'visible'); } catch { /* Sigue funcionando sin almacenamiento. */ }
      update(); return;
    }
    if (target.hasAttribute('data-cronista-greet')) { react('greeting'); return; }
    if (!node || collapsed) return;
    const action = target.dataset.action || target.dataset.onlineAction || target.dataset.quick;
    if (['select-card', 'select'].includes(action)) react('thinking');
    else if (['solo-place', 'place', 'slot'].includes(action)) react('writing');
  });
})();
