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
async function openFirstDeck(expected = 'play-menu') {
  await click('[data-action="set-block"]');
  await click('.collection-entry.active [data-action="set-mode"]');
  assert.equal(screen(), expected);
}

// Jugar solo → Grandes colecciones → mazo → dificultad, sin repetir formato.
w = await boot();
assert.equal(screen(), 'home');
assert.equal(app().querySelector('.topbar .atlas-back'), null, 'el inicio no tiene flecha');
await click('[data-action="solo-hub"]');
assert.equal(screen(), 'hub-solo');
await expectBack('home');
await click('[data-action="solo-hub"]');
await click('[data-solo-route="collections"]');
assert.equal(screen(), 'hub-solo', 'Grandes colecciones se despliega en la propia pantalla');
assert.ok(app().querySelector('#mode-inline-drawer .gallery-panel'));
await click('[data-solo-route="collections"]');
assert.equal(app().querySelector('#mode-inline-drawer').hidden, true, 'tocar de nuevo la tarjeta las oculta');
await click('[data-solo-route="collections"]');
await openFirstDeck('solo-home');
assert.equal(app().querySelector('.play-choices'), null);
await expectBack('hub-solo');
if (app().querySelector('#mode-inline-drawer').hidden) await click('[data-solo-route="collections"]');
await click('#mode-inline-drawer [data-action="set-block"][data-block="mezcla"]');
await click('#mode-inline-drawer [data-action="set-mode"][data-mode="mixed"]');
assert.equal(screen(), 'solo-home', 'Gran mezcla llega a dificultad sin elegir otra vez mazo ni formato');
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
await click('[data-action="local-hub"]');
assert.equal(screen(), 'hub-friends-local', 'Un solo móvil tiene su propia pantalla, como Jugar solo');
await click('[data-inline-route="local"]');
assert.ok(app().querySelector('#mode-inline-drawer .gallery-panel'), 'Grandes colecciones se despliega en la propia pantalla');
await click('#mode-inline-drawer [data-action="set-block"]');
await click('#mode-inline-drawer .collection-entry.active [data-action="set-mode"]');
assert.equal(screen(), 'setup');
await expectBack('hub-friends-local');
if (app().querySelector('#mode-inline-drawer').hidden) await click('[data-inline-route="local"]');
await click('#mode-inline-drawer [data-action="set-block"][data-block="mezcla"]');
await click('#mode-inline-drawer [data-action="set-mode"][data-mode="mixed"]');
assert.equal(screen(), 'setup', 'Gran mezcla en un solo móvil va a preparar la partida');
await expectBack('hub-friends-local');
await expectBack('hub-friends');
await expectBack('home');

// Jugar con amigos → Duelo por turnos.
await click('[data-action="friends-hub"]');
await click('[data-friend-hub="duel"]');
assert.equal(screen(), 'hub-friends-duel', 'Duelo por turnos tiene su propia pantalla, como Jugar solo');
await click('[data-inline-route="duel"]');
await click('#mode-inline-drawer [data-action="set-block"]');
await click('#mode-inline-drawer .collection-entry.active [data-action="set-mode"]');
assert.equal(screen(), 'duel-home');
await expectBack('hub-friends-duel');
await expectBack('hub-friends');
await expectBack('home');

// Wi-Fi local → mazo → sala, sin volver a elegir Wi-Fi.
await click('[data-action="friends-hub"]');
await click('[data-friend-hub="wifi"]');
assert.equal(screen(), 'hub-friends-wifi');
await click('[data-inline-route="wifi"]');
await click('#mode-inline-drawer [data-action="set-block"]');
await click('#mode-inline-drawer .collection-entry.active [data-action="set-mode"]');
assert.equal(screen(), 'local-entrada');
await back();
assert.equal(screen(), 'hub-friends-wifi');
await expectBack('hub-friends');
await expectBack('home');

// Jugar online → Grandes colecciones: vuelve a Jugar online, no al inicio.
await click('[data-action="home-top"]');
await click('[data-action="online-hub"]');
assert.equal(screen(), 'hub-online');
await click('[data-action="online-collections"]');
assert.equal(screen(), 'hub-online-collections');
await expectBack('hub-online');
await expectBack('home');

// Competición muestra solo los formatos de la entrada elegida.
await click('[data-action="solo-hub"]');
await click('.mode-entry[data-action="competition-menu"]');
assert.ok(app().querySelector('[data-action="start-competition"]'));
assert.equal(app().querySelector('[data-action="competition-local"]'), null);
await expectBack('hub-solo');
await expectBack('home');
await click('[data-action="friends-hub"]');
await click('[data-action="local-hub"]');
await click('.mode-entry[data-action="competition-menu"]');
assert.equal(screen(), 'competition-menu');
assert.equal(app().querySelector('[data-action="start-competition"]'), null);
assert.ok(app().querySelector('[data-action="competition-local"]'));
await click('[data-action="competition-local"]');
assert.equal(screen(), 'setup');
await expectBack('competition-menu');
await expectBack('hub-friends-local');
await expectBack('hub-friends');
await expectBack('home');
await click('.home-nav [data-action="perfil"]');
assert.equal(screen(), 'perfil');
await expectBack('home');

// Tras salir de una partida se vuelve a su preparación, y desde ahí hacia atrás sin
// quedarse dando vueltas entre dos pantallas.
w.CONTINUUM.localNavigate('jugar');
await tick();
assert.equal(screen(), 'hub-solo', 'la antigua pantalla «Jugar» ya no existe: se abre Jugar solo');
await click('[data-inline-route]');
w.sessionStorage.removeItem('continuum-entry-route');
await openFirstDeck();
await click('.play-choice-block [data-action="toggle-format-block"]');
await click('.play-choice[data-action="setup"]');
await click('[data-action="start"]');
// Antes de repartir se juega el minijuego de quién empieza (todas con la misma
// cifra: a igual distancia se respeta el orden de la mesa).
while (w.document.getElementById('starter-guess-input')) { w.document.getElementById('starter-guess-input').value = '1900'; await click('[data-action="starter-guess-submit"]'); }
await click('[data-action="starter-start"]');
assert.equal(screen(), 'pass');
await back();
await click('[data-exit-confirm]');
assert.equal(screen(), 'setup');
await expectBack('play-menu');
await expectBack('hub-solo');
await expectBack('home');

// Deslizar hacia la derecha hace lo mismo que la flecha, también en las pantallas que
// pintan otros módulos.
function pointer(type, x) {
  const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 320, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'touch' } });
  app().dispatchEvent(event);
}
async function swipe() {
  pointer('pointerdown', 30);
  for (let paso = 1; paso <= 3; paso++) pointer('pointermove', 30 + (140 * paso) / 3);
  pointer('pointerup', 170);
  await tick(); await tick();
}
w.CONTINUUM.localNavigate('jugar');
await tick();
await click('[data-action="quick-challenges"]');
assert.equal(screen(), 'quick-challenges');
assert.ok(app().querySelector('[data-quick="start-free"]'));
await swipe();
assert.equal(screen(), 'hub-solo', 'deslizar en Retos rápidos vuelve a Jugar solo');
if (!app().querySelector('[data-action="set-block"]')) await click('[data-inline-route]');
w.sessionStorage.removeItem('continuum-entry-route');
await openFirstDeck();
await click('.play-choice-block [data-action="toggle-format-block"]');
await click('.play-choice[data-action="local-multiplayer"]');
const wifi = screen();
assert.ok(wifi.startsWith('local-'), `Wi-Fi local abierto (${wifi})`);
await swipe();
assert.equal(screen(), 'play-menu', 'deslizar en Wi-Fi local vuelve al menú del mazo');

console.log('✓ La flecha de volver lleva siempre a la pantalla anterior');
w.close();
