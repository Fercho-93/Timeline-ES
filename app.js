(function () {
  "use strict";

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const MODE_STORAGE_KEY = "hilo-selected-mode-v1";
  const LEGACY_STORAGE_KEY = "hilo-espana-game-v1";
  // Las modalidades, sus ejes y los ayudantes que comparte con el modo de varios
  // móviles están en modes.js, para declararlos una sola vez.
  const CT = window.CONTINUUM;
  const { escapeHtml, initials, shuffle } = CT;
  let selectedModeKey = localStorage.getItem(MODE_STORAGE_KEY) || CT.DEFAULT_MODE;
  if (!CT.has(selectedModeKey)) selectedModeKey = CT.DEFAULT_MODE;
  // El bloque en pantalla se deduce siempre del juego elegido, así que no se guarda aparte.
  let selectedBlockKey = CT.blockOf(selectedModeKey).key;
  let cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
  let screen = "home";
  let game = loadGame();
  let selectedCardId = null;
  let result = null;
  let pendingIndex = null;

  function currentAxis() { return CT.axis(selectedModeKey); }

  function formatValue(card) { return CT.formatValue(selectedModeKey, card); }

  function sortValue(card) { return CT.sortValue(selectedModeKey, card); }

  function currentMode() { return CT.mode(selectedModeKey); }

  function storageKey() { return `hilo-game-${selectedModeKey}-v1`; }

  function setMode(modeKey) {
    if (!CT.has(modeKey)) return;
    selectedModeKey = modeKey;
    selectedBlockKey = CT.blockOf(modeKey).key;
    localStorage.setItem(MODE_STORAGE_KEY, modeKey);
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    game = loadGame();
    selectedCardId = null;
    pendingIndex = null;
    result = null;
  }

  function eraForCard(card) { return CT.eraForCard(selectedModeKey, card); }

  function saveGame() {
    if (game) localStorage.setItem(storageKey(), JSON.stringify(game));
    else localStorage.removeItem(storageKey());
  }

  function loadGame() {
    try {
      let raw = localStorage.getItem(storageKey());
      if (!raw && selectedModeKey === "history") {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          localStorage.setItem(storageKey(), raw);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
      const stored = JSON.parse(raw);
      if (!stored || !stored.players || !stored.timeline) return null;
      stored.mode = stored.mode || selectedModeKey;
      if (!stored.winners && stored.winner != null) stored.winners = [stored.winner];
      return stored;
    } catch { return null; }
  }

  function header(extra = "") {
    return `<header class="topbar"><div class="brand">Continuum</div>${extra}</header>`;
  }

  // La carátula de cada bloque. Van a la caché de la aplicación, así que están
  // reducidas a 900 px de ancho: es el doble de lo que ocupa el panel más grande.
  const BLOCK_ART = {
    history: '<img src="assets/hero-history.jpg" alt="">',
    cinema: '<img src="assets/hero-cinema.jpg" alt="">',
    globe: '<img src="assets/hero-geography.jpg" alt="">'
  };

  // La galería en acordeón es el selector de bloque: la carátula elegida se despliega
  // en color y las otras quedan como lomos que se pueden tocar.
  function gallery() {
    return `<div class="gallery" role="group" aria-label="Elige el bloque">${Object.values(CT.BLOCKS).map(item => {
      const active = item.key === selectedBlockKey;
      const total = item.games.length;
      return `<button class="gallery-panel panel-${item.art}${active ? " active" : ""}" data-action="set-block" data-block="${item.key}" aria-pressed="${active}" aria-label="${item.name}, ${total} ${total === 1 ? "juego" : "juegos"}">
        <span class="panel-art" aria-hidden="true">${BLOCK_ART[item.art]}</span>
        <span class="panel-spine" aria-hidden="true"><i>${item.icon}</i><b>${item.name}</b></span>
        <span class="panel-label" aria-hidden="true"><i></i><strong>${item.name}</strong><small>${item.tagline}</small></span>
      </button>`;
    }).join("")}</div>`;
  }

  // Los juegos del bloque en pantalla. Hoy hay uno por bloque; la lista está pensada
  // para cuando haya varios.
  function gameList() {
    const games = CT.blockGames(selectedBlockKey);
    return `<div class="games" role="group" aria-label="Elige el juego">${games.map(item => {
      const active = item.key === selectedModeKey;
      return `<button class="game-row${active ? " active" : ""}" data-action="set-mode" data-mode="${item.key}" aria-pressed="${active}">
        <span class="game-name">${item.name}</span>
        <span class="game-meta">${item.cards.length} ${item.cardLabel} · ${item.blurb}</span>
      </button>`;
    }).join("")}</div>`;
  }

  function home() {
    screen = "home";
    const resume = game && game.mode === selectedModeKey;
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="rules">Cómo jugar</button>')}
      <section class="hero">
        ${gallery()}
        <div class="hero-copy">
          <h1>${CT.question(selectedModeKey)}</h1>
          ${gameList()}
          <div class="actions">
            <button class="btn btn-primary" data-action="setup">Un solo móvil <span>→</span></button>
            <button class="btn btn-secondary" data-action="online">Varios móviles</button>
            <button class="btn btn-secondary" data-action="solo">Jugar solo</button>
            ${resume ? '<button class="btn btn-secondary" data-action="continue">Continuar</button>' : ''}
          </div>
        </div>
      </section>
      <p class="app-version" id="app-version"></p>
    </div>`;
    showCacheVersion();
  }

  async function showCacheVersion() {
    if (!("caches" in window)) return;
    try {
      const key = (await caches.keys()).find(name => name.startsWith("continuum-"));
      const label = document.getElementById("app-version");
      if (key && label) label.textContent = key;
    } catch { /* sin caché disponible no hay nada que mostrar */ }
  }

  // Elegir bloque selecciona su primer juego, que es lo que se espera cuando solo hay uno.
  function setBlock(blockKey) {
    if (!CT.hasBlock(blockKey)) return;
    selectedBlockKey = blockKey;
    const games = CT.block(blockKey).games;
    if (!games.includes(selectedModeKey)) setMode(games[0]);
  }

  function setup() {
    screen = "setup";
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section"><h2>${currentMode().name}</h2><p class="lead">Añade hasta 9 personas y marca a la más joven: tendrá el primer turno.</p>
        <div class="panel">
          <div id="players"><div class="player-row"><input aria-label="Nombre del jugador 1" value="Jugador 1" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div><div class="player-row"><input aria-label="Nombre del jugador 2" value="Jugador 2" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div></div>
          <button class="btn btn-ghost" data-action="add-player">＋ Añadir participante</button>
          <div class="setup-grid">
            <div class="field"><label for="starter">La persona más joven</label><select id="starter"><option value="0">Jugador 1</option><option value="1">Jugador 2</option></select></div>
            <div class="field"><label for="hand-size">Cartas iniciales por persona</label><select id="hand-size"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:20px" data-action="start">Barajar y empezar <span>→</span></button>
        </div>
      </section>
    </div>`;
  }

  function syncStarterOptions() {
    const inputs = [...document.querySelectorAll("#players input")];
    const select = document.getElementById("starter");
    const selected = Math.min(Number(select.value), inputs.length - 1);
    select.innerHTML = inputs.map((input, i) => `<option value="${i}">${escapeHtml(input.value.trim() || `Jugador ${i + 1}`)}</option>`).join("");
    select.value = selected;
    inputs.forEach((input, i) => input.setAttribute("aria-label", `Nombre del jugador ${i + 1}`));
  }

  function startGame() {
    const inputs = [...document.querySelectorAll("#players input")];
    if (inputs.length < 2) return showToast("Se necesitan al menos 2 jugadores");
    const names = inputs.map((input, i) => input.value.trim() || `Jugador ${i + 1}`);
    const handSize = Number(document.getElementById("hand-size").value);
    const starter = Number(document.getElementById("starter").value);
    const shuffled = shuffle(currentMode().cards.map(card => card.id));
    const players = names.map((name, i) => ({ id: i + 1, name, hand: shuffled.splice(0, handSize) }));
    const timeline = [shuffled.shift()];
    game = { mode: selectedModeKey, players, deck: shuffled, discard: [], timeline, current: starter, starter, turnsInRound: 0, round: 1, winner: null, winners: null };
    selectedCardId = null;
    result = null;
    saveGame();
    renderPass();
  }

  function currentPlayer() { return game.players[game.current]; }

  function renderPass() {
    screen = "pass";
    const player = currentPlayer();
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <section class="pass-screen"><div class="panel pass-card"><div class="player-medallion">${escapeHtml(initials(player.name))}</div><div class="eyebrow">Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}</div><h2>El turno es de<br>${escapeHtml(player.name)}</h2><p>Pásale el móvil. Las fechas siguen ocultas hasta colocar una carta.</p><button class="btn btn-primary btn-block" data-action="ready">Empezar mi turno <span>→</span></button></div></section>
    </div>`;
  }

  function gameView() {
    screen = "game";
    const player = currentPlayer();
    const timelineCards = game.timeline.map(id => cardsById.get(id));
    const handCards = player.hand.map(id => cardsById.get(id));
    const selectedCard = selectedCardId ? cardsById.get(selectedCardId) : null;
    const slots = [];
    for (let i = 0; i <= timelineCards.length; i++) {
      slots.push(pendingIndex === i && selectedCard
        ? confirmSlot(selectedCard)
        : `<button class="slot" data-action="place" data-index="${i}" ${selectedCardId ? "" : "disabled"} aria-label="Colocar en la posición ${i + 1} de ${timelineCards.length + 1}"><span>+</span></button>`);
      if (i < timelineCards.length) {
        slots.push(timelineCardMarkup(timelineCards[i]));
      }
    }
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <div class="game-head"><div><div class="turn-label">Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}</div><div class="turn-name">${escapeHtml(player.name)}</div></div><div class="deck-count"><strong>${game.deck.length}</strong><span>mazo</span></div></div>
      <div class="scoreboard">${game.players.map((p, i) => `<span class="score ${i === game.current ? "active" : ""}"><i>${escapeHtml(initials(p.name))}</i><b>${escapeHtml(p.name)}</b><em>${p.hand.length}</em></span>`).join("")}</div>
      <section><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${game.timeline.length} cartas</small></div><div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      <section><div class="hand-title"><h3>Tus cartas</h3><small>${player.hand.length} por colocar</small></div><div class="hand">${handCards.map(card => `<button class="hand-card ${selectedCardId === card.id ? "selected" : ""}" data-action="select-card" data-id="${card.id}"><span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`).join("")}</div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Elige una carta, o arrástrala hasta un hueco +"}</p></section>
    </div>`;
    if (selectedCardId) setTimeout(() => document.querySelector(".timeline-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    // Arrastrar una carta hasta un hueco lleva al mismo sitio que tocarla y luego tocar
    // el hueco: a la confirmación. El paso de confirmar se mantiene porque en un móvil
    // el dedo falla y la jugada no debería depender de eso.
    CT.enableDrag({
      cardSelector: ".hand-card", slotSelector: ".slot",
      onDrop: (id, index) => { selectedCardId = id; pendingIndex = index; gameView(); }
    });
  }

  function timelineCardMarkup(card) {
    const era = eraForCard(card);
    return `<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div></article>`;
  }

  function confirmSlot(card) {
    return `<div class="slot-confirm"><small>Colocar aquí</small><strong>${escapeHtml(card.title)}</strong>
      <button class="btn btn-primary btn-block" data-action="confirm-place">Sí, aquí</button>
      <button class="btn btn-ghost btn-block" data-action="cancel-place">Cancelar</button></div>`;
  }

  function placeCard(index) {
    if (!selectedCardId) return;
    pendingIndex = null;
    const player = currentPlayer();
    const card = cardsById.get(selectedCardId);
    const previous = index > 0 ? cardsById.get(game.timeline[index - 1]) : null;
    const next = index < game.timeline.length ? cardsById.get(game.timeline[index]) : null;
    const correct = (!previous || sortValue(card) >= sortValue(previous)) && (!next || sortValue(card) <= sortValue(next));
    player.hand = player.hand.filter(id => id !== selectedCardId);
    let returned = false;
    if (correct) game.timeline.splice(index, 0, selectedCardId);
    else if (drawCard(player)) game.discard.push(selectedCardId);
    else {
      // Sin mazo ni descarte no hay nada que robar: la carta vuelve a la mano.
      player.hand.push(selectedCardId);
      returned = true;
    }
    result = { correct, returned, card, playerName: player.name };
    selectedCardId = null;
    saveGame();
    renderResult();
  }

  function drawCard(player) {
    if (!game.deck.length) {
      game.deck = shuffle(game.discard);
      game.discard = [];
    }
    const id = game.deck.shift();
    if (id == null) return false;
    player.hand.push(id);
    return true;
  }

  function renderResult() {
    gameView();
    const { correct, returned, card } = result;
    const era = eraForCard(card);
    app.insertAdjacentHTML("beforeend", `<div class="overlay"><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark">${correct ? "✓" : "×"}</div><div class="eyebrow">${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div><p>${correct ? "La carta se queda en la línea temporal." : returned ? "No quedan cartas que robar, así que esta vuelve a tu mano." : "La carta va al descarte y has robado una nueva."}</p><button class="btn btn-primary btn-block" data-action="finish-turn">Terminar turno <span>→</span></button></div></div>`);
  }

  function finishTurn() {
    game.turnsInRound += 1;
    if (game.turnsInRound >= game.players.length && resolveRound()) return;
    game.current = (game.current + 1) % game.players.length;
    result = null;
    saveGame();
    renderPass();
  }

  // Devuelve true si la partida ha terminado. Nadie puede empezar un turno con la mano
  // vacía: o gana, o el desempate le da una carta, o se acaba la partida por falta de mazo.
  function resolveRound() {
    const empty = game.players.filter(player => player.hand.length === 0);
    if (empty.length === 1) return endGame(empty);
    if (empty.length > 1) {
      if (game.deck.length + game.discard.length < empty.length) return endGame(empty);
      empty.forEach(drawCard);
      showToast("Empate: una carta extra para cada finalista");
    }
    game.round += 1;
    game.turnsInRound = 0;
    return false;
  }

  function endGame(winners) {
    game.winners = winners.map(player => player.id);
    game.winner = game.winners[0];
    saveGame();
    renderWinner(winners);
    return true;
  }

  function renderWinner(winners) {
    screen = "winner";
    const list = [].concat(winners);
    const names = list.map(player => escapeHtml(player.name));
    const title = names.length === 1 ? `${names[0]} gana` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]} ganan`;
    const lead = names.length === 1
      ? "Ha sido la única persona en terminar la ronda sin cartas."
      : "Se acabaron las cartas del mazo y terminan la ronda empatadas sin cartas.";
    app.innerHTML = `<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">🏆</div><div class="eyebrow">Fin de la partida</div><h1 style="font-size:clamp(2.5rem,12vw,4.5rem)">${title}</h1><p class="lead" style="margin-inline:auto">${lead}</p><div class="actions" style="justify-content:center"><button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button></div></div></section></div>`;
  }

  const DAILY_CARDS = 15;
  const SOLO_LIVES = 3;
  const RECORDS_KEY = "hilo-retos-v1";
  let solo = null;

  function soloKey() { return `hilo-solo-${selectedModeKey}-v1`; }

  function today() { return new Date().toLocaleDateString("sv-SE"); }

  function yesterday() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString("sv-SE");
  }

  // Semilla a partir de la fecha: el reto del día es el mismo en todos los móviles,
  // sin necesidad de servidor.
  function seedFrom(text) {
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    return seed >>> 0;
  }

  function seededRandom(seed) {
    let state = seed;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWith(items, random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function readRecords() {
    try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
  }

  function modeRecords() {
    const records = readRecords();
    return records[selectedModeKey] || { best: 0, streak: 0, lastDay: "", days: {} };
  }

  function saveRecords(entry) {
    const records = readRecords();
    records[selectedModeKey] = entry;
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* almacenamiento lleno */ }
  }

  function saveSolo() {
    if (solo) localStorage.setItem(soloKey(), JSON.stringify(solo));
    else localStorage.removeItem(soloKey());
  }

  function loadSolo() {
    try {
      const stored = JSON.parse(localStorage.getItem(soloKey()));
      if (!stored || !stored.timeline || stored.finished) return null;
      // El reto diario caduca: si es de otro día ya no vale continuarlo.
      if (stored.kind === "daily" && stored.day !== today()) return null;
      return stored;
    } catch { return null; }
  }

  function soloHome() {
    screen = "solo-home";
    solo = loadSolo();
    pendingIndex = null;
    const records = modeRecords();
    const doneToday = records.days && records.days[today()];
    const mode = currentMode();
    const pendiente = solo && solo.kind === "free";
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section"><div class="eyebrow"><span class="eyebrow-line"></span> ${mode.name}</div><h2>Jugar en solitario</h2>
        <p class="lead">Coloca las cartas tú solo. Tienes ${SOLO_LIVES} vidas: cada fallo te cuesta una.</p>
        <div class="panel solo-panel">
          <div class="section-label">Reto diario <small>${today().split("-").reverse().join("/")}</small></div>
          ${doneToday
            ? `<p class="solo-done">Hoy ya lo has jugado: <strong>${doneToday.hits} de ${doneToday.total}</strong>. Vuelve mañana.</p>`
            : `<p>Las mismas ${DAILY_CARDS} cartas para todo el mundo, un intento al día.</p><button class="btn btn-primary btn-block" data-action="start-daily">Jugar el reto de hoy <span>→</span></button>`}
          <div class="solo-stats"><span><b>${records.streak || 0}</b><small>días seguidos</small></span><span><b>${records.best || 0}</b><small>mejor marca libre</small></span></div>
        </div>
        <div class="panel solo-panel">
          <div class="section-label">Partida libre</div>
          <p>El mazo entero, sin límite de cartas: aguanta lo que puedas.</p>
          ${pendiente ? `<button class="btn btn-primary btn-block" data-action="resume-solo">Continuar la partida <span>→</span></button>` : ""}
          <button class="btn ${pendiente ? "btn-secondary" : "btn-primary"} btn-block" data-action="start-free">${pendiente ? "Empezar otra" : "Empezar"}</button>
        </div>
      </section>
    </div>`;
  }

  function startSolo(kind) {
    const ids = currentMode().cards.map(card => card.id);
    const barajado = kind === "daily"
      ? shuffleWith(ids, seededRandom(seedFrom(`${today()}:${selectedModeKey}`))).slice(0, DAILY_CARDS + 1)
      : shuffle(ids);
    const timeline = [barajado.shift()];
    solo = {
      kind, mode: selectedModeKey, day: today(), deck: barajado, timeline,
      current: barajado.shift(), lives: SOLO_LIVES, hits: 0, played: 0,
      total: kind === "daily" ? DAILY_CARDS : null, finished: false
    };
    pendingIndex = null;
    result = null;
    saveSolo();
    soloView();
  }

  function soloView() {
    screen = "solo";
    const card = cardsById.get(solo.current);
    const timelineCards = solo.timeline.map(id => cardsById.get(id));
    const slots = [];
    for (let i = 0; i <= timelineCards.length; i++) {
      slots.push(pendingIndex === i
        ? confirmSlot(card)
        : `<button class="slot" data-action="solo-place" data-index="${i}" aria-label="Colocar en la posición ${i + 1} de ${timelineCards.length + 1}"><span>+</span></button>`);
      if (i < timelineCards.length) slots.push(timelineCardMarkup(timelineCards[i]));
    }
    const restantes = solo.total ? solo.total - solo.played : solo.deck.length + 1;
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="solo-menu">Salir</button>')}
      <div class="game-head"><div><div class="turn-label">${solo.kind === "daily" ? "Reto diario" : "Partida libre"}</div><div class="turn-name">${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}</div></div><div class="deck-count"><strong>${restantes}</strong><span>por colocar</span></div></div>
      <div class="solo-lives" aria-label="Vidas restantes: ${solo.lives}">${"♥".repeat(solo.lives)}${"♡".repeat(SOLO_LIVES - solo.lives)}</div>
      <section><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${solo.timeline.length} cartas</small></div><div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      <section><div class="hand-title"><h3>Tu carta</h3></div><div class="hand hand-solo"><div class="hand-card selected" data-id="${card.id}"><span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(card.title)}</strong></div></div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : "Arrastra la carta hasta un hueco, o tócalo directamente"}</p></section>
    </div>`;
    CT.enableDrag({
      cardSelector: ".hand-card", slotSelector: ".slot",
      onDrop: (id, index) => { pendingIndex = index; soloView(); }
    });
  }

  function soloPlace(index) {
    const card = cardsById.get(solo.current);
    const previous = index > 0 ? cardsById.get(solo.timeline[index - 1]) : null;
    const next = index < solo.timeline.length ? cardsById.get(solo.timeline[index]) : null;
    const correct = (!previous || sortValue(card) >= sortValue(previous)) && (!next || sortValue(card) <= sortValue(next));
    if (correct) {
      solo.timeline.splice(index, 0, solo.current);
      solo.hits += 1;
    } else {
      solo.lives -= 1;
    }
    solo.played += 1;
    pendingIndex = null;
    result = { correct, card, solo: true };
    saveSolo();
    soloResult();
  }

  function soloResult() {
    soloView();
    const { correct, card } = result;
    const era = eraForCard(card);
    const acabada = solo.lives === 0 || !solo.deck.length || (solo.total && solo.played >= solo.total);
    app.insertAdjacentHTML("beforeend", `<div class="overlay"><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark">${correct ? "✓" : "×"}</div><div class="eyebrow">${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div><p>${correct ? "La carta se queda colocada." : `Fallo: te quedan ${solo.lives} ${solo.lives === 1 ? "vida" : "vidas"}.`}</p><button class="btn btn-primary btn-block" data-action="solo-next">${acabada ? "Ver el resultado" : "Siguiente carta"} <span>→</span></button></div></div>`);
  }

  function soloNext() {
    result = null;
    if (solo.lives === 0 || !solo.deck.length || (solo.total && solo.played >= solo.total)) return soloFinish();
    solo.current = solo.deck.shift();
    saveSolo();
    soloView();
  }

  function soloFinish() {
    screen = "solo-end";
    const total = solo.total || solo.played;
    const records = modeRecords();
    const dia = today();
    if (solo.kind === "daily" && !(records.days && records.days[dia])) {
      records.days = records.days || {};
      records.days[dia] = { hits: solo.hits, total };
      records.streak = records.lastDay === yesterday() ? (records.streak || 0) + 1 : 1;
      records.lastDay = dia;
      // No hace falta guardar el histórico entero: basta con los últimos días.
      const dias = Object.keys(records.days).sort().slice(-60);
      records.days = Object.fromEntries(dias.map(clave => [clave, records.days[clave]]));
      saveRecords(records);
    } else if (solo.kind === "free" && solo.hits > (records.best || 0)) {
      records.best = solo.hits;
      saveRecords(records);
    }
    const superado = solo.lives > 0;
    const resumen = solo.kind === "daily"
      ? `Has colocado bien <strong>${solo.hits}</strong> de ${total} cartas.`
      : `Has aguantado <strong>${solo.hits}</strong> ${solo.hits === 1 ? "carta" : "cartas"} seguidas antes de quedarte sin vidas.`;
    solo.finished = true;
    saveSolo();
    solo = null;
    app.innerHTML = `<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">${superado ? "🏅" : "🎯"}</div><div class="eyebrow">${superado ? "Reto completado" : "Se acabaron las vidas"}</div><h1 style="font-size:clamp(2rem,9vw,3.4rem)">${resumen}</h1><div class="actions" style="justify-content:center"><button class="btn btn-primary" data-action="solo">Volver a solitario</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button></div></div></section></div>`;
  }

  function rules() {
    const returnTo = screen;
    app.insertAdjacentHTML("beforeend", `<div class="overlay" data-overlay="rules"><div class="modal rules"><div class="eyebrow">Reglas rápidas</div><h2>Cómo jugar</h2><ol><li>Pueden jugar de 2 a 9 personas. Reparte 4 cartas a cada una (o la cantidad que elijáis), siempre con la fecha oculta.</li><li>La persona más joven comienza. En su turno elige una carta y el hueco donde cree que encaja.</li><li>Al revelar la fecha, si está bien ordenada permanece en la línea. Si falla, se descarta y roba otra.</li><li>Todos juegan una vez por ronda, en el orden indicado.</li><li>Gana quien sea la única persona que termina una ronda sin cartas. Si varias lo logran, reciben una carta y desempatan.</li></ol><button class="btn btn-primary btn-block" data-action="close-rules" data-return="${returnTo}">Entendido</button></div></div>`);
  }

  function gameMenu() {
    app.insertAdjacentHTML("beforeend", `<div class="overlay"><div class="modal"><div class="eyebrow">Partida en pausa</div><h2>¿Qué quieres hacer?</h2><div class="actions" style="display:grid"><button class="btn btn-primary" data-action="close-menu">Seguir jugando</button><button class="btn btn-secondary" data-action="rules">Ver las reglas</button><button class="btn btn-ghost" data-action="abandon">Abandonar partida</button></div></div></div>`);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  async function launchOnline(roomCode = "") {
    app.innerHTML = `<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="spinner"></div><h2>Conectando la sala</h2><p>Preparando el modo multijugador…</p></div></section></div>`;
    try {
      const online = await import("./online.js");
      await online.openOnlineMode({ roomCode, modeKey: selectedModeKey });
    } catch (error) {
      console.error(error);
      showToast("No se pudo conectar. Comprueba tu conexión a internet.");
      home();
    }
  }

  app.addEventListener("input", event => {
    if (event.target.closest("#players")) syncStarterOptions();
  });

  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "home") home();
    else if (action === "set-mode") { setMode(target.dataset.mode); home(); }
    else if (action === "set-block") { setBlock(target.dataset.block); home(); }
    else if (action === "home-new") { game = null; saveGame(); home(); }
    else if (action === "setup") setup();
    else if (action === "online") launchOnline();
    else if (action === "continue") { game.winners ? renderWinner(game.players.filter(p => game.winners.includes(p.id))) : renderPass(); }
    else if (action === "add-player") {
      const count = document.querySelectorAll("#players .player-row").length;
      if (count >= 9) return showToast("El máximo es de 9 jugadores");
      document.getElementById("players").insertAdjacentHTML("beforeend", `<div class="player-row"><input aria-label="Nombre del jugador ${count + 1}" value="Jugador ${count + 1}" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div>`);
      syncStarterOptions();
    } else if (action === "remove-player") {
      if (document.querySelectorAll("#players .player-row").length <= 2) return showToast("Se necesitan al menos 2 jugadores");
      target.closest(".player-row").remove(); syncStarterOptions();
    } else if (action === "start") startGame();
    else if (action === "ready") gameView();
    else if (action === "select-card") { selectedCardId = Number(target.dataset.id); pendingIndex = null; gameView(); }
    else if (action === "place") { pendingIndex = Number(target.dataset.index); gameView(); }
    else if (action === "confirm-place") { screen === "solo" ? soloPlace(pendingIndex) : placeCard(pendingIndex); }
    else if (action === "cancel-place") { pendingIndex = null; screen === "solo" ? soloView() : gameView(); }
    else if (action === "finish-turn") finishTurn();
    else if (action === "solo") soloHome();
    else if (action === "start-daily") startSolo("daily");
    else if (action === "start-free") startSolo("free");
    else if (action === "resume-solo") { solo = loadSolo(); pendingIndex = null; solo ? soloView() : soloHome(); }
    else if (action === "solo-place") { pendingIndex = Number(target.dataset.index); soloView(); }
    else if (action === "solo-next") soloNext();
    else if (action === "solo-menu") soloHome();
    else if (action === "rules") rules();
    else if (action === "close-rules") target.closest(".overlay").remove();
    else if (action === "game-menu") gameMenu();
    else if (action === "close-menu") target.closest(".overlay").remove();
    else if (action === "abandon") { game = null; saveGame(); home(); }
  });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
  const invitedRoom = new URLSearchParams(location.search).get("room") || "";
  if (invitedRoom) launchOnline(invitedRoom);
  else home();
})();
