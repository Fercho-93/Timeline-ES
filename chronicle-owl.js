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
    <ellipse cx="80" cy="149" rx="48" ry="3" fill="#40382e" opacity=".12"/>
    <g class="cronista-book" stroke="#756044" stroke-width="1" stroke-linejoin="round">
      <path d="M34 131q24-7 46 1q22-8 46-1v14q-23-4-46 2q-22-6-46-2Z" fill="#5d4936"/>
      <path d="M36 127q23-6 44 2q22-8 44-2v15q-23-5-44 2q-22-7-44-2Z" fill="#d9c6a0"/>
      <path d="M38 128q22-4 42 3q21-7 42-3v11q-21-4-42 3q-21-7-42-3Z" fill="#f1e7ce"/>
      <path d="M80 131v12m-36-9 26 2m-26 1 26 2m21-3 25-2m-25 5 25-2" fill="none" stroke="#b29a74" stroke-width=".65"/>
      <path d="m83 144 5 8 3-9" fill="#917343" stroke="none"/>
    </g>
    <g class="cronista-body">
      <path d="M55 64q-9 25-3 46q7 19 28 22q22-3 29-22q6-23-4-46Z" fill="#736451" stroke="#4e4539" stroke-width="1.3"/>
      <path d="M67 71q-15 30-3 48q6 9 16 11q13-4 18-13q10-20-5-46Z" fill="#c8b795"/>
      <path d="M72 77q8 6 16 0m-18 8q10 7 20 0m-22 8q12 8 24 0m-24 8q12 8 24 0m-21 8q10 7 20 0m-15 8q6 4 12 0" fill="none" stroke="#9b8662" stroke-width=".9"/>
      <path d="m74 79 1 4m10-4-1 4m-7 5 1 4m8-4-1 4m-13 5 1 4m9-4-1 4m-4 5 1 4m9-4-1 4" stroke="#a38d68" stroke-width=".65"/>
      <g class="cronista-wing-left">
        <path d="M56 68q-20 22-8 54q15-9 17-37Z" fill="#615443" stroke="#4e4539" stroke-width="1.2"/>
        <path d="M55 77q-10 21-4 37m7-29q-6 17-4 25m5-12-1 10" fill="none" stroke="#aa9776" stroke-width="1"/>
        <path d="m49 93 7 3m-7 5 5 2m-3 5 3 1" fill="none" stroke="#aa9776" stroke-width=".65"/>
      </g>
      <g class="cronista-wing-right">
        <path d="M104 69q18 21 9 49q-14-7-17-34Z" fill="#615443" stroke="#4e4539" stroke-width="1.2"/>
        <path d="M105 78q9 19 6 33m-10-26q7 16 6 22m-6-11 3 8" fill="none" stroke="#aa9776" stroke-width="1"/>
      </g>
      <path d="m70 127-5 6m7-5v6m17-6v6m2-7 6 6" stroke="#957343" stroke-width="1.8" stroke-linecap="round"/>
      <g class="cronista-head">
        <path d="M51 42 48 16q12 8 20 15q12-4 24 0q9-9 20-15l-3 27q7 28-11 37q-18 10-36 0q-17-8-11-38Z" fill="#7f7059" stroke="#4e4539" stroke-width="1.3"/>
        <path d="m51 23 8 19m49-19-8 19" stroke="#b5a17c" stroke-width="1.2"/>
        <path d="M80 43q-16-16-25 0q-11 22 8 32l17 8 17-8q18-10 8-32q-9-16-25 0Z" fill="#deceb0"/>
        <path d="M76 44q-13-12-19 4q-6 15 9 24m18-28q13-12 19 4q6 15-9 24" fill="none" stroke="#b8a080" stroke-width=".8"/>
        <path d="m59 36 12 4m18 0 12-4m-45 8 3 1m-5 4 4 1m-4 4 4 1m-3 4 4 1m-1 4 3 1m42-22-3 1m5 4-4 1m4 4-4 1m3 4-4 1m1 4-3 1" fill="none" stroke="#9e8968" stroke-width=".75"/>
        <g class="cronista-eyes">
          <ellipse cx="65" cy="55" rx="9" ry="10" fill="#bba16b"/><ellipse cx="95" cy="55" rx="9" ry="10" fill="#bba16b"/>
          <ellipse cx="65" cy="55" rx="4.5" ry="7" fill="#302b26"/><ellipse cx="95" cy="55" rx="4.5" ry="7" fill="#302b26"/>
          <g fill="#f5e9ce"><circle cx="66.5" cy="52" r="1.5"/><circle cx="96.5" cy="52" r="1.5"/></g>
        </g>
        <g fill="none" stroke="#ac8750" stroke-width="1.25"><circle cx="65" cy="56" r="14"/><circle cx="95" cy="56" r="14"/><path d="M79 54q1-2 2 0m-30 0-5-3m63 3 5-3"/></g>
        <path d="M76 69q4-4 8 0l-4 11Z" fill="#9e7b43" stroke="#6b5637" stroke-width=".9"/>
        <path d="m66 75 5 3m18 0 5-3m-21 4 3 2m8 0 3-2" fill="none" stroke="#ac9571" stroke-width=".7"/>
      </g>
      <g class="cronista-quill" stroke="#806b4b" stroke-width=".9" stroke-linejoin="round">
        <path d="M113 124q-1-29 25-70q8 29-17 53Z" fill="#e7dcc2"/>
        <path d="M110 137q8-41 27-78m-17 45 11-6m-7-3 11-7m-7-3 9-6m-18 31 9-5m-6-17-2-11" fill="none"/>
        <path d="m109 137 3-6" stroke="#493f31" stroke-width="1.2"/>
      </g>
    </g>
    <g class="cronista-sparkles" fill="#b18d51"><path d="m34 37 2-6 2 6 6 2-6 2-2 6-2-6-6-2Zm90-11 1.5-5 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5Z"/></g>
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
