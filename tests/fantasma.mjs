import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const plain = value => JSON.parse(JSON.stringify(value));
function boot(storage = {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://continuum.test' }).window;
  w.structuredClone = structuredClone;
  Object.entries(storage).forEach(([key, value]) => w.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)));
  scripts.forEach(file => w.eval(read(file)));
  return w;
}
const click = (w, action) => { const el = w.document.querySelector(`[data-action="${action}"]`); assert.ok(el, action); el.click(); };
// «Continuar» y «Solitario» viven en el menú de un mazo concreto (`playMenu`), al que se
// llega desplegando antes su bloque en la portada. «Competición» no: baraja varios mazos
// al azar, así que su botón está en la portada y no depende de ningún mazo elegido. Este
// archivo solo juega con Historia de España.
const abreMazo = w => { w.document.querySelector('[data-block="historia"]').click(); w.document.querySelector('[data-mode="history"]').click(); };
const key = 'hilo-game-history-v1', soloKey = 'hilo-solo-history-v1';
const state = (w, k = key) => JSON.parse(w.localStorage.getItem(k));
const all = s => [...s.timeline, ...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
function freshGhost(owners = ['1']) { return { cards: [6], owners, used: [], pending: [], cooldown: [], actor: '', fresh: false }; }
function fixture() {
  return { mode: 'history', pulse: true, ghost: freshGhost(), players: [{ id: 1, name: 'Ana', hand: [6, 7, 8] }, { id: 2, name: 'Luis', hand: [9, 10, 11] }], timeline: [1, 2, 3, 4, 5], deck: [12, 13, 14, 15], discard: [], current: 0, starter: 0, round: 1, turnsInRound: 0, winner: null, winners: null };
}
function play(w, correct = true, single = false) {
  const s = state(w, single ? soloKey : key), ct = w.CONTINUUM;
  const id = single ? s.current : s.players[s.current].hand[0];
  const card = ct.cards(s.mode).find(c => c.id === id);
  const board = s.timeline.map(id => ct.cards(s.mode).find(c => c.id === id));
  const at = ct.correctIndex(s.mode, board, card);
  const index = correct ? at : (at === 0 ? board.length : 0);
  if (!single) { const el = w.document.querySelector(`[data-action="select-card"][data-id="${id}"]`); el.click(); }
  w.document.querySelectorAll(`[data-action="${single ? 'solo-place' : 'place'}"]`)[index].click();
  click(w, 'confirm-place');
}
console.log('\nFantasma: reparto, jugadas y dificultades');
{
  const w = boot(), g = w.CONTINUUM.Ghost;
  let seed = 73473;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const n of [38, 167, 673]) for (const p of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const h = Math.min(4, Math.floor((n - 1) / p)), deck = Array.from({ length: n }, (_, i) => i + 1);
    let dealt = 0;
    const seen = new Set();
    for (let k = 0; k < 2500; k++) {
      const ghost = g.create(deck, p, h, random);
      if (ghost.cards.some(id => id <= p * h)) dealt++;
      assert.equal(ghost.distribution, 2);
      assert.equal(ghost.cards.length, Math.ceil(p / 3), 'siempre la cantidad fija por jugadores');
      assert.equal(new Set(ghost.cards).size, ghost.cards.length);
      ghost.cards.forEach(id => { assert.notEqual(id, p * h + 1, 'no poder en carta inicial'); assert.ok(deck.includes(id)); seen.add(id); });
    }
    assert.ok(dealt > 0);
    if (n >= 167) assert.ok(dealt < 2500, 'incluir poderes no garantiza repartirlos');
    assert.ok(seen.size > p * h, 'también aparece en robos posteriores');
    assert.ok([...seen].some(id => id > n * 0.9), 'la cola del mazo sigue siendo elegible');
    assert.deepEqual(deck, Array.from({ length: n }, (_, i) => i + 1), 'no cambia cartas normales ni su orden');
    console.log(`  ${p} jugadores, ${n} cartas: ${(dealt/25).toFixed(1)}% con poder repartido; siempre ${Math.ceil(p/3)} incluidos`);
  }
  // Probabilidades anunciadas: 20 cartas extraídas, 5 jugadores y 2 Fantasmas.
  // Estos N ya excluyen la carta inicial del tablero. Margen estadístico, sin
  // reproducir el algoritmo: detecta tanto el reparto uniforme como el antiguo.
  for (const [n, expected] of [[50, 0.64], [200, 0.39], [500, 0.34]]) {
    const deck = Array.from({ length: n + 1 }, (_, i) => i + 1);
    let appeared = 0;
    for (let i = 0; i < 10000; i++) if (g.create(deck, 5, 4, random).cards.some(id => id <= 20)) appeared++;
    assert.ok(Math.abs(appeared / 10000 - expected) < 0.025, `${n} cartas: ${(appeared/100).toFixed(1)}% esperado ≈${expected*100}%`);
    console.log(`  Probabilidad con ${n} cartas disponibles y 20 extraídas: ${(appeared/100).toFixed(1)}%`);
  }
  const deck = Array.from({ length: 201 }, (_, i) => i + 1);
  assert.equal(g.create(deck, 2, 1, () => 0).cards[0], 1, 'puede tocar la primera');
  assert.equal(g.create(deck, 2, 6, () => 1 - Number.EPSILON).cards[0], 201, 'puede tocar la última');
  assert.equal(g.create([], 9, 0).cards.length, 0, 'sin posiciones no inventa cartas');
  assert.equal(g.create([1], 9, 0).cards.length, 0, 'solo hay carta inicial');
  assert.equal(g.create([1, 2, 3], 9, 0).cards.length, 2, 'acota cantidad por posiciones disponibles');
  const repeated = { ...freshGhost(['1', '']), cards: [6, 12], distribution: 2 };
  g.claim(repeated, 12, 1, [13, 14], () => 0);
  assert.deepEqual(plain(repeated.cards), [6, 13]);
  assert.deepEqual(plain(repeated.owners), ['1', ''], 'no entrega un segundo poder');
  const restored = JSON.parse(JSON.stringify(repeated));
  g.claim(restored, 13, 2, [14]);
  assert.deepEqual(restored.owners, ['1', '2'], 'el poder recolocado se conserva y llega a otro jugador');
  repeated.used = ['1'];
  g.claim(repeated, 13, 1, [14], () => 0);
  assert.equal(repeated.cards[1], 14, 'haberlo usado no permite recibir otro');
  g.claim(repeated, 14, 1, []);
  assert.equal(g.owns(repeated, 1), false, 'sin sitio se consume y no restaura un uso');
  g.claim(repeated, 14, 2, [15]);
  assert.equal(g.owns(repeated, 2), false, 'no resucita por reciclar la carta normal');
  for (const p of [2,3,4,5,6,7,8,9]) {
    const deck = Array.from({length: 167},(_,i)=>i+1), powers=w.CONTINUUM.Powers.create(deck,p,4,true,true,random);
    const amount=Math.ceil(p/3);
    assert.equal(powers.ghost.cards.length,amount);
    assert.equal(powers.pulsePower.cards.length,amount);
    assert.equal(new Set([...powers.ghost.cards,...powers.pulsePower.cards]).size,amount*2,'los dos poderes no comparten carta');
    assert.ok(!powers.ghost.cards.includes(p*4+1) && !powers.pulsePower.cards.includes(p*4+1));
  }
  const together={ghost:{...freshGhost(['1']),distribution:2,cards:[6]},pulsePower:{distribution:2,cards:[12,13],owners:['1',''],used:[]}};
  w.CONTINUUM.Powers.claim(together,13,1,[6,12,14],()=>0);
  assert.equal(together.pulsePower.cards[1],14,'el duplicado evita posiciones de ambos poderes');
  w.close();
}
{
  let w = boot({ [key]: fixture() });
  abreMazo(w);
  click(w, 'continue'); click(w, 'ready');
  const inventory = all(state(w)).sort((a,b) => a-b);
  click(w, 'ghost-use');
  assert.deepEqual(state(w).ghost.pending, ['1', '2']);
  assert.equal(w.document.querySelector('[data-action="pulse-open"]'), null);
  assert.equal(w.document.querySelectorAll('.ghost-card').length, 5);
  assert.ok([...w.document.querySelectorAll('.map-stop')].every(x => /valor oculto/.test(x.getAttribute('aria-label'))));
  assert.ok([...w.document.querySelectorAll('.timeline-card')].every(x => !/era-/.test(x.innerHTML)));
  play(w);
  assert.ok(w.document.querySelector('.modal .year').textContent.trim());
  assert.equal(w.document.querySelectorAll('.ghost-card').length, 6, 'el resultado no destapa el tablero');
  const saved = state(w); w.close();
  w = boot({ [key]: saved }); abreMazo(w); click(w,'continue'); click(w,'ready');
  assert.ok(w.document.querySelector('.modal'), 'recarga restaura resultado, no repite jugada');
  click(w, 'finish-turn'); click(w,'ready');
  assert.deepEqual(state(w).ghost.pending, ['2']);
  assert.ok(w.document.querySelector('[data-action="pulse-open"]'), 'el rival puede usar Pulso dentro del efecto');
  play(w); click(w,'finish-turn'); click(w,'ready');
  assert.deepEqual(state(w).ghost.pending, []);
  assert.deepEqual(state(w).ghost.cooldown, ['1','2']);
  assert.equal(w.document.querySelectorAll('.ghost-card').length,0);
  assert.deepEqual(all(state(w)).sort((a,b)=>a-b), inventory);
  play(w); click(w,'finish-turn'); click(w,'ready'); play(w); click(w,'finish-turn');
  assert.deepEqual(state(w).ghost.cooldown, []);
  w.close();
}
{
  const f = fixture(); f.players[0].hand = [6]; f.current = 1; f.turnsInRound = 0;
  const w = boot({ [key]: f }); abreMazo(w); click(w,'continue'); click(w,'ready');
  play(w); click(w,'finish-turn'); click(w,'ready'); play(w); click(w,'finish-turn');
  assert.equal(state(w).winner,1,'conservar Fantasma no impide ganar');
  assert.deepEqual(state(w).ghost.used,[]);
  w.close();
}
{
  const f=fixture(); f.ghost=freshGhost(['']); f.ghost.cards=[12];
  const w=boot({[key]:f});abreMazo(w);click(w,'continue');click(w,'ready');play(w,false);
  assert.equal(state(w).ghost.owners[0],'1','el robo de penalización puede entregar el poder');
  assert.equal(state(w).players[0].hand.length,3,'el poder no sustituye la penalización');w.close();
}
{
  const f=fixture(); f.ghost={...freshGhost(['1','']),cards:[6,12],distribution:2};
  let w=boot({[key]:f});abreMazo(w);click(w,'continue');click(w,'ready');play(w,false);
  let s=state(w);
  assert.equal(s.players[0].hand.length,3,'recolocar un duplicado conserva el castigo');
  assert.equal(s.ghost.owners[1],'');assert.ok(s.deck.includes(s.ghost.cards[1]));
  w.close();w=boot({[key]:s});abreMazo(w);click(w,'continue');click(w,'ready');
  assert.deepEqual(state(w).ghost,s.ghost,'recargar no vuelve a sortear la recolocación');
  click(w,'finish-turn');
  assert.equal(w.document.querySelector('.ghost-power'),null,'el cambio de manos no revela el poder');
  click(w,'ready');assert.equal(w.document.querySelector('.ghost-power'),null,'el rival no ve el poder ajeno');
  w.close();
}
{
  const initial={kind:'free',mode:'history',difficulty:'hard',ghostTurns:[3],day:'2026-08-31',deck:[7,8,9,10,11,12],timeline:[1,2,3,4,5],current:6,lives:3,hits:3,played:3,total:null,finished:false};
  const w=boot({[soloKey]:initial});abreMazo(w);click(w,'solo');click(w,'resume-solo');
  assert.equal(w.document.querySelectorAll('.ghost-card').length,5);
  play(w,true,true);assert.equal(w.document.querySelectorAll('.ghost-card').length,6);
  click(w,'solo-next');assert.equal(w.document.querySelectorAll('.ghost-card').length,0);
  assert.equal(state(w,soloKey).autoAdded.length,2);w.close();
}
for (const difficulty of ['easy','normal','hard','expert']) {
  let w = boot({ 'continuum-difficulty-v1': difficulty }); abreMazo(w); click(w,'solo'); click(w,'start-free');
  let s = state(w,soloKey); const initialTotal=s.deck.length+s.timeline.length+1;
  assert.equal(s.difficulty,difficulty);
  assert.equal(w.document.querySelectorAll('.ghost-card').length,difficulty==='expert'?1:0);
  play(w,false,true); const saved=state(w,soloKey); w.close();
  w=boot({[soloKey]:saved,'continuum-difficulty-v1':difficulty});abreMazo(w);click(w,'solo');click(w,'resume-solo');
  assert.ok(w.document.querySelector('.modal'));click(w,'solo-next');
  s=state(w,soloKey);
  assert.equal(s.lives,2);assert.equal(s.hits,0);assert.equal(s.played,1);
  assert.equal(s.autoAdded.length, {easy:0,normal:1,hard:2,expert:2}[difficulty], 'automáticas incluso tras fallo');
  assert.equal(new Set([...s.timeline,...s.deck,s.current,...s.failed]).size,initialTotal);
  const cards=w.CONTINUUM.cards(s.mode), byId=new Map(cards.map(c=>[c.id,c]));
  let turns=0;
  while (!w.document.querySelector('.pass-screen') && turns++<cards.length) {
    s=state(w,soloKey);const values=s.timeline.map(id=>w.CONTINUUM.sortValue(s.mode,byId.get(id)));
    assert.deepEqual([...values].sort((a,b)=>a-b),values);
    play(w,true,true); click(w,'solo-next');
  }
  assert.ok(turns<cards.length,'termina sin bloqueo aunque las automáticas agoten el mazo');
  assert.match(w.document.body.textContent,/Has completado el mazo/);
  const records=JSON.parse(w.localStorage.getItem('hilo-retos-v1')).history;
  assert.ok(records.bestByDifficulty[difficulty]>0);
  if(difficulty!=='easy')assert.equal(records.best||0,0,'no pisa récord clásico');
  w.close();
}
{
  // El modo competición ya no vive en el menú de un mazo concreto: baraja varios mazos
  // al azar, así que su botón está en la portada y no hace falta `abreMazo` para llegar.
  const w=boot({'continuum-difficulty-v1':'expert'});click(w,'start-competition');click(w,'comp-next-round');
  assert.equal(w.document.querySelectorAll('.ghost-card').length,1);
  let rounds=0;
  // Las cinco cartas del usuario nunca se consumen como incorporaciones automáticas.
  while(rounds++<14){
    for(let i=0;i<5;i++){
      const id=Number(w.document.querySelector('.hand-card').dataset.id),ct=w.CONTINUUM;
      const cards=Object.values(ct.MODES).flatMap(m=>m.cards),byId=new Map(cards.map(c=>[c.id,c]));
      const board=[...w.document.querySelectorAll('.timeline-card')].map(el=>byId.get(Number(el.dataset.id)));
      const card=byId.get(id);const mode=Object.values(ct.MODES).find(m=>m.key!=='mixed'&&m.cards.some(c=>c.id===id)).key;
      const at=ct.correctIndex(mode,board,card);
      w.document.querySelectorAll('[data-action="solo-place"]')[at].click();click(w,'confirm-place');click(w,'solo-next');
    }
    if(rounds<14){click(w,'comp-next-round');}
  }
  assert.match(w.document.body.textContent,/70/);w.close();
}
console.log('  Fantasma, conservación de cartas, guardado y cuatro dificultades: OK');
