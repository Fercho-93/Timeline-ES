// Retos rápidos en solitario: los mazos del día rotan por el catálogo, cada mazo se juega entero y
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

// Rotación: cuatro mazos distintos cada día, iguales para todos, que cambian de un día a otro y
// recorren el catálogo entero en ocho días.
// Los arrays vienen de la ventana de JSDOM: se comparan por contenido.
const plain = value => JSON.parse(JSON.stringify(value));
const ids = day => plain(Q.todayDecks(day).map(c => c.id));
assert.equal(ids('2026-10-13').length, 4);
assert.equal(new Set(ids('2026-10-13')).size, 4, 'sin repetir en el mismo día');
assert.deepEqual(ids('2026-10-13'), ids('2026-10-13'), 'el mismo día salen los mismos');
assert.notDeepEqual(ids('2026-10-13'), ids('2026-10-14'), 'al día siguiente salen otros');
assert.equal(ids('2026-10-13').filter(id => ids('2026-10-14').includes(id)).length, 0, 'sin repetir de un día al siguiente');
const semana = new Set(['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20'].flatMap(ids));
assert.equal(semana.size, CT.QuickCatalog.challenges.length, 'en ocho días han salido todos los retos');

// La pantalla de solitario enseña los mazos de hoy con su progreso.
w.sessionStorage.setItem('continuum-entry-route', 'quick');
CT.ModeHubs.open('hub-solo');
w.document.querySelector('[data-action="quick-challenges"]').click();
const tiles = [...w.document.querySelectorAll('[data-quick="play-deck"]')];
assert.equal(tiles.length, 4, 'cuatro mazos del día');
assert.deepEqual(tiles.map(t => t.dataset.deck), ids(new Date().toLocaleDateString('sv-SE')));
assert.match(tiles[0].textContent, /Descubiertas 0 de \d+/);

// Dos formas de jugar bien separadas: mazos del día (por defecto) o partida sorpresa. Solo se ve una.
const modo = key => w.document.querySelector(`[data-quick="solo-mode"][data-mode="${key}"]`);
const panel = key => w.document.querySelector(`[data-mode-pane="${key}"]`);
assert.equal(modo('day').getAttribute('aria-checked'), 'true', 'empieza en los mazos del día');
assert.equal(panel('day').hidden, false);
assert.equal(panel('surprise').hidden, true, 'la partida sorpresa no se mezcla con los mazos del día');
assert.match(modo('day').textContent, /Cambian en \d+ h/);
modo('surprise').click();
assert.equal(modo('surprise').getAttribute('aria-checked'), 'true');
assert.equal(panel('surprise').hidden, false);
assert.equal(panel('day').hidden, true);
assert.ok(panel('surprise').querySelector('[data-quick="start-free"]') && panel('surprise').querySelector('.quick-length'));
// Se recuerda la última forma elegida.
w.document.querySelector('[data-quick="collection"]').click();
w.document.querySelector('[data-quick="formats"]').click();
assert.equal(panel('surprise').hidden, false, 'al volver sigue en la partida sorpresa');
modo('day').click();

// Un mazo del día se juega entero.
const deckId = tiles[0].dataset.deck, deck = E.challenge(deckId);
w.document.querySelector(`[data-quick="play-deck"][data-deck="${deckId}"]`).click();
w.document.querySelector('[data-quick="ready"]').click();
const saved = () => JSON.parse(w.localStorage.getItem('continuum-quick-challenges-v1'));
assert.equal(saved().config.rounds.length, 1);
assert.equal(saved().config.rounds[0].id, deckId);
assert.equal(saved().config.rounds[0].order.length, deck.cards.length, 'con todas sus cartas');

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
assert.ok(final, 'resumen de la colección al acabar');
assert.match(final.textContent, new RegExp(`${deck.cards.length - 2} cartas nuevas`));
final.querySelector('[data-quick="collection"]').click();
const album = w.document.querySelector('.quick-album');
assert.ok(album, 'se abre la colección');
assert.match(album.textContent, new RegExp(`${deck.cards.length - 2} de 567 cartas descubiertas`));
const abierto = album.querySelector('.quick-album-deck[open]');
assert.match(abierto.textContent, new RegExp(deck.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.equal(abierto.querySelectorAll('.quick-album-card.is-found').length, deck.cards.length - 2);
assert.equal(abierto.querySelectorAll('.quick-album-card.is-locked').length, 2);
assert.ok(abierto.querySelector('.quick-album-today'), 'marca los mazos de hoy');
// Un mazo que no es de hoy no se puede jugar desde la colección.
const otro = album.querySelector('.quick-album-deck:not(:has(.quick-album-today))');
assert.equal(otro.querySelector('[data-quick="play-deck"]'), null);
console.log('Retos rápidos: mazos del día, mazo entero y colección de cartas descubiertas: OK');
