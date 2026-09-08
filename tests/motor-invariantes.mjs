import assert from 'node:assert/strict';
import '../engine.js';
const E=globalThis.ContinuumEngine;
const value=id=>id;
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const inventory=s=>[...(s.hand||s.byHand||[]),...(s.targetHand||[]),...s.timeline,...s.deck,...s.discard].sort((a,b)=>a-b);
for(const deck of [[],[7,8]]) for(const discard of [[],[9,10]]) {
 const state=freeze({hand:[2,4],timeline:[1,3,5],deck,discard});
 for(const slot of [0,1,2,3]) {
  const result=E.play(state,2,slot,value,c=>[...c].reverse());
  assert.deepEqual(inventory(result),inventory(state));
  assert.equal(result.correct,slot===1);
 }
 for(const byIndex of [0,1]) for(const targetIndex of [0,1]) {
  const pulse=freeze({cardId:2,byIndex,giftId:4});
  const before=freeze({byHand:[4,6],targetHand:[11],timeline:[1,3,5],deck,discard});
  const result=E.pulse(before,pulse,targetIndex,value,c=>[...c].reverse());
  assert.deepEqual(inventory(result),[...inventory(before),2].sort((a,b)=>a-b));
  assert.equal(result.byOk,byIndex===1);assert.equal(result.targetOk,targetIndex===1);
  assert.equal(result.penaltySkipped,byIndex===0&&targetIndex===1&&!deck.length&&!discard.length);
 }
}
for(const slot of [-1,NaN,0.5,2]) assert.throws(()=>E.play({hand:[2],timeline:[1],deck:[],discard:[]},2,slot,value),/INVALID_SLOT/);
assert.throws(()=>E.play({hand:[2],timeline:[],deck:[],discard:[]},3,0,value),/NO_CARD/);
assert.equal(E.fits([2],2,0,value),true);assert.equal(E.fits([2],2,1,value),true);
console.log('Motor independiente: inmutabilidad, conservación de cartas, cuatro Pulsos e índices inválidos: OK');
