import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

// JSDOM no pinta píxeles. Las medidas intrínsecas se simulan para comprobar
// escala, espacio de scroll, redimensionado, límites y conservación del DOM.
for (const screen of ['game','solo','online-game']) {
  const dom=new JSDOM('<main id="app"></main>',{runScripts:'outside-only'});
  const w=dom.window, app=w.document.getElementById('app');
  app.dataset.screen=screen;w.CONTINUUM={};
  let resize, observed;
  w.ResizeObserver=class {constructor(callback){resize=callback;} observe(el){observed=el;} disconnect(){observed=null;}};
  w.eval(fs.readFileSync(new URL('../mapa.js',import.meta.url),'utf8'));
  const paint=()=>{
    app.innerHTML=w.CONTINUUM.timelineMap('animals',[1,2])+'<div class="timeline-wrap"><div class="timeline"><article class="timeline-card"><div class="card-visual"><img src="animal.webp" alt="Animal"></div></article><article class="timeline-card ghost-card">Oculta</article></div></div><button class="hand-card selected">Carta elegida</button>';
    const timeline=app.querySelector('.timeline');
    Object.defineProperty(timeline,'offsetWidth',{configurable:true,get:()=>1200});
    Object.defineProperty(timeline,'offsetHeight',{configurable:true,get:()=>240});
    w.CONTINUUM.applyTimelineZoom(app);
    return timeline;
  };
  let timeline=paint();
  const image=app.querySelector('img'), selected=app.querySelector('.selected');
  for(const [index,scale] of [0.8,1,1.2,1.4].entries()) {
    const range=app.querySelector('input');range.value=index;range.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(app.querySelector('output').textContent,`${Math.round(scale*100)}%`);
    assert.equal(range.getAttribute('aria-valuetext'),`${Math.round(scale*100)} por ciento`);
    assert.equal(timeline.style.transform,`scale(${scale})`);
    assert.equal(parseFloat(timeline.parentElement.style.width),1200*scale);
    assert.equal(parseFloat(timeline.parentElement.style.height),240*scale);
    assert.equal(app.querySelector('img'),image,'la imagen sigue dentro de la misma tira escalada');
    assert.equal(app.querySelector('.selected'),selected,'no se pierde la selección');
    assert.equal(app.querySelector('.ghost-card').textContent,'Oculta');
  }
  assert.equal(app.querySelector('[data-timeline-zoom="in"]').disabled,true);
  Object.defineProperty(timeline,'offsetHeight',{get:()=>300});resize();
  assert.equal(parseFloat(timeline.parentElement.style.height),420,'un cambio de alto reserva espacio al 140%');
  for(let i=0;i<8;i++)app.querySelector('[data-timeline-zoom="out"]').click();
  assert.equal(app.querySelector('output').textContent,'80%');
  assert.equal(app.querySelector('[data-timeline-zoom="out"]').disabled,true);
  timeline=paint();assert.equal(observed,timeline,'tras repintar se observa la tira nueva');
  assert.equal(app.querySelector('output').textContent,'80%','el zoom persiste al repintar');
  w.CONTINUUM.applyTimelineZoom(app,true);
  assert.equal(app.querySelector('output').textContent,'100%');
  assert.equal(app.querySelectorAll('.timeline-scale-frame').length,1,'no se anidan escalas');
  dom.window.close();
}
console.log('Zoom: cuatro porcentajes, límites, dimensiones reservadas, resize, selección, Fantasma y repintado correctos en local, solitario y online.');
