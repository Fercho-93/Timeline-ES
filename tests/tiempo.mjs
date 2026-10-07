// Tiempo por carta: la opción está en todas las pantallas de configuración (menos el reto
// diario) y, cuando se agota el plazo, la jugada cuenta como fallo.
import {gameHtml} from './game-fixture.mjs';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? 'ok  ' : 'FALLA'} ${label}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(almacen = {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test/' }).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  Object.entries(almacen).forEach(([k, v]) => w.localStorage.setItem(k, v));
  scripts.forEach(f => w.eval(read(f)));
  // Reloj adelantable: cada prueba mueve la hora en vez de esperar el plazo de verdad.
  let desfase = 0; const base = w.Date.now.bind(w.Date);
  w.Date.now = () => base() + desfase;
  w.adelanta = ms => { desfase += ms; };
  return w;
}
const $ = (w, sel) => w.document.querySelector(sel);
const click = (w, sel) => { const el = $(w, sel); assert.ok(el, sel); el.click(); };
const elige = (w, contexto, segundos) => { const input = $(w, `input[data-tiempo="${contexto}"][value="${segundos}"]`); assert.ok(input, `${contexto} ${segundos}`); input.checked = true; input.dispatchEvent(new w.Event('change', { bubbles: true })); };
const opciones = (w, contexto) => [...w.document.querySelectorAll(`input[data-tiempo="${contexto}"]`)].map(i => Number(i.value));
const abreMazo = (w, route) => { w.CONTINUUM.ModeHubs.open('hub-solo'); click(w, '[data-inline-route]'); click(w, '[data-block="historia"]'); click(w, '[data-mode="history"]'); if (route) w.CONTINUUM.openDeckAs(route); };

console.log('\nLa opción está en cada configuración');
{
  const w = boot();
  abreMazo(w);
  ok('jugar solo · colecciones', JSON.stringify(opciones(w, 'solo')) === '[0,15,20,30]');
  w.CONTINUUM.openDeckAs('local');
  ok('un solo móvil · colecciones', opciones(w, 'local').length === 4);
  w.CONTINUUM.openDeckAs('online');
  ok('cada uno en su móvil · colecciones (los tres ritmos)', opciones(w, 'amigos').length === 4 && $(w, 'input[data-tiempo="amigos"][value="15"]').checked);
  w.CONTINUUM.ModeHubs.open('hub-solo'); click(w, '[data-action="competition-menu"]');
  ok('competición en solitario', opciones(w, 'comp-solo').length === 4);
  w.CONTINUUM.ModeHubs.open('hub-friends-local'); click(w, '[data-action="competition-menu"]');
  ok('competición en un solo móvil', opciones(w, 'local').length === 4);
  w.CONTINUUM.ModeHubs.open('hub-friends-online'); click(w, '[data-action="create-room-toggle"]'); click(w, '[data-action="competition-menu"]');
  ok('competición con amigos', opciones(w, 'amigos').length === 4);
  const app = $(w, '#app'), paint = h => { app.innerHTML = h; };
  w.CONTINUUM.Quick.openSolo(paint);
  ok('retos rápidos en solitario', opciones(w, 'quick-solo').length === 4);
  w.CONTINUUM.Quick.openLocal(paint);
  ok('retos rápidos en un solo móvil', opciones(w, 'quick-local').length === 4);
  w.CONTINUUM.Quick.openDuel(paint);
  ok('retos rápidos con amigos', opciones(w, 'amigos').length === 4);
  w.CONTINUUM.ModeHubs.open('hub-online-create');
  ok('crear una mesa pública (30 s si no se ha elegido otro)', opciones(w, 'publica').length === 4 && $(w, 'input[data-tiempo="publica"][value="30"]').checked);
  click(w, 'input[data-public-create="kind"][value="quick"]');
  ok('la mesa de Retos rápidos no pide mazo', $(w, '[data-public-deck]').hidden);
  w.CONTINUUM.localNavigate('home');
  ok('el reto diario no la lleva', !w.document.querySelector('input[data-tiempo]'));
  w.close();
}

console.log('\nJugar solo: agotar el plazo cuesta una vida');
{
  const w = boot();
  abreMazo(w);
  elige(w, 'solo', 15);
  click(w, '[data-action="start-free"]');
  ok('la partida enseña la cuenta atrás', !!$(w, '.reloj-bar'));
  const vidas = JSON.parse(w.localStorage.getItem('hilo-solo-history-v1')).lives;
  w.adelanta(16000); await sleep(350);
  const partida = JSON.parse(w.localStorage.getItem('hilo-solo-history-v1'));
  ok('al agotarse, la carta cuenta como fallo y resta una vida', partida.lives === vidas - 1 && partida.played === 1);
  ok('y se dice que se acabó el tiempo', /Se acabó el tiempo/.test(w.document.body.textContent));
  w.close();
  const sin = boot(); abreMazo(sin); elige(sin, 'solo', 0); click(sin, '[data-action="start-free"]');
  ok('sin tiempo no hay cuenta atrás', !$(sin, '.reloj-bar'));
  sin.close();
}

console.log('\nUn solo móvil: agotar el turno es una jugada fallada');
{
  const w = boot();
  abreMazo(w, 'local');
  elige(w, 'local', 20);
  w.document.getElementById('hand-size').value = '2';
  click(w, '[data-action="start"]');
  while ($(w, '#starter-guess-input')) { $(w, '#starter-guess-input').value = '1900'; click(w, '[data-action="starter-guess-submit"]'); }
  click(w, '[data-action="starter-start"]');
  click(w, '[data-action="ready"]');
  ok('el turno enseña la cuenta atrás', !!$(w, '.reloj-bar'));
  w.adelanta(21000); await sleep(350);
  ok('al agotarse se resuelve el turno como fallo por tiempo', /Se acabó el tiempo/.test(w.document.body.textContent) && !!$(w, '[data-action="finish-turn"]'));
  ok('mientras se ve el resultado el reloj no sigue', !$(w, '.reloj-bar'));
  w.close();
}

console.log('\nRetos rápidos: el plazo viaja en la partida y agotarlo falla la jugada');
{
  const w = boot();
  const E = w.CONTINUUM.QuickEngine, c = E.challenge('albums-sales');
  const config = { names: ['Tú'], rounds: [{ id: c.id, order: c.cards.map(x => x.id) }], kind: 'free', seconds: 15 };
  const s = E.create(config);
  const fallo = E.step(s, E.timeoutPlacement(s));
  ok('la jugada por tiempo es una colocación que no encaja', fallo.result.correct === false);
  assert.throws(() => E.create({ ...config, seconds: 45 }), /INVALID_CONFIG/);
  const app = $(w, '#app'), paint = h => { app.innerHTML = h; };
  w.CONTINUUM.Quick.openSolo(paint);
  elige(w, 'quick-solo', 15);
  click(w, '.quick-length-chip[data-length="1"]'); click(w, '[data-quick="start-free"]'); click(w, '[data-quick="ready"]');
  ok('la partida enseña la cuenta atrás', !!$(w, '.reloj-bar'));
  w.adelanta(16000); await sleep(350);
  const guardada = JSON.parse(w.localStorage.getItem('continuum-quick-challenges-v1'));
  ok('al agotarse se juega una carta, y falla', guardada.config.seconds === 15 && guardada.commands.length === 1 && !!$(w, '[data-quick="ack"]'));
  // El duelo por enlace lleva el plazo: quien lo acepta juega con el mismo.
  const R = w.CONTINUUM.QuickRoom;
  const sala = R.reduce(R.reduce(R.create('a', 'Ana', 4), 'b', { type: 'join', name: 'Bea' }), 'a', { type: 'start', rounds: config.rounds, kind: 'network', seconds: 20 });
  ok('la sala guarda el plazo en su configuración', sala.config.seconds === 20);
  w.close();
}

console.log('\nMismas cartas: el plazo viaja en el enlace');
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  for (const [cifras, ms] of [[false, 0], [false, 15000], [false, 20000], [false, 30000], [true, 0], [true, 15000], [true, 20000], [true, 30000]]) {
    const mode = 'history', seed = 'abc123', total = cifras ? D.Cifras.CARTAS : 5;
    const payload = cifras
      ? D.Cifras.codificar({ mode, seed, total, jugadas: Array.from({ length: total }, () => ({ respuesta: 1900, ms: 4000, salida: false })), nombre: 'Ana', ms })
      : D.codificar({ mode, seed, total, hits: 3, sequence: [true, true, true, false, false], nombre: 'Ana', ms });
    const leido = D.descodificar(payload);
    ok(`${cifras ? 'cifras' : 'orden'} ${ms ? `${ms / 1000} s` : 'sin tiempo'}`, leido.ok && leido.duelo.ms === ms);
  }
  w.close();
}

if (fail) { console.error(`\n${fail} fallos`); process.exit(1); }
console.log('\nTiempo por carta en todas las modalidades: OK');
