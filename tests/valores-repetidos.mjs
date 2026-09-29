// Al repartir, un mazo no lleva dos cartas con el mismo valor: de cada grupo se deja una, elegida
// al azar (no siempre la misma), y con semilla —reto diario, duelo— es reproducible.
import {gameHtml} from './game-fixture.mjs';
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const w = new JSDOM(html.replace(/<script (type="module" )?src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://x.test/' }).window;
w.scrollTo = () => {};
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
const CT = w.CONTINUUM;
let conRepetidos = 0;
for (const key of Object.keys(CT.MODES)) {
  const cartas = CT.cards(key), ids = cartas.map(c => c.id);
  const valor = new Map(cartas.map(c => [c.id, CT.sortValue(key, c)]));
  const limpio = CT.uniqueValueIds(key, ids);
  const valores = limpio.map(id => valor.get(id));
  assert.equal(new Set(valores).size, valores.length, `${key}: quedan valores repetidos`);
  assert.equal(new Set(valores).size, new Set(ids.map(id => valor.get(id))).size, `${key}: no se pierde ningún valor`);
  assert.deepEqual(limpio, ids.filter(id => limpio.includes(id)), `${key}: se conserva el orden`);
  if (limpio.length < ids.length) conRepetidos++;
}
assert.ok(conRepetidos > 0, 'hay mazos con valores repetidos que probar');

// Al azar: en varias partidas no se aparta siempre la misma carta de un grupo.
const grupo = CT.cards('history').filter(c => CT.sortValue('history', c) === 1492).map(c => c.id);
assert.ok(grupo.length >= 3);
const ids = CT.cards('history').map(c => c.id);
const elegidas = new Set();
for (let i = 0; i < 60; i++) elegidas.add(CT.uniqueValueIds('history', ids).find(id => grupo.includes(id)));
assert.ok(elegidas.size > 1, 'la carta que se deja cambia entre partidas');
assert.equal(CT.uniqueValueIds('history', ids).filter(id => grupo.includes(id)).length, 1, 'de cada grupo queda una');

// Con semilla: los dos móviles de un duelo o del reto diario reciben lo mismo.
const a = CT.uniqueValueIds('history', ids, CT.seededRandom(CT.seedFrom('semilla:history')));
const b = CT.uniqueValueIds('history', ids, CT.seededRandom(CT.seedFrom('semilla:history')));
const c = CT.uniqueValueIds('history', ids, CT.seededRandom(CT.seedFrom('otra:history')));
assert.deepEqual(a, b, 'misma semilla, mismo reparto');
assert.notDeepEqual(a, c, 'otra semilla, otro reparto');
assert.deepEqual(CT.Duelo.reparto('history', 'abc123', 15), CT.Duelo.reparto('history', 'abc123', 15), 'el duelo es reproducible');
const repDuelo = CT.Duelo.reparto('history', 'abc123', 15).map(id => CT.sortValue('history', CT.cards('history').find(x => x.id === id)));
assert.equal(new Set(repDuelo).size, repDuelo.length, 'el duelo no reparte valores iguales');

console.log(`${Object.keys(CT.MODES).length} mazos revisados, ${conRepetidos} con valores repetidos, sin repetir al repartir`);
w.close();
