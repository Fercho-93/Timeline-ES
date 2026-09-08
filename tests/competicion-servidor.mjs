import assert from 'node:assert/strict';
import {createMatch,applyAction,publicMatch} from '../server/competition.mjs';
const catalog=Array.from({length:80},(_,i)=>({id:i+1,value:i+1}));
const ids=Array.from({length:9},(_,i)=>'player00'+i),copy=c=>[...c];
const all=s=>[...s.deck,...s.discard,...s.timeline,...Object.values(s.players).flatMap(p=>p.hand),...(s.pulse?[s.pulse.cardId]:[])].sort((a,b)=>a-b);
for(let count=2;count<=9;count++) {
 let s=createMatch(ids[0],catalog,1000,copy);
 const step=(uid,action)=>{const before=JSON.stringify(s);const old=s;s=applyAction(s,uid,{...action,version:s.version},2000,copy);assert.equal(JSON.stringify(old),before);assert.deepEqual(all(s),catalog.map(c=>c.id));};
 for(const uid of ids.slice(1,count))step(uid,{type:'join'});
 step(ids[0],{type:'start'});
 assert.throws(()=>applyAction(s,ids[1],{type:'play',cardId:2,index:0,version:s.version},2000),/NOT_TURN/);
 assert.throws(()=>applyAction(s,ids[0],{type:'play',cardId:2,index:0,correct:true,version:s.version},2000),/INVALID_ACTION/);
 step(ids[0],{type:'pulse',target:ids[1]});step(ids[0],{type:'answer',index:s.timeline.length});
 const pub=publicMatch(s);
 for(const key of ['deck','discard','players','values','auditHash'])assert.equal(Object.hasOwn(pub,key),false);
 for(const key of ['byIndex','byOk','giftId'])assert.equal(Object.hasOwn(pub.pulse,key),false);
 step(ids[1],{type:'answer',index:0});step(ids[0],{type:'endTurn'});
 for(let moves=0;s.status!=='ended'&&moves<500;moves++) {
  const uid=s.order[s.current],cardId=s.players[uid].hand[0];
  let index=s.timeline.findIndex(id=>id>cardId);if(index<0)index=s.timeline.length;
  step(uid,{type:'play',cardId,index});step(uid,{type:'endTurn'});
 }
 assert.equal(s.status,'ended');assert.ok(s.winners.length);
 assert.ok(s.winners.every(uid=>s.players[uid].hand.length===0));
 assert.throws(()=>applyAction(s,ids[0],{type:'endTurn',version:s.version-1},2000),/STALE_VERSION/);
}
console.log('Servidor: partidas completas 2–9, Pulso privado, conservación e intentos de manipulación: OK');
