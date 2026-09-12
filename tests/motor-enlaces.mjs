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
assert.equal(CT.Links.base(),'https://fercho-93.github.io/Timeline-ES/');
assert.deepEqual(plain(CT.Links.parse(CT.Links.base()+'?room=ABCD2345')),{room:'ABCD2345'});
for(const link of ['https://evil.test/?room=ABCD2345','javascript:alert(1)','https://fercho-93.github.io/otro/?room=ABCD2345']) assert.equal(CT.Links.parse(link),null);
assert.deepEqual(plain(CT.Links.parse(CT.Links.base()+'#duelo=abc')),{duelo:'abc'});
console.log('Motor puro, agotamiento de 2 a 9 jugadores y enlaces nativos: OK');
