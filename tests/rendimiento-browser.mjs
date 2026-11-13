// Rendimiento en un móvil modesto: Chromium con la CPU frenada (CDP) mide cuánto tarda en salir el Inicio, cuánto
// tarda cada toque de una partida en verse en pantalla, los fotogramas que se pierden con las animaciones y si la
// memoria o el número de nodos crecen al encadenar partidas. Además compara una mesa de 2 jugadores con otra de 10
// (el máximo en «Un solo móvil»): con más gente en la mesa, cada turno no puede costar mucho más.
//
// Los límites son holgados a propósito: avisan de un salto (un bucle de más, una fuga, un repintado de toda la
// página en cada toque), no de unos milisegundos. Cada ejecución imprime sus cifras y las guarda en
// test-results/rendimiento/cifras.json para comparar. RENDIMIENTO_CPU cambia el freno (por defecto 4×).
import { servirJuego, chromium, opcionesLanzamiento } from './lib/navegador.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const CPU = Number(process.env.RENDIMIENTO_CPU) || 4;
const LIMITES = {
  inicioMs: 6000,           // del goto al Inicio pintado y quieto
  toqueP95Ms: 700,          // toque → siguiente fotograma, percentil 95 (aquí, unos 300 ms)
  toqueMaxMs: 1500,         // el peor toque de la partida
  fotogramaLargoPct: 25,    // % de fotogramas de más de 50 ms mientras se anima un turno
  diezFrenteADos: 2.5,      // coste de un turno con 10 jugadores frente a 2
  heapCrecimientoMb: 8,     // memoria tras 4 partidas más, después de recoger basura
  nodosCrecimiento: 1500,   // nodos del DOM (y retenidos) tras 4 partidas más
};
const TURNOS = 12;

const pct = (lista, p) => { const s = [...lista].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const media = lista => lista.reduce((a, b) => a + b, 0) / lista.length;
const redondea = v => Math.round(v * 10) / 10;

const server = await servirJuego();
const url = `http://127.0.0.1:${server.address().port}/`;
const cifras = { cpu: CPU };
let browser;
try {
  browser = await chromium.launch(opcionesLanzamiento('chromium', { args: ['--js-flags=--expose-gc'] }));
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('continuum-splash-seen-v2', '1');
    localStorage.setItem('continuum-identidad-v1', JSON.stringify({ nombre: 'Prueba' }));
    // Baraja fija: cada ejecución juega las mismas cartas.
    let seed = 20261113; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  // ── Arranque: del goto al Inicio pintado y quieto ──
  const t0 = Date.now();
  await page.goto(url);
  await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
  await page.locator('.home-nav').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('.motion-entering'));
  cifras.inicioMs = Date.now() - t0;

  // Un toque medido dentro de la página: del click al fotograma siguiente ya pintado.
  const toque = sel => page.evaluate(sel => new Promise((resolve, reject) => {
    const el = document.querySelector(sel);
    if (!el) return reject(Error(`no está ${sel}`));
    const t = performance.now();
    el.click();
    requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - t)));
  }), sel);
  // Fotogramas mientras se anima lo que acaba de pasar: cuántos pasan de 50 ms.
  const fotogramas = ms => page.evaluate(ms => new Promise(resolve => {
    const marcas = []; const fin = performance.now() + ms;
    const paso = t => { marcas.push(t); t < fin ? requestAnimationFrame(paso) : resolve(marcas.slice(1).map((v, i) => v - marcas[i])); };
    requestAnimationFrame(paso);
  }), ms);
  const pantalla = () => page.evaluate(() => document.getElementById('app').dataset.screen);

  // `elegido`: el mazo de Historia ya está escogido y se abre «Un solo móvil» sin pasar por los menús.
  async function mesa(jugadores, elegido = false) {
    if (!elegido) {
      await page.evaluate(() => window.CONTINUUM.ModeHubs.open('hub-solo'));
      await page.locator('[data-inline-route="collections"]').click();
      await page.locator('[data-block="historia"]').click();
      await page.locator('[data-mode="history"]').click();
    }
    await page.evaluate(() => window.CONTINUUM.openDeckAs('local'));
    // La pantalla recuerda la mesa anterior: se deja con los que toquen.
    while (await page.locator('#players .player-row').count() > jugadores) await page.locator('[data-action="remove-player"]').first().click();
    while (await page.locator('#players .player-row').count() < jugadores) await page.locator('[data-action="add-player"]').click();
    await page.locator('[data-action="start"]').click();
    for (let i = 0; await page.locator('#starter-guess-input').count(); i++) {
      await page.locator('#starter-guess-input').fill(String(1000 + i * 37));
      await page.locator('[data-action="starter-guess-submit"]').click();
    }
    await page.locator('[data-action="starter-start"]').click();
  }

  // Un turno: preparado → hueco → «Colocar carta» → pasar el turno. Devuelve los toques medidos y los fotogramas
  // de la animación del resultado.
  async function turno() {
    const toques = [];
    if (await pantalla() === 'pass') { await page.locator('[data-action="ready"]').waitFor(); toques.push(await toque('[data-action="ready"]')); }
    await page.locator('.slot:not([disabled])').first().waitFor();
    toques.push(await toque('.slot:not([disabled])'));
    await page.locator('[data-action="confirm-place"]').waitFor();
    toques.push(await toque('[data-action="confirm-place"]'));
    const frames = await fotogramas(900);
    // Tras acertar se puede seguir colocando o pasar; tras fallar solo se sigue. Se pasa siempre.
    const siguiente = page.locator('[data-action="finish-turn"], [data-action="next-turn"], [data-action="continue-turn"]').first();
    await siguiente.waitFor();
    const accion = await siguiente.getAttribute('data-action');
    toques.push(await toque(`[data-action="${accion}"]`));
    return { toques, frames };
  }

  async function partida(jugadores, turnos) {
    await mesa(jugadores);
    const toques = [], frames = [];
    for (let i = 0; i < turnos && !['winner', 'final-local'].includes(await pantalla()); i++) {
      const r = await turno();
      toques.push(...r.toques); frames.push(...r.frames);
    }
    await page.goto(url);
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    await page.locator('.home-nav').first().waitFor();
    return { toques, frames };
  }

  // ── 2 jugadores frente a 10 ──
  const dos = await partida(2, TURNOS);
  const diez = await partida(10, TURNOS);
  const resumen = ({ toques, frames }) => ({
    toques: toques.length, p50: redondea(pct(toques, 50)), p95: redondea(pct(toques, 95)), max: redondea(Math.max(...toques)), media: redondea(media(toques)),
    fotogramas: frames.length, largosPct: redondea(100 * frames.filter(f => f > 50).length / frames.length)
  });
  cifras.dosJugadores = resumen(dos);
  cifras.diezJugadores = resumen(diez);

  // ── Memoria: una partida para calentar, medida, cuatro partidas más, medida ──
  const memoria = async () => {
    await page.evaluate(() => window.gc?.());
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
    return { heapMb: m.JSHeapUsedSize / 1048576, nodos: m.Nodes, oyentes: m.JSEventListeners };
  };
  // Sin recargar entre partidas: así se queda lo que una partida no suelte.
  async function partidaSinRecargar(jugadores, turnos) {
    await mesa(jugadores, true);
    for (let i = 0; i < turnos && !['winner', 'final-local'].includes(await pantalla()); i++) await turno();
    await page.evaluate(() => window.CONTINUUM.localNavigate('jugar'));
    await page.locator('.home-nav').first().waitFor();
  }
  await mesa(2);
  await page.evaluate(() => window.CONTINUUM.localNavigate('jugar'));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await partidaSinRecargar(10, 6);
  const antes = await memoria();
  for (let i = 0; i < 4; i++) await partidaSinRecargar(10, 6);
  const despues = await memoria();
  cifras.memoria = { antes: { heapMb: redondea(antes.heapMb), nodos: antes.nodos, oyentes: antes.oyentes }, despues: { heapMb: redondea(despues.heapMb), nodos: despues.nodos, oyentes: despues.oyentes } };

  console.log(JSON.stringify(cifras, null, 2));
  await fs.mkdir('test-results/rendimiento', { recursive: true });
  await fs.writeFile('test-results/rendimiento/cifras.json', JSON.stringify(cifras, null, 2));

  // ── Límites ──
  assert.deepEqual(errors, [], 'sin errores de página');
  assert.ok(cifras.inicioMs < LIMITES.inicioMs, `el Inicio sale en ${cifras.inicioMs} ms (límite ${LIMITES.inicioMs})`);
  for (const [nombre, r] of [['2 jugadores', cifras.dosJugadores], ['10 jugadores', cifras.diezJugadores]]) {
    assert.ok(r.toques >= TURNOS * 3, `${nombre}: se jugaron los turnos (${r.toques} toques)`);
    assert.ok(r.p95 < LIMITES.toqueP95Ms, `${nombre}: toque p95 ${r.p95} ms (límite ${LIMITES.toqueP95Ms})`);
    assert.ok(r.max < LIMITES.toqueMaxMs, `${nombre}: peor toque ${r.max} ms (límite ${LIMITES.toqueMaxMs})`);
    assert.ok(r.largosPct < LIMITES.fotogramaLargoPct, `${nombre}: ${r.largosPct} % de fotogramas largos (límite ${LIMITES.fotogramaLargoPct} %)`);
  }
  const ratio = cifras.diezJugadores.media / cifras.dosJugadores.media;
  cifras.diezFrenteADos = redondea(ratio);
  assert.ok(ratio < LIMITES.diezFrenteADos, `un turno con 10 jugadores cuesta ${redondea(ratio)}× el de 2 (límite ${LIMITES.diezFrenteADos}×)`);
  assert.ok(despues.heapMb - antes.heapMb < LIMITES.heapCrecimientoMb, `la memoria crece ${redondea(despues.heapMb - antes.heapMb)} MB en 4 partidas (límite ${LIMITES.heapCrecimientoMb})`);
  assert.ok(despues.nodos - antes.nodos < LIMITES.nodosCrecimiento, `los nodos crecen ${despues.nodos - antes.nodos} en 4 partidas (límite ${LIMITES.nodosCrecimiento})`);
  console.log(`Rendimiento con la CPU a 1/${CPU}: OK (10 jugadores = ${redondea(ratio)}× 2 jugadores)`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
