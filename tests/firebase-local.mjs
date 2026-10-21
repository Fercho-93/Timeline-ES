// El SDK de Firebase va dentro de la app (vendor/firebase/), no se descarga de gstatic.com en cada arranque:
// guía 2.5.2 de App Review (apps autocontenidas) y primer arranque sin red. Esta prueba vigila tres cosas:
// 1. ningún archivo del juego importa de gstatic;
// 2. lo vendido es exactamente el SDK instalado (si se sube `firebase` en package.json, hay que ejecutar
//    `npm run vendor:firebase`);
// 3. el paquete móvil y la caché sin conexión lo llevan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MODULES, sdkVersion, vendored} from '../scripts/vendor-firebase.mjs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

const version = await sdkVersion();
assert.equal(read('vendor/firebase/VERSION').trim(), version, `vendor/firebase/VERSION debe ser ${version}: ejecuta «npm run vendor:firebase»`);
for (const name of MODULES) {
  const actual = read(`vendor/firebase/${name}.js`);
  assert.equal(actual, await vendored(name, version), `vendor/firebase/${name}.js no coincide con el SDK ${version}: ejecuta «npm run vendor:firebase»`);
  assert.doesNotMatch(actual, /gstatic\.com/, `${name}: sin direcciones de gstatic`);
}

// Ningún archivo del juego (ni sus importaciones dinámicas) carga código de gstatic.
const juego = fs.readdirSync(new URL('..', import.meta.url)).filter(f => /\.(js|html)$/.test(f) && !/^(jsqr|qrcode-generator)\.js$/.test(f));
const usados = new Set();
for (const file of juego) {
  const text = read(file);
  if (file !== 'index.html') assert.doesNotMatch(text, /https:\/\/www\.gstatic\.com\/firebasejs/, `${file}: importa Firebase de gstatic`);
  for (const [, name] of text.matchAll(/['"]\.\/vendor\/firebase\/(firebase-[\w-]+)\.js['"]/g)) usados.add(name);
}
for (const name of usados) assert.ok(MODULES.includes(name), `${name} se importa pero no está en la lista de scripts/vendor-firebase.mjs`);
assert.ok(usados.size >= 4, 'el juego usa el SDK local');

// Sin conexión y en el paquete móvil.
const sw = read('service-worker-258.js');
for (const name of MODULES) assert.ok(sw.includes(`"./vendor/firebase/${name}.js"`), `${name} falta en la precarga del service worker`);
assert.match(read('scripts/build.mjs'), /DIRS = \["assets", "vendor"\]/, 'el paquete móvil copia vendor/');
console.log(`SDK de Firebase ${version} dentro de la app: sin gstatic, igual al paquete instalado, precargado: OK`);
