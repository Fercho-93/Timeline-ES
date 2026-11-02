// Tareas automáticas en la nube (Cloud Functions): avisos de duelos al móvil, mantenimiento de duelos
// caducados, el borrado de cuenta (deleteMyAccount) y la limpieza de datos caducados (purgeExpiredData,
// cada hora, y purgeRankingsAndGuests, cada día). Se publican a mano.
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { DAY, millis, lifecycle, movementMessage } = require('./duel-policy');
const { getAuth } = require('firebase-admin/auth');
const { ACTIVITY } = require('./retention');
const { deleteAccount } = require('./account-purge');
const { RUN_BUDGET_MS, purgeCollection, purgeRanking, purgeStaleGuests } = require('./purge');
const { maintainOpenDuels } = require('./duel-maintenance');

// En Madrid, junto a la base de datos: los datos no salen de España para procesarse y los avisos
// de Firestore no cruzan de región. El juego llama a `deleteMyAccount` aquí (js/nube/accounts.js, FUNCTIONS_REGIONS).
// Las tareas programadas van en Bélgica (SCHEDULED_REGION): Cloud Scheduler no existe en Madrid.
setGlobalOptions({ region: 'europe-southwest1' });
const SCHEDULED_REGION = 'europe-west1';
// Una sola instancia: una ejecución no se pisa con la siguiente. Cada una deja de empezar trabajo a los
// RUN_BUDGET_MS (420 s), antes del corte de los 540 s, y lo que quede lo retoma la siguiente.
const SCHEDULED = { region: SCHEDULED_REGION, timeZone: 'Europe/Madrid', timeoutSeconds: 540, maxInstances: 1 };
initializeApp();

const db = getFirestore();
async function send(uid, duelId, title, body, type = 'turn-duel') {
  const snapshot = await db.collection('playerProfiles').doc(uid).collection('pushTokens').get();
  const docs = snapshot.docs.filter(d => typeof d.data().token === 'string');
  for (let start = 0; start < docs.length; start += 500) {
    const batch = docs.slice(start, start + 500);
    const result = await getMessaging().sendEachForMulticast({ tokens: batch.map(d => d.data().token), notification: { title, body }, data: { type, duelId } });
    await Promise.all(result.responses.map((response, i) => {
      const code = response.error?.code;
      if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) return batch[i].ref.delete();
      if (code) console.warn('Duel push failed', code);
      return null;
    }));
  }
}
// Claim before sending: delivery failures do not cause repeated alerts.
async function claimEvent(id) {
  const ref = db.collection('duelNotificationEvents').doc(id.replace(/\//g, '_'));
  return db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return false;
    tx.set(ref, { claimedAt: FieldValue.serverTimestamp() });
    return true;
  });
}
exports.notifyTurnDuel = onDocumentUpdated('turnDuels/{duelId}', async event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  const message = before && after && movementMessage(before, after);
  if (message && await claimEvent(event.id)) await send(message.recipient, event.params.duelId, message.title, message.body);
});
// Duelo por turnos de Retos rápidos (sala de dos): avisa a quien le toca cuando el otro termina su jugada.
exports.notifyQuickDuel = onDocumentUpdated('quickRooms/{code}', async event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  if (!before || !after || after.config?.kind !== 'duel' || after.members?.length !== 2 || before.members?.length !== 2) return;
  if (after.actor === before.actor || !after.members.includes(after.actor)) return;
  const title = after.phase === 'finished' ? 'Duelo terminado' : 'Te toca en Continuum';
  const body = after.phase === 'finished' ? 'Tu amigo ha terminado el duelo de Retos rápidos. Mira quién ha ganado.'
    : after.phase === 'round-end' ? 'Se ha acabado un mazo del duelo de Retos rápidos. Pasa al siguiente.'
    : 'Tu amigo ha hecho su jugada en el duelo de Retos rápidos. Es tu turno.';
  if (await claimEvent(event.id)) await send(after.actor, event.params.code, title, body, 'quick-duel');
});
exports.notifyDuelInvitation = onDocumentCreated('turnDuels/{duelId}', async event => {
  const game = event.data?.data();
  if (game?.invitedUid && game.status === 'waiting' && await claimEvent(event.id)) {
    const [a, b] = await Promise.all([
      db.doc(`duelPreferences/${game.invitedUid}/blocked/${game.playersOrder[0]}`).get(),
      db.doc(`duelPreferences/${game.playersOrder[0]}/blocked/${game.invitedUid}`).get()
    ]);
    if (a.exists || b.exists) return;
    const alias = game.players?.[game.playersOrder[0]]?.alias || 'Un rival';
    await send(game.invitedUid, event.params.duelId, 'Nuevo reto en Continuum', `${alias} te invita a un duelo. Acéptalo desde tu perfil.`);
  }
});
async function maintainDuel(ref, now) {
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;
    const game = snapshot.data(), action = lifecycle(game, now);
    if (!action) return null;
    if (action.type === 'expire') {
      tx.update(ref, { status: 'expired', turnUid: null, expiredAt: FieldValue.serverTimestamp(), resultText: 'Duelo caducado tras siete días sin actividad.' });
      return null;
    }
    if (game.status === 'waiting' && game.invitedUid) {
      const a = await tx.get(db.doc(`duelPreferences/${game.invitedUid}/blocked/${game.playersOrder[0]}`));
      const b = await tx.get(db.doc(`duelPreferences/${game.playersOrder[0]}/blocked/${game.invitedUid}`));
      if (a.exists || b.exists) return null;
    }
    const budget = db.collection('duelReminderBudgets').doc(action.recipient);
    const last = await tx.get(budget);
    if (now - millis(last.data()?.lastSentAt) < DAY) return null;
    tx.set(budget, { lastSentAt: FieldValue.serverTimestamp() });
    tx.update(ref, { remindedTurn: action.turnKey, remindedAt: FieldValue.serverTimestamp() });
    return { recipient: action.recipient, waiting: game.status === 'waiting' };
  });
}
exports.maintainTurnDuels = onSchedule({ ...SCHEDULED, schedule: 'every 60 minutes' }, async () => {
  const now = Date.now();
  const result = await maintainOpenDuels(db, now, async ref => {
    const reminder = await maintainDuel(ref, now);
    if (!reminder) return;
    try { await send(reminder.recipient, ref.id, '¿Seguimos jugando?', reminder.waiting ? 'Tienes una invitación pendiente en Continuum.' : 'Tienes un turno pendiente en Continuum. Tu rival te espera.'); }
    catch (error) { console.warn('Duel reminder failed', error.code); }
  }, { deadline: now + RUN_BUDGET_MS });
  if (!result.indexed) console.warn('Duel maintenance: falta el índice compuesto de turnDuels (status, updatedAt); se recorren todos los duelos abiertos. Ver docs/CONFIGURAR_MULTIJUGADOR.md.');
  if (result.failed) console.warn('Duel maintenance failed', result.failed, result.lastError);
  if (result.timedOut) console.warn('Duel maintenance: sin tiempo para todos; sigue en la próxima ejecución.');
  console.log('Duel maintenance summary', JSON.stringify(result));
});

// Borrado de la cuenta de quien llama, desde Ajustes. Borra todo lo que el servidor guarda de ella y su
// acceso. Solo actúa sobre la cuenta autenticada: no recibe ningún identificador.
exports.deleteMyAccount = onCall({ timeoutSeconds: 120, maxInstances: 10 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Hay que iniciar sesión.');
  try { await deleteAccount(db, getAuth(), uid); }
  catch (error) { console.warn('Account deletion failed', error.code || error.message); throw new HttpsError('internal', 'No se pudo borrar la cuenta.'); }
  return { deleted: true };
});
// Limpieza según los plazos de retention.js (los mismos que cuenta la política de privacidad). La lógica, los topes
// por ejecución y el borrado con subcolecciones (una sala se lleva su presencia y su final), en purge.js.
// Resumen en los registros: cuánto se ha borrado de cada cosa y, aparte, lo que ha fallado o se ha quedado a medias.
function logPurge(label, names, results) {
  const summary = {}, capped = [], unfinished = [];
  results.forEach((outcome, i) => {
    const name = names[i], result = outcome.value;
    if (outcome.status === 'rejected') { console.warn('Purge failed', name, outcome.reason?.code || outcome.reason?.message); return; }
    summary[name] = result.removed;
    if (result.failed) console.warn('Purge failed', name, `${result.failed} sin borrar`, result.lastError);
    if (result.capped) capped.push(name);
    if (result.timedOut) unfinished.push(name);
  });
  if (capped.length) console.warn('Purge capped: se ha llegado al tope por ejecución en', capped.join(', '));
  if (unfinished.length) console.warn('Purge unfinished: sin tiempo para todo en', unfinished.join(', '), '(sigue en la próxima ejecución)');
  console.log(`${label} summary`, JSON.stringify(summary));
}
// Cada hora: las colecciones con fecha de última actividad, todas a la vez y cada una por su lado (si una falla o
// tiene mucho que borrar, las demás no esperan).
exports.purgeExpiredData = onSchedule({ ...SCHEDULED, schedule: 'every 60 minutes' }, async () => {
  const now = Date.now(), deadline = now + RUN_BUDGET_MS, names = Object.keys(ACTIVITY);
  logPurge('Purge', names, await Promise.allSettled(names.map(name => purgeCollection(db, name, now, { deadline }))));
});
// Cada día: las tablas del ranking de hace más de 90 días y los invitados que llevan un año sin abrir el juego.
exports.purgeRankingsAndGuests = onSchedule({ ...SCHEDULED, schedule: 'every day 04:17' }, async () => {
  const now = Date.now(), deadline = now + RUN_BUDGET_MS;
  logPurge('Purge rankings and guests', ['dailyScores', 'weeklyScores', 'guests'], await Promise.allSettled([
    purgeRanking(db, 'dailyScores', now, { deadline }),
    purgeRanking(db, 'weeklyScores', now, { deadline }),
    purgeStaleGuests(db, getAuth(), now, { deadline })
  ]));
});
