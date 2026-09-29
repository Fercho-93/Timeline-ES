// El modo "Sin conexión": varias personas juegan en la misma sala sin ningún tipo de
// internet, por Wi-Fi local (un móvil crea el punto de acceso, el resto se une como a
// cualquier red). Reutiliza exactamente la lógica de `local-room.js` y el canal de
// `local-transport.js` a través de `local-session.js`; este archivo solo pinta las
// pantallas y traduce los toques en acciones, con las mismas clases CSS que ya usa
// `online.js` para la sala compartida (`.panel`, `.online-form`, `.room-code-card`,
// `.lobby-table`, `.timeline-card`, `.hand-card`…) — es la misma mesa, sin Firestore.
//
// Las reglas son las de la sala online (ver `local-room.js`): minijuego de quién empieza
// con la mesa por orden de cercanía, final secreta si varias personas terminan a la vez,
// Pulso y Fantasma opcionales, límite de tiempo por turno y revancha. Lo propio de aquí:
// quien pierde la conexión conserva su plaza y sus cartas, y vuelve a sentarse
// escaneando una invitación nueva del anfitrión. Sin torneo.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const { escapeHtml, shuffle } = CT;
  const appEl = document.getElementById("app");
  const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const BACK_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7M7 12h14"/></svg>';
  const SHARE_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>';
  const WIFI_ICON = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M8.5 16a6 6 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/></svg>';
  const CAMERA_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="3.5"/></svg>';

  let onBackToMenu = null;
  let modeKey = "history";
  let directJoin = false;
  let screen = "";
  let role = null; // 'host' | 'guest'
  let hostSession = null, guestSession = null;
  let roomState = null;
  let myName = "", myPlayerId = "";
  // Quien crea la sala no tiene identificador propio: es el anfitrión de la sala.
  const esMio = uid => uid === myPlayerId || (role === "host" && uid === roomState?.hostId);
  let pendingInvite = null; // { peerId, offerSignal, acceptAnswer, inviteText }
  let pendingAnswerText = "";
  let selectedCardId = null, pendingIndex = null;
  let busy = false;
  let cardsByIdCache = new Map();
  // Reloj del turno. El anfitrión manda con su propio reloj (`turnStartedAt`); cada
  // invitado cuenta desde que recibe el turno, para no depender de que los relojes de los
  // móviles coincidan — en la misma Wi-Fi el mensaje tarda milésimas.
  let turnTimerHandle = null, turnSeenKey = "", turnSeenAt = 0;

  // Leer un código con la cámara es la única pantalla de QR que necesita navegación
  // propia (mostrar uno se pinta directamente donde haga falta, ver más abajo).
  // `cameraHandle` es la cámara abierta en vivo: hay que cerrarla en cuanto se deja esa
  // pantalla — el `paint` de más abajo lo hace solo con que la pantalla destino no sea la
  // suya.
  let qrScanTitle = "", qrScanHint = "", qrScanOnResult = null, qrScanOnBack = null;
  let cameraHandle = null;

  function showToast(message) {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  function stopCamera() { cameraHandle?.stop(); cameraHandle = null; }

  function paint(html, pantalla) {
    if (pantalla !== "local-qr-scan") stopCamera();
    if (pantalla !== "local-cercanas") stopNearbySearch();
    if (pantalla !== "local-game") clearTurnTimer();
    CT.paint(appEl, html, pantalla);
  }

  function ownName() { return escapeHtml(CT.Identidad?.propio?.() || ""); }

  // Cuando Android e iPhone no comparten ningún destino en la hoja de compartir del
  // sistema, queda copiar el texto a mano. Si el portapapeles tampoco está disponible, el
  // propio cuadro de texto de la pantalla es de solo lectura y se selecciona al tocarlo,
  // así que la persona puede copiarlo con el gesto normal del móvil de todos modos.
  function copyToClipboard(text, successMessage) {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(successMessage)).catch(() => showToast("Selecciona el texto y cópialo a mano"));
    } else showToast("Selecciona el texto y cópialo a mano");
  }

  function header(backAction, actionsHtml = "") {
    return `<header class="topbar"><button class="icon-btn" data-local-action="${backAction}" aria-label="Volver">${BACK_ICON}</button><div class="brand">Continuum</div><div class="topbar-actions"><i data-sound-slot></i>${actionsHtml}</div></header>`;
  }

  function wifiNote() {
    return `<div class="wifi-note">${WIFI_ICON}<p><strong>Antes de empezar:</strong> uno de los móviles activa su punto de acceso Wi-Fi (mejor si es Android) y el resto se une a esa red — no hace falta que tenga internet.</p></div>`;
  }

  // El permiso de la cámara hay que pedirlo aquí, al entrar, no cuando ya haga falta
  // escanear: para entonces puede que no quede conexión y, si el navegador lo denegó,
  // no hay manera cómoda de ir a activarlo a mano en mitad de la partida. Pedirlo ahora,
  // con la pantalla explicando por qué, dispara el aviso del sistema mientras todavía se
  // puede arreglar sin prisas.
  function cameraNote() {
    return `<div class="wifi-note">${CAMERA_ICON}<p><strong>Hace falta la cámara</strong> para leer los códigos QR entre los móviles cuando no compartáis ningún otro canal. Actívala ahora — si esperas a necesitarla, puede que ya no tengas cómo arreglarlo.</p><button type="button" class="btn btn-secondary" data-local-action="warm-camera">Activar la cámara</button></div>`;
  }

  async function warmUpCamera() {
    if (!CT.QrScanner.isSupported()) { showToast("Este navegador no permite usar la cámara aquí."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.getTracks().forEach(track => track.stop());
      showToast("Cámara activada. Ya puedes escanear códigos QR sin conexión.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo activar la cámara. Revisa los permisos del navegador o del sistema.");
    }
  }

  function createRoomCode() {
    const values = new Uint32Array(8);
    crypto.getRandomValues(values);
    return [...values].map(value => ROOM_CHARS[value % ROOM_CHARS.length]).join("");
  }

  function randomPlayerId() {
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return [...values].map(v => v.toString(36)).join("");
  }

  // Traduce en una sola frase lo que el reductor de la sala (`local-room.js`) o el
  // transporte (`local-transport.js`) señalan con un código corto en inglés.
  function errorMessage(code) {
    const map = {
      NOT_HOST: "Solo quien organiza la sala puede hacer eso",
      INVALID_START: "Hacen falta al menos dos personas para empezar",
      INVALID_ROOM: "No se pudo crear la sala",
      ROOM_FULL: "La sala ya tiene el máximo de participantes",
      ALREADY_STARTED: "La partida ya ha comenzado",
      DECK_MISMATCH: "Alguien lleva una versión distinta del juego. Actualizad todos los móviles y cread una sala nueva.",
      NOT_TURN: "Todavía no es tu turno",
      NOT_ALLOWED: "Esa acción no se puede hacer ahora",
      HOST: "Quien organiza la sala no puede salir: cierra la sala",
      STARTER_PENDING: "Antes de empezar, todos tienen que responder al minijuego de quién empieza",
      SEAT_TAKEN: "Esa plaza ya está ocupada por alguien conectado",
      WEBRTC_UNAVAILABLE: "Este navegador no admite conexiones directas entre móviles",
      UNKNOWN_ACTION: "No se ha entendido la acción",
      EMPTY_SIGNAL: "Pega primero el código que te han compartido",
      INVALID_SIGNAL: "Ese código no es válido. Pídelo otra vez.",
      INVALID_INVITE: "Ese código no es válido. Pídelo otra vez."
    };
    return map[code] || "No se pudo completar la acción";
  }

  // La invitación completa: la señal WebRTC del anfitrión más los datos de la sala que el
  // invitado todavía no conoce (código, modalidad, huella del mazo). La respuesta del
  // invitado no necesita nada de esto — el anfitrión ya sabe en qué sala está — así que
  // esa viaja tal cual, sin envolver.
  //
  // Sin el paso extra por base64 que llevaba antes: todos los campos ya son texto seguro
  // (letras, dígitos, puntos) generado por la propia aplicación, nunca escrito a mano por
  // quien juega, así que el JSON en crudo no necesita esa envoltura — algo menos que
  // meter en el código QR de la invitación (`qr-encode.js`).
  function encodeInvite(data) { return "CTM1:" + JSON.stringify(data); }
  function decodeInvite(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed.startsWith("CTM1:")) throw new Error("INVALID_INVITE");
    let data;
    try { data = JSON.parse(trimmed.slice(5)); }
    catch { throw new Error("INVALID_INVITE"); }
    if (!data || typeof data.signal !== "string" || typeof data.roomCode !== "string") throw new Error("INVALID_INVITE");
    return data;
  }

  function cardsById() {
    let map = cardsByIdCache.get(modeKey);
    if (!map) { map = new Map(CT.cards(modeKey).map(card => [card.id, card])); cardsByIdCache.set(modeKey, map); }
    return map;
  }
  function getCard(id) { return cardsById().get(id); }
  function formatValue(card) { return CT.formatValue(modeKey, card); }
  function eraForCard(card) { return CT.eraForCard(modeKey, card); }
  function categoryBadge(card) { return CT.categoryBadge(modeKey, card); }
  function usesAnimalArt() { return CT.usesAnimalArt(modeKey); }
  function animalArt(card) { return CT.animalArt(modeKey, card); }
  function cardBack() { return CT.cardBack(modeKey); }
  function hiddenLabel() { return CT.hiddenLabel(modeKey); }
  function timelineTitle() { return CT.timelineTitle(modeKey); }
  function boardQuestion() {
    const axis = CT.axis(modeKey);
    return `<section class="board-question" aria-label="Criterio de orden"><h2>¿Dónde encaja?</h2><div class="board-axis">Ordena por <strong>${escapeHtml(axis.orderLabel)}</strong></div><p>${escapeHtml(axis.question)} Coloca la carta en la posición correcta.</p></section>`;
  }
  function playerProgress(handLength) {
    const players = roomState.playerOrder.map(uid => roomState.players[uid]);
    const largestHand = Math.max(1, ...players.map(player => player.hand.length));
    return Math.round(Math.max(12, Math.min(100, ((largestHand - handLength + 1) / (largestHand + 1)) * 100)));
  }

  // También hay que reaccionar desde "invitar" (anfitrión) y "comparte tu respuesta"
  // (invitado): son las pantallas donde cada cual espera a que la conexión cuaje. Sin
  // esto, aunque la sala ya estuviera lista, ninguno de los dos se enteraba y se quedaban
  // mirando "Conectando…" para siempre — había que salir y volver a mano al vestíbulo.
  function onRoomChange(room) {
    // Un invitado que ya no figura en la mesa (lo han expulsado o se ha marchado) no puede
    // pintar una partida de la que no forma parte: vuelve a la entrada con un aviso.
    if (role === "guest" && room && !room.playerOrder.includes(myPlayerId)) {
      leaveToEntrada("Ya no estás en esta sala");
      return;
    }
    const previous = roomState;
    roomState = room;
    if (previous?.phase !== room.phase || previous?.status !== room.status) renderGame.revelando = false;
    if (role === "guest") rememberSeat();
    if (["local-lobby", "local-game", "local-invitar", "local-unirse-compartir", "local-cercanas", "local-final", "local-final-secreta"].includes(screen)) renderCurrent();
  }

  // El canal con el anfitrión se ha caído: cerró la sala, se quedó sin batería o salió de
  // la Wi-Fi. A mitad de partida la plaza sigue guardada en el móvil del anfitrión, así
  // que se ofrece volver a sentarse; en la sala de espera o con la partida acabada, no hay
  // nada que recuperar.
  function onGuestDisconnect() {
    if (role !== "guest" || !guestSession) return;
    if (roomState?.status === "playing") {
      rememberSeat();
      guestSession = null; role = null; roomState = null;
      CT.closeDialog?.();
      renderDisconnected();
      return;
    }
    leaveToEntrada(roomState?.status === "ended" ? "La sala se ha cerrado" : "Se ha perdido la conexión con la sala");
  }

  function renderCurrent() {
    if (!roomState) return;
    if (roomState.status === "playing" || roomState.status === "ended") renderGame();
    else renderLobby();
  }

  // ---------------------------------------------------------------------------
  // Entrada
  function open(options = {}) {
    stopCamera();
    onBackToMenu = typeof options.onBack === "function" ? options.onBack : null;
    modeKey = CT.has(options.modeKey) ? options.modeKey : CT.DEFAULT_MODE;
    role = null; hostSession = null; guestSession = null; roomState = null; myPlayerId = "";
    pendingInvite = null; pendingAnswerText = ""; selectedCardId = null; pendingIndex = null;
    cardsByIdCache = new Map();
    // «Unirme a una sala» desde el menú de Wi-Fi local: no hay mazo elegido, el de la
    // invitación manda. Se salta la entrada y se pasa directo a escanear.
    directJoin = !!options.join;
    if (directJoin) renderUnirseForm(); else renderEntrada();
  }

  function renderEntrada() {
    screen = "local-entrada";
    paint(`<div class="shell online-shell">${header("back")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${escapeHtml(CT.mode(modeKey).name)}</div><h2 data-focus tabindex="-1">Una mesa,<br>varias pantallas — sin internet</h2><p class="lead">Cada persona juega desde su móvil, conectadas por Wi-Fi local, sin ninguna conexión a internet.</p></section>
      ${wifiNote()}
      ${cameraNote()}
      <div class="online-entry-grid">
        <div class="panel online-form"><span class="form-number">01</span><h3>Unirse a una sala</h3><p>Alguien ya ha creado una y te ha pasado su código.</p><button type="button" class="btn btn-primary btn-block" data-local-action="go-unirse">Unirme a la partida <span>→</span></button></div>
        <form class="panel online-form" data-local-form="create"><span class="form-number">02</span><h3>Crear una sala</h3><p>Tú preparas la partida y compartes el código.</p><div class="field"><label for="local-name-host">Tu nombre</label><input id="local-name-host" name="name" maxlength="18" required placeholder="Ej. Fernando" autocomplete="name" value="${ownName()}"></div><button class="btn btn-secondary btn-block" type="submit">Crear sala</button></form>
      </div>
      <p class="online-note">No necesita conexión a internet en ningún momento.</p>
    </div>`, "local-entrada");
  }

  function doCreateRoom(name) {
    role = "host";
    myName = name;
    myPlayerId = CT.LocalSession.HOST_ID;
    const roomCode = createRoomCode();
    try {
      hostSession = CT.LocalSession.createHostSession({
        roomCode, hostName: name, avatarId: CT.Avatares.ownId(), modeKey,
        deckFingerprint: CT.deckFingerprint(modeKey),
        onChange: onRoomChange,
        onPeerLost: (lostName, playing) => showToast(playing
          ? `${lostName || "Alguien"} se ha desconectado: conserva su plaza y sus turnos se saltan. Invítale otra vez desde el menú.`
          : `${lostName || "Alguien"} se ha desconectado y sale de la mesa`),
        onPeerBack: backName => showToast(`${backName || "Alguien"} ha vuelto a su plaza`)
      });
    } catch (error) { console.error(error); showToast("No se pudo crear la sala"); return; }
    roomState = hostSession.currentRoom();
    renderLobby();
  }

  // Escanear con la cámara es el camino normal — un único código, una única lectura — y
  // pegarlo a mano queda como recurso para cuando la cámara no se pueda usar.
  function renderUnirseForm() {
    screen = "local-unirse";
    paint(`<div class="shell online-shell">${header(directJoin ? "back" : "go-entrada")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Invitado</div><h2 data-focus tabindex="-1">Unirse a una sala</h2>${directJoin ? "<p class=\"lead\">No hace falta elegir mazo: la sala trae el suyo.</p>" : ""}</section>
      ${directJoin ? wifiNote() + cameraNote() : ""}
      <form class="panel online-form" data-local-form="join-offer">
        <div class="field"><label for="local-guest-name">Tu nombre</label><input id="local-guest-name" name="name" maxlength="18" required placeholder="Ej. Ana" autocomplete="name" value="${ownName() || escapeHtml(savedSeat()?.name || "")}"></div>
        ${savedSeat() ? `<p class="hint">Si escaneas una invitación de la sala ${escapeHtml(savedSeat().roomCode)}, volverás a tu plaza con tus cartas.</p>` : ""}
        ${nearbyAvailable() ? `<button type="button" class="btn btn-primary btn-block" data-local-action="nearby-search">${WIFI_ICON} Buscar salas cercanas</button><p class="hint">Entre iPhones: sin escanear nada ni compartir Wi-Fi. Con Bluetooth y Wi-Fi activados basta.</p>` : ""}
        <button type="button" class="btn ${nearbyAvailable() ? "btn-secondary" : "btn-primary"} btn-block" data-local-action="scan-offer">${CAMERA_ICON} Escanear el código del anfitrión</button>
        <details class="qr-fallback"><summary>¿No puedes usar la cámara?</summary>
          <div class="field"><label for="local-guest-offer">Pega el código que te ha compartido el anfitrión</label><textarea id="local-guest-offer" name="offer" rows="3" placeholder="Recíbelo por Bluetooth, AirDrop o Cerca y pégalo aquí."></textarea></div>
          <button class="btn btn-secondary btn-block" type="submit">Unirse con ese código</button>
        </details>
      </form>
    </div>`, "local-unirse");
  }

  async function doJoinWithOffer(name, offerText) {
    if (busy) return;
    busy = true;
    try {
      const invite = decodeInvite(offerText);
      role = "guest";
      myName = name;
      // Quien vuelve a la misma sala recupera su plaza con su mismo identificador.
      const seat = savedSeat();
      myPlayerId = seat && seat.roomCode === invite.roomCode ? seat.playerId : randomPlayerId();
      modeKey = CT.has(invite.modeKey) ? invite.modeKey : modeKey;
      guestSession = CT.LocalSession.createGuestSession({
        offerSignal: invite.signal, playerId: myPlayerId, name, avatarId: CT.Avatares.ownId(), deckFingerprint: invite.deckFingerprint,
        onChange: onRoomChange,
        onError: code => showToast(errorMessage(code)),
        onDisconnect: onGuestDisconnect
      });
      pendingAnswerText = await guestSession.answerSignal();
      renderUnirseCompartir();
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error.message));
    } finally { busy = false; }
  }

  // ---------------------------------------------------------------------------
  // Salas cercanas (iPhone ↔ iPhone, MultipeerConnectivity): sin QR. El anfitrión se anuncia
  // solo al crear la sala y aquí se ve la lista; tocar una sala basta para entrar.
  const nearbyAvailable = () => !!CT.LocalPeer?.available?.();
  let nearbySearch = null, nearbyRooms = [], nearbyName = "";
  function stopNearbySearch() { nearbySearch?.stop?.(); nearbySearch = null; }

  function nearbyListMarkup() {
    if (!nearbyRooms.length) return `<div class="status status-waiting"><div class="spinner" aria-hidden="true"></div><span>Buscando salas cercanas… Que quien organiza haya creado ya la sala, y que los dos tengáis Bluetooth y Wi-Fi activados (no hace falta estar conectados a ninguna red).</span></div>`;
    return `<div class="nearby-list">${nearbyRooms.map(room => {
      const known = CT.has(room.mode), sameDeck = !room.fp || !known || room.fp === CT.deckFingerprint(room.mode);
      const usable = known && sameDeck;
      return `<button type="button" class="btn btn-secondary btn-block" data-local-action="nearby-join" data-id="${escapeHtml(room.id)}"${usable ? "" : " disabled"}><b>${escapeHtml(room.host || "Sala")}</b> · ${escapeHtml(known ? CT.mode(room.mode).name : "Mazo desconocido")}${usable ? "" : ` — ${known ? "versión distinta del juego" : "actualiza la app"}`}</button>`;
    }).join("")}</div>`;
  }

  async function renderNearby(name) {
    nearbyName = name;
    nearbyRooms = [];
    screen = "local-cercanas";
    paint(`<div class="shell online-shell">${header("go-unirse")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Invitado</div><h2 data-focus tabindex="-1">Salas cercanas</h2><p class="lead">Elige la sala de quien la ha creado. Se unirá sola, sin códigos.</p></section>
      <div class="panel" id="local-nearby-list" aria-live="polite">${nearbyListMarkup()}</div>
    </div>`, "local-cercanas");
    try {
      nearbySearch = await CT.LocalPeer.browse(rooms => {
        nearbyRooms = rooms;
        const list = document.getElementById("local-nearby-list");
        if (list && screen === "local-cercanas") list.innerHTML = nearbyListMarkup();
      });
    } catch (error) {
      console.error(error);
      const list = document.getElementById("local-nearby-list");
      if (list) list.innerHTML = `<p>No se pudo buscar salas cercanas. Comprueba que has permitido la red local en Ajustes → Continuum, y que Bluetooth y Wi-Fi están activados.</p>`;
    }
  }

  async function doJoinNearby(id) {
    if (busy) return;
    const info = nearbyRooms.find(room => room.id === id);
    if (!info) return;
    busy = true;
    try {
      role = "guest";
      myName = nearbyName;
      const seat = savedSeat();
      myPlayerId = seat && seat.roomCode === info.room ? seat.playerId : randomPlayerId();
      modeKey = CT.has(info.mode) ? info.mode : modeKey;
      guestSession = CT.LocalSession.createGuestSession({
        nearbyHostId: id, playerId: myPlayerId, name: myName, avatarId: CT.Avatares.ownId(), deckFingerprint: CT.deckFingerprint(modeKey),
        onChange: onRoomChange,
        onError: code => showToast(errorMessage(code)),
        onDisconnect: onGuestDisconnect,
        onFail: () => {
          if (role !== "guest" || roomState) return;
          try { guestSession?.close(); } catch {}
          guestSession = null; role = null;
          showToast("No se pudo conectar con esa sala. Inténtalo de nuevo.");
          if (screen === "local-cercanas") void renderNearby(nearbyName);
        }
      });
      const list = document.getElementById("local-nearby-list");
      if (list) list.innerHTML = `<div class="status status-waiting"><div class="spinner" aria-hidden="true"></div><span>Conectando con ${escapeHtml(info.host || "la sala")}…</span></div>`;
      await guestSession.connect();
    } catch (error) {
      console.error(error);
      guestSession = null; role = null;
      showToast(errorMessage(error.message));
      void renderNearby(nearbyName);
    } finally { busy = false; }
  }

  // Diagnóstico de la conexión mientras se espera: si el canal no abre, la pantalla lo dice en
  // vez de quedarse en «Conectando…» para siempre, y enseña el estado ICE, el tamaño del QR y
  // los candidatos, que es justo lo que hace falta para saber por qué no conecta.
  let connectionWatch = null;
  function watchConnection(peerConnection, { signalText, qrText, warnAfter }) {
    clearInterval(connectionWatch); connectionWatch = null;
    if (!peerConnection) return;
    const started = Date.now();
    const info = CT.LocalTransport.describeSignal(signalText);
    let qrVersion = "?";
    try { qrVersion = CT.QrEncode.version(qrText); } catch { /* Sin dato. */ }
    const line = () => `ICE ${peerConnection.iceConnectionState} · conexión ${peerConnection.connectionState} · QR v${qrVersion} · señal ${info.length} car.${info.compact ? " (compacta)" : ""} · ${info.candidates} candidatos${info.mdns ? `, ${info.mdns} con nombre .local` : ""}`;
    connectionWatch = setInterval(() => {
      const statusEl = document.getElementById("local-conn-status"), diagEl = document.getElementById("local-conn-diag");
      if (!statusEl) { clearInterval(connectionWatch); connectionWatch = null; return; }
      const state = peerConnection.iceConnectionState, seconds = (Date.now() - started) / 1000;
      if (diagEl) diagEl.textContent = line();
      if (state === "connected" || state === "completed") { clearInterval(connectionWatch); connectionWatch = null; return; }
      if (state === "failed" || state === "disconnected" || seconds >= warnAfter) {
        statusEl.textContent = "No consigue conectar. Comprobad que los dos móviles están en el mismo Wi-Fi, con los datos móviles apagados, y que el punto de acceso no aísla los dispositivos. Si sigue igual, empezad la invitación de nuevo.";
        if (diagEl) diagEl.hidden = false;
      }
    }, 1000);
  }

  // Un único código QR, generado y enseñado directamente — sin un botón "mostrar como QR"
  // aparte, es lo primero que se ve. Compartir por Bluetooth/AirDrop o copiar a mano queda
  // como recurso, para cuando la cámara de quien organiza la sala no se pueda usar.
  function renderUnirseCompartir() {
    screen = "local-unirse-compartir";
    paint(`<div class="shell online-shell">${header("leave")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Invitado</div><h2 data-focus tabindex="-1">Enséñale esto a quien organiza la sala</h2><p class="lead">Se incorporará sola en cuanto lo escanee con su cámara — no hace falta hacer nada más.</p></section>
      <div class="panel qr-panel"><div class="qr-frame"><canvas id="local-answer-qr" aria-label="Tu respuesta, en código QR"></canvas></div></div>
      <details class="panel qr-fallback"><summary>¿No puede usar la cámara?</summary>
        <button type="button" class="btn btn-primary btn-block" data-local-action="share-answer">${SHARE_ICON} Compartir mi respuesta</button>
        <textarea class="signal-box" readonly rows="4" aria-label="Tu respuesta, para copiar a mano si hace falta" onclick="this.select()">${escapeHtml(pendingAnswerText)}</textarea>
        <button type="button" class="btn btn-secondary btn-block" data-local-action="copy-answer">Copiar</button>
      </details>
      <div class="status status-waiting"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span id="local-conn-status">Conectando con la sala…</span></div>
      <small class="hint" id="local-conn-diag" hidden></small>
    </div>`, "local-unirse-compartir");
    try { CT.QrEncode.draw(document.getElementById("local-answer-qr"), pendingAnswerText); }
    catch (error) { console.error(error); showToast("No se pudo generar el código QR; usa la opción de compartir a mano."); }
    // El invitado no sabe cuándo escanea el otro su respuesta: solo avisa pasado un minuto.
    watchConnection(guestSession?.peerConnection, { signalText: pendingAnswerText, qrText: pendingAnswerText, warnAfter: 60 });
  }

  // ---------------------------------------------------------------------------
  // Anfitrión: invitar a una persona más
  async function openInvite() {
    if (!hostSession || busy) return;
    if (roomState.playerOrder.length >= CT.LocalRoom.MAX_PLAYERS) { showToast("La sala ya está llena"); return; }
    busy = true;
    screen = "local-invitar";
    paint(`<div class="shell online-shell">${header("local-lobby")}<section class="pass-screen"><div class="panel"><div class="spinner"></div><h2 data-focus tabindex="-1">Preparando la invitación</h2></div></section></div>`, "local-invitar");
    try {
      const invite = await hostSession.invitePeer();
      const inviteText = encodeInvite({
        v: 1, roomCode: roomState.roomCode, modeKey, deckFingerprint: roomState.deckFingerprint,
        signal: invite.offerSignal
      });
      pendingInvite = { ...invite, inviteText };
      renderInvitar(false);
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error.message));
      renderLobby();
    } finally { busy = false; }
  }

  // Igual que en la pantalla del invitado: el código QR es lo primero que se ve, no algo
  // detrás de un botón. Una vez la otra persona lo escanea y manda su respuesta —por el
  // mismo camino, con su propia cámara— toca escanearla aquí para cerrar la conexión.
  function renderInvitar(conectado) {
    screen = "local-invitar";
    paint(`<div class="shell online-shell">${header("local-lobby")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Anfitrión</div><h2 data-focus tabindex="-1">Invitar a alguien</h2><p class="lead">Que la otra persona escanee esto con su cámara para unirse a la sala.</p></section>
      <div class="panel qr-panel"><div class="qr-frame"><canvas id="local-invite-qr" aria-label="Código de invitación, en código QR"></canvas></div></div>
      <details class="panel qr-fallback"><summary>¿No puede usar la cámara?</summary>
        <button type="button" class="btn btn-primary btn-block" data-local-action="share-invite">${SHARE_ICON} Compartir código</button>
        <textarea class="signal-box" readonly rows="4" aria-label="Código de conexión, para copiar a mano si hace falta" onclick="this.select()">${escapeHtml(pendingInvite?.inviteText || "")}</textarea>
        <button type="button" class="btn btn-secondary btn-block" data-local-action="copy-invite">Copiar</button>
      </details>
      ${conectado
        ? `<div class="status status-ok"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span id="local-conn-status">Conectando…</span></div><small class="hint" id="local-conn-diag" hidden></small>`
        : `<button type="button" class="btn btn-primary btn-block" data-local-action="scan-answer">${CAMERA_ICON} Ya me ha enseñado su código — escanearlo</button>
      <details class="panel qr-fallback"><summary>¿Te lo ha mandado a mano?</summary>
        <form data-local-form="accept-answer">
          <div class="field"><label for="local-answer">Pega aquí la respuesta que te manden</label><textarea id="local-answer" name="answer" rows="3" placeholder="Cuando te la manden, pégala en este campo…"></textarea></div>
          <button class="btn btn-secondary btn-block" type="submit">Conectar</button>
        </form>
      </details>`}
      <button type="button" class="btn btn-ghost btn-block" data-local-action="local-lobby">Ir al vestíbulo</button>
    </div>`, "local-invitar");
    try { CT.QrEncode.draw(document.getElementById("local-invite-qr"), pendingInvite?.inviteText || ""); }
    catch (error) { console.error(error); showToast("No se pudo generar el código QR; usa la opción de compartir a mano."); }
    if (conectado) watchConnection(pendingInvite?.peerConnection, { signalText: pendingInvite?.offerSignal, qrText: pendingInvite?.inviteText || "", warnAfter: 15 });
  }

  async function acceptPendingAnswer(text) {
    if (!pendingInvite || busy) return;
    busy = true;
    try {
      await pendingInvite.acceptAnswer(text.trim());
      renderInvitar(true);
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error.message));
    } finally { busy = false; }
  }

  // ---------------------------------------------------------------------------
  // Lectura por cámara — la única pantalla dedicada que hace falta: mostrar el código ya
  // no la necesita (se dibuja directamente en la propia pantalla de invitar/compartir, ver
  // más arriba). Con la librería completa de QR (`qr-encode.js`) una invitación entera
  // cabe en un único código, así que aquí solo hay que leer uno y devolver su texto tal
  // cual — nada que reunir ni trocear.
  function openQrScan({ title, hint, onResult, onBack }) {
    qrScanTitle = title; qrScanHint = hint; qrScanOnResult = onResult; qrScanOnBack = onBack;
    renderQrScan();
  }

  function renderQrScan() {
    screen = "local-qr-scan";
    paint(`<div class="shell online-shell">${header("qr-scan-back")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Cámara</div><h2 data-focus tabindex="-1">${escapeHtml(qrScanTitle)}</h2><p class="lead">${escapeHtml(qrScanHint)}</p></section>
      <div class="panel qr-panel"><div class="qr-frame"><video id="local-qr-video" aria-label="Cámara"></video></div><p class="hint" id="local-qr-scan-status" aria-live="polite">Encuadra el código QR con la cámara.</p></div>
    </div>`, "local-qr-scan");
    startCameraScan();
  }

  async function startCameraScan() {
    stopCamera();
    const statusEl = document.getElementById("local-qr-scan-status");
    if (!CT.QrScanner.isSupported()) { if (statusEl) statusEl.textContent = "Este navegador no permite usar la cámara aquí."; return; }
    const videoEl = document.getElementById("local-qr-video");
    try {
      cameraHandle = await CT.QrScanner.start(videoEl, text => {
        const onResult = qrScanOnResult;
        stopCamera();
        onResult?.(text);
      }, () => { if (statusEl) statusEl.textContent = "No se ha podido leer el código. Sigue encuadrándolo."; });
    } catch (error) {
      console.error(error);
      if (statusEl) statusEl.textContent = "No se pudo acceder a la cámara. Revisa los permisos y vuelve a intentarlo.";
    }
  }

  // ---------------------------------------------------------------------------
  // Vestíbulo (compartido entre anfitrión e invitados)
  const SEAT_POSITIONS = [
    { left: "50%", top: "10%" }, { left: "80%", top: "24%" }, { left: "90%", top: "50%" },
    { left: "80%", top: "76%" }, { left: "50%", top: "90%" }, { left: "20%", top: "76%" },
    { left: "10%", top: "50%" }, { left: "20%", top: "24%" }
  ];

  // Los ajustes del anfitrión se guardan aquí y no en el propio formulario: la sala de
  // espera se repinta con cada respuesta del minijuego y, si no, volverían a los de serie.
  const lobbySettings = { preset: "simple", handSize: "4", turnSeconds: "30", pulse: false, ghost: false };

  // El minijuego de quién empieza, el mismo que en la sala online y en un solo móvil:
  // el anfitrión reparte una carta, cada persona escribe su cifra en su móvil, empieza
  // quien más se acerca y el resto juega por orden de cercanía.
  function starterRanking() {
    const draw = roomState?.starterDraw;
    if (!draw || !CT.LocalRoom.starterComplete(roomState)) return null;
    return CT.Starter.order(modeKey, draw.cardId, roomState.playerOrder.map(id => ({ id, value: draw.guesses[id] })));
  }
  function starterPanelMarkup(isHost) {
    const draw = roomState.starterDraw;
    if (roomState.playerOrder.length < 2) return "";
    if (!draw) {
      return isHost
        ? `<div class="field starter-field"><span class="field-label">Quién empieza</span><button type="button" class="btn btn-secondary btn-block" data-local-action="starter-draw">🂠 Sortear con una carta quién empieza</button><p class="hint">Cada persona escribe la cifra de la misma carta: empieza quien más se acerque y el resto juega por orden de cercanía.</p></div>`
        : `<div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>Va a repartir una carta para decidir el orden de juego.</p>`;
    }
    const card = getCard(draw.cardId);
    const regla = CT.axis(modeKey).cifra || {};
    const repetir = isHost ? `<button type="button" class="btn btn-ghost btn-block" data-local-action="starter-draw">🂠 Repetir el sorteo</button>` : "";
    const cardMarkup = detalle => `<div class="cifra-card starter-card"><div class="starter-card-art" aria-label="Ilustración de ${escapeHtml(card.title)}">${animalArt(card)}</div>${categoryBadge(card)}<strong>${escapeHtml(card.title)}</strong><span>${detalle}</span></div>`;
    const ranking = starterRanking();
    if (ranking) {
      const lista = ranking.map((id, i) => `<li${i === 0 ? ' class="starter-draw-winner"' : ""}><span>${i + 1}.º ${escapeHtml(roomState.players[id].name)}${id === myPlayerId ? " · tú" : ""}</span><span>${escapeHtml(CT.Duelo.Cifras.formato(modeKey, draw.guesses[id]))}</span></li>`).join("");
      const resultado = `${cardMarkup(`El valor real era ${escapeHtml(formatValue(card))}`)}<p class="hint">Orden de juego, de quien más se acercó a quien menos:</p><ol class="starter-draw-list">${lista}</ol>`;
      return `<div class="field starter-field"><span class="field-label">Quién empieza</span>${resultado}${isHost ? `${repetir}<button class="btn btn-primary btn-block" data-local-action="start">Barajar y empezar <span>→</span></button>` : '<p class="hint">Esperando al anfitrión para empezar.</p>'}</div>`;
    }
    if (myPlayerId in draw.guesses) {
      const faltan = roomState.playerOrder.filter(id => !(id in draw.guesses)).map(id => roomState.players[id].name);
      return `<div class="field starter-field"><span class="field-label">Quién empieza</span>${cardMarkup(escapeHtml(regla.pregunta || ""))}<p class="hint">Ya has respondido. Esperando a ${escapeHtml(faltan.join(", "))}.</p>${repetir}</div>`;
    }
    return `<div class="field starter-field"><span class="field-label">Quién empieza</span>${cardMarkup(escapeHtml(regla.pregunta || ""))}
      <div class="field cifra-field"><label for="starter-guess-input">Tu cifra${regla.unidad ? ` <span class="cifra-unidad">en ${escapeHtml(regla.unidad)} si no pones otra</span>` : ""}</label><input id="starter-guess-input" type="text" inputmode="${regla.decimales ? "decimal" : "numeric"}" autocomplete="off" enterkeyhint="send"><p class="hint">${escapeHtml(regla.pista || "")}</p></div>
      <button type="button" class="btn btn-primary btn-block" data-local-action="starter-guess">Adivinar <span>→</span></button>${repetir}</div>`;
  }

  function renderLobby() {
    if (!roomState) return;
    screen = "local-lobby";
    const isHost = role === "host";
    const draft = document.getElementById("starter-guess-input")?.value || "";
    const seats = roomState.playerOrder.map((uid, index) => {
      const player = roomState.players[uid];
      const pos = SEAT_POSITIONS[index] || SEAT_POSITIONS[SEAT_POSITIONS.length - 1];
      const puedeExpulsar = isHost && uid !== roomState.hostId;
      return `<div class="table-seat" style="left:${pos.left};top:${pos.top};"><span class="seat-avatar">${CT.Avatares.markup(player.name, { size: 44, seed: 'room:' + uid, id: esMio(uid) ? CT.Avatares.ownId() : player.avatarId })}</span><strong>${escapeHtml(player.name)}${uid === myPlayerId ? " · tú" : ""}</strong><small>${uid === roomState.hostId ? "Anfitrión" : `Plaza ${index + 1}`}</small><i class="ready-seal">Listo</i>${puedeExpulsar ? `<button class="kick-btn" data-local-action="kick" data-uid="${uid}" aria-label="Expulsar a ${escapeHtml(player.name)}">×</button>` : ""}</div>`;
    }).join("");
    const opcion = (value, label, current) => `<option value="${value}"${String(current) === String(value) ? " selected" : ""}>${label}</option>`;
    const settings = isHost
      ? `<div class="section-label">Ajustes</div>
        <div class="field"><label for="wifi-preset">Tipo de partida</label><select id="wifi-preset">${opcion("simple", "Primera partida · sin poderes", lobbySettings.preset)}${opcion("advanced", "Avanzada · Pulso y Fantasma", lobbySettings.preset)}${lobbySettings.preset === "custom" ? opcion("custom", "Personalizada", lobbySettings.preset) : ""}</select></div>
        <div class="field"><label for="wifi-turn-seconds">Tiempo por turno</label><select id="wifi-turn-seconds">${opcion(0, "Sin límite", lobbySettings.turnSeconds)}${opcion(20, "20 segundos", lobbySettings.turnSeconds)}${opcion(30, "30 segundos", lobbySettings.turnSeconds)}${opcion(45, "45 segundos", lobbySettings.turnSeconds)}</select></div>
        <div class="field"><label for="wifi-hand-size">Cartas iniciales</label><select id="wifi-hand-size">${[1, 2, 3, 4, 5, 6].map(n => opcion(n, n, lobbySettings.handSize)).join("")}</select></div>
        <label class="opt-row"><span>Cartas Pulso <small>Esconde de 1 a 3 poderes Pulso con el mismo reparto que Fantasma.</small></span><input type="checkbox" id="wifi-pulse"${lobbySettings.pulse ? " checked" : ""}></label>
        <label class="opt-row"><span>Cartas Fantasma <small>De 1 a 3 poderes ocultos según los jugadores. Pueden quedarse sin descubrir.</small></span><input type="checkbox" id="wifi-ghost"${lobbySettings.ghost ? " checked" : ""}></label>
        ${roomState.playerOrder.length < 2 ? '<p class="hint">Esperando a alguien más…</p>' : starterPanelMarkup(true)}`
      : roomState.playerOrder.length < 2 ? `<div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>La partida comenzará en todos los móviles a la vez.</p>` : starterPanelMarkup(false);
    paint(`<div class="shell online-shell">${header("leave")}
      <section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Sala de espera</div><h2 data-focus tabindex="-1">Preparando la mesa</h2></div><div class="room-code-card"><small>Código de sala</small><strong>${escapeHtml(roomState.roomCode)}</strong>${isHost ? `<div class="room-invite-actions"><button type="button" data-local-action="invite">${hostSession?.nearby ? "Invitar por QR (Android)" : "Invitar a alguien"}</button></div>` : ""}</div></section>
      ${isHost && hostSession?.nearby ? `<p class="online-note" data-nearby-note>Sala visible para los iPhones cercanos: que pulsen «Unirme a una sala → Buscar salas cercanas». Para un Android, usa el QR.</p>` : ""}
      <div class="online-lobby-grid">
        <section class="panel lobby-table-panel"><div class="section-label">Mesa de exploradores <small>${roomState.playerOrder.length}/${CT.LocalRoom.MAX_PLAYERS}</small></div><div class="lobby-table"><div class="lobby-table-core"><span>CONTINUUM</span><strong>${roomState.playerOrder.length}</strong><small>${roomState.playerOrder.length === 1 ? "explorador" : "exploradores"}</small></div>${seats}</div><p class="lobby-ready-note"><i>Listo</i> La plaza queda preparada al entrar en la sala.</p></section>
        <section class="panel lobby-settings">${settings}</section>
      </div>
    </div>`, "local-lobby");
    if (draft) { const input = document.getElementById("starter-guess-input"); if (input && !input.value) input.value = draft; }
  }

  // Todas las jugadas pasan por aquí: el anfitrión las aplica en su propio móvil y el
  // invitado se las manda al anfitrión, que las resuelve y reparte el resultado.
  function send(type, data = {}) {
    if (role === "host") hostSession.act(type, data);
    else if (guestSession) guestSession.send(type, data);
  }
  function attempt(type, data = {}) {
    if (busy) return;
    busy = true;
    try { send(type, data); }
    catch (error) { if (error.message !== "NOT_ALLOWED" || type !== "finish-turn") { console.error(error); showToast(errorMessage(error.message)); } }
    finally { busy = false; }
  }

  function doStarterGuess() {
    const campo = document.getElementById("starter-guess-input");
    const value = CT.Duelo.Cifras.leer(modeKey, campo ? campo.value : "");
    if (value === null) return showToast("Escribe una cifra válida");
    attempt("starter-guess", { value });
  }

  function doStart() {
    if (role !== "host") return;
    attempt("start", {
      handSize: Number(lobbySettings.handSize) || 4,
      turnSeconds: Number(lobbySettings.turnSeconds) || 0,
      pulse: !!lobbySettings.pulse, ghost: !!lobbySettings.ghost
    });
  }

  function doRemovePlayer(targetId) {
    if (role === "host") attempt("remove-player", { targetId });
    else if (targetId === myPlayerId) leaveToEntrada();
  }

  function doCloseRoom() {
    if (role !== "host") return;
    CT.UI.confirmDialog("Se cerrará la sala para todos los participantes.", () => leaveToEntrada(), { title: "¿Cerrar la sala?", confirmLabel: "Cerrar sala", cancelLabel: "Seguir en la sala" });
  }

  // Salir de la sala: quien organiza la cierra para todos (se pide confirmación si ya hay
  // alguien más); un invitado avisa antes al anfitrión, para que sus cartas vuelvan al
  // descarte y la partida no se quede esperando su turno.
  function requestLeave() {
    if (role === "host") {
      if (roomState && roomState.playerOrder.length > 1 && roomState.status !== "ended") {
        CT.UI.confirmDialog("Si sales, la sala se cierra para todos los participantes.", () => leaveToEntrada(), { title: "¿Salir y cerrar la sala?", confirmLabel: "Cerrar sala", cancelLabel: "Quedarme en la sala" });
        return;
      }
      leaveToEntrada();
    } else if (role === "guest" && roomState && roomState.status === "playing") {
      CT.UI.confirmDialog("Tus cartas volverán al mazo.", () => leaveToEntrada(), { title: "¿Salir de la partida?", confirmLabel: "Salir de la partida", cancelLabel: "Quedarme" });
    } else leaveToEntrada();
  }

  function leaveToEntrada(message = "") {
    CT.closeDialog?.();
    const guest = guestSession;
    hostSession?.close?.();
    guestSession = null;
    if (guest) { if (roomState?.playerOrder?.includes(myPlayerId)) guest.leave?.(); else guest.close?.(); }
    forgetSeat();
    hostSession = null; roomState = null; role = null; myPlayerId = "";
    selectedCardId = null; pendingIndex = null;
    renderEntrada();
    if (message) showToast(message);
  }

  function doSkipTurn(expectedVersion = null) {
    if (role !== "host" || !roomState || roomState.status !== "playing") return;
    try { send("skip-turn", expectedVersion === null ? {} : { expectedVersion }); }
    catch (error) { console.error(error); showToast(errorMessage(error.message)); }
  }

  // ---------------------------------------------------------------------------
  // Plaza reservada. Si el canal con el anfitrión se cae a mitad de partida, la plaza y
  // las cartas siguen esperando en su móvil: basta con que vuelva a invitar a esta
  // persona. Se recuerda también tras recargar la página, por si el móvil la cerró.
  const SEAT_KEY = "continuum-wifi-seat";
  let lastSeat = null;
  function rememberSeat() {
    if (role !== "guest" || !roomState) return;
    lastSeat = { roomCode: roomState.roomCode, playerId: myPlayerId, name: myName, modeKey };
    try { CT.Storage?.setItem?.(SEAT_KEY, JSON.stringify(lastSeat)); } catch {}
  }
  function forgetSeat() { lastSeat = null; try { CT.Storage?.removeItem?.(SEAT_KEY); } catch {} }
  function savedSeat() {
    if (lastSeat) return lastSeat;
    try { return JSON.parse(CT.Storage?.getItem?.(SEAT_KEY) || "null"); } catch { return null; }
  }

  function renderDisconnected() {
    screen = "local-desconectado";
    paint(`<div class="shell online-shell">${header("go-entrada")}<section class="pass-screen"><div class="panel pass-card">
      <div class="big-icon" aria-hidden="true">${WIFI_ICON}</div>
      <div class="eyebrow">Sala ${escapeHtml(lastSeat?.roomCode || "")}</div>
      <h2 data-focus tabindex="-1">Se ha perdido la conexión</h2>
      <p>Tu plaza y tus cartas siguen guardadas en el móvil de quien organiza la sala. Mientras no vuelvas, tus turnos se saltan.</p>
      <p class="hint">Sin internet no hay forma de reengancharse sola: pídele que te invite otra vez (Menú → Invitar a alguien) y escanea su código. Volverás a tu sitio, con tus cartas.</p>
      <button type="button" class="btn btn-primary btn-block" data-local-action="go-unirse">Volver a sentarme <span>→</span></button>
      <button type="button" class="btn btn-ghost btn-block" data-local-action="forget-seat">Salir de la partida</button>
    </div></section></div>`, "local-desconectado");
  }

  // ---------------------------------------------------------------------------
  // Reloj del turno
  function clearTurnTimer() { if (turnTimerHandle) { clearInterval(turnTimerHandle); turnTimerHandle = null; } }

  function turnRemaining() {
    const seconds = Number(roomState?.turnSeconds) || 0;
    if (!seconds || roomState.status !== "playing" || roomState.phase !== "turn") return null;
    if (role === "host" && Number.isFinite(roomState.turnStartedAt)) {
      return Math.max(0, Math.ceil(seconds - (Date.now() - roomState.turnStartedAt) / 1000));
    }
    const key = `${roomState.round}:${roomState.turnsInRound}:${roomState.current}:${roomState.version}`;
    if (key !== turnSeenKey) { turnSeenKey = key; turnSeenAt = performance.now(); }
    return Math.max(0, Math.ceil(seconds - (performance.now() - turnSeenAt) / 1000));
  }

  function manageTurnTimer() {
    clearTurnTimer();
    if (turnRemaining() === null) return;
    const version = roomState.version;
    const tick = () => {
      const remaining = turnRemaining();
      const value = document.getElementById("turn-timer-value");
      if (value && remaining !== null) value.textContent = remaining;
      document.getElementById("turn-timer")?.classList.toggle("turn-timer-low", remaining !== null && remaining <= 5);
      if (remaining === 0 && role === "host" && roomState?.version === version) {
        clearTurnTimer();
        const name = roomState.players[roomState.playerOrder[roomState.current]]?.name;
        doSkipTurn(version);
        showToast(`Se acabó el tiempo${name ? ` de ${name}` : ""}`);
      }
    };
    tick();
    turnTimerHandle = setInterval(tick, 250);
  }

  function showGuide() {
    appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-local-guide><div class="modal rules"><div class="guide-tools"><button type="button" class="icon-btn guide-close" data-local-action="close-guide" aria-label="Cerrar guía">×</button></div><div class="guide-content">${CT.guideMarkup(modeKey, "online", { pulse: !!roomState?.pulse, ghost: roomState?.status === "playing" ? !!roomState.ghost : true })}</div><button class="btn btn-primary btn-block" data-local-action="close-guide">Entendido</button></div></div>`);
    CT.openDialog(appEl.querySelector("[data-local-guide]"), true);
  }

  // Durante la partida, la flecha de volver y el botón «Sala» abren este menú en vez de
  // llevar al vestíbulo, que ya no sirve de nada con la partida en marcha.
  function roomMenu() {
    if (!roomState) return;
    const isHost = role === "host";
    const playing = roomState.status === "playing";
    const currentUid = playing ? roomState.playerOrder[roomState.current] : null;
    const currentName = currentUid ? roomState.players[currentUid]?.name : "";
    const others = roomState.playerOrder.filter(uid => uid !== roomState.hostId);
    const ausentes = others.filter(uid => roomState.players[uid].away);
    appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-local-room-overlay><div class="modal">
      <div class="eyebrow">Sala ${escapeHtml(roomState.roomCode)}</div><h2>Opciones de la partida</h2><p class="hint">La partida continúa mientras consultas este menú.</p>
      <div class="actions" style="display:grid">
        <button class="btn btn-secondary" data-local-action="guide">Guía</button>
        ${isHost && playing ? `<button class="btn btn-secondary" data-local-action="invite">Invitar a alguien${ausentes.length ? ` · para que vuelva ${escapeHtml(ausentes.map(uid => roomState.players[uid].name).join(", "))}` : ""}</button>` : ""}
        ${isHost && playing && currentUid !== roomState.hostId && ["turn", "pulse"].includes(roomState.phase) ? `<button class="btn btn-ghost" data-local-action="skip">Saltar el turno de ${escapeHtml(currentName)}</button>` : ""}
      </div>
      ${isHost && others.length ? `<div class="manage-players"><div class="section-label">Participantes</div>${others.map(uid => `<div class="manage-player"><span class="seat-avatar">${CT.Avatares.markup(roomState.players[uid].name, { size: 34, seed: 'room:' + uid, id: roomState.players[uid].avatarId })}</span><strong>${escapeHtml(roomState.players[uid].name)}${roomState.players[uid].away ? " · desconectado" : ""}</strong><button class="kick-btn" data-local-action="kick" data-uid="${uid}">Expulsar</button></div>`).join("")}</div>` : ""}
      <div class="actions" style="display:grid">
        ${isHost ? '<button class="btn btn-ghost" data-local-action="close-room">Terminar partida y cerrar sala</button>' : '<button class="btn btn-ghost" data-local-action="leave">Salir de la partida</button>'}
        <button class="btn btn-primary" data-local-action="close-room-menu">Volver a la partida</button>
      </div>
    </div></div>`);
    CT.openDialog(appEl.querySelector("[data-local-room-overlay]"), true);
  }

  // ---------------------------------------------------------------------------
  // Partida
  function pulseTargetIds() { return CT.LocalRoom.pulseTargets(roomState, myPlayerId); }

  function openPulse() {
    const opciones = pulseTargetIds().map(uid => {
      const player = roomState.players[uid];
      return `<button class="btn btn-secondary btn-block pulse-target" data-local-action="pulse-target" data-target="${uid}"><b>${escapeHtml(player.name)}</b><small>${player.hand.length} ${player.hand.length === 1 ? "carta" : "cartas"}</small></button>`;
    }).join("");
    appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-pulse-overlay><div class="modal">
      <div class="eyebrow">Pulso</div>
      <h2>¿A quién retas?</h2>
      <p class="lead" style="margin-inline:auto">${CT.pulseRules}</p>
      <div class="actions" style="display:grid;margin-top:6px">${opciones}</div>
      <button class="btn btn-ghost btn-block" style="margin-top:10px" data-local-action="close-room-menu">Mejor no</button>
    </div></div>`);
    CT.openDialog(appEl.querySelector("[data-pulse-overlay]"), true);
  }

  function timelineCardMarkup(card) {
    const era = eraForCard(card);
    const animal = usesAnimalArt();
    const body = animal
      ? `<div class="card-visual era-${era.key}">${animalArt(card)}</div><div class="card-content">${categoryBadge(card)}<h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p><div class="year">${formatValue(card)}</div></div>`
      : `<div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content">${categoryBadge(card)}<div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div>`;
    return roomState.ghost?.pending.length ? CT.Ghost.hiddenCard(card) : `<article class="timeline-card card-flippable ${animal ? "animal-timeline-card" : ""}" data-id="${card.id}" role="button" tabindex="0" aria-label="${escapeHtml(card.title)}. Toca para ver ${animal ? "la lámina y los datos" : "la explicación"}.">${body}</article>`;
  }

  function renderGame() {
    if (roomState.status === "ended") { renderFinal(); return; }
    if (roomState.phase === "final") { renderSecretFinal(); return; }
    screen = "local-game";
    const currentUid = roomState.playerOrder[roomState.current];
    const currentPlayer = roomState.players[currentUid];
    const me = roomState.players[myPlayerId];
    const myTurn = currentUid === myPlayerId && roomState.phase === "turn";
    const pulsing = roomState.phase === "pulse" && roomState.pulseTurn;
    const defensa = pulsing && roomState.pulseTurn.stage === "defensa";
    const myPulse = pulsing && (defensa ? roomState.pulseTurn.targetId === myPlayerId : currentUid === myPlayerId);
    const pulseCard = pulsing ? getCard(roomState.pulseTurn.cardId) : null;
    const pulseTargetName = pulsing ? roomState.players[roomState.pulseTurn.targetId]?.name || "" : "";
    const timelineCards = roomState.timeline.map(id => getCard(id));
    const selectedCard = selectedCardId ? getCard(selectedCardId) : null;
    const failIndex = roomState.phase === "reveal" && !roomState.reveal.correct && !roomState.reveal.duel
      ? CT.correctIndex(modeKey, timelineCards, getCard(roomState.reveal.cardId)) : null;
    const slots = [];
    for (let index = 0; index <= timelineCards.length; index++) {
      const confirmable = myPulse ? pulseCard : (myTurn ? selectedCard : null);
      slots.push(confirmable && pendingIndex === index
        ? `<div class="slot-confirm" data-index="${index}"><small>Colocar aquí</small><strong>${escapeHtml(confirmable.title)}</strong><button class="btn btn-primary btn-block" data-local-action="${myPulse ? (defensa ? "confirm-defense" : "confirm-pulse") : "confirm-place"}" data-autofocus>Sí, aquí</button><button class="btn btn-ghost btn-block" data-local-action="cancel-place">Cancelar</button></div>`
        : myPulse
          ? `<button class="slot" data-local-action="pulse-place" data-index="${index}" aria-label="Colocar en la posición ${index + 1} de ${timelineCards.length + 1}"><span>+</span></button>`
        : index === failIndex
          ? `<button class="slot slot-correct" data-local-action="place" data-index="${index}" disabled aria-label="Aquí iba la carta que se acaba de fallar"><span>✦</span><small>Aquí</small></button>`
          : `<button class="slot" data-local-action="place" data-index="${index}" ${myTurn && selectedCardId ? "" : "disabled"} aria-label="Colocar en la posición ${index + 1} de ${timelineCards.length + 1}"><span>+</span></button>`);
      if (index < timelineCards.length) slots.push(timelineCardMarkup(timelineCards[index]));
    }
    const secondsLeft = turnRemaining();
    const powersEnabled = myTurn && !pulsing;
    const handSection = pulsing
      ? `<section><div class="hand-title"><h3>Carta del duelo</h3><small>${defensa ? `reta ${escapeHtml(currentPlayer.name)}` : `contra ${escapeHtml(pulseTargetName)}`}</small></div><div class="hand hand-solo"><div class="hand-card selected" data-id="${pulseCard.id}">${categoryBadge(pulseCard)}<span class="hidden-date">${hiddenLabel()}</span>${cardBack()}<strong>${escapeHtml(pulseCard.title)}</strong></div></div><p class="hint">${myPulse
        ? (pendingIndex !== null ? "Confirma el hueco elegido o toca otro"
          : defensa ? `Colócala tú también. Si aciertas, no te llevas ninguna carta de ${escapeHtml(currentPlayer.name)}`
          : `Colócala. Si aciertas y ${escapeHtml(pulseTargetName)} falla, le pasas una carta tuya`)
        : defensa ? `${escapeHtml(pulseTargetName)} está colocando la misma carta…` : `${escapeHtml(currentPlayer.name)} está colocando la carta del duelo…`}</p></section>`
      : `<section><div class="hand-title"><h3>Tu mano</h3><small>${me.hand.length} por colocar</small></div><div class="hand">${me.hand.map(id => { const card = getCard(id); return `<button class="hand-card ${selectedCardId === id ? "selected" : ""}" data-local-action="select" data-id="${id}" aria-pressed="${selectedCardId === id}" ${myTurn ? "" : "disabled"}>${categoryBadge(card)}<span class="hidden-date">${hiddenLabel()}</span>${cardBack()}<strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`; }).join("")}</div><p class="hint">${myTurn ? (pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Toca una carta para seleccionarla y después un hueco +, o mantenla pulsada y arrástrala hasta el hueco") : `${escapeHtml(currentPlayer.name)} está pensando dónde colocar su carta…`}</p></section>`;
    paint(`<div class="shell">${header("room-menu", '<button class="icon-btn" data-local-action="room-menu" aria-label="Abrir menú de la sala">Sala</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}, ronda ${roomState.round}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">Ronda ${roomState.round} · Turno ${roomState.turnsInRound + 1} de ${roomState.playerOrder.length}</div><div class="turn-name" aria-hidden="true">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}</div></div>${secondsLeft !== null ? `<div class="turn-timer ${secondsLeft <= 5 ? "turn-timer-low" : ""}" id="turn-timer" role="timer" aria-label="Tiempo para jugar"><strong id="turn-timer-value">${secondsLeft}</strong><span>seg</span></div>` : ""}<div class="deck-count"><strong>${roomState.deck.length}</strong><span>mazo</span></div></div>
      <section class="scoreboard-panel" aria-label="Jugadores"><div class="scoreboard-title">Jugadores</div><div class="scoreboard">${roomState.playerOrder.map(uid => { const player = roomState.players[uid]; return `<span class="score ${uid === currentUid ? "active" : ""}"${uid === currentUid ? ' aria-current="true"' : ""}><i class="score-avatar">${CT.Avatares.markup(player.name, { size: 40, seed: 'room:' + uid, id: esMio(uid) ? CT.Avatares.ownId() : player.avatarId })}</i><span class="score-copy"><b>${escapeHtml(player.name)}${uid === myPlayerId ? " · tú" : ""}${player.away ? " · desconectado" : ""}</b><span class="score-progress" aria-hidden="true"><i style="--player-progress:${playerProgress(player.hand.length)}%"></i></span></span><em><strong>${player.hand.length}</strong><small>cartas</small></em></span>`; }).join("")}</div></section>
      ${pulsing ? `<div class="pulse-banner">⚡ Duelo · <b>${escapeHtml(currentPlayer.name)}</b> reta a <b>${escapeHtml(pulseTargetName)}</b>${defensa ? " · defiende" : ""}</div>` : ""}
      ${CT.Ghost.banner(roomState.ghost, roomState.playerOrder.map(id => ({ id, name: roomState.players[id].name })))}
      ${boardQuestion()}
      ${handSection}
      <section class="board-timeline-section"><div class="hand-title"><h3>${timelineTitle()}</h3></div>${CT.timelineEnds(modeKey)}${CT.timelineMap(modeKey, timelineCards, { hidden: !!roomState.ghost?.pending.length })}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      ${!pulsing && roomState.phase !== "reveal" ? CT.Ghost.power(roomState.ghost, myPlayerId, roomState.timeline.length, me.hand.length, 'data-local-action="ghost-use"', powersEnabled) : ""}
      ${!pulsing && roomState.phase !== "reveal" ? pulseButton(me, powersEnabled) : ""}
      ${roomState.phase === "reveal" ? revealOverlay(currentUid) : ""}
    </div>`, "local-game");
    manageTurnTimer();
    CT.enableDrag?.({
      cardSelector: ".hand-card", slotSelector: ".slot",
      onDrop: (id, index) => {
        if (!myPulse) selectedCardId = Number(id);
        pendingIndex = index;
        renderGame();
      }
    });
    if (roomState.phase === "reveal" && !renderGame.revelando) CT.openDialog(appEl.querySelector(".overlay"), false);
    renderGame.revelando = roomState.phase === "reveal";
  }

  // El Pulso aparece como poder (si se reparte con cartas) o como botón (si la partida lo
  // activó sin reparto), exactamente igual que en la sala online.
  function pulseButton(me, enabled) {
    if (roomState.pulsePower) return CT.Powers.pulsePower(roomState.pulsePower, myPlayerId, me.hand.length, 'data-local-action="pulse-open"', enabled && CT.LocalRoom.pulseAvailable(roomState, myPlayerId));
    return enabled && CT.LocalRoom.pulseAvailable(roomState, myPlayerId) ? `<button class="btn btn-secondary btn-block pulse-btn" data-local-action="pulse-open">⚡ Usar mi Pulso <small>una vez por partida</small></button>` : "";
  }

  function revealOverlay(currentUid) {
    const reveal = roomState.reveal;
    const card = getCard(reveal.cardId);
    const era = eraForCard(card);
    const canContinue = myPlayerId === currentUid || role === "host";
    const hint = reveal.correct || reveal.duel ? "" : `<p>${CT.placementHint(modeKey, roomState.timeline.map(id => getCard(id)), card)}</p>`;
    const seguir = canContinue ? '<button class="btn btn-primary btn-block" data-dialog-focus data-local-action="finish-turn">Continuar <span>→</span></button>' : `<div class="waiting-inline"><i></i> Esperando a ${escapeHtml(reveal.playerName)}…</div>`;
    const fichaCarta = `<div class="reveal">${categoryBadge(card)}<div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div>${CT.Art?.button ? CT.Art.button(modeKey, card) : ""}<div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div>`;
    if (reveal.duel) {
      const implicado = myPlayerId === reveal.playerId || myPlayerId === reveal.targetId;
      const cartas = roomState.timeline.map(id => getCard(id));
      const sinLaCarta = reveal.correct || reveal.targetOk ? cartas.filter(item => item.id !== card.id) : cartas;
      const donde = index => {
        const antes = sinLaCarta[index - 1], despues = sinLaCarta[index];
        if (!antes && !despues) return "en la línea vacía";
        if (!antes) return `antes de «${escapeHtml(despues.title)}»`;
        if (!despues) return `después de «${escapeHtml(antes.title)}»`;
        return `entre «${escapeHtml(antes.title)}» y «${escapeHtml(despues.title)}»`;
      };
      const fila = (nombre, ok, index) => `<div class="pulse-duel-row ${ok ? "pulse-duel-hit" : "pulse-duel-miss"}"><span class="pulse-duel-mark" aria-hidden="true">${ok ? "✓" : "×"}</span><span><b>${escapeHtml(nombre)}</b><small>${ok ? "Acierta" : "Falla"}: la puso ${donde(index)}</small></span></div>`;
      const regalo = implicado && reveal.giftId != null ? `<b>${escapeHtml(getCard(reveal.giftId).title)}</b>` : "una carta";
      const cierre = reveal.correct && reveal.targetOk
        ? "Empate: los dos la habéis colocado bien, así que no cambia ninguna mano. La carta se queda en la línea."
        : reveal.correct
          ? `Solo acierta <b>${escapeHtml(reveal.playerName)}</b>: <b>${escapeHtml(reveal.targetName)}</b> se lleva ${regalo}. La carta se queda en la línea.`
          : reveal.targetOk
            ? `<b>${escapeHtml(reveal.targetName)}</b> se defiende y coloca la carta en la línea. <b>${escapeHtml(reveal.playerName)}</b> ${reveal.penaltySkipped ? "no roba: el mazo y el descarte están agotados" : "roba una por fallar el reto"}.`
            : `No la acierta ninguno de los dos: la carta va al descarte y <b>${escapeHtml(reveal.playerName)}</b> roba una por haber lanzado el reto.`;
      return `<div class="overlay" data-result-card="${reveal.correct || reveal.targetOk ? card.id : ""}"><div class="modal pulse-duel-modal">
        <div class="eyebrow" aria-hidden="true">⚡ Duelo · ${escapeHtml(reveal.playerName)} contra ${escapeHtml(reveal.targetName)}</div>
        <h2>${escapeHtml(card.title)}</h2>${fichaCarta}
        <div class="pulse-duel-rows">${fila(reveal.playerName, reveal.correct, reveal.byIndex)}${fila(reveal.targetName, reveal.targetOk, reveal.targetIndex)}</div>
        <p class="pulse-outcome">${cierre}</p>${seguir}
      </div></div>`;
    }
    const quien = reveal.playerId === myPlayerId ? "Tú" : escapeHtml(reveal.playerName || "");
    const desenlace = `<p>${reveal.correct ? "La carta permanece en la línea temporal." : reveal.returned ? "No quedan cartas que robar, así que vuelve a su mano." : `${quien} ${reveal.playerId === myPlayerId ? "descartas" : "descarta"} la carta y ${reveal.playerId === myPlayerId ? "robas" : "roba"} una nueva.`}</p>`;
    return `<div class="overlay" data-result-card="${reveal.correct ? card.id : ""}"><div class="modal ${reveal.correct ? "success" : "failure"}"><div class="result-mark" aria-hidden="true">${reveal.correct ? "✓" : "×"}</div><div class="eyebrow" aria-hidden="true">${reveal.correct ? "¡Bien colocado!" : "No encaja ahí"} · ${quien}</div><h2><span class="solo-lectores">${reveal.correct ? "Bien colocado:" : "No encaja ahí:"} </span>${escapeHtml(card.title)}</h2>${fichaCarta}${hint}${desenlace}${seguir}</div></div>`;
  }

  // La final secreta, igual que en la sala online: cada finalista escribe su cifra en su
  // propio móvil y no se enseña ninguna hasta que estén todas.
  function renderSecretFinal() {
    screen = "local-final-secreta";
    const final = roomState.final;
    const answers = roomState.finalAnswers || {};
    const name = uid => roomState.players[uid]?.name || "";
    const complete = CT.LocalRoom.finalComplete(roomState);
    const finalist = final.players.includes(myPlayerId);
    const answered = myPlayerId in answers;
    const oldForm = appEl.querySelector("[data-local-final]");
    const draft = oldForm ? { guess: oldForm.elements.guess?.value, era: oldForm.elements.era?.value } : null;
    let body;
    if (complete) {
      const ranking = CT.Final.rank(final, answers);
      body = `${CT.Final.results(modeKey, final, answers, name)}<button class="btn btn-primary btn-block" data-local-action="final-next">${ranking.winners.length === 1 ? "Ver ganador" : "Otra carta de desempate"}</button>`;
    } else {
      const faltan = final.players.filter(uid => !(uid in answers)).map(uid => escapeHtml(name(uid))).join(", ");
      body = `<p>Respuestas guardadas: ${Object.keys(answers).length} de ${final.players.length}.</p>${finalist && !answered ? CT.Final.form(modeKey, "data-local-final") : `<section class="panel"><h2>${answered ? "Tu respuesta está guardada" : "Estás siguiendo la final"}</h2><p>Esperando a ${faltan}. Las cifras se revelan cuando todos hayan respondido.</p></section>`}`;
    }
    paint(`<div class="shell">${header("room-menu", '<button class="icon-btn" data-local-action="room-menu" aria-label="Abrir menú de la sala">Sala</button>')}<h1 data-focus tabindex="-1">Final de desempate</h1><p>Solo juegan ${final.players.map(uid => escapeHtml(name(uid))).join(", ")}: terminaron la misma ronda sin cartas.</p>${CT.Final.question(modeKey, final)}${body}</div>`, "local-final-secreta");
    const form = appEl.querySelector("[data-local-final]");
    if (form && draft?.guess) { form.elements.guess.value = draft.guess; if (form.elements.era && draft.era) form.elements.era.value = draft.era; }
  }

  // Fin de partida: revancha con la misma mesa (la pide quien organiza) o salir.
  function renderFinal() {
    screen = "local-final";
    const uids = (roomState.winners || (roomState.winner ? [roomState.winner] : [])).filter(uid => roomState.players[uid]);
    const names = uids.map(uid => escapeHtml(roomState.players[uid].name) + (uid === myPlayerId ? " (tú)" : ""));
    const title = !names.length ? "Partida terminada" : names.length === 1 ? `${names[0]} gana` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]} ganan`;
    const lead = roomState.final ? "Ha ganado la final con la cifra más cercana." : names.length ? (roomState.playerOrder.length === 1 ? "Es la última persona que queda en la mesa." : "Se ha quedado sin cartas antes que nadie.") : "";
    const isHost = role === "host";
    const puedeRevancha = isHost && roomState.playerOrder.filter(uid => !roomState.players[uid].away).length >= CT.LocalRoom.MIN_PLAYERS;
    const acciones = isHost
      ? `${puedeRevancha ? '<button class="btn btn-primary btn-block" data-local-action="rematch">Revancha con la misma mesa <span>→</span></button>' : ""}<button class="btn ${puedeRevancha ? "btn-secondary" : "btn-primary"} btn-block" data-local-action="close-room">Cerrar la sala</button>`
      : `<p class="hint">Si quien organiza pide revancha, volveréis todos a la sala de espera.</p><button class="btn btn-secondary btn-block" data-local-action="leave">Salir de la sala</button>`;
    paint(`<div class="shell">${header("leave")}<section class="pass-screen"><div class="panel pass-card"><div class="eyebrow">Partida terminada · ${roomState.timeline.length} ${roomState.timeline.length === 1 ? "carta" : "cartas"} en la mesa</div><h2 data-focus tabindex="-1">${title}</h2><p>${lead}</p>${acciones}</div></section></div>`, "local-final");
  }

  function doSelect(id) {
    selectedCardId = Number(id);
    pendingIndex = null;
    renderGame();
  }

  function doPlace(index) { pendingIndex = index; renderGame(); }
  function doCancelPlace() { pendingIndex = null; renderGame(); }

  function doConfirmPlace() {
    if (!selectedCardId || pendingIndex === null) return;
    const cardId = selectedCardId, index = pendingIndex;
    selectedCardId = null; pendingIndex = null;
    attempt("place-card", { cardId, index });
  }

  function doPulsePlace(type) {
    if (pendingIndex === null) return;
    const index = pendingIndex;
    pendingIndex = null;
    attempt(type, { index });
  }

  // ---------------------------------------------------------------------------
  // Eventos
  document.addEventListener("submit", event => {
    if (event.target.matches("[data-local-final]")) {
      event.preventDefault();
      try {
        const values = new FormData(event.target);
        const value = CT.Final.parse(modeKey, values.get("guess"), values.get("era") === "bc");
        attempt("final-answer", { value });
      } catch (error) { showToast(error.message); }
      return;
    }
    const form = event.target.closest("[data-local-form]");
    if (!form) return;
    event.preventDefault();
    const values = new FormData(form);
    const kind = form.dataset.localForm;
    if (kind === "create") {
      const name = String(values.get("name") || "").trim().slice(0, 18);
      if (!name) return showToast("Escribe tu nombre");
      doCreateRoom(name);
    } else if (kind === "join-offer") {
      const name = String(values.get("name") || "").trim().slice(0, 18);
      const offer = String(values.get("offer") || "").trim();
      if (!name) return showToast("Escribe tu nombre");
      if (!offer) return showToast(errorMessage("EMPTY_SIGNAL"));
      void doJoinWithOffer(name, offer);
    } else if (kind === "accept-answer") {
      const answer = String(values.get("answer") || "").trim();
      if (!answer) return showToast("Pega primero la respuesta");
      void acceptPendingAnswer(answer);
    }
  });

  document.addEventListener("change", event => {
    const id = event.target.id;
    if (!["wifi-preset", "wifi-turn-seconds", "wifi-hand-size", "wifi-pulse", "wifi-ghost"].includes(id)) return;
    const pulseBox = document.getElementById("wifi-pulse"), ghostBox = document.getElementById("wifi-ghost");
    if (id === "wifi-preset") {
      if (event.target.value === "custom") return;
      lobbySettings.pulse = lobbySettings.ghost = event.target.value === "advanced";
      if (pulseBox) pulseBox.checked = lobbySettings.pulse;
      if (ghostBox) ghostBox.checked = lobbySettings.ghost;
    } else if (id === "wifi-turn-seconds") lobbySettings.turnSeconds = event.target.value;
    else if (id === "wifi-hand-size") lobbySettings.handSize = event.target.value;
    else if (id === "wifi-pulse") lobbySettings.pulse = event.target.checked;
    else if (id === "wifi-ghost") lobbySettings.ghost = event.target.checked;
    // El desplegable siempre dice lo que hacen las casillas: con un solo poder es «Personalizada».
    lobbySettings.preset = lobbySettings.pulse && lobbySettings.ghost ? "advanced" : !lobbySettings.pulse && !lobbySettings.ghost ? "simple" : "custom";
    const preset = document.getElementById("wifi-preset");
    if (preset) {
      if (lobbySettings.preset === "custom" && !preset.querySelector('option[value="custom"]')) preset.insertAdjacentHTML("beforeend", '<option value="custom">Personalizada</option>');
      preset.value = lobbySettings.preset;
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.id === "starter-guess-input" && screen === "local-lobby") { event.preventDefault(); doStarterGuess(); }
  });

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-local-action]");
    if (!target) return;
    const action = target.dataset.localAction;
    if (action === "back") { if (onBackToMenu) onBackToMenu(); }
    else if (action === "leave") requestLeave();
    else if (action === "room-menu") roomMenu();
    else if (action === "close-room-menu") CT.closeDialog();
    else if (action === "guide") { CT.closeDialog(); showGuide(); }
    else if (action === "close-guide") CT.closeDialog();
    else if (action === "skip") { CT.closeDialog(); doSkipTurn(); }
    else if (action === "rematch") attempt("rematch");
    else if (action === "starter-draw") attempt("starter-draw");
    else if (action === "starter-guess") doStarterGuess();
    else if (action === "go-unirse") renderUnirseForm();
    else if (action === "forget-seat") { forgetSeat(); renderEntrada(); }
    else if (action === "warm-camera") void warmUpCamera();
    else if (action === "go-entrada") renderEntrada();
    else if (action === "local-lobby") { if (roomState) renderCurrent(); else renderEntrada(); }
    else if (action === "invite") { CT.closeDialog?.(); void openInvite(); }
    else if (action === "share-invite") {
      if (!pendingInvite) return;
      void CT.LocalShare.shareSignal(pendingInvite.inviteText, { title: "Continuum · invitación" })
        .then(result => { if (result === "copied") showToast("Código copiado"); })
        .catch(error => showToast(errorMessage(error.message)));
    }
    else if (action === "share-answer") {
      void CT.LocalShare.shareSignal(pendingAnswerText, { title: "Continuum · respuesta" })
        .then(result => { if (result === "copied") showToast("Respuesta copiada"); })
        .catch(error => showToast(errorMessage(error.message)));
    }
    else if (action === "copy-invite") copyToClipboard(pendingInvite?.inviteText, "Código copiado");
    else if (action === "copy-answer") copyToClipboard(pendingAnswerText, "Respuesta copiada");
    else if (action === "scan-answer") openQrScan({
      title: "Escanear respuesta", hint: "Apunta la cámara al código que te enseñe la otra persona.",
      onResult: text => { renderInvitar(false); void acceptPendingAnswer(text); },
      onBack: () => renderInvitar(false)
    });
    else if (action === "nearby-search") {
      const name = String(document.getElementById("local-guest-name")?.value || "").trim().slice(0, 18);
      if (!name) return showToast("Escribe tu nombre antes de buscar");
      void renderNearby(name);
    }
    else if (action === "nearby-join") void doJoinNearby(target.dataset.id);
    else if (action === "scan-offer") {
      const name = String(document.getElementById("local-guest-name")?.value || "").trim().slice(0, 18);
      if (!name) return showToast("Escribe tu nombre antes de escanear");
      openQrScan({
        title: "Escanear invitación", hint: "Apunta la cámara al código que te enseñe quien organiza la sala.",
        onResult: text => { renderUnirseForm(); void doJoinWithOffer(name, text); },
        onBack: () => renderUnirseForm()
      });
    }
    else if (action === "qr-scan-back") { const onBack = qrScanOnBack; qrScanOnBack = null; (onBack || renderEntrada)(); }
    else if (action === "start") doStart();
    else if (action === "close-room") doCloseRoom();
    else if (action === "kick") { const uid = target.dataset.uid, name = roomState?.players[uid]?.name || "esta persona"; CT.UI.confirmDialog("Saldrá de la sala y sus cartas volverán al mazo.", () => { CT.closeDialog?.(); doRemovePlayer(uid); }, { title: `¿Expulsar a ${name}?`, confirmLabel: "Expulsar", cancelLabel: "Cancelar" }); }
    else if (action === "select") doSelect(target.dataset.id);
    else if (action === "place" || action === "pulse-place") doPlace(Number(target.dataset.index));
    else if (action === "confirm-place") doConfirmPlace();
    else if (action === "confirm-pulse") doPulsePlace("pulse-place");
    else if (action === "confirm-defense") doPulsePlace("pulse-defend");
    else if (action === "cancel-place") doCancelPlace();
    else if (action === "finish-turn") attempt("finish-turn");
    else if (action === "ghost-use") { selectedCardId = null; pendingIndex = null; attempt("use-ghost"); }
    else if (action === "pulse-open") openPulse();
    else if (action === "pulse-target") { CT.closeDialog(); selectedCardId = null; pendingIndex = null; attempt("pulse-start", { targetId: target.dataset.target }); }
    else if (action === "final-next") attempt("final-next");
  });

  CT.LocalMultiplayer = { open };
})();
