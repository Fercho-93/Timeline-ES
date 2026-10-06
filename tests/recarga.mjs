import {gameHtml} from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=gameHtml(read('index.html'));
const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>read(m[1]));
function boot(saved={}) {
 const w=new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''),{runScripts:'outside-only',url:'https://continuum.test/'}).window;
 w.scrollTo=()=>{};
 for(const [key,value] of Object.entries(saved.session||{}))w.sessionStorage.setItem(key,value);
 for(const [key,value] of Object.entries(saved.local||{}))w.localStorage.setItem(key,value);
 for(const script of scripts)w.eval(script);
 return w;
}
const snapshot=w=>({session:{...w.sessionStorage},local:{...w.localStorage}});
let w=boot();
const click=selector=>{const el=w.document.querySelector(selector);assert.ok(el,selector);el.click();};
w.CONTINUUM.ModeHubs.open('hub-solo');w.document.querySelector('[data-inline-route]').click();w.sessionStorage.removeItem('continuum-entry-route');click('[data-block="historia"]');click('[data-mode="history"]');
let saved=snapshot(w);w.close();w=boot(saved);
assert.equal(w.document.querySelector('#app').dataset.screen,'solo-home');
assert.match(w.document.querySelector('.solo-intro .eyebrow').textContent,/Historia de España/);
// Una vista guardada por una versión anterior en la antigua pantalla de formatos abre el mazo en solitario.
const antigua=snapshot(w);antigua.session['continuum-tab-view-v1']=JSON.stringify({...JSON.parse(antigua.session['continuum-tab-view-v1']),screen:'play-menu'});
const vieja=boot(antigua);assert.equal(vieja.document.querySelector('#app').dataset.screen,'solo-home');vieja.close();
click('[data-action="start-free"]');
saved=snapshot(w);w.close();w=boot(saved);
assert.equal(w.document.querySelector('#app').dataset.screen,'solo');
const firstCard=w.document.querySelector('.hand-card').dataset.id;
saved=snapshot(w);w.close();w=boot(saved);
assert.equal(w.document.querySelector('.hand-card').dataset.id,firstCard,'recargar no reparte otra carta');
w.close();
w=boot({session:{'continuum-tab-view-v1':'{invalid'}});
assert.equal(w.document.querySelector('#app').dataset.screen,'home');w.close();
w=boot({session:{'continuum-tab-view-v1':JSON.stringify({screen:'play-menu',mode:'missing'})}});
assert.equal(w.document.querySelector('#app').dataset.screen,'home');w.close();
console.log('Recarga: mismo mazo, solitario sin repartir de nuevo y rutas inválidas OK.');
