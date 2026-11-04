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

// «Mismas cartas» en grupo (3 o 4): el enlace lleva el tamaño del grupo y lo que sacaron quienes jugaron antes.
{
  const enGrupo = D.payload({...record, config: {...record.config, group: 3, rivals: [['Luis', 4]]}});
  assert.equal(enGrupo.g, 3); assert.equal(JSON.stringify(enGrupo.r), '[["Luis",4]]');
  const leido = D.read(CT.LocalTransport.encodeText(JSON.stringify(enGrupo)));
  assert.equal(leido.group, 3); assert.equal(JSON.stringify(leido.prior), '[["Luis",4]]');
  assert.equal(leido.score, score, 'el resultado de quien te lo pasa lo vuelve a calcular el motor');
  const sinGrupo = D.read(link);
  assert.equal(sinGrupo.group, 2, 'los enlaces de dos (y los de antes) siguen siendo de dos');
  const raro = D.read(CT.LocalTransport.encodeText(JSON.stringify({...enGrupo, g: 9, r: [['<b>x</b>', -3], 'basura']})));
  assert.equal(raro.group, 2, 'un tamaño fuera de 2 a 4 no vale');
}
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
assert.match(app.textContent, /Retos rápidos con amigos/);
assert.match(app.textContent, /mismos retos/);
assert.match(app.textContent, /En directo/);
assert.match(app.textContent, /Por turnos/);
assert.doesNotMatch(app.textContent, /Mismas cartas/, '«Mismas cartas» ya no existe con amigos');
// Dos ritmos, como en las colecciones: en directo (sala) y por turnos (el duelo).
assert.deepEqual([...app.querySelectorAll('input[name="quick-duel-pace"]')].map(i => i.value), ['directo', 'turnos']);
assert.equal(app.querySelector('input[name="quick-duel-pace"]:checked').value, 'directo', 'por defecto, en directo');
assert.equal(app.querySelector('[data-quick-duel-block="directo"]').hidden, false);
assert.equal(app.querySelector('[data-quick-duel-block="turnos"]').hidden, true);
assert.ok(app.querySelector('[data-quick-duel-pre] #quick-net-players'), 'en directo se elige el máximo de la sala');
assert.equal(app.querySelector('[data-quick-group]').hidden, true, 'y no el número de jugadores de los otros ritmos');
assert.equal(app.querySelector('#quick-duel-group').value, '2', 'por turnos, de entrada, dos');
assert.ok(!app.querySelector('.duel-brief'), 'sin textos de explicación debajo de los ajustes');
assert.equal(app.querySelector('[data-quick-keep-field]').hidden, false, 'en directo también se elige qué pasa al fallar');
assert.ok(app.querySelector('#quick-profile-name[readonly]'), 'el nombre es el del perfil');
assert.deepEqual([...app.querySelectorAll('input[name="quick-live-net"]')].map(i => i.value), ['internet', 'wifi']);
assert.ok(app.querySelector('[data-quick-duel-block="directo"] [data-quick="live-room"]'));
// Orden de «Cómo jugáis», igual en todas las modalidades: ritmo, conexión, máximo, contenido, tiempo, nombre y botón.
{
  const pos = sel => { const el = app.querySelector(sel); assert.ok(el, `falta ${sel}`); return [...app.querySelectorAll('*')].indexOf(el); };
  const orden = ['input[name="quick-duel-pace"]', 'input[name="quick-live-net"]', '#quick-net-players', '#quick-duel-group', '.quick-length-chip', '[data-quick-keep-field]', '[data-tiempo], .tiempo-field, [name="tiempo-amigos"]', '#quick-profile-name', '[data-quick="live-room"]'];
  const encontrados = orden.filter(sel => app.querySelector(sel));
  assert.ok(encontrados.length >= 7, 'están los campos del formulario');
  const posiciones = encontrados.map(pos);
  assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b), 'los campos siguen el orden común');
}
// Duraciones: solo 1, 3 y 5 a la vista; las largas del solitario y un solo móvil, tras «Más duraciones».
assert.equal(app.querySelectorAll('.quick-length-chip:not([hidden])').length, 3);
const sinInternet = app.querySelector('input[name="quick-live-net"][value="wifi"]'); sinInternet.checked = true;
sinInternet.dispatchEvent(new w.Event('change', {bubbles: true}));
assert.equal(w.CONTINUUM.Storage.getItem('continuum-quick-live-net-v1'), 'wifi');
assert.ok(app.querySelector('[data-quick-duel-block="turnos"] [data-quick="create-room"]'), 'por turnos se crea una sala de dos');
assert.equal(app.querySelector('details.duel-join'), null, 'unirse a un duelo va por «Unirme a una partida»');
// Qué pasa al fallar se elige al crear el duelo por turnos (no en una sala de espera: el duelo no tiene mesa).
assert.deepEqual([...app.querySelectorAll('input[name="quick-keep"]')].map(i => i.value), ['fuera', 'seguir']);
assert.equal(app.querySelector('input[name="quick-keep"]:checked').value, 'fuera', 'por defecto, arriesgar o plantarse');
assert.equal(app.querySelector('.lobby-table'), null, 'el duelo por turnos no enseña mesa');
assert.doesNotMatch(app.textContent, /Escribir la cifra/, 'en Retos rápidos siempre se ordenan cartas');
// Cambiar de ritmo enseña el otro bloque sin repintar y se recuerda.
const turnos = app.querySelector('input[value="turnos"]'); turnos.checked = true;
turnos.dispatchEvent(new w.Event('change', {bubbles: true}));
assert.equal(app.querySelector('[data-quick-duel-block="directo"]').hidden, true);
assert.equal(app.querySelector('[data-quick-duel-block="turnos"]').hidden, false);
assert.equal(app.querySelector('[data-quick-group]').hidden, false, 'por turnos se elige cuántos sois');
assert.equal(w.CONTINUUM.Storage.getItem('continuum-quick-duel-pace-v1'), 'turnos');
// Sin internet, en directo se marca sola la Wi-Fi, sin cambiar lo que había guardado.
w.CONTINUUM.Storage.setItem('continuum-quick-duel-pace-v1', 'directo');
w.CONTINUUM.Storage.setItem('continuum-quick-live-net-v1', 'internet');
Object.defineProperty(w.navigator, 'onLine', {configurable: true, get: () => false});
CT.Quick.openDuel(html => { app.innerHTML = html; });
assert.equal(app.querySelector('input[name="quick-live-net"]:checked').value, 'wifi');
assert.ok(app.querySelector('[data-offline-note]'));
assert.equal(w.CONTINUUM.Storage.getItem('continuum-quick-live-net-v1'), 'internet');
// Por turnos el duelo se guarda en el servidor: sin internet se avisa antes de pulsar y, si se pulsa, no se crea nada.
w.CONTINUUM.Storage.setItem('continuum-quick-duel-pace-v1', 'turnos');
CT.Quick.openDuel(html => { app.innerHTML = html; });
assert.ok(app.querySelector('[data-quick-duel-block="turnos"] [data-offline-turnos]'), 'sin internet se avisa de que el duelo por turnos no se puede crear');
app.querySelector('[data-quick="create-room"]').click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.match(app.querySelector('#quick-error').textContent, /Sin internet no se puede crear un duelo por turnos/);
w.CONTINUUM.Storage.setItem('continuum-quick-duel-pace-v1', 'directo');
Object.defineProperty(w.navigator, 'onLine', {configurable: true, get: () => true});
CT.Quick.openDuel(html => { app.innerHTML = html; });
assert.equal(app.querySelector('[data-offline-turnos]'), null, 'con internet no hay aviso');
// El máximo de la sala se recuerda, el mismo que en las colecciones, pero Retos rápidos con amigos es de 2 a 4.
w.CONTINUUM.Storage.setItem('continuum-live-max-v1', '3');
CT.Quick.openDuel(html => { app.innerHTML = html; });
assert.equal(app.querySelector('#quick-net-players').value, '3');
w.CONTINUUM.Storage.setItem('continuum-live-max-v1', '10');
CT.Quick.openDuel(html => { app.innerHTML = html; });
assert.equal(app.querySelector('#quick-net-players').value, '4', 'diez en las colecciones son cuatro en Retos rápidos');
assert.deepEqual([...app.querySelectorAll('#quick-net-players option')].map(o => o.value), ['2', '3', '4'], 'en Retos rápidos con amigos solo se elige de 2 a 4');
{
  const maximo = app.querySelector('#quick-net-players'); maximo.value = '3';
  maximo.dispatchEvent(new w.Event('change', {bubbles: true}));
  assert.equal(w.CONTINUUM.Storage.getItem('continuum-live-max-v1'), '3', 'lo elegido aquí se recuerda');
}
w.CONTINUUM.Storage.removeItem('continuum-live-max-v1');
// El texto tras fallar una carta concuerda con quien juega: «Pierdes…» en solitario, «Ana pierde…» en mesa,
// y con 0 aciertos provisionales no dice «pierde 0 aciertos».
{
  const src = read('js/retos/quick-challenges.js'), f = src.slice(src.indexOf('  function resultNote'), src.indexOf('  function render() {'));
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
  // Reto que te han mandado, y duelo en el que alguien se rindió.
  const inv = R.create('otro', 'Marta', 2); inv.invitedUid = 'me'; inv.invitedName = 'Tester';
  const invStarted = R.reduce(inv, 'otro', {type: 'start', rounds: rounds3, kind: 'duel', keep: true});
  const rendido = R.reduce(joined, 'amigo', {type: 'resign'});
  CT.QuickNetwork.mine = async () => [{code: 'EEEEEEEEE2', room: invStarted, uid: 'me'}, {code: 'FFFFFFFFF2', room: rendido, uid: 'me'}];
  const extra = await CT.Quick.duels();
  const e = code => extra.find(x => x.code === code);
  assert.equal(e('EEEEEEEEE2').grupo, 'retado'); assert.equal(e('EEEEEEEEE2').rival, 'Marta'); assert.equal(e('EEEEEEEEE2').pendiente, true);
  assert.equal(e('FFFFFFFFF2').done, true); assert.equal(e('FFFFFFFFF2').result, 'win'); assert.match(e('FFFFFFFFF2').estado, /rindió/);
  assert.equal(e('FFFFFFFFF2').length, 3); assert.equal(e('FFFFFFFFF2').keep, true);
  // Reto rechazado: cerrado para los dos, sin resultado.
  const rech = R.reduce(invStarted, 'me', {type: 'decline'});
  CT.QuickNetwork.mine = async () => [{code: 'GGGGGGGGG2', room: rech, uid: 'me'}];
  const rc = (await CT.Quick.duels())[0];
  assert.equal(rc.grupo, 'historial'); assert.equal(rc.done, true); assert.equal(rc.result, undefined); assert.match(rc.estado, /Rechazaste/);
  CT.QuickNetwork.mine = async () => rooms.map(x => ({...x, uid: 'me'}));
  await CT.Quick.duels();
  CT.QuickNetwork.mine = async () => {throw Error('sin conexión');};
  assert.equal((await CT.Quick.duels()).length, 3, 'sin conexión se enseña lo último que se supo');
  assert.equal(CT.Quick.forgetDuel, undefined, 'archivar va con la cuenta (duelPreferences), no con el móvil');
}
console.log('Duelo de Retos rápidos: mazos por semilla, enlace corto, resultado comprobado por el motor y entrada con 1, 3 o 5 mazos.');

// La invitación nativa se procesa sin cambiar el origen ni la cuenta del móvil.
const encoded = CT.LocalTransport.encodeText(JSON.stringify(payload));
CT.Quick.open(html => { app.innerHTML = html; }, {quickDuel:encoded});
assert.equal(app.querySelectorAll('.hand-card').length, rounds[0].order.length - 1, 'la invitación arranca el primer mazo del rival');
assert.equal(w.location.origin, 'https://continuum.test');
// Duelo por turnos de grupo (de 2 a 4): quien lo crea juega primero y cada amigo ocupa, al abrir el enlace, la siguiente plaza.
{
  const R = CT.QuickRoom, rondas = E.collectionRounds('history', 1);
  let r = R.create('me', 'Tester', 3); r = R.reduce(r, 'me', {type: 'start', rounds: rondas, kind: 'duel', keep: true});
  assert.equal(JSON.stringify(R.state(r).players.map(p => p.name)), '["Tester","Jugador 2","Jugador 3"]', 'cada plaza libre lleva un nombre provisional');
  r = R.reduce(r, 'me', {type: 'place', cardId: R.state(r).remaining[0], index: 0}); r = R.reduce(r, 'me', {type: 'ack'});
  assert.equal(R.state(r).current, 1, 'después le toca a la segunda plaza, aún vacía');
  assert.throws(() => R.reduce(r, 'me', {type: 'place', cardId: R.state(r).remaining[0], index: 0}), /turno/, 'quien creó el duelo no juega por los demás');
  CT.QuickNetwork.mine = async () => [{code: 'JJJJJJJJJ2', room: r, uid: 'me'}];
  let [row] = await CT.Quick.duels();
  assert.equal(row.grupo, 'enviada'); assert.equal(row.estado, 'Esperando a que entre Jugador 2'); assert.equal(row.rivalUid, null, 'un duelo de grupo no cuenta para el cara a cara');
  r = R.reduce(r, 'luis', {type: 'join', name: 'Luis'});
  assert.equal(JSON.stringify(r.config.names), '["Tester","Luis","Jugador 3"]', 'quien entra ocupa la siguiente plaza');
  assert.equal(r.actor, 'luis', 'y juega su turno');
  r = R.reduce(r, 'luis', {type: 'place', cardId: R.state(r).remaining[0], index: 0}); r = R.reduce(r, 'luis', {type: 'ack'});
  r = R.reduce(r, 'sara', {type: 'join', name: 'Sara'});
  assert.equal(JSON.stringify(r.config.names), JSON.stringify(r.names), 'con la mesa completa, los nombres son los de verdad');
  assert.throws(() => R.reduce(r, 'otro', {type: 'join', name: 'Otro'}), /completa/, 'no cabe una cuarta persona en un duelo de tres');
  CT.QuickNetwork.mine = async () => [{code: 'JJJJJJJJJ2', room: r, uid: 'me'}];
  [row] = await CT.Quick.duels();
  assert.equal(row.grupo, 'su-turno'); assert.equal(row.estado, 'Turno de Sara'); assert.match(row.marcador, /^Tú \d · Luis \d · Sara \d aciertos$/);
  assert.equal(row.players, 3, 'la revancha se crea con las mismas plazas');
  // El motor admite hasta 10 plazas (Grandes colecciones); que Retos rápidos se quede en 4 lo decide la pantalla.
  let diez = R.create('me', 'Tester', 10); diez = R.reduce(diez, 'me', {type: 'start', rounds: rondas, kind: 'duel', keep: true});
  assert.equal(R.state(diez).players.length, 10, 'un duelo de diez reserva diez plazas');
  assert.throws(() => R.reduce(R.create('me', 'Tester', 11), 'me', {type: 'start', rounds: rondas, kind: 'duel'}), /Sala no válida|dos personas/, 'más de diez no cabe');
}
// Duelo por turnos de Grandes colecciones: motor propio con mano individual, reposición al fallar y final de desempate.
{
  const c = E.challenge('col:history'), val = id => c.cards.find(x => x.id === id).value;
  const deck = E.colDeck('history');
  assert.equal(new Set(deck.map(val)).size, deck.length, 'el mazo no repite valores');
  const config = {names: ['Ana', 'Bea', 'Cid'], rounds: [{id: 'col:history', order: deck}], kind: 'duel', hand: 3, historyId: 'x'};
  let s = E.create(config);
  assert.equal(E.isColDuel(config), true);
  assert.equal(E.keepPlaying(s), true, 'en colecciones no hay «plantarse»: un fallo no echa a nadie');
  assert.equal(JSON.stringify(s.players.map(p => p.hand.length)), JSON.stringify([3, 3, 3]), 'cada jugador tiene su mano');
  assert.equal(new Set(s.players.flatMap(p => p.hand)).size, 9, 'las manos son distintas');
  assert.equal(s.timeline.length, 1);
  assert.equal(s.deck.length, deck.length - 10, 'el resto es el mazo de reposición');
  assert.deepEqual(s.remaining, s.players[0].hand, 'se ve la mano de quien juega');
  const bien = (st, id) => { for (let i = 0; i <= st.timeline.length; i++) if (E.step(st, {type: 'place', cardId: id, index: i}).result.correct) return i; };
  const mal = (st, id) => { for (let i = 0; i <= st.timeline.length; i++) if (!E.step(st, {type: 'place', cardId: id, index: i}).result.correct) return i; return null; };
  // Acertar: la carta entra en la línea y la mano baja.
  const primera = s.players[0].hand[0], hueco = bien(s, primera);
  s = E.step(s, {type: 'place', cardId: primera, index: hueco});
  assert.equal(s.result.correct, true); assert.equal(s.players[0].hand.length, 2); assert.ok(s.timeline.includes(primera));
  assert.throws(() => E.step(s, {type: 'place', cardId: s.players[1].hand[0], index: 0}), /INVALID/, 'en el turno de otro no se juega');
  s = E.step(s, {type: 'ack'});
  assert.equal(s.current, 1);
  // Fallar: la carta no entra en la línea y se repone otra del mazo (sigue con las mismas cartas).
  const falla = s.players[1].hand.find(id => mal(s, id) !== null), largo = s.timeline.length, mazo = s.deck.length;
  s = E.step(s, {type: 'place', cardId: falla, index: mal(s, falla)});
  assert.equal(s.result.correct, false); assert.equal(s.timeline.length, largo, 'la carta fallada no entra en la línea');
  assert.equal(s.players[1].hand.length, 3, 'repone: tiene las mismas cartas que antes');
  assert.ok(!s.players[1].hand.includes(falla) && s.discard.includes(falla) && s.deck.length === mazo - 1, 'la fallada va al descarte y la nueva sale del mazo');
  assert.ok(s.result.drawn && s.players[1].hand.includes(s.result.drawn));
  s = E.step(s, {type: 'ack'});
  // Gana quien se queda sin cartas al cerrar la vuelta.
  const jugar = (st, quien) => { const id = st.players[st.current].hand[0]; return E.step(E.step(st, {type: 'place', cardId: id, index: quien === 'bien' ? bien(st, id) : mal(st, id)}), {type: 'ack'}); };
  let t = E.create({...config, names: ['Ana', 'Bea'], hand: 2});
  t = jugar(t, 'bien');
  assert.equal(t.phase, 'turn', 'todavía falta que juegue Bea');
  t = jugar(t, 'mal');
  assert.equal(t.phase, 'turn', 'nadie se ha quedado sin cartas: sigue la partida');
  assert.equal(JSON.stringify(t.players.map(p => p.hand.length)), '[1,2]', 'Bea falló y repone; Ana lleva una menos');
  assert.equal(t.round, 2, 'segunda vuelta');
  t = jugar(t, 'bien'); t = jugar(t, 'bien');
  assert.equal(t.phase, 'round-end'); assert.equal(JSON.stringify(t.winners), JSON.stringify([0]), 'gana Ana, la única sin cartas al cerrar la vuelta');
  // Varios sin cartas a la vez: final de desempate con una cifra secreta; gana la más cercana.
  let u = E.create({...config, names: ['Ana', 'Bea'], hand: 1});
  u = jugar(u, 'bien'); u = jugar(u, 'bien');
  assert.equal(u.phase, 'turn'); assert.ok(u.final, 'empatan sin cartas: final'); assert.equal(JSON.stringify(u.final.players), JSON.stringify([0, 1]));
  assert.throws(() => E.step(u, {type: 'place', cardId: deck[0], index: 0}), /INVALID/, 'en la final no se colocan cartas');
  const real = u.final.target;
  u = E.step(u, {type: 'guess', value: real + 1000});
  assert.equal(u.current, 1, 'después responde la otra persona');
  assert.throws(() => E.step(u, {type: 'guess', value: 1.5}), /INVALID/, 'solo enteros');
  u = E.step(u, {type: 'guess', value: real});
  assert.equal(u.phase, 'round-end'); assert.equal(JSON.stringify(u.winners), JSON.stringify([1]), 'gana la cifra más cercana');
  // Empate en la final: otra carta, solo con los empatados.
  let v = E.create({...config, names: ['Ana', 'Bea'], hand: 1});
  v = jugar(v, 'bien'); v = jugar(v, 'bien');
  const primeraCarta = v.final.cardId;
  v = E.step(E.step(v, {type: 'guess', value: v.final.target + 5}), {type: 'guess', value: v.final.target - 5});
  assert.equal(v.phase, 'turn'); assert.equal(v.final.round, 2, 'otra carta'); assert.notEqual(v.final.cardId, primeraCarta); assert.equal(JSON.stringify(v.final.players), JSON.stringify([0, 1]));
  // Sala: «hand» viaja en la configuración y el motor de la sala lo reconstruye igual en todos los móviles.
  const R = CT.QuickRoom;
  let room = R.create('ana', 'Ana', 3); room = R.reduce(room, 'ana', {type: 'start', rounds: [{id: 'col:history', order: deck}], kind: 'duel', hand: 2, historyId: 'sala'});
  assert.equal(room.config.hand, 2); assert.equal(R.state(room).players.length, 3); assert.equal(room.config.names.length, 3);
  assert.equal(room.actor, 'ana');
  const abre = R.state(room).players[0].hand[0];
  room = R.reduce(room, 'ana', {type: 'place', cardId: abre, index: bien(R.state(room), abre)}); room = R.reduce(room, 'ana', {type: 'ack'});
  assert.equal(room.actor, room.members[1] || room.host, 'el turno pasa a la siguiente plaza');
  room = R.reduce(room, 'bea', {type: 'join', name: 'Bea'});
  assert.equal(room.actor, 'bea', 'quien entra juega su turno con su mano');
  CT.QuickNetwork.mine = async () => [{code: 'KKKKKKKKK2', room, uid: 'ana'}];
  const [fila] = await CT.Quick.duels();
  assert.match(fila.marcador, /^Tú 1 carta · Bea 2 cartas · Jugador 3 2 cartas$/, 'Tus duelos cuenta las cartas que le quedan a cada uno');
  assert.equal(fila.collection, 'history');
}
// Grandes colecciones por turnos: el mazo elegido se juega con estas reglas, en rondas de 9 cartas más la de salida.
{
  const R = CT.QuickRoom, c = E.challenge('col:history');
  assert.equal(c.title, CT.mode('history').name, 'el mazo de colección se ve con su nombre');
  assert.ok(c.cards.every(card => typeof card.id === 'string' && Number.isFinite(card.value) && card.label), 'cada carta trae su valor y su etiqueta');
  const rondas = E.collectionRounds('history', 3);
  assert.equal(rondas.length, 3); assert.ok(rondas.every(r => r.id === 'col:history' && r.order.length === E.MULTI_CARDS));
  assert.equal(new Set(rondas.flatMap(r => r.order)).size, 3 * E.MULTI_CARDS, 'cada ronda trae cartas distintas');
  assert.equal(E.collectionRounds('history', 99).length, 5, 'como mucho cinco rondas');
  let r = R.create('me', 'Tester', 2); r = R.reduce(r, 'me', {type: 'start', rounds: rondas, kind: 'duel', keep: false});
  r = R.reduce(r, 'me', {type: 'place', cardId: R.state(r).remaining[0], index: 0}); r = R.reduce(r, 'me', {type: 'ack'});
  const joined = R.reduce(r, 'amigo', {type: 'join', name: 'Luis'});
  assert.equal(R.validate(joined).config.rounds[0].id, 'col:history', 'la sala se valida con el mazo de colección');
  CT.QuickNetwork.mine = async () => [{code: 'HHHHHHHHH2', room: joined, uid: 'me'}];
  const [row] = await CT.Quick.duels();
  assert.equal(row.collection, 'history', 'la fila del duelo recuerda el mazo para la revancha');
  assert.equal(row.deck, CT.mode('history').name);
  assert.match(row.detalle, /^Ronda 1 de 3 · carta \d de 9$/);
  // Las versiones anteriores no saben jugar estos mazos: la sala lleva otra huella, que esta versión acepta.
  assert.notEqual(CT.QuickNetwork.collectionFingerprint(), CT.QuickNetwork.fingerprint());
  assert.ok(CT.QuickNetwork.compatible(CT.QuickNetwork.collectionFingerprint()) && CT.QuickNetwork.compatible(CT.QuickNetwork.fingerprint()));
}
w.close();
