// Continuum — matchmaking público (MVP)
// Capa pequeña y aislada: decide qué mesa pública puede aceptar a un jugador.
// La persistencia y la atomicidad real se realizan con una transacción Firestore desde online.js.

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

export function shouldStartPublicRoom(room) {
  if (!room || room.matchmaking !== 'public' || room.status !== 'lobby') return false;
  const capacity = normalizePublicCapacity(room.capacity);
  return Array.isArray(room.playerOrder) && room.playerOrder.length === capacity;
}

export function makePublicRoomCode(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 7; i += 1) suffix += alphabet[Math.floor(random() * alphabet.length)];
  return PUBLIC_ROOM_PREFIX + suffix;
}

export function publicPlayer({ uid, name, avatarId = null, clientVersion, joinedAt = Date.now() }) {
  if (!uid || !name) throw new Error('INVALID_PUBLIC_PLAYER');
  return { uid, name: String(name).slice(0, 18), avatarId, clientVersion, joinedAt };
}

export const PUBLIC_MATCHMAKING = Object.freeze({
  MIN_PLAYERS,
  MAX_PLAYERS,
  PUBLIC_ROOM_PREFIX
});
