import {gameHtml} from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read = name => fs.readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {runScripts:'outside-only', url:'https://continuum.test/'}).window;
w.scrollTo = () => {};
const calls = [];
w.Capacitor = {isNativePlatform:()=>true, registerPlugin:()=>({notification: async value=>calls.push(value.type), impact:async value=>calls.push(value.style)})};
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
try {
  const CT = w.CONTINUUM;
  CT.Effects.feedback(true); assert.equal(calls.length,0);
  CT.effectPrefs = () => ({haptics:true,sound:true});
  w.AudioContext = function () { throw Error('Audio no disponible'); };
  CT.Effects.feedback(true); CT.Effects.feedback(false);
  await Promise.resolve(); assert.deepEqual(calls,['SUCCESS','WARNING']);
  const confirm=w.document.createElement('button'); confirm.dataset.action='confirm-place'; w.document.body.append(confirm); confirm.click();
  await Promise.resolve(); assert.equal(calls.at(-1),'LIGHT');
  const outer=w.document.createElement('div'); outer.className='overlay'; outer.innerHTML='<div class="modal"><h2>Resultado</h2>'+CT.Art.button('history',CT.cards('history')[0])+'<button data-dialog-focus>Continuar</button></div>';
  w.document.getElementById('app').append(outer); CT.openDialog(outer);
  assert.equal(w.document.activeElement.textContent,'Continuar');
  const art=outer.querySelector('[data-art-src]'); art.focus(); art.click();
  assert.ok(w.document.querySelector('.art-modal img'));
  w.document.querySelector('[data-art-close]').click();
  assert.equal(w.document.activeElement,art);
  assert.ok(outer.isConnected);
  console.log('Efectos opcionales, fallo de audio y ampliación con retorno de foco: OK');
} finally { w.close(); }

// Los efectos se han retirado, no solo silenciado con una preferencia nueva.
// Un usuario que tenía sound:true tampoco debe crear contextos de audio.
for (const savedSound of [false, true]) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test/',pretendToBeVisual:true}).window;
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=()=>{};
  w.localStorage.setItem('hilo-ajustes-v1',JSON.stringify({sound:savedSound,ambience:false,haptics:true}));
  let contexts=0;
  w.AudioContext=w.webkitAudioContext=function(){contexts++;throw Error('No debe crearse audio de efectos');};
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))w.eval(read(m[1]));
  try {
    assert.equal(w.CONTINUUM.effectPrefs().sound,false,'las preferencias antiguas no reactivan efectos');
    for(const selector of ['[data-block="historia"]','[data-mode="history"]','[data-action="solo"]','[data-action="back-menu"]']) {
      w.document.querySelector('#app '+selector).click();
    }
    w.document.querySelector('[data-settings-action="open"]').click();
    assert.equal(w.document.querySelector('[data-settings-action="sound"]'),null,'no queda un interruptor sin función');
    assert.ok(w.document.querySelector('[data-settings-action="ambience"]'),'la música conserva su ajuste');
    assert.ok(w.document.querySelector('[data-settings-action="haptics"]'),'la vibración conserva su ajuste');
    // Ni siquiera otro módulo con preferencias antiguas puede hacerlos sonar.
    w.CONTINUUM.effectPrefs=()=>({sound:true,haptics:false,ambience:false});
    const effects=w.CONTINUUM.Effects;
    effects.feedback(true);effects.feedback(false);effects.tap();effects.stamp();effects.page();effects.page(true);
    for(const kind of ['page','back','unroll','expand','open','close','select','place','return','hover','flip','deal','turn','end','zoom','notice']) effects.transition(kind);
    await new Promise(resolve=>w.setTimeout(resolve,20));
    assert.equal(contexts,0,'todas las acciones y transiciones son silenciosas');
  } finally {w.close();}
}
console.log('Efectos retirados, preferencias antiguas y ajustes de ambiente/vibración: OK');

// Recorridos reales: los avisos internos conservan el cambio de estado, también con
// movimiento reducido. Repintar la misma pantalla o tocar lo ya elegido es silencio.
{
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test/',pretendToBeVisual:true}).window;
  w.scrollTo=()=>{}; w.matchMedia=()=>({matches:true}); w.Element.prototype.scrollIntoView=()=>{};
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  const cues=[];
  w.CONTINUUM.Effects={transition:kind=>cues.push(kind),page:back=>cues.push(back?'back':'page'),tap:()=>cues.push('tap'),feedback:correct=>cues.push(correct?'success':'failure')};
  const click=selector=>{const node=w.document.querySelector(selector);assert.ok(node,selector);cues.length=0;node.click();};
  const has=kind=>assert.ok(cues.includes(kind),`${kind}: ${cues.join(',')}`);
  try {
    click('#app [data-block="historia"]'); has('unroll');
    click('#app [data-block="historia"]'); has('close');
    click('#app [data-block="historia"]');
    click('#app [data-mode="history"]'); has('page');
    click('#app [data-format="multi"]'); has('expand');
    click('#app [data-format="multi"]'); has('close');
    click('#app [data-action="solo"]'); has('page');
    click('#app .solo-fold summary');
    click('#app [data-action="start-free"]'); has('page');
    click('#app .slot'); has('place');
    click('#app [data-action="cancel-place"]'); has('return');
    click('#app .hand-card'); assert.deepEqual(cues,[],'una carta que ya estaba elegida no repite el toque');
    click('#app [data-timeline-zoom="out"]'); has('zoom');
    click('#app .card-flippable'); has('flip');
    click('#app .atlas-menu'); has('open');
    cues.length=0;
    w.document.querySelector('.modal').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    has('close');
    click('#app [data-action="ui-back"]'); has('open');
    click('#app [data-exit-confirm]'); has('back');
    click('#app [data-action="back-menu"]');
    click('#app [data-action="perfil"]'); assert.deepEqual(cues,[],'cambiar de pestaña no añade rebote ni efecto sonoro');
    // Un repintado idéntico puede llegar del servidor: no significa otra transición.
    cues.length=0;
    const app=w.document.getElementById('app');
    w.CONTINUUM.paint(app,app.innerHTML,app.dataset.screen);
    assert.deepEqual(cues,[]);
    const dealt=w.document.createElement('div');app.append(dealt);
    w.CONTINUUM.dealIn([dealt]);has('deal');
    cues.length=0;
    w.CONTINUUM.paint(app,'<div class="shell"><h1>Fin</h1></div>','winner');has('end');
    cues.length=0;
    w.CONTINUUM.paint(app,'<div class="shell"><h1>Tu turno</h1></div>','pass');has('turn');
    w.CONTINUUM.paint(app,'<div class="shell"><article class="final-card">Carta neutral</article><form class="final-form"></form></div>','final-local');
    cues.length=0;
    w.CONTINUUM.paint(app,'<div class="shell"><article class="final-card">Carta neutral</article><section class="final-results">Resultado</section></div>','final-local');has('flip');
    cues.length=0;
    w.CONTINUUM.paint(app,app.innerHTML,'final-local');assert.deepEqual(cues,[],'las cifras ya reveladas no vuelven a sonar');
    console.log('Avisos internos de navegación, cartas, turnos y finales conservados: OK');
  } finally {w.close();}
}

// Disponibilidad real y prueba inmediata del ajuste (sin depender del sonido).
for (const platform of ['unsupported','web','native','native-missing','native-error']) {
  const dom=new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''),{runScripts:'outside-only',url:'https://continuum.test/'});
  const w=dom.window, pulses=[];
  w.scrollTo=()=>{};
  if(platform==='web')w.navigator.vibrate=value=>{pulses.push(value);return true;};
  if(platform.startsWith('native'))w.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>platform!=='native-missing',registerPlugin:()=>({impact:async()=>{if(platform==='native-error')throw Error('Unavailable');pulses.push('LIGHT');},notification:async()=>{}})};
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))w.eval(read(m[1]));
  try {
    w.document.querySelector('[data-settings-action="open"]').click();
    const toggle=w.document.querySelector('[data-settings-action="haptics"]');
    const supported=!['unsupported','native-missing'].includes(platform);
    assert.equal(toggle.disabled,!supported);
    if(!supported){assert.match(w.document.querySelector('#haptics-help').textContent,/no está disponible|no ofrece vibración/);continue;}
    toggle.checked=true;toggle.dispatchEvent(new w.Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(w.CONTINUUM.effectPrefs().sound,false,'vibración independiente del sonido');
    if(platform==='native-error'){assert.match(w.document.querySelector('#haptics-help').textContent,/No se pudo/);continue;}
    assert.equal(pulses.length,1,'activar produce una prueba inmediata');
    const test=w.document.querySelector('[data-settings-action="test-haptics"]');test.click();
    await new Promise(resolve=>setTimeout(resolve,0));assert.equal(pulses.length,2);
    toggle.checked=false;toggle.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.equal(test.disabled,true);await w.CONTINUUM.Effects.testHaptics();assert.equal(pulses.length,2,'apagar detiene también las pruebas');
  } finally {w.close();}
}
console.log('Vibración: prueba inmediata, independencia del sonido, navegador no compatible y errores nativos: OK');
