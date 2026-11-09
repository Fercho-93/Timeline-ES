import {gameHtml} from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { finishLocalFinal } from './final-helper.mjs';
const html = gameHtml(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const key = 'hilo-game-history-v1';
function boot(saved) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://test.local/'}).window;
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = () => {};
  if (saved) w.localStorage.setItem(key, saved);
  for (const file of scripts) w.eval(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  return w;
}
let w = boot();
const F = w.CONTINUUM.Final;
assert.equal(F.parse('animals','0,3'),300000000);
assert.equal(F.parse('history','218',true),-218);
// La cifra se escribe como en el minijuego de quién empieza: con la unidad detrás y, en fechas, «a. C.» (el menos).
assert.equal(F.parse('population','47 millones'),47000000);
assert.equal(F.parse('population','47,5 millones'),47500000);
assert.equal(F.parse('animals','300 g'),300000000);
assert.equal(F.parse('history','-218'),-218);
assert.throws(()=>F.parse('population','47 lunas'),/cifra/);
assert.throws(()=>F.parse('population','47,5'),/decimales/, 'no hay medio habitante');
assert.match(F.form('population','data-x'), /cifra-chip[^>]*data-cifra-unidad="millones"/, 'la final lleva los botones de unidad');
assert.match(F.form('history','data-x'), /data-cifra-signo="a\. C\."/, 'y el de a. C. en las fechas');
assert.doesNotMatch(F.form('history','data-x'), /final-era/, 'sin el selector de era de antes');
// La final no repite una carta cuyo valor ya se vio (línea, descarte, minijuego) mientras quede otra.
{
  const ids = w.CONTINUUM.cards('history').map(card => card.id);
  for (let i = 0; i < 20; i++) assert.equal(F.create('history', ['a','b'], null, ids.slice(1)).cardId, ids[0]);
  const visto = ids.slice(0, -1), segunda = F.create('history', ['a','b'], F.create('history', ['a','b'], null, visto), visto);
  assert.notEqual(segunda.cardId, ids.at(-1), 'el desempate siguiente no repite la carta de la ronda anterior');
}
// La cifra correcta de una final se comprueba contra la carta: una sala online no puede
// traer otra (la escribe quien abre la final y las reglas no la recalculan).
{
  const honesta = F.create('history', ['a','b']);
  assert.ok(F.valid('history', honesta), 'una final creada por el juego es válida');
  assert.equal(F.targetOf('history', honesta.cardId), honesta.target);
  assert.ok(!F.valid('history', {...honesta, target: honesta.target + 1}), 'TRAMPA: otra cifra correcta para la misma carta');
  assert.ok(!F.valid('history', {...honesta, cardId: -1}), 'TRAMPA: una carta que no existe');
  assert.ok(!F.valid('history', null));
}
for (const raw of ['', 'NaN','1.234,56','1e6','3.1']) assert.throws(()=>F.parse('history',raw));
assert.throws(()=>F.parse('animals','-1'));
const ranked = F.rank({players:['a','b','c'], target:300000000},{a:200000000,b:400000000,c:900000000});
assert.deepEqual([...ranked.winners],['a','b']);
for (const mode of Object.keys(w.CONTINUUM.MODES)) {
  let final = F.create(mode,['a','b','c']);
  assert.ok(Number.isSafeInteger(final.target));
  const next = F.create(mode,['a','b'], final);
  assert.notEqual(next.cardId,final.cardId);
  assert.equal(next.round,2);
  assert.equal(next.players.length,2);
  // Cada mazo dice en qué unidad se responde: Idiomas se quedaba en «(undefined)».
  assert.doesNotMatch(F.form(mode,'data-x') + F.question(mode,final) + F.value(mode,final.target), /undefined/, `unidad de ${mode}`);
}
assert.match(F.form('languages','data-x'), /Tu cifra secreta \(hablantes\)/);
assert.match(F.form('history','data-x'), /Tu cifra secreta \(años\)/);
assert.equal(F.value('animals', F.parse('animals','0,3')), '0,3 kg');
function click(sel) { const el=w.document.querySelector(sel); assert.ok(el,sel); el.click(); }
w.CONTINUUM.ModeHubs.open('hub-solo');w.document.querySelector('[data-inline-route]').click();w.sessionStorage.removeItem('continuum-entry-route');click('[data-block="historia"]');click('[data-mode="history"]');w.CONTINUUM.openDeckAs('local');
w.document.querySelector('#hand-size').value='1';click('[data-action="start"]');
while (w.document.getElementById('starter-guess-input')) { w.document.getElementById('starter-guess-input').value='1900'; click('[data-action="starter-guess-submit"]'); }
click('[data-action="starter-start"]');
for(let i=0;i<2;i++) {
  click('[data-action="ready"]');
  const id=Number(w.document.querySelector('.hand-card').dataset.id);
  click('.hand-card');
  const state=JSON.parse(w.localStorage.getItem(key));
  const card=w.CONTINUUM.cards('history').find(c=>c.id===id);
  const line=state.timeline.map(cid=>w.CONTINUUM.cards('history').find(c=>c.id===cid));
  const index=w.CONTINUUM.correctIndex('history',line,card);
  click(`[data-action="place"][data-index="${index}"]`);click('[data-action="confirm-place"]');click('[data-action="finish-turn"]');
}
let state=JSON.parse(w.localStorage.getItem(key));
assert.equal(state.final.players.length,2);
assert.ok(state.players.every(p=>p.hand.length===0));
assert.equal(state.starterCardIds.length,1,'la partida recuerda la carta del minijuego');
assert.ok(![...state.starterCardIds,...state.timeline,...state.discard].includes(state.final.cardId),'la final no repite la carta del minijuego ni otra ya vista');
assert.equal(w.document.querySelector('[data-final-local]'),null,'pantalla de pase oculta el formulario');
// Ambos dan la misma cifra: segunda carta y conservación de respuestas al recargar.
for(let i=0;i<2;i++) {
  click('[data-action="final-ready"]');
  w.document.querySelector('#final-guess').value='12345';
  w.document.querySelector('[data-final-local]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  if(i===0) {
    assert.ok(!w.document.body.textContent.includes('12345'),'la cifra previa no aparece al pasar el móvil');
    const saved=w.localStorage.getItem(key);w.close();w=boot(saved);
    click('[data-action="continue"]');
  }
}
assert.ok(w.document.querySelector('.final-results'));
click('[data-action="final-next"]');
const second=JSON.parse(w.localStorage.getItem(key));
assert.equal(second.final.round,2);assert.notEqual(second.final.cardId,state.final.cardId);
finishLocalFinal(w,key);
state=JSON.parse(w.localStorage.getItem(key));
assert.equal(state.winners.length,1);
w.close();
// La frase bajo «X gana» es la misma en los tres modos y dice cómo se ganó de verdad.
{
  const v = boot().CONTINUUM.Final.verdict;
  assert.equal(v({ ganadores: 1, final: false, quedan: 3 }), 'Ha sido la única persona en terminar la vuelta sin cartas.');
  assert.equal(v({ ganadores: 1, final: false, quedan: 1 }), 'Es la última persona que queda en la partida.', 'si los demás se marcharon no ganó por cartas');
  assert.equal(v({ ganadores: 1, final: true, quedan: 3 }), 'Ha ganado la final con la cifra más cercana.');
  assert.equal(v({ ganadores: 2, final: true, quedan: 3 }), 'Han empatado en la final con la misma diferencia.');
}
console.log('Final: unidades, decimales, a. C., empate, carta nueva, secreto local, recarga y ganador único: OK');
