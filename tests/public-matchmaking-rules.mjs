import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync(path.join(REPO,'firestore.rules'),'utf8'),host:'127.0.0.1',port:8080}});
const H='pub-host',P2='pub-p2',P3='pub-p3';
const CODE='PUBAAAAAAA', KEY='history:2';
const ctx=uid=>env.authenticatedContext(uid).firestore();
const player=(name,version=42)=>({name,avatarId:null,hand:[],joinedAt:1,clientVersion:version});
const room=(host=H)=>({roomCode:CODE,mode:'history',deckFingerprint:'167.test1',hostUid:host,matchmaking:'public',capacity:2,clientVersion:42,status:'lobby',phase:'lobby',version:1,handSize:4,turnSeconds:30,playerOrder:[host],players:{[host]:player('Ana')},deck:[],discard:[],timeline:[],current:0,starter:host,turnsInRound:0,round:1,winner:null,winners:null,reveal:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const queue=(code=CODE,status='waiting')=>({queueKey:KEY,roomCode:code,mode:'history',capacity:2,clientVersion:42,deckFingerprint:'167.test1',status,updatedAt:serverTimestamp()});
let fail=0;
const check=async(label,ok,p)=>{try{await(ok?assertSucceeds(p):assertFails(p));console.log('  ok  ',label);}catch(e){fail++;console.log('  FALLA',label,String(e).split('\n')[0]);}};

console.log('\nMatchmaking público');
await env.clearFirestore();
{
  const db=ctx(H),b=writeBatch(db);
  b.set(doc(db,'roomCreation',H),{lastCreatedAt:serverTimestamp(),roomCode:CODE});
  b.set(doc(db,'rooms',CODE),room());
  b.set(doc(db,'publicQueues',KEY),queue());
  await check('crea sala pública y su cola de forma atómica',true,b.commit());
}
await check('un usuario autenticado puede localizar la cola',true,getDoc(doc(ctx(P2),'publicQueues',KEY)));

await env.clearFirestore();
await check('no permite crear una sala pública sin su cola',false,(async()=>{
  const db=ctx(H),b=writeBatch(db);
  b.set(doc(db,'roomCreation',H),{lastCreatedAt:serverTimestamp(),roomCode:CODE});
  b.set(doc(db,'rooms',CODE),room());
  return b.commit();
})());

await env.clearFirestore();
await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await setDoc(doc(db,'rooms',CODE),{...room(),createdAt:new Date(),updatedAt:new Date()});
  await setDoc(doc(db,'publicQueues',KEY),{...queue(),updatedAt:new Date()});
});
{
  const db=ctx(P2),b=writeBatch(db);
  const r=room();
  b.update(doc(db,'rooms',CODE),{players:{...r.players,[P2]:player('Bea')},playerOrder:[H,P2],version:2,updatedAt:serverTimestamp()});
  b.update(doc(db,'publicQueues',KEY),{status:'full',updatedAt:serverTimestamp()});
  await check('la última plaza entra y marca la cola llena en el mismo commit',true,b.commit());
}
await check('una tercera persona no puede superar la capacidad',false,updateDoc(doc(ctx(P3),'rooms',CODE),{players:{[H]:player('Ana'),[P2]:player('Bea'),[P3]:player('Cid')},playerOrder:[H,P2,P3],version:3,updatedAt:serverTimestamp()}));

await env.clearFirestore();
await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await setDoc(doc(db,'rooms',CODE),{...room(),createdAt:new Date(),updatedAt:new Date()});
  await setDoc(doc(db,'publicQueues',KEY),{...queue(),updatedAt:new Date()});
});
await check('no se puede secuestrar una cola waiting apuntándola a otra sala',false,updateDoc(doc(ctx(P2),'publicQueues',KEY),{roomCode:'PUBBBBBBBB',updatedAt:serverTimestamp()}));

await env.cleanup();
console.log(fail ? '\n'+fail+' fallos' : '\n0 fallos');
process.exit(fail?1:0);
