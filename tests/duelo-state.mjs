import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const source = fs.readFileSync('duelo-turnos.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
const dom = new JSDOM('<main id="app"></main><div id="toast"></div>', { url: 'https://continuum.test/', runScripts: 'outside-only' });
const w = dom.window;
w.scrollTo = () => {};
w.setInterval = w.setTimeout = () => 0;
let now = 1700000000000;
w.Date.now = () => now;
const games = new Map();
let offline = false, loseAck = false, writes = 0;
const clone = value => value && JSON.parse(JSON.stringify(value));
const cards = [{ id: 1, title: 'Primera', year: 100, detail: 'Una explicación' }, { id: 2, title: 'Segunda', year: 200, detail: 'Otra explicación' }, { id: 3, title: 'Tercera', year: 300, detail: 'Detalle tercero' }];
w.CONTINUUM = {
  escapeHtml: v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'), cards: () => cards,
  mode: () => ({ name: 'Historia' }), eraForCard: () => ({ key: 'modern', name: 'Historia', symbol: '✦' }),
  categoryBadge: () => '', animalArt: () => '', cardBack: () => '', sortValue: (_, c) => c.year,
  formatValue: (_, c) => String(c.year), hiddenLabel: () => 'Año oculto', timelineTitle: () => 'Cronología',
  placementHint: () => 'Debía ir después de Primera.',
  Accounts: { user: { uid: 'me' }, profile: { alias: 'Yo' } },
  Duelo: { CARTAS: 2, reparto: () => [1,2,3], Cifras: { CARTAS: 2, reparto: () => [2,3], leer: (_, value) => Number(value), puntosCarta: () => 75, banda: () => ({ nombre: 'Muy cerca' }), formato: (_, v) => `${v} años`, regla: () => ({ anos: true }) } }
};
w.__deps = {
  auth: { currentUser: { uid: 'me' } }, db: {}, doc: (_, ...args) => args.at(-1), Timestamp: { now: () => ({ seconds: now / 1000 }) }, serverTimestamp: () => ({ seconds: now / 1000 }),
  runTransaction: async (_, callback) => {
    if (offline) throw Object.assign(Error('offline'), { code: 'unavailable' });
    const changes = [];
    const result = await callback({ get: async key => ({ data: () => clone(games.get(key)), exists: () => games.has(key) }), update: (key, data) => changes.push([key, data]) });
    for (const [key, data] of changes) { games.set(key, { ...games.get(key), ...clone(data) }); writes++; }
    if (loseAck) { loseAck = false; throw Object.assign(Error('lost ack'), { code: 'unavailable' }); }
    return result;
  }
};
w.eval(`const {auth,db,doc,Timestamp,serverTimestamp,runTransaction}=window.__deps;\n${source}\nwindow.testDuel={
  show: game=>{current=game;preparingTurn=null;prepareTurn();render();}, ready:()=>{prepareTurn(true);render();}, refresh:()=>render(),
  place, queueMove, retryPending, outbox, pendingMove, cancel,
  deadline:()=>enteredAt, awaiting:()=>awaitingReady,
  snapshot:game=>{current=game;prepareTurn();render();},
  restore:game=>{current=game;preparingTurn=null;enteredAt=0;prepareTurn();render();}
};`);
const t = w.testDuel;
const game = (id, extra = {}) => ({ id, mode: 'history', kind: 'orden', status: 'playing', turnUid: 'me', turnIndex: 0, total: 2, seed: 'test', timeline: [1], plays: [], playersOrder: ['me','them'], players: { me: { alias: 'Yo' }, them: { alias: 'Rival' } }, scores: { me: 0, them: 0 }, updatedAt: { seconds: now/1000 }, ...extra });
try {
  games.set('one', game('one'));
  t.show(clone(games.get('one')));
  assert.equal(t.awaiting(), true);
  assert.equal(t.deadline(), 0);
  assert.equal(w.document.querySelector('.hand-card'), null);
  await t.place(1);
  assert.equal(writes, 0, 'cannot play before ready');
  t.ready(); const deadline = t.deadline();
  t.ready(); assert.equal(t.deadline(), deadline, 'repeated ready cannot extend time');
  assert.equal(w.document.querySelector('.hand-card'), null, 'card hidden during countdown');
  now += 4000;
  t.refresh();
  assert.ok(w.document.querySelector('.hand-card'));
  offline = true;
  await t.place(1);
  const saved = clone(t.pendingMove('one'));
  assert.equal(saved.ms, 1000);
  assert.equal(saved.index, 1);
  assert.equal(writes, 0);
  await t.place(0);
  assert.equal(t.pendingMove('one').index, 1, 'cannot change a queued answer');
  assert.equal(w.document.querySelector('.hand-card'), null);
  now += 20000;
  t.restore(clone(games.get('one')));
  assert.equal(t.deadline(), deadline, 'reload retains original deadline');
  assert.equal(w.document.querySelector('.hand-card'), null, 'reload with outbox does not reveal card');
  offline = false; loseAck = true;
  await t.retryPending();
  assert.equal(writes, 1);
  assert.equal(games.get('one').plays[0].ms, 1000, 'retry preserves answer time');
  assert.equal(games.get('one').scores.me, 1);
  assert.ok(t.pendingMove('one'), 'lost acknowledgement retains pending operation');
  games.set('other', game('other'));
  t.show(clone(games.get('other')));
  await t.retryPending();
  assert.equal(writes, 1, 'idempotent retry does not award points twice');
  assert.equal(t.pendingMove('one'), undefined);
  assert.equal(games.get('other').turnIndex, 0, 'navigation never retargets a pending move');
  t.show(clone(games.get('one')));
  assert.equal(w.document.querySelector('.reveal .year').textContent, '200');
  assert.doesNotMatch(w.document.querySelector('.turn-duel-solution').textContent, /Debía ir después/);
  t.show({ ...clone(games.get('one')), plays: [{ uid: 'them', cardId: 2, index: 0, correct: false }], timeline: [1], status: 'playing', turnUid: 'me' });
  assert.match(w.document.querySelector('.turn-duel-solution').textContent, /Debía ir después/);
  games.set('late', game('late'));
  t.show(clone(games.get('late'))); t.ready(); now += 19000;
  await t.place(1);
  assert.equal(games.get('late').plays[0].timeout, true, 'click after deadline is a timeout');
  assert.equal(games.get('late').scores.me, 0);
  games.set('numbers', game('numbers', {kind:'cifras',timeline:[]}));
  t.show(clone(games.get('numbers'))); t.ready(); now += 4000;
  await t.queueMove({respuesta:190});
  t.snapshot(clone(games.get('numbers')));
  assert.match(w.document.querySelector('.turn-duel-solution').textContent, /190 años/);
  assert.match(w.document.querySelector('.turn-duel-solution').textContent, /10 años/);
  assert.match(w.document.querySelector('.turn-duel-solution').textContent, /75/);
  const stats = w.CONTINUUM.TurnDuel.headToHead('them', [game('win',{status:'finished',scores:{me:2,them:1}}),game('loss',{status:'resigned',winnerUid:'them'}),game('tie',{status:'finished',kind:'cifras',scores:{me:5,them:5}}),game('ignore',{status:'cancelled',scores:{me:20,them:0}})]);
  assert.equal(stats.orden.wins, 1); assert.equal(stats.orden.losses, 1); assert.equal(stats.cifras.draws, 1);
  games.set('race',game('race'));
  await assert.rejects(t.cancel('race','waiting'), /ha cambiado/);
  console.log('OK: readiness, persisted deadline, offline recovery, lost acknowledgement, idempotency, navigation, timeout, shared solutions, head-to-head, cancellation race.');
} finally { dom.window.close(); }
