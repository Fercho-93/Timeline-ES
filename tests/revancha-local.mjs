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
await click('[data-action="local-hub"]');
await click('[data-inline-route="local"]');
await click('#mode-inline-drawer [data-action="set-block"]');
await click('#mode-inline-drawer .collection-entry.active [data-action="set-mode"]');
assert.equal(screen(), 'setup');

await click('[data-action="add-player"]');
const nombres = ['Lucía', 'Marcos', 'Irene'];
w.document.querySelectorAll('#players input').forEach((input, i) => { input.value = nombres[i]; });
w.document.getElementById('hand-size').value = '3';
w.document.getElementById('pulse-toggle').checked = true;
// Sin minijuego no se baraja: «Empezar» lo abre, igual que en las salas.
await click('[data-action="start"]');
assert.ok(w.document.getElementById('starter-guess-input'), 'empezar abre el minijuego de quién empieza');
assert.equal(screen(), 'setup');
console.log('  ok   no se empieza sin el minijuego de quién empieza');
for (const valor of ['1', '2', '3']) {
  w.document.getElementById('starter-guess-input').value = valor;
  await click('[data-action="starter-guess-submit"]');
}
await click('[data-action="starter-start"]');
assert.equal(screen(), 'pass');
console.log('  ok   la partida empieza con la mesa preparada');

// «Cambiar jugadores o ajustes» (el botón de la pantalla final) vuelve a la preparación
// con los mismos jugadores. Se pulsa aquí sin terminar la partida: la acción es la misma.
app().insertAdjacentHTML('beforeend', '<button data-action="setup">Otra partida</button>');
await click('[data-action="setup"]');
assert.equal(screen(), 'setup');
assert.deepEqual([...w.document.querySelectorAll('#players input')].map(input => input.value).sort(), [...nombres].sort());
assert.equal(w.document.getElementById('hand-size').value, '3');
assert.equal(w.document.getElementById('pulse-toggle').checked, true);
assert.equal(w.document.getElementById('ghost-toggle').checked, false);
console.log('  ok   la preparación recuerda nombres, cartas y poderes');

// La revancha vuelve a jugar el minijuego de quién empieza y, al terminarlo, baraja
// directamente. La mesa se sienta por orden de cercanía: quien más se acerca, primero.
app().insertAdjacentHTML('beforeend', '<button data-action="rematch-local">Revancha</button>');
await click('[data-action="rematch-local"]');
// Antes de volver a la preparación se elige el mismo mazo u otro.
assert.ok(w.document.querySelector('[data-rematch-deck] [data-rematch-pick]') && w.document.querySelector('[data-rematch-other]'), 'la revancha ofrece el mismo mazo u otro');
await click('[data-rematch-pick]');
assert.ok(w.document.getElementById('starter-guess-input'), 'la revancha abre el minijuego');
const nombresMesa = [...w.document.querySelectorAll('#players input')].map(input => input.value);
const respuestas = [1, 999999, 2];
let tituloCarta = '';
for (const valor of respuestas) {
  tituloCarta = w.document.querySelector('.starter-card strong').textContent;
  w.document.getElementById('starter-guess-input').value = String(valor);
  await click('[data-action="starter-guess-submit"]');
}
const CTw = w.CONTINUUM, modo = CTw.DEFAULT_MODE;
const carta = CTw.cards(modo).find(item => item.title === tituloCarta);
const esperado = CTw.Starter.order(modo, carta.id, respuestas.map((value, id) => ({ id, value }))).map(i => nombresMesa[i]);
const filas = [...w.document.querySelectorAll('.starter-draw-list li')].map(li => li.textContent);
assert.equal(filas.length, 3, 'el resultado enseña a las tres personas');
esperado.forEach((nombre, i) => assert.ok(filas[i].includes(`${i + 1}.º ${nombre}`), `puesto ${i + 1}: ${nombre}`));
console.log('  ok   el resultado ordena a la mesa de quien más se acerca a quien menos');
await click('[data-action="starter-start"]');
assert.equal(screen(), 'pass');
assert.ok(app().textContent.includes(esperado[0]), 'empieza quien más se acercó');
console.log('  ok   la revancha baraja desde el resultado y empieza quien más se acercó');
console.log('\n0 fallos');

// El diálogo de la revancha: el mismo mazo u otro (cualquiera de los que se tienen), o cancelar.
{
  const UI = w.CONTINUUM.UI, tap = el => el.dispatchEvent(new w.MouseEvent('click', {bubbles: true}));
  let elegido = 'sin respuesta';
  UI.chooseRematchDeck({current: 'history'}).then(v => { elegido = v; });
  const mismo = w.document.querySelector('[data-rematch-deck] [data-rematch-pick]');
  assert.equal(mismo.dataset.rematchPick, 'history', 'el primer botón es el mismo mazo');
  assert.match(mismo.textContent, /Mismo mazo · Historia de España/);
  tap(w.document.querySelector('[data-rematch-other]'));
  const otros = [...w.document.querySelectorAll('[data-rematch-deck] [data-rematch-pick]')].map(b => b.dataset.rematchPick);
  assert.ok(otros.length >= 10 && !otros.includes('history'), 'en «Otro mazo» salen los demás mazos, sin repetir el actual');
  tap(w.document.querySelector('[data-rematch-pick="movies"]'));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(elegido, 'movies', 'devuelve el mazo elegido');
  assert.equal(w.document.querySelector('[data-rematch-deck]'), null, 'y se cierra');
  UI.chooseRematchDeck({current: 'history'}).then(v => { elegido = v; });
  tap(w.document.querySelector('[data-rematch-cancel]'));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(elegido, null, 'cancelar no elige nada');
  console.log('  ok   la revancha ofrece el mismo mazo, otro mazo o cancelar');
}
