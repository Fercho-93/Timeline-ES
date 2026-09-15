import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const w = new JSDOM('<div id="app" data-screen="home"></div>',{runScripts:'outside-only',pretendToBeVisual:true}).window;
const sources=[];
let enabled=false, resolveFetch, requests=0, decodes=0;
const buffer={duration:64};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
class AudioMock {
  state='running'; currentTime=0; destination={};
  async decodeAudioData(){decodes++;return buffer;}
  createBufferSource(){const s={...node(),start(){this.started=true},stop(){this.stopped=true;this.onended?.()}};sources.push(s);return s;}
  createGain(){return {...node(),gain:{setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}}};}
}
w.fetch=url=>{assert.equal(url,'assets/audio/entre-paginas.mp3');requests++;return new Promise(resolve=>{resolveFetch=resolve;});};
w.AudioContext=AudioMock; w.matchMedia=()=>({matches:false,addEventListener(){}});
w.CONTINUUM={effectPrefs:()=>({ambience:enabled,depth:false,sound:false})};
w.eval(fs.readFileSync(new URL('../immersion.js',import.meta.url),'utf8'));
const update=()=>w.CONTINUUM.UI.updateEffects();
const hidden=value=>{Object.defineProperty(w.document,'hidden',{configurable:true,value});w.document.dispatchEvent(new w.Event('visibilitychange'));};
try {
  update();assert.equal(requests,0,'no descarga ni suena por defecto');
  enabled=true;update();update();assert.equal(requests,1,'carga única');
  enabled=false;update();
  resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await settle();
  assert.equal(sources.length,0,'apagar durante la descarga impide el arranque tardío');
  enabled=true;update();await settle();assert.equal(sources.length,1);assert.ok(sources[0].loop&&sources[0].started);
  update();await settle();assert.equal(sources.length,1,'no duplica la música');
  hidden(true);assert.ok(sources[0].stopped&&sources[0].disconnected);
  hidden(false);await settle();assert.equal(sources.length,2);
  w.dispatchEvent(new w.Event('pagehide'));assert.ok(sources[1].stopped);
  update();await settle();assert.equal(sources.length,2,'no reinicia fuera de la página');
  w.dispatchEvent(new w.Event('pageshow'));await settle();assert.equal(sources.length,3);
  assert.equal(decodes,1);assert.equal(requests,1,'reutiliza descarga y decodificación');
  enabled=false;update();assert.ok(sources[2].stopped);
  // Race between a cached start and a hide must never leave audio playing.
  enabled=true;update();hidden(true);await settle();assert.equal(sources.length,3);
  const track=fs.readFileSync(new URL('../assets/audio/entre-paginas.mp3',import.meta.url));
  assert.ok(track.length>100000&&track.length<1200000);
  const sw=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
  assert.ok(sw.includes('"./assets/audio/entre-paginas.mp3"'),'audio disponible sin conexión tras instalar caché');
  console.log('Guitarra: carga única, activación opcional, cancelación pendiente, bucle y ciclo de página: OK');
} finally {w.close();}
// A failed download can be retried on the next interaction, without an unhandled rejection.
const retry = new JSDOM('<div id="app"></div>',{runScripts:'outside-only',pretendToBeVisual:true}).window;
try {
  let attempts=0;
  retry.AudioContext=AudioMock;retry.matchMedia=w.matchMedia;
  retry.CONTINUUM={effectPrefs:()=>({ambience:true})};
  retry.fetch=async()=>({ok:++attempts>1,arrayBuffer:async()=>new ArrayBuffer(8)});
  retry.eval(fs.readFileSync(new URL('../immersion.js',import.meta.url),'utf8'));
  retry.CONTINUUM.UI.updateEffects();await settle();
  retry.CONTINUUM.UI.updateEffects();await settle();assert.equal(attempts,2);
  assert.ok(sources.at(-1).started);retry.dispatchEvent(new retry.Event('pagehide'));
  console.log('Guitarra: reintento después de fallo de red: OK');
} finally {retry.close();}
