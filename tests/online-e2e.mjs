// Recorrido de extremo a extremo de «Jugar online» con varias personas a la vez, en
// Chromium y contra los emuladores (ver online-e2e-harness.mjs). Uso:
//   npm run test:online-e2e
import assert from 'node:assert/strict';
import { startHarness } from './online-e2e-harness.mjs';
const h = await startHarness();
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? 'ok  ' : 'FALLA'} ${label}`); };
const flat = t => t.replace(/\s+/g, ' ');
async function openHub(p) { await p.click('[data-action="toggle-modes"]', { wait: 600 }); await p.click('[data-action="online-hub"]'); }
async function search(p, kind = 'surprise', capacity = '0') {
  if (await p.screen() !== 'hub-online') { await p.click('[data-action="home-top"]').catch(() => {}); await openHub(p); }
  await p.page.selectOption('#mode-public-capacity', capacity);
  await p.click(`[data-action="public-match"][data-online-kind="${kind}"]`, { wait: 100 });
  await p.waitScreen('online-lobby', 20000).catch(async error => {
    console.log(`  ${p.label} no llega a la mesa: ${await p.screen()} · ${flat(await p.text()).slice(0, 200)}`);
    console.log(p.log.slice(-8).join('\n'));
    throw error;
  });
  await p.page.waitForTimeout(800);
}
const seats = p => p.page.locator('.public-seat:not(.is-empty)').count();
async function boardLayout(p) {
  return p.page.evaluate(() => {
    const app=document.getElementById('app'),hand=app.querySelector('.hand'),timeline=app.querySelector('.timeline-wrap');
    return {screen:app.dataset.screen,fit:app.dataset.boardFit,zoom:app.querySelector('.timeline-zoom output')?.textContent?.trim(),
      height:document.documentElement.scrollHeight,viewport:visualViewport?.height||innerHeight,
      width:document.documentElement.scrollWidth,fan:hand?.classList.contains('hand-fan'),
      order:hand&&timeline&&hand.getBoundingClientRect().top<timeline.getBoundingClientRect().top};
  });
}
async function answer(p, value) {
  await p.page.locator('#starter-guess-input').waitFor({ timeout: 15000 });
  await p.page.fill('#starter-guess-input', String(value));
  await p.click('[data-online-action="starter-guess-submit"]', { wait: 600 });
}
async function cardValue(p) {
  const title = (await p.page.locator('.public-starter .starter-card strong').first().textContent()).trim();
  return p.page.evaluate(t => { const CT = window.CONTINUUM, mode = document.querySelector('.public-lobby-head h2').textContent.trim(); const key = Object.keys(CT.MODES).find(k => CT.MODES[k].name === mode); const card = CT.cards(key).find(c => c.title === t); return CT.sortValue(key, card); }, title);
}

try {
  const [a, b, c] = [await h.player('A'), await h.player('B'), await h.player('C')];
  await a.enter('Ana'); await b.enter('Bruno'); await c.enter('Carla');
  for (const p of [a, b, c]) await openHub(p);

  console.log('\nUna persona sola busca');
  await search(a);
  ok('entra en una mesa y ve que se busca gente', /Buscando jugadores/.test(flat(await a.text())));
  ok('no se ve «Anfitrión» ni la caja técnica de conexión', !/Anfitrión/.test(await a.text()) && !(await a.page.locator('#room-connection').count()));
  await a.shot('e2e-01-sola');

  console.log('\nEntra una segunda persona: cuenta atrás y minijuego');
  await search(b);
  await a.page.waitForTimeout(1500);
  ok('las dos ven la mesa con dos jugadores', await seats(a) === 2 && await seats(b) === 2);
  ok('empieza la cuenta atrás', /La partida empieza en 0:\d\d/.test(flat(await b.text())));
  ok('sale la carta del minijuego mientras se espera', await a.page.locator('#starter-guess-input').count() === 1);
  const real = await cardValue(a);
  await answer(a, Math.round(real + 5000));
  await answer(b, Math.round(real));

  console.log('\nEntra una tercera persona tarde y no responde');
  await b.page.waitForTimeout(8000);
  const before = await b.page.locator('#public-clock').textContent();
  await search(c);
  await b.page.waitForTimeout(1200);
  const after = await b.page.locator('#public-clock').textContent();
  ok(`al entrar alguien, la cuenta vuelve a empezar (${before} → ${after})`, Number(after.split(':')[1]) > Number(before.split(':')[1]));
  ok('quien entra tarde ve la misma carta', await c.page.locator('#starter-guess-input').count() === 1);
  await c.shot('e2e-02-tres');
  const t0 = Date.now();
  await Promise.all([a, b, c].map(p => p.waitScreen('online-game', 60000)));
  const waited = Math.round((Date.now() - t0) / 1000);
  ok(`la partida empieza sola al acabar la cuenta atrás (${waited} s)`, waited >= 20 && waited <= 40);
  await b.page.waitForTimeout(1500);
  const order = await b.page.$$eval('.scoreboard .score-copy b', els => els.map(e => e.textContent.replace(' · tú', '').trim()));
  ok(`orden por cercanía y quien no respondió al final (${order.join(', ')})`, order.join(',') === 'Bruno,Ana,Carla');
  ok('empieza quien más se acercó', /Tu turno/.test(await b.page.locator('.turn-name').textContent()));
  await b.shot('e2e-03-partida');
  const onlineBoard=await boardLayout(b);
  ok(`la mesa online cabe al 100 % sin scroll (${onlineBoard.height}/${onlineBoard.viewport})`,
    onlineBoard.screen==='online-game'&&onlineBoard.height<=onlineBoard.viewport+2&&onlineBoard.width<=390+2&&onlineBoard.zoom==='100%');
  ok('la mano online conserva el abanico encima de la línea',onlineBoard.fan&&onlineBoard.order);
  for (const p of [a, b, c]) await p.ctx.close();

  console.log('\nQuien lleva la mesa se va: el relevo es automático');
  const [d, e, f] = [await h.player('D'), await h.player('E'), await h.player('F')];
  await d.enter('Diego'); await e.enter('Elena'); await f.enter('Félix');
  for (const p of [d, e, f]) await openHub(p);
  await search(d, 'surprise', '4');
  ok('justo después de empezar otra partida, buscar sigue funcionando (antes fallaba al leer la mesa ya en juego)', await seats(d) === 1);
  await search(e, 'surprise', '4');
  await d.page.waitForTimeout(1000);
  await d.click('[data-online-action="leave-public"]', { wait: 1500 });
  ok('quien se va vuelve a «Jugar online»', await d.screen() === 'hub-online');
  await e.page.waitForTimeout(1500);
  ok('su plaza queda libre en seguida', await seats(e) === 1);
  await e.page.waitForFunction(() => document.querySelector('.public-status')?.textContent.includes('Buscando'), null, { timeout: 30000 });
  await e.page.waitForTimeout(20000);
  await search(f, 'surprise', '4');
  await e.page.waitForTimeout(2000);
  ok('quien queda puede seguir: entra otra persona y la mesa vuelve a arrancar', await seats(e) === 2 && /empieza en/.test(flat(await e.text())));
  await e.shot('e2e-04-relevo');
  for (const p of [d, e, f]) await p.ctx.close();

  console.log('\nAlguien busca solo y se va: nadie entra en una mesa fantasma');
  const [g, i] = [await h.player('G'), await h.player('I')];
  await g.enter('Gloria'); await i.enter('Iván');
  for (const p of [g, i]) await openHub(p);
  await search(g, 'surprise', '3');
  await g.click('#app .topbar .atlas-back, #app .topbar [aria-label="Volver"]', { wait: 1500 });
  ok('la flecha de volver también deja de buscar y vuelve a «Jugar online»', await g.screen() === 'hub-online');
  await search(i, 'surprise', '3');
  ok('la siguiente persona empieza una mesa nueva, sin nadie fantasma', await seats(i) === 1 && !/Gloria/.test(await i.text()));
  for (const p of [g, i]) await p.ctx.close();

  console.log('\nGrandes colecciones: elegir tema');
  const [t1, t2] = [await h.player('T1'), await h.player('T2')];
  await t1.enter('Teo'); await t2.enter('Tania');
  for (const p of [t1, t2]) {
    await openHub(p);
    await p.page.selectOption('#mode-public-capacity', '2');
    await p.click('[data-action="online-collections"]');
    await p.page.locator('[data-public-topic]').first().check();
    await p.click('[data-action="public-match"][data-online-kind="collections-vote"]', { wait: 100 });
    await p.waitScreen('online-lobby', 20000);
  }
  await t1.page.waitForTimeout(1500);
  const tema = (await t1.page.locator('.public-lobby-head h2').textContent()).trim();
  ok(`quien elige el mismo tema entra en la misma mesa (${tema})`, await seats(t1) === 2 && await seats(t2) === 2);
  const realT = await cardValue(t1);
  await answer(t1, Math.round(realT)); await answer(t2, Math.round(realT + 10));
  await Promise.all([t1, t2].map(p => p.waitScreen('online-game', 20000)));
  ok('con la mesa completa y todos respondidos, empieza sin esperar la cuenta atrás', await t1.screen() === 'online-game');
  for (const p of [t1, t2]) await p.ctx.close();

  console.log('\nMesas abiertas: crear una con su configuración y entrar desde la lista');
  const [m1, m2, k1, k2] = [await h.player('M1'), await h.player('M2'), await h.player('K1'), await h.player('K2')];
  await m1.enter('Marta'); await m2.enter('Mario'); await k1.enter('Kiko'); await k2.enter('Katia');
  for (const p of [m1, m2, k1, k2]) await openHub(p);
  const crear = async (p, { kind, capacity, seconds, deck = 1 }) => {
    await p.click('[data-action="public-create"]');
    await p.page.locator(`input[data-public-create="kind"][value="${kind}"]`).check({ force: true });
    if (kind === 'collections') await p.page.selectOption('#public-create-mode', { index: deck });
    await p.page.locator(`input[data-public-create="capacity"][value="${capacity}"]`).check({ force: true });
    await p.page.locator(`input[data-tiempo="publica"][value="${seconds}"]`).check({ force: true });
    await p.click('[data-action="public-create-go"]', { wait: 1500 });
  };
  await crear(m1, { kind: 'collections', capacity: 2, seconds: 15 });
  await m1.waitScreen('online-lobby', 20000);
  const mazo = (await m1.page.locator('.public-lobby-head h2').textContent()).trim();
  ok('la mesa creada lleva el tiempo elegido', /15 s por turno/.test(flat(await m1.text())));
  const fila = m2.page.locator('.public-table', { hasText: 'Marta' });
  await fila.waitFor({ timeout: 20000 }).catch(() => {});
  ok(`la mesa aparece en la lista de los demás con su configuración (${mazo})`, (await fila.count()) === 1 && /15 s por carta/.test(flat(await fila.textContent())) && flat(await fila.textContent()).includes(mazo));
  await m2.shot('e2e-04b-mesas-abiertas');
  await fila.locator('[data-action="public-join"]').click();
  await m2.waitScreen('online-lobby', 20000);
  await m1.page.waitForTimeout(1500);
  ok('al pulsar «Unirme» se sienta en esa mesa', await seats(m1) === 2 && await seats(m2) === 2 && /15 s por turno/.test(flat(await m2.text())));
  await k2.page.waitForTimeout(2500);
  ok('una mesa llena desaparece de la lista', !(await k2.page.locator('.public-table', { hasText: 'Marta' }).count()));
  const realM = await cardValue(m1);
  await answer(m1, Math.round(realM)); await answer(m2, Math.round(realM + 10));
  await Promise.all([m1, m2].map(p => p.waitScreen('online-game', 20000)));
  const reloj = Number(await m1.page.locator('#turn-timer-value').textContent().catch(() => 'NaN'));
  ok(`y la partida empieza con ese tiempo por turno (${reloj} s)`, reloj > 0 && reloj <= 15);
  await crear(k1, { kind: 'quick', capacity: 2, seconds: 20 });
  await k1.page.waitForTimeout(1500);
  const filaK = k2.page.locator('.public-table', { hasText: 'Kiko' });
  await filaK.waitFor({ timeout: 20000 }).catch(() => {});
  ok('también se anuncian las mesas de Retos rápidos', (await filaK.count()) === 1 && /Retos rápidos/.test(await filaK.textContent()) && /20 s por carta/.test(await filaK.textContent()));
  await filaK.locator('[data-action="public-join"]').click();
  await k2.page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'quick-game' || /reto 1 de 3/i.test(document.body.textContent), null, { timeout: 30000 }).catch(() => {});
  ok('con la mesa llena empieza el reto con su tiempo por carta', /reto 1 de 3/i.test(flat(await k2.text())));
  for (const p of [m1, m2, k1, k2]) {
    const errors = p.log.filter(l => /pageerror|PERMISSION|permission-denied/i.test(l));
    ok(`${p.label}: sin errores en la consola`, !errors.length);
    if (errors.length) console.log(errors.join('\n'));
    await p.ctx.close();
  }

  console.log('\nRetos rápidos en mesa pública');
  const [q1, q2, q3] = [await h.player('Q1'), await h.player('Q2'), await h.player('Q3')];
  await q1.enter('Quino'); await q2.enter('Queralt'); await q3.enter('Quique');
  for (const p of [q1, q2, q3]) await openHub(p);
  const quick = async p => { await p.page.selectOption('#mode-public-capacity', '4'); await p.click('[data-action="quick-public"]', { wait: 2500 }); };
  await quick(q1); await quick(q3);
  await q3.page.waitForTimeout(1500);
  await q3.click('[data-quick="leave-public"]', { wait: 1500 });
  await q1.page.waitForTimeout(1500);
  ok('en Retos rápidos también se puede dejar de buscar sin ocupar la plaza', !/Quique/.test(await q1.text()));
  await quick(q2);
  await q1.page.waitForTimeout(1500);
  ok('con dos personas corre la cuenta atrás', /empieza en 0:\d\d/.test(flat(await q2.text())));
  await q2.shot('e2e-05-retos');
  await q2.page.waitForFunction(() => !document.querySelector('.public-lobby'), null, { timeout: 60000 }).catch(() => {});
  ok('y la partida de Retos rápidos empieza sola', !(await q2.page.locator('.public-lobby').count()) && /reto 1 de 3/i.test(flat(await q2.text())));
  await q2.shot('e2e-06-retos-partida');
  if(await q2.screen()==='quick-game') {
    const quickBoard=await boardLayout(q2);
    ok(`la mesa del reto online cabe al 100 % (${quickBoard.height}/${quickBoard.viewport})`,
      quickBoard.height<=quickBoard.viewport+2&&quickBoard.width<=390+2&&quickBoard.zoom==='100%'&&quickBoard.fan&&quickBoard.order);
  }

  for (const p of [q1, q2, q3]) {
    const errors = p.log.filter(l => /pageerror|PERMISSION|permission-denied/i.test(l));
    ok(`${p.label}: sin errores en la consola`, !errors.length);
    if (errors.length) console.log(errors.join('\n'));
  }
} finally {
  await h.close();
}
console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
