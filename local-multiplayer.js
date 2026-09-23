// El modo "Sin conexión": varias personas juegan en la misma sala sin ningún tipo de
// internet, por Wi-Fi local (un móvil crea el punto de acceso, el resto se une como a
// cualquier red). Reutiliza exactamente la lógica de `local-room.js` y el canal de
// `local-transport.js` a través de `local-session.js`; este archivo solo pinta las
// pantallas y traduce los toques en acciones, con las mismas clases CSS que ya usa
// `online.js` para la sala compartida (`.panel`, `.online-form`, `.room-code-card`,
// `.lobby-table`, `.timeline-card`, `.hand-card`…) — es la misma mesa, sin Firestore.
//
// Alcance de esta primera versión, heredado de `local-room.js`: sin Fantasma, sin Pulso,
// sin torneo y sin el desempate de final secreta. Sin sorteo de quién empieza: empieza
// siempre quien organiza la sala. Se puede jugar una partida completa de principio a fin.
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
  let screen = "";
  let role = null; // 'host' | 'guest'
  let hostSession = null, guestSession = null;
  let roomState = null;
  let myName = "", myPlayerId = "";
  let pendingInvite = null; // { peerId, offerSignal, acceptAnswer, inviteText }
  let pendingAnswerText = "";
  let selectedCardId = null, pendingIndex = null;
  let busy = false;
  let cardsByIdCache = new Map();

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
    CT.paint(appEl, html, pantalla);
  }

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
    return `<header class="topbar"><button class="icon-btn" data-local-action="${backAction}" aria-label="Volver">${BACK_ICON}</button><div class="brand">Continuum</div><div class="topbar-actions">${actionsHtml}</div></header>`;
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
      TIE_NOT_SUPPORTED_YET: "Varias personas se han quedado sin cartas en la misma ronda. Ese desempate llega en una próxima actualización.",
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

  // También hay que reaccionar desde "invitar" (anfitrión) y "comparte tu respuesta"
  // (invitado): son las pantallas donde cada cual espera a que la conexión cuaje. Sin
  // esto, aunque la sala ya estuviera lista, ninguno de los dos se enteraba y se quedaban
  // mirando "Conectando…" para siempre — había que salir y volver a mano al vestíbulo.
  function onRoomChange(room) {
    roomState = room;
    if (["local-lobby", "local-game", "local-invitar", "local-unirse-compartir"].includes(screen)) renderCurrent();
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
    role = null; hostSession = null; guestSession = null; roomState = null;
    pendingInvite = null; pendingAnswerText = ""; selectedCardId = null; pendingIndex = null;
    cardsByIdCache = new Map();
    renderEntrada();
  }

  function renderEntrada() {
    screen = "local-entrada";
    paint(`<div class="shell online-shell">${header("back")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${escapeHtml(CT.mode(modeKey).name)}</div><h2 data-focus tabindex="-1">Una mesa,<br>varias pantallas — sin internet</h2><p class="lead">Cada persona juega desde su móvil, conectadas por Wi-Fi local, sin ninguna conexión a internet.</p></section>
      ${wifiNote()}
      ${cameraNote()}
      <div class="online-entry-grid">
        <div class="panel online-form"><span class="form-number">01</span><h3>Unirse a una sala</h3><p>Alguien ya ha creado una y te ha pasado su código.</p><button type="button" class="btn btn-primary btn-block" data-local-action="go-unirse">Unirme a la partida <span>→</span></button></div>
        <form class="panel online-form" data-local-form="create"><span class="form-number">02</span><h3>Crear una sala</h3><p>Tú preparas la partida y compartes el código.</p><div class="field"><label for="local-name-host">Tu nombre</label><input id="local-name-host" name="name" maxlength="18" required placeholder="Ej. Fernando" autocomplete="name"></div><button class="btn btn-secondary btn-block" type="submit">Crear sala</button></form>
      </div>
      <p class="online-note">No necesita conexión a internet en ningún momento.</p>
    </div>`, "local-entrada");
  }

  function doCreateRoom(name) {
    role = "host";
    myName = name;
    const roomCode = createRoomCode();
    try {
      hostSession = CT.LocalSession.createHostSession({
        roomCode, hostName: name, modeKey,
        deckFingerprint: CT.deckFingerprint(modeKey),
        onChange: onRoomChange
      });
    } catch (error) { console.error(error); showToast("No se pudo crear la sala"); return; }
    roomState = hostSession.currentRoom();
    renderLobby();
  }

  // Escanear con la cámara es el camino normal — un único código, una única lectura — y
  // pegarlo a mano queda como recurso para cuando la cámara no se pueda usar.
  function renderUnirseForm() {
    screen = "local-unirse";
    paint(`<div class="shell online-shell">${header("go-entrada")}
      <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Invitado</div><h2 data-focus tabindex="-1">Unirse a una sala</h2></section>
      <form class="panel online-form" data-local-form="join-offer">
        <div class="field"><label for="local-guest-name">Tu nombre</label><input id="local-guest-name" name="name" maxlength="18" required placeholder="Ej. Ana" autocomplete="name"></div>
        <button type="button" class="btn btn-primary btn-block" data-local-action="scan-offer">${CAMERA_ICON} Escanear el código del anfitrión</button>
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
      myPlayerId = randomPlayerId();
      modeKey = CT.has(invite.modeKey) ? invite.modeKey : modeKey;
      guestSession = CT.LocalSession.createGuestSession({
        offerSignal: invite.signal, playerId: myPlayerId, name, deckFingerprint: invite.deckFingerprint,
        onChange: onRoomChange,
        onError: code => showToast(errorMessage(code))
      });
      pendingAnswerText = await guestSession.answerSignal();
      renderUnirseCompartir();
    } catch (error) {
      console.error(error);
      showToast(errorMessage(error.message));
    } finally { busy = false; }
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
      <div class="status status-waiting"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>Conectando con la sala…</span></div>
    </div>`, "local-unirse-compartir");
    try { CT.QrEncode.draw(document.getElementById("local-answer-qr"), pendingAnswerText); }
    catch (error) { console.error(error); showToast("No se pudo generar el código QR; usa la opción de compartir a mano."); }
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
        ? `<div class="status status-ok"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>Conectando…</span></div>`
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

  function renderLobby() {
    if (!roomState) return;
    screen = "local-lobby";
    const isHost = role === "host";
    const seats = roomState.playerOrder.map((uid, index) => {
      const player = roomState.players[uid];
      const pos = SEAT_POSITIONS[index] || SEAT_POSITIONS[SEAT_POSITIONS.length - 1];
      const puedeExpulsar = isHost && uid !== roomState.hostId;
      return `<div class="table-seat" style="left:${pos.left};top:${pos.top};"><span class="seat-avatar">${CT.Avatares.markup(player.name, { size: 44 })}</span><strong>${escapeHtml(player.name)}${uid === myPlayerId ? " · tú" : ""}</strong><small>${uid === roomState.hostId ? "Anfitrión" : `Plaza ${index + 1}`}</small><i class="ready-seal">Listo</i>${puedeExpulsar ? `<button class="kick-btn" data-local-action="kick" data-uid="${uid}" aria-label="Expulsar a ${escapeHtml(player.name)}">×</button>` : ""}</div>`;
    }).join("");
    const settings = isHost
      ? `<div class="section-label">Ajustes</div><div class="field"><label for="local-hand-size">Cartas iniciales</label><select id="local-hand-size"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div><div class="field"><label for="local-turn-seconds">Tiempo por turno</label><select id="local-turn-seconds"><option value="0">Sin límite</option><option value="20" selected>20 segundos</option><option value="30">30 segundos</option></select></div>${roomState.playerOrder.length < 2 ? '<p class="hint">Esperando a alguien más…</p>' : '<button class="btn btn-primary btn-block" data-local-action="start">Barajar y empezar</button>'}<button class="btn btn-ghost btn-block" data-local-action="close-room">Cerrar sala</button>`
      : `<div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>La partida comenzará en todos los móviles a la vez.</p>`;
    paint(`<div class="shell online-shell">${header("leave")}
      <section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Sala de espera</div><h2 data-focus tabindex="-1">Preparando la mesa</h2></div><div class="room-code-card"><small>Código de sala</small><strong>${escapeHtml(roomState.roomCode)}</strong>${isHost ? `<div class="room-invite-actions"><button type="button" data-local-action="invite">Invitar a alguien</button></div>` : ""}</div></section>
      <div class="online-lobby-grid">
        <section class="panel lobby-table-panel"><div class="section-label">Mesa de exploradores <small>${roomState.playerOrder.length}/${CT.LocalRoom.MAX_PLAYERS}</small></div><div class="lobby-table"><div class="lobby-table-core"><span>CONTINUUM</span><strong>${roomState.playerOrder.length}</strong><small>${roomState.playerOrder.length === 1 ? "explorador" : "exploradores"}</small></div>${seats}</div><p class="lobby-ready-note"><i>Listo</i> La plaza queda preparada al entrar en la sala.</p></section>
        <section class="panel lobby-settings">${settings}</section>
      </div>
    </div>`, "local-lobby");
  }

  function doStart() {
    if (role !== "host" || busy) return;
    const handSize = Number(document.getElementById("local-hand-size")?.value || 4);
    const turnSeconds = Number(document.getElementById("local-turn-seconds")?.value || 20);
    busy = true;
    try {
      hostSession.act("start", { handSize, turnSeconds, starterId: roomState.hostId });
    } catch (error) { console.error(error); showToast(errorMessage(error.message)); }
    finally { busy = false; }
  }

  function doRemovePlayer(targetId) {
    if (busy) return;
    if (role === "host") {
      try { hostSession.act("remove-player", { targetId }); }
      catch (error) { console.error(error); showToast(errorMessage(error.message)); }
    } else if (targetId === myPlayerId) {
      guestSession.removePlayer(targetId);
      leaveToEntrada();
    }
  }

  function doCloseRoom() {
    if (role !== "host") return;
    if (!confirm("¿Cerrar la sala para todos los participantes?")) return;
    hostSession.close();
    leaveToEntrada();
  }

  function leaveToEntrada() {
    hostSession?.close?.();
    guestSession?.close?.();
    hostSession = null; guestSession = null; roomState = null; role = null;
    renderEntrada();
  }

  // ---------------------------------------------------------------------------
  // Partida
  function renderGame() {
    const currentUid = roomState.playerOrder[roomState.current];
    const currentPlayer = roomState.players[currentUid];
    const myTurn = currentUid === myPlayerId && roomState.phase === "turn";
    const me = roomState.players[myPlayerId];
    if (roomState.status === "ended") { renderFinal(); return; }
    const timelineCards = roomState.timeline.map(id => getCard(id));
    const failIndex = roomState.phase === "reveal" && !roomState.reveal.correct
      ? CT.correctIndex(modeKey, timelineCards, getCard(roomState.reveal.cardId)) : null;
    const slots = [];
    for (let index = 0; index <= timelineCards.length; index++) {
      const selectedCard = selectedCardId ? getCard(selectedCardId) : null;
      slots.push(selectedCard && pendingIndex === index
        ? `<div class="slot-confirm" data-index="${index}"><small>Colocar aquí</small><strong>${escapeHtml(selectedCard.title)}</strong><button class="btn btn-primary btn-block" data-local-action="confirm-place" data-autofocus>Sí, aquí</button><button class="btn btn-ghost btn-block" data-local-action="cancel-place">Cancelar</button></div>`
        : index === failIndex
          ? `<button class="slot slot-correct" data-local-action="place" data-index="${index}" disabled aria-label="Aquí iba la carta que se acaba de fallar"><span>✦</span><small>Aquí</small></button>`
          : `<button class="slot" data-local-action="place" data-index="${index}" ${myTurn && selectedCardId ? "" : "disabled"} aria-label="Colocar en la posición ${index + 1} de ${timelineCards.length + 1}"><span>+</span></button>`);
      if (index < timelineCards.length) {
        const card = timelineCards[index];
        const era = eraForCard(card);
        const animal = usesAnimalArt();
        const body = animal
          ? `${categoryBadge(card)}<div class="card-visual era-${era.key}">${animalArt(card)}</div><div class="card-content"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p><div class="year">${formatValue(card)}</div></div>`
          : `<div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content">${categoryBadge(card)}<div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div>`;
        slots.push(`<article class="timeline-card card-flippable ${animal ? "animal-timeline-card" : ""}" data-id="${card.id}" role="button" tabindex="0" aria-label="${escapeHtml(card.title)}. Toca para ver la explicación.">${body}</article>`);
      }
    }
    paint(`<div class="shell">${header("local-lobby", '<button class="icon-btn" data-local-action="local-lobby" aria-label="Abrir menú de la sala">Sala</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}, ronda ${roomState.round}</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">Ronda ${roomState.round} · Turno ${roomState.turnsInRound + 1} de ${roomState.playerOrder.length}</div><div class="turn-name" aria-hidden="true">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}</div></div><div class="deck-count"><strong>${roomState.deck.length}</strong><span>mazo</span></div></div>
      <div class="scoreboard">${roomState.playerOrder.map(uid => { const player = roomState.players[uid]; return `<span class="score ${uid === currentUid ? "active" : ""}"${uid === currentUid ? ' aria-current="true"' : ""}><i class="score-avatar">${CT.Avatares.markup(player.name, { size: 28 })}</i><b>${escapeHtml(player.name)}${uid === myPlayerId ? " · tú" : ""}</b><em>${player.hand.length}</em></span>`; }).join("")}</div>
      <section><div class="hand-title"><h3>${timelineTitle()}</h3><small>${roomState.timeline.length} ${roomState.timeline.length === 1 ? "carta" : "cartas"}</small></div><div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
      ${roomState.phase === "reveal" ? revealPanel(currentUid) : `<section><div class="hand-title"><h3>Tu mano</h3><small>${me.hand.length} por colocar</small></div><div class="hand">${me.hand.map(id => { const card = getCard(id); return `<button class="hand-card ${selectedCardId === id ? "selected" : ""}" data-local-action="select" data-id="${id}" aria-pressed="${selectedCardId === id}" ${myTurn ? "" : "disabled"}>${categoryBadge(card)}<span class="hidden-date">${hiddenLabel()}</span>${cardBack()}<strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`; }).join("")}</div><p class="hint">${myTurn ? (pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Toca una carta para seleccionarla y después un hueco +") : `${escapeHtml(currentPlayer.name)} está pensando dónde colocar su carta…`}</p></section>`}
    </div>`, "local-game");
  }

  function revealPanel(currentUid) {
    const reveal = roomState.reveal;
    const card = getCard(reveal.cardId);
    const canContinue = myPlayerId === currentUid || role === "host";
    return `<section class="panel reveal-panel"><div class="eyebrow">${reveal.correct ? "Acierto" : "Fallo"}</div><h3>${escapeHtml(card.title)}</h3><p>${formatValue(card)}</p>${canContinue ? '<button class="btn btn-primary btn-block" data-local-action="finish-turn">Continuar</button>' : '<p class="hint">Esperando para seguir…</p>'}</section>`;
  }

  function renderFinal() {
    screen = "local-final";
    const winnerName = roomState.winner ? roomState.players[roomState.winner]?.name : null;
    paint(`<div class="shell">${header("local-lobby")}<section class="pass-screen"><div class="panel pass-card"><div class="eyebrow">Partida terminada</div><h2 data-focus tabindex="-1">${winnerName ? `${escapeHtml(winnerName)} gana` : "Partida terminada"}</h2><p>${winnerName ? "Se ha quedado sin cartas antes que nadie." : ""}</p><button class="btn btn-primary btn-block" data-local-action="close-room">Salir de la sala</button></div></section></div>`, "local-final");
  }

  function doSelect(id) {
    selectedCardId = Number(id);
    pendingIndex = null;
    renderGame();
  }

  function doPlace(index) { pendingIndex = index; renderGame(); }
  function doCancelPlace() { pendingIndex = null; renderGame(); }

  function doConfirmPlace() {
    if (!selectedCardId || pendingIndex === null || busy) return;
    const cardId = selectedCardId, index = pendingIndex;
    selectedCardId = null; pendingIndex = null;
    busy = true;
    try {
      if (role === "host") hostSession.act("place-card", { cardId, index });
      else guestSession.placeCard(cardId, index);
    } catch (error) { console.error(error); showToast(errorMessage(error.message)); }
    finally { busy = false; }
  }

  function doFinishTurn() {
    if (busy) return;
    busy = true;
    try {
      if (role === "host") hostSession.act("finish-turn", {});
      else guestSession.finishTurn();
    } catch (error) {
      if (error.message !== "NOT_ALLOWED") { console.error(error); showToast(errorMessage(error.message)); }
    } finally { busy = false; }
  }

  // ---------------------------------------------------------------------------
  // Eventos
  document.addEventListener("submit", event => {
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

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-local-action]");
    if (!target) return;
    const action = target.dataset.localAction;
    if (action === "back") { if (onBackToMenu) onBackToMenu(); }
    else if (action === "leave") leaveToEntrada();
    else if (action === "go-unirse") renderUnirseForm();
    else if (action === "warm-camera") void warmUpCamera();
    else if (action === "go-entrada") renderEntrada();
    else if (action === "local-lobby") { if (roomState) renderLobby(); else renderEntrada(); }
    else if (action === "invite") void openInvite();
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
    else if (action === "kick") { const name = roomState?.players[target.dataset.uid]?.name || "esta persona"; if (confirm(`¿Expulsar a ${name} de la sala?`)) doRemovePlayer(target.dataset.uid); }
    else if (action === "select") doSelect(target.dataset.id);
    else if (action === "place") doPlace(Number(target.dataset.index));
    else if (action === "confirm-place") doConfirmPlace();
    else if (action === "cancel-place") doCancelPlace();
    else if (action === "finish-turn") doFinishTurn();
  });

  CT.LocalMultiplayer = { open };
})();
