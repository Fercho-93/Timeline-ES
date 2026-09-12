import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { finishLocalFinal } from './final-helper.mjs';
const html = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
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
}
function click(sel) { const el=w.document.querySelector(sel); assert.ok(el,sel); el.click(); }
click('[data-block="historia"]');click('[data-mode="history"]');click('[data-format="multi"]');click('[data-action="setup"]');
w.document.querySelector('#hand-size').value='1';click('[data-action="start"]');
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
console.log('Final: unidades, decimales, a. C., empate, carta nueva, secreto local, recarga y ganador único: OK');
