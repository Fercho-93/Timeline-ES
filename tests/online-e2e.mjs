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
