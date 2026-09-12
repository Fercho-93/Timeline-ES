import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { deleteDoc, disableNetwork, doc, enableNetwork, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAT-ELQvHrBdMaCdxJNUJzDRwq1jOOwI44",
  authDomain: "timeline-es.firebaseapp.com",
  projectId: "timeline-es",
  storageBucket: "timeline-es.firebasestorage.app",
  messagingSenderId: "572227626442",
  appId: "1:572227626442:web:f7c1ad0d66de6f02d79b33"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appEl = document.getElementById("app");
const toastEl = document.getElementById("toast");
// Las modalidades, sus ejes y estos ayudantes están en modes.js, que ya está cargado
// cuando este módulo se descarga: se pide al entrar en el modo de varios móviles.
const CT = window.CONTINUUM;
const { escapeHtml, initials, shuffle, announce } = CT;
// Igual que en el juego local: pintar conserva el foco del teclado, y las capas se abren
// como diálogos de verdad. Está en `a11y.js`, compartido por los dos motores.
const paint = (html, pantalla) => { CT.Scene.apply(selectedModeKey, pantalla); CT.paint(appEl, html, pantalla); queueMicrotask(renderPresence); };
const abreCapa = (capa, cerrable) => CT.openDialog(capa, cerrable);
const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let user = null;
let returnToMenu = null;
let entryRequest = 0;
let roomCode = "";
let roomRef = null;
let roomState = null;
let unsubscribeRoom = null;
let selectedCardId = null;
let pendingIndex = null;
let busy = false;
let selectedModeKey = "history";
let competitionOptions = null;
let onlineCompetitionIntroIndex = null;
let seenSelfInRoom = false;
let lastEffectVersion = null;
let lastObservedTurnUid = null;
let lastObservedRoomVersion = null;
let fallbackTimerVersion = null;
let fallbackTimerStartedAt = 0;
let turnTimerHandle = null;
// Cada turno tiene 20 segundos para colocar la carta; si se agotan, pasa al siguiente
// jugador. `turnStartedAt` es la marca del servidor, así que la cuenta atrás se ve igual
// en todos los móviles aunque sus relojes no coincidan.
const TURN_SECONDS = 20; // Valor de las salas antiguas; las nuevas guardan su ajuste.
const CLIENT_VERSION = 42; // Competición con cambio de mazo entre rondas.
const turnSeconds = () => roomState?.turnSeconds ?? TURN_SECONDS;
let presenceRoom = "", presenceTimer = null, presenceBusy = false;
const presenceListeners = new Map(), presenceRecords = new Map();
let connectionMessage = "Conectando con la sala…";
function stopPresence() {
  clearInterval(presenceTimer); presenceTimer = null; presenceRoom = "";
  for (const stop of presenceListeners.values()) stop();
  presenceListeners.clear(); presenceRecords.clear();
}
async function heartbeat() {
  if (presenceBusy || !roomRef || !user || !navigator.onLine) return;
  presenceBusy = true;
  const code = roomCode, sent = performance.now();
  try {
    const reference = doc(db, "rooms", code, "presence", user.uid);
    await setDoc(reference, { seenAt: serverTimestamp(), visible: document.visibilityState === "visible" });
    const confirmed = await getDoc(reference);
    if (code !== roomCode) return;
    const time = confirmed.data()?.seenAt?.toMillis?.();
    CT.Session.calibrate(time, sent);
    connectionMessage = "Conexión confirmada";
  } catch { connectionMessage = "Sin confirmación del servidor. Conserva esta pantalla y reintenta al volver la conexión."; }
  finally { presenceBusy = false; renderPresence(); }
}
function ensurePresence() {
  if (presenceRoom !== roomCode) {
    stopPresence(); presenceRoom = roomCode;
    void heartbeat();
    presenceTimer = setInterval(() => { if (document.visibilityState === "visible") void heartbeat(); }, 45000);
  }
  for (const uid of roomState.playerOrder) {
    if (presenceListeners.has(uid)) continue;
    const stop = onSnapshot(doc(db, "rooms", roomCode, "presence", uid), snap => {
      const p = snap.data();
      if (p?.seenAt?.toMillis) presenceRecords.set(uid, { seenAt: p.seenAt.toMillis(), visible: p.visible });
      renderPresence();
    }, () => { connectionMessage = "La presencia requiere las reglas actualizadas de la sala."; renderPresence(); });
    presenceListeners.set(uid, stop);
  }
  for (const [uid, stop] of presenceListeners) if (!roomState.playerOrder.includes(uid)) { stop(); presenceListeners.delete(uid); presenceRecords.delete(uid); }
}
function canClaimHost() {
  if (!roomState || !user || roomState.hostUid === user.uid || !navigator.onLine || roomState.status === "ended") return false;
  const now = CT.Session.now(), host = presenceRecords.get(roomState.hostUid);
  const last = host?.seenAt ?? roomState.updatedAt?.toMillis?.();
  return now !== null && Number.isFinite(last) && now - last > (host?.visible === false ? 15000 : 90000);
}
function renderPresence() {
  if (!roomState || !user) return;
  // La presencia sigue activa para reconexión y relevo del anfitrión, pero durante la
  // partida no se muestra: la pantalla debe quedar centrada en el juego.
  if (roomState.status === "playing") {
    appEl.querySelector("#room-connection")?.remove();
    return;
  }
  const shell = appEl.querySelector(".shell");
  if (!shell) return;
  let box = shell.querySelector("#room-connection");
  if (!box) { box = document.createElement("aside"); box.id = "room-connection"; box.className = "room-connection"; shell.querySelector("header")?.after(box); }
  const current = roomState.playerOrder[roomState.current];
  const task = roomState.phase === "pulse" ? (roomState.pulseTurn?.stage === "defensa" ? roomState.pulseTurn.targetUid : current) : current;
  const instruction = roomState.status === "playing" ? (roomState.phase === "reveal" ? "Resultado listo: podéis continuar." : task === user.uid ? (roomState.phase === "pulse" ? "Te toca colocar la carta del Pulso." : "Te toca elegir una carta y colocarla.") : "Esperando a " + (roomState.players[task]?.name || "otro participante") + ".") : "";
  box.innerHTML = '<p role="status">' + escapeHtml(navigator.onLine ? connectionMessage : "Sin conexión. La sala se recuperará al volver la red.") + ' ' + escapeHtml(instruction) + '</p><details><summary>Conexión de participantes</summary><ul>'
    + roomState.playerOrder.map(uid => '<li>' + escapeHtml(roomState.players[uid].name) + ': ' + escapeHtml(CT.Session.presence(presenceRecords.get(uid))) + '</li>').join("") + '</ul></details>'
    + (canClaimHost() ? '<button class="btn btn-secondary" data-online-action="claim-host">Tomar relevo del anfitrión</button>' : '');
}
async function claimHost() {
  if (busy || !canClaimHost()) return;
  busy = true;
  try {
    await runTransaction(db, async tx => {
      const current = (await tx.get(roomRef)).data();
      if (!current.playerOrder.includes(user.uid) || current.status === "ended") throw Error("Sala no disponible");
      tx.update(roomRef, { hostUid: user.uid, version: current.version + 1, updatedAt: serverTimestamp() });
    });
  } catch { showToast("El anfitrión ha vuelto o alguien ya tomó el relevo. La sala sigue guardada."); }
  finally { busy = false; }
}

// La modalidad la manda la sala; solo antes de entrar en una vale la elegida en la portada.
function modeKey() { return roomState?.mode || selectedModeKey; }

function formatValue(card) { return CT.formatValue(modeKey(), card); }

function sortValue(card) { return CT.sortValue(modeKey(), card); }

function hiddenLabel() { return CT.hiddenLabel(modeKey()); }

function timelineTitle() { return CT.timelineTitle(modeKey()); }

function eraForCard(card) { return CT.eraForCard(modeKey(), card); }

function modeCards(key = modeKey()) { return CT.cards(key); }

// Igual que en el juego local: las láminas de animales no llevan cifras, así que pueden
// verse en la mano sin revelar el dato que hay que ordenar.
function usesAnimalArt() { return CT.usesAnimalArt(modeKey()); }
function animalArt(card) { return CT.animalArt(modeKey(), card); }
function categoryBadge(card) { return CT.categoryBadge(modeKey(), card); }

// Un mapa por modalidad, no uno solo: la modalidad puede cambiar entre partidas (aunque
// nunca a mitad de una) y cada mazo conserva sus propios identificadores. Se construye la
// primera vez que se pide y se reutiliza después, en vez de recorrer el mazo entero —hasta
// 673 cartas en Gran mezcla— en cada carta de la línea y de la mano, en cada instantánea
// de la sala.
const cardsByIdCache = new Map();
function cardsById(key = modeKey()) {
  let map = cardsByIdCache.get(key);
  if (!map) {
    map = new Map(modeCards(key).map(card => [card.id, card]));
    cardsByIdCache.set(key, map);
  }
  return map;
}

function getCard(id) {
  return cardsById().get(id);
}

function header(extra = "") {
  return `<header class="topbar"><div class="brand">Continuum <span class="live-badge"><i></i> EN DIRECTO</span></div><div class="topbar-actions">${extra}${CT.settingsButton()}</div></header>${roomState?.tournament ? `<p class="eyebrow">Competición · ronda ${roomState.tournament.index+1} de ${roomState.tournament.queue.length} · ${escapeHtml(CT.mode(modeKey()).name)}</p>` : ''}`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function showGuide() {
  const mode = modeKey();
  appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-online-guide><div class="modal rules"><div class="guide-tools"><button type="button" class="icon-btn guide-close" data-online-action="close-guide" aria-label="Cerrar guía">×</button></div><div class="guide-content">${CT.guideMarkup(mode, "online", { pulse: !!roomState?.pulse, ghost: roomState?.status === "playing" ? !!roomState.ghost : true })}</div><button class="btn btn-primary btn-block" data-online-action="close-guide">Entendido</button></div></div>`);
  abreCapa(appEl.querySelector("[data-online-guide]"), true);
}

function createRoomCode() {
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return [...values].map(value => ROOM_CHARS[value % ROOM_CHARS.length]).join("");
}

function cleanCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
}

function invitationUrl(code = roomCode) {
  const url = new URL(CT.Links.base());
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", code);
  return url.toString();
}

// El enlace público sirve para compartir, no para cambiar la URL de Capacitor.
// Actualizar la barra del navegador es opcional: nunca debe impedir entrar a una
// sala que Firebase ya ha guardado.
function updateRoomAddress(code) {
  if (window.Capacitor?.isNativePlatform?.()) return;
  try {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("room", code);
    history.replaceState({}, "", url.toString());
  } catch (error) {
    console.warn("No se pudo actualizar la dirección de la sala", error);
  }
}

function roomErrorMessage(error, fallback) {
  if (error.code === "unavailable" || error.code === "auth/network-request-failed") {
    return "No se pudo contactar con el servidor. Comprueba la conexión y vuelve a intentarlo.";
  }
  if (error.code === "permission-denied") {
    return "El servidor ha rechazado la operación. Si acabas de crear una sala, espera 30 segundos; si persiste, hay que revisar los permisos del juego.";
  }
  return fallback;
}

function gfMultiply(x, y) {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((y >>> i) & 1) * x;
  }
  return result;
}

function reedSolomonDivisor(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = Array(divisor.length).fill(0);
  data.forEach(byte => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((value, index) => { result[index] ^= gfMultiply(value, factor); });
  });
  return result;
}

function makeQrMatrix(text) {
  const version = 5;
  const size = version * 4 + 17;
  const dataCodewords = 108;
  const errorCodewords = 26;
  const bytes = [...new TextEncoder().encode(text)];
  if (bytes.length > 106) throw new Error("QR_TEXT_TOO_LONG");
  const bits = [];
  const appendBits = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  appendBits(0x4, 4);
  appendBits(bytes.length, 8);
  bytes.forEach(byte => appendBits(byte, 8));
  appendBits(0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xec ^ 0x11) data.push(pad);
  const error = reedSolomonRemainder(data, reedSolomonDivisor(errorCodewords));
  const allBits = [];
  [...data, ...error].forEach(byte => { for (let i = 7; i >= 0; i--) allBits.push((byte >>> i) & 1); });

  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunction = (x, y, dark) => {
    if (x >= 0 && x < size && y >= 0 && y < size) { modules[y][x] = Boolean(dark); isFunction[y][x] = true; }
  };
  const drawFinder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
    }
  };
  const drawAlignment = (cx, cy) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  };
  for (let i = 0; i < size; i++) { setFunction(6, i, i % 2 === 0); setFunction(i, 6, i % 2 === 0); }
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
  drawAlignment(30, 30);

  const formatData = 8;
  let remainder = formatData;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  const formatBits = ((formatData << 10) | remainder) ^ 0x5412;
  const formatBit = index => ((formatBits >>> index) & 1) !== 0;
  for (let i = 0; i <= 5; i++) setFunction(8, i, formatBit(i));
  setFunction(8, 7, formatBit(6)); setFunction(8, 8, formatBit(7)); setFunction(7, 8, formatBit(8));
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, formatBit(i));
  for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, formatBit(i));
  setFunction(8, size - 8, true);

  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column++) {
        const x = right - column;
        if (isFunction[y][x]) continue;
        let dark = bitIndex < allBits.length ? allBits[bitIndex] !== 0 : false;
        bitIndex += 1;
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
      }
    }
  }
  return modules;
}

function drawQr(canvas, text) {
  const matrix = makeQrMatrix(text);
  const quietZone = 4;
  const targetSize = 260;
  const scale = Math.floor(targetSize / (matrix.length + quietZone * 2));
  const size = (matrix.length + quietZone * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#211b16";
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) context.fillRect((x + quietZone) * scale, (y + quietZone) * scale, scale, scale);
  }));
}

function rememberRoom(code, name) {
  CT.Storage.setItem(`hilo-online-${code}`, JSON.stringify({ name }));
}

function rememberedRoom(code) {
  try { return JSON.parse(CT.Storage.getItem(`hilo-online-${code}`)); }
  catch { return null; }
}

let protectionReady;
async function ensureProtection() {
  const config = CT.Deployment;
  if (!config?.appCheckSiteKey || window.Capacitor?.isNativePlatform?.()) {
    if (config?.audience === 'public') throw Error('Falta configurar la protección de las salas para esta plataforma.');
    return;
  }
  protectionReady ||= import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js').then(({initializeAppCheck,ReCaptchaEnterpriseProvider}) => {
    initializeAppCheck(firebaseApp,{provider:new ReCaptchaEnterpriseProvider(config.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  }).catch(error => { protectionReady=null; throw error; });
  await protectionReady;
}
async function ensureAuth() {
  await ensureProtection();
  if (auth.currentUser) {
    user = auth.currentUser;
    return user;
  }
  return new Promise((resolve, reject) => {
    let signingIn = false;
    const stop = onAuthStateChanged(auth, async current => {
      if (current) {
        user = current;
        stop();
        resolve(current);
      } else if (!signingIn) {
        signingIn = true;
        try { await signInAnonymously(auth); }
        catch (error) { stop(); reject(error); }
      }
    }, reject);
  });
}

export async function openOnlineMode(options = {}) {
  const request = ++entryRequest;
  returnToMenu = typeof options.onBack === "function" ? options.onBack : null;
  selectedModeKey = CT.has(options.modeKey) ? options.modeKey : CT.DEFAULT_MODE;
  competitionOptions = options.competition || null;
  renderEntry(cleanCode(options.roomCode));
  await ensureAuth();
  if (request !== entryRequest) return;
  const invited = cleanCode(options.roomCode);
  if (!invited) return;
  try {
    const reference = doc(db, "rooms", invited);
    const snapshot = await getDoc(reference);
    if (request !== entryRequest) return;
    if (snapshot.exists() && snapshot.data().playerOrder.includes(user.uid)) {
      connectToRoom(invited);
    }
  } catch {
    // A new guest may only read a lobby after entering a name.
  }
}

function renderEntry(invited = "") {
  const known = invited ? rememberedRoom(invited) : null;
  paint(`<div class="shell online-shell">${header('<button class="icon-btn" data-online-action="guide">Guía</button><button class="icon-btn" data-online-action="back">Salir</button>')}
    <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${CT.mode(selectedModeKey).name}</div><h2 data-focus tabindex="-1">Una mesa,<br>varias pantallas</h2><p class="lead">Cada persona juega desde su móvil y todos ven la línea temporal avanzar en directo.</p></section>
    <div class="online-entry-grid${invited ? " online-entry-invited" : ""}">
      <form class="panel online-form" data-online-form="join"><span class="form-number">01</span><h3>${invited ? "Te han invitado a una sala" : "Entrar en una sala"}</h3><p>${invited ? "Introduce tu nombre para unirte a la partida compartida." : "Usa el código que aparece en el móvil anfitrión."}</p><div class="field"><label for="online-code">Código de sala</label><input id="online-code" name="code" class="room-code-input" maxlength="8" required placeholder="ABCD2345" value="${escapeHtml(invited)}" autocapitalize="characters" autocomplete="off"></div><div class="field"><label for="online-player-name">Tu nombre</label><input id="online-player-name" name="name" maxlength="18" required placeholder="Ej. Lucía" autocomplete="name" value="${escapeHtml(known?.name || "")}"></div><button class="btn btn-primary btn-block" type="submit">Unirme a la partida <span>→</span></button></form>
      ${invited ? "" : '<form class="panel online-form" data-online-form="create"><span class="form-number">02</span><h3>Crear una sala</h3><p>Tú preparas la partida y compartes el código.</p><div class="field"><label for="online-host-name">Tu nombre</label><input id="online-host-name" name="name" maxlength="18" required placeholder="Ej. Fernando" autocomplete="name"></div><button class="btn btn-secondary btn-block" type="submit">Crear sala</button></form>'}
    </div>
    <p class="online-note">Necesita conexión a internet durante la partida compartida.</p>
  </div>`, "online-entry");
  if (competitionOptions && !invited) {
    appEl.querySelector('.online-intro .eyebrow').textContent='Competición multijugador';
    appEl.querySelector('.online-intro .lead').textContent=`${competitionOptions.rounds} rondas con mazos aleatorios, ${competitionOptions.cards} cartas por persona. Un punto por ronda ganada.`;
  }
}

async function createRoom(name) {
  if (busy) return;
  busy = true;
  try {
    await ensureAuth();
    const tournament = competitionOptions ? CT.Tournament.create(competitionOptions.rounds,competitionOptions.cards) : null;
    if (tournament) {
      try { await getDoc(doc(db,'capabilities','multiCompetition')); }
      catch { showToast('Falta actualizar el servicio de salas para Competición multijugador.'); return; }
      selectedModeKey=tournament.queue[0];
    }
    const code = createRoomCode();
    const reference = doc(db, "rooms", code);
    const batch = writeBatch(db);
    batch.set(doc(db,'roomCreation',user.uid),{lastCreatedAt:serverTimestamp(),roomCode:code});
    batch.set(reference, {
      roomCode: code,
      ...(tournament ? {tournament} : {}),
      mode: selectedModeKey,
      deckFingerprint: CT.deckFingerprint(selectedModeKey),
      hostUid: user.uid,
      status: "lobby",
      phase: "lobby",
      version: 1,
      handSize: tournament?.handSize || 4, turnSeconds: 30,
      playerOrder: [user.uid],
      players: { [user.uid]: { name, hand: [], joinedAt: Date.now(), clientVersion: CLIENT_VERSION } },
      deck: [], discard: [], timeline: [], current: 0, starter: user.uid,
      turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await batch.commit();
    rememberRoom(code, name);
    updateRoomAddress(code);
    connectToRoom(code);
  } catch (error) {
    console.error(error);
    showToast(roomErrorMessage(error, "No se pudo crear la sala. Vuelve a intentarlo; si persiste, comunica el error."));
  } finally { busy = false; }
}

async function joinRoom(code, name) {
  if (busy) return;
  busy = true;
  try {
    await ensureAuth();
    const reference = doc(db, "rooms", code);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error("ROOM_NOT_FOUND");
      const data = snapshot.data();
      // Si los dos móviles llevan versiones distintas, el mazo puede haber cambiado —ha
      // pasado con animales, países y distancias— y entonces un mismo identificador de
      // carta señalaría cosas distintas en cada pantalla. Mejor avisar aquí que dejar
      // que la partida se reparta mal o se rompa a mitad de jugarla.
      if (data.deckFingerprint && data.deckFingerprint !== CT.deckFingerprint(data.mode)) throw new Error("DECK_MISMATCH");
      if (data.playerOrder.includes(user.uid)) return;
      if (data.status !== "lobby") throw new Error("ALREADY_STARTED");
      if (data.playerOrder.length >= 9) throw new Error("ROOM_FULL");
      transaction.update(reference, {
        players: { ...data.players, [user.uid]: { name, hand: [], joinedAt: Date.now(), clientVersion: CLIENT_VERSION } },
        playerOrder: [...data.playerOrder, user.uid],
        version: data.version + 1,
        updatedAt: serverTimestamp()
      });
    });
    rememberRoom(code, name);
    updateRoomAddress(code);
    connectToRoom(code);
  } catch (error) {
    const messages = { ROOM_NOT_FOUND: "No existe ninguna sala con ese código", ALREADY_STARTED: "La partida ya ha comenzado", ROOM_FULL: "La sala ya tiene 9 participantes", DECK_MISMATCH: "Tu móvil lleva una versión distinta del juego. Actualiza la aplicación para poder entrar." };
    console.error(error);
    showToast(messages[error.message] || roomErrorMessage(error, "No se pudo entrar en la sala. Vuelve a intentarlo; si persiste, comunica el error."));
  } finally { busy = false; }
}

function connectToRoom(code) {
  unsubscribeRoom?.();
  roomCode = code;
  roomRef = doc(db, "rooms", code);
  CT.Storage.setItem("continuum-last-room", code);
  seenSelfInRoom = false;
  lastEffectVersion = null;
  lastObservedTurnUid = null;
  lastObservedRoomVersion = null;
  fallbackTimerVersion = null;
  fallbackTimerStartedAt = 0;
  unsubscribeRoom = onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) {
      // Mismo motivo: una caché aún sin la sala no significa que la hayan cerrado.
      if (!seenSelfInRoom && snapshot.metadata.fromCache) return;
      leaveOnline("La sala ha sido cerrada");
      return;
    }
    const previousTurnUid = lastObservedTurnUid;
    const previousRoomVersion = lastObservedRoomVersion;
    const previousState = roomState;
    roomState = snapshot.data();
    CT.onlineActive = roomState.status !== "ended";
    const observedTurnUid = roomState.status === "playing"
      ? roomState.playerOrder[roomState.current]
      : null;
    const turnChanged = Boolean(
      previousTurnUid &&
      observedTurnUid &&
      previousTurnUid !== observedTurnUid &&
      previousRoomVersion !== roomState.version &&
      roomState.phase === "turn"
    );
    lastObservedTurnUid = observedTurnUid;
    lastObservedRoomVersion = roomState.version;
    roomState.mode = roomState.mode || "history";
    selectedModeKey = roomState.mode;
    if (roomState.playerOrder.includes(user.uid)) seenSelfInRoom = true;
    else if (!seenSelfInRoom && snapshot.metadata.fromCache) {
      // Al abrir el enlace de invitación se lee la sala, así que la primera instantánea
      // llega de la caché con la foto anterior a nuestra entrada. No es una expulsión.
      return;
    } else {
      leaveOnline("Ya no estás en esta sala");
      return;
    }
    ensurePresence();
    if (roomState.phase !== "turn") pendingIndex = null;
    anotaProgreso();
    if (roomState.status === "lobby") renderLobby();
    else if (roomState.status === "ended") renderWinner();
    else if (roomState.phase === "final") { clearTurnTimer(); void renderOnlineFinal(); }
    else if (roomState.phase === "tiebreak") {
      clearTurnTimer();
      paint(`<div class="shell">${header()}<h1 data-focus tabindex="-1">Repartiendo el desempate</h1><p>Quedan ${roomState.tieQueue.length} cartas por repartir. La partida continúa cuando termine el reparto.</p><button class="btn btn-primary" data-online-action="continue-tie">Continuar reparto</button></div>`, 'online-tiebreak');
      if (!snapshot.metadata.fromCache) void continueTie();
    }
    else {
      if (roomState.tournament && onlineCompetitionIntroIndex !== roomState.tournament.index) {
        onlineCompetitionIntroIndex = roomState.tournament.index;
        renderCompetitionIntro();
        return;
      }
      renderGame();
      if (turnChanged) showTurnChangeSplash(observedTurnUid, previousState);
    }
  }, error => {
    console.error(error);
    if (error.code === "permission-denied") leaveOnline("Ya no estás en esta sala");
    else showToast("Se perdió la conexión con la sala");
  });
}

// El perfil se alimenta desde aquí, en el único sitio por el que pasa cada cambio de la
// sala, y no dentro de las transacciones: una transacción puede reintentarse, y la
// instantánea que la confirma es la que cuenta. Todo lo demás —no contar las jugadas
// ajenas, no contar dos veces la misma— lo resuelve `CT.Progreso`, que es quien recuerda
// entre recargas qué versiones de la sala ya vio.
function showTurnChangeSplash(nextUid, previousState = null) {
  const nextName = roomState?.players?.[nextUid]?.name || "el siguiente jugador";
  const isMine = nextUid === user.uid;
  // El cambio de jugador no implica perder el turno: también ocurre al acertar.
  // Sin un resultado confirmado, mostramos un mensaje neutral (salto o reconexión).
  const myResult = previousState?.phase === "reveal" && previousState.reveal?.playerUid === user.uid
    ? previousState.reveal : null;
  const heading = isMine ? "Ahora te toca a ti" : myResult?.correct ? "¡Carta bien colocada!" : myResult ? "Turno completado" : "Cambio de turno";
  appEl.querySelector("[data-turn-change-splash]")?.remove();
  appEl.insertAdjacentHTML("beforeend", `<div class="overlay turn-change-splash" data-turn-change-splash role="status" aria-live="assertive">
    <div class="modal turn-change-card">
      <div class="turn-change-mark" aria-hidden="true">${myResult?.correct && !isMine ? "✓" : isMine ? "✦" : "→"}</div>
      <div class="eyebrow">${isMine ? "Tu turno" : "Cambio de turno"}</div>
      <h2>${heading}</h2>
      <p>${isMine ? "Elige una carta y colócala en la línea temporal." : `Le toca a <strong>${escapeHtml(nextName)}</strong>.`}</p>
    </div>
  </div>`);
  const splash = appEl.querySelector("[data-turn-change-splash]");
  window.setTimeout(() => splash?.remove(), 2000);
}
function anotaProgreso() {
  if (lastEffectVersion !== null && lastEffectVersion !== roomState.version && roomState.phase === "reveal" && roomState.reveal?.playerUid === user.uid) CT.Effects.feedback(roomState.reveal.correct);
  lastEffectVersion = roomState.version;
  const nuevos = [];
  if (roomState.phase === "reveal" && roomState.reveal) {
    const { reveal } = roomState;
    nuevos.push(...CT.Progreso.recordOnline({
      code: roomCode, version: roomState.version, mine: reveal.playerUid === user.uid,
      mode: modeKey(), cardId: reveal.cardId, correct: !!reveal.correct,
      hidden: !!roomState.ghost?.pending.length, pulse: !!reveal.pulse
    }));
  }
  if (roomState.status === "ended") {
    const ganadores = roomState.winners || (roomState.winner ? [roomState.winner] : []);
    nuevos.push(...CT.Progreso.finishOnline({
      code: roomCode, version: roomState.version, mode: modeKey(), won: ganadores.includes(user.uid)
    }));
  }
  if (nuevos.length) {
    showToast(nuevos.length === 1 ? `Logro: ${nuevos[0].name}` : `${nuevos.length} logros nuevos`);
    announce(nuevos.map(item => `Logro desbloqueado: ${item.name}.`).join(" "));
  }
}

function renderLobby() {
  clearTurnTimer();
  const isHost = roomState.hostUid === user.uid;
  const people = roomState.playerOrder.map(uid => roomState.players[uid]);
  paint(`<div class="shell online-shell">${header(`<button class="icon-btn" data-online-action="guide">Guía</button>${isHost ? '<button class="icon-btn" data-online-action="leave">Salir</button>' : '<button class="icon-btn" data-online-action="leave-room">Salir</button>'}`)}
    <section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Sala de espera</div><h2 data-focus tabindex="-1">Preparando la mesa</h2></div><div class="room-code-card"><small>Código de sala</small><strong>${roomCode}</strong><div class="room-invite-actions"><button data-online-action="share">Compartir enlace</button><button data-online-action="qr">Mostrar QR</button></div></div></section>
    <div class="online-lobby-grid"><section class="panel"><div class="section-label">Participantes <small>${people.length}/9</small></div><div class="lobby-players">${roomState.playerOrder.map((uid, index) => { const player = roomState.players[uid]; return `<div class="lobby-player"><span>${escapeHtml(initials(player.name))}</span><div><strong>${escapeHtml(player.name)}${uid === user.uid ? " · tú" : ""}</strong><small>${uid === roomState.hostUid ? "Anfitrión" : `Participante ${index + 1}`}</small></div>${isHost && uid !== roomState.hostUid ? `<button class="kick-btn" data-online-action="kick" data-uid="${uid}">Expulsar</button>` : "<i>✓</i>"}</div>`; }).join("")}</div></section>
      <section class="panel lobby-settings">${isHost ? `<div class="section-label">Ajustes</div><div class="field"><label for="online-preset">Tipo de partida</label><select id="online-preset"><option value="simple">Primera partida · sin poderes</option><option value="advanced">Avanzada · Pulso y Fantasma</option></select></div><div class="field"><label for="online-turn-seconds">Tiempo por turno</label><select id="online-turn-seconds"><option value="0">Sin límite</option><option value="20">20 segundos</option><option value="30" selected>30 segundos</option><option value="45">45 segundos</option></select></div><div class="field"><label for="online-hand-size">Cartas iniciales</label><select id="online-hand-size"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div><div class="field"><label for="online-starter">La persona más joven</label><select id="online-starter">${roomState.playerOrder.map(uid => `<option value="${uid}">${escapeHtml(roomState.players[uid].name)}</option>`).join("")}</select></div><label class="opt-row"><span>Cartas Pulso <small>Esconde de 1 a 3 poderes Pulso con el mismo reparto que Fantasma.</small></span><input type="checkbox" id="online-pulse"></label><label class="opt-row"><span>Cartas Fantasma <small>De 1 a 3 poderes ocultos según los jugadores. Pueden quedarse sin descubrir. Requiere reglas v39.</small></span><input type="checkbox" id="online-ghost"></label><button class="btn btn-primary btn-block" data-online-action="start" ${people.length < 2 ? "disabled" : ""}>${people.length < 2 ? "Esperando a alguien más…" : "Barajar y empezar →"}</button><button class="btn btn-ghost btn-block" data-online-action="close-room">Cerrar sala</button>` : `<div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>La partida comenzará en todos los móviles al mismo tiempo.</p>`}</section>
    </div>
  </div>`, "online-lobby");
  if (roomState.tournament) {
    appEl.querySelector('.lobby-head').insertAdjacentHTML('afterend', tournamentBoard());
    const hand = document.getElementById('online-hand-size');
    if (hand) {hand.value=String(roomState.tournament.handSize);hand.disabled=true;}
  }
}

function tournamentBoard(winners = []) {
  return CT.Tournament.board(roomState.tournament,roomState.playerOrder.map(id=>({id,name:roomState.players[id].name})),winners);
}

function renderCompetitionIntro() {
  const mode = CT.mode(roomState.mode);
  const art = { history: ["hero-history", 467], entertainment: ["hero-entertainment", 1050], science: ["hero-science", 1050], nature: ["hero-nature", 1050], globe: ["hero-geography", 859], mixed: ["hero-mixed", 992] }[CT.blockOf(roomState.mode).art] || ["hero-history", 467];
  paint(`<div class="shell online-shell">${header('<button class="icon-btn" data-online-action="room">Partida</button>')}<section class="pass-screen"><div class="panel pass-card comp-splash">
    <div class="chapter-art" aria-hidden="true"><img src="assets/${art[0]}-700.webp" alt="" width="700" height="${art[1]}" decoding="async" fetchpriority="high"></div>
    <div class="chapter-number">Tema ${roomState.tournament.index + 1} de ${roomState.tournament.queue.length}</div>
    <h2 data-focus tabindex="-1"><span class="comp-splash-lead">Competición · ronda ${roomState.tournament.index + 1}</span>${escapeHtml(mode.name)}</h2>
    <button class="btn btn-block comp-splash-start" data-online-action="competition-round-start">Empezar ronda</button>
  </div></section></div>`, "online-competition-intro");
}

async function nextTournamentRound() {
  if(busy || !roomState?.tournament || user.uid!==roomState.hostUid || roomState.tournament.index+1>=roomState.tournament.queue.length) return;
  busy=true;
  const reference=roomRef, expected=roomState.tournament.index;
  try {
    await runTransaction(db,async tx=>{
      const data=(await tx.get(reference)).data();
      if(data.status!=='ended' || data.tournament.index!==expected || data.hostUid!==user.uid) return;
      const tournament=CT.Tournament.next(data.tournament,data.winners || [data.winner]);
      const mode=tournament.queue[tournament.index];
      const next={...data,tournament,mode,deckFingerprint:CT.deckFingerprint(mode),status:'lobby',phase:'lobby',handSize:tournament.handSize,players:data.players,deck:[],discard:[],timeline:[],current:0,starter:data.playerOrder[0],turnsInRound:0,round:1,winner:null,winners:null,reveal:null,pulseTurn:null,version:data.version+1,updatedAt:serverTimestamp()};
      next.finalRoundOffset=data.final?.round || data.finalRoundOffset || 0;
      for(const key of ['ghost','pulsePower','final','tieQueue','turnStartedAt']) delete next[key];
      tx.set(reference,next);
    });
  } catch(error) {console.error(error);showToast('No se pudo abrir la siguiente ronda. La sala y el resultado siguen guardados.');}
  finally {busy=false;}
}

async function startRoom(withGhost = true) {
  if (busy || roomState.hostUid !== user.uid) return;
  const handSize = roomState.tournament?.handSize || Number(document.getElementById("online-hand-size").value);
  const starterUid = document.getElementById("online-starter").value;
  const pulse = !!document.getElementById("online-pulse")?.checked;
  const enableGhost = withGhost && !!document.getElementById("online-ghost")?.checked;
  busy = true;
  try {
    try { await getDoc(doc(db, 'capabilities', 'secretFinal')); }
    catch (error) {
      if (error.code === 'permission-denied') throw Error('FINAL_RULES_REQUIRED');
      throw error;
    }
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      if (data.hostUid !== user.uid || data.status !== "lobby" || data.playerOrder.length < 2) throw new Error("INVALID_START");
      // El anfitrión pudo abrir la sala y esperar con la pestaña de fondo mientras la
      // aplicación se actualizaba sola: se comprueba también aquí, no solo al entrar.
      if (data.deckFingerprint && data.deckFingerprint !== CT.deckFingerprint(data.mode)) throw new Error("DECK_MISMATCH");
      if (data.playerOrder.some(uid => (data.players[uid].clientVersion || 0) < CLIENT_VERSION)) throw new Error("UPDATE_CLIENTS");
      const deck = shuffle(modeCards(data.mode || "history").map(card => card.id));
      const actualHand = Math.min(handSize, Math.floor((deck.length - 1) / data.playerOrder.length));
      const powers = CT.Powers.create(deck, data.playerOrder.length, actualHand, enableGhost, pulse);
      const players = { ...data.players };
      data.playerOrder.forEach(uid => { players[uid] = { ...players[uid], hand: deck.splice(0, actualHand), pulseUsed: false, shieldRound: 0 }; });
      const timeline = [deck.shift()];
      data.playerOrder.forEach(uid => players[uid].hand.forEach(id => CT.Powers.claim(powers, id, uid, deck)));
      transaction.update(roomRef, {
        handSize: actualHand, turnSeconds: Number(document.getElementById("online-turn-seconds")?.value ?? 30), pulse, ...(powers.ghost ? { ghost: powers.ghost } : {}), ...(powers.pulsePower ? { pulsePower: powers.pulsePower } : {}), players, deck, timeline, discard: [], status: "playing", phase: "turn",
        current: data.playerOrder.indexOf(starterUid), starter: starterUid,
        turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null, pulseTurn: null,
        turnStartedAt: serverTimestamp(),
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error(error);
    if (error.message === 'FINAL_RULES_REQUIRED') { showToast('El servicio de salas necesita actualizarse para la final secreta. Contacta con el organizador de la beta.'); return; }
    showToast(error.message === "DECK_MISMATCH" ? "Alguien de la sala lleva una versión distinta del juego. Actualizad todos los móviles y cread una sala nueva." : error.message === "UPDATE_CLIENTS" ? `Para usar esta sala, actualizad todos los móviles a v${CLIENT_VERSION} y cread una sala nueva.` : (enableGhost || pulse) && error.code === "permission-denied" ? "Actualiza firestore.rules a v39 para usar Fantasma o Pulso." : "No se pudo iniciar la partida");
  } finally { busy = false; }
}

function clearTurnTimer() {
  if (turnTimerHandle) { clearInterval(turnTimerHandle); turnTimerHandle = null; }
}

function turnRemaining() {
  const seconds = turnSeconds();
  const serverStartedAt = roomState?.turnStartedAt?.toMillis?.();
  const serverRemaining = CT.Session.remaining(serverStartedAt, seconds);
  if (serverRemaining !== null) return serverRemaining;
  if (fallbackTimerVersion !== roomState?.version) {
    fallbackTimerVersion = roomState?.version;
    fallbackTimerStartedAt = performance.now();
  }
  return Math.max(0, seconds - Math.floor((performance.now() - fallbackTimerStartedAt) / 1000));
}
function manageTurnTimer() {
  clearTurnTimer();
  if (!roomState || roomState.status !== "playing" || roomState.phase !== "turn" || !turnSeconds()) return;
  const tick = () => {
    const remaining = turnRemaining();
    const value = document.getElementById("turn-timer-value");
    if (value) value.textContent = remaining ?? "…";
    document.getElementById("turn-timer")?.classList.toggle("turn-timer-low", remaining !== null && remaining <= 5);
    if (remaining === 0 && roomState.hostUid === user.uid && navigator.onLine) { clearTurnTimer(); skipTurn(roomState.version); }
  };
  tick(); turnTimerHandle = setInterval(tick, 250);
}

function renderGame() {
  if (!roomState.playerOrder.includes(user.uid)) return renderEntry(roomCode);
  const me = roomState.players[user.uid];
  const currentUid = roomState.playerOrder[roomState.current];
  const currentPlayer = roomState.players[currentUid];
  const myTurn = currentUid === user.uid && roomState.phase === "turn";
  // Mientras se resuelve un Pulso la mano no se toca: la única carta jugable es la que
  // sacó el mazo, y solo quien lo lanzó puede colocarla.
  const pulsing = roomState.phase === "pulse" && roomState.pulseTurn;
  const defensa = pulsing && roomState.pulseTurn.stage === "defensa";
  // En un duelo coloca quien reta primero y quien defiende después: el turno no cambia
  // de manos, pero la jugada sí.
  const myPulse = pulsing && (defensa ? roomState.pulseTurn.targetUid === user.uid : currentUid === user.uid);
  const pulseCard = pulsing ? getCard(roomState.pulseTurn.cardId) : null;
  const pulseTargetName = pulsing ? roomState.players[roomState.pulseTurn.targetUid]?.name || "" : "";
  const timelineCards = roomState.timeline.map(id => getCard(id));
  const selectedCard = selectedCardId ? getCard(selectedCardId) : null;
  // Igual que en la partida local: mientras se ve el aviso de fallo, `roomState.timeline`
  // todavía no lleva la carta fallada, así que se puede señalar dónde iba de verdad.
  const failIndex = roomState.phase === "reveal" && !roomState.reveal.correct
    ? CT.correctIndex(modeKey(), timelineCards, getCard(roomState.reveal.cardId))
    : null;
  const slots = [];
  for (let index = 0; index <= timelineCards.length; index++) {
    const confirmable = myPulse ? pulseCard : (myTurn ? selectedCard : null);
    slots.push(confirmable && pendingIndex === index
      ? `<div class="slot-confirm" data-index="${index}"><small>Colocar aquí</small><strong>${escapeHtml(confirmable.title)}</strong><button class="btn btn-primary btn-block" data-online-action="${myPulse ? (defensa ? "confirm-defense" : "confirm-pulse") : "confirm-place"}" data-autofocus>Sí, aquí</button><button class="btn btn-ghost btn-block" data-online-action="cancel-place">Cancelar</button></div>`
      : myPulse
        ? `<button class="slot" data-online-action="pulse-place" data-index="${index}" aria-label="Colocar en la posición ${index + 1} de ${timelineCards.length + 1}"><span>+</span></button>`
      : index === failIndex
        ? `<button class="slot slot-correct" data-online-action="place" data-index="${index}" disabled aria-label="Aquí iba la carta que se acaba de fallar"><span>✦</span><small>Aquí</small></button>`
        : `<button class="slot" data-online-action="place" data-index="${index}" ${myTurn && selectedCardId ? "" : "disabled"} aria-label="Colocar en la posición ${index + 1} de ${timelineCards.length + 1}"><span>+</span></button>`);
    if (index < timelineCards.length) {
      const card = timelineCards[index];
      const era = eraForCard(card);
      const animal = usesAnimalArt();
      // Con ilustración, la temática va fuera de la imagen (franja propia arriba) y el
      // resultado al fondo del todo, para que el título no empuje el zócalo sobre el dibujo.
      const body = animal
        ? `${categoryBadge(card)}<div class="card-visual era-${era.key}">${animalArt(card)}</div><div class="card-content"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p><div class="year">${formatValue(card)}</div></div>`
        : `<div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content">${categoryBadge(card)}<div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div>`;
      slots.push(roomState.ghost?.pending.length ? CT.Ghost.hiddenCard(card) : `<article class="timeline-card card-flippable ${animal ? "animal-timeline-card" : ""}" data-id="${card.id}" role="button" tabindex="0" aria-label="${escapeHtml(card.title)}. Toca para ver la explicación.">${body}</article>`);
    }
  }
  // El primer pintado ya arranca con la cuenta atrás en su punto real, no siempre en 20:
  // quien abre la sala a mitad de turno ve lo que de verdad queda, no un contador que
  // vuelve a empezar de cero en su pantalla.
  const secondsLeft = roomState.phase === "turn" && turnSeconds() ? (turnRemaining() ?? turnSeconds()) : null;
  paint(`<div class="shell">${header('<button class="icon-btn" data-online-action="room" aria-label="Abrir menú de la sala">Menú</button>')}
    <h1 class="solo-lectores" data-focus tabindex="-1">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}, ronda ${roomState.round}</h1>
    <div class="game-head"><div><div class="turn-label" aria-hidden="true">Ronda ${roomState.round} · Turno ${roomState.turnsInRound + 1} de ${roomState.playerOrder.length}</div><div class="turn-name" aria-hidden="true">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}</div></div>${secondsLeft !== null ? `<div class="turn-timer ${secondsLeft <= 5 ? "turn-timer-low" : ""}" id="turn-timer" role="timer" aria-label="Tiempo para jugar"><strong id="turn-timer-value">${secondsLeft}</strong><span>seg</span></div>` : ""}<div class="deck-count"><strong>${roomState.deck.length}</strong><span>mazo</span></div></div>
    <div class="scoreboard">${roomState.playerOrder.map(uid => { const player = roomState.players[uid]; return `<span class="score ${uid === currentUid ? "active" : ""}"${uid === currentUid ? ' aria-current="true"' : ""}><i>${escapeHtml(initials(player.name))}</i><b>${escapeHtml(player.name)}${uid === user.uid ? " · tú" : ""}</b><em>${player.hand.length}</em></span>`; }).join("")}</div>
    ${pulsing ? `<div class="pulse-banner">⚡ Duelo · <b>${escapeHtml(currentPlayer.name)}</b> reta a <b>${escapeHtml(pulseTargetName)}</b>${defensa ? " · defiende" : ""}</div>` : ""}
    ${CT.Ghost.banner(roomState.ghost, roomState.playerOrder.map(id => ({ id, name: roomState.players[id].name })))}
    <section><div class="hand-title"><h3>${timelineTitle()}</h3><small>${roomState.timeline.length} cartas</small></div>${CT.timelineMap(modeKey(), timelineCards, { hidden: !!roomState.ghost?.pending.length })}<div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
    ${pulsing
      ? `<section><div class="hand-title"><h3>Carta del duelo</h3><small>${defensa ? `te reta ${escapeHtml(currentPlayer.name)}` : `contra ${escapeHtml(pulseTargetName)}`}</small></div><div class="hand hand-solo"><div class="hand-card selected ${usesAnimalArt() ? "animal-hand-card" : ""}" data-id="${pulseCard.id}">${animalArt(pulseCard)}${categoryBadge(pulseCard)}<span class="hidden-date">${hiddenLabel()}</span><strong>${escapeHtml(pulseCard.title)}</strong></div></div><p class="hint">${myPulse
        ? (pendingIndex !== null ? "Confirma el hueco elegido o toca otro"
          : defensa ? `Colócala tú también. Si aciertas, no te llevas ninguna carta de ${escapeHtml(currentPlayer.name)}`
          : `Colócala. Si aciertas y ${escapeHtml(pulseTargetName)} falla, le pasas una carta tuya`)
        : defensa ? `${escapeHtml(pulseTargetName)} está colocando la misma carta…`
        : `${escapeHtml(currentPlayer.name)} está colocando la carta del duelo…`}</p></section>`
      : `<section><div class="hand-title"><h3>Tu mano</h3><small>${me.hand.length} por colocar</small></div><div class="hand">${me.hand.map(id => { const card = getCard(id); return `<button class="hand-card ${selectedCardId === id ? "selected" : ""} ${usesAnimalArt() ? "animal-hand-card" : ""}" data-online-action="select" data-id="${id}" aria-pressed="${selectedCardId === id}" ${myTurn ? "" : "disabled"}>${animalArt(card)}${categoryBadge(card)}<span class="hidden-date">${hiddenLabel()}</span><strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`; }).join("")}</div><p class="hint">${myTurn ? (pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Toca una carta para seleccionarla y después un hueco +") : `${escapeHtml(currentPlayer.name)} está pensando dónde colocar su carta…`}</p>${myTurn && pulseAvailable() ? `<button class="btn btn-secondary btn-block pulse-btn" data-online-action="pulse-open">⚡ Usar mi Pulso <small>una vez por partida</small></button>` : ""}</section>`}
    ${!pulsing && roomState.phase !== "reveal" ? CT.Ghost.power(roomState.ghost, user.uid, roomState.timeline.length, me.hand.length, 'data-online-action="ghost-use"', myTurn) : ""}
    ${roomState.phase === "reveal" ? revealOverlay(currentUid) : ""}
    ${!pulsing && roomState.phase !== "reveal" ? CT.Powers.pulsePower(roomState.pulsePower, user.uid, me.hand.length, 'data-online-action="pulse-open"', myTurn && !roomState.ghost?.fresh && roomState.deck.length + roomState.discard.length > 0 && pulseTargetUids().length > 0) : ""}
  </div>`, "online-game");
  manageTurnTimer();
  // Igual que en el juego local: arrastrar una carta hasta un hueco es otra forma de
  // llegar a la confirmación. Fuera de turno las cartas están desactivadas y no arrancan.
  CT.enableDrag({
    cardSelector: ".hand-card", slotSelector: ".slot",
    onDrop: (id, index) => {
      // En un Pulso la carta ya está decidida: arrastrar solo elige el hueco.
      if (!myPulse) selectedCardId = id;
      pendingIndex = index;
      if (index !== null) announce(`Hueco ${index + 1} de ${roomState.timeline.length + 1} elegido. Confirma o elige otro.`);
      renderGame();
    }
  });
  // La capa del revelado viaja dentro del repintado, y este se repite con cada
  // instantánea que llega de la sala. Solo se abre como diálogo al aparecer, o el foco
  // saltaría dentro de ella una y otra vez.
  const revelando = roomState.phase === "reveal";
  if (revelando && !renderGame.revelando) abreCapa(appEl.querySelector(".overlay"), false);
  renderGame.revelando = revelando;
  if (failIndex !== null) setTimeout(() => CT.scrollToElement(document.querySelector(".timeline-wrap"), document.querySelector(".slot-correct")), 0);
}

function revealOverlay(currentUid) {
  const reveal = roomState.reveal;
  const card = getCard(reveal.cardId);
  const era = eraForCard(card);
  const canContinue = user.uid === currentUid || user.uid === roomState.hostUid;
  // El hueco resaltado en la línea, detrás de esta capa, ya lo enseña; esta frase lo dice
  // también con palabras, que es lo único que le llega a quien usa un lector de pantalla.
  const hint = reveal.correct ? "" : `<p>${CT.placementHint(modeKey(), roomState.timeline.map(id => getCard(id)), card)}</p>`;
  // El título de la carta que cambia de mano solo lo ven las dos personas implicadas: el
  // resto de la sala se entera de que hubo trasvase, pero no de cuál era la carta.
  const implicado = reveal.pulse && (user.uid === reveal.playerUid || user.uid === reveal.targetUid);
  const seguir = canContinue ? '<button class="btn btn-primary btn-block" data-dialog-focus data-online-action="finish-turn">Continuar <span>→</span></button>' : `<div class="waiting-inline"><i></i> Esperando a ${escapeHtml(reveal.playerName)}…</div>`;
  const fichaCarta = `<div class="reveal">${categoryBadge(card)}<div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p>${CT.Art.button(modeKey(), card)}</div>`;
  // Un duelo no lo gana ni lo pierde una sola persona, así que no lleva la marca grande de
  // acierto: cada jugada trae la suya y debajo se cuenta el desenlace.
  if (reveal.duel) {
    const cartas = roomState.timeline.map(id => getCard(id));
    // La línea ya lleva la carta del duelo si alguien la colocó bien, así que para decir
    // dónde la puso cada cual hay que mirar la línea sin ella.
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
      ? `Empate: los dos la habéis colocado bien, así que no cambia ninguna mano. La carta se queda en la línea.`
      : reveal.correct
        ? `Solo acierta <b>${escapeHtml(reveal.playerName)}</b>: <b>${escapeHtml(reveal.targetName)}</b> se lleva ${regalo}. La carta se queda en la línea.`
        : reveal.targetOk
          ? `<b>${escapeHtml(reveal.targetName)}</b> se defiende y coloca la carta en la línea. <b>${escapeHtml(reveal.playerName)}</b> ${reveal.penaltySkipped ? "no roba: el mazo y el descarte están agotados" : "roba una por fallar el reto"}.`
          : `No la acierta ninguno de los dos: la carta va al descarte y <b>${escapeHtml(reveal.playerName)}</b> roba una por haber lanzado el reto.`;
    return `<div class="overlay"><div class="modal pulse-duel-modal">
      <div class="eyebrow" aria-hidden="true">⚡ Duelo · ${escapeHtml(reveal.playerName)} contra ${escapeHtml(reveal.targetName)}</div>
      <h2>${escapeHtml(card.title)}</h2>
      ${fichaCarta}
      <div class="pulse-duel-rows">
        ${fila(reveal.playerName, reveal.correct, reveal.byIndex)}
        ${fila(reveal.targetName, reveal.targetOk, reveal.targetIndex)}
      </div>
      <p class="pulse-outcome">${cierre}</p>
      ${seguir}
    </div></div>`;
  }
  const desenlace = `<p>${reveal.correct ? "La carta permanece en la línea temporal." : reveal.returned ? "No quedan cartas que robar, así que vuelve a su mano." : `${escapeHtml(reveal.playerName)} descarta la carta y roba una nueva.`}</p>`;
  return `<div class="overlay"><div class="modal ${reveal.correct ? "success" : "failure"}"><div class="result-mark" aria-hidden="true">${reveal.correct ? "✓" : "×"}</div><div class="eyebrow" aria-hidden="true">${reveal.correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2><span class="solo-lectores">${reveal.correct ? "Bien colocado:" : "No encaja ahí:"} </span>${escapeHtml(card.title)}</h2>${fichaCarta}${hint}${desenlace}${seguir}</div></div>`;
}

async function placeCard(index) {
  if (busy || !selectedCardId) return;
  const playedId = selectedCardId;
  pendingIndex = null;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      const currentUid = data.playerOrder[data.current];
      if (data.status !== "playing" || data.phase !== "turn" || currentUid !== user.uid) throw new Error("NOT_TURN");
      const played = CT.Engine.play({...data, hand:data.players[user.uid].hand}, playedId, index, id => sortValue(getCard(id)));
      const {hand, timeline, deck, discard, correct, returned} = played;
      const ghost = data.ghost ? structuredClone(data.ghost) : null;
      const pulsePower = data.pulsePower ? structuredClone(data.pulsePower) : null;
      if (played.drawnCardId != null) CT.Powers.claim({ghost, pulsePower}, played.drawnCardId, user.uid, deck);
      const players = { ...data.players, [user.uid]: { ...data.players[user.uid], hand } };
      transaction.update(roomRef, {
        players, ...(ghost ? { ghost } : {}), ...(pulsePower ? { pulsePower } : {}), deck, discard, timeline, phase: "reveal",
        reveal: { cardId: playedId, correct, returned, playerUid: user.uid, playerName: data.players[user.uid].name },
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
    selectedCardId = null;
  } catch (error) {
    console.error(error);
    showToast("La jugada no se pudo enviar. Inténtalo de nuevo.");
  } finally { busy = false; }
}

// ---------------------------------------------------------------------------
// El Pulso en la sala compartida. Las reglas son las mismas que en un solo móvil, y están
// explicadas en `app.js`. Lo propio de aquí es que se resuelve en dos transacciones y no
// en una: entre lanzarlo y colocar la carta hay que enseñársela a quien reta, así que
// `turn` → `pulse` la saca del mazo y `pulse` → `reveal` la resuelve.
//
// Es la única jugada del juego que toca dos manos a la vez, y por eso `firestore.rules`
// necesita reglas propias: `onlyMyHand()`, que protege el resto de jugadas, aquí no vale.
const PULSE_MIN_HAND = 2;

function pulseTargetUids() {
  if (!roomState) return [];
  return roomState.playerOrder.filter(uid =>
    uid !== user.uid && (roomState.players[uid].shieldRound || 0) !== roomState.round);
}

function pulseAvailable() {
  const me = roomState.players[user.uid];
  const hasPower = roomState.pulsePower ? CT.Powers.ownsPulse(roomState.pulsePower, user.uid) : !!roomState.pulse;
  return !roomState.ghost?.fresh && hasPower && !me.pulseUsed && me.hand.length >= PULSE_MIN_HAND
    && roomState.deck.length + roomState.discard.length > 0 && pulseTargetUids().length > 0;
}

function openPulse() {
  const opciones = pulseTargetUids().map(uid => {
    const player = roomState.players[uid];
    return `<button class="btn btn-secondary btn-block pulse-target" data-online-action="pulse-target" data-target="${uid}"><b>${escapeHtml(player.name)}</b><small>${player.hand.length} ${player.hand.length === 1 ? "carta" : "cartas"}</small></button>`;
  }).join("");
  appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-pulse-overlay><div class="modal">
    <div class="eyebrow">Pulso</div>
    <h2>¿A quién retas?</h2>
    <p class="lead" style="margin-inline:auto">${CT.pulseRules}</p>
    <div class="actions" style="display:grid;margin-top:6px">${opciones}</div>
    <button class="btn btn-ghost btn-block" style="margin-top:10px" data-online-action="close-pulse">Mejor no</button>
  </div></div>`);
  abreCapa(appEl.querySelector("[data-pulse-overlay]"), true);
}

async function useGhost() {
  if (busy) return;
  selectedCardId = null; pendingIndex = null;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      if (data.status !== "playing" || data.phase !== "turn" || data.playerOrder[data.current] !== user.uid
        || !CT.Ghost.available(data.ghost, user.uid, data.timeline.length, data.players[user.uid].hand.length)) throw new Error("NO_GHOST");
      const ghost = structuredClone(data.ghost);
      CT.Ghost.activate(ghost, user.uid, data.playerOrder);
      transaction.update(roomRef, { ghost, version: data.version + 1, updatedAt: serverTimestamp() });
    });
    selectedCardId = null; pendingIndex = null;
  } catch (error) {
    console.error(error); showToast("No se pudo activar Fantasma. Comprueba que las reglas de sala estén actualizadas.");
  } finally { busy = false; }
}

async function startPulse(targetUid) {
  if (busy) return;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      const currentUid = data.playerOrder[data.current];
      if (data.status !== "playing" || data.phase !== "turn" || currentUid !== user.uid) throw new Error("NOT_TURN");
      const me = data.players[user.uid];
      const hasPower = data.pulsePower ? CT.Powers.ownsPulse(data.pulsePower, user.uid) : !!data.pulse;
      if (data.ghost?.fresh || !hasPower || me.pulseUsed || me.hand.length < PULSE_MIN_HAND) throw new Error("NO_PULSE");
      if (!data.playerOrder.includes(targetUid) || targetUid === user.uid) throw new Error("NO_TARGET");
      if ((data.players[targetUid].shieldRound || 0) === data.round) throw new Error("SHIELDED");
      let deck = [...data.deck];
      let discard = [...data.discard];
      if (!deck.length) { deck = shuffle(discard); discard = []; }
      const cardId = deck.shift();
      if (cardId == null) throw new Error("NO_CARDS");
      const ghost = data.ghost ? structuredClone(data.ghost) : null;
      const pulsePower = data.pulsePower ? structuredClone(data.pulsePower) : null;
      CT.Powers.consumePulse(pulsePower, user.uid);
      CT.Powers.claim({ ghost, pulsePower }, cardId, user.uid, deck);
      transaction.update(roomRef, {
        players: { ...data.players, [user.uid]: { ...me, pulseUsed: true } },
        ...(ghost ? { ghost } : {}), ...(pulsePower ? { pulsePower } : {}), deck, discard, phase: "pulse",
        // La carta que se pagaría si ganas el duelo se sortea aquí, con la mano intacta y
        // antes de que nadie coloque: así ni se elige a posteriori ni la elige quien cobra.
        pulseTurn: { targetUid, cardId, stage: "reto", giftId: me.hand[Math.floor(Math.random() * me.hand.length)] },
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error(error);
    showToast("No se pudo lanzar el Pulso");
  } finally { busy = false; }
}

// Primera mitad del duelo: quien reta coloca y su jugada se guarda sin resolver nada.
// Ninguna mano, ni la línea, ni el mazo se tocan todavía: lo único que cambia es el
// propio `pulseTurn`, que es lo que hace la transición barata de validar en las reglas.
async function placePulse(index) {
  if (busy || roomState?.phase !== "pulse") return;
  pendingIndex = null;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      const currentUid = data.playerOrder[data.current];
      if (data.status !== "playing" || data.phase !== "pulse" || currentUid !== user.uid) throw new Error("NOT_TURN");
      if ((data.pulseTurn.stage || "reto") !== "reto") throw new Error("NOT_STAGE");
      transaction.update(roomRef, {
        pulseTurn: { ...data.pulseTurn, stage: "defensa", byIndex: index, byOk: aciertaEn(data, data.pulseTurn.cardId, index) },
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error(error);
    showToast("La jugada no se pudo enviar. Inténtalo de nuevo.");
  } finally { busy = false; }
}

function aciertaEn(data, cardId, index) {
  return CT.Engine.fits(data.timeline, cardId, index, id => sortValue(getCard(id)));
}

// Segunda mitad: defiende quien ha sido retado, y su transacción reparte las
// consecuencias de las dos jugadas a la vez. Es la única escritura del juego que hace
// alguien que no tiene el turno, y por eso `firestore.rules` la valida aparte.
async function defendPulse(index) {
  if (busy || roomState?.phase !== "pulse") return;
  pendingIndex = null;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      if (data.status !== "playing" || data.phase !== "pulse") throw new Error("NOT_PULSE");
      const { targetUid, cardId, byOk, giftId } = data.pulseTurn;
      // Quien retó es quien tiene el turno; no hace falta un campo aparte que las reglas
      // tendrían que validar por su cuenta.
      const byUid = data.playerOrder[data.current];
      if (data.pulseTurn.stage !== "defensa" || targetUid !== user.uid) throw new Error("NOT_DEFENSE");
      const resolved = CT.Engine.pulse({...data, byHand:data.players[byUid].hand, targetHand:data.players[user.uid].hand},
        data.pulseTurn, index, id => sortValue(getCard(id)));
      const {targetOk, timeline, deck, discard, penaltySkipped} = resolved;
      const players = {...data.players,
        [byUid]: {...data.players[byUid], hand:resolved.byHand},
        [user.uid]: {...data.players[user.uid], hand:resolved.targetHand}};
      if (resolved.giftId != null) players[user.uid].shieldRound = data.round;
      const ghost = data.ghost ? structuredClone(data.ghost) : null;
      const pulsePower = data.pulsePower ? structuredClone(data.pulsePower) : null;
      if (resolved.drawnCardId != null) CT.Powers.claim({ghost, pulsePower}, resolved.drawnCardId, byUid, deck);
      transaction.update(roomRef, {
        players, ...(ghost ? { ghost } : {}), ...(pulsePower ? { pulsePower } : {}), deck, discard, timeline, phase: "reveal", pulseTurn: null,
        reveal: {
          cardId, correct: byOk, returned: false, pulse: true, duel: true, targetOk, penaltySkipped,
          giftId: byOk && !targetOk ? giftId : null,
          byIndex: data.pulseTurn.byIndex, targetIndex: index,
          playerUid: byUid, playerName: data.players[byUid].name,
          targetUid: user.uid, targetName: players[user.uid].name
        },
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error(error);
    showToast("La defensa no se pudo enviar. Inténtalo de nuevo.");
  } finally { busy = false; }
}

function takeCard(deckInput, discardInput) {
  return CT.Engine.draw(deckInput, discardInput);
}

async function finishTurn() {
  if (busy || roomState?.phase !== "reveal") return;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      const currentUid = data.playerOrder[data.current];
      if (data.phase !== "reveal" || (user.uid !== currentUid && user.uid !== data.hostUid)) throw new Error("NOT_ALLOWED");
      const ghost = data.ghost ? structuredClone(data.ghost) : null;
      const pulsePower = data.pulsePower ? structuredClone(data.pulsePower) : null;
      CT.Ghost.advance(ghost, currentUid, data.playerOrder);
      let turnsInRound = data.turnsInRound + 1;
      let round = data.round;
      let players = { ...data.players };
      let deck = [...data.deck];
      let discard = [...data.discard];
      if (turnsInRound >= data.playerOrder.length) {
        const {empty} = CT.Engine.roundOutcome(data.playerOrder, players, deck.length + discard.length);
        // Varios jugadores sin cartas disputan una final numérica secreta.
        if (empty.length === 1) {
          transaction.update(roomRef, { status: "ended", phase: "finished", winner: empty[0], winners: empty, reveal: null, version: data.version + 1, updatedAt: serverTimestamp() });
          return;
        }
        if (empty.length > 1) {
          transaction.update(roomRef, {phase:'final',final:CT.Final.create(data.mode, empty, data.finalRoundOffset ? {round:data.finalRoundOffset,used:[]} : null, data.timeline),reveal:null,version:data.version+1,updatedAt:serverTimestamp()});
          return;
        }
        turnsInRound = 0;
        round += 1;
      }
      transaction.update(roomRef, {
        players, ...(ghost ? { ghost } : {}), ...(pulsePower ? { pulsePower } : {}), deck, discard, current: (data.current + 1) % data.playerOrder.length,
        turnsInRound, round, phase: "turn", reveal: null, turnStartedAt: serverTimestamp(),
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    // NOT_ALLOWED = alguien se adelantó a cerrar el turno; no hay nada que avisar.
    if (error.message !== "NOT_ALLOWED") {
      console.error(error);
      showToast("No se pudo avanzar el turno");
    }
  } finally { busy = false; }
}

async function continueTie(retries = 1) {
  if (busy || !roomRef) return;
  busy = true;
  let attemptedVersion, retry = false;
  try {
    for (let step=0;step<10;step++) {
      const more = await runTransaction(db, async transaction => {
        const data=(await transaction.get(roomRef)).data();
        attemptedVersion = data?.version;
        if (data?.phase !== 'tiebreak' || !data.playerOrder.includes(user.uid)) return false;
        const ghost=data.ghost ? structuredClone(data.ghost) : null;
        if (!data.tieQueue.length) {
          CT.Ghost.advance(ghost,data.playerOrder[data.current],data.playerOrder);
          transaction.update(roomRef,{...(ghost?{ghost}:{}),phase:'turn',current:(data.current+1)%data.playerOrder.length,round:data.round+1,turnsInRound:0,turnStartedAt:serverTimestamp(),version:data.version+1,updatedAt:serverTimestamp()});
          return false;
        }
        const who=data.tieQueue[0], drawn=takeCard(data.deck,data.discard);
        if (drawn.cardId == null) throw Error('Desempate sin cartas');
        const pulsePower=data.pulsePower ? structuredClone(data.pulsePower) : null;
        CT.Powers.claim({ghost,pulsePower},drawn.cardId,who,drawn.deck);
        transaction.update(roomRef,{players:{...data.players,[who]:{...data.players[who],hand:[drawn.cardId]}},deck:drawn.deck,discard:drawn.discard,tieQueue:data.tieQueue.slice(1),...(ghost?{ghost}:{}),...(pulsePower?{pulsePower}:{}),version:data.version+1,updatedAt:serverTimestamp()});
        return true;
      });
      if (!more) break;
    }
  } catch(error) {
    let latest;
    try { latest=(await getDoc(roomRef)).data(); } catch { /* Se conserva la cola para reintentar con conexión. */ }
    if (latest && latest.version !== attemptedVersion && latest.playerOrder.includes(user.uid)) {
      retry = latest.phase === 'tiebreak' && retries > 0;
      if (latest.phase === 'tiebreak' && !retry) showToast('Otra persona está continuando el reparto.');
    } else { console.error(error); showToast('El desempate sigue guardado. Pulsa Continuar reparto para reintentarlo.'); }
  }
  finally { busy=false; }
  if (retry) await continueTie(retries - 1);
}

let finalRenderId = 0;
const finalDrafts = new Map();
function finalAnswerRef(code, round, uid) {
  return doc(db, 'rooms', code, 'finalRounds', String(round), 'answers', uid);
}
async function renderOnlineFinal() {
  const request = ++finalRenderId, code = roomCode, final = roomState.final;
  const draftKey = `${code}:${final.round}`;
  const oldForm = appEl.querySelector('[data-final-online]');
  if (oldForm?.dataset.round === String(final.round)) finalDrafts.set(draftKey, {guess:oldForm.elements.guess.value, era:oldForm.elements.era?.value});
  const complete = final.submitted.length === final.players.length;
  const submitted = final.submitted.includes(user.uid);
  const finalist = final.players.includes(user.uid);
  const name = uid => roomState.players[uid].name;
  const shell = body => `<div class="shell">${header(roomState.hostUid === user.uid ? '<button class="icon-btn" data-online-action="close-room">Cerrar sala</button>' : '')}<h1 data-focus tabindex="-1">Final de desempate</h1>${CT.Final.question(modeKey(), final)}${body}</div>`;
  paint(shell(complete ? '<p role="status">Revelando las respuestas…</p>' : `<p>Respuestas guardadas: ${final.submitted.length} de ${final.players.length}.</p>${finalist && !submitted ? CT.Final.form(modeKey(), `data-final-online data-round="${final.round}"`) : `<section class="panel"><h2>${submitted ? 'Tu respuesta está guardada' : 'Estás siguiendo la final'}</h2><p>Esperando a ${final.players.filter(uid => !final.submitted.includes(uid)).map(uid => escapeHtml(name(uid))).join(', ')}. Las cifras se revelan cuando todos hayan respondido.</p></section>`}`), 'online-final');
  const form = appEl.querySelector('[data-final-online]'), draft = finalDrafts.get(draftKey);
  if (form && draft) { form.elements.guess.value = draft.guess; if (form.elements.era) form.elements.era.value = draft.era || 'ad'; }
  if (!complete) return;
  try {
    const answers = Object.fromEntries(await Promise.all(final.players.map(async uid => [uid, (await getDoc(finalAnswerRef(code, final.round, uid))).data().value])));
    if (request !== finalRenderId || roomCode !== code || roomState.phase !== 'final' || roomState.final.round !== final.round) return;
    const ranking = CT.Final.rank(final, answers);
    paint(shell(`${CT.Final.results(modeKey(), final, answers, name)}<button class="btn btn-primary btn-block" data-online-action="final-next">${ranking.winners.length === 1 ? 'Ver ganador' : 'Otra carta de desempate'}</button>`), 'online-final');
    finalDrafts.delete(draftKey);
  } catch (error) {
    if (request !== finalRenderId || roomState?.phase !== 'final' || roomCode !== code) return;
    console.error(error);
    paint(shell('<p>Las respuestas siguen guardadas. No se pudo cargar el resultado.</p><button class="btn btn-primary" data-online-action="final-refresh">Reintentar</button>'), 'online-final');
  }
}

document.addEventListener('submit', async event => {
  if (!event.target.matches('[data-final-online]')) return;
  event.preventDefault();
  if (busy || roomState?.phase !== 'final') return;
  const round = roomState.final.round, code = roomCode;
  let value;
  try {
    const values = new FormData(event.target);
    value = CT.Final.parse(modeKey(), values.get('guess'), values.get('era') === 'bc');
  } catch (error) { showToast(error.message); return; }
  busy = true;
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await runTransaction(db, async tx => {
      const reference = doc(db, 'rooms', code), data = (await tx.get(reference)).data();
      if (data.phase !== 'final' || data.final.round !== round || !data.final.players.includes(user.uid)) throw Error('La final ha cambiado.');
      if (data.final.submitted.includes(user.uid)) return;
      tx.set(finalAnswerRef(code, round, user.uid), {value});
      tx.update(reference, {final:{...data.final, submitted:[...data.final.submitted, user.uid]}, version:data.version + 1, updatedAt:serverTimestamp()});
    });
  } catch (error) { console.error(error); showToast('No se pudo guardar tu respuesta. Reintenta cuando vuelva la conexión.'); }
  finally { busy = false; if (button.isConnected) button.disabled = false; }
});

async function nextOnlineFinal() {
  if (busy || roomState?.phase !== 'final') return;
  busy = true;
  const reference = roomRef, code = roomCode, expectedRound = roomState.final.round;
  try {
    await runTransaction(db, async tx => {
      const data = (await tx.get(reference)).data(), final = data.final;
      if (data.phase !== 'final' || final.round !== expectedRound || final.submitted.length !== final.players.length) return;
      const answers = Object.fromEntries(await Promise.all(final.players.map(async uid => [uid, (await tx.get(finalAnswerRef(code, final.round, uid))).data().value])));
      const ranking = CT.Final.rank(final, answers);
      tx.update(reference, ranking.winners.length === 1
        ? {status:'ended', phase:'finished', winner:ranking.winners[0], winners:ranking.winners, version:data.version + 1, updatedAt:serverTimestamp()}
        : {final:CT.Final.create(data.mode, ranking.winners, final, data.timeline), version:data.version + 1, updatedAt:serverTimestamp()});
    });
  } catch (error) { console.error(error); showToast('No se pudo continuar la final. Puedes reintentarlo.'); }
  finally { busy = false; }
}

function renderWinner() {
  clearTurnTimer();
  const uids = (roomState.winners || [roomState.winner]).filter(uid => roomState.players[uid]);
  const names = uids.map(uid => escapeHtml(roomState.players[uid].name));
  const title = names.length === 1 ? `${names[0]} gana` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]} ganan`;
  const lead = roomState.final ? "Ha ganado la final con la cifra más cercana." : names.length === 1
    ? "Ha sido la única persona en terminar la ronda sin cartas."
    : "Se acabaron las cartas del mazo y terminan la ronda empatadas sin cartas.";
  paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel winner-online"><div class="player-medallion">${escapeHtml(initials(roomState.players[uids[0]].name))}</div><div class="eyebrow">Fin de la partida · Sala ${roomCode}</div><h1 data-focus tabindex="-1" style="font-size:clamp(2.5rem,12vw,4.5rem)">${title}</h1><p class="lead" style="margin-inline:auto">${lead}</p><div class="actions" style="justify-content:center"><button class="btn btn-ghost" data-online-action="review-timeline">Ver las ${roomState.timeline.length} cartas jugadas</button><button class="btn btn-primary" data-online-action="back">Ir al inicio</button>${roomState.hostUid === user.uid ? '<button class="btn btn-secondary" data-online-action="close-room">Cerrar sala</button>' : ""}</div></div></section></div>`, "online-winner");
  if(roomState.tournament) {
    const section=appEl.querySelector('.pass-screen');
    section.insertAdjacentHTML('afterbegin',tournamentBoard(uids));
    if(roomState.tournament.index+1<roomState.tournament.queue.length) section.insertAdjacentHTML('beforeend',roomState.hostUid===user.uid ? '<button class="btn btn-primary btn-block" data-online-action="competition-next">Siguiente ronda · nuevo mazo</button>' : '<p role="status">Esperando al anfitrión para pasar al siguiente mazo.</p>');
  }
}

// Igual que en el juego local: quien gana su partida también quiere repasar la línea
// entera tal y como quedó, no solo lo que falló por el camino.
function renderTimelineReview() {
  paint(`<div class="shell">${header()}<section>
    <div class="eyebrow">Línea de tiempo completa</div>
    <h1 data-focus tabindex="-1">${roomState.timeline.length} ${roomState.timeline.length === 1 ? "carta jugada" : "cartas jugadas"}</h1>
    <div class="review-grid">${roomState.timeline.map(id => {
      const card = getCard(id);
      if (!card) return "";
      const era = eraForCard(card);
      return `<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content">${categoryBadge(card)}<div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div></article>`;
    }).join("")}</div>
    <div class="actions" style="justify-content:center"><button class="btn btn-primary" data-online-action="back-from-timeline">Volver</button></div>
  </section></div>`, "online-timeline-review");
}

function roomMenu() {
  const isHost = roomState?.hostUid === user.uid;
  const playing = roomState?.status === "playing";
  const inFinal = roomState?.phase === 'final';
  const currentUid = playing ? roomState.playerOrder[roomState.current] : null;
  const currentName = currentUid ? roomState.players[currentUid].name : "";
  const others = (roomState?.playerOrder || []).filter(uid => uid !== roomState.hostUid);
  appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-room-overlay><div class="modal">
    <div class="eyebrow">Sala ${roomCode}</div><h2>Gestionar la partida</h2>
    <div class="actions" style="display:grid">
      <button class="btn btn-secondary" data-online-action="share">Compartir enlace</button>
      <button class="btn btn-secondary" data-online-action="qr">Mostrar QR</button>
      ${isHost && playing && !inFinal ? `<button class="btn btn-ghost" data-online-action="skip">Saltar el turno de ${escapeHtml(currentName)}</button>` : ""}
    </div>
    ${isHost && others.length && !inFinal ? `<div class="manage-players"><div class="section-label">Participantes</div>${others.map(uid => `<div class="manage-player"><span>${escapeHtml(initials(roomState.players[uid].name))}</span><strong>${escapeHtml(roomState.players[uid].name)}</strong><button class="kick-btn" data-online-action="kick" data-uid="${uid}">Expulsar</button></div>`).join("")}</div>` : ""}
    ${inFinal ? '<p>La final espera a todos los finalistas. Si alguien se desconecta, puede volver a entrar y responder.</p>' : ''}
    <div class="actions" style="display:grid">
      ${isHost && playing ? '<button class="btn btn-ghost" data-online-action="close-room">Terminar partida y cerrar sala</button>' : isHost ? '<button class="btn btn-ghost" data-online-action="close-room">Cerrar la sala</button>' : inFinal ? '<button class="btn btn-ghost" data-online-action="back">Ir al inicio</button>' : '<button class="btn btn-ghost" data-online-action="leave-room">Salir de la partida</button>'}
      <button class="btn btn-primary" data-online-action="close-room-menu">Volver a la partida</button>
    </div>
  </div></div>`);
  abreCapa(appEl.querySelector("[data-room-overlay]"), true);
}

// El anfitrión desatasca la partida cuando alguien se queda sin batería o sin cobertura.
async function skipTurn(expectedVersion = null) {
  if (busy || roomState?.hostUid !== user.uid || roomState?.status !== "playing") return;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      if (data.hostUid !== user.uid || data.status !== "playing") throw new Error("NOT_ALLOWED");
      if (expectedVersion !== null && (data.version !== expectedVersion || data.phase !== "turn")) return;
      const ghost = data.ghost ? structuredClone(data.ghost) : null;
      CT.Ghost.advance(ghost, data.playerOrder[data.current], data.playerOrder);
      const roundEnds = data.turnsInRound + 1 >= data.playerOrder.length;
      transaction.update(roomRef, {
        ...(ghost ? { ghost } : {}),
        ...(data.phase === "pulse" ? { discard: [...data.discard, data.pulseTurn.cardId], pulseTurn: null } : {}),
        current: (data.current + 1) % data.playerOrder.length,
        turnsInRound: roundEnds ? 0 : data.turnsInRound + 1,
        round: roundEnds ? data.round + 1 : data.round,
        phase: "turn", reveal: null, turnStartedAt: serverTimestamp(),
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
    showToast("Turno saltado");
  } catch (error) {
    console.error(error);
    showToast("No se pudo saltar el turno");
  } finally { busy = false; }
}

// Expulsar (anfitrión) o marcharse: las cartas de quien sale vuelven al descarte.
async function removePlayer(targetUid) {
  if (busy) return;
  if (targetUid !== user.uid && roomState?.hostUid !== user.uid) return;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      const index = data.playerOrder.indexOf(targetUid);
      if (index < 0) return;
      if (targetUid === data.hostUid) throw new Error("HOST");
      const playerOrder = data.playerOrder.filter(uid => uid !== targetUid);
      const players = { ...data.players };
      const ghost = data.ghost ? structuredClone(data.ghost) : null;
      // Una salida cierra la jugada en curso; no deja participantes pendientes
      // que nunca volverán a jugar ni permite combinar poderes en el mismo turno.
      if (targetUid === data.playerOrder[data.current]) CT.Ghost.advance(ghost, targetUid, playerOrder);
      CT.Ghost.remove(ghost, targetUid, playerOrder);
      const cancelPulse = data.phase === "pulse" && (targetUid === data.playerOrder[data.current] || targetUid === data.pulseTurn.targetUid);
      const hand = players[targetUid]?.hand || [];
      delete players[targetUid];
      const update = {
        players, ...(ghost ? { ghost } : {}), playerOrder, discard: [...data.discard, ...hand, ...(cancelPulse ? [data.pulseTurn.cardId] : [])],
        ...(cancelPulse ? { pulseTurn: null } : {}),
        version: data.version + 1, updatedAt: serverTimestamp()
      };
      if (data.status === "playing") {
        if (playerOrder.length < 2) {
          Object.assign(update, { status: "ended", phase: "finished", winner: playerOrder[0], current: 0, turnsInRound: 0, reveal: null });
        } else {
          const before = index < data.current;
          const current = (before ? data.current - 1 : data.current) % playerOrder.length;
          const turnsInRound = before ? Math.max(0, data.turnsInRound - 1) : data.turnsInRound;
          Object.assign(update, {
            current, turnsInRound: Math.min(turnsInRound, playerOrder.length - 1),
            phase: cancelPulse || targetUid === data.playerOrder[data.current] ? "turn" : data.phase,
            reveal: targetUid === data.playerOrder[data.current] ? null : data.reveal
          });
        }
      }
      transaction.update(roomRef, update);
    });
  } catch (error) {
    console.error(error);
    showToast(error.message === "HOST" ? "El anfitrión no puede salir: cierra la sala" : "No se pudo actualizar la sala");
  } finally { busy = false; }
}

async function shareRoom() {
  const url = invitationUrl();
  try {
    if (navigator.share) await navigator.share({ title: "Continuum", text: `Únete a mi partida. Código: ${roomCode}`, url });
    else { await navigator.clipboard.writeText(url); showToast("Enlace copiado"); }
  } catch (error) {
    if (error.name !== "AbortError") showToast("No se pudo compartir el enlace");
  }
}

function showQr() {
  document.body.insertAdjacentHTML("beforeend", `<div class="overlay qr-overlay" data-qr-overlay><div class="modal qr-modal"><div class="eyebrow">Invitación a la sala</div><h2>Escanea para entrar</h2><div class="qr-frame"><canvas id="room-qr" aria-label="Código QR de invitación a la sala"></canvas></div><div class="qr-room-code">${roomCode}</div><p>Abre la cámara del otro móvil y apunta al código. El enlace rellenará automáticamente la sala.</p><div class="actions" style="display:grid"><button class="btn btn-primary" data-online-action="share">Compartir enlace</button><button class="btn btn-secondary" data-online-action="close-qr">Cerrar</button></div></div></div>`);
  try { drawQr(document.getElementById("room-qr"), invitationUrl()); }
  catch (error) { console.error(error); showToast("La dirección es demasiado larga para generar el QR"); }
  abreCapa(document.querySelector("[data-qr-overlay]"), true);
}

async function closeRoom() {
  if (!roomRef || roomState?.hostUid !== user.uid) return;
  if (!confirm("¿Cerrar la sala para todos los participantes?")) return;
  await deleteDoc(roomRef);
}

// Con mensaje se recarga un momento después, para que dé tiempo a leerlo.
function leaveOnline(message = "") {
  clearTurnTimer();
  stopPresence();
  CT.onlineActive = false;
  unsubscribeRoom?.();
  unsubscribeRoom = null;
  roomState = null;
  roomRef = null;
  roomCode = "";
  history.replaceState({}, "", location.pathname);
  if (!message) return location.reload();
  showToast(message);
  setTimeout(() => location.reload(), 1600);
}

// Un móvil que se bloquea, cambia de pestaña o pierde cobertura un momento puede dejar el
// listener de Firestore colgado: la conexión persistente se corta y, en algunos
// navegadores, no se reanuda sola hasta recargar. Al volver a primer plano o recuperar
// red, se fuerza a Firestore a reconectar (cortando y reabriendo la conexión) para que
// la sala se ponga al día sin que nadie tenga que refrescar a mano.
async function forceResync() {
  if (!roomRef) return;
  try {
    await disableNetwork(db);
    await enableNetwork(db);
  } catch (error) { console.error(error); }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") forceResync();
  void heartbeat();
});
window.addEventListener("offline", renderPresence);
window.addEventListener("online", () => void heartbeat());
window.addEventListener("online", forceResync);
window.addEventListener("pageshow", event => { if (event.persisted) forceResync(); });

document.addEventListener("submit", event => {
  const form = event.target.closest("[data-online-form]");
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  const name = String(values.get("name") || "").trim().slice(0, 18);
  if (!name) return showToast("Escribe tu nombre");
  if (form.dataset.onlineForm === "create") createRoom(name);
  else {
    const code = cleanCode(values.get("code"));
    if (code.length !== 8) return showToast("El código debe tener 8 caracteres");
    joinRoom(code, name);
  }
});

document.addEventListener("change", event => {
  if (event.target.id !== "online-preset") return;
  const advanced = event.target.value === "advanced";
  document.getElementById("online-pulse").checked = advanced;
  document.getElementById("online-ghost").checked = advanced;
});
document.addEventListener("input", event => {
  if (event.target.matches(".room-code-input")) event.target.value = cleanCode(event.target.value);
});

document.addEventListener("click", event => {
  const target = event.target.closest("[data-online-action]");
  if (!target) return;
  const action = target.dataset.onlineAction;
  if (action === "back" && !roomRef && returnToMenu) { entryRequest++; CT.onlineActive = false; returnToMenu(); }
  else if (action === "back" || action === "leave") leaveOnline();
  else if (action === "claim-host") claimHost();
  else if (action === "review-timeline") renderTimelineReview();
  else if (action === "back-from-timeline") renderWinner();
  else if (action === "guide") showGuide();
  else if (action === "close-guide") CT.closeDialog();
  else if (action === "share") shareRoom();
  else if (action === "qr") showQr();
  else if (action === "close-qr") CT.closeDialog();
  else if (action === "start") startRoom();
  else if (action === "competition-next") nextTournamentRound();
  else if (action === "competition-round-start") renderGame();
  else if (action === "select") {
    selectedCardId = Number(target.dataset.id);
    pendingIndex = null;
    announce(`Elegida la carta ${getCard(selectedCardId).title}. Ahora elige un hueco.`);
    renderGame();
  }
  else if (action === "ghost-use") useGhost();
  else if (action === "pulse-open") openPulse();
  else if (action === "close-pulse") CT.closeDialog();
  else if (action === "pulse-target") { CT.closeDialog(); startPulse(target.dataset.target); }
  else if (action === "pulse-place") { pendingIndex = Number(target.dataset.index); announce(`Hueco ${pendingIndex + 1} de ${roomState.timeline.length + 1} elegido. Confirma o elige otro.`); renderGame(); }
  else if (action === "confirm-pulse") placePulse(pendingIndex);
  else if (action === "confirm-defense") defendPulse(pendingIndex);
  else if (action === "place") {
    pendingIndex = Number(target.dataset.index);
    announce(`Hueco ${pendingIndex + 1} de ${roomState.timeline.length + 1} elegido. Confirma o elige otro.`);
    renderGame();
  }
  else if (action === "confirm-place") placeCard(pendingIndex);
  else if (action === "cancel-place") { pendingIndex = null; renderGame(); }
  else if (action === "continue-tie") void continueTie();
  else if (action === "finish-turn") finishTurn();
  else if (action === "final-refresh") void renderOnlineFinal();
  else if (action === "final-next") void nextOnlineFinal();
  else if (action === "close-room") closeRoom();
  else if (action === "room") roomMenu();
  else if (action === "close-room-menu") CT.closeDialog();
  else if (action === "skip") { CT.closeDialog(); skipTurn(); }
  else if (action === "kick") {
    const name = roomState?.players[target.dataset.uid]?.name || "esta persona";
    if (confirm(`¿Expulsar a ${name} de la sala?`)) { CT.closeDialog(); removePlayer(target.dataset.uid); }
  } else if (action === "leave-room") {
    if (confirm("¿Salir de la sala? Tus cartas volverán al mazo.")) removePlayer(user.uid);
  }
});
