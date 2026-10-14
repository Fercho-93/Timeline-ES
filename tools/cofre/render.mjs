// Herramienta opcional de autoría. No se ejecuta ni se distribuye dentro del juego.
// COFRE_TOOL_DEPS=/ruta/node_modules node tools/cofre/render.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(process.env.COFRE_TOOL_DEPS?path.resolve(process.env.COFRE_TOOL_DEPS,'package.json'):import.meta.url);
const {chromium}=require('playwright'),sharp=require('sharp');
const threeRoot=path.resolve(path.dirname(require.resolve('three')),'..');
const server=http.createServer((req,res)=>{
 const url=decodeURIComponent(req.url.split('?')[0]);
 const file=url.startsWith('/three/')?path.join(threeRoot,url.slice(7)):path.join(root,url);
 try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'image/webp');res.end(fs.readFileSync(file));}
 catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.COFRE_CHROMIUM_EXECUTABLE?{executablePath:process.env.COFRE_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:640,height:560},deviceScaleFactor:1});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/cofre/scene.html`);
 await page.waitForFunction(()=>window.chestReady,null,{timeout:60000});
 for(let sheet=0;sheet<8;sheet++) {
  const cells=[];
  for(let cell=0;cell<8;cell++) {
   await page.evaluate(t=>window.drawChest(t),(sheet*8+cell)/25);
   cells.push({input:await page.screenshot({omitBackground:true}),left:(cell%4)*640,top:Math.floor(cell/4)*560});
  }
  const info=await sharp({create:{width:2560,height:1120,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cells).webp({quality:83,alphaQuality:100,effort:6}).toFile(path.join(root,`assets/cofre-frames-v2-${sheet}.webp`));
  console.log(`Hoja ${sheet+1}/8: ${info.size} bytes`);
 }
} finally {await browser?.close();server.close();}
