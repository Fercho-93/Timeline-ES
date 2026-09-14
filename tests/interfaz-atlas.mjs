import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read = f => fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html = read('index.html');
function boot() {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test',pretendToBeVisual:true}).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.matchMedia = () => ({matches:true});
  for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(match[1]));
  return w;
}
const click = (w,s) => {const el=w.document.querySelector(s);assert.ok(el,s);el.click();};
const screen = w => w.document.querySelector('#app').dataset.screen;
{
  const w=boot();
  try {
    click(w,'[data-block="naturaleza"]');click(w,'[data-mode="animals"]');
    assert.equal(w.document.querySelectorAll('.atlas-specimens figure').length,3);
    assert.equal(w.document.querySelectorAll('.home-nav button').length,5);
    assert.ok(w.document.querySelector('.home-nav [data-action="rules"]'));
    assert.equal(w.document.querySelector('.topbar [data-action="rules"]'),null);
    click(w,'[data-format="multi"]');click(w,'[data-action="setup"]');
    w.document.querySelector('#hand-size').value='4';click(w,'[data-action="start"]');click(w,'[data-action="ready"]');
    assert.equal(w.document.querySelectorAll('.hand-card').length,4);
    assert.equal(w.document.querySelector('.home-nav'),null);
    assert.equal(w.document.querySelectorAll('.topbar button').length,2);
    click(w,'.hand-card');click(w,'.slot');
    const selected=w.document.querySelector('.hand-card.selected').dataset.id;
    assert.equal(w.document.querySelectorAll('[data-action="confirm-place"]').length,1);
    assert.ok(w.document.querySelector('.placement-dock [data-action="confirm-place"]'));
    assert.equal(w.document.querySelector('.slot-confirm button'),null);
    const zoom=w.document.querySelector('[data-timeline-range]');zoom.value='0';zoom.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(w.document.querySelector('.timeline-zoom output').textContent,'50%');
    assert.equal(w.document.querySelector('.hand-card.selected').dataset.id,selected);
    const saved=w.localStorage.getItem('hilo-game-animals-v1');
    click(w,'[data-action="ui-back"]');assert.ok(w.document.querySelector('[data-exit-dialog]'));
    click(w,'[data-exit-stay]');assert.equal(screen(w),'game');assert.equal(w.localStorage.getItem('hilo-game-animals-v1'),saved);
    click(w,'[data-action="ui-back"]');click(w,'[data-exit-confirm]');assert.equal(screen(w),'setup');
    assert.ok(w.localStorage.getItem('hilo-game-animals-v1'));
    click(w,'[data-action="back-menu"]');click(w,'[data-action="continue"]');click(w,'[data-action="ready"]');
    assert.equal(w.document.querySelectorAll('.hand-card').length,4);
  } finally {w.close();}
}
{
  const w=boot();
  try {
    // Real online rendering with an inert SDK: no server calls are made by UI navigation.
    w.eval(`(() => {
      const initializeApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({});
      ${read('online.js').replace(/^import .*;$/gm,'').replace('export async function','async function')}
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
    assert.equal(w.document.querySelectorAll('.home-nav button').length,5);
    click(w,'.home-nav [data-action="home-top"]');assert.equal(screen(w),'home');
  } finally {w.close();}
}
{
  const w=boot();
  try {
    assert.deepEqual(JSON.parse(JSON.stringify(w.CONTINUUM.effectPrefs())),{sound:false,haptics:false,ambience:false,depth:false});
    click(w,'[data-settings-action="open"]');
    assert.equal(w.document.querySelectorAll('.home-nav').length,1);
    assert.ok(w.document.querySelector('.settings-modal .home-nav'));
    w.DeviceOrientationEvent={requestPermission:async()=> 'denied'};
    const depth=w.document.querySelector('[data-settings-action="depth"]');depth.checked=true;depth.dispatchEvent(new w.Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(w.CONTINUUM.effectPrefs().depth,false);assert.equal(depth.checked,false);
    click(w,'[data-settings-action="close"]');
    assert.ok(w.document.querySelector('.shell > .home-nav'));
  } finally {w.close();}
}
console.log('Atlas: muestras, navegación, confirmación única, zoom, guardado, salida online y permisos opcionales: OK');
