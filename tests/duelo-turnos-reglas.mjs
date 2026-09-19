import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
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
      scores: { ...game.scores, guest: 0 }, timeline: [1],
      status: 'playing', turnUid: 'creator', updatedAt: serverTimestamp()
    });
  }));

  await assertSucceeds(getDoc(doc(creator, 'turnDuels', duelId)));
  await assertSucceeds(getDoc(doc(guest, 'turnDuels', duelId)));
  await assertFails(getDoc(doc(outsider, 'turnDuels', duelId)));

  await assertSucceeds(runTransaction(creator, async transaction => {
    const ref = doc(creator, 'turnDuels', duelId), game = (await transaction.get(ref)).data();
    transaction.update(ref, {
      plays: [{ uid: 'creator', cardId: 2, index: 0, correct: false, at: Timestamp.now() }],
      timeline: game.timeline, scores: game.scores, turnIndex: 1, turnUid: 'guest',
      status: 'playing', updatedAt: serverTimestamp(), resultText: null
    });
  }));

  await assertSucceeds(runTransaction(guest, async transaction => {
    const ref = doc(guest, 'turnDuels', duelId), game = (await transaction.get(ref)).data();
    transaction.update(ref, {
      plays: [...game.plays, { uid: 'guest', cardId: 3, index: 1, correct: true, at: Timestamp.now() }],
      timeline: [...game.timeline, 3], scores: { ...game.scores, guest: 1 },
      turnIndex: 2, turnUid: 'creator', status: 'playing', updatedAt: serverTimestamp(), resultText: null
    });
  }));

  const cifrasId = 'duel-cifras-token';
  await assertSucceeds(setDoc(doc(creator, 'turnDuels', cifrasId), {
    id: cifrasId, mode: 'history', kind: 'cifras', seed: 'def456', total: 10,
    turnIndex: 0, turnUid: null, playersOrder: ['creator'], players: { creator: { alias: 'Ana' } },
    status: 'waiting', plays: [], timeline: [], scores: { creator: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertSucceeds(runTransaction(guest, async transaction => {
    const ref = doc(guest, 'turnDuels', cifrasId), game = (await transaction.get(ref)).data();
    transaction.update(ref, {
      playersOrder: [...game.playersOrder, 'guest'], players: { ...game.players, guest: { alias: 'Bea' } },
      scores: { ...game.scores, guest: 0 }, status: 'playing', turnUid: 'creator', updatedAt: serverTimestamp()
    });
  }));
  await assertSucceeds(runTransaction(creator, async transaction => {
    const ref = doc(creator, 'turnDuels', cifrasId), game = (await transaction.get(ref)).data();
    transaction.update(ref, {
      plays: [{ uid: 'creator', cardId: 4, respuesta: 1492, points: 55, at: Timestamp.now() }],
      timeline: [], scores: { ...game.scores, creator: 55 }, turnIndex: 1, turnUid: 'guest',
      status: 'playing', updatedAt: serverTimestamp(), resultText: null
    });
  }));
  console.log('Duelo por turnos: el enlace permite entrar una vez y la partida vuelve a ser privada.');
} finally {
  await env.cleanup();
}
