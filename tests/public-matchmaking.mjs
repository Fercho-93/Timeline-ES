import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STALE_MS,
  queueFresh,
  normalizePublicCapacity,
  publicQueueKey,
  isJoinablePublicRoom,
  shouldStartPublicRoom,
  makePublicRoomCode,
  publicPlayer
} from '../public-matchmaking.js';

assert.equal(normalizePublicCapacity(2), 2);
assert.equal(normalizePublicCapacity('4'), 4);
assert.throws(() => normalizePublicCapacity(1), /INVALID_PUBLIC_CAPACITY/);
assert.throws(() => normalizePublicCapacity(5), /INVALID_PUBLIC_CAPACITY/);
assert.equal(publicQueueKey({ mode: 'history', capacity: 4, clientVersion: 42, deckFingerprint: '167.test1' }), 'history:4:v42:167.test1');

const room = {
  matchmaking: 'public', status: 'lobby', mode: 'history', capacity: 4,
  clientVersion: 42, deckFingerprint: 'deck-a', playerOrder: ['a', 'b']
};
assert.equal(isJoinablePublicRoom(room, { mode: 'history', capacity: 4, clientVersion: 42, deckFingerprint: 'deck-a' }), true);
assert.equal(isJoinablePublicRoom({ ...room, status: 'playing' }, { capacity: 4 }), false);
assert.equal(isJoinablePublicRoom({ ...room, playerOrder: ['a','b','c','d'] }, { capacity: 4 }), false);
assert.equal(isJoinablePublicRoom(room, { mode: 'movies', capacity: 4 }), false);
assert.equal(isJoinablePublicRoom(room, { capacity: 4, clientVersion: 43 }), false);
assert.equal(isJoinablePublicRoom(room, { capacity: 4, deckFingerprint: 'deck-b' }), false);
assert.equal(shouldStartPublicRoom(room), false);
assert.equal(shouldStartPublicRoom({ ...room, playerOrder: ['a','b','c','d'] }), true);

const code = makePublicRoomCode(() => 0);
assert.equal(code, 'PAAAAAAA');
assert.equal(code.length, 8);
const player = publicPlayer({ uid: 'u1', name: 'Fernando-123456789012345', avatarId: 'fox', clientVersion: 42, joinedAt: 1 });
assert.equal(player.uid, 'u1');
assert.equal(player.name.length, 18);
assert.equal(player.joinedAt, 1);

// Una cola sin renovar en dos minutos es de una mesa abandonada, con el mismo plazo que las
// reglas usan para dejar sustituir las colas y borrar las fichas del tablón.
const renovada = ms => ({ updatedAt: { toMillis: () => ms } });
assert.equal(queueFresh(renovada(1000), 1000 + STALE_MS - 1), true);
assert.equal(queueFresh(renovada(1000), 1000 + STALE_MS), false);
assert.equal(queueFresh({ updatedAt: null }, 0), false, 'sin hora del servidor la cola no cuenta como viva');
const reglas = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.equal(reglas.split(`duration.value(${STALE_MS / 1000}, 's')`).length - 1, 3, 'las reglas de las dos colas y del tablón usan el mismo plazo');

console.log('public matchmaking core: ok');

// La capa pública se mantiene deliberadamente entre 2 y 4 para no fragmentar colas.
assert.equal(normalizePublicCapacity(2),2);
assert.equal(normalizePublicCapacity(4),4);
assert.throws(()=>normalizePublicCapacity(1));
assert.throws(()=>normalizePublicCapacity(5));
