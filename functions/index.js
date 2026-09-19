const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

initializeApp();

exports.notifyTurnDuel = onDocumentUpdated('turnDuels/{duelId}', async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.turnUid === after.turnUid || !after.turnUid || after.status === 'finished') return;
  const tokens = await getFirestore().collection('playerProfiles').doc(after.turnUid).collection('pushTokens').get();
  const registrationTokens = tokens.docs.map(snapshot => snapshot.data().token).filter(Boolean);
  if (!registrationTokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens: registrationTokens,
    notification: { title: 'Tu turno en Continuum', body: 'Tu oponente ha colocado una carta. Te toca jugar.' },
    data: { type: 'turn-duel', duelId: event.params.duelId }
  });
});
