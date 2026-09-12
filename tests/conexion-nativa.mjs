import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Ejecuta las funciones reales; solo Firebase y los efectos de pantalla se simulan.
// Ninguna prueba crea salas de producción.
const source = fs.readFileSync(new URL('../online.js', import.meta.url), 'utf8');
const links = fs.readFileSync(new URL('../links.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function invitationUrl('), source.indexOf('function gfMultiply('));
const operations = source.slice(source.indexOf('async function createRoom('), source.indexOf('function connectToRoom('));
const code = 'ABCD2345';

function setup(href, native, { blockedHistory = false, serverError = null } = {}) {
  const events = [], messages = [], warnings = [];
  const location = new URL(href);
  const CT = { Links: null, deckFingerprint: () => 'deck-v1' };
  const room = { status: 'lobby', mode: 'history', deckFingerprint: 'deck-v1', playerOrder: ['host'], players: {}, version: 1 };
  const context = vm.createContext({
    window: { CONTINUUM: CT, Capacitor: { isNativePlatform: () => native } },
    location, URL, URLSearchParams,
    console: { error() {}, warn: (...args) => warnings.push(args) },
    history: { replaceState(_state, _title, value) {
      events.push('history');
      if (blockedHistory || new URL(value).origin !== location.origin) throw new DOMException('Different origin', 'SecurityError');
      location.href = value;
    } },
    ensureAuth: async () => {}, createRoomCode: () => code,
    doc: (_db, ...parts) => parts.join('/'), serverTimestamp: () => 'server-time',
    writeBatch: () => ({ set() {}, async commit() { if (serverError) throw serverError; events.push('saved'); } }),
    runTransaction: async (_db, work) => {
      if (serverError) throw serverError;
      await work({ get: async () => ({ exists: () => true, data: () => room }), update() {} });
      events.push('saved');
    },
    rememberRoom: () => events.push('remembered'),
    connectToRoom: value => { assert.equal(value, code); events.push('connected'); },
    showToast: message => messages.push(message),
  });
  vm.runInContext(links, context);
  vm.runInContext(`const CT = window.CONTINUUM, db = {}, user = {uid:'guest'}, CLIENT_VERSION = 40;
    let busy = false, selectedModeKey = 'history', roomCode = '';
    ${helpers}\n${operations}`, context);
  return { context, events, messages, warnings, location };
}

for (const operation of ['createRoom', 'joinRoom']) {
  const run = ctx => operation === 'createRoom' ? ctx.createRoom('Fer') : ctx.joinRoom(code, 'Fer');
  for (const [href, native] of [
    ['capacitor://localhost/', true],
    ['https://localhost/', true],
    ['https://fercho-93.github.io/Timeline-ES/?old=1#old', false],
  ]) {
    const test = setup(href, native);
    await run(test.context);
    assert.deepEqual(test.events, native ? ['saved', 'remembered', 'connected'] : ['saved', 'remembered', 'history', 'connected']);
    assert.equal(test.messages.length, 0);
    assert.equal(test.location.href, native ? href : `https://fercho-93.github.io/Timeline-ES/?room=${code}`);
    assert.equal(test.context.invitationUrl(code), `https://fercho-93.github.io/Timeline-ES/?room=${code}`);
  }
  const blocked = setup('https://fercho-93.github.io/Timeline-ES/', false, { blockedHistory: true });
  await run(blocked.context);
  assert.equal(blocked.events.at(-1), 'connected', 'un fallo del historial no impide entrar');
  assert.equal(blocked.messages.length, 0);
  assert.equal(blocked.warnings.length, 1);

  for (const errorCode of ['unavailable', 'permission-denied']) {
    const rejected = setup('capacitor://localhost/', true, { serverError: { code: errorCode } });
    await run(rejected.context);
    assert.deepEqual(rejected.events, [], 'un rechazo del servidor no conecta una sala inexistente');
    assert.match(rejected.messages[0], errorCode === 'unavailable' ? /contactar con el servidor/ : /servidor ha rechazado/);
    await run(rejected.context);
    assert.equal(rejected.messages.length, 2, 'se libera el bloqueo para poder reintentar');
  }
}
console.log('OK: crear y entrar en iOS, Android y web; enlaces públicos, historial bloqueado y errores del servidor.');
