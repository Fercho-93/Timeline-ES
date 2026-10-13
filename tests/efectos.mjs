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

// La antigua preferencia sound:true no reactiva nada: los efectos de sonido dependen solo
// de su propio ajuste (sfx). Con él apagado, ninguna acción crea un contexto de audio.
for (const savedSound of [false, true]) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test/',pretendToBeVisual:true}).window;
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=()=>{};
  w.localStorage.setItem('hilo-ajustes-v1',JSON.stringify({sound:savedSound,sfx:false,ambience:false,haptics:true}));
  let contexts=0;
  w.AudioContext=w.webkitAudioContext=function(){contexts++;throw Error('No debe crearse audio de efectos');};
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))w.eval(read(m[1]));
  try {
    assert.equal(w.CONTINUUM.effectPrefs().sound,false,'las preferencias antiguas no reactivan efectos');
    assert.equal(w.CONTINUUM.effectPrefs().sfx,false,'el ajuste propio de los efectos manda');
    w.CONTINUUM.ModeHubs.open('hub-solo');w.document.querySelector('[data-inline-route]').click();w.sessionStorage.removeItem('continuum-entry-route');
    for(const selector of ['[data-block="historia"]','[data-mode="history"]','[data-action="back-menu"]']) {
      w.document.querySelector('#app '+selector).click();
    }
    w.document.querySelector('[data-settings-action="open"]').click();
    assert.equal(w.document.querySelector('[data-settings-action="sound"]'),null,'no queda un interruptor sin función');
    assert.ok(w.document.querySelector('[data-settings-action="ambience"]'),'la música conserva su ajuste');
    assert.equal(w.document.querySelector('[data-settings-action="sfx"]').checked,false,'los efectos tienen su interruptor, aquí apagado');
    assert.ok(w.document.querySelector('[data-settings-action="haptics"]'),'la vibración conserva su ajuste');
    // Los créditos de la música se leen dentro del juego y se cierran sin salir de Ajustes.
    assert.equal(w.document.querySelector('a[href*="CREDITS.md"]'),null,'los créditos no abren un archivo de texto');
    w.document.querySelector('[data-settings-action="music-credits"]').click();
    assert.match(w.document.querySelector('[data-overlay="music-credits"]')?.textContent||'',/Música original de Continuum/);
    w.document.querySelector('[data-overlay="music-credits"] [data-settings-action="close"]').click();
    assert.ok(w.document.querySelector('[data-overlay="settings"]'),'cerrar los créditos deja Ajustes abierto');
    // Ni siquiera otro módulo con preferencias antiguas puede hacerlos sonar.
    w.CONTINUUM.effectPrefs=()=>({sound:true,haptics:false,ambience:false});
    const effects=w.CONTINUUM.Effects;
    effects.feedback(true);effects.feedback(false);effects.tap();effects.stamp();effects.page();effects.page(true);
    for(const kind of ['page','back','unroll','expand','open','close','select','place','return','hover','flip','deal','turn','end','zoom','notice']) effects.transition(kind);
    await new Promise(resolve=>w.setTimeout(resolve,20));
    assert.equal(contexts,0,'todas las acciones y transiciones son silenciosas');
  } finally {w.close();}
}
console.log('Efectos apagados, preferencias antiguas y ajustes de ambiente/vibración: OK');

// Efectos de sonido encendidos (lo que trae una instalación nueva): cada momento de la
// jugada suena, el volumen sigue al ajuste, y apagarlos los calla sin tocar la música.
{
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test/',pretendToBeVisual:true}).window;
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=()=>{};
  let contexts=0, notas=0, master=null;
  // El tono fundamental de cada sonido (la primera voz de cada nota), para comprobar la altura.
  const graves=[];
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
  const nodo=extra=>({connect(){},disconnect(){},...extra});
  w.AudioContext=function(){
    contexts++;
    Object.assign(this,{state:'running',currentTime:0,sampleRate:8000,destination:nodo(),
      resume:async()=>{},suspend:async()=>{},
      createGain:()=>{const g=nodo({gain:param()});master??=g;return g;},
      createDynamicsCompressor:()=>nodo({threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()}),
      createBiquadFilter:()=>nodo({frequency:param(),Q:param()}),
      createConvolver:()=>nodo(),
      createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),
      createOscillator:()=>{let v=0;return nodo({frequency:{...param(),get value(){return v;},set value(x){v=x;graves.push(x);}},start(){notas++;},stop(){}});},
      createBufferSource:()=>nodo({start(){},stop(){}})});
  };
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))w.eval(read(m[1]));
  try {
    const CT=w.CONTINUUM;
    assert.equal(CT.effectPrefs().sfx,true,'los efectos vienen encendidos');
    assert.equal(contexts,0,'cargar el juego no crea audio');
    CT.Effects.transition('lift');assert.equal(contexts,1);assert.ok(notas>0,'coger una carta suena');
    for(const [paso,accion] of [['hueco',()=>CT.Effects.transition('hover',{index:2,total:5})],['acierto',()=>CT.Effects.feedback(true)],['fallo',()=>CT.Effects.feedback(false)],['lámina',()=>CT.Effects.discovery()],['logro',()=>CT.Effects.achievement()],['reloj',()=>CT.Effects.clock(2)],['fin',()=>CT.Effects.transition('end')],['plantarse',()=>CT.Effects.bank()],['poder',()=>CT.Effects.power()],['turno',()=>CT.Effects.transition('turn')],['atrás',()=>CT.Effects.transition('back')],['desplegar',()=>CT.Effects.transition('unroll')],['plegar',()=>CT.Effects.transition('fold')]]){
      const antes=notas;accion();assert.ok(notas>antes,`${paso} suena`);
    }
    assert.ok(Math.abs(master.gain.value-.8*.7*.7)<1e-9,'volumen por defecto, 70 %');
    // Los botones del menú suenan cada vez más agudos al ir avanzando, y volver atrás suena siempre igual
    // (el toque grave de Atlas) y solo en los botones de volver.
    {
      await new Promise(r=>w.setTimeout(r,11000));
      const host=w.document.createElement('div');host.id='menu-prueba';w.document.body.append(host);
      host.innerHTML='<button id="b1">Uno</button><button id="b2">Dos</button><button id="b3">Tres</button><button id="b4">Cuatro</button><button id="v1" class="icon-btn atlas-back" aria-label="Volver a la pantalla anterior">‹</button><button id="v2" aria-label="Volver">‹</button><button id="v3" data-action="ui-back">‹</button>';
      const toque=async id=>{graves.length=0;host.querySelector(id).click();await new Promise(r=>w.setTimeout(r,320));return graves[0];};
      const subida=[];
      for(const id of ['#b1','#b2','#b3','#b4'])subida.push(await toque(id));
      assert.ok(subida.every(Number.isFinite)&&subida.every((f,i)=>i===0||f>subida[i-1]*1.03),`cada botón suena más agudo que el anterior: ${subida.map(f=>Math.round(f))}`);
      const atras=[];
      for(const id of ['#v1','#v2','#v3'])atras.push(await toque(id));
      assert.ok(atras.every(f=>Math.abs(f-atras[0])<atras[0]*.01),`volver suena siempre igual: ${atras.map(f=>Math.round(f))}`);
      assert.ok(atras[0]<subida[0],'y es más grave que los toques de avanzar');
      // Una pantalla que cambia "hacia atrás" sin pulsar volver no usa el sonido de volver.
      await new Promise(r=>w.setTimeout(r,1700));
      graves.length=0;CT.Effects.transition('back');await new Promise(r=>w.setTimeout(r,50));
      assert.ok(graves.length>0&&Math.abs(graves[0]-atras[0])>atras[0]*.05,'solo los botones de volver usan el sonido de volver');
      host.remove();
    }
    // Ningún botón queda mudo: uno sin sonido propio suena con el toque de menú, y uno que ya provoca
    // su sonido no suena dos veces. Uno desactivado no suena.
    {
      await new Promise(r=>w.setTimeout(r,1000));
      const host=w.document.createElement('div');w.document.body.append(host);
      host.innerHTML='<button id="mudo">Un botón cualquiera</button><button id="off" disabled>Desactivado</button><span id="no">texto</span>';
      let antes=notas;host.querySelector('#mudo').click();
      assert.equal(notas,antes,'el toque espera por si hay un sonido propio');
      await new Promise(r=>w.setTimeout(r,150));
      assert.ok(notas>antes,'un botón sin sonido propio suena');
      const unToque=notas-antes;
      antes=notas;host.querySelector('#off').click();host.querySelector('#no').click();await new Promise(r=>w.setTimeout(r,150));
      assert.equal(notas,antes,'un botón desactivado o un texto no suenan');
      await new Promise(r=>w.setTimeout(r,250));
      host.querySelector('#mudo').addEventListener('click',()=>CT.Effects.transition('back'),{once:true});
      antes=notas;host.querySelector('#mudo').click();await new Promise(r=>w.setTimeout(r,150));
      const propio=notas-antes;
      await new Promise(r=>w.setTimeout(r,250));
      antes=notas;host.querySelector('#mudo').click();await new Promise(r=>w.setTimeout(r,150));
      assert.equal(propio,unToque,'si el botón ya provoca su sonido, no se añade el toque encima');
      host.remove();
    }
    w.document.querySelector('[data-settings-action="open"]').click();
    const volumen=w.document.querySelector('[data-settings-action="sfx-volume"]');
    volumen.value='100';volumen.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.ok(Math.abs(master.gain.value-.8)<1e-9,'el volumen sigue al ajuste y se oye una prueba');
    const toggle=w.document.querySelector('[data-settings-action="sfx"]');
    toggle.checked=false;toggle.dispatchEvent(new w.Event('change',{bubbles:true}));
    await new Promise(resolve=>w.setTimeout(resolve,0));
    assert.equal(CT.effectPrefs().sfx,false);assert.equal(CT.effectPrefs().ambience,false,'la música no cambia');
    const antes=notas;
    CT.Effects.feedback(true);CT.Effects.transition('lift');CT.Effects.transition('end');CT.Effects.clock(1);
    assert.equal(notas,antes,'apagados, nada suena');
    assert.equal(JSON.parse(w.localStorage.getItem('hilo-ajustes-v1')).sfx,false,'el ajuste se guarda');
    console.log('Efectos de sonido: encendidos por defecto, cada momento suena, volumen y apagado: OK');
  } finally {w.close();}
}

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
    w.CONTINUUM.ModeHubs.open('hub-solo');w.document.querySelector('[data-inline-route]').click();w.sessionStorage.removeItem('continuum-entry-route');
    click('#app [data-block="historia"]'); has('unroll');
    click('#app [data-block="historia"]'); has('fold');
    click('#app [data-block="historia"]');
    click('#app [data-mode="history"]'); has('page');
    click('#app [data-action="start-free"]'); has('page');
    click('#app .slot'); has('place');
    click('#app [data-action="cancel-place"]'); has('return');
    click('#app .hand-card'); assert.deepEqual(cues,[],'una carta que ya estaba elegida no repite el toque');
    click('#app [data-timeline-zoom="out"]'); has('zoom');
    // Tocar una carta de la línea abre su ficha (antes se giraba).
    click('#app .card-flippable'); assert.ok(cues.includes('flip') || cues.includes('open'), cues.join(',')); w.CONTINUUM.closeDialog?.();
    click('#app .atlas-menu'); has('open');
    cues.length=0;
    w.document.querySelector('.modal').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    has('close');
    click('#app [data-action="ui-back"]'); has('open');
    click('#app [data-exit-confirm]'); has('back');
    click('#app [data-action="back-menu"]');
    click('#app .home-nav [data-action="home-top"]'); assert.deepEqual(cues,[],'cambiar de pestaña no añade rebote ni efecto sonoro');
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
    // También acaban o avisan el duelo de cifras, la mesa por Wi-Fi y las finales numéricas en red.
    cues.length=0;w.CONTINUUM.paint(app,'<div class="shell"><h1>Duelo</h1></div>','cifras-end');has('end');
    cues.length=0;w.CONTINUUM.paint(app,'<div class="shell"><h1>Final</h1></div>','online-final');has('turn');
    cues.length=0;w.CONTINUUM.paint(app,'<div class="shell"><h1>Fin</h1></div>','local-final');has('end');
    cues.length=0;w.CONTINUUM.paint(app,'<div class="shell"><h1>Tu turno</h1></div>','pass');
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
    if(platform==='web'){
      // Los momentos que se notan en la mano: te toca, fin, levantar carta, plantarse, poder, tiempo
      // agotado y el resultado de quién empieza (una sola vez por sorteo). Los menús solo suenan.
      const E=w.CONTINUUM.Effects, n=pulses.length;
      E.transition('turn');E.transition('end');E.transition('lift');E.bank();E.power();E.clock(0);E.clock(2);
      E.starterResult('sala:7');E.starterResult('sala:7');E.transition('page');E.transition('open');
      assert.equal(JSON.stringify(pulses.slice(n)),JSON.stringify([28,28,18,28,28,[30,40,30],18,28]));
    }
    toggle.checked=false;toggle.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.equal(test.disabled,true);const encendida=pulses.length;await w.CONTINUUM.Effects.testHaptics();w.CONTINUUM.Effects.transition('turn');w.CONTINUUM.Effects.power();assert.equal(pulses.length,encendida,'apagar detiene también las pruebas y los avisos');
  } finally {w.close();}
}
console.log('Vibración: prueba inmediata, independencia del sonido, navegador no compatible y errores nativos: OK');
