// Vista de un turno activo: mide la maquetación del duelo que depende de una segunda cuenta.
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gameHtml} from './game-fixture.mjs';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=gameHtml(await fs.readFile(path.join(root,'index.html'),'utf8'));
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,f=path.resolve(root,'.'+p);
  if(!f.startsWith(root+path.sep)&&p!=='/')throw Error('path');res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(f)]||'text/html'});res.end(p==='/'?html:await fs.readFile(f));
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const errors=[];
await fs.mkdir(path.join(root,'test-results/zoom'),{recursive:true});
try{
 for(const [name,engine] of [['webkit',webkit],['chromium',chromium]]){
  const browser=await engine.launch();
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
      app.innerHTML=`<div class="shell turn-duel-shell"><nav class="turn-duel-nav"><button class="icon-btn">←</button><span>CONTINUUM <small>Duelo por turnos</small></span></nav>
        <section class="turn-duel-screen"><header class="turn-duel-heading"><div><div class="eyebrow">Ordenar las cartas</div><h1>Es tu turno</h1><p>Carta 2 de 10 · Contra Alejandro</p></div><div class="turn-duel-clock"><span><b>15</b><small>s</small></span></div></header>
        <div class="turn-duel-scores">${['Tú','Alejandro'].map(name=>`<div class="turn-duel-player"><span class="turn-duel-avatar">${name[0]}</span><span class="turn-duel-player-info"><strong>${name}</strong><small>Jugador</small></span><span class="turn-duel-score"><b>0</b><small>aciertos</small></span></div>`).join('')}</div>
        <aside class="turn-duel-last"><b>Última jugada</b><p>Tu rival acertó la posición de una carta histórica.</p><small>Marcador 0 · 0</small></aside>
        <section class="turn-duel-hand"><div class="hand-title"><h3>Tu carta</h3><small>Fecha oculta</small></div><div class="hand hand-solo"><div class="hand-card selected"><span class="hidden-date">Fecha oculta</span>${CT.cardBack('history')}<strong>Comienza la guerra de los Treinta Años</strong></div></div><p class="hint">Toca el hueco donde quieres colocar la carta.</p></section>
        <section class="turn-duel-board"><div class="hand-title"><h3>Línea temporal</h3><small>1 carta</small></div><div class="timeline-wrap"><div class="timeline"><button class="slot"><span>+</span></button><article class="timeline-card animal-timeline-card"><div class="card-visual">${CT.animalArt('history',card)}</div><div class="card-content"><h3>${CT.escapeHtml(card.title)}</h3><div class="year">${CT.formatValue('history',card)}</div></div></article><button class="slot"><span>+</span></button></div></div><p class="hint">Desliza la línea para ver todas las cartas.</p></section></section></div>`;
    });
    await page.waitForTimeout(100);
    const result=await page.evaluate(()=>({screen:document.documentElement.scrollHeight,available:visualViewport?.height||innerHeight,
      order:document.querySelector('.turn-duel-hand').getBoundingClientRect().top<document.querySelector('.turn-duel-board').getBoundingClientRect().top,
      horizontal:document.documentElement.scrollWidth>innerWidth+2}));
    console.log(name,width,result);
    if(result.screen>result.available+2||!result.order||result.horizontal)errors.push(`${name} ${width}: ${JSON.stringify(result)}`);
    await page.screenshot({path:path.join(root,`test-results/zoom/turn-duel-${name}-${width}.png`)});
    await page.close();
   }
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
