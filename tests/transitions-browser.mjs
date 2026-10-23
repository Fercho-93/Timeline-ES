import { servirJuego, chromium, opcionesLanzamiento } from './lib/navegador.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const server = await servirJuego();
let browser;
try {
  browser = await chromium.launch(opcionesLanzamiento());
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
    // Todas las salidas superiores, incluido el cierre mientras aún entra el panel. La barra superior
    // de Inicio flota sobre la portada y solo toma alto cuando recibe el botón de sonido: no es fondo.
    for (const [open, close] of [
      ['[data-action="rules"]', '.rules .atlas-dialog-back'],
      ['[data-settings-action="open"]', '.settings-modal .atlas-dialog-back']
    ]) {
      for (const quick of [false, true]) {
        const backgroundOpacity = await page.locator('#app > .shell > :not(.home-nav):not(.atlas-scroll-veil):not(.atlas-topbar)').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).map(node => getComputedStyle(node).opacity));
        await page.locator('.home-nav ' + open).click();
        if (!quick) await settle();
        await page.locator(close).first().click();
        await page.waitForFunction(() => document.querySelector('#app > .shell > .home-nav') && (!document.querySelector('.overlay') || document.querySelector('.dialog-exit')));
        await page.waitForFunction(() => !document.querySelector('.dialog-exit, .enc-modal, .rules, .settings-modal') && document.querySelector('#app').dataset.screen !== 'perfil');
        assert.equal(await page.locator('#app > .shell.motion-entering').count(), 0, `${open} (rápido=${quick}): volver no inicia un segundo fundido`);
        const alphas = await page.locator('#app > .shell > :not(.home-nav):not(.atlas-scroll-veil):not(.atlas-topbar)').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).map(node => getComputedStyle(node).opacity));
        assert.deepEqual(alphas, backgroundOpacity, 'el fondo conserva su opacidad al regresar');
      }
    }
    for (let round = 0; round < 2; round++) {
      for (const selector of ['[data-action="rules"]', '[data-settings-action="open"]', '[data-action="home-top"]']) {
        await page.locator('.home-nav ' + selector).click();
        await settle();
      }
    }
    await page.evaluate(()=>window.CONTINUUM.localNavigate('jugar'));
    await settle();
    // Jugar solo → Grandes colecciones → mazo; después, el mismo mazo en un solo móvil y vuelta.
    await page.locator('[data-inline-route="collections"]').click();
    await settle();
    await page.locator('[data-block="historia"]').click();
    await settle();
    await page.locator('[data-mode="history"]').click();
    await settle();
    await page.evaluate(() => window.CONTINUUM.openDeckAs('local'));
    await settle();
    // Volver y volver a entrar mientras aún entra la pantalla anterior.
    await page.locator('[data-action="back-menu"]').click();
    await page.evaluate(() => window.CONTINUUM.openDeckAs('collections'));
    await settle();
    // Navegación durante una entrada: la limpieza antigua no toca la nueva.
    await page.locator('.home-nav [data-action="home-top"]').click();
    await page.locator('.home-nav [data-action="perfil"]').click();
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
