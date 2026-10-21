// Tabletas en un navegador de verdad: en horizontal la partida usa dos columnas con las medidas reales;
// en vertical y en el móvil sigue la mesa a escala. Se lanza con Playwright (ver zoom-visual.yml).
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const {webkit, chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
import {gameHtml} from './game-fixture.mjs';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = gameHtml(await fs.readFile(path.join(root, 'index.html'), 'utf8'));
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && pathname !== '/') throw Error('path');
    const body = pathname === '/' ? html : await fs.readFile(file);
    res.writeHead(200, {'Content-Type': {'.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml'}[path.extname(file)] || 'text/html'});
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const destination = path.join(root, 'test-results/zoom');
await fs.mkdir(destination, {recursive: true});

// [anchura, altura, modo esperado]: 'mesa' = escalada como un iPhone; 'columnas' = dos columnas con medidas reales.
const casos = [[390, 844, 'mesa'], [834, 1194, 'mesa'], [1194, 834, 'columnas'], [1376, 1032, 'columnas'], [1024, 768, 'columnas']];
let browser;
try {
  for (const [engine, type] of [['webkit', webkit], ['chromium', chromium]].filter(([name]) => (process.env.ENGINES || 'webkit,chromium').split(',').includes(name))) {
    browser = await type.launch(engine === 'chromium' && process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
    for (const [width, height, modo] of casos) {
      const page = await browser.newPage({viewport: {width, height}, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce'});
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const etiqueta = `${engine} ${width}×${height}`;
      try {
        await page.addInitScript(() => { localStorage.setItem('continuum-splash-seen-v2', '1'); let seed = 20261021; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); });
        await page.goto(url); await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
        await page.evaluate(() => window.CONTINUUM.ModeHubs.open('hub-solo'));
        await page.locator('[data-inline-route="collections"]').click();
        await page.locator('[data-block="historia"]').click();
        await page.locator('[data-mode="history"]').click();
        await page.locator('[data-action="start-free"]').click();
        await page.locator('.board-timeline-section .timeline-card').first().waitFor();
        await page.evaluate(async () => {
          await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; })));
          for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        });
        const medir = () => page.evaluate(() => {
          const app = document.getElementById('app'), box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return {left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height)}; };
          return {
            tablet: document.documentElement.getAttribute('data-tablet'), mesa: app.classList.contains('mesa-escena'),
            focus: box(app.querySelector('.board-focus-card, .hand-solo')), line: box(app.querySelector('.board-timeline-section')), card: box(app.querySelector('.timeline-card')),
            result: box(app.querySelector('.board-result-layer .modal.board-result')),
            doc: document.documentElement.scrollHeight, inner: innerHeight, innerWidth, docWidth: document.documentElement.scrollWidth
          };
        });
        const antes = await medir();
        assert.equal(antes.mesa, modo === 'mesa', `${etiqueta}: mesa escalada = ${modo === 'mesa'}`);
        assert.ok(antes.docWidth <= antes.innerWidth + 1, `${etiqueta}: sin desbordamiento horizontal`);
        if (modo === 'columnas') {
          assert.equal(antes.tablet, 'horizontal', etiqueta);
          assert.ok(antes.line.left >= antes.focus.right - 2, `${etiqueta}: la línea queda a la derecha de tu carta (${antes.line.left} ≥ ${antes.focus.right})`);
          assert.ok(antes.line.width > antes.innerWidth * 0.5, `${etiqueta}: la línea ocupa más de la mitad`);
          assert.ok(antes.doc <= antes.inner + 1, `${etiqueta}: la partida cabe sin desplazarse (${antes.doc} ≤ ${antes.inner})`);
          assert.ok(antes.line.bottom <= antes.inner + 1, `${etiqueta}: la línea cabe a lo alto`);
          assert.ok(antes.card.height >= 280, `${etiqueta}: las cartas de la línea son grandes (${antes.card.height})`);
          // Colocar una carta: el resultado sale en la columna izquierda y no alarga la página.
          await page.locator('.board-timeline-section .slot').first().click();
          await page.getByRole('button', {name: /Colocar carta/i}).first().click();
          await page.locator('.board-result-layer .modal.board-result').waitFor();
          await page.waitForTimeout(300);
          const despues = await medir();
          assert.ok(despues.result, `${etiqueta}: aparece el resultado`);
          assert.ok(despues.result.right <= despues.line.left + 2, `${etiqueta}: el resultado queda en la columna izquierda`);
          assert.ok(despues.result.bottom <= despues.inner + 1 && despues.result.top >= 0, `${etiqueta}: el resultado se ve entero`);
          assert.ok(despues.doc <= despues.inner + 1, `${etiqueta}: el resultado no alarga la página (${despues.doc})`);
        } else {
          assert.equal(antes.tablet, width >= 700 ? 'vertical' : null, etiqueta);
          assert.ok(antes.focus.width < antes.innerWidth, etiqueta);
        }
        assert.deepEqual(errors, [], `${etiqueta}: sin errores de página`);
        await page.screenshot({path: path.join(destination, `tablet-${engine}-${width}x${height}.png`)});
        console.log(`ok   ${etiqueta}: ${modo}`);
      } finally { await page.close(); }
    }
    await browser.close(); browser = null;
  }
  console.log('Tabletas en navegador: mesa a escala en móvil y vertical, dos columnas en horizontal: OK');
} finally { await browser?.close(); server.close(); }
