// Limpieza de lo caducado según los plazos de retention.js: las colecciones con fecha de última actividad (cada
// hora), las tablas del ranking y los invitados sin usar (cada día). Recibe la base de datos y el servicio de
// usuarios por parámetro para poder probarse con dobles (tests/limpieza-tope.mjs). No depende de firebase-admin:
// las pruebas la cargan sin instalar las dependencias de functions/.
const { ACTIVITY, cutoff, expiredRankingKey, staleAnonymous } = require('./retention');
const { deleteAccount } = require('./account-purge');

// Documentos por página al buscar lo caducado. Solo se lee la fecha (`select`): un documento puede pesar hasta
// 1 MB y una página de documentos enteros no cabría en la memoria de la función.
const PAGE = 500;
// Tope de documentos que una ejecución borra de una misma colección. Es un cortafuegos: la limpieza usa permisos
// de administrador y se salta las reglas de Firestore, así que si un plazo o una fecha salieran mal, sin tope
// borraría todo de una vez. Va de lo más antiguo a lo más reciente, así que un fallo se lleva primero lo más viejo.
// Con 50.000 salas al día caducan unas 2.000 por hora: el tope deja margen para picos y para recuperar atrasos,
// y lo que sobre se borra en las ejecuciones siguientes.
const MAX_PURGE_PER_RUN = 50000;
// Tablas del ranking (una por día o por semana) que se borran como mucho en una ejecución diaria.
const MAX_RANKING_TABLES_PER_RUN = 10;
// Invitados caducados que se borran como mucho en una ejecución diaria.
const MAX_GUESTS_PER_RUN = 10000;
// Colecciones con subcolecciones: se borran con `recursiveDelete`, que se lleva lo de dentro (una sala, su
// presencia, quién empieza y las respuestas de la final). En las demás basta borrar el documento.
const NESTED = new Set(['rooms']);
// Cuántas salas se borran a la vez (cada una busca antes sus subcolecciones) y cuántas cuentas de invitado.
const NESTED_CONCURRENCY = 25;
const GUEST_CONCURRENCY = 10;
const GUEST_PAGE = 1000;
// Las tareas programadas se cortan a los 540 s. A los 420 dejan de empezar trabajo nuevo y terminan lo empezado.
const RUN_BUDGET_MS = 420000;
// Por dónde va el repaso de invitados: el siguiente lo retoma ahí aunque el anterior no haya llegado al final.
// Solo lo usa el servidor: las reglas no lo abren a nadie.
const GUEST_CURSOR = 'purgeState/staleGuests';

// Ejecuta `task` con cada elemento, como mucho `limit` a la vez. `task` recoge sus propios errores.
async function inParallel(items, limit, task) {
  let next = 0;
  const worker = async () => { while (next < items.length) await task(items[next++]); };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Borra lo caducado de una colección, de lo más antiguo a lo más reciente, hasta el tope o hasta `deadline`.
// Devuelve cuántos ha borrado, cuántos han fallado (se reintentan en la ejecución siguiente) y si ha parado por el
// tope (`capped`) o por tiempo (`timedOut`). Cada colección usa su BulkWriter, que agrupa los borrados y empieza a
// 500 por segundo, como recomienda Firestore.
async function purgeCollection(db, name, now, { max = MAX_PURGE_PER_RUN, deadline = Infinity } = {}) {
  const field = ACTIVITY[name], before = cutoff(name, now), nested = NESTED.has(name);
  const result = { removed: 0, failed: 0, capped: false, timedOut: false };
  const tally = ok => ok ? result.removed++ : result.failed++;
  const fail = error => { result.lastError = error?.code || error?.message; return false; };
  const writer = db.bulkWriter();
  let last;
  try {
    for (;;) {
      const want = Math.min(PAGE, max - result.removed - result.failed);
      if (want <= 0) { result.capped = true; break; }
      if (Date.now() >= deadline) { result.timedOut = true; break; }
      // Solo la fecha: es lo que pide el orden y lo que necesita `startAfter` para seguir por la página siguiente
      // sin volver a pedir lo que aún se está borrando (o lo que ha fallado, que queda para otra ejecución).
      let query = db.collection(name).where(field, '<', before).orderBy(field).select(field).limit(want);
      if (last) query = query.startAfter(last);
      const page = await query.get();
      if (nested) {
        await inParallel(page.docs, NESTED_CONCURRENCY, async doc => tally(await db.recursiveDelete(doc.ref, writer).then(() => true, fail)));
      } else {
        const done = page.docs.map(doc => writer.delete(doc.ref).then(() => true, fail));
        await writer.flush();
        (await Promise.all(done)).forEach(tally);
      }
      if (page.size < want) break;
      last = page.docs.at(-1);
    }
  } finally { await writer.close(); }
  return result;
}

// Las tablas del ranking van por fecha (`dailyScores/2026-10-09`): se borra entera, con sus filas, cuando la fecha
// queda fuera del plazo. De la más antigua a la más reciente y con su propio tope.
async function purgeRanking(db, name, now, { max = MAX_RANKING_TABLES_PER_RUN, deadline = Infinity } = {}) {
  const expired = (await db.collection(name).listDocuments()).filter(ref => expiredRankingKey(ref.id, now))
    .sort((a, b) => a.id < b.id ? -1 : 1);
  const result = { removed: 0, failed: 0, capped: expired.length > max, timedOut: false };
  const writer = db.bulkWriter();
  try {
    for (const ref of expired.slice(0, max)) {
      if (Date.now() >= deadline) { result.timedOut = true; break; }
      try { await db.recursiveDelete(ref, writer); result.removed++; }
      catch (error) { result.failed++; result.lastError = error?.code || error?.message; }
    }
  } finally { await writer.close(); }
  return result;
}

// Invitados anónimos que llevan un año sin abrir el juego: nadie puede volver a entrar en ellos. Authentication no
// deja buscar por fecha, así que se repasan todos por páginas, retomando donde se quedó la ejecución anterior
// (GUEST_CURSOR). El cursor solo avanza cuando una página está terminada: si la ejecución se corta, esa página se
// repasa otra vez y lo ya borrado ya no sale. Al llegar al final se borra el cursor y el siguiente repaso empieza
// desde el principio.
async function purgeStaleGuests(db, auth, now, { max = MAX_GUESTS_PER_RUN, deadline = Infinity, pageSize = GUEST_PAGE } = {}) {
  const cursor = db.doc(GUEST_CURSOR);
  let token = (await cursor.get()).data()?.pageToken || undefined;
  const result = { removed: 0, failed: 0, checked: 0, capped: false, timedOut: false, finished: false };
  for (;;) {
    if (Date.now() >= deadline) { result.timedOut = true; break; }
    let page;
    try { page = await auth.listUsers(pageSize, token); }
    catch (error) {
      // Un cursor que Authentication ya no reconoce: se vuelve a empezar.
      if (token && error?.code === 'auth/invalid-page-token') { token = undefined; continue; }
      throw error;
    }
    result.checked += page.users.length;
    let stale = page.users.filter(user => staleAnonymous(user, now));
    const room = max - result.removed - result.failed;
    if (stale.length > room) { stale = stale.slice(0, room); result.capped = true; }
    await inParallel(stale, GUEST_CONCURRENCY, async user => {
      try { await deleteAccount(db, auth, user.uid); result.removed++; }
      catch (error) { result.failed++; result.lastError = error?.code || error?.message; }
    });
    // Con el tope a mitad de página, el cursor se queda antes de ella: la próxima vez se repasa entera.
    if (result.capped) break;
    token = page.pageToken;
    if (!token) { await cursor.delete(); result.finished = true; break; }
    await cursor.set({ pageToken: token, savedAt: new Date() });
  }
  return result;
}

module.exports = {
  PAGE, MAX_PURGE_PER_RUN, MAX_RANKING_TABLES_PER_RUN, MAX_GUESTS_PER_RUN, NESTED, RUN_BUDGET_MS, GUEST_CURSOR,
  inParallel, purgeCollection, purgeRanking, purgeStaleGuests
};
