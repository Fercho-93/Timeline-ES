// Mesas públicas, la parte que no toca la red: clave de la cola, plazas, si una mesa admite a alguien
// más y su código, y la versión y la caducidad que comparten la partida rápida
// (public-matchmaking-online.js, que hace las transacciones en Firestore), las salas (online.js), el
// tablón (public-tables.js) y Retos rápidos (quick-online.js). Sin Firebase, se prueba en Node
// (tests/public-matchmaking.mjs).

// Versión de las salas de Grandes colecciones (privadas y públicas): cada plaza la apunta
// (`clientVersion`) y forma parte de la clave de la cola pública. `startRoom` (online.js) no
// reparte si alguien de la mesa lleva una anterior. Se sube cuando cambia algo que un móvil sin
// actualizar no sabría jugar; la última vez, la competición con cambio de mazo entre rondas.
export const CLIENT_VERSION = 42;

// Quien lleva una mesa pública renueva su cola y su ficha del tablón cada 45 s; si llevan dos
// minutos sin renovarse, la mesa está abandonada. Es el mismo plazo que usan las reglas
// (firestore.rules) para dejar sustituir la cola o borrar la ficha.
export const STALE_MS = 120000;

// ¿Sigue viva la cola? `updatedAt` es la hora del servidor de su última renovación.
export function queueFresh(queue, now = Date.now()) {
  const at = queue?.updatedAt?.toMillis?.();
  return Number.isFinite(at) && now - at < STALE_MS;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const PUBLIC_ROOM_PREFIX = 'P';

export function normalizePublicCapacity(value) {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < MIN_PLAYERS || capacity > MAX_PLAYERS) {
    throw new Error('INVALID_PUBLIC_CAPACITY');
  }
  return capacity;
}

export function publicQueueKey({ mode, capacity, clientVersion, deckFingerprint }) {
  if (!mode || typeof mode !== 'string') throw new Error('INVALID_PUBLIC_MODE');
  if (!Number.isInteger(Number(clientVersion)) || Number(clientVersion) < 1) throw new Error('INVALID_PUBLIC_VERSION');
  if (!deckFingerprint || typeof deckFingerprint !== 'string') throw new Error('INVALID_PUBLIC_DECK');
  return mode + ':' + normalizePublicCapacity(capacity) + ':v' + Number(clientVersion) + ':' + deckFingerprint;
}

export function isJoinablePublicRoom(room, { mode, capacity, clientVersion, deckFingerprint } = {}) {
  if (!room || room.matchmaking !== 'public' || room.status !== 'lobby') return false;
  const wantedCapacity = normalizePublicCapacity(capacity ?? room.capacity);
  if (room.capacity !== wantedCapacity) return false;
  if (mode && room.mode !== mode) return false;
  if (!Array.isArray(room.playerOrder) || room.playerOrder.length >= wantedCapacity) return false;
  if (clientVersion != null && room.clientVersion != null && room.clientVersion !== clientVersion) return false;
  if (deckFingerprint && room.deckFingerprint && room.deckFingerprint !== deckFingerprint) return false;
  return true;
}

export function makePublicRoomCode(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 7; i += 1) suffix += alphabet[Math.floor(random() * alphabet.length)];
  return PUBLIC_ROOM_PREFIX + suffix;
}

