import {gameHtml} from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {finishLocalFinal} from './final-helper.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=gameHtml(read('index.html')), key='continuum-multi-competition-v1';
function boot(saved) {
 const w=new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''),{runScripts:'outside-only',url:'https://continuum.test/'}).window;
 w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
 if(saved) w.localStorage.setItem(key,saved);
 for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
 return w;
}
let w=boot();
const click=sel=>{const el=w.document.querySelector(sel);assert.ok(el,sel);el.click();};
const state=()=>JSON.parse(w.localStorage.getItem(key));
assert.equal(w.document.querySelector('[data-action="start-competition"]'),null);
assert.equal(w.document.getElementById('competition-length'),null);
w.CONTINUUM.localNavigate('home');w.CONTINUUM.ModeHubs.refreshHome();w.CONTINUUM.ModeHubs.open('hub-friends-local');click('[data-action="competition-menu"]');
// Desde «Un solo móvil» se abre directamente la ventana única de ajustes.
assert.ok(w.document.getElementById('competition-length') && w.document.getElementById('hand-size'));
assert.equal(w.document.getElementById('competition-cards'),null);
// Cada puerta ofrece solo su forma de jugar: ya se eligió antes, no se vuelve a preguntar.
assert.equal(w.document.querySelector('[data-action="competition-online"]'), null, 'desde «Un solo móvil» no se ofrece la sala online');
assert.equal(w.document.querySelector('[data-action="start-competition"]'), null, 'ni la competición en solitario');
w.CONTINUUM.ModeHubs.open('hub-friends-online');click('[data-action="competition-menu"]');
assert.ok(w.document.querySelector('[data-action="comp-friends-start"]'));
assert.equal(w.document.querySelector('[data-action="competition-local"]'), null, 'desde «Cada uno en su móvil» no se ofrece un solo móvil');
// La competición es siempre de las Grandes colecciones: no se elige contenido.
assert.equal(w.document.querySelector('input[name="comp-content"]'), null);
// Cartas por persona siempre a la vista, con 5 temas por defecto.
assert.ok(w.document.getElementById('competition-cards').checkVisibility?.() ?? !w.document.getElementById('competition-cards').closest('[hidden]'));
// Por turnos caben 30 cartas: el desplegable solo ofrece las cartas por persona que se jugarán con
// esos temas, y la entradilla dice cómo se gana con cada ritmo.
{
  const doc = w.document, cartas = () => doc.getElementById('competition-cards');
  const elegibles = () => [...cartas().options].filter(o => !o.disabled && !o.hidden).map(o => Number(o.value));
  const cambia = (el, valor) => { if (el.type === 'radio') el.checked = true; else el.value = String(valor); el.dispatchEvent(new w.Event('change', {bubbles: true})); };
  const ritmo = valor => cambia(doc.querySelector(`input[name="comp-pace"][value="${valor}"]`));
  const temas = n => cambia(doc.getElementById('competition-length'), n);
  const ayuda = () => doc.querySelector('[data-comp-cards-help]'), ayudaOculta = () => !!ayuda().closest('[hidden]'), lead = () => doc.querySelector('[data-comp-lead]').textContent;
  assert.deepEqual(elegibles(), [1, 2, 3, 4, 5, 6], 'en directo, de 1 a 6');
  assert.equal(ayudaOculta(), true);
  assert.match(lead(), /todos a la vez/);
  cartas().value = '6';
  ritmo('turnos'); temas(5);
  assert.deepEqual(elegibles(), [1, 2, 3], 'por turnos, con 5 temas caben 3 por persona');
  assert.equal(cartas().value, '3', 'lo elegido baja al tope');
  assert.equal(ayudaOculta(), false);
  assert.match(ayuda().textContent, /con 5 temas caben como mucho 3 cartas/);
  assert.match(lead(), /por turnos entre dos; gana quien más acierte en total/);
  assert.doesNotMatch(lead(), /todos a la vez/);
  temas(3);
  assert.deepEqual(elegibles(), [1, 2, 3, 4, 5], 'con 3 temas, 5');
  assert.match(ayuda().textContent, /con 3 temas caben como mucho 5 cartas/);
  // Al volver a entrar por turnos, la pantalla ya sale con el tope.
  temas(5); w.CONTINUUM.ModeHubs.open('hub-friends-online'); click('[data-action="competition-menu"]');
  assert.ok(Math.max(...elegibles()) <= 3 && Number(cartas().value) <= 3, 'repintada por turnos, sin cartas que no caben');
  // Sin internet, la competición por turnos no se puede crear: se avisa y el botón no la empieza.
  Object.defineProperty(w.navigator, 'onLine', {configurable: true, get: () => false});
  w.CONTINUUM.ModeHubs.open('hub-friends-online'); click('[data-action="competition-menu"]');
  assert.equal(doc.querySelector('[data-offline-turnos]').hidden, false);
  assert.equal(doc.querySelector('[data-offline-note]').hidden, true, 'por turnos no se dice que se jugará por la Wi-Fi');
  click('[data-action="comp-friends-start"]');
  assert.ok(doc.querySelector('[data-action="comp-friends-start"]'), 'sigue en la misma pantalla');
  assert.match(doc.getElementById('toast').textContent, /Sin internet no se puede crear una competición por turnos/);
  ritmo('directo');
  assert.equal(doc.querySelector('[data-offline-turnos]').hidden, true);
  assert.equal(doc.querySelector('[data-offline-note]').hidden, false, 'en directo, por la Wi-Fi');
  assert.deepEqual(elegibles(), [1, 2, 3, 4, 5, 6]);
  Object.defineProperty(w.navigator, 'onLine', {configurable: true, get: () => true});
}
w.CONTINUUM.ModeHubs.open('hub-friends-local');click('[data-action="competition-menu"]');
// Un solo móvil: una única ventana de ajustes (rondas y cartas), sin pantalla previa.
assert.equal(w.document.getElementById('competition-cards'),null);
w.document.getElementById('competition-length').value='3';w.document.getElementById('hand-size').value='1';
// La competición se juega sin poderes: la preparación no ofrece los interruptores.
assert.equal(w.document.getElementById('ghost-toggle'),null);assert.equal(w.document.getElementById('pulse-toggle'),null);
click('[data-action="start"]');
// Antes de repartir se juega el minijuego de quién empieza (todas con la misma
// cifra: a igual distancia se respeta el orden de la mesa).
while (w.document.getElementById('starter-guess-input')) { w.document.getElementById('starter-guess-input').value = '1900'; click('[data-action="starter-guess-submit"]'); }
click('[data-action="starter-start"]');
click('[data-action="competition-round-start"]');
assert.equal(state().tournament.queue.length,3);assert.equal(new Set(state().tournament.queue).size,3);
assert.ok(state().players.every(p=>p.hand.length===1));
assert.ok(!state().ghost && !state().pulsePower && state().pulse===false,'el reparto no esconde poderes');
for(let round=0;round<3;round++) {
 for(let turn=0;turn<2;turn++) {
  click('[data-action="ready"]');const s=state(),CT=w.CONTINUUM;
  const card=CT.cards(s.mode).find(c=>c.id===s.players[s.current].hand[0]);
  click(`[data-action="select-card"][data-id="${card.id}"]`);
  const index=CT.correctIndex(s.mode,s.timeline.map(id=>CT.cards(s.mode).find(c=>c.id===id)),card);
  click(`[data-action="place"][data-index="${index}"]`);click('[data-action="confirm-place"]');click('[data-action="finish-turn"]');
 }
 assert.equal(state().final.players.length,2);
 finishLocalFinal(w,key);
 assert.ok(w.document.querySelector('.tournament-board'));
 assert.equal(w.document.querySelectorAll('.chapter-stop').length,3);
 assert.equal(w.document.querySelectorAll('.chapter-stop.current').length,1);
 assert.ok(w.document.querySelector('.final-metrics'),'el cierre resume el resultado antes de las acciones');
 assert.equal(state().tournament.index,round);
 // Terminar la competición en grupo también da «Vuelta completa», como en solitario; los temas de antes, no.
 assert.equal(w.CONTINUUM.Progreso.read().marks.comps,round===2?1:0,'la competición de un solo móvil cuenta para el logro al acabar');
 if(round===2){
  // El marcador final, en la propia pantalla del último tema.
  assert.equal(w.document.querySelector('[data-action="competition-next"]'),null);
  assert.match(w.document.querySelector('.tournament-board').textContent,/3 puntos/);
  assert.match(w.document.querySelector('.tournament-board').textContent,/0 puntos/,'quien pierde las tres finales no suma');
  assert.equal(w.document.querySelectorAll('.chapter-stop.complete').length,2);
  assert.match(w.document.querySelector('.final-title').textContent,/gana el tema|ganan el tema/,'el título habla del tema, no de la competición');
 }
 const saved=w.localStorage.getItem(key);w.close();w=boot(saved);w.CONTINUUM.localNavigate('home');w.CONTINUUM.ModeHubs.refreshHome();w.CONTINUUM.ModeHubs.open('hub-friends-local');click('[data-action="competition-menu"]');
 // Una competición ya terminada no se ofrece seguir: solo quedaría el marcador final.
 if(round===2){assert.equal(w.document.querySelector('[data-action="competition-resume"]'),null,'la competición terminada no se ofrece seguir');break;}
 click('[data-action="competition-resume"]');
 assert.ok(w.document.querySelector('.tournament-board'));
 const prior=state().mode;click('[data-action="competition-next"]');assert.notEqual(state().mode,prior);assert.ok(state().players.every(p=>p.hand.length===1));click('[data-action="competition-round-start"]');
}
w.close();
// La pantalla de resultado no puede ensancharse más que el móvil: sin una pista de rejilla acotada, el recorrido de
// una competición (capítulos en fila) empujaba todo el resultado fuera de la pantalla y solo se veía el fondo.
{
  const css=read('css/edition.css');
  assert.match(css,/\.pass-screen\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);?\s*\}/,'.pass-screen tiene una única columna acotada');
  assert.match(css,/\.chapter-journey ol > li\.chapter-stop\s*\{[^}]*display:\s*grid/,'los capítulos del recorrido no heredan el flex de las listas del marcador');
}
// Solitario conserva el mismo ciclo y juega siempre 10 cartas por tema, como una ronda: no se eligen.
w=boot();w.CONTINUUM.localNavigate('home');w.CONTINUUM.ModeHubs.refreshHome();w.CONTINUUM.ModeHubs.open('hub-solo');click('[data-action="competition-menu"]');w.document.getElementById('competition-length').value='3';
assert.equal(w.document.getElementById('competition-cards'),null,'la competición en solitario no ofrece elegir las cartas por tema');
click('[data-action="start-competition"]');click('[data-action="comp-next-round"]');
let solo=JSON.parse(w.localStorage.getItem('continuum-competition-v1'));
assert.equal(solo.cardsPerRound,10);assert.equal(solo.solo.total,10);
{ // El recorrido no revela los mazos que aún no han llegado.
  const CTw = w.CONTINUUM, modos = CTw.Tournament.modes().slice(0, 3);
  const html = CTw.Tournament.journey({ queue: modos, index: 0, history: [], handSize: 4 });
  assert.ok(html.includes(CTw.mode(modos[0]).name), 'el capítulo actual sí dice su mazo');
  for (const pendiente of modos.slice(1)) assert.ok(!html.includes(CTw.mode(pendiente).name), 'un capítulo pendiente no debe decir su mazo');
  assert.ok(html.includes('Por descubrir'));
}
{ // Solo suma quien gana la ronda: perder la final con la mano vacía deja a cero.
  const CTw = w.CONTINUUM, modos = CTw.Tournament.modes().slice(0, 2);
  const t = { queue: modos, index: 1, handSize: 3, history: [{ mode: modos[0], winners: [1], hands: { 1: 0, 2: 0, 3: 2 } }] };
  const mesa = [{ id: 1, name: 'Ana', hand: [] }, { id: 2, name: 'Luis', hand: [] }, { id: 3, name: 'Eva', hand: [7, 8, 9] }];
  const puntos = html => Object.fromEntries([...html.matchAll(/<strong>(\w+)<\/strong><span>(-?\d+) punto/g)].map(m => [m[1], Number(m[2])]));
  assert.deepEqual(puntos(CTw.Tournament.board(t, mesa, [2])), { Ana: 1, Luis: 1, Eva: -3 });
  // Una ronda que acaba sin ganador cuenta las manos, pero no regala el punto a nadie.
  assert.deepEqual(puntos(CTw.Tournament.board(t, mesa, [], true)), { Ana: 1, Luis: 0, Eva: -3 });
}
w.close();
console.log('Competición: tres formatos, mazos sin repetir, cartas configurables, tres rondas locales, desempate, marcador y recuperación: OK');
