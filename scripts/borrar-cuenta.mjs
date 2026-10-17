// Borrado manual de una cuenta por parte del titular (moderación o petición por correo).
// Lo lanza el workflow «Borrar cuenta de un jugador»; hace lo mismo que el botón de Ajustes
// (functions/account-purge.js): datos de la cuenta, filas del ranking y acceso.
// Uso: node scripts/borrar-cuenta.mjs <nombre o uid>
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { deleteAccount, findUid } = require('./account-purge');

const target = process.argv[2];
if (!target) { console.error('Falta el nombre del jugador o su identificador.'); process.exit(2); }
initializeApp({ projectId: 'timeline-es' });
const db = getFirestore();
const uid = await findUid(db, target);
if (!uid) { console.error(`No hay ningún jugador con el nombre o identificador «${target}». No se ha borrado nada.`); process.exit(1); }
await deleteAccount(db, getAuth(), uid);
console.log(`Cuenta ${uid} borrada: datos, ranking y acceso.`);
