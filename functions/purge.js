// Limpieza diaria de una colección según los plazos de retention.js. Recibe la base de datos por parámetro para
// poder probarse con un doble (tests/limpieza-tope.mjs).
const { ACTIVITY, cutoff } = require('./retention');

const PAGE = 200;
// Tope de documentos que una ejecución borra de una misma colección. Es un cortafuegos: la limpieza usa permisos
// de administrador y se salta las reglas de Firestore, así que si un plazo o una fecha salieran mal, sin tope
// borraría todo de una vez. Con tope, el daño de un fallo en un día queda acotado y el resto sigue donde estaba.
// Lo que sobre se borra en las ejecuciones de los días siguientes.
const MAX_PURGE_PER_RUN = 5000;

// Devuelve cuántos documentos ha borrado y si se ha detenido por el tope.
async function purgeCollection(db, name, now, max = MAX_PURGE_PER_RUN) {
  let removed = 0;
  for (;;) {
    const want = Math.min(PAGE, max - removed);
    if (want <= 0) return { removed, capped: true };
    const page = await db.collection(name).where(ACTIVITY[name], '<', cutoff(name, now)).limit(want).get();
    for (const snapshot of page.docs) { await db.recursiveDelete(snapshot.ref); removed++; }
    if (page.size < want) return { removed, capped: false };
  }
}

module.exports = { PAGE, MAX_PURGE_PER_RUN, purgeCollection };
