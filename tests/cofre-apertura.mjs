// La secuencia no puede bloquear la entrada si falta una hoja o se cierra el telón.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync(new URL('../splash.js',import.meta.url),'utf8');
function setup({failImages=false}={}) {
 const dom=new JSDOM('<div id="app-splash"></div><main id="app"></main>',{url:'https://cofre.test/',runScripts:'outside-only'}),w=dom.window;
 let now=0,id=0;const timers=new Map(),draws=[];
 w.setTimeout=(fn,delay=0)=>{const key=++id;timers.set(key,{at:now+delay,fn});return key;};w.clearTimeout=key=>timers.delete(key);
 w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(now),16);w.cancelAnimationFrame=w.clearTimeout;
 Object.defineProperty(w.performance,'now',{value:()=>now});
 w.matchMedia=()=>({matches:false});
 w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},drawImage(...args){draws.push(args);}});
 w.Image=class {set src(value){this.url=value;Promise.resolve().then(()=>failImages?this.onerror():this.onload());}};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 const advance=async ms=>{const target=now+ms;let iterations=0;while(true){const next=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++iterations>10000)throw Error('Timer loop');now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}now=target;await flush();};
 const open=()=>w.document.querySelector('.caja').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 return {dom,w,draws,advance,flush,open};
}
{
 const h=setup();await h.flush();
 assert.ok(h.w.document.querySelector('.cofre-cine-listo canvas'),'se monta el fotograma cerrado');
 assert.equal(h.draws[0][1],0,'primer fotograma, primera celda');
 const gate=h.w.CONTINUUM_SPLASH.gate();h.open();await h.advance(300);
 assert.equal(h.w.document.querySelector('.splash-caja-escena').dataset.cofreFase,'cierre');
 await h.advance(700);assert.equal(h.w.document.querySelector('.splash-caja-escena').dataset.cofreFase,'tapa');
 await h.advance(1100);assert.equal(h.w.document.querySelector('.splash-caja-escena').dataset.cofreFase,'abierto');
 await h.advance(2600);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);
 assert.ok(h.draws.some(a=>a[0].url.endsWith('-7.webp')),'se llega a la última hoja');
 assert.equal(new Set(h.draws.map(a=>`${a[0].url}:${a[1]}:${a[2]}`)).size,64,'se recorren los 64 fotogramas');
 h.w.document.getElementById('splash-play').click();await gate;
 assert.equal(h.w.localStorage.getItem('continuum-caja-abierta-v1'),'1');
 h.dom.window.close();
}
{
 const h=setup({failImages:true});await h.flush();
 assert.ok(!h.w.document.querySelector('.cofre-cine-listo'),'hojas fallidas: alternativa CSS');
 const gate=h.w.CONTINUUM_SPLASH.gate();h.open();await h.advance(4700);
 h.w.document.getElementById('splash-play').click();await gate;
 h.dom.window.close();
}
{
 const h=setup();h.open();await h.flush();
 assert.ok(!h.w.document.querySelector('.cofre-cine-listo'),'toque inmediato: no cambia de modelo a mitad de apertura');
 await h.advance(4700);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);h.dom.window.close();
}
{
 const h=setup();await h.flush();h.open();await h.advance(200);
 h.w.CONTINUUM_SPLASH.entering();h.w.CONTINUUM_SPLASH.finish();await h.advance(1620);
 const last=h.draws.length;await h.advance(6000);assert.equal(h.draws.length,last,'cancelar la escena detiene el render');h.dom.window.close();
}
console.log('Cofre: fotogramas, fases, teclado, entrada, persistencia, carga fallida, toque temprano y cancelación: OK');
