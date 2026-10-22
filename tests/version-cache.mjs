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
for (const sheet of ['edition', 'tablet']) {
  assert.equal(index.match(new RegExp(`href="css/${sheet}\\.css\\?v=(\\d+)"`))?.[1], cache, `${sheet}.css?v= de index.html coincide con CACHE`);
}
// El resto de hojas solo suben cuando cambian, pero nunca pueden ir por delante de la caché.
for (const [, name, version] of index.matchAll(/href="(css\/[\w-]+\.css)\?v=(\d+)"/g)) {
  assert.ok(Number(version) <= Number(cache), `${name}?v=${version} no puede superar la versión de caché ${cache}`);
}
console.log(`OK: versión de caché ${cache} coherente en el service worker, js/arranque/updates.js e index.html.`);
