import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const window={CONTINUUM:{}};for(const p of ['engine.js','quick-challenges-data.js','quick-challenges-engine.js','quick-room.js'])vm.runInNewContext(fs.readFileSync(p,'utf8'),{window});
const {QuickRoom:R,QuickEngine:E}=window.CONTINUUM;
const rounds=[{id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}];
let r=R.create('a','Ana',2),before=JSON.stringify(r);
r=R.reduce(r,'b',{type:'join',name:'Bea'});assert.equal(JSON.parse(before).members.length,1);
assert.throws(()=>R.reduce(r,'c',{type:'join',name:'Carla'}));
assert.throws(()=>R.reduce(r,'b',{type:'start',rounds}));
r=R.reduce(r,'a',{type:'start',rounds});
assert.throws(()=>R.reduce(r,'b',{type:'bank'}));
assert.throws(()=>R.reduce(r,'a',{type:'bank'},r.revision-1));
assert.throws(()=>R.validate({...r,actor:'b'}));
r=R.reduce(r,'a',{type:'place',cardId:'poker-2',index:1});assert.equal(R.state(r).players[0].points,1);
assert.throws(()=>R.reduce(r,'a',{type:'place',cardId:'poker-3',index:2}));
r=R.reduce(r,'a',{type:'ack'});assert.equal(r.actor,'b');
r=R.reduce(r,'b',{type:'bank'});r=R.reduce(r,'a',{type:'bank'});assert.equal(r.phase,'finished');
assert.equal(R.state(r).players[0].score,1);assert.throws(()=>R.reduce(r,'a',{type:'next'}));
const longRounds=Array.from({length:5},()=>({id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}));
const expanded=R.create('host','Host',8);assert.equal(expanded.capacity,8);
let rotating=E.create({names:['A','B'],rounds:longRounds});assert.equal(rotating.current,0);rotating=E.step(rotating,{type:'bank'});rotating=E.step(rotating,{type:'bank'});rotating=E.step(rotating,{type:'next'});assert.equal(rotating.current,1);
let solo=E.create({names:['Tú'],rounds});
while(solo.phase!=='round-end'){
  if(solo.phase==='result')solo=E.step(solo,{type:'ack'});
  else solo=E.step(solo,{type:'place',cardId:solo.remaining[0],index:solo.timeline.length});
}
assert.equal(solo.players[0].score,8);
solo=E.create({names:['Tú'],rounds});solo=E.step(solo,{type:'place',cardId:'poker-2',index:1});solo=E.step(solo,{type:'ack'});solo=E.step(solo,{type:'place',cardId:'poker-3',index:0});solo=E.step(solo,{type:'ack'});assert.equal(solo.phase,'turn','en solitario un fallo no corta el reto');assert.equal(solo.players[0].status,'active');assert.equal(solo.players[0].points,1,'conserva el acierto previo');
console.log('Sala de Retos: capacidad, identidad, turnos, revisiones, inmutabilidad y solitario completo: OK');
// Duelo por turnos: empieza quien lo crea, sin esperar; el amigo entra después y sigue donde se quedó.
{
  const duelRounds=[{id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}, {id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}];
  let d=R.create('a','Ana',2);
  assert.throws(()=>R.reduce(d,'a',{type:'start',rounds:duelRounds,kind:'network'}),/al menos dos/,'solo un duelo empieza sin amigo');
  d=R.reduce(d,'a',{type:'start',rounds:duelRounds,kind:'duel',keep:true});
  assert.equal(JSON.stringify(d.config.names),'["Ana","Tu amigo"]');assert.equal(d.members.length,1);assert.equal(d.actor,'a');
  d=R.reduce(d,'a',{type:'place',cardId:'poker-2',index:1});d=R.reduce(d,'a',{type:'ack'});
  assert.equal(R.state(d).current,1,'le toca al amigo');assert.equal(d.actor,'a','mientras tanto el móvil de Ana hace de turno');
  assert.throws(()=>R.reduce(d,'a',{type:'place',cardId:'poker-3',index:0}),/INVALID|Jugada|turno/i,'Ana no juega el turno del amigo');
  const antes=JSON.stringify(d);
  assert.throws(()=>R.reduce(d,'c',{type:'join',name:'ana'}),/diferente/);
  d=R.reduce(d,'b',{type:'join',name:'Beto'});assert.equal(JSON.stringify(R.state(R.reduce(JSON.parse(antes),'b',{type:'join',name:'Beto'})).players.map(p=>p.name)),'["Ana","Beto"]');
  assert.equal(d.actor,'b');assert.equal(JSON.stringify(d.config.names),'["Ana","Beto"]');
  assert.throws(()=>R.reduce(d,'c',{type:'join',name:'Carla'}),/completa/);
  d=R.reduce(d,'b',{type:'place',cardId:'poker-3',index:0});assert.equal(d.phase,'result');
  // El primer turno alterna: con first:1 abre el amigo (y Ana solo espera)
  let e=R.reduce(R.create('a','Ana',2),'a',{type:'start',rounds:duelRounds,kind:'duel',first:1});
  assert.equal(R.state(e).current,1);assert.equal(e.actor,'a');
  e=R.reduce(e,'b',{type:'join',name:'Beto'});assert.equal(e.actor,'b');
  assert.equal(R.reduce(R.create('a','Ana',2),'a',{type:'start',rounds:duelRounds,kind:'duel',first:2}).config.first,undefined,'un primer turno inválido se ignora');
  // Rondas siguientes: el inicio sigue rotando respecto a `first`
  let t=E.create({names:['A','B'],rounds:duelRounds,first:1});assert.equal(t.current,1);t=E.step(t,{type:'bank'});t=E.step(t,{type:'bank'});t=E.step(t,{type:'next'});assert.equal(t.current,0);
  // Una mesa corriente de dos no admite entrar una vez empezada
  let m=R.create('a','Ana',2);m=R.reduce(m,'b',{type:'join',name:'Bea'});m=R.reduce(m,'a',{type:'start',rounds:duelRounds,kind:'duel'});
  assert.throws(()=>R.reduce(m,'c',{type:'join',name:'Carla'}));
}
// Rendirse y retos dirigidos
{
  const duelRounds=[{id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}];
  let d=R.create('a','Ana',2);d.invitedUid='b';d.invitedName='Beto';
  d=R.reduce(d,'a',{type:'start',rounds:duelRounds,kind:'duel',keep:true});
  const d0=JSON.parse(JSON.stringify(d));
  assert.throws(()=>R.reduce(d,'z',{type:'join',name:'Zoe'}),/otra persona/,'un reto dirigido solo lo acepta quien lo recibe');
  assert.throws(()=>R.reduce(d,'a',{type:'resign'}),/rendir/,'solo se rinde con el amigo dentro');
  d=R.reduce(d,'b',{type:'join',name:'Beto'});
  const r=R.reduce(d,'b',{type:'resign'});
  assert.equal(r.phase,'finished');assert.equal(r.resigned,'b');assert.equal(r.actor,'a');
  assert.throws(()=>R.reduce(r,'a',{type:'place',cardId:'poker-2',index:1}));
  assert.throws(()=>R.reduce(d,'z',{type:'resign'}));
  assert.throws(()=>R.validate({...d,resigned:'z'}));
  // Rechazar el reto: el duelo se cierra y a quien retó le sale cancelado
  const rech=R.reduce(d0,'b',{type:'decline'});
  assert.equal(rech.phase,'finished');assert.equal(rech.declined,'b');assert.equal(rech.actor,'a');
  assert.throws(()=>R.reduce(rech,'b',{type:'join',name:'Beto'}));
  assert.throws(()=>R.reduce(d0,'a',{type:'decline'}),/rechazar/);
  assert.throws(()=>R.reduce(d0,'z',{type:'decline'}),/rechazar/);
  assert.throws(()=>R.validate({...d0,declined:'z'}));
  const m=R.reduce(R.reduce(R.create('a','Ana',4),'b',{type:'join',name:'Bea'}),'a',{type:'start',rounds:duelRounds,kind:'network'});
  assert.throws(()=>R.reduce(m,'b',{type:'resign'}),/rendir/,'las mesas de varios no tienen rendirse');
}
console.log('Duelo por turnos: empieza el creador, el amigo entra después y el primer turno alterna: OK');

{
  // Quién empieza en una sala en directo: sortea quien la lleva, cada uno responde una vez y quien gana abre el primer reto.
  let t=R.create('a','Ana',4);t=R.reduce(t,'b',{type:'join',name:'Bea'});t=R.reduce(t,'c',{type:'join',name:'Cid'});
  assert.throws(()=>R.reduce(t,'b',{type:'starter-draw',modeKey:'history',cardId:1}),/sortear/);
  t=R.reduce(t,'a',{type:'starter-draw',modeKey:'history',cardId:1});
  assert.equal(JSON.stringify(t.starter.guesses),'{}');
  assert.throws(()=>R.reduce(t,'z',{type:'starter-guess',value:5}),/responder/);
  t=R.reduce(t,'b',{type:'starter-guess',value:1900});
  assert.throws(()=>R.reduce(t,'b',{type:'starter-guess',value:1800}),/responder/,'no se puede cambiar la respuesta');
  assert.throws(()=>R.reduce(t,'c',{type:'starter-guess',value:NaN}),/responder/);
  t=R.reduce(t,'c',{type:'starter-guess',value:5});
  const empezada=R.reduce(t,'a',{type:'start',rounds,first:2});
  assert.equal(empezada.config.first,2);assert.equal(empezada.actor,'c','abre el reto quien ganó el minijuego');
  assert.equal(R.reduce(t,'a',{type:'start',rounds,first:9}).config.first,undefined,'un puesto que no existe se ignora');
  assert.equal(JSON.stringify(R.reduce(t,'a',{type:'starter-draw',modeKey:'history',cardId:2}).starter.guesses),'{}','repetir el sorteo borra las respuestas');
  assert.throws(()=>R.validate({...t,starter:{modeKey:'history',cardId:1,guesses:{x:5}}}),/no válida/,'respuestas de quien no está en la mesa');
}
{
  // Cada jugada lleva quién la hizo, y la reconstrucción comprueba que era su turno.
  let t=R.reduce(R.reduce(R.create('a','Ana',2),'b',{type:'join',name:'Bea'}),'a',{type:'start',rounds,kind:'duel'});
  t=R.reduce(t,'a',{type:'place',cardId:'poker-2',index:1});
  assert.equal(t.commands.at(-1).by,'a','la jugada queda firmada por quien la hace');
  assert.equal(R.reduce(t,'a',{type:'ack',by:'b'}).commands.at(-1).by,'a','la firma no la elige quien manda la acción');
  // TRAMPA: quien tiene el turno se apunta otra vez como actor y juega la carta del rival.
  const forged=JSON.parse(JSON.stringify(t));
  forged.commands.push({type:'ack',by:'a'});forged.revision++;
  forged.commands.push({type:'place',cardId:'poker-9',index:0,by:'a'});forged.revision++;
  forged.commands.push({type:'ack',by:'a'});forged.revision++;
  // Fase y actor coherentes con el motor: solo la firma delata la jugada.
  const st=R.state(forged);forged.phase=st.phase;forged.actor=forged.members[st.current];
  assert.throws(()=>R.validate(forged),/Turno no válido/,'una jugada firmada por quien no tenía el turno no cuenta');
  // Las salas anteriores al cambio, sin firmas, se siguen pudiendo reconstruir.
  const legacy=JSON.parse(JSON.stringify(t));legacy.commands=legacy.commands.map(({by,...c})=>c);
  assert.doesNotThrow(()=>R.validate(legacy));
  assert.ok(R.sameCommand(t.commands.at(-1),{type:'place',cardId:'poker-2',index:1},'a'),'una jugada pendiente se reconoce ya firmada');
  assert.ok(!R.sameCommand(t.commands.at(-1),{type:'place',cardId:'poker-2',index:1},'b'));
}
console.log('Quién empieza en una sala en directo: sorteo, respuesta única y primer turno: OK');
