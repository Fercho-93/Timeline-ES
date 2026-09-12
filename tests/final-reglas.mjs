import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp} from 'firebase/firestore';
const env = await initializeTestEnvironment({projectId:'demo-hilo',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const ids=Array.from({length:9},(_,i)=>'p'+i), code='FINAL234';
const db=uid=>env.authenticatedContext(uid).firestore();
const room=client=>doc(client,'rooms',code);
const answer=(client,round,uid)=>doc(client,'rooms',code,'finalRounds',String(round),'answers',uid);
let state;
async function seed(count=9,finalists=count) {
  await env.clearFirestore();
  state={roomCode:code,mode:'history',hostUid:'p0',status:'playing',phase:'final',version:1,
    playerOrder:ids.slice(0,count),players:Object.fromEntries(ids.slice(0,count).map(uid=>[uid,{name:uid,hand:[]}])) ,
    current:count-1,turnsInRound:count-1,round:1,deck:[],discard:[],timeline:[1],winner:null,winners:null,reveal:null,
    createdAt:1,updatedAt:1,final:{round:1,players:ids.slice(0,finalists),cardId:2,target:100,submitted:[],used:[2]}};
  await env.withSecurityRulesDisabled(c=>setDoc(room(c.firestore()),state));
}
async function submit(uid,value) {
  const client=db(uid),batch=writeBatch(client);
  const next={...state.final,submitted:[...state.final.submitted,uid]};
  batch.set(answer(client,state.final.round,uid),{value});
  batch.update(room(client),{final:next,version:state.version+1,updatedAt:serverTimestamp()});
  await assertSucceeds(batch.commit());state.final=next;state.version++;
}
try {
  await seed(3,2);
  await assertSucceeds(getDoc(doc(db('p0'),'capabilities','secretFinal')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'capabilities','secretFinal')));
  await assertFails(setDoc(answer(db('p2'),1,'p2'),{value:100}));
  await assertFails(setDoc(answer(db('p0'),1,'p0'),{value:100}));
  await assertFails(updateDoc(room(db('p0')),{final:{...state.final,submitted:['p0']},version:2,updatedAt:serverTimestamp()}));
  await submit('p0',90);
  assert.equal((await assertSucceeds(getDoc(answer(db('p0'),1,'p0')))).data().value,90);
  await assertFails(getDoc(answer(db('p1'),1,'p0')));
  await assertFails(getDoc(answer(db('p2'),1,'p0')));
  await assertFails(updateDoc(answer(db('p0'),1,'p0'),{value:100}));
  await assertFails(deleteDoc(answer(db('p0'),1,'p0')));
  await assertFails(setDoc(answer(db('p1'),2,'p1'),{value:100}));
  await submit('p1',105);
  await assertSucceeds(getDoc(answer(db('p2'),1,'p0')));
  await assertFails(getDoc(answer(db('outsider'),1,'p0')));
  const finish=who=>({status:'ended',phase:'finished',winner:who,winners:[who],version:state.version+1,updatedAt:serverTimestamp()});
  await assertFails(updateDoc(room(db('p0')),finish('p0')));
  await assertSucceeds(updateDoc(room(db('p2')),finish('p1')));

  await seed();
  for(let i=0;i<9;i++) await submit(ids[i],i===0?90:i===1?110:120+i);
  await assertFails(updateDoc(room(db('p0')),finish('p0')));
  const next={round:2,players:['p0','p1'],cardId:3,target:200,submitted:[],used:[2,3]};
  await assertFails(updateDoc(room(db('p0')),{final:{...next,players:['p0','p2']},version:state.version+1,updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(room(db('p8')),{final:next,version:state.version+1,updatedAt:serverTimestamp()}));
  state.final=next;state.version++;
  await submit('p0',200);await submit('p1',250);
  await assertSucceeds(updateDoc(room(db('p0')),finish('p0')));

  // La final empieza con los únicos jugadores que acabaron la ronda sin cartas.
  await seed(3,2);
  const final=state.final;
  delete state.final;state.phase='reveal';state.players.p2.hand=[7];
  await env.withSecurityRulesDisabled(c=>setDoc(room(c.firestore()),state));
  await assertFails(updateDoc(room(db('p1')),{phase:'final',final,reveal:null,version:2,updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(room(db('p0')),{phase:'final',final,reveal:null,version:2,updatedAt:serverTimestamp()}));
  console.log('Final privada: secreto, recibos atómicos, inmutabilidad, espectadores, nueve finalistas, empate y ganador: OK');
} finally {await env.cleanup();}
