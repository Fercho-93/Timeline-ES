import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, deleteDoc, getDoc, getDocs, query, collection, where, runTransaction, serverTimestamp, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
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
  const cancellation = { status: 'cancelled', turnUid: null, closedBy: 'outsider', updatedAt: serverTimestamp(), resultText: 'Duelo cerrado.' };
  await assertFails(updateDoc(doc(outsider, 'turnDuels', duelId), cancellation));
  await assertFails(updateDoc(doc(guest, 'turnDuels', duelId), { ...cancellation, closedBy: 'guest', scores: { guest: 100 } }));
  await assertFails(updateDoc(doc(guest, 'turnDuels', duelId), { ...cancellation, closedBy: 'guest' }));
  await assertFails(updateDoc(doc(guest, 'turnDuels', duelId), { ...cancellation, status: 'resigned', closedBy: 'guest', winnerUid: 'guest' }));
  await assertSucceeds(updateDoc(doc(guest, 'turnDuels', duelId), { ...cancellation, status: 'resigned', closedBy: 'guest', winnerUid: 'creator' }));
  await assertSucceeds(setDoc(doc(guest, 'duelPreferences', 'guest', 'archived', duelId), { updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(creator, 'duelPreferences', 'guest', 'archived', duelId)));
  await assertFails(setDoc(doc(creator, 'duelPreferences', 'guest', 'archived', duelId), { updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(guest, 'duelPreferences', 'guest', 'archived', cifrasId), { updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(guest, 'duelPreferences', 'guest', 'archived', duelId)));
  await assertFails(updateDoc(doc(creator, 'turnDuels', duelId), { status: 'playing', turnUid: 'creator' }));
  await assertSucceeds(getDoc(doc(creator, 'turnDuels', duelId)));
  const directId = `direct-${duelId}-creator`;
  const direct = { id: directId, sourceDuel: duelId, invitedUid: 'guest', invitedAlias: 'Bea', mode: 'history', kind: 'orden', seed: 'fresh', total: 15, turnIndex: 0, turnUid: null, playersOrder: ['creator'], players: { creator: { alias: 'Ana' } }, status: 'waiting', plays: [], timeline: [1], scores: { creator: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(runTransaction(creator, async tx => { const ref = doc(creator, 'turnDuels', directId); await tx.get(ref); tx.set(ref, direct); }));
  await assertSucceeds(getDoc(doc(guest, 'turnDuels', directId)));
  await assertFails(getDoc(doc(outsider, 'turnDuels', directId)));
  await assertSucceeds(getDocs(query(collection(guest, 'turnDuels'), where('invitedUid', '==', 'guest'))));
  await assertSucceeds(getDocs(query(collection(creator, 'turnDuels'), where('playersOrder', 'array-contains', 'creator'))));
  await assertFails(setDoc(doc(creator, 'turnDuels', 'bad-invitation'), { ...direct, id: 'bad-invitation', invitedUid: 'outsider' }));
  await assertFails(updateDoc(doc(creator, 'turnDuels', directId), { remindedTurn: 'waiting:0' }));
  const accept = { playersOrder: ['creator', 'guest'], players: { creator: { alias: 'Ana' }, guest: { alias: 'Bea' } }, scores: { creator: 0, guest: 0 }, status: 'playing', turnUid: 'creator', updatedAt: serverTimestamp() };
  await assertFails(updateDoc(doc(outsider, 'turnDuels', directId), accept));
  await assertSucceeds(updateDoc(doc(guest, 'turnDuels', directId), accept));
  const boundedId = 'invite-abc123-creator-0';
  await assertSucceeds(setDoc(doc(creator, 'turnDuels', boundedId), { ...direct, id: boundedId, invitationRound: 0 }));
  await assertSucceeds(updateDoc(doc(guest, 'turnDuels', boundedId), { ...cancellation, closedBy: 'guest' }));
  await assertSucceeds(setDoc(doc(creator, 'turnDuels', 'invite-abc123-creator-1'), { ...direct, id: 'invite-abc123-creator-1', invitationRound: 1 }));
  await assertFails(setDoc(doc(creator, 'turnDuels', 'invite-abc123-creator-2'), { ...direct, id: 'invite-abc123-creator-2', invitationRound: 0 }));
  const declineId = `direct-${cifrasId}-creator`;
  const blocked = doc(guest, 'duelPreferences', 'guest', 'blocked', 'creator');
  await assertSucceeds(setDoc(blocked, { alias: 'Ana', updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(creator, 'duelPreferences', 'guest', 'blocked', 'creator')));
  await assertFails(setDoc(doc(creator, 'turnDuels', declineId), { ...direct, id: declineId, sourceDuel: cifrasId, kind: 'cifras', timeline: [] }));
  await assertSucceeds(deleteDoc(blocked));
  await assertSucceeds(setDoc(doc(creator, 'turnDuels', declineId), { ...direct, id: declineId, sourceDuel: cifrasId, kind: 'cifras', timeline: [] }));
  await assertSucceeds(setDoc(blocked, { alias: 'Ana', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(guest, 'turnDuels', declineId), accept));
  await assertFails(setDoc(doc(outsider, 'duelPreferences', 'guest', 'blocked', 'creator'), { alias: 'Ana', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(guest, 'turnDuels', declineId), { ...cancellation, closedBy: 'guest' }));
  await env.withSecurityRulesDisabled(async ctx => updateDoc(doc(ctx.firestore(), 'turnDuels', directId), { updatedAt: Timestamp.fromMillis(Date.now() - 8 * 86400000) }));
  await assertFails(updateDoc(doc(creator, 'turnDuels', directId), { turnIndex: 1, turnUid: 'guest', plays: [{ uid: 'creator', cardId: 2, index: 0, correct: false }], updatedAt: serverTimestamp() }));
  console.log('OK: link and direct invitations, private access, acceptance, decline, listing, closure and inactivity enforcement.');
} finally {
  await env.cleanup();
}
