// Recorre en Chromium, a ancho de móvil y de escritorio, cada pantalla a la que se puede
// avanzar: comprueba que se ve la flecha de volver y que lleva a la pantalla anterior.
// Uso: PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs node tests/navegacion-volver-browser.mjs
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gameHtml} from './game-fixture.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const html = gameHtml(await fs.readFile(root + '/index.html', 'utf8'));
const server = createServer(async (req, res) => {
  try { const p = new URL(req.url, 'http://x').pathname; const f = path.join(root, p); const body = p === '/' ? html : await fs.readFile(f);
    res.setHeader('Content-Type', {'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'}[path.extname(f)] || 'text/html'); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const problems = [];
const ARROW = '#app .atlas-back, #app .topbar [data-local-action][aria-label="Volver"], #app .turn-duel-back';

async function session(viewport, date, fn) {
  const ctx = await browser.newContext({viewport, reducedMotion: 'reduce'});
  const pg = await ctx.newPage();
  if (date) await pg.clock.setFixedTime(new Date(date));
  pg.on('pageerror', e => problems.push(`[${viewport.width}] pageerror ${e.message}`));
  await pg.goto(url);
  await pg.waitForFunction(() => document.getElementById('app')?.dataset.screen === 'home');
  await pg.evaluate(() => document.getElementById('splash')?.remove());
  const screen = () => pg.evaluate(() => document.getElementById('app').dataset.screen);
  const settle = () => pg.waitForTimeout(250);
  const tag = `[${viewport.width}px${date ? ' ' + date.slice(0, 10) : ''}]`;
  // En Inicio las modalidades están plegadas bajo la lámina «Jugar».
  const openModes = async () => { const toggle = pg.locator('[data-action="toggle-modes"][aria-expanded="false"]'); if (await toggle.count()) { await toggle.first().click(); await pg.waitForTimeout(400); } };
  const click = async sel => { if (/-hub|mode-entry/.test(sel)) await openModes(); const el = pg.locator(sel + ':visible').first(); await el.scrollIntoViewIfNeeded({timeout: 5000}); await el.click({timeout: 5000}); await settle(); };
  const arrowVisible = () => pg.evaluate(sel => { const el = [...document.querySelectorAll(sel)].find(e => e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 20; }, ARROW);
  const at = async expected => { const s = await screen(); if (s !== expected) problems.push(`${tag} esperaba ${expected}, está en ${s}`); return s === expected; };
  const back = async expected => {
    const from = await screen();
    if (!(await arrowVisible())) { problems.push(`${tag} ${from}: NO se ve la flecha de volver`); return; }
    await pg.evaluate(sel => { window.scrollTo(0, 0); [...document.querySelectorAll(sel)].find(e => e.checkVisibility()).click(); }, ARROW); await settle();
    if (await pg.locator('[data-exit-confirm]').count()) { await pg.click('[data-exit-confirm]'); await settle(); }
    const s = await screen();
    if (expected && s !== expected) problems.push(`${tag} volver desde ${from} → ${s} (debería ser ${expected})`);
    else console.log(`${tag} ✓ ${from} ← flecha → ${s}`);
  };
  const noArrowHome = async () => { if (await arrowVisible()) problems.push(`${tag} home muestra flecha`); };
  await fn({pg, click, back, at, screen, noArrowHome});
  await ctx.close();
}

async function flows(vp) {
  await session(vp, null, async ({click, back, at, noArrowHome, pg, screen}) => {
    await noArrowHome();
    // Jugar solo
    await click('[data-action="solo-hub"]'); await at('hub-solo'); await back('home');
    await click('[data-action="solo-hub"]'); await click('[data-solo-route="collections"]'); await at('jugar');
    await click('[data-action="set-block"]'); await click('.collection-entry.active [data-action="set-mode"]'); await at('solo-home');
    await click('[data-action="start-free"]'); await at('solo'); await back('solo-home');
    await back('jugar'); await back('hub-solo');
    await click('[data-solo-route="collections"]');
    await click('#mode-inline-drawer [data-action="set-block"][data-block="mezcla"]');
    await click('#mode-inline-drawer [data-action="set-mode"][data-mode="mixed"]'); await at('solo-home'); await back('hub-solo');
    await click('[data-solo-route="quick"]'); await at('quick-challenges');
    await click('[data-quick="start-free"]'); await at('quick-challenges'); await click('[data-quick="ready"]'); await at('quick-game'); await back('quick-challenges'); await click('[data-quick="start-free"]'); await back('quick-challenges');
    await back('hub-solo'); await back('home');
    // Jugar con amigos
    // Un solo móvil, o cada uno en el suyo: el duelo, el Wi-Fi y la sala salen del ritmo elegido tras el mazo.
    for (const [route, target] of [['local', 'setup'], ['duel', 'duel-home'], ['wifi', 'local-entrada'], ['online', null]]) {
      const hub = route === 'local' ? 'local' : 'online';
      await click('[data-action="friends-hub"]'); await at('hub-friends');
      await click(route === 'local' ? '[data-action="local-hub"]' : '[data-friend-hub="online"]'); await at(`hub-friends-${hub}`);
      if (hub === 'online') await click('[data-action="create-room-toggle"]');
      await click(`[data-inline-route="${hub}"]`); await click('#mode-inline-drawer [data-action="set-block"]'); await click('#mode-inline-drawer .collection-entry.active [data-action="set-mode"]');
      if (route === 'duel') await click('label:has(input[name="duel-pace"][value="seguidos"])');
      if (route === 'wifi' || route === 'online') { await click(`label:has(input[name="live-net"][value="${route === 'wifi' ? 'wifi' : 'internet'}"])`); await click('[data-action="start-live-room"]'); }
      if (target) await at(target);
      if (route === 'online') { await pg.waitForFunction(() => document.getElementById('app').dataset.screen !== 'online-loading', null, {timeout: 15000}).catch(() => {}); console.log('online →', await screen()); }
      if (route === 'local') { await click('[data-action="start"]'); await at('pass'); await back('setup'); }
      if (route === 'duel') { await click('[data-action="start-duel"]'); await at('duelo-listo'); await back('duel-home'); await click('[data-action="duels-list"]'); await at('duelos'); await back('duel-home'); }
      await back('jugar'); await back('hub-friends'); await back('home');
    }
    // Jugar online
    await click('[data-action="online-hub"]'); await at('hub-online');
    await click('[data-action="online-collections"]'); await at('hub-online-collections'); await back('hub-online');
    await back('home');
    // Competición
    await click('[data-action="solo-hub"]');
    await click('.mode-entry[data-action="competition-menu"]'); await at('competition-menu');
    await click('[data-action="start-competition"]'); await back('competition-menu');
    await back('hub-solo'); await back('home');
    await click('[data-action="friends-hub"]'); await click('[data-action="local-hub"]');
    await click('.mode-entry[data-action="competition-menu"]'); await at('competition-menu');
    await click('[data-action="competition-local"]'); await at('setup'); await back('competition-menu');
    await back('hub-friends-local'); await back('hub-friends'); await back('home');
    // Atlas
    await click('.home-nav [data-action="perfil"]'); await at('perfil'); await back('home');
    // Jugar clásico (puerta antigua)
    await pg.evaluate(() => window.CONTINUUM.localNavigate('jugar')); await pg.waitForTimeout(600); await at('jugar');
    await click('[data-action="quick-challenges"]'); await at('quick-challenges');
    await click('[data-quick="free"]'); await back('quick-challenges');
    await click('[data-quick="show-multi"]'); await click('[data-quick="local"]'); await back('quick-challenges');
    await click('[data-quick="show-multi"]'); await click('[data-quick="internet"]'); await back('quick-challenges');
    await back('jugar');
    await click('[data-action="competition-menu"]'); await back('jugar');
    await back('home');
  });
  // Reto diario: día de retos rápidos (impar) y de colecciones (par)
  for (const date of ['2026-09-27T10:00:00', '2026-09-28T10:00:00']) {
    await session(vp, date, async ({click, back, at, screen, pg}) => {
      await click('[data-action="daily-start"]');
      const s = await screen();
      await back('home');
      await click('[data-action="daily-start"]');
      if (s === 'quick-challenges') { await click('[data-quick="ready"]'); await at('quick-game'); await back('home'); }
      else { await pg.waitForSelector('[data-action="daily-play"]:not([hidden])', {timeout: 8000}); await click('[data-action="daily-play"]'); await at('solo'); await back('home'); }
    });
  }
}

for (const vp of [{width: 390, height: 844}, {width: 1280, height: 900}]) await flows(vp);
await browser.close(); server.close();
if (problems.length) { console.error('\nPROBLEMAS:\n' + problems.join('\n')); process.exit(1); }
console.log('\n✓ Todas las pantallas tienen flecha de volver y vuelven a la anterior');
