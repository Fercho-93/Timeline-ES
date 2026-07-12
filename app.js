(function () {
  "use strict";

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const STORAGE_KEY = "hilo-espana-game-v1";
  const cardsById = new Map(window.HISTORY_CARDS.map(card => [card.id, card]));
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

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function saveGame() {
    if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function loadGame() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || !stored.players || !stored.timeline) return null;
      return stored;
    } catch { return null; }
  }

  function header(extra = "") {
    return `<header class="topbar"><div class="brand"><span class="brand-mark">⌛</span>Hilo de España</div>${extra}</header>`;
  }

  function home() {
    screen = "home";
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="rules">Cómo jugar</button>')}
      <section class="hero">
        <div class="eyebrow">Historia · intuición · sobremesa</div>
        <h1>¿Antes o después?</h1>
        <p class="lead">Construid juntos una línea del tiempo de España. Coloca tus hechos en el lugar correcto y sé la única persona que se queda sin cartas.</p>
        <div class="hero-stats"><span class="pill">${window.HISTORY_CARDS.length} hechos</span><span class="pill">2–6 jugadores</span><span class="pill">Sin internet</span><span class="pill">Un solo móvil</span></div>
        <div class="actions">
          <button class="btn btn-primary" data-action="setup">Nueva partida</button>
          ${game ? '<button class="btn btn-secondary" data-action="continue">Continuar partida</button>' : ''}
        </div>
      </section>
    </div>`;
  }

  function setup() {
    screen = "setup";
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <section><div class="eyebrow">Preparación</div><h2>¿Quién juega?</h2><p class="lead">Añade los nombres y marca a la persona más joven: comenzará la partida.</p>
        <div class="panel">
          <div id="players"><div class="player-row"><input aria-label="Nombre del jugador 1" value="Jugador 1" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div><div class="player-row"><input aria-label="Nombre del jugador 2" value="Jugador 2" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div></div>
          <button class="btn btn-ghost" data-action="add-player">+ Añadir jugador</button>
          <div class="setup-grid">
            <div class="field"><label for="starter">La persona más joven</label><select id="starter"><option value="0">Jugador 1</option><option value="1">Jugador 2</option></select></div>
            <div class="field"><label for="hand-size">Cartas iniciales por persona</label><select id="hand-size"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:20px" data-action="start">Barajar y empezar</button>
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
    const shuffled = shuffle(window.HISTORY_CARDS.map(card => card.id));
    const players = names.map((name, i) => ({ id: i + 1, name, hand: shuffled.splice(0, handSize) }));
    const timeline = [shuffled.shift()];
    game = { players, deck: shuffled, discard: [], timeline, current: starter, starter, turnsInRound: 0, round: 1, winner: null };
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
      <section class="pass-screen"><div class="panel"><div class="big-icon">📱</div><div class="eyebrow">Ronda ${game.round}</div><h2>Pásale el móvil a ${escapeHtml(player.name)}</h2><p>Las fechas siguen ocultas. Cuando lo tenga, puede comenzar su turno.</p><button class="btn btn-primary btn-block" data-action="ready">Soy ${escapeHtml(player.name)}</button></div></section>
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
        slots.push(`<article class="timeline-card"><div class="year">${formatYear(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></article>`);
      }
    }
    app.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <div class="game-head"><div><div class="turn-label">Ronda ${game.round} · Turno de</div><div class="turn-name">${escapeHtml(player.name)}</div></div><div class="deck-count"><strong>${game.deck.length}</strong><span>mazo</span></div></div>
      <div class="scoreboard">${game.players.map((p, i) => `<span class="score ${i === game.current ? "active" : ""}">${escapeHtml(p.name)} · ${p.hand.length}</span>`).join("")}</div>
      <section><div class="hand-title"><h3>Línea temporal</h3><small>${game.timeline.length} cartas</small></div><div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      <section><div class="hand-title"><h3>Tus cartas</h3><small>${player.hand.length} por colocar</small></div><div class="hand">${handCards.map(card => `<button class="hand-card ${selectedCardId === card.id ? "selected" : ""}" data-action="select-card" data-id="${card.id}"><span class="hidden-date">Fecha oculta</span><strong>${escapeHtml(card.title)}</strong></button>`).join("")}</div><p class="hint">${selectedCardId ? "Ahora toca un hueco + de la línea temporal" : "Elige una carta para colocarla"}</p></section>
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
    app.insertAdjacentHTML("beforeend", `<div class="overlay"><div class="modal ${correct ? "success" : "failure"}"><div class="big-icon">${correct ? "✓" : "×"}</div><div class="eyebrow">${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2>${escapeHtml(card.title)}</h2><div class="reveal"><div class="year">${formatYear(card)}</div><p>${escapeHtml(card.detail)}</p></div><p>${correct ? "La carta se queda en la línea temporal." : "La carta va al descarte y has robado una nueva."}</p><button class="btn btn-primary btn-block" data-action="finish-turn">Terminar turno</button></div></div>`);
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
    app.insertAdjacentHTML("beforeend", `<div class="overlay" data-overlay="rules"><div class="modal rules"><div class="eyebrow">Reglas rápidas</div><h2>Cómo jugar</h2><ol><li>Reparte 4 cartas por persona (o la cantidad que elijáis), siempre con la fecha oculta.</li><li>La persona más joven comienza. En su turno elige una carta y el hueco donde cree que encaja.</li><li>Al revelar la fecha, si está bien ordenada permanece en la línea. Si falla, se descarta y roba otra.</li><li>Todos juegan una vez por ronda, en el orden indicado.</li><li>Gana quien sea la única persona que termina una ronda sin cartas. Si varias lo logran, reciben una carta y desempatan.</li></ol><button class="btn btn-primary btn-block" data-action="close-rules" data-return="${returnTo}">Entendido</button></div></div>`);
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

  app.addEventListener("input", event => {
    if (event.target.closest("#players")) syncStarterOptions();
  });

  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "home") home();
    else if (action === "home-new") { game = null; saveGame(); home(); }
    else if (action === "setup") setup();
    else if (action === "continue") { game.winner ? renderWinner(game.players.find(p => p.id === game.winner)) : renderPass(); }
    else if (action === "add-player") {
      const count = document.querySelectorAll("#players .player-row").length;
      if (count >= 6) return showToast("El máximo es de 6 jugadores");
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
  home();
})();
