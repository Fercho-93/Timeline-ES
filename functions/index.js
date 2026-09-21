const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { DAY, millis, lifecycle, movementMessage } = require('./duel-policy');

initializeApp();

const db = getFirestore();
async function send(uid, duelId, title, body) {
  const snapshot = await db.collection('playerProfiles').doc(uid).collection('pushTokens').get();
  const docs = snapshot.docs.filter(d => typeof d.data().token === 'string');
  for (let start = 0; start < docs.length; start += 500) {
    const batch = docs.slice(start, start + 500);
    const result = await getMessaging().sendEachForMulticast({ tokens: batch.map(d => d.data().token), notification: { title, body }, data: { type: 'turn-duel', duelId } });
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
    // C.4.1: where('in') + orderBy en otro campo (aquí el propio id) exige un índice
    // compuesto; declarado en firestore.indexes.json, desplegado con
    // `firebase deploy --only firestore` (no con `--only firestore:rules`, que solo
    // sube las reglas).
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
