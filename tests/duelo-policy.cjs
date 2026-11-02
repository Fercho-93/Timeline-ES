const assert = require('node:assert/strict');
const { DAY, lifecycle, movementMessage } = require('../functions/duel-policy');
const start = 1700000000000;
const game = { status: 'playing', turnUid: 'a', turnIndex: 2, updatedAt: { seconds: start / 1000 } };
assert.equal(lifecycle(game, start + 2 * DAY - 1), null);
assert.deepEqual(lifecycle(game, start + 2 * DAY), { type: 'remind', recipient: 'a', turnKey: 'playing:2' });
assert.equal(lifecycle({ ...game, remindedTurn: 'playing:2' }, start + 3 * DAY), null);
assert.equal(lifecycle({ ...game, remindedTurn: 'playing:2', turnIndex: 4 }, start + 3 * DAY).type, 'remind');
assert.equal(lifecycle(game, start + 7 * DAY).type, 'expire');
assert.equal(lifecycle({ ...game, status: 'finished' }, start + 9 * DAY), null);
assert.equal(lifecycle({ ...game, status: 'waiting', turnUid: null }, start + 3 * DAY), null);
assert.equal(lifecycle({ ...game, status: 'waiting', invitedUid: 'b' }, start + 3 * DAY).recipient, 'b');
assert.equal(movementMessage(game, { ...game, remindedTurn: 'playing:2' }), null);
assert.equal(movementMessage(game, { ...game, status: 'expired', turnUid: null }), null);
assert.equal(movementMessage(game, { ...game, turnUid: 'b' }).recipient, 'b');

// Repaso horario (functions/duel-maintenance.js) con una base en memoria: solo los duelos abiertos con dos días o más
// sin jugar, del más antiguo al más reciente, leyendo solo lo que necesita lifecycle, varios a la vez, parando a tiempo
// y siguiendo en la ejecución siguiente. Sin el índice compuesto, recorre todos los abiertos.
const { maintainOpenDuels, FIELDS, PAGE } = require('../functions/duel-maintenance');
const ts = ms => ({ toMillis: () => ms, valueOf: () => ms });
function fakeDb(duels, { indexMissing = false } = {}) {
  const store = new Map(Object.entries(duels)), log = { selects: [], queries: 0 };
  const query = (state = { filters: [], order: null, fields: null, max: Infinity, after: null }) => {
    const next = change => query({ ...state, ...change });
    return {
      where: (field, op, value) => next({ filters: [...state.filters, { field, op, value }] }),
      orderBy: field => next({ order: field }),
      select: (...fields) => { log.selects.push(fields); return next({ fields }); },
      limit: max => next({ max }),
      startAfter: snap => next({ after: snap._key }),
      get: async () => {
        log.queries++;
        if (indexMissing && state.order === 'updatedAt' && state.filters.some(f => f.field === 'status')) throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
        const key = id => [state.order ? +store.get(id)[state.order] : 0, id];
        const before = (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
        let ids = [...store.keys()].filter(id => state.filters.every(({ field, op, value }) => op === 'in' ? value.includes(store.get(id)[field]) : store.get(id)[field] <= value));
        ids.sort((a, b) => before(key(a), key(b)));
        if (state.after) ids = ids.filter(id => before(key(id), state.after) > 0);
        ids = ids.slice(0, state.max);
        const pick = d => Object.fromEntries(state.fields.filter(f => f in d).map(f => [f, d[f]]));
        return { size: ids.length, docs: ids.map(id => ({ id, ref: { id }, _key: key(id), data: () => pick(store.get(id)) })) };
      },
    };
  };
  return { store, log, collection: name => { assert.equal(name, 'turnDuels'); return query(); } };
}
const duel = (status, daysAgo, extra = {}) => ({ status, turnUid: 'a', turnIndex: 1, updatedAt: ts(start - daysAgo * DAY), createdAt: ts(start - 20 * DAY), plays: Array(50).fill({ card: 'x' }), ...extra });
const sample = () => ({
  caduca: duel('playing', 8), avisar: duel('playing', 3), avisado: duel('playing', 3.5, { remindedTurn: 'playing:1' }),
  reciente: duel('playing', 1), terminado: duel('finished', 10), invitacion: duel('waiting', 2.5, { turnUid: null, invitedUid: 'b' }),
});
(async () => {
  // Lo que lee el repaso basta para decidir: con solo esos campos, lifecycle dice lo mismo que con el duelo entero.
  for (const game of Object.values(sample())) {
    const only = Object.fromEntries(FIELDS.filter(f => f in game).map(f => [f, game[f]]));
    assert.deepEqual(lifecycle(only, start), lifecycle(game, start));
  }
  {
    const db = fakeDb(sample()), handled = [];
    const result = await maintainOpenDuels(db, start, async ref => { handled.push(ref.id); });
    assert.deepEqual(handled, ['caduca', 'avisar', 'invitacion'], 'del más antiguo al más reciente, solo los que necesitan algo');
    assert.equal(result.checked, 4, 'ni los recientes ni los terminados llegan a leerse');
    assert.deepEqual([result.handled, result.failed, result.timedOut, result.indexed], [3, 0, false, true]);
    assert.ok(db.log.selects.every(fields => fields.join() === FIELDS.join()), 'solo los campos de lifecycle, no las jugadas');
  }
  // Muchos duelos: varios a la vez (con máximo), para a tiempo y la ejecución siguiente sigue por lo que quedó,
  // sin guardar nada: los ya caducados dejan de estar abiertos.
  {
    const many = {};
    for (let i = 0; i < 2 * PAGE + 200; i++) many[`d${String(i).padStart(5, '0')}`] = duel('playing', 8 + i / 1000);
    const db = fakeDb(many);
    let running = 0, peak = 0;
    const expire = async ref => { running++; peak = Math.max(peak, running); await new Promise(r => setImmediate(r)); db.store.get(ref.id).status = 'expired'; running--; };
    const realNow = Date.now;
    Date.now = () => realNow() + (db.log.queries >= 1 ? 10 * 60000 : 0);
    let first;
    try { first = await maintainOpenDuels(db, start, expire, { deadline: realNow() + 60000 }); }
    finally { Date.now = realNow; }
    assert.deepEqual([first.handled, first.timedOut], [PAGE, true], 'termina la página empezada y se para');
    assert.ok(db.store.get(`d${String(2 * PAGE + 199).padStart(5, '0')}`).status === 'expired', 'empieza por el más antiguo');
    assert.ok(peak > 1 && peak <= 20, `duelos a la vez: ${peak}`);
    const second = await maintainOpenDuels(db, start, expire);
    assert.deepEqual([second.handled, second.timedOut], [PAGE + 200, false], 'la siguiente hace el resto');
    assert.ok([...db.store.values()].every(game => game.status === 'expired'));
  }
  // Sin el índice compuesto (status, updatedAt), recorre todos los abiertos y decide igual.
  {
    const db = fakeDb(sample(), { indexMissing: true }), handled = [];
    const result = await maintainOpenDuels(db, start, async ref => { handled.push(ref.id); });
    assert.equal(result.indexed, false);
    assert.deepEqual(handled.sort(), ['avisar', 'caduca', 'invitacion']);
    assert.equal(result.checked, 5, 'lee todos los abiertos, también los recientes');
  }
  // Un duelo que falla no para a los demás; cualquier otro error de la consulta sí se nota.
  {
    const db = fakeDb(sample()), handled = [];
    const result = await maintainOpenDuels(db, start, async ref => { if (ref.id === 'caduca') throw Object.assign(new Error('x'), { code: 'aborted' }); handled.push(ref.id); });
    assert.deepEqual([result.handled, result.failed, result.lastError], [2, 1, 'aborted']);
    const broken = { collection: () => ({ where: () => ({ where: () => ({ orderBy: () => ({ select: () => ({ limit: () => ({ get: async () => { throw Object.assign(new Error('caído'), { code: 14 }); } }) }) }) }) }) }) };
    await assert.rejects(() => maintainOpenDuels(broken, start, async () => {}), /caído/);
  }
  console.log('OK: 48h reminders, one per turn, 7-day expiry, invitation and movement messages; hourly scan by age, resumable, without full documents.');
})().catch(error => { console.error(error); process.exit(1); });
