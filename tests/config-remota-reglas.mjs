// El cartel remoto (appConfig/current) lo lee cualquiera con sesión y no lo escribe ningún cliente.
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-config-remota', firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
try {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'appConfig', 'current'), { minBuild: 10, onlineEnabled: true }); });
  const ana = env.authenticatedContext('ana', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const anonimo = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(ana, 'appConfig', 'current')));
  await assertFails(getDoc(doc(anonimo, 'appConfig', 'current')));
  await assertFails(setDoc(doc(ana, 'appConfig', 'current'), { minBuild: 99999, onlineEnabled: false }));
  await assertFails(setDoc(doc(ana, 'appConfig', 'otra'), { minBuild: 1 }));
  await assertFails(deleteDoc(doc(ana, 'appConfig', 'current')));
  await assertFails(getDocs(collection(ana, 'appConfig')));
  console.log('Cartel remoto: lectura con sesión, ninguna escritura ni listado desde clientes: OK');
} finally { await env.cleanup(); }
