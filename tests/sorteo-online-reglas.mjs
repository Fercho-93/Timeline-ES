import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-sorteo', firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
const room = { hostUid: 'ana', roomCode: 'SORT1234', mode: 'history', deckFingerprint: 'test', playerOrder: ['ana', 'bea'], players: { ana: { name: 'Ana', hand: [] }, bea: { name: 'Bea', hand: [] } }, status: 'lobby', phase: 'lobby', version: 1, updatedAt: Timestamp.fromMillis(Date.now() - 100000), createdAt: Timestamp.fromMillis(Date.now() - 100000) };
const ctx = uid => env.authenticatedContext(uid, { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
const starter = (uid, other = uid) => doc(ctx(uid), 'rooms', 'SORT1234', 'starter', other);
async function seed(overrides = {}) {
  await env.withSecurityRulesDisabled(async tx => { await setDoc(doc(tx.firestore(), 'rooms', 'SORT1234'), { ...room, ...overrides }); });
}
let fail = 0;
// El SDK de pruebas de reglas a veces deja el aviso de un intento fallido a medias antes
// de que la siguiente llamada empiece, y eso confundía la comprobación siguiente con un
// error que no era suyo. Comprobarlo a mano, con su propio intento y su propio resultado,
// no tiene ese problema.
async function ok(label, fn) {
  try { await fn(); console.log(`  ok   ${label}`); }
  catch (error) { fail++; console.log(`  FALLA ${label}: ${error.code || error.message}`); }
}
async function falla(label, fn) {
  try { await fn(); fail++; console.log(`  FALLA ${label}: se permitió y no debía`); }
  catch { console.log(`  ok   ${label}`); }
}
try {
  await seed();
  // El anfitrión reparte la carta guardándola en su propio documento.
  await ok('el anfitrión reparte la carta en su propio documento', () => setDoc(starter('ana'), { cardId: 12, value: null, guessedAt: null }));
  // Cualquier participante puede leerla para saber qué carta le toca adivinar.
  await ok('cualquier participante puede leer la carta repartida', () => getDoc(starter('bea', 'ana')));
  // Cada persona solo escribe su propio documento, nunca el de otra.
  await falla('nadie escribe el documento de otra persona', () => setDoc(starter('bea', 'ana'), { cardId: 12, value: 1900, guessedAt: serverTimestamp() }));
  await ok('cada persona escribe su propia adivinanza', () => setDoc(starter('bea'), { cardId: 12, value: 1900, guessedAt: serverTimestamp() }));
  // Alguien fuera de la sala no puede ni leer ni escribir.
  await falla('quien no está en la sala no puede leer', () => getDoc(starter('intruso', 'ana')));
  await falla('quien no está en la sala no puede escribir', () => setDoc(starter('intruso'), { cardId: 12, value: 1, guessedAt: serverTimestamp() }));
  // Solo se aceptan los tres campos, con el tipo esperado.
  await falla('no se cuela un campo de más', () => updateDoc(starter('ana'), { cardId: 12, value: null, guessedAt: null, trampa: true }));
  await falla('la carta tiene que ser un número', () => updateDoc(starter('ana'), { cardId: '12', value: null, guessedAt: null }));
  await falla('la respuesta tiene que ser un número', () => updateDoc(starter('ana'), { cardId: 12, value: 'mil novecientos', guessedAt: null }));
  await falla('la hora de la respuesta tiene que ser la del servidor', () => updateDoc(starter('ana'), { cardId: 12, value: null, guessedAt: Timestamp.fromMillis(0) }));
  // Actualizar la propia respuesta más tarde sigue permitido.
  await ok('se puede responder más tarde', () => updateDoc(starter('ana'), { cardId: 12, value: 1905, guessedAt: serverTimestamp() }));
  const guardado = (await getDoc(starter('ana'))).data();
  assert.equal(guardado?.value, 1905);
  // Una vez la partida ha arrancado, ya no se puede escribir el sorteo, pero sí se puede
  // seguir leyendo (por si alguien llega tarde a ver quién ganó el sorteo).
  await seed({ status: 'playing', phase: 'turn', current: 0, starter: 'ana', deck: [], discard: [], timeline: [1] });
  await falla('ya no se puede escribir con la partida empezada', () => setDoc(starter('bea'), { cardId: 12, value: 1, guessedAt: serverTimestamp() }));
  await ok('pero se puede seguir leyendo', () => getDoc(starter('bea', 'ana')));
  console.log(`\n${fail} fallos`);
  process.exit(fail ? 1 : 0);
} finally { await env.cleanup(); }
