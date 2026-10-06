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
  // Cada móvil arranca con su propio nombre de perfil (la partida ya no pide escribirlo).
  const open=async(name='Prueba')=>{
    const page=await browser.newPage({viewport:{width:390,height:850},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(nombre=>{localStorage.setItem('continuum-identidad-v1',JSON.stringify({nombre}));window.pcs=[];const P=window.RTCPeerConnection;window.RTCPeerConnection=class extends P{constructor(...a){super(...a);window.pcs.push(this);}};},name);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(()=>window.CONTINUUM_SPLASH?.finish());
    return page;
  };
  const dismissSplash=page=>page.evaluate(()=>document.querySelector('[data-quick-splash]')?.click());
  // Juega un reto colocando siempre la primera carta en el primer hueco, hasta su final.
  const playRound=async page=>{
    for(let i=0;i<80;i++){
      await dismissSplash(page);await page.waitForTimeout(30);
      if(await page.locator('.quick-panel h2').count())return;
      if(await page.locator('[data-quick="ack"]').count()){await page.locator('[data-quick="ack"]').click();continue;}
      await page.locator('[data-quick="select"]').first().click();await page.locator('[data-quick="slot"]').first().click();await page.locator('[data-quick="confirm"]').click();
    }
    throw Error('El reto no terminó');
  };
  const openPlay=async page=>{if(await page.locator('[data-action="toggle-modes"][aria-expanded="false"]').count())await page.locator('[data-action="toggle-modes"]').click();};
  const toFriends=async page=>{await openPlay(page);await page.locator('[data-action="friends-hub"]').click();await page.locator('[data-friend-hub="online"]').click();await page.locator('[data-action="create-room-toggle"]').click();await page.locator('[data-friend-quick="online"]').click();};
  // Jugar solo → Retos rápidos: un reto entero; un fallo no te echa.
  const p=await open();
  await openPlay(p);await p.locator('[data-action="solo-hub"]').click();await p.locator('[data-solo-route="quick"]').click();
  await p.screenshot({path:'test-results/quick-challenges/formats.png',fullPage:true});
  await p.locator('.quick-length-chip[data-length="1"]').click();await p.locator('[data-quick="start-free"]').click();
  await dismissSplash(p);await p.locator('[data-quick="ready"]').click();
  assert.equal(await p.locator('[data-quick="bank"]').count(),0,'en solitario no hay que plantarse');
  await playRound(p);
  assert.match(await p.locator('.quick-panel h2').innerText(),/Tu resultado/);
  // Cada uno en su móvil → Retos rápidos → Mismas cartas: juegas y mandas el enlace.
  await p.locator('[data-action="home"]').click();
  await toFriends(p);
  await p.locator('label:has(input[name="quick-duel-pace"][value="seguidos"])').click();
  await p.locator('.quick-length-chip[data-length="1"]').click();await p.locator('[data-quick="start-duel"]').click();
  await dismissSplash(p);await p.locator('[data-quick="ready"]').click();
  await playRound(p);
  const link=await p.locator('#quick-result-link').inputValue();
  // El enlace apunta a la web publicada: se abre aquí con la misma invitación.
  const rival=await open('Bea');await rival.goto(`http://127.0.0.1:${server.address().port}/${new URL(link).hash}`);await rival.reload();await rival.evaluate(()=>window.CONTINUUM_SPLASH?.finish());await dismissSplash(rival);
  // Las mismas cartas en el mismo orden y la misma forma de jugarlas: empate.
  await playRound(rival);assert.ok(await rival.getByText(/Habéis empatado/).isVisible());
  await p.close();await rival.close();
  // Real WebRTC connection between two independent browser contexts: sala en directo sin internet.
  const host=await open('Ana'),guest=await open('Bea');
  await toFriends(host);
  await host.locator('.quick-length-chip[data-length="1"]').click();
  await host.locator('label:has(input[name="quick-live-net"][value="wifi"])').click();
  await host.locator('[data-quick="live-room"]').click();
  await host.locator('[data-quick="invite-peer"]').click();
  const offer=await host.locator('#quick-signal').inputValue();
  // Quien se une entra por «Unirme a una partida» y pega la invitación.
  await openPlay(guest);await guest.locator('.mode-join-shortcut').click();
  await guest.locator('#friends-join-code').fill(offer);await guest.locator('[data-friends-join-form] [type="submit"]').click();
  await guest.locator('#quick-signal').waitFor();
  const answer=await guest.locator('#quick-signal').inputValue();
  await host.locator('#quick-answer').fill(answer);await host.locator('[data-quick="accept-answer"]').click();
  try{await host.getByText('Bea',{exact:false}).first().waitFor();}catch(e){for(const [label,pg] of [['host',host],['guest',guest]]){console.log(label,await pg.locator('#app').innerText(),await pg.evaluate(()=>pcs.map(x=>({state:x.connectionState,ice:x.iceConnectionState}))));await pg.screenshot({path:'test-results/quick-challenges/'+label+'-error.png',fullPage:true});}throw e;}
  await host.locator('[data-quick="start-room"]:enabled').click();
  await dismissSplash(guest);await dismissSplash(host);
  // Mientras juega Ana, Bea ve la partida pero no puede plantarse: el botón solo sale en su turno.
  await guest.locator('[data-quick="select"]').first().waitFor();
  assert.equal(await guest.locator('[data-quick="bank"]').count(),0);
  assert.equal(await guest.locator('[data-quick="select"]').first().isDisabled(),true);
  await host.locator('[data-quick="select"]').first().click();await host.locator('[data-quick="slot"]').first().click();await host.locator('[data-quick="confirm"]').click();
  await host.locator('[data-quick="ack"]').click();await guest.locator('[data-quick="bank"]:enabled').waitFor();await guest.locator('[data-quick="bank"]').click();
  // If the first placement was correct, Ana is still active and can bank.
  await host.waitForTimeout(200);
  if(await host.locator('[data-quick="bank"]').count())await host.locator('[data-quick="bank"]').click();
  await host.locator('.quick-panel h2').waitFor();await guest.locator('.quick-panel h2').waitFor();
  await host.close();await guest.close();
  assert.deepEqual(errors,[]);
  console.log('Retos rápidos: solo, mismas cartas por enlace y sala por Wi-Fi con WebRTC real en dos móviles: OK');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
