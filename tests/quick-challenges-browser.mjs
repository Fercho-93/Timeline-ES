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
  browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
  await fs.mkdir('test-results/quick-challenges', {recursive: true});
  for (const width of [360, 390, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 850}, reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    // Inicio → Jugar → Jugar con amigos → Un solo móvil → Retos rápidos.
    await page.locator('[data-action="toggle-modes"]').click();
    await page.locator('[data-action="friends-hub"]').click();
    await page.locator('[data-action="local-hub"]').click();
    const sizes = await page.locator('.mode-hub-list .mode-entry').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().width)));
    assert.ok(sizes.length >= 3 && sizes.every(w => w === sizes[0]), 'Retos rápidos tiene el mismo ancho que las otras puertas');
    await page.screenshot({path: `test-results/quick-challenges/home-${width}.png`, fullPage:true});
    await page.locator('[data-friend-quick="local"]').click();
    await page.screenshot({path: `test-results/quick-challenges/setup-${width}.png`, fullPage: true});
    await page.locator('#quick-name-0').fill('Ana');
    await page.locator('[data-quick="add-player"]').click();
    await page.locator('[data-quick="add-player"]').click();
    assert.equal(await page.locator('[data-quick-name]').count(), 4);
    assert.equal(await page.locator('#quick-name-0').inputValue(), 'Ana');
    await page.locator('[data-quick="remove-player"]').last().click();
    await page.locator('[data-quick="remove-player"]').last().click();
    assert.equal(await page.locator('[data-quick-name]').count(), 2);
    await page.locator('.quick-length-chip[data-length="1"]').click();
    await page.locator('[data-quick="start"]').click();
    for (const v of ['1900', '1500']) { await page.locator('#quick-starter-input').fill(v); await page.locator('[data-quick="starter-guess"]').click(); }
    await page.locator('[data-quick="starter-go"]').click();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(await overflow(), false, `Sin desbordamiento a ${width}px`);
    await page.screenshot({path: `test-results/quick-challenges/turn-${width}.png`, fullPage: true});
    // Tocar una carta de la línea abre su ficha (antes se giraba); Escape la cierra.
    await page.locator('.card-flippable').first().click();
    assert.ok(await page.locator('.overlay, [role="dialog"]').count(), 'la carta abre su ficha');
    await page.keyboard.press('Escape');
    // El zoom de las cartas se elige en el menú de la partida.
    await page.locator('[data-quick="menu"]').click();
    await page.locator('.menu-view-zoom [data-zoom-level="2"]').click();
    assert.equal(await page.locator('.timeline').evaluate(el => el.style.transform), 'scale(1.2)');
    await page.locator('.menu-view-zoom [data-zoom-level="1"]').click();
    await page.locator('[data-quick="close-menu"]').click();
    await page.locator('[data-quick="menu"]').click();
    await page.locator('[data-settings-action="open"]').click();
    await page.locator('[data-settings-action="close"]').first().click();
    await page.locator('[data-quick="close-menu"]').click();
    if(width === 1280) {
      await page.locator('.hand-card').first().dragTo(page.locator('.slot').first());
      await page.locator('[data-quick="confirm"]').waitFor();
      await page.locator('[data-quick="cancel"]').click();
    }
    await page.locator('[data-quick="select"]').first().click();
    await page.locator('[data-quick="slot"]').first().click();
    await page.locator('[data-quick="confirm"]').click();
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('[data-quick="ack"]').isVisible());
    await page.screenshot({path: `test-results/quick-challenges/result-${width}.png`, fullPage: true});
    await page.reload();
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    await page.locator('[data-quick="resume"]').click();
    assert.ok(await page.locator('[data-quick="ack"]').isVisible());
    await page.locator('[data-quick="ack"]').click();
    while (await page.locator('[data-quick="bank"]').count()) await page.locator('[data-quick="bank"]').click();
    await page.getByText('Ver el orden completo y las fuentes').click();
    // El orden completo enseña todas las cartas del reto que salió.
    const cards = await page.evaluate(() => JSON.parse(localStorage.getItem('continuum-quick-challenges-v1')).config.rounds[0].order.length);
    assert.equal(await page.locator('details li').count(), cards);
    assert.equal(await overflow(), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Navegador: 360, 390 y 1280 px, colocación, revelación, recarga y cierre sin errores: OK');
} finally {await browser?.close(); await new Promise(resolve => server.close(resolve));}
