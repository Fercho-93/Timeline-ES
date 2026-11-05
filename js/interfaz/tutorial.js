// La guía en vídeo: el juego se explica mostrándolo. Cada escena se reproduce sola, con un
// subtítulo corto y un dedo que hace las jugadas. Se pausa, se avanza y se rebobina como un
// vídeo; no es un vídeo de verdad, sino la misma mesa dibujada con cartas reales de los mazos, así
// que nunca enseña algo que luego el tablero contradiga. Solo se mira: no pide ninguna jugada,
// no gasta vidas ni cambia el progreso.
//
// El orden es el de quien no conoce el juego: primero lo que vale siempre (la carta, la línea,
// colocar, fallar y los dos tipos de mazo), después cada forma de jugar con lo que la distingue
// (solo, el reto diario y en grupo) y al final por dónde empezar. Lo que cambia de una forma a
// otra —qué cuesta un fallo, cómo se gana— se cuenta en su sitio, no como regla general.
// Cada dato sale del código que lo decide (las referencias van junto a cada escena): si una regla
// cambia allí, hay que cambiarla aquí. Los subtítulos se leen a unos 15 caracteres por segundo.
(() => {
  const CT = window.CONTINUUM;
  const esc = value => CT.escapeHtml(value);

  // Las cartas de los ejemplos se toman de puntos separados del mazo, ordenadas y con valores
  // distintos: la que se coloca encaja de verdad donde dice la escena. Cada escena usa las suyas,
  // para no enseñar descubierta una carta que luego se coloca oculta.
  const POINTS = [0.05, 0.14, 0.23, 0.32, 0.41, 0.5, 0.59, 0.68, 0.77, 0.86, 0.95];
  function distinctSorted(list, value) {
    const seen = new Set();
    return [...list].sort((a, b) => value(a) - value(b)).filter(card => { const v = value(card); if (seen.has(v)) return false; seen.add(v); return true; });
  }
  function sample(modeKey) {
    const ordered = distinctSorted(CT.cards(modeKey), card => CT.sortValue(modeKey, card));
    if (ordered.length < POINTS.length + 1) return null;
    return POINTS.map(fraction => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))]);
  }
  // Retos rápidos: mazos de verdad con reglas que no son de fechas («De oeste a este», «De menor
  // a mayor longitud»). Si un día faltan, sirve cualquier otro con cartas suficientes.
  const quickDecks = () => CT.QuickCatalog?.challenges || [];
  function quickSample(id) {
    const deck = quickDecks().find(item => item.id === id) || quickDecks().find(item => item.cards?.length >= 8);
    if (!deck) return null;
    const ordered = distinctSorted(deck.cards, card => card.value * (deck.direction || 1));
    if (ordered.length < 8) return null;
    return { deck, cards: [0.05, 0.18, 0.3, 0.42, 0.55, 0.68, 0.8, 0.92].map(f => ordered[Math.floor(ordered.length * f)]) };
  }

  // Una carta: lámina, dato y título; oculta, el reverso del mazo y el rótulo del dato que esconde.
  function cardMarkup(modeKey, card, { hidden = false, extra = "" } = {}) {
    return `<div class="tv-card${hidden ? " is-hidden" : ""}${extra ? " " + extra : ""}" data-card="${esc(card.id)}">
      <span class="tv-back">${CT.cardBack(modeKey)}</span>
      <span class="tv-art">${CT.animalArt(modeKey, card) || `<i aria-hidden="true">◆</i>`}</span>
      <b class="tv-value">${esc(CT.shortValue(modeKey, card))}</b><b class="tv-secret">?<i>${esc(CT.hiddenLabel(modeKey))}</i></b>
      <small>${esc(card.title)}</small></div>`;
  }
  // La misma carta de un reto rápido: en la mesa de verdad, oculta dice «Valor oculto».
  function quickCardMarkup(card, { hidden = false, extra = "" } = {}) {
    return `<div class="tv-card${hidden ? " is-hidden" : ""}${extra ? " " + extra : ""}" data-card="${esc(card.id)}">
      <span class="tv-back">${CT.cardBack("quick")}</span>
      <span class="tv-art">${card.image ? `<img src="${esc(card.image)}" alt="" decoding="async" loading="lazy">` : `<i aria-hidden="true">◆</i>`}</span>
      <b class="tv-value">${esc(card.label)}</b><b class="tv-secret">?<i>Valor oculto</i></b>
      <small>${esc(card.title)}</small></div>`;
  }
  // Una carta en miniatura (lámina y dato), para la línea común de una partida en grupo.
  const miniMarkup = (modeKey, card, extra = "") => `<span class="tv-mini${extra ? " " + extra : ""}"><span class="tv-art">${CT.animalArt(modeKey, card) || "◆"}</span><b>${esc(CT.shortValue(modeKey, card))}</b></span>`;

  // Un hueco de la línea. Como en la mesa de verdad, el primero (antes de todo) es «−» y los
  // demás «+». Es un dibujo, no un botón: el vídeo solo se mira.
  const gapHtml = index => `<span class="tv-gap" data-gap="${index}" aria-hidden="true">${index === 0 ? "−" : "+"}</span>`;
  // Una línea con sus huecos entre carta y carta (y en los extremos).
  function lineMarkup(cardsHtml, { gaps = true, extra = "" } = {}) {
    const gap = index => gaps ? gapHtml(index) : "";
    return `<div class="tv-line${extra ? " " + extra : ""}">${cardsHtml.map((html, index) => gap(index) + html).join("")}${gap(cardsHtml.length)}</div>`;
  }

  // Dónde está en la aplicación lo que cuenta la escena: los botones que hay que pulsar.
  const path = steps => `<div class="tv-path">${steps.map(step => `<span>${esc(step)}</span>`).join('<i aria-hidden="true">›</i>')}</div>`;
  const hearts = (lost = 0, extra = "") => `<div class="tv-lives${extra ? " " + extra : ""}" aria-hidden="true">${[0, 1, 2].map(i => `<i${i >= 3 - lost ? ' class="is-lost"' : ""}>♥</i>`).join("")}</div>`;
  const dots = (marks, extra = "") => `<div class="tv-dots${extra ? " " + extra : ""}">${marks.split("").map(m => `<span data-mark="${m === "✓" ? "ok" : m === "✗" ? "bad" : "none"}">${m === "·" ? "" : m}</span>`).join("")}</div>`;
  // «Sin vidas», «Sin reloj»: el símbolo tachado.
  const without = (symbol, text) => `<span class="tv-without"><i aria-hidden="true">${symbol}</i>${esc(text)}</span>`;
  const art = file => `<img class="tv-menu-art" src="assets/${file}" alt="" decoding="async">`;

  // Los niveles salen de las mismas reglas que usa la partida (js/juego/ghost.js): si cambian,
  // el vídeo cambia con ellas.
  const FALLBACK_LEVELS = {
    easy: { name: "Fácil", extra: 0, seconds: 0, hidden: "never" }, normal: { name: "Normal", extra: 1, seconds: 30, hidden: "never" },
    hard: { name: "Difícil", extra: 2, seconds: 20, hidden: "sometimes" }, expert: { name: "Experto", extra: 2, seconds: 15, hidden: "always" }
  };
  const LEVELS = () => Object.values(CT.Ghost?.LEVELS || FALLBACK_LEVELS);
  function levelsTable() {
    const levels = LEVELS();
    const row = (label, value, extra = "") => `<div class="tv-level-row${extra}"><span>${label}</span>${levels.map((level, i) => `<b data-level="${i}">${value(level)}</b>`).join("")}</div>`;
    return `<div class="tv-levels" style="--tv-levels:${levels.length}">${row("", level => esc(level.name), " tv-level-head")}
      ${row("Reloj por carta", level => level.seconds ? `${level.seconds} s` : "No")}
      ${row("Cada acierto añade", level => level.extra ? `${level.extra} carta${level.extra > 1 ? "s" : ""}` : "—")}
      ${row("Datos de la línea", level => ({ never: "A la vista", sometimes: "Ocultos a veces", always: "Ocultos" })[level.hidden] || "A la vista")}</div>`;
  }

  // ── Las escenas ────────────────────────────────────────────────────────────────────────
  // Cada escena dibuja su mesa (`html`) y una lista de pasos [milisegundo, acción].
  // `portada`: el vídeo se ve suelto desde la portada, sin manual debajo; al acabar se vuelve a ella.
  function scenes(modeKey, portada = false) {
    const s = sample(modeKey);
    const time = CT.mode(modeKey).axis === "time";
    const [less, more] = CT.axis?.(modeKey)?.ends || (time ? ["Más antiguo", "Más reciente"] : ["Menos", "Más"]);
    const card = (c, options) => cardMarkup(modeKey, c, options);
    const quick = quickSample("cities-east-west"), rivers = quickSample("rivers-spain");
    const qcard = (c, options) => quickCardMarkup(c, options);

    // 1 · La carta: una de fechas y otra de cifras, si el juego tiene los dos mazos.
    const kinds = ["history", "animals"].filter(key => CT.has(key) && CT.cards(key).length)
      .map(key => [key, CT.cards(key)[Math.floor(CT.cards(key).length / 3)]]);
    const pair = (kinds.length === 2 ? kinds : [[modeKey, s[5]]])
      .map(([key, c]) => `<figure class="tv-kind">${cardMarkup(key, c, { hidden: true, extra: "tv-big" })}<figcaption>${esc(CT.mode(key).name)}</figcaption></figure>`).join("");

    // Quién empieza: cada uno escribe el dato de la carta s[5]; las respuestas son valores reales
    // del mazo, en su unidad. Empieza quien más se acerca y los demás siguen por cercanía
    // (CT.Starter, js/juego/final.js).
    const target = CT.sortValue(modeKey, s[5]);
    const guesses = [["Ana", s[1]], ["Luis", s[6]], ["Sara", s[9]]]
      .map(([name, c]) => ({ name, value: CT.shortValue(modeKey, c), distance: Math.abs(CT.sortValue(modeKey, c) - target) }));
    const ranks = guesses.map(g => guesses.filter(other => other.distance < g.distance).length);
    const first = guesses[ranks.indexOf(0)].name;
    const seatOrder = guesses.map((g, i) => [ranks[i], g.name]).sort((a, b) => a[0] - b[0]).map(([, name]) => name);

    // En grupo: la línea común y las manos (dos cartas cada uno para que la partida quepa).
    const seat = name => `<div class="tv-seat" data-seat="${esc(name)}"><b>${esc(name)}</b><span class="tv-minihand"><i></i><i></i></span><em></em></div>`;
    const pile = (key, label) => `<span class="tv-pile" data-pile="${key}"><span class="tv-stack"><i></i><i></i><i></i></span><small>${label}</small></span>`;

    // Los días del reto diario se alternan (CT.RetoDiario.familia, js/jugador/reto-diario.js).
    const today = CT.RetoDiario?.familia?.() || "collections";
    const familyName = key => key === "quick" ? "Retos rápidos" : "Grandes colecciones";
    const familyArt = key => key === "quick" ? "menu-quick.webp" : "menu-collections.webp";
    const day = (label, key) => `<span class="tv-day">${art(familyArt(key))}<b>${label}</b><small>${familyName(key)}</small></span>`;

    const blocks = Object.values(CT.BLOCKS || {}).map(block => `<span>${esc(block.name)}</span>`).join("");
    const todayDecks = ["cities-east-west", "sports-players", "foods-kcal", "buildings"].map(id => quickDecks().find(d => d.id === id)).filter(Boolean)
      .concat(quickDecks()).filter((d, i, list) => list.indexOf(d) === i).slice(0, 4);
    const deckTile = d => `<span class="tv-deck-tile">${(img => img ? `<img src="${esc(img)}" alt="" decoding="async" loading="lazy">` : "<i>◆</i>")(d.cards?.find(c => c.image)?.image)}<small>${esc(d.title)}</small></span>`;
    const Q = quick?.cards || [], R = rivers?.cards || [];

    return [
      // ── 1 · Lo básico ─────────────────────────────────────────────────────────────────
      // En la mano se ve el título; el dato y la lámina, no (js/juego/app.js, mano de la mesa).
      { chapter: 0, title: "La carta", duration: 7600,
        html: `<div class="tv-center"><div class="tv-pair">${pair}</div></div>`,
        steps: [
          [0, c => { c.say("Cada carta te dice qué es…"); c.stagger(".tv-kind", 300); }],
          [1000, c => c.add(".tv-kind .tv-card", "is-mark-title")],
          [2100, c => { c.remove(".tv-kind .tv-card", "is-mark-title"); c.add(".tv-kind .tv-card", "is-mark-secret"); c.say("…pero esconde un dato: una fecha o una cifra."); }],
          [5300, c => { c.remove(".tv-kind .tv-card", "is-mark-secret"); c.flip(".tv-kind .tv-card"); c.say("Lo descubres al colocarla."); }]
        ] },
      // Toda partida empieza con una carta descubierta; la línea va siempre de izquierda a
      // derecha, de menor a mayor (js/juego/engine.js).
      { chapter: 0, title: "La línea", duration: 8600,
        html: `<div class="tv-center">${lineMarkup([s[1], s[4], s[7], s[10]].map((c, i) => card(c, { extra: i === 1 ? "is-ref" : "" })), { gaps: false })}
          <div class="tv-axis"><span>${esc(less)}</span><i></i><span>${esc(more)}</span></div></div>`,
        steps: [
          [0, c => { c.say("La partida empieza con una carta ya descubierta."); c.add(".tv-line .is-ref", "is-in"); }],
          [3100, c => { c.say("Las que aciertas se ordenan con ella: de antes a después, o de menor a mayor."); c.stagger(".tv-line .tv-card:not(.is-ref)", 420); }],
          [4400, c => c.add(".tv-axis", "is-in")],
          [5600, c => c.stagger(".tv-line .tv-card", 260, "is-tick")]
        ] },
      // Arrastrar pide mantener pulsada la carta (js/interfaz/drag.js); el hueco elegido se
      // confirma con «Colocar carta →» (js/juego/app.js). Acierta si queda entre sus vecinas.
      { chapter: 0, title: "Colocar una carta", duration: 10200,
        html: `<div class="tv-table">${lineMarkup([card(s[2]), card(s[8])])}
          <div class="tv-hand-row"><div class="tv-hand">${card(s[5], { hidden: true })}</div>
          <span class="tv-confirm" aria-hidden="true"><b>Colocar carta →</b><small>Cambiar</small></span></div></div>`,
        steps: [
          [0, c => { c.add(".tv-hand .tv-card", "is-in"); c.say("Mantén pulsada tu carta y arrástrala al hueco donde crees que va."); }],
          [600, c => c.fingerTo(".tv-hand .tv-card")],
          [1100, c => { c.press(true); c.add(".tv-hand .tv-card", "is-held"); }],
          [1700, c => c.dragTo(".tv-hand .tv-card", '.tv-gap[data-gap="1"]')],
          [2800, c => { c.press(false); c.drop(".tv-hand .tv-card", '.tv-gap[data-gap="1"]'); }],
          [4000, c => { c.add(".tv-confirm", "is-in"); c.say("Después, confírmalo con «Colocar carta»."); }],
          [4800, c => c.fingerTo(".tv-confirm b")],
          [5400, c => c.tap()],
          [6600, c => { c.flip(".tv-line .is-placed", true); c.remove(".tv-confirm", "is-in"); c.fingerHide(); c.say("Si queda entre sus vecinas, acierto: la carta se queda."); }]
        ] },
      // Tocar la carta y luego el hueco vale en todas las mesas (jugando solo, la carta ya está
      // elegida). Al fallar, la línea marca «✦ Aquí»; lo que cuesta depende de la modalidad.
      { chapter: 0, title: "Si fallas", duration: 10500,
        html: `<div class="tv-table">${lineMarkup([card(s[2]), card(s[5]), card(s[8])])}
          <div class="tv-hand-row"><div class="tv-hand">${card(s[3], { hidden: true })}</div>
          <span class="tv-confirm" aria-hidden="true"><b>Colocar carta →</b><small>Cambiar</small></span></div></div>`,
        steps: [
          [0, c => { c.add(".tv-hand .tv-card", "is-in"); c.say("También puedes tocar tu carta y luego el hueco."); }],
          [400, c => c.fingerTo(".tv-hand .tv-card")],
          [900, c => { c.tap(); c.add(".tv-hand .tv-card", "is-selected"); }],
          [1500, c => c.fingerTo('.tv-gap[data-gap="3"]')],
          [2100, c => { c.tap(); c.drop(".tv-hand .tv-card", '.tv-gap[data-gap="3"]'); }],
          [2700, c => { c.add(".tv-confirm", "is-in"); c.fingerTo(".tv-confirm b"); }],
          [3300, c => c.tap()],
          [3700, c => { c.flip(".tv-line .is-placed", false); c.remove(".tv-confirm", "is-in"); c.fingerHide(); c.say("Si no encaja, es un fallo, y la línea marca dónde iba."); }],
          [4500, c => c.mark(1)],
          [7300, c => c.say("Lo que cuesta un fallo depende de cómo juegues.")]
        ] },
      // Los dos catálogos: Grandes colecciones (bloques de js/juego/modes.js, por fecha o por
      // cifra) y Retos rápidos (mazos/quick-challenges-data.js, cada uno con su regla).
      { chapter: 0, title: "Dos tipos de mazo", duration: 9900,
        html: `<div class="tv-families">
          <div class="tv-family" data-family="collections">${art("menu-collections.webp")}<div><b>Grandes colecciones</b><small>Mazos por temas · por fecha o por cifra</small><span class="tv-chips">${blocks}</span></div></div>
          <div class="tv-family" data-family="quick">${art("menu-quick.webp")}<div><b>Retos rápidos</b><small>Mazos cortos · cada uno con su regla</small>${quick ? `<span class="tv-rule">${esc(quick.deck.title)}</span>
            <span class="tv-tokens">${[Q[1], Q[4], Q[7]].map(c => `<span><b>${esc(c.title)}</b>${esc(c.label)}</span>`).join('<i aria-hidden="true">→</i>')}</span>` : ""}</div></div></div>`,
        steps: [
          [0, c => { c.add('[data-family="collections"]', "is-in"); c.say("Hay dos tipos de mazo. Grandes colecciones: mazos por temas, de fechas o de cifras."); }],
          [600, c => c.stagger('[data-family="collections"] .tv-chips span', 150)],
          [5400, c => { c.add('[data-family="quick"]', "is-in"); c.say("Retos rápidos: mazos cortos, y cada uno trae su propia regla de orden."); }],
          [6100, c => c.stagger(".tv-tokens > *", 250)]
        ] },

      // ── 2 · Jugar solo ────────────────────────────────────────────────────────────────
      // Ronda: 10 cartas y 3 vidas; con 0 vidas, «Se acabaron las vidas»; al final, una estrella
      // por vida (js/juego/app.js, SOLO_ROUND_CARDS y SOLO_LIVES).
      { chapter: 1, title: "Una ronda", duration: 11800,
        html: `<div class="tv-board">${path(["Jugar solo", "Grandes colecciones", "un mazo"])}
          <div class="tv-round" data-round="main"><div class="tv-round-head"><b>Ronda · 10 cartas</b><span class="tv-stars">★★<i>★</i></span></div>
            <div class="tv-round-row">${hearts()}${dots("✓✓✓✗✓✓✓✓✓✓")}</div></div>
          <div class="tv-round tv-round-out" data-round="out"><div class="tv-round-row">${hearts(3)}${dots("✓✗✓✗✗·····")}</div><small>Se acabaron las vidas</small></div></div>`,
        steps: [
          [0, c => { c.say("Jugando solo con Grandes colecciones, una ronda son 10 cartas y 3 vidas."); c.add('[data-round="main"] .tv-lives', "is-in"); }],
          [500, c => c.stagger('[data-round="main"] .tv-dots span', 330)],
          [1550, c => c.lose('[data-round="main"] .tv-lives')],
          [4800, c => { c.say("Cada fallo cuesta una vida, y sin vidas se acaba."); c.add('[data-round="out"]', "is-in"); c.stagger('[data-round="out"] .tv-dots span', 260); }],
          [8000, c => { c.say("Si llegas al final, cada vida que te queda es una estrella."); c.add(".tv-stars", "is-in"); c.pulse('[data-round="main"] .tv-lives'); }]
        ] },
      // Maratón: en la pantalla del mazo, el mazo entero hasta acabarlo o perder las 3 vidas.
      // Competición: el último panel de Grandes colecciones; 10 cartas y 3 vidas por tema.
      { chapter: 1, title: "Maratón y competición", duration: 8800,
        html: `<div class="tv-board"><div class="tv-modes">
          <div class="tv-mode" data-mode="marathon"><b>Maratón</b><small>En la pantalla del mazo</small>${hearts(0, "is-in")}${dots("✓✓✓✓✗✓✓✓✓✓✓✗", "tv-dots-run")}<span class="tv-more">… hasta el final del mazo</span></div>
          <div class="tv-mode" data-mode="competition"><b>Competición</b><small>Al final de Grandes colecciones</small>
            <span class="tv-topics">${["Tema 1", "Tema 2", "Tema 3"].map(t => `<span><em>${t}</em>${hearts(0, "is-in")}<i>10 cartas</i></span>`).join("")}</span></div></div></div>`,
        steps: [
          [0, c => { c.add('[data-mode="marathon"]', "is-in"); c.say("Maratón: todo el mazo, hasta acabarlo o perder las 3 vidas."); }],
          [400, c => c.stagger('[data-mode="marathon"] .tv-dots span', 210)],
          [4000, c => { c.add('[data-mode="competition"]', "is-in"); c.say("Competición: varios temas al azar, con 10 cartas y 3 vidas en cada uno."); }],
          [4500, c => c.stagger(".tv-topics > span", 350)]
        ] },
      // La dificultad solo existe jugando solo en Grandes colecciones (js/juego/ghost.js).
      { chapter: 1, title: "Dificultad", duration: 12900,
        html: `<div class="tv-board">${levelsTable()}<div class="tv-diff-demo">
          <span class="tv-clock" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="tv-clock-arc" cx="18" cy="18" r="15"/></svg><b>No</b></span>
          ${lineMarkup([card(s[1], { extra: "tv-sm" }), card(s[4], { extra: "tv-sm tv-extra" }), card(s[6], { extra: "tv-sm" }), card(s[9], { extra: "tv-sm" })], { gaps: false })}</div></div>`,
        steps: [
          [0, c => { c.say("Antes de empezar eliges dificultad. En Fácil, sin reloj."); c.stagger(".tv-level-row", 240); }],
          [800, c => c.focus(".tv-levels", 0)],
          [3700, c => { c.focus(".tv-levels", 1); c.clock(`${LEVELS()[1]?.seconds || 30} s`); c.say("Desde Normal hay reloj por carta, y cada acierto añade cartas a la línea."); }],
          [5600, c => c.add(".tv-extra", "is-in")],
          [8600, c => { c.focus(".tv-levels", 2); c.clock(`${LEVELS()[2]?.seconds || 20} s`); c.say("En Difícil a veces, y en Experto siempre, la línea oculta sus datos."); c.add(".tv-diff-demo .tv-card", "is-ghost"); }],
          [9700, c => c.remove(".tv-diff-demo .tv-card", "is-ghost")],
          [10600, c => { c.focus(".tv-levels", 3); c.clock(`${LEVELS()[3]?.seconds || 15} s`); c.add(".tv-diff-demo .tv-card", "is-ghost"); }]
        ] },
      // Retos rápidos en solitario: 4 mazos al día, iguales para todos; las 10 cartas a la vista
      // y sin vidas (js/retos/quick-challenges.js y quick-challenges-engine.js).
      { chapter: 1, title: "Retos rápidos", duration: 11600,
        html: `<div class="tv-board">${path(["Jugar solo", "Retos rápidos"])}<div class="tv-phases">
          <div class="tv-phase is-on" data-phase="1"><span class="tv-tag">Mazos de hoy</span><div class="tv-deck-tiles">${todayDecks.map(deckTile).join("")}</div></div>
          <div class="tv-phase tv-quick" data-phase="2">${quick ? `<span class="tv-rule">${esc(quick.deck.rule)}</span>
            ${lineMarkup([qcard(Q[1], { extra: "tv-sm" }), qcard(Q[3], { hidden: true, extra: "tv-sm tv-extra" })], { gaps: false })}
            <span class="tv-tag">Tus cartas</span><div class="tv-pool">${[Q[3], Q[0], Q[5], Q[7]].map(c => qcard(c, { hidden: true, extra: "tv-sm" })).join("")}<span class="tv-more">+6</span></div>` : ""}
            <div class="tv-round-row">${without("♥", "Sin vidas")}${dots("✓✓✗✓✓✓✗✓✓✓")}</div></div></div></div>`,
        steps: [
          [0, c => { c.say("En Retos rápidos tienes 4 mazos al día, los mismos para todos."); c.stagger(".tv-deck-tile", 260); }],
          [2400, c => c.fingerTo(".tv-deck-tile")],
          [2900, c => { c.tap(); c.add(".tv-deck-tile:first-child", "is-picked"); }],
          [4000, c => { c.fingerHide(); c.phase(2); c.say("Ves tus 10 cartas a la vez y eliges cuál colocar."); }],
          [4900, c => c.fingerTo(".tv-pool .tv-card")],
          [5400, c => { c.tap(); c.add(".tv-pool .tv-card:first-child", "is-out"); c.add(".tv-quick .tv-extra", "is-in"); }],
          [6000, c => { c.fingerHide(); c.flip(".tv-quick .tv-extra", true); }],
          [7600, c => { c.say("No hay vidas: un fallo no suma, pero sigues hasta el final."); c.stagger(".tv-quick .tv-dots span", 220); c.add(".tv-quick .tv-without", "is-in"); }]
        ] },

      // ── 3 · Reto diario ───────────────────────────────────────────────────────────────
      // Un intento al día, las mismas 10 cartas para todos; un día Grandes colecciones (en
      // Fácil) y al siguiente Retos rápidos; sin vidas ni reloj; ranking solo si se acepta
      // (js/jugador/reto-diario.js, js/juego/app.js y js/nube/accounts.js).
      { chapter: 2, title: "Reto diario", duration: 13200,
        html: `<div class="tv-board">${path(["Inicio", "Reto diario"])}${dots("✓✓✗✓✓✓✗✓✓✗")}<div class="tv-score">7 de 10</div>
          <div class="tv-days">${day("Hoy", today)}<i aria-hidden="true">→</i>${day("Mañana", today === "quick" ? "collections" : "quick")}</div>
          <div class="tv-facts">${without("♥", "Sin vidas")}${without("⏱", "Sin reloj")}<span>Ranking, si quieres</span></div></div>`,
        steps: [
          [0, c => { c.say("El reto diario: 10 cartas, las mismas para todos, y un solo intento."); c.stagger(".tv-dots span", 260); }],
          [3000, c => c.add(".tv-score", "is-in")],
          [4500, c => { c.say("Un día es de Grandes colecciones y al siguiente, de Retos rápidos."); c.stagger(".tv-day, .tv-days > i", 350); }],
          [8600, c => { c.say("Sin vidas ni reloj: un fallo no suma. Y si quieres, sales en el ranking."); c.stagger(".tv-facts > *", 400); }]
        ] },

      // ── 4 · En grupo ──────────────────────────────────────────────────────────────────
      // Un solo móvil, sin conexión; cada uno en el suyo, en directo (internet o la misma Wi-Fi)
      // o por turnos. Grandes colecciones de 2 a 10, Retos rápidos de 2 a 4
      // (js/juego/app.js y js/retos/quick-challenges.js).
      { chapter: 3, title: "Con amigos", duration: 13600,
        html: `<div class="tv-board">${path(["Jugar", "Jugar con amigos"])}<div class="tv-ways">
          <div class="tv-way tv-way-one"><b>Un solo móvil</b><span class="tv-pass"><span class="tv-people"><b>Ana</b><b>Luis</b><b>Sara</b></span></span><small>Os lo pasáis · sin conexión</small></div>
          <div class="tv-way tv-way-many"><b>Cada uno en su móvil</b><span class="tv-rhythms"><span><b>En directo</b>A la vez · internet o la misma Wi-Fi</span><span><b>Por turnos</b>Cada uno cuando pueda</span></span></div></div>
          <div class="tv-join"><b>Unirme a una partida</b><small>código · enlace · QR</small></div>
          <p class="tv-note">Grandes colecciones: de 2 a 10 · Retos rápidos: de 2 a 4</p></div>`,
        steps: [
          [0, c => { c.say("Con amigos, podéis pasaros un solo móvil o jugar cada uno en el suyo."); c.add(".tv-way-one", "is-in"); }],
          [500, c => c.cycle(".tv-people b", 700, 3)],
          [2100, c => { c.add(".tv-way-many", "is-in"); c.add(".tv-note", "is-in"); }],
          [4500, c => { c.say("Cada uno en el suyo: en directo, a la vez, o por turnos, cuando podáis."); c.stagger(".tv-rhythms > span", 1500, "is-on"); }],
          [9200, c => { c.say("Quien crea la partida os invita, y entráis con «Unirme a una partida»."); c.add(".tv-join", "is-in"); }]
        ] },
      // El minijuego de salida (js/juego/final.js): cifra secreta de la misma carta; en un duelo
      // por turnos no se juega y empieza quien lo crea.
      { chapter: 3, title: "Quién empieza", duration: 9800,
        html: `<div class="tv-center tv-starter">${card(s[5], { hidden: true, extra: "tv-big tv-guess-card" })}
          <div class="tv-guesses">${guesses.map((g, i) => `<span data-guess="${i}" data-rank="${ranks[i] + 1}.º"><b>${esc(g.name)}</b><em>${esc(g.value)}</em></span>`).join("")}</div>
          <p class="tv-note">En un duelo por turnos empieza quien lo crea.</p></div>`,
        steps: [
          [0, c => { c.say("Para ver quién empieza, cada uno escribe en secreto el dato de una carta."); c.add(".tv-guess-card", "is-in"); }],
          [800, c => c.stagger(".tv-guesses span", 420)],
          [4200, c => { c.flip(".tv-guess-card"); c.add(".tv-guesses", "is-shown"); }],
          [4900, c => { c.say(`Empieza quien más se acerca (aquí, ${first}), y los demás le siguen por cercanía.`); c.rank(".tv-guesses span"); }],
          [8600, c => c.add(".tv-note", "is-in")]
        ] },
      // Grandes colecciones en grupo: cada uno su mano y una línea común; acierto, una carta menos;
      // fallo, al descarte y se roba; la victoria se mira al cerrar la vuelta; si acaban varios,
      // final de desempate (js/juego/app.js, js/juego/engine.js y js/juego/final.js).
      { chapter: 3, title: "Grandes colecciones en grupo", duration: 18200,
        html: `<div class="tv-board tv-group"><div class="tv-gline-wrap"><span class="tv-tag">Línea común</span><span class="tv-vuelta">Vuelta <b>1</b></span>
          <div class="tv-gline">${[s[1], s[3], s[5], s[7], s[9]].map((c, i) => miniMarkup(modeKey, c, i === 1 ? "" : "is-pending")).join("")}</div></div>
          <div class="tv-seats">${seatOrder.map(seat).join("")}</div><div class="tv-piles">${pile("deck", "Mazo")}${pile("discard", "Descarte")}</div></div>`,
        steps: [
          [0, c => { c.say("Con Grandes colecciones, cada uno tiene su mano y colocáis por turnos en la misma línea."); c.stagger(".tv-seat", 250); c.add(".tv-piles", "is-in"); }],
          [1100, c => c.turn(0)],
          [1800, c => c.play(0, ".tv-gline > :nth-child(3)")],
          [3100, c => c.turn(1)],
          [3800, c => c.play(1, ".tv-gline > :nth-child(1)")],
          [5600, c => { c.say("Si aciertas, tienes una carta menos; si fallas, va al descarte y robas otra."); c.turn(2); }],
          [6300, c => c.miss(2)],
          [7300, c => c.draw(2)],
          [8600, c => { c.text(".tv-vuelta b", "2"); c.turn(0); }],
          [9300, c => c.play(0, ".tv-gline > :nth-child(4)")],
          [10500, c => { c.say("Al cerrar la vuelta, gana quien se ha quedado sin cartas."); c.turn(1); }],
          [11100, c => c.miss(1)],
          [11900, c => c.draw(1)],
          [12700, c => c.turn(2)],
          [13300, c => c.play(2, ".tv-gline > :nth-child(5)")],
          [14300, c => { c.turn(-1); c.win(0); c.say("Si son varios, desempatan como al empezar, con otra carta."); }]
        ] },
      // Retos rápidos en grupo: cartas comunes; «Arriesgar o plantarse» (aciertos provisionales,
      // un fallo los pierde y deja fuera hasta el siguiente mazo) o «Seguir hasta el final»; gana
      // quien más aciertos suma (js/retos/quick-challenges-engine.js).
      { chapter: 3, title: "Retos rápidos en grupo", duration: 18600,
        html: `<div class="tv-board tv-group tv-quick-group"><div class="tv-switch"><span class="is-on">Arriesgar o plantarse</span><span>Seguir hasta el final</span></div>
          ${rivers ? `<span class="tv-rule">${esc(rivers.deck.rule)}</span>${lineMarkup([R[0], R[1], R[3], R[4], R[6], R[7]].map(c => c === R[3] ? qcard(c, { extra: "tv-sm" }) : qcard(c, { hidden: true, extra: "tv-sm tv-extra" })), { gaps: false })}
          <span class="tv-tag">Cartas comunes</span><div class="tv-pool">${[R[6], R[1], R[4], R[7], R[0]].map(c => qcard(c, { hidden: true, extra: "tv-sm" })).join("")}<span class="tv-more">+4</span></div>` : ""}
          <div class="tv-scores">${["Ana", "Luis", "Sara"].map(name => `<span data-player="${name}"><b>${name}</b><em>0</em></span>`).join("")}</div></div>`,
        steps: [
          [0, c => { c.say("Con Retos rápidos, las cartas son comunes: en tu turno eliges una."); c.stagger(".tv-scores span", 200); }],
          [900, c => c.qplay("Ana", 1, 4, "+1")],
          [2600, c => c.qplay("Luis", 1, 1, "+1")],
          [4300, c => c.say("Con «Arriesgar o plantarse», tus aciertos son provisionales hasta que te plantas.")],
          [4700, c => c.qplay("Sara", 1, 3, "+1")],
          [6400, c => c.qplay("Ana", 1, 5, "+2")],
          [7800, c => c.bank("Ana", "2")],
          [9600, c => { c.say("Si fallas antes, los pierdes y quedas fuera hasta el siguiente mazo."); c.qplay("Luis", 1, 0, "0", false); }],
          [14000, c => { c.say("Con «Seguir hasta el final», fallar solo no suma. Gana quien más acierte."); c.remove(".tv-switch span", "is-on"); c.add(".tv-switch span:last-child", "is-on"); }]
        ] },
      // Los poderes (js/juego/ghost.js y engine.js): opcionales, de un solo uso, solo con Grandes
      // colecciones en un solo móvil o en directo, y nunca en la competición.
      { chapter: 3, title: "Poderes", duration: 14200,
        html: `<div class="tv-board"><p class="tv-note is-in">Opcionales · Grandes colecciones en un móvil o en directo, salvo en la competición</p><div class="tv-powers">
          <div class="tv-power" data-power="ghost"><b><i aria-hidden="true">◌</i> Fantasma</b>${lineMarkup([card(s[2], { extra: "tv-sm" }), card(s[6], { extra: "tv-sm" })], { gaps: false })}<small>Una vuelta, para todos</small></div>
          <div class="tv-power" data-power="pulse"><b><i aria-hidden="true">ϟ</i> Pulso</b><span class="tv-duel"><span data-duel="you"><em>Tú</em><span class="tv-minihand"><i></i><i></i><i></i></span><u></u></span><span data-duel="rival"><em>Luis</em><span class="tv-minihand"><i></i><i></i></span><u></u></span></span><small>La misma carta, a ciegas</small></div></div></div>`,
        steps: [
          [0, c => { c.say("Si activáis los poderes, algunas cartas traen uno, de un solo uso."); c.stagger(".tv-power", 400); }],
          [4300, c => { c.add('[data-power="ghost"]', "is-on"); c.say("Fantasma: durante una vuelta, la línea oculta sus datos y láminas."); }],
          [5000, c => c.add('[data-power="ghost"] .tv-card', "is-ghost-full")],
          [8700, c => { c.remove('[data-power="ghost"]', "is-on"); c.add('[data-power="pulse"]', "is-on"); c.say("Pulso: retas a alguien con la misma carta. Si solo aciertas tú, le das una tuya."); }],
          [10000, c => { c.text('[data-duel="you"] u', "✓"); c.text('[data-duel="rival"] u', "✗"); c.add('[data-duel="you"]', "is-ok"); c.add('[data-duel="rival"]', "is-bad"); }],
          [11100, c => c.give('[data-duel="you"] .tv-minihand', '[data-duel="rival"] .tv-minihand')]
        ] },
      // Mesas públicas: con desconocidos, de 2 a 4, sin poderes; empieza al llenarse o a los
      // 30 s sin que entre nadie (js/online/online.js y js/interfaz/home-modes-v1.js).
      { chapter: 3, title: "Jugar online", duration: 11400,
        html: `<div class="tv-board">${path(["Jugar", "Jugar online"])}
          <div class="tv-mesa"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tv-mesa-table" cx="60" cy="60" r="30"/><circle class="tv-mesa-ring" cx="60" cy="60" r="38"/>
            ${[[60, 12, "A", 1], [108, 60, "B", 1], [60, 108, "C", 0], [12, 60, "D", 0]].map(([x, y, letter, taken]) => `<g class="tv-chair${taken ? " is-taken" : ""}" data-chair="${letter}"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 3.6}">${letter}</text></g>`).join("")}</svg>
            <b class="tv-mesa-go">¡Empieza!</b></div>
          <div class="tv-options"><span>Crear mesa</span><span>Mesas abiertas</span><span>Partida rápida</span></div>
          <p class="tv-note">Grandes colecciones o Retos rápidos · sin poderes</p></div>`,
        steps: [
          [0, c => { c.say("En «Jugar online» te sientas con desconocidos, de 2 a 4."); c.add(".tv-mesa", "is-in"); }],
          [1400, c => { c.stagger(".tv-options span", 300); c.add(".tv-note", "is-in"); }],
          [3700, c => c.say("Crea una mesa, elige una abierta o pide una partida rápida.")],
          [7600, c => { c.say("Empieza al llenarse o a los 30 s sin que entre nadie más."); c.add(".tv-mesa-ring", "is-run"); }],
          [8500, c => { c.add('[data-chair="C"]', "is-taken"); c.restart(".tv-mesa-ring", "is-run"); }],
          [10600, c => c.add(".tv-mesa", "is-go")]
        ] },
      { chapter: 3, title: "A jugar", duration: 4800, last: true,
        html: `<div class="tv-center tv-end"><div class="tv-logo">A jugar</div><p>Para empezar: «Jugar solo», «Grandes colecciones», un mazo y una ronda en Fácil.</p><div class="tv-end-actions"><button type="button" class="tv-end-btn is-main" data-tv="replay">Ver otra vez</button>${portada ? "" : '<button type="button" class="tv-end-btn" data-tv="manual">Ver la Guía completa</button>'}</div></div>`,
        steps: [
          [0, c => { c.say(portada ? "Pulsa «Jugar» para empezar." : "Debajo tienes la Guía completa, por temas."); c.add(".tv-end", "is-in"); }]
        ] }
    ];
  }

  const CHAPTERS = ["Lo básico", "Jugar solo", "Reto diario", "En grupo"];

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

    const $ = sel => typeof sel === "string" ? stage.querySelector(sel) : sel;
    const $$ = sel => [...stage.querySelectorAll(sel)];
    let instant = false;
    const later = (fn, ms) => { if (instant) { fn(); return; } const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };
    const rect = el => el.getBoundingClientRect();
    const centerOf = el => {
      const box = rect(root.querySelector(".tv-screen")), r = rect(el);
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    };
    // Mueve elementos de sitio en el DOM y los lleva de donde estaban a donde quedan, sin saltos.
    function flipLayout(els, mutate) {
      const first = new Map(els.filter(Boolean).map(el => [el, rect(el)]));
      mutate();
      if (instant) return;
      first.forEach((before, el) => {
        if (!el.isConnected) return;
        const after = rect(el), dx = before.left - after.left, dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate?.([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(.2,.7,.2,1)" });
      });
    }
    // Una carta que vuela de un sitio a otro de la mesa (de la mano a la línea, al descarte…).
    function fly(from, to, cls = "") {
      from = $(from); to = $(to);
      if (!from || !to || instant) return;
      const box = rect(stage), a = rect(from), b = rect(to);
      const el = document.createElement("span");
      el.className = `tv-flyer${cls ? " " + cls : ""}`;
      el.style.left = `${a.left - box.left + a.width / 2}px`;
      el.style.top = `${a.top - box.top + a.height / 2}px`;
      stage.append(el);
      void el.offsetWidth;
      el.style.transform = `translate(-50%, -50%) translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px)`;
      later(() => el.remove(), 720);
    }
    const seat = i => $$(".tv-seat")[i];
    const handCards = row => [...(row?.querySelectorAll(".tv-minihand i:not(.is-out)") || [])];
    const ctx = {
      // Cada frase entra de nuevo (la clase se quita y se vuelve a poner para repetir la animación).
      say(text) { caption.textContent = text; caption.classList.remove("is-say"); void caption.offsetWidth; caption.classList.add("is-say"); },
      add(sel, cls) { $$(sel).forEach(el => el.classList.add(cls)); },
      remove(sel, cls) { $$(sel).forEach(el => el.classList.remove(cls)); },
      restart(sel, cls) { $$(sel).forEach(el => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); }); },
      text(sel, value) { $$(sel).forEach(el => { el.textContent = value; }); },
      stagger(sel, gap, cls = "is-in") { $$(sel).forEach((el, i) => later(() => el.classList.add(cls), i * gap)); },
      cycle(sel, gap, rounds) { const els = $$(sel); for (let i = 0; i < els.length * rounds; i++) later(() => els.forEach((el, k) => el.classList.toggle("is-on", k === i % els.length)), i * gap); },
      pulse(sel) { $$(sel).forEach(el => { el.classList.remove("is-pulse"); void el.offsetWidth; el.classList.add("is-pulse"); }); },
      // Cambia de fase dentro de una escena (dos estados de la misma pantalla).
      phase(n) { $$(".tv-phase").forEach(el => el.classList.toggle("is-on", el.dataset.phase === String(n))); },
      // Resalta una columna de la tabla de niveles.
      focus(sel, column) { $$(`${sel} [data-level]`).forEach(el => el.classList.toggle("is-on", el.dataset.level === String(column))); },
      // El reloj de la dificultad: rótulo nuevo y cuenta atrás desde el principio.
      clock(label) { const el = $(".tv-clock"); if (!el) return; el.querySelector("b").textContent = label; ctx.restart(".tv-clock", "is-run"); },
      // Una vida menos: se apaga el último corazón que quede.
      lose(sel) { $$(`${sel} i:not(.is-lost)`).pop()?.classList.add("is-lost"); },
      // La carta se da la vuelta y enseña su dato; con `ok`, en verde o en rojo.
      flip(sel, ok) {
        (typeof sel === "string" ? $$(sel) : [sel]).forEach(el => {
          el.classList.add("is-flipping");
          later(() => { el.classList.remove("is-hidden"); if (ok === true) el.classList.add("is-ok"); if (ok === false) el.classList.add("is-bad"); }, 220);
          later(() => el.classList.remove("is-flipping"), 480);
        });
      },
      // La mesa en grupo: de quién es el turno, acertar (la carta va a la línea común), fallar
      // (al descarte), robar y ganar.
      turn(i) { $$(".tv-seat").forEach((el, k) => { el.classList.toggle("is-turn", k === i); }); },
      mark(gapIndex) { $(`.tv-gap[data-gap="${gapIndex}"]`)?.classList.add("is-here"); },
      play(i, slotSel) {
        const row = seat(i), cardEl = handCards(row)[0], slot = $(slotSel); if (!row || !cardEl || !slot) return;
        fly(cardEl, slot, "is-ok");
        cardEl.classList.add("is-out");
        later(() => { slot.classList.remove("is-pending"); slot.classList.add("is-new"); }, 420);
        const left = handCards(row).length;
        const em = row.querySelector("em"); em.textContent = left ? "✓" : "✓ Sin cartas"; em.dataset.mark = "ok";
      },
      miss(i) {
        const row = seat(i), cardEl = handCards(row)[0]; if (!row || !cardEl) return;
        fly(cardEl, '[data-pile="discard"] .tv-stack', "is-bad");
        cardEl.classList.add("is-out");
        const em = row.querySelector("em"); em.textContent = "✗"; em.dataset.mark = "bad";
        later(() => ctx.pulse('[data-pile="discard"]'), 600);
      },
      draw(i) {
        const row = seat(i); if (!row) return;
        fly('[data-pile="deck"] .tv-stack', row.querySelector(".tv-minihand"), "is-back");
        ctx.pulse('[data-pile="deck"]');
        later(() => row.querySelector(".tv-minihand")?.insertAdjacentHTML("beforeend", '<i class="is-new"></i>'), 560);
      },
      win(i) { const row = seat(i); if (!row) return; row.classList.add("is-winner"); const em = row.querySelector("em"); em.textContent = "Gana"; em.dataset.mark = "win"; },
      // Retos rápidos en grupo: quien juega elige una carta común (`pick`), que entra en la
      // línea (`slot`, la n-ésima carta pendiente) bien o mal; su marcador cambia a `score`.
      qplay(name, pick, slot, score, ok = true) {
        const who = $(`[data-player="${name}"]`), pool = $$(".tv-pool .tv-card:not(.is-out)"), target = $$(".tv-quick-group .tv-line .tv-card")[slot];
        $$(".tv-scores span").forEach(el => el.classList.toggle("is-turn", el === who));
        const chosen = pool[Math.min(pick, pool.length) - 1]; if (!who || !chosen || !target) return;
        fly(chosen, target, ok ? "is-ok is-quick" : "is-bad is-quick");
        chosen.classList.add("is-out");
        later(() => { target.classList.add("is-in"); ctx.flip(target, ok); }, 380);
        later(() => {
          const em = who.querySelector("em"); em.textContent = score;
          who.classList.toggle("is-open", ok); if (!ok) who.classList.add("is-out");
          ctx.pulse(`[data-player="${name}"]`);
        }, 700);
      },
      bank(name, score) { const who = $(`[data-player="${name}"]`); if (!who) return; who.classList.remove("is-open"); who.classList.add("is-banked"); who.querySelector("em").textContent = score; ctx.pulse(`[data-player="${name}"]`); },
      // El Pulso: una carta de la mano de quien reta pasa a la del rival.
      give(fromSel, toSel) {
        const from = $(fromSel), to = $(toSel), cardEl = from && handCards(from.parentElement)[0]; if (!from || !to || !cardEl) return;
        fly(cardEl, to, "is-back");
        cardEl.classList.add("is-out");
        later(() => to.insertAdjacentHTML("beforeend", '<i class="is-new"></i>'), 560);
      },
      // Quién empieza: cada respuesta recibe su puesto y se ordenan por cercanía.
      rank(sel) {
        const els = $$(sel), parent = els[0]?.parentElement; if (!parent) return;
        flipLayout(els, () => els.slice().sort((a, b) => parseInt(a.dataset.rank, 10) - parseInt(b.dataset.rank, 10)).forEach(el => { parent.append(el); el.classList.add("is-ranked"); }));
      },
      // El dedo aparece ya sobre su primer destino; después se desplaza de uno a otro.
      fingerTo(sel) {
        const el = $(sel); if (!el) return; const [x, y] = centerOf(el);
        if (!finger.classList.contains("is-in")) { finger.style.transition = "none"; finger.style.transform = `translate(${x}px, ${y}px)`; void finger.offsetWidth; finger.style.transition = ""; }
        finger.style.transform = `translate(${x}px, ${y}px)`; finger.classList.add("is-in");
      },
      fingerHide() { finger.classList.remove("is-in", "is-press"); },
      press(on) { finger.classList.toggle("is-press", on); },
      tap() { finger.classList.remove("is-tap"); void finger.offsetWidth; finger.classList.add("is-tap"); },
      dragTo(cardSel, gapSel) {
        const cardEl = $(cardSel), gap = $(gapSel); if (!cardEl || !gap) return;
        const [cx, cy] = centerOf(cardEl), [gx, gy] = centerOf(gap);
        cardEl.style.transform = `translate(${gx - cx}px, ${gy - cy}px) scale(.9)`;
        cardEl.classList.add("is-lifted");
        ctx.fingerTo(gap);
      },
      // La carta de la mano entra en la línea por el hueco indicado, todavía oculta; las vecinas
      // se apartan para hacerle sitio.
      drop(cardSel, gapSel) {
        const cardEl = $(cardSel), gap = $(gapSel), line = $(".tv-line"); if (!cardEl || !gap || !line) return;
        let prev = gap.previousElementSibling;
        while (prev && !prev.classList.contains("tv-card")) prev = prev.previousElementSibling;
        flipLayout([cardEl, ...line.querySelectorAll(".tv-card")], () => {
          cardEl.style.transition = "none"; cardEl.style.transform = "";
          cardEl.remove();
          if (prev) prev.after(cardEl); else line.prepend(cardEl);
          cardEl.classList.remove("is-lifted", "is-held", "is-selected");
          cardEl.classList.add("is-placed");
          $(".tv-hand")?.classList.add("is-empty");
          ctx.renumber();
          void cardEl.offsetWidth; cardEl.style.transition = "";
        });
      },
      renumber() {
        const line = $(".tv-line"); if (!line) return;
        line.querySelectorAll(".tv-gap").forEach(gap => gap.remove());
        const cards = [...line.querySelectorAll(".tv-card")];
        cards.forEach((cardEl, i) => cardEl.insertAdjacentHTML("beforebegin", gapHtml(i)));
        line.insertAdjacentHTML("beforeend", gapHtml(cards.length));
      }
    };

    function build(target = 0) {
      timeouts.forEach(clearTimeout); timeouts.clear();
      const scene = list[index];
      // La escena anterior se disuelve mientras entra la nueva, como un fundido de vídeo.
      if (fade && stage.childElementCount && !instant) {
        fade.innerHTML = stage.innerHTML;
        fade.querySelectorAll(".tv-flyer").forEach(el => el.remove());
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

  // `scenes` queda a la vista para las pruebas (velocidad de lectura y duración total).
  CT.Tutorial = { markup, mount, mountAll, scenes };
})();
