// La lámina de cada forma de jugar (Jugar solo, Jugar con amigos, Jugar online): al entrar desde
// Inicio sale sobre su pantalla, como la portada del mazo, y enseña de un vistazo cómo se juega allí.
//   · Arriba, una tira: una carta con su título y el dato oculto baja a su hueco de la línea y se
//     revela («Avión · 1903»).
//   · Debajo, una tabla que se lee en horizontal: Grandes colecciones | Retos rápidos, fila a fila
//     (Tienes / Si fallas / Gana o Al final / Eliges). Cada celda es un pictograma con un rótulo
//     de cuatro palabras como mucho.
//   · En grupo, un bloque final: dónde se juega (amigos) o cómo empieza una mesa (online).
// El estado quieto ES la lámina terminada: las animaciones (css/guia-modos.css) pasan una sola vez,
// fila a fila, y con movimiento reducido no se mueve nada. Cada pictograma lleva su regla entera
// en el aria-label, para quien no lo ve.
// Lo que cuentan sale de la Guía (CT.guideMarkup en js/juego/modes.js) y del motor de Retos rápidos
// (js/retos/quick-challenges-engine.js): si cambia una regla allí, cambia también aquí.
// Un toque la retira; «No volver a mostrar» la apaga para esa forma de jugar. La abre
// js/interfaz/home-modes-v1.js con `CT.GuiaModos.show(kind)`.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const esc = value => CT.escapeHtml(value);
  const n1 = value => Math.round(value * 10) / 10;

  // ── Piezas de dibujo: cada una se pinta igual en todas las escenas ──────────────────
  // Una carta de papel: ilustración arriba y dato abajo. `kind`: line (ya en la línea), new (por
  // colocar: borde de acento y «?»), ok (acertada), ko (fallada), back (dorso del mazo), ghost.
  function card(x, y, w, h, kind = 'line') {
    const pad = w >= 20 ? 3 : 2;
    const body = `<rect class="g-body g-body-${kind}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/>`;
    if (kind === 'ghost') return body;
    if (kind === 'back') return `<g>${body}<rect class="g-back-frame" x="${n1(x + 1.6)}" y="${n1(y + 1.6)}" width="${n1(w - 3.2)}" height="${n1(h - 3.2)}" rx="1.5"/></g>`;
    const art = `<rect class="g-art" x="${x + pad}" y="${y + pad}" width="${w - 2 * pad}" height="${n1(h * 0.36)}" rx="1"/>`;
    const bandH = n1(Math.max(3, h * 0.16)), bandY = n1(y + h - bandH - pad);
    const data = kind === 'new'
      ? `<text class="g-q" x="${n1(x + w / 2)}" y="${n1(y + h - pad - 0.5)}" font-size="${n1(h * 0.42)}">?</text>`
      : `<rect class="g-band g-band-${kind}" x="${x + pad}" y="${bandY}" width="${w - 2 * pad}" height="${bandH}" rx="1"/>`;
    return `<g>${body}${art}${data}</g>`;
  }
  const badge = (x, y, ok, r = 5.5) => `<g class="g-badge g-badge-${ok ? 'ok' : 'ko'}"><circle cx="${x}" cy="${y}" r="${r}"/><path d="${ok
    ? `M${n1(x - r * 0.48)} ${n1(y + r * 0.02)}l${n1(r * 0.34)} ${n1(r * 0.36)} ${n1(r * 0.66)} ${n1(-r * 0.74)}`
    : `M${n1(x - r * 0.38)} ${n1(y - r * 0.38)}l${n1(r * 0.76)} ${n1(r * 0.76)}m0 ${n1(-r * 0.76)}l${n1(-r * 0.76)} ${n1(r * 0.76)}`}"/></g>`;
  // Corazón centrado en (x, y) de ancho s: full (vida), lost (vida perdida), none (sin vidas, tachado).
  function heart(x, y, s, state = 'full', cls = '') {
    const d = `M${x} ${n1(y + s * 0.42)}C${n1(x - s * 0.62)} ${n1(y + s * 0.02)} ${n1(x - s * 0.46)} ${n1(y - s * 0.52)} ${x} ${n1(y - s * 0.17)}C${n1(x + s * 0.46)} ${n1(y - s * 0.52)} ${n1(x + s * 0.62)} ${n1(y + s * 0.02)} ${x} ${n1(y + s * 0.42)}Z`;
    const cross = state === 'none' ? `<path class="g-heart-cross" d="M${n1(x - s * 0.55)} ${n1(y + s * 0.45)}L${n1(x + s * 0.55)} ${n1(y - s * 0.5)}"/>` : '';
    return `<path class="g-heart g-heart-${state}${cls ? ' ' + cls : ''}" d="${d}"/>${cross}`;
  }
  function star(x, y, s, won = true) {
    const points = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? s * 0.21 : s * 0.5, a = -Math.PI / 2 + i * Math.PI / 5;
      return `${n1(x + r * Math.cos(a))} ${n1(y + r * Math.sin(a))}`;
    });
    return `<path class="g-star${won ? '' : ' g-star-empty'}" d="M${points.join('L')}Z"/>`;
  }
  const crown = (x, y) => `<path class="g-crown" d="M${x - 6} ${y + 3}V${y - 3}L${x - 3} ${y}L${x} ${y - 4}L${x + 3} ${y}L${x + 6} ${y - 3}V${y + 3}Z"/>`;
  // Un jugador: círculo de papel con su letra; `turn` le pone el anillo de turno.
  const player = (x, y, letter, turn = '') => `<g class="g-player">${turn ? `<circle class="g-turn ${turn === true ? '' : turn}" cx="${x}" cy="${y}" r="11"/>` : ''}<circle class="g-head" cx="${x}" cy="${y}" r="8"/><text x="${x}" y="${n1(y + 3.3)}" font-size="9.5">${letter}</text></g>`;
  // Las cartas que le quedan en la mano.
  const disc = (x, y, count, cls = '') => `<g class="g-disc${count === 0 ? ' g-disc-zero' : ''}${cls ? ' ' + cls : ''}"><circle cx="${x}" cy="${y}" r="6.5"/><text x="${x}" y="${n1(y + 3.1)}" font-size="9">${count}</text></g>`;
  // Una mano: cartas por colocar en abanico, giradas alrededor de su pie (px, py). Con `open`, el
  // abanico se abre al llegar su fila.
  function fan(px, py, count, { w = 13, h = 18, open = false } = {}) {
    const angles = count === 3 ? [-14, 0, 14] : count === 2 ? [-8, 8] : [0];
    return angles.map(a => {
      const inner = card(n1(px - w / 2), n1(py - h - 2), w, h, 'new');
      return `<g transform="rotate(${a} ${px} ${py})">${open && a ? `<g class="a-fan" style="--rot:${-a}deg;transform-origin:${px}px ${py}px">${inner}</g>` : inner}</g>`;
    }).join('');
  }
  const deck = (x, y) => [0, 1, 2].map(i => card(n1(x + (2 - i) * 1.6), n1(y + (2 - i) * 1.6), 13, 18, 'back')).join('');
  // Un punto de Retos rápidos: en juego («+2», provisional), asegurado (con candado) o perdido.
  function chip(x, y, state, value) {
    const lock = `<g class="g-lock"><path d="M${x + 19} ${y + 6.4}v-1.6a2.2 2.2 0 0 1 4.4 0v1.6"/><rect x="${n1(x + 18.2)}" y="${n1(y + 6.2)}" width="6" height="4.6" rx="1"/></g>`;
    const cross = `<path class="g-chip-cross" d="M${x + 18} ${y + 4.6}l4.4 4.4m0-4.4l-4.4 4.4"/>`;
    const textX = state === 'open' ? x + 14 : x + 10;
    return `<g class="g-chip g-chip-${state}"><rect x="${x}" y="${y}" width="28" height="14" rx="7"/><text x="${textX}" y="${n1(y + 10.2)}" font-size="9.5">${esc(value)}</text>${state === 'banked' ? lock : state === 'out' ? cross : ''}</g>`;
  }
  const head = (x, y, angle, cls = 'g-arrow') => `<path class="${cls}" d="M-3.2 -2.6L0 0L-3.2 2.6" transform="translate(${x} ${y}) rotate(${angle})"/>`;
  const arrow = (x1, x2, y) => `<path class="g-arrow" d="M${x1} ${y}H${x2}"/>${head(x2, y, 0)}`;
  // Una celda de la tabla, de 140 × 44 unidades.
  const cell = (rule, body) => `<svg class="g-scene" viewBox="0 0 140 44" role="img" aria-label="${esc(rule)}" focusable="false">${body}</svg>`;
  const pop = (body, d = 0, cls = 'a-pop') => `<g class="${cls}"${d ? ` style="--d:${d}s"` : ''}>${body}</g>`;

  // ── La tira «cómo se juega» (260 × 76) ───────────────────────────────────────────
  // Gutenberg (1450), la locomotora (1804) y el primer móvil (1973) ya están en la línea; el primer
  // vuelo de los Wright (1903) baja, duda sobre un hueco, va al bueno y se revela (mazos/inventos.js).
  function howStrip(group, rule) {
    const lineCard = (x, year) => `<rect class="g-body" x="${x}" y="26" width="28" height="36" rx="2.5"/><rect class="g-art" x="${x + 3}" y="29" width="22" height="12" rx="1"/><text class="g-year" x="${x + 14}" y="56" font-size="10">${year}</text>`;
    const gap = x => `<rect class="g-gap${x === 72 ? ' g-how-s1' : ''}" x="${x}" y="26" width="28" height="36" rx="2.5"/><text class="g-plus" x="${x + 14}" y="48" font-size="12">+</text>`;
    const plane = 'M149 35h18M158 30.5v9M150.5 33.2v3.6';
    const newCard = `<g class="g-how-card">
        <text class="g-tag" x="153" y="21" font-size="9">Avión</text>
        <rect class="g-body g-body-line" x="144" y="26" width="28" height="36" rx="2.5"/>
        <rect class="g-art" x="147" y="29" width="22" height="12" rx="1"/><path class="g-plane" d="${plane}"/>
        <g class="g-how-unknown"><rect class="g-body-new-edge" x="144" y="26" width="28" height="36" rx="2.5"/><text class="g-q" x="158" y="57" font-size="13">?</text></g>
        <g class="g-how-known"><rect class="g-body-ok-edge" x="144" y="26" width="28" height="36" rx="2.5"/><rect class="g-band-ok" x="144" y="48" width="28" height="10"/><text class="g-year g-year-ok" x="158" y="56.4" font-size="10">1903</text></g>
      </g>`;
    const players = group ? `${player(14, 44, 'A', 'g-turn-a')}${player(246, 44, 'B', 'g-turn-b')}` : '';
    // Con movimiento reducido no hay viaje: un fantasma sobre el primer hueco y una flecha al bueno lo cuentan.
    const trace = `<g class="g-trace"><rect class="g-body-ghost" x="74" y="3" width="24" height="17" rx="2.5" transform="rotate(-6 86 11)"/><path class="g-fix" d="M100 9Q124 0 146 18"/>${head(146, 18, 39, 'g-fix')}</g>`;
    return `<svg class="g-scene g-how" viewBox="0 0 260 76" role="img" aria-label="${esc(rule)}" focusable="false">
      <path class="g-rule" d="M30 66H226"/>${head(229, 66, 0, 'g-rule-head')}
      <text class="g-axis t-start" x="30" y="75" font-size="8.5">Más antiguo</text><text class="g-axis t-end" x="229" y="75" font-size="8.5">Más reciente</text>
      ${lineCard(36, 1450)}${gap(72)}${lineCard(108, 1804)}${gap(144)}${lineCard(180, 1973)}
      ${trace}${newCard}${pop(badge(172, 26, true, 6.5), 1.9)}${players}
    </svg>`;
  }

  // ── Pictogramas de la tabla (cada uno, una regla) ───────────────────────────────
  // La mini línea del fallo jugando solo: la carta se intentó a la derecha (raya roja) y pasa a su sitio.
  const missLine = () => `<path class="g-rule" d="M4 39H66"/>${card(4, 18, 14, 20)}${card(40, 18, 14, 20)}
    <path class="g-attempt" d="M61 19V39"/><path class="g-fix" d="M61 15Q46 3 30 13"/>${head(30, 13, 148, 'g-fix')}
    <g class="a-miss" style="--fx:32px">${card(22, 18, 14, 20, 'ko')}${badge(35, 18, false, 5)}</g>${arrow(72, 84, 28)}`;
  const PICTS = {
    // Jugar solo
    soloLives: () => `${card(14, 11, 16, 22, 'new')}${[58, 78, 98].map((x, i) => pop(heart(x, 22, 13), i * 0.12)).join('')}`,
    soloTen: () => `${fan(40, 42, 3, { open: true })}${pop('<text class="g-big t-start" x="62" y="31" font-size="14">10</text>', 0.3)}${heart(110, 22, 12, 'none')}`,
    soloMissLife: () => `${missLine()}${heart(96, 28, 11)}${heart(111, 28, 11)}${heart(126, 28, 11, 'lost', 'a-lose')}`,
    soloMissGo: () => `${missLine()}<g class="a-in" style="--fx:-8px;--d:.8s">${card(98, 11, 16, 22, 'new')}</g>`,
    soloStars: () => `${heart(14, 22, 10)}${heart(28, 22, 10)}${heart(42, 22, 10, 'lost')}${arrow(54, 68, 22)}${[84, 102, 120].map((x, i) => pop(star(x, 22, 15, i < 2), i * 0.12)).join('')}`,
    soloAlbum: () => `${card(6, 12, 14, 20, 'ok')}${badge(19, 12, true, 4.5)}${card(24, 12, 14, 20, 'ok')}${badge(37, 12, true, 4.5)}${arrow(46, 60, 22)}
      <rect class="g-album" x="72" y="8" width="50" height="28" rx="3"/><path class="g-album-spine" d="M97 8V36"/>
      ${pop('<rect class="g-slot g-slot-on" x="76" y="17" width="8" height="10" rx="1"/>')}${pop('<rect class="g-slot g-slot-on" x="86" y="17" width="8" height="10" rx="1"/>', 0.15)}
      <rect class="g-slot" x="101" y="17" width="8" height="10" rx="1"/><rect class="g-slot" x="111" y="17" width="8" height="10" rx="1"/>`,
    // En grupo (con amigos y online)
    groupHands: () => `${player(12, 30, 'A')}${fan(36, 42, 3, { open: true })}${pop(disc(54, 14, 3))}${player(82, 30, 'B')}${fan(106, 42, 3, { open: true })}${pop(disc(124, 14, 3))}`,
    groupCommon: () => `<path class="g-link" d="M21 27L49 23"/><path class="g-link" d="M119 27L91 23"/>${[47, 63, 79].map((x, i) => pop(card(x, 3, 14, 19, 'new'), i * 0.08)).join('')}${player(14, 32, 'A')}${player(126, 32, 'B')}`,
    groupDiscard: () => `<g transform="rotate(-10 17 20)">${card(10, 10, 14, 19)}</g><g transform="rotate(6 17 20)">${card(10, 10, 14, 19)}</g>
      <g class="a-drop" style="--fy:-10px">${card(10, 10, 14, 19, 'ko')}${badge(24, 10, false, 5)}</g>
      ${deck(48, 12)}<path class="g-arrow" d="M68 14Q85 3 99 17"/>${head(99, 17, 45)}
      ${fan(104, 42, 3)}<g class="a-travel" style="--fx:-47px;--fy:-6px;--d:.4s">${card(97, 20, 13, 18, 'back')}</g>
      ${player(130, 34, 'B')}${disc(128, 12, 3, 'a-pulse')}`,
    groupBank: () => `${chip(4, 15, 'open', '+2')}<path class="g-arrow" d="M34 19L49 11"/>${head(49, 11, -28)}<path class="g-arrow" d="M34 25L49 33"/>${head(49, 33, 28)}
      ${pop(chip(52, 3, 'banked', '2'), 0.3)}<text class="g-note t-start" x="85" y="13.5" font-size="9">te plantas</text>
      ${pop(chip(52, 27, 'out', '0'), 0.45)}<text class="g-note t-start" x="85" y="37.5" font-size="9">fallas</text>`,
    groupEmpty: () => `${player(16, 30, 'A')}${pop(crown(16, 15), 0.3)}${card(30, 20, 13, 18, 'ghost')}${pop(disc(53, 29, 0))}${player(86, 30, 'B')}${fan(110, 42, 2)}${disc(130, 14, 2)}`,
    groupMost: () => `${player(16, 30, 'A')}${pop(crown(16, 15), 0.3)}${chip(30, 23, 'banked', '3')}${player(86, 30, 'B')}${chip(100, 23, 'banked', '2')}`
  };

  // ── Bloques finales de las láminas en grupo ──────────────────────────────────────
  const WHERE = `<div class="mode-guide-where">
      <p><svg class="g-scene g-pict" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect class="g-phone" x="14" y="8" width="12" height="20" rx="3"/><circle class="g-head" cx="5" cy="30" r="4"/><circle class="g-head" cx="35" cy="30" r="4"/><path class="g-arrow" d="M9 36Q20 42 31 36"/>${head(31, 36, -24)}${head(9, 36, 204)}</svg><span><b>Un solo móvil</b><small>os lo pasáis</small></span></p>
      <p><svg class="g-scene g-pict" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path class="g-link" d="M7.5 9H32.5"/><circle class="g-dot" cx="20" cy="9" r="2"/>${[3, 15.5, 28].map(x => `<rect class="g-phone" x="${x}" y="14" width="9" height="16" rx="2.5"/>`).join('')}</svg><span><b>Cada uno en su móvil</b><small>en directo o por turnos</small></span></p>
    </div>`;
  const START = `<svg class="g-scene g-start" viewBox="0 0 300 52" role="img" aria-label="${esc('Cómo empieza: creas una mesa, te sientas en una de las mesas abiertas o pides una partida rápida y te sentamos en la primera libre. Jugáis de 2 a 4 personas. La partida empieza al llenarse la mesa o, con al menos dos, cuando pasan 30 segundos sin que entre nadie más.')}" focusable="false">
      <ellipse class="g-table" cx="44" cy="26" rx="24" ry="12"/>
      <circle class="g-seat" cx="44" cy="44" r="6.5"/><circle class="g-seat" cx="12" cy="26" r="6.5"/>
      ${[[44, 8, 'A'], [76, 26, 'B']].map(([x, y, l]) => `<g class="g-player"><circle class="g-head" cx="${x}" cy="${y}" r="6.5"/><text x="${x}" y="${y + 3}" font-size="8">${l}</text></g>`).join('')}
      ${arrow(90, 106, 26)}
      <circle class="g-clock" cx="128" cy="26" r="14"/><circle class="g-clock-arc" cx="128" cy="26" r="14" transform="rotate(-90 128 26)"/><text class="g-big" x="128" y="29.5" font-size="9.5">30 s</text>
      ${arrow(150, 166, 26)}${pop('<text class="g-go" x="214" y="31" font-size="13">¡Empieza!</text>', 1)}
    </svg>`;

  // ── Contenido de cada forma de jugar ──────────────────────────────────────────
  //   how     [grupo, rótulo, regla entera]
  //   rows    [etiqueta, momento en s, [pictograma, rótulo, regla] de Grandes colecciones, ídem de Retos rápidos]
  //   choose  [[principal, nota] de Grandes colecciones, ídem de Retos rápidos]
  //   end     null | {label, caption, html}
  const HOW = 'Cómo se juega: te sale una carta con su título y su dibujo, pero con el dato oculto. Colócala en el hueco de la línea donde creas que va, de más antiguo a más reciente, o de menor a mayor según el mazo. Al confirmar se revela el dato y, si encaja, la carta se queda en la línea. Por ejemplo, el primer vuelo de los hermanos Wright, de 1903, va entre la primera locomotora, de 1804, y la primera llamada desde un móvil, de 1973.';
  const HOW_GROUP = `${HOW} En grupo jugáis uno tras otro sobre la misma línea: cuando A coloca su carta, le toca a B.`;
  const groupRows = where => [
    ['Tienes', 3.6,
      ['groupHands', 'Cada uno, su mano', `Grandes colecciones ${where}: cada persona tiene su propia mano${where === 'en grupo' ? ', de 1 a 6 cartas,' : ''} y solo ella la ve. En tu turno colocas una de tus cartas en la línea común; si aciertas, tienes una menos.`],
      ['groupCommon', 'Cartas comunes', `Retos rápidos ${where}: nadie tiene mano. Las cartas del reto están a la vista y son las mismas para todos; en tu turno eliges una y la colocas en la línea.`]],
    ['Si fallas', 4.6,
      ['groupDiscard', 'Descartas y robas', `Grandes colecciones ${where}, si fallas: la carta no entra en la línea, va al descarte y robas otra del mazo, así que tu mano no baja. Si el mazo se acaba, se baraja el descarte.`],
      ['groupBank', 'Plántate o lo pierdes', where === 'en grupo'
        ? 'Retos rápidos en grupo, con «Arriesgar o plantarse»: cada acierto es provisional y en tu turno puedes plantarte para asegurarlo. Si fallas, pierdes los provisionales de ese mazo y quedas fuera hasta el siguiente; la carta fallada pasa a su sitio en la línea. Quien prepara la partida puede elegir «Seguir hasta el final»: un fallo no suma, pero sigues jugando.'
        : 'Retos rápidos en una mesa: la partida rápida se juega siempre a arriesgar o plantarse. Cada acierto es provisional y en tu turno puedes plantarte para asegurarlo; si fallas, pierdes los provisionales de ese mazo y quedas fuera hasta el siguiente. Quien crea una mesa puede elegir «Seguir hasta el final».']],
    ['Gana', 6,
      ['groupEmpty', 'Vacía tu mano', `Grandes colecciones ${where}: gana quien se queda sin cartas. La vuelta se termina siempre, para que todos jueguen los mismos turnos; si acaban varios sin cartas, se juega una final de desempate.`],
      ['groupMost', 'Más aciertos', `Retos rápidos ${where}: al acabar todos los mazos gana quien más aciertos ha asegurado. Al terminar un mazo, lo que sigue en juego se asegura solo. Un empate se comparte.`]]
  ];
  const GUIDES = {
    solo: {
      screen: 'hub-solo', name: 'Jugar solo', title: 'Tú contra la línea', art: 'mode-walk-solo.webp',
      how: [false, 'Adivina dónde va', HOW],
      rows: [
        ['Tienes', 3,
          ['soloLives', '3 vidas', 'Grandes colecciones jugando solo: empiezas con tres vidas y colocas una carta cada vez. Una ronda son 10 cartas y la maratón, el mazo entero; en la competición tienes tres vidas en cada tema.'],
          ['soloTen', '10 cartas, sin vidas', 'Retos rápidos jugando solo: juegas 10 cartas del mazo. Las ves todas y eliges cuál colocar. No hay vidas.']],
        ['Si fallas', 4,
          ['soloMissLife', 'Pierdes una vida', 'Grandes colecciones jugando solo, si fallas: la línea marca con «Aquí» dónde iba la carta, la carta pasa a ese sitio como referencia y pierdes una de tus tres vidas. Sin vidas se acaba la partida; en la competición, ese tema.'],
          ['soloMissGo', 'Sigues jugando', 'Retos rápidos jugando solo, si fallas: esa carta no suma y pasa a su lugar correcto en la línea, pero sigues hasta terminar las 10 cartas. Un fallo no te echa.']],
        ['Al final', 5.4,
          ['soloStars', 'Cada vida, una estrella', 'Grandes colecciones jugando solo: cuentan tus aciertos. Si terminas una ronda con alguna vida, la superas y cada vida que te queda es una estrella.'],
          ['soloAlbum', 'Aciertos a tu colección', 'Retos rápidos jugando solo: cada carta bien colocada suma un acierto y pasa a tu colección. En cada mazo salen primero las que aún te faltan.']]
      ],
      choose: [['Mazo y dificultad', 'ronda · maratón · competición'], ['4 mazos al día', 'eliges uno · iguales para todos']],
      end: null
    },
    friends: {
      screen: 'hub-friends', name: 'Jugar con amigos', title: 'Un móvil o varios', art: 'mode-walk-multi.webp',
      how: [true, 'Uno tras otro', HOW_GROUP],
      rows: groupRows('en grupo'),
      choose: [['2 a 10 jugadores', 'mano de 1 a 6 · poderes · tiempo'], ['2 a 4 jugadores', 'arriesgar o seguir · cuántos mazos']],
      end: { label: 'Dónde jugáis', html: WHERE, rule: 'Dónde jugáis: en un solo móvil, que os vais pasando sin mirar las cartas de los demás, o cada uno en su móvil. Cada uno en su móvil puede ser en directo, en una sala con todos conectados por internet o en la misma Wi-Fi, o por turnos: un duelo en el que cada uno juega cuando puede y que caduca a los 7 días sin jugar. Si te invitan, entra con «Unirme a una partida».' }
    },
    online: {
      screen: 'hub-online', name: 'Jugar online', title: 'Mesas con desconocidos', art: 'menu-online.webp',
      how: [true, 'Uno tras otro', HOW_GROUP],
      rows: groupRows('en una mesa'),
      choose: [['Hasta 3 temas', 'o ninguno · sin poderes'], ['Mazos sorpresa', 'partida rápida: 3 · tu mesa: 1, 3 o 5']],
      end: { label: 'Cómo empieza', caption: 'Llena o a los 30 s', html: START, at: 7 }
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
  const figure = ([pict, caption, rule]) => `<figure class="mode-guide-cell">${cell(rule, PICTS[pict]())}<figcaption>${esc(caption)}</figcaption></figure>`;
  const rowLabel = text => `<p class="mode-guide-rowlabel" aria-hidden="true"><span>${esc(text)}</span></p>`;
  function markup(guide) {
    const [group, howCaption, howRule] = guide.how;
    const axis = '<svg class="g-scene g-axis-mini" viewBox="0 0 120 12" aria-hidden="true" focusable="false"><text class="g-axis t-start" x="0" y="9" font-size="8.5">Oeste</text><path class="g-rule" d="M33 6H86"/>' + head(89, 6, 0, 'g-rule-head') + '<text class="g-axis t-end" x="120" y="9" font-size="8.5">Este</text></svg>';
    const end = guide.end ? `<section class="mode-guide-end" style="--at:${guide.end.at || 0}s"${guide.end.rule ? ` role="img" aria-label="${esc(guide.end.rule)}"` : ''}>${rowLabel(guide.end.label)}${guide.end.html}${guide.end.caption ? `<p class="mode-guide-caption">${esc(guide.end.caption)}</p>` : ''}</section>` : '';
    return `<div class="mode-guide-inner">
      <header class="mode-guide-head"><img class="mode-guide-hero" src="assets/${guide.art}" alt="" aria-hidden="true" decoding="async"><span><span class="eyebrow">${esc(guide.name)}</span><h2 id="mode-guide-title">${esc(guide.title)}</h2></span></header>
      <figure class="mode-guide-how" style="--at:.55s">${howStrip(group, howRule)}<figcaption>${esc(howCaption)}</figcaption></figure>
      <section class="mode-guide-table" aria-label="Grandes colecciones y Retos rápidos">
        <div class="mode-guide-cols"><p class="mode-guide-colhead"><b>Grandes colecciones</b><small>Mazos por temas</small></p><p class="mode-guide-colhead"><b>Retos rápidos</b><small>Cada mazo, su regla</small>${axis}</p></div>
        ${guide.rows.map(([label, at, collections, quick]) => `<div class="mode-guide-row" style="--at:${at}s">${rowLabel(label)}${figure(collections)}${figure(quick)}</div>`).join('')}
        <div class="mode-guide-row mode-guide-choose">${rowLabel('Eliges')}${guide.choose.map(([main, note]) => `<p><b>${esc(main)}</b><small>${esc(note)}</small></p>`).join('')}</div>
      </section>
      ${end}
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

  CT.GuiaModos = { show, close, follow, guides: GUIDES, scenes: PICTS };
})();
