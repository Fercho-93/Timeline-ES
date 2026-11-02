// Vista de un turno activo: mide la maquetación del duelo que depende de una segunda cuenta.
import { servirJuego, motores, opcionesLanzamiento } from './lib/navegador.mjs';
import { REPO as root } from './lib/comun.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
// ENGINES=chromium limita la prueba a Chromium donde no hay WebKit instalado (por defecto, los dos).
const server = await servirJuego();
const errors=[];
await fs.mkdir(path.join(root,'test-results/zoom'),{recursive:true});
try{
 for(const [name,engine] of motores()){
  const browser=await engine.launch(opcionesLanzamiento(name));
  try{
   for(const [width,height] of [[320,568],[375,667]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
    await page.addInitScript(()=>localStorage.setItem('continuum-splash-seen-v2','1'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(()=>{
      window.CONTINUUM_SPLASH?.finish();
      const CT=window.CONTINUUM,app=document.getElementById('app');
      const card=CT.cards('history').find(item=>CT.animalArt('history',item));
      app.className='';app.dataset.screen='turn-duel';
      // La misma cabecera que las demás mesas (duelo-turnos.js): barra, franja con la carta y las píldoras.
      app.innerHTML=`<div class="shell turn-duel-shell">${CT.UI.header('data-turn-action="back"','',true,'Duelo · Historia de España')}
        <h1 class="solo-lectores">Es tu turno, contra Alejandro</h1>
        <div class="game-head game-head-slim turn-duel-head"><div class="deck-count"><strong>2</strong><span>de 10</span></div><section class="scoreboard-panel"><div class="scoreboard">${['Tú','Alejandro'].map((name,i)=>`<span class="score ${i?'':'active'}"><i class="score-avatar">${name[0]}</i><span class="score-copy"><b>${name}</b></span><em><strong>0</strong><small>aciertos</small></em></span>`).join('')}</div></section></div>
        <section class="turn-duel-screen">
        <aside class="turn-duel-last"><b>Última jugada</b><p>Tu rival acertó la posición de una carta histórica.</p><small>Marcador 0 · 0</small></aside>
        <section class="turn-duel-hand"><div class="hand-title"><h3>Tu carta</h3></div><div class="hand hand-solo"><div class="hand-card selected"><span class="hidden-date">Fecha oculta</span>${CT.cardBack('history')}<strong>Comienza la guerra de los Treinta Años</strong></div></div></section>
        <section class="turn-duel-board"><div class="hand-title"><h3>Línea temporal</h3><small>1 carta</small></div><div class="timeline-wrap"><div class="timeline"><button class="slot"><span>+</span></button><article class="timeline-card animal-timeline-card"><div class="card-visual">${CT.animalArt('history',card)}</div><div class="card-content"><h3>${CT.escapeHtml(card.title)}</h3><div class="year">${CT.formatValue('history',card)}</div></div></article><button class="slot"><span>+</span></button></div></div></section></section></div>`;
    });
    await page.waitForTimeout(100);
    const result=await page.evaluate(()=>({screen:document.documentElement.scrollHeight,available:visualViewport?.height||innerHeight,
      order:document.querySelector('.turn-duel-hand').getBoundingClientRect().top<document.querySelector('.turn-duel-board').getBoundingClientRect().top,
      horizontal:document.documentElement.scrollWidth>innerWidth+2,
      marker:getComputedStyle(document.querySelector('.turn-duel-hand .hand-card'),'::before').display}));
    console.log(name,width,result);
    if(result.screen>result.available+2||!result.order||result.horizontal||result.marker!=='none')errors.push(`${name} ${width}: ${JSON.stringify(result)}`);
    await page.screenshot({path:path.join(root,`test-results/zoom/turn-duel-${name}-${width}.png`)});
    await page.close();
   }
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
