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
    assert.equal(sources.length,6);
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
    enabled=false; time=200; effects.feedback(false);
    assert.equal(sources.length,6,'silenciar impide nuevos sonidos');
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
