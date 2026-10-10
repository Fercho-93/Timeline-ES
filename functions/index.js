const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { DAY, millis, lifecycle, movementMessage } = require('./duel-policy');
const { getAuth } = require('firebase-admin/auth');
const { ACTIVITY, cutoff, expiredRankingKey, staleAnonymous } = require('./retention');

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
exports.maintainTurnDuels = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Europe/Madrid', timeoutSeconds: 540, maxInstances: 1 }, async () => {
  let cursor;
  const now = Date.now();
  do {
    let query = db.collection('turnDuels').where('status', 'in', ['waiting', 'playing']).orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const snapshot of page.docs) {
      const reminder = await maintainDuel(snapshot.ref, now);
      if (reminder) {
        try { await send(reminder.recipient, snapshot.id, '¿Seguimos jugando?', reminder.waiting ? 'Tienes una invitación pendiente en Continuum.' : 'Tienes un turno pendiente en Continuum. Tu rival te espera.'); }
        catch (error) { console.warn('Duel reminder failed', error.code); }
      }
    }
    cursor = page.size === 200 ? page.docs.at(-1) : null;
  } while (cursor);
});

// Limpieza diaria según los plazos de retention.js (los mismos que cuenta la política de
// privacidad). Borra con sus subcolecciones: una sala se lleva su presencia y su final.
async function purgeCollection(name, now) {
  let removed = 0;
  for (;;) {
    const page = await db.collection(name).where(ACTIVITY[name], '<', cutoff(name, now)).limit(200).get();
    for (const snapshot of page.docs) { await db.recursiveDelete(snapshot.ref); removed++; }
    if (page.size < 200) return removed;
  }
}
async function purgeRanking(collection, now) {
  let removed = 0;
  for (const ref of await db.collection(collection).listDocuments()) {
    if (expiredRankingKey(ref.id, now)) { await db.recursiveDelete(ref); removed++; }
  }
  return removed;
}
// Todo lo que pertenece a una cuenta, como al borrarla desde el juego.
async function purgeAccount(uid) {
  const aliasKey = (await db.doc(`playerProfiles/${uid}`).get()).data()?.aliasKey;
  for (const path of [`playerProfiles/${uid}`, `playerProgress/${uid}`, `socialRanking/${uid}`, `dailyRanking/${uid}`,
    `duelPreferences/${uid}`, `creationQuota/${uid}`, `roomCreation/${uid}`, `duelReminderBudgets/${uid}`]) await db.recursiveDelete(db.doc(path));
  if (aliasKey) {
    const name = db.doc(`playerNames/${aliasKey}`);
    if ((await name.get()).data()?.uid === uid) await name.delete();
  }
}
// Invitados anónimos que llevan un año sin abrir el juego: nadie puede volver a entrar en ellos.
async function purgeStaleGuests(now, limit = 500) {
  let token, removed = 0;
  do {
    const page = await getAuth().listUsers(1000, token);
    for (const user of page.users) {
      if (removed >= limit) return removed;
      if (!staleAnonymous(user, now)) continue;
      await purgeAccount(user.uid);
      await getAuth().deleteUser(user.uid);
      removed++;
    }
    token = page.pageToken;
  } while (token);
  return removed;
}
exports.purgeExpiredData = onSchedule({ schedule: 'every day 04:17', timeZone: 'Europe/Madrid', timeoutSeconds: 540, maxInstances: 1 }, async () => {
  const now = Date.now(), summary = {};
  for (const name of Object.keys(ACTIVITY)) {
    try { summary[name] = await purgeCollection(name, now); } catch (error) { console.warn('Purge failed', name, error.code || error.message); }
  }
  for (const name of ['dailyScores', 'weeklyScores']) {
    try { summary[name] = await purgeRanking(name, now); } catch (error) { console.warn('Purge failed', name, error.code || error.message); }
  }
  try { summary.guests = await purgeStaleGuests(now); } catch (error) { console.warn('Purge failed', 'guests', error.code || error.message); }
  console.log('Purge summary', JSON.stringify(summary));
});
