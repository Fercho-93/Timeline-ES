import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {finishLocalFinal} from './final-helper.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'), key='continuum-multi-competition-v1';
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
click('[data-action="competition-menu"]');
assert.ok(w.document.querySelector('[data-action="start-competition"]'));
w.document.getElementById('competition-length').value='3';w.document.getElementById('competition-cards').value='1';
click('[data-format="competition-multi"]');
assert.equal(w.document.getElementById('competition-length').value,'3');
assert.equal(w.document.getElementById('competition-cards').value,'1');
assert.ok(w.document.querySelector('[data-action="competition-online"]'));
click('[data-action="competition-local"]');click('[data-action="back-menu"]');
assert.equal(w.document.getElementById('competition-cards').value,'1');
click('[data-action="competition-local"]');click('[data-action="start"]');
click('[data-action="competition-round-start"]');
assert.equal(state().tournament.queue.length,3);assert.equal(new Set(state().tournament.queue).size,3);
assert.ok(state().players.every(p=>p.hand.length===1));
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
 assert.equal(state().tournament.index,round);
 const saved=w.localStorage.getItem(key);w.close();w=boot(saved);click('[data-action="competition-menu"]');click('[data-action="competition-resume"]');
 assert.ok(w.document.querySelector('.tournament-board'));
 if(round<2){const prior=state().mode;click('[data-action="competition-next"]');assert.notEqual(state().mode,prior);assert.ok(state().players.every(p=>p.hand.length===1));click('[data-action="competition-round-start"]');}
}
assert.equal(w.document.querySelector('[data-action="competition-next"]'),null);
assert.match(w.document.querySelector('.tournament-board').textContent,/3 puntos/);
w.close();
// Solitario conserva el mismo ciclo y respeta el número de cartas elegido.
w=boot();click('[data-action="competition-menu"]');w.document.getElementById('competition-length').value='3';w.document.getElementById('competition-cards').value='2';
click('[data-action="start-competition"]');click('[data-action="comp-next-round"]');
let solo=JSON.parse(w.localStorage.getItem('continuum-competition-v1'));
assert.equal(solo.cardsPerRound,2);assert.equal(solo.solo.total,2);
w.close();
console.log('Competición: tres formatos, mazos sin repetir, cartas configurables, tres rondas locales, desempate, marcador y recuperación: OK');
