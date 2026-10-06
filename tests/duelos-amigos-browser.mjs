import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {gameHtml} from './game-fixture.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=fileURLToPath(new URL('..',import.meta.url)),html=gameHtml(await fs.readFile(path.join(root,'index.html'),'utf8'));
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+pathname);if(!file.startsWith(path.resolve(root)+'/')&&pathname!=='/')throw Error('path');const body=pathname==='/'?html:await fs.readFile(file);res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'text/html');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 await fs.mkdir('test-results/duelos-amigos',{recursive:true});
 for(const width of [360,393]){
  const page=await browser.newPage({viewport:{width,height:852},reducedMotion:'reduce'});
  await page.route('https://**/*',route=>route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{
   window.CONTINUUM_SPLASH?.finish();
   const CT=window.CONTINUUM,R=CT.QuickRoom,E=CT.QuickEngine;
   const rounds=[{id:'albums-sales',order:E.challenge('albums-sales').cards.map(c=>c.id)}];
   const room=R.reduce(R.create('me','Fer',2),'me',{type:'start',rounds,kind:'duel',keep:true});
   CT.QuickNetwork.internet=async opts=>{opts.onChange(room,'me','ABCDEFGH23');return {kind:'internet',code:'ABCDEFGH23',close(){},act:async()=>{}};};
   await CT.Quick.openRoom((markup,playing)=>CT.paint(document.getElementById('app'),markup,playing?'quick-game':'quick-challenges'),'ABCDEFGH23',()=>{});
  });
  await page.locator('.hand-card .quick-card-artist').first().waitFor();
  // Todas las cartas del reto menos la que abre la línea, sea cual sea el tamaño del mazo.
  assert.equal(await page.locator('.hand-card .quick-card-artist').count(),await page.evaluate(()=>CONTINUUM.QuickEngine.challenge('albums-sales').cards.length-1));
  assert.equal(await page.locator('.timeline-card .quick-card-artist').innerText(),'Led Zeppelin');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  const bounds=await page.locator('.fan-center strong').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
  assert.ok(bounds.scroll<=bounds.client+1,'Artist is not vertically clipped');
  await page.screenshot({path:`test-results/duelos-amigos/discos-${width}.png`,fullPage:true});
  await page.locator('[data-quick="menu"]').click();
  assert.equal(await page.getByRole('button',{name:'Salir del duelo',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Salir sin guardar',exact:true}).count(),0);
  await page.close();
 }
 console.log('OK: album artists and online exit at 360/393px, no horizontal overflow or artist clipping.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
