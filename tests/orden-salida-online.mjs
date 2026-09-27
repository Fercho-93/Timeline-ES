import { gameHtml } from './game-fixture.mjs';
// Ejecuta el online.js real contra las reglas reales (emulador): el minijuego de quién
// empieza sienta a la mesa por orden de cercanía, y en una mesa pública el relevo del
// anfitrión que se ha ido llega solo y libera su plaza.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-orden', firestore: { host: '127.0.0.1', port: 8080, rules: read('firestore.rules') } });
const ROOM = 'ORDEN234', A = 'ana', B = 'bea', C = 'cid';
const db = uid => env.authenticatedContext(uid, { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
const seedDoc = (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), ...path), data));
const readDoc = async (...path) => { let data; await env.withSecurityRulesDisabled(async c => { data = (await getDoc(doc(c.firestore(), ...path))).data(); }); return data; };
const roomData = () => readDoc('rooms', ROOM);
const clone = x => JSON.parse(JSON.stringify(x));
const KEEP = ['updatedAt', 'turnStartedAt', 'seenAt', 'lastCreatedAt'];
const limpia = data => { const out = clone(data); for (const campo of KEEP) if (campo in data) out[campo] = data[campo]; return out; };

function client(uid) {
  const html = gameHtml(read('index.html')), w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test' }).window;
  w.structuredClone = structuredClone; w.scrollTo = () => {};
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  const errors = []; w.console.error = e => errors.push(e);
  w.__sdk = {
    initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => db(uid), doc, getDoc, serverTimestamp,
    setDoc: (ref, data) => setDoc(ref, limpia(data)),
    runTransaction: (d, callback) => runTransaction(d, tx => callback({ get: ref => tx.get(ref), set: (ref, data) => tx.set(ref, limpia(data)), update: (ref, data) => tx.update(ref, limpia(data)) }))
  };
  const src = read('online.js').replace(/^import .+;\n/gm, '').replace('export async function', 'async function');
  w.eval(`(()=>{const {initializeApp,getAuth,getFirestore,doc,getDoc,setDoc,runTransaction,serverTimestamp}=window.__sdk;const firebaseApp=initializeApp(),auth=getAuth(),db=getFirestore();${src}
  window.onlineTest={set(data){roomState=data;user={uid:${JSON.stringify(uid)}};roomRef=doc(db,'rooms',${JSON.stringify(ROOM)});roomCode=${JSON.stringify(ROOM)};},
    starterRecords, presenceRecords, startRoom, claimHost, removePlayer, starterRanking, keepPublicQueueAlive, relayKick:()=>relayKick};})();`);
  return { w, api: w.onlineTest, errors, async load() { this.api.set(await roomData()); } };
}

let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? 'ok  ' : 'FALLA'} ${label}`); };
const player = (name, extra = {}) => ({ name, hand: [], joinedAt: 1, clientVersion: 42, ...extra });

try {
  console.log('\nSala privada: la mesa se sienta por orden de cercanía');
  const lobby = { winners: null, roomCode: ROOM, mode: 'history', hostUid: A, status: 'lobby', phase: 'lobby', version: 1, handSize: 2, turnSeconds: 30,
    playerOrder: [A, B, C], players: { [A]: player('Ana'), [B]: player('Bea'), [C]: player('Cid') }, deck: [], discard: [], timeline: [], current: 0, starter: A,
    turnsInRound: 0, round: 1, winner: null, reveal: null, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) };
  await seedDoc(['rooms', ROOM], lobby);
  const host = client(A);
  const CT = host.w.CONTINUUM;
  const card = CT.cards('history').find(item => Math.abs(CT.sortValue('history', item)) > 100);
  const real = CT.sortValue('history', card);
  await host.load();
  host.api.starterRecords.set(A, { cardId: card.id, value: real + 50 });
  host.api.starterRecords.set(B, { cardId: card.id, value: real + 500 });
  host.api.starterRecords.set(C, { cardId: card.id, value: real + 1 });
  ok('el ranking va de quien más se acerca a quien menos', host.api.starterRanking().join(',') === [C, A, B].join(','));
  const beaRespuesta = host.api.starterRecords.get(B);
  host.api.starterRecords.delete(B);
  ok('sin todas las respuestas no hay orden en una sala privada', host.api.starterRanking() === null);
  ok('en una mesa pública, al agotarse el plazo, quien no respondió juega al final', host.api.starterRanking(true).join(',') === [C, A, B].join(','));
  host.api.starterRecords.set(B, beaRespuesta);
  await host.api.startRoom(false);
  let data = await roomData();
  ok('la partida empieza', data.status === 'playing');
  ok('el orden de juego es el del minijuego', data.playerOrder.join(',') === [C, A, B].join(','));
  ok('empieza quien más se acercó', data.playerOrder[data.current] === C && data.starter === C);
  ok('sin errores en pantalla', host.errors.length === 0); if (host.errors.length) console.log(host.errors.map(e => e?.stack || String(e)).join('\n'));

  console.log('\nMesa pública: relevo automático del anfitrión que se fue');
  await env.clearFirestore();
  const KEY = 'history:2:v42:x';
  const pub = { ...lobby, deckFingerprint: 'x', matchmaking: 'public', capacity: 2, clientVersion: 42, queueKey: KEY, playerOrder: [A, B], players: { [A]: player('Ana'), [B]: player('Bea') } };
  await seedDoc(['rooms', ROOM], pub);
  await seedDoc(['publicQueues', KEY], { queueKey: KEY, roomCode: ROOM, mode: 'history', capacity: 2, clientVersion: 42, deckFingerprint: 'x', status: 'full', updatedAt: Timestamp.now() });
  // Ana dejó la pantalla de la sala hace 20 segundos.
  await seedDoc(['rooms', ROOM, 'presence', A], { seenAt: Timestamp.fromMillis(Date.now() - 20000), visible: false });
  const bea = client(B);
  bea.w.CONTINUUM.Session.calibrate(Date.now(), bea.w.performance.now());
  await bea.load();
  bea.api.presenceRecords.set(A, { seenAt: Date.now() - 20000, visible: false });
  await bea.api.claimHost(true);
  data = await roomData();
  ok('Bea toma el relevo sola', data.hostUid === B);
  ok('y queda pendiente sacar a Ana de la mesa', bea.api.relayKick() === A);
  await bea.load();
  await bea.api.removePlayer(A);
  data = await roomData();
  ok('la plaza de Ana queda libre', data.playerOrder.join(',') === B);
  await new Promise(resolve => setTimeout(resolve, 300));
  const queue = await readDoc('publicQueues', KEY);
  ok('la mesa vuelve a aparecer en la búsqueda', queue.status === 'waiting');
  const antes = queue.updatedAt.toMillis();
  await new Promise(resolve => setTimeout(resolve, 20));
  await bea.load();
  await bea.api.keepPublicQueueAlive();
  const renovada = await readDoc('publicQueues', KEY);
  ok('quien sigue esperando mantiene viva la mesa en la búsqueda', renovada.updatedAt.toMillis() > antes && renovada.status === 'waiting');
  ok('sin errores en pantalla', bea.errors.length === 0);
} finally {
  await env.cleanup();
}
console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
