// Recorre los formatos jugables y mide la mesa al 100 % en móviles de distinto tamaño.
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const {webkit, chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
import {gameHtml} from './game-fixture.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=gameHtml(await fs.readFile(path.join(root,'index.html'),'utf8'));
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&pathname!=='/')throw Error('path');
    const body=pathname==='/'?html:await fs.readFile(file);
    res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'text/html'});
    res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const destination=path.join(root,'test-results/zoom');
await fs.mkdir(destination,{recursive:true});
const records=[];
let browser;
try {
  for(const [engine,type] of [['webkit',webkit],['chromium',chromium]]) {
    if(process.env.BROWSER_ENGINE && process.env.BROWSER_ENGINE!==engine)continue;
    browser=await type.launch();
    for(const {width,height} of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:600,height:800}]) {
      for(const format of ['solo','local','competition','quick']) {
        const page=await browser.newPage({viewport:{width,height},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
        page.setDefaultTimeout(12000);
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        try {
          await page.addInitScript(()=>localStorage.setItem('continuum-splash-seen-v2','1'));
          await page.goto(url);await page.evaluate(()=>window.CONTINUUM_SPLASH?.finish());
          if(format==='quick') {
            await page.evaluate(()=>window.CONTINUUM.localNavigate('jugar'));
            await page.locator('[data-action="quick-challenges"]').click();
            await page.locator('[data-quick="free"]').click();
            await page.locator('[data-quick="start-free"]').click();
            await page.locator('[data-quick="ready"]').click();
          } else if(format==='competition') {
            await page.evaluate(()=>window.CONTINUUM.localNavigate('jugar'));
            await page.locator('[data-action="competition-menu"]').click();
            await page.locator('[data-action="start-competition"]').click();
            await page.locator('[data-action="comp-next-round"]').click();
          } else {
            await page.evaluate(()=>window.CONTINUUM.localNavigate('jugar'));
            await page.locator('[data-action="toggle-play-catalog"][data-section="collections"]').click();
            await page.locator('[data-block="historia"]').click();
            await page.locator('[data-mode="history"]').click();
            if(format==='solo') {
              await page.locator('[data-action="solo"]').click();
              await page.locator('[data-action="start-free"]').click();
            } else {
              await page.locator('[data-action="toggle-format-block"][data-format="multi"]').click();
              await page.locator('[data-action="setup"]').click();
              await page.locator('[data-action="start"]').click();
              for(const guess of ['1000','2000']) {
                await page.locator('#starter-guess-input').fill(guess);
                await page.locator('[data-action="starter-guess-submit"]').click();
              }
              await page.locator('[data-action="starter-start"]').click();
              await page.locator('[data-action="ready"]').click();
            }
          }
          await page.waitForTimeout(180);
          const data=await page.evaluate(()=>{
            const app=document.getElementById('app'),shell=app.querySelector(':scope > .shell');
            const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height)}};
            const hand=app.querySelector('.hand'),timeline=app.querySelector('.timeline-wrap');
            const handCard=hand?.querySelector('.hand-card'),label=handCard?.querySelector('strong'),emblem=handCard?.querySelector('.reverso-emblema');
            return {screen:app.dataset.screen,fit:app.dataset.boardFit||'',viewport:Math.round(visualViewport?.height||innerHeight),
              shellHeight:Math.round(shell?.scrollHeight||0),documentHeight:document.documentElement.scrollHeight,
              hand:box(hand),timeline:box(timeline),zoom:app.querySelector('.timeline-zoom output')?.textContent?.trim(),
              cards:hand?.querySelectorAll('.hand-card').length||0,fan:!!hand?.classList.contains('hand-fan'),
              order:hand&&timeline?box(hand).top<box(timeline).top:null,
              labelFits:label?label.scrollHeight<=label.clientHeight+1:null,
              emblemVisible:emblem&&hand?.classList.contains('hand-solo')?box(emblem).bottom<=box(label).top+2:null,
              horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2};
          });
          records.push({engine,width,height,format,...data,errors});
          if(data.screen!==(format==='quick'?'quick-game':format==='local'?'game':'solo') ||
            data.documentHeight>data.viewport+2 || data.horizontalOverflow || data.zoom!=='100%' ||
            !data.order || (data.cards>1&&!data.fan) || data.labelFits===false || data.emblemVisible===false)
            errors.push('La mesa no cumple las medidas o el orden de juego');
          if(width===320||width===390)await page.screenshot({path:path.join(destination,`board-${engine}-${format}-${width}.png`)});
        }catch(error){records.push({engine,width,height,format,error:String(error),errors});}
        finally{await fs.writeFile(path.join(destination,'board-fit.json'),JSON.stringify(records,null,2));await page.close();}
      }
    }
    await browser.close();browser=null;
  }
  const summary=records.map(r=>`${r.engine} ${r.width}×${r.height} ${r.format}: ${r.error||`${r.screen} ${r.fit} ${r.shellHeight}/${r.viewport} fan=${r.fan}`}`);
  console.log(summary.join('\n'));
  if(records.some(r=>r.error||r.errors?.length))process.exitCode=1;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
