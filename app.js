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
  // Estado de la enciclopedia: qué mazo se consulta, la búsqueda y el filtro de banda en
  // curso, y qué carta destacar al llegar desde el repaso de una carta fallada.
  let encMode = null;
  let encQuery = "";
  let encBand = "all";
  let encHighlight = null;
  // La portada empieza mostrando la colección, no un mazo abierto. Un toque descubre
  // una categoría y enseña directamente los mazos que contiene.
  let collectionOpen = false;
  let collectionDetails = false;

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

  // Cada carta del mazo de peso tiene una lámina propia. Se enlazan por ID para que un
  // retoque del título o del valor no pueda cambiar por accidente la ilustración.
  const ANIMAL_ART_BY_ID = {
    10001: "bee", 10002: "monarch-butterfly", 10003: "mantis", 10004: "green-tree-frog",
    10005: "house-mouse", 10007: "rock-pigeon", 10008: "guinea-pig", 10009: "european-hare",
    10010: "cat", 10011: "fox", 10012: "european-beaver", 10013: "iberian-lynx",
    10014: "great-dane", 10015: "gray-wolf", 10016: "capybara", 10017: "chimpanzee",
    10018: "giant-panda", 10019: "american-black-bear", 10020: "lion", 10021: "bengal-tiger",
    10022: "grevys-zebra", 10023: "domestic-horse", 10024: "alaska-moose", 10025: "american-bison",
    10026: "giraffe", 10027: "common-hippopotamus", 10028: "white-rhinoceros",
    10029: "southern-elephant-seal", 10030: "elephant", 10031: "whale-shark", 10032: "orca",
    10034: "humpback-whale", 10035: "sperm-whale", 10038: "blue-whale", 10039: "octopus",
    10040: "flamingo", 10041: "penguin", 10042: "kangaroo", 10043: "nile-crocodile",
    10044: "polar-bear", 10045: "dromedary-camel"
  };

  // Las láminas no contienen cifras, por lo que pueden verse en la mano sin revelar el
  // peso que hay que ordenar.
  function animalArt(card) {
    if (selectedModeKey !== "animals") return "";
    const plate = ANIMAL_ART_BY_ID[card.id];
    if (!plate) return "";
    return `<img class="animal-card-art" src="assets/animal-cards/${plate}.webp" alt="" width="512" height="768" decoding="async" loading="lazy">`;
  }

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
  // unos pocos píxeles de ancho y además va en gris y oscurecido: basta con 400;
  // la carátula abierta usa 700 para conservar detalle.
  //
  // Se decide aquí y no con `sizes`, que no sabe nada del panel que está abierto: al
  // desplegar otro bloque se actualiza su imagen sin destruir la galería.
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
    return `<div class="gallery" role="group" aria-label="Elige una colección">${Object.values(CT.BLOCKS).map(item => {
      const active = collectionOpen && item.key === selectedBlockKey;
      const total = item.games.length;
      const instruction = active ? "Mazos visibles debajo." : "Toca para ampliar y ver sus mazos.";
      const mazos = active && collectionDetails
        ? `<div class="collection-decks"><h2 data-focus tabindex="-1">${item.name}</h2><p class="lead">Elige un mazo para continuar.</p>${gameList()}</div>`
        : "";
      return `<div class="collection-entry${active ? " active" : ""}"><button class="gallery-panel panel-${item.art}${active ? " active" : ""}" data-action="set-block" data-block="${item.key}" aria-pressed="${active}" aria-label="${item.name}, ${total} ${total === 1 ? "juego" : "juegos"}. ${instruction}">
        <span class="panel-art" aria-hidden="true">${blockArt(item.art, active)}</span>
        <span class="panel-spine" aria-hidden="true"><i>${item.icon}</i><b>${item.name}</b></span>
        <span class="panel-label" aria-hidden="true"><i></i><strong>${item.name}</strong><small>${item.tagline}</small></span>
      </button>${mazos}</div>`;
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

  // Los iconos son trazos propios, no una librería externa: no añaden una descarga ni
  // rompen el uso sin conexión. El texto sigue siendo el nombre accesible de cada modo.
  function playIcon(kind) {
    const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if (kind === "local") return `<svg ${common}><rect x="7" y="2.75" width="10" height="18.5" rx="2.2"></rect><path d="M10.5 18h3"></path></svg>`;
    if (kind === "online") return `<svg ${common}><rect x="3" y="6" width="10" height="15" rx="2"></rect><rect x="11" y="2.75" width="10" height="15" rx="2"></rect><path d="M14 14.75h4"></path></svg>`;
    if (kind === "deck") return `<svg ${common}><path d="M12 6.6C10.4 5.3 8.5 4.7 6 4.7v12.9c2.5 0 4.4.6 6 1.9 1.6-1.3 3.5-1.9 6-1.9V4.7c-2.5 0-4.4.6-6 1.9Z"></path><path d="M12 6.6v12.9"></path></svg>`;
    return `<svg ${common}><circle cx="12" cy="8" r="3.25"></circle><path d="M5.5 21c.8-4.05 3.05-6 6.5-6s5.7 1.95 6.5 6"></path></svg>`;
  }

  function playChoices(resume) {
    return `<section class="play-choices" aria-labelledby="play-choices-title"><div class="play-choices-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Elegir formato</div><h2 id="play-choices-title">¿Cómo quieres jugar?</h2></div></div><div class="play-choice-grid">
      <button class="play-choice primary" data-action="setup"><span class="choice-icon">${playIcon("local")}</span><span><b>Un solo móvil</b><small>Pasad el teléfono en cada turno.</small></span><i aria-hidden="true">→</i></button>
      <button class="play-choice" data-action="online"><span class="choice-icon">${playIcon("online")}</span><span><b>Varios móviles</b><small>Cada persona juega desde su pantalla.</small></span><i aria-hidden="true">→</i></button>
      <button class="play-choice" data-action="solo"><span class="choice-icon">${playIcon("solo")}</span><span><b>Jugar solo</b><small>Reto diario o partida libre.</small></span><i aria-hidden="true">→</i></button>
      ${resume ? '<button class="continue-choice" data-action="continue">Continuar la partida guardada <span>→</span></button>' : ""}
    </div></section>`;
  }

  // Consultar el mazo no es una forma de jugar, así que no comparte fila con los
  // formatos ni se cuela como un botón más de la cabecera: va debajo, con sitio para
  // decir de cuántas cartas habla. Sin artículo delante del recuento: `cardLabel`
  // cambia de género según el mazo («hechos», «películas», «pares»).
  function deckBrowse() {
    const mode = currentMode();
    return `<button class="deck-browse" data-action="enciclopedia">
      <span class="choice-icon">${playIcon("deck")}</span>
      <span><b>Enciclopedia</b><small>Consulta sus ${mode.cards.length} ${escapeHtml(mode.cardLabel)}, con su valor y su explicación.</small></span>
      <i aria-hidden="true">→</i>
    </button>`;
  }

  function competitionPromo() {
    return `<button class="comp-promo" data-action="start-competition">
      <span class="comp-promo-art"><img src="assets/hero-competicion-400.webp" srcset="assets/hero-competicion-400.webp 400w, assets/hero-competicion-700.webp 700w" sizes="(min-width: 700px) 340px, 100vw" alt="" width="400" height="200" decoding="async" loading="lazy"></span>
      <span class="comp-promo-copy"><b>Modo competición 🏆</b><small>Un tema al azar tras otro, sin repetirse. ${ROUND_CARDS} cartas por tema, ${SOLO_LIVES} vidas cada vez.</small></span>
    </button>`;
  }

  function homeMasthead() {
    return `<section class="home-masthead" aria-label="Continuum, un juego para ordenar y comparar">
      <div class="home-crest" aria-hidden="true"><img src="assets/hero-history-400.webp" alt="" width="400" height="267" decoding="async" fetchpriority="high"></div>
      <div class="home-wordmark">Continuum</div>
      <div class="home-tagline">Ordena. Compara. Descubre.</div>
      <div class="home-ornament" aria-hidden="true"><span></span><i></i><span></span></div>
      <p>Coloca las cartas en el orden correcto<br>y construye la línea del tiempo.</p>
    </section>`;
  }

  // El perfil entra por aquí y no por la cabecera: es un destino de la portada, como la
  // colección, y la barra de arriba ya tiene su trabajo con las acciones de cada pantalla.
  function homeNav() {
    return `<nav class="home-nav" aria-label="Navegación de inicio">
      <button data-action="home-top" aria-label="Ir al inicio"><span aria-hidden="true">⌂</span><small>Inicio</small></button>
      <button data-action="home-collection" aria-label="Ir a la colección de mazos"><span aria-hidden="true">▣</span><small>Colección</small></button>
      <button data-action="perfil" aria-label="Ver tu perfil"><span aria-hidden="true">★</span><small>Perfil</small></button>
      <button data-settings-action="open" aria-label="Abrir ajustes"><span aria-hidden="true">⚙</span><small>Ajustes</small></button>
    </nav>`;
  }

  function home() {
    screen = "home";
    paint(`<div class="shell home-shell">${header('<button class="icon-btn" data-action="rules">Guía</button>')}
      ${homeMasthead()}<section class="hero"><div class="hero-copy"><section class="deck-collection" id="deck-collection"><div class="collection-heading"><div class="eyebrow"><span class="eyebrow-line"></span> Explora los mazos</div><h2>Colección</h2></div>${gallery()}</section></div></section>
      ${homeNav()}
      <p class="app-version" id="app-version"></p>
    </div>`);
    showCacheVersion();
  }

  // Se llega aquí con un mazo ya elegido, así que es el sitio natural para ojearlo
  // entero antes de decidir cómo jugarlo.
  function playMenu() {
    screen = "play-menu";
    const resume = game && game.mode === selectedModeKey;
    const block = CT.block(selectedBlockKey);
    const art = BLOCK_ART[block.art];
    paint(`<div class="shell home-shell play-menu-shell">${header('<button class="icon-btn" data-action="collection-back">Volver</button>')}
      <section class="mode-masthead"><img src="assets/${art.archivo}-700.webp" alt="" width="700" height="${art.alto[700]}" decoding="async"><div><div class="eyebrow">${block.name}</div><h1 data-focus tabindex="-1">${currentMode().name}</h1><p>${currentMode().blurb}</p></div></section>
      <section class="home-play">${playChoices(resume)}${deckBrowse()}${competitionPromo()}</section>
    </div>`);
    window.scrollTo(0, 0);
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
          <label class="opt-row"><span>Cartas Fantasma <small>Esconde de 1 a 3 Fantasmas según los jugadores. Pueden salir al repartir o robar, o quedarse sin descubrir. Se guardan aparte y no cuentan para ganar.</small></span><input type="checkbox" id="ghost-toggle" checked></label>
          <label class="opt-row"><span>Cartas Pulso <small>Esconde de 1 a 3 poderes Pulso con el mismo reparto que Fantasma.</small></span><input type="checkbox" id="pulse-toggle"></label>
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
    const requestedHand = Number(document.getElementById("hand-size").value);
    const handSize = Math.min(requestedHand, Math.floor((currentMode().cards.length - 1) / names.length));
    if (handSize < requestedHand) showToast(`Mazo pequeño: ${handSize} cartas por persona para reservar el tablero.`);
    const starter = Number(document.getElementById("starter").value);
    const ghost = !!document.getElementById("ghost-toggle")?.checked;
    const pulse = !!document.getElementById("pulse-toggle")?.checked;
    const shuffled = shuffle(currentMode().cards.map(card => card.id));
    // `pulseUsed` y `shieldRound` solo los mira el Pulso; una partida guardada de antes
    // no los lleva, y sin ellos `undefined` se comporta como «no usado» y «sin escudo»,
    // que es justo lo que hace falta para que siga abriéndose sin migrarla.
    const powers = CT.Powers.create(shuffled, names.length, handSize, ghost, pulse);
    const players = names.map((name, i) => ({ id: i + 1, name, hand: shuffled.splice(0, handSize), pulseUsed: false, shieldRound: 0 }));
    const timeline = [shuffled.shift()];
    players.forEach(p => p.hand.forEach(id => CT.Powers.claim(powers, id, p.id, shuffled)));
    game = { mode: selectedModeKey, pulse, ...powers, players, deck: shuffled, discard: [], timeline, current: starter, starter, turnsInRound: 0, round: 1, winner: null, winners: null, pulseTurn: null, pulseGift: null };
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
    const nuevaSeleccion = activeCard && app.querySelector(".hand-card.selected")?.dataset.id !== String(activeCard.id);
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
        slots.push(timelineCardMarkup(timelineCards[i], !!game.ghost?.pending.length));
      }
    }
    const manoHtml = pulseCard
      ? `<section><div class="hand-title"><h3>Carta del Pulso</h3><small>contra ${escapeHtml(pulseTarget.name)}</small></div><div class="hand hand-solo"><div class="hand-card selected ${selectedModeKey === "animals" ? "animal-hand-card" : ""}" data-id="${pulseCard.id}">${animalArt(pulseCard)}<span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(pulseCard.title)}</strong></div></div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : "Colócala: si aciertas le pasas una carta tuya, si fallas robas una"}</p></section>`
      : `<section><div class="hand-title"><h3>Tus cartas</h3><small>${player.hand.length} por colocar</small></div><div class="hand">${handCards.map(card => `<button class="hand-card ${selectedCardId === card.id ? "selected" : ""} ${selectedModeKey === "animals" ? "animal-hand-card" : ""}" data-action="select-card" data-id="${card.id}" aria-pressed="${selectedCardId === card.id}">${animalArt(card)}<span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`).join("")}</div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Elige una carta, o arrástrala hasta un hueco +"}</p>${!game.pulsePower && pulseAvailable(player) ? `<button class="btn btn-secondary btn-block pulse-btn" data-action="pulse-open">⚡ Usar mi Pulso <small>una vez por partida</small></button>` : ""}</section>`;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">Turno de ${escapeHtml(player.name)}, ronda ${game.round}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}</div><div class="turn-name" aria-hidden="true">${escapeHtml(player.name)}</div></div><div class="deck-count"><strong>${game.deck.length}</strong><span>mazo</span></div></div>
      <div class="scoreboard">${game.players.map((p, i) => `<span class="score ${i === game.current ? "active" : ""}"${i === game.current ? ' aria-current="true"' : ""}><i>${escapeHtml(initials(p.name))}</i><b>${escapeHtml(p.name)}</b><em>${p.hand.length}</em></span>`).join("")}</div>
      ${pulseCard ? `<div class="pulse-banner">⚡ Pulso contra <b>${escapeHtml(pulseTarget.name)}</b></div>` : ""}
      ${CT.Ghost.banner(game.ghost, game.players)}
      <section><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${game.timeline.length} cartas</small></div>${CT.timelineMap(selectedModeKey, timelineCards, { hidden: !!game.ghost?.pending.length })}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      ${manoHtml}
      ${!game.pulseTurn && !result ? CT.Ghost.power(game.ghost, player.id, game.timeline.length, player.hand.length, 'data-action="ghost-use"') : ""}
      ${!game.pulseTurn && !result ? CT.Powers.pulsePower(game.pulsePower, player.id, player.hand.length, 'data-action="pulse-open"', !game.ghost?.fresh && game.deck.length + game.discard.length > 0 && pulseTargets().length > 0) : ""}
    </div>`);
    if (nuevaSeleccion) {
      const linea = app.querySelector(".timeline-wrap");
      setTimeout(() => {
        // Un cambio de hueco o pantalla puede haber sustituido la mesa antes del frame.
        if (!linea?.isConnected) return;
        const rect = linea.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        linea.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      }, 0);
    }
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

  function timelineCardMarkup(card, hidden = false) {
    if (hidden) return CT.Ghost.hiddenCard(card);
    const era = eraForCard(card);
    // El identificador no se ve ni se lee: es el ancla que usa `a11y.js` para no perder
    // el sitio en la línea cuando se repinta la pantalla.
    const animal = selectedModeKey === "animals";
    return `<article class="timeline-card ${animal ? "animal-timeline-card" : ""}" data-id="${card.id}"><div class="card-visual era-${era.key}">${animal ? animalArt(card) : `<span>${era.symbol}</span><small>${era.name}</small>`}</div><div class="card-content"><div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div></article>`;
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
    return `<div class="slot-confirm" data-index="${pendingIndex}"><small>Colocar aquí</small><strong>${escapeHtml(card.title)}</strong>
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
    // El perfil se registra aquí y no al pintar: pintar se repite y contaría de más.
    anotaLogros(CT.Progreso.record({ mode: game.mode, cardId: card.id, correct, kind: "local", hidden: !!game.ghost?.pending.length }));
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
    CT.Powers.claim(game, id, player.id, game.deck);
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
    const hasPower = game.pulsePower ? CT.Powers.ownsPulse(game.pulsePower, player.id) : !!game.pulse;
    return !game.ghost?.fresh && hasPower && !player.pulseUsed && player.hand.length >= PULSE_MIN_HAND
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
    CT.Powers.consumePulse(game.pulsePower, player.id);
    CT.Powers.claim(game, cardId, player.id, game.deck);
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
    anotaLogros(CT.Progreso.record({ mode: game.mode, cardId: card.id, correct, kind: "local", hidden: !!game.ghost?.pending.length, pulse: true }));
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
    game.pendingResult = result;
    saveGame();
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

  function useGhost() {
    const player = currentPlayer();
    if (result || game.pendingResult || game.pulseTurn || !CT.Ghost.available(game.ghost, player.id, game.timeline.length, player.hand.length)) return;
    CT.Ghost.activate(game.ghost, player.id, game.players.map(p => p.id));
    selectedCardId = null; pendingIndex = null;
    saveGame(); gameView(); announce(`${player.name} ha activado Fantasma durante una vuelta.`);
  }

  function finishTurn() {
    if (!result && !game.pendingResult) return;
    CT.Ghost.advance(game.ghost, currentPlayer().id, game.players.map(p => p.id));
    game.pendingResult = null;
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
    anotaLogros(CT.Progreso.finishGame({ mode: game.mode, kind: "local", players: game.players.length }));
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
        return `<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${CT.formatValue(mode, card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p>${veces > 1 ? `<p class="review-count">Fallada ${veces} veces</p>` : ""}<button type="button" class="enc-link" data-action="enc-view" data-mode="${mode}" data-id="${id}">Ver en la enciclopedia <span aria-hidden="true">→</span></button></div></article>`;
      }).join("")}</div>` : `<p class="lead">Partida perfecta.</p>`}
      <div class="actions" style="justify-content:center">${actionsHtml}</div>
    </section></div>`);
  }

  // El desplegable de mazos agrupado por bloque, igual que la portada los agrupa en la
  // galería: así la enciclopedia no inventa un segundo orden de los catorce juegos.
  function encModeOptions(modeKey) {
    return Object.values(CT.BLOCKS).map(item => `<optgroup label="${escapeHtml(item.name)}">${item.games.map(key => {
      const mode = CT.mode(key);
      return `<option value="${key}"${key === modeKey ? " selected" : ""}>${escapeHtml(mode.name)} (${mode.cards.length})</option>`;
    }).join("")}</optgroup>`).join("");
  }

  function encCountText(modeKey, count) {
    const mode = CT.mode(modeKey);
    return `${count} de ${mode.cards.length} ${escapeHtml(mode.cardLabel)} · ${escapeHtml(CT.axis(modeKey).timelineTitle)}`;
  }

  // Solo se entra aquí desde la portada o desde un repaso: nunca desde dentro de una
  // partida, donde ver el mazo entero volvería trivial cualquier jugada pendiente.
  function enciclopediaView() {
    screen = "enciclopedia";
    const mode = CT.mode(encMode);
    const bands = CT.Enciclopedia.bands(encMode);
    const cards = CT.Enciclopedia.filterCards(encMode, { query: encQuery, band: encBand });
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section enc-section">
        <div class="eyebrow"><span class="eyebrow-line"></span> Enciclopedia</div>
        <h1 data-focus tabindex="-1">${escapeHtml(mode.name)}</h1>
        <p class="lead" id="enc-count">${encCountText(encMode, cards.length)}</p>
        <div class="panel enc-toolbar">
          <div class="field">
            <label for="enc-mode-select">Mazo</label>
            <select id="enc-mode-select">${encModeOptions(encMode)}</select>
          </div>
          <div class="field">
            <label for="enc-search-input">Buscar</label>
            <input id="enc-search-input" type="search" autocomplete="off" placeholder="Título, explicación o fuente…" value="${escapeHtml(encQuery)}">
          </div>
          <div class="enc-bands" role="group" aria-label="Filtrar por época o magnitud">
            <button type="button" id="enc-band-all" class="band-chip${encBand === "all" ? " active" : ""}" data-action="enc-band" data-band="all" aria-pressed="${encBand === "all"}">Todas</button>
            ${bands.map(band => `<button type="button" id="enc-band-${band.key}" class="band-chip${encBand === band.key ? " active" : ""}" data-action="enc-band" data-band="${band.key}" aria-pressed="${encBand === band.key}"><span aria-hidden="true">${band.symbol}</span> ${escapeHtml(band.name)}</button>`).join("")}
          </div>
        </div>
        <div id="enc-results">${CT.Enciclopedia.resultsMarkup(encMode, cards, { highlight: encHighlight })}</div>
      </section>
    </div>`);
  }

  function openEnciclopedia(modeKey, { highlight = null, band = "all" } = {}) {
    encMode = CT.has(modeKey) ? modeKey : selectedModeKey;
    encQuery = "";
    encBand = band;
    encHighlight = highlight;
    enciclopediaView();
    if (highlight == null) return;
    // Se aplaza al siguiente turno de repintado: el elemento acaba de entrar en el DOM
    // y aún puede sustituirse (o desaparecer) antes de que haya nada que desplazar.
    setTimeout(() => {
      const carta = app.querySelector(`[data-enc-card="${highlight}"]`);
      if (!carta?.isConnected) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      carta.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }, 0);
  }

  // ---------------------------------------------------------------------------
  // El perfil
  //
  // Lo que hasta ahora era invisible: cuánto has jugado, en qué mazo aciertas y en cuál
  // no, y qué te falta para el siguiente logro. Los números los lleva `progreso.js`; aquí
  // solo se pintan. Es la única pantalla que mira todos los mazos a la vez, así que cada
  // punto débil enlaza con la enciclopedia del suyo en vez de dejarte buscándolo.
  // ---------------------------------------------------------------------------

  const LOGRO_GRUPOS = ["Constancia", "Puntería", "Recorrido", "Oficio"];

  function statBox(valor, etiqueta) {
    return `<span><b>${valor}</b><small>${etiqueta}</small></span>`;
  }

  function perfilResumen(resumen) {
    return `<div class="panel">
      <div class="solo-stats perfil-stats">
        ${statBox(resumen.games, resumen.games === 1 ? "partida" : "partidas")}
        ${statBox(resumen.cards, "cartas colocadas")}
        ${statBox(`${resumen.accuracy}%`, "de aciertos")}
        ${statBox(resumen.bestRun, "mejor tirada seguida")}
        ${statBox(resumen.bestStreak, "días seguidos de reto")}
        ${statBox(`${resumen.unlocked}/${resumen.total}`, "logros")}
      </div>
    </div>`;
  }

  function perfilPorJuego(filas) {
    if (!filas.length) return "";
    return `<div class="section-label">Por juego <small>${filas.length} ${filas.length === 1 ? "mazo" : "mazos"}</small></div>
      <div class="games">${filas.map(fila => `<div class="game-row">
        <span class="game-name">${escapeHtml(fila.name)}</span>
        <span class="game-meta">${fila.cards} ${fila.cards === 1 ? "carta" : "cartas"} · ${fila.accuracy}% de aciertos · ${fila.games} ${fila.games === 1 ? "partida" : "partidas"}</span>
      </div>`).join("")}</div>`;
  }

  // Un punto débil no es un reproche: es un enlace. Por eso cada fila lleva a la ficha o
  // al tramo del mazo donde está lo que se falla, que es donde se puede hacer algo.
  function perfilPuntosDebiles(bandas, cartas) {
    if (!bandas.length && !cartas.length) return "";
    const filasBandas = bandas.map(banda => `<button type="button" class="weak-row" data-action="enc-band-view" data-mode="${banda.mode}" data-band="${banda.band}">
      <span class="weak-mark" aria-hidden="true">${escapeHtml(banda.symbol)}</span>
      <span><b>${escapeHtml(banda.name)}</b><small>${escapeHtml(banda.modeName)} · ${banda.accuracy}% en ${banda.played} ${banda.played === 1 ? "carta" : "cartas"}</small></span>
      <i aria-hidden="true">→</i>
    </button>`).join("");
    const filasCartas = cartas.map(carta => `<button type="button" class="weak-row" data-action="enc-view" data-mode="${carta.mode}" data-id="${carta.id}">
      <span class="weak-mark" aria-hidden="true">×${carta.count}</span>
      <span><b>${escapeHtml(carta.title)}</b><small>${escapeHtml(carta.modeName)}</small></span>
      <i aria-hidden="true">→</i>
    </button>`).join("");
    return `<div class="section-label">Puntos débiles</div>
      <div class="panel weak-panel">
        ${bandas.length ? `<h3>Dónde más se falla</h3><div class="weak-list" role="group" aria-label="Tramos con menos aciertos">${filasBandas}</div>` : ""}
        ${cartas.length ? `<h3>Cartas que se atragantan</h3><div class="weak-list" role="group" aria-label="Cartas falladas más veces">${filasCartas}</div>` : ""}
      </div>`;
  }

  function perfilLogros(logros) {
    const grupos = LOGRO_GRUPOS.filter(grupo => logros.some(logro => logro.group === grupo));
    return `<div class="section-label">Logros <small>${logros.filter(l => l.unlocked).length} de ${logros.length}</small></div>
      ${grupos.map(grupo => `<h3 class="logro-grupo">${escapeHtml(grupo)}</h3>
        <div class="logro-grid" role="group" aria-label="Logros de ${escapeHtml(grupo)}">
          ${logros.filter(logro => logro.group === grupo).map(logroCard).join("")}
        </div>`).join("")}`;
  }

  function logroCard(logro) {
    // La barra solo tiene sentido cuando hay camino que recorrer: en un logro de «hazlo
    // una vez» no informa de nada, o estás a cero o ya lo tienes.
    const barra = !logro.unlocked && logro.goal > 1
      ? `<div class="logro-bar" role="img" aria-label="${logro.have} de ${logro.goal}"><i style="width:${Math.round((logro.have / logro.goal) * 100)}%"></i></div><small class="logro-progress">${logro.have} de ${logro.goal}</small>`
      : "";
    return `<div class="logro${logro.unlocked ? " unlocked" : ""}">
      <span class="logro-mark" aria-hidden="true">${logro.unlocked ? "★" : "☆"}</span>
      <div><b>${escapeHtml(logro.name)}</b><small>${escapeHtml(logro.desc)}</small>${barra}</div>
    </div>`;
  }

  // Todo esto vive en un solo móvil: borrar los datos del navegador, cambiar de teléfono
  // o jugar en una ventana privada se lo lleva sin aviso. La copia no es un extra, es lo
  // que hace razonable pedirle a alguien treinta días seguidos por un logro.
  function perfilCopia() {
    return `<div class="section-label">Copia de seguridad</div>
      <div class="panel">
        <p class="hint">El perfil se guarda solo en este móvil. Cópialo antes de cambiar de teléfono o de borrar los datos del navegador.</p>
        <div class="actions" style="margin-top:12px">
          <button class="btn btn-secondary" data-action="perfil-export">Copiar mi perfil</button>
          <button class="btn btn-ghost" data-action="perfil-reset">Empezar de cero</button>
        </div>
        <div class="field" style="margin-top:16px">
          <label for="perfil-import">Pegar un perfil copiado</label>
          <textarea id="perfil-import" rows="3" placeholder="Pega aquí el texto que copiaste"></textarea>
        </div>
        <button class="btn btn-secondary btn-block" style="margin-top:10px" data-action="perfil-import">Recuperar ese perfil</button>
      </div>`;
  }

  function perfilView() {
    screen = "perfil";
    const resumen = CT.Progreso.summary();
    const filas = CT.Progreso.modeRows();
    const estrenado = resumen.cards > 0 || resumen.games > 0;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section perfil-section">
        <div class="eyebrow"><span class="eyebrow-line"></span> Tu progreso</div>
        <h1 data-focus tabindex="-1">Perfil</h1>
        ${estrenado
          ? `<p class="lead">${resumen.hits} ${resumen.hits === 1 ? "acierto" : "aciertos"} de ${resumen.cards} ${resumen.cards === 1 ? "carta" : "cartas"} colocadas.</p>`
          : `<p class="lead">Aquí se irá guardando lo que juegues: aciertos, mazos, puntos débiles y logros. Todavía no hay nada que contar.</p>`}
        ${perfilResumen(resumen)}
        ${perfilPorJuego(filas)}
        ${perfilPuntosDebiles(CT.Progreso.weakBands(), CT.Progreso.weakCards())}
        ${perfilLogros(CT.Progreso.achievements())}
        ${perfilCopia()}
      </section>
    </div>`);
  }

  async function perfilExport() {
    const texto = CT.Progreso.exportJson();
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch { /* cancelado, se intenta copiar */ }
    }
    try {
      await navigator.clipboard.writeText(texto);
      showToast("Perfil copiado");
    } catch {
      showToast("No se pudo copiar el perfil");
    }
  }

  function perfilImport() {
    const campo = document.getElementById("perfil-import");
    const texto = (campo?.value || "").trim();
    if (!texto) return showToast("Pega antes el texto del perfil");
    const resultado = CT.Progreso.importJson(texto);
    if (!resultado.ok) return showToast(resultado.error);
    showToast("Perfil recuperado");
    perfilView();
  }

  // Borrar el perfil no se deshace, así que se pregunta. Es la misma cautela que el resto
  // del juego tiene con abandonar una partida.
  function perfilResetMenu() {
    overlay(`<div class="overlay"><div class="modal">
      <div class="eyebrow">Empezar de cero</div>
      <h2>¿Borrar todo el progreso?</h2>
      <p class="lead" style="margin-inline:auto">Se pierden las estadísticas y los logros de este móvil, y no hay manera de recuperarlos. El reto diario y sus rachas no se tocan.</p>
      <div class="actions" style="display:grid">
        <button class="btn btn-ghost" data-action="perfil-reset-confirm">Sí, borrar el perfil</button>
        <button class="btn btn-primary" data-action="close-menu">Mejor no</button>
      </div>
    </div></div>`, true);
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

  let selectedDifficulty = localStorage.getItem("continuum-difficulty-v1") || "easy";
  if (!CT.Ghost.LEVELS[selectedDifficulty]) selectedDifficulty = "easy";
  function soloHidden() { return solo.difficulty === "expert" || !!solo.ghostTurns?.includes(solo.played - (solo.pendingResult ? 1 : 0)); }
  function soloHome() {
    screen = "solo-home";
    solo = loadSolo();
    pendingIndex = null;
    const records = modeRecords();
    const doneToday = records.days && records.days[today()];
    const mode = currentMode();
    const pendiente = solo && solo.kind === "free";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="home">Volver</button>')}
      <section class="setup-section solo-home"><div class="solo-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${mode.name}</div><h2 class="solo-title" data-focus tabindex="-1">Jugar en solitario</h2>
        <p class="lead">Coloca las cartas tú solo. Tienes ${SOLO_LIVES} vidas: cada fallo te cuesta una.</p></div>
        <div class="panel solo-panel">
          <div class="solo-panel-head"><h3>Reto diario</h3><time datetime="${today()}">${today().split("-").reverse().join("/")}</time></div>
          ${doneToday
            ? `<p class="solo-done">Hoy ya lo has jugado: <strong>${doneToday.hits} de ${doneToday.total}</strong>. Vuelve mañana.</p>`
            : `<p>Las mismas ${DAILY_CARDS} cartas para todo el mundo, un intento al día.</p><button class="btn btn-primary btn-block" data-action="start-daily">Jugar el reto de hoy <span>→</span></button>`}
          <div class="solo-stats"><span><b>${records.streak || 0}</b><small>días seguidos</small></span><span><b>${records.best || 0}</b><small>mejor marca · Fácil</small></span></div>
          ${calendarHtml(records)}
        </div>
        <div class="panel solo-panel">
          <div class="solo-panel-head"><h3>Partida libre</h3></div>
          <p>El mazo entero, hasta perder las tres vidas o agotarlo.</p>
          ${CT.Ghost.difficultySelect("solo-difficulty", selectedDifficulty)}
          <p class="hint" data-level-record>Mejor marca en ${CT.Ghost.level(selectedDifficulty).name}: ${records.bestByDifficulty?.[selectedDifficulty] || (selectedDifficulty === "easy" ? records.best || 0 : 0)}</p>
          ${pendiente ? `<button class="btn btn-primary btn-block" data-action="resume-solo">Continuar ${CT.Ghost.level(solo.difficulty).name} <span>→</span></button>` : ""}
          <button class="btn ${pendiente ? "btn-secondary" : "btn-primary"} btn-block" data-action="start-free">${pendiente ? "Empezar otra" : "Empezar"}</button>
        </div>
      </section>
    </div>`);
  }

  function startSolo(kind) {
    const difficulty = kind === "daily" ? "easy" : selectedDifficulty;
    const ids = currentMode().cards.map(card => card.id);
    const barajado = kind === "daily"
      ? shuffleWith(ids, seededRandom(seedFrom(`${today()}:${selectedModeKey}`))).slice(0, DAILY_CARDS + 1)
      : shuffle(ids);
    const timeline = [barajado.shift()];
    solo = {
      kind, difficulty, ghostTurns: difficulty === "hard" ? CT.Ghost.soloSchedule(ids.length) : [],
      mode: selectedModeKey, day: today(), deck: barajado, timeline,
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
      if (i < timelineCards.length) slots.push(timelineCardMarkup(timelineCards[i], soloHidden()));
    }
    const restantes = solo.total ? solo.total - solo.played : (solo.pendingResult ? 0 : 1) + Math.ceil(solo.deck.length / (1 + CT.Ghost.level(solo.difficulty).extra));
    const etiqueta = soloLabel();
    paint(`<div class="shell">${header(`<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="${solo.kind === "comp" ? "abandon-comp" : "solo-menu"}">Salir</button>`)}
      <h1 class="solo-lectores" data-focus tabindex="-1">${etiqueta}: ${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}, ${solo.lives} ${solo.lives === 1 ? "vida" : "vidas"}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">${etiqueta}</div><div class="turn-name" aria-hidden="true">${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}</div></div><div class="deck-count"><strong>${restantes}</strong><span>por colocar</span></div></div>
      <div class="solo-lives" aria-label="Vidas restantes: ${solo.lives}">${"♥".repeat(solo.lives)}${"♡".repeat(SOLO_LIVES - solo.lives)}</div>
      ${soloHidden() ? `<div class="ghost-banner" role="status"><span aria-hidden="true">◌</span><div><b>Fantasma ${solo.difficulty === "expert" ? "permanente" : "· esta jugada"}</b><small>Los valores se revelan al resolver cada carta.</small></div></div>` : ""}
      <section><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${solo.timeline.length} cartas</small></div>${CT.timelineMap(selectedModeKey, timelineCards, { hidden: soloHidden() })}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      ${solo.autoAdded?.length ? `<p class="auto-cards" role="status">El tablero ha incorporado ${solo.autoAdded.length} ${solo.autoAdded.length === 1 ? "carta" : "cartas"}: ${solo.autoAdded.map(id => escapeHtml(cardsById.get(id).title)).join(" · ")}. No suman aciertos.</p>` : ""}
      <section><div class="hand-title"><h3>Tu carta</h3></div><div class="hand hand-solo"><div class="hand-card selected ${selectedModeKey === "animals" ? "animal-hand-card" : ""}" data-id="${card.id}">${animalArt(card)}<span class="hidden-date">${currentAxis().hiddenLabel}</span><strong>${escapeHtml(card.title)}</strong></div></div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : "Arrastra la carta hasta un hueco, o tócalo directamente"}</p></section>
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
    if (solo.pendingResult || !Number.isInteger(index) || index < 0 || index > solo.timeline.length) return;
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
    solo.pendingResult = { correct, cardId: card.id };
    anotaLogros(CT.Progreso.record({ mode: solo.mode, cardId: card.id, correct, kind: solo.kind, hidden: soloHidden() }));
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
    if (!solo?.pendingResult) return;
    solo.pendingResult = null;
    result = null;
    if (solo.lives === 0 || !solo.deck.length || (solo.total && solo.played >= solo.total)) return soloFinish();
    // Primero se reserva la siguiente carta del jugador. Nunca se duplica ni se
    // consume por la inserción automática, que no modifica aciertos ni vidas.
    solo.current = solo.deck.shift();
    solo.autoAdded = [];
    const extra = CT.Ghost.level(solo.difficulty).extra;
    for (let n = 0; n < extra && solo.deck.length; n++) {
      const id = solo.deck.shift();
      const at = CT.correctIndex(selectedModeKey, solo.timeline.map(id => cardsById.get(id)), cardsById.get(id));
      solo.timeline.splice(at, 0, id); solo.autoAdded.push(id);
    }
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
    // El identificador anónimo del móvil lo genera `progreso.js`, que es quien lo usa
    // para el perfil; aquí solo se copia dentro del récord del mazo para que un futuro
    // marcador entre amigos no tenga que cruzar dos claves de almacenamiento.
    records.playerId = records.playerId || CT.Progreso.playerId();
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
    } else if (solo.kind === "free") {
      const difficulty = solo.difficulty || "easy";
      records.bestByDifficulty = records.bestByDifficulty || { easy: records.best || 0 };
      records.bestByDifficulty[difficulty] = Math.max(records.bestByDifficulty[difficulty] || 0, solo.hits);
      if (difficulty === "easy") records.best = records.bestByDifficulty.easy;
      saveRecords(records);
    }
    const superado = solo.lives > 0;
    const logros = CT.Progreso.finishGame({
      mode: solo.mode, kind: solo.kind, hits: solo.hits, total,
      difficulty: solo.difficulty || "easy", streak: records.streak || 0, lives: solo.lives
    });
    const resumen = solo.kind === "daily"
      ? `Has colocado bien <strong>${solo.hits}</strong> de ${total} cartas.`
      : `Has colocado <strong>${solo.hits}</strong> ${solo.hits === 1 ? "carta" : "cartas"} en ${CT.Ghost.level(solo.difficulty).name}. ${solo.lives > 0 ? "Has completado el mazo." : "Has agotado las tres vidas."}`;
    soloFailedForReview = (solo.failed || []).map(id => ({ id, mode: solo.mode }));
    const compartir = solo.kind === "daily" ? shareText(currentMode().name, dia, solo.hits, total, solo.sequence || [], records.streak) : null;
    solo.finished = true;
    saveSolo();
    solo = null;
    const fallosUnicos = new Set(soloFailedForReview.map(item => item.id)).size;
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">${superado ? "🏅" : "🎯"}</div><div class="eyebrow">${superado ? "Reto completado" : "Se acabaron las vidas"}</div><h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${resumen}</h1>${logrosMarkup(logros)}<div class="actions" style="justify-content:center">${compartir ? `<button class="btn btn-secondary" data-action="share-daily">Compartir resultado</button>` : ""}${fallosUnicos ? `<button class="btn btn-ghost" data-action="review-solo">Ver lo que se falló (${fallosUnicos})</button>` : ""}<button class="btn btn-primary" data-action="solo">Volver a solitario</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button></div></div></section></div>`);
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
    if (solo.kind === "comp") return `Competición · ${CT.Ghost.level(comp.difficulty).name} · tema ${TOTAL_TEMAS - comp.queue.length} de ${TOTAL_TEMAS}`;
    return `Partida libre · ${CT.Ghost.level(solo.difficulty).name}`;
  }

  function startCompetition() {
    previousModeKey = selectedModeKey;
    comp = { difficulty: selectedDifficulty, queue: shuffle(COMP_MODES), roundsSummary: [], totalHits: 0, totalFailed: [] };
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
      ${!comp.roundsSummary.length ? CT.Ghost.difficultySelect("comp-difficulty", comp.difficulty) : `<p>${CT.Ghost.level(comp.difficulty).name}</p>`}
      ${comp.roundsSummary.length ? `<div class="solo-stats" style="grid-template-columns:1fr"><span><b>${comp.totalHits}</b><small>aciertos hasta ahora</small></span></div>` : ""}
      <button class="btn btn-primary btn-block" data-action="comp-next-round">Empezar <span>→</span></button>
    </div></section></div>`);
  }

  function beginCompRound() {
    if (!comp.roundsSummary.length) comp.difficulty = document.getElementById("comp-difficulty")?.value || comp.difficulty;
    const modeKey = comp.queue.shift();
    selectedModeKey = modeKey;
    cardsById = new Map(CT.cards(modeKey).map(card => [card.id, card]));
    const extra = CT.Ghost.level(comp.difficulty).extra;
    const barajado = shuffle(CT.cards(modeKey).map(card => card.id)).slice(0, ROUND_CARDS + 1 + extra * (ROUND_CARDS - 1));
    const timeline = [barajado.shift()];
    solo = {
      kind: "comp", difficulty: comp.difficulty, ghostTurns: comp.difficulty === "hard" ? CT.Ghost.soloSchedule(ROUND_CARDS) : [], mode: modeKey, timeline, deck: barajado,
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
    // Cada ronda es una partida de su propio mazo, y así es como la cuenta el perfil. El
    // logro de la competición entera se apunta al final, en `compFinish`.
    anotaLogros(CT.Progreso.finishGame({ mode: solo.mode, kind: "comp", hits: solo.hits, total: solo.total, difficulty: comp.difficulty }));
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
    const logros = CT.Progreso.finishCompetition();
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel">
      <div class="big-icon">🏆</div>
      <div class="eyebrow">Competición terminada</div>
      <h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${comp.totalHits} de ${totalCards} en total</h1>
      <ul class="comp-summary">${filas}</ul>
      ${logrosMarkup(logros)}
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
    overlay(`<div class="overlay" data-overlay="rules"><div class="modal rules"><div class="guide-content">${CT.guideMarkup(modeKey, context, { pulse: !!game?.pulse, ghost: game ? !!game.ghost : true })}</div><button class="btn btn-primary btn-block" data-action="close-rules" data-return="${returnTo}">Entendido</button></div></div>`, true);
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

  // Un logro puede caer a mitad de partida, y ahí no hay pantalla donde ponerlo: se avisa
  // y se sigue jugando. En una pantalla de fin, en cambio, hay sitio para enseñarlo
  // entero, así que ahí se usa `logrosMarkup` en vez de esto.
  function anotaLogros(nuevos) {
    if (!nuevos || !nuevos.length) return;
    showToast(nuevos.length === 1 ? `Logro: ${nuevos[0].name}` : `${nuevos.length} logros nuevos`);
    announce(nuevos.map(item => `Logro desbloqueado: ${item.name}.`).join(" "));
  }

  function logrosMarkup(nuevos) {
    if (!nuevos || !nuevos.length) return "";
    return `<div class="logros-nuevos" role="status">
      <div class="eyebrow">${nuevos.length === 1 ? "Logro nuevo" : `${nuevos.length} logros nuevos`}</div>
      ${nuevos.map(item => `<div class="logro-chip"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.desc)}</small></div>`).join("")}
    </div>`;
  }

  async function launchOnline(roomCode = "") {
    screen = "online-loading";
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

  app.addEventListener("change", event => {
    if (event.target.id === "enc-mode-select") { openEnciclopedia(event.target.value); return; }
    if (!["solo-difficulty", "comp-difficulty"].includes(event.target.id)) return;
    const key = event.target.value;
    if (!CT.Ghost.LEVELS[key]) return;
    event.target.closest(".difficulty-field").querySelector("[data-difficulty-help]").textContent = CT.Ghost.level(key).description;
    selectedDifficulty = key;
    localStorage.setItem("continuum-difficulty-v1", key);
    const record = app.querySelector("[data-level-record]");
    const records = modeRecords();
    if (record) record.textContent = `Mejor marca en ${CT.Ghost.level(key).name}: ${records.bestByDifficulty?.[key] || (key === "easy" ? records.best || 0 : 0)}`;
  });

  app.addEventListener("input", event => {
    if (event.target.closest("#players")) syncStarterOptions();
    else if (event.target.id === "enc-search-input") {
      // Se actualiza solo el resultado, sin repintar la pantalla entera: repintarla
      // destruiría el campo justo mientras se escribe en él.
      encQuery = event.target.value;
      const cards = CT.Enciclopedia.filterCards(encMode, { query: encQuery, band: encBand });
      document.getElementById("enc-results").innerHTML = CT.Enciclopedia.resultsMarkup(encMode, cards, { highlight: encHighlight });
      document.getElementById("enc-count").textContent = encCountText(encMode, cards.length);
    }
  });

  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "home") home();
    else if (action === "home-top") window.scrollTo({ top: 0, behavior: "smooth" });
    else if (action === "home-collection") document.getElementById("deck-collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (action === "collection-back") { collectionOpen = true; collectionDetails = true; home(); }
    else if (action === "set-mode") { setMode(target.dataset.mode); collectionOpen = true; collectionDetails = true; playMenu(); }
    else if (action === "set-block") {
      if (!collectionOpen || target.dataset.block !== selectedBlockKey) setBlock(target.dataset.block);
      collectionOpen = true;
      collectionDetails = true;
      home();
    }
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
    else if (action === "ready") { if (game.pulseGift && game.pulseGift.to === currentPlayer().id) { game.pulseGift = null; saveGame(); } if (game.pendingResult) { result = game.pendingResult; renderResult(); } else gameView(); }
    else if (action === "ghost-use") useGhost();
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
    else if (action === "resume-solo") { solo = loadSolo(); pendingIndex = null; if (!solo) soloHome(); else if (solo.pendingResult) { result = { correct: solo.pendingResult.correct, card: cardsById.get(solo.pendingResult.cardId), solo: true }; soloResult(); } else { result = null; soloView(); } }
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
    else if (action === "enciclopedia") openEnciclopedia(selectedModeKey);
    else if (action === "enc-view") openEnciclopedia(target.dataset.mode, { highlight: Number(target.dataset.id) });
    else if (action === "enc-band-view") openEnciclopedia(target.dataset.mode, { band: target.dataset.band });
    else if (action === "enc-band") { encBand = target.dataset.band; enciclopediaView(); }
    else if (action === "perfil") perfilView();
    else if (action === "perfil-export") perfilExport();
    else if (action === "perfil-import") perfilImport();
    else if (action === "perfil-reset") perfilResetMenu();
    else if (action === "perfil-reset-confirm") { CT.Progreso.reset(); CT.closeDialog(); showToast("Perfil borrado"); perfilView(); }
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

