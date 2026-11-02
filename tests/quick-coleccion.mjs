// Retos rápidos en solitario: cuatro mazos al azar cada día, cada mazo se juega con 10 cartas y
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

// Rotación: cuatro mazos al azar cada día, iguales para todos, que cambian de un día a otro y
// recorren el catálogo entero en ocho días.
const ids = day => plain(Q.todayDecks(day).map(c => c.id));
assert.equal(ids('2026-10-13').length, 4);
assert.equal(new Set(ids('2026-10-13')).size, 4, 'sin repetir en el mismo día');
assert.deepEqual(ids('2026-10-13'), ids('2026-10-13'), 'el mismo día salen los mismos');
assert.equal(ids('2026-10-13').filter(id => ids('2026-10-14').includes(id)).length, 0, 'sin repetir de un día al siguiente');
const semana = new Set(['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20'].flatMap(ids));
assert.equal(semana.size, CT.QuickCatalog.challenges.length, 'en ocho días han salido todos los retos');

// La pantalla de solitario enseña solo los cuatro mazos de hoy, con su progreso.
w.sessionStorage.setItem('continuum-entry-route', 'quick');
CT.ModeHubs.open('hub-solo');
w.document.querySelector('[data-action="quick-challenges"]').click();
const hoy = ids(new Date().toLocaleDateString('sv-SE'));
const tiles = [...w.document.querySelectorAll('[data-quick="play-deck"]')];
assert.deepEqual(tiles.map(t => t.dataset.deck), hoy, 'los cuatro mazos de hoy');
assert.match(tiles[0].textContent, /Descubiertas 0 de \d+/);
assert.match(w.document.querySelector('.quick-album-note').textContent, /Cambian cada día \(dentro de \d+ h\)/);
assert.equal(w.document.querySelector('[data-quick="play-random"], [data-quick="solo-mode"], [data-quick="start-free"]'), null, 'ni «Al azar» ni partida sorpresa');
assert.equal(w.document.querySelector('.quick-resume'), null, 'sin partida guardada no hay tarjeta de continuar');

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
assert.equal(album.querySelectorAll('.quick-album-deck [data-quick="play-deck"]').length, 4, 'desde la colección solo se juegan los mazos de hoy');
assert.equal(album.querySelectorAll('.quick-album-today').length, 4, 'y van marcados con «Hoy»');
const grupos = () => [...w.document.querySelectorAll('[data-deck-group]')].map(g => [g.dataset.deckGroup, g.querySelectorAll('.quick-album-deck').length]);
assert.deepEqual(grupos(), [['started', 1], ['new', CT.QuickCatalog.challenges.length - 1]], 'la colección agrupa igual: empezados y nuevos');
assert.equal(album.querySelector('[data-deck-group="started"] .quick-album-deck b').textContent, deck.title, 'el mazo empezado va en «Empezados»');
// Al volver a jugarlo salen primero las cartas que aún faltan en la colección.
abierto.querySelector('[data-quick="play-deck"]').click();
w.document.querySelector('[data-quick="ready"]').click();
const vistas = CT.Progreso.quickSeenCards(), otra = saved().config.rounds[0].order;
const faltan = deck.cards.filter(c => !vistas.has(c.id)).length;
assert.equal(otra.length, jugadas);
assert.equal(otra.filter(id => !vistas.has(id)).length, Math.min(faltan, otra.length), 'las que faltan van delante');
// Con una partida a medias, «Continuar» es una tarjeta con su mazo y lo jugado, aparte del panel.
CT.ModeHubs.open('hub-solo');
w.document.querySelector('[data-action="quick-challenges"]').click();
const resume = w.document.querySelector('.quick-resume');
assert.ok(resume && resume.querySelector('[data-quick="resume"]'), 'tarjeta de partida a medias');
assert.equal(resume.querySelector('b').textContent, deck.title);
assert.match(resume.textContent, /\d+ de \d+ cartas jugadas/);
assert.ok(!resume.closest('.solo-panel'), 'fuera del panel de mazos');
// Un mazo que no es de hoy no se juega aunque llegue la orden.
const fuera = CT.QuickCatalog.challenges.find(c => !hoy.includes(c.id));
const falso = w.document.createElement('button'); falso.dataset.quick = 'play-deck'; falso.dataset.deck = fuera.id;
w.document.querySelector('#app').append(falso); falso.click();
assert.ok(w.document.querySelector('.quick-free-setup'), 'vuelve a los mazos de hoy');
console.log('Retos rápidos: cuatro mazos al azar cada día, 10 cartas por reto y colección de cartas descubiertas: OK');
