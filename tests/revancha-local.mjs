// «Un solo móvil»: después de una partida, la revancha y «Cambiar jugadores o ajustes»
// recuperan la mesa anterior (nombres, cartas iniciales y poderes) en vez de volver a
// «Jugador 2» y obligar a escribir todos los nombres otra vez.
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

const app = () => w.document.getElementById('app');
const screen = () => app().dataset.screen;
async function click(selector) {
  const el = w.document.querySelector(selector);
  assert.ok(el, `no existe ${selector} en ${screen()}`);
  el.click();
  await tick();
}

await click('[data-action="friends-hub"]');
await click('[data-friend-route="local"]');
await click('[data-action="set-block"]');
await click('.collection-entry.active [data-action="set-mode"]');
assert.equal(screen(), 'setup');

await click('[data-action="add-player"]');
const nombres = ['Lucía', 'Marcos', 'Irene'];
w.document.querySelectorAll('#players input').forEach((input, i) => { input.value = nombres[i]; });
w.document.getElementById('hand-size').value = '3';
w.document.getElementById('pulse-toggle').checked = true;
await click('[data-action="start"]');
assert.equal(screen(), 'pass');
console.log('  ok   la partida empieza con la mesa preparada');

// «Cambiar jugadores o ajustes» (el botón de la pantalla final) vuelve a la preparación
// con la misma mesa. Se pulsa aquí sin terminar la partida: la acción es la misma.
app().insertAdjacentHTML('beforeend', '<button data-action="setup">Otra partida</button>');
await click('[data-action="setup"]');
assert.equal(screen(), 'setup');
assert.deepEqual([...w.document.querySelectorAll('#players input')].map(input => input.value), nombres);
assert.equal(w.document.getElementById('hand-size').value, '3');
assert.equal(w.document.getElementById('pulse-toggle').checked, true);
assert.equal(w.document.getElementById('ghost-toggle').checked, false);
console.log('  ok   la preparación recuerda nombres, cartas y poderes');

// La revancha arranca directamente otra partida con las mismas personas.
app().insertAdjacentHTML('beforeend', '<button data-action="rematch-local">Revancha</button>');
await click('[data-action="rematch-local"]');
assert.equal(screen(), 'pass');
assert.ok(nombres.some(nombre => app().textContent.includes(nombre)), 'el turno es de alguien de la mesa anterior');
console.log('  ok   la revancha empieza otra partida con la misma mesa');
console.log('\n0 fallos');
