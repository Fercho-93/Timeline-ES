// La flecha de volver de cada pantalla lleva a la pantalla inmediatamente anterior,
// también en las entradas de la portada (online, solo, con amigos) y en Retos rápidos.
import { gameHtml } from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function boot() {
  const w = new JSDOM(html.replace(/<script (type="module" )?src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test/' }).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  await tick();
  return w;
}

let w;
const app = () => w.document.getElementById('app');
const screen = () => app().dataset.screen;
async function click(selector) {
  const el = w.document.querySelector(selector);
  assert.ok(el, `no existe ${selector} en ${screen()}`);
  el.click();
  await tick();
}
// La flecha de la barra superior: cada pantalla que no es el inicio tiene una.
async function back() {
  const arrow = app().querySelector('.topbar .atlas-back, .topbar [data-local-action], .turn-duel-back');
  assert.ok(arrow, `falta la flecha de volver en ${screen()}`);
  arrow.click();
  await tick();
}
async function expectBack(expected) { await back(); assert.equal(screen(), expected, `volver debería llevar a ${expected}`); }
async function openFirstDeck() {
  await click('[data-action="set-block"]');
  await click('.collection-entry.active [data-action="set-mode"]');
  assert.equal(screen(), 'play-menu');
}

// Jugar solo → Grandes colecciones → mazo → Jugar solo: y vuelta atrás paso a paso.
w = await boot();
assert.equal(screen(), 'home');
assert.equal(app().querySelector('.topbar .atlas-back'), null, 'el inicio no tiene flecha');
await click('[data-action="solo-hub"]');
assert.equal(screen(), 'hub-solo');
await expectBack('home');
await click('[data-action="solo-hub"]');
await click('[data-solo-route="collections"]');
assert.equal(screen(), 'jugar');
await openFirstDeck();
await click('.play-choice[data-action="solo"]');
assert.equal(screen(), 'solo-home');
await expectBack('play-menu');
await expectBack('jugar');
await expectBack('hub-solo');
await expectBack('home');

// Jugar solo → Retos rápidos: la flecha sale a la elección, no al menú de formatos.
await click('[data-action="solo-hub"]');
await click('[data-solo-route="quick"]');
assert.equal(screen(), 'quick-challenges');
await expectBack('hub-solo');
await expectBack('home');

// Jugar con amigos → Un solo móvil → mazo → preparar partida.
await click('[data-action="friends-hub"]');
assert.equal(screen(), 'hub-friends');
await click('[data-friend-route="local"]');
await openFirstDeck();
await click('.play-choice[data-action="setup"]');
assert.equal(screen(), 'setup');
await expectBack('play-menu');
await expectBack('jugar');
await expectBack('hub-friends');
await expectBack('home');

// Jugar con amigos → Duelo por turnos.
await click('[data-action="friends-hub"]');
await click('[data-friend-route="duel"]');
await openFirstDeck();
await click('.play-choice[data-action="duel-home"]');
assert.equal(screen(), 'duel-home');
await expectBack('play-menu');

// Jugar online → Grandes colecciones: vuelve a Jugar online, no al inicio.
await click('[data-action="home-top"]');
await click('[data-action="online-hub"]');
assert.equal(screen(), 'hub-online');
await click('[data-action="online-collections"]');
assert.equal(screen(), 'hub-online-collections');
await expectBack('hub-online');
await expectBack('home');

// Competición y Atlas vuelven al inicio.
await click('.mode-entry[data-action="competition-menu"]');
assert.equal(screen(), 'competition-menu');
await click('[data-format="competition-multi"]');
await click('[data-action="competition-local"]');
assert.equal(screen(), 'setup');
await expectBack('competition-menu');
await expectBack('home');
await click('.home-door[data-action="perfil"]');
assert.equal(screen(), 'perfil');
await expectBack('home');

// Tras salir de una partida se vuelve a su preparación, y desde ahí hacia atrás sin
// quedarse dando vueltas entre dos pantallas.
await click('.home-door[data-action="jugar"]');
assert.equal(screen(), 'jugar');
await click('[data-action="toggle-play-catalog"][data-section="collections"]');
await openFirstDeck();
await click('.play-choice-block [data-action="toggle-format-block"]');
await click('.play-choice[data-action="setup"]');
await click('[data-action="start"]');
assert.equal(screen(), 'pass');
await back();
await click('[data-exit-confirm]');
assert.equal(screen(), 'setup');
await expectBack('play-menu');
await expectBack('jugar');
await expectBack('home');

console.log('✓ La flecha de volver lleva siempre a la pantalla anterior');
w.close();
