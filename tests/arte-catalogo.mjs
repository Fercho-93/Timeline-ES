import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^"]*)?"[^>]*>/g)].map(match => match[1]);
const window = {};
// Descubre los catálogos desde la página real, para detectar también nuevos mazos.
const catalogs = scripts.filter(file => !file.includes('/') && /window\.\w+_CARDS\s*=/.test(read(file)));
for (const file of [...catalogs, 'modes.js', 'enciclopedia.js', 'quick-challenges-data.js']) vm.runInNewContext(read(file), { window });
const ct = window.CONTINUUM;
assert(scripts.includes('modes.js'));
for (const file of catalogs) assert(scripts.indexOf(file) < scripts.indexOf('modes.js'), `${file} se carga después de modes.js`);
const files = fs.readdirSync(path.join(root, 'assets'), { recursive: true }).map(file => 'assets/' + file.replaceAll('\\', '/'));
const exactPaths = new Set(files);
const artFiles = files.filter(file => /^assets\/[^/]+-cards\/.*\.(webp|png|jpe?g)$/i.test(file));
const used = new Set(), uniqueCards = new Map();
const groups = Object.values(ct.BLOCKS).flatMap(block => Array.from(block.games));
assert.equal(new Set(groups).size, groups.length, 'Mazo repetido entre colecciones');
assert.deepEqual([...groups].sort(), Object.keys(ct.MODES).sort(), 'Mazos fuera de las colecciones');
const source = read('modes.js');
for (const [key, mode] of Object.entries(ct.MODES)) {
  assert(ct.usesAnimalArt(key), `${key} no activa las ilustraciones`);
  assert(mode.cards.length > 0, `${key} está vacío`);
  const ids = new Set();
  for (const card of mode.cards) {
    assert(!ids.has(card.id), `ID repetido en ${key}: ${card.id}`);
    ids.add(card.id);
    const src = ct.animalArt(key, card).match(/src="([^"]+)"/)?.[1];
    assert(src, `${key}/${card.id} no tiene ilustración`);
    assert(exactPaths.has(src), `Archivo ausente o mayúsculas incorrectas: ${src}`);
    used.add(src);
    assert(ct.Enciclopedia.cardMarkup(key, card, { descubiertas: new Set([card.id]) }).includes(`src="${src}"`), `La colección no muestra ${key}/${card.id}`);
    if (key === 'mixed') {
      const original = ct.cards(card.sourceMode).find(item => item.id === card.id);
      assert(original, `Carta sin origen en Gran mezcla: ${card.id}`);
      assert.equal(ct.animalArt(key, card), ct.animalArt(card.sourceMode, original));
    } else {
      assert(!uniqueCards.has(card.id), `ID compartido por mazos independientes: ${card.id}`);
      uniqueCards.set(card.id, card);
    }
  }
  console.log(`${mode.name}: ${mode.cards.length} cartas ilustradas`);
}
for (const cards of Object.values(window).filter(Array.isArray)) for (const card of cards) {
  assert(uniqueCards.has(card.id), `Carta del catálogo fuera de los mazos: ${card.id}`);
}
for (const map of source.matchAll(/const \w+_ART_BY_ID = \{([\s\S]*?)\};/g)) {
  const ids = [...map[1].matchAll(/(\d+):\s*"/g)].map(match => Number(match[1]));
  assert.equal(ids.length, new Set(ids).size, 'ID repetido en una tabla de imágenes');
  for (const id of ids) assert(uniqueCards.has(id), `Asociación de arte a carta inexistente: ${id}`);
}
// Retos rápidos ilustra sus cartas aparte, en su propio catálogo y no en ct.MODES: sin
// esto, cada imagen de assets/quick-cards/ se veía huérfana aunque estuviera en uso.
let quickImages = 0;
for (const challenge of ct.QuickCatalog.challenges) {
  for (const card of challenge.cards) {
    if (!card.image) continue;
    assert(exactPaths.has(card.image), `Archivo ausente o mayúsculas incorrectas: ${card.image}`);
    used.add(card.image);
    quickImages += 1;
  }
}
console.log(`Retos rápidos: ${quickImages} cartas ilustradas`);
assert.deepEqual(artFiles.filter(file => !used.has(file)), [], 'Ilustraciones sin carta');
console.log(`${uniqueCards.size} cartas únicas; ${artFiles.length} imágenes; ninguna asociación ausente ni imagen huérfana.`);
