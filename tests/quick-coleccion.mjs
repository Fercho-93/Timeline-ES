// Retos rápidos en solitario: un álbum con todos los mazos, cada mazo se juega con 10 cartas y
// cada acierto propio deja la carta en la colección, que viaja con el progreso y suma en el ranking
// de descubrimientos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {gameHtml} from './game-fixture.mjs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {runScripts: 'outside-only', url: 'https://continuum.test/'}).window;
w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
const CT = w.CONTINUUM, E = CT.QuickEngine, Q = CT.Quick;
// Se escuchan los avisos de sonido y vibración que lanza la partida.
const cues = [];
CT.Effects = {...CT.Effects, discovery: () => cues.push('discovery'), transition: kind => cues.push(kind), feedback: ok => cues.push(ok ? 'acierto' : 'fallo'), bank: () => cues.push('bank')};

const plain = value => JSON.parse(JSON.stringify(value));

// La pantalla de solitario es un álbum: todos los mazos, con su progreso, y «Al azar».
w.sessionStorage.setItem('continuum-entry-route', 'quick');
CT.ModeHubs.open('hub-solo');
w.document.querySelector('[data-action="quick-challenges"]').click();
const tiles = [...w.document.querySelectorAll('[data-quick="play-deck"]')];
assert.equal(tiles.length, CT.QuickCatalog.challenges.length, 'todos los mazos a la vista');
assert.deepEqual(tiles.map(t => t.dataset.deck), plain(CT.QuickCatalog.challenges.map(c => c.id)), 'sin nada descubierto, en el orden del catálogo');
assert.match(tiles[0].textContent, /Descubiertas 0 de \d+/);
assert.ok(w.document.querySelector('[data-quick="play-random"]'), 'y un botón para jugar uno al azar');
assert.equal(w.document.querySelector('[data-quick="solo-mode"], [data-quick="start-free"]'), null, 'ya no hay mazos del día ni partida sorpresa');

// Un mazo se juega con 10 cartas que colocar, más la que abre la línea (o entero, si es más pequeño).
const deckId = tiles[0].dataset.deck, deck = E.challenge(deckId), jugadas = Math.min(deck.cards.length, E.SOLO_CARDS + 1);
assert.equal(E.SOLO_CARDS, 10);
w.document.querySelector(`[data-quick="play-deck"][data-deck="${deckId}"]`).click();
w.document.querySelector('[data-quick="ready"]').click();
const saved = () => JSON.parse(w.localStorage.getItem('continuum-quick-challenges-v1'));
assert.equal(saved().config.rounds.length, 1);
assert.equal(saved().config.rounds[0].id, deckId);
assert.equal(saved().config.rounds[0].order.length, jugadas, '10 cartas que colocar y una de referencia');

// Un acierto deja la carta en la colección y se celebra; un fallo no.
const value = id => deck.cards.find(c => c.id === id).value * deck.direction;
const play = right => {
  const s = E.restore(saved()), id = s.remaining[0];
  const after = s.timeline.findIndex(t => value(t) > value(id)), good = after < 0 ? s.timeline.length : after;
  const fits = i => CT.Engine.fits(s.timeline, id, i, value);
  const index = right ? good : [...Array(s.timeline.length + 1).keys()].find(i => !fits(i));
  w.document.querySelector(`[data-quick="select"][data-id="${id}"]`).click();
  w.document.querySelector(`[data-quick="slot"][data-index="${index}"]`).click();
  w.document.querySelector('[data-quick="confirm"]').click();
  return id;
};
const acertada = play(true);
assert.ok(CT.Progreso.quickSeenCards().has(acertada), 'el acierto entra en la colección');
assert.ok(cues.includes('acierto') && cues.includes('discovery'), 'una carta nueva suena como una lámina');
assert.match(w.document.querySelector('[data-quick-result]').textContent, /Nueva carta en tu colección/);
assert.deepEqual(plain(saved().found), [acertada], 'la partida guardada recuerda sus cartas nuevas');
w.document.querySelector('[data-quick="ack"]').click();
const fallada = play(false);
assert.ok(!CT.Progreso.quickSeenCards().has(fallada), 'un fallo no descubre la carta');
assert.doesNotMatch(w.document.querySelector('[data-quick-result]').textContent, /Nueva carta/);
w.document.querySelector('[data-quick="ack"]').click();

// La colección viaja con el progreso (hilo-perfil-v1) y descarta identificadores que no existen.
const perfil = JSON.parse(w.localStorage.getItem(CT.Progreso.KEY) || CT.Storage.getItem(CT.Progreso.KEY));
assert.deepEqual(plain(perfil.quickMastered), [acertada]);
assert.deepEqual(plain(CT.Progreso.discoveries()), {collections: 0, quick: 1, total: 1});
const ajeno = {...perfil, quickMastered: [acertada, 'inventada-1', 7, acertada]};
assert.equal(CT.Progreso.importJson(JSON.stringify(ajeno)).ok, true);
assert.deepEqual(plain(CT.Progreso.read().quickMastered), [acertada], 'solo cartas que existen, sin repetir');

// Al terminar el mazo, el resumen cuenta las cartas nuevas y lleva a la colección.
for (let guard = 0; E.restore(saved()).phase !== 'round-end' && guard < 60; guard++) {play(true); w.document.querySelector('[data-quick="ack"]').click();}
const final = w.document.querySelector('.quick-collection-summary');
assert.equal(cues.filter(k => k === 'end').length, 1, 'el final de la partida suena una vez');
assert.ok(final, 'resumen de la colección al acabar');
assert.match(final.textContent, new RegExp(`${jugadas - 2} cartas nuevas`));
final.querySelector('[data-quick="collection"]').click();
const album = w.document.querySelector('.quick-album');
assert.ok(album, 'se abre la colección');
assert.match(album.textContent, new RegExp(`${jugadas - 2} de 567 cartas descubiertas`));
const abierto = album.querySelector('.quick-album-deck[open]');
assert.match(abierto.textContent, new RegExp(deck.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.equal(abierto.querySelectorAll('.quick-album-card.is-found').length, jugadas - 2);
assert.equal(abierto.querySelectorAll('.quick-album-card.is-locked').length, deck.cards.length - jugadas + 2);
assert.equal(album.querySelectorAll('.quick-album-deck [data-quick="play-deck"]').length, CT.QuickCatalog.challenges.length, 'cualquier mazo se puede jugar desde la colección');
assert.equal(album.querySelector('.quick-album-deck').querySelector('b').textContent, deck.title, 'el mazo empezado va el primero');
// Al volver a jugarlo salen primero las cartas que aún faltan en la colección.
abierto.querySelector('[data-quick="play-deck"]').click();
w.document.querySelector('[data-quick="ready"]').click();
const vistas = CT.Progreso.quickSeenCards(), otra = saved().config.rounds[0].order;
const faltan = deck.cards.filter(c => !vistas.has(c.id)).length;
assert.equal(otra.length, jugadas);
assert.equal(otra.filter(id => !vistas.has(id)).length, Math.min(faltan, otra.length), 'las que faltan van delante');
// En el álbum, el mazo empezado sube arriba; «Al azar» elige uno sin completar, con 10 cartas.
CT.ModeHubs.open('hub-solo');
w.document.querySelector('[data-action="quick-challenges"]').click();
assert.equal(w.document.querySelector('[data-quick="play-deck"]').dataset.deck, deckId, 'el mazo empezado va el primero');
const completos = new Set(CT.QuickCatalog.challenges.filter(c => c.cards.every(card => CT.Progreso.quickSeenCards().has(card.id))).map(c => c.id));
for (let i = 0; i < 5; i++) {
  w.document.querySelector('[data-quick="play-random"]').click();
  const elegido = w.document.querySelector('.quick-ready h2')?.textContent;
  assert.ok(elegido && !completos.has(CT.QuickCatalog.challenges.find(c => c.title === elegido)?.id), 'al azar, uno sin completar');
  w.document.querySelector('[data-quick="ready"]').click();
  assert.equal(saved().config.rounds.length, 1, 'un solo mazo');
  assert.equal(saved().config.rounds[0].order.length, Math.min(E.challenge(saved().config.rounds[0].id).cards.length, E.SOLO_CARDS + 1), '10 cartas y la de referencia');
  CT.ModeHubs.open('hub-solo');
  w.document.querySelector('[data-action="quick-challenges"]').click();
}
console.log('Retos rápidos: álbum de mazos, 10 cartas por reto y colección de cartas descubiertas: OK');
