import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {gameHtml} from './game-fixture.mjs';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {runScripts: 'outside-only', url: 'https://continuum.test/'}).window;
w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
const CT = w.CONTINUUM, P = CT.Progreso, E = CT.Enciclopedia;
const [a,b,c,d,e,f] = CT.cards('history');

// La lista antigua no demuestra aciertos y no puede desbloquear el nuevo álbum.
CT.Storage.setItem(P.KEY, JSON.stringify({seen: [a.id], totals: {games: 4, cards: 8, hits: 5}}));
assert.equal(P.seenCards().size, 0);
assert.equal(P.read().totals.hits, 5, 'La migración conserva las estadísticas');
P.record({mode: 'history', cardId: a.id, correct: false});
assert.equal(P.seenCards().has(a.id), false);
P.record({mode: 'history', cardId: a.id, correct: true});
assert.equal(P.seenCards().has(a.id), true);
P.record({mode: 'history', cardId: b.id, correct: true, kind: 'local', mine: false});
assert.equal(P.seenCards().has(b.id), false, 'Un acierto ajeno no desbloquea');
P.record({mode: 'history', cardId: b.id, correct: true, kind: 'local', mine: true});
assert.equal(P.seenCards().has(b.id), true);
P.recordOnline({code: 'ONE', version: 1, mode: 'history', cardId: c.id, correct: true, mine: false});
assert.equal(P.seenCards().has(c.id), false);
P.recordOnline({code: 'ONE', version: 2, mode: 'history', cardId: c.id, correct: true, mine: true});
assert.equal(P.seenCards().has(c.id), true);
P.record({mode: 'mixed', cardId: d.id, correct: true, kind: 'comp'});
assert.equal(P.seenCards().has(d.id), true, 'La gran mezcla desbloquea en el mazo original');
P.record({mode: 'history', cardId: e.id, correct: true, kind: 'cifras'});
assert.equal(P.seenCards().has(e.id), true);
const hits = P.read().totals.hits;
assert.equal(P.discover({mode: 'history', cardId: f.id, correct: true, mine: false}), false);
assert.equal(P.discover({mode: 'history', cardId: f.id, correct: true, mine: true}), true);
assert.equal(P.discover({mode: 'history', cardId: f.id, correct: true, mine: true}), false);
assert.equal(P.read().totals.hits, hits, 'Recuperar un acierto de un duelo no duplica estadísticas');

for (const mode of ['history','animals','lifespan','distances','languages']) {
  const card = CT.cards(mode).find(c => CT.cardArt(mode, c));
  if (!card) continue;
  for (const unlocked of [false, true]) {
    const fragment = w.document.createElement('div');
    fragment.innerHTML = E.cardMarkup(mode, card, {descubiertas: new Set(unlocked ? [card.id] : [])});
    assert.equal(!!fragment.querySelector('img'), unlocked);
    assert.equal(fragment.querySelector('.year,.enc-era'), null);
    assert.equal(/\d/.test(fragment.querySelector('.card-content > p').textContent), false, mode + ': la descripción no filtra cifras');
    assert.ok(fragment.textContent.includes(card.title));
    assert.equal(fragment.querySelector('.card-visual').className, 'card-visual');
  }
}
assert.doesNotMatch(E.description({detail: 'Una obrera vive seis semanas y pesa 0,12 g.'}), /seis|0,12/);
const ordered = E.filterCards('history');
assert.ok(ordered.every((card,i) => !i || ordered[i-1].title.localeCompare(card.title,'es') <= 0));
assert.doesNotMatch(E.recentMarkup(), /class="year"|<span>[^<]*a\. C\./);

// El álbum y la ficha ampliada usan la misma vista sin dato.
CT.localNavigate('perfil');
w.document.querySelector('[data-action="home-encyclopedia"]').click();
const select = w.document.querySelector('#enc-mode-select'); select.value = 'history'; select.dispatchEvent(new w.Event('change', {bubbles:true}));
assert.equal(w.document.querySelector('#enc-results .year'), null);
assert.equal(w.document.querySelector('.band-chip'), null);
w.document.querySelector('[data-enc-card]').click();
assert.ok(w.document.querySelector('.enc-card-modal'));
assert.equal(w.document.querySelector('.enc-card-modal .year'), null);

 // Recuperar duelos antiguos exige un acierto real, no puntos parciales.
P.reset();
w.eval('const auth = {currentUser: {uid: "atlas-owner"}};\n' + read('duelo-turnos.js').replace(/^import .*;\r?\n/gm, '') + '\nwindow.recoverAtlasPlays = discoverOwnPlays;');
w.recoverAtlasPlays({mode:'history',kind:'orden',plays:[
  {uid:'other',cardId:a.id,correct:true},
  {uid:'atlas-owner',cardId:b.id,correct:false},
  {uid:'atlas-owner',cardId:c.id,correct:true}
]});
assert.equal(P.seenCards().has(a.id), false);
assert.equal(P.seenCards().has(b.id), false);
assert.equal(P.seenCards().has(c.id), true);
w.recoverAtlasPlays({mode:'history',kind:'cifras',plays:[
  {uid:'atlas-owner',cardId:d.id,respuesta:d.year+100,points:10},
  {uid:'atlas-owner',cardId:e.id,respuesta:e.year,points:100},
  {uid:'atlas-owner',cardId:f.id,respuesta:f.year,points:100,timeout:true}
]});
assert.equal(P.seenCards().has(d.id), false, 'Los puntos parciales antiguos no son un acierto');
assert.equal(P.seenCards().has(e.id), true);
assert.equal(P.seenCards().has(f.id), false);

w.close();
console.log('OK: solo aciertos propios, migración, online, local, mezcla, cifras, duelos sin duplicar, álbum y ficha sin datos.');
