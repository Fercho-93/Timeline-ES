import {gameHtml} from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
// Antes de repartir se juega el minijuego de quién empieza: todos dicen la misma cifra.
function jugarQuienEmpieza(w) { const d = w.document; const tap = el => el?.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); for (let i = 0; i < 12 && d.getElementById('starter-guess-input'); i++) { d.getElementById('starter-guess-input').value = '1900'; tap(d.querySelector('[data-action="starter-guess-submit"]')); } tap(d.querySelector('[data-action="starter-start"]')); return w; }

// La colección y la competición viven ahora en «Jugar», no en la portada: desde la
// portada, se entra primero ahí. Devuelve la misma ventana para poder encadenarlo.
// La tarjeta de la portada gira antes de navegar; `homeTransition = "done"` es la
// marca con la que la propia portada se salta ese giro, y aquí se usa para no esperarlo.
function pulsaPuerta(d, accion) { const b = d.querySelector(`[data-action="${accion}"]`); if (!b) return; b.dataset.homeTransition = "done"; b.click(); }
function irAJugar(w) { const d = w.document; if (!d.querySelector('[data-block]')) { w.CONTINUUM.ModeHubs.open('hub-solo'); if (!d.querySelector('[data-block]')) d.querySelector('[data-inline-route]')?.click(); } w.sessionStorage.removeItem('continuum-entry-route'); return w; }
function irAInicio(w) { w.sessionStorage.removeItem('continuum-entry-route'); w.CONTINUUM.localNavigate('home'); w.CONTINUUM.ModeHubs.refreshHome(); return w; }

const read = f => fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html = gameHtml(read('index.html'));
function boot(reduce = true) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test',pretendToBeVisual:true}).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.matchMedia = () => ({matches:reduce});
  for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(match[1]));
  return w;
}
const click = (w,s) => {const el=w.document.querySelector(s);assert.ok(el,s);el.click();};
const screen = w => w.document.querySelector('#app').dataset.screen;
{
  const w = boot();
  try {
    const titulo = w.document.querySelector('.home-masthead:not(.splash-masthead) .home-wordmark');
    assert.equal(titulo?.textContent.trim(), 'Continuum', 'el título principal sigue siendo texto legible');
    const css = read('css/styles.css');
    assert.match(css, /\.home-masthead:not\(\.splash-masthead\) \.home-wordmark\s*\{[^}]*max-width:\s*100%/s,
      'el relieve se limita a Inicio y conserva el encaje en móvil');
    assert.match(css, /\.home-masthead:not\(\.splash-masthead\) \.home-wordmark\s*\{[^}]*color:\s*var\(--ink\)[^}]*text-shadow:[^}]*var\(--paper\)[^}]*var\(--accent-dark\)/s,
      'el título obtiene contraste y relieve desde la paleta de cada tema');
  } finally {w.close();}
}
{
  const w=boot();
  try {
    click(irAJugar(w),'[data-block="naturaleza"]');click(w,'[data-mode="animals"]');
    assert.equal(w.document.getElementById('app').dataset.screen,'solo-home');
    assert.equal(w.document.querySelectorAll('.home-nav button').length,4);
    assert.ok(w.document.querySelector('.home-nav [data-action="rules"]'));
    assert.equal(w.document.querySelector('.topbar [data-action="rules"]'),null);
    (w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
    w.document.querySelector('#hand-size').value='4';click(w, '[data-action="start"]'); jugarQuienEmpieza(w);click(w,'[data-action="ready"]');
    assert.equal(w.document.querySelectorAll('.hand-card').length,4);
    assert.equal(w.document.querySelector('.home-nav'),null);
    assert.equal(w.document.querySelectorAll('.topbar button').length,2);
    click(w,'.hand-card');
    // La carta elegida pasa a la línea como vista previa al tocar un hueco.
    const selected=w.document.querySelector('.hand-card.selected').dataset.id;
    click(w,'.slot');
    assert.equal(w.document.querySelectorAll('[data-action="confirm-place"]').length,1);
    assert.ok(w.document.querySelector('.placement-dock [data-action="confirm-place"]'));
    assert.equal(w.document.querySelector('.placement-dock-status strong').textContent,'Posición elegida');
    assert.equal(w.document.querySelector('.placement-dock-actions [data-action="cancel-place"]').textContent,'Cambiar');
    const timelineSection=w.document.querySelector('.timeline-wrap').closest('section');
    assert.equal(timelineSection.nextElementSibling.className,'placement-dock');
    assert.ok(w.document.querySelector('.atlas-hand-section'), 'la mano sigue en la mesa');
    assert.equal(w.document.querySelector('.slot-confirm button'),null);
    const zoom=w.document.querySelector('[data-timeline-range]');zoom.value='0';zoom.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(w.document.querySelector('.timeline-zoom output').textContent,'80%');
    assert.equal(w.document.querySelector(`.hand-card[data-id="${selected}"]`),null,'la carta elegida está en la línea como vista previa');
    const saved=w.localStorage.getItem('hilo-game-animals-v1');
    click(w,'[data-action="ui-back"]');assert.ok(w.document.querySelector('[data-exit-dialog]'));
    click(w,'[data-exit-stay]');assert.equal(screen(w),'game');assert.equal(w.localStorage.getItem('hilo-game-animals-v1'),saved);
    click(w,'[data-action="ui-back"]');click(w,'[data-exit-confirm]');assert.equal(screen(w),'setup');
    assert.ok(w.localStorage.getItem('hilo-game-animals-v1'));
    click(w,'[data-action="continue"]');click(w,'[data-action="ready"]');
    assert.equal(w.document.querySelectorAll('.hand-card').length,4);
  } finally {w.close();}
}
{
  const w=boot();
  try {
    // Real online rendering with an inert SDK: no server calls are made by UI navigation.
    w.eval(`(() => {
      const initializeApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({}),firebaseApp={},auth={},db={};
      const deleteDoc=async()=>{},disableNetwork=async()=>{},enableNetwork=async()=>{},doc=()=>({}),getDoc=async()=>({exists:()=>false,data:()=>null}),onSnapshot=()=>()=>{},runTransaction=async()=>{},serverTimestamp=()=>null,setDoc=async()=>{},writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});
      ${read('js/online/online.js').replace(/^import .*;$/gm,'').replace('export async function','async function')}
      const ids=CT.cards('animals').map(c=>c.id);
      user={uid:'fer'};selectedModeKey='animals';roomCode='ABCD2345';roomRef={};
      roomState={mode:'animals',status:'playing',phase:'turn',players:{fer:{name:'Fer',hand:ids.slice(1,5)},ana:{name:'Ana',hand:ids.slice(5,9)}},playerOrder:['fer','ana'],current:0,hostUid:'ana',timeline:[ids[0]],deck:ids.slice(9),discard:[],round:1,turnsInRound:0,turnSeconds:0,version:1};
      CT.onlineActive=true; window.detachCount=0;unsubscribeRoom=()=>window.detachCount++;
      renderGame();
    })()`);
    assert.equal(screen(w),'online-game');
    assert.equal(w.document.querySelectorAll('.home-nav').length,0);
    click(w,'[data-online-action="select"]');click(w,'[data-online-action="place"]');
    assert.ok(w.document.querySelector('.placement-dock [data-online-action="confirm-place"]'));
    click(w,'[data-online-action="room"]');assert.ok(w.document.querySelector('[data-online-action="guide"]'));
    click(w,'[data-online-action="close-room-menu"]');
    click(w,'[data-online-action="back"]');click(w,'[data-exit-stay]');assert.equal(screen(w),'online-game');assert.equal(w.detachCount,0);
    click(w,'[data-online-action="back"]');click(w,'[data-exit-confirm]');
    assert.equal(screen(w),'online-entry');assert.equal(w.detachCount,1);
    assert.equal(w.document.querySelector('#online-code').value,'ABCD2345');
    assert.equal(w.document.querySelectorAll('.home-nav button').length,4);
    click(w,'.home-nav [data-action="home-top"]');assert.equal(screen(w),'home');
  } finally {w.close();}
}
// Si cambia el anfitrión en la sala de espera, el nuevo enseña y usa lo que se eligió al crear
// la sala (guardado en ella), no sus propias preferencias de «Cada uno en su móvil».
{
  const w=boot();
  try {
    w.localStorage.setItem('continuum-tiempo-amigos-v1','30');
    w.eval(`(() => {
      const initializeApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({}),firebaseApp={},auth={},db={};
      const deleteDoc=async()=>{},disableNetwork=async()=>{},enableNetwork=async()=>{},doc=()=>({}),getDoc=async()=>({exists:()=>false,data:()=>null}),onSnapshot=()=>()=>{},runTransaction=async()=>{},serverTimestamp=()=>null,setDoc=async()=>{},writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});
      ${read('js/online/online.js').replace(/^import .*;$/gm,'').replace('export async function','async function')}
      user={uid:'ana'};selectedModeKey='history';roomCode='RELEVO234';roomRef={};
      roomState={mode:'history',status:'lobby',phase:'lobby',hostUid:'ana',playerOrder:['ana','fer'],players:{ana:{name:'Ana',hand:[]},fer:{name:'Fer',hand:[]}},timeline:[],deck:[],discard:[],round:1,version:3,
        turnSeconds:20,handSize:3,poderes:{pulse:true,ghost:false}};
      CT.onlineActive=true;renderLobby();
    })()`);
    assert.equal(w.document.getElementById('online-turn-seconds').value,'20','el tiempo es el de la sala, no el del nuevo anfitrión');
    assert.equal(w.document.getElementById('online-hand-size').value,'3');
    assert.equal(w.document.getElementById('online-pulse').checked,true);
    assert.equal(w.document.getElementById('online-ghost').checked,false);
    await new Promise(resolve=>setTimeout(resolve,50));
  } finally {w.close();}
}
// Al terminar una sala online se repasa lo fallado, como en un solo móvil: un fallo de
// cualquiera de la mesa entra en «Ver lo que se falló»; un acierto, no.
{
  const w=boot();
  try {
    w.eval(`(() => {
      const initializeApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({}),firebaseApp={},auth={},db={};
      const deleteDoc=async()=>{},disableNetwork=async()=>{},enableNetwork=async()=>{},doc=()=>({}),getDoc=async()=>({exists:()=>false,data:()=>null}),onSnapshot=()=>()=>{},runTransaction=async()=>{},serverTimestamp=()=>null,setDoc=async()=>{},writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});
      ${read('js/online/online.js').replace(/^import .*;$/gm,'').replace('export async function','async function')}
      const ids=CT.cards('animals').map(c=>c.id);
      user={uid:'fer'};selectedModeKey='animals';roomCode='ABCD2345';roomRef={};
      const base={mode:'animals',status:'playing',players:{fer:{name:'Fer',hand:[]},ana:{name:'Ana',hand:[ids[5]]}},playerOrder:['fer','ana'],current:0,hostUid:'ana',timeline:[ids[0],ids[1]],deck:ids.slice(9),discard:[ids[2]],round:2};
      roomState={...base,phase:'reveal',version:7,reveal:{playerUid:'ana',cardId:ids[2],correct:false}};anotaProgreso();
      roomState={...base,phase:'reveal',version:8,reveal:{playerUid:'fer',cardId:ids[1],correct:true}};anotaProgreso();
      roomState={...base,status:'ended',phase:'finished',version:9,winner:'fer',winners:['fer']};
      CT.onlineActive=true;renderWinner();
      window.__fallada=CT.cards('animals').find(c=>c.id===ids[2]).title;
    })()`);
    const boton=w.document.querySelector('[data-online-action="review-failed"]');
    assert.ok(boton,'la sala online ofrece «Ver lo que se falló»');
    assert.match(boton.textContent,/\(1\)/);
    click(w,'[data-online-action="review-failed"]');
    assert.equal(w.document.querySelectorAll('.review-grid .timeline-card').length,1);
    assert.ok(w.document.querySelector('.review-grid').textContent.includes(w.__fallada));
    click(w,'[data-online-action="back-from-timeline"]');
    assert.ok(w.document.querySelector('[data-online-action="review-failed"]'),'«Volver» regresa al resultado');
    // Lo que el perfil deja pendiente (guardar el progreso) termina antes de cerrar la ventana.
    await new Promise(resolve=>setTimeout(resolve,50));
  } finally {w.close();}
}
{
  const w=boot();
  try {
    assert.deepEqual(JSON.parse(JSON.stringify(w.CONTINUUM.effectPrefs())),{sound:false,haptics:false,sfx:true,sfxVolume:0.7});
    assert.equal(w.CONTINUUM.setAmbience, undefined, 'ya no hay música que activar');
    click(w,'[data-settings-action="open"]');
    assert.equal(w.document.querySelectorAll('.home-nav').length,1);
    assert.ok(w.document.querySelector('.settings-modal .home-nav'));
    assert.equal(w.document.querySelector('[data-settings-action="ambience"]'), null, 'Ajustes no ofrece música');
    assert.equal(w.document.querySelector('[data-settings-action="depth"]'), null, 'Ajustes ya no ofrece profundidad al mover el móvil');
    click(w,'[data-settings-action="close"]');
    assert.ok(w.document.querySelector('.shell > .home-nav'));
  } finally {w.close();}
}
console.log('Atlas: muestras, navegación, confirmación única, zoom, guardado, salida online y permisos opcionales: OK');
