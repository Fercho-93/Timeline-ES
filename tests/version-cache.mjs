// La versión de caché vive en cuatro sitios y tienen que coincidir: si no, el service worker sigue sirviendo la
// versión anterior y el cambio «no aparece» en los móviles (ya pasó con el commit que subió solo el service worker).
// `node scripts/bump-version.mjs` los sube a la vez.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const sw = read('service-worker-258.js'), updates = read('js/arranque/updates.js'), index = read('index.html');

const cache = sw.match(/const CACHE = "continuum-v(\d+)"/)?.[1];
assert.ok(cache, 'el service worker declara CACHE = "continuum-vNNN"');
assert.equal(updates.match(/CT\.APP_VERSION = "continuum-v(\d+)"/)?.[1], cache, 'js/arranque/updates.js (CT.APP_VERSION) coincide con CACHE');
// Todas las hojas llevan la versión de caché en su `?v=`: así ninguna se queda atrás cuando cambia.
const hojas = [...index.matchAll(/href="(css\/[\w-]+\.css)\?v=(\d+)"/g)];
assert.ok(hojas.length >= 2, 'index.html carga sus hojas con ?v=');
for (const [, name, version] of hojas) assert.equal(version, cache, `${name}?v= de index.html coincide con CACHE`);
console.log(`OK: versión de caché ${cache} coherente en el service worker, js/arranque/updates.js e index.html.`);
