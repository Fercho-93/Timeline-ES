import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import './conexion-nativa.mjs';
import './confirmacion-extremos.mjs';
const CT = {shuffle: cards => [...cards].reverse()};
const context = vm.createContext({window:{CONTINUUM:CT},location:{origin:'https://local.test',pathname:'/'},URL,URLSearchParams});
for(const file of ['engine.js','links.js']) vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const plain = x => JSON.parse(JSON.stringify(x));
assert.deepEqual(plain(CT.Engine.draw([1,2],[3])),{cardId:1,deck:[2],discard:[3]});
assert.deepEqual(plain(CT.Engine.draw([],[3,4])),{cardId:4,deck:[3],discard:[]});
assert.equal(CT.Engine.draw([],[]).cardId,undefined);
for(let count=2;count<=9;count++) {
  const order=Array.from({length:count},(_,i)=>String(i)), players=Object.fromEntries(order.map(id=>[id,{hand:[]}])) ;
  assert.equal(CT.Engine.roundOutcome(order,players,count-1).ended,true);
  assert.equal(CT.Engine.roundOutcome(order,players,count).ended,false);
}
context.window.Capacitor={isNativePlatform:()=>true};
assert.equal(CT.Links.base(),'https://continuumjuego.es/');
// El dominio propio se acepta igual que la dirección de GitHub, con y sin www; otras rutas no.
assert.deepEqual(plain(CT.Links.parse('https://continuumjuego.es/invitation.html#room=ABCD2345')),{room:'ABCD2345'});
assert.deepEqual(plain(CT.Links.parse('https://www.continuumjuego.es/#room=ABCD2345')),{room:'ABCD2345'});
assert.deepEqual(plain(CT.Links.parse('https://fercho-93.github.io/Timeline-ES/invitation.html#room=ABCD2345')),{room:'ABCD2345'});
assert.equal(CT.Links.parse('https://continuumjuego.es/otra/#room=ABCD2345'),null);
assert.equal(CT.Links.parse('https://continuumjuego.es.evil.test/#room=ABCD2345'),null);
assert.deepEqual(plain(CT.Links.parse(CT.Links.base()+'?room=ABCD2345')),{room:'ABCD2345'});
for(const link of ['https://evil.test/?room=ABCD2345','javascript:alert(1)','https://fercho-93.github.io/otro/?room=ABCD2345']) assert.equal(CT.Links.parse(link),null);
assert.deepEqual(plain(CT.Links.parse(CT.Links.base()+'#duelo=abc')),{duelo:'abc'});
console.log('Motor puro, agotamiento de 2 a 9 jugadores y enlaces nativos: OK');
// En la web, las invitaciones salen con la dirección desde la que se juega: al activar el dominio
// propio pasan solas a él. Desde otra dirección, o en la app nativa, se usa la pública fija.
{
  const native = context.window.Capacitor;
  context.window.Capacitor = null;
  context.location.href = 'https://continuumjuego.es/';
  assert.equal(CT.Links.invitation({room:'ABCD2345'}), 'https://continuumjuego.es/invitation.html#room=ABCD2345');
  context.location.href = 'https://fercho-93.github.io/Timeline-ES/';
  assert.equal(CT.Links.invitation({room:'ABCD2345'}), 'https://fercho-93.github.io/Timeline-ES/invitation.html#room=ABCD2345');
  context.location.href = 'https://local.test/';
  assert.equal(CT.Links.invitation({room:'ABCD2345'}), 'https://continuumjuego.es/invitation.html#room=ABCD2345');
  context.window.Capacitor = {isNativePlatform:()=>true};
  context.location.href = 'capacitor://localhost/';
  assert.equal(CT.Links.invitation({room:'ABCD2345'}), 'https://continuumjuego.es/invitation.html#room=ABCD2345');
  context.window.Capacitor = native;
}
console.log('Dominio propio: se aceptan las dos direcciones y la web comparte la suya: OK');
