(function () {
  "use strict";

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const MODE_STORAGE_KEY = "hilo-selected-mode-v1";
  const LEGACY_STORAGE_KEY = "hilo-espana-game-v1";
  // Las modalidades, sus ejes y los ayudantes que comparte con el modo de varios
  // móviles están en modes.js, para declararlos una sola vez.
  const CT = window.CONTINUUM;
  const { escapeHtml, initials, shuffle, announce } = CT;
  // Pintar pasa por aquí para que el foco del teclado no se pierda en cada jugada.
  const paint = html => CT.paint(app, html, screen);
  // Y las capas se abren como diálogos: foco dentro, tabulador atrapado, Escape cierra.
  // `cerrable` distingue las capas que se pueden descartar —las reglas, el menú— de las
  // que son un paso obligado de la jugada, donde Escape no debe hacer nada.
  function overlay(html, cerrable) {
    app.insertAdjacentHTML("beforeend", html);
    CT.openDialog(app.lastElementChild, cerrable);
  }
  let selectedModeKey = localStorage.getItem(MODE_STORAGE_KEY) || CT.DEFAULT_MODE;
  if (!CT.has(selectedModeKey)) selectedModeKey = CT.DEFAULT_MODE;
  // El bloque en pantalla se deduce siempre del juego elegido, así que no se guarda aparte.
  let selectedBlockKey = CT.blockOf(selectedModeKey).key;
  let cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
  // Cada mazo numera sus cartas en su propio rango (historia 1+, cine 1001+, música
  // 6001+...), así que un identificador nunca choca entre modalidades. Esto es lo que
  // permite que la pantalla de repaso de la competición, que mezcla fallos de varios
  // temas distintos, pueda encontrar cualquier carta sin saber de qué mazo venía.
  const GLOBAL_CARDS_BY_ID = new Map(Object.values(CT.MODES).flatMap(m => m.cards).map(card => [card.id, card]));
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
    return `<header class="topbar"><div class="brand">Continuum</div><div class="topbar-actions">${extra}${CT.settingsButton()}</div></header>`;
  }

  // Las carátulas van a la caché de la aplicación y se bajan en la primera visita, así
  // que hay dos tamaños de cada una y cada panel pide el que de verdad usa: el lomo mide
  // 66 px de ancho y además va en gris y oscurecido, así que con 400 va sobrado; la
  // carátula abierta ocupa unos 292 px en un móvil y unos 880 en un escritorio.
  //
  // Se decide aquí y no con `sizes`, que no sabe nada del panel que está abierto: al
  // desplegar otro bloque la portada se repinta entera y con ella cambia la imagen.
  const BLOCK_ART = {
    history: { archivo: "hero-history", alto: { 400: 267, 700: 467 } },
    entertainment: { archivo: "hero-entertainment", alto: { 400: 600, 700: 1050 } },
    science: { archivo: "hero-science", alto: { 400: 600, 700: 1050 } },
    nature: { archivo: "hero-nature", alto: { 400: 600, 700: 1050 } },
    globe: { archivo: "hero-geography", alto: { 400: 491, 700: 859 } },
    mixed: { archivo: "hero-mixed", alto: { 400: 567, 700: 992 } }
  };

  function blockArt(art, active) {
    const ancho = active ? 700 : 400;
    const arte = BLOCK_ART[art];
    return `<img src="assets/${arte.archivo}-${ancho}.webp" alt="" width="${ancho}" height="${arte.alto[ancho]}" decoding="async" fetchpriority="${active ? "high" : "low"}">`;
  }

  // La galería en acordeón es el selector de bloque: la carátula elegida se despliega
  // en color y las otras quedan como lomos que se pueden tocar.
  function gallery() {
    return `<div class="gallery" role="group" aria-label="Elige el bloque">${Object.values(CT.BLOCKS).map(item => {
      const active = item.key === selectedBlockKey;
      const total = item.games.length;
      return `<button class="gallery-panel panel-${item.art}${active ? " active" : ""}" data-action="set-block" data-block="${item.key}" aria-pressed="${active}" aria-label="${item.name}, ${total} ${total === 1 ? "juego" : "juegos"}">
        <span class="panel-art" aria-hidden="true">${blockArt(item.art, active)}</span>
        <span class="panel-spine" aria-hidden="true"><i>${item.icon}</i><b>${item.name}</b></span>
        <span class="panel-label" aria-hidden="true"><i></i><strong>${item.name}</strong><small>${item.tagline}</small></span>
      </button>`;
    }).join("")}</div>`;
  }

  // Los juegos del bloque en pantalla.
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
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button>')}
      <section class="hero">
        ${gallery()}
        <div class="hero-copy">
          <h1 data-focus tabindex="-1">${CT.question(selectedModeKey)}</h1>
          ${gameList()}
          <div class="actions">
            <button class="btn btn-primary" data-action="setup">Un solo móvil <span>→</span></button>
            <button class="btn btn-secondary" data-action="online">Varios móviles</button>
            <button class="btn btn-secondary" data-action="solo">Jugar solo</button>
            ${resume ? '<button class="btn btn-secondary" data-action="continue">Continuar</button>' : ''}
          </div>
          <button class="comp-promo" data-action="start-competition">
            <span class="comp-promo-art"><img src="assets/hero-competicion-400.webp" srcset="assets/hero-competicion-400.webp 400w, assets/hero-competicion-700.webp 700w" sizes="(min-width: 700px) 340px, 100vw" alt="" width="400" height="200" decoding="async" loading="lazy"></span>
            <span class="comp-promo-copy"><b>Modo competición 🏆</b><small>Un tema al azar tras otro, sin repetirse. ${ROUND_CARDS} cartas por tema, ${SOLO_LIVES} vidas cada vez.</small></span>
          </button>
        </div>
      </section>
      <p class="app-version" id="app-version"></p>
    </div>`);
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
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section"><h2 data-focus tabindex="-1">${currentMode().name}</h2><p class="lead">Añade hasta 9 personas y marca a la más joven: tendrá el primer turno.</p>
        <div class="panel">
          <div id="players"><div class="player-row"><input aria-label="Nombre del jugador 1" value="Jugador 1" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div><div class="player-row"><input aria-label="Nombre del jugador 2" value="Jugador 2" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div></div>
          <button class="btn btn-ghost" data-action="add-player">＋ Añadir participante</button>
          <div class="setup-grid">
            <div class="field"><label for="starter">La persona más joven</label><select id="starter"><option value="0">Jugador 1</option><option value="1">Jugador 2</option></select></div>
            <div class="field"><label for="hand-size">Cartas iniciales por persona</label><select id="hand-size"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div>
          </div>
          <label class="opt-row"><span>Pulso <small>Una vez por partida, reta a otra persona con una carta del mazo en vez de jugar tu turno.</small></span><input type="checkbox" id="pulse-toggle"></label>
          <button class="btn btn-primary btn-block" style="margin-top:20px" data-action="start">Barajar y empezar <span>→</span></button>
        </div>
      </section>
    </div>`);
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
    const pulse = !!document.getElementById("pulse-toggle")?.checked;
    const shuffled = shuffle(currentMode().cards.map(card => card.id));
    // `pulseUsed` y `shieldRound` solo los mira el Pulso; una partida guardada de antes
    // no los lleva, y sin ellos `undefined` se comporta como «no usado» y «sin escudo»,
    // que es justo lo que hace falta para que siga abriéndose sin migrarla.
    const players = names.map((name, i) => ({ id: i + 1, name, hand: shuffled.splice(0, handSize), pulseUsed: false, shieldRound: 0 }));
    const timeline = [shuffled.shift()];
    game = { mode: selectedModeKey, pulse, players, deck: shuffled, discard: [], timeline, current: starter, starter, turnsInRound: 0, round: 1, winner: null, winners: null, pulseTurn: null, pulseGift: null };
    selectedCardId = null;
    result = null;
    saveGame();
    renderPass();
  }

  function currentPlayer() { return game.players[game.current]; }

  function renderPass() {
    screen = "pass";
    const player = currentPlayer();
    // Quien recibió una carta en el Pulso de otro se entera aquí, al recoger el móvil, y
    // no antes: es su carta y nadie más tiene por qué verla en la pantalla de paso.
    const regalo = game.pulseGift && game.pulseGift.to === player.id
      ? `<p class="pulse-gift">⚡ <b>${escapeHtml(game.pulseGift.from)}</b> te ha pasado <b>${escapeHtml(cardsById.get(game.pulseGift.cardId).title)}</b> con su Pulso.</p>`
      : "";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <section class="pass-screen"><div class="panel pass-card"><div class="player-medallion">${escapeHtml(initials(player.name))}</div><div class="eyebrow">Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}</div><h2 data-focus tabindex="-1">El turno es de<br>${escapeHtml(player.name)}</h2><p>Pásale el móvil. Las fechas siguen ocultas hasta colocar una carta.</p>${regalo}<button class="btn btn-primary btn-block" data-action="ready">Empezar mi turno <span>→</span></button></div></section>
    </div>`);
  }

  function gameView() {
    screen = "game";
    const player = currentPlayer();
    const timelineCards = game.timeline.map(id => cardsById.get(id));
    const handCards = player.hand.map(id => cardsById.get(id));
    const selectedCard = selectedCardId ? cardsById.get(selectedCardId) : null;
    // Durante un Pulso la mano no se toca: la única carta jugable es la que sacó el mazo,
    // así que hace de carta elegida para los huecos, el arrastre y la confirmación.
    const pulseCard = game.pulseTurn ? cardsById.get(game.pulseTurn.cardId) : null;
    const pulseTarget = game.pulseTurn ? game.players.find(item => item.id === game.pulseTurn.targetId) : null;
    const activeCard = pulseCard || selectedCard;
    // Tras un fallo, `result` sigue apuntando a la carta que se acaba de fallar (todavía
    // no se ha pulsado «Terminar turno»): se aprovecha para señalar en la propia línea el
    // hueco donde iba de verdad, justo debajo del aviso que ya lo cuenta con palabras.
    const failIndex = result && !result.correct ? CT.correctIndex(selectedModeKey, timelineCards, result.card) : null;
    const slots = [];
    for (let i = 0; i <= timelineCards.length; i++) {
      slots.push(pendingIndex === i && activeCard
        ? confirmSlot(activeCard)
        : slotMarkup(i, timelineCards.length, pulseCard ? "pulse-place" : "place", pulseCard ? true : !!selectedCardId, i === failIndex));
      if (i < timelineCards.length) {
        slots.push(timelineCardMarkup(timelineCards[i]));
      }
    }
    const manoHtml = pulseCard
      ? `<section><div class="hand-title"><h3>Carta del Pulso</h3><small>contra ${escapeHtml(pulseTarget.name)}</small></div><div class="hand hand-solo"><div class="hand-card selected" data-id="${pulseCard.id}"><span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(pulseCard.title)}</strong></div></div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : "Colócala: si aciertas le pasas una carta tuya, si fallas robas una"}</p></section>`
      : `<section><div class="hand-title"><h3>Tus cartas</h3><small>${player.hand.length} por colocar</small></div><div class="hand">${handCards.map(card => `<button class="hand-card ${selectedCardId === card.id ? "selected" : ""}" data-action="select-card" data-id="${card.id}" aria-pressed="${selectedCardId === card.id}"><span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`).join("")}</div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Elige una carta, o arrástrala hasta un hueco +"}</p>${pulseAvailable(player) ? `<button class="btn btn-secondary btn-block pulse-btn" data-action="pulse-open">⚡ Usar mi Pulso <small>una vez por partida</small></button>` : ""}</section>`;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">Turno de ${escapeHtml(player.name)}, ronda ${game.round}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}</div><div class="turn-name" aria-hidden="true">${escapeHtml(player.name)}</div></div><div class="deck-count"><strong>${game.deck.length}</strong><span>mazo</span></div></div>
      <div class="scoreboard">${game.players.map((p, i) => `<span class="score ${i === game.current ? "active" : ""}"${i === game.current ? ' aria-current="true"' : ""}><i>${escapeHtml(initials(p.name))}</i><b>${escapeHtml(p.name)}</b><em>${p.hand.length}</em></span>`).join("")}</div>
      ${pulseCard ? `<div class="pulse-banner">⚡ Pulso contra <b>${escapeHtml(pulseTarget.name)}</b></div>` : ""}
      <section><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${game.timeline.length} cartas</small></div>${CT.timelineMap(selectedModeKey, timelineCards)}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      ${manoHtml}
    </div>`);
    if (selectedCardId || pulseCard) setTimeout(() => document.querySelector(".timeline-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    if (failIndex !== null) setTimeout(() => CT.scrollToElement(document.querySelector(".timeline-wrap"), document.querySelector(".slot-correct")), 0);
    // Arrastrar una carta hasta un hueco lleva al mismo sitio que tocarla y luego tocar
    // el hueco: a la confirmación. El paso de confirmar se mantiene porque en un móvil
    // el dedo falla y la jugada no debería depender de eso.
    CT.enableDrag({
      cardSelector: ".hand-card", slotSelector: ".slot",
      onDrop: (id, index) => {
        // En un Pulso la carta ya está decidida: arrastrar solo elige el hueco.
        if (!pulseCard) selectedCardId = id;
        pendingIndex = index;
        if (index === null) announce(`Elegida la carta ${cardsById.get(id).title}. Ahora elige un hueco.`);
        else anunciaHueco(index, game.timeline.length);
        gameView();
      }
    });
  }

  function timelineCardMarkup(card) {
    const era = eraForCard(card);
    // El identificador no se ve ni se lee: es el ancla que usa `a11y.js` para no perder
    // el sitio en la línea cuando se repinta la pantalla.
    return `<article class="timeline-card" data-id="${card.id}"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div></article>`;
  }

  // El hueco «+» normal, o el mismo hueco resaltado como el sitio donde iba de verdad la
  // carta que se acaba de fallar. Lo usan tanto la partida como el solitario.
  function slotMarkup(index, total, actionName, enabled, isCorrectSlot) {
    if (isCorrectSlot) {
      return `<button class="slot slot-correct" data-action="${actionName}" data-index="${index}" ${enabled ? "" : "disabled"} aria-label="Aquí iba la carta que acabas de fallar"><span>✦</span><small>Aquí</small></button>`;
    }
    return `<button class="slot" data-action="${actionName}" data-index="${index}" ${enabled ? "" : "disabled"} aria-label="Colocar en la posición ${index + 1} de ${total + 1}"><span>+</span></button>`;
  }

  function confirmSlot(card) {
    return `<div class="slot-confirm"><small>Colocar aquí</small><strong>${escapeHtml(card.title)}</strong>
      <button class="btn btn-primary btn-block" data-action="confirm-place" data-autofocus>Sí, aquí</button>
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
    else if (drawCard(player)) {
      game.discard.push(selectedCardId);
      // Aparte del descarte, que vuelve al mazo y se puede volver a repartir: para el
      // repaso final importa que la carta se falló alguna vez, acierte después o no.
      (game.failed = game.failed || []).push(selectedCardId);
    } else {
      // Sin mazo ni descarte no hay nada que robar: la carta vuelve a la mano.
      player.hand.push(selectedCardId);
      returned = true;
      (game.failed = game.failed || []).push(selectedCardId);
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

  // ---------------------------------------------------------------------------
  // El Pulso
  //
  // Una sola vez por partida, en lugar de jugar tu turno, retas a otra persona: el mazo
  // saca una carta que tú no has elegido y la colocas. Si aciertas, se queda en la línea
  // y le endosas una carta al azar de tu mano; si fallas, va al descarte y robas tú.
  //
  // Tres decisiones que no son obvias:
  //
  // - Fallar castiga solo a quien reta. Si además le quitara una carta al rival, quien ya
  //   no puede ganar podría fallar aposta para acercar a la victoria a quien quisiera:
  //   un jugador eliminado decidiendo la partida. Con el castigo en un solo lado eso
  //   desaparece, y como efecto secundario se puede retar a quien ya está a cero cartas
  //   esperando ganar al final de la ronda, que es la jugada más tensa del mecanismo.
  // - La carta que se entrega va al azar. Si pudieras elegirla soltarías siempre la que
  //   no sabes colocar, y el Pulso dejaría de ser una apuesta para ser un vertedero.
  // - Hacen falta dos cartas para activarlo. Con una sola, ganar el Pulso te dejaría a
  //   cero regalándola, sin haberla colocado nunca en la línea: se saltaría la condición
  //   de victoria del juego.
  //
  // No hay cronómetro a propósito. La dificultad la pone lo llena que esté la línea: al
  // principio los huecos son anchos y aciertas casi seguro, pero es cuando menos daño
  // haces; al final son estrechos y es cuando el Pulso decide la partida.
  const PULSE_MIN_HAND = 2;

  // Quién puede recibir el Pulso: cualquiera menos quien lo lanza y quien ya recibió una
  // carta esta ronda. Sin límite por cartas en mano —incluido quien está a cero.
  function pulseTargets() {
    const me = currentPlayer();
    return game.players.filter(player => player.id !== me.id && player.shieldRound !== game.round);
  }

  function pulseAvailable(player) {
    return !!game.pulse && !player.pulseUsed && player.hand.length >= PULSE_MIN_HAND
      && game.deck.length + game.discard.length > 0 && pulseTargets().length > 0;
  }

  function startPulse(targetId) {
    const player = currentPlayer();
    if (!pulseAvailable(player) || !pulseTargets().some(target => target.id === targetId)) return;
    if (!game.deck.length) {
      game.deck = shuffle(game.discard);
      game.discard = [];
    }
    const cardId = game.deck.shift();
    if (cardId == null) return showToast("No quedan cartas para el Pulso");
    player.pulseUsed = true;
    game.pulseTurn = { targetId, cardId };
    selectedCardId = null;
    pendingIndex = null;
    saveGame();
    gameView();
  }

  function placePulse(index) {
    const player = currentPlayer();
    const { targetId, cardId } = game.pulseTurn;
    const target = game.players.find(item => item.id === targetId);
    const card = cardsById.get(cardId);
    const previous = index > 0 ? cardsById.get(game.timeline[index - 1]) : null;
    const next = index < game.timeline.length ? cardsById.get(game.timeline[index]) : null;
    const correct = (!previous || sortValue(card) >= sortValue(previous)) && (!next || sortValue(card) <= sortValue(next));
    let gift = null;
    if (correct) {
      game.timeline.splice(index, 0, cardId);
      const giftId = player.hand[Math.floor(Math.random() * player.hand.length)];
      player.hand = player.hand.filter(id => id !== giftId);
      target.hand.push(giftId);
      target.shieldRound = game.round;
      // Quien la recibe se entera al empezar su turno, en la pantalla de pasar el móvil.
      game.pulseGift = { to: target.id, cardId: giftId, from: player.name };
      gift = cardsById.get(giftId);
    } else {
      game.discard.push(cardId);
      (game.failed = game.failed || []).push(cardId);
      // Nunca falla: la carta del reto acaba de entrar en el descarte, así que hay al
      // menos una que robar aunque el mazo estuviera vacío.
      drawCard(player);
    }
    game.pulseTurn = null;
    pendingIndex = null;
    result = { correct, card, pulse: true, targetName: target.name, gift };
    saveGame();
    renderResult();
  }

  function pulseTargetMenu() {
    const opciones = pulseTargets().map(target =>
      `<button class="btn btn-secondary btn-block pulse-target" data-action="pulse-target" data-target="${target.id}"><b>${escapeHtml(target.name)}</b><small>${target.hand.length} ${target.hand.length === 1 ? "carta" : "cartas"}</small></button>`).join("");
    const protegidos = game.players.filter(player => player.id !== currentPlayer().id && player.shieldRound === game.round);
    overlay(`<div class="overlay"><div class="modal">
      <div class="eyebrow">Pulso</div>
      <h2>¿A quién retas?</h2>
      <p class="lead" style="margin-inline:auto">El mazo sacará una carta que no eliges tú. Si la colocas bien, le pasas una carta al azar de tu mano; si fallas, robas una y a esa persona no le pasa nada.</p>
      <div class="actions" style="display:grid;margin-top:6px">${opciones}</div>
      ${protegidos.length ? `<p class="hint" style="margin-top:12px">Ya recibieron una carta esta ronda: ${protegidos.map(player => escapeHtml(player.name)).join(", ")}.</p>` : ""}
      <button class="btn btn-ghost btn-block" style="margin-top:10px" data-action="close-menu">Mejor no</button>
    </div></div>`, true);
  }

  function renderResult() {
    gameView();
    const { correct, returned, card } = result;
    const era = eraForCard(card);
    // El hueco resaltado detrás del aviso ya lo enseña; esta frase lo dice también con
    // palabras, que es lo único que le llega a quien usa un lector de pantalla.
    const hint = correct ? "" : `<p>${CT.placementHint(selectedModeKey, game.timeline.map(id => cardsById.get(id)), card)}</p>`;
    const desenlace = result.pulse
      ? (correct
        ? `<p class="pulse-outcome">La carta se queda en la línea. <b>${escapeHtml(result.targetName)}</b> se lleva tu <b>${escapeHtml(result.gift.title)}</b>.</p>`
        : `<p class="pulse-outcome">La carta va al descarte y robas una. A <b>${escapeHtml(result.targetName)}</b> no le pasa nada.</p>`)
      : `<p>${correct ? "La carta se queda en la línea temporal." : returned ? "No quedan cartas que robar, así que esta vuelve a tu mano." : "La carta va al descarte y has robado una nueva."}</p>`;
    overlay(`<div class="overlay"><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark" aria-hidden="true">${correct ? "✓" : "×"}</div><div class="eyebrow" aria-hidden="true">${result.pulse ? "⚡ Pulso · " : ""}${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2><span class="solo-lectores">${correct ? "Bien colocado:" : "No encaja ahí:"} </span>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div>${hint}${desenlace}<button class="btn btn-primary btn-block" data-action="finish-turn">Terminar turno <span>→</span></button></div></div>`);
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
    const fallosUnicos = new Set(game.failed || []).size;
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">🏆</div><div class="eyebrow">Fin de la partida</div><h1 data-focus tabindex="-1" style="font-size:clamp(2.5rem,12vw,4.5rem)">${title}</h1><p class="lead" style="margin-inline:auto">${lead}</p><div class="actions" style="justify-content:center">${fallosUnicos ? `<button class="btn btn-ghost" data-action="review-game">Ver lo que se falló (${fallosUnicos})</button>` : ""}<button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button></div></div></section></div>`);
  }

  // Repasa lo que se falló al terminar: cada fallo se descarta en el momento y nunca se
  // vuelve a ver dónde iba en realidad, así que el juego se queda sin su mejor ocasión
  // para enseñar algo. `items` son pares { id, mode }, no solo identificadores: la
  // competición mezcla fallos de varios temas y cada uno se formatea con las reglas de
  // su propio eje (fecha, superficie o población).
  function reviewScreen(items, actionsHtml) {
    screen = "review";
    const counts = new Map();
    items.forEach(({ id, mode }) => counts.set(id, { mode, veces: (counts.get(id)?.veces || 0) + 1 }));
    const unicos = [...counts.entries()];
    paint(`<div class="shell">${header()}<section>
      <div class="eyebrow">Repaso</div>
      <h1 data-focus tabindex="-1">${unicos.length ? `${unicos.length} ${unicos.length === 1 ? "carta" : "cartas"} para recordar` : "Ninguna carta fallada"}</h1>
      ${unicos.length ? `<div class="review-grid">${unicos.map(([id, { mode, veces }]) => {
        const card = GLOBAL_CARDS_BY_ID.get(id);
        if (!card) return "";
        const era = CT.eraForCard(mode, card);
        return `<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${CT.formatValue(mode, card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p>${veces > 1 ? `<p class="review-count">Fallada ${veces} veces</p>` : ""}</div></article>`;
      }).join("")}</div>` : `<p class="lead">Partida perfecta.</p>`}
      <div class="actions" style="justify-content:center">${actionsHtml}</div>
    </section></div>`);
  }

  const DAILY_CARDS = 15;
  const SOLO_LIVES = 3;
  const RECORDS_KEY = "hilo-retos-v1";
  let solo = null;
  // Los fallos de la última partida en solitario, para poder repasarlos aunque `solo`
  // ya se haya vaciado al terminar.
  let soloFailedForReview = [];
  // El texto para compartir el reto diario, por la misma razón: se construye antes de
  // vaciar `solo` y el botón de compartir vive en la pantalla siguiente.
  let lastShareText = null;

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

  // Un identificador estable y anónimo. Vive en su propia clave, generado una sola vez,
  // porque es del jugador y no de un mazo — `records` en cambio se indexa por modalidad.
  // Se copia además dentro del registro de cada modalidad (más abajo) para que un futuro
  // marcador entre amigos no tenga que cruzar dos claves de almacenamiento para asociar
  // una marca con quién la hizo. No identifica a nadie ni sale de este móvil todavía.
  const PLAYER_KEY = "hilo-jugador-v1";

  function playerId() {
    try {
      let id = localStorage.getItem(PLAYER_KEY);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(PLAYER_KEY, id);
      }
      return id;
    } catch { return null; }
  }

  function saveSolo() {
    // La competición no se guarda: cada ronda cambia de tema y, con él, de modalidad
    // seleccionada, así que su clave de guardado (soloKey, atada a esa modalidad)
    // pisaría la partida libre o el reto diario que hubiera guardados en ese tema.
    if (solo && solo.kind === "comp") return;
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

  const CALENDARIO_DIAS = 28;

  // Las últimas cuatro semanas del reto diario, un cuadrito por día. La racha ya se ve
  // como número; esto enseña su forma: dónde hay huecos y qué tan bien fue cada intento.
  function calendarHtml(records) {
    const days = records.days || {};
    const celdas = [];
    for (let i = CALENDARIO_DIAS - 1; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const clave = fecha.toLocaleDateString("sv-SE");
      const entrada = days[clave];
      const ratio = entrada ? entrada.hits / entrada.total : null;
      const nivel = ratio === null ? "vacio" : ratio >= 0.8 ? "alto" : ratio >= 0.5 ? "medio" : "bajo";
      const fechaLegible = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
      const etiqueta = entrada ? `${fechaLegible}: ${entrada.hits} de ${entrada.total}` : `${fechaLegible}: sin jugar`;
      celdas.push(`<span class="cal-day cal-${nivel}" title="${escapeHtml(etiqueta)}" aria-label="${escapeHtml(etiqueta)}"></span>`);
    }
    return `<div class="cal-grid" role="img" aria-label="Calendario de los últimos ${CALENDARIO_DIAS} días del reto diario">${celdas.join("")}</div>`;
  }

  function soloHome() {
    screen = "solo-home";
    solo = loadSolo();
    pendingIndex = null;
    const records = modeRecords();
    const doneToday = records.days && records.days[today()];
    const mode = currentMode();
    const pendiente = solo && solo.kind === "free";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section"><div class="eyebrow"><span class="eyebrow-line"></span> ${mode.name}</div><h2 data-focus tabindex="-1">Jugar en solitario</h2>
        <p class="lead">Coloca las cartas tú solo. Tienes ${SOLO_LIVES} vidas: cada fallo te cuesta una.</p>
        <div class="panel solo-panel">
          <div class="section-label">Reto diario <small>${today().split("-").reverse().join("/")}</small></div>
          ${doneToday
            ? `<p class="solo-done">Hoy ya lo has jugado: <strong>${doneToday.hits} de ${doneToday.total}</strong>. Vuelve mañana.</p>`
            : `<p>Las mismas ${DAILY_CARDS} cartas para todo el mundo, un intento al día.</p><button class="btn btn-primary btn-block" data-action="start-daily">Jugar el reto de hoy <span>→</span></button>`}
          <div class="solo-stats"><span><b>${records.streak || 0}</b><small>días seguidos</small></span><span><b>${records.best || 0}</b><small>mejor marca libre</small></span></div>
          ${calendarHtml(records)}
        </div>
        <div class="panel solo-panel">
          <div class="section-label">Partida libre</div>
          <p>El mazo entero, sin límite de cartas: aguanta lo que puedas.</p>
          ${pendiente ? `<button class="btn btn-primary btn-block" data-action="resume-solo">Continuar la partida <span>→</span></button>` : ""}
          <button class="btn ${pendiente ? "btn-secondary" : "btn-primary"} btn-block" data-action="start-free">${pendiente ? "Empezar otra" : "Empezar"}</button>
        </div>
      </section>
    </div>`);
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
    const failIndex = result && !result.correct ? CT.correctIndex(selectedModeKey, timelineCards, result.card) : null;
    const slots = [];
    for (let i = 0; i <= timelineCards.length; i++) {
      slots.push(pendingIndex === i
        ? confirmSlot(card)
        : slotMarkup(i, timelineCards.length, "solo-place", true, i === failIndex));
      if (i < timelineCards.length) slots.push(timelineCardMarkup(timelineCards[i]));
    }
    const restantes = solo.total ? solo.total - solo.played : solo.deck.length + 1;
    const etiqueta = soloLabel();
    paint(`<div class="shell">${header(`<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="${solo.kind === "comp" ? "abandon-comp" : "solo-menu"}">Salir</button>`)}
      <h1 class="solo-lectores" data-focus tabindex="-1">${etiqueta}: ${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}, ${solo.lives} ${solo.lives === 1 ? "vida" : "vidas"}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">${etiqueta}</div><div class="turn-name" aria-hidden="true">${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}</div></div><div class="deck-count"><strong>${restantes}</strong><span>por colocar</span></div></div>
      <div class="solo-lives" aria-label="Vidas restantes: ${solo.lives}">${"♥".repeat(solo.lives)}${"♡".repeat(SOLO_LIVES - solo.lives)}</div>
      <section><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${solo.timeline.length} cartas</small></div>${CT.timelineMap(selectedModeKey, timelineCards)}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      <section><div class="hand-title"><h3>Tu carta</h3></div><div class="hand hand-solo"><div class="hand-card selected" data-id="${card.id}"><span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(card.title)}</strong></div></div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : "Arrastra la carta hasta un hueco, o tócalo directamente"}</p></section>
    </div>`);
    if (failIndex !== null) setTimeout(() => CT.scrollToElement(document.querySelector(".timeline-wrap"), document.querySelector(".slot-correct")), 0);
    CT.enableDrag({
      cardSelector: ".hand-card", slotSelector: ".slot",
      onDrop: (id, index) => {
        pendingIndex = index;
        if (index !== null) anunciaHueco(index, solo.timeline.length);
        soloView();
      }
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
      (solo.failed = solo.failed || []).push(solo.current);
    }
    solo.played += 1;
    // Un acierto o un fallo por carta, en el orden en que se jugaron: es lo único que
    // hace falta para dibujar la cuadrícula de aciertos al compartir el reto diario.
    (solo.sequence = solo.sequence || []).push(correct);
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
    const hint = correct ? "" : `<p>${CT.placementHint(selectedModeKey, solo.timeline.map(id => cardsById.get(id)), card)}</p>`;
    overlay(`<div class="overlay"><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark" aria-hidden="true">${correct ? "✓" : "×"}</div><div class="eyebrow" aria-hidden="true">${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2><span class="solo-lectores">${correct ? "Bien colocado:" : "No encaja ahí:"} </span>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div>${hint}<p>${correct ? "La carta se queda colocada." : `Fallo: te quedan ${solo.lives} ${solo.lives === 1 ? "vida" : "vidas"}.`}</p><button class="btn btn-primary btn-block" data-action="solo-next">${acabada ? "Ver el resultado" : "Siguiente carta"} <span>→</span></button></div></div>`);
  }

  function soloNext() {
    result = null;
    if (solo.lives === 0 || !solo.deck.length || (solo.total && solo.played >= solo.total)) return soloFinish();
    solo.current = solo.deck.shift();
    saveSolo();
    soloView();
  }

  function soloFinish() {
    if (solo.kind === "comp") return compRoundFinish();
    screen = "solo-end";
    const total = solo.total || solo.played;
    const records = modeRecords();
    // Se guarda con cada marca, no solo al crearlo, para que una instalación que ya
    // tenía partidas antes de este cambio acabe teniendo el suyo igual.
    records.playerId = records.playerId || playerId();
    const dia = today();
    const esReto = solo.kind === "daily" && !(records.days && records.days[dia]);
    if (esReto) {
      records.days = records.days || {};
      // `sequence` y `finishedAt` no los usa nada todavía: son lo que necesitaría un
      // marcador entre amigos del reto diario si algún día existe, guardado desde ya
      // para no depender de reconstruirlo a partir de partidas viejas que no lo llevan.
      records.days[dia] = { hits: solo.hits, total, sequence: solo.sequence || [], finishedAt: new Date().toISOString() };
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
    soloFailedForReview = (solo.failed || []).map(id => ({ id, mode: solo.mode }));
    const compartir = solo.kind === "daily" ? shareText(currentMode().name, dia, solo.hits, total, solo.sequence || [], records.streak) : null;
    solo.finished = true;
    saveSolo();
    solo = null;
    const fallosUnicos = new Set(soloFailedForReview.map(item => item.id)).size;
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">${superado ? "🏅" : "🎯"}</div><div class="eyebrow">${superado ? "Reto completado" : "Se acabaron las vidas"}</div><h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${resumen}</h1><div class="actions" style="justify-content:center">${compartir ? `<button class="btn btn-secondary" data-action="share-daily">Compartir resultado</button>` : ""}${fallosUnicos ? `<button class="btn btn-ghost" data-action="review-solo">Ver lo que se falló (${fallosUnicos})</button>` : ""}<button class="btn btn-primary" data-action="solo">Volver a solitario</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button></div></div></section></div>`);
    lastShareText = compartir;
  }

  // Un resumen al estilo Wordle: cuenta el resultado sin revelar ninguna carta, así que
  // se puede compartir sin destriparle el reto a quien todavía no lo ha jugado.
  function shareText(modeName, dia, hits, total, sequence, streak) {
    const grid = sequence.map(ok => (ok ? "🟩" : "⬜")).join("");
    const fecha = dia.split("-").reverse().join("/");
    const rachaLinea = streak > 1 ? `\n🔥 racha de ${streak} días` : "";
    return `Continuum · ${modeName} · reto diario ${fecha}\n📊 ${hits}/${total}${rachaLinea}\n${grid}`;
  }

  async function shareDaily() {
    if (!lastShareText) return;
    if (navigator.share) {
      try { await navigator.share({ text: lastShareText }); return; } catch { /* cancelado, se intenta copiar */ }
    }
    try {
      await navigator.clipboard.writeText(lastShareText);
      showToast("Resultado copiado");
    } catch {
      showToast("No se pudo compartir");
    }
  }

  // Competición: una ronda de ROUND_CARDS cartas por cada modalidad ya establecida, en
  // un orden al azar y sin repetir ninguna, todas con el mismo motor de colocar-una-a-
  // una que el solitario (`solo`, con kind: "comp"). Lo único propio de la competición
  // vive en `comp`: qué temas quedan por jugar y el marcador acumulado de las rondas ya
  // resueltas.
  //
  // No se guarda en `localStorage`: cada ronda cambia la modalidad seleccionada, y esa
  // modalidad es la que decide dónde se guardan las partidas normales de solitario. Si
  // la competición sobreviviera a un cierre de la aplicación, arrastraría esa modalidad
  // cambiada consigo. Se pierde si se recarga la página a mitad, igual que se perdería
  // una mano de cartas repartida y no anotada en cualquier juego de mesa.
  const ROUND_CARDS = 5;
  // «Gran mezcla temporal» no es un género propio: combina los demás mazos con eje temporal.
  // Un tema de
  // competición que sea «un poco de todo lo anterior» no aporta nada nuevo a la ronda, así
  // que se excluye de la rotación.
  const COMP_MODES = Object.keys(CT.MODES).filter(key => key !== "mixed");
  const TOTAL_TEMAS = COMP_MODES.length;
  let comp = null;
  let previousModeKey = null;

  function soloLabel() {
    if (solo.kind === "daily") return "Reto diario";
    if (solo.kind === "comp") return `Competición · tema ${TOTAL_TEMAS - comp.queue.length} de ${TOTAL_TEMAS}`;
    return "Partida libre";
  }

  function startCompetition() {
    previousModeKey = selectedModeKey;
    comp = { queue: shuffle(COMP_MODES), roundsSummary: [], totalHits: 0, totalFailed: [] };
    compRoundIntro();
  }

  function compRoundIntro() {
    screen = "comp-intro";
    const mode = CT.mode(comp.queue[0]);
    const numero = TOTAL_TEMAS - comp.queue.length + 1;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="abandon-comp">Salir</button>')}<section class="pass-screen"><div class="panel pass-card">
      <div class="eyebrow">Competición · Tema ${numero} de ${TOTAL_TEMAS}</div>
      <h2 data-focus tabindex="-1">${mode.name}</h2>
      <p>${mode.blurb} ${ROUND_CARDS} cartas, ${SOLO_LIVES} vidas nuevas.</p>
      ${comp.roundsSummary.length ? `<div class="solo-stats" style="grid-template-columns:1fr"><span><b>${comp.totalHits}</b><small>aciertos hasta ahora</small></span></div>` : ""}
      <button class="btn btn-primary btn-block" data-action="comp-next-round">Empezar <span>→</span></button>
    </div></section></div>`);
  }

  function beginCompRound() {
    const modeKey = comp.queue.shift();
    selectedModeKey = modeKey;
    cardsById = new Map(CT.cards(modeKey).map(card => [card.id, card]));
    const barajado = shuffle(CT.cards(modeKey).map(card => card.id)).slice(0, ROUND_CARDS + 1);
    const timeline = [barajado.shift()];
    solo = {
      kind: "comp", mode: modeKey, timeline, deck: barajado,
      current: barajado.shift(), lives: SOLO_LIVES, hits: 0, played: 0,
      total: ROUND_CARDS, finished: false, failed: []
    };
    pendingIndex = null;
    result = null;
    soloView();
  }

  function compRoundFinish() {
    comp.roundsSummary.push({ mode: solo.mode, hits: solo.hits, total: solo.total });
    comp.totalHits += solo.hits;
    comp.totalFailed.push(...(solo.failed || []).map(id => ({ id, mode: solo.mode })));
    solo = null;
    if (comp.queue.length) compRoundIntro();
    else compFinish();
  }

  function compFinish() {
    screen = "comp-end";
    selectedModeKey = previousModeKey;
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    const totalCards = comp.roundsSummary.length * ROUND_CARDS;
    const fallosUnicos = new Set(comp.totalFailed.map(item => item.id)).size;
    const filas = comp.roundsSummary.map(r => `<li><b>${escapeHtml(CT.mode(r.mode).name)}</b><span>${r.hits} de ${r.total}</span></li>`).join("");
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel">
      <div class="big-icon">🏆</div>
      <div class="eyebrow">Competición terminada</div>
      <h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${comp.totalHits} de ${totalCards} en total</h1>
      <ul class="comp-summary">${filas}</ul>
      <div class="actions" style="justify-content:center">${fallosUnicos ? `<button class="btn btn-ghost" data-action="review-comp">Ver lo que se falló (${fallosUnicos})</button>` : ""}<button class="btn btn-primary" data-action="start-competition">Jugar otra vez</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button></div>
    </div></section></div>`);
  }

  // Salir a mitad de una competición no debe dejar la modalidad cambiada puesta: se
  // restaura la de antes de empezar, igual que hace `compFinish` al terminarla entera.
  function abandonCompetition() {
    selectedModeKey = previousModeKey;
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    solo = null;
    comp = null;
    home();
  }

  function rules() {
    const returnTo = screen;
    const context = comp ? "competition" : solo ? "solo" : "local";
    const modeKey = game?.mode || solo?.mode || selectedModeKey;
    overlay(`<div class="overlay" data-overlay="rules"><div class="modal rules"><div class="guide-content">${CT.guideMarkup(modeKey, context, { pulse: !!game?.pulse })}</div><button class="btn btn-primary btn-block" data-action="close-rules" data-return="${returnTo}">Entendido</button></div></div>`, true);
  }

  function gameMenu() {
    overlay(`<div class="overlay"><div class="modal"><div class="eyebrow">Partida en pausa</div><h2>¿Qué quieres hacer?</h2><div class="actions" style="display:grid"><button class="btn btn-primary" data-action="close-menu">Seguir jugando</button><button class="btn btn-secondary" data-action="rules">Ver la guía</button><button class="btn btn-ghost" data-action="abandon">Abandonar partida</button></div></div></div>`, true);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  async function launchOnline(roomCode = "") {
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="spinner"></div><h2 data-focus tabindex="-1">Conectando la sala</h2><p>Preparando el modo multijugador…</p></div></section></div>`);
    try {
      const online = await import("./online.js");
      await online.openOnlineMode({ roomCode, modeKey: selectedModeKey });
    } catch (error) {
      console.error(error);
      showToast("No se pudo conectar. Comprueba tu conexión a internet.");
      home();
    }
  }

  // Colocar es la única acción cuyo resultado no se ve en ningún titular: hay que decirlo.
  function anunciaHueco(index, cartas) {
    announce(`Hueco ${index + 1} de ${cartas + 1} elegido. Confirma o elige otro.`);
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
    else if (action === "ready") { if (game.pulseGift && game.pulseGift.to === currentPlayer().id) { game.pulseGift = null; saveGame(); } gameView(); }
    else if (action === "select-card") {
      selectedCardId = Number(target.dataset.id);
      pendingIndex = null;
      announce(`Elegida la carta ${cardsById.get(selectedCardId).title}. Ahora elige un hueco.`);
      gameView();
    }
    else if (action === "place") { pendingIndex = Number(target.dataset.index); anunciaHueco(pendingIndex, game.timeline.length); gameView(); }
    else if (action === "confirm-place") { screen === "solo" ? soloPlace(pendingIndex) : game.pulseTurn ? placePulse(pendingIndex) : placeCard(pendingIndex); }
    else if (action === "cancel-place") { pendingIndex = null; screen === "solo" ? soloView() : gameView(); }
    else if (action === "finish-turn") finishTurn();
    else if (action === "solo") soloHome();
    else if (action === "start-daily") startSolo("daily");
    else if (action === "start-free") startSolo("free");
    else if (action === "resume-solo") { solo = loadSolo(); pendingIndex = null; solo ? soloView() : soloHome(); }
    else if (action === "solo-place") { pendingIndex = Number(target.dataset.index); anunciaHueco(pendingIndex, solo.timeline.length); soloView(); }
    else if (action === "solo-next") soloNext();
    else if (action === "solo-menu") soloHome();
    else if (action === "rules") rules();
    else if (action === "close-rules") CT.closeDialog();
    else if (action === "game-menu") gameMenu();
    else if (action === "close-menu") CT.closeDialog();
    else if (action === "abandon") { game = null; saveGame(); home(); }
    else if (action === "pulse-open") pulseTargetMenu();
    else if (action === "pulse-target") { CT.closeDialog(); startPulse(Number(target.dataset.target)); }
    else if (action === "pulse-place") { pendingIndex = Number(target.dataset.index); anunciaHueco(pendingIndex, game.timeline.length); gameView(); }
    else if (action === "review-game") reviewScreen((game.failed || []).map(id => ({ id, mode: game.mode })), `<button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button>`);
    else if (action === "review-solo") reviewScreen(soloFailedForReview, `<button class="btn btn-primary" data-action="solo">Volver a solitario</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button>`);
    else if (action === "share-daily") shareDaily();
    else if (action === "review-comp") reviewScreen(comp.totalFailed, `<button class="btn btn-primary" data-action="start-competition">Jugar otra vez</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button>`);
    else if (action === "start-competition") startCompetition();
    else if (action === "comp-next-round") beginCompRound();
    else if (action === "abandon-comp") abandonCompetition();
  });

  // `skipWaiting` y `clients.claim`, en el propio service worker, hacen que la versión
  // nueva tome el control sin esperar a cerrar la pestaña. Pero eso no basta: la página ya
  // abierta sigue ejecutando el código antiguo hasta que se recarga, así que sin esta
  // línea la actualización llega pero no se ve —exactamente lo que pasa en una PWA
  // instalada, donde «entrar y salir» a veces reanuda la misma pestaña en vez de abrir
  // una de verdad—. En cuanto cambia quién controla la página, se recarga sola.
  //
  // Y como el navegador no siempre comprueba si hay una versión nueva por su cuenta al
  // reabrir la aplicación, se le pide explícitamente cada vez que vuelve a primer plano:
  // así una actualización ya subida a GitHub Pages no depende de que el navegador decida
  // por sí mismo cuándo mirar.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      const registro = await navigator.serviceWorker.register("service-worker.js");
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registro.update();
      });
    });
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });
  }
  const invitedRoom = new URLSearchParams(location.search).get("room") || "";
  if (invitedRoom) launchOnline(invitedRoom);
  else home();
})();
