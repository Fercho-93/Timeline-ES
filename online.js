import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { deleteDoc, doc, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

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
const MODE_CARDS = { history: window.HISTORY_CARDS, movies: window.MOVIE_CARDS, countries: window.COUNTRY_CARDS };
const MODE_NAMES = { history: "Historia de España", movies: "Estrenos de cine", countries: "Superficie de países" };
const MODE_ICONS = { history: "🏛️", movies: "🎬", countries: "🌍" };
const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let user = null;
let roomCode = "";
let roomRef = null;
let roomState = null;
let unsubscribeRoom = null;
let selectedCardId = null;
let pendingIndex = null;
let busy = false;
let selectedModeKey = "history";
let seenSelfInRoom = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function modeKey() { return roomState?.mode || selectedModeKey; }

function isArea() { return modeKey() === "countries"; }

function formatValue(card) {
  if (isArea()) {
    const value = card.value < 10 ? card.value.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : Math.round(card.value).toLocaleString("es-ES");
    return `${value} km²`;
  }
  if (card.label) return card.label;
  return card.year < 0 ? `${Math.abs(card.year)} a. C.` : String(card.year);
}

function sortValue(card) { return isArea() ? card.value : card.year; }

function hiddenLabel() { return isArea() ? "Superficie oculta" : "Fecha oculta"; }

function timelineTitle() { return isArea() ? "De menor a mayor" : "Línea temporal"; }

function modeCards(modeKey = roomState?.mode || selectedModeKey) {
  return MODE_CARDS[modeKey] || MODE_CARDS.history;
}

function getCard(id) {
  return modeCards().find(card => card.id === id);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}

function eraForCard(card) {
  if (isArea()) {
    if (card.value < 1000) return { key: "diminuto", name: "Diminuto", symbol: "·" };
    if (card.value < 50000) return { key: "pequeno", name: "Pequeño", symbol: "▪" };
    if (card.value < 300000) return { key: "mediano", name: "Mediano", symbol: "◈" };
    if (card.value < 1000000) return { key: "grande", name: "Grande", symbol: "◆" };
    if (card.value < 5000000) return { key: "enorme", name: "Enorme", symbol: "★" };
    return { key: "gigante", name: "Gigante", symbol: "⬢" };
  }
  if (modeKey() === "movies") {
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

function header(extra = "") {
  const modeName = MODE_NAMES[modeKey()] || MODE_NAMES.history;
  return `<header class="topbar"><div class="brand"><span class="brand-mark">${MODE_ICONS[modeKey()] || MODE_ICONS.history}</span>Hilo · ${modeName} <span class="live-badge"><i></i> EN DIRECTO</span></div>${extra}</header>`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", code);
  return url.toString();
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
  localStorage.setItem(`hilo-online-${code}`, JSON.stringify({ name }));
}

function rememberedRoom(code) {
  try { return JSON.parse(localStorage.getItem(`hilo-online-${code}`)); }
  catch { return null; }
}

async function ensureAuth() {
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
  selectedModeKey = MODE_CARDS[options.modeKey] ? options.modeKey : "history";
  renderEntry(cleanCode(options.roomCode));
  await ensureAuth();
  const invited = cleanCode(options.roomCode);
  if (!invited) return;
  try {
    const reference = doc(db, "rooms", invited);
    const snapshot = await getDoc(reference);
    if (snapshot.exists() && snapshot.data().playerOrder.includes(user.uid)) {
      connectToRoom(invited);
    }
  } catch {
    // A new guest may only read a lobby after entering a name.
  }
}

function renderEntry(invited = "") {
  const known = invited ? rememberedRoom(invited) : null;
  appEl.innerHTML = `<div class="shell online-shell">${header('<button class="icon-btn" data-online-action="back">Salir</button>')}
    <section class="online-intro"><div class="eyebrow"><span class="eyebrow-line"></span> ${MODE_NAMES[selectedModeKey]}</div><h2>Una mesa,<br>varias pantallas</h2><p class="lead">Cada persona juega desde su móvil y todos ven la línea temporal avanzar en directo.</p></section>
    <div class="online-entry-grid">
      <form class="panel online-form" data-online-form="create"><span class="form-number">01</span><h3>Crear una sala</h3><p>Tú preparas la partida y compartes el código.</p><div class="field"><label for="online-host-name">Tu nombre</label><input id="online-host-name" name="name" maxlength="18" required placeholder="Ej. Fernando" autocomplete="name"></div><button class="btn btn-primary btn-block" type="submit">Crear sala <span>→</span></button></form>
      <form class="panel online-form" data-online-form="join"><span class="form-number">02</span><h3>Entrar en una sala</h3><p>Usa el código que aparece en el móvil anfitrión.</p><div class="field"><label for="online-code">Código de sala</label><input id="online-code" name="code" class="room-code-input" maxlength="8" required placeholder="ABCD2345" value="${escapeHtml(invited)}" autocapitalize="characters" autocomplete="off"></div><div class="field"><label for="online-player-name">Tu nombre</label><input id="online-player-name" name="name" maxlength="18" required placeholder="Ej. Lucía" autocomplete="name" value="${escapeHtml(known?.name || "")}"></div><button class="btn btn-secondary btn-block" type="submit">Unirme a la partida</button></form>
    </div>
    <p class="online-note">Necesita conexión a internet durante la partida compartida.</p>
  </div>`;
}

async function createRoom(name) {
  if (busy) return;
  busy = true;
  try {
    await ensureAuth();
    const code = createRoomCode();
    const reference = doc(db, "rooms", code);
    await setDoc(reference, {
      roomCode: code,
      mode: selectedModeKey,
      hostUid: user.uid,
      status: "lobby",
      phase: "lobby",
      version: 1,
      handSize: 4,
      playerOrder: [user.uid],
      players: { [user.uid]: { name, hand: [], joinedAt: Date.now() } },
      deck: [], discard: [], timeline: [], current: 0, starter: user.uid,
      turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    rememberRoom(code, name);
    history.replaceState({}, "", invitationUrl(code));
    connectToRoom(code);
  } catch (error) {
    console.error(error);
    showToast("No se pudo crear la sala. Revisa Firestore y sus reglas.");
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
      if (data.playerOrder.includes(user.uid)) return;
      if (data.status !== "lobby") throw new Error("ALREADY_STARTED");
      if (data.playerOrder.length >= 9) throw new Error("ROOM_FULL");
      transaction.update(reference, {
        players: { ...data.players, [user.uid]: { name, hand: [], joinedAt: Date.now() } },
        playerOrder: [...data.playerOrder, user.uid],
        version: data.version + 1,
        updatedAt: serverTimestamp()
      });
    });
    rememberRoom(code, name);
    history.replaceState({}, "", invitationUrl(code));
    connectToRoom(code);
  } catch (error) {
    const messages = { ROOM_NOT_FOUND: "No existe ninguna sala con ese código", ALREADY_STARTED: "La partida ya ha comenzado", ROOM_FULL: "La sala ya tiene 9 participantes" };
    showToast(messages[error.message] || "No se pudo entrar. Comprueba el código y las reglas de Firebase.");
  } finally { busy = false; }
}

function connectToRoom(code) {
  unsubscribeRoom?.();
  roomCode = code;
  roomRef = doc(db, "rooms", code);
  seenSelfInRoom = false;
  unsubscribeRoom = onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) {
      // Mismo motivo: una caché aún sin la sala no significa que la hayan cerrado.
      if (!seenSelfInRoom && snapshot.metadata.fromCache) return;
      leaveOnline("La sala ha sido cerrada");
      return;
    }
    roomState = snapshot.data();
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
    if (roomState.phase !== "turn") pendingIndex = null;
    if (roomState.status === "lobby") renderLobby();
    else if (roomState.status === "ended") renderWinner();
    else renderGame();
  }, error => {
    console.error(error);
    if (error.code === "permission-denied") leaveOnline("Ya no estás en esta sala");
    else showToast("Se perdió la conexión con la sala");
  });
}

function renderLobby() {
  const isHost = roomState.hostUid === user.uid;
  const people = roomState.playerOrder.map(uid => roomState.players[uid]);
  appEl.innerHTML = `<div class="shell online-shell">${header(isHost ? '<button class="icon-btn" data-online-action="leave">Salir</button>' : '<button class="icon-btn" data-online-action="leave-room">Salir</button>')}
    <section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Sala de espera</div><h2>Preparando la mesa</h2></div><div class="room-code-card"><small>Código de sala</small><strong>${roomCode}</strong><div class="room-invite-actions"><button data-online-action="share">Compartir enlace</button><button data-online-action="qr">Mostrar QR</button></div></div></section>
    <div class="online-lobby-grid"><section class="panel"><div class="section-label">Participantes <small>${people.length}/9</small></div><div class="lobby-players">${roomState.playerOrder.map((uid, index) => { const player = roomState.players[uid]; return `<div class="lobby-player"><span>${escapeHtml(initials(player.name))}</span><div><strong>${escapeHtml(player.name)}${uid === user.uid ? " · tú" : ""}</strong><small>${uid === roomState.hostUid ? "Anfitrión" : `Participante ${index + 1}`}</small></div>${isHost && uid !== roomState.hostUid ? `<button class="kick-btn" data-online-action="kick" data-uid="${uid}">Expulsar</button>` : "<i>✓</i>"}</div>`; }).join("")}</div></section>
      <section class="panel lobby-settings">${isHost ? `<div class="section-label">Ajustes</div><div class="field"><label for="online-hand-size">Cartas iniciales</label><select id="online-hand-size"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div><div class="field"><label for="online-starter">La persona más joven</label><select id="online-starter">${roomState.playerOrder.map(uid => `<option value="${uid}">${escapeHtml(roomState.players[uid].name)}</option>`).join("")}</select></div><button class="btn btn-primary btn-block" data-online-action="start" ${people.length < 2 ? "disabled" : ""}>${people.length < 2 ? "Esperando a alguien más…" : "Barajar y empezar →"}</button><button class="btn btn-ghost btn-block" data-online-action="close-room">Cerrar sala</button>` : `<div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>La partida comenzará en todos los móviles al mismo tiempo.</p>`}</section>
    </div>
  </div>`;
}

async function startRoom() {
  if (busy || roomState.hostUid !== user.uid) return;
  const handSize = Number(document.getElementById("online-hand-size").value);
  const starterUid = document.getElementById("online-starter").value;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      if (data.hostUid !== user.uid || data.status !== "lobby" || data.playerOrder.length < 2) throw new Error("INVALID_START");
      const deck = shuffle(modeCards(data.mode || "history").map(card => card.id));
      const players = { ...data.players };
      data.playerOrder.forEach(uid => { players[uid] = { ...players[uid], hand: deck.splice(0, handSize) }; });
      const timeline = [deck.shift()];
      transaction.update(roomRef, {
        handSize, players, deck, timeline, discard: [], status: "playing", phase: "turn",
        current: data.playerOrder.indexOf(starterUid), starter: starterUid,
        turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
        version: data.version + 1, updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error(error);
    showToast("No se pudo iniciar la partida");
  } finally { busy = false; }
}

function renderGame() {
  if (!roomState.playerOrder.includes(user.uid)) return renderEntry(roomCode);
  const me = roomState.players[user.uid];
  const currentUid = roomState.playerOrder[roomState.current];
  const currentPlayer = roomState.players[currentUid];
  const myTurn = currentUid === user.uid && roomState.phase === "turn";
  const timelineCards = roomState.timeline.map(id => getCard(id));
  const selectedCard = selectedCardId ? getCard(selectedCardId) : null;
  const slots = [];
  for (let index = 0; index <= timelineCards.length; index++) {
    slots.push(myTurn && selectedCard && pendingIndex === index
      ? `<div class="slot-confirm"><small>Colocar aquí</small><strong>${escapeHtml(selectedCard.title)}</strong><button class="btn btn-primary btn-block" data-online-action="confirm-place">Sí, aquí</button><button class="btn btn-ghost btn-block" data-online-action="cancel-place">Cancelar</button></div>`
      : `<button class="slot" data-online-action="place" data-index="${index}" ${myTurn && selectedCardId ? "" : "disabled"} aria-label="Colocar en la posición ${index + 1} de ${timelineCards.length + 1}"><span>+</span></button>`);
    if (index < timelineCards.length) {
      const card = timelineCards[index];
      const era = eraForCard(card);
      slots.push(`<article class="timeline-card"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${formatValue(card)}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.detail)}</p></div></article>`);
    }
  }
  appEl.innerHTML = `<div class="shell">${header('<button class="icon-btn" data-online-action="room">Sala</button>')}
    <div class="connection-strip"><span><i></i> Sala ${roomCode}</span><small>${roomState.playerOrder.length} participantes</small></div>
    <div class="game-head"><div><div class="turn-label">Ronda ${roomState.round} · Turno ${roomState.turnsInRound + 1} de ${roomState.playerOrder.length}</div><div class="turn-name">${myTurn ? "Tu turno" : `Turno de ${escapeHtml(currentPlayer.name)}`}</div></div><div class="deck-count"><strong>${roomState.deck.length}</strong><span>mazo</span></div></div>
    <div class="scoreboard">${roomState.playerOrder.map(uid => { const player = roomState.players[uid]; return `<span class="score ${uid === currentUid ? "active" : ""}"><i>${escapeHtml(initials(player.name))}</i><b>${escapeHtml(player.name)}${uid === user.uid ? " · tú" : ""}</b><em>${player.hand.length}</em></span>`; }).join("")}</div>
    <section><div class="hand-title"><h3>${timelineTitle()}</h3><small>${roomState.timeline.length} cartas</small></div><div class="timeline-wrap"><div class="timeline">${slots.join("")}</div></div></section>
    <section><div class="hand-title"><h3>Tu mano</h3><small>${me.hand.length} por colocar</small></div><div class="hand">${me.hand.map(id => { const card = getCard(id); return `<button class="hand-card ${selectedCardId === id ? "selected" : ""}" data-online-action="select" data-id="${id}" ${myTurn ? "" : "disabled"}><span class="hidden-date">${hiddenLabel()}</span><strong>${escapeHtml(card.title)}</strong><span class="card-arrow">→</span></button>`; }).join("")}</div><p class="hint">${myTurn ? (pendingIndex !== null ? "Confirma el hueco elegido o toca otro" : selectedCardId ? "Ahora toca uno de los huecos + de la línea temporal" : "Elige una carta para colocarla") : `${escapeHtml(currentPlayer.name)} está pensando dónde colocar su carta…`}</p></section>
    ${roomState.phase === "reveal" ? revealOverlay(currentUid) : ""}
  </div>`;
}

function revealOverlay(currentUid) {
  const reveal = roomState.reveal;
  const card = getCard(reveal.cardId);
  const era = eraForCard(card);
  const canContinue = user.uid === currentUid || user.uid === roomState.hostUid;
  return `<div class="overlay"><div class="modal ${reveal.correct ? "success" : "failure"}"><div class="result-mark">${reveal.correct ? "✓" : "×"}</div><div class="eyebrow">${reveal.correct ? "¡Bien colocado!" : "No encaja ahí"}</div><h2>${escapeHtml(card.title)}</h2><div class="reveal"><div class="reveal-era era-${era.key}"><span>${era.symbol}</span>${era.name}</div><div class="year">${formatValue(card)}</div><p>${escapeHtml(card.detail)}</p></div><p>${reveal.correct ? "La carta permanece en la línea temporal." : reveal.returned ? "No quedan cartas que robar, así que vuelve a su mano." : `${escapeHtml(reveal.playerName)} descarta la carta y roba una nueva.`}</p>${canContinue ? '<button class="btn btn-primary btn-block" data-online-action="finish-turn">Continuar <span>→</span></button>' : `<div class="waiting-inline"><i></i> Esperando a ${escapeHtml(reveal.playerName)}…</div>`}</div></div>`;
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
      const hand = [...data.players[user.uid].hand];
      if (!hand.includes(playedId)) throw new Error("NO_CARD");
      const card = getCard(playedId);
      const previous = index > 0 ? getCard(data.timeline[index - 1]) : null;
      const next = index < data.timeline.length ? getCard(data.timeline[index]) : null;
      const correct = (!previous || sortValue(card) >= sortValue(previous)) && (!next || sortValue(card) <= sortValue(next));
      hand.splice(hand.indexOf(playedId), 1);
      const timeline = [...data.timeline];
      let deck = [...data.deck];
      let discard = [...data.discard];
      let returned = false;
      if (correct) timeline.splice(index, 0, playedId);
      else {
        const drawn = takeCard(deck, discard);
        deck = drawn.deck; discard = drawn.discard;
        if (drawn.cardId != null) { hand.push(drawn.cardId); discard.push(playedId); }
        // Sin mazo ni descarte no hay nada que robar: la carta vuelve a la mano.
        else { hand.push(playedId); returned = true; }
      }
      const players = { ...data.players, [user.uid]: { ...data.players[user.uid], hand } };
      transaction.update(roomRef, {
        players, deck, discard, timeline, phase: "reveal",
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

function takeCard(deckInput, discardInput) {
  let deck = [...deckInput];
  let discard = [...discardInput];
  if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
  return { cardId: deck.shift(), deck, discard };
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
      let turnsInRound = data.turnsInRound + 1;
      let round = data.round;
      let players = { ...data.players };
      let deck = [...data.deck];
      let discard = [...data.discard];
      if (turnsInRound >= data.playerOrder.length) {
        const empty = data.playerOrder.filter(uid => players[uid].hand.length === 0);
        // Sin cartas suficientes para el desempate la partida termina compartida:
        // si no, a esas personas les llegaría el turno con la mano vacía.
        if (empty.length === 1 || (empty.length > 1 && deck.length + discard.length < empty.length)) {
          transaction.update(roomRef, { status: "ended", phase: "finished", winner: empty[0], winners: empty, reveal: null, version: data.version + 1, updatedAt: serverTimestamp() });
          return;
        }
        if (empty.length > 1) {
          empty.forEach(uid => {
            const drawn = takeCard(deck, discard);
            deck = drawn.deck; discard = drawn.discard;
            if (drawn.cardId != null) players[uid] = { ...players[uid], hand: [...players[uid].hand, drawn.cardId] };
          });
        }
        turnsInRound = 0;
        round += 1;
      }
      transaction.update(roomRef, {
        players, deck, discard, current: (data.current + 1) % data.playerOrder.length,
        turnsInRound, round, phase: "turn", reveal: null,
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

function renderWinner() {
  const uids = (roomState.winners || [roomState.winner]).filter(uid => roomState.players[uid]);
  const names = uids.map(uid => escapeHtml(roomState.players[uid].name));
  const title = names.length === 1 ? `${names[0]} gana` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]} ganan`;
  const lead = names.length === 1
    ? "Ha sido la única persona en terminar la ronda sin cartas."
    : "Se acabaron las cartas del mazo y terminan la ronda empatadas sin cartas.";
  appEl.innerHTML = `<div class="shell">${header()}<section class="pass-screen"><div class="panel winner-online"><div class="player-medallion">${escapeHtml(initials(roomState.players[uids[0]].name))}</div><div class="eyebrow">Fin de la partida · Sala ${roomCode}</div><h1 style="font-size:clamp(2.5rem,12vw,4.5rem)">${title}</h1><p class="lead" style="margin-inline:auto">${lead}</p><div class="actions" style="justify-content:center"><button class="btn btn-primary" data-online-action="back">Ir al inicio</button>${roomState.hostUid === user.uid ? '<button class="btn btn-secondary" data-online-action="close-room">Cerrar sala</button>' : ""}</div></div></section></div>`;
}

function roomMenu() {
  const isHost = roomState?.hostUid === user.uid;
  const playing = roomState?.status === "playing";
  const currentUid = playing ? roomState.playerOrder[roomState.current] : null;
  const currentName = currentUid ? roomState.players[currentUid].name : "";
  const others = (roomState?.playerOrder || []).filter(uid => uid !== roomState.hostUid);
  appEl.insertAdjacentHTML("beforeend", `<div class="overlay" data-room-overlay><div class="modal">
    <div class="eyebrow">Sala ${roomCode}</div><h2>Gestionar la partida</h2>
    <div class="actions" style="display:grid">
      <button class="btn btn-secondary" data-online-action="share">Compartir enlace</button>
      <button class="btn btn-secondary" data-online-action="qr">Mostrar QR</button>
      ${isHost && playing ? `<button class="btn btn-ghost" data-online-action="skip">Saltar el turno de ${escapeHtml(currentName)}</button>` : ""}
    </div>
    ${isHost && others.length ? `<div class="manage-players"><div class="section-label">Participantes</div>${others.map(uid => `<div class="manage-player"><span>${escapeHtml(initials(roomState.players[uid].name))}</span><strong>${escapeHtml(roomState.players[uid].name)}</strong><button class="kick-btn" data-online-action="kick" data-uid="${uid}">Expulsar</button></div>`).join("")}</div>` : ""}
    <div class="actions" style="display:grid">
      ${isHost ? '<button class="btn btn-ghost" data-online-action="close-room">Cerrar la sala</button>' : '<button class="btn btn-ghost" data-online-action="leave-room">Salir de la partida</button>'}
      <button class="btn btn-primary" data-online-action="close-room-menu">Volver a la partida</button>
    </div>
  </div></div>`);
}

// El anfitrión desatasca la partida cuando alguien se queda sin batería o sin cobertura.
async function skipTurn() {
  if (busy || roomState?.hostUid !== user.uid || roomState?.status !== "playing") return;
  busy = true;
  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      if (data.hostUid !== user.uid || data.status !== "playing") throw new Error("NOT_ALLOWED");
      const roundEnds = data.turnsInRound + 1 >= data.playerOrder.length;
      transaction.update(roomRef, {
        current: (data.current + 1) % data.playerOrder.length,
        turnsInRound: roundEnds ? 0 : data.turnsInRound + 1,
        round: roundEnds ? data.round + 1 : data.round,
        phase: "turn", reveal: null,
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
      const hand = players[targetUid]?.hand || [];
      delete players[targetUid];
      const update = {
        players, playerOrder, discard: [...data.discard, ...hand],
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
            phase: "turn", reveal: null
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
    if (navigator.share) await navigator.share({ title: "Hilo de España", text: `Únete a mi partida. Código: ${roomCode}`, url });
    else { await navigator.clipboard.writeText(url); showToast("Enlace copiado"); }
  } catch (error) {
    if (error.name !== "AbortError") showToast("No se pudo compartir el enlace");
  }
}

function showQr() {
  document.body.insertAdjacentHTML("beforeend", `<div class="overlay qr-overlay" data-qr-overlay><div class="modal qr-modal"><div class="eyebrow">Invitación a la sala</div><h2>Escanea para entrar</h2><div class="qr-frame"><canvas id="room-qr" aria-label="Código QR de invitación a la sala"></canvas></div><div class="qr-room-code">${roomCode}</div><p>Abre la cámara del otro móvil y apunta al código. El enlace rellenará automáticamente la sala.</p><div class="actions" style="display:grid"><button class="btn btn-primary" data-online-action="share">Compartir enlace</button><button class="btn btn-secondary" data-online-action="close-qr">Cerrar</button></div></div></div>`);
  try { drawQr(document.getElementById("room-qr"), invitationUrl()); }
  catch (error) { console.error(error); showToast("La dirección es demasiado larga para generar el QR"); }
}

async function closeRoom() {
  if (!roomRef || roomState?.hostUid !== user.uid) return;
  if (!confirm("¿Cerrar la sala para todos los participantes?")) return;
  await deleteDoc(roomRef);
}

// Con mensaje se recarga un momento después, para que dé tiempo a leerlo.
function leaveOnline(message = "") {
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

document.addEventListener("input", event => {
  if (event.target.matches(".room-code-input")) event.target.value = cleanCode(event.target.value);
});

document.addEventListener("click", event => {
  const target = event.target.closest("[data-online-action]");
  if (!target) return;
  const action = target.dataset.onlineAction;
  if (action === "back" || action === "leave") leaveOnline();
  else if (action === "share") shareRoom();
  else if (action === "qr") showQr();
  else if (action === "close-qr") target.closest("[data-qr-overlay]")?.remove();
  else if (action === "start") startRoom();
  else if (action === "select") { selectedCardId = Number(target.dataset.id); pendingIndex = null; renderGame(); }
  else if (action === "place") { pendingIndex = Number(target.dataset.index); renderGame(); }
  else if (action === "confirm-place") placeCard(pendingIndex);
  else if (action === "cancel-place") { pendingIndex = null; renderGame(); }
  else if (action === "finish-turn") finishTurn();
  else if (action === "close-room") closeRoom();
  else if (action === "room") roomMenu();
  else if (action === "close-room-menu") target.closest("[data-room-overlay]")?.remove();
  else if (action === "skip") { target.closest("[data-room-overlay]")?.remove(); skipTurn(); }
  else if (action === "kick") {
    const name = roomState?.players[target.dataset.uid]?.name || "esta persona";
    if (confirm(`¿Expulsar a ${name} de la sala?`)) { target.closest("[data-room-overlay]")?.remove(); removePlayer(target.dataset.uid); }
  } else if (action === "leave-room") {
    if (confirm("¿Salir de la sala? Tus cartas volverán al mazo.")) removePlayer(user.uid);
  }
});
