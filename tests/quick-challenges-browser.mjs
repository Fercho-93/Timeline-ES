import { servirJuego, chromium, opcionesLanzamiento, DECODIFICAR } from './lib/navegador.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = await servirJuego();
let browser;
try {
  browser = await chromium.launch(opcionesLanzamiento());
  await fs.mkdir('test-results/quick-challenges', {recursive: true});
  for (const width of [360, 390, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 850}, reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    // Numeración, nombre y cruz deben compartir fila, incluso después de añadir participantes.
    await page.evaluate(() => {
      const CT = window.CONTINUUM;
      CT.ModeHubs.open('hub-solo');
      if (!document.querySelector('[data-block]')) document.querySelector('[data-inline-route]').click();
      document.querySelector('[data-block="historia"]').click();
      document.querySelector('[data-mode="history"]').click();
      CT.openDeckAs('local');
    });
    await page.locator('[data-action="add-player"]').click();
    const seats = await page.locator('#players .player-row').evaluateAll(rows => rows.map(row => {
      const box = row.getBoundingClientRect(), input = row.querySelector('input').getBoundingClientRect(), remove = row.querySelector('.remove').getBoundingClientRect();
      return {sameRow: Math.abs((input.top + input.height / 2) - (remove.top + remove.height / 2)) < 2, fits: input.right <= remove.left && remove.right <= box.right + 1, height: box.height};
    }));
    assert.ok(seats.length === 3 && seats.every(row => row.sameRow && row.fits && row.height <= 65), `Jugadores alineados a ${width}px`);
    await page.evaluate(() => { window.CONTINUUM.localNavigate('home'); window.CONTINUUM.ModeHubs.refreshHome(); });
    // Inicio → Jugar → Jugar con amigos → Un solo móvil → Retos rápidos.
    await page.locator('[data-action="toggle-modes"]').click();
    await page.locator('[data-action="friends-hub"]').click();
    await page.locator('[data-action="local-hub"]').click();
    const sizes = await page.locator('.mode-hub-list .mode-entry').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().width)));
    assert.ok(sizes.length >= 2 && sizes.every(w => w === sizes[0]), 'Retos rápidos tiene el mismo ancho que las otras puertas');
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
    const plate = page.locator('[data-quick-starter][data-starter-dialog] .starter-card-art img');
    await plate.waitFor();
    await plate.evaluate(DECODIFICAR);
    assert.ok(await plate.evaluate(img => img.naturalWidth > 0 && img.getBoundingClientRect().height >= 150), 'Retos rápidos muestra la lámina ilustrada');
    assert.equal(await page.locator('[data-quick-starter] #quick-starter-input').getAttribute('aria-describedby'), 'quick-starter-input-hint');
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
    // Al recargar se vuelve al Inicio, como en la app: la partida guardada se retoma desde
    // la propia pantalla de Retos rápidos.
    await page.reload();
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    await page.locator('[data-action="toggle-modes"]').click();
    await page.locator('[data-action="friends-hub"]').click();
    await page.locator('[data-action="local-hub"]').click();
    await page.locator('[data-friend-quick="local"]').click();
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
