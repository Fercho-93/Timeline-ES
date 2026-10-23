// La mano en abanico es un carrusel: deslizar el dedo la gira tantas cartas como el dedo recorra (y algo más si
// va rápido), da la vuelta sin extremos, deja ver las cartas del fondo y, al soltar, siempre queda una carta en el
// centro y es la elegida. Con gestos táctiles reales (CDP), de 8 o 9 cartas a 3 para probar también la vuelta de las
// manos pequeñas. PLAYWRIGHT_MODULE y CHROME_PATH como en el resto de pruebas con navegador.
import { servirJuego, chromium, opcionesLanzamiento } from './lib/navegador.mjs';
import assert from 'node:assert/strict';
const server = await servirJuego();
let browser;
try {
  browser = await chromium.launch(opcionesLanzamiento());
  const page = await browser.newPage({viewport: {width: 390, height: 850}, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'no-preference'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('continuum-identidad-v1', JSON.stringify({nombre: 'Prueba'})));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
  const dismissSplash = () => page.evaluate(() => document.querySelector('[data-quick-splash]')?.click());
  // Retos rápidos, un solo móvil, dos personas, un reto: una mano de 8 cartas.
  if (await page.locator('[data-action="toggle-modes"][aria-expanded="false"]').count()) await page.locator('[data-action="toggle-modes"]').click();
  await page.locator('[data-action="friends-hub"]').click();
  await page.locator('[data-action="local-hub"]').click();
  await page.locator('[data-friend-quick="local"]').click();
  await page.locator('.quick-length-chip[data-length="1"]').click();
  await page.locator('[data-quick="start"]').click();
  for (const guess of ['10', '11']) {
    await page.locator('#quick-starter-input').fill(guess);
    await page.locator('[data-quick="starter-guess"]').click();
  }
  await page.locator('[data-quick="starter-go"]').click();
  await dismissSplash();
  await page.waitForTimeout(200);
  if (await page.locator('[data-quick="ready"]').count()) await page.locator('[data-quick="ready"]').click();
  await page.waitForSelector('.hand-fan .hand-card');
  const cdp = await page.context().newCDPSession(page);
  const rest = () => page.waitForFunction(() => ![...document.querySelectorAll('.hand-fan .hand-card')].some(card => card.getAnimations().length), null, {timeout: 4000});
  const hand = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll('.hand-fan .hand-card')];
    const offsets = cards.map(card => Number(card.style.getPropertyValue('--fan-offset')));
    const shown = cards.map(card => {const style = getComputedStyle(card); return style.visibility !== 'hidden' && Number(style.opacity) > .5;});
    return {
      ids: cards.map(card => card.dataset.id), offsets, total: cards.length,
      center: cards.find(card => card.classList.contains('fan-center'))?.dataset.id,
      selected: cards.find(card => card.classList.contains('selected'))?.dataset.id,
      centers: cards.filter(card => card.classList.contains('fan-center')).length, everyoneShown: shown.every(Boolean)
    };
  });
  // Las invariantes en reposo: todas se ven, cada una en su sitio, y una sola en el centro: la elegida.
  const settled = async label => {
    await rest();
    const state = await hand();
    assert.equal(new Set(state.offsets).size, state.total, `${label}: dos cartas en el mismo sitio (${state.offsets})`);
    assert.ok(state.everyoneShown, `${label}: con tan pocas cartas todas se ven`);
    assert.equal(state.centers, 1, `${label}: una sola carta en el centro`);
    assert.ok(!state.selected || state.selected === state.center, `${label}: la del centro es la elegida`);
    return state;
  };
  const swipe = async (from, to, {steps = 10, pause = 16} = {}) => {
    const box = await page.locator('.hand-fan').boundingBox(), y = box.y + box.height / 2;
    // Cada toque lleva su marca de tiempo: la velocidad del gesto (que decide la inercia) sale de `pause`
    // y no de lo despacio que vaya el equipo que ejecuta la prueba.
    const t0 = Date.now() / 1000;
    const send = (type, x, ms) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y, id: 1}], timestamp: t0 + ms / 1000});
    await send('touchStart', from, 0);
    for (let i = 1; i <= steps; i++) {await send('touchMove', from + (to - from) * i / steps, i * pause); await page.waitForTimeout(8);}
    await send('touchEnd', to, steps * pause);
  };
  const shift = (before, after) => { // cuántas cartas se movió el centro, con vuelta
    const n = before.total, d = ((after.ids.indexOf(after.center) - before.ids.indexOf(before.center)) % n + n) % n;
    return d > n / 2 ? d - n : d;
  };

  let before = await settled('inicio');
  assert.ok(before.total >= 8, `una mano de 8 o más cartas (${before.total})`);
  // Se ven más cartas que las cinco de siempre: el fondo asoma a los dos lados.
  assert.ok(before.offsets.some(offset => Math.abs(offset) >= 3), 'hay cartas del fondo a la vista');
  const farthest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.hand-fan .hand-card')].map(card => Math.abs(Number(card.style.getPropertyValue('--fan-offset'))))));
  assert.ok(farthest >= 3);

  // Un arrastre corto y lento no cambia de carta; uno de una carta, avanza una; uno largo, varias.
  // (sobre la carta del centro: un movimiento de menos de 12 px cuenta como un toque, y tocar otra la elegiría)
  await swipe(205, 190, {steps: 8, pause: 50}); let after = await settled('corto');
  assert.equal(shift(before, after), 0, 'un arrastre corto vuelve a su sitio');
  before = after;
  await swipe(260, 200, {steps: 12, pause: 50}); after = await settled('una carta');
  assert.equal(shift(before, after), 1, 'arrastrar a la izquierda trae la siguiente');
  before = after;
  await swipe(100, 290, {steps: 19, pause: 30}); after = await settled('tres cartas');
  // Valor absoluto: en una mano de 9, recorrer 5 cartas hacia un lado se mide como 4 hacia el otro (`shift` toma el camino corto).
  assert.ok(Math.abs(shift(before, after)) >= 2, `un arrastre largo a la derecha recorre varias cartas (${shift(before, after)})`);
  before = after;
  await swipe(340, 110, {steps: 6, pause: 10}); after = await settled('flick');
  assert.ok(Math.abs(shift(before, after)) >= 3, `un gesto rápido sigue girando por inercia (${shift(before, after)})`);
  // Las flechas, encima de las cartas de los lados, también son zona de deslizamiento.
  before = after;
  await swipe(28, 200, {steps: 10, pause: 20}); after = await settled('desde la flecha');
  assert.notEqual(shift(before, after), 0, 'deslizar empezando en una flecha gira el abanico');
  before = after;
  await page.locator('[data-fan-step="1"]').click(); after = await settled('flecha');
  assert.equal(shift(before, after), 1, 'la flecha avanza una carta');

  // Con pocas cartas (donde la vuelta casi se ve) todo sigue en su sitio.
  const play = async () => {
    await dismissSplash();
    const card = await page.evaluate(() => {
      const CT = window.CONTINUUM, E = CT.QuickEngine, state = E.restore(JSON.parse(localStorage.getItem('continuum-quick-challenges-v1')));
      const challenge = E.challenge(state.config.rounds[state.index].id), value = id => challenge.cards.find(item => item.id === id).value * challenge.direction;
      const cardId = state.remaining[0];
      for (let index = 0; index <= state.timeline.length; index++) if (CT.Engine.fits(state.timeline, cardId, index, value)) return {cardId, index};
    });
    // En el abanico, una carta del borde puede quedar bajo su vecina: este ayudante solo vacía la mano, así que
    // la elige por código en vez de por el punto donde la tocaría un dedo.
    await page.locator(`[data-quick="select"][data-id="${card.cardId}"]`).evaluate(el => el.click());
    await page.locator(`[data-quick="slot"][data-index="${card.index}"]`).click();
    await page.locator('[data-quick="confirm"]').click();
    await page.locator('[data-quick="ack"]').click();
    await page.waitForTimeout(450);
  };
  for (const total of [5, 3]) {
    while (await page.locator('.hand-fan .hand-card').count() > total) await play();
    before = await settled(`${total} cartas`);
    await swipe(250, 150, {pause: 40}); after = await settled(`${total} cartas, deslizar`);
    assert.notEqual(shift(before, after), 0);
    before = after;
    await swipe(80, 330, {steps: 6, pause: 10}); after = await settled(`${total} cartas, gesto rápido`);
    assert.equal(after.total, total);
  }
  assert.deepEqual(errors, [], 'sin errores en la página');
  console.log('Mano en abanico: carrusel con fondo visible, arrastre, inercia, flechas y manos pequeñas: OK');
} finally {
  await browser?.close();
  server.close();
}
