// La mano ocupa la mitad superior del tablero y muestra la misma marca en
// solitario, multijugador local, sala online y retos rápidos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {gameHtml} from './game-fixture.mjs';
// Antes de repartir se juega el minijuego de quién empieza: todos dicen la misma cifra.
function jugarQuienEmpieza(w) { const d = w.document; const tap = el => el?.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); for (let i = 0; i < 12 && d.getElementById('starter-guess-input'); i++) { d.getElementById('starter-guess-input').value = '1900'; tap(d.querySelector('[data-action="starter-guess-submit"]')); } tap(d.querySelector('[data-action="starter-start"]')); return w; }


const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const logo = 'assets/continuum-emblem-800.webp';
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
function boot() {
  const window = new JSDOM(html.replace(/<script src="[^"]+"><\/script>/g, ''), {
    runScripts: 'outside-only', url: 'https://continuum.test', pretendToBeVisual: true
  }).window;
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({matches: true});
  scripts.forEach(file => window.eval(read(file)));
  return window;
}
function click(document, selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `Falta ${selector}`);
  element.click();
}
function checkBoard(document, count) {
  const app = document.querySelector('#app');
  const hand = app.querySelector('.atlas-hand-section');
  const timeline = app.querySelector('.board-timeline-section');
  assert.ok(app.classList.contains('atlas-board'), 'la partida usa la mesa compartida');
  assert.ok(hand && timeline && (hand.compareDocumentPosition(timeline) & 4), 'la mano precede a la línea');
  assert.equal(hand.querySelectorAll('.hand-card').length, count);
  for (const card of hand.querySelectorAll('.hand-card')) {
    assert.equal(card.querySelector('.carta-reverso .reverso-emblema')?.getAttribute('src'), logo);
    assert.equal(card.querySelector('.animal-card-art'), null, 'la mano no revela ilustraciones');
  }
}
function checkPendingHand(document) {
  assert.ok(document.querySelector('.slot-confirm'), 'la vista previa sigue en la línea');
  assert.equal(document.querySelectorAll('.hand-card.selected, .hand-card[aria-pressed="true"]').length, 0,
    'ninguna carta de arriba está seleccionada durante la vista previa');
  assert.ok(document.querySelector('.hand-placement-pending'), 'el carrusel mantiene un centro sin resaltarlo en rojo');
}
assert.match(read('edition.css'), /\.hand\.hand-fan:not\(\.hand-placement-pending\) \.hand-card\.fan-center\s*\{/,
  'el centro del carrusel solo tiene el resaltado rojo cuando no hay vista previa');
{
  const window = boot(), document = window.document;
  try {
    const CT = window.CONTINUUM;
    for (const mode of Object.keys(CT.MODES)) assert.match(CT.cardBack(mode), /continuum-emblem-800\.webp/);
    CT.localNavigate('jugar');
    click(document, '[data-inline-route]'); window.sessionStorage.removeItem('continuum-entry-route');
    click(document, '[data-block="historia"]');
    click(document, '[data-mode="history"]');
    (document.CONTINUUM||document.defaultView.CONTINUUM).openDeckAs('collections');
    click(document, '[data-action="start-free"]');
    checkBoard(document, 1);
    assert.ok(document.querySelector('.hand-card.selected'), 'la carta única destaca');
  } finally { window.close(); }
}
{
  const window = boot(), document = window.document;
  try {
    window.CONTINUUM.localNavigate('jugar');
    click(document, '[data-inline-route]'); window.sessionStorage.removeItem('continuum-entry-route');
    click(document, '[data-block="historia"]');
    click(document, '[data-mode="history"]');
    (document.CONTINUUM||document.defaultView.CONTINUUM).openDeckAs('local');
    document.querySelector('#hand-size').value = '4';
    click(document, '[data-action="start"]');
    // Antes de repartir se juega el minijuego de quién empieza (todas con la misma
    // cifra: a igual distancia se respeta el orden de la mesa).
    while (document.getElementById('starter-guess-input')) { document.getElementById('starter-guess-input').value = '1900'; click(document, '[data-action="starter-guess-submit"]'); }
    click(document, '[data-action="starter-start"]');
    click(document, '[data-action="ready"]');
    checkBoard(document, 4);
    click(document, '.hand-card:not(.selected)');
    assert.equal(document.querySelectorAll('.hand-card.selected').length, 1, 'solo una carta jugable resalta');
    assert.ok(document.querySelector('.hand-fan .fan-center.selected'), 'la elegida queda en el centro');
    const before = document.querySelector('.hand-card.selected').dataset.id;
    click(document, '[data-fan-step="1"]');
    assert.notEqual(document.querySelector('.hand-card.selected').dataset.id, before, 'la flecha elige la siguiente carta');
    click(document, '[data-fan-step="-1"]');
    assert.equal(document.querySelector('.hand-card.selected').dataset.id, before, 'el carrusel conserva el orden');
    click(document, '[data-action="place"]');
    checkPendingHand(document);
    click(document, '[data-action="place"]');
    checkPendingHand(document);
    click(document, '[data-action="cancel-place"]');
    assert.equal(document.querySelector('.hand-card.selected').dataset.id, before, 'cancelar devuelve la selección a su carta');
    assert.equal(document.querySelector('.hand-placement-pending'), null);
    click(document, '[data-action="place"]');
    click(document, '.hand-card');
    assert.equal(document.querySelector('.slot-confirm'), null, 'elegir otra carta retira la vista previa anterior');
    assert.equal(document.querySelectorAll('.hand-card.selected').length, 1);
  } finally { window.close(); }
}
{
  const window = boot(), document = window.document;
  try {
    const online = read('online.js').replace(/^import .*;$/gm, '').replace('export async function', 'async function');
    window.eval(`(() => {
      const initializeApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({});
      ${online}
      const ids=CT.cards('animals').map(card=>card.id);
      user={uid:'fer'};selectedModeKey='animals';roomCode='ABCD2345';roomRef={};
      roomState={mode:'animals',status:'playing',phase:'turn',players:{fer:{name:'Fer',hand:ids.slice(1,5)},ana:{name:'Ana',hand:ids.slice(5,9)}},playerOrder:['fer','ana'],current:0,hostUid:'ana',timeline:[ids[0]],deck:ids.slice(9),discard:[],round:1,turnsInRound:0,turnSeconds:0,version:1};
      CT.onlineActive=true;renderGame();
    })()`);
    checkBoard(document, 4);
    click(document, '[data-online-action="select"]');
    assert.equal(document.querySelectorAll('.hand-card.selected').length, 1);
    const before = document.querySelector('.hand-card.selected').dataset.id;
    click(document, '[data-online-action="place"]');
    checkPendingHand(document);
    click(document, '[data-online-action="cancel-place"]');
    assert.equal(document.querySelector('.hand-card.selected').dataset.id, before);
    assert.equal(document.querySelector('.hand-placement-pending'), null);
  } finally { window.close(); }
}
{
  const window = boot(), document = window.document;
  try {
    const CT = window.CONTINUUM;
    CT.Quick.openSolo((markup, playing) => CT.paint(document.querySelector('#app'), markup, playing ? 'quick-game' : 'quick-challenges'));
    click(document, '[data-quick="start-free"]');
    click(document, '[data-quick="ready"]');
    checkBoard(document, document.querySelectorAll('.hand-card').length);
    assert.ok(document.querySelectorAll('.hand-card').length > 1, 'el reto mantiene todas las cartas comunes');
    click(document, '[data-quick="select"]');
    assert.equal(document.querySelectorAll('.hand-card.selected').length, 1);
    assert.ok(document.querySelectorAll('.hand-fan .hand-card:not(.fan-away)').length <= 5, 'la mano larga ocupa un abanico compacto');
    const before = document.querySelector('.hand-card.selected').dataset.id;
    const hand = document.querySelector('.hand-fan');
    for (const [type, x] of [['pointerdown', 220], ['pointermove', 150], ['pointerup', 120]]) {
      const event = new window.MouseEvent(type, {bubbles: true, cancelable: true, clientX: x, clientY: 100});
      Object.defineProperties(event, {pointerType: {value: 'touch'}, pointerId: {value: 1}});
      hand.dispatchEvent(event);
    }
    assert.notEqual(document.querySelector('.hand-card.selected').dataset.id, before, 'deslizar cambia la carta sin salir de la partida');
    assert.ok(document.querySelector('.hand-fan .fan-center.selected'));
  } finally { window.close(); }
}
{
  const window = new JSDOM('<div id="app"></div>', {runScripts: 'outside-only'}).window;
  try {
    window.CONTINUUM = {};
    window.matchMedia = () => ({matches: true});
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
    window.eval(read('immersion.js'));
    const app = window.document.querySelector('#app');
    const renderHand = (screen, count, pending = false, solo = false) => {
      app.dataset.screen = screen;
      app.innerHTML = `<div class="shell"><section><div class="hand${solo ? ' hand-solo' : ''}">${Array.from({length: count}, (_, index) => `<button class="hand-card" data-id="${index}"><strong>Carta ${index}</strong></button>`).join('')}</div></section>${pending ? '<div class="slot-confirm"></div>' : ''}</div>`;
      window.CONTINUUM.UI.mount(app, screen);
    };
    for (const screen of ['game', 'local-game', 'online-game', 'quick-game']) {
      renderHand(screen, 3);
      assert.ok(app.querySelector('.hand-fan-controls'), `${screen}: hay controles con varias cartas`);
      renderHand(screen, 1);
      const last = app.querySelector('.hand-card');
      assert.ok(app.querySelector('.hand.hand-fan'), `${screen}: la última carta conserva los estilos de tamaño del abanico`);
      assert.ok(last.classList.contains('fan-center'), `${screen}: la última carta queda centrada`);
      assert.equal(last.style.getPropertyValue('--fan-offset'), '0');
      assert.equal(last.style.getPropertyValue('--fan-depth'), '0');
      assert.equal(last.tabIndex, 0, `${screen}: la carta sigue accesible con teclado`);
      assert.equal(app.querySelector('.hand-fan-controls'), null, `${screen}: no hay flechas sin otras cartas`);
      renderHand(screen, 1, true);
      assert.ok(app.querySelector('.hand-fan.hand-placement-pending'), `${screen}: también conserva el formato durante la vista previa`);
      renderHand(screen, 0);
      assert.equal(app.querySelector('.hand-fan'), null, `${screen}: no se monta un abanico vacío`);
    }
    renderHand('solo', 1, false, true);
    assert.equal(app.querySelector('.hand-fan'), null, 'solitario conserva su formato propio de carta única');
  } finally { window.close(); }
}
console.log('Mano y reverso: solitario, local, online y retos rápidos correctos.');
