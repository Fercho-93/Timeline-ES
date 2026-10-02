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
  let s = E.create({names: ['Tú'], rounds, kind: 'duel', keep: true}); const commands = [];
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
const record = {version: CT.QuickCatalog.version, config: {names: ['Tú'], rounds, kind: 'duel', keep: true, seed}, commands};
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
assert.throws(() => D.read(enlace({v: 2})), /versión anterior/, 'los enlaces de antes (un fallo te dejaba fuera) piden crear uno nuevo');
assert.throws(() => D.read(enlace({c: 'p99.0,a'})), /dañado/);
assert.throws(() => D.read(enlace({c: commands.slice(0, 6).length ? D.pack(commands.slice(0, 6), rounds) : ''})), /no ha terminado/);
assert.throws(() => D.read(enlace({n: 0})), /no es un duelo/);
// Trampa: decir que se acertó todo cuando no es verdad no cambia nada, porque el resultado lo calcula el motor.
const mala = jugar(rounds, {perfecta: false});
const conMala = D.read(enlace({c: D.pack(mala.commands, rounds)}));
assert.equal(conMala.score, mala.state.players[0].score);
assert.ok(conMala.score < score, 'el resultado sale de las jugadas, no de lo que diga el enlace');
assert.equal(mala.state.phase, 'round-end', 'en el duelo por enlace un fallo no corta: se juegan todos los mazos');
assert.ok(mala.commands.filter(c => c.type === 'place').length >= rounds.reduce((n, r) => n + r.order.length - 1, 0), 'se colocan todas las cartas de todos los mazos');

// La pantalla de preparar el duelo: 1, 3 o 5 mazos y, por defecto, 3.
const app = w.document.getElementById('app');
CT.Quick.openDuel(html => { app.innerHTML = html; });
const chips = [...app.querySelectorAll('.quick-length-chip')].map(c => c.dataset.length);
assert.deepEqual(chips, ['1', '3', '5']);
assert.equal(app.querySelector('.quick-length-chip.is-selected').dataset.length, '3');
assert.match(app.textContent, /Duelo de Retos rápidos/);
assert.match(app.textContent, /mismos mazos/);
assert.match(app.textContent, /Partida completa/);
assert.match(app.textContent, /Por turnos/);
// Los dos ritmos del duelo, como en las colecciones: partida completa (enlace) y por turnos (sala de dos).
assert.deepEqual([...app.querySelectorAll('input[name="quick-duel-pace"]')].map(i => i.value), ['seguidos', 'turnos']);
assert.equal(app.querySelector('input[name="quick-duel-pace"]:checked').value, 'seguidos', 'por defecto, partida completa');
assert.equal(app.querySelector('[data-quick-duel-block="seguidos"]').hidden, false);
assert.equal(app.querySelector('[data-quick-duel-block="turnos"]').hidden, true);
assert.ok(app.querySelector('[data-quick="start-duel"]'));
assert.ok(app.querySelector('[data-quick-duel-block="turnos"] [data-quick="create-room"]'), 'por turnos se crea una sala de dos');
assert.ok(app.querySelector('[data-quick-duel-block="turnos"] #quick-net-code'), 'y se puede entrar con un código');
// Qué pasa al fallar se elige al crear el duelo por turnos (no en una sala de espera: el duelo no tiene mesa).
assert.deepEqual([...app.querySelectorAll('[data-quick-duel-block="turnos"] input[name="quick-keep"]')].map(i => i.value), ['seguir', 'fuera']);
assert.equal(app.querySelector('input[name="quick-keep"]:checked').value, 'seguir', 'por defecto, seguir hasta el final');
assert.equal(app.querySelector('.lobby-table'), null, 'el duelo por turnos no enseña mesa');
assert.doesNotMatch(app.textContent, /Escribir la cifra/, 'en Retos rápidos siempre se ordenan cartas');
// Cambiar de ritmo enseña el otro bloque sin repintar y se recuerda.
const turnos = app.querySelector('input[value="turnos"]'); turnos.checked = true;
turnos.dispatchEvent(new w.Event('change', {bubbles: true}));
assert.equal(app.querySelector('[data-quick-duel-block="seguidos"]').hidden, true);
assert.equal(app.querySelector('[data-quick-duel-block="turnos"]').hidden, false);
assert.equal(w.CONTINUUM.Storage.getItem('continuum-quick-duel-pace-v1'), 'turnos');
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
// Lista unificada de duelos (de tu cuenta): dicen a quién le toca, en qué mazo y carta vais, y los terminados cuentan para el cara a cara.
{
  const R = CT.QuickRoom, order = id => E.challenge(id).cards.map(c => c.id).slice(0, 6);
  const rounds3 = ['poker', 'drinks', 'oscars'].map(id => ({id, order: order(id)}));
  let r = R.create('me', 'Tester', 2); r = R.reduce(r, 'me', {type: 'start', rounds: rounds3, kind: 'duel', keep: true});
  r = R.reduce(r, 'me', {type: 'place', cardId: R.state(r).remaining[0], index: 1}); r = R.reduce(r, 'me', {type: 'ack'});
  const joined = R.reduce(r, 'amigo', {type: 'join', name: 'Luis'});
  let fin = joined;
  for (let g = 0; g < 400 && fin.phase !== 'finished'; g++) {
    if (fin.phase === 'round-end') {fin = R.reduce(fin, fin.host, {type: 'next'}); continue;}
    const st = R.state(fin), id = fin.members[st.current];
    fin = R.reduce(fin, id, st.phase === 'result' ? {type: 'ack'} : {type: 'place', cardId: st.remaining[0], index: st.timeline.length});
  }
  const mesa = R.create('me', 'Tester', 4);
  const rooms = [{code: 'AAAAAAAAA2', room: r}, {code: 'BBBBBBBBB2', room: joined}, {code: 'CCCCCCCCC2', room: fin}, {code: 'DDDDDDDDD2', room: mesa}];
  CT.QuickNetwork.mine = async () => rooms.map(x => ({...x, uid: 'me'}));
  const rows = await CT.Quick.duels();
  const by = code => rows.find(x => x.code === code);
  assert.equal(rows.length, 3, 'las mesas de varios no son duelos');
  assert.equal(by('AAAAAAAAA2').grupo, 'enviada', 'si el amigo aún no ha abierto el enlace, esperas');
  assert.equal(by('BBBBBBBBB2').grupo, 'su-turno'); assert.equal(by('BBBBBBBBB2').rival, 'Luis'); assert.equal(by('BBBBBBBBB2').rivalUid, 'amigo');
  assert.match(by('BBBBBBBBB2').detalle, /^Mazo 1 de 3 · carta \d de 5$/);
  assert.match(by('BBBBBBBBB2').marcador, /^Tú \d · Luis \d aciertos$/);
  assert.equal(by('CCCCCCCCC2').done, true); assert.ok(['win', 'loss', 'draw'].includes(by('CCCCCCCCC2').result));
  CT.Quick.forgetDuel('CCCCCCCCC2');
  const tras = await CT.Quick.duels();
  assert.equal(tras.length, 3, 'archivar esconde de la lista pero el duelo sigue contando'); assert.equal(tras.find(x => x.code === 'CCCCCCCCC2').hidden, true);
  CT.QuickNetwork.mine = async () => {throw Error('sin conexión');};
  assert.equal((await CT.Quick.duels()).length, 3, 'sin conexión se enseña lo último que se supo');
}
console.log('Duelo de Retos rápidos: mazos por semilla, enlace corto, resultado comprobado por el motor y entrada con 1, 3 o 5 mazos.');
