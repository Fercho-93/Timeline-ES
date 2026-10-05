// Recorre las puertas de Inicio hasta la mesa jugable o la sala que espera a otro móvil.
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gameHtml} from './game-fixture.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=gameHtml(await fs.readFile(path.join(root,'index.html'),'utf8'));
const server=createServer(async(req,res)=>{
  try {const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)&&name!=='/')throw Error('path');
    const body=name==='/'?html:await fs.readFile(file);
    res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(file)]||'text/html'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
const findings=[];
const scenarios={
  collections:async({click,deck})=>{await click('[data-action="solo-hub"]');await click('[data-solo-route="collections"]');await deck();await click('[data-action="start-free"]');},
  mixed:async({click})=>{await click('[data-action="solo-hub"]');await click('[data-solo-route="collections"]');await click('[data-block="mezcla"]');await click('[data-mode="mixed"]');await click('[data-action="start-free"]');},
  quick:async({click})=>{await click('[data-action="solo-hub"]');await click('[data-solo-route="quick"]');await click('[data-quick="start-free"]');await click('[data-quick="ready"]');},
  local:async({click,deck})=>{await click('[data-action="friends-hub"]');await click('[data-action="local-hub"]');await click('[data-inline-route="local"]');await deck();await click('[data-action="start"]');for(const n of ['1000','2000']){await click('#starter-guess-input',true,n);await click('[data-action="starter-guess-submit"]');}await click('[data-action="starter-start"]');await click('[data-action="ready"]');},
  duel:async({click,deck})=>{await click('[data-action="friends-hub"]');await click('[data-friend-hub="online"]');await click('[data-action="create-room-toggle"]');await click('[data-inline-route="online"]');await deck();await click('label:has(input[name="duel-pace"][value="seguidos"])');await click('[data-action="start-duel"]');await click('[data-action="duel-play"]');},
  competition:async({click})=>{await click('[data-action="solo-hub"]');await click('[data-action="competition-menu"]');await click('[data-action="start-competition"]');await click('[data-action="comp-next-round"]');},
  daily:async({click,page})=>{await click('[data-action="daily-start"]');const screen=await page.locator('#app').getAttribute('data-screen');if(screen==='quick-challenges')await click('[data-quick="ready"]');else{await click('[data-action="daily-play"]');}},
  wifi:async({click,deck})=>{await click('[data-action="friends-hub"]');await click('[data-friend-hub="online"]');await click('[data-action="create-room-toggle"]');await click('[data-inline-route="online"]');await deck();await click('label:has(input[name="live-net"][value="wifi"])');await click('[data-action="start-live-room"]');},
  online:async({click,deck})=>{await click('[data-action="friends-hub"]');await click('[data-friend-hub="online"]');await click('[data-action="create-room-toggle"]');await click('[data-inline-route="online"]');await deck();await click('[data-action="start-live-room"]');}
};
const expected={collections:'solo',mixed:'solo',quick:'quick-game',local:'game',duel:'solo',competition:'solo',daily:'quick-game',wifi:'local-entrada',online:'online-loading'};
try {
  for(const [name,run] of Object.entries(scenarios)){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
    page.setDefaultTimeout(7000);
    page.on('pageerror',error=>findings.push(`${name}: ${error.message}`));
    try {
      await page.addInitScript(()=>localStorage.setItem('continuum-splash-seen-v2','1'));
      if(name==='daily')await page.clock.setFixedTime(new Date('2026-09-27T10:00:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(()=>window.CONTINUUM_SPLASH?.finish());
      const click=async(selector,fill=false,value='')=>{
        const modes=page.locator('[data-action="toggle-modes"][aria-expanded="false"]');
        if(await modes.count())await modes.first().click();
        const target=page.locator(`${selector}:visible`).first();
        if(fill)await target.fill(value);else await target.click();
      };
      const deck=async()=>{await click('[data-block="historia"]');await click('[data-mode="history"]');};
      await run({click,deck,page});
      const state=await page.locator('#app').getAttribute('data-screen');
      const valid=state===expected[name] || name==='online'&&['online-loading','online-entry','online-lobby','online-error'].includes(state) || name==='daily'&&state==='solo';
      if(!valid)findings.push(`${name}: ${state} (se esperaba ${expected[name]})`);
      if(['solo','quick-game','game'].includes(state)){
        const board=await page.evaluate(()=>({board:document.querySelector('#app')?.classList.contains('atlas-board'),
          order:document.querySelector('#app .hand')?.getBoundingClientRect().top<document.querySelector('#app .timeline-wrap')?.getBoundingClientRect().top}));
        if(!board.board||!board.order)findings.push(`${name}: la mesa no conserva mano arriba y línea abajo`);
      }
      console.log(`${name}: ${state}`);
    }catch(error){findings.push(`${name}: ${String(error)}`);}
    finally{await page.close();}
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}
else console.log('Las entradas locales llegan a su mesa; las de red alcanzan la sala o la frontera de conexión del fixture.');
