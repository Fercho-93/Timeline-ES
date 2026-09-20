import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {gameHtml} from './game-fixture.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const html = gameHtml(await fs.readFile(path.join(root, 'index.html'), 'utf8'));
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(path.resolve(root) + path.sep) && pathname !== '/') throw Error('path');
    const body = pathname === '/' ? html : await fs.readFile(file);
    res.setHeader('Content-Type', {'.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml'}[path.extname(file)] || 'text/html');
    res.end(body);
  } catch {res.writeHead(404); res.end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH,args:['--disable-features=WebRtcHideLocalIpsWithMdns']} : {args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
  await fs.mkdir('test-results/quick-challenges', {recursive: true});
  const errors=[];
  const open=async()=>{
    const page=await browser.newPage({viewport:{width:390,height:850},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.pcs=[];const P=window.RTCPeerConnection;window.RTCPeerConnection=class extends P{constructor(...a){super(...a);window.pcs.push(this);}};});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(()=>window.CONTINUUM_SPLASH?.finish());
    await page.locator('[data-action="quick-challenges"]').click();return page;
  };
  const p=await open();
  await p.screenshot({path:'test-results/quick-challenges/formats.png',fullPage:true});
  await p.locator('[data-quick="solo-menu"]').click();
  await p.screenshot({path:'test-results/quick-challenges/solo.png',fullPage:true});
  await p.locator('[data-quick="daily"]').click();
  const today=await p.evaluate(()=>JSON.parse(localStorage.getItem('continuum-quick-daily-v1')));
  assert.equal(today.config.names.length,1);
  await p.locator('[data-quick="bank"]').click();
  assert.ok(await p.getByText('Tu resultado',{exact:true}).isVisible());
  await p.locator('[data-quick="formats"]').click();await p.locator('[data-quick="solo-menu"]').click();await p.locator('[data-quick="daily"]').click();
  assert.ok(await p.getByText('Tu resultado',{exact:true}).isVisible(),'El diario no permite reiniciar el intento terminado');
  await p.locator('[data-quick="formats"]').click();await p.locator('[data-quick="solo-menu"]').click();await p.locator('[data-quick="free"]').click();
  assert.equal(await p.locator('[data-quick-name]').count(),1);assert.equal(await p.locator('[data-quick="add-player"]').count(),0);
  await p.locator('[data-quick="start"]').click();
  for(let i=0;i<3;i++){await p.locator('[data-quick="bank"]').click();if(i<2)await p.locator('[data-quick="next"]').click();}
  await p.locator('[data-quick="formats"]').click();await p.locator('[data-quick="solo-menu"]').click();await p.locator('[data-quick="duel"]').click();
  await p.locator('#quick-length').selectOption('1');await p.locator('[data-quick="start"]').click();await p.locator('[data-quick="bank"]').click();
  const link=await p.locator('#quick-result-link').inputValue();
  const rival=await browser.newPage();rival.on('pageerror',e=>errors.push(e.message));await rival.goto(link);await rival.evaluate(()=>window.CONTINUUM_SPLASH?.finish());
  await rival.locator('[data-quick="bank"]').click();assert.ok(await rival.getByText(/Habéis empatado/).isVisible());
  await p.close();await rival.close();
  // Real WebRTC connection between two independent browser contexts.
  const host=await open(),guest=await open();
  for(const page of [host,guest]){await page.locator('[data-quick="show-multi"]').click();await page.locator('[data-quick="offline"]').click();}
  await host.locator('#quick-net-name').fill('Ana');await host.locator('[data-quick="create-room"]').click();
  await host.locator('[data-quick="invite-peer"]').click();
  const offer=await host.locator('#quick-signal').inputValue();
  await guest.locator('#quick-net-name').fill('Bea');await guest.locator('#quick-net-code').fill(offer);await guest.locator('[data-quick="join-room"]').click();
  const answer=await guest.locator('#quick-signal').inputValue();
  await host.locator('#quick-answer').fill(answer);await host.locator('[data-quick="accept-answer"]').click();
  try{await host.getByRole('listitem').filter({hasText:'Bea'}).waitFor();}catch(e){for(const [label,p] of [['host',host],['guest',guest]]){console.log(label,await p.locator('#app').innerText(),await p.evaluate(()=>pcs.map(x=>({state:x.connectionState,ice:x.iceConnectionState}))));await p.screenshot({path:'test-results/quick-challenges/'+label+'-error.png',fullPage:true});}throw e;}await guest.getByRole('listitem').filter({hasText:'Ana'}).waitFor();
  await host.locator('#quick-net-length').selectOption('1');await host.locator('[data-quick="start-room"]').click();
  await guest.locator('[data-quick="bank"]').waitFor();assert.equal(await guest.locator('[data-quick="bank"]').isDisabled(),true);
  await host.locator('[data-quick="select"]').first().click();await host.locator('[data-quick="slot"]').first().click();await host.locator('[data-quick="confirm"]').click();
  await host.locator('[data-quick="ack"]').click();await guest.locator('[data-quick="bank"]:enabled').waitFor();await guest.locator('[data-quick="bank"]').click();
  // If the first placement was correct, Ana is still active and can bank.
  await host.waitForTimeout(200);
  if(await host.locator('[data-quick="bank"]').count())await host.locator('[data-quick="bank"]').click();
  await host.locator('[data-quick="formats"]').waitFor();await guest.locator('[data-quick="formats"]').waitFor();
  await host.close();await guest.close();
  assert.deepEqual(errors,[]);
  console.log('Formatos: diario sin reinicio, libre, duelo por enlace y partida WebRTC real en dos móviles: OK');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
