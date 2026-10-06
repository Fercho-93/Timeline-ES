// Competición por turnos: varios temas al azar en un mismo duelo por turnos. Se juega una
// partida entera de dos temas entre dos jugadores con el código real de duelo-turnos.js y
// se comprueba lo que exigen las reglas de Firestore, que no cambian: el documento lleva
// los mismos campos de siempre, la línea guardada solo crece una carta por acierto y nunca
// se vacía al pasar de tema.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const source = fs.readFileSync('duelo-turnos.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
const dom = new JSDOM('<main id="app"></main><div id="toast"></div>', { url: 'https://continuum.test/', runScripts: 'outside-only' });
const w = dom.window;
w.scrollTo = () => {};
w.setInterval = w.setTimeout = () => 0;
const games = new Map();
const clone = value => value && JSON.parse(JSON.stringify(value));
// Dos mazos cuyas cartas comparten identificadores, como pasa entre mazos reales: la línea de
// cada tema tiene que salir de su propio mazo.
const decks = {
  alfa: [1, 2, 3, 4].map(id => ({ id, title: `Alfa ${id}`, year: id * 100, detail: '' })),
  beta: [1, 2, 3, 4].map(id => ({ id, title: `Beta ${id}`, year: id * 10, detail: '' }))
};
let me = 'ana';
w.CONTINUUM = {
  escapeHtml: v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
  has: key => key in decks, cards: key => decks[key], mode: key => ({ name: key === 'alfa' ? 'Alfa' : 'Beta' }),
  eraForCard: () => ({ key: 'modern', name: 'Era', symbol: '✦' }), categoryBadge: () => '', animalArt: () => '', cardBack: () => '',
  sortValue: (_, c) => c.year, formatValue: (_, c) => String(c.year), hiddenLabel: () => 'Oculto', timelineTitle: () => 'Línea',
  placementHint: () => '', timelineEnds: () => '', timelineMap: () => '',
  Accounts: { get user() { return { uid: me }; }, profile: { alias: 'Yo' } },
  Identidad: { propio: () => me === 'ana' ? 'Ana' : 'Bea' },
  Tournament: { create: rounds => ({ queue: ['alfa', 'beta'].slice(0, rounds) }) },
  // Reparto fijo: el orden del mazo tal cual, tantas cartas como pida el tema más la de salida.
  Duelo: { CARTAS: 15, reparto: (mode, _seed, total) => decks[mode].slice(0, total + 1).map(c => c.id), crearSemilla: () => 'semilla', Cifras: { CARTAS: 10 } }
};
w.eval(fs.readFileSync('links.js', 'utf8'));
const created = [];
w.__deps = {
  auth: { get currentUser() { return { uid: me }; } }, db: {}, doc: (_, ...args) => args.at(-1),
  Timestamp: { now: () => ({ seconds: Date.now() / 1000 }) }, serverTimestamp: () => ({ seconds: Date.now() / 1000 }),
  onSnapshot: (key, callback) => { callback({ data: () => clone(games.get(key)), metadata: {} }); return () => {}; },
  runTransaction: async (_, callback) => {
    const changes = [];
    const result = await callback({ get: async key => ({ data: () => clone(games.get(key)), exists: () => games.has(key) }), set: (key, data) => { created.push(key); games.set(key, clone(data)); }, update: (key, data) => changes.push([key, data]) });
    for (const [key, data] of changes) games.set(key, { ...games.get(key), ...clone(data) });
    return result;
  }
};
w.navigator.clipboard = { writeText: async () => {} };
w.eval(`const {auth,db,doc,Timestamp,serverTimestamp,runTransaction,onSnapshot}=window.__deps;\n${source}\nwindow.testComp={
  create, localCard, timelineCards, gameLabel, modeAt, themeAt,
  show: game=>{current=game;prepareTurn();render();}, queueMove
};`);
const t = w.testComp;

await t.create('history', 'orden', null, { rounds: 2, cards: 2 });
assert.equal(created.length, 1, 'se crea un único documento');
const id = created[0];
let game = games.get(id);
assert.deepEqual(Object.keys(game).sort(), ['createdAt', 'id', 'kind', 'mode', 'playersOrder', 'players', 'plays', 'scores', 'seed', 'status', 'timeline', 'total', 'turnIndex', 'turnUid', 'updatedAt'].sort(), 'los mismos campos que admiten las reglas');
assert.equal(game.mode, 'comp:alfa,beta', 'los temas viajan en el campo del mazo');
assert.equal(game.kind, 'orden');
assert.equal(game.total, 4, 'dos temas por dos cartas');
assert.deepEqual(game.timeline, [1], 'la línea empieza con la carta de salida del primer tema');
assert.equal(t.gameLabel(game), 'Competición · 2 temas');

// Juega quien tenga el turno y coloca bien o mal la carta que le toca.
async function play(player, correct) {
  me = player;
  const before = clone(games.get(id));
  t.show({ ...clone(before), id });
  const card = t.localCard(before), line = t.timelineCards(before), mode = t.modeAt(before);
  const right = line.findIndex(c => c.year > card.year);
  const good = right < 0 ? line.length : right;
  const index = correct ? good : good === 0 ? line.length : 0;
  await t.queueMove({ index });
  const after = games.get(id);
  return { before, after, card, mode, correct: after.plays.at(-1).correct };
}

// Turno 0: empieza quien crea, antes de que entre la rival (tema Alfa).
let r = await play('ana', true);
assert.equal(r.mode, 'alfa');
assert.equal(r.card.title, 'Alfa 2');
assert.equal(r.correct, true);
assert.deepEqual(r.after.timeline, [1, 2], 'un acierto suma exactamente una carta a la línea guardada');
assert.equal(r.after.status, 'waiting');
// Entra Bea, como haría join(): la línea no cambia.
games.set(id, { ...games.get(id), playersOrder: ['ana', 'bea'], players: { ana: { alias: 'Ana' }, bea: { alias: 'Bea' } }, scores: { ana: 1, bea: 0 }, status: 'playing', turnUid: 'bea' });

// Turno 1: Bea falla en Alfa; la línea guardada no cambia.
r = await play('bea', false);
assert.equal(r.mode, 'alfa');
assert.equal(r.correct, false);
assert.deepEqual(r.after.timeline, r.before.timeline, 'un fallo no toca la línea guardada');
assert.equal(r.after.turnUid, 'ana');

// Turno 2: empieza el tema Beta con su propia carta de salida y su propio mazo.
game = games.get(id);
assert.equal(t.themeAt(game), 1);
assert.deepEqual(t.timelineCards(game).map(c => c.title), ['Beta 1'], 'el segundo tema empieza con su propia línea');
r = await play('ana', true);
assert.equal(r.mode, 'beta');
assert.equal(r.card.title, 'Beta 2');
assert.deepEqual(r.after.timeline, [...r.before.timeline, 2], 'la línea guardada sigue creciendo, sin vaciarse al cambiar de tema');
me = 'bea';
assert.match(w.document.querySelector('.turn-duel-heading').textContent, /tema 2 de 2 · Beta/, 'la cabecera dice qué tema se juega');

// Turno 3: Bea acierta y la competición termina.
r = await play('bea', true);
assert.equal(r.mode, 'beta');
assert.equal(r.card.title, 'Beta 3');
assert.deepEqual(t.timelineCards(r.after, 1).map(c => c.title), ['Beta 1', 'Beta 2', 'Beta 3'], 'la línea de Beta se rehace con sus aciertos');
assert.deepEqual(t.timelineCards(r.after, 0).map(c => c.title), ['Alfa 1', 'Alfa 2'], 'y la de Alfa sigue siendo la suya');
assert.equal(r.after.status, 'finished');
assert.deepEqual(r.after.scores, { ana: 2, bea: 1 });
assert.equal(r.after.timeline.length, 1 + 3, 'una carta guardada por cada acierto, más la de salida');

console.log('Competición por turnos: temas al azar, reparto por tema, líneas propias y documento válido para las reglas: OK');
