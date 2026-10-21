// Copia al repositorio los módulos del SDK de Firebase que usa el juego (vendor/firebase/), para que la app no
// descargue código de gstatic.com en cada arranque (guía 2.5.2 de App Review: apps autocontenidas) y
// funcione sin conexión desde el primer arranque. Son los mismos módulos «de CDN» que publica el paquete npm
// `firebase`; solo cambia la dirección de `firebase-app.js` dentro de cada uno, que pasa de gstatic a un
// archivo vecino. Se ejecuta con `npm run vendor:firebase` al subir la versión de `firebase` en package.json;
// `tests/firebase-local.mjs` comprueba que lo vendido coincide con el paquete instalado.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODULES = ['firebase-app', 'firebase-auth', 'firebase-firestore', 'firebase-app-check', 'firebase-functions'];
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sdk = path.join(root, 'node_modules/firebase');

export async function sdkVersion() {
  return JSON.parse(await readFile(path.join(sdk, 'package.json'), 'utf8')).version;
}
// El contenido que debe tener cada archivo vendido.
export async function vendored(name, version) {
  const text = await readFile(path.join(sdk, `${name}.js`), 'utf8');
  return text.replaceAll(`https://www.gstatic.com/firebasejs/${version}/`, './');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = await sdkVersion();
  const out = path.join(root, 'vendor/firebase');
  await mkdir(out, { recursive: true });
  for (const name of MODULES) {
    const text = await vendored(name, version);
    if (text.includes('gstatic.com')) throw new Error(`${name}: queda una dirección de gstatic sin reescribir`);
    await writeFile(path.join(out, `${name}.js`), text);
  }
  await writeFile(path.join(out, 'VERSION'), `${version}\n`);
  console.log(`vendor/firebase/ actualizado con el SDK ${version} (${MODULES.length} módulos).`);
}
