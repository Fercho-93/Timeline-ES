// Real browser layout regression; Firebase is replaced by deterministic snapshots.
// PLAYWRIGHT_MODULE can point to a locally installed Playwright entry point.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const source = (await fs.readFile(path.join(root, 'duelo-turnos.js'), 'utf8')).replace(/^import .*;\r?\n/gm, '');
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<html><body></body></html>'); return; }
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
    const target = path.resolve(root, relative);
    if (!target.startsWith(root)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', relative.endsWith('.css') ? 'text/css' : relative.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    res.end(await fs.readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
try {
  for (const width of [320, 390, 430, 820, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    // Disable all application scripts: no network game or authentication is created.
    await page.route('**/*', route => route.request().url().startsWith(`http://127.0.0.1:${server.address().port}/`) ? route.continue() : route.abort());
    await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/edition.css"><link rel="stylesheet" href="/accounts.css"><main id="app"></main><div id="toast"></div>`);
    await page.evaluate(() => {
      const cards = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `Acontecimiento histórico número ${i + 1}`, year: 1000 + i, detail: 'Explicación de la carta.' }));
      window.CONTINUUM = {
        escapeHtml: text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
        cards: () => cards, categoryBadge: () => '', animalArt: () => '', cardBack: () => '<span class="carta-reverso">✦</span>',
        eraForCard: () => ({ key: 'modern', symbol: '✦', name: 'Historia' }), formatValue: (_, c) => String(c.year), sortValue: (_, c) => c.year, mode: () => ({name:'Historia'}), placementHint: () => 'Debía ir después de la carta anterior.',
        hiddenLabel: () => 'Fecha oculta', timelineTitle: () => 'Línea temporal', Accounts: { user: { uid: 'me' } },
        Duelo: { CARTAS: 15, reparto: () => cards.map(c => c.id), Cifras: { reparto: () => cards.map(c => c.id), regla: () => ({ pregunta: '¿En qué año fue?' }) } }
      };
    });
    await page.addScriptTag({ url: '/mapa.js' });
    await page.addScriptTag({ content: `const auth={currentUser:{uid:'me'}};\n${source}\nwindow.showDuel=(options={})=>{cachedGames=options.nextGames||[];current={id:'layout',mode:'history',kind:'orden',seed:'test',total:15,turnIndex:0,turnUid:'me',status:'playing',playersOrder:['me','them'],players:{me:{alias:'Explorador'},them:{alias:'Un rival con nombre largo'}},scores:{me:0,them:0},timeline:[1],...options};enteredAt=Date.now();pendingIndex=null;render();clearInterval(timer);}; window.redrawDuel=()=>{render();clearInterval(timer);};window.tickDuel=()=>{enteredAt=Date.now()-10000;updateClock();};` });
    const fits = async label => {
      const sizes = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, shell: document.querySelector('.turn-duel-shell').getBoundingClientRect().right }));
      assert.ok(sizes.page <= sizes.viewport + 1, `${width}px ${label}: page overflow ${JSON.stringify(sizes)}`);
      assert.ok(sizes.shell <= sizes.viewport + 1, `${width}px ${label}: shell outside viewport`);
    };
    await page.evaluate(() => showDuel());
    await fits('first card');
    await page.evaluate(() => showDuel({ timeline: Array.from({length: 12}, (_, i) => i + 1), turnIndex: 12 }));
    await fits('long board');
    if (process.env.DUEL_SCREENSHOT && width === 390) await page.screenshot({ path: process.env.DUEL_SCREENSHOT, fullPage: true });
    const scrolled = await page.evaluate(() => { const wrap=document.querySelector('.timeline-wrap'); wrap.scrollLeft=350; return wrap.scrollLeft; });
    assert.ok(scrolled > 0, 'the board can scroll');
    await page.evaluate(() => redrawDuel());
    assert.equal(await page.locator('.timeline-wrap').evaluate(el => el.scrollLeft), scrolled, 'snapshot preserves board position');
    await page.locator('[data-turn-action="select-slot"]').last().click();
    await fits('confirmation');
    await page.locator('[data-turn-action="cancel-place"]').click();
    await page.evaluate(() => showDuel({ timeline: [1,2,3], turnUid: 'them', turnIndex: 3 }));
    await fits('opponent turn');
    assert.equal(await page.locator('.timeline-card').count(), 3, 'board stays visible while waiting');
    await page.evaluate(() => showDuel({ kind: 'cifras' }));
    await page.locator('#turn-cifra-input').fill('1492');
    await page.evaluate(() => { redrawDuel(); tickDuel(); });
    assert.equal(await page.locator('#turn-cifra-input').inputValue(), '1492');
    assert.equal(await page.locator('#turn-duel-seconds').textContent(), '5');
    await fits('cifras');
    await page.evaluate(() => showDuel({ status:'waiting', turnUid:null, playersOrder:['me'] }));
    await fits('invitation');
    await page.locator('summary').click();
    await fits('invitation link');
    await page.addScriptTag({ content: `window.previewTurn=()=>{preparingTurn=null;prepareTurn();render();clearInterval(timer);};window.beginPreparation=()=>{preparingTurn=null;prepareTurn(true);render();clearInterval(timer);return enteredAt;};window.endPreparation=()=>{prepareUntil=Date.now()-1;render();clearInterval(timer);};` });
    await page.evaluate(() => showDuel());
    await page.evaluate(() => previewTurn());
    assert.equal(await page.locator('[data-turn-action="ready"]').count(), 1);
    assert.equal(await page.locator('.hand-card').count(), 0, 'no card before I am ready');
    assert.equal(await page.locator('.turn-duel-clock').count(), 0);
    await fits('ready screen');
    const deadline = await page.evaluate(() => beginPreparation());
    assert.equal(await page.locator('#turn-ready-seconds').textContent(), '3');
    assert.equal(await page.locator('.hand-card').count(), 0, 'pending card is absent during preparation');
    assert.equal(await page.locator('[data-turn-action="select-slot"]').count(), 0);
    assert.equal(await page.evaluate(() => beginPreparation()), deadline, 'reentry does not reset the deadline');
    await page.evaluate(() => endPreparation());
    assert.equal(await page.locator('.hand-card').count(), 1);
    await page.evaluate(() => showDuel({status:'cancelled',turnUid:null,resultText:'Duelo cerrado.'}));
    assert.equal(await page.locator('.hand-card').count(), 0);
    assert.equal(await page.locator('[data-turn-action="select-slot"]').count(), 0);
    await page.evaluate(() => showDuel({status:'waiting',turnUid:null,playersOrder:['them'],invitedUid:'me',invitedAlias:'Explorador'}));
    assert.equal(await page.locator('[data-turn-action="accept"]').count(), 1);
    assert.equal(await page.locator('.hand-card').count(), 0);
    await fits('direct invitation');
    await page.evaluate(() => showDuel({status:'expired',turnUid:null,plays:[{uid:'them',cardId:2,correct:true}],nextGames:[{id:'other',status:'playing',turnUid:'me'}]}));
    assert.equal(await page.locator('.turn-duel-last').count(), 1);
    assert.equal(await page.locator('.reveal .year').textContent(), '1001');
    assert.equal(await page.locator('[data-turn-action="rematch"]').count(), 1);
    assert.equal(await page.locator('[data-turn-action="next"]').count(), 1);
    assert.equal(await page.locator('.hand-card').count(), 0);
    await fits('last move and rematch');
    if (process.env.DUEL_SCREENSHOT && width === 390) { await page.locator('.turn-duel-solution').evaluate(el => el.open = true); await page.screenshot({path:process.env.DUEL_SCREENSHOT.replace('.png','-solution.png'),fullPage:true}); }
    const favorites = await page.evaluate(() => { const t=CONTINUUM.TurnDuel; t.favorite('them'); return t.rivals([{id:'past',mode:'history',kind:'orden',playersOrder:['me','them'],players:{them:{alias:'Rival'}}}]); });
    assert.equal(favorites[0].favorite, true);
    assert.equal(favorites[0].source, 'past');
    await page.evaluate(() => { document.getElementById('app').innerHTML = `<div class="shell">${CONTINUUM.TurnDuel.profileMarkup([{id:'old',status:'resigned',winnerUid:'me',kind:'orden',mode:'history',playersOrder:['me','them'],players:{me:{alias:'Yo'},them:{alias:'Rival con un nombre bastante largo'}},scores:{me:2,them:3}}])}</div>`; });
    await page.locator('details').evaluateAll(elements => elements.forEach(el => el.open = true));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'profile fits');
    if (process.env.DUEL_SCREENSHOT && width === 390) await page.screenshot({path:process.env.DUEL_SCREENSHOT.replace('.png','-profile.png'),fullPage:true});
    assert.equal(await page.locator('[data-action="archive-turn-duel"]').count(), 1);
    assert.equal(await page.locator('[data-action="block-duel-rival"]').count(), 1);
    assert.deepEqual(errors, []);
    console.log(`OK ${width}px: invitation, long board, confirmation, opponent turn, answer and circular timer`);
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
