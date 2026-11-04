// La lámina de cada forma de jugar (Jugar solo, Jugar con amigos, Jugar online): al entrar desde
// Inicio sale sobre su pantalla, como la portada del mazo, y enseña con escenas animadas cómo se
// juega allí. Arriba, cómo se juega; debajo, Grandes colecciones y Retos rápidos cara a cara con
// su lógica en esa forma de jugar (jugando solo: vidas o regla sorpresa; en grupo: cada uno su
// mano o un mismo mazo para todos); al final, el árbol de modalidades con lo que se elige en
// cada una. Las escenas son SVG con animaciones de css/guia-modos.css; con movimiento reducido se
// quedan quietas. Cada escena lleva la regla entera en su `aria-label`, para quien no la ve.
// Lo que cuentan sale de la Guía (CT.guideMarkup en js/juego/modes.js): si cambia una regla allí,
// cambia también aquí. Un toque la retira; «No volver a mostrar» la apaga para esa forma de jugar.
// La abre js/interfaz/home-modes-v1.js con `CT.GuiaModos.show(kind)`.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const esc = value => CT.escapeHtml(value);

  // ── Piezas de dibujo ──────────────────────────────────────────────────────────────
  const card = (x, y, w = 14, h = 19, cls = '') => `<rect class="g-card${cls ? ' ' + cls : ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/>`;
  const badge = (cls, x, y, ok) => `<g class="g-badge ${ok ? 'g-badge-ok' : 'g-badge-ko'} ${cls}"><circle cx="${x}" cy="${y}" r="6"/><path d="${ok ? `M${x - 3} ${y}l2 2.2 4-4.4` : `M${x - 2.4} ${y - 2.4}l4.8 4.8m0-4.8l-4.8 4.8`}"/></g>`;
  const avatar = (cls, x, y, letter) => `<g class="g-avatar ${cls}"><circle class="g-avatar-ring" cx="${x}" cy="${y}" r="10.5"/><circle cx="${x}" cy="${y}" r="8"/><text x="${x}" y="${y + 3}">${letter}</text></g>`;
  const heart = (cls, x, y) => `<path class="g-heart ${cls}" d="M${x} ${y + 9}l-5-5a3 3 0 0 1 5-3.6a3 3 0 0 1 5 3.6z"/>`;
  const svg = (viewBox, label, body, key) => `<svg class="g-scene g-scene-${key}" viewBox="${viewBox}" role="img" aria-label="${esc(label)}" focusable="false">${body}</svg>`;

  // ── Escenas ───────────────────────────────────────────────────────────────────────
  const SCENES = {
    // Una carta nueva baja al hueco que le toca y queda bien colocada.
    line: label => svg('0 0 200 92', label, `
      <path class="g-rule" d="M6 70h188"/>
      ${card(14, 46, 34, 44)}<text class="g-year" x="31" y="73">1492</text>
      ${card(58, 46, 34, 44)}<text class="g-year" x="75" y="73">1789</text>
      <rect class="g-gap g-line-gap" x="104" y="46" width="34" height="44" rx="4"/>
      ${card(150, 46, 34, 44)}<text class="g-year" x="167" y="73">1969</text>
      <g class="g-line-drop">${card(104, 0, 34, 44, 'g-new')}<text class="g-mark" x="121" y="27">?</text></g>
      ${badge('g-line-ok', 140, 44, true)}`, 'line'),
    // Jugando solo en las colecciones: un acierto se queda; un fallo quita una de las tres vidas.
    lives: label => svg('0 0 160 100', label, `
      ${heart('', 125, 6)}${heart('', 137, 6)}${heart('g-lives-heart', 149, 6)}
      <path class="g-rule" d="M8 74h144"/>
      ${card(20, 52, 16, 22)}${card(70, 52, 16, 22)}${card(128, 52, 16, 22)}
      <g class="g-lives-a">${card(45, 8, 16, 22, 'g-new g-lives-a-card')}</g>${badge('g-lives-a-ok', 53, 44, true)}
      <g class="g-lives-b">${card(99, 8, 16, 22, 'g-new g-lives-b-card')}</g>${badge('g-lives-b-ko', 107, 44, false)}`, 'lives'),
    // Retos rápidos: un mazo sorpresa se da la vuelta, enseña su regla y las cartas se ordenan con ella.
    surprise: label => svg('0 0 160 100', label, `
      <g class="g-flip-back">${card(56, 6, 48, 30, 'g-new')}<text class="g-mark" x="80" y="26">?</text></g>
      <g class="g-flip-rule"><rect class="g-rule-banner" x="18" y="8" width="124" height="26" rx="5"/><text class="g-rule-text" x="80" y="25">De oeste a este →</text></g>
      <path class="g-rule" d="M8 84h144"/>
      <g class="g-sort g-sort-1">${card(12, 52, 40, 30)}<text class="g-city" x="32" y="71">Lisboa</text></g>
      <g class="g-sort g-sort-2">${card(60, 52, 40, 30)}<text class="g-city" x="80" y="71">Roma</text></g>
      <g class="g-sort g-sort-3">${card(108, 52, 40, 30)}<text class="g-city" x="128" y="71">Pekín</text></g>`, 'surprise'),
    // En grupo, Grandes colecciones: cada uno juega de su mano; quien falla descarta y roba del mazo.
    hands: label => svg('0 0 160 100', label, `
      <path class="g-rule" d="M8 38h144"/>
      ${card(40, 17)}${card(104, 17)}
      <rect class="g-gap g-hands-gap" x="72" y="17" width="14" height="19" rx="2.5"/>
      ${card(71, 60, 14, 19, 'g-back')}${card(73, 62, 14, 19, 'g-back')}
      <g class="g-hand g-hand-a">${card(26, 62)}${card(34, 59)}</g>
      <g class="g-hands-a">${card(42, 62, 14, 19, 'g-new g-hands-a-card')}</g>${badge('g-hands-a-ok', 79, 12, true)}
      <g class="g-hand g-hand-b">${card(112, 59)}${card(120, 62)}</g>
      <g class="g-hands-b">${card(104, 62, 14, 19, 'g-new g-hands-b-card')}</g>${badge('g-hands-b-ko', 135, 12, false)}
      <g class="g-hands-draw">${card(73, 62, 14, 19, 'g-back')}</g>
      ${avatar('g-hands-pa', 18, 88, 'A')}${avatar('g-hands-pb', 142, 88, 'B')}`, 'hands'),
    // En grupo, Retos rápidos: todos sacan, por turnos, del mismo mazo; un acierto es un punto
    // provisional, quien falla queda fuera y quien se planta asegura sus puntos.
    shared: label => svg('0 0 160 100', label, `
      <path class="g-rule" d="M8 30h144"/>
      ${card(30, 9)}${card(86, 9)}
      ${card(71, 44, 14, 19, 'g-back')}${card(73, 46, 14, 19, 'g-back')}
      <g class="g-shared-k3">${card(73, 46, 14, 19, 'g-new g-shared-k3-card')}</g>
      <g class="g-shared-k2">${card(73, 46, 14, 19, 'g-new g-shared-k2-card')}</g>
      <g class="g-shared-k1">${card(73, 46, 14, 19, 'g-new g-shared-k1-card')}</g>
      ${badge('g-shared-k3-ko', 150, 6, false)}
      <circle class="g-pip g-shared-pa" cx="30" cy="70" r="3.5"/><circle class="g-pip g-shared-pb" cx="80" cy="70" r="3.5"/>
      <g class="g-shared-bank"><rect class="g-bubble" x="4" y="50" width="52" height="12" rx="6"/><text class="g-bubble-text" x="30" y="59">Me planto</text></g>
      ${avatar('g-shared-a', 30, 88, 'A')}${avatar('g-shared-b', 80, 88, 'B')}${avatar('g-shared-c', 130, 88, 'C')}`, 'shared'),
    // Jugar online: una mesa de cuatro plazas se llena y la partida empieza.
    table: label => svg('0 0 200 92', label, `
      <ellipse class="g-table" cx="100" cy="46" rx="40" ry="22"/>
      <text class="g-table-wait" x="100" y="50">Esperando…</text><text class="g-table-go" x="100" y="50">¡Empieza!</text>
      ${[[100, 12, 'A'], [156, 46, 'B'], [100, 80, 'C'], [44, 46, 'D']].map(([x, y, l], i) => `<g class="g-seat g-seat-${i + 1}"><circle class="g-seat-empty" cx="${x}" cy="${y}" r="7"/>${avatar('g-seat-person', x, y, l)}</g>`).join('')}`, 'table')
  };

  // ── Contenido de cada forma de jugar ──────────────────────────────────────────────
  //   how       [escena, rótulo corto, regla entera para el lector de pantalla]
  //   games     [Grandes colecciones, Retos rápidos], cada uno igual que `how`
  //   branches  [ilustración, nombre, nota, hojas [[nombre, nota]], «Tú eliges» [opciones]]
  const GUIDES = {
    solo: {
      screen: 'hub-solo', name: 'Jugar solo', title: 'A tu ritmo', art: 'mode-walk-solo.webp',
      how: ['line', 'Cada carta, a su hueco', 'Pon cada carta en su hueco de la línea: de antes a después o de menor a mayor. Si fallas, la línea te enseña dónde iba.'],
      games: [
        ['lives', '3 vidas por partida', 'Grandes colecciones: mazos por temas. Cada acierto se queda en la línea; cada fallo te quita una de tus tres vidas.'],
        ['surprise', 'Mazo sorpresa, regla nueva', 'Retos rápidos: mazos cortos y sorpresa, cada uno con su propia regla de orden, como de oeste a este. Fallar no te saca.']
      ],
      branches: [
        ['menu-collections.webp', 'Grandes colecciones', 'Tú eliges el tema', [['Ronda', '10 cartas'], ['Maratón', 'el mazo entero'], ['Competición', 'varios temas seguidos']], ['Mazo', 'Dificultad']],
        ['menu-quick.webp', 'Retos rápidos', '4 mazos nuevos cada día', [], []]
      ]
    },
    friends: {
      screen: 'hub-friends', name: 'Jugar con amigos', title: 'Juntos, como prefiráis', art: 'mode-walk-multi.webp',
      how: ['line', 'Por turnos, en la misma línea', 'Por turnos, cada uno pone una carta en su hueco de la línea, que es la misma para todos.'],
      games: [
        ['hands', 'Cada uno, su mano', 'Grandes colecciones: cada uno tiene su mano. Si fallas, la carta se descarta y robas otra del mazo. Gana quien se queda sin cartas.'],
        ['shared', 'Un mazo para todos', 'Retos rápidos: todos sacan del mismo mazo, por turnos. Cada acierto es un punto provisional; si fallas, quedas fuera de ese mazo; plantarte asegura tus puntos. También se puede jugar a seguir hasta el final.']
      ],
      branches: [
        ['menu-local.webp', 'Un solo móvil', 'De 2 a 10 · pasáis el móvil', [], ['Cartas', 'Poderes', 'Tiempo']],
        ['menu-private.webp', 'Cada uno en su móvil', 'Internet o la misma Wi-Fi', [['En directo', 'todos a la vez'], ['Por turnos', 'cuando cada uno pueda'], ['Unirme', 'QR, enlace o código']], []]
      ]
    },
    online: {
      screen: 'hub-online', name: 'Jugar online', title: 'Una mesa con más gente', art: 'menu-online.webp',
      how: ['table', '2 a 4 · empieza al llenarse', 'Mesas públicas de 2 a 4 personas. La partida empieza al llenarse la mesa o, con al menos dos, tras 30 segundos sin que entre nadie más.'],
      games: [
        ['hands', 'Cada uno, su mano', 'Grandes colecciones: cada uno tiene su mano. Si fallas, robas otra. Gana quien se queda sin cartas.'],
        ['shared', 'Un mazo para todos', 'Retos rápidos: todos sacan del mismo mazo sorpresa, por turnos. Cada acierto es provisional: plántate para asegurarlo o arriesga.']
      ],
      branches: [
        ['menu-wifi.webp', 'Crear mesa', 'Aparece en la lista', [], ['Juego', 'Plazas', 'Tiempo']],
        ['menu-online.webp', 'Mesas abiertas', 'Siéntate en una', [], []],
        ['menu-quick.webp', 'Partida rápida', 'La primera mesa libre', [['Grandes colecciones', 'hasta 3 temas'], ['Retos rápidos', '3 mazos sorpresa']], []]
      ]
    }
  };

  // ── Lámina ────────────────────────────────────────────────────────────────────────
  const KEY = 'continuum-guia-modos-v1';
  function hidden() {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; }
  }
  function hide(kind) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...hidden(), [kind]: true })); } catch { /* sin guardado, vuelve a salir la próxima vez */ }
  }
  let layer = null;
  function close({ focus = true } = {}) {
    const current = layer;
    if (!current || current.dataset.closed) return;
    current.dataset.closed = '1';
    layer = null;
    current.classList.add('is-leaving');
    setTimeout(() => current.remove(), 260);
    if (focus) document.getElementById('app')?.querySelector('[data-focus]')?.focus?.({ preventScroll: true });
  }
  const scene = ([key, caption, rule], cls = '') => `<figure class="mode-guide-scene${cls}">${SCENES[key](rule)}<figcaption>${esc(caption)}</figcaption></figure>`;
  function markup(guide) {
    const leaves = list => list.length ? `<ul class="mode-guide-leaves">${list.map(([name, note]) => `<li><b>${esc(name)}</b> <span>${esc(note)}</span></li>`).join('')}</ul>` : '';
    const chips = list => list.length ? `<p class="mode-guide-choose"><em>Tú eliges</em>${list.map(item => `<span>${esc(item)}</span>`).join('')}</p>` : '';
    const [collections, quick] = guide.games;
    return `<div class="mode-guide-inner">
      <header class="mode-guide-head"><img class="mode-guide-hero" src="assets/${guide.art}" alt="" aria-hidden="true" decoding="async"><span><span class="eyebrow">${esc(guide.name)}</span><h2 id="mode-guide-title">${esc(guide.title)}</h2></span></header>
      ${scene(guide.how, ' mode-guide-how')}
      <section class="mode-guide-games" aria-label="Los dos juegos">
        <div class="mode-guide-game"><b>Grandes colecciones</b>${scene(collections)}</div>
        <div class="mode-guide-game"><b>Retos rápidos</b>${scene(quick)}</div>
      </section>
      <h3 class="mode-guide-section">Qué puedes jugar</h3>
      <ol class="mode-guide-tree">${guide.branches.map(([art, name, note, list, choose]) => `<li class="mode-guide-branch">
        <span class="mode-guide-node"><img src="assets/${art}" alt="" aria-hidden="true" decoding="async"><span><b>${esc(name)}</b><small>${esc(note)}</small></span></span>${leaves(list)}${chips(choose)}</li>`).join('')}</ol>
      <footer class="mode-guide-foot">
        <button type="button" class="mode-guide-go" data-mode-guide-go>Toca para continuar</button>
        <button type="button" class="mode-guide-hide" data-mode-guide-hide>No volver a mostrar</button>
      </footer>
    </div>`;
  }
  function show(kind) {
    const guide = GUIDES[kind];
    if (!guide || hidden()[kind]) return null;
    layer?.remove(); layer = null;
    const box = document.createElement('div');
    box.className = 'quick-splash mode-guide';
    box.dataset.modeGuide = kind;
    box.dataset.screen = guide.screen;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'mode-guide-title');
    box.innerHTML = markup(guide);
    box.addEventListener('click', event => {
      if (event.target.closest('[data-mode-guide-hide]')) hide(kind);
      close();
    });
    box.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      // El foco no sale de la lámina mientras está abierta: solo tiene sus dos botones.
      if (event.key === 'Tab') {
        const buttons = [...box.querySelectorAll('button')];
        const at = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(at + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    });
    layer = box;
    // Fuera de #app, como la portada del mazo: así no la borra el repintado de la pantalla.
    document.body.append(box);
    try { box.querySelector('[data-mode-guide-go]').focus({ preventScroll: true }); } catch { /* sin foco también se toca */ }
    CT.Effects?.transition?.('open');
    return box;
  }
  // La lámina se va con su pantalla (por ejemplo, con el «atrás» del sistema).
  function follow(screen) { if (layer && screen !== layer.dataset.screen) close({ focus: false }); }

  CT.GuiaModos = { show, close, follow, guides: GUIDES, scenes: SCENES };
})();
