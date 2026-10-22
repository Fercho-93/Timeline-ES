// La limpieza diaria (functions/purge.js) usa permisos de administrador y no pasa por las reglas de Firestore:
// su cortafuegos son un plazo mínimo y un tope de borrados por ejecución. Con una base de datos en memoria.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../functions/retention.js');
const { purgeCollection, MAX_PURGE_PER_RUN, PAGE } = require('../functions/purge.js');
const DAY = R.DAY, now = Date.parse('2026-10-10T12:00:00Z');

// Un plazo por debajo de un día (o inválido) hace fallar el cálculo del límite antes de borrar nada.
for (const name of Object.keys(R.ACTIVITY)) assert.ok(R.RETENTION[name] >= R.MIN_RETENTION, `${name}: plazo de al menos un día`);
assert.equal(R.MIN_RETENTION, DAY);
for (const bad of [0, -DAY, DAY - 1, NaN, '7', undefined]) {
  assert.throws(() => R.cutoff('rooms', now, { ...R.RETENTION, rooms: bad }), /Plazo de conservación no válido/, `un plazo ${String(bad)} no se acepta`);
}
assert.equal(R.cutoff('rooms', now, { ...R.RETENTION, rooms: DAY }).toISOString(), '2026-10-09T12:00:00.000Z', 'un día justo sí');
assert.throws(() => R.cutoff('no-existe', now), /Plazo de conservación no válido/, 'una colección sin plazo no calcula límite');

// Base de datos en memoria con lo justo para la limpieza: where(<) + limit + get y recursiveDelete.
function fakeDb(docs) {
  const store = new Map(docs.map((d, i) => [`${d.collection}/${i}`, d]));
  const deleted = [];
  const ref = key => ({ key });
  return {
    deleted, store,
    collection: name => ({
      where: (field, op, limitDate) => ({
        limit: n => ({
          get: async () => {
            const found = [...store.entries()].filter(([key, d]) => key.startsWith(`${name}/`) && d[field] < limitDate).slice(0, n);
            return { size: found.length, docs: found.map(([key]) => ({ ref: ref(key) })) };
          }
        })
      })
    }),
    recursiveDelete: async r => { store.delete(r.key); deleted.push(r.key); }
  };
}
const old = (collection, i) => ({ collection, updatedAt: new Date(now - 10 * DAY - i) });
const fresh = collection => ({ collection, updatedAt: new Date(now - DAY) });

// Borra solo lo caducado, en varias páginas, y no toca lo reciente.
{
  const db = fakeDb([...Array.from({ length: 450 }, (_, i) => old('rooms', i)), fresh('rooms'), fresh('rooms')]);
  const result = await purgeCollection(db, 'rooms', now);
  assert.deepEqual(result, { removed: 450, capped: false });
  assert.equal(db.store.size, 2, 'los dos recientes siguen ahí');
}
// Con más caducados que el tope, se detiene en el tope y deja el resto para el día siguiente.
{
  const db = fakeDb(Array.from({ length: 1000 }, (_, i) => old('rooms', i)));
  const result = await purgeCollection(db, 'rooms', now, 300);
  assert.deepEqual(result, { removed: 300, capped: true });
  assert.equal(db.store.size, 700, 'el resto queda sin borrar');
  const next = await purgeCollection(db, 'rooms', now, 300);
  assert.equal(next.removed, 300, 'la siguiente ejecución sigue donde se quedó');
}
// Si un fallo hiciera caducar todo (por ejemplo, fechas mal escritas), el tope por defecto limita el daño de un día.
{
  const total = MAX_PURGE_PER_RUN + 700;
  const db = fakeDb(Array.from({ length: total }, (_, i) => old('rooms', i)));
  const result = await purgeCollection(db, 'rooms', now);
  assert.equal(result.removed, MAX_PURGE_PER_RUN);
  assert.equal(result.capped, true);
  assert.equal(db.store.size, 700);
}
assert.ok(MAX_PURGE_PER_RUN >= PAGE && MAX_PURGE_PER_RUN <= 20000, 'el tope es razonable: ni menor que una página ni tan alto que no proteja');
console.log('Limpieza diaria: plazo mínimo, páginas, tope por ejecución y reanudación: OK');
