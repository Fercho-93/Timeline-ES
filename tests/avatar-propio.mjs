// El avatar que eliges en el Atlas es el que te representa también dentro de las partidas.
import { gameHtml } from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const w = new JSDOM(html.replace(/<script (type="module" )?src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test/' }).window;
w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
await tick();
const CT = w.CONTINUUM;
const click = async sel => { const el = w.document.querySelector(sel); assert.ok(el, sel); el.click(); await tick(); };

// Una elección distinta de la que le tocaría a «Tú» por su nombre.
const porNombre = CT.Avatares.idFor('name:tú');
const elegido = CT.Avatares.ids.find(id => id !== porNombre && id !== CT.Avatares.idFor(CT.Avatares.ownSeed()));
assert.ok(CT.Avatares.choose(elegido));
const src = sel => w.document.querySelector(sel)?.getAttribute('src') || '';

await click('.home-door[data-action="perfil"]');
assert.ok(src('.atlas-identidad-avatar img').includes(elegido), 'el Atlas muestra el avatar elegido');

await click('[data-action="home-top"]');
await click('[data-action="solo-hub"]');
await click('[data-solo-route="quick"]');
await click('[data-quick="start-free"]');
await click('[data-quick="ready"]');
assert.ok(src('.score-avatar img').includes(elegido), `Retos rápidos en solitario muestra el avatar elegido (${src('.score-avatar img')})`);

console.log('✓ Tu avatar elegido es el mismo en el Atlas y en las partidas');
w.close();
