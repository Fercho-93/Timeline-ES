// Repaso horario de los duelos por turnos abiertos (maintainTurnDuels): qué duelos necesitan un recordatorio o
// caducar. Recibe la base de datos y lo que hay que hacer con cada duelo por parámetro para poder probarse con
// dobles (tests/duelo-policy.cjs); la transacción y el aviso están en index.js.
const { DAY, lifecycle } = require('./duel-policy');
const { inParallel } = require('./purge');

const ACTIVE = ['waiting', 'playing'];
// Lo que necesita `lifecycle` para decidir. Se lee solo eso (`select`), no el duelo entero con sus jugadas.
const FIELDS = ['status', 'updatedAt', 'createdAt', 'turnUid', 'invitedUid', 'turnIndex', 'remindedTurn'];
const PAGE = 500;
// Duelos que se tratan a la vez (cada uno es una transacción y, a veces, un aviso al móvil).
const CONCURRENCY = 20;
// Ningún duelo necesita nada antes de dos días sin jugar (el primer recordatorio).
const FIRST_ACTION = 2 * DAY;
// Firestore responde FAILED_PRECONDITION (9) a una consulta sin su índice compuesto.
const MISSING_INDEX = 9;

// Recorre los duelos abiertos que llevan dos días o más sin jugar, del más antiguo al más reciente, y llama a
// `handle(ref)` con los que necesitan algo, hasta `deadline`. No hace falta guardar por dónde va: un duelo caducado
// deja de estar abierto y uno ya avisado deja de necesitar nada, así que la ejecución siguiente empieza por lo que
// quedó pendiente, y lo más urgente (lo que caduca) siempre va primero.
// La consulta necesita el índice compuesto de `turnDuels` (status, updatedAt). Si aún no existe, recorre los
// duelos abiertos por identificador, como antes (`indexed: false` en el resultado), para no dejar de avisar.
async function maintainOpenDuels(db, now, handle, { deadline = Infinity } = {}) {
  const result = { checked: 0, handled: 0, failed: 0, timedOut: false, indexed: true };
  const due = new Date(now - FIRST_ACTION);
  let last;
  for (;;) {
    if (Date.now() >= deadline) { result.timedOut = true; break; }
    let query = db.collection('turnDuels').where('status', 'in', ACTIVE);
    if (result.indexed) query = query.where('updatedAt', '<=', due).orderBy('updatedAt');
    query = query.select(...FIELDS).limit(PAGE);
    if (last) query = query.startAfter(last);
    let page;
    try { page = await query.get(); }
    catch (error) {
      if (!result.indexed || error?.code !== MISSING_INDEX) throw error;
      result.indexed = false; last = undefined;
      continue;
    }
    result.checked += page.size;
    const pending = page.docs.filter(doc => lifecycle(doc.data(), now));
    await inParallel(pending, CONCURRENCY, async doc => {
      try { await handle(doc.ref); result.handled++; }
      catch (error) { result.failed++; result.lastError = error?.code || error?.message; }
    });
    if (page.size < PAGE) break;
    last = page.docs.at(-1);
  }
  return result;
}

module.exports = { ACTIVE, FIELDS, PAGE, maintainOpenDuels };
