// La mano ocupa la mitad superior del tablero y muestra la misma marca en
// solitario, multijugador local, sala online y retos rápidos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {gameHtml} from './game-fixture.mjs';

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
{
  const window = boot(), document = window.document;
  try {
    const CT = window.CONTINUUM;
    for (const mode of Object.keys(CT.MODES)) assert.match(CT.cardBack(mode), /continuum-emblem-800\.webp/);
    CT.localNavigate('jugar');
    click(document, '[data-action="toggle-play-catalog"][data-section="collections"]');
    click(document, '[data-block="historia"]');
    click(document, '[data-mode="history"]');
    click(document, '[data-action="solo"]');
    click(document, '[data-action="start-free"]');
    checkBoard(document, 1);
    assert.ok(document.querySelector('.hand-card.selected'), 'la carta única destaca');
  } finally { window.close(); }
}
{
  const window = boot(), document = window.document;
  try {
    window.CONTINUUM.localNavigate('jugar');
    click(document, '[data-action="toggle-play-catalog"][data-section="collections"]');
    click(document, '[data-block="historia"]');
    click(document, '[data-mode="history"]');
    click(document, '[data-format="multi"]');
    click(document, '[data-action="setup"]');
    document.querySelector('#hand-size').value = '4';
    click(document, '[data-action="start"]');
    click(document, '[data-action="ready"]');
    checkBoard(document, 4);
    click(document, '.hand-card:not(.selected)');
    assert.equal(document.querySelectorAll('.hand-card.selected').length, 1, 'solo una carta jugable resalta');
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
  } finally { window.close(); }
}
console.log('Mano y reverso: solitario, local, online y retos rápidos correctos.');
