import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {gameHtml} from './game-fixture.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = gameHtml(await fs.readFile(path.join(root, 'index.html'), 'utf8'));
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) && name !== '/') throw Error('path');
    const body = name === '/' ? html : await fs.readFile(file);
    const mime = {'.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2'}[path.extname(file)] || 'text/html';
    res.writeHead(200, {'Content-Type':mime}); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({viewport:{width:390,height:740}, reducedMotion});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('continuum-splash-seen-v2', '1'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    await page.evaluate(() => document.fonts.ready);
    const settle = async () => {
      await page.waitForFunction(() => !document.querySelector('.motion-entering'));
      const before = await page.locator('.home-nav').first().boundingBox();
      await page.waitForTimeout(850);
      const after = await page.locator('.home-nav').first().boundingBox();
      assert.ok(Math.abs(before.y - after.y) < 1, 'la barra no salta al finalizar');
      const active = await page.locator('.motion-managed').evaluateAll(nodes => nodes.flatMap(node => node.getAnimations().filter(effect => effect.playState === 'running').map(effect => effect.animationName || 'JS')));
      assert.deepEqual(active, [], 'no reaparece una segunda animación');
      assert.equal(await page.locator('.camera-move, .profile-roll-edge').count(), 0);
    };
    // Todas las salidas superiores, incluido el cierre mientras aún entra el panel.
    for (const [open, close] of [
      ['[data-action="rules"]', '.rules .atlas-dialog-back'],
      ['[data-settings-action="open"]', '.settings-modal .atlas-dialog-back']
    ]) {
      for (const quick of [false, true]) {
        const backgroundOpacity = await page.locator('#app > .shell > :not(.home-nav):not(.atlas-scroll-veil)').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).map(node => getComputedStyle(node).opacity));
        await page.locator('.home-nav ' + open).click();
        if (!quick) await settle();
        await page.locator(close).first().click();
        await page.waitForFunction(() => document.querySelector('#app > .shell > .home-nav') && (!document.querySelector('.overlay') || document.querySelector('.dialog-exit')));
        await page.waitForFunction(() => !document.querySelector('.dialog-exit, .enc-modal, .rules, .settings-modal') && document.querySelector('#app').dataset.screen !== 'perfil');
        assert.equal(await page.locator('#app > .shell.motion-entering').count(), 0, `${open} (rápido=${quick}): volver no inicia un segundo fundido`);
        const alphas = await page.locator('#app > .shell > :not(.home-nav):not(.atlas-scroll-veil)').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).map(node => getComputedStyle(node).opacity));
        assert.deepEqual(alphas, backgroundOpacity, 'el fondo conserva su opacidad al regresar');
      }
    }
    for (let round = 0; round < 2; round++) {
      for (const selector of ['[data-action="rules"]', '[data-settings-action="open"]', '[data-action="home-top"]']) {
        await page.locator('.home-nav ' + selector).click();
        await settle();
      }
    }
    await page.locator('.home-door[data-action="jugar"]').click();
    await settle();
    await page.locator('[data-block="historia"]').click();
    await settle();
    await page.locator('[data-mode="history"]').click();
    await settle();
    await page.locator('[data-format="multi"]').click();
    await settle();
    await page.locator('[data-action="setup"]').click();
    await settle();
    await page.locator('[data-action="back-menu"]').click();
    await page.locator('[data-action="solo"]').click();
    await settle();
    // Navegación durante una entrada: la limpieza antigua no toca la nueva.
    await page.locator('.home-nav [data-action="home-top"]').click();
    await page.locator('.home-door[data-action="perfil"]').click();
    await page.locator('[data-action="home-encyclopedia"]').click();
    await page.locator('.home-nav [data-settings-action="open"]').click();
    await settle();
    assert.equal(await page.locator('.home-nav').filter({visible:true}).count(), 1);
    assert.deepEqual(errors, []);
    await fs.mkdir('test-results/transitions', {recursive:true});
    await page.screenshot({path:`test-results/transitions/${reducedMotion}.png`});
    console.log(`Transiciones en Chromium móvil (${reducedMotion}): OK`);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
