import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const w = new JSDOM('<div id="app" data-screen="home"></div>',{runScripts:'outside-only',pretendToBeVisual:true}).window;
const sources=[], buffers=[];
let enabled=false;
const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
class AudioMock {
  state='running'; currentTime=0; sampleRate=24000; destination={};
  createBuffer(channels,length,rate){const data=new Float32Array(length);const b={length,sampleRate:rate,getChannelData:()=>data};buffers.push(b);return b;}
  createBufferSource(){const s={...node(),start(){this.started=true},stop(){this.stopped=true;this.onended?.()}};sources.push(s);return s;}
  createGain(){return {...node(),gain:{setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}}};}
}
w.AudioContext=AudioMock; w.matchMedia=()=>({matches:false,addEventListener(){}});
w.CONTINUUM={effectPrefs:()=>({ambience:enabled,depth:false,sound:false})};
w.eval(fs.readFileSync(new URL('../immersion.js',import.meta.url),'utf8'));
try {
  w.CONTINUUM.UI.updateEffects();assert.equal(sources.length,0,'sin reproducción por defecto');
  enabled=true;w.CONTINUUM.UI.updateEffects();assert.equal(sources.length,1);assert.ok(sources[0].loop&&sources[0].started);
  const data=buffers[0].getChannelData(0);assert.ok(data.length/24000>26);
  let peak=0,energy=0;for(const v of data){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));energy+=v*v;}
  assert.ok(peak<=.601&&energy>1,'señal musical finita sin saturación');
  w.CONTINUUM.UI.updateEffects();assert.equal(sources.length,1,'no duplica la música');
  enabled=false;w.CONTINUUM.UI.updateEffects();assert.ok(sources[0].stopped&&sources[0].disconnected);
  enabled=true;w.CONTINUUM.UI.updateEffects();assert.equal(buffers.length,1,'reutiliza el bucle sin regenerarlo');
  Object.defineProperty(w.document,'hidden',{configurable:true,value:true});w.document.dispatchEvent(new w.Event('visibilitychange'));assert.ok(sources[1].stopped);
  Object.defineProperty(w.document,'hidden',{configurable:true,value:false});w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(sources.length,3);
  w.dispatchEvent(new w.Event('pagehide'));assert.ok(sources[2].stopped&&sources[2].disconnected);
  console.log('Guitarra: señal, activación opcional, bucle único, reutilización y limpieza al ocultar/salir: OK');
} finally {w.close();}
