// La lámina de cada forma de jugar (js/interfaz/home-modes-v1.js): al entrar desde Inicio en Jugar
// solo, Jugar con amigos o Jugar online sale el árbol de lo que hay dentro, sobre la pantalla ya
// pintada. Un toque la retira, se va con su pantalla y «No volver a mostrar» la apaga solo para esa.
import { gameHtml } from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

async function boot() {
  const w = new JSDOM(html.replace(/<script (type="module" )?src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test/' }).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  await tick();
  return w;
}

const w = await boot();
const doc = w.document, app = doc.getElementById('app');
const guide = () => doc.querySelector('[data-mode-guide]:not([data-closed])');
async function enter(action) {
  const door = app.querySelector(`[data-action="${action}"]`);
  assert.ok(door, `falta la puerta ${action} en ${app.dataset.screen}`);
  door.click();
  await tick();
}
async function home() { app.querySelector('.topbar .atlas-back').click(); await tick(300); assert.equal(app.dataset.screen, 'home'); }

const CASES = [
  ['solo-hub', 'solo', 'hub-solo', ['Grandes colecciones', 'Retos rápidos']],
  ['friends-hub', 'friends', 'hub-friends', ['Un solo móvil', 'Cada uno en su móvil']],
  ['online-hub', 'online', 'hub-online', ['Crear mesa', 'Mesas abiertas', 'Partida rápida']]
];

for (const [action, kind, screen, branches] of CASES) {
  await enter(action);
  assert.equal(app.dataset.screen, screen, 'la pantalla se pinta debajo de la lámina');
  const layer = guide();
  assert.ok(layer, `${action}: sale la lámina`);
  assert.equal(layer.dataset.modeGuide, kind);
  assert.equal(layer.parentElement, doc.body, 'fuera de #app, para que no la borre un repintado');
  assert.equal(layer.getAttribute('role'), 'dialog');
  assert.equal(layer.getAttribute('aria-modal'), 'true');
  assert.deepEqual([...layer.querySelectorAll('.mode-guide-node b')].map(b => b.textContent), branches, `${action}: las ramas del árbol`);
  // Cómo se juega (con la línea dibujada) y los dos juegos cara a cara, cada uno con su lógica.
  assert.ok(layer.querySelector('.mode-guide-how svg.mode-guide-line'), `${action}: la línea dibujada`);
  assert.ok(layer.querySelector('.mode-guide-how p').textContent.length > 20, `${action}: la frase de cómo se juega`);
  assert.deepEqual([...layer.querySelectorAll('.mode-guide-game b')].map(b => b.textContent), ['Grandes colecciones', 'Retos rápidos']);
  layer.querySelectorAll('.mode-guide-game p').forEach(p => assert.ok(p.textContent.length > 20, `${action}: cada juego dice cómo funciona`));
  assert.equal(doc.activeElement, layer.querySelector('[data-mode-guide-go]'), 'el foco va a la lámina');
  // Un toque en cualquier parte la retira y devuelve el foco al título de la pantalla.
  layer.click();
  assert.equal(guide(), null, `${action}: un toque la retira`);
  assert.equal(doc.activeElement, app.querySelector('[data-focus]'));
  await tick(300);
  assert.equal(doc.querySelector('[data-mode-guide]'), null, 'y se quita del documento');
  await home();
}

// Volver a la pantalla anterior (también con el «atrás» del sistema) se lleva la lámina.
await enter('solo-hub');
assert.ok(guide());
await home();
assert.equal(guide(), null, 'la lámina se va con su pantalla');

// Escape también la cierra.
await enter('friends-hub');
guide().dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.equal(guide(), null, 'Escape la retira');
await home();

// «No volver a mostrar» la apaga para esa forma de jugar; las otras siguen saliendo.
await enter('online-hub');
guide().querySelector('[data-mode-guide-hide]').click();
assert.equal(guide(), null);
await home();
await enter('online-hub');
assert.equal(guide(), null, 'apagada, ya no sale');
assert.equal(app.dataset.screen, 'hub-online');
await home();
await enter('solo-hub');
assert.ok(guide(), 'las demás siguen saliendo');
assert.deepEqual(JSON.parse(w.localStorage.getItem('continuum-guia-modos-v1')), { online: true });

// Las pantallas a las que se llega desde dentro (Un solo móvil, Cada uno en su móvil) no la repiten.
guide().click(); await home();
await enter('friends-hub'); guide().click();
await enter('local-hub');
assert.equal(app.dataset.screen, 'hub-friends-local');
assert.equal(guide(), null, 'dentro de Jugar con amigos no vuelve a salir');

// Con amigos, la lámina cuenta la lógica en grupo: la mano y el robo en Grandes colecciones;
// arriesgar o plantarse en Retos rápidos. Solo, las vidas y la dificultad.
const text = kind => { const g = w.CONTINUUM.ModeHubs.guides[kind]; return [g.how, ...g.games, ...g.branches.flat(2)].join(' '); };
assert.match(text('friends'), /mano/); assert.match(text('friends'), /robas/); assert.match(text('friends'), /plantarse/);
assert.match(text('online'), /plántate/); assert.match(text('online'), /2 a 4/);
assert.match(text('solo'), /vidas/); assert.match(text('solo'), /Dificultad/);

console.log('guia-modos: ok');
w.close();
