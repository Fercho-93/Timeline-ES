// La guía en vídeo: el juego se explica mostrándolo. Cada escena se reproduce sola, con un
// subtítulo corto y un dedo que hace las jugadas. Se pausa, se avanza y se rebobina como un
// vídeo; no es un vídeo de verdad, sino la misma mesa dibujada con cartas reales del mazo, así
// que nunca enseña algo que luego el tablero contradiga. Solo se mira: no pide ninguna jugada,
// no gasta vidas ni cambia el progreso.
(() => {
  const CT = window.CONTINUUM;
  const esc = value => CT.escapeHtml(value);

  // Las cartas de los ejemplos se toman de puntos separados del mazo, ordenadas y con valores
  // distintos: la que se coloca encaja de verdad donde dice la escena.
  function sample(modeKey) {
    const deck = CT.cards(modeKey);
    const seen = new Set();
    const ordered = [...deck].sort((a, b) => CT.sortValue(modeKey, a) - CT.sortValue(modeKey, b))
      .filter(card => { const value = CT.sortValue(modeKey, card); if (seen.has(value)) return false; seen.add(value); return true; });
    if (ordered.length < 8) return null;
    const at = fraction => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
    return [0.08, 0.24, 0.4, 0.52, 0.64, 0.8, 0.94].map(at);
  }

  function cardMarkup(modeKey, card, { hidden = false, extra = "" } = {}) {
    return `<div class="tv-card${hidden ? " is-hidden" : ""}${extra ? " " + extra : ""}" data-card="${esc(card.id)}">
      <span class="tv-back">${CT.cardBack(modeKey)}</span>
      <span class="tv-art">${CT.animalArt(modeKey, card) || `<i aria-hidden="true">◆</i>`}</span>
      <b class="tv-value">${esc(CT.shortValue(modeKey, card))}</b><b class="tv-secret">?<i>${esc(CT.hiddenLabel(modeKey))}</i></b>
      <small>${esc(card.title)}</small></div>`;
  }

  // Un hueco de la línea. Como en la mesa de verdad, el primero (antes de todo) es «−» y los
  // demás «+». Es un dibujo, no un botón: el vídeo solo se mira.
  const gapHtml = index => `<span class="tv-gap" data-gap="${index}" aria-hidden="true">${index === 0 ? "−" : "+"}</span>`;
  // Una línea con sus huecos entre carta y carta (y en los extremos).
  function lineMarkup(modeKey, list, { gaps = true } = {}) {
    const gap = index => gaps ? gapHtml(index) : "";
    return `<div class="tv-line">${list.map((card, index) => gap(index) + cardMarkup(modeKey, card.card || card, card.opts || {})).join("")}${gap(list.length)}</div>`;
  }

  // Dónde está en la aplicación lo que cuenta la escena: los botones que hay que pulsar.
  const path = steps => `<div class="tv-path">${steps.map(step => `<span>${esc(step)}</span>`).join('<i aria-hidden="true">›</i>')}</div>`;
  // Las mismas láminas que las puertas y modalidades de Inicio, a escala de la guía.
  const MENU_ART = {
    "Jugar": "home-door-jugar.webp", "Jugar solo": "mode-walk-solo.webp", "Retos rápidos": "menu-quick.webp",
    "Jugar con amigos": "mode-walk-multi.webp", "Jugar online": "menu-online.webp",
    "Unirme a una partida": "menu-private.webp", "Reto diario": "menu-daily.webp",
    "Maratón": "mode-walk-solo.webp", "Competición": "competition-engraving.webp",
    "Mazos del día": "menu-daily.webp", "Partida sorpresa": "menu-quick.webp",
    "Mesas abiertas": "menu-online.webp", "Crear mesa": "menu-wifi.webp", "Partida rápida": "menu-quick.webp"
  };
  const menuArt = name => MENU_ART[name] ? `<img class="tv-menu-art" src="assets/${MENU_ART[name]}" alt="" decoding="async">` : "";
  const door = (name, extra = "") => `<div class="tv-door ${extra}">${menuArt(name)}<b>${esc(name)}</b>${name === "Jugar" ? '<i class="tv-chevron" aria-hidden="true">⌄</i>' : ""}</div>`;
  function tile(icon, name, facts, extra = "") {
    return `<div class="tv-tile${extra ? " " + extra : ""}">${menuArt(name) || `<i aria-hidden="true">${icon}</i>`}<b>${name}</b>${facts ? `<small>${facts}</small>` : ""}</div>`;
  }
  const hearts = () => `<div class="tv-lives" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></div>`;
  const dots = marks => `<div class="tv-dots">${marks.split("").map(m => `<span data-mark="${m === "✓" ? "ok" : "bad"}">${m}</span>`).join("")}</div>`;

  // Los niveles salen de las mismas reglas que usa la partida (ghost.js): si cambian, el vídeo
  // cambia con ellas.
  const FALLBACK_LEVELS = {
    easy: { name: "Fácil", extra: 0, seconds: 0, hidden: "never" }, normal: { name: "Normal", extra: 1, seconds: 30, hidden: "never" },
    hard: { name: "Difícil", extra: 2, seconds: 20, hidden: "sometimes" }, expert: { name: "Experto", extra: 2, seconds: 15, hidden: "always" }
  };
  function levelsTable(time) {
    const levels = Object.values(CT.Ghost?.LEVELS || FALLBACK_LEVELS);
    const row = (label, value) => `<div class="tv-level-row"><span>${label}</span>${levels.map((level, i) => `<b data-level="${i}">${value(level)}</b>`).join("")}</div>`;
    return `<div class="tv-levels" style="--tv-levels:${levels.length}">${row("", level => esc(level.name)).replace("tv-level-row", "tv-level-row tv-level-head")}
      ${row("Reloj", level => level.seconds ? `${level.seconds} s` : "No")}
      ${row("Por acierto", level => level.extra ? `+${level.extra} carta${level.extra > 1 ? "s" : ""}` : "—")}
      ${row(time ? "Fechas ocultas" : "Cifras ocultas", level => ({ never: "No", sometimes: "A veces", always: "Siempre" })[level.hidden] || "No")}</div>`;
  }

  // Un reto rápido de verdad, para enseñar que cada mazo trae su propia regla.
  function quickExample() {
    const list = CT.QuickCatalog?.challenges || [];
    const deck = list.find(item => item.id === "sports-players") || list[0];
    return deck ? `<div class="tv-deck"><img class="tv-menu-art" src="${esc(deck.cards?.find(card => card.image)?.image || "assets/menu-quick.webp")}" alt="" decoding="async"><b>${esc(deck.title)}</b><small>${esc(deck.rule)}</small></div>` : "";
  }

  // Separadores dentro del vídeo: anuncian un cambio de bloque antes de sus ejemplos.
  function blockIntro(chapter, heading, art, kicker, description, route, caption) {
    return { chapter, title: `${heading} · Entradilla`, duration: 4800,
      html: `<div class="tv-chapter-intro">
        <div class="tv-intro-hero">${menuArt(art)}<div class="tv-intro-copy"><p>${esc(kicker)}</p><h3>${esc(heading)}</h3><span>${esc(description)}</span></div></div>
        ${path(route)}</div>`,
      steps: [[0, c => c.say(caption)]] };
  }

  // ── Las escenas ────────────────────────────────────────────────────────────────────────
  // Cada escena dibuja su mesa (`html`) y una lista de pasos [milisegundo, acción].
  // `portada`: el vídeo se ve suelto desde la portada, sin manual debajo; al acabar se vuelve a ella.
  function scenes(modeKey, portada = false) {
    const s = sample(modeKey);
    const time = CT.mode(modeKey).axis === "time";
    const order = time ? "de antes a después" : "de menor a mayor";
    const [less, more] = CT.axis?.(modeKey)?.ends || (time ? ["Antes", "Después"] : ["Menos", "Más"]);
    const [A, B, C, D, E, F, G] = s;

    // Una carta de fechas y otra de cifras, si el juego tiene los dos mazos; si no, la del mazo abierto.
    const kinds = ["history", "animals"].filter(key => CT.has(key) && CT.cards(key).length)
      .map(key => [key, CT.cards(key)[Math.floor(CT.cards(key).length / 3)]]);
    const pair = (kinds.length === 2 ? kinds : [[modeKey, D]])
      .map(([key, card]) => `<figure class="tv-kind">${cardMarkup(key, card, { hidden: true, extra: "tv-big" })}<figcaption>${esc(CT.mode(key).name)}</figcaption></figure>`).join("");

    // Quién empieza: cada uno dice el dato de la carta D. Las respuestas son valores reales del
    // mazo, así que se escriben en su unidad; empieza quien más se acerca.
    const guesses = [["Ana", B], ["Luis", E], ["Sara", G]];
    const target = CT.sortValue(modeKey, D);
    const closest = guesses.reduce((best, [, card], i) => Math.abs(CT.sortValue(modeKey, card) - target) < Math.abs(CT.sortValue(modeKey, guesses[best][1]) - target) ? i : best, 0);

    const seat = (name, cards) => `<div class="tv-seat"><b>${name}</b><span class="tv-minihand">${"<i></i>".repeat(cards)}</span><em></em></div>`;

    return [
      // 1 · Lo básico
      { chapter: 0, title: "Cada carta, un dato", duration: 6800,
        html: `<div class="tv-center"><div class="tv-pair">${pair}</div></div>`,
        steps: [
          [0, c => c.say("Cada carta esconde un dato.")],
          [300, c => c.stagger(".tv-kind", 350)],
          [2400, c => c.fingerTo(".tv-big")],
          [2900, c => { c.tap(); c.reveal(".tv-big"); c.fingerHide(); }],
          [3300, c => c.say("Según el mazo, puede ser una fecha, un peso, una distancia…")]
        ] },
      { chapter: 0, title: "La línea", duration: 7000,
        html: `<div class="tv-center">${lineMarkup(modeKey, [A, C, E, G], { gaps: false })}<div class="tv-axis"><span>${esc(less)}</span><i></i><span>${esc(more)}</span></div></div>`,
        steps: [
          [0, c => c.say("Tu objetivo es poner cada carta en su sitio de la línea.")],
          [300, c => c.stagger(".tv-line .tv-card", 380)],
          [2600, c => c.add(".tv-axis", "is-in")],
          [3400, c => c.say(`La línea va ${order}.`)]
        ] },
      { chapter: 0, title: "Tu turno", duration: 10000,
        html: `<div class="tv-table">${lineMarkup(modeKey, [B, E])}<div class="tv-hand">${cardMarkup(modeKey, C, { hidden: true })}</div><span class="tv-confirm" aria-hidden="true">Colocar carta →</span></div>`,
        steps: [
          [0, c => c.say("Arrastra la carta al hueco donde crees que va.")],
          [400, c => c.add(".tv-hand .tv-card", "is-in")],
          [1800, c => { c.fingerTo(".tv-hand .tv-card"); c.say("También puedes seleccionarla y tocar «+» o «−»."); }],
          [2400, c => c.press(true)],
          [2900, c => c.dragTo(".tv-hand .tv-card", '.tv-gap[data-gap="1"]')],
          [4100, c => { c.press(false); c.drop('.tv-gap[data-gap="1"]'); }],
          [4800, c => { c.add(".tv-confirm", "is-in"); c.say("Confirma con «Colocar carta»."); }],
          [5800, c => c.fingerTo(".tv-confirm")],
          [6400, c => c.tap()],
          [6900, c => { c.reveal(".tv-line .is-placed", true); c.remove(".tv-confirm", "is-in"); c.fingerHide(); c.say("Se descubre el dato. Si encaja, la carta se queda."); }]
        ] },
      { chapter: 0, title: "Si fallas", duration: 9200,
        html: `<div class="tv-table">${hearts()}${lineMarkup(modeKey, [B, C, E])}<div class="tv-hand">${cardMarkup(modeKey, F, { hidden: true })}</div></div>`,
        steps: [
          [0, c => { c.say("Si fallas…"); c.add(".tv-hand .tv-card", "is-in"); c.add(".tv-lives", "is-in"); }],
          [1200, c => c.fingerTo('.tv-gap[data-gap="1"]')],
          [1800, c => { c.tap(); c.drop('.tv-gap[data-gap="1"]'); }],
          [2600, c => { c.reveal(".tv-line .is-placed", false); c.fingerHide(); c.say("…la línea marca dónde iba."); }],
          [3400, c => c.mark(4)],
          [5600, c => { c.move(".tv-line .is-placed", 3); c.lose(".tv-lives"); c.say("En una ronda, la carta pasa a su sitio y pierdes una vida."); }]
        ] },
      { chapter: 0, title: "Dónde se juega", duration: 8600,
        html: `<div class="tv-home">${door("Jugar", "tv-door-play")}
          <div class="tv-choices">${["Jugar solo", "Jugar con amigos", "Jugar online"].map(name => `<span>${menuArt(name)}<b>${name}</b></span>`).join("")}</div>
          ${door("Unirme a una partida", "tv-door-join")}${door("Reto diario", "tv-door-daily")}</div>`,
        steps: [
          [0, c => { c.say("En Inicio, toca «Jugar» para elegir si juegas solo, con amigos u online."); c.add(".tv-home", "is-in"); }],
          [1100, c => c.fingerTo(".tv-door-play")],
          [1700, c => { c.tap(); c.add(".tv-door-play", "is-open"); c.add(".tv-choices", "is-open"); }],
          [1900, c => c.stagger(".tv-choices > span", 300)],
          [3600, c => c.fingerHide()],
          [4800, c => { c.say("En Inicio también están «Unirme a una partida» y «Reto diario»."); c.stagger(".tv-door-join, .tv-door-daily", 400); }]
        ] },

      // 2 · Jugar solo
      { chapter: 1, title: "Jugar solo · Elegir colección", duration: 6800,
        html: `<div class="tv-chapter-intro">
          <div class="tv-intro-hero">${menuArt("Jugar solo")}<div class="tv-intro-copy"><p>A tu ritmo</p><h3>Jugar solo</h3><span>Elige una colección<br>y un mazo</span></div></div>
          ${path(["Jugar", "Jugar solo", "Grandes colecciones"])}</div>`,
        steps: [
          [0, c => c.say("En «Jugar solo» juegas a tu ritmo.")],
          [2800, c => c.say("En «Grandes colecciones», elige una colección y después un mazo.")]
        ] },
      { chapter: 1, title: "Rondas", duration: 10400,
        html: `<div class="tv-board">${path(["Jugar solo", "Grandes colecciones"])}<div class="tv-round"><div class="tv-round-head"><b>Ronda</b>${hearts()}</div>${dots("✓✓✓✗✓✓✓✓✓✓")}<div class="tv-stars">★★<i>★</i></div></div>
          <div class="tv-tiles">${tile("∞", "Maratón", "Todo el mazo · 3 vidas")}${tile("◈", "Competición", "Varios temas · 3 vidas en cada uno")}</div></div>`,
        steps: [
          [0, c => { c.say("En cada ronda juegas 10 cartas y tienes 3 vidas."); c.add(".tv-lives", "is-in"); }],
          [500, c => c.stagger(".tv-dots span", 260)],
          [1300, c => c.lose(".tv-lives")],
          [3600, c => { c.add(".tv-stars", "is-in"); c.say("Al terminar, ganas una estrella por cada vida que te quede."); }],
          [6800, c => { c.say("También puedes jugar una maratón o una competición."); c.stagger(".tv-tile", 500); }]
        ] },
      { chapter: 1, title: "Dificultad", duration: 10200,
        html: `<div class="tv-board">${path(["Jugar solo", "Grandes colecciones", "Dificultad"])}${levelsTable(time)}</div>`,
        steps: [
          [0, c => c.say("Hay cuatro niveles. En Fácil no hay reloj.")],
          [300, c => c.stagger(".tv-level-row", 350)],
          [1600, c => c.focus(".tv-levels", 0)],
          [3600, c => { c.focus(".tv-levels", 1); c.say("Desde Normal hay reloj, y cada acierto añade cartas a la línea."); }],
          [5400, c => c.focus(".tv-levels", 2)],
          [7000, c => { c.focus(".tv-levels", 3); c.say(`En Experto se ocultan las ${time ? "fechas" : "cifras"} de la línea. Te guías por las ilustraciones.`); }]
        ] },
      blockIntro(1, "Retos rápidos", "Retos rápidos", "Jugar solo", "Mazos del día y partidas sorpresa",
        ["Jugar solo", "Retos rápidos"], "En «Jugar solo» también tienes «Retos rápidos»."),
      { chapter: 1, title: "Retos rápidos", duration: 9800,
        html: `<div class="tv-board">${path(["Jugar solo", "Retos rápidos"])}${quickExample()}<div class="tv-tiles">
          ${tile("☀", "Mazos del día", "4 mazos, nuevos cada día")}${tile("?", "Partida sorpresa", "1, 3, 5 o más, al azar")}</div></div>`,
        steps: [
          [0, c => { c.say("Mazos cortos, cada uno con su propia regla de orden."); c.add(".tv-deck", "is-in"); }],
          [3400, c => { c.say("Juega uno de los mazos del día o una partida sorpresa."); c.stagger(".tv-tile", 500); }],
          [6800, c => c.say("Un fallo no te elimina: al final cuentan tus aciertos.")]
        ] },

      // 3 · En grupo
      blockIntro(2, "En grupo", "Jugar con amigos", "Con otras personas", "Las reglas de una partida en grupo",
        ["Inicio", "Jugar"], "Veamos cómo se juega con otras personas."),
      // Un turno es una carta: Ana se queda sin cartas en su turno, pero gana al cerrar la vuelta,
      // después de que jueguen Luis y Sara (sin cartas también ellos, habría final).
      { chapter: 2, title: "Tu mano", duration: 11600,
        html: `<div class="tv-board"><div class="tv-path"><span>Grandes colecciones · en grupo</span></div><div class="tv-seats">${seat("Ana", 2)}${seat("Luis", 3)}${seat("Sara", 3)}</div>
          <div class="tv-piles"><span data-pile="deck">Mazo</span><span data-pile="discard">Descarte</span></div></div>`,
        steps: [
          [0, c => { c.say("Cada persona tiene su propia mano de cartas."); c.stagger(".tv-seat", 300); }],
          [1200, c => c.add(".tv-piles", "is-in")],
          [2600, c => { c.turn(0); c.say("Si aciertas, te queda una carta menos."); }],
          [3300, c => c.play(0, true)],
          [4600, c => { c.turn(1); c.say("Si fallas, va al descarte y robas otra."); }],
          [5300, c => { c.play(1, false); c.pulse('[data-pile="discard"]'); }],
          [6100, c => { c.draw(1); c.pulse('[data-pile="deck"]'); }],
          [6900, c => { c.turn(2); c.play(2, true); }],
          [7800, c => { c.turn(0); c.say("Gana quien termine la vuelta sin cartas."); }],
          [8300, c => c.play(0, true)],
          [9000, c => { c.turn(1); c.play(1, true); }],
          [9700, c => { c.turn(2); c.play(2, true); }],
          [10500, c => { c.turn(-1); c.win(0); }]
        ] },
      { chapter: 2, title: "Quién empieza", duration: 10600,
        html: `<div class="tv-center">${cardMarkup(modeKey, D, { hidden: true, extra: "tv-big tv-guess-card" })}<div class="tv-guesses">${guesses.map(([name, card], i) => `<span data-guess="${i}"><b>${name}</b>${esc(CT.shortValue(modeKey, card))}</span>`).join("")}</div></div>`,
        steps: [
          [0, c => { c.say("Para decidir quién empieza, cada persona intenta adivinar el dato de una carta."); c.add(".tv-big", "is-in"); }],
          [1000, c => c.stagger(".tv-guesses span", 450)],
          [3800, c => { c.reveal(".tv-big"); c.say("Empieza quien más se acerque."); }],
          [4300, c => c.add(`[data-guess="${closest}"]`, "is-on")],
          [7000, c => c.say("Si en la misma vuelta varios se quedan sin cartas, se desempata igual.")]
        ] },
      { chapter: 2, title: "Con amigos", duration: 11000,
        html: `<div class="tv-board">${path(["Jugar", "Jugar con amigos"])}<div class="tv-ways">
          <div class="tv-way tv-way-one"><img class="tv-menu-art" src="assets/menu-local.webp" alt=""><b>Un solo móvil</b><span class="tv-pass"><span class="tv-phone" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10.5 18.5h3"/></svg></span><span class="tv-people"><b>Ana</b><b>Luis</b><b>Sara</b></span></span><small>De 2 a 9 personas</small></div>
          <div class="tv-way tv-way-many"><img class="tv-menu-art" src="assets/menu-private.webp" alt=""><b>Cada uno en su móvil</b><span class="tv-rhythms"><span><b>En directo</b>Todos a la vez</span><span><b>Por turnos</b>Un duelo a dos, sin prisa</span><span><b>Mismas cartas</b>Juegas y retas con un enlace</span></span></div></div></div>`,
        steps: [
          [0, c => { c.say("Si compartís móvil, pasadlo a quien le toque jugar."); c.add(".tv-way-one", "is-in"); }],
          [500, c => c.cycle(".tv-people b", 800, 2)],
          [4400, c => { c.add(".tv-way-many", "is-in"); c.stagger(".tv-rhythms > span", 450); c.say("O cada uno en el suyo: en directo, por turnos o con las mismas cartas."); }],
          [8200, c => c.say("Para entrar en una partida, toca «Unirme a una partida».")]
        ] },
      { chapter: 2, title: "Poderes", duration: 11400,
        html: `<div class="tv-board"><div class="tv-path"><span>Opcionales · se activan al preparar la partida</span></div><div class="tv-powers">
          <div class="tv-power" data-power="ghost"><i aria-hidden="true">◌</i><b>Fantasma</b><span class="tv-mini" aria-hidden="true"><em>?</em><em>?</em><em>?</em></span></div>
          <div class="tv-power" data-power="pulse"><i aria-hidden="true">ϟ</i><b>Pulso</b><span class="tv-duel" aria-hidden="true"><em>Tú</em><i>ϟ</i><em>Luis</em></span></div></div>
          <p class="tv-note">No hay poderes en duelos, competición, mesas públicas ni Retos rápidos.</p></div>`,
        steps: [
          [0, c => { c.say("Algunas cartas dan poderes de un solo uso."); c.stagger(".tv-power", 400); }],
          [3200, c => { c.add('[data-power="ghost"]', "is-on"); c.say("Fantasma: durante una vuelta, las cartas ocultan su dato y su ilustración."); }],
          [7000, c => { c.remove('[data-power="ghost"]', "is-on"); c.add('[data-power="pulse"]', "is-on"); c.say("Pulso: los dos colocan la misma carta. Si solo tú aciertas, le pasas una de tu mano."); }],
          [9200, c => c.add(".tv-note", "is-in")]
        ] },
      blockIntro(2, "Jugar online", "Jugar online", "Con otras personas", "Encuentra una mesa pública",
        ["Jugar", "Jugar online"], "En «Jugar online» puedes unirte a una mesa pública o crear la tuya."),
      { chapter: 2, title: "Online", duration: 8800,
        html: `<div class="tv-board">${path(["Jugar", "Jugar online"])}<div class="tv-table-seats"><span>●</span><span>●</span><span class="is-free">○</span><span class="is-free">○</span></div><div class="tv-tiles tv-three">
          ${tile("◎", "Mesas abiertas", "Siéntate en una")}${tile("+", "Crear mesa", "Juego, jugadores y tiempo")}${tile("»", "Partida rápida", "Te sentamos")}</div></div>`,
        steps: [
          [0, c => { c.say("En las mesas públicas podéis jugar de 2 a 4 jugadores."); c.add(".tv-table-seats", "is-in"); }],
          [1400, c => c.fill(".tv-table-seats .is-free", 800)],
          [3600, c => { c.say("Elige una mesa, crea la tuya o busca una partida rápida."); c.stagger(".tv-tile", 450); }]
        ] },

      // 4 · Reto diario
      blockIntro(3, "Reto diario", "Reto diario", "Desde Inicio", "El mismo desafío para todos",
        ["Inicio", "Reto diario"], "En Inicio tienes el «Reto diario», con las mismas cartas para todos."),
      { chapter: 3, title: "Reto diario", duration: 9600,
        html: `<div class="tv-board">${path(["Inicio", "Reto diario"])}${dots("✓✓✗✓✓✓✗✓✓✗")}<div class="tv-score">7 de 10</div>
          <div class="tv-facts"><span>Un intento al día</span><span>Días pares: Grandes colecciones</span><span>Impares: Retos rápidos</span></div></div>`,
        steps: [
          [0, c => c.say("Cada día tienes un reto nuevo de 10 cartas.")],
          [500, c => c.stagger(".tv-dots span", 260)],
          [3300, c => c.add(".tv-score", "is-in")],
          [4400, c => c.say("No hay vidas ni límite de tiempo. Tus aciertos cuentan en el ranking diario y semanal.")],
          [5600, c => c.stagger(".tv-facts span", 350)]
        ] },
      { chapter: 3, title: "A jugar", duration: 4500, last: true,
        html: `<div class="tv-center tv-end"><div class="tv-logo">A jugar</div><p>Para empezar, elige un mazo de Grandes colecciones en «Jugar solo» y juega en Fácil.</p><div class="tv-end-actions"><button type="button" class="btn btn-secondary" data-tv="replay">Ver otra vez</button>${portada ? "" : '<button type="button" class="btn btn-ghost" data-tv="manual">Ver la Guía completa</button>'}</div></div>`,
        steps: [
          [0, c => { c.say(portada ? "Pulsa «Jugar» para empezar." : "Debajo tienes la Guía completa, con todos los detalles."); c.add(".tv-end", "is-in"); }]
        ] }
    ];
  }

  const CHAPTERS = ["Lo básico", "Jugar solo", "En grupo", "Reto diario"];

  const ICON = {
    play: '<svg class="tv-ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6v14.8c0 .9 1 1.4 1.7.9l11-7.4c.7-.4.7-1.4 0-1.8l-11-7.4C8 3.2 7 3.7 7 4.6Z"/></svg>',
    pause: '<svg class="tv-ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4" width="4.5" height="16" rx="1.3"/><rect x="14" y="4" width="4.5" height="16" rx="1.3"/></svg>',
    replay: '<svg class="tv-ico-replay" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.3 4h2.2A5 5 0 1 0 12 7v3L7.5 6 12 2v3Z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5h2.4v13H6v-13Zm12.6.9v11.2c0 .9-1 1.4-1.7.9L9 13c-.7-.5-.7-1.5 0-2l7.9-5.5c.7-.5 1.7 0 1.7.9Z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.6 5.5H18v13h-2.4v-13ZM5.4 6.4v11.2c0 .9 1 1.4 1.7.9L15 13c.7-.5.7-1.5 0-2L7.1 5.5c-.7-.5-1.7 0-1.7.9Z"/></svg>'
  };

  function markup(modeKey, { portada = false } = {}) {
    if (!sample(modeKey)) return "";
    const list = scenes(modeKey, portada);
    // La línea de escenas de arriba: un tramo por escena, agrupados por capítulo.
    const timeline = CHAPTERS.map((name, chapter) => `<span class="tv-seg-group" data-chapter="${chapter}">${list.map((scene, index) => scene.chapter === chapter ? `<button type="button" class="tv-seg" data-tv-scene="${index}" tabindex="-1" aria-label="${esc(scene.title)}"><i></i></button>` : "").join("")}</span>`).join("");
    return `<section class="tv-player" data-tutorial="${esc(modeKey)}"${portada ? " data-portada" : ""} aria-label="Vídeo: cómo se juega">
      <div class="tv-screen">
        <i class="tv-light" aria-hidden="true"></i>
        <div class="tv-timeline" aria-hidden="true">${timeline}</div>
        <div class="tv-scene-title" aria-hidden="true"></div>
        <div class="tv-fade" aria-hidden="true" inert></div>
        <div class="tv-stage"></div>
        <span class="tv-finger" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-1a1.5 1.5 0 0 1 3 0v4.5a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.9-2.6L3.6 14a1.5 1.5 0 0 1 2.4-1.8L9 15V11"/></svg></span>
        <p class="tv-caption" aria-live="polite"></p>
        <button type="button" class="tv-big-play" data-tv="toggle" aria-label="Reproducir" hidden>${ICON.play}</button>
      </div>
      <div class="tv-controls">
        <div class="tv-transport">
          <button type="button" class="tv-btn" data-tv="prev" aria-label="Escena anterior">${ICON.prev}</button>
          <button type="button" class="tv-btn tv-play" data-tv="toggle" data-state="playing" aria-label="Pausar">${ICON.play}${ICON.pause}${ICON.replay}</button>
          <button type="button" class="tv-btn" data-tv="next" aria-label="Escena siguiente">${ICON.next}</button>
        </div>
        <div class="tv-chapters">${CHAPTERS.map((name, index) => `<button type="button" class="tv-chapter" data-tv-chapter="${index}"><b aria-hidden="true">${index + 1}</b><small>${name}</small></button>`).join("")}</div>
      </div>
    </section>`;
  }

  // ── El reproductor ─────────────────────────────────────────────────────────────────────
  function mount(root) {
    if (root.dataset.tutorialReady) return;
    root.dataset.tutorialReady = "1";
    const modeKey = root.dataset.tutorial;
    const list = scenes(modeKey, root.hasAttribute("data-portada"));
    const stage = root.querySelector(".tv-stage"), finger = root.querySelector(".tv-finger"), fade = root.querySelector(".tv-fade");
    const caption = root.querySelector(".tv-caption"), sceneTitle = root.querySelector(".tv-scene-title");
    let index = 0, t = 0, applied = 0, playing = true, ended = false, last = 0, timer = 0;
    const timeouts = new Set();

    const $ = sel => stage.querySelector(sel);
    const $$ = sel => [...stage.querySelectorAll(sel)];
    const later = (fn, ms) => { if (instant) { fn(); return; } const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };
    let instant = false;
    const centerOf = el => {
      const box = root.querySelector(".tv-screen").getBoundingClientRect(), r = el.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    };
    const seat = i => $$(".tv-seat")[i];
    const ctx = {
      // Cada frase entra de nuevo (la clase se quita y se vuelve a poner para repetir la animación).
      say(text) { caption.textContent = text; caption.classList.remove("is-say"); void caption.offsetWidth; caption.classList.add("is-say"); },
      add(sel, cls) { $$(sel).forEach(el => el.classList.add(cls)); },
      remove(sel, cls) { $$(sel).forEach(el => el.classList.remove(cls)); },
      stagger(sel, gap) { $$(sel).forEach((el, i) => later(() => el.classList.add("is-in"), i * gap)); },
      cycle(sel, gap, rounds) { const els = $$(sel); for (let i = 0; i < els.length * rounds; i++) later(() => els.forEach((el, k) => el.classList.toggle("is-on", k === i % els.length)), i * gap); },
      fill(sel, gap) { $$(sel).forEach((el, i) => later(() => { el.classList.remove("is-free"); el.textContent = "●"; }, i * gap)); },
      pulse(sel) { $$(sel).forEach(el => { el.classList.remove("is-pulse"); void el.offsetWidth; el.classList.add("is-pulse"); }); },
      // Resalta una columna de la tabla de niveles.
      focus(sel, column) { $$(`${sel} [data-level]`).forEach(el => el.classList.toggle("is-on", el.dataset.level === String(column))); },
      // Una vida menos: se apaga el último corazón que quede.
      lose(sel) { $$(`${sel} i:not(.is-lost)`).pop()?.classList.add("is-lost"); },
      // La mesa en grupo: de quién es el turno, una carta jugada (bien o mal), robar y ganar.
      turn(i) { $$(".tv-seat").forEach((el, k) => { el.classList.toggle("is-turn", k === i); el.querySelector("em").textContent = ""; }); },
      play(i, ok) {
        const row = seat(i); if (!row) return;
        row.querySelectorAll(".tv-minihand i:not(.is-out)")[0]?.classList.add("is-out", ok ? "is-ok" : "is-bad");
        const mark = row.querySelector("em"); mark.textContent = ok ? "✓" : "✗"; mark.dataset.mark = ok ? "ok" : "bad";
      },
      draw(i) { seat(i)?.querySelector(".tv-minihand")?.insertAdjacentHTML("beforeend", '<i class="is-new"></i>'); },
      win(i) { const row = seat(i); if (!row) return; row.classList.add("is-winner"); const mark = row.querySelector("em"); mark.textContent = "Gana"; mark.dataset.mark = "win"; },
      fingerTo(sel) { const el = typeof sel === "string" ? $(sel) : sel; if (!el) return; const [x, y] = centerOf(el); finger.style.transform = `translate(${x}px, ${y}px)`; finger.classList.add("is-in"); },
      fingerHide() { finger.classList.remove("is-in", "is-press"); },
      press(on) { finger.classList.toggle("is-press", on); },
      tap() { finger.classList.remove("is-tap"); void finger.offsetWidth; finger.classList.add("is-tap"); },
      dragTo(cardSel, gapSel) {
        const card = $(cardSel), gap = $(gapSel); if (!card || !gap) return;
        const [cx, cy] = centerOf(card), [gx, gy] = centerOf(gap);
        card.style.transform = `translate(${gx - cx}px, ${gy - cy}px) scale(.9)`;
        card.classList.add("is-lifted");
        ctx.fingerTo(gap);
      },
      // La carta de la mano entra en la línea por el hueco indicado, todavía oculta.
      drop(gapSel) {
        const card = $(".tv-hand .tv-card"), gap = $(gapSel);
        const line = $(".tv-line"); if (!card || !gap || !line) return;
        let prev = gap.previousElementSibling;
        while (prev && !prev.classList.contains("tv-card")) prev = prev.previousElementSibling;
        card.remove();
        if (prev) prev.after(card); else line.prepend(card);
        card.style.transform = ""; card.classList.remove("is-lifted", "is-in");
        card.classList.add("is-placed");
        $(".tv-hand")?.classList.add("is-empty");
        ctx.renumber();
      },
      renumber() {
        const line = $(".tv-line"); if (!line) return;
        // Huecos entre cartas, sin dos seguidos ni carta sin hueco al lado.
        line.querySelectorAll(".tv-gap").forEach(gap => gap.remove());
        const cards = [...line.querySelectorAll(".tv-card")];
        cards.forEach((card, i) => card.insertAdjacentHTML("beforebegin", gapHtml(i)));
        line.insertAdjacentHTML("beforeend", gapHtml(cards.length));
      },
      reveal(sel, ok) {
        $$(sel).forEach(el => {
          el.classList.remove("is-hidden");
          if (ok === true) el.classList.add("is-ok");
          if (ok === false) el.classList.add("is-bad");
        });
      },
      mark(gapIndex) { $(`.tv-gap[data-gap="${gapIndex}"]`)?.classList.add("is-here"); },
      move(sel, gapIndex) {
        const el = $(sel), line = $(".tv-line"); if (!el || !line) return;
        const others = [...line.querySelectorAll(".tv-card")].filter(card => card !== el);
        el.remove();
        if (others[gapIndex - 1]) others[gapIndex - 1].after(el); else line.prepend(el);
        el.classList.remove("is-bad"); el.classList.add("is-moved");
        ctx.renumber();
      }
    };

    function build(target = 0) {
      timeouts.forEach(clearTimeout); timeouts.clear();
      const scene = list[index];
      // La escena anterior se disuelve mientras entra la nueva, como un fundido de vídeo.
      if (fade && stage.childElementCount && !instant) {
        fade.innerHTML = stage.innerHTML;
        fade.classList.remove("is-out"); void fade.offsetWidth; fade.classList.add("is-out");
        later(() => { fade.innerHTML = ""; fade.classList.remove("is-out"); }, 450);
      }
      stage.innerHTML = scene.html;
      stage.classList.remove("is-enter"); void stage.offsetWidth; stage.classList.add("is-enter");
      stage.dataset.scene = String(index);
      sceneTitle.textContent = scene.title;
      sceneTitle.classList.remove("is-in"); void sceneTitle.offsetWidth; sceneTitle.classList.add("is-in");
      ctx.fingerHide(); finger.style.transform = "";
      caption.textContent = "";
      t = 0; applied = 0;
      if (target > 0) {
        instant = true; root.classList.add("tv-instant");
        advance(target);
        void stage.offsetWidth;
        root.classList.remove("tv-instant"); instant = false;
      }
      paint();
    }

    function advance(to) {
      const steps = list[index].steps;
      while (applied < steps.length && steps[applied][0] <= to) { steps[applied][1](ctx); applied++; }
      t = to;
    }

    function go(next, { play = true } = {}) {
      index = Math.max(0, Math.min(list.length - 1, next));
      ended = false; build();
      if (play) setPlaying(true);
    }

    function setPlaying(on) {
      if (ended && on) { index = 0; ended = false; build(); }
      playing = on;
      last = now();
      if (playing) loop();
      paint();
    }

    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    function loop() {
      clearTimeout(timer);
      if (!root.isConnected) { stop(); return; }
      if (!playing) return;
      const moment = now(), dt = Math.min(200, moment - last); last = moment;
      advance(t + dt);
      const scene = list[index];
      if (t >= scene.duration) {
        if (scene.last || index >= list.length - 1) {
          ended = true; playing = false; paint();
          // Quien lo ha abierto (la portada) decide qué hacer al terminar.
          root.dispatchEvent(new CustomEvent("tutorial-end", { bubbles: true }));
          return;
        }
        index++; build();
      }
      paintProgress();
      timer = setTimeout(loop, 60);
    }
    function stop() { clearTimeout(timer); timeouts.forEach(clearTimeout); timeouts.clear(); playing = false; }

    const segments = [...root.querySelectorAll(".tv-seg i")];
    function paintProgress() {
      // Arriba, un tramo por escena: las pasadas llenas, la actual avanzando.
      segments.forEach((bar, i) => {
        const scene = list[i]; if (!scene) return;
        bar.style.width = i < index || ended ? "100%" : i === index ? `${Math.min(100, Math.round(t / scene.duration * 100))}%` : "0%";
      });
      CHAPTERS.forEach((_, chapter) => {
        const tab = root.querySelector(`[data-tv-chapter="${chapter}"]`); if (!tab) return;
        tab.classList.toggle("is-current", list[index].chapter === chapter);
        tab.classList.toggle("is-done", ended || list.every((scene, i) => scene.chapter !== chapter || i < index));
      });
    }
    function paint() {
      const play = root.querySelector(".tv-play"), big = root.querySelector(".tv-big-play");
      play.dataset.state = playing ? "playing" : ended ? "ended" : "paused";
      play.setAttribute("aria-label", playing ? "Pausar" : ended ? "Ver otra vez" : "Reproducir");
      big.hidden = playing || ended;
      root.classList.toggle("is-paused", !playing);
      root.classList.toggle("is-ended", ended);
      paintProgress();
    }

    root.addEventListener("click", event => {
      const control = event.target.closest("[data-tv]"), chapter = event.target.closest("[data-tv-chapter]"), seg = event.target.closest("[data-tv-scene]");
      if (seg) { go(Number(seg.dataset.tvScene)); return; }
      if (chapter) { go(list.findIndex(scene => scene.chapter === Number(chapter.dataset.tvChapter))); return; }
      if (!control) return;
      const action = control.dataset.tv;
      if (action === "toggle") setPlaying(!playing);
      else if (action === "prev") go(t > 1500 ? index : index - 1);
      else if (action === "next") go(index + 1);
      else if (action === "replay") go(0);
      else if (action === "manual") root.closest(".guide-handbook")?.querySelector(".guide-manual")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    // Tocar la pantalla pausa o reanuda, como en un vídeo.
    root.querySelector(".tv-screen").addEventListener("click", event => {
      if (event.target.closest("button")) return;
      setPlaying(!playing);
    });

    // Al salir de la aplicación el vídeo se queda en pausa, como cualquier reproductor.
    const onHidden = () => { if (!root.isConnected) document.removeEventListener("visibilitychange", onHidden); else if (document.hidden && playing) setPlaying(false); };
    document.addEventListener("visibilitychange", onHidden);
    build();
    setPlaying(true);
    root.tutorial = { go, setPlaying, state: () => ({ index, t, playing, ended, scenes: list.length, title: list[index].title, duration: list[index].duration }), stop };
  }

  // La guía se inserta como texto desde varios sitios (la partida, las salas); el
  // reproductor arranca solo en cuanto aparece en la página.
  const page = typeof document !== "undefined" ? document : null;
  function mountAll(scope = page) { scope?.querySelectorAll?.("[data-tutorial]:not([data-tutorial-ready])").forEach(mount); }
  if (page?.documentElement && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => mountAll()).observe(page.documentElement, { childList: true, subtree: true });
  }

  CT.Tutorial = { markup, mount, mountAll };
})();
