// La película aportada no puede bloquear Jugar si falla la descarga o el códec.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/media-src 'self' blob:/,'la política de medios permite reproducir el archivo descargado');
const source=fs.readFileSync(new URL('../splash.js',import.meta.url),'utf8');
function setup({failFetch=false,failPlay=false,delayed=false,reduced=false}={}) {
 const dom=new JSDOM('<div id="app-splash"></div><main id="app"></main>',{url:'https://cofre.test/',runScripts:'outside-only'}),w=dom.window;
 let now=0,id=0,plays=0,resolveFetch;const timers=new Map(),requests=[],revoked=[];
 w.setTimeout=(fn,delay=0)=>{const key=++id;timers.set(key,{at:now+delay,fn});return key;};w.clearTimeout=key=>timers.delete(key);
 w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(now),16);w.cancelAnimationFrame=w.clearTimeout;
 Object.defineProperty(w.performance,'now',{value:()=>now});w.matchMedia=()=>({matches:reduced});
 w.URL.createObjectURL=()=> 'blob:cofre-film';w.URL.revokeObjectURL=url=>revoked.push(url);
 const response={ok:true,blob:async()=>({type:'video/mp4'})};
 w.fetch=(url,options)=>{requests.push({url,options});return delayed?new Promise(resolve=>{resolveFetch=()=>resolve(response);}):failFetch?Promise.reject(new Error('offline')):Promise.resolve(response);};
 w.HTMLMediaElement.prototype.play=function(){plays++;return failPlay?Promise.reject(new Error('codec')):Promise.resolve();};
 w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 const advance=async ms=>{const target=now+ms;let iterations=0;while(true){const next=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++iterations>10000)throw Error('Timer loop');now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}now=target;await flush();};
 const open=()=>w.document.querySelector('.caja-abrir').click();
 return {dom,w,requests,revoked,advance,flush,open,get plays(){return plays;},resolve:()=>resolveFetch()};
}
{
 const h=setup();await h.flush();const v=h.w.document.querySelector('video');
 assert.equal(v.src,'blob:cofre-film');assert.equal(v.muted,true);assert.equal(v.playsInline,true);
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'assets/cofre-opening-v3.mp4');assert.equal(h.requests[0].options.headers,undefined,'descarga completa, sin Range');
 const gate=h.w.CONTINUUM_SPLASH.gate();h.open();h.open();await h.flush();assert.equal(h.plays,1,'solo una reproducción');
 await h.advance(4000);assert.ok(h.w.document.querySelector('.splash-caja-escena'),'no corta la película a los 4,2 s del modelo antiguo');
 v.dispatchEvent(new h.w.Event('ended'));await h.advance(500);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);assert.deepEqual(h.revoked,['blob:cofre-film']);
 h.w.document.getElementById('splash-play').click();await gate;assert.equal(h.w.localStorage.getItem('continuum-caja-abierta-v1'),'1');h.dom.window.close();
}
for(const options of [{failFetch:true},{failPlay:true}]){
 const h=setup(options);await h.flush();const gate=h.w.CONTINUUM_SPLASH.gate();h.open();await h.flush();
 assert.ok(h.w.document.querySelector('.cofre-sin-video'),'utiliza las láminas, sin recuperar el cofre antiguo');
 await h.advance(710);assert.match(h.w.document.querySelector('.cofre-fallback').src,/-open.webp$/);
 await h.advance(1200);assert.match(h.w.document.querySelector('.cofre-fallback').src,/-rise.webp$/);
 await h.advance(1300);assert.match(h.w.document.querySelector('.cofre-fallback').src,/-fan.webp$/);
 await h.advance(2000);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);
 h.w.document.getElementById('splash-play').click();await gate;h.dom.window.close();
}
{
 const h=setup({delayed:true});await h.flush();h.open();await h.flush();assert.equal(h.plays,0);h.resolve();await h.flush();assert.equal(h.plays,1,'el toque temprano espera al archivo');h.dom.window.close();
}
{
 const h=setup();await h.flush();h.open();await h.flush();h.w.document.querySelector('video').dispatchEvent(new h.w.Event('error'));await h.flush();assert.ok(h.w.document.querySelector('.cofre-sin-video'));await h.advance(5200);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);h.dom.window.close();
}
{
 const h=setup({delayed:true});await h.flush();h.open();h.w.CONTINUUM_SPLASH.entering();h.w.CONTINUUM_SPLASH.finish();await h.advance(1620);h.resolve();await h.flush();assert.equal(h.plays,0,'cerrar el telón cancela una carga pendiente');assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);h.dom.window.close();
}
{
 const h=setup();await h.flush();h.open();await h.flush();await h.advance(10500);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null,'un reproductor atascado tampoco bloquea la entrada');h.dom.window.close();
}
{
 const h=setup({reduced:true});await h.flush();assert.equal(h.requests.length,0);assert.equal(h.w.document.querySelector('.splash-caja-escena'),null);h.dom.window.close();
}
console.log('Cofre: vídeo, descarga completa, toque temprano, fin real, persistencia, códec, red, láminas, cancelación y movimiento reducido: OK');
