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
// Cada carta enseña su curiosidad al descubrirse y conserva referencias trazables.
const quickCards = CT.QuickCatalog.challenges.flatMap(deck => deck.cards);
assert.equal(CT.QuickCatalog.version, 3, 'los cambios de texto conservan las partidas guardadas');
assert.equal(quickCards.length, 567);
assert.equal(new Set(quickCards.map(card => card.curiosity)).size, 567);
const auditedNotes = new Map(['docs/fuentes-metros-ampliacion-2026-10-04.json','docs/fuentes-siete-retos-ampliacion-2026-10-05.json','docs/fuentes-seis-retos-ampliacion-2026-10-05.json'].flatMap(file=>JSON.parse(read(file)).cards.map(card=>[card.id,card.measureNote])));
for (const deck of CT.QuickCatalog.challenges) for (const card of deck.cards) {
  assert.ok(card.image && fs.existsSync(new URL('../' + card.image, import.meta.url)), `${card.id}: ilustración propia existente`);
  assert.ok(typeof card.curiosity === 'string' && card.curiosity.length >= 50, `${card.id}: curiosidad propia`);
  assert.ok(card.detail.startsWith(card.curiosity), `${card.id}: curiosidad antes del criterio de medida`);
  assert.ok(card.detail.includes(auditedNotes.get(card.id) || deck.context), `${card.id}: conserva las aclaraciones de comparación`);
  assert.ok(/^https?:\/\//.test(card.source), `${card.id}: fuente del dato`);
  assert.ok(/^https:\/\//.test(card.curiositySource), `${card.id}: fuente de la curiosidad`);
  if (deck.asOf) assert.ok(card.detail.includes(`Datos a ${deck.asOf}.`));
}
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
// Agotamiento, orden de izquierda a derecha y empates válidos.
// De izquierda a derecha, cada mazo aumenta su magnitud o su fecha absoluta.
for (const c of CT.QuickCatalog.challenges) assert.equal(c.direction,1,c.id);
const tv=E.challenge('spanish-tv');
assert.equal(tv.cards.length,19);
assert.equal(tv.asOf,null,'las fechas históricas no llevan fecha de actualización anual');
const tvSources=JSON.parse(read('docs/fuentes-programas-estrenos-2026-10-04.json'));
for(const r of tvSources.cards){const card=tv.cards.find(c=>c.id===r.id);const [year,month]=r.date.split('-').map(Number);assert.equal(card.value,year*100+month);assert.equal(card.label,r.label);assert.equal(card.source,r.source);assert.ok(!/hace|años transcurridos/.test(card.detail+' '+card.label));}
s=E.create({names:['A','B'],rounds:[round('spanish-tv')]});
while(s.remaining.length){const id=s.remaining[0],date=x=>tv.cards.find(c=>c.id===x).value;const place=s.timeline.findIndex(t=>date(t)>date(id));s=E.step(s,{type:'place',cardId:id,index:place<0?s.timeline.length:place});assert.equal(s.result.correct,true);s=E.step(s,{type:'ack'});}
assert.equal(s.phase,'round-end');
{const dates=s.timeline.map(id=>tv.cards.find(c=>c.id===id).value);assert.equal(JSON.stringify(dates),JSON.stringify([...dates].sort((a,b)=>a-b)));}
{const order=['spanish-tv-3','spanish-tv-4'],state=E.create({names:['A','B'],rounds:[{id:'spanish-tv',order}]});assert.equal(E.step(state,{type:'place',cardId:order[1],index:1}).result.correct,true,'abril de 2006 antes de septiembre de 2006');assert.equal(E.step(state,{type:'place',cardId:order[1],index:0}).result.correct,false,'el mismo año no basta para empatar');}
const oldTvSave={version:3,config:{names:['Ana','Luis'],rounds:[{id:'spanish-tv',order:Array.from({length:9},(_,i)=>'spanish-tv-'+(i+1))}]},commands:[{type:'place',cardId:'spanish-tv-2',index:0}]};
assert.equal(E.restore(oldTvSave).phase,'result');assert.equal(E.restore(oldTvSave).result.correct,true);
s = E.create({names: ['A', 'B'], rounds: [round('oscars')]});
assert.equal(E.step(s, {type: 'place', cardId: 'oscars-2', index: 0}).result.correct, true, 'con menos Óscar que la de referencia, va a su izquierda');
assert.equal(E.step(s, {type: 'place', cardId: 'oscars-2', index: 1}).result.correct, false, 'y no a su derecha');
const serie = E.challenge('series-seasons');
s = E.create({names: ['A', 'B'], rounds: [round('series-seasons')]});
const base = serie.cards.find(c => c.id === s.timeline[0]);
const mas = serie.cards.find(c => c.value > base.value), menos = serie.cards.find(c => c.value < base.value);
if (mas) assert.equal(E.step(s, {type: 'place', cardId: mas.id, index: 1}).result.correct, true, 'más temporadas, a la derecha');
if (menos) assert.equal(E.step(s, {type: 'place', cardId: menos.id, index: 0}).result.correct, true, 'menos temporadas, a la izquierda');
const oscars = E.challenge('oscars'); const before = oscars.cards[1].value;
oscars.cards[1].value = oscars.cards[0].value;
for (const index of [0, 1]) {
  s = E.create({names: ['A', 'B'], rounds: [round('oscars')]});
  assert.equal(E.step(s, {type: 'place', cardId: 'oscars-2', index}).result.correct, true);
}
oscars.cards[1].value = before;
assert.equal(E.create({names: ['A'], rounds: [round('social')]}).players.length, 1);
assert.throws(() => E.restore({version: -1, config, commands: []}));
assert.throws(() => E.restore({version: 1, config, commands: [{type: 'place', cardId: 'missing', index: 0}]}));
assert.throws(() => E.create({names: ['A', 'B'], rounds: [{id:'social', order: ['social-1']}]}));
for (const c of CT.QuickCatalog.challenges) {
  assert.ok(c.cards.length >= 2 && c.cards.length <= (c.id === 'drinks' ? 34 : c.id === 'festivities' ? 32 : c.id === 'companies-revenue' ? 30 : 25));
  assert.equal(new Set(c.cards.map(card => card.id)).size, c.cards.length);
  assert.ok(c.cards.every(card => Number.isFinite(card.value) && card.title && card.label && card.detail && card.source.startsWith('https://')));
}
const requestedDecks = ['sports-players','drinks','festivities','social','wwii','civil-war','kings','consoles','oscars','companies-founded','timezones-june','cities-east-west','cities-north-south','body','series-seasons','buildings','rivers-spain','foods-kcal','albums-sales','stadiums','capitals-altitude','eurovision-wins','storage','airports','metros','companies-revenue','spanish-tv','minimum-wages'];
assert.ok(requestedDecks.every(id => CT.QuickCatalog.challenges.some(c => c.id === id)));
assert.ok(requestedDecks.every(id => CT.QuickCatalog.challenges.find(c => c.id === id).cards.length <= (id === 'drinks' ? 34 : id === 'festivities' ? 32 : id === 'companies-revenue' ? 30 : 25)));
const social = CT.QuickCatalog.challenges.find(c => c.id === 'social');
assert.equal(social.cards.length, 22);
const addedSocial = [['Fotolog',2002],['Flickr',2004],['Tuenti',2006],['Foursquare',2009],['Vine',2013],['BeReal',2020],['Threads',2023]];
for (const [i, [title, year]] of addedSocial.entries()) {
  const card = social.cards[i + 15];
  assert.equal(card.title, title);
  assert.equal(card.id, `social-${i + 16}`);
  assert.equal(card.value, year);
  assert.equal(card.label, String(year));
  assert.notEqual(card.source, 'https://en.wikipedia.org/wiki/Timeline_of_social_media');
}
const publishedSocialOrder = social.cards.slice(0, 15).map(card => card.id);
const oldSocialSave = {version: 3, config: {names: ['Ana','Luis'], rounds: [{id: 'social', order: publishedSocialOrder}]}, commands: [{type: 'place', cardId: 'social-2', index: 1}]};
assert.equal(E.restore(oldSocialSave).phase, 'result', 'se pueden continuar las partidas guardadas con las 15 redes originales');
assert.ok(social.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const wwii = CT.QuickCatalog.challenges.find(c => c.id === 'wwii');
assert.ok(wwii.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const civilWar = CT.QuickCatalog.challenges.find(c => c.id === 'civil-war');
assert.ok(civilWar.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const kings = CT.QuickCatalog.challenges.find(c => c.id === 'kings');
assert.ok(kings.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const consoles = CT.QuickCatalog.challenges.find(c => c.id === 'consoles');
assert.ok(consoles.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const oscarsWithImages = CT.QuickCatalog.challenges.find(c => c.id === 'oscars');
assert.ok(oscarsWithImages.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const companiesFounded = CT.QuickCatalog.challenges.find(c => c.id === 'companies-founded');
assert.ok(companiesFounded.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const timezonesJune = CT.QuickCatalog.challenges.find(c => c.id === 'timezones-june');
assert.ok(timezonesJune.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const citiesEastWest = CT.QuickCatalog.challenges.find(c => c.id === 'cities-east-west');
assert.ok(citiesEastWest.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const citiesNorthSouth = CT.QuickCatalog.challenges.find(c => c.id === 'cities-north-south');
assert.ok(citiesNorthSouth.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const body = CT.QuickCatalog.challenges.find(c => c.id === 'body');
assert.ok(body.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const seriesSeasons = CT.QuickCatalog.challenges.find(c => c.id === 'series-seasons');
assert.ok(seriesSeasons.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const buildings = CT.QuickCatalog.challenges.find(c => c.id === 'buildings');
assert.ok(buildings.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const riversSpain = CT.QuickCatalog.challenges.find(c => c.id === 'rivers-spain');
assert.ok(riversSpain.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const foodsKcal = CT.QuickCatalog.challenges.find(c => c.id === 'foods-kcal');
assert.ok(foodsKcal.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const albumsSales = CT.QuickCatalog.challenges.find(c => c.id === 'albums-sales');
assert.ok(albumsSales.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const stadiums = CT.QuickCatalog.challenges.find(c => c.id === 'stadiums');
assert.ok(stadiums.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const capitalsAltitude = CT.QuickCatalog.challenges.find(c => c.id === 'capitals-altitude');
assert.ok(capitalsAltitude.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const eurovisionWins = CT.QuickCatalog.challenges.find(c => c.id === 'eurovision-wins');
assert.ok(eurovisionWins.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const storage = CT.QuickCatalog.challenges.find(c => c.id === 'storage');
assert.ok(storage.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const airports = CT.QuickCatalog.challenges.find(c => c.id === 'airports');
assert.ok(airports.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const metros = CT.QuickCatalog.challenges.find(c => c.id === 'metros');
assert.ok(metros.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));

assert.equal(metros.cards.length,19);
assert.equal(new Set(metros.cards.map(c=>c.title)).size,19);
const metroAudit=JSON.parse(read('docs/fuentes-metros-ampliacion-2026-10-04.json'));
assert.equal(metroAudit.cards.length,10);
for(const item of metroAudit.cards){const card=metros.cards.find(c=>c.id===item.id);assert.equal(card.value,item.value);assert.equal(card.label,item.label);assert.equal(card.source,item.source);assert.equal(card.curiositySource,item.curiositySource);assert.ok(card.detail.includes(item.dataDate));assert.ok(card.detail.includes(item.scope));}
assert.equal(metros.cards.find(c=>c.id==='metros-10').value,124.7,'Barcelona excluye el funicular y FGC');
assert.equal(metros.cards.find(c=>c.id==='metros-15').value,37.9,'Budapest suma las dos categorías de rutas KSH, incluida M1');
assert.equal(metros.cards.find(c=>c.id==='metros-19').value,56.57,'Buenos Aires excluye Premetro');
s=E.create({names:['A','B'],rounds:[round('metros')]});
while(s.remaining.length){const id=s.remaining[0],value=x=>metros.cards.find(c=>c.id===x).value;const place=s.timeline.findIndex(t=>value(t)>value(id));s=E.step(s,{type:'place',cardId:id,index:place<0?s.timeline.length:place});assert.equal(s.result.correct,true);s=E.step(s,{type:'ack'});}
assert.equal(s.phase,'round-end');
const oldMetroSave={version:3,config:{names:['Ana','Luis'],rounds:[{id:'metros',order:Array.from({length:9},(_,i)=>'metros-'+(i+1))}]},commands:[{type:'place',cardId:'metros-2',index:1}]};
assert.equal(E.restore(oldMetroSave).result.correct,true);


// La ampliación conserva los IDs antiguos y las partidas guardadas; se prueban todos los valores nuevos al ordenar.
const sevenAudit=JSON.parse(read('docs/fuentes-siete-retos-ampliacion-2026-10-05.json'));
assert.equal(sevenAudit.cards.length,70);
const previousSizes={'airports':7,'capitals-altitude':9,'stadiums':10,'albums-sales':9,'foods-kcal':14,'rivers-spain':10,'buildings':9};
for(const [deckId,previous] of Object.entries(previousSizes)){
 const deck=E.challenge(deckId);assert.equal(deck.cards.length,previous+10);
 assert.equal(new Set(deck.cards.map(c=>c.title)).size,deck.cards.length);
 s=E.create({names:['A','B'],rounds:[round(deckId)]});
 while(s.remaining.length){const id=s.remaining[0],value=x=>deck.cards.find(c=>c.id===x).value;const place=s.timeline.findIndex(t=>value(t)>value(id));s=E.step(s,{type:'place',cardId:id,index:place<0?s.timeline.length:place});assert.equal(s.result.correct,true);s=E.step(s,{type:'ack'});}
 assert.equal(s.phase,'round-end');
 const saved={version:3,config:{names:['A','B'],rounds:[{id:deckId,order:Array.from({length:previous},(_,i)=>deckId+'-'+(i+1))}]},commands:[]};
 assert.equal(E.restore(saved).remaining.length,previous-1);
}
for(const item of sevenAudit.cards){
 const card=E.challenge(item.deck).cards.find(c=>c.id===item.id);
 assert.equal(card.value,item.value);assert.equal(card.label,item.label);assert.equal(card.source,item.source);
 assert.equal(card.curiositySource,item.curiositySource);assert.ok(card.detail.includes(item.scope));assert.ok(card.detail.includes(item.dataDate));
 if(item.passengers)assert.equal(card.value,item.passengers/1e6);
 if(item.deck==='foods-kcal')assert.equal(card.value,item.snapshot.nutrients['208'].value);
 if(item.deck==='capitals-altitude')assert.equal(card.value,item.snapshot.dem);
}
for(const card of E.challenge('albums-sales').cards)assert.ok(card.artist&&card.artist.length>=3,'cada álbum identifica a su artista');
assert.equal(E.challenge('stadiums').cards.find(c=>c.id==='stadiums-12').value,75024,'Allianz: configuración nacional');
assert.equal(E.challenge('stadiums').cards.find(c=>c.id==='stadiums-18').value,43858,'Sevilla: cuentas oficiales 2024/25');
assert.ok(E.challenge('stadiums').cards.find(c=>c.id==='stadiums-17').title.includes('antes de la reforma'));
assert.equal(E.challenge('albums-sales').cards.find(c=>c.id==='albums-sales-15').value,25,'Springsteen: estimación oficial de 2024');
assert.equal(E.challenge('rivers-spain').cards.find(c=>c.id==='rivers-spain-15').value,66,'Bidasoa: recorrido completo según Navarra');


// Coordenadas firmadas, husos fraccionarios y premios por categoría: criterios verificables de los seis mazos.
const sixAudit=JSON.parse(read('docs/fuentes-seis-retos-ampliacion-2026-10-05.json'));
assert.equal(sixAudit.cards.length,60);
assert.equal(E.challenge('series-seasons').cards.find(c=>c.id==='series-seasons-11').value,38,'Los Simpson: temporada 38 estrenada el 27 de septiembre de 2026');
const sixPreviousSizes={'series-seasons':11,'cities-north-south':9,'cities-east-west':10,'timezones-june':12,'companies-founded':12,'oscars':10};
for(const [deckId,previous] of Object.entries(sixPreviousSizes)){
 const deck=E.challenge(deckId);assert.equal(deck.cards.length,previous+10);
 assert.equal(new Set(deck.cards.map(c=>c.title)).size,deck.cards.length);
 s=E.create({names:['A','B'],rounds:[round(deckId)]});
 while(s.remaining.length){const id=s.remaining[0],value=x=>deck.cards.find(c=>c.id===x).value;const place=s.timeline.findIndex(t=>value(t)>value(id));s=E.step(s,{type:'place',cardId:id,index:place<0?s.timeline.length:place});assert.equal(s.result.correct,true);s=E.step(s,{type:'ack'});}
 assert.equal(s.phase,'round-end');
 const saved={version:3,config:{names:['A','B'],rounds:[{id:deckId,order:Array.from({length:previous},(_,i)=>deckId+'-'+(i+1))}]},commands:[]};
 assert.equal(E.restore(saved).remaining.length,previous-1);
}
function juneUtcOffset(zone){const name=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date('2026-06-15T12:00:00Z')).find(p=>p.type==='timeZoneName').value;const m=name.match(/GMT([+-])(\d{2}):(\d{2})/);return m?(m[1]==='-'?-1:1)*(Number(m[2])+Number(m[3])/60):0;}
assert.equal(juneUtcOffset('Europe/Madrid'),2);
for(const item of sixAudit.cards){
 const card=E.challenge(item.deck).cards.find(c=>c.id===item.id);
 assert.equal(card.value,item.value);assert.equal(card.source,item.source);assert.equal(card.curiositySource,item.curiositySource);assert.ok(card.detail.includes(item.scope));
 if(item.deck.startsWith('cities-')){const fields=item.snapshot.raw.split('\t');const col=item.deck==='cities-north-south'?4:5;assert.equal(Number(fields[0]),item.snapshot.geonameId);assert.equal(Number(fields[col].trim()).toFixed(2),card.value.toFixed(2));}
 if(item.deck==='timezones-june'){assert.equal(card.value,juneUtcOffset(item.snapshot.ianaZone)-juneUtcOffset('Europe/Madrid'));assert.ok(card.detail.includes('15 de junio de 2026'));}
 if(item.deck==='oscars'){assert.equal(card.value,new Set(item.snapshot.winningCategories).size);assert.ok(item.snapshot.nominations>=card.value);assert.ok(card.detail.includes('ceremonia de '+item.snapshot.ceremonyYear));}
}
assert.equal(E.challenge('timezones-june').cards.find(c=>c.id==='timezones-june-14').value,3.75);
assert.equal(E.challenge('timezones-june').cards.find(c=>c.id==='timezones-june-13').value,-4.5);
assert.equal(E.challenge('oscars').cards.find(c=>c.id==='oscars-16').value,6,'La La Land: seis premios, no catorce nominaciones');
assert.ok(E.challenge('companies-founded').cards.find(c=>c.id==='companies-founded-18').detail.includes('Blue Ribbon Sports'));

const companiesRevenue = CT.QuickCatalog.challenges.find(c => c.id === 'companies-revenue');
assert.ok(companiesRevenue.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
assert.equal(companiesRevenue.cards.length,30);
assert.equal(companiesRevenue.asOf,'2025');
const revenueAudit=JSON.parse(read('docs/fuentes-facturacion-empresas-2025.json'));
const revenueFx=JSON.parse(read('docs/eurostat-cambios-medios-2025.json'));
assert.equal(revenueFx.dimension.statinfo.category.index.AVG,0);
assert.equal(revenueFx.dimension.time.category.index['2025'],0);
assert.equal(new Set(companiesRevenue.cards.map(c=>c.title)).size,30);
for(const r of revenueAudit.cards){const card=companiesRevenue.cards.find(c=>c.id===r.id);const rate=r.currency==='EUR'?1:revenueFx.value[revenueFx.dimension.currency.category.index[r.currency]];assert.equal(r.exchangeRate,rate);assert.equal(card.value,Math.round(r.originalMillions/rate));assert.equal(card.label,r.label);assert.ok(card.label.endsWith(' M€'));assert.equal(card.source,r.source);assert.ok(card.detail.includes(r.period));assert.ok(!card.label.includes('M$'));}
assert.equal(companiesRevenue.cards.find(c=>c.title==='Mercadona').value,38178,'se usa cifra de negocios sin IVA');
assert.equal(revenueAudit.cards.find(c=>c.title==='NVIDIA').period,'2025-01-27 / 2026-01-25','no se utiliza FY2025 que representa 2024');
s=E.create({names:['A','B'],rounds:[round('companies-revenue')]});
while(s.remaining.length){const id=s.remaining[0],value=x=>companiesRevenue.cards.find(c=>c.id===x).value;const place=s.timeline.findIndex(t=>value(t)>value(id));s=E.step(s,{type:'place',cardId:id,index:place<0?s.timeline.length:place});assert.equal(s.result.correct,true);s=E.step(s,{type:'ack'});}
assert.equal(s.phase,'round-end');
const oldRevenueSave={version:3,config:{names:['Ana','Luis'],rounds:[{id:'companies-revenue',order:Array.from({length:8},(_,i)=>'companies-revenue-'+(i+1))}]},commands:[{type:'place',cardId:'companies-revenue-2',index:0}]};
assert.equal(E.restore(oldRevenueSave).result.correct,true);

const spanishTv = CT.QuickCatalog.challenges.find(c => c.id === 'spanish-tv');
assert.ok(spanishTv.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const minimumWages = CT.QuickCatalog.challenges.find(c => c.id === 'minimum-wages');
assert.equal(minimumWages.cards.length,22);
assert.equal(minimumWages.asOf,'1 de julio de 2026');
const wageAudit=JSON.parse(read('docs/fuentes-salarios-minimos-2026-07.json'));
const wageSnapshot=JSON.parse(read('docs/eurostat-salarios-2026-S2-EUR.json'));
assert.equal(wageSnapshot.dimension.time.category.index['2026-S2'],0);
for(const record of wageAudit.cards){const card=minimumWages.cards.find(c=>c.id===record.id);assert.equal(card.title,record.title);assert.equal(card.value,wageSnapshot.value[wageSnapshot.dimension.geo.category.index[record.geo]]);assert.equal(card.source,record.source);assert.equal(card.curiositySource,record.nationalSource);}
assert.deepEqual(Array.from(minimumWages.cards.slice(0,10),c=>c.title),['Bulgaria','Rumanía','Polonia','España','Francia','Bélgica','Países Bajos','Alemania','Irlanda','Luxemburgo']);
const oldWagesSave={version:3,config:{names:['Ana','Luis'],rounds:[{id:'minimum-wages',order:Array.from({length:10},(_,i)=>'minimum-wages-'+(i+1))}]},commands:[{type:'place',cardId:'minimum-wages-2',index:1}]};
assert.equal(E.restore(oldWagesSave).phase,'result','se recuperan las partidas con las diez cartas originales');
assert.equal(E.restore(oldWagesSave).result.correct,true);
{const order=['minimum-wages-13','minimum-wages-19'];const tied=E.create({names:['A','B'],rounds:[{id:'minimum-wages',order}]});assert.equal(E.step(tied,{type:'place',cardId:order[1],index:0}).result.correct,true);assert.equal(E.step(tied,{type:'place',cardId:order[1],index:1}).result.correct,true);}

assert.ok(minimumWages.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const sportsPlayers = CT.QuickCatalog.challenges.find(c => c.id === 'sports-players');
assert.ok(sportsPlayers.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
const drinks = CT.QuickCatalog.challenges.find(c => c.id === 'drinks');
assert.equal(drinks.cards.length, 34);
assert.ok(drinks.cards.every(card => card.source !== 'https://www.niaaa.nih.gov/alcohols-effects-health/alcohol-topics/what-standard-drink'), 'Cada bebida tiene una fuente específica');
assert.ok(drinks.cards.slice(0, 21).every((card, i) => card.id === 'drinks-' + (i + 1) && card.image === 'assets/quick-cards/drinks-' + (i + 1) + '.webp' && fs.existsSync(new URL('../' + card.image, import.meta.url))));
assert.ok(drinks.cards.every((card, i) => card.image === 'assets/quick-cards/drinks-' + (i + 1) + '.webp' && fs.existsSync(new URL('../' + card.image, import.meta.url))), 'Todas las bebidas tienen una ilustración propia existente');
assert.ok(new Set(drinks.cards.map(card => card.value)).size >= 20, 'El mazo cubre al menos 20 graduaciones');
assert.ok(drinks.cards.filter(card => card.value === 40).length / drinks.cards.length < 0.25, 'Menos del 25 % del mazo se concentra en 40 %');
const festivities = CT.QuickCatalog.challenges.find(c => c.id === 'festivities');
assert.equal(festivities.cards.length, 32);
assert.ok(festivities.cards.every(card => card.source !== 'https://www.timeanddate.com/holidays/'), 'Cada festividad tiene una referencia concreta');
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
for (const card of festivities.cards) {
  const match = /^(\d{1,2}) de ([a-z]+)$/.exec(card.label);
  assert.ok(match, `${card.title}: día y mes fijos`);
  const month = months.indexOf(match[2]), day = Number(match[1]);
  assert.ok(month >= 0);
  const date = new Date(Date.UTC(2025, month, day));
  assert.equal(date.getUTCMonth(), month, `${card.title}: fecha existente`);
  assert.equal(card.value, (date.getTime() - Date.UTC(2025, 0, 0)) / 86400000, `${card.title}: posición correcta en el año`);
}
assert.ok(festivities.cards.every(card => card.image && fs.existsSync(new URL('../' + card.image, import.meta.url))));
assert.equal(CT.QuickCatalog.upcoming, undefined, 'La colección pendiente ya no se publica');
assert.equal(CT.has('counts'), false, 'La colección eliminada no entra en partidas ni en competición');
// Integración real con portada, selección, confirmación, guardado y fin de partida.
const click = selector => {const el = w.document.querySelector(selector); assert.ok(el, selector); el.click();};
const openQuick = () => {
  // Retos rápidos en un solo móvil, por la puerta de «Jugar con amigos»: es donde ya se ve
  // «Continuar partida guardada» y donde se avisa de un guardado dañado.
  w.sessionStorage.removeItem('continuum-entry-route');
  w.CONTINUUM.ModeHubs.open('hub-friends-local');
  w.document.querySelector('[data-action="quick-challenges"]').click();
};
openQuick();
assert.match(w.document.querySelector('#app').textContent, /un solo móvil/);
assert.ok(w.document.querySelector('.quick-starter-field [data-quick="draw-starter"]'), 'el campo de quién empieza es visible en la preparación');
click('[data-quick="start"]');
// Un solo móvil: antes de repartir se juega el minijuego de quién empieza (con una carta de Grandes colecciones).
assert.ok(w.document.querySelector('[data-quick-starter]'), 'se abre el minijuego de quién empieza');
for (let i = 0; i < 2; i++) { w.document.getElementById('quick-starter-input').value = i ? '1500' : '1900'; click('[data-quick="starter-guess"]'); }
assert.match(w.document.querySelector('[data-quick-starter]').textContent, /Empieza la partida/);
assert.match(w.document.querySelector('.quick-starter-field').textContent, /empieza/, 'el resultado queda a la vista en la preparación');
click('[data-quick="starter-go"]');
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
  assert.ok(!w.document.querySelector('.hand').textContent.includes(c.cards.find(card => card.id === cardId).curiosity), 'la curiosidad no se revela antes de jugar');
  assert.equal(w.document.querySelector('[data-quick="confirm"]'), null);
  click(`[data-quick="slot"][data-index="${index < 0 ? s.timeline.length : index}"]`);
  click('[data-quick="confirm"]');
  const snapshot = w.localStorage.getItem(key);
  assert.equal(E.restore(JSON.parse(snapshot)).phase, 'result');
  w.close(); w = boot(snapshot); CT = w.CONTINUUM; E = CT.QuickEngine;
  openQuick(); click('[data-quick="resume"]');
  assert.match(w.document.querySelector('#app').textContent, /¡Bien colocado!/);
  const discovered = c.cards.find(card => card.id === cardId);
  const resultPanel = w.document.querySelector('[data-quick-result]');
  assert.ok(resultPanel.textContent.includes(discovered.curiosity), 'la carta descubierta enseña su curiosidad');
  const references = [...resultPanel.querySelectorAll('a')].map(a => a.href);
  assert.ok(references.includes(discovered.source));
  assert.ok(references.includes(discovered.curiositySource));
  click('[data-quick="ack"]'); click('[data-quick="bank"]'); click('[data-quick="bank"]');
  assert.equal(E.restore(JSON.parse(w.localStorage.getItem(key))).phase, 'round-end');
  const finalList = w.document.querySelector('details.quick-panel');
  assert.ok(finalList.textContent.includes(discovered.curiosity));
  assert.ok([...finalList.querySelectorAll('a')].some(a => a.href === discovered.curiositySource));
  if (r < 2) click('[data-quick="next"]');
}
assert.equal(w.document.querySelector('[data-quick="next"]'), null);
assert.match(w.document.querySelector('#app').textContent, /Gana|Victoria compartida/);
click('[data-action="home"]');
assert.equal(w.document.querySelector('[data-action="quick-counts"]'), null, 'La colección eliminada no aparece en inicio');
assert.ok(w.document.querySelector('[data-action="jugar"]'));
w.close();
w = boot('{invalid'); openQuick();
assert.match(w.document.querySelector('#app').textContent, /No se ha podido recuperar/);
assert.equal(w.document.querySelector('[data-quick="resume"]'), null);
w.close();
// El reto diario rápido guarda un solo resultado normalizable y la racha en
// el mismo registro que el reto diario de grandes colecciones.
w=boot();CT=w.CONTINUUM;
const dailyDate=new Date().toLocaleDateString('sv-SE');
CT.Quick.startDaily(dailyDate,(markup,playing)=>{const app=w.document.getElementById('app');app.innerHTML=markup;app.dataset.screen=playing?'quick-game':'quick-challenges';});
click('[data-quick="ready"]');
// En solitario no se puede plantar y un fallo no echa del reto: se juegan las diez cartas.
assert.equal(w.document.querySelector('[data-quick="bank"]'), null, 'sin botón de plantarse en solitario');
let aciertos = 0, jugadas = 0;
for (;;) {
  const saved = JSON.parse(w.localStorage.getItem(key)) || JSON.parse(w.localStorage.getItem('continuum-quick-challenges-v1'));
  const st = E.restore(saved);
  if (st.phase === 'round-end') break;
  const c = E.challenge(st.config.rounds[0].id), cardId = st.remaining[0];
  const val = id => c.cards.find(card => card.id === id).value * c.direction;
  const right = st.timeline.findIndex(id => val(id) > val(cardId));
  const rightIndex = right < 0 ? st.timeline.length : right;
  // Se falla a propósito cada tercera carta: colocándola en un hueco que no es el suyo.
  const fail = jugadas % 3 === 2 && st.timeline.length > 1;
  const wrong = [...Array(st.timeline.length + 1).keys()].find(i => !E.step(st, {type: 'place', cardId, index: i}).result.correct);
  const index = fail && wrong !== undefined ? wrong : rightIndex;
  click(`[data-quick="select"][data-id="${cardId}"]`);
  click(`[data-quick="slot"][data-index="${index}"]`);
  click('[data-quick="confirm"]');
  const after = E.restore(JSON.parse(w.localStorage.getItem(key)));
  if (after.result.correct) aciertos++;
  assert.equal(after.players[0].status, 'active', 'un fallo no saca a quien juega solo');
  click('[data-quick="ack"]');
  jugadas++;
  assert.ok(jugadas <= 12, 'el reto termina');
}
assert.equal(jugadas, 10, 'se juegan las diez cartas aunque haya fallos');
assert.ok(aciertos < 10 && aciertos > 0);
const daily=JSON.parse(w.localStorage.getItem('hilo-retos-v1')).retoDiario;
assert.equal(daily.days[dailyDate].family,'quick');
assert.equal(daily.days[dailyDate].hits,aciertos);
assert.equal(daily.days[dailyDate].total,10);
assert.match(w.document.querySelector('#app').textContent, new RegExp(`${aciertos} de 10`));
assert.equal(daily.streak,1);
w.close();
// El motor: solo y sin ser duelo, un fallo cuenta y se sigue; en duelo o con más gente, se queda fuera.
{
  const cfg = {names: ['Tú'], kind: 'free', rounds: [round('poker')]};
  let t = E.create(cfg);
  t = E.step(t, {type: 'place', cardId: 'poker-2', index: 1});
  t = E.step(t, {type: 'ack'});
  t = E.step(t, {type: 'place', cardId: 'poker-3', index: 0});
  assert.equal(t.result.correct, false);
  assert.equal(t.result.lost, 0, 'no pierde lo ya acertado');
  assert.equal(t.players[0].status, 'active');
  assert.equal(t.players[0].points, 1, 'conserva el acierto y sigue');
  t = E.step(t, {type: 'ack'});
  assert.equal(t.phase, 'turn', 'sigue jugando tras el fallo');
  // Duelo con `keep: true` (enlace «partida completa» o sala «sigue hasta el final»): un fallo no echa y plantarse no existe.
  let dk = E.create({names: ['Tú'], kind: 'duel', keep: true, rounds: [round('poker')]});
  dk = E.step(dk, {type: 'place', cardId: 'poker-3', index: 0});
  assert.equal(dk.result.correct, false);
  assert.equal(dk.players[0].status, 'active', 'con keep el fallo no saca del reto');
  dk = E.step(dk, {type: 'ack'});
  assert.equal(dk.phase, 'turn');
  assert.throws(() => E.step(dk, {type: 'bank'}), /INVALID_ACTION/, 'con keep no se puede plantar');
  // Sala de dos con keep: los dos juegan alternando hasta agotar las cartas y no queda nadie fuera.
  let k2 = E.create({names: ['Ana', 'Luis'], kind: 'duel', keep: true, rounds: [round('poker')]});
  for (let guard = 0; k2.phase !== 'round-end' && guard < 40; guard++) {
    const c = E.challenge('poker'), id = k2.remaining[0], v = x => c.cards.find(card => card.id === x).value * c.direction;
    const right = k2.timeline.findIndex(t => v(t) > v(id)), idx = right < 0 ? k2.timeline.length : right;
    k2 = E.step(k2, {type: 'place', cardId: id, index: guard % 3 === 0 ? (idx === 0 ? 1 : 0) : idx});
    assert.ok(k2.players.every(pl => pl.status === 'active'));
    k2 = E.step(k2, {type: 'ack'});
  }
  assert.equal(k2.phase, 'round-end');
  assert.equal(k2.players.reduce((n, pl) => n + pl.roundScore, 0) > 0, true);
  assert.throws(() => E.create({names: ['Tú'], keep: 'si', rounds: [round('poker')]}), /INVALID_CONFIG/);
  // Sin `keep` (duelos o partidas guardadas antes de existir la opción) todo sigue como entonces.
  const duel = E.create({names: ['Tú'], kind: 'duel', rounds: [round('poker')]});
  let d = E.step(duel, {type: 'place', cardId: 'poker-2', index: 1});
  d = E.step(d, {type: 'ack'});
  d = E.step(d, {type: 'place', cardId: 'poker-3', index: 0});
  assert.equal(d.players[0].status, 'failed', 'en el duelo el fallo sigue sacando del reto');
}
console.log('Retos rápidos: reglas, empates, orden descendente, turnos, recuperación y tres rondas completas: OK');
