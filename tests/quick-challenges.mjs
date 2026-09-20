import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {gameHtml} from './game-fixture.mjs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const key = 'continuum-quick-challenges-v1';
function boot(saved) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {runScripts: 'outside-only', url: 'https://continuum.test/'}).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  if (saved) w.localStorage.setItem(key, saved);
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  return w;
}
let w = boot(), CT = w.CONTINUUM, E = CT.QuickEngine;
const round = id => ({id, order: E.challenge(id).cards.map(c => c.id)});
const config = {names: ['Ana', 'Luis'], rounds: [round('poker'), round('social'), round('oscars')]};
let s = E.create(config);
assert.equal(s.remaining.length, 8);
assert.equal(s.timeline.length, 1);
const original = JSON.stringify(s);
s = E.step(s, {type: 'place', cardId: 'poker-2', index: 1});
assert.equal(s.players[0].points, 1);
assert.equal(s.phase, 'result');
assert.equal(E.create(config).players[0].points, 0);
assert.equal(JSON.parse(original).remaining.length, 8);
assert.throws(() => E.step(s, {type: 'bank'}));
s = E.step(s, {type: 'ack'});
assert.equal(s.current, 1);
s = E.step(s, {type: 'bank'});
assert.equal(s.current, 0);
s = E.step(s, {type: 'place', cardId: 'poker-3', index: 0});
assert.equal(s.result.lost, 1);
assert.equal(s.players[0].points, 0);
assert.equal(s.players[0].status, 'failed');
assert.deepEqual([...s.timeline], ['poker-1', 'poker-2', 'poker-3']);
s = E.step(s, {type: 'ack'});
assert.equal(s.phase, 'round-end');
s = E.step(s, {type: 'next'});
assert.equal(s.current, 1);
assert.ok(s.players.every(p => p.status === 'active'));
// Asegurar conserva la puntuación y no vuelve a sumar al cerrar la ronda.
s = E.create({names: ['Ana', 'Luis'], rounds: [round('social')]});
s = E.step(s, {type: 'place', cardId: 'social-2', index: 1}); s = E.step(s, {type: 'ack'});
s = E.step(s, {type: 'bank'}); s = E.step(s, {type: 'bank'});
assert.equal(s.players[0].score, 1); assert.equal(s.players[0].roundScore, 1);
assert.throws(() => E.step(s, {type: 'bank'}));
// Agotamiento, dirección descendente y empates válidos.
s = E.create({names: ['A', 'B'], rounds: [round('oscars')]});
while (s.remaining.length) {
  s = E.step(s, {type: 'place', cardId: s.remaining[0], index: s.timeline.length});
  assert.equal(s.result.correct, true); s = E.step(s, {type: 'ack'});
}
assert.equal(s.phase, 'round-end'); assert.equal(s.players.reduce((sum, p) => sum + p.score, 0), 9);
const oscars = E.challenge('oscars'); const before = oscars.cards[1].value;
oscars.cards[1].value = oscars.cards[0].value;
for (const index of [0, 1]) {
  s = E.create({names: ['A', 'B'], rounds: [round('oscars')]});
  assert.equal(E.step(s, {type: 'place', cardId: 'oscars-2', index}).result.correct, true);
}
oscars.cards[1].value = before;
assert.throws(() => E.create({names: ['A'], rounds: [round('social')]}));
assert.throws(() => E.restore({version: -1, config, commands: []}));
assert.throws(() => E.restore({version: 1, config, commands: [{type: 'place', cardId: 'missing', index: 0}]}));
assert.throws(() => E.create({names: ['A', 'B'], rounds: [{id:'social', order: ['social-1']}]}));
for (const c of CT.QuickCatalog.challenges) {
  assert.ok(c.cards.length >= 2 && c.cards.length <= 10);
  assert.equal(new Set(c.cards.map(card => card.id)).size, c.cards.length);
  assert.ok(c.cards.every(card => Number.isFinite(card.value) && card.title && card.label && card.detail && card.source.startsWith('https://')));
}
assert.equal(CT.QuickCatalog.upcoming.cards.length, 0);
assert.equal(CT.has('counts'), false, 'El mazo pendiente no entra en partidas ni en competición');
// Integración real con portada, selección, confirmación, guardado y fin de partida.
const click = selector => {const el = w.document.querySelector(selector); assert.ok(el, selector); el.click();};
click('[data-action="quick-challenges"]');
assert.match(w.document.querySelector('#app').textContent, /Un solo móvil/);
click('[data-quick="start"]');
let saved = JSON.parse(w.localStorage.getItem(key));
assert.equal(saved.config.rounds.length, 3);
assert.equal(new Set(saved.config.rounds.map(r => r.id)).size, 3);
for (let r = 0; r < 3; r++) {
  saved = JSON.parse(w.localStorage.getItem(key)); s = E.restore(saved);
  const c = E.challenge(s.config.rounds[r].id);
  const cardId = s.remaining[0];
  const val = id => c.cards.find(card => card.id === id).value * c.direction;
  const index = s.timeline.findIndex(id => val(id) > val(cardId));
  click(`[data-quick="select"][data-id="${cardId}"]`);
  assert.equal(w.document.querySelector('[data-quick="confirm"]'), null);
  click(`[data-quick="slot"][data-index="${index < 0 ? s.timeline.length : index}"]`);
  click('[data-quick="confirm"]');
  const snapshot = w.localStorage.getItem(key);
  assert.equal(E.restore(JSON.parse(snapshot)).phase, 'result');
  w.close(); w = boot(snapshot); CT = w.CONTINUUM; E = CT.QuickEngine;
  click('[data-action="quick-challenges"]'); click('[data-quick="resume"]');
  assert.match(w.document.querySelector('#app').textContent, /¡Bien colocado!/);
  click('[data-quick="ack"]'); click('[data-quick="bank"]'); click('[data-quick="bank"]');
  assert.equal(E.restore(JSON.parse(w.localStorage.getItem(key))).phase, 'round-end');
  if (r < 2) click('[data-quick="next"]');
}
assert.equal(w.document.querySelector('[data-quick="next"]'), null);
assert.match(w.document.querySelector('#app').textContent, /Gana|Victoria compartida/);
click('[data-action="home"]');
assert.match(w.document.querySelector('#app').textContent, /¿Cuántos hay…\?/);
assert.ok(w.document.querySelector('[data-action="competition-menu"]'));
w.close();
w = boot('{invalid'); click('[data-action="quick-challenges"]');
assert.match(w.document.querySelector('#app').textContent, /No se ha podido recuperar/);
assert.equal(w.document.querySelector('[data-quick="resume"]'), null);
w.close();
console.log('Retos rápidos: reglas, empates, orden descendente, turnos, recuperación y tres rondas completas: OK');
