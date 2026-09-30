// Duelo de Retos rápidos por enlace: juegas tú, mandas el enlace y tu amigo juega los mismos mazos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {gameHtml} from './game-fixture.mjs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
function boot(url = 'https://continuum.test/') {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {runScripts: 'outside-only', url}).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  return w;
}
const w = boot(), CT = w.CONTINUUM, E = CT.QuickEngine, D = CT.Quick.Duel;

// Una partida perfecta de cinco mazos con el motor: es el caso más largo que puede salir.
function jugar(rounds, {perfecta = true} = {}) {
  let s = E.create({names: ['Tú'], rounds, kind: 'duel'}); const commands = [];
  const step = c => { s = E.step(s, c); commands.push(c); };
  while (true) {
    if (s.phase === 'turn') {
      const cardId = s.remaining[0];
      let index = 0;
      for (let i = 0; i <= s.timeline.length; i++) { if (E.step(s, {type: 'place', cardId, index: i}).result.correct) { index = i; break; } }
      step({type: 'place', cardId, index: perfecta ? index : (index === 0 ? s.timeline.length : 0)});
    } else if (s.phase === 'result') step({type: 'ack'});
    else if (s.phase === 'round-end') { if (s.index + 1 < rounds.length) step({type: 'next'}); else break; }
    else break;
  }
  return {commands, state: s};
}
const seed = 'semilla-de-prueba';
const rounds = D.rounds(5, null, seed);
assert.deepEqual(rounds, D.rounds(5, null, seed), 'la misma semilla reparte los mismos mazos en los dos móviles');
assert.notDeepEqual(rounds.map(r => r.id), D.rounds(5, null, 'otra').map(r => r.id), 'otra semilla, otros mazos');
const {commands, state} = jugar(rounds);
const score = state.players[0].score;
assert.ok(commands.length > 100, 'una partida larga pasa de 100 jugadas: antes no se podía ni reanudar');
const record = {version: CT.QuickCatalog.version, config: {names: ['Tú'], rounds, kind: 'duel', seed}, commands};
assert.doesNotThrow(() => E.restore(record), 'el motor acepta una partida larga');
const payload = D.payload(record);
const link = CT.LocalTransport.encodeText(JSON.stringify(payload));
assert.ok(link.length < 2500, `el enlace es corto (${link.length} caracteres)`);
const rival = D.read(link);
assert.equal(rival.score, score, 'quien abre el enlace ve el resultado que sacó quien retó');
assert.deepEqual(rival.rounds, rounds);
assert.ok(score > 0);

// Un enlace que no vale se rechaza con un motivo legible.
const enlace = cambios => CT.LocalTransport.encodeText(JSON.stringify({...payload, ...cambios}));
assert.throws(() => D.read('no-es-un-enlace'), /no es un duelo/);
assert.throws(() => D.read(enlace({f: 'otra-version'})), /otra versión/);
assert.throws(() => D.read(enlace({v: 1})), /no es un duelo/);
assert.throws(() => D.read(enlace({c: 'p99.0,a'})), /dañado/);
assert.throws(() => D.read(enlace({c: commands.slice(0, 6).length ? D.pack(commands.slice(0, 6), rounds) : ''})), /no ha terminado/);
assert.throws(() => D.read(enlace({n: 0})), /no es un duelo/);
// Trampa: decir que se acertó todo cuando no es verdad no cambia nada, porque el resultado lo calcula el motor.
const mala = jugar(rounds, {perfecta: false});
const conMala = D.read(enlace({c: D.pack(mala.commands, rounds)}));
assert.equal(conMala.score, mala.state.players[0].score);
assert.ok(conMala.score < score, 'el resultado sale de las jugadas, no de lo que diga el enlace');

// La pantalla de preparar el duelo: 1, 3 o 5 mazos y, por defecto, 3.
const app = w.document.getElementById('app');
CT.Quick.openDuel(html => { app.innerHTML = html; });
const chips = [...app.querySelectorAll('.quick-length-chip')].map(c => c.dataset.length);
assert.deepEqual(chips, ['1', '3', '5']);
assert.equal(app.querySelector('.quick-length-chip.is-selected').dataset.length, '3');
assert.match(app.textContent, /Duelo de Retos rápidos/);
assert.match(app.textContent, /mismos mazos/);
assert.equal(app.querySelector('[data-quick="enter-room"], [data-quick="create-room"], #quick-net-code'), null, 'ya no pide sala ni código');
assert.ok(app.querySelector('[data-quick="start-duel"]'));
// El texto tras fallar una carta concuerda con quien juega: «Pierdes…» en solitario, «Ana pierde…» en mesa,
// y con 0 aciertos provisionales no dice «pierde 0 aciertos».
{
  const src = read('quick-challenges.js'), f = src.slice(src.indexOf('  function resultNote'), src.indexOf('  function render() {'));
  const nota = (room, players) => new Function('room', 'state', 'esc', f + ';return resultNote;')(room, {players}, x => x);
  const solo = nota(null, [1]), mesa = nota(null, [1, 2]);
  assert.equal(solo({correct: true}, {name: 'Tú', points: 1}), 'Tienes 1 acierto provisional.');
  assert.match(solo({correct: false, lost: 2}, {name: 'Tú'}), /^Pierdes 2 aciertos de este reto y quedas fuera/);
  assert.match(solo({correct: false, lost: 1}, {name: 'Tú'}), /^Pierdes 1 acierto de este reto/);
  assert.match(solo({correct: false, lost: 0}, {name: 'Tú'}), /^No tenías aciertos provisionales que perder/);
  assert.match(mesa({correct: false, lost: 3}, {name: 'Ana'}), /^Ana pierde 3 aciertos de este reto y queda fuera/);
  assert.doesNotMatch(mesa({correct: false, lost: 0}, {name: 'Ana'}), /pierde 0|0 aciertos/);
  assert.doesNotMatch(solo({correct: false, lost: 0}, {name: 'Tú'}), /Tú pierde/);
}
console.log('Duelo de Retos rápidos: mazos por semilla, enlace corto, resultado comprobado por el motor y entrada con 1, 3 o 5 mazos.');
