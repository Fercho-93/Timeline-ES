// La limpieza del servidor (functions/purge.js) usa permisos de administrador y no pasa por las reglas de Firestore:
// su cortafuegos son un plazo mínimo y un tope de borrados por ejecución. Además tiene que dar abasto con mucho
// volumen: lee solo la fecha de cada documento, borra en bloque, se para antes del corte de la función y la
// ejecución siguiente sigue donde se quedó. Con una base de datos en memoria.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../functions/retention.js');
const P = require('../functions/purge.js');
const { purgeCollection, purgeRanking, purgeStaleGuests, inParallel, MAX_PURGE_PER_RUN, PAGE } = P;
const DAY = R.DAY, now = Date.parse('2026-10-10T12:00:00Z');
// Si algo se queda esperando un borrado que nunca se envía (un BulkWriter sin vaciar), la prueba falla en vez de colgarse.
setTimeout(() => { console.error('La limpieza se ha quedado esperando'); process.exit(1); }, 60000).unref();

// Un plazo por debajo de un día (o inválido) hace fallar el cálculo del límite antes de borrar nada.
for (const name of Object.keys(R.ACTIVITY)) assert.ok(R.RETENTION[name] >= R.MIN_RETENTION, `${name}: plazo de al menos un día`);
assert.equal(R.MIN_RETENTION, DAY);
for (const bad of [0, -DAY, DAY - 1, NaN, '7', undefined]) {
  assert.throws(() => R.cutoff('rooms', now, { ...R.RETENTION, rooms: bad }), /Plazo de conservación no válido/, `un plazo ${String(bad)} no se acepta`);
}
assert.equal(R.cutoff('rooms', now, { ...R.RETENTION, rooms: DAY }).toISOString(), '2026-10-09T12:00:00.000Z', 'un día justo sí');
assert.throws(() => R.cutoff('no-existe', now), /Plazo de conservación no válido/, 'una colección sin plazo no calcula límite');

// Base de datos en memoria con lo que usa la limpieza: consultas con where/orderBy/select/limit/startAfter,
// listDocuments, BulkWriter (los borrados no se envían hasta flush o close, como en Firestore) y recursiveDelete.
function fakeDb(entries = {}) {
  const store = new Map(Object.entries(entries));
  const log = { selects: [], writers: 0, closed: 0, recursive: [], maxNested: 0, failOn: new Set() };
  let nestedNow = 0;
  const ref = path => ({
    path, id: path.split('/').at(-1),
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    set: async data => { store.set(path, data); },
    delete: async () => { store.delete(path); },
  });
  const query = (name, state = { filters: [], order: null, fields: null, max: Infinity, after: null }) => {
    const next = change => query(name, { ...state, ...change });
    return {
      where: (field, op, value) => next({ filters: [...state.filters, { field, op, value }] }),
      orderBy: field => next({ order: field }),
      select: (...fields) => { log.selects.push(fields); return next({ fields }); },
      limit: max => next({ max }),
      startAfter: snap => next({ after: snap }),
      get: async () => {
        // Orden de Firestore: por el campo de orderBy y, a igualdad, por la ruta.
        const before = (a, b) => a.at - b.at || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
        let found = [];
        for (const [path, d] of store) {
          if (!path.startsWith(`${name}/`) || path.indexOf('/', name.length + 1) >= 0) continue;
          if (state.filters.every(f => f.op === '<' ? d[f.field] < f.value : f.op === '<=' ? d[f.field] <= f.value : f.value.includes(d[f.field]))) {
            found.push({ path, d, at: state.order ? +d[state.order] : 0 });
          }
        }
        if (state.after) found = found.filter(entry => before(entry, state.after._key) > 0);
        found = found.sort(before).slice(0, state.max);
        const pick = d => state.fields ? Object.fromEntries(state.fields.filter(f => f in d).map(f => [f, d[f]])) : d;
        const docs = found.map(entry => ({ id: entry.path.split('/')[1], ref: ref(entry.path), _key: entry, data: () => pick(entry.d) }));
        return { size: docs.length, docs };
      },
    };
  };
  const remove = path => { for (const key of [...store.keys()]) if (key === path || key.startsWith(`${path}/`)) store.delete(key); };
  const db = {
    store, log,
    doc: ref,
    collection: name => ({
      ...query(name),
      listDocuments: async () => [...new Set([...store.keys()].filter(k => k.startsWith(`${name}/`)).map(k => k.split('/')[1]))].map(id => ref(`${name}/${id}`)),
    }),
    bulkWriter: () => {
      log.writers++;
      let queue = [];
      const send = async () => { const batch = queue; queue = []; for (const op of batch) op(); };
      return {
        delete: target => new Promise((resolve, reject) => {
          queue.push(() => { if (log.failOn.has(target.path)) reject(Object.assign(new Error('caído'), { code: 'unavailable' })); else { store.delete(target.path); resolve(); } });
        }),
        flush: send,
        close: async () => { log.closed++; await send(); },
      };
    },
    recursiveDelete: async (target, writer) => {
      log.recursive.push({ path: target.path, shared: !!writer });
      log.maxNested = Math.max(log.maxNested, ++nestedNow);
      await new Promise(resolve => setImmediate(resolve));
      nestedNow--;
      if (log.failOn.has(target.path)) throw Object.assign(new Error('caído'), { code: 'unavailable' });
      remove(target.path);
    },
  };
  return db;
}
const at = ms => new Date(ms);
const seed = (name, count, age = 10 * DAY, field = R.ACTIVITY[name]) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${name}/${name}-${String(i).padStart(6, '0')}`, { [field]: at(now - age - i), relleno: 'x'.repeat(50) }]));
const count = (db, prefix) => [...db.store.keys()].filter(k => k.startsWith(prefix)).length;

// Borra solo lo caducado, en varias páginas, y no toca lo reciente.
{
  const db = fakeDb({ ...seed('publicTables', 2 * PAGE + 50), 'publicTables/nueva': { updatedAt: at(now - DAY / 2) }, 'publicTables/otra': { updatedAt: at(now - 1000) } });
  const result = await purgeCollection(db, 'publicTables', now);
  assert.deepEqual(result, { removed: 2 * PAGE + 50, failed: 0, capped: false, timedOut: false });
  assert.deepEqual([...db.store.keys()].sort(), ['publicTables/nueva', 'publicTables/otra'], 'los recientes siguen ahí');
  // Lee solo la fecha, no los documentos enteros (pueden pesar 1 MB cada uno), y cierra su BulkWriter.
  assert.ok(db.log.selects.length >= 3 && db.log.selects.every(fields => fields.length === 1 && fields[0] === 'updatedAt'), 'cada página lee solo updatedAt');
  assert.equal(db.log.writers, 1);
  assert.equal(db.log.closed, 1);
  assert.equal(db.log.recursive.length, 0, 'una colección sin subcolecciones no busca lo de dentro de cada documento');
}
// Cada colección con su campo de fecha: las denuncias por createdAt, los avisos por claimedAt.
{
  const db = fakeDb({ ...seed('reports', 3, 91 * DAY), ...seed('duelNotificationEvents', 4, 31 * DAY), 'reports/reciente': { createdAt: at(now - 89 * DAY) }, 'duelNotificationEvents/reciente': { claimedAt: at(now - 29 * DAY) } });
  assert.equal((await purgeCollection(db, 'reports', now)).removed, 3);
  assert.equal((await purgeCollection(db, 'duelNotificationEvents', now)).removed, 4);
  assert.deepEqual([...db.store.keys()].sort(), ['duelNotificationEvents/reciente', 'reports/reciente']);
}
// Una sala se borra con sus subcolecciones (presencia, quién empieza, respuestas de la final), con un BulkWriter
// compartido y varias a la vez, pero con un máximo.
{
  const rooms = seed('rooms', 120);
  for (const path of Object.keys(rooms)) {
    rooms[`${path}/presence/ana`] = {}; rooms[`${path}/starter/ana`] = {}; rooms[`${path}/finalRounds/1/answers/ana`] = {};
  }
  const db = fakeDb({ ...rooms, 'rooms/viva': { updatedAt: at(now - DAY) }, 'rooms/viva/presence/luis': {} });
  const result = await purgeCollection(db, 'rooms', now);
  assert.equal(result.removed, 120);
  assert.deepEqual([...db.store.keys()].sort(), ['rooms/viva', 'rooms/viva/presence/luis'], 'no quedan subcolecciones huérfanas');
  assert.ok(db.log.recursive.every(call => call.shared), 'recursiveDelete usa el BulkWriter de la colección');
  assert.ok(db.log.maxNested > 1 && db.log.maxNested <= 25, `salas a la vez: ${db.log.maxNested}`);
}
// Con más caducados que el tope, se detiene en el tope y deja el resto para la ejecución siguiente; borra primero
// lo más antiguo.
{
  const db = fakeDb(seed('rooms', 1000));
  const result = await purgeCollection(db, 'rooms', now, { max: 300 });
  assert.deepEqual(result, { removed: 300, failed: 0, capped: true, timedOut: false });
  assert.equal(count(db, 'rooms/'), 700, 'el resto queda sin borrar');
  assert.ok(!db.store.has('rooms/rooms-000999') && db.store.has('rooms/rooms-000000'), 'se ha empezado por lo más antiguo');
  const next = await purgeCollection(db, 'rooms', now, { max: 300 });
  assert.equal(next.removed, 300, 'la siguiente ejecución sigue donde se quedó');
}
// Si un fallo hiciera caducar todo (por ejemplo, fechas mal escritas), el tope por defecto limita el daño de una ejecución.
{
  const total = MAX_PURGE_PER_RUN + 700;
  const db = fakeDb(seed('creationQuota', total));
  const result = await purgeCollection(db, 'creationQuota', now);
  assert.equal(result.removed, MAX_PURGE_PER_RUN);
  assert.equal(result.capped, true);
  assert.equal(db.store.size, 700);
}
// El tope es proporcional al volumen: la limpieza corre cada hora y, con 50.000 salas al día, caducan unas 2.000 por
// hora. Tiene que dejar margen de sobra y, aun así, no ser tan alto que no proteja.
assert.ok(MAX_PURGE_PER_RUN >= 10 * 50000 / 24 && MAX_PURGE_PER_RUN <= 100000, 'el tope deja diez veces el volumen de una hora y protege');
assert.ok(MAX_PURGE_PER_RUN >= PAGE && PAGE <= 1000, 'páginas pequeñas: solo fechas, y nunca más que el tope');
// Se para a tiempo: pasado el plazo de la ejecución no empieza otra página, y la siguiente ejecución sigue.
{
  const db = fakeDb(seed('quickRooms', 3 * PAGE, 31 * DAY));
  const late = await purgeCollection(db, 'quickRooms', now, { deadline: Date.now() - 1 });
  assert.deepEqual(late, { removed: 0, failed: 0, capped: false, timedOut: true });
  assert.equal(db.log.closed, 1, 'cierra su BulkWriter aunque no haya hecho nada');
  // Tras la primera página, el reloj marca que se ha acabado el tiempo.
  const realNow = Date.now, start = db.log.selects.length;
  Date.now = () => realNow() + (db.log.selects.length > start ? 10 * 60000 : 0);
  try {
    const partial = await purgeCollection(db, 'quickRooms', now, { deadline: realNow() + 60000 });
    assert.equal(partial.timedOut, true);
    assert.equal(partial.removed, PAGE, 'termina la página empezada y no pide otra');
  } finally { Date.now = realNow; }
  const rest = await purgeCollection(db, 'quickRooms', now);
  assert.equal(rest.removed, 2 * PAGE, 'la ejecución siguiente borra lo que quedaba');
  assert.equal(count(db, 'quickRooms/'), 0);
}
// Un borrado que falla no para los demás ni se repite en bucle: queda para la ejecución siguiente.
{
  const db = fakeDb(seed('turnDuels', 10, 31 * DAY));
  db.log.failOn.add('turnDuels/turnDuels-000003');
  const result = await purgeCollection(db, 'turnDuels', now);
  assert.equal(result.removed, 9);
  assert.equal(result.failed, 1);
  assert.equal(result.lastError, 'unavailable');
  db.log.failOn.clear();
  assert.equal((await purgeCollection(db, 'turnDuels', now)).removed, 1, 'la siguiente ejecución lo borra');
  const rooms = fakeDb(seed('rooms', 5));
  rooms.log.failOn.add('rooms/rooms-000001');
  const nested = await purgeCollection(rooms, 'rooms', now);
  assert.deepEqual([nested.removed, nested.failed], [4, 1], 'también con subcolecciones');
}
// Las colecciones de la limpieza horaria son independientes: un fallo en una no impide las demás (index.js las lanza
// a la vez con Promise.allSettled), y cada una tiene su BulkWriter.
{
  const db = fakeDb({ ...seed('publicQueues', 5, 2 * DAY), ...seed('roomCreation', 5, 8 * DAY) });
  const broken = { ...db, collection: name => name === 'publicQueues' ? { where: () => { throw new Error('índice'); } } : db.collection(name) };
  const outcomes = await Promise.allSettled(['publicQueues', 'roomCreation'].map(name => purgeCollection(broken, name, now)));
  assert.equal(outcomes[0].status, 'rejected');
  assert.equal(outcomes[1].value.removed, 5);
}

// Tablas del ranking: se borran enteras (con sus filas) cuando su fecha sale del plazo, de la más antigua a la más
// reciente y con tope.
{
  const tables = {};
  for (const day of ['2026-06-01', '2026-06-02', '2026-06-03', '2026-07-01', '2026-09-30', 'no-es-fecha']) tables[`dailyScores/${day}/players/ana`] = { score: 1 };
  const db = fakeDb(tables);
  const first = await purgeRanking(db, 'dailyScores', now, { max: 2 });
  assert.deepEqual(first, { removed: 2, failed: 0, capped: true, timedOut: false });
  assert.ok(!db.store.has('dailyScores/2026-06-01/players/ana') && !db.store.has('dailyScores/2026-06-02/players/ana'), 'empieza por las más antiguas');
  const second = await purgeRanking(db, 'dailyScores', now);
  assert.equal(second.removed, 2);
  assert.deepEqual([...db.store.keys()].sort(), ['dailyScores/2026-09-30/players/ana', 'dailyScores/no-es-fecha/players/ana']);
  assert.ok(db.log.recursive.every(call => call.shared));
  assert.ok(P.MAX_RANKING_TABLES_PER_RUN >= 2 && P.MAX_RANKING_TABLES_PER_RUN <= 31, 'tope de tablas por día razonable');
}

// Invitados caducados: se repasan por páginas, se borran solo los anónimos de más de un año y el repaso sigue al día
// siguiente donde se quedó (cursor en purgeState/staleGuests).
{
  const user = (uid, days, providers = []) => ({ uid, providerData: providers, metadata: { lastRefreshTime: new Date(now - days * DAY).toUTCString() } });
  let users = [];
  for (let i = 0; i < 25; i++) users.push(user(`u${String(i).padStart(2, '0')}`, i % 2 ? 400 : 10));
  users.push(user('z-apple', 900, [{ providerId: 'apple.com' }]));
  const deleted = [], listed = [];
  const auth = {
    listUsers: async (size, token) => {
      listed.push(token ?? null);
      if (token === 'caducado') throw Object.assign(new Error('x'), { code: 'auth/invalid-page-token' });
      const start = token ? users.findIndex(u => u.uid > token) : 0;
      const page = start < 0 ? [] : users.slice(start, start + size);
      const last = page.at(-1);
      return { users: page, pageToken: last && users.indexOf(last) < users.length - 1 ? last.uid : undefined };
    },
    deleteUser: async uid => { deleted.push(uid); users = users.filter(u => u.uid !== uid); },
  };
  const db = fakeDb();
  const realNow = Date.now;
  let calls = 0;
  // La primera ejecución se queda sin tiempo tras dos páginas de cinco.
  const listUsers = auth.listUsers;
  auth.listUsers = async (...args) => { calls++; return listUsers(...args); };
  Date.now = () => realNow() + (calls >= 2 ? 10 * 60000 : 0);
  let first;
  try { first = await purgeStaleGuests(db, auth, now, { pageSize: 5, deadline: realNow() + 60000 }); }
  finally { Date.now = realNow; }
  assert.equal(first.timedOut, true);
  assert.equal(first.checked, 10);
  assert.deepEqual(deleted, ['u01', 'u03', 'u05', 'u07', 'u09'], 'solo los invitados de más de un año');
  assert.equal(db.store.get(P.GUEST_CURSOR)?.pageToken, 'u09', 'guarda por dónde va');
  // La siguiente sigue desde ahí, llega al final y borra el cursor para empezar de nuevo la próxima vez.
  const second = await purgeStaleGuests(db, auth, now, { pageSize: 5 });
  assert.equal(listed.at(-4), 'u09', 'retoma el repaso donde se quedó');
  assert.equal(second.finished, true);
  assert.deepEqual(deleted.slice(5), ['u11', 'u13', 'u15', 'u17', 'u19', 'u21', 'u23']);
  assert.ok(!db.store.has(P.GUEST_CURSOR));
  assert.ok(users.some(u => u.uid === 'z-apple'), 'una cuenta de Apple nunca se borra sola');
  // Tope por ejecución: a mitad de página, el cursor no pasa de ella.
  for (let i = 0; i < 6; i++) users.push(user(`v${i}`, 500));
  users.sort((a, b) => a.uid < b.uid ? -1 : 1);
  const capped = await purgeStaleGuests(db, auth, now, { pageSize: 50, max: 4 });
  assert.equal(capped.removed, 4);
  assert.equal(capped.capped, true);
  assert.ok(!db.store.has(P.GUEST_CURSOR), 'con el tope a mitad de la primera página no se guarda cursor');
  assert.equal((await purgeStaleGuests(db, auth, now, { pageSize: 50 })).removed, 2, 'la siguiente borra los que faltaban');
  // Un cursor que Authentication ya no reconoce: vuelve a empezar en vez de fallar.
  db.store.set(P.GUEST_CURSOR, { pageToken: 'caducado' });
  const restart = await purgeStaleGuests(db, auth, now, { pageSize: 50 });
  assert.equal(restart.finished, true);
  assert.equal(listed.at(-1), null);
  // Si borrar una cuenta falla, sigue con las demás y lo cuenta.
  users.push(user('w1', 500), user('w2', 500));
  const failing = { ...auth, deleteUser: async uid => { if (uid === 'w1') throw Object.assign(new Error('x'), { code: 'auth/internal-error' }); return auth.deleteUser(uid); } };
  const partial = await purgeStaleGuests(db, failing, now, { pageSize: 50 });
  assert.deepEqual([partial.removed, partial.failed, partial.lastError], [1, 1, 'auth/internal-error']);
  assert.ok(P.MAX_GUESTS_PER_RUN >= 1000 && P.MAX_GUESTS_PER_RUN <= 50000);
}

// inParallel: todos los elementos, nunca más de los permitidos a la vez.
{
  let running = 0, peak = 0;
  const seen = [];
  await inParallel([...Array(40).keys()], 7, async i => { running++; peak = Math.max(peak, running); await new Promise(r => setImmediate(r)); seen.push(i); running--; });
  assert.equal(seen.length, 40);
  assert.equal(peak, 7);
  await inParallel([], 5, async () => { throw new Error('nunca'); });
}
assert.ok(P.RUN_BUDGET_MS <= 480000 && P.RUN_BUDGET_MS >= 300000, 'deja de empezar trabajo con margen antes del corte de 540 s');
console.log('Limpieza: plazo mínimo, solo fechas, en bloque, tope por ejecución, parada a tiempo y reanudación: OK');
