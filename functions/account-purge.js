// Todo lo que el servidor guarda de una cuenta. Lo usan la función `deleteMyAccount` (borrado desde el
// juego), la limpieza de invitados caducados y el borrado manual del titular (scripts/borrar-cuenta.mjs).
// Recibe la base de datos y el servicio de usuarios por parámetro para poder probarlo con dobles.

// Documentos sueltos de la cuenta; `recursiveDelete` se lleva también sus subcolecciones
// (avisos del móvil, bloqueados, archivados).
const ACCOUNT_DOCS = ['playerProfiles', 'playerProgress', 'socialRanking', 'dailyRanking', 'discoveryScores',
  'duelPreferences', 'creationQuota', 'roomCreation', 'duelReminderBudgets'];
// Colecciones con un documento por día o semana y, dentro, una fila por jugador.
const RANKING_COLLECTIONS = ['dailyScores', 'weeklyScores'];

async function purgeAccountData(db, uid) {
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('uid no válido');
  const aliasKey = (await db.doc(`playerProfiles/${uid}`).get()).data()?.aliasKey;
  // El nombre se libera antes que el perfil, que es donde se guarda `aliasKey`: si el borrado se corta entre los dos
  // pasos, al repetirlo el perfil sigue ahí y el nombre no se queda reservado para siempre sin dueño.
  if (aliasKey) {
    const name = db.doc(`playerNames/${aliasKey}`);
    if ((await name.get()).data()?.uid === uid) await name.delete();
  }
  // Las filas del ranking de todos los días y semanas que aún se conservan.
  for (const name of RANKING_COLLECTIONS) {
    for (const period of await db.collection(name).listDocuments()) await period.collection('players').doc(uid).delete();
  }
  for (const collection of ACCOUNT_DOCS) await db.recursiveDelete(db.doc(`${collection}/${uid}`));
}

// Borra los datos y, al final, el usuario de acceso. Si el usuario ya no existe, no es un error:
// así se puede repetir una petición que se cortó a medias.
async function deleteAccount(db, auth, uid) {
  await purgeAccountData(db, uid);
  try { await auth.deleteUser(uid); }
  catch (error) { if (error?.code !== 'auth/user-not-found') throw error; }
}

// A quién se refiere un identificador o un nombre de jugador (borrado manual por moderación).
// Devuelve el uid, o null si no hay nadie con ese dato.
async function findUid(db, target) {
  const text = String(target ?? '').trim();
  if (!text || text.includes('/')) return null;
  if ((await db.doc(`playerProfiles/${text}`).get()).exists) return text;
  return (await db.doc(`playerNames/${text.toLowerCase()}`).get()).data()?.uid ?? null;
}

module.exports = { ACCOUNT_DOCS, RANKING_COLLECTIONS, purgeAccountData, deleteAccount, findUid };
