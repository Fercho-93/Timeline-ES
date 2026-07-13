(function () {
  "use strict";

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const MODE_STORAGE_KEY = "hilo-selected-mode-v1";
  const LEGACY_STORAGE_KEY = "hilo-espana-game-v1";
  const MODES = {
    history: {
      key: "history", name: "Historia de España", shortName: "España", icon: "🏛️",
      eyebrow: "Historia · intuición · sobremesa",
      description: "Construid una línea del tiempo de España. Escucha tu intuición, arriesga y sé la única persona que se queda sin cartas.",
      cardLabel: "hechos", caption: "De Hispania a la democracia", cards: window.HISTORY_CARDS
    },
    movies: {
      key: "movies", name: "Estrenos de cine", shortName: "Cine", icon: "🎬",
      eyebrow: "Cine · memoria · palomitas",
      description: "Ordenad grandes películas por su año de estreno. De los pioneros del cine a los éxitos más recientes.",
      cardLabel: "películas", caption: "De Méliès a nuestros días", cards: window.MOVIE_CARDS
    }
  };
  let selectedModeKey = localStorage.getItem(MODE_STORAGE_KEY) || "history";
  if (!MODES[selectedModeKey]) selectedModeKey = "history";
  let cardsById = new Map(MODES[selectedModeKey].cards.map(card => [card.id, card]));
  let screen = "home";
  let game = loadGame();
  let selectedCardId = null;
  let result = null;
  let passReady = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function formatYear(card) {
    if (card.label) return card.label;
    return card.year < 0 ? `${Math.abs(card.year)} a. C.` : String(card.year);
  }

  function currentMode() { return MODES[selectedModeKey]; }

  function storageKey() { return `hilo-game-${selectedModeKey}-v1`; }

  function setMode(modeKey) {
    if (!MODES[modeKey]) return;
    selectedModeKey = modeKey;
    localStorage.setItem(MODE_STORAGE_KEY, modeKey);
    cardsById = new Map(currentMode().cards.map(card => [card.id, card]));
    game = loadGame();
    selectedCardId = null;
    result = null;
  }

  function eraForCard(card) {
    if (selectedModeKey === "movies") {
      if (card.year < 1930) return { key: "pioneros", name: "Cine pionero", symbol: "▥" };
      if (card.year < 1960) return { key: "clasico", name: "Cine clásico", symbol: "★" };
      if (card.year < 1980) return { key: "nuevocine", name: "Nuevo cine", symbol: "◉" };
      if (card.year < 2000) return { key: "blockbuster", name: "Era blockbuster", symbol: "◆" };
      if (card.year < 2010) return { key: "milenio", name: "Nuevo milenio", symbol: "✦" };
      return { key: "actual", name: "Cine actual", symbol: "▷" };
    }
    if (card.year < 711) return { key: "antigua", name: "Hispania antigua", symbol: "Ⅻ" };
    if (card.year < 1492) return { key: "medieval", name: "Edad Media", symbol: "♜" };
    if (card.year < 1700) return { key: "imperio", name: "Monarquía Hispánica", symbol: "✦" };
    if (card.year < 1808) return { key: "ilustracion", name: "Ilustración", symbol: "☼" };
    if (card.year < 1931) return { key: "moderna", name: "España contemporánea", symbol: "⌁" };
    if (card.year < 1975) return { key: "sigloxx", name: "Siglo XX", symbol: "◈" };
    return { key: "democracia", name: "Democracia", symbol: "◎" };
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function saveGame() {
    if (game) localStorage.setItem(storageKey(), JSON.stringify(game));
    else localStorage.removeItem(storageKey());
  }

  function loadGame() {
    try {
      let raw = localStorage.getItem(storageKey());
      if (!raw && selectedModeKey === "history") raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      const stored = JSON.parse(raw);
      if (!stored || !stored.players || !stored.timeline) return null;
      stored.mode = stored.mode || selectedModeKey;
      return stored;
    } catch { return null; }
  }

  function header(extra = "") {
    return `<header class="topbar"><div class="brand"><span class="brand-mark">${currentMode().icon}</span>Hilo · ${currentMode().shortName}</div>${extra}</header>`;
  }

  function home() {
    screen = "home";
    const mode = currentMode();
    const modePicker = `<div class="mode-switch" role="group" aria-label="Modalidad de juego">${Object.values(MODES).map(item => `<button class="mode-option ${item.key === selectedModeKey ? "active" : ""}" data-action="set-mode" data-mode="${item.key}" aria-pressed="${item.key === selectedModeKey}"><span>${item.icon}</span><b>${item.name}</b></button>`).join("")}</div>`;
    const heroArt = selectedModeKey === "history"
      ? `<div class="hero-art" aria-hidden="true"><img src="assets/hero-history.jpg" alt=""><div class="art-seal"><span>${mode.cards.length}</span><small>momentos<br>de historia</small></div><div class="art-caption">${mode.caption}</div></div>`
      : `<div class="hero-art hero-cinema" aria-hidden="true"><div class="cinema-symbol">🎬</div><div class="film-strip"></div><div class="art-seal"><span>${mode.cards.length}</span><small>grandes<br>estrenos</small></div><div class="art-caption">${mode.caption}</div></div>`;
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="rules">Cómo jugar</button>')}
      ${modePicker}
      <section class="hero hero-premium">
        <div class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-line"></span> ${mode.eyebrow}</div>
          <h1>¿Antes o<br><em>después?</em></h1>
          <p class="lead">${mode.description}</p>
          <div class="hero-stats"><span class="pill">${mode.cards.length} ${mode.cardLabel}</span><span class="pill">2–9 jugadores</span><span class="pill">Sin conexión</span></div>
          <div class="actions">
            <button class="btn btn-primary" data-action="setup">Un solo móvil <span>→</span></button>
            <button class="btn btn-secondary" data-action="online">Varios móviles</button>
            ${game && game.mode === selectedModeKey ? '<button class="btn btn-secondary" data-action="continue">Continuar</button>' : ''}
          </div>
        </div>
        ${heroArt}
      </section>
    </div>`;
  }

  function setup() {
    screen = "setup";
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section"><div class="eyebrow"><span class="eyebrow-line"></span> ${currentMode().name}</div><h2>La partida empieza aquí</h2><p class="lead">Añade hasta 9 personas y marca a la más joven: tendrá el primer turno.</p>
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
    game = { mode: selectedModeKey, players, deck: shuffled, discard: [], timeline, current: starter, starter, turnsInRound: 0, round: 1, winner: null };
    selectedCardId = null;
    result = null;
    passReady = false;
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
    const slots = [];
    for (let i = 0; i <= timelineCards.length; i++) {
      slots.push(`<button class="slot" data-action="place" data-index="${i}" ${selectedCardId ? "" : "disabled"} aria-label="Colocar en la posición ${i + 1}"><span>+</span></button>`);
      if (i < timelineCards.length) {
        const card = timelineCards[i];
        const era = eraForCard(card);
        slots.push(`<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${formatYear(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div></article>`);
      }
    }
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <div class="game-head"><div><div class="turn-label">Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}</div><div class="turn-name">${escapeHtml(player.name)}</div></div><div class="deck-count"><strong>${game.deck.length}</strong><span>mazo</span></div></div>
      <div class="scoreboard">${game.players.map((p, i) => `<span class="score ${i === game.current ? "active" : ""}"><i>${escapeHtml(initials(p.name))}</i><b>${escapeHtml(p.name)}</b><em>${p.hand.length}</em></span>`).join("")}</div>
      <section><div class="hand-title"><h3>Línea temporal</h3><small>${game.timeline.length} cartas</small></div><div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      <section><div class="hand-title"><h3>Tus cartas</h3><small>${player.hand.length} por colocar</small></div><div class="hand">${handCards.map(card => { const era = eraForCard(card); return `<button class="hand-card ${selectedCardId === card.id ? "selected" : ""}" data-action="select-card" data-id="${card.id}"><span class="card-era era-${era.key}"><i>${era.symbol}</i>${era.name}</span><span class="hidden-date">Fecha oculta</span><strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`; }).join("")}</div><p class="hint">${selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Elige una carta para colocarla"}</p></section>
    </div>`;
    if (selectedCardId) setTimeout(() => document.querySelector(".timeline-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function placeCard(index) {
    if (!selectedCardId) return;
    const player = currentPlayer();
    const card = cardsById.get(selectedCardId);
    const previous = index > 0 ? cardsById.get(game.timeline[index - 1]) : null;
    const next = index < game.timeline.length ? cardsById.get(game.timeline[index]) : null;
    const correct = (!previous || card.year >= previous.year) && (!next || card.year <= next.year);
    player.hand = player.hand.filter(id => id !== selectedCardId);
    if (correct) game.timeline.splice(index, 0, selectedCardId);
    else {
      game.discard.push(selectedCardId);
      drawCard(player);
    }
    result = { correct, card, playerName: player.name };
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
    if (id != null) player.hand.push(id);
  }

  function renderResult() {
    gameView();
    const { correct, card } = result;
    const era = eraForCard(card);
    app.insertAdjacentHTML("beforeend", `<div class="overlay"><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark">${correct ? "✓" : "×"}</div><div class="eyebrow">${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatYear(card)}</div><p>${escapeHtml(card.detail)}</p></div><p>${correct ? "La carta se queda en la línea temporal." : "La carta va al descarte y has robado una nueva."}</p><button class="btn btn-primary btn-block" data-action="finish-turn">Terminar turno <span>→</span></button></div></div>`);
  }

  function finishTurn() {
    game.turnsInRound += 1;
    if (game.turnsInRound >= game.players.length) {
      const empty = game.players.filter(player => player.hand.length === 0);
      if (empty.length === 1) {
        game.winner = empty[0].id;
        saveGame();
        return renderWinner(empty[0]);
      }
      if (empty.length > 1) {
        empty.forEach(drawCard);
        showToast("Empate: una carta extra para cada finalista");
      }
      game.round += 1;
      game.turnsInRound = 0;
    }
    game.current = (game.current + 1) % game.players.length;
    result = null;
    saveGame();
    renderPass();
  }

  function renderWinner(winner) {
    screen = "winner";
    app.innerHTML = `<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">🏆</div><div class="eyebrow">Fin de la partida</div><h1 style="font-size:clamp(2.5rem,12vw,4.5rem)">${escapeHtml(winner.name)} gana</h1><p class="lead" style="margin-inline:auto">Ha sido la única persona en terminar la ronda sin cartas.</p><div class="actions" style="justify-content:center"><button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button></div></div></section></div>`;
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
    else if (action === "home-new") { game = null; saveGame(); home(); }
    else if (action === "setup") setup();
    else if (action === "online") launchOnline();
    else if (action === "continue") { game.winner ? renderWinner(game.players.find(p => p.id === game.winner)) : renderPass(); }
    else if (action === "add-player") {
      const count = document.querySelectorAll("#players .player-row").length;
      if (count >= 9) return showToast("El máximo es de 9 jugadores");
      document.getElementById("players").insertAdjacentHTML("beforeend", `<div class="player-row"><input aria-label="Nombre del jugador ${count + 1}" value="Jugador ${count + 1}" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div>`);
      syncStarterOptions();
    } else if (action === "remove-player") {
      if (document.querySelectorAll("#players .player-row").length <= 2) return showToast("Se necesitan al menos 2 jugadores");
      target.closest(".player-row").remove(); syncStarterOptions();
    } else if (action === "start") startGame();
    else if (action === "ready") { passReady = true; gameView(); }
    else if (action === "select-card") { selectedCardId = Number(target.dataset.id); gameView(); }
    else if (action === "place") placeCard(Number(target.dataset.index));
    else if (action === "finish-turn") finishTurn();
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

