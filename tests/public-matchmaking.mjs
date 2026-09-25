import assert from 'node:assert/strict';
import {
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

console.log('public matchmaking core: ok');
