import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import fs from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-duelo-turnos',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});
const claims = { firebase: { sign_in_provider: 'anonymous' } };
const creator = env.authenticatedContext('creator', claims).firestore();
const guest = env.authenticatedContext('guest', claims).firestore();
const outsider = env.authenticatedContext('outsider', claims).firestore();
const publicDb = env.unauthenticatedContext().firestore();
const duelId = 'duel-link-token';

try {
  await assertSucceeds(setDoc(doc(creator, 'turnDuels', duelId), {
    id: duelId, mode: 'history', kind: 'orden', seed: 'abc123', total: 15,
    turnIndex: 0, turnUid: null, playersOrder: ['creator'],
    players: { creator: { alias: 'Ana' } }, status: 'waiting', plays: [],
    timeline: [], scores: { creator: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));

  await assertSucceeds(getDoc(doc(guest, 'turnDuels', duelId)));
  await assertFails(getDoc(doc(publicDb, 'turnDuels', duelId)));

  await assertSucceeds(runTransaction(guest, async transaction => {
    const ref = doc(guest, 'turnDuels', duelId);
    const snapshot = await transaction.get(ref);
    const game = snapshot.data();
    transaction.update(ref, {
      playersOrder: [...game.playersOrder, 'guest'],
      players: { ...game.players, guest: { alias: 'Bea' } },
      status: 'playing', turnUid: 'creator', updatedAt: serverTimestamp()
    });
  }));

  await assertSucceeds(getDoc(doc(creator, 'turnDuels', duelId)));
  await assertSucceeds(getDoc(doc(guest, 'turnDuels', duelId)));
  await assertFails(getDoc(doc(outsider, 'turnDuels', duelId)));
  console.log('Duelo por turnos: el enlace permite entrar una vez y la partida vuelve a ser privada.');
} finally {
  await env.cleanup();
}
