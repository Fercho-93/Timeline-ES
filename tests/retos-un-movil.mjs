// Retos rápidos en un solo móvil: el reto diario a medias no se pierde al empezar otra partida, el reloj no corre
// mientras se pasa el móvil y «Guardar y salir» lo congela.
import { gameHtml } from './game-fixture.mjs';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const KEY = 'continuum-quick-challenges-v1', DAILY = 'continuum-quick-daily-v1', TURN = 'continuum-quick-turn-v1';
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? 'ok  ' : 'FALLA'} ${label}`); };
function boot(almacen = {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test/' }).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  Object.entries(almacen).forEach(([k, v]) => w.localStorage.setItem(k, v));
  scripts.forEach(f => w.eval(read(f)));
  let desfase = 0; const base = w.Date.now.bind(w.Date);
  w.Date.now = () => base() + desfase;
  w.adelanta = ms => { desfase += ms; };
  return w;
}
const $ = (w, sel) => w.document.querySelector(sel);
const click = (w, sel) => { const el = $(w, sel); assert.ok(el, sel); el.click(); };
const paint = w => h => { $(w, '#app').innerHTML = h; };
const today = new Date().toLocaleDateString('sv-SE');

console.log('\nEl reto diario a medias no se pierde');
{
  const w = boot(), CT = w.CONTINUUM, E = CT.QuickEngine;
  CT.Quick.startDaily(today, paint(w));
  click(w, '[data-quick="ready"]');
  const cardId = E.restore(JSON.parse(w.localStorage.getItem(DAILY))).remaining[0];
  click(w, `[data-quick="select"][data-id="${cardId}"]`); click(w, '[data-quick="slot"][data-index="0"]'); click(w, '[data-quick="confirm"]');
  ok('el reto diario se guarda en su hueco propio', JSON.parse(w.localStorage.getItem(DAILY)).commands.length === 1 && w.localStorage.getItem(KEY) === null);
  // Otra partida (aquí, una libre en solitario) usa el hueco de siempre y no toca el del reto diario.
  CT.Quick.openSolo(paint(w));
  click(w, '[data-quick="play-random"]'); click(w, '[data-quick="ready"]');
  ok('la otra partida se guarda aparte', JSON.parse(w.localStorage.getItem(KEY))?.config?.kind === 'free');
  ok('y el reto diario sigue a medias', CT.Quick.dailyPending(today) && JSON.parse(w.localStorage.getItem(DAILY)).commands.length === 1);
  w.close();
}
{
  // Un reto diario a medias guardado por una versión anterior (en el hueco común) pasa a su hueco propio.
  const w0 = boot(), E0 = w0.CONTINUUM.QuickEngine, c = E0.challenge('poker');
  const viejo = JSON.stringify({ version: w0.CONTINUUM.QuickCatalog.version, config: { names: ['Tú'], rounds: [{ id: c.id, order: c.cards.map(x => x.id) }], kind: 'daily', day: today }, commands: [] });
  w0.close();
  const w = boot({ [KEY]: viejo });
  ok('el de una versión anterior se reconoce', w.CONTINUUM.Quick.dailyPending(today));
  ok('y se mueve a su hueco', w.localStorage.getItem(DAILY) === viejo && w.localStorage.getItem(KEY) === null);
  w.close();
}

console.log('\nEl reloj en un solo móvil');
{
  const w0 = boot(), E0 = w0.CONTINUUM.QuickEngine, c = E0.challenge('albums-sales');
  const partida = JSON.stringify({ version: w0.CONTINUUM.QuickCatalog.version, config: { names: ['Ana', 'Luis'], rounds: [{ id: c.id, order: c.cards.map(x => x.id).slice(0, 11) }], kind: 'local', historyId: 'prueba-reloj', seconds: 15 }, commands: [] });
  w0.close();
  const w = boot({ [KEY]: partida }), CT = w.CONTINUUM;
  CT.Quick.openLocal(paint(w));
  click(w, '[data-quick="resume"]');
  ok('antes del turno se pasa el móvil, sin reloj', !!$(w, '[data-quick="turn-ready"]') && !$(w, '.reloj-bar') && /Ana/.test($(w, '.pass-screen').textContent));
  w.adelanta(30000);
  click(w, '[data-quick="turn-ready"]');
  ok('el reloj empieza al pulsar «Empezar mi turno», con el plazo entero', !!$(w, '.reloj-bar') && JSON.parse(w.localStorage.getItem(TURN)).at >= w.Date.now() - 1000);
  w.adelanta(5000);
  click(w, '[data-quick="menu"]');
  click(w, '[data-quick="formats"]');
  const congelado = JSON.parse(w.localStorage.getItem(TURN));
  ok('«Guardar y salir» congela lo gastado', Number.isFinite(congelado.elapsed) && congelado.elapsed >= 5000 && congelado.elapsed < 7000);
  w.adelanta(600000);
  CT.Quick.openLocal(paint(w));
  click(w, '[data-quick="resume"]'); click(w, '[data-quick="turn-ready"]');
  const sigue = JSON.parse(w.localStorage.getItem(TURN));
  ok('al volver sigue con el tiempo que le quedaba, aunque haya pasado un rato', Number.isFinite(sigue.at) && w.Date.now() - sigue.at < 7000 && JSON.parse(w.localStorage.getItem(KEY)).commands.length === 0);
  w.close();
}

if (fail) { console.error(`\n${fail} fallos`); process.exit(1); }
console.log('Retos rápidos en un solo móvil: reto diario aparte, móvil que pasa de mano y reloj congelado al salir: OK');
