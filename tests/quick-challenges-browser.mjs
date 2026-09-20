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
    await page.locator('[data-action="quick-challenges"]').click();
    await page.screenshot({path: `test-results/quick-challenges/setup-${width}.png`, fullPage: true});
    await page.locator('#quick-length').selectOption('1');
    await page.locator('#quick-choice').selectOption('poker');
    await page.locator('[data-quick="start"]').click();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(await overflow(), false, `Sin desbordamiento a ${width}px`);
    await page.screenshot({path: `test-results/quick-challenges/turn-${width}.png`, fullPage: true});
    await page.locator('[data-quick="select"]').first().click();
    await page.locator('[data-quick="slot"]').first().click();
    await page.locator('[data-quick="confirm"]').click();
    assert.ok(await page.locator('[data-quick="ack"]').isVisible());
    await page.screenshot({path: `test-results/quick-challenges/result-${width}.png`, fullPage: true});
    await page.reload();
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    await page.locator('[data-quick="resume"]').click();
    assert.ok(await page.locator('[data-quick="ack"]').isVisible());
    await page.locator('[data-quick="ack"]').click();
    while (await page.locator('[data-quick="bank"]').count()) await page.locator('[data-quick="bank"]').click();
    await page.getByText('Ver el orden completo y las fuentes').click();
    assert.equal(await page.locator('details li').count(), 9);
    assert.equal(await overflow(), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Navegador: 360, 390 y 1280 px, colocación, revelación, recarga y cierre sin errores: OK');
} finally {await browser?.close(); await new Promise(resolve => server.close(resolve));}
