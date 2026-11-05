// La lámina de cada forma de jugar (js/interfaz/guia-modos.js): al entrar desde Inicio en Jugar
// solo, Jugar con amigos o Jugar online sale sobre la pantalla ya pintada. Arriba, la tira de cómo
// se juega; debajo, la tabla Grandes colecciones | Retos rápidos fila a fila (Tienes, Si fallas,
// Gana o Al final, Eliges), con un pictograma y un rótulo corto por celda; en grupo, un bloque
// final. Un toque la retira, se va con su pantalla y «No volver a mostrar» la apaga solo para esa.
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
// Palabras visibles de un rótulo; «30 s» va con espacio duro y cuenta como una.
const words = text => text.trim().split(/ +/).length;

const CASES = [
  ['solo-hub', 'solo', 'hub-solo', ['Tienes', 'Si fallas', 'Al final', 'Eliges'], null],
  ['friends-hub', 'friends', 'hub-friends', ['Tienes', 'Si fallas', 'Gana', 'Eliges'], 'Dónde jugáis'],
  ['online-hub', 'online', 'hub-online', ['Tienes', 'Si fallas', 'Gana', 'Eliges'], 'Cómo empieza']
];

for (const [action, kind, screen, rows, end] of CASES) {
  await enter(action);
  assert.equal(app.dataset.screen, screen, 'la pantalla se pinta debajo de la lámina');
  const layer = guide();
  assert.ok(layer, `${action}: sale la lámina`);
  assert.equal(layer.dataset.modeGuide, kind);
  assert.equal(layer.parentElement, doc.body, 'fuera de #app, para que no la borre un repintado');
  assert.equal(layer.getAttribute('role'), 'dialog');
  assert.equal(layer.getAttribute('aria-modal'), 'true');
  // La tira de cómo se juega: la carta del ejemplo (1903) entre 1804 y 1973, con su regla entera.
  const how = layer.querySelector('.mode-guide-how svg[role="img"]');
  assert.ok(how, `${action}: la tira de cómo se juega`);
  const year = y => Number([...how.querySelectorAll('text')].find(t => t.textContent === String(y))?.getAttribute('x'));
  assert.ok(year(1450) < year(1804) && year(1804) < year(1903) && year(1903) < year(1973), `${action}: 1903 entre 1804 y 1973`);
  assert.ok(how.getAttribute('aria-label').length > 100, `${action}: la tira cuenta la regla`);
  // La tabla: las dos columnas, las filas en orden y seis pictogramas con su regla y un rótulo corto.
  assert.deepEqual([...layer.querySelectorAll('.mode-guide-colhead b')].map(b => b.textContent), ['Grandes colecciones', 'Retos rápidos']);
  assert.deepEqual([...layer.querySelectorAll('.mode-guide-table .mode-guide-rowlabel')].map(p => p.textContent), rows);
  const cells = [...layer.querySelectorAll('.mode-guide-table figure.mode-guide-cell')];
  assert.equal(cells.length, 6, `${action}: seis celdas`);
  cells.forEach(cell => {
    const svg = cell.querySelector('svg');
    assert.equal(svg.getAttribute('role'), 'img');
    assert.ok(svg.getAttribute('aria-label').length > 40, `${action}: cada celda cuenta su regla`);
    assert.ok(words(cell.querySelector('figcaption').textContent) <= 4, `${action}: «${cell.querySelector('figcaption').textContent}» pasa de 4 palabras`);
  });
  const choose = [...layer.querySelectorAll('.mode-guide-choose > p:not(.mode-guide-rowlabel)')];
  assert.equal(choose.length, 2, `${action}: la fila «Eliges» de cada juego`);
  assert.match(choose[0].textContent, /^Grandes colecciones, eliges:/, 'el lector de pantalla sabe de qué juego es cada opción');
  assert.match(choose[1].textContent, /^Retos rápidos, eliges:/);
  // Fila a fila: cada bloque tiene su momento, después del anterior (nada destella antes de tiempo).
  const at = [...layer.querySelectorAll('.mode-guide-how, .mode-guide-row, .mode-guide-end')].map(el => parseFloat(el.style.getPropertyValue('--at')));
  assert.ok(at.every(t => t > 0), `${action}: todos los bloques tienen su momento`);
  assert.ok(at.every((t, i) => !i || t > at[i - 1]), `${action}: en orden: ${at.join(', ')}`);
  // El bloque final, solo en grupo.
  assert.equal(layer.querySelector('.mode-guide-end .mode-guide-rowlabel')?.textContent || null, end);
  // Ninguna etiqueta de fila ni el árbol antiguo: la lámina no tiene nada pulsable salvo el pie.
  assert.equal(layer.querySelectorAll('button').length, 2, `${action}: solo los dos botones del pie`);
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

// Lo que cuenta cada lámina, contra las reglas (CT.guideMarkup y el motor de Retos rápidos).
const G = w.CONTINUUM.GuiaModos.guides;
const rules = kind => [G[kind].how[2], ...G[kind].rows.flatMap(([, , a, b]) => [a[2], b[2]]), G[kind].end?.rule || ''].join(' ');
const shown = kind => [G[kind].how[1], ...G[kind].rows.flatMap(([, , a, b]) => [a[1], b[1]]), ...G[kind].choose.flat()].join(' ');
// Jugando solo: vidas en las colecciones; en Retos rápidos no hay vidas, ni sorpresa, ni plantarse
// (el motor sigue siempre con una sola persona: keepPlaying).
assert.match(rules('solo'), /tres vidas/);
assert.match(rules('solo'), /No hay vidas/);
assert.doesNotMatch(shown('solo') + rules('solo'), /sorpresa|plánt|plant/i);
assert.equal(w.CONTINUUM.QuickEngine.keepPlaying({ config: { names: ['Yo'], kind: 'free', rounds: [] } }), true);
// En grupo: la mano y el robo en las colecciones; cartas comunes y plantarse en Retos rápidos.
for (const kind of ['friends', 'online']) {
  assert.match(rules(kind), /mano/); assert.match(rules(kind), /robas/); assert.match(rules(kind), /descarte/);
  assert.match(rules(kind), /nadie tiene mano/); assert.match(rules(kind), /plantarte/);
  assert.match(rules(kind), /sin cartas/); assert.match(rules(kind), /aciertos ha asegurado/);
}
assert.match(shown('friends'), /2 a 10/); assert.match(shown('friends'), /2 a 4/);
// Las cifras, ancladas al motor: 10 cartas jugando solo y manos de 1 a 6.
const E = w.CONTINUUM.QuickEngine;
assert.equal(E.SOLO_CARDS, 10); assert.equal(E.MAX_HAND, 6);
assert.match(shown('solo'), new RegExp(`${E.SOLO_CARDS} cartas`));
assert.match(shown('friends'), new RegExp(`1 a ${E.MAX_HAND}`));
assert.match(G.online.end.html, /30 s/); assert.match(G.online.end.html, /2 a 4/);
assert.match(rules('friends'), /7 días/);
// Los años del ejemplo son los del mazo de inventos.
const inventos = w.CONTINUUM.cards('inventions').map(c => c.year);
for (const year of [1450, 1804, 1903, 1973]) assert.ok(inventos.includes(year), `el mazo de inventos tiene ${year}`);

// La puerta de Retos rápidos en Jugar solo ya no promete plantarse.
w.CONTINUUM.ModeHubs.open('hub-solo'); await tick();
assert.doesNotMatch(app.querySelector('[data-solo-route="quick"]').textContent, /plánt/i);
assert.match(app.querySelector('[data-solo-route="quick"]').textContent, new RegExp(`${E.SOLO_CARDS} cartas: un fallo no te echa`));

console.log('guia-modos: ok');
w.close();
