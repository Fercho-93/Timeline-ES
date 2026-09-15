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

// Render de las texturas en memoria y contrato del reproductor: volumen limitado,
// liberación de voces y respeto del interruptor incluso durante resume().
{
  const w = new JSDOM('<main id="app"></main>', {runScripts:'outside-only',pretendToBeVisual:true}).window;
  let enabled = false, time = 0, created = 0, resume;
  const sources = [], gains = [], buffers = [];
  w.performance.now = () => time;
  w.CONTINUUM = {effectPrefs:()=>({sound:enabled,haptics:false})};
  class Audio {
    state = 'running'; sampleRate = 24000; currentTime = 0; destination = {};
    constructor() { created++; }
    createBuffer(channels, length) {
      const data = new Float32Array(length);
      const buffer = {getChannelData:()=>data}; buffers.push(data); return buffer;
    }
    createBufferSource() {
      const source = {connect(){},disconnect(){this.disconnected=true;},start(at){this.at=at;}};
      sources.push(source); return source;
    }
    createGain() { const gain={gain:{value:0},connect(){},disconnect(){this.disconnected=true;}}; gains.push(gain); return gain; }
    resume() { return new Promise(resolve=>{resume=resolve;}); }
  }
  w.AudioContext = Audio;
  w.eval(read('effects.js'));
  try {
    const effects = w.CONTINUUM.Effects;
    effects.feedback(true); effects.page(); effects.tap();
    assert.equal(created,0,'silenciado no crea un contexto');
    enabled=true;
    effects.feedback(true); effects.feedback(true);
    assert.equal(sources.length,2,'repetir el mismo aviso no acumula notas');
    assert.equal(sources[1].at,.13,'el acierto es una respuesta doble breve');
    effects.feedback(false); effects.page(); effects.tap();
    assert.equal(sources.length,5,'la navegación queda pendiente, no se superpone al resultado');
    time=100; effects.feedback(true);
    assert.equal(sources.length,6,'el número de voces simultáneas está limitado');
    assert.equal(buffers.length,4,'las texturas se reutilizan');
    assert.notDeepEqual(sources[0].buffer.getChannelData(0),sources[2].buffer.getChannelData(0),'acierto y fallo son distinguibles');
    for(const samples of buffers) {
      assert.ok(samples.every(Number.isFinite));
      assert.ok(Math.max(...samples.map(Math.abs))<.4,'sin picos fuertes');
      assert.equal(samples[0],0,'ataque sin clic inicial');
      assert.ok(Math.abs(samples.at(-1))<.001,'final amortiguado');
    }
    sources.forEach(source=>source.onended());
    assert.ok(sources.every(source=>source.disconnected) && gains.every(gain=>gain.disconnected),'se liberan los nodos');
    time=300;
    effects.transition('close'); effects.transition('open'); effects.page();
    assert.equal(sources.length,6,'las transiciones esperan al desenlace de la acción');
    await new Promise(resolve=>w.setTimeout(resolve,5));
    assert.equal(sources.length,7,'cerrar, abrir y navegar generan una sola respuesta de página');
    sources.at(-1).onended();
    time=500;
    effects.transition('open'); effects.feedback(true);
    await new Promise(resolve=>w.setTimeout(resolve,5));
    assert.equal(sources.length,9,'el resultado sustituye al sonido de apertura del diálogo');
    sources.slice(-2).forEach(source=>source.onended());
    time=700;
    effects.transition('page'); enabled=false;
    await new Promise(resolve=>w.setTimeout(resolve,5));
    assert.equal(sources.length,9,'silenciar cancela también la transición pendiente');
    effects.feedback(false);
    assert.equal(sources.length,9,'silenciar impide nuevos sonidos');
    enabled=true; time=900;
    const details=w.document.createElement('details');details.className='solo-fold';details.innerHTML='<summary>Partida libre</summary>';
    w.document.body.append(details);details.firstElementChild.click();
    await new Promise(resolve=>w.setTimeout(resolve,5));
    assert.equal(sources.length,10,'el despliegue nativo también tiene respuesta sonora');
    sources.at(-1).onended();time=1100;details.firstElementChild.click();
    await new Promise(resolve=>w.setTimeout(resolve,5));
    assert.equal(sources.length,11,'plegar produce una sola respuesta');
  } finally { w.close(); }
}
{
  const w = new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}).window;
  let enabled=true, unlock, played=false;
  w.CONTINUUM={effectPrefs:()=>({sound:enabled})};
  w.AudioContext=function(){return {state:'suspended',resume:()=>new Promise(resolve=>{unlock=resolve;}),createBufferSource(){played=true;}};};
  w.eval(read('effects.js'));
  try {
    w.CONTINUUM.Effects.feedback(true);
    enabled=false; unlock(); await Promise.resolve(); await Promise.resolve();
    assert.equal(played,false,'silenciar mientras se desbloquea el audio cancela el sonido pendiente');
  } finally {w.close();}
}
console.log('Texturas de papel y madera, silencio, volumen y liberación de voces: OK');

// Todos los módulos cargados: protege contra volver a registrar otro reproductor
// genérico de clics además del que responde a las transiciones.
{
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test/',pretendToBeVisual:true}).window;
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=()=>{};
  const starts=[];
  const param=()=>({value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  w.AudioContext=function(){return {
    state:'running',sampleRate:8000,currentTime:0,destination:{},
    createBuffer(_channels,length){return {duration:length/8000,getChannelData:()=>new Float32Array(length)};},
    createGain(){return {gain:param(),connect(){},disconnect(){}};},
    createBiquadFilter(){return {frequency:param(),connect(){},disconnect(){}};},
    createBufferSource(){return {playbackRate:param(),connect(){},disconnect(){},stop(){},start(){starts.push({duration:this.buffer.duration,rate:this.playbackRate.value});w.queueMicrotask(()=>this.onended?.());}};}
  };};
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))w.eval(read(m[1]));
  w.CONTINUUM.effectPrefs=()=>({sound:true});
  try {
    for(const [selector,rate] of [['[data-block="historia"]',1],['[data-mode="history"]',.85],['[data-action="solo"]',.85],['[data-action="back-menu"]',.7]]) {
      starts.length=0;w.document.querySelector('#app '+selector).click();
      await new Promise(resolve=>w.setTimeout(resolve,100));
      assert.equal(starts.length,1,`${selector}: solo su transición, sin otro sonido genérico de clic`);
      assert.equal(starts[0].rate,rate,'el regreso conserva su sentido sonoro');
    }
  } finally {w.close();}
}

// Recorridos reales: el sonido pertenece al cambio de estado, también con
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
    click('#app [data-action="perfil"]'); has('unroll');
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
    console.log('Navegación, colecciones, diálogos, cartas, zoom, turnos y finales con sonido: OK');
  } finally {w.close();}
}
