import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STALE_MS,
  queueFresh,
  normalizePublicCapacity,
  publicQueueKey,
  isJoinablePublicRoom,
  makePublicRoomCode
} from '../js/online/public-matchmaking.js';

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

const code = makePublicRoomCode(() => 0);
assert.equal(code, 'PAAAAAAA');
assert.equal(code.length, 8);

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

// «Buscar mesa al azar»: si no hay ninguna mesa esperando se abre la del primer mazo de la
// lista, así que la lista se baraja antes; sin barajar, la mesa era siempre de Historia.
{
  const fuente = fs.readFileSync(new URL('../js/online/public-matchmaking-online.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export .*;\r?\n?/gm, '');
  const esperando = new Set();
  const ventana = { CONTINUUM: { MODES: { history: {}, world: {}, movies: {}, mixed: {} }, deckFingerprint: () => 'fp', shuffle: lista => [...lista].reverse() } };
  const buscar = new Function('window', 'auth', 'db', 'doc', 'getDoc', 'runTransaction', 'serverTimestamp', 'publicQueueKey', 'isJoinablePublicRoom', 'makePublicRoomCode', 'normalizePublicCapacity', 'queueFresh', 'CLIENT_VERSION',
    `${fuente}\nfindFlexible = async (mode, capacity) => ({ code: 'MESA-' + mode, capacity });\nreturn findAcrossModes;`)(
    ventana, {}, {}, (_, coleccion, clave) => clave, async clave => ({ exists: () => esperando.has(clave.split(':')[0]), data: () => ({ status: 'waiting', updatedAt: { toMillis: () => Date.now() } }) }),
    async () => {}, () => null, publicQueueKey, isJoinablePublicRoom, makePublicRoomCode, normalizePublicCapacity, () => true, 1);
  const sinMesas = await buscar(['history', 'world', 'movies', 'mixed'], 4);
  assert.equal(sinMesas.code, 'MESA-movies', 'sin mesas esperando se abre la del mazo que sale primero al barajar');
  esperando.add('world');
  const conMesa = await buscar(['history', 'world', 'movies'], 4);
  assert.equal(conMesa.code, 'MESA-world', 'si un mazo tiene mesa esperando se entra en ella');
}
console.log('Mesa al azar: baraja los mazos antes de abrir una: OK');
