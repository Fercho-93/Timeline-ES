// Correcciones de la pasada de verificación del 20 de octubre de 2026 (docs/revision-verificacion-2026-10-20.md):
// cada una fija un dato que la revisión encontró equivocado, para que no vuelva por una edición descuidada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const load = file => { const window = { CONTINUUM: {} }; vm.runInNewContext(read(file), { window }); return Object.values(window).filter(Array.isArray).flat(); };
const card = (file, id) => { const found = load(file).find(c => c.id === id); assert.ok(found, `existe ${id} en ${file}`); return found; };

assert.equal(card('music.js', 6066).year, 1983, 'Billie Jean salió como sencillo en enero de 1983 (el álbum Thriller es de 1982)');
assert.equal(card('music.js', 6032).year, 1982, 'Thriller sigue en 1982');
assert.equal(card('inventos.js', 4002).year, -3500, 'el torno de alfarero es de hacia 3500 a. C.');
assert.ok(card('inventos.js', 4002).year < card('inventos.js', 4001).year, 'el torno es anterior a la escritura cuneiforme');
assert.equal(card('distances.js', 11001).value, 18, 'París–Versalles: 17,6–17,9 km en línea recta');
assert.doesNotMatch(card('countries.js', 2065).detail, /cuatro quintas/, 'el Karakum cubre cerca del 70 % de Turkmenistán, no más del 80 %');
assert.doesNotMatch(card('idiomas.js', 14011).detail, /única lengua grande/, 'el indonesio, el javanés o el filipino también usan el alfabeto latino');
assert.doesNotMatch(card('animals.js', 10035).detail, /ballena gris/, 'no hay carta de ballena gris con la que empatar');
assert.doesNotMatch(card('movies.js', 1064).detail, /^Peter Jackson estrena en Nueva Zelanda/, 'el estreno mundial fue en Londres');

// Retos rápidos: la batalla de Teruel empezó el 15 de diciembre de 1937 (el 22 de febrero de 1938 es el final).
const w = { CONTINUUM: {} }; vm.runInNewContext(read('quick-challenges-data.js'), { window: w });
const decks = w.CONTINUUM.QuickCatalog.challenges;
const teruel = decks.find(d => d.id === 'civil-war').cards.find(c => c.title === 'Batalla de Teruel');
assert.equal(teruel.value, 19371215); assert.equal(teruel.label, '15 diciembre 1937');
const fernando = decks.find(d => d.id === 'kings').cards.find(c => c.title === 'Fernando VII');
assert.match(fernando.detail, /1808/, 'Fernando VII: se aclara que reinó unas semanas en 1808');

// Segunda pasada (21 de octubre): ríos según el INE y la Confederación del Miño-Sil, y «In the End» como sencillo.
assert.equal(card('music.js', 6085).year, 2001, '«In the End» salió como sencillo en octubre de 2001 (el álbum Hybrid Theory es de 2000)');
const rios = Object.fromEntries(decks.find(d => d.id === 'rivers-spain').cards.map(c => [c.title, c]));
assert.deepEqual(['Miño', 'Segura', 'Júcar', 'Guadalquivir', 'Guadiana', 'Duero', 'Ebro', 'Tajo'].map(n => rios[n].value), [315, 325, 498, 657, 818, 895, 910, 1007]);
for (const n of ['Guadalquivir', 'Guadiana', 'Duero', 'Ebro', 'Tajo']) assert.match(rios[n].source, /ine\.es/, `${n}: fuente del INE`);
assert.match(rios['Miño'].source, /chminosil\.es/, 'Miño: fuente de la Confederación del Miño-Sil');
console.log('Auditoría: las correcciones del 20 de octubre de 2026 siguen aplicadas: OK');
