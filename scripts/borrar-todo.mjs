// Borrado total para el día del lanzamiento: todas las cuentas (invitados y las vinculadas con Apple) y todos los
// datos de Firestore (perfiles, progreso, ranking, salas, duelos, mesas, cuotas, denuncias…), para que nadie arrastre
// nada de la beta. Solo se conserva `appConfig` (el cartel remoto, que escribe el titular desde la consola).
// Lo lanza el workflow «Borrar todos los datos (lanzamiento)». Sin `--borrar` no toca nada: solo cuenta.
// Uso: node scripts/borrar-todo.mjs [--borrar]
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const MANTENER = new Set(['appConfig']);
const borrar = process.argv.includes('--borrar');
const projectId = process.env.PROYECTO || 'timeline-es';
initializeApp({ projectId });
const db = getFirestore(), auth = getAuth();
console.log(`${borrar ? 'BORRANDO' : 'Simulacro (no se borra nada)'} en el proyecto ${projectId}.`);

// 1. Firestore, colección por colección (con sus subcolecciones).
const colecciones = (await db.listCollections()).filter(c => !MANTENER.has(c.id));
for (const col of colecciones) {
  const { count } = (await col.count().get()).data();
  console.log(`Firestore · ${col.id}: ${count} documentos de primer nivel${borrar ? ' → borrando' : ''}`);
  if (borrar) await db.recursiveDelete(col);
}

// 2. Authentication: todos los usuarios, por tandas de mil. En simulacro solo se cuentan; al borrar, cada tanda
// desaparece y la siguiente lista empieza otra vez desde el principio, hasta quedar vacía.
let usuarios = 0;
if (borrar) {
  for (let page = await auth.listUsers(1000); page.users.length; page = await auth.listUsers(1000)) {
    usuarios += page.users.length;
    await auth.deleteUsers(page.users.map(u => u.uid));
  }
} else {
  let token;
  do { const page = await auth.listUsers(1000, token); usuarios += page.users.length; token = page.pageToken; } while (token);
}
console.log(`Authentication: ${usuarios} usuarios${borrar ? ' borrados' : ' (no se han borrado)'}.`);

// 3. Comprobación final.
if (borrar) {
  const restantes = (await db.listCollections()).filter(c => !MANTENER.has(c.id)).length;
  const { users } = await auth.listUsers(1);
  console.log(restantes || users.length ? `OJO: quedan ${restantes} colecciones y ${users.length ? 'algún usuario' : 'ningún usuario'}. Vuelve a lanzarlo.` : 'Todo borrado.');
  if (restantes || users.length) process.exit(1);
}
