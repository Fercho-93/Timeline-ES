// Prueba de maquetación real: JSDOM no puede detectar que una imagen se encoge.
// Ejecutar con Playwright instalado; el workflow instala Chromium y WebKit.
import {chromium, webkit} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gameHtml} from './game-fixture.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const html=gameHtml(await fs.readFile(path.join(root,'index.html'),'utf8'));
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&pathname!=='/')throw Error('path');
    const body=pathname==='/'?html:await fs.readFile(file);
    const ext=path.extname(file),mime={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]||'text/html';
    res.writeHead(200,{'Content-Type':mime});res.end(body);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
await fs.mkdir('test-results/zoom',{recursive:true});
const records=[];
try {
 for(const [engine,type] of [['webkit',webkit],['chromium',chromium]]) {
  const browser=await type.launch();
  try {
   for(const [width,height] of [[375,667],[414,714],[390,844],[412,915]]) {
    const page=await browser.newPage({viewport:{width,height},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      localStorage.setItem('hilo-solo-history-v1',JSON.stringify({kind:'free',difficulty:'normal',mode:'history',day:new Date().toLocaleDateString('sv-SE'),deck:[1,2,3],timeline:[74],current:67,lives:3,hits:0,played:0,total:null,finished:false}));
    });
    await page.goto(url);
    await page.locator('[data-block="historia"]').click();
    await page.locator('[data-mode="history"]').click();
    await page.locator('[data-action="solo"]').click();
    await page.locator('.solo-fold').filter({has:page.locator('[data-action="resume-solo"]')}).locator('summary').click();
    await page.locator('[data-action="resume-solo"]').click();
    await page.locator('.timeline-card img').evaluate(img=>img.decode());
    const measure=()=>page.evaluate(()=>{
      const card=document.querySelector('.timeline-card'),img=card.querySelector('img'),panel=card.querySelector('.card-visual');
      const box=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top}};
      return {card:box(card),image:box(img),panel:box(panel),label:document.querySelector('.timeline-zoom output').textContent};
    });
    const base=await measure();
    for(const [index,scale] of [.8,1,1.2].entries()) {
      await page.locator('[data-timeline-range]').fill(String(index));
      const now=await measure();
      assert.equal(now.label,`${Math.round(scale*100)}%`);
      for(const part of ['card','image'])for(const axis of ['width','height']) {
        assert.ok(Math.abs(now[part][axis]/base[part][axis]-scale)<.015,`${engine} ${width} ${now.label} ${part}.${axis}: ${JSON.stringify({base,now})}`);
      }
      assert.ok(Math.abs(now.panel.width-now.image.width)<1,'la imagen llena el ancho del panel');
      assert.ok(Math.abs(now.panel.height-now.image.height)<1,'la imagen llena el alto del panel');
      assert.ok(now.image.width/now.card.width>.75,'la imagen no se convierte en una miniatura');
      records.push({engine,width,height,scale,...now});
      if(width===414)await page.screenshot({path:`test-results/zoom/${engine}-${Math.round(scale*100)}.png`,fullPage:true});
    }
    if (width === 414) {
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.locator('[data-action="solo-place"][data-index="1"]').click();
      await page.locator('[data-action="confirm-place"]').click();
      const preview=page.locator('.overlay.result-preview');
      await preview.waitFor({state:'visible',timeout:800});
      assert.equal(await page.locator('.modal').isVisible(),false,'el resultado no tapa la carta');
      const style=await preview.evaluate(el=>({background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter}));
      assert.equal(style.background,'rgba(0, 0, 0, 0)');
      assert.equal(style.blur,'none');
      await page.screenshot({path:`test-results/zoom/${engine}-acierto-tablero.png`});
      await page.locator('.modal').waitFor({state:'visible',timeout:2500});
      assert.equal(await page.locator('[data-action="solo-next"]').evaluate(el=>document.activeElement===el),true);
      await page.screenshot({path:`test-results/zoom/${engine}-acierto-resultado.png`});
      await page.locator('[data-action="solo-next"]').click();
      assert.equal(await page.locator('.shell').evaluate(el=>el.inert),true,'el tablero espera antes de repartir');
      const hiddenAI=page.locator('.timeline-card[style*="visibility: hidden"]');
      assert.ok(await hiddenAI.count()>0,'la carta de IA aún no aparece');
      await page.waitForTimeout(500);
      assert.ok(await hiddenAI.count()>0,'la espera dura más de medio segundo');
      await page.waitForFunction(()=>!document.querySelector('.shell').inert);
      await page.waitForTimeout(800);
      // Completar la partida permite revisar el abanico y la página de resultados reales.
      for(let turn=0;turn<8 && await page.locator('[data-action="solo-place"]').count();turn++) {
        const at=await page.evaluate(()=>{
          const cards=new Map(window.HISTORY_CARDS.map(c=>[c.id,c]));
          const board=[...document.querySelectorAll('.timeline .timeline-card')].map(el=>cards.get(Number(el.dataset.id)));
          const card=cards.get(Number(document.querySelector('.hand-card').dataset.id));
          return window.CONTINUUM.correctIndex('history',board,card);
        });
        await page.locator(`[data-action="solo-place"][data-index="${at}"]`).click();
        await page.locator('[data-action="confirm-place"]').click();
        await page.locator('.modal').waitFor({state:'visible'});
        await page.locator('[data-action="solo-next"]').click();
        if(await page.locator('.shell[inert]').count()) await page.waitForFunction(()=>!document.querySelector('.shell').inert);
      }
      await page.locator('.atlas-final-page').waitFor();
      assert.ok(await page.locator('.atlas-final-fan .timeline-card').count()>0);
      await page.waitForTimeout(1500);
      await page.screenshot({path:`test-results/zoom/${engine}-final-atlas.png`,fullPage:true});
      await page.close();
      continue;
    }
    // Cambiar orientación debe recalcular el espacio reservado sin recortar la tira.
    await page.setViewportSize({width:height,height:width});
    await page.waitForFunction(()=>{
      const frame=document.querySelector('.timeline-scale-frame').getBoundingClientRect();
      const line=document.querySelector('.timeline').getBoundingClientRect();
      return Math.abs(frame.height-line.height)<2;
    });
    await page.close();
   }
  } finally {await browser.close();}
 }
 console.log('OK: carta e imagen proporcionales en 24 combinaciones (WebKit/Chromium, 4 pantallas, 3 niveles).');
} finally {
 await fs.writeFile('test-results/zoom/measurements.json',JSON.stringify(records,null,2));
 server.close();
}
