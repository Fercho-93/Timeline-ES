(function () {
  "use strict";

  const app = document.getElementById("app");
  app.dataset.platform = /Android/i.test(navigator.userAgent) ? "android" : "other";
  app.dataset.device = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ? "ios" : app.dataset.platform;
  const toast = document.getElementById("toast");
  const MODE_STORAGE_KEY = "hilo-selected-mode-v1";
  const VIEW_STORAGE_KEY = "continuum-tab-view-v1";
  // Las modalidades, sus ejes y los ayudantes que comparte con el modo de varios
  // móviles están en modes.js, para declararlos una sola vez.
  const CT = window.CONTINUUM;
  const turnDuelReady = import('./duelo-turnos.js').catch(() => null);
  const pushReady = import('./push.js').catch(() => null);
  const { escapeHtml, initials, shuffle, announce, seedFrom, seededRandom, shuffleWith } = CT;
  pushReady.then(module => module?.start?.());
  window.addEventListener('continuum:turn-duel-open', event => turnDuelReady.then(() => CT.TurnDuel?.open({ gameId: event.detail?.duelId, back: home })));
  // Pintar pasa por aquí para que el foco del teclado no se pierda en cada jugada.
  let playReturn = 'play-menu';
  let lastPaintedScreen = 'home';
  let previousView = null, navigatingBack = false;
  const navigationTrail = [];
  const paint = html => {
    if (CT.Accounts && !CT.Accounts.ready) return;
    if (CT.UI.isPlaying(screen) && !CT.UI.isPlaying(lastPaintedScreen)) {
      playReturn = ['setup', 'solo-home', 'duel-home', 'competition-menu', 'duelo-intro'].includes(lastPaintedScreen) ? lastPaintedScreen : 'play-menu';
    }
    if (screen !== lastPaintedScreen && !navigatingBack) {
      if (screen === 'home') navigationTrail.length = 0;
      else if (previousView && !CT.UI.isPlaying(lastPaintedScreen) && !CT.UI.isPlaying(screen) && screen !== 'enciclopedia' && lastPaintedScreen !== 'enciclopedia') navigationTrail.push(previousView);
    }
    navigatingBack = false;
    previousView = {screen, mode: selectedModeKey, block: selectedBlockKey, html, format: formatOpen, tournament: pendingTournament, collectionOpen, collectionDetails, collectionIndexExpanded, jugarSection, homeDestination, profileReturn};
    lastPaintedScreen = screen;
    rememberView();
    const sceneMode = screen === "enciclopedia" && encMode !== "all" ? encMode : selectedModeKey;
    CT.Scene.apply(sceneMode, screen);
    CT.paint(app, html, screen);
  };
  // Solo una ruta y preferencias de navegación, nunca HTML ni estado de una jugada.
  // sessionStorage mantiene independiente cada pestaña y sobrevive a una recarga.
  function rememberView() {
    if (screen === "jugar" && previousView?.screen === "jugar") {
      Object.assign(previousView, {mode: selectedModeKey, block: selectedBlockKey, collectionOpen, collectionDetails, collectionIndexExpanded, jugarSection});
    }
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({screen, mode: selectedModeKey,
        block: selectedBlockKey, format: formatOpen, collectionOpen, collectionDetails, collectionIndexExpanded, jugarSection,
        homeDestination, profileReturn, soloKind: solo?.kind}));
    } catch { /* El bloqueo del almacenamiento no impide jugar. */ }
  }
  function restoreView() {
    let view;
    try { view = JSON.parse(sessionStorage.getItem(VIEW_STORAGE_KEY)); } catch { return false; }
    // Una vista guardada de un mazo que ya no es suyo no se recupera: se empieza en la
    // portada. Pintar la puerta cerrada aquí no valdría, porque la ruta guardada pintaría
    // encima justo después.
    if (!view || !CT.has(view.mode) || !CT.Cartera.tiene(view.mode)) return false;
    const routes = {'home': home, 'jugar': jugarView, 'duelos': duelsView, 'play-menu': playMenu, 'solo-home': soloHome, 'duel-home': duelHome,
      'competition-menu': competitionMenu, 'quick-challenges': quickChallenges, 'quick-game': quickChallenges, 'quick-lobby': quickChallenges, 'perfil': perfilView};
    // Los turnos se recuperan desde sus guardados validados, nunca desde la ruta.
    if (view.screen === 'solo' && view.soloKind === 'daily') routes.solo = () => resumeSolo('daily');
    else if (view.screen === 'solo' && view.soloKind !== 'comp') routes.solo = resumeSolo;
    // Y el duelo de cifras se recupera con su reloj puesto en hora: recargar durante una
    // carta no devuelve el plazo entero, cierra esa carta.
    routes.cifras = resumeCifras;
    if (!routes[view.screen]) return false;
    setMode(view.mode);
    if (CT.hasBlock(view.block)) selectedBlockKey = view.block;
    formatOpen = ['multi', 'competition-multi'].includes(view.format) ? view.format : null;
    collectionOpen = view.collectionOpen === true;
    collectionDetails = view.collectionDetails === true;
    collectionIndexExpanded = view.collectionIndexExpanded === true;
    jugarSection = ["collections", "quick", "competition"].includes(view.jugarSection) ? view.jugarSection : null;
    homeDestination = view.homeDestination === 'collection' ? 'collection' : 'home';
    profileReturn = ['play-menu','solo-home'].includes(view.profileReturn) ? view.profileReturn : 'home';
    if (view.screen === 'perfil') screen = 'perfil';
    routes[view.screen]();
    return true;
  }
  function resumeSolo(kind = "mode") {
    solo = kind === "daily" ? loadDaily() : loadSolo();
    if (kind === "daily" && solo) soloSlot = "daily";
    if (solo) cardsById = new Map(solo.savedDeck.map(card => [card.id, card]));
    pendingIndex = null;
    if (!solo) kind === "daily" ? home() : soloHome();
    else if (solo.pendingResult) {
      result = {
        correct: solo.pendingResult.correct, card: cardsById.get(solo.pendingResult.cardId), solo: true,
        attemptedIndex: solo.pendingResult.attemptedIndex, correctIndex: solo.pendingResult.correctIndex
      };
      soloResult();
    } else {
      result = null;
      // Igual que en el duelo de cifras: si la carta seguía abierta y se ha estado fuera
      // más que el margen de gracia, se cierra en vez de estrenar plazo. Cerrar la
      // aplicación no es una manera de pedir tiempo muerto.
      if (enDueloConReloj() && solo.cartaEmpezadaEn && Date.now() - solo.cartaEmpezadaEn > CT.Duelo.GRACIA_MS) cierraCartaDuelo("salida");
      else soloView();
    }
  }
  // Y las capas se abren como diálogos: foco dentro, tabulador atrapado, Escape cierra.
  // `cerrable` distingue las capas que se pueden descartar —las reglas, el menú— de las
  // que son un paso obligado de la jugada, donde Escape no debe hacer nada.
  function overlay(html, cerrable) {
    app.insertAdjacentHTML("beforeend", html);
    CT.openDialog(app.lastElementChild, cerrable);
  }
  let selectedModeKey = CT.Storage.getItem(MODE_STORAGE_KEY) || CT.DEFAULT_MODE;
  if (!CT.has(selectedModeKey)) selectedModeKey = CT.DEFAULT_MODE;
  // Y si el que quedó elegido la última vez ya no es suyo, se vuelve al de siempre. Lo
  // que hay guardado aquí es un recuerdo de la última partida, no un derecho: sin esta
  // línea, cerrar un mazo dejaría al juego entero apuntando a él sin pasar por `setMode`,
  // que es donde se pregunta a la cartera.
  if (!CT.Cartera.tiene(selectedModeKey)) selectedModeKey = CT.DEFAULT_MODE;
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
  let pendingTournament = null;
  // El minijuego de la carta para decidir quién empieza: null hasta que se saca, y se
  // invalida en cuanto cambia el número de jugadores porque ya no habría una carta por
  // persona.
  let starterDraw = null;
  let competitionConfig = {rounds: CT.Tournament.modes().length, cards:5};
  const MULTI_COMP_KEY = 'continuum-multi-competition-v1';
  // Estado de la enciclopedia: qué mazo se consulta, la búsqueda y el filtro de banda en
  // curso, y qué carta destacar al llegar desde el repaso de una carta fallada.
  let encMode = null;
  let encQuery = "";
  let encBand = "all";
  // Y el filtro de láminas: todas, solo las desbloqueadas o solo las que faltan. Empieza
  // en «todas» siempre —la enciclopedia se abre para consultar, no para coleccionar— y
  // vuelve ahí al cambiar de mazo, como la banda.
  let encLock = "all";
  let encHighlight = null;
  // A dónde vuelve el botón «Volver» de la enciclopedia: al mazo desde el que se abrió,
  // o al perfil si se llegó desde un punto débil. Sin esto, «Volver» siempre mandaba al
  // inicio, deshaciendo de un toque la navegación que trajo hasta aquí.
  let encReturn = "home";
  let encBackground = '';
  let encBackgroundScreen = '';
  let reviewReturnView = null;
  // La portada empieza mostrando la colección, no un mazo abierto. Un toque descubre
  // una categoría y enseña directamente los mazos que contiene.
  let collectionOpen = false;
  let collectionIndexExpanded = false;
  let jugarSection = null;
  let homeDestination = "home";
  let profileReturn = "home";
  let collectionDetails = false;
  // Qué bloque de formato está desplegado en el menú del mazo: "multi", "solo" o
  // ninguno de los dos. Empiezan los dos cerrados, como la colección de la portada.
  let formatOpen = null;

  function currentAxis() { return CT.axis(selectedModeKey); }

  function playerProgress(handLength, players) {
    const largestHand = Math.max(1, ...players.map(player => player.hand.length));
    return Math.round(Math.max(12, Math.min(100, ((largestHand - handLength + 1) / (largestHand + 1)) * 100)));
  }

  function formatValue(card) { return CT.formatValue(selectedModeKey, card); }

  function sortValue(card) { return CT.sortValue(selectedModeKey, card); }

  function currentMode() { return CT.mode(selectedModeKey); }

  function storageKey() { return `hilo-game-${selectedModeKey}-v1`; }

  // Todo lo que lleva a jugar un mazo pasa por aquí, así que aquí se le pregunta a la
  // cartera. Hoy nunca dice que no —no hay nada a la venta—, pero el día que lo diga,
  // este es el sitio que impide entrar por la puerta de atrás.
  function setMode(modeKey) {
    if (!CT.has(modeKey)) return false;
    if (!CT.Cartera.tiene(modeKey)) { mazoCerrado(modeKey); return false; }
    selectedModeKey = modeKey;
    selectedBlockKey = CT.blockOf(modeKey).key;
    CT.Storage.setItem(MODE_STORAGE_KEY, modeKey);
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    game = loadGame();
    selectedCardId = null;
    pendingIndex = null;
    result = null;
    formatOpen = null;
    return true;
  }

  function eraForCard(card) { return CT.eraForCard(selectedModeKey, card); }

  // Cada carta de peso, longevidad y velocidad tiene una lámina propia. Se enlazan por ID para que un
  // retoque del título o del valor no pueda cambiar por accidente la ilustración.
  // La tabla de láminas vive en modes.js, compartida con online.js.
  function usesAnimalArt() { return CT.usesAnimalArt(selectedModeKey); }
  function animalArt(card) { return CT.animalArt(selectedModeKey, card); }
  // En la mano nunca va la lámina, sino el reverso del mazo: por qué, en `modes.js`.
  function cardBack() { return CT.cardBack(selectedModeKey); }
  // El sello de tema de una carta, solo hay uno en «Gran mezcla»: en cualquier otra
  // modalidad `CT.categoryBadge` devuelve una cadena vacía.
  function categoryBadge(card) { return CT.categoryBadge(selectedModeKey, card); }

  function saveGame() {
    if (game?.tournament) { CT.Storage.setItem(MULTI_COMP_KEY, JSON.stringify(CT.Saves.prepare(game, selectedModeKey))); return; }
    if (game) CT.Storage.setItem(storageKey(), JSON.stringify(CT.Saves.prepare(game, selectedModeKey)));
    else CT.Storage.removeItem(storageKey());
  }

  function loadGame() {
    try {
      const stored = CT.Saves.read(storageKey(), selectedModeKey);
      if (!stored || !stored.players || !stored.timeline) return null;
      stored.mode = stored.mode || selectedModeKey;
      if (!stored.winners && stored.winner != null) stored.winners = [stored.winner];
      return stored;
    } catch { return null; }
  }

  // Flecha para retroceder; la casa del menú inferior vuelve al inicio.
  function header(extra = "") {
    const playing = CT.UI.isPlaying(screen);
    if (playing) {
      const menu = screen === 'solo' || screen === 'comp-intro' ? 'solo-options' : 'game-menu';
      return CT.UI.header('data-action="ui-back"', `data-action="${menu}"`, true);
    }
    const backAction = extra.match(/data-action="(collection-back|back-menu|home)"/)?.[1] || 'ui-back';
    return CT.UI.header(screen === 'home' ? '' : `data-action="${backAction}"`);
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
    return `<div class="gallery" role="group" aria-label="Elige una colección">${Object.values(CT.BLOCKS).map((item, index) => {
      const active = collectionOpen && item.key === selectedBlockKey;
      const total = item.games.length;
      const instruction = active ? "Mazos visibles debajo." : "Toca para ampliar y ver sus mazos.";
      const mazos = active && collectionDetails
        ? `<div class="collection-decks"><h2 data-focus tabindex="-1">${item.name}</h2><p class="lead">Elige un mazo para continuar.</p>${gameList()}</div>`
        : "";
      return `<div class="collection-entry${active ? " active" : ""}"><button class="gallery-panel panel-${item.art}${active ? " active" : ""}" data-action="set-block" data-block="${item.key}" aria-pressed="${active}" aria-expanded="${active}" aria-controls="collection-drawer-${item.key}" aria-label="${item.name}, ${total} ${total === 1 ? "juego" : "juegos"}. ${instruction}">
        <span class="panel-backdrop" aria-hidden="true">${blockArt(item.art, active)}</span>
        <span class="panel-depth-light" aria-hidden="true"></span>
        <span class="panel-art" aria-hidden="true">${blockArt(item.art, active)}</span>
        <span class="panel-depth-ground" aria-hidden="true"></span>
        <span class="collection-foil" aria-hidden="true"></span>
        <span class="collection-index" aria-hidden="true">${total} ${total === 1 ? "mazo" : "mazos"}${CT.Cartera.cerrados(item.key).length ? ` · ${CT.Cartera.cerrados(item.key).length} 🔒` : ""}</span>
        <span class="collection-open" aria-hidden="true">${active ? "−" : "↗"}</span>
        <span class="panel-spine" aria-hidden="true"><i>${item.icon}</i><b>${item.name}</b></span>
        <span class="panel-label" aria-hidden="true"><i></i><strong>${item.name}</strong><small>${item.tagline}</small></span>
      </button><div id="collection-drawer-${item.key}" class="collection-drawer"${active ? "" : " inert"}><div class="collection-drawer-inner">${mazos}</div></div></div>`;
    }).join("")}</div>`;
  }

  // Los juegos del bloque en pantalla.
  function gameList() {
    const games = CT.blockGames(selectedBlockKey);
    return `<div class="games" role="group" aria-label="Elige el juego">${games.map((item, index) => {
      const active = item.key === selectedModeKey;
      // Un mazo cerrado se sigue viendo, con su candado: esconderlo haría que nadie
      // supiera que existe, y lo que se vende tiene que poder verse antes de comprarlo.
      const abierto = CT.Cartera.tiene(item.key);
      // El candado va estampado en medio del mazo, sobre su propia lámina, no de adorno
      // al lado del nombre: así se ve de un vistazo cuál está cerrado sin leer una línea.
      // Cuando un mazo no tiene lámina, el sello se queda igual en su hueco.
      const lamina = CT.cardArt(item.key, item.cards[0]) ? CT.animalArt(item.key, item.cards[0]) : "";
      const preview = lamina || !abierto
        ? `<span class="deck-preview${abierto ? "" : " deck-preview-cerrado"}" aria-hidden="true">${lamina}${abierto ? "" : '<span class="deck-candado">🔒</span>'}</span>`
        : "";
      return `<button class="game-row${active ? " active" : ""}${abierto ? "" : " game-row-cerrado"}" data-action="set-mode" data-mode="${item.key}" aria-pressed="${active}"${abierto ? "" : ` aria-describedby="mazo-cerrado-${item.key}"`}>
        ${preview}<span class="deck-chapter" aria-hidden="true">Capítulo ${["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][index] || index + 1}<i>↗</i></span>
        <span class="game-name">${item.name}<span class="solo-lectores">${abierto ? "" : ", cerrado"}</span></span>
        <span class="game-meta"${abierto ? "" : ` id="mazo-cerrado-${item.key}"`}>${abierto ? `${item.cards.length} ${item.cardLabel} · ${item.blurb}` : escapeHtml(CT.Cartera.motivo(item.key).texto)}</span>
      </button>`;
    }).join("")}</div>`;
  }

  // Los iconos son trazos propios, no una librería externa: no añaden una descarga ni
  // rompen el uso sin conexión. El texto sigue siendo el nombre accesible de cada modo.
  function playIcon(kind) {
    const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if (kind === "local") return `<svg ${common}><rect x="7" y="2.75" width="10" height="18.5" rx="2.2"></rect><path d="M10.5 18h3"></path></svg>`;
    if (kind === "online") return `<svg ${common}><rect x="3" y="6" width="10" height="15" rx="2"></rect><rect x="11" y="2.75" width="10" height="15" rx="2"></rect><path d="M14 14.75h4"></path></svg>`;
    if (kind === "offline") return `<svg ${common}><rect x="3" y="6" width="8" height="13" rx="1.8"></rect><rect x="13" y="5" width="8" height="13" rx="1.8"></rect><path d="M11 12h2"></path></svg>`;
    if (kind === "deck") return `<svg ${common}><path d="M12 6.6C10.4 5.3 8.5 4.7 6 4.7v12.9c2.5 0 4.4.6 6 1.9 1.6-1.3 3.5-1.9 6-1.9V4.7c-2.5 0-4.4.6-6 1.9Z"></path><path d="M12 6.6v12.9"></path></svg>`;
    return `<svg ${common}><circle cx="12" cy="8" r="3.25"></circle><path d="M5.5 21c.8-4.05 3.05-6 6.5-6s5.7 1.95 6.5 6"></path></svg>`;
  }

  // Cada bloque es un acordeón propio: el encabezado siempre se ve, y solo despliega
  // sus formatos cuando es el bloque elegido. Igual que la colección de la portada, no
  // se abren los dos a la vez, para no repetir en pantalla las tres opciones sin que la
  // persona haya pedido ver ninguna todavía.
  function formatBlock(key, title, subtitle, choicesHtml) {
    const open = formatOpen === key;
    return `<div class="play-choice-block${open ? " open" : ""}">
      <button class="play-block-toggle walking-choice" data-action="toggle-format-block" data-format="${key}" aria-expanded="${open}">
        <img class="walking-art" src="assets/mode-walk-multi.webp" alt="" width="720" height="480"><span class="walking-copy"><b>${title}</b><small>${subtitle}</small></span>
        <i class="play-block-chevron" aria-hidden="true">⌄</i>
      </button>
      ${open ? `<div class="play-choice-grid">${choicesHtml}</div>` : ""}
    </div>`;
  }

  function playChoices(resume) {
    const multi = `<button class="play-choice primary" data-action="setup"><span class="choice-icon">${playIcon("local")}</span><span><b>Un solo móvil</b><small>Pasad el teléfono en cada turno.</small></span><i aria-hidden="true">→</i></button>
      <button class="play-choice" data-action="online"><span class="choice-icon">${playIcon("online")}</span><span><b>Varios móviles</b><small>Cada persona juega desde su pantalla.</small></span><i aria-hidden="true">→</i></button>
      <button class="play-choice" data-action="local-multiplayer"><span class="choice-icon">${playIcon("offline")}</span><span><b>Sin conexión</b><small>Varios móviles, sin internet — una red Wi-Fi local basta.</small></span><i aria-hidden="true">→</i></button>
      ${resume ? '<button class="continue-choice" data-action="continue">Continuar la partida guardada <span>→</span></button>' : ""}`;
    const solo = `<button class="play-choice walking-choice" data-action="solo"><img class="walking-art" src="assets/mode-walk-solo.webp" alt="" width="720" height="480"><span class="walking-copy"><b>Jugar solo</b><small>Partida libre hasta perder las vidas.</small></span><i aria-hidden="true">→</i></button>`;
    const duelo = `<button class="play-choice walking-choice duel-choice" data-action="duel-home"><img class="walking-art" src="assets/mode-walk-duel.webp" alt="" width="1536" height="1024"><span class="walking-copy"><b>Retar a un amigo</b><small>Las mismas cartas para los dos, por enlace.</small></span><i aria-hidden="true">→</i></button>`;
    return `<section class="play-choices" aria-labelledby="play-choices-title"><div class="play-choices-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Elegir formato</div><h2 id="play-choices-title">¿Cómo quieres jugar?</h2></div></div>
      ${formatBlock("multi", "Multijugador", "Un solo móvil o varios.", multi)}
      <div class="direct-solo">${solo}</div>
      <div class="direct-solo">${duelo}</div>
    </section>`;
  }

  function competitionPromo() {
    return `<button class="comp-promo" data-action="competition-menu">
      <span class="comp-promo-art"><img src="assets/competition-engraving.webp" alt="" width="1000" height="667" decoding="async" loading="lazy"></span>
      <span class="comp-promo-copy"><span class="competition-kicker">Explora · Compite · Descubre</span><b>Cada ronda,<br>un nuevo reto</b><small>Un nuevo tema en cada ronda.<br>Solo o en compañía.</small><span class="competition-cta">Elegir cómo jugar <span aria-hidden="true">→</span></span></span>
    </button>`;
  }

  function competitionMenu() {
    screen = 'competition-menu';
    const multi = `<button class="play-choice primary" data-action="competition-local"><span class="choice-icon">${playIcon('local')}</span><span><b>Un solo móvil</b><small>Pasad el teléfono en cada turno.</small></span><i aria-hidden="true">→</i></button>
      <button class="play-choice" data-action="competition-online"><span class="choice-icon">${playIcon('online')}</span><span><b>Varios móviles</b><small>La misma sala durante todas las rondas.</small></span><i aria-hidden="true">→</i></button>`;
    paint(`<div class="shell home-shell play-menu-shell">${header('<button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="mode-masthead comp-atlas-intro"><img src="assets/competition-engraving.webp" alt="" width="1000" height="667" decoding="async"><div><div class="eyebrow">Mazos aleatorios</div><h1 data-focus tabindex="-1">Modo competición</h1><p>Termina una ronda y descubre otro mazo, sin repetir temáticas.</p></div></section>
      <section class="home-play"><div class="panel setup-grid">
        <div class="field"><label for="competition-length">Rondas</label><select id="competition-length">${[[3,'3 temas'],[5,'5 temas'],[CT.Tournament.modes().length,'Todos los temas']].map(([n,label])=>`<option value="${n}"${n===competitionConfig.rounds?' selected':''}>${label}</option>`).join('')}</select></div>
        <div class="field"><label for="competition-cards">Cartas por ronda y persona</label><select id="competition-cards">${[1,2,3,4,5,6].map(n=>`<option${n===competitionConfig.cards?' selected':''}>${n}</option>`).join('')}</select></div>
      </div><section class="play-choices"><div class="play-choices-head"><h2>¿Cómo quieres jugar?</h2></div>
        ${formatBlock('competition-multi','Multijugador','Un solo móvil o varios.',multi)}
        <div class="direct-solo"><button class="play-choice walking-choice" data-action="start-competition"><img class="walking-art" src="assets/mode-walk-solo.webp" alt="" width="720" height="480"><span class="walking-copy"><b>Jugar solo</b><small>Suma tus aciertos a lo largo de las rondas.</small></span><i aria-hidden="true">→</i></button></div>
      </section>
      ${loadCompetition() ? '<button class="btn btn-secondary btn-block" data-action="resume-competition">Continuar competición en solitario</button>' : ''}
      ${CT.Storage.getItem(MULTI_COMP_KEY) ? '<button class="btn btn-secondary btn-block" data-action="competition-resume">Continuar competición multijugador guardada</button>' : ''}
      </section></div>`);
  }

  function competitionOptions() {
    competitionConfig = {rounds:Number(document.getElementById('competition-length')?.value)||competitionConfig.rounds, cards:Number(document.getElementById('competition-cards')?.value)||competitionConfig.cards};
    return {...competitionConfig};
  }
  function prepareMultiCompetition() {
    pendingTournament = competitionOptions();
    setup();
    document.getElementById('hand-size').value = String(pendingTournament.cards);
    app.querySelector('.setup-section h2').textContent = 'Competición multijugador';
    app.querySelector('.setup-section .lead').textContent = `${pendingTournament.rounds} rondas con mazos aleatorios. Ganar la ronda suma un punto; las cartas que te queden en la mano restan su número menos uno.`;
  }
  function startTournamentRound(t, players, starter, ghost, pulse, excludedCardId = null) {
    selectedModeKey = t.queue[t.index];
    selectedBlockKey = CT.blockOf(selectedModeKey).key;
    cardsById = new Map(CT.cards(selectedModeKey).map(c=>[c.id,c]));
    const deck = shuffle(CT.cards(selectedModeKey).map(c=>c.id).filter(id => id !== excludedCardId));
    const handSize = Math.min(t.handSize, Math.floor((deck.length-1)/players.length));
    const powers = CT.Powers.create(deck,players.length,handSize,ghost,pulse);
    const roster = players.map(p=>({id:p.id,name:p.name,hand:deck.splice(0,handSize),pulseUsed:false,shieldRound:0}));
    const timeline=[deck.shift()];
    roster.forEach(p=>p.hand.forEach(id=>CT.Powers.claim(powers,id,p.id,deck)));
    game={mode:selectedModeKey,tournament:t,competitionGhost:ghost,pulse,...powers,players:roster,deck,discard:[],timeline,current:starter,starter,turnsInRound:0,round:1,winner:null,winners:null,tournamentIntro:true,pulseTurn:null,pulseGift:null};
    selectedCardId=null;pendingIndex=null;result=null;saveGame();renderTournamentIntro();
  }
  function nextTournamentRound() {
    if (!game?.tournament || !game.winners || game.tournament.index+1>=game.tournament.queue.length) return;
    startTournamentRound(CT.Tournament.next(game.tournament,game.players,game.winners),game.players,(game.starter+1)%game.players.length,game.competitionGhost,game.pulse);
  }
  function resumeMultiCompetition() {
    try {
      const saved=JSON.parse(CT.Storage.getItem(MULTI_COMP_KEY));
      CT.Saves.validate(saved,saved.mode);
      if (!saved.tournament?.queue?.every(CT.has) || saved.tournament.queue[saved.tournament.index]!==saved.mode) throw Error('Competición inválida');
      game=saved;selectedModeKey=game.mode;selectedBlockKey=CT.blockOf(game.mode).key;
      cardsById=new Map(game.savedDeck.map(c=>[c.id,c]));selectedCardId=null;pendingIndex=null;result=null;
      if(game.winners) renderWinner(game.players.filter(p=>game.winners.includes(p.id))); else if(game.tournamentIntro !== false) renderTournamentIntro(); else renderPass();
    } catch { showToast('No se pudo recuperar la competición guardada.'); }
  }
  function renderTournamentIntro() {
    screen = "tournament-intro";
    const mode = currentMode();
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}<section class="pass-screen"><div class="panel pass-card comp-splash">
      <div class="chapter-art" aria-hidden="true">${blockArt(CT.blockOf(game.mode).art, true)}</div>
      ${CT.Tournament.journey(game.tournament)}
      <div class="chapter-number">Tema ${game.tournament.index + 1} de ${game.tournament.queue.length}</div>
      <h2 data-focus tabindex="-1"><span class="comp-splash-lead">Competición · ronda ${game.tournament.index + 1}</span>${escapeHtml(mode.name)}</h2>
      <button class="btn btn-block comp-splash-start" data-action="competition-round-start">Empezar ronda</button>
    </div></section></div>`);
  }

  function homeMasthead() {
    return `<section class="home-masthead" aria-label="Continuum, un juego para ordenar y comparar">
      <div class="home-crest" aria-hidden="true"><img src="assets/continuum-emblem-800.webp" alt="" width="800" height="533" decoding="async" fetchpriority="high"></div>
      <div class="home-wordmark">Continuum</div>
      <div class="home-tagline">Ordena. Compara. Descubre.</div>
      <div class="home-ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    </section>`;
  }

  // El perfil entra por aquí y no por la cabecera: es un destino de la portada, como la
  // colección, y la barra de arriba ya tiene su trabajo con las acciones de cada pantalla.
  function homeNav() {
    return CT.UI.nav(screen);
  }


  function backMenu() {
    // La bienvenida no tiene nada detrás: hasta tener nombre no se entra en el juego.
    if (screen === "bienvenida") return;
    CT.prepareReturn?.();
    if (screen !== 'enciclopedia' && navigationTrail.length) {
      const previous = navigationTrail.pop();
      if (previous.screen !== screen) {
        navigatingBack = true;
        if (previous.mode !== selectedModeKey) setMode(previous.mode);
        selectedBlockKey = previous.block; formatOpen = previous.format;
        pendingTournament = previous.tournament; collectionOpen = previous.collectionOpen;
        collectionDetails = previous.collectionDetails; collectionIndexExpanded = previous.collectionIndexExpanded; jugarSection = previous.jugarSection || null;
        homeDestination = previous.homeDestination; profileReturn = previous.profileReturn;
        const render = {'home':home, 'jugar':jugarView, 'duelos':duelsView, 'play-menu':playMenu, 'competition-menu':competitionMenu, 'setup':setup, 'solo-home':soloHome, 'duel-home':duelHome, 'perfil':perfilView, 'duelo-intro':duelIntro}[previous.screen];
        if (render) render(); else { screen = previous.screen; paint(previous.html); }
        return;
      }
    }
    if (screen === 'setup' && pendingTournament) { pendingTournament=null;competitionMenu();return; }
    if (["setup", "solo-home", "duel-home", "online-loading", "online-error"].includes(screen)) playMenu();
    else if (screen === "duelo-intro") duelHome();
    else if (screen === "play-menu") { collectionOpen = true; collectionDetails = true; homeDestination = "collection"; jugarView(); }
    else if (["competition-menu", "quick-challenges"].includes(screen)) jugarView();
    else if (screen === "enciclopedia") app.querySelector('[data-action="enc-back"]')?.click();
    else if (screen === "perfil" && profileReturn === "play-menu") playMenu();
    else if (screen === "perfil" && profileReturn === "solo-home") soloHome();
    else home();
  }

  function quickActions() {
    const resume = game && !game.winners;
    const buttons = resume ? '<button class="btn btn-secondary" data-action="continue">Continuar partida</button>' : '';
    return buttons ? `<section class="quick-actions" aria-label="Jugar ahora">${buttons}</section>` : '';
  }
  function quickChallenges() {
    screen = "quick-challenges";
    CT.Quick.open((html, playing) => {screen = playing === "lobby" ? "quick-lobby" : playing ? "quick-game" : "quick-challenges"; paint(html);});
  }

  // ── Bienvenida ─────────────────────────────────────────────────────────────────────
  //
  // La primera vez que se entra, el juego pregunta el nombre. El avatar sale de él y se
  // ve mientras se escribe. Quien ya tenía nombre de antes se reconoce y no pasa por aquí
  // (`CT.Identidad.reconoce`).
  let bienvenidaNombre = "";
  function bienvenida(error = "") {
    screen = "bienvenida";
    const nombre = bienvenidaNombre || CT.Identidad.nombre();
    paint(`<div class="shell bienvenida-shell"><section class="bienvenida">
      <div class="bienvenida-avatar" data-avatar-vivo>${CT.Avatares.markup(nombre, { size: 112 })}</div>
      <h1 data-focus tabindex="-1">Bienvenido a Continuum</h1>
      <p class="lead">¿Cómo te llamas?</p>
      <form class="bienvenida-form" data-bienvenida="nombre" novalidate>
        <label class="solo-lectores" for="bienvenida-nombre">Tu nombre</label>
        <input id="bienvenida-nombre" type="text" autocomplete="nickname" maxlength="${CT.Identidad.MAX}" placeholder="Tu nombre" value="${escapeHtml(nombre)}" aria-describedby="bienvenida-error bienvenida-pista" data-avatar-de>
        <p id="bienvenida-error" class="bienvenida-error" role="alert">${escapeHtml(error)}</p>
        <button class="btn btn-primary btn-block" type="submit">Empezar a jugar <span aria-hidden="true">→</span></button>
      </form>
      <p class="hint" id="bienvenida-pista">Tu avatar sale de tu nombre. Podrás cambiar el nombre en el Atlas.</p>
    </section></div>`);
  }

  // El nombre se guarda también en la cuenta, si la hay: es el del ranking y los duelos.
  // Si otra cuenta ya lo usa, se dice y se deja elegir otro.
  async function guardaNombre(nombre) {
    const problema = CT.Identidad.problema(nombre);
    if (problema) throw Error(problema);
    if (CT.Accounts?.ready && CT.Accounts.renombra) await CT.Accounts.renombra(CT.Identidad.limpia(nombre));
  }

  async function bienvenidaNombreEnviado(boton) {
    const nombre = CT.Identidad.limpia(document.getElementById("bienvenida-nombre")?.value);
    bienvenidaNombre = nombre;
    if (boton) boton.disabled = true;
    try {
      await guardaNombre(nombre);
      CT.Identidad.guarda({ nombre });
    } catch (error) {
      bienvenida(error.message || "No se ha podido guardar el nombre.");
      document.getElementById("bienvenida-nombre")?.focus();
      return;
    }
    bienvenidaNombre = "";
    home();
  }

  // La portada tiene tres puertas y nada más: jugar, el reto del día y el atlas. Encima,
  // solo cuando hay algo pendiente, el aviso de los duelos en los que te toca.
  function home() {
    CT.Quick.leave();
    pendingTournament = null;
    screen = "home";
    paint(`<div class="shell home-shell home-doors-shell">${header()}
      ${homeMasthead()}${quickActions()}
      <div id="home-duels" class="home-duels"></div>
      <section class="home-doors" aria-label="Qué quieres hacer">
        ${homeDoor("jugar", "Jugar", "Colecciones, retos rápidos y competición.", "home-door-jugar", 344, 378)}
        ${dailyDoor()}
        ${homeDoor("perfil", "Atlas", "Tus cartas, tu progreso y tus logros.", "hero-geography", 859)}
      </section>
      ${homeNav()}
      <p class="app-version" id="app-version"></p>
    </div>`);
    showCacheVersion();
    refreshDuelBanner();
  }

  // `ancho` solo lo lleva una ilustración propia de la portada; las demás son las
  // portadas de 700 px de las familias.
  function homeDoor(action, title, text, art, alto, ancho = 0) {
    const src = ancho ? `assets/${art}.webp` : `assets/${art}-700.webp`;
    return `<button class="home-door" data-action="${action}">
      <span class="home-door-art" aria-hidden="true"><img src="${src}" alt="" width="${ancho || 700}" height="${alto}" decoding="async"></span>
      <span class="home-door-copy"><b>${title}</b><small>${text}</small><span class="home-door-cta" aria-hidden="true">Entrar →</span></span>
    </button>`;
  }

  // El mazo del día es sorpresa: la portada no lo nombra ni enseña su ilustración, y se
  // descubre al empezar. Una vez jugado ya no hay nada que esconder y se dice cuál fue.
  function dailyDoor() {
    const dia = today();
    const records = dailyRecords(), hecho = records.days?.[dia], racha = dailyStreak(records);
    const pendiente = !hecho && loadDaily();
    // Sin racha no se dice nada: la línea solo aparece cuando hay días que contar.
    const rachaTexto = racha ? `<span class="home-daily-streak">${glyph(GLYPHS.racha)}<span>${racha} ${racha === 1 ? "día seguido" : "días seguidos"}</span></span>` : "";
    const detalle = hecho
      ? `${escapeHtml(CT.mode(dailyModeKey(dia)).name)}: <strong>${hecho.hits} de ${hecho.total}</strong>`
      : "Un mazo sorpresa cada día.";
    const copy = `<b>Reto diario</b>
      <small>${detalle}</small>
      ${rachaTexto}`;
    const arte = `<span class="home-door-art home-daily-art" aria-hidden="true"><img src="assets/hero-history-700.webp" alt="" width="700" height="467" decoding="async"></span>`;
    if (hecho) return `<article class="home-door home-door-daily is-done">${arte}<span class="home-door-copy">${copy}
      <button class="btn btn-secondary home-daily-share" data-action="share-daily-home">Compartir resultado</button></span></article>`;
    return `<button class="home-door home-door-daily" data-action="daily-start">${arte}<span class="home-door-copy">${copy}
      <span class="home-door-cta" aria-hidden="true">${pendiente ? "Continuar el reto" : "Jugar el reto de hoy"} →</span></span></button>`;
  }

  // La hoja de calendario del día: el reto es de hoy y cambia mañana, y eso es lo que
  // dice el dibujo, sin desvelar de qué mazo va. Trazos con los colores de la edición.
  // Una alegoría neutral de Continuum: cartas sin tema, órbitas y una línea temporal.
  // Prepara la sorpresa sin adelantar el mazo que saldrá en la ruleta.
  function dailyMysteryArt() {
    return `<svg class="daily-mystery-art" viewBox="0 0 260 180" role="presentation">
      <g class="daily-mystery-orbits">
        <ellipse cx="130" cy="88" rx="105" ry="68"/>
        <ellipse cx="130" cy="88" rx="82" ry="51"/>
        <path d="M130 13v11M130 152v11M24 88h13M223 88h13"/>
      </g>
      <g class="daily-mystery-cards">
        <g transform="rotate(-11 91 91)">
          <rect class="daily-mystery-card" x="48" y="37" width="86" height="112" rx="7"/>
          <path class="daily-mystery-card-line" d="M60 52h62M60 134h62"/>
          <circle class="daily-mystery-card-seal" cx="91" cy="91" r="17"/>
        </g>
        <g transform="rotate(11 169 91)">
          <rect class="daily-mystery-card" x="126" y="37" width="86" height="112" rx="7"/>
          <path class="daily-mystery-card-line" d="M138 52h62M138 134h62"/>
          <circle class="daily-mystery-card-seal" cx="169" cy="91" r="17"/>
        </g>
        <rect class="daily-mystery-card daily-mystery-card-main" x="87" y="27" width="86" height="122" rx="8"/>
        <path class="daily-mystery-card-line" d="M100 43h60M100 133h60"/>
        <path class="daily-mystery-diamond" d="m130 47 7 7-7 7-7-7Z"/>
      </g>
      <path class="daily-mystery-thread-shadow" d="M65 94c19-29 42-29 65 0s46 29 65 0c-19-29-42-29-65 0s-46 29-65 0Z"/>
      <path class="daily-mystery-thread" d="M65 94c19-29 42-29 65 0s46 29 65 0c-19-29-42-29-65 0s-46 29-65 0Z"/>
      <g class="daily-mystery-timeline">
        <path d="M42 159h176"/>
        <circle cx="62" cy="159" r="4"/><circle cx="96" cy="159" r="3"/>
        <circle cx="130" cy="159" r="5"/><circle cx="164" cy="159" r="3"/>
        <circle cx="198" cy="159" r="4"/>
      </g>
    </svg>`;
  }

  function shareDailyFromHome() {
    const dia = today(), records = dailyRecords(), hecho = records.days?.[dia];
    if (!hecho) return;
    compartir(shareText(CT.mode(dailyModeKey(dia)).name, dia, hecho.hits, hecho.total, hecho.sequence || [], records.streak), "Resultado copiado");
  }

  // El aviso solo existe cuando hay algo que hacer, y lleva siempre a la lista de duelos:
  // ahí cada uno dice contra quién es, a quién le toca y cómo va, y se entra tocándolo.
  let pendingDuels = [];
  function refreshDuelBanner() {
    const box = document.getElementById("home-duels");
    if (!box) return;
    turnDuelReady.then(() => CT.TurnDuel?.list?.() || []).then(partidas => {
      if (!box.isConnected || screen !== "home") return;
      pendingDuels = CT.TurnDuel.pending?.(partidas) || [];
      if (!pendingDuels.length) return;
      const n = pendingDuels.length;
      const turnos = pendingDuels.filter(g => g.status === "playing").length, retos = n - turnos;
      const detalle = [turnos ? `${turnos} ${turnos === 1 ? "te espera" : "te esperan"}` : "", retos ? `${retos} ${retos === 1 ? "reto nuevo" : "retos nuevos"}` : ""].filter(Boolean).join(" · ");
      box.innerHTML = `<button class="home-duels-banner" data-action="duels-open"><span class="home-duels-mark" aria-hidden="true">⚔</span><span><b>${n === 1 ? "Tienes un duelo pendiente" : `Tienes ${n} duelos pendientes`}</b><small>${detalle}</small></span><i aria-hidden="true">→</i></button>`;
    }).catch(() => { /* sin conexión no hay aviso: la portada sigue igual */ });
  }

  function openPendingDuels() { duelsView(); }

  // Todos tus duelos por turnos, agrupados por lo que esperan: tu turno, el del rival,
  // retos recibidos, invitaciones enviadas e historial.
  function duelsView() {
    screen = "duelos";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="setup-section perfil-section">
        <header class="atlas-page-heading"><div class="eyebrow">Retos entre amigos</div><h1 data-focus tabindex="-1">Tus duelos</h1><p>En qué punto está cada uno y a quién le toca.</p></header>
        <section class="panel turn-duel-profile" id="turn-duels-list"><p role="status">Cargando tus duelos…</p></section>
      </section>
      ${homeNav()}
    </div>`);
    const box = document.getElementById("turn-duels-list");
    turnDuelReady.then(() => CT.TurnDuel?.list?.() || []).then(partidas => {
      if (!box?.isConnected || screen !== "duelos") return;
      box.innerHTML = CT.TurnDuel.profileMarkup(partidas).replace(/^<h2>Mis duelos<\/h2>/, "");
    }).catch(() => { if (box?.isConnected && screen === "duelos") box.innerHTML = '<p>No se pudieron cargar los duelos. Comprueba tu conexión y vuelve a intentarlo.</p>'; });
  }

  // Después de tocar un duelo (rendirse, archivar, bloquear…) se repinta la pantalla
  // desde la que se tocó.
  function duelsRefresh() { screen === "duelos" ? duelsView() : perfilView(); }

  // Jugar: primero qué, luego cómo. Tres bloques, cada uno con su propio «¿Cómo quieres
  // jugar?» detrás.
  function jugarView() {
    CT.Quick.leave();
    pendingTournament = null;
    screen = "jugar";
    if (collectionIndexExpanded) jugarSection = "collections";
    paint(`<div class="shell home-shell home-gallery-shell jugar-shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}
      <header class="atlas-page-heading jugar-heading"><div class="eyebrow">Elige tu próxima partida</div><h1 data-focus tabindex="-1">¿Qué te apetece jugar?</h1><p>Explora un tema, prueba un reto o lánzate a competir.</p></header>
      <div class="play-catalog">
        ${catalogSection("collections", "01", "Grandes colecciones", "Historia, ciencia, naturaleza y mucho más.", "Explorar los mazos")}
        ${catalogSection("quick", "02", "Retos rápidos", "Temas concretos para una partida diferente.", "Descubrir los retos")}
        ${catalogSection("competition", "03", "Competición", "Pon a prueba lo que sabes, ronda a ronda.", "Ver cómo competir")}
      </div>
      ${homeNav()}
    </div>`);
  }

  function catalogContent(key) {
    if (key === "collections") return `<p class="catalog-hint">Elige una colección para desplegar sus mazos.</p><section id="deck-collection">${gallery()}</section>`;
    if (key === "quick") return `<div class="home-quick"><div class="gallery">${CT.Quick.blocks()}</div></div>`;
    return `<div class="home-competition">${competitionPromo()}</div>`;
  }

  function catalogSection(key, number, title, description, cta) {
    const open = jugarSection === key;
    return `<section class="catalog-section catalog-${key}${open ? " is-open" : ""}" data-catalog="${key}">
      <h2><button class="catalog-toggle" data-action="toggle-play-catalog" data-section="${key}" aria-expanded="${open}" aria-controls="catalog-${key}">
        <span class="catalog-number" aria-hidden="true">${number}</span><span class="catalog-copy"><strong>${title}</strong><small>${description}</small><span class="catalog-cta">${cta}</span></span><span class="catalog-chevron" aria-hidden="true">+</span>
      </button></h2>
      <div id="catalog-${key}" class="catalog-drawer"${open ? "" : " inert"}><div class="catalog-drawer-inner">${open ? catalogContent(key) : ""}</div></div>
    </section>`;
  }

  function toggleCatalog(key) {
    jugarSection = jugarSection === key ? null : key;
    collectionIndexExpanded = jugarSection === "collections";
    app.querySelectorAll("[data-catalog]").forEach(section => {
      const open = section.dataset.catalog === jugarSection;
      const drawer = section.querySelector(".catalog-drawer");
      const inner = drawer.firstElementChild;
      if (open && !inner.innerHTML) inner.innerHTML = catalogContent(key);
      // Medir la fila cerrada permite animar su altura incluso al cargarla por primera vez.
      void drawer.offsetHeight;
      section.classList.toggle("is-open", open);
      section.querySelector(".catalog-toggle").setAttribute("aria-expanded", String(open));
      drawer.inert = !open;
    });
    rememberView();
  }

  // Se llega aquí con un mazo ya elegido, así que es el sitio natural para ojearlo
  // entero antes de decidir cómo jugarlo.
  function playMenu() {
    screen = "play-menu";
    const resume = game && game.mode === selectedModeKey;
    const block = CT.block(selectedBlockKey);
    const art = BLOCK_ART[block.art];
    paint(`<div class="shell home-shell play-menu-shell">${header('<button class="icon-btn" data-action="collection-back">Volver</button>')}
      ${CT.UI.deckIntro(selectedModeKey, `assets/${art.archivo}-700.webp`)}
      <section class="home-play">${playChoices(resume)}</section>
    </div>`);
    window.scrollTo(0, 0);
  }

  // Entrada editorial: la cabecera ya está en su lugar. No viaja ninguna portada,
  // no se mide su geometría ni se bloquea la navegación esperando una animación.
  function openMode(modeKey) {
    // Si el mazo no es suyo, `setMode` ya ha pintado la explicación: pintar el menú
    // encima la borraría y dejaría un botón que no hace nada.
    if (!setMode(modeKey)) return;
    collectionOpen = true;
    collectionDetails = true;
    playMenu();
  }

  // Compartida con el diagnóstico de más abajo: es la misma búsqueda, una sola vez.
  async function cacheVersion() {
    return CT.APP_VERSION;
  }

  async function showCacheVersion() {
    const key = await cacheVersion();
    // Nada llama a esto con `await`: si la pantalla ya cambió (o, en pruebas, si la
    // ventana ya se cerró) para cuando `cacheVersion()` resuelve, tocar el DOM puede
    // fallar. No es un fallo que nadie necesite ver ni reportar.
    try {
      const label = document.getElementById("app-version");
      if (key && label) label.textContent = key;
    } catch { /* la pantalla ya no está: no hay nada que actualizar */ }
  }

  // Lo que hace falta para depurar un fallo a distancia: qué versión hay instalada,
  // en qué pantalla estaba la persona y a qué hora. Se usa tanto en la pantalla de
  // «algo ha fallado» de más abajo como en el botón de comentarios de Ajustes, para no
  // mantener dos formatos distintos del mismo informe.
  async function buildDiagnostics(extra = "") {
    const version = (await cacheVersion()) || "sin instalar";
    const lineas = [
      `Continuum ${version}`,
      `Pantalla: ${screen}`,
      `Mazo: ${selectedModeKey}`,
      `Navegador: ${navigator.userAgent}`,
      `Hora: ${new Date().toISOString()}`
    ];
    if (extra) lineas.push("", extra);
    return lineas.join("\n");
  }

  // Cuando algo se rompe de verdad, la pantalla se queda en blanco y quien está probando
  // la aplicación no tiene forma de contarlo salvo describirlo de memoria. Este manejador
  // sustituye ese silencio por un aviso con lo necesario para depurarlo a distancia.
  //
  // No pasa por `paint()`: si algo ya se rompió, lo más seguro es no depender de la misma
  // maquinaria que acaba de fallar. Sí reutiliza `CT.openDialog`, que no toca nada del
  // estado del juego, solo el elemento que se le pasa.
  let crashShown = false;
  async function showCrash(mensaje) {
    if (crashShown) return;
    crashShown = true;
    // Nada espera a esto (ni podría: lo dispara un evento de error). Un manejador de
    // errores que a su vez lanza un error sin capturar no ayuda a nadie, así que todo su
    // cuerpo va protegido: si para cuando se ejecuta ya no hay documento donde pintar
    // —la página se está yendo, o en una prueba, la ventana ya se cerró—, se abandona en
    // silencio en vez de sumar un segundo fallo al primero.
    try {
      const detalle = await buildDiagnostics(mensaje);
      const capa = document.createElement("div");
      capa.className = "overlay";
      capa.innerHTML = `<div class="modal">
        <h2>Algo ha fallado</h2>
        <p>No es cosa tuya. Copia este texto y compártelo con quien mantiene la aplicación.</p>
        <div class="field"><textarea id="crash-detalle" rows="6" readonly>${escapeHtml(detalle)}</textarea></div>
        <button type="button" class="btn btn-primary btn-block" data-crash-action="copiar">Copiar</button>
        <button type="button" class="btn btn-secondary btn-block" style="margin-top:10px" data-crash-action="inicio">Volver al inicio</button>
      </div>`;
      document.body.appendChild(capa);
      CT.openDialog(capa, false);
      // El primer control focuseable es esta misma caja: seleccionar su texto de una vez
      // deja el copiado a mano tan a mano como el botón.
      const textarea = capa.querySelector("#crash-detalle");
      textarea.select();
      capa.querySelector('[data-crash-action="copiar"]').addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(detalle); }
        catch { textarea.select(); document.execCommand("copy"); }
      });
      capa.querySelector('[data-crash-action="inicio"]').addEventListener("click", () => location.reload());
    } catch { /* sin documento donde pintar, no hay aviso posible */ }
  }

  window.addEventListener("error", event => {
    // Un ruido conocido de algunos navegadores, inofensivo y ajeno a la aplicación.
    if (/ResizeObserver loop/.test(event.message || "")) return;
    // Safari (y otros navegadores) informan así, a propósito y sin más detalle, de
    // cualquier error que ocurra fuera del origen de la propia página —por ejemplo, al
    // tocar su icono nativo de compartir—: es una medida de seguridad del navegador, no
    // un aviso de que algo se haya roto aquí. `event.error` viene vacío también por eso:
    // un fallo real de la aplicación siempre trae su propio objeto de error.
    if (event.message === "Script error." && !event.error) return;
    showCrash(`${event.message || "Error sin mensaje"}\n${event.error?.stack || ""}`.trim());
  });
  window.addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    showCrash(reason instanceof Error ? `${reason.message}\n${reason.stack || ""}`.trim() : String(reason));
  });
  // El botón de comentarios de Ajustes usa el mismo informe, exista o no un fallo de por
  // medio: «esto no me cuadra» también merece poder mandarse con contexto.
  CT.appDiagnostics = () => buildDiagnostics();

  // Elegir bloque selecciona su primer juego, que es lo que se espera cuando solo hay uno.
  function setBlock(blockKey) {
    if (!CT.hasBlock(blockKey)) return;
    selectedBlockKey = blockKey;
    const games = CT.block(blockKey).games;
    if (!games.includes(selectedModeKey)) setMode(games[0]);
  }

  function setup() {
    screen = "setup";
    starterDraw = null;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="setup-section"><h2 data-focus tabindex="-1">${currentMode().name}</h2><p class="lead">Añade hasta 9 personas y decidid quién empieza adivinando la cifra de una carta.</p>
        <div class="panel">
          <div class="setup-block">
            <div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Jugadores</span></div>
            <div id="players"><div class="player-row"><input aria-label="Nombre del jugador 1" value="${escapeHtml(CT.Identidad.nombre() || "Jugador 1")}" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div><div class="player-row"><input aria-label="Nombre del jugador 2" value="Jugador 2" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div></div>
            <button class="btn btn-ghost" data-action="add-player">＋ Añadir participante</button>
            <section id="recent-players" class="recent-players" aria-label="Participantes recientes" hidden></section>
          </div>
          <div class="setup-block">
            <div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Cómo empezar</span></div>
            <div class="setup-grid">
              <div class="field starter-field">${starterFieldMarkup()}</div>
              <div class="field"><label for="hand-size">Cartas iniciales por persona</label><select id="hand-size"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div>
            </div>
          </div>
          <div class="setup-block">
            <div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Modo de juego</span></div>
            <div class="field"><label for="local-preset">Tipo de partida</label><select id="local-preset"><option value="simple">Primera partida · sin poderes</option><option value="advanced">Avanzada · Pulso y Fantasma</option></select></div>
            <label class="opt-row"><span>Cartas Fantasma <small>Esconde de 1 a 3 Fantasmas según los jugadores. Pueden salir al repartir o robar, o quedarse sin descubrir. Se guardan aparte y no cuentan para ganar.</small></span><input type="checkbox" id="ghost-toggle"></label>
            <label class="opt-row"><span>Cartas Pulso <small>Esconde de 1 a 3 poderes Pulso con el mismo reparto que Fantasma.</small></span><input type="checkbox" id="pulse-toggle"></label>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:20px" data-action="start">Barajar y empezar <span>→</span></button>
        </div>
      </section>
    </div>`);
    renderRecentPlayers();
  }

  // El campo que decide quién empieza: mientras no se ha jugado el minijuego, un botón
  // que lo lanza; en cuanto hay un resultado, quién ganó y la opción de repetirlo.
  function starterFieldMarkup() {
    const names = playerNames();
    if (!starterDraw || starterDraw.winner === null || starterDraw.names.length !== names.length) {
      return `<span class="field-label">Quién empieza</span><button type="button" class="btn btn-block starter-draw-cta" data-action="draw-starter"><span class="starter-draw-icon" aria-hidden="true">🂠</span><span class="starter-draw-copy"><b>Adivinar la fecha</b><small>Cada uno prueba con una carta y gana quien más se acerque</small></span><span class="starter-draw-arrow" aria-hidden="true">→</span></button>`;
    }
    const ganador = escapeHtml(names[starterDraw.winner] ?? `Jugador ${starterDraw.winner + 1}`);
    return `<span class="field-label">Quién empieza</span><p class="starter-result"><span class="starter-result-crown" aria-hidden="true">${crownIcon()}</span><strong>${ganador}</strong> ha acertado más cerca y empieza.</p><button type="button" class="btn btn-ghost" data-action="draw-starter">🂠 Repetir el sorteo</button>`;
  }
  const crownIcon = () => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8Z"/><path d="M5 21h14"/></svg>';

  function playerNames() {
    return [...document.querySelectorAll("#players input")].map((input, i) => input.value.trim() || `Jugador ${i + 1}`);
  }

  // Cuánto se aleja una respuesta del valor real de la carta, con el mismo criterio que
  // usa el duelo de cifras: en años y siglos el error se mide en unidades, porque errar
  // un siglo pesa igual en el año 200 que en el 1900; en el resto se mide en proporción,
  // porque errar 100 habitantes no es lo mismo en un pueblo que en una capital.
  function starterError(modeKey, card, guess) {
    const real = CT.sortValue(modeKey, card);
    const anos = !!reglaCifra(modeKey).anos;
    return anos || real === 0 ? Math.abs(guess - real) : Math.abs(guess - real) / Math.abs(real);
  }

  // El minijuego para decidir quién empieza: se saca una única carta del mazo elegido y,
  // pasando el móvil, cada persona escribe a qué cifra cree que corresponde. Gana quien
  // más se acerque al valor real, y esa carta se aparta del mazo antes de repartir: ya se
  // ha visto de sobra como para que vuelva a salir en la partida.
  function beginStarterDraw() {
    const names = playerNames();
    if (names.length < 2) return showToast("Se necesitan al menos 2 jugadores");
    const cardId = shuffle(currentMode().cards.map(card => card.id))[0];
    starterDraw = { names, cardId, step: 0, guesses: [], winner: null, drawnIds: [cardId] };
    renderStarterGuess();
  }

  function starterCard() { return cardsById.get(starterDraw.cardId) || currentMode().cards.find(c => c.id === starterDraw.cardId); }

  // Un único diálogo para todo el minijuego: la primera llamada lo abre con su
  // contenido ya dentro (para que el foco y el título del lector de pantalla se
  // calculen bien desde el principio) y las siguientes solo reemplazan lo de dentro, así
  // el paso de una persona a otra no va dejando diálogos apilados ni un Escape que
  // retrocede a la pregunta de quien ya contestó.
  function renderStarterDialog(modalHtml) {
    const existing = app.querySelector('[data-starter-dialog] .modal');
    if (existing) { existing.innerHTML = modalHtml; return; }
    overlay(`<div class="overlay" data-starter-dialog><div class="modal">${modalHtml}</div></div>`, true);
  }

  function renderStarterGuess() {
    const card = starterCard();
    const regla = reglaCifra(selectedModeKey);
    const jugador = escapeHtml(starterDraw.names[starterDraw.step]);
    renderStarterDialog(`<h2>Pasa el móvil a ${jugador}</h2>
      <div class="cifra-card starter-card"><div class="starter-card-art" aria-label="Ilustración de ${escapeHtml(card.title)}">${animalArt(card)}</div>${categoryBadge(card)}<strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(regla.pregunta || "")}</span></div>
      <div class="field cifra-field">
        <label for="starter-guess-input">Tu cifra${regla.unidad ? ` <span class="cifra-unidad">en ${escapeHtml(regla.unidad)} si no pones otra</span>` : ""}</label>
        <input id="starter-guess-input" type="text" inputmode="${regla.decimales ? "decimal" : "numeric"}" autocomplete="off" enterkeyhint="send">
        <p class="hint">${escapeHtml(regla.pista || "")}</p>
      </div>
      <div class="actions"><button class="btn btn-primary btn-block" data-action="starter-guess-submit">Adivinar <span>→</span></button></div>`);
    const campo = app.querySelector("#starter-guess-input");
    campo?.focus({ preventScroll: true });
    // En iOS el teclado tarda un pelín en abrirse y el viewport en recalcularse: sin este
    // empujón el campo puede quedar tapado hasta que el usuario desplace a mano.
    campo?.addEventListener("focus", () => campo.scrollIntoView({ block: "center", behavior: "smooth" }));
    campo?.addEventListener("keydown", evento => { if (evento.key === "Enter") { evento.preventDefault(); starterGuessSubmit(); } });
  }

  function starterGuessSubmit() {
    const campo = app.querySelector("#starter-guess-input");
    const valor = leeCifra(campo ? campo.value : "", selectedModeKey);
    if (valor === null) return showToast("Escribe una cifra válida");
    starterDraw.guesses.push(valor);
    starterDraw.step += 1;
    if (starterDraw.step < starterDraw.names.length) { renderStarterGuess(); return; }
    const card = starterCard();
    const errores = starterDraw.guesses.map(guess => starterError(selectedModeKey, card, guess));
    const winner = errores.indexOf(Math.min(...errores));
    starterDraw.winner = winner;
    document.querySelector(".starter-field").innerHTML = starterFieldMarkup();
    announce(`${starterDraw.names[winner]} ha acertado más cerca y empieza la partida.`);
    renderStarterDialog(`<h2>¿Quién empieza?</h2>
      <div class="starter-winner-banner"><span class="starter-winner-crown" aria-hidden="true">${crownIcon()}</span><b>${escapeHtml(starterDraw.names[winner])}</b><span>Empieza la partida</span></div>
      <div class="cifra-card starter-card"><div class="starter-card-art" aria-label="Ilustración de ${escapeHtml(card.title)}">${animalArt(card)}</div>${categoryBadge(card)}<strong>${escapeHtml(card.title)}</strong><span>El valor real era ${escapeHtml(CT.formatValue(selectedModeKey, card))}</span></div>
      <ul class="starter-draw-list">${starterDraw.names.map((name, i) => `<li${i === winner ? ' class="starter-draw-winner"' : ''}><span>${escapeHtml(name)}</span><span>${escapeHtml(Cifras.formato(selectedModeKey, starterDraw.guesses[i]))}</span></li>`).join("")}</ul>
      <div class="actions"><button class="btn btn-primary btn-block" data-action="close-menu">Aceptar</button></div>`);
  }

  function syncStarterOptions() {
    const inputs = [...document.querySelectorAll("#players input")];
    inputs.forEach((input, i) => input.setAttribute("aria-label", `Nombre del jugador ${i + 1}`));
    const field = document.querySelector(".starter-field");
    if (field) field.innerHTML = starterFieldMarkup();
  }

  function renderRecentPlayers() {
    const host = document.getElementById("recent-players");
    if (!host || !CT.RecentPlayers) return;
    const active = [...document.querySelectorAll("#players input")].map(input => input.value);
    const names = CT.RecentPlayers.available(active);
    host.hidden = !names.length;
    host.innerHTML = names.length ? `<div class="recent-players-head"><strong>Jugadores recientes</strong><button type="button" data-action="clear-recent-players">Borrar lista</button></div><div class="recent-player-list">${names.map(name => {
      const encoded = encodeURIComponent(name);
      return `<span class="recent-player"><button type="button" data-action="add-recent-player" data-recent-name="${encoded}" aria-label="Añadir a ${escapeHtml(name)}">＋ ${escapeHtml(name)}</button><button type="button" data-action="remove-recent-player" data-recent-name="${encoded}" aria-label="Olvidar a ${escapeHtml(name)}">×</button></span>`;
    }).join("")}</div>` : "";
  }

  function appendPlayer(name = "") {
    const rows = document.querySelectorAll("#players .player-row");
    if (rows.length >= 9) return showToast("El máximo es de 9 jugadores");
    const value = name || `Jugador ${rows.length + 1}`;
    document.getElementById("players").insertAdjacentHTML("beforeend", `<div class="player-row"><input aria-label="Nombre del jugador ${rows.length + 1}" value="${escapeHtml(value)}" maxlength="18"><button class="remove" data-action="remove-player" aria-label="Quitar jugador">×</button></div>`);
    syncStarterOptions();
    renderRecentPlayers();
  }

  // El avatar de cada jugador sale de su nombre, como el tuyo.
  function jugadorAvatar(jugador, size) {
    return CT.Avatares.markup(jugador.name, { size });
  }

  function startGame() {
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    const inputs = [...document.querySelectorAll("#players input")];
    if (inputs.length < 2) return showToast("Se necesitan al menos 2 jugadores");
    const names = inputs.map((input, i) => input.value.trim() || `Jugador ${i + 1}`);
    CT.RecentPlayers?.remember(names);
    // Si nadie ha jugado el minijuego, se decide igualmente y sin pantalla: la partida
    // siempre arranca a partir de un sorteo, se haya visto o no. Sin adivinanzas de por
    // medio no hay quien acertó más cerca, así que aquí el sorteo es solo quién empieza.
    if (!starterDraw || starterDraw.winner === null || starterDraw.names.length !== names.length) {
      const cardId = shuffle(currentMode().cards.map(card => card.id))[0];
      starterDraw = { names, cardId, step: names.length, guesses: [], winner: Math.floor(Math.random() * names.length), drawnIds: [cardId] };
    }
    const requestedHand = Number(document.getElementById("hand-size").value);
    const handSize = Math.min(requestedHand, Math.floor((currentMode().cards.length - 1) / names.length));
    if (handSize < requestedHand) showToast(`Mazo pequeño: ${handSize} cartas por persona para reservar el tablero.`);
    const starter = starterDraw.winner;
    const drawnIds = starterDraw.drawnIds;
    const ghost = !!document.getElementById("ghost-toggle")?.checked;
    const pulse = !!document.getElementById("pulse-toggle")?.checked;
    if (pendingTournament) {
      const t=CT.Tournament.create(pendingTournament.rounds,requestedHand);pendingTournament=null;
      startTournamentRound(t,names.map((name,i)=>({id:i+1,name})),starter,ghost,pulse,starterDraw.cardId);return;
    }
    // Las cartas que se sacaron para decidir quién empieza ya se han visto: se apartan
    // del mazo para que nadie vuelva a encontrárselas en la partida.
    const shuffled = shuffle(currentMode().cards.map(card => card.id).filter(id => !drawnIds.includes(id)));
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
    if (game.final) return renderFinalPass();
    screen = "pass";
    const player = currentPlayer();
    // Quien recibió una carta en el Pulso de otro se entera aquí, al recoger el móvil, y
    // no antes: es su carta y nadie más tiene por qué verla en la pantalla de paso.
    const regalo = game.pulseGift && game.pulseGift.to === player.id
      ? `<p class="pulse-gift">⚡ <b>${escapeHtml(game.pulseGift.from)}</b> te ha pasado <b>${escapeHtml(cardsById.get(game.pulseGift.cardId).title)}</b> con su Pulso.</p>`
      : "";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <section class="pass-screen"><div class="panel pass-card"><div class="player-medallion player-medallion-avatar">${jugadorAvatar(player, 76)}</div><div class="eyebrow">${game.tournament ? `Competición · ronda ${game.tournament.index + 1} de ${game.tournament.queue.length}` : `Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}`}</div><h2 data-focus tabindex="-1">El turno es de<br>${escapeHtml(player.name)}</h2><p>Pásale el móvil. Las fechas siguen ocultas hasta colocar una carta.</p>${regalo}<button class="btn btn-primary btn-block" data-action="ready">Empezar mi turno <span>→</span></button></div></section>
    </div>`);
  }

  function gameView() {
    screen = "game";
    // Durante la defensa de un Pulso el móvil lo tiene quien ha sido retado, no quien
    // tiene el turno: es su jugada la que se está haciendo.
    const player = actingPlayer();
    const defending = pulseStage() === PULSE_DEFENSA;
    const timelineCards = game.timeline.map(id => cardsById.get(id));
    const handCards = player.hand.map(id => cardsById.get(id)).filter(card => !(pendingIndex !== null && selectedCardId === card.id));
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
    // Las dos mitades del duelo enseñan la misma carta; lo que cambia es a quién se le
    // habla y qué se juega en esa mitad. Se calcula al vuelo y no antes: sin Pulso en
    // marcha no hay a quién nombrar.
    const pistaPulso = () => pendingIndex !== null
      ? "Confirma el hueco elegido o toca otro"
      : defending
        ? `Colócala tú también. Si aciertas, no te llevas ninguna carta de ${escapeHtml(currentPlayer().name)}`
        : `Colócala. Si aciertas y ${escapeHtml(pulseTarget.name)} falla, le pasas una carta tuya`;
    const manoHtml = pulseCard
      ? `<section><div class="hand-title"><h3>Carta del duelo</h3><small>${defending ? `te reta ${escapeHtml(currentPlayer().name)}` : `contra ${escapeHtml(pulseTarget.name)}`}</small></div>${pendingIndex === null ? `<div class="hand hand-solo"><div class="hand-card selected" data-id="${pulseCard.id}">${categoryBadge(pulseCard)}<span class="hidden-date">${currentAxis().hiddenLabel}</span>${cardBack()}<strong>${escapeHtml(pulseCard.title)}</strong></div></div>` : `<p class="hint provisional-hand-note">La carta está en la línea como vista previa.</p>`}<p class="hint">${pistaPulso()}</p></section>`
      : `<section><div class="hand-title"><h3>Tus cartas</h3><small>${handCards.length} en mano</small></div><div class="hand">${handCards.map(card => `<button class="hand-card ${selectedCardId === card.id ? "selected" : ""}" data-action="select-card" data-id="${card.id}" aria-pressed="${selectedCardId === card.id}">${categoryBadge(card)}<span class="hidden-date">${currentAxis().hiddenLabel}</span>${cardBack()}<strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`).join("")}</div><p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Toca una carta para seleccionarla y después un hueco +, o mantenla pulsada y arrástrala hasta el hueco"}</p>${!game.pulsePower && pulseAvailable(player) ? `<button class="btn btn-secondary btn-block pulse-btn" data-action="pulse-open">⚡ Usar mi Pulso <small>una vez por partida</small></button>` : ""}</section>`;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">${defending ? `Defiendes el Pulso de ${escapeHtml(currentPlayer().name)}, ${escapeHtml(player.name)}` : `Turno de ${escapeHtml(player.name)}, ronda ${game.round}`}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">${defending ? "⚡ Defensa del Pulso" : `${game.tournament ? `Competición · ronda ${game.tournament.index + 1} de ${game.tournament.queue.length}` : `Ronda ${game.round} · Turno ${game.turnsInRound + 1} de ${game.players.length}`}`}</div><div class="turn-name" aria-hidden="true">${escapeHtml(player.name)}</div></div><div class="deck-count"><strong>${game.deck.length}</strong><span>mazo</span></div></div>
      <section class="scoreboard-panel" aria-label="Jugadores"><div class="scoreboard-title">Jugadores</div><div class="scoreboard">${game.players.map((p, i) => `<span class="score ${i === game.current ? "active" : ""}"${i === game.current ? ' aria-current="true"' : ""}><i class="score-avatar">${jugadorAvatar(p, 40)}</i><span class="score-copy"><b>${escapeHtml(p.name)}</b><span class="score-progress" aria-hidden="true"><i style="--player-progress:${playerProgress(p.hand.length, game.players)}%"></i></span></span><em><strong>${p.hand.length}</strong><small>cartas</small></em></span>`).join("")}</div></section>
      ${pulseCard ? `<div class="pulse-banner">⚡ Duelo · <b>${escapeHtml(currentPlayer().name)}</b> reta a <b>${escapeHtml(pulseTarget.name)}</b>${defending ? " · te toca defender" : ""}</div>` : ""}
      ${CT.Ghost.banner(game.ghost, game.players)}
      ${manoHtml}
      <section class="board-timeline-section"><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${game.timeline.length} ${game.timeline.length === 1 ? "carta" : "cartas"}</small></div>${CT.timelineMap(selectedModeKey, timelineCards, { hidden: !!game.ghost?.pending.length })}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
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
    const animal = usesAnimalArt();
    // Con ilustración, la temática va fuera de la imagen (franja propia arriba) y el
    // resultado al fondo del todo, para que el título no empuje el zócalo sobre el dibujo.
    const body = animal
      ? `${categoryBadge(card)}<div class="card-visual era-${era.key}">${animalArt(card)}</div><div class="card-content"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p><div class="year">${formatValue(card)}</div></div>`
      : `<div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content">${categoryBadge(card)}<div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div>`;
    return `<article class="timeline-card card-flippable ${animal ? "animal-timeline-card" : ""}" data-id="${card.id}" role="button" tabindex="0" aria-label="${escapeHtml(card.title)}. Toca para ver la explicación.">${body}</article>`;
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
    return `<div class="slot-confirm provisional-placement" data-index="${pendingIndex}"><div class="slot-confirm-card"><small>Vista previa · sin confirmar</small><strong>${escapeHtml(card.title)}</strong><span aria-hidden="true">${escapeHtml(currentAxis().hiddenLabel)}</span></div>
      <button class="btn btn-primary btn-block" data-action="confirm-place" data-autofocus>Sí, aquí</button>
      <button class="btn btn-ghost btn-block" data-action="cancel-place">Cancelar</button></div>`;
  }

  function placeCard(index) {
    if (!selectedCardId) return;
    pendingIndex = null;
    const player = currentPlayer();
    const card = cardsById.get(selectedCardId);
    const played = CT.Engine.play({...game, hand:player.hand}, selectedCardId, index, id => sortValue(cardsById.get(id)));
    const {correct, returned} = played;
    player.hand = played.hand;
    game.timeline = played.timeline; game.deck = played.deck; game.discard = played.discard;
    if (played.drawnCardId != null) CT.Powers.claim(game, played.drawnCardId, player.id, game.deck);
    if (!correct) (game.failed = game.failed || []).push(selectedCardId);
    result = {
      correct, returned, card, playerName: player.name, attemptedIndex: index,
      correctIndex: correct ? null : CT.correctIndex(selectedModeKey, game.timeline.map(id => cardsById.get(id)), card)
    };
    CT.Effects.feedback(correct);
    selectedCardId = null;
    // El perfil se registra aquí y no al pintar: pintar se repite y contaría de más.
    const nuevaLamina=!CT.Progreso.seenCards().has(card.id)&&!!CT.cardArt(game.mode,card);
    anotaLogros(CT.Progreso.record({ mode: game.mode, cardId: card.id, correct, kind: "local", hidden: !!game.ghost?.pending.length }));
    if(nuevaLamina)game.newDiscoveries=(game.newDiscoveries||0)+1;
    saveGame();
    renderResult();
  }

  function drawCard(player) {
    const drawn = CT.Engine.draw(game.deck, game.discard);
    game.deck = drawn.deck; game.discard = drawn.discard;
    const id = drawn.cardId;
    if (id == null) return false;
    player.hand.push(id);
    CT.Powers.claim(game, id, player.id, game.deck);
    return true;
  }

  // ---------------------------------------------------------------------------
  // El Pulso: un duelo a ciegas
  //
  // Una sola vez por partida, en lugar de jugar tu turno, retas a otra persona. El mazo
  // saca una carta que no elige ninguno de los dos y la colocáis los dos: primero quien
  // reta y después, sin ver la respuesta del otro, quien ha sido retado. Se descubre todo
  // a la vez:
  //
  //   los dos aciertan     → nada, defensa perfecta
  //   solo quien reta      → le endosa una carta al azar de su mano
  //   solo quien defiende  → quien reta roba una
  //   ninguno de los dos   → quien reta roba una
  //
  // La carta se queda en la línea si alguno supo colocarla; si fallan los dos, al descarte.
  //
  // Decisiones que no son obvias:
  //
  // - Quien defiende nunca pierde una carta por fallar: solo la recibe si el otro acertó.
  //   Así fallar no castiga a los dos lados y quien ya no puede ganar no puede fallar
  //   aposta para acercar a nadie a la victoria. Es la misma razón por la que se puede
  //   retar a quien está a cero cartas esperando el final de la ronda, que sigue siendo
  //   la jugada más tensa del mecanismo.
  // - La carta que se entrega va al azar y se aparta al lanzar el Pulso, antes de que
  //   nadie coloque nada. Si pudieras elegirla soltarías siempre la que no sabes colocar,
  //   y el Pulso dejaría de ser una apuesta para ser un vertedero.
  // - Hacen falta dos cartas para lanzarlo. Con una sola, ganar el duelo te dejaría a cero
  //   regalándola, sin haberla colocado nunca en la línea: se saltaría la condición de
  //   victoria del juego.
  //
  // No hay cronómetro a propósito. La dificultad la pone lo llena que esté la línea: al
  // principio los huecos son anchos y acertáis los dos casi seguro —y entonces no pasa
  // nada—, pero al final son estrechos y es cuando el Pulso decide la partida.
  const PULSE_MIN_HAND = 2;

  // Las tres etapas de un duelo. Una partida guardada antes del duelo no las lleva: su
  // Pulso se queda en la primera, que es justo donde estaba.
  const PULSE_RETO = "reto", PULSE_PASE = "pase", PULSE_DEFENSA = "defensa";

  function pulseStage() { return game.pulseTurn ? game.pulseTurn.stage || PULSE_RETO : null; }

  // Quien tiene el móvil en la mano ahora mismo. Durante la defensa no es quien tiene el
  // turno, y es lo único del juego que separa esas dos cosas.
  function actingPlayer() {
    if (pulseStage() === PULSE_DEFENSA) return game.players.find(item => item.id === game.pulseTurn.targetId);
    return currentPlayer();
  }

  // Dónde ha colocado alguien la carta, dicho con palabras: es lo que cuenta el duelo al
  // revelarse, y lo único que le llega a quien usa un lector de pantalla.
  function posicionEnLinea(index, cartas) {
    const antes = cartas[index - 1];
    const despues = cartas[index];
    if (!antes && !despues) return "en la línea vacía";
    if (!antes) return `antes de «${escapeHtml(despues.title)}»`;
    if (!despues) return `después de «${escapeHtml(antes.title)}»`;
    return `entre «${escapeHtml(antes.title)}» y «${escapeHtml(despues.title)}»`;
  }

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
    // La carta que se pagaría si ganas el duelo se sortea aquí, con la mano todavía
    // intacta y antes de que nadie coloque nada: así no puede elegirse a posteriori.
    game.pulseTurn = {
      targetId, cardId, stage: PULSE_RETO,
      giftId: player.hand[Math.floor(Math.random() * player.hand.length)]
    };
    selectedCardId = null;
    pendingIndex = null;
    saveGame();
    gameView();
  }

  function aciertaEn(card, index) {
    return CT.Engine.fits(game.timeline, card.id, index, id => sortValue(cardsById.get(id)));
  }

  // Primera mitad del duelo: quien reta coloca y la jugada se guarda sin resolverse. No se
  // revela nada todavía, porque el móvil va a pasar a la otra persona.
  function placePulse(index) {
    const card = cardsById.get(game.pulseTurn.cardId);
    game.pulseTurn.byIndex = index;
    game.pulseTurn.byOk = aciertaEn(card, index);
    game.pulseTurn.stage = PULSE_PASE;
    pendingIndex = null;
    anotaLogros(CT.Progreso.record({ mode: game.mode, cardId: card.id, correct: game.pulseTurn.byOk, kind: "local", hidden: !!game.ghost?.pending.length, pulse: true }));
    saveGame();
    renderPulsePass();
  }

  // Segunda mitad: defiende quien ha sido retado y se descubre todo a la vez.
  function placePulseDefense(index) {
    const player = currentPlayer();
    const { targetId, cardId, byIndex, byOk } = game.pulseTurn;
    const target = game.players.find(item => item.id === targetId);
    const card = cardsById.get(cardId);
    const targetOk = aciertaEn(card, index);
    // Los textos de posición se calculan antes de tocar la línea: después, los índices ya
    // señalarían a otras cartas.
    const cartas = game.timeline.map(id => cardsById.get(id));
    const posiciones = { by: posicionEnLinea(byIndex, cartas), target: posicionEnLinea(index, cartas) };
    const giftId = player.hand.includes(game.pulseTurn.giftId) ? game.pulseTurn.giftId
      : player.hand[Math.floor(Math.random() * player.hand.length)];
    const resolved = CT.Engine.pulse({...game, byHand:player.hand, targetHand:target.hand},
      {...game.pulseTurn, giftId}, index, id => sortValue(cardsById.get(id)));
    game.timeline = resolved.timeline; game.deck = resolved.deck; game.discard = resolved.discard;
    player.hand = resolved.byHand; target.hand = resolved.targetHand;
    const penaltySkipped = resolved.penaltySkipped;
    const gift = resolved.giftId == null ? null : cardsById.get(resolved.giftId);
    if (!byOk && !targetOk) (game.failed = game.failed || []).push(cardId);
    if (gift) {
      target.shieldRound = game.round;
      game.pulseGift = {to:target.id, cardId:gift.id, from:player.name};
    }
    if (resolved.drawnCardId != null) CT.Powers.claim(game, resolved.drawnCardId, player.id, game.deck);
    game.pulseTurn = null;
    CT.Effects.feedback(targetOk);
    pendingIndex = null;
    result = {
      correct: byOk, card, pulse: true, duel: true, targetOk,
      byName: player.name, targetName: target.name, gift, posiciones, penaltySkipped
    };
    anotaLogros(CT.Progreso.record({ mode: game.mode, cardId: card.id, correct: targetOk, kind: "local", hidden: !!game.ghost?.pending.length, pulse: true }));
    saveGame();
    renderResult();
  }

  // El móvil cambia de manos en mitad de la jugada, así que hace falta una pantalla de
  // paso propia: la de un turno normal anuncia una ronda y un turno que aquí no cambian.
  function renderPulsePass() {
    screen = "pulse-pass";
    const target = game.players.find(item => item.id === game.pulseTurn.targetId);
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="game-menu">Partida</button>')}
      <section class="pass-screen"><div class="panel pass-card">
        <div class="player-medallion player-medallion-avatar">${jugadorAvatar(target, 76)}</div>
        <div class="eyebrow">⚡ Pulso · Te retan</div>
        <h2 data-focus tabindex="-1">Pásale el móvil a<br>${escapeHtml(target.name)}</h2>
        <p>Coloca la misma carta donde creas que va. No verás dónde la ha puesto ${escapeHtml(currentPlayer().name)} hasta que los dos hayáis jugado.</p>
        <button class="btn btn-primary btn-block" data-action="pulse-defend">Defender <span>→</span></button>
      </div></section>
    </div>`);
  }

  function pulseTargetMenu() {
    const opciones = pulseTargets().map(target =>
      `<button class="btn btn-secondary btn-block pulse-target" data-action="pulse-target" data-target="${target.id}"><b>${escapeHtml(target.name)}</b><small>${target.hand.length} ${target.hand.length === 1 ? "carta" : "cartas"}</small></button>`).join("");
    const protegidos = game.players.filter(player => player.id !== currentPlayer().id && player.shieldRound === game.round);
    overlay(`<div class="overlay"><div class="modal">
      <div class="eyebrow">Pulso</div>
      <h2>¿A quién retas?</h2>
      <p class="lead" style="margin-inline:auto">${CT.pulseRules}</p>
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
    // Un duelo no lo gana ni lo pierde una sola persona, así que no lleva la marca grande
    // de acierto: cada jugada trae la suya y debajo se cuenta el desenlace.
    if (result.duel) {
      const marcador = jugada => `<div class="pulse-duel-row ${jugada.ok ? "pulse-duel-hit" : "pulse-duel-miss"}"><span class="pulse-duel-mark" aria-hidden="true">${jugada.ok ? "✓" : "×"}</span><span><b>${escapeHtml(jugada.name)}</b><small>${jugada.ok ? "Acierta" : "Falla"}: la puso ${jugada.donde}</small></span></div>`;
      overlay(`<div class="overlay" data-result-card="${correct || result.targetOk ? card.id : ''}"><div class="modal pulse-duel-modal">
        <div class="eyebrow" aria-hidden="true">⚡ Duelo · ${escapeHtml(result.byName)} contra ${escapeHtml(result.targetName)}</div>
        <h2>${escapeHtml(card.title)}</h2>
        <div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div>${CT.Art.button(selectedModeKey, card)}<div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div>
        <div class="pulse-duel-rows">
          ${marcador({ name: result.byName, ok: result.correct, donde: result.posiciones.by })}
          ${marcador({ name: result.targetName, ok: result.targetOk, donde: result.posiciones.target })}
        </div>
        ${duelOutcome(result)}
        <button class="btn btn-primary btn-block" data-dialog-focus data-action="finish-turn">Terminar turno <span>→</span></button>
      </div></div>`);
      return;
    }
    const desenlace = `<p>${correct ? "La carta se queda en la línea temporal." : returned ? "No quedan cartas que robar, así que esta vuelve a tu mano." : "La carta va al descarte y has robado una nueva."}</p>`;
    overlay(`<div class="overlay" data-result-card="${correct ? card.id : ''}"${correct ? '' : ` data-correction-card="${card.id}" data-attempted-slot="${result.attemptedIndex}" data-correct-slot="${result.correctIndex}"`}><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark" aria-hidden="true">${correct ? "✓" : "×"}</div><div class="eyebrow" aria-hidden="true">${correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2><span class="solo-lectores">${correct ? "Bien colocado:" : "No encaja ahí:"} </span>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div>${CT.Art.button(selectedModeKey, card)}<div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div>${hint}${desenlace}<button class="btn btn-primary btn-block" data-dialog-focus data-action="finish-turn">Terminar turno <span>→</span></button></div></div>`);
  }

  // Las cuatro salidas del duelo, contadas desde la mesa y no desde nadie en concreto.
  function duelOutcome(result) {
    if (result.correct && result.targetOk) {
      return `<p class="pulse-outcome">Empate: los dos la habéis colocado bien, así que no cambia ninguna mano. La carta se queda en la línea.</p>`;
    }
    if (result.correct) {
      return `<p class="pulse-outcome">Solo acierta <b>${escapeHtml(result.byName)}</b>: <b>${escapeHtml(result.targetName)}</b> se lleva su <b>${escapeHtml(result.gift.title)}</b>. La carta se queda en la línea.</p>`;
    }
    if (result.targetOk) {
      return `<p class="pulse-outcome"><b>${escapeHtml(result.targetName)}</b> se defiende y coloca la carta en la línea. <b>${escapeHtml(result.byName)}</b> ${result.penaltySkipped ? "no roba: el mazo y el descarte están agotados" : "roba una por fallar el reto"}.</p>`;
    }
    return `<p class="pulse-outcome">No la acierta ninguno de los dos: la carta va al descarte y <b>${escapeHtml(result.byName)}</b> roba una por haber lanzado el reto.</p>`;
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

  // Devuelve true si se abandona la ronda normal para ganar o pasar a la final.
  function resolveRound() {
    const players = Object.fromEntries(game.players.map(player => [player.id, player]));
    const outcome = CT.Engine.roundOutcome(game.players.map(player => player.id), players, game.deck.length + game.discard.length);
    const empty = outcome.empty.map(id => players[id]);
    if (empty.length > 1) {
      game.final = CT.Final.create(selectedModeKey, empty.map(player => player.id), null, game.timeline);
      game.finalAnswers = {};
      result = null;
      saveGame(); renderFinalPass();
      return true;
    }
    if (outcome.ended) return endGame(empty);
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

  function renderFinalPass(revealInput = false) {
    screen = "final-local";
    const final = game.final;
    const name = uid => game.players.find(player => player.id === uid).name;
    const next = final.players.find(uid => !(uid in game.finalAnswers));
    if (next == null) {
      const ranking = CT.Final.rank(final, game.finalAnswers);
      paint(`<div class="shell">${header()}<h1 data-focus tabindex="-1">Resultado de la final</h1>${CT.Final.question(selectedModeKey, final)}${CT.Final.results(selectedModeKey, final, game.finalAnswers, name)}<button class="btn btn-primary btn-block" data-action="final-next">${ranking.winners.length === 1 ? 'Ver ganador' : 'Otra carta de desempate'}</button></div>`);
      return;
    }
    paint(`<div class="shell">${header()}<h1 data-focus tabindex="-1">Final de desempate</h1><p>Solo juegan ${final.players.map(uid => escapeHtml(name(uid))).join(', ')}.</p>${revealInput ? `${CT.Final.question(selectedModeKey, final)}<h3>Responde ${escapeHtml(name(next))}</h3>${CT.Final.form(selectedModeKey, 'data-final-local')}` : `<section class="panel pass-card"><h2>Pásale el móvil a ${escapeHtml(name(next))}</h2><p>Los demás no deben mirar. Las cifras se mostrarán cuando todos hayan respondido.</p><button class="btn btn-primary btn-block" data-action="final-ready">Soy ${escapeHtml(name(next))}</button></section>`}</div>`);
  }

  app.addEventListener('submit', event => {
    if (!event.target.matches('[data-final-local]')) return;
    event.preventDefault();
    const final = game.final;
    const next = final.players.find(uid => !(uid in game.finalAnswers));
    if (next == null) return;
    try {
      const data = new FormData(event.target);
      game.finalAnswers[next] = CT.Final.parse(selectedModeKey, data.get('guess'), data.get('era') === 'bc');
      saveGame(); renderFinalPass();
    } catch (error) { showToast(error.message); }
  });

  function nextLocalFinal() {
    const ranking = CT.Final.rank(game.final, game.finalAnswers);
    if (ranking.winners.length === 1) return endGame(game.players.filter(player => ranking.winners.includes(player.id)));
    game.final = CT.Final.create(selectedModeKey, ranking.winners, game.final, game.timeline);
    game.finalAnswers = {};
    saveGame(); renderFinalPass();
  }

  function renderWinner(winners) {
    screen = "winner";
    const list = [].concat(winners);
    const names = list.map(player => escapeHtml(player.name));
    const title = names.length === 1 ? `${names[0]} gana` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]} ganan`;
    const lead = game.final ? "Ha ganado la final con la cifra más cercana." : names.length === 1
      ? "Ha sido la única persona en terminar la ronda sin cartas."
      : "Se acabaron las cartas del mazo y terminan la ronda empatadas sin cartas.";
    const fallosUnicos = new Set(game.failed || []).size;
    const earned=game.earnedAchievements||[];
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel final-composition"><div class="eyebrow">Fin de la partida</div><h1 class="final-title" data-focus tabindex="-1">${title}</h1><p class="final-lead">${lead}</p>${finalMetrics(game.timeline.length,'láminas jugadas',`Ronda ${game.round||1}`,'mejor tramo',game.newDiscoveries||0,earned.length)}${logrosMarkup(earned)}<div class="actions final-actions"><button class="btn btn-ghost" data-action="review-timeline">Ver las ${game.timeline.length} ${game.timeline.length === 1 ? "carta" : "cartas"} jugadas</button>${fallosUnicos ? `<button class="btn btn-ghost" data-action="review-game">Ver lo que se falló (${fallosUnicos})</button>` : ""}<button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button></div></div></section></div>`);
    if (game.tournament) {
      app.querySelector('.pass-screen').insertAdjacentHTML('afterbegin',CT.Tournament.board(game.tournament,game.players,game.winners));
      const button=app.querySelector('[data-action="setup"]');
      if (game.tournament.index+1<game.tournament.queue.length) { button.dataset.action='competition-next';button.textContent='Siguiente ronda · nuevo mazo'; }
      else { button.dataset.action='home';button.textContent='Elegir otra competición'; }
    }
  }

  // La pantalla de fin solo enseñaba lo fallado: quien gana su partida también quiere
  // repasar la línea entera tal y como quedó, no solo lo que se le atragantó por el camino.
  function timelineReviewScreen(ids, mode, actionsHtml) {
    reviewReturnView = () => timelineReviewScreen(ids, mode, actionsHtml);
    screen = "timeline-review";
    paint(`<div class="shell">${header()}<section>
      <div class="eyebrow">Línea de tiempo completa</div>
      <h1 data-focus tabindex="-1">${ids.length} ${ids.length === 1 ? "carta jugada" : "cartas jugadas"}</h1>
      <div class="review-grid">${ids.map(id => {
        const card = GLOBAL_CARDS_BY_ID.get(id);
        if (!card) return "";
        const era = CT.eraForCard(mode, card);
        return `<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${CT.formatValue(mode, card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p><button type="button" class="enc-link" data-action="enc-view" data-mode="${mode}" data-id="${id}">Ver en la enciclopedia <span aria-hidden="true">→</span></button></div></article>`;
      }).join("")}</div>
      <div class="actions" style="justify-content:center">${actionsHtml}</div>
    </section></div>`);
  }

  // Repasa lo que se falló al terminar: cada fallo se descarta en el momento y nunca se
  // vuelve a ver dónde iba en realidad, así que el juego se queda sin su mejor ocasión
  // para enseñar algo. `items` son pares { id, mode }, no solo identificadores: la
  // competición mezcla fallos de varios temas y cada uno se formatea con las reglas de
  // su propio eje (fecha, superficie o población).
  function reviewScreen(items, actionsHtml) {
    reviewReturnView = () => reviewScreen(items, actionsHtml);
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
  // galería: así la enciclopedia no inventa un segundo orden de los quince juegos.
  // Un mazo que no es suyo no se ofrece: elegirlo acabaría en «Todas las cartas» sin
  // decir por qué. Y un bloque que se queda sin mazos ofrecibles no pinta su grupo vacío.
  function encModeOptions(modeKey) {
    return `<option value="all"${modeKey === "all" ? " selected" : ""}>Todas las cartas</option>` + Object.values(CT.BLOCKS).map(item => {
      const games = item.games.filter(key => CT.Cartera.tiene(key));
      if (!games.length) return "";
      return `<optgroup label="${escapeHtml(item.name)}">${games.map(key => {
        const mode = CT.mode(key);
        return `<option value="${key}"${key === modeKey ? " selected" : ""}>${escapeHtml(mode.name)} (${mode.cards.length})</option>`;
      }).join("")}</optgroup>`;
    }).join("");
  }

  function encCountText(modeKey, count) {
    if (modeKey === "all") {
      // El total del catálogo se cuenta sin filtros: es el denominador, y con el filtro de
      // láminas puesto diría «12 de 12 cartas» en vez de decir cuántas hay en total.
      const groups = CT.Enciclopedia.catalogGroups();
      const decks = groups.flatMap(group => group.decks);
      // Y las láminas de todo el juego, que es el recuento que da sentido al filtro aquí.
      const laminas = decks.reduce((suma, deck) => {
        const progreso = CT.Enciclopedia.seenProgress(deck.key);
        return { seen: suma.seen + progreso.seen, total: suma.total + progreso.total };
      }, { seen: 0, total: 0 });
      const descubiertas = laminas.total ? ` · ${laminas.seen} de ${laminas.total} láminas descubiertas` : "";
      return `${count} de ${decks.reduce((sum, deck) => sum + deck.cards.length, 0)} cartas · ${decks.length} mazos · ${groups.length} temáticas${descubiertas}`;
    }
    const mode = CT.mode(modeKey);
    // Las láminas descubiertas van aquí y no en cada carta: es un recuento del mazo, y
    // además explica de una vez por qué algunas ilustraciones se ven veladas.
    const laminas = CT.Enciclopedia.seenProgress(modeKey);
    const descubiertas = laminas.total ? ` · ${laminas.seen} de ${laminas.total} láminas descubiertas` : "";
    return `${count} de ${mode.cards.length} ${escapeHtml(mode.cardLabel)} · ${escapeHtml(CT.axis(modeKey).timelineTitle)}${descubiertas}`;
  }

  // Solo se entra aquí desde la portada o desde un repaso: nunca desde dentro de una
  // partida, donde ver el mazo entero volvería trivial cualquier jugada pendiente.
  function enciclopediaView() {
    if (screen !== 'enciclopedia') {
      encBackground = app.innerHTML;
      encBackgroundScreen = screen;
    }
    screen = "enciclopedia";
    const all = encMode === "all";
    const mode = all ? {name: "Álbum de láminas"} : CT.mode(encMode);
    const bands = all ? [] : CT.Enciclopedia.bands(encMode);
    const cards = all
      ? CT.Enciclopedia.catalogGroups(encQuery, { lock: encLock }).flatMap(group => group.decks.flatMap(deck => deck.cards))
      : CT.Enciclopedia.filterCards(encMode, { query: encQuery, band: encBand, lock: encLock });
    // El filtro de láminas está en el catálogo completo y en cualquier mazo que tenga
    // ilustraciones. Donde no aparece es en un mazo sin ninguna: no habría nada que
    // bloquear y las dos opciones saldrían vacías.
    const conLaminas = all || CT.Enciclopedia.seenProgress(encMode).total > 0;
    const chipLock = (key, etiqueta) => `<button type="button" class="enc-lock-chip${encLock === key ? " active" : ""}" data-action="enc-lock" data-lock="${key}" aria-pressed="${encLock === key}">${etiqueta}</button>`;
    paint(`<div class="enc-background" data-background-screen="${encBackgroundScreen}" inert aria-hidden="true">${encBackground}</div><div class="overlay" data-overlay="encyclopedia"><div class="modal settings-modal enc-modal">
      <button class="btn btn-secondary" data-action="enc-back" data-dialog-focus>Cerrar enciclopedia</button>
      <section class="setup-section enc-section">
        <header class="atlas-page-heading"><div class="eyebrow">El atlas de Continuum</div><h1 data-focus tabindex="-1">Enciclopedia</h1><p>Explora las cartas. Completa tu colección, una partida a la vez.</p></header><div class="enc-selection-heading"><h2>${escapeHtml(mode.name)}</h2><p id="enc-count" role="status">${encCountText(encMode, cards.length)}</p></div>
        <div class="panel enc-toolbar enc-toolbar-compact">
          <div class="field enc-topic-select">
            <label for="enc-mode-select">Explorar temática</label>
            <select id="enc-mode-select">${encModeOptions(encMode)}</select>
          </div>
          ${conLaminas ? `<div class="field enc-lock-field">
            <span class="enc-lock-label" id="enc-lock-label">Estado de las láminas</span>
            <div class="enc-bands enc-locks" role="group" aria-labelledby="enc-lock-label">
              ${chipLock("all", "Todas")}${chipLock("seen", "Descubiertas")}${chipLock("locked", "Por descubrir")}
            </div>
          </div>` : ''}
          <details class="enc-advanced-filters">
            <summary>Buscar o acotar por periodo</summary>
            <div class="enc-advanced-body">
              <div class="field">
                <label for="enc-search-input">Buscar</label>
                <input id="enc-search-input" type="search" autocomplete="off" placeholder="Título, explicación o fuente…" value="${escapeHtml(encQuery)}">
              </div>
              ${all ? '' : `<div class="enc-bands" role="group" aria-label="Filtrar por época o magnitud">
                <button type="button" id="enc-band-all" class="band-chip${encBand === "all" ? " active" : ""}" data-action="enc-band" data-band="all" aria-pressed="${encBand === "all"}">Todas</button>
                ${bands.map(band => `<button type="button" id="enc-band-${band.key}" class="band-chip${encBand === band.key ? " active" : ""}" data-action="enc-band" data-band="${band.key}" aria-pressed="${encBand === band.key}"><span aria-hidden="true">${band.symbol}</span> ${escapeHtml(band.name)}</button>`).join("")}
              </div>`}
            </div>
          </details>
        </div>
        ${all && !encQuery && encLock === "all" ? CT.Enciclopedia.recentMarkup() : ""}
        ${all && encLock === "all" ? '<p class="hint" data-enc-browse-hint>Explora una temática y despliega un mazo, o busca entre todas las cartas.</p>' : ''}
        <div id="enc-results">${all ? CT.Enciclopedia.catalogMarkup(encQuery, { lock: encLock }) : CT.Enciclopedia.resultsMarkup(encMode, cards, { highlight: encHighlight })}</div>
        <button type="button" class="btn btn-secondary btn-block" data-action="enc-back">Cerrar enciclopedia</button>
      </section>
    </div></div>`);
    app.querySelectorAll('.home-nav [aria-current]').forEach(button => button.removeAttribute('aria-current'));
    CT.openDialog(app.querySelector('[data-overlay="encyclopedia"]'), true, closeEnciclopedia);
  }

  function closeEnciclopedia() {
    if (encReturn === "review" && reviewReturnView) reviewReturnView();
    else if (encReturn === "play-menu") playMenu();
    else if (encReturn === "perfil") perfilView();
    else home();
    app.querySelector('[data-action="home-encyclopedia"]')?.focus({preventScroll:true});
  }

  function openEnciclopediaCard(modeKey, id) {
    if (!CT.has(modeKey)) return;
    const card = CT.cards(modeKey).find(item => item.id === Number(id));
    if (!card) return;
    const descubiertas = CT.Progreso?.seenCards?.() || new Set();
    overlay(`<div class="overlay enc-card-overlay" data-overlay="encyclopedia-card"><div class="modal enc-card-modal" role="dialog" aria-modal="true" aria-labelledby="enc-card-title">
      <button type="button" class="enc-card-close" data-action="enc-card-close" data-dialog-focus aria-label="Cerrar carta">×</button>
      <div class="eyebrow">${escapeHtml(CT.mode(modeKey).name)}</div>
      <h2 id="enc-card-title">${escapeHtml(card.title)}</h2>
      <div class="enc-card-large">${CT.Enciclopedia.cardMarkup(modeKey, card, { descubiertas, interactive: false })}</div>
      <button type="button" class="btn btn-secondary btn-block" data-action="enc-card-close">Volver a la enciclopedia</button>
    </div></div>`, true);
  }

  function openEnciclopediaImage(modeKey, id) {
    if (!CT.has(modeKey)) return;
    const card = CT.cards(modeKey).find(item => item.id === Number(id));
    if (!card || !CT.cardArt(modeKey, card) || !(CT.Progreso?.seenCards?.() || new Set()).has(card.id)) return;
    overlay(`<div class="overlay enc-image-overlay" data-overlay="encyclopedia-image"><div class="modal enc-image-modal" role="dialog" aria-modal="true" aria-labelledby="enc-image-title">
      <button type="button" class="enc-card-close" data-action="enc-card-close" data-dialog-focus aria-label="Cerrar ilustración">×</button>
      <div class="eyebrow">${escapeHtml(CT.mode(modeKey).name)}</div>
      <h2 id="enc-image-title">${escapeHtml(card.title)}</h2>
      <div class="enc-image-full">${CT.animalArt(modeKey, card)}</div>
      <button type="button" class="btn btn-secondary btn-block" data-action="enc-card-close">Volver a la carta</button>
    </div></div>`, true);
  }

  function openEnciclopedia(modeKey, { highlight = null, band = "all", returnTo = "home" } = {}) {
    // Abrir la enciclopedia de un mazo cerrado la abre entera, no ese mazo.
    encMode = modeKey === "all" || (CT.has(modeKey) && CT.Cartera.tiene(modeKey)) ? modeKey : "all";
    encQuery = "";
    encBand = band;
    // Cada mazo entra por «todas»: llegar a uno nuevo con el filtro de otro puesto —y con
    // media colección escondida sin saber por qué— es la manera más rápida de perderse.
    // Vale también al llegar desde un punto débil del perfil, donde lo que se busca es
    // una carta concreta y no puede quedarse fuera por estar bloqueada.
    encLock = "all";
    encHighlight = highlight;
    encReturn = returnTo;
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
        ${statBox(resumen.bestRun, "racha máxima de aciertos")}
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
    const filasBandas = bandas.map(banda => `<button type="button" class="weak-row" data-action="enc-band-view" data-mode="${escapeHtml(banda.mode)}" data-band="${escapeHtml(banda.band)}">
      <span class="weak-mark" aria-hidden="true">${escapeHtml(banda.symbol)}</span>
      <span><b>${escapeHtml(banda.name)}</b><small>${escapeHtml(banda.modeName)} · ${banda.accuracy}% en ${banda.played} ${banda.played === 1 ? "carta" : "cartas"}</small></span>
      <i aria-hidden="true">→</i>
    </button>`).join("");
    const filasCartas = cartas.map(carta => `<button type="button" class="weak-row" data-action="enc-view" data-mode="${escapeHtml(carta.mode)}" data-id="${carta.id}">
      <span class="weak-mark" aria-hidden="true">×${carta.count}</span>
      <span><b>${escapeHtml(carta.title)}</b><small>${escapeHtml(carta.modeName)}</small></span>
      <i aria-hidden="true">→</i>
    </button>`).join("");
    return `<div class="section-label">Para practicar</div>
      <div class="panel weak-panel">
        ${bandas.length ? `<h3>Tramos para practicar</h3><div class="weak-list" role="group" aria-label="Tramos con menos aciertos">${filasBandas}</div>` : ""}
        ${cartas.length ? `<h3>Cartas para repasar</h3><div class="weak-list" role="group" aria-label="Cartas falladas más veces">${filasCartas}</div>` : ""}
      </div>`;
  }

  // El Atlas junta lo que antes eran el perfil y la enciclopedia: arriba la colección,
  // con la puerta a todas las cartas, y debajo el recorrido de quien juega.
  function atlasColeccion() {
    return `<section class="panel atlas-collection"><div><h2>Tu colección</h2>${perfilColeccion()}</div>
      <button class="btn btn-primary" data-action="home-encyclopedia">Explorar todas las cartas <span aria-hidden="true">→</span></button></section>`;
  }

  // Quién eres en el juego: tu nombre y el avatar que sale de él.
  function atlasIdentidad() {
    const nombre = CT.Identidad.nombre();
    return `<section class="panel atlas-identidad">
      <span class="atlas-identidad-avatar">${CT.Avatares.markup(nombre, { size: 72, etiqueta: "Tu avatar" })}</span>
      <div><h2>${escapeHtml(nombre || "Sin nombre")}</h2>
        <div class="atlas-identidad-acciones"><button class="btn btn-secondary" data-action="identidad-nombre">Cambiar nombre</button></div>
        <p class="hint">Tu avatar sale de tu nombre: cambia si lo cambias.</p></div>
    </section>`;
  }

  function editaNombre(error = "", valor = CT.Identidad.nombre()) {
    CT.closeDialog?.();
    overlay(`<div class="overlay"><div class="modal identidad-modal"><h2>Tu nombre</h2>
      <div class="identidad-avatar-vivo" data-avatar-vivo>${CT.Avatares.markup(valor, { size: 88 })}</div>
      <form data-identidad="nombre" novalidate>
        <label for="identidad-nombre">Nombre de tu perfil</label>
        <input id="identidad-nombre" type="text" autocomplete="nickname" maxlength="${CT.Identidad.MAX}" value="${escapeHtml(valor)}" aria-describedby="identidad-error" data-avatar-de>
        <p id="identidad-error" class="bienvenida-error" role="alert">${escapeHtml(error)}</p>
        <div class="actions" style="display:grid"><button class="btn btn-primary" type="submit">Guardar</button><button class="btn btn-secondary" type="button" data-action="close-menu">Cancelar</button></div>
      </form></div></div>`, true);
  }

  async function nombreEditado(boton) {
    const nombre = CT.Identidad.limpia(document.getElementById("identidad-nombre")?.value);
    if (boton) boton.disabled = true;
    try {
      await guardaNombre(nombre);
      CT.Identidad.guarda({ nombre });
      CT.closeDialog();
      perfilView();
      showToast("Nombre guardado");
    } catch (error) {
      editaNombre(error.message || "No se ha podido guardar el nombre.", nombre);
    }
  }

  function atlasRetoDiario() {
    const records = dailyRecords(), racha = dailyStreak(records);
    return `<section class="panel atlas-daily"><h2>Reto diario</h2>
      <div class="solo-stats daily-stats">
        <span>${glyph(GLYPHS.racha)}<b>${racha}</b><small>${racha === 1 ? "día seguido" : "días seguidos"}</small></span>
        <span>${glyph(GLYPHS.marca)}<b>${records.best || 0}</b><small>mejor resultado</small></span>
      </div>
      ${calendarHtml(records)}</section>`;
  }

  function perfilColeccion() {
    const keys = Object.keys(CT.MODES || {}).filter(key => key !== "mixed" && (!CT.Cartera || CT.Cartera.tiene(key)));
    const total = keys.reduce((sum, key) => sum + (CT.Enciclopedia?.seenProgress(key)?.total || 0), 0);
    const seen = keys.reduce((sum, key) => sum + (CT.Enciclopedia?.seenProgress(key)?.seen || 0), 0);
    const decks = keys.length;
    return `<div class="perfil-collection"><div><b>${seen}/${total}</b><span>láminas descubiertas</span></div><small>${decks} ${decks === 1 ? "mazo disponible" : "mazos disponibles"} · juega una carta para completar tu álbum</small></div>`;
  }

  function perfilLogros(logros) {
    const grupos = LOGRO_GRUPOS.filter(grupo => logros.some(logro => logro.group === grupo));
    const siguiente = logros.find(logro => !logro.unlocked);
    return `<div class="section-label">Logros <small>${logros.filter(l => l.unlocked).length} de ${logros.length}</small></div>
      ${siguiente ? `<p class="profile-next-goal"><b>Siguiente objetivo:</b> ${escapeHtml(siguiente.name)} · ${escapeHtml(siguiente.desc)}</p>` : '<p class="profile-next-goal">Has conseguido todos los logros disponibles.</p>'}
      ${grupos.map(grupo => `<details class="perfil-achievement-group"><summary><span><b>${escapeHtml(grupo)}</b><small>${logros.filter(l => l.group === grupo && l.unlocked).length} de ${logros.filter(l => l.group === grupo).length} conseguidos</small></span><i aria-hidden="true">+</i></summary>
        <div class="logro-grid" role="group" aria-label="Logros de ${escapeHtml(grupo)}">
          ${logros.filter(logro => logro.group === grupo).map(logroCard).join("")}
        </div></details>`).join("")}`;
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
        <div class="actions" style="margin-top:12px;justify-content:center">
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
    if (screen !== "perfil" && screen !== "enciclopedia") profileReturn = screen;
    screen = "perfil";
    const resumen = CT.Progreso.summary();
    const filas = CT.Progreso.modeRows();
    const estrenado = resumen.cards > 0 || resumen.games > 0;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="setup-section perfil-section">
        <header class="atlas-page-heading"><div class="eyebrow">Tu colección y tu recorrido</div><h1 data-focus tabindex="-1">Atlas</h1><p>Las cartas que has descubierto y la huella que deja cada partida.</p></header>
        ${atlasIdentidad()}
        ${atlasColeccion()}
        ${atlasRetoDiario()}
        <section class="panel atlas-duels"><div><h2>Tus duelos</h2><p>Retos por turnos con tus amigos: en qué punto está cada uno.</p></div><button class="btn btn-secondary" data-action="duels-list">Ver tus duelos <span aria-hidden="true">→</span></button></section>
        <div class="perfil-account" aria-label="Cuenta y datos">${CT.Accounts?.card() || perfilCopia()}</div>
        ${estrenado
          ? `<p class="lead">${resumen.hits} ${resumen.hits === 1 ? "acierto" : "aciertos"} de ${resumen.cards} ${resumen.cards === 1 ? "carta" : "cartas"} colocadas.</p>`
          : `<p class="lead">Todavía no hay nada que contar. Tu primera partida será el comienzo de tu recorrido.</p>`}
        ${perfilResumen(resumen)}
        <div class="perfil-main">
        ${perfilPorJuego(filas)}
        ${perfilPuntosDebiles(CT.Progreso.weakBands(), CT.Progreso.weakCards())}
        ${perfilLogros(CT.Progreso.achievements())}</div>
      </section>
      ${homeNav()}
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
  // Lo mismo para el duelo: la invitación al crearlo, o el marcador al terminarlo.
  let lastDuelShare = null;
  // El duelo que ha llegado por enlace y todavía no se ha aceptado.
  let pendingDuel = null;

  function enDuelo() { return solo?.kind === "duel"; }

  // Cuándo se acaba una partida en solitario. El duelo es el único formato sin vidas: las
  // dos partes juegan las mismas cartas de principio a fin, porque si a una se le acabaran
  // a la séptima el marcador estaría comparando siete cartas contra quince.
  function soloAcabada() {
    if (!solo) return true;
    if (solo.total && solo.played >= solo.total) return true;
    if (!solo.deck.length) return true;
    return !enDuelo() && solo.lives === 0;
  }

  // El reto diario tiene su propio hueco de guardado: comparte mazo con la partida libre
  // y el duelo de ese día, y empezarlo no puede pisar una partida libre a medias.
  let soloSlot = "mode";
  function soloKey() { return soloSlot === "daily" ? DAILY_SAVE_KEY : `hilo-solo-${selectedModeKey}-v1`; }

  function today() { return new Date().toLocaleDateString("sv-SE"); }

  function yesterday() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString("sv-SE");
  }

  // El día anterior a una fecha dada (formato sv-SE, AAAA-MM-DD), para calcular la racha
  // del reto diario contra el día en que se empezó a jugar y no contra el de hoy: un reto
  // empezado antes de medianoche y acabado después sigue contando como el día en que
  // empezó.
  function previousDay(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString("sv-SE");
  }

  function readRecords() {
    try { return JSON.parse(CT.Storage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
  }

  // ── El reto diario ────────────────────────────────────────────────────────────────
  //
  // Uno para todo el mundo: cada día sale un mazo, el mismo en todos los móviles, y de
  // él las mismas cartas. El mazo se sortea con la fecha como semilla entre los mazos
  // gratuitos (`CT.Cartera.diarios`), nunca entre los que ha comprado cada cuenta, que
  // harían que dos personas no jugaran el mismo reto. La racha es una sola, la del reto,
  // y no una por mazo.
  // Sus marcas viven dentro de `hilo-retos-v1`, junto a las de cada mazo, porque esa es
  // la clave que la cuenta sincroniza con la nube: así la racha sigue al jugador de un
  // móvil a otro. `retoDiario` no es el nombre de ningún mazo.
  const DAILY_RECORDS_FIELD = "retoDiario";
  const DAILY_SAVE_KEY = "continuum-reto-diario-partida-v2";

  function dailyPick(day) {
    const pool = CT.Cartera.diarios().filter(CT.has);
    return pool[Math.floor(seededRandom(seedFrom(`reto-diario:${day}`))() * pool.length)];
  }
  // Un sorteo al azar repetiría mazo dos días seguidos de vez en cuando; se evita
  // saltando al siguiente del bote. Solo mira el día anterior sin corregir, así que no
  // hay cadena de cálculos hacia atrás.
  function dailyModeKey(day = today()) {
    const pool = CT.Cartera.diarios().filter(CT.has);
    const pick = dailyPick(day);
    if (pool.length < 2 || pick !== dailyPick(previousDay(day))) return pick;
    return pool[(pool.indexOf(pick) + 1) % pool.length];
  }

  function dailyRecords() {
    const stored = readRecords()[DAILY_RECORDS_FIELD];
    if (stored) return stored;
    olvidaRetosPorMazo();
    return { best: 0, streak: 0, lastDay: "", days: {} };
  }

  function saveDailyRecords(entry) {
    const records = readRecords();
    records[DAILY_RECORDS_FIELD] = entry;
    try { CT.Storage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* almacenamiento lleno */ }
  }

  // Las rachas del antiguo reto diario por mazo se borran la primera vez que se consulta
  // el nuevo: el reto es ahora uno para todos y su racha empieza de cero. Las mejores
  // marcas de la partida libre se quedan donde estaban. Se hace al consultar y no al
  // cargar para que ya esté puesto el almacenamiento de la cuenta que juega.
  function olvidaRetosPorMazo() {
    try {
      const records = readRecords();
      for (const entry of Object.values(records)) { if (entry && typeof entry === "object") { delete entry.days; delete entry.streak; delete entry.lastDay; } }
      records[DAILY_RECORDS_FIELD] = { best: 0, streak: 0, lastDay: "", days: {} };
      CT.Storage.setItem(RECORDS_KEY, JSON.stringify(records));
      CT.Storage.removeItem("continuum-quick-daily-v1");
    } catch { /* sin almacenamiento no hay nada que borrar */ }
  }

  // La racha de hoy solo sigue viva si ayer también se jugó (o si hoy ya está jugado).
  function dailyStreak(records = dailyRecords()) {
    return records.lastDay === today() || records.lastDay === yesterday() ? records.streak || 0 : 0;
  }

  function loadDaily() {
    try {
      const stored = JSON.parse(CT.Storage.getItem(DAILY_SAVE_KEY));
      if (!stored || stored.kind !== "daily" || stored.day !== today() || stored.finished || !CT.has(stored.mode)) return null;
      return CT.Saves.read(DAILY_SAVE_KEY, stored.mode);
    } catch { return null; }
  }

  function startDaily() {
    const pendiente = loadDaily();
    if (pendiente) { setMode(pendiente.mode); resumeSolo("daily"); return; }
    if (dailyRecords().days?.[today()]) { home(); return; }
    dailyIntro();
  }

  // La presentación del reto: el mazo del día es sorpresa hasta aquí. Los nombres de los
  // mazos pasan cada vez más despacio hasta pararse en el de hoy (unos tres segundos), y
  // entonces aparece su colección y el botón para jugar. Con movimiento reducido se
  // desvela sin ruleta.
  let dailyReelTimer = null;
  function dailyIntro() {
    clearTimeout(dailyReelTimer);
    screen = "daily-intro";
    const dia = today(), modeKey = dailyModeKey(dia), mode = CT.mode(modeKey);
    const fecha = new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="home">Volver</button>')}<section class="pass-screen"><div class="panel pass-card comp-splash daily-splash">
      <div class="chapter-art daily-splash-art" aria-hidden="true">${dailyMysteryArt()}</div>
      <div class="chapter-number">Reto diario · ${escapeHtml(fecha)}</div>
      <h2 data-focus tabindex="-1"><span class="comp-splash-lead">Hoy toca</span><span class="daily-reel-stage" aria-hidden="true"><span class="daily-reel-kicker">Seleccionando mazo</span><span class="daily-reel-window"><span class="daily-reel">·&nbsp;·&nbsp;·</span></span></span><span class="solo-lectores" id="daily-reveal" aria-live="polite"></span></h2>
      <p class="daily-splash-rule" hidden>${DAILY_CARDS} cartas, las mismas para todo el mundo. Un intento.</p>
      <button class="btn btn-block comp-splash-start" data-action="daily-play" hidden>Jugar <span aria-hidden="true">→</span></button>
    </div></section></div>`);
    const reel = app.querySelector(".daily-reel");
    const revela = () => {
      if (screen !== "daily-intro" || !reel.isConnected) return;
      reel.classList.remove("is-ticking");
      reel.textContent = mode.name;
      reel.classList.add("is-revealed");
      const splash = app.querySelector(".daily-splash");
      splash?.classList.add("is-revealed");
      const kicker = app.querySelector(".daily-reel-kicker");
      if (kicker) kicker.textContent = "Mazo de hoy";
      const arte = app.querySelector(".daily-splash-art");
      arte.innerHTML = blockArt(CT.blockOf(modeKey).art, true);
      arte.classList.add("is-revealed");
      CT.Scene.apply(modeKey, "daily-reveal");
      app.querySelector(".daily-splash-rule").hidden = false;
      const jugar = app.querySelector('[data-action="daily-play"]');
      jugar.hidden = false;
      app.querySelector("#daily-reveal").textContent = `Hoy toca ${mode.name}.`;
      jugar.focus({ preventScroll: true });
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { revela(); return; }
    // Los otros nombres, barajados, para que la ruleta no pase siempre en el mismo orden.
    const otros = shuffle(CT.Cartera.diarios().filter(key => CT.has(key) && key !== modeKey).map(key => CT.mode(key).name));
    let paso = 0, transcurrido = 0;
    const gira = () => {
      if (screen !== "daily-intro" || !reel.isConnected) return;
      const espera = 60 + paso * paso * 2.2;
      transcurrido += espera;
      if (transcurrido > 2800 || !otros.length) { revela(); return; }
      reel.classList.remove("is-ticking");
      void reel.offsetWidth;
      reel.textContent = otros[paso % otros.length];
      reel.classList.add("is-ticking");
      paso += 1;
      dailyReelTimer = setTimeout(gira, espera);
    };
    gira();
  }

  function playDaily() {
    clearTimeout(dailyReelTimer);
    if (loadDaily() || dailyRecords().days?.[today()]) { startDaily(); return; }
    // `setMode` pinta la puerta cerrada si el mazo no es suyo; el bote del reto son los
    // gratuitos, así que no debería pasar, pero si pasa se queda en esa explicación.
    if (!setMode(dailyModeKey())) return;
    soloSlot = "daily";
    startSolo("daily");
  }

  function modeRecords() {
    const records = readRecords();
    return records[selectedModeKey] || { best: 0, streak: 0, lastDay: "", days: {} };
  }

  function saveRecords(entry) {
    const records = readRecords();
    records[selectedModeKey] = entry;
    try { CT.Storage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* almacenamiento lleno */ }
  }

  function saveSolo() {
    // La competición usa su propio guardado y conserva las partidas por mazo.
    if (solo && solo.kind === "comp") { saveCompetition(); return; }
    if (solo) CT.Storage.setItem(soloKey(), JSON.stringify(CT.Saves.prepare(solo, selectedModeKey)));
    else CT.Storage.removeItem(soloKey());
  }

  function loadSolo() {
    soloSlot = "mode";
    try {
      const stored = CT.Saves.read(soloKey(), selectedModeKey);
      if (!stored || !stored.timeline || stored.finished) return null;
      // Los guardados del antiguo reto diario por mazo ya no se continúan.
      if (stored.kind === "daily") return null;
      return stored;
    } catch { return null; }
  }

  const CALENDARIO_DIAS = 28;

  // Iconos de trazo para los paneles de «Jugar en solitario», con el mismo grosor que las
  // marcas que pone immersion.js en la cabecera de cada desplegable.
  const GLYPHS = {
    racha: '<path d="M12 3c1 3.5 5 5.6 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.7 2.4-4.8.3 1.6 1.1 2.6 2.1 2.8C11 8.6 11.3 5.6 12 3Z"/>',
    marca: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
    seguidos: '<path d="M7 3h10M7 21h10M8 3v2a4 4 0 0 0 1.6 3.2L12 10l2.4-1.8A4 4 0 0 0 16 5V3M8 21v-2a4 4 0 0 1 1.6-3.2L12 14l2.4 1.8A4 4 0 0 1 16 19v2"/>',
    turnos: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    orden: '<rect x="2.5" y="7" width="5.5" height="10" rx="1.2"/><rect x="9.25" y="7" width="5.5" height="10" rx="1.2"/><rect x="16" y="7" width="5.5" height="10" rx="1.2"/>',
    cifras: '<path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h15M3.5 15h15"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };
  function glyph(paths) {
    return `<svg class="solo-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  }

  // Las últimas cuatro semanas del reto diario, un cuadrito por día. La racha ya se ve
  // como número; esto enseña su forma: dónde hay huecos y qué tan bien fue cada intento.
  // Las columnas no empiezan en lunes: la última casilla es siempre hoy. Por eso la
  // cabecera de días se calcula desde la primera fecha y no es fija.
  function calendarHtml(records) {
    const days = records.days || {};
    const celdas = [];
    const iniciales = ["D", "L", "M", "X", "J", "V", "S"];
    let cabecera = "";
    let jugados = 0;
    for (let i = CALENDARIO_DIAS - 1; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      if (celdas.length < 7) cabecera += `<span>${iniciales[fecha.getDay()]}</span>`;
      const clave = fecha.toLocaleDateString("sv-SE");
      const entrada = days[clave];
      if (entrada) jugados += 1;
      const ratio = entrada ? entrada.hits / entrada.total : null;
      const nivel = ratio === null ? "vacio" : ratio >= 0.8 ? "alto" : ratio >= 0.5 ? "medio" : "bajo";
      const fechaLegible = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
      const etiqueta = entrada ? `${fechaLegible}: ${entrada.hits} de ${entrada.total}` : `${fechaLegible}: sin jugar`;
      celdas.push(`<span class="cal-day cal-${nivel}${i === 0 ? " cal-hoy" : ""}" style="--i:${celdas.length}" title="${escapeHtml(etiqueta)}" aria-label="${escapeHtml(etiqueta)}"></span>`);
    }
    return `<div class="cal-card">
      <div class="cal-head"><span class="cal-title">Últimas 4 semanas</span><span class="cal-count">${jugados} de ${CALENDARIO_DIAS} días</span></div>
      <div class="cal-weekdays" aria-hidden="true">${cabecera}</div>
      <div class="cal-grid" role="img" aria-label="Calendario de los últimos ${CALENDARIO_DIAS} días del reto diario">${celdas.join("")}</div>
      <div class="cal-legend" aria-hidden="true"><span>Menos</span><i class="cal-swatch cal-vacio"></i><i class="cal-swatch cal-bajo"></i><i class="cal-swatch cal-medio"></i><i class="cal-swatch cal-alto"></i><span>Más aciertos</span></div>
    </div>`;
  }

  let selectedDifficulty = CT.Storage.getItem("continuum-difficulty-v1") || "easy";
  // Las cartas que el tablero acaba de colocar y todavía no se han visto llegar.
  let recienColocadas = [];
  if (!CT.Ghost.LEVELS[selectedDifficulty]) selectedDifficulty = "easy";
  function soloHidden() { return solo.difficulty === "expert" || !!solo.ghostTurns?.includes(solo.played - (solo.pendingResult ? 1 : 0)); }
  function soloHome() {
    screen = "solo-home";
    solo = loadSolo();
    pendingIndex = null;
    const records = modeRecords();
    const mode = currentMode();
    const pendiente = solo && solo.kind === "free";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="setup-section solo-home"><div class="solo-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${mode.name}</div><h2 class="solo-title" data-focus tabindex="-1">Jugar en solitario</h2>
        <p class="lead">Ordena, descubre y supera tu marca.</p><p class="solo-intro-rule">${SOLO_LIVES} vidas · Cada fallo cuesta una.</p></div>
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

  // Retar a un amigo: el duelo por enlace, que antes vivía dentro del solitario, tiene
  // ahora su propia pantalla como tercera manera de jugar un mazo.
  function duelHome() {
    screen = "duel-home";
    solo = loadSolo();
    pendingIndex = null;
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="setup-section solo-home"><div class="solo-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${currentMode().name}</div><h2 class="solo-title" data-focus tabindex="-1">Retar a un amigo</h2>
        <p class="lead">Las mismas cartas para los dos. Gana quien más acierte.</p><p class="solo-intro-rule">En duelo se juegan las ${CT.Duelo.CARTAS} cartas sin límite de vidas.</p></div>
        ${duelPanel()}
        <button class="btn btn-ghost btn-block" data-action="duels-list">Ver tus duelos en curso</button>
      </section>
    </div>`);
  }

  // El duelo es un formato propio y no un botón al final de otra partida. La razón es la
  // semilla: el reto diario tiene una —la fecha— pero la partida libre baraja al azar y
  // dura lo que duren las vidas, así que no hay nada que mandar que reparta lo mismo en
  // el otro móvil. Con formato propio, en cambio, vale cualquier mazo y cuantas veces se
  // quiera, y cada duelo estrena semilla.
  // Las maneras de entrar a un mazo cerrado, una debajo de otra. El mazo suelto va
  // primero porque es el más barato y el que responde a lo que se acaba de tocar; la
  // colección, si la hay, va detrás como la alternativa que sale más a cuenta. Cada una
  // dice qué abre y cuánto cuesta, sin letra pequeña.
  function opcionesDeCompra(vias, modeKey) {
    return vias.map((via, indice) => {
      const pendientes = via.mazos.filter(key => !CT.Cartera.tiene(key));
      const cartas = pendientes.reduce((total, key) => total + CT.mode(key).cards.length, 0);
      const abre = via.tipo === "mazo"
        ? `Solo este mazo · ${cartas} cartas`
        : `${pendientes.length} mazos · ${cartas} cartas`;
      return `<button class="btn ${indice ? "btn-secondary" : "btn-primary"} btn-block compra-via" style="margin-top:${indice ? 8 : 14}px" data-action="mazo-desbloquear" data-paquete="${via.clave}" data-mode="${modeKey}">
        <b>${escapeHtml(via.tipo === "mazo" ? "Este mazo" : via.nombre)} · ${escapeHtml(via.precio)}</b>
        <small>${escapeHtml(abre)}</small>
      </button>`;
    }).join("");
  }

  // Un mazo al que todavía no se tiene derecho: la puerta cerrada, con lo que hay dentro,
  // las maneras de conseguirlo y su salida. Lo que nunca debe tener es un botón que no
  // haga nada, así que si no hay ninguna manera de comprarlo solo queda la salida.
  function mazoCerrado(modeKey) {
    const razon = CT.Cartera.motivo(modeKey);
    if (!razon) return;
    screen = "mazo-cerrado";
    const juego = CT.mode(modeKey);
    const vias = razon.opciones || [];
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="pass-screen"><div class="panel">
        <div class="big-icon">🔒</div>
        <div class="eyebrow">Todavía no es tuyo</div>
        <h1 data-focus tabindex="-1" style="font-size:clamp(1.8rem,7vw,2.6rem)">${escapeHtml(juego.name)}</h1>
        <p class="lead" style="margin-inline:auto">${vias.length > 1 ? "Dos maneras de conseguirlo." : escapeHtml(juego.blurb)}</p>
        ${vias.length
          ? `${opcionesDeCompra(vias, modeKey)}
             <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="home">Ir al inicio</button>`
          : `<p class="lead" style="margin-inline:auto">${escapeHtml(razon.texto)}</p>
             <button class="btn btn-primary btn-block" style="margin-top:14px" data-action="home">Ir al inicio</button>`}
        <p class="hint" style="margin-top:14px">Lo que ya hayas descubierto de este mazo sigue siendo tuyo y te espera dentro.</p>
      </div></section>
    </div>`);
  }

  // La ventana de pago, fingida. No imita la de ninguna tienda: cuenta lo que pasaría,
  // que es lo que hace falta para decidir si la puerta cerrada está bien contada. El
  // botón concede el paquete de verdad —pero solo en esta sesión, la cartera no lo
  // guarda—, así que se puede entrar al mazo, mirarlo y recargar para volver a verlo
  // cerrado.
  function tiendaSimulada(clave, modeKey) {
    const suyo = CT.Cartera.paquetes().find(uno => uno.clave === clave);
    if (!suyo) return;
    const cuantos = suyo.mazos.length === 1 ? "1 mazo" : `${suyo.mazos.length} mazos`;
    overlay(`<div class="overlay"><div class="modal">
      <div class="eyebrow">Simulación · no se cobra nada</div>
      <h2>${escapeHtml(suyo.nombre)}</h2>
      <p class="lead" style="margin-inline:auto">Aquí se abriría la ventana de pago del propio móvil, con la cuenta que ya tengas configurada. Continuum no llega a ver la tarjeta: solo recibe un sí o un no.</p>
      <p class="hint">${cuantos} · ${escapeHtml(suyo.precio || "precio por decidir")} · pago único</p>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-dialog-focus data-action="compra-simular" data-paquete="${suyo.clave}" data-mode="${modeKey || ""}">Simular que sale bien</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="close-menu">Cancelar</button>
      <p class="hint" style="margin-top:12px">Al recargar el juego vuelve a estar cerrado: no hay ninguna compra guardada detrás.</p>
    </div></div>`, true);
  }

  // El duelo es uno solo con dos maneras de jugarlo, no dos formatos distintos: lo que
  // comparten —las mismas cartas en los dos móviles, el enlace, el nombre, el reloj y lo
  // que pasa al salirse de la aplicación— pesa mucho más que en lo que se diferencian,
  // que es si la carta se coloca en la línea o se responde con una cifra. Por eso el menú
  // enseña una sola opción y la modalidad se elige dentro.
  const DUEL_KIND_KEY = "hilo-duelo-prueba-v1";
  const DUEL_PACE_KEY = "hilo-duelo-ritmo-v1";

  function duelKind() {
    const guardado = CT.Storage.getItem(DUEL_KIND_KEY) || CT.Storage.getItem("hilo-duelo-modo-v1");
    return guardado === "cifras" && reglaCifra() ? "cifras" : "orden";
  }
  function duelPace() { return CT.Storage.getItem(DUEL_PACE_KEY) === "turnos" ? "turnos" : "seguidos"; }
  // Compatibilidad con llamadas antiguas: el modo ya solo representa la prueba.
  function duelMode() { return duelKind(); }

  function duelPanel() {
    // Un duelo aceptado y dejado a medias no se puede volver a empezar desde el enlace si
    // ya lo has cerrado, así que se ofrece continuarlo: con él se iría la marca del rival.
    const enOrden = solo && solo.kind === "duel";
    const enCifras = cargaCifras();
    const contra = partida => partida?.duelo?.rival || partida?.rival ? (partida.duelo?.rival || partida.rival).nombre || "quien te retaba" : null;
    const regla = reglaCifra();
    const prueba = duelKind();
    const ritmo = duelPace();
    const bloque = (clave, cuerpo) => `<div data-duel-block="${clave}"${clave === `${ritmo}-${prueba}` ? "" : " hidden"}>${cuerpo}</div>`;
    return `<div class="panel solo-panel">
      <div class="solo-panel-head"><h3>Duelo por enlace</h3></div>
      <p>Juegas tú, mandas el enlace, y quien lo abra recibe exactamente las mismas cartas.</p>
      <div class="field duel-kind-field">
        <span class="field-label" id="duel-pace-label">Ritmo del duelo</span>
        <div class="segmented" role="radiogroup" aria-labelledby="duel-pace-label">
          ${[["seguidos", "Duelo de seguidos", "Juegas y esperas al rival"], ["turnos", "Duelo por turnos", "Cada uno desde su móvil"]]
            .map(([clave, titulo, pie]) => `<label class="segmented-option${clave === ritmo ? " is-on" : ""}">
              <input type="radio" name="duel-pace" value="${clave}"${clave === ritmo ? " checked" : ""}>
              <i class="duel-option-mark" aria-hidden="true">${glyph(GLYPHS[clave])}</i>
              <span><b>${titulo}</b><small>${pie}</small></span>
            </label>`).join("")}
        </div>
      </div>
      <div class="field duel-kind-field">
        <span class="field-label" id="duel-kind-label">Prueba</span>
        <div class="segmented" role="radiogroup" aria-labelledby="duel-kind-label">
          ${[["orden", "Ordenar las cartas", "Colocarlas en la línea"], ...(regla ? [["cifras", "Escribir la cifra", "Responder con el número"]] : [])]
            .map(([clave, titulo, pie]) => `<label class="segmented-option${clave === prueba ? " is-on" : ""}">
              <input type="radio" name="duel-kind" value="${clave}"${clave === prueba ? " checked" : ""}>
              <i class="duel-option-mark" aria-hidden="true">${glyph(GLYPHS[clave])}</i>
              <span><b>${titulo}</b><small>${pie}</small></span>
            </label>`).join("")}
        </div>
      </div>
      ${bloque("seguidos-orden", `<div class="duel-brief"><p>${CT.Duelo.CARTAS} cartas al azar de este mazo, y las colocas en la línea. Gana quien más acierte.</p>
        <p class="solo-intro-rule duel-rule">${glyph(GLYPHS.reloj)}<span>${CT.Duelo.SEGUNDOS} segundos por carta · El reloj no se para: si sales de la aplicación, la carta se da por fallada.</span></p></div>
        ${enOrden ? `<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="resume-solo">Continuar ${contra(solo) ? `el duelo contra ${escapeHtml(contra(solo))}` : "tu duelo"} <span>→</span></button>` : ""}
        <button class="btn ${enOrden ? "btn-secondary" : "btn-primary"} btn-block" style="margin-top:10px" data-action="start-duel">${enOrden ? "Empezar otro duelo" : "Crear un duelo"} <span>→</span></button>`)}
      ${regla ? bloque("seguidos-cifras", `<div class="duel-brief"><p>${Cifras.CARTAS} cartas de este mazo, y en cada una escribes el número. ${escapeHtml(regla.pregunta)} Gana quien más puntos sume: cuenta lo cerca que te quedes y lo rápido que respondas.</p>
        <p class="solo-intro-rule duel-rule">${glyph(GLYPHS.reloj)}<span>${Cifras.SEGUNDOS} segundos por carta · El reloj no se para: si sales de la aplicación, la carta se cierra.</span></p></div>
        ${enCifras ? `<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="resume-cifras">Continuar ${contra(enCifras) ? `el duelo contra ${escapeHtml(contra(enCifras))}` : "tu duelo de cifras"} <span>→</span></button>` : ""}
        <button class="btn ${enCifras ? "btn-secondary" : "btn-primary"} btn-block" style="margin-top:10px" data-action="start-cifras">${enCifras ? "Empezar otro" : "Crear un duelo de cifras"} <span>→</span></button>`) : ""}
      ${bloque("turnos-orden", `<div class="duel-brief"><p>Colocad una carta cada vez, desde vuestro propio móvil. Recibirás un aviso cuando el rival juegue.</p>
        <p class="solo-intro-rule duel-rule">${glyph(GLYPHS.reloj)}<span>15 segundos de seguridad al entrar en cada turno · Si sales de la pantalla, el turno queda protegido.</span></p></div>
        <button class="btn btn-primary btn-block" style="margin-top:10px" data-action="start-turn-duel">Crear duelo por turnos <span>→</span></button>`)}
      ${regla ? bloque("turnos-cifras", `<div class="duel-brief"><p>Responded una cifra cada vez, desde vuestro propio móvil. El rival recibe un aviso al terminar tu turno.</p>
        <p class="solo-intro-rule duel-rule">${glyph(GLYPHS.reloj)}<span>15 segundos de seguridad al entrar en cada turno · La respuesta queda cerrada si sales de la pantalla.</span></p></div>
        <button class="btn btn-primary btn-block" style="margin-top:10px" data-action="start-turn-duel">Crear duelo por turnos <span>→</span></button>`) : ""}
      <div class="field duel-identity-field">
        <label for="duel-name">Tu nombre de perfil</label>
        <div class="duel-identity"><span class="duel-avatar" aria-hidden="true">${escapeHtml(initials(duelName()))}</span><input id="duel-name" type="text" readonly aria-readonly="true" value="${escapeHtml(duelName())}"></div>
        <small class="field-help">Se usará automáticamente en el duelo. Puedes cambiarlo desde tu perfil.</small>
      </div>
    </div>`;
  }

  // El nombre se guarda entre duelos: es lo único que hay que escribir, y pedirlo cada
  // vez para acabar poniendo lo mismo sobra.
  const DUEL_NAME_KEY = "hilo-nombre-v1";

  function duelName() {
    try { return CT.Duelo.limpiaNombre(CT.Identidad.nombre() || CT.Accounts?.profile?.alias || CT.Storage.getItem(DUEL_NAME_KEY) || "Explorador"); } catch { return "Explorador"; }
  }

  function saveDuelName(nombre) {
    try { CT.Storage.setItem(DUEL_NAME_KEY, CT.Duelo.limpiaNombre(nombre)); } catch { /* almacenamiento lleno */ }
  }

  function guardaNombreSiLoHay() {
    const campo = document.getElementById("duel-name");
    if (campo) saveDuelName(campo.value);
  }

  // `duel` recibe el duelo ya descodificado cuando se acepta un reto ajeno; si no viene,
  // se estrena uno propio con semilla nueva. En los dos casos el reparto sale de la misma
  // función, que es justo lo que garantiza que los dos móviles jueguen lo mismo.
  function startSolo(kind, duel = null) {
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    // El duelo se juega siempre en Fácil, como el reto diario: si cada parte lo jugara en
    // una dificultad, el marcador compararía dos cosas distintas.
    const difficulty = kind === "daily" || kind === "duel" ? "easy" : selectedDifficulty;
    const ids = currentMode().cards.map(card => card.id);
    let barajado;
    let duelo = null;
    if (kind === "duel") {
      // Un duelo que se estrena aquí se juega a reloj. Uno que llega por enlace se juega
      // como lo jugó quien retó: los enlaces anteriores al reloj no lo llevan, y ponérselo
      // a quien los acepta sería compararlo contra una marca hecha sin plazo.
      duelo = duel || { seed: CT.Duelo.crearSemilla(), total: CT.Duelo.CARTAS, rival: null, ms: CT.Duelo.MS };
      barajado = CT.Duelo.reparto(selectedModeKey, duelo.seed, duelo.total);
    } else if (kind === "daily") {
      barajado = shuffleWith(ids, seededRandom(seedFrom(`${today()}:${selectedModeKey}`))).slice(0, DAILY_CARDS + 1);
    } else {
      barajado = shuffle(ids);
    }
    const timeline = [barajado.shift()];
    solo = {
      kind, difficulty, ghostTurns: difficulty === "hard" ? CT.Ghost.soloSchedule(ids.length) : [],
      mode: selectedModeKey, day: today(), deck: barajado, timeline,
      current: barajado.shift(), lives: SOLO_LIVES, hits: 0, played: 0,
      total: kind === "daily" ? DAILY_CARDS : kind === "duel" ? duelo.total : null,
      duelo, finished: false, newDiscoveries: 0,
      cartaEmpezadaEn: duelo?.ms > 0 ? Date.now() : null
    };
    pendingIndex = null;
    result = null;
    saveSolo();
    soloView();
  }

  // El plazo de este duelo en concreto: el de hoy si se estrenó aquí, o el que traía el
  // enlace si llegó de fuera. Cero es un duelo de antes de que hubiera reloj.
  function plazoDuelo() { return solo?.kind === "duel" && !solo.finished ? Number(solo.duelo?.ms) || 0 : 0; }
  function enDueloConReloj() { return plazoDuelo() > 0; }

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
      <h1 class="solo-lectores" data-focus tabindex="-1">${etiqueta}: ${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}${enDuelo() ? "" : `, ${solo.lives} ${solo.lives === 1 ? "vida" : "vidas"}`}</h1>
      ${solo.kind === "comp" ? `<div class="comp-topic">${escapeHtml(CT.mode(solo.mode).name)}</div>` : ""}
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">${etiqueta}</div><div class="turn-name" aria-hidden="true">${solo.hits} ${solo.hits === 1 ? "acierto" : "aciertos"}</div></div><div class="deck-count"><strong>${restantes}</strong><span>por colocar</span></div></div>
      ${enDuelo() ? "" : `<div class="solo-lives" aria-label="Vidas restantes: ${solo.lives}">${"♥".repeat(solo.lives)}${"♡".repeat(SOLO_LIVES - solo.lives)}</div>`}
      ${enDueloConReloj() && solo.cartaEmpezadaEn && !solo.pendingResult ? relojMarkup(Math.max(0, plazoDuelo() - (Date.now() - solo.cartaEmpezadaEn)), plazoDuelo()) : ""}
      ${soloHidden() ? `<div class="ghost-banner" role="status"><span aria-hidden="true">◌</span><div><b>Fantasma ${solo.difficulty === "expert" ? "permanente" : "· esta jugada"}</b><small>Los valores se revelan al resolver cada carta.</small></div></div>` : ""}
      <section class="board-focus-card"><div class="hand-title"><h3>Tu carta</h3></div>${pendingIndex === null ? `<div class="hand hand-solo"><div class="hand-card selected" data-id="${card.id}">${categoryBadge(card)}<span class="hidden-date">${currentAxis().hiddenLabel}</span>${cardBack()}<strong>${escapeHtml(card.title)}</strong></div></div>` : `<p class="hint provisional-hand-note">La carta está en la línea como vista previa.</p>`}<p class="hint">${pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : "Toca el hueco donde quieres colocar la carta, o mantén pulsada la carta y arrástrala hasta él"}</p></section>
      <section class="board-timeline-section"><div class="hand-title"><h3>${currentAxis().timelineTitle}</h3><small>${solo.timeline.length} ${solo.timeline.length === 1 ? "carta" : "cartas"}</small></div>${CT.timelineMap(selectedModeKey, timelineCards, { hidden: soloHidden() })}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      ${solo.autoAdded?.length ? `<p class="auto-cards" role="status">El tablero ha incorporado ${solo.autoAdded.length} ${solo.autoAdded.length === 1 ? "carta" : "cartas"}: ${solo.autoAdded.map(id => escapeHtml(cardsById.get(id).title)).join(" · ")}. No suman aciertos.</p>` : ""}
    </div>`);
    if (failIndex !== null) setTimeout(() => CT.scrollToElement(document.querySelector(".timeline-wrap"), document.querySelector(".slot-correct")), 0);
    // Las cartas que acaba de colocar el tablero se ven llegar, una detrás de otra, y la
    // línea se desplaza hasta la primera para que el movimiento no ocurra fuera de la
    // pantalla. Solo la primera vez que se pintan: repintar al elegir un hueco no vuelve
    // a repartirlas, así que tampoco vuelve a animarlas.
    if (recienColocadas.length) {
      const llegan = recienColocadas.map(id => app.querySelector(`.timeline-card[data-id="${id}"]`)).filter(Boolean);
      recienColocadas = [];
      const wrap = app.querySelector(".timeline-wrap");
      if (llegan.length && wrap) {
        // La vista acompaña a cada carta hasta donde cae. El desplazamiento es seco y no
        // suave: la carta todavía no se ve —entra desde el centro— y así el sitio al que
        // llega ya está quieto cuando empieza a moverse.
        CT.dealIn(llegan, {
          delay: 1000,
          seguir: carta => {
            const caja = carta.getBoundingClientRect(), marco = wrap.getBoundingClientRect();
            wrap.scrollLeft += caja.left - marco.left - (marco.width - caja.width) / 2;
          }
        });
      }
    }
    CT.enableDrag({
      cardSelector: ".hand-card", slotSelector: ".slot",
      onDrop: (id, index) => {
        pendingIndex = index;
        if (index !== null) anunciaHueco(index, solo.timeline.length);
        soloView();
      }
    });
    if (cartaEnReloj()) arrancaReloj();
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
    }
    resuelveCartaSolo(card, correct, index, null);
  }

  // Quedarse sin tiempo, o salirse de la aplicación con una carta delante, la da por
  // fallada. En un duelo a reloj no decidir es una decisión: dejarla pendiente para
  // volver luego sería justamente el hueco por el que se cuela quien va a buscar la
  // respuesta a otra parte, que es lo que el plazo viene a cerrar.
  function cierraCartaDuelo(motivo) {
    if (!enDueloConReloj() || !solo.cartaEmpezadaEn || solo.pendingResult) return;
    resuelveCartaSolo(cardsById.get(solo.current), false, null, motivo);
  }

  // Lo que ocurre con una carta una vez resuelta, se haya colocado o se haya acabado el
  // tiempo: cuenta como jugada, entra en la cuadrícula y abre el resultado.
  function resuelveCartaSolo(card, correct, index, motivo) {
    paraReloj();
    if (!correct) {
      // El duelo no gasta vidas: ver `soloAcabada`.
      if (!enDuelo()) solo.lives -= 1;
      (solo.failed = solo.failed || []).push(solo.current);
    }
    solo.played += 1;
    // Un acierto o un fallo por carta, en el orden en que se jugaron: es lo único que
    // hace falta para dibujar la cuadrícula de aciertos al compartir el reto diario.
    (solo.sequence = solo.sequence || []).push(correct);
    solo.cartaEmpezadaEn = null;
    pendingIndex = null;
    result = {
      correct, card, solo: true, motivo, attemptedIndex: index,
      correctIndex: correct ? null : CT.correctIndex(selectedModeKey, solo.timeline.map(id => cardsById.get(id)), card)
    };
    CT.Effects.feedback(correct);
    solo.pendingResult = { correct, cardId: card.id, attemptedIndex: result.attemptedIndex, correctIndex: result.correctIndex };
    const nuevaLamina=!CT.Progreso.seenCards().has(card.id)&&!!CT.cardArt(solo.mode,card);
    anotaLogros(CT.Progreso.record({ mode: solo.mode, cardId: card.id, correct, kind: solo.kind, hidden: soloHidden() }));
    if(nuevaLamina)solo.newDiscoveries=(solo.newDiscoveries||0)+1;
    saveSolo();
    soloResult();
  }

  function soloResult() {
    soloView();
    const { correct, card, motivo } = result;
    const era = eraForCard(card);
    const acabada = soloAcabada();
    const hint = correct ? "" : `<p>${CT.placementHint(selectedModeKey, solo.timeline.map(id => cardsById.get(id)), card)}</p>`;
    // Una carta que se acabó sin colocar no se ha colocado mal: se dice lo que pasó de
    // verdad, y la explicación de debajo tampoco la llama fallo de colocación.
    const titulo = correct ? "¡Bien colocado!" : motivo === "salida" ? "Carta cerrada" : motivo === "tiempo" ? "Se acabó el tiempo" : "No encaja ahí";
    const remate = correct ? "La carta se queda colocada."
      : motivo === "salida" ? "Has salido de la aplicación con la carta delante, así que esta no suma."
      : motivo === "tiempo" ? "Se agotaron los segundos sin colocarla, así que esta no suma."
      : enDuelo() ? "Fallo: esa carta no suma." : `Fallo: te quedan ${solo.lives} ${solo.lives === 1 ? "vida" : "vidas"}.`;
    overlay(`<div class="overlay" data-result-card="${correct ? card.id : ''}"${correct ? '' : ` data-correction-card="${card.id}" data-attempted-slot="${result.attemptedIndex}" data-correct-slot="${result.correctIndex}"`}><div class="modal ${correct ? "success" : "failure"}"><div class="result-mark" aria-hidden="true">${correct ? "✓" : "×"}</div><div class="eyebrow" aria-hidden="true">${titulo}</div><h2><span class="solo-lectores">${titulo}: </span>${escapeHtml(card.title)}</h2><div class="reveal">${categoryBadge(card)}<div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div>${CT.Art.button(selectedModeKey, card)}<div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div>${hint}<p>${remate}</p><button class="btn btn-primary btn-block" data-dialog-focus data-action="solo-next">${acabada ? "Ver el resultado" : "Siguiente carta"} <span>→</span></button></div></div>`);
  }

  function soloNext() {
    if (!solo?.pendingResult) return;
    solo.pendingResult = null;
    result = null;
    if (soloAcabada()) return soloFinish();
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
    // `autoAdded` se guarda con la partida y sigue ahí al reanudarla, así que no sirve
    // para saber si el movimiento está por enseñar: eso lo dice esta lista, que vive solo
    // en esta pantalla y se vacía en cuanto se ha visto llegar las cartas.
    recienColocadas = solo.autoAdded.slice();
    // La carta nueva estrena plazo. Se apunta el instante, no lo que queda: así el tiempo
    // corre aunque el móvil apague la pantalla o la aplicación se vaya al fondo.
    if (enDueloConReloj()) solo.cartaEmpezadaEn = Date.now();
    saveSolo();
    soloView();
  }

  function soloFinish() {
    if (solo.kind === "comp") return compRoundFinish();
    screen = "solo-end";
    const total = solo.total || solo.played;
    const records = solo.kind === "daily" ? dailyRecords() : modeRecords();
    const difficulty=solo.difficulty||'easy';
    const previousBest=records.bestByDifficulty?.[difficulty]||((difficulty==='easy'?records.best:0)||0);
    // Se guarda con cada marca, no solo al crearlo, para que una instalación que ya
    // tenía partidas antes de este cambio acabe teniendo el suyo igual.
    // El identificador anónimo del móvil lo genera `progreso.js`, que es quien lo usa
    // para el perfil; aquí solo se copia dentro del récord del mazo para que un futuro
    // marcador entre amigos no tenga que cruzar dos claves de almacenamiento.
    records.playerId = records.playerId || CT.Progreso.playerId();
    // El reto diario convalida por el día en que se empezó a jugar, no por el día en que
    // se termina: uno empezado a las 23:58 y acabado pasada la medianoche sigue siendo el
    // reto de la fecha en que se empezó.
    const dia = solo.day || today();
    const esReto = solo.kind === "daily" && !(records.days && records.days[dia]);
    if (esReto) {
      records.days = records.days || {};
      // `sequence` y `finishedAt` no los usa nada todavía: son lo que necesitaría un
      // marcador entre amigos del reto diario si algún día existe, guardado desde ya
      // para no depender de reconstruirlo a partir de partidas viejas que no lo llevan.
      records.days[dia] = { hits: solo.hits, total, sequence: solo.sequence || [], finishedAt: new Date().toISOString() };
      records.streak = records.lastDay === previousDay(dia) ? (records.streak || 0) + 1 : 1;
      records.lastDay = dia;
      // No hace falta guardar el histórico entero: basta con los últimos días.
      const dias = Object.keys(records.days).sort().slice(-60);
      records.days = Object.fromEntries(dias.map(clave => [clave, records.days[clave]]));
      records.best = Math.max(records.best || 0, solo.hits);
      saveDailyRecords(records);
    } else if (solo.kind === "free") {
      records.bestByDifficulty = records.bestByDifficulty || { easy: records.best || 0 };
      records.bestByDifficulty[difficulty] = Math.max(records.bestByDifficulty[difficulty] || 0, solo.hits);
      if (difficulty === "easy") records.best = records.bestByDifficulty.easy;
      saveRecords(records);
    }
    const enDueloEsta = solo.kind === "duel";
    const superado = enDueloEsta ? solo.hits === total : solo.lives > 0;
    const logros = CT.Progreso.finishGame({
      mode: solo.mode, kind: solo.kind, hits: solo.hits, total, rankedDaily: esReto,
      difficulty: solo.difficulty || "easy", streak: records.streak || 0, lives: solo.lives,
      // Ganar un duelo solo se puede afirmar cuando hay alguien contra quien ganarlo: al
      // crearlo todavía no hay rival, solo una marca que mandar.
      won: enDueloEsta && !!solo.duelo?.rival && solo.hits > solo.duelo.rival.hits
    });
    const resumen = solo.kind === "daily" || enDueloEsta
      ? `Has colocado bien <strong>${solo.hits}</strong> de ${total} cartas.`
      : `Has colocado <strong>${solo.hits}</strong> ${solo.hits === 1 ? "carta" : "cartas"} en ${CT.Ghost.level(solo.difficulty).name}. ${solo.lives > 0 ? "Has completado el mazo." : "Has agotado las tres vidas."}`;
    soloFailedForReview = (solo.failed || []).map(id => ({ id, mode: solo.mode }));
    const compartir = solo.kind === "daily" ? shareText(currentMode().name, dia, solo.hits, total, solo.sequence || [], records.streak) : null;
    const duelo = enDueloEsta ? cierreDuelo(solo, total) : null;
    const earned = [...(solo.earnedAchievements || []), ...logros];
    const sessionLogros = [...new Map(earned.map(item => [item.id || item.name, item])).values()];
    const finalHits=solo.hits;
    const soloKind=solo.kind;
    const newDiscoveries=solo.newDiscoveries||0;
    const bestNow=solo.kind==='free'?Math.max(previousBest,solo.hits):Math.max(previousBest,records.best||0);
    solo.finished = true;
    saveSolo();
    solo = null;
    const fallosUnicos = new Set(soloFailedForReview.map(item => item.id)).size;
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel final-composition"><div class="eyebrow">${duelo ? duelo.eyebrow : superado ? "Reto completado" : "Se acabaron las vidas"}</div><h1 class="final-title" data-focus tabindex="-1">${duelo ? duelo.titular : 'Tu resultado'}</h1>${finalMetrics(finalHits,finalHits===1?'acierto':'aciertos',bestNow,soloKind==='free'?(finalHits>previousBest?'nueva mejor marca':'mejor marca'):'mejor marca',newDiscoveries,sessionLogros.length)}${duelo ? duelo.cuerpo : `<p class="final-lead">${resumen}</p>`}${logrosMarkup(sessionLogros)}<div class="actions final-actions">${duelo ? duelo.acciones : ""}${compartir ? `<button class="btn btn-secondary" data-action="share-daily">Compartir resultado</button>` : ""}${fallosUnicos ? `<button class="btn btn-ghost" data-action="review-solo">Ver lo que se falló (${fallosUnicos})</button>` : ""}${soloKind === "daily" ? '<button class="btn btn-primary" data-action="home">Ir al inicio</button>' : `<button class="btn ${duelo ? "btn-secondary" : "btn-primary"}" data-action="${duelo ? "duel-home" : "solo"}">${duelo ? "Volver a los duelos" : "Volver a solitario"}</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button>`}</div></div></section></div>`);
    lastShareText = compartir;
  }

  // El final de un duelo tiene dos caras. Si lo has creado tú, todavía no hay con quién
  // compararse: lo que toca es mandar el enlace. Si lo has aceptado, sí hay marcador, y
  // la gracia está en verlo carta a carta.
  function cierreDuelo(partida, total) {
    const mode = CT.mode(partida.mode);
    const mio = { hits: partida.hits, sequence: partida.sequence || [] };
    const rival = partida.duelo?.rival || null;
    const payload = CT.Duelo.codificar({
      mode: partida.mode, seed: partida.duelo.seed, total, deck: partida.savedDeck,
      hits: mio.hits, sequence: mio.sequence, nombre: duelName()
    });

    if (!rival) {
      lastDuelShare = CT.Duelo.invitacion({ modeName: mode.name, nombre: duelName(), hits: mio.hits, total, payload });
      return {
        icono: "🎯", eyebrow: "Duelo listo",
        titular: `Has colocado bien <strong>${mio.hits}</strong> de ${total} cartas.`,
        cuerpo: `<p class="lead" style="margin-inline:auto">Manda el enlace a quien quieras: recibirá estas mismas ${total} cartas, en el mismo orden, y al terminar verá vuestro cara a cara.</p>`,
        acciones: `<button class="btn btn-primary" data-action="share-duel">Mandar el reto <span>→</span></button>`
      };
    }

    const gano = mio.hits > rival.hits;
    const empate = mio.hits === rival.hits;
    const quien = rival.nombre || "quien te retaba";
    lastDuelShare = CT.Duelo.marcador({ modeName: mode.name, rival, mio });
    return {
      icono: empate ? "🤝" : gano ? "🏆" : "🎯",
      eyebrow: empate ? "Empate" : gano ? "Has ganado el duelo" : "Duelo perdido",
      titular: `${mio.hits} <span style="opacity:.6">a</span> ${rival.hits}`,
      cuerpo: `<p class="lead" style="margin-inline:auto">${empate ? `Habéis acertado lo mismo que ${quien}.` : gano ? `Has superado a ${escapeHtml(quien)}.` : `${escapeHtml(quien)} te ha ganado esta vez.`}</p>
        ${duelGridMarkup(quien, rival.sequence, mio.sequence)}`,
      acciones: `<button class="btn btn-primary" data-action="start-duel">Devolver el reto <span>→</span></button><button class="btn btn-secondary" data-action="share-duel">Compartir el resultado</button>`
    };
  }

  // Las dos cuadrículas, una encima de otra: se ve de un vistazo en qué cartas os habéis
  // separado, que es lo que de verdad se comenta después.
  function duelGridMarkup(quien, suya, mia) {
    const fila = sec => sec.map(acierto => `<i class="${acierto ? "ok" : "ko"}" aria-hidden="true"></i>`).join("");
    const cuenta = sec => `${sec.filter(Boolean).length} de ${sec.length}`;
    return `<div class="duel-grid">
      <div><b>${escapeHtml(quien)}</b><div class="duel-row" role="img" aria-label="${escapeHtml(quien)}: ${cuenta(suya)}">${fila(suya)}</div></div>
      <div><b>Tú</b><div class="duel-row" role="img" aria-label="Tú: ${cuenta(mia)}">${fila(mia)}</div></div>
    </div>`;
  }

  // ——— El duelo de cifras ———
  //
  // Diez cartas, el mismo plazo que el duelo de orden, y en vez de colocar se escribe el
  // que puntúa y lo que viaja en el enlace está en duelo.js; aquí está lo que se ve y,
  // sobre todo, el reloj, que es la regla de la que depende todo lo demás.
  //
  // El reloj se mide siempre restando marcas de `Date.now()`, nunca descontando de un
  // contador. La diferencia no es de estilo: una pestaña escondida congela sus
  // temporizadores, así que un contador se pararía justo mientras alguien va a buscar la
  // respuesta a otra parte. Con la hora de verdad, irse cuesta el tiempo que se tarda.
  const Cifras = CT.Duelo.Cifras;
  let cifras = null;
  let cifrasReloj = null;
  // Desde cuándo está esto en segundo plano. Lo alimentan la visibilidad del documento y
  // el cambio de estado de la aplicación nativa, que en móvil no siempre coinciden.
  let ocultaDesde = 0;

  function reglaCifra(modeKey = selectedModeKey) { return CT.axis(modeKey).cifra; }

  function cifrasKey() { return `hilo-cifras-${selectedModeKey}-v1`; }

  // El plazo de esta partida de cifras: el de hoy si se estrenó aquí, o el que traía el
  // enlace si llegó de fuera. Los puntos por rapidez se miden contra él, así que una
  // partida jugada con otro plazo hay que seguir puntuándola con el suyo.
  function plazoCifras() { return Number(cifras?.ms) || Cifras.MS; }

  // La carta que se tiene delante. Mientras se enseña el resultado de una, la de delante
  // sigue siendo esa y no la siguiente: revelar la siguiente por detrás de la capa sería
  // regalar un plazo entero de ventaja.
  function indiceCifra() { return cifras.jugadas.length - (cifras.pendiente ? 1 : 0); }
  function cartaCifra() { return cifras.cartas[indiceCifra()]; }

  function guardaCifras() {
    if (!cifras) { CT.Storage.removeItem(cifrasKey()); return; }
    const { mode, seed, total, ms, jugadas, empezadaEn, rival, finished } = cifras;
    try { CT.Storage.setItem(cifrasKey(), JSON.stringify({ mode, seed, total, ms, jugadas, empezadaEn, rival, finished })); }
    catch { /* almacenamiento lleno */ }
  }

  // Al recuperar una partida no se guardan las cartas: se vuelven a repartir con la
  // semilla. Si el mazo ha cambiado de versión entre medias, el reparto ya no cuadra y la
  // partida se descarta en vez de comparar cosas distintas.
  function cargaCifras() {
    try {
      const guardado = JSON.parse(CT.Storage.getItem(cifrasKey()) || "null");
      if (!guardado || guardado.finished || guardado.mode !== selectedModeKey || !CT.has(guardado.mode)) return null;
      if (!reglaCifra(guardado.mode)) return null;
      const total = Number(guardado.total);
      if (!Number.isInteger(total) || total < 1 || total > Cifras.CARTAS) return null;
      if (!Array.isArray(guardado.jugadas) || guardado.jugadas.length > total) return null;
      const cartas = Cifras.cartas(guardado.mode, guardado.seed, total);
      if (cartas.length !== total || cartas.some(card => !card)) return null;
      return { ...guardado, total, cartas, pendiente: null };
    } catch { return null; }
  }

  // Lo que escribe una persona en español: puntos de millar, coma decimal, espacios y a
  // veces un menos para los años antes de Cristo. «47.000.000» son cuarenta y siete
  // millones; «1,5» es uno y medio; y «1.5», que nadie escribiría como millar porque
  // detrás del punto no hay tres cifras, se entiende como decimal.
  // Lo que escribe una persona, que puede traer su unidad detrás: «40 g», «2,5 t»,
  // «3 días», «47 millones». El número se lee a la española —puntos de millar, coma
  // decimal— y la unidad se convierte a la del mazo, que es la que ordena las cartas.
  // Una unidad que no se reconoce no se ignora: la respuesta entera se descarta, porque
  // dar por buenos «40 lunas» como si fueran cuarenta kilos sería puntuar otra cosa.
  function leeCifra(texto, modeKey = cifras?.mode || selectedModeKey) { return Cifras.leer(modeKey, texto); }

  function paraReloj() {
    if (cifrasReloj) clearInterval(cifrasReloj);
    cifrasReloj = null;
  }

  function arrancaReloj() {
    paraReloj();
    cifrasReloj = setInterval(tictac, 100);
    tictac();
  }

  // Los dos duelos comparten el reloj. Lo único que cambia es qué cierra cada uno cuando
  // se agota: el de cifras cierra la respuesta escrita; el de orden da la carta por
  // fallada, porque ahí no hay nada a medio escribir que rescatar. Devuelve `null` en
  // cuanto no hay ninguna carta abierta, que es la señal de parar el latido.
  function cartaEnReloj() {
    if (screen === "cifras" && cifras && cifras.empezadaEn !== null && !cifras.pendiente) {
      return { empezadaEn: cifras.empezadaEn, ms: plazoCifras(), cierra: cierraCarta };
    }
    if (screen === "solo" && enDueloConReloj() && solo.cartaEmpezadaEn && !solo.pendingResult) {
      return { empezadaEn: solo.cartaEmpezadaEn, ms: plazoDuelo(), cierra: cierraCartaDuelo };
    }
    return null;
  }

  // El latido: no decide nada por su cuenta, solo mira la hora y pinta lo que queda. Si
  // el móvil ha tenido la pestaña congelada, al volver encuentra el tiempo ya gastado.
  function tictac() {
    const abierta = cartaEnReloj();
    const barra = app.querySelector(".reloj-bar");
    if (!abierta || !barra) return paraReloj();
    const restante = abierta.ms - (Date.now() - abierta.empezadaEn);
    barra.value = Math.max(0, restante);
    barra.classList.toggle("reloj-apura", restante <= 3000);
    const marca = app.querySelector(".reloj-left");
    if (marca) marca.textContent = `${Math.max(0, Math.ceil(restante / 1000))} s`;
    if (restante <= 0) abierta.cierra("tiempo");
  }

  // El reloj de una carta, igual en los dos duelos.
  function relojMarkup(restante, total) {
    return `<div class="reloj"><progress class="reloj-bar ${restante <= 3000 ? "reloj-apura" : ""}" max="${total}" value="${restante}" aria-label="Tiempo restante para esta carta"></progress><b class="reloj-left" role="timer" aria-live="off">${Math.ceil(restante / 1000)} s</b></div>`;
  }

  function abreCarta() {
    cifras.pendiente = null;
    cifras.empezadaEn = Date.now();
    guardaCifras();
    cifrasView();
  }

  // Cerrar una carta es lo único que resuelve una jugada, y las tres maneras de llegar
  // aquí acaban en el mismo sitio: responder, agotar el plazo o salirse de la
  // aplicación. Solo la tercera anula la respuesta; agotar el tiempo con algo escrito
  // sigue puntuando, pero sin la parte que premia la prisa.
  function cierraCarta(motivo) {
    if (!cifras || cifras.empezadaEn === null || cifras.pendiente) return;
    paraReloj();
    const salida = motivo === "salida";
    const campo = app.querySelector("#cifra-input");
    const respuesta = salida ? null : leeCifra(campo ? campo.value : "");
    const jugada = {
      respuesta,
      ms: Math.min(Math.max(Date.now() - cifras.empezadaEn, 0), plazoCifras()),
      salida
    };
    const card = cartaCifra();
    cifras.jugadas.push(jugada);
    cifras.empezadaEn = null;
    const puntos = Cifras.puntosCarta(cifras.mode, card, jugada, plazoCifras());
    cifras.pendiente = { jugada, motivo, puntos };
    anotaLogros(CT.Progreso.record({ mode: cifras.mode, cardId: card.id, correct: puntos > 0, kind: "cifras" }));
    CT.Effects.feedback(puntos > 0);
    guardaCifras();
    cifrasView();
    cifrasRevelado();
  }

  // Irse de la aplicación cierra la carta abierta, pero no a la primera: por debajo del
  // margen de gracia caben un aviso que se cuela, una llamada o un roce en el gesto de
  // multitarea, y ninguna de esas tres cosas puede costar una carta. Lo que no se hace es
  // llamar tramposo a nadie: la carta se cierra y se dice, que es lo que de verdad se ve
  // después en el marcador compartido.
  function salidaDeLaApp(fuera) {
    if (fuera <= CT.Duelo.GRACIA_MS) return;
    cartaEnReloj()?.cierra("salida");
  }

  function vuelveAPrimerPlano() {
    const fuera = ocultaDesde ? Date.now() - ocultaDesde : 0;
    ocultaDesde = 0;
    salidaDeLaApp(fuera);
  }

  function seVaAlFondo() { ocultaDesde = ocultaDesde || Date.now(); }

  document.addEventListener("visibilitychange", () => (document.hidden ? seVaAlFondo() : vuelveAPrimerPlano()));
  window.addEventListener("pagehide", seVaAlFondo);
  window.addEventListener("pageshow", vuelveAPrimerPlano);
  try {
    const capacitor = window.Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      const nativa = capacitor.registerPlugin?.("App") || capacitor.Plugins?.App;
      Promise.resolve(nativa?.addListener?.("appStateChange", estado => (estado.isActive ? vuelveAPrimerPlano() : seVaAlFondo()))).catch(() => {});
    }
  } catch { /* La visibilidad del documento ya cubre el caso general. */ }

  function startCifras(duel = null) {
    const duelo = duel || { seed: CT.Duelo.crearSemilla(), total: Cifras.CARTAS, rival: null, ms: Cifras.MS };
    cifras = {
      mode: selectedModeKey, seed: duelo.seed, total: duelo.total, ms: Number(duelo.ms) || Cifras.MS,
      cartas: Cifras.cartas(selectedModeKey, duelo.seed, duelo.total),
      jugadas: [], empezadaEn: null, rival: duelo.rival, finished: false, pendiente: null
    };
    abreCarta();
  }

  // Reanudar: si la carta seguía abierta, el tiempo que ha pasado por fuera cuenta igual,
  // así que salirse y volver más tarde —o cerrar la aplicación del todo— cierra esa
  // carta en vez de regalar un reloj nuevo.
  function resumeCifras() {
    cifras = cargaCifras();
    if (!cifras) return duelHome();
    if (cifras.jugadas.length >= cifras.total) return cifrasFinish();
    if (cifras.empezadaEn === null) return abreCarta();
    // La carta seguía abierta. Si se ha estado fuera más que el margen de gracia se
    // cierra como salida, sin pasar antes por la pantalla: pintarla arrancaría el reloj,
    // que al encontrar el tiempo gastado lo contaría como un simple agotarse el plazo y
    // la carta dejaría de aparecer como lo que fue.
    if (Date.now() - cifras.empezadaEn > Cifras.GRACIA_MS) return cierraCarta("salida");
    cifrasView();
  }

  function cifrasView() {
    screen = "cifras";
    const regla = reglaCifra(cifras.mode);
    const card = cartaCifra();
    const indice = indiceCifra();
    const cerrada = !!cifras.pendiente;
    const puntos = Cifras.puntosPartida(cifras.mode, cifras.seed, cifras.total, cifras.jugadas, plazoCifras());
    const restante = cerrada ? 0 : Math.max(0, plazoCifras() - (Date.now() - cifras.empezadaEn));
    const marcaRival = cifras.rival ? `<span><b>${cifras.rival.puntos}</b><small>${escapeHtml(cifras.rival.nombre || "quien te reta")}</small></span>` : "";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="cifras-exit">Salir</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">Carta ${indice + 1} de ${cifras.total}. ${escapeHtml(regla.pregunta)} ${escapeHtml(card.title)}. Tienes ${Cifras.SEGUNDOS} segundos.</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">Duelo de cifras</div><div class="turn-name" aria-hidden="true">${puntos} ${puntos === 1 ? "punto" : "puntos"}</div></div><div class="deck-count"><strong>${cifras.total - indice}</strong><span>por responder</span></div></div>
      ${marcaRival ? `<div class="solo-stats cifra-rival">${marcaRival}</div>` : ""}
      <section class="cifra-panel">
        ${relojMarkup(restante, plazoCifras())}
        <div class="cifra-card" id="cifra-pregunta">${categoryBadge(card)}<strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(regla.pregunta)}</span></div>
        <div class="field cifra-field">
          <label for="cifra-input">Tu cifra${regla.unidad ? ` <span class="cifra-unidad">en ${escapeHtml(regla.unidad)} si no pones otra</span>` : ""}</label>
          <input id="cifra-input" type="text" inputmode="${regla.decimales ? "decimal" : "numeric"}" autocomplete="off" enterkeyhint="send" aria-describedby="cifra-pregunta cifra-unidades" placeholder="${escapeHtml(regla.unidad || "")}" ${cerrada ? "disabled" : "data-autofocus"}>
          <p class="hint" id="cifra-unidades">${escapeHtml(regla.pista || "")}${unidadesMarkup(cifras.mode)}</p>
        </div>
        <button class="btn btn-primary btn-block" data-action="cifra-answer" ${cerrada ? "disabled" : ""}>Responder <span>→</span></button>
        <p class="hint cifra-aviso">El reloj no se para. Si sales de la aplicación, la carta se cierra.</p>
      </section>
    </div>`);
    const campo = app.querySelector("#cifra-input");
    if (campo && !cerrada) campo.addEventListener("keydown", evento => { if (evento.key === "Enter") { evento.preventDefault(); cierraCarta("respuesta"); } });
    if (!cerrada) arrancaReloj();
  }

  // Las unidades que admite el mazo, tal cual las declara su eje. No es decoración: en
  // peso, longevidad y velocidad el valor interno está en una unidad y las cartas se
  // enseñan en otra, así que sin esto no hay manera de saber en qué se responde.
  function unidadesMarkup(modeKey) {
    const lista = Cifras.unidades(modeKey);
    if (lista.length < 2) return "";
    return `<span class="cifra-unidades">Se aceptan: ${lista.map(u => escapeHtml(u.nombre)).join(" · ")}</span>`;
  }

  // El resultado de una carta: lo que valía, lo que se respondió y lo que suma. Aquí ya
  // se puede enseñar el detalle de la carta, que antes de responder muchas veces lleva la
  // cifra dentro.
  function cifrasRevelado() {
    const { jugada, motivo, puntos } = cifras.pendiente;
    const card = cartaCifra();
    const banda = Cifras.banda(cifras.mode, card, jugada.respuesta);
    const acabada = cifras.jugadas.length >= cifras.total;
    const suya = cifras.rival ? cifras.rival.jugadas[indiceCifra()] : null;
    const titulo = jugada.salida ? "Carta cerrada" : banda.nombre;
    const explicacion = jugada.salida
      ? "Has salido de la aplicación con la carta abierta, así que esta no puntúa."
      : jugada.respuesta === null
        ? motivo === "tiempo" ? `Se acabaron los ${Cifras.SEGUNDOS} segundos sin ninguna cifra escrita.` : "No has escrito ninguna cifra."
        : `Tu respuesta: <strong>${escapeHtml(Cifras.formato(cifras.mode, jugada.respuesta))}</strong>${motivo === "tiempo" ? " — llegó con el tiempo agotado, así que no suma la prisa." : ` — has tardado ${(jugada.ms / 1000).toFixed(1)} s.`}`;
    overlay(`<div class="overlay" data-result-card="${puntos > 0 ? card.id : ""}"><div class="modal ${puntos > 0 ? "success" : "failure"}">
      <div class="result-mark" aria-hidden="true">${puntos >= 70 ? "✓" : puntos > 0 ? "≈" : "×"}</div>
      <div class="eyebrow" aria-hidden="true">${escapeHtml(titulo)}</div>
      <h2><span class="solo-lectores">${escapeHtml(titulo)}: </span>${escapeHtml(card.title)}</h2>
      <div class="reveal">${categoryBadge(card)}${CT.Art.button(cifras.mode, card)}<div class="year">${escapeHtml(CT.formatValue(cifras.mode, card))}</div><p>${escapeHtml(card.detail)}</p></div>
      <p>${explicacion}</p>
      <p class="cifra-puntos"><b>+${puntos}</b> ${puntos === 1 ? "punto" : "puntos"}</p>
      ${suya ? `<p class="hint">${escapeHtml(cifras.rival.nombre || "Quien te reta")} respondió ${escapeHtml(suya.salida ? "nada: salió de la aplicación" : Cifras.formato(cifras.mode, suya.respuesta))} y sumó ${Cifras.puntosCarta(cifras.mode, card, suya, plazoCifras())}.</p>` : ""}
      <button class="btn btn-primary btn-block" data-dialog-focus data-action="cifras-next">${acabada ? "Ver el resultado" : "Siguiente carta"} <span>→</span></button>
    </div></div>`);
  }

  function cifrasNext() {
    if (!cifras?.pendiente) return;
    CT.closeDialog?.();
    if (cifras.jugadas.length >= cifras.total) return cifrasFinish();
    abreCarta();
  }

  // Las dos caras del final, como en el otro duelo: quien lo crea manda el enlace y quien
  // lo acepta ve el cara a cara.
  function cifrasFinish() {
    paraReloj();
    screen = "cifras-end";
    const { mode, seed, total, jugadas, rival } = cifras;
    const modeName = CT.mode(mode).name;
    const plazo = plazoCifras();
    const mios = { puntos: Cifras.puntosPartida(mode, seed, total, jugadas, plazo), jugadas };
    const aciertos = jugadas.filter((jugada, i) => Cifras.puntosCarta(mode, cifras.cartas[i], jugada, plazo) > 0).length;
    const salidas = jugadas.filter(jugada => jugada.salida).length;
    const payload = Cifras.codificar({ mode, seed, total, jugadas, nombre: duelName() });
    const gano = !!rival && mios.puntos > rival.puntos;
    const logros = CT.Progreso.finishGame({ mode, kind: "duel", hits: aciertos, total, won: gano });
    const sessionLogros = [...new Map(logros.map(item => [item.id || item.name, item])).values()];

    let icono = "🎯", eyebrow = "Duelo de cifras listo", titular = `<strong>${mios.puntos}</strong> puntos en ${total} cartas.`, cuerpo = "", acciones = "";
    if (!rival) {
      lastDuelShare = Cifras.invitacion({ modeName, nombre: duelName(), puntos: mios.puntos, total, payload });
      cuerpo = `<p class="lead" style="margin-inline:auto">Manda el enlace a quien quieras: recibirá estas mismas ${total} cartas, con los mismos ${Cifras.SEGUNDOS} segundos para cada una.</p>`;
      acciones = `<button class="btn btn-primary" data-action="share-duel">Mandar el reto <span>→</span></button>`;
    } else {
      const empate = mios.puntos === rival.puntos;
      const quien = rival.nombre || "quien te retaba";
      lastDuelShare = Cifras.marcador({ modeName, mode, seed, total, rival, mio: mios, ms: plazo });
      icono = empate ? "🤝" : gano ? "🏆" : "🎯";
      eyebrow = empate ? "Empate" : gano ? "Has ganado el duelo" : "Duelo perdido";
      titular = `${mios.puntos} <span style="opacity:.6">a</span> ${rival.puntos}`;
      cuerpo = `<p class="lead" style="margin-inline:auto">${empate ? `Habéis sumado lo mismo que ${escapeHtml(quien)}.` : gano ? `Has superado a ${escapeHtml(quien)}.` : `${escapeHtml(quien)} te ha ganado esta vez.`}</p>
        ${cifrasGridMarkup(quien, rival.jugadas, jugadas, mode, cifras.cartas, plazo)}`;
      acciones = `<button class="btn btn-primary" data-action="start-cifras">Devolver el reto <span>→</span></button><button class="btn btn-secondary" data-action="share-duel">Compartir el resultado</button>`;
    }

    cifras.finished = true;
    guardaCifras();
    cifras = null;
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel">
      <div class="big-icon">${icono}</div><div class="eyebrow">${eyebrow}</div>
      <h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${titular}</h1>
      ${cuerpo}
      ${salidas ? `<p class="hint">${salidas === 1 ? "Una carta se cerró" : `${salidas} cartas se cerraron`} por salir de la aplicación.</p>` : ""}
      ${logrosMarkup(sessionLogros)}
      <div class="actions" style="justify-content:center">${acciones}<button class="btn btn-secondary" data-action="duel-home">Volver a los duelos</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button></div>
    </div></section></div>`);
  }

  // Verde lo clavado o casi, amarillo lo que se acercó, blanco lo que no puntuó y negro
  // la carta que se cerró por salir de la aplicación.
  function cifrasGridMarkup(quien, suyas, mias, mode, cartas, plazo) {
    const puntosDe = (jugada, i) => Cifras.puntosCarta(mode, cartas[i], jugada, plazo);
    const clase = (jugada, i) => {
      if (jugada.salida) return "out";
      const puntos = puntosDe(jugada, i);
      return puntos >= 70 ? "ok" : puntos > 0 ? "mid" : "ko";
    };
    const fila = lista => lista.map((jugada, i) => `<i class="${clase(jugada, i)}" aria-hidden="true"></i>`).join("");
    const cuenta = lista => `${lista.filter(puntosDe).length} de ${lista.length}`;
    return `<div class="duel-grid">
      <div><b>${escapeHtml(quien)}</b><div class="duel-row" role="img" aria-label="${escapeHtml(quien)}: puntúa en ${cuenta(suyas)}">${fila(suyas)}</div></div>
      <div><b>Tú</b><div class="duel-row" role="img" aria-label="Tú: puntúas en ${cuenta(mias)}">${fila(mias)}</div></div>
    </div>`;
  }

  // ——— Antes de empezar ———
  //
  // Un duelo va a reloj desde la primera carta, así que entrar directamente castigaba a
  // quien todavía estaba leyendo de qué iba. Entre elegir la modalidad y jugar hay ahora
  // una pantalla que enseña cómo funciona —con una demostración animada, que se entiende
  // antes que un párrafo— y que no arranca nada hasta que se pulsa. Y al pulsar, tres
  // segundos de cuenta atrás para levantar la vista y prepararse.
  let duelPreparado = null;

  function duelReady(modalidad, duel = null, pace = "seguidos") {
    duelPreparado = { modalidad, duel, pace };
    screen = "duelo-listo";
    const cifrasEsta = modalidad === "cifras";
    const enTurnos = pace === "turnos";
    const regla = reglaCifra();
    const rival = duel?.rival || null;
    const plazo = Math.round((Number(duel?.ms) || CT.Duelo.MS) / 1000);
    const reglas = cifrasEsta
      ? [`${Cifras.CARTAS} cartas de ${escapeHtml(currentMode().name)}, una detrás de otra.`,
         `En cada una escribes el número. ${escapeHtml(regla.pregunta || "")}`,
         enTurnos ? `Cada uno responde desde su propio móvil: recibirás un aviso cuando el rival juegue.` : `Puntúa lo cerca que te quedes <b>y</b> lo rápido que respondas.`]
      : [`${CT.Duelo.CARTAS} cartas de ${escapeHtml(currentMode().name)}, una detrás de otra.`,
         `Colocas cada una en el hueco que le toque de la línea.`,
         enTurnos ? `Cada uno juega desde su propio móvil: recibirás un aviso cuando el rival juegue.` : `Gana quien más acierte. No se gastan vidas: se juegan todas.`];
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="pass-screen"><div class="panel duelo-listo">
        <div class="eyebrow">Duelo por enlace</div>
        <h1 data-focus tabindex="-1" class="duelo-listo-titulo">${cifrasEsta ? "Escribir la cifra" : "Ordenar las cartas"}</h1>
        ${demoMarkup(cifrasEsta)}
        <ul class="duelo-reglas">${reglas.map(linea => `<li>${linea}</li>`).join("")}</ul>
        <p class="solo-intro-rule">${enTurnos ? "15 segundos de seguridad al entrar en cada turno · Si sales de la pantalla, el turno queda protegido." : `${plazo} segundos por carta · El reloj no se para: si sales de la aplicación, la carta se ${cifrasEsta ? "cierra" : "da por fallada"}.`}</p>
        ${rival ? `<div class="solo-stats" style="grid-template-columns:1fr"><span><b>${cifrasEsta ? `${rival.puntos} puntos` : `${rival.hits} de ${duel.total}`}</b><small>la marca de ${escapeHtml(rival.nombre || "quien te reta")}</small></span></div>` : ""}
        <button class="btn btn-primary btn-block duelo-jugar" data-action="duel-play">JUGAR <span>→</span></button>
      </div></section>
    </div>`);
  }

  // La demostración: no explica con palabras lo que se entiende mirando. Es decorativa
  // —las reglas van escritas justo debajo—, así que se esconde del lector de pantalla, y
  // con movimiento reducido se queda quieta en su último fotograma, que ya se entiende.
  function demoMarkup(cifrasEsta) {
    // La demostración es del mazo que se va a jugar, no de uno cualquiera: enseñar
    // «¿Cuántos habitantes?» antes de un duelo de pesos confundía más que ayudaba. Aun
    // así no usa ninguna carta de verdad —eso sería destripar una de las diez—, sino la
    // pregunta del eje y un ejemplo suyo.
    const regla = reglaCifra();
    const eje = currentAxis();
    if (cifrasEsta) {
      return `<div class="demo demo-cifras" aria-hidden="true">
        <div class="demo-carta"><b>Una carta de ${escapeHtml(currentMode().name)}</b><small>${escapeHtml(regla.pregunta || "")}</small></div>
        <div class="demo-reloj"><i></i></div>
        <div class="demo-campo"><span>${escapeHtml(regla.ejemplo || "")}</span></div>
        <div class="demo-premio">+82</div>
      </div>`;
    }
    return `<div class="demo demo-orden" aria-hidden="true">
      <small class="demo-eje">${escapeHtml(eje.timelineTitle)}</small>
      <div class="demo-linea">
        <span class="demo-hito">◂</span>
        <span class="demo-hueco"></span>
        <span class="demo-hito">▸</span>
      </div>
      <span class="demo-mano">${escapeHtml(eje.hiddenLabel)}</span>
      <div class="demo-premio">✓</div>
    </div>`;
  }

  // Tres, dos, uno. La partida no se crea hasta el final, así que el reloj de la primera
  // carta empieza a contar cuando de verdad se ve la carta y no antes.
  function cuentaAtras(arranca) {
    const pasos = ["3", "2", "1", "¡Ya!"];
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    overlay(`<div class="overlay overlay-cuenta"><div class="cuenta" role="status" aria-live="assertive"><b class="cuenta-numero">${pasos[0]}</b></div></div>`);
    announce("Preparados. La partida empieza en tres segundos.");
    let paso = 0;
    const siguiente = () => {
      paso += 1;
      const marca = app.querySelector(".cuenta-numero");
      if (!marca) return;
      if (paso >= pasos.length) { CT.closeDialog?.(); arranca(); return; }
      marca.textContent = pasos[paso];
      // Reiniciar la animación en cada número: sin esto solo se animaría el primero.
      if (!quieto) { marca.style.animation = "none"; void marca.offsetWidth; marca.style.animation = ""; }
      CT.Effects?.transition?.("notice");
      setTimeout(siguiente, Math.round(CT.Duelo.CUENTA_PASO_MS * (paso === pasos.length - 1 ? 0.65 : 1)));
    };
    setTimeout(siguiente, CT.Duelo.CUENTA_PASO_MS);
  }

  function duelPlay() {
    if (!duelPreparado) return duelHome();
    const { modalidad, duel, pace } = duelPreparado;
    duelPreparado = null;
    if (pace === "turnos") {
      turnDuelReady.then(() => CT.TurnDuel?.open({ mode: selectedModeKey, kind: modalidad, back: playMenu }));
      return;
    }
    cuentaAtras(() => (modalidad === "cifras" ? startCifras(duel) : startSolo("duel", duel)));
  }

  // La pantalla a la que se llega desde un enlace de duelo. Dice quién reta, con qué
  // mazo y qué marca hay que batir —pero ninguna carta: la gracia es no saber qué sale—.
  function duelIntro() {
    screen = "duelo-intro";
    const { mode, total, rival, cifras: esCifras } = pendingDuel;
    // Un enlace anterior al reloj se juega sin él: la marca de enfrente se hizo sin plazo
    // y ponérselo solo a quien lo acepta no compararía las mismas dos partidas.
    const conReloj = pendingDuel.ms > 0;
    const juego = CT.mode(mode);
    const quien = rival.nombre || "Alguien";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="back-menu">Volver</button>')}
      <section class="pass-screen"><div class="panel">
        <div class="big-icon">${esCifras ? "⏱️" : "⚔️"}</div>
        <div class="eyebrow">${esCifras ? "Duelo de cifras" : "Duelo"}</div>
        <h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${escapeHtml(quien)} te reta</h1>
        <p class="lead" style="margin-inline:auto">${escapeHtml(juego.name)} · ${total} cartas, las mismas que ha jugado ${escapeHtml(quien)}${esCifras ? `. En cada una escribes la cifra` : " y en el mismo orden"}.</p>
        ${conReloj
          ? `<p class="solo-intro-rule">${Math.round(pendingDuel.ms / 1000)} segundos por carta · El reloj no se para: si sales de la aplicación, la carta se ${esCifras ? "cierra" : "da por fallada"}.</p>`
          : `<p class="solo-intro-rule">Este reto se creó antes de que los duelos llevaran reloj, así que se juega sin plazo, como lo jugó ${escapeHtml(quien)}.</p>`}
        <div class="solo-stats" style="grid-template-columns:1fr"><span><b>${esCifras ? `${rival.puntos} puntos` : `${rival.hits} de ${total}`}</b><small>la marca que hay que batir</small></span></div>
        <div class="field" style="margin-top:16px">
          <label for="duel-name">Tu nombre de perfil</label>
          <input id="duel-name" type="text" readonly aria-readonly="true" value="${escapeHtml(duelName())}">
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" data-action="accept-duel">Aceptar el reto <span>→</span></button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="home">Ahora no</button>
      </div></section>
    </div>`);
  }

  // Un enlace puede llegar cortado al reenviarlo, de una versión con otro mazo, o
  // simplemente mal. Se explica qué ha pasado y se sigue: nunca una excepción ni una
  // pantalla en blanco.
  const DUELO_MOTIVOS = {
    "mazo-distinto": "Este duelo se creó con una versión distinta del mazo, así que las cartas no serían las mismas. Actualizad los dos la aplicación y volved a intentarlo.",
    version: "Este enlace es de una versión más nueva del juego. Actualiza la aplicación para poder jugarlo.",
    mazo: "El enlace menciona un mazo que este juego no tiene.",
    "mazo-cerrado": "Este reto es de un mazo que todavía no es tuyo. Consíguelo y podrás aceptarlo.",
    roto: "El enlace está incompleto o se ha estropeado por el camino. Pide que te lo manden otra vez, entero."
  };

  // Un mazo cerrado no es un enlace estropeado: el reto está perfectamente, lo que falta
  // es el mazo. Por eso lleva su propio título y, si hay precio, la misma salida que la
  // puerta cerrada, que es lo que quien recibe el reto quiere en ese momento.
  function duelInvalido(motivo, modeKey) {
    screen = "duelo-invalido";
    const cerrado = motivo === "mazo-cerrado" && CT.has(modeKey);
    const razon = cerrado ? CT.Cartera.motivo(modeKey) : null;
    paint(`<div class="shell">${header()}
      <section class="pass-screen"><div class="panel">
        <div class="big-icon">${cerrado ? "🔒" : "🔗"}</div>
        <div class="eyebrow">Duelo</div>
        <h1 data-focus tabindex="-1" style="font-size:clamp(1.8rem,7vw,2.8rem)">${cerrado ? "Te falta el mazo" : "Este enlace no vale"}</h1>
        <p class="lead" style="margin-inline:auto">${cerrado ? `El reto es de ${escapeHtml(CT.mode(modeKey).name)}. ${escapeHtml(razon?.texto || "")}` : DUELO_MOTIVOS[motivo] || DUELO_MOTIVOS.roto}</p>
        ${razon?.precio
          ? `<button class="btn btn-primary btn-block" style="margin-top:14px" data-action="mazo-desbloquear" data-paquete="${razon.paquete}" data-mode="${modeKey}">Desbloquear · ${escapeHtml(razon.precio)}</button>
             <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="home">Ir al inicio</button>`
          : `<button class="btn btn-primary btn-block" style="margin-top:14px" data-action="home">Ir al inicio</button>`}
      </div></section>
    </div>`);
  }

  // Aceptar el reto: se cambia al mazo del duelo —puede no ser el que tuvieras abierto—
  // y se reparte con su semilla, que es lo que hace que salgan las mismas cartas.
  function acceptDuel() {
    if (!pendingDuel) return home();
    guardaNombreSiLoHay();
    const duelo = pendingDuel;
    pendingDuel = null;
    if (duelo.mode !== selectedModeKey) setMode(duelo.mode);
    duelReady(duelo.cifras ? "cifras" : "orden", duelo);
  }

  // Un resumen al estilo Wordle: cuenta el resultado sin revelar ninguna carta, así que
  // se puede compartir sin destriparle el reto a quien todavía no lo ha jugado.
  function shareText(modeName, dia, hits, total, sequence, streak) {
    const grid = sequence.map(ok => (ok ? "🟩" : "⬜")).join("");
    const fecha = dia.split("-").reverse().join("/");
    const rachaLinea = streak > 1 ? `\n🔥 racha de ${streak} días` : "";
    return `Continuum · ${modeName} · reto diario ${fecha}\n📊 ${hits}/${total}${rachaLinea}\n${grid}`;
  }

  // Compartir de verdad si el móvil sabe —el menú del sistema, con WhatsApp y demás— y
  // copiar al portapapeles si no. Lo usan el reto diario y el duelo por igual.
  async function compartir(texto, aviso) {
    if (!texto) return;
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch { /* cancelado, se intenta copiar */ }
    }
    try {
      await navigator.clipboard.writeText(texto);
      showToast(aviso);
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
  // La competición se guarda con una clave independiente de las partidas por mazo.
  const ROUND_CARDS = 5;
  // «Gran mezcla temporal» no es un género propio: combina los demás mazos con eje temporal.
  // Un tema de
  // competición que sea «un poco de todo lo anterior» no aporta nada nuevo a la ronda, así
  // que se excluye de la rotación.
  // La rotación sortea temas, así que solo puede sortear los que el jugador tiene. Se
  // calcula al empezar cada competición y no una vez al cargar: entre una y otra puede
  // haber cambiado lo que tiene abierto.
  const compModes = () => Object.keys(CT.MODES).filter(key => key !== "mixed" && CT.Cartera.tiene(key));
  const COMP_MODES = Object.keys(CT.MODES).filter(key => key !== "mixed");
  const TOTAL_TEMAS = COMP_MODES.length;
  let comp = null;
  let previousModeKey = null;

  function soloLabel() {
    if (solo.kind === "daily") return "Reto diario";
    if (solo.kind === "duel") return solo.duelo?.rival ? `Duelo · contra ${solo.duelo.rival.nombre || "quien te reta"}` : "Duelo · tu tirada";
    // El tema no va aquí: lo lleva su propio rótulo encima del marcador, que es lo que
    // recuerda a qué se está jugando cuando el cartel del principio ya se ha ido.
    if (solo.kind === "comp") return `Competición · ${CT.Ghost.level(comp.difficulty).name} · tema ${(comp.totalThemes || TOTAL_TEMAS) - comp.queue.length} de ${comp.totalThemes || TOTAL_TEMAS}`;
    return `Partida libre · ${CT.Ghost.level(solo.difficulty).name}`;
  }

  const COMP_KEY = "continuum-competition-v1";
  function saveCompetition() {
    if (!comp) return;
    comp.saveVersion = CT.Saves.VERSION;
    comp.previousModeKey = previousModeKey;
    comp.solo = solo?.kind === "comp" ? CT.Saves.prepare(solo, solo.mode) : null;
    CT.Storage.setItem(COMP_KEY, JSON.stringify(comp));
  }
  function loadCompetition() {
    const raw = CT.Storage.getItem(COMP_KEY);
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw);
      if (saved.saveVersion !== CT.Saves.VERSION || !Array.isArray(saved.queue) || !Array.isArray(saved.roundsSummary) || !CT.has(saved.previousModeKey) || !CT.Ghost.LEVELS[saved.difficulty] || !saved.decks || !saved.queue.every(key => CT.has(key) && Array.isArray(saved.decks[key]))) throw Error("Formato de competición desconocido");
      saved.cardsPerRound ??= ROUND_CARDS;
      if (!Number.isInteger(saved.cardsPerRound) || saved.cardsPerRound<1 || saved.cardsPerRound>6 || !Array.isArray(saved.totalFailed) || !Number.isInteger(saved.totalHits) || saved.totalHits < 0 || saved.roundsSummary.some(round => !CT.has(round.mode) || !Number.isInteger(round.hits) || round.hits < 0 || round.hits > saved.cardsPerRound || round.total !== saved.cardsPerRound)) throw Error("Marcador inválido");
      if (saved.solo) CT.Saves.validate(saved.solo, saved.solo.mode);
      const themes = [...saved.queue, ...saved.roundsSummary.map(round => round.mode), ...(saved.solo ? [saved.solo.mode] : [])];
      if (!themes.length || new Set(themes).size !== themes.length || (!saved.finished && !saved.solo && !saved.queue.length)) throw Error("Rondas inválidas");
      return saved.finished ? null : saved;
    } catch { CT.Storage.protect(COMP_KEY); return null; }
  }
  function resumeCompetition(confirmed = false) {
    comp = loadCompetition();
    if (!comp) { home(); return; }
    previousModeKey = comp.previousModeKey;
    solo = comp.solo; pendingIndex = null; result = null;
    if (!solo) { compRoundIntro(); return; }
    selectedModeKey = solo.mode;
    if (!confirmed) { compRoundIntro(true); return; }
    cardsById = new Map(solo.savedDeck.map(card => [card.id, card]));
    if (solo.pendingResult) {
      result = { correct: solo.pendingResult.correct, card: cardsById.get(solo.pendingResult.cardId), solo: true };
      soloResult();
    } else soloView();
  }
  function startCompetition() {
    if (loadCompetition()) { resumeCompetition(); return; }
    solo = null;
    previousModeKey = selectedModeKey;
    const temas = compModes();
    comp = { decks: CT.Saves.clone(Object.fromEntries(temas.map(key => [key, CT.cards(key)]))), difficulty: selectedDifficulty, queue: shuffle(temas).slice(0, Number(document.getElementById("competition-length")?.value) || temas.length), roundsSummary: [], totalHits: 0, totalFailed: [] };
    comp.totalThemes = comp.queue.length;
    comp.cardsPerRound = competitionOptions().cards;
    compRoundIntro();
  }

  // El cartel de cada tema: cada ronda sale al azar, así que antes de jugarla la pantalla
  // no dice nada más que a qué se va a jugar. Nada de dificultad, marcador ni número de
  // cartas —eso ya se ve dentro de la partida—: un cartel, un botón y a jugar. No se
  // retira solo; hace falta tocar «Empezar», igual en el primer tema que en los demás.
  function compRoundIntro(resuming = false) {
    screen = "comp-intro";
    const introMode = resuming ? solo.mode : comp.queue[0];
    selectedModeKey = introMode;
    saveCompetition();
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="abandon-comp">Salir</button>')}<section class="pass-screen"><div class="panel pass-card comp-splash">
      <div class="chapter-art" aria-hidden="true">${blockArt(CT.blockOf(introMode).art, true)}</div>
      <div class="chapter-number">Tema ${comp.roundsSummary.length + 1} de ${comp.totalThemes}</div>
      <h2 data-focus tabindex="-1"><span class="comp-splash-lead">${resuming ? "Vas a continuar" : "Vas a jugar a"}</span>${escapeHtml(CT.mode(introMode).name)}</h2>
      <button class="btn btn-block comp-splash-start" data-action="${resuming ? "comp-confirm-resume" : "comp-next-round"}">${resuming ? "Continuar partida" : "Empezar"}</button>
    </div></section></div>`);
  }

  function beginCompRound() {
    const modeKey = comp.queue.shift();
    selectedModeKey = modeKey;
    cardsById = new Map(comp.decks[modeKey].map(card => [card.id, card]));
    const extra = CT.Ghost.level(comp.difficulty).extra;
    const count = comp.cardsPerRound || ROUND_CARDS;
    const barajado = shuffle(comp.decks[modeKey].map(card => card.id)).slice(0, count + 1 + extra * (count - 1));
    const timeline = [barajado.shift()];
    solo = {
      savedDeck: comp.decks[modeKey], kind: "comp", difficulty: comp.difficulty, ghostTurns: comp.difficulty === "hard" ? CT.Ghost.soloSchedule(count) : [], mode: modeKey, timeline, deck: barajado,
      current: barajado.shift(), lives: SOLO_LIVES, hits: 0, played: 0,
      total: count, finished: false, failed: []
    };
    pendingIndex = null;
    result = null;
    saveCompetition();
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
    comp.finished = true;
    saveCompetition();
    selectedModeKey = previousModeKey;
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    const totalCards = comp.roundsSummary.reduce((sum,r)=>sum+r.total,0);
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
    saveCompetition();
    selectedModeKey = previousModeKey;
    cardsById = new Map(CT.cards(selectedModeKey).map(card => [card.id, card]));
    solo = null;
    comp = null;
    home();
  }

  // La guía explica la forma de jugar que se tiene delante. Con una partida en marcha la
  // dice ella; sin partida empezada la dice la pantalla, porque abrir la guía desde el
  // menú del solitario y leer las reglas de una partida entre varios no ayuda a nadie.
  function rules() {
    const returnTo = screen;
    const enSolitario = ["solo-home", "duel-home", "solo", "solo-end", "cifras", "cifras-end", "duelo-intro"].includes(screen);
    const context = comp ? "competition" : solo || enSolitario ? "solo" : "local";
    const modeKey = screen === 'solo' ? solo.mode : CT.UI.isPlaying(screen) ? (game?.mode || selectedModeKey) : selectedModeKey;
    overlay(`<div class="overlay" data-overlay="rules"><div class="modal rules"><div class="guide-tools"><button type="button" class="icon-btn guide-close" data-action="close-rules" aria-label="Cerrar guía">×</button></div><div class="guide-content">${CT.guideMarkup(modeKey, context, { pulse: !!game?.pulse, ghost: game ? !!game.ghost : true })}</div><button class="btn btn-primary btn-block" data-action="close-rules" data-return="${returnTo}">Entendido</button></div></div>`, true);
  }

  function returnFromPlay() {
    if ((screen === 'solo' && solo?.kind === 'comp') || screen === 'comp-intro') {
      saveCompetition(); solo = null; comp = null; competitionMenu(); return;
    }
    if (solo && screen === 'solo') saveSolo();
    else if (game) saveGame();
    result = null; selectedCardId = null; pendingIndex = null;
    if (screen !== 'solo' && game?.tournament) { competitionMenu(); return; }
    if (soloSlot === 'daily' && screen === 'solo') { solo = null; soloSlot = 'mode'; home(); return; }
    if (playReturn === 'setup') setup();
    else if (playReturn === 'duel-home' || solo?.kind === 'duel') duelHome();
    else if (playReturn === 'solo-home' || screen === 'solo') soloHome();
    else if (playReturn === 'duelo-intro') duelIntro();
    else playMenu();
  }
  // La misma salida sin guardar que ya ofrece el menú de la partida (los tres puntos),
  // pero también aquí, en la flecha de volver: es la salida que de verdad se usa más a
  // menudo, así que no debería hacer falta abrir otro menú para encontrarla.
  function requestPlayExit() {
    const discard = screen === 'solo' && solo && solo.kind !== 'comp'
      ? { label: 'Salir sin guardar', proceed: abandonSolo }
      : game && !game.tournament
        ? { label: 'Abandonar partida', proceed: () => { game = null; saveGame(); home(); } }
        : null;
    CT.UI.confirmExit('Tu partida quedará guardada para continuar después.', returnFromPlay, undefined, undefined, discard);
  }
  function uiBack() {
    if (["quick-game","quick-lobby"].includes(screen)) { app.querySelector('[data-quick="exit"]')?.click(); return; }
    if (app.dataset.screen?.startsWith('online-')) { CT.onlineNavigate?.('back'); return; }
    if (CT.UI.isPlaying(screen)) { requestPlayExit(); return; }
    backMenu();
  }
  function soloOptions() {
    // La competición tiene su propio guardado y su propia forma de salir (abandonarla
    // borra el progreso de todas las rondas, no solo del intento actual), así que el
    // botón de salir sin guardar solo aparece fuera de ella.
    const puedeSalirSinGuardar = solo && solo.kind !== "comp";
    overlay(`<div class="overlay"><div class="modal"><h2>Opciones de la partida</h2><div class="actions" style="display:grid">
      <button class="btn btn-primary" data-action="close-menu">Seguir jugando</button>
      <button class="btn btn-secondary" data-action="rules">Guía</button>${CT.settingsButton()}
      <button class="btn btn-secondary" data-action="solo-menu">Guardar y salir</button>
      ${puedeSalirSinGuardar ? '<button class="btn btn-ghost" data-action="abandon-solo">Salir sin guardar</button>' : ''}
    </div></div></div>`, true);
  }

  // Salir sin guardar: se descarta el intento entero, no cuenta para las estadísticas ni
  // para la racha del reto diario, y no deja nada a medias para continuar después.
  function abandonSolo() {
    const eraDuelo = solo?.kind === "duel";
    solo = null;
    saveSolo();
    soloFailedForReview = [];
    result = null;
    pendingIndex = null;
    selectedCardId = null;
    if (soloSlot === "daily") { soloSlot = "mode"; home(); } else if (eraDuelo) duelHome(); else soloHome();
  }
  function gameMenu() {
    overlay(`<div class="overlay"><div class="modal"><h2>Opciones de la partida</h2><div class="actions" style="display:grid"><button class="btn btn-primary" data-action="close-menu">Seguir jugando</button><button class="btn btn-secondary" data-action="rules">Guía</button>${CT.settingsButton()}<button class="btn btn-secondary" data-action="ui-back">Guardar y salir</button><button class="btn btn-ghost" data-action="abandon">Abandonar partida</button></div></div></div>`, true);
  }

  function showToast(message) {
    if (!toast.classList.contains('show') || toast.textContent !== message) CT.Effects.transition('notice');
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
    if (solo) { solo.earnedAchievements = [...(solo.earnedAchievements || []), ...nuevos]; }
    else if (game) { game.earnedAchievements = [...(game.earnedAchievements || []), ...nuevos]; }
    showToast(nuevos.length === 1 ? `Logro: ${nuevos[0].name}` : `${nuevos.length} logros nuevos`);
    announce(nuevos.map(item => `Logro desbloqueado: ${item.name}.`).join(" "));
  }

  function finalMetrics(score,scoreLabel,best,bestLabel,newPlates,achievements) {
    return `<div class="final-metrics"><div class="final-score"><strong>${escapeHtml(score)}</strong><span>${escapeHtml(scoreLabel)}</span></div><div class="final-stat"><small>${escapeHtml(bestLabel)}</small><b>${escapeHtml(best)}</b></div><div class="final-stat"><small>Láminas nuevas</small><b>${Number(newPlates)||0}</b></div><div class="final-stat"><small>Logros</small><b>${Number(achievements)||0}</b></div></div>`;
  }

  function logrosMarkup(nuevos) {
    if (!nuevos || !nuevos.length) return "";
    return `<div class="logros-nuevos" role="status">
      <div class="eyebrow">${nuevos.length === 1 ? "Logro nuevo" : `${nuevos.length} logros nuevos`}</div>
      ${nuevos.map(item => `<div class="logro-chip"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.desc)}</small></div>`).join("")}
    </div>`;
  }

  // A diferencia de `online.js`, no hace falta un `import()` dinámico: no descarga nada
  // de fuera (ni Firebase ni ninguna CDN), así que se carga siempre con el resto de la
  // aplicación, igual que `duelo.js`. `launchLocalMultiplayer` solo entrega el control.
  function launchLocalMultiplayer() {
    CT.LocalMultiplayer.open({ modeKey: selectedModeKey, onBack: playMenu });
  }

  async function launchOnline(roomCode = "", competition = null) {
    screen = "online-loading";
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="spinner"></div><h2 data-focus tabindex="-1">Conectando la sala</h2><p>Preparando el modo multijugador…</p></div></section></div>`);
    try {
      const online = await import("./online.js");
      await online.openOnlineMode({ roomCode, modeKey: selectedModeKey, competition, onBack: competition ? competitionMenu : playMenu });
    } catch (error) {
      console.error(error);
      screen = "online-error";
      paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel"><div class="big-icon">☁</div><h2 data-focus tabindex="-1">No se pudo conectar</h2><p class="lead" style="margin-inline:auto">Comprueba la conexión a internet y vuelve a intentarlo. No se ha borrado ninguna partida guardada.</p><button class="btn btn-primary btn-block" data-action="retry-online">Reintentar conexión</button><button class="btn btn-ghost btn-block" data-action="home">Volver al inicio</button></div></section></div>`);
    }
  }

  // Colocar es la única acción cuyo resultado no se ve en ningún titular: hay que decirlo.
  function anunciaHueco(index, cartas) {
    announce(`Hueco ${index + 1} de ${cartas + 1} elegido. Confirma o elige otro.`);
  }

  app.addEventListener("change", event => {
    if (event.target.id === "enc-mode-select") { openEnciclopedia(event.target.value, { returnTo: encReturn }); return; }
    // Cambiar de modalidad no repinta: repintar cerraría el desplegable que se acaba de
    // abrir para llegar hasta aquí. Se enseña un bloque y se esconde el otro.
    if (event.target.name === "duel-kind" || event.target.name === "duel-pace") {
      const value = event.target.value;
      if (event.target.name === "duel-kind") CT.Storage.setItem(DUEL_KIND_KEY, value);
      else CT.Storage.setItem(DUEL_PACE_KEY, value);
      const selectedKind = event.target.name === "duel-kind" ? value : duelKind();
      const selectedPace = event.target.name === "duel-pace" ? value : duelPace();
      app.querySelectorAll("[data-duel-block]").forEach(bloque => { bloque.hidden = bloque.dataset.duelBlock !== `${selectedPace}-${selectedKind}`; });
      // La pastilla elegida se marca en el propio elemento: el `:has()` del CSS lo haría
      // solo, pero no todos los navegadores en los que se juega esto lo soportan.
      app.querySelectorAll(".segmented-option").forEach(opcion => {
        opcion.classList.toggle("is-on", opcion.querySelector("input").checked);
      });
      return;
    }
    if (event.target.id !== "solo-difficulty") return;
    const key = event.target.value;
    if (!CT.Ghost.LEVELS[key]) return;
    event.target.closest(".difficulty-field").querySelector("[data-difficulty-help]").textContent = CT.Ghost.level(key).description;
    selectedDifficulty = key;
    CT.Storage.setItem("continuum-difficulty-v1", key);
    const record = app.querySelector("[data-level-record]");
    const records = modeRecords();
    if (record) record.textContent = `Mejor marca en ${CT.Ghost.level(key).name}: ${records.bestByDifficulty?.[key] || (key === "easy" ? records.best || 0 : 0)}`;
  });

  app.addEventListener("toggle", event => {
    const deck = event.target;
    if (screen !== "enciclopedia" || encMode !== "all" || !deck.matches?.("[data-enc-deck]") || !deck.open || deck.dataset.loaded) return;
    deck.querySelector(".enc-deck-cards").innerHTML = CT.Enciclopedia.resultsMarkup(deck.dataset.encDeck, CT.Enciclopedia.filterCards(deck.dataset.encDeck, { query: encQuery, lock: encLock }));
    deck.dataset.loaded = "true";
  }, true);

  app.addEventListener("input", event => {
    // El avatar se redibuja con cada letra: así se ve qué personaje sale de cada nombre.
    if (event.target.matches?.("[data-avatar-de]")) {
      const vivo = event.target.closest(".bienvenida, .identidad-modal")?.querySelector("[data-avatar-vivo]");
      if (vivo) vivo.innerHTML = CT.Avatares.markup(event.target.value, { size: vivo.classList.contains("bienvenida-avatar") ? 112 : 88 });
    }
    if (event.target.closest("#players")) { syncStarterOptions(); renderRecentPlayers(); }
    else if (event.target.id === "enc-search-input") {
      // Se actualiza solo el resultado, sin repintar la pantalla entera: repintarla
      // destruiría el campo justo mientras se escribe en él.
      encQuery = event.target.value;
      app.querySelectorAll('.enc-recent, [data-enc-browse-hint]').forEach(element => { element.hidden = !!encQuery.trim(); });
      const all = encMode === "all";
      const cards = all
        ? CT.Enciclopedia.catalogGroups(encQuery, { lock: encLock }).flatMap(group => group.decks.flatMap(deck => deck.cards))
        : CT.Enciclopedia.filterCards(encMode, { query: encQuery, band: encBand, lock: encLock });
      document.getElementById("enc-results").innerHTML = all ? CT.Enciclopedia.catalogMarkup(encQuery, { lock: encLock }) : CT.Enciclopedia.resultsMarkup(encMode, cards, { highlight: encHighlight });
      document.getElementById("enc-count").textContent = encCountText(encMode, cards.length);
    }
  });

  app.addEventListener("change", event => {
    if (event.target.id !== "local-preset") return;
    const advanced = event.target.value === "advanced";
    document.getElementById("ghost-toggle").checked = advanced;
    document.getElementById("pulse-toggle").checked = advanced;
  });
  document.addEventListener("contextmenu", event => {
    if (event.target.closest(".hand-card, .timeline-card, .card-visual, .animal-card-art")) event.preventDefault();
  });
  document.addEventListener("dragstart", event => {
    if (event.target.closest(".hand-card, .timeline-card, .card-visual, .animal-card-art")) event.preventDefault();
  });

  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.dataset.action === "enc-card" && event.target.closest("a")) return;
    const action = target.dataset.action;
    // La tarjeta gira antes de navegar. Con movimiento reducido (o sin forma de
    // saberlo) no hay giro que esperar: se navega en el acto, sin aplazar el clic.
    const sinMovimiento = !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!sinMovimiento && screen === "home" && target.matches(".home-door") &&
        ["daily-start", "jugar", "perfil"].includes(action) &&
        target.dataset.homeTransition !== "done") {
      event.preventDefault();
      target.classList.add("home-door-leaving");
      const delay = 240;
      window.setTimeout(() => {
        app.classList.add("home-transition-enter");
        target.dataset.homeTransition = "done";
        target.click();
        delete target.dataset.homeTransition;
        window.setTimeout(() => app.classList.remove("home-transition-enter"), 520);
      }, delay);
      return;
    }
    if (app.dataset.screen?.startsWith('online-') && ['home-top', 'jugar', 'home-encyclopedia', 'perfil', 'rules'].includes(action)) {
      CT.onlineNavigate?.(action); return;
    }
    if (action === 'quick-challenges') quickChallenges();
    else if (action === 'ui-back') uiBack();
    else if (action === 'solo-options') soloOptions();
    else if (action === "retry-online") launchOnline();
    else if (action === "resume-room") launchOnline(CT.Storage.getItem("continuum-last-room"));
    else if (action === "home") home();
    else if (action === "back-menu") backMenu();
    else if (action === "home-top") { homeDestination = "home"; home(); window.scrollTo({ top: 0, behavior: "instant" }); }
    // La enciclopedia se abre desde el Atlas, y al cerrarla se vuelve a él.
    else if (action === "home-encyclopedia") openEnciclopedia("all", { returnTo: screen === "perfil" ? "perfil" : "home" });
    else if (action === "collection-back") { collectionIndexExpanded = true; jugarSection = "collections"; collectionOpen = true; collectionDetails = true; homeDestination = "collection"; jugarView(); }
    else if (action === "jugar") { jugarSection = null; collectionOpen = false; collectionDetails = false; collectionIndexExpanded = false; jugarView(); window.scrollTo(0, 0); }
    else if (action === "toggle-play-catalog") toggleCatalog(target.dataset.section);
    else if (action === "duels-open") openPendingDuels();
    else if (action === "duels-list") duelsView();
    else if (action === "share-daily-home") shareDailyFromHome();
    else if (action === "set-mode") openMode(target.dataset.mode);
    else if (action === "mazo-desbloquear") tiendaSimulada(target.dataset.paquete, target.dataset.mode);
    else if (action === "compra-simular") {
      const modeKey = target.dataset.mode;
      const comprado = CT.Cartera.compraSimulada(target.dataset.paquete);
      CT.closeDialog();
      if (!comprado) return showToast("No se ha podido simular la compra");
      showToast("Compra simulada: ya es tuyo");
      if (CT.has(modeKey)) openMode(modeKey); else home();
    }
    else if (action === "set-block") {
      const open = !(collectionOpen && target.dataset.block === selectedBlockKey);
      setBlock(target.dataset.block);
      collectionIndexExpanded = true;
      jugarSection = "collections";
      homeDestination = "collection";
      collectionOpen = open;
      collectionDetails = open;
      app.querySelectorAll("#deck-collection .collection-entry").forEach(entry => {
        const button = entry.querySelector(".gallery-panel");
        const active = open && button.dataset.block === selectedBlockKey;
        const drawer = entry.querySelector(".collection-drawer");
        if (active) drawer.firstElementChild.innerHTML = `<div class="collection-decks"><p class="lead">Elige tu mazo</p>${gameList()}</div>`;
        void drawer.offsetHeight;
        entry.classList.toggle("active", active);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-expanded", String(active));
        button.setAttribute("aria-label", `${CT.block(button.dataset.block).name}. ${active ? "Mazos visibles debajo." : "Toca para ver sus mazos."}`);
        drawer.inert = !active;
      });
      rememberView();
    }
    else if (action === "home-new") { game = null; saveGame(); home(); }
    else if (action === "toggle-format-block") { formatOpen = formatOpen === target.dataset.format ? null : target.dataset.format; CT.Effects.transition(formatOpen ? 'expand' : 'close'); if(screen==='competition-menu') {competitionOptions();competitionMenu();} else playMenu(); }
    else if (action === "competition-menu") { formatOpen=null;competitionMenu(); }
    else if (action === "setup") { pendingTournament=null;setup(); }
    else if (action === "competition-local") prepareMultiCompetition();
    else if (action === "competition-online") launchOnline('',competitionOptions());
    else if (action === "competition-next") nextTournamentRound();
    else if (action === "competition-resume") resumeMultiCompetition();
    else if (action === "competition-round-start") { game.tournamentIntro = false; saveGame(); renderPass(); }
    else if (action === "online") launchOnline();
    else if (action === "local-multiplayer") launchLocalMultiplayer();
    // Una partida guardada a mitad de un duelo vuelve a su pantalla de paso, no a la de
    // un turno normal: si volviera a esa, quien reta colocaría su carta por segunda vez.
    else if (action === "continue") { cardsById = new Map(game.savedDeck.map(card => [card.id, card])); game.winners ? renderWinner(game.players.filter(p => game.winners.includes(p.id))) : pulseStage() === PULSE_PASE ? renderPulsePass() : renderPass(); }
    else if (action === "add-player") {
      appendPlayer();
    } else if (action === "add-recent-player") {
      const name = decodeURIComponent(target.dataset.recentName || "");
      const active = [...document.querySelectorAll("#players input")].map(input => CT.RecentPlayers.identity(input.value));
      if (active.includes(CT.RecentPlayers.identity(name))) return showToast("Ese jugador ya está añadido");
      appendPlayer(name);
    } else if (action === "remove-recent-player") {
      CT.RecentPlayers.remove(decodeURIComponent(target.dataset.recentName || ""));
      renderRecentPlayers();
    } else if (action === "clear-recent-players") {
      CT.RecentPlayers.clear();
      renderRecentPlayers();
    } else if (action === "remove-player") {
      if (document.querySelectorAll("#players .player-row").length <= 2) return showToast("Se necesitan al menos 2 jugadores");
      target.closest(".player-row").remove(); syncStarterOptions(); renderRecentPlayers();
    } else if (action === "draw-starter") beginStarterDraw();
    else if (action === "starter-guess-submit") starterGuessSubmit();
    else if (action === "start") startGame();
    else if (action === "ready") { if (game.pulseGift && game.pulseGift.to === currentPlayer().id) { game.pulseGift = null; saveGame(); } if (game.pendingResult) { result = game.pendingResult; renderResult(); } else gameView(); }
    else if (action === "ghost-use") useGhost();
    else if (action === "select-card") {
      selectedCardId = Number(target.dataset.id);
      pendingIndex = null;
      announce(`Elegida la carta ${cardsById.get(selectedCardId).title}. Ahora elige un hueco.`);
      gameView();
    }
    else if (action === "place") { pendingIndex = Number(target.dataset.index); anunciaHueco(pendingIndex, game.timeline.length); gameView(); }
    else if (action === "confirm-place") { screen === "solo" ? soloPlace(pendingIndex) : game.pulseTurn ? (pulseStage() === PULSE_DEFENSA ? placePulseDefense(pendingIndex) : placePulse(pendingIndex)) : placeCard(pendingIndex); }
    else if (action === "cancel-place") { pendingIndex = null; screen === "solo" ? soloView() : gameView(); }
    else if (action === "finish-turn") finishTurn();
    else if (action === "final-ready") renderFinalPass(true);
    else if (action === "final-next") nextLocalFinal();
    else if (action === "solo") soloHome();
    else if (action === "duel-home") duelHome();
    else if (action === "start-free") startSolo("free");
    // Vale tanto para estrenar un duelo como para devolver uno recién jugado: en los dos
    // casos es una semilla nueva, así que nadie repite cartas que ya conoce.
    // El campo del nombre solo está donde se pide. Al devolver un reto desde el cara a
    // cara no lo hay, y guardar lo que devuelve un elemento inexistente borraría el
    // nombre que ya tenías puesto.
    else if (action === "start-duel") { guardaNombreSiLoHay(); duelReady("orden"); }
    // El duelo de cifras se estrena igual, y «Devolver el reto» pasa por aquí desde el
    // cara a cara, donde el campo del nombre no existe y no hay nada que guardar.
    else if (action === "start-cifras") { guardaNombreSiLoHay(); duelReady("cifras"); }
    else if (action === "start-turn-duel") { guardaNombreSiLoHay(); duelReady(duelKind(), null, "turnos"); }
    else if (action === "open-turn-duel") { const back = screen === "duelos" ? duelsView : perfilView; turnDuelReady.then(() => CT.TurnDuel?.open({ gameId: target.dataset.turnId, back })); }
    else if (action === 'next-turn-duel') { const back = screen === "duelos" ? duelsView : perfilView; turnDuelReady.then(() => CT.TurnDuel.next(back)).catch(() => showToast('No se pudieron consultar tus duelos.')); }
    else if (action === 'favorite-duel-rival') { CT.TurnDuel.favorite(target.dataset.rivalId); duelsRefresh(); }
    else if (action === 'rematch-turn-duel') { target.disabled = true; const back = screen === "duelos" ? duelsView : perfilView; turnDuelReady.then(() => CT.TurnDuel.challenge(target.dataset.turnId, back)).catch(() => showToast('No se pudo enviar la invitación.')).finally(() => { target.disabled = false; }); }
    else if (action === "close-turn-duel") {
      if (!window.confirm(target.dataset.playing === 'true' ? '¿Rendirte? Tu rival ganará esta partida. Se conservará en el historial.' : '¿Cancelar esta invitación? No contará como derrota.')) return;
      target.disabled = true;
      turnDuelReady.then(() => CT.TurnDuel.cancel(target.dataset.turnId, target.dataset.playing === 'true' ? 'playing' : 'waiting')).then(() => { showToast('Partida actualizada'); duelsRefresh(); }).catch(() => { target.disabled = false; showToast('No se pudo actualizar el duelo. Puede haber cambiado: vuelve a abrir la lista.'); });
    }
    else if (action === 'archive-turn-duel') {
      target.disabled = true;
      CT.TurnDuel.archive(target.dataset.turnId, target.dataset.restore === 'true').then(duelsRefresh).catch(() => { target.disabled = false; showToast('No se pudo cambiar el archivo.'); });
    }
    else if (action === 'reshare-turn-duel') { CT.TurnDuel.reshare(target.dataset.turnId).catch(() => showToast('No se pudo compartir el enlace.')); }
    else if (action === 'block-duel-rival' || action === 'unblock-duel-rival') {
      const unblock = action === 'unblock-duel-rival';
      if (!unblock && !window.confirm('¿Bloquear los retos de este rival? No cancela las partidas en curso. Puedes deshacerlo desde tu perfil.')) return;
      target.disabled = true;
      CT.TurnDuel.block(target.dataset.rivalId, target.dataset.rivalName, unblock).then(duelsRefresh).catch(() => { target.disabled = false; showToast('No se pudo cambiar el bloqueo.'); });
    }
    else if (action === "duel-play") duelPlay();
    else if (action === "resume-cifras") resumeCifras();
    else if (action === "cifra-answer") cierraCarta("respuesta");
    else if (action === "cifras-next") cifrasNext();
    else if (action === "cifras-exit") CT.UI.confirmExit("La carta que tengas abierta se cerrará: el reloj no se para.", () => { paraReloj(); if (cifras) { guardaCifras(); cifras = null; } duelHome(); });
    else if (action === "accept-duel") acceptDuel();
    else if (action === "share-duel") compartir(lastDuelShare, "Enlace copiado");
    else if (action === "resume-solo") resumeSolo();
    else if (action === "daily-start") startDaily();
    else if (action === "daily-play") playDaily();
    else if (action === "identidad-nombre") editaNombre();
    else if (action === "solo-place") { pendingIndex = Number(target.dataset.index); anunciaHueco(pendingIndex, solo.timeline.length); soloView(); }
    else if (action === "solo-next") soloNext();
    else if (action === "solo-menu") requestPlayExit();
    else if (action === "rules") rules();
    else if (action === "close-rules") CT.closeDialog();
    else if (action === "game-menu") gameMenu();
    else if (action === "close-menu") CT.closeDialog();
    else if (action === "abandon") CT.UI.confirmExit('Se borrará la partida actual. Esta acción no se puede deshacer.', () => { game = null; saveGame(); home(); }, '¿Abandonar partida?', 'Abandonar');
    else if (action === "abandon-solo") CT.UI.confirmExit('Se borrará el intento actual y no contará en las estadísticas ni en la racha. Esta acción no se puede deshacer.', abandonSolo, '¿Salir sin guardar?', 'Salir sin guardar');
    else if (action === "pulse-open") pulseTargetMenu();
    else if (action === "pulse-defend") { game.pulseTurn.stage = PULSE_DEFENSA; pendingIndex = null; saveGame(); gameView(); }
    else if (action === "pulse-target") { CT.closeDialog(); startPulse(Number(target.dataset.target)); }
    else if (action === "pulse-place") { pendingIndex = Number(target.dataset.index); anunciaHueco(pendingIndex, game.timeline.length); gameView(); }
    else if (action === "review-game") reviewScreen((game.failed || []).map(id => ({ id, mode: game.mode })), `<button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button>`);
    else if (action === "review-timeline") timelineReviewScreen(game.timeline, game.mode, `<button class="btn btn-primary" data-action="setup">Otra partida</button><button class="btn btn-secondary" data-action="home-new">Ir al inicio</button>`);
    else if (action === "review-solo") reviewScreen(soloFailedForReview, `<button class="btn btn-primary" data-action="solo">Volver a solitario</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button>`);
    else if (action === "share-daily") compartir(lastShareText, "Resultado copiado");
    else if (action === "review-comp") reviewScreen(comp.totalFailed, `<button class="btn btn-primary" data-action="start-competition">Jugar otra vez</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button>`);
    else if (action === "resume-competition") resumeCompetition();
    else if (action === "start-competition") startCompetition();
    else if (action === "comp-next-round") beginCompRound();
    else if (action === "comp-confirm-resume") resumeCompetition(true);
    else if (action === "abandon-comp") requestPlayExit();
    else if (action === "enciclopedia") openEnciclopedia(selectedModeKey, { returnTo: "play-menu" });
    else if (action === "enc-view") openEnciclopedia(target.dataset.mode, { highlight: Number(target.dataset.id), returnTo: ["review", "timeline-review"].includes(screen) ? "review" : "perfil" });
    else if (action === "enc-card") openEnciclopediaCard(target.dataset.mode, target.dataset.id);
    else if (action === "enc-image") openEnciclopediaImage(target.dataset.mode, target.dataset.id);
    else if (action === "enc-card-close") CT.closeDialog();
    else if (action === "enc-band-view") openEnciclopedia(target.dataset.mode, { band: target.dataset.band, returnTo: "perfil" });
    else if (action === "enc-band") { encBand = target.dataset.band; enciclopediaView(); }
    else if (action === "enc-lock") { encLock = ["all", "seen", "locked"].includes(target.dataset.lock) ? target.dataset.lock : "all"; enciclopediaView(); }
    else if (action === "enc-close") CT.closeDialog();
    else if (action === "enc-back") CT.closeDialog();
    else if (action === "perfil") perfilView();
    else if (action === "perfil-export") perfilExport();
    else if (action === "perfil-import" && !CT.Accounts) perfilImport();
    else if (action === "perfil-reset" && !CT.Accounts) perfilResetMenu();
    else if (action === "perfil-reset-confirm" && !CT.Accounts) { CT.Progreso.reset(); CT.closeDialog(); showToast("Perfil borrado"); perfilView(); }
  });

  // Los dos formularios de nombre (bienvenida y Atlas) se envían con Intro igual que con
  // el botón.
  app.addEventListener("submit", event => {
    const form = event.target.closest("[data-bienvenida], [data-identidad]");
    if (!form) return;
    event.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    if (form.dataset.bienvenida) bienvenidaNombreEnviado(boton); else nombreEditado(boton);
  });

  app.addEventListener("keydown", event => {
    if ((event.key !== "Enter" && event.key !== " ") || event.target.dataset.action !== "enc-card") return;
    event.preventDefault();
    event.target.click();
  });

  CT.localNavigate = action => {
    if (action === 'home-encyclopedia') openEnciclopedia('all');
    else if (action === 'perfil') perfilView();
    else if (action === 'daily') { CT.closeDialog(); startDaily(); }
    else if (action === 'jugar') jugarView();
    else { homeDestination = 'home'; home(); window.scrollTo(0, 0); }
  };
  CT.isSessionActive = () => ["pass", "game", "pulse-pass", "final-local", "solo", "cifras", "comp-intro", "quick-game", "quick-lobby"].includes(screen) || !!CT.onlineActive;
  CT.Updates.start();
  // El botón/gesto Atrás de Android: `window.Capacitor` solo existe dentro del contenedor
  // nativo (Capacitor lo inyecta al arrancar la WebView), así que esto no toca la versión
  // web ni iOS, que no lo tienen. Un diálogo abierto se cierra como con Escape; una partida
  // en curso pregunta antes de abandonarla, igual que el resto del juego; cualquier otra
  // pantalla recupera su menú anterior; desde el inicio, el gesto cierra la aplicación.
  if (window.Capacitor?.isNativePlatform?.()) {
    const nativeApp = window.Capacitor.registerPlugin?.('App') || window.Capacitor.Plugins?.App;
    nativeApp?.addListener?.("backButton", () => {
      if (CT.backPressed()) return;
      if (app.dataset.screen?.startsWith('online-') || CT.UI.isPlaying(screen)) { uiBack(); return; }
      if (screen !== "home") { backMenu(); return; }
      nativeApp.exitApp();
    });
  }
  // Y deslizar de izquierda a derecha hace lo mismo que el botón «Volver» de la pantalla,
  // en todas las versiones: web, Android e iOS. Cuándo un movimiento del dedo cuenta como
  // «atrás» lo decide swipe.js; a dónde se vuelve, esto:
  //
  // - Con un diálogo descartable encima (la guía, los ajustes, la enciclopedia) se cierra,
  //   igual que con Escape o con el botón Atrás. Un paso obligado de la jugada se queda
  //   donde está y se come el gesto, que para eso `backPressed` devuelve `true`.
  // - Dentro de una partida no navega. Un deslizamiento se puede hacer sin querer mirando
  //   la mesa, y abandonar una partida no puede depender de eso: ahí se sale por el menú
  //   de la partida, que pregunta primero, como hasta ahora.
  // - El modo de varios móviles pinta sus propias pantallas y sabe cómo salir de una sala,
  //   así que el gesto pulsa su salida en vez de repintar por encima de la sala.
  // - Desde el inicio no hay nada detrás: el gesto no hace nada. Cerrar la aplicación sigue
  //   siendo cosa del botón Atrás de Android y de nadie más.
  // La llamada es opcional a propósito: el service worker sirve cada archivo de su propia
  // copia, así que en el primer arranque tras una actualización puede convivir este `app.js`
  // nuevo con un `index.html` viejo que todavía no carga `swipe.js`. Sin gesto se sigue
  // jugando; con una excepción aquí, la aplicación no arrancaría.
  CT.enableSwipeBack?.(() => {
    if (CT.backPressed()) return;
    if (CT.isSessionActive()) return;
    // La pantalla la manda el DOM y no la variable local: durante una sala es online.js
    // quien pinta, y `screen` se quedó en la última pantalla que pintó este archivo.
    if ((app.dataset.screen || screen) === "home") return;
    const salidaOnline = app.querySelector('[data-online-action="back"]');
    if (salidaOnline) { salidaOnline.click(); return; }
    backMenu();
  });
  // Qué mazos tiene abiertos quien juega lo decide `CT.Cartera.arranque()`, que ya se ha
  // ejecutado al cargarse `cartera.js`: este archivo necesita saberlo antes de elegir el
  // mazo de la última partida, mucho antes de llegar hasta aquí. El día que haya tienda,
  // es en `arranque` donde se le pregunta a Apple o a Google qué tiene comprado esta
  // cuenta. El resto del juego ya pregunta a la cartera.

  // Dos maneras de entrar por enlace: la invitación a una sala, que necesita conexión, y
  // el reto de un duelo, que no necesita nada porque el enlace ya lo lleva todo dentro.
  CT.Links.start(target => {
    if (CT.isSessionActive() && !confirm('¿Abrir la invitación? Tu partida local quedará guardada.')) return;
    if (target.room) launchOnline(target.room);
    else if (target.turnDuel) turnDuelReady.then(() => CT.TurnDuel?.open({ gameId: target.turnDuel, mode: selectedModeKey, back: home }));
    else { const value = CT.Duelo.descodificar(target.duelo); if (value.ok) { pendingDuel = value.duelo; duelIntro(); } else duelInvalido(value.motivo, value.mode); }
  });
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  const invitedRoom = params.get("room") || "";
  const duelPayload = params.get("duelo") || "";
  const turnDuelId = params.get("turnoduelo") || "";
  if (params.has("quick-room") || params.has("quick-duel")) quickChallenges();
  else if (invitedRoom) launchOnline(invitedRoom);
  else if (turnDuelId) turnDuelReady.then(() => CT.TurnDuel?.open({ gameId: turnDuelId, mode: selectedModeKey, back: home }));
  else if (duelPayload) {
    const leido = CT.Duelo.descodificar(duelPayload);
    if (leido.ok) { pendingDuel = leido.duelo; duelIntro(); }
    else duelInvalido(leido.motivo, leido.mode);
  } else if (!CT.Identidad.reconoce()) bienvenida();
  else if (!restoreView()) home();
})();
