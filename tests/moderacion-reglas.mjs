// Moderación en el servidor: nombres reservados, el nombre se libera al borrar el perfil,
// duelos con ficha acotada y denuncias que solo se escriben (las lee quien administra, en la consola).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'demo-hilo', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
const dbs = new Map();   // una conexión por persona: mezclar referencias de conexiones distintas falla
const as = uid => { if (!dbs.has(uid)) dbs.set(uid, env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()); return dbs.get(uid); };
const profile = (alias, extra = {}) => ({ alias, aliasKey: alias.toLowerCase(), avatar: 'compass', season: 'launch-1', privacyVersion: 1, createdAt: serverTimestamp(), ...extra });
async function register(uid, alias) {
  const db = as(uid), batch = writeBatch(db);
  batch.set(doc(db, 'playerProfiles', uid), profile(alias));
  batch.set(doc(db, 'playerNames', alias.toLowerCase()), { uid });
  return batch.commit();
}
try {
  // 1) Nombres reservados: ni el del juego ni los de quien lo gestiona.
  for (const alias of ['Continuum', 'Admin', 'Soporte', 'Moderador', 'Staff', 'Continuum Oficial', 'El Continuum'])
    await assertFails(register('uno-' + alias.length + alias[0], alias));
  await assertSucceeds(register('ana', 'Ana'));
  // Un nombre normal que solo se parece (contiene «admin» como parte de otra palabra) no se bloquea aquí.
  await assertSucceeds(register('mar', 'Mariadmira'));

  // 2) Quien ya tenía un nombre reservado antes de esta regla no queda afectado.
  await env.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), 'playerProfiles', 'viejo'), { alias: 'Admin', aliasKey: 'admin', avatar: 'compass', season: 'launch-1', privacyVersion: 1, createdAt: new Date() });
    await setDoc(doc(c.firestore(), 'playerNames', 'admin'), { uid: 'viejo' });
  });
  await assertSucceeds(updateDoc(doc(as('viejo'), 'playerProfiles', 'viejo'), { avatar: 'star' }));

  // 3) Acaparar nombres: borrar solo el perfil deja el nombre reservado, y eso ya no se puede.
  await assertFails(deleteDoc(doc(as('ana'), 'playerProfiles', 'ana')));
  let batch = writeBatch(as('ana'));
  batch.delete(doc(as('ana'), 'playerProfiles', 'ana')); batch.delete(doc(as('ana'), 'playerNames', 'ana'));
  await assertSucceeds(batch.commit());   // lo que hace el borrado de cuenta: nombre y perfil a la vez
  await assertSucceeds(register('ana', 'Ana'));   // y el nombre queda libre para volver a usarlo

  // 4) Denuncias: se escriben una vez por pareja y no se leen desde el juego.
  const report = (to, extra = {}) => ({ reporter: 'ana', target: to, targetAlias: 'Bea', reason: 'nombre-ofensivo', context: 'ranking', createdAt: serverTimestamp(), ...extra });
  const ana = as('ana');
  await assertSucceeds(setDoc(doc(ana, 'reports', 'ana_bea'), report('bea')));
  await assertFails(setDoc(doc(ana, 'reports', 'ana_bea'), report('bea')));                              // no se repite
  await assertFails(setDoc(doc(ana, 'reports', 'ana_cid'), report('bea')));                               // el id es denunciante_denunciado
  await assertFails(setDoc(doc(ana, 'reports', 'ana_ana'), report('ana')));                               // nadie se denuncia a sí mismo
  await assertFails(setDoc(doc(ana, 'reports', 'ana_dan'), report('dan', { reason: 'porque sí' })));      // motivos cerrados
  await assertFails(setDoc(doc(ana, 'reports', 'ana_eva'), report('eva', { context: 'chat' })));          // contextos cerrados
  await assertFails(setDoc(doc(ana, 'reports', 'ana_fil'), report('fil', { extra: 'x'.repeat(5000) })));  // sin claves extra
  await assertFails(setDoc(doc(ana, 'reports', 'ana_gus'), report('gus', { targetAlias: 'x'.repeat(25) })));
  await assertFails(setDoc(doc(ana, 'reports', 'ana_hal'), report('hal', { createdAt: new Date(0) })));  // hora del servidor
  await assertFails(setDoc(doc(as('bea'), 'reports', 'ana_ivo'), report('ivo')));                         // no en nombre de otra persona
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'reports', 'ana_jon'), report('jon')));
  await assertFails(getDoc(doc(ana, 'reports', 'ana_bea')));                                              // ni la propia
  await assertFails(getDocs(collection(ana, 'reports')));
  await assertFails(deleteDoc(doc(ana, 'reports', 'ana_bea')));
  await assertFails(updateDoc(doc(ana, 'reports', 'ana_bea'), { reason: 'otro' }));

  // 5) Duelo por turnos: quien entra solo lleva su alias (con tope de tamaño), no claves extra.
  const duel = { id: 'D1', mode: 'history', kind: 'orden', seed: 's', total: 3, turnIndex: 0, turnUid: null, playersOrder: ['ana'], players: { ana: { alias: 'Ana' } }, status: 'waiting', plays: [], timeline: [], scores: { ana: 0 }, createdAt: new Date(), updatedAt: new Date() };
  const joined = extra => ({ playersOrder: ['ana', 'bea'], players: { ana: { alias: 'Ana' }, bea: extra }, scores: { ana: 0, bea: 0 }, status: 'playing', turnUid: 'ana', timeline: [], turnIndex: 0, updatedAt: serverTimestamp() });
  const reset = () => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'turnDuels', 'D1'), { ...duel, createdAt: new Date(), updatedAt: new Date() }));
  await reset(); await assertFails(updateDoc(doc(as('bea'), 'turnDuels', 'D1'), joined({ alias: 'x'.repeat(25) })));
  await reset(); await assertFails(updateDoc(doc(as('bea'), 'turnDuels', 'D1'), joined({ alias: 'Bea', basura: 'x'.repeat(2000) })));
  await reset(); await assertSucceeds(updateDoc(doc(as('bea'), 'turnDuels', 'D1'), joined({ alias: 'Bea' })));

  // 6) El token del móvil tiene tope.
  const push = token => ({ token, platform: 'ios', updatedAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(ana, 'playerProfiles', 'ana', 'pushTokens', 't1'), push('t'.repeat(200))));
  await assertFails(setDoc(doc(ana, 'playerProfiles', 'ana', 'pushTokens', 't2'), push('t'.repeat(4097))));
  console.log('Moderación: nombres reservados, nombre liberado al borrar, denuncias de solo escritura y topes de tamaño: OK');
} finally { await env.cleanup(); }
