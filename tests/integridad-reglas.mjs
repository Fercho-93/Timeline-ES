import fs from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-integrity',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const db=env.authenticatedContext('a').firestore(), ref=doc(db,'rooms','ABCD2345');
const original={roomCode:'ABCD2345',mode:'history',deckFingerprint:'test',hostUid:'a',status:'playing',phase:'turn',version:1,handSize:2,playerOrder:['a','b','c'],players:{a:{name:'Ana',hand:[1,2]},b:{name:'Bea',hand:[3]},c:{name:'Cid',hand:[4]}},deck:[5,6],discard:[],timeline:[7,8],current:0,starter:'a',turnsInRound:0,round:1,winner:null,winners:null,reveal:null,createdAt:Timestamp.fromMillis(1),updatedAt:Timestamp.fromMillis(1)};
const seed = data=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'rooms','ABCD2345'),data));
const stamp=()=>({version:2,updatedAt:serverTimestamp()});
try {
  const valid={players:{...original.players,a:{name:'Ana',hand:[2]}},timeline:[1,7,8],phase:'reveal',reveal:{cardId:1,correct:true,playerUid:'a',playerName:'Ana'}};
  for(const attack of [{...valid,timeline:[1,70,8]},{...valid,deck:[50,6]},{...valid,players:{...original.players,a:{name:'Ana',hand:[22]}}},{...valid,timeline:[1,1,8]}]) {
    await seed(original); await assertFails(updateDoc(ref,{...attack,...stamp()}));
  }
  await seed(original);await assertSucceeds(updateDoc(ref,{...valid,...stamp()}));
  const early={...original,phase:'reveal',players:{...original.players,a:{name:'Ana',hand:[]}}};
  await seed(early);await assertFails(updateDoc(ref,{status:'ended',phase:'finished',winner:'a',winners:['a'],reveal:null,...stamp()}));
  await seed(original);await assertFails(updateDoc(ref,{players:{a:{name:'Ana',hand:[9,2]},c:original.players.c},playerOrder:['a','c'],discard:[3],...stamp()}));
  await seed(original);await assertFails(updateDoc(ref,{players:{a:original.players.a,c:original.players.c},playerOrder:['a','c'],discard:[30],...stamp()}));
  // Cola de desempate: no se puede elegir otro destinatario ni otra carta.
  const tie={...original,phase:'tiebreak',tieQueue:['a','b'],players:{...original.players,a:{name:'Ana',hand:[]},b:{name:'Bea',hand:[]}}};
  const step={players:{...tie.players,a:{name:'Ana',hand:[5]}},deck:[6],tieQueue:['b'],...stamp()};
  await seed(tie);await assertSucceeds(updateDoc(ref,step));
  await seed(tie);await assertFails(updateDoc(ref,{...step,players:{...tie.players,a:{name:'Ana',hand:[6]}},deck:[5]}));
  await seed(tie);await assertFails(updateDoc(ref,{...step,tieQueue:[]}));
  await seed(tie);await assertFails(updateDoc(ref,{...step,players:{...tie.players,a:{name:'Ana',hand:[5,6]}},deck:[]}));
  // Una alta sin cuota y dos altas consecutivas son rechazadas por el servidor.
  const lobby={...original,status:'lobby',phase:'lobby',playerOrder:['a'],players:{a:{name:'Ana',hand:[]}},deck:[],timeline:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await env.withSecurityRulesDisabled(async c=>{await deleteDoc(doc(c.firestore(),'rooms','ABCD2345'));await deleteDoc(doc(c.firestore(),'roomCreation','a'));});
  await assertFails(setDoc(ref,lobby));
  const first=writeBatch(db);first.set(doc(db,'roomCreation','a'),{roomCode:'ABCD2345',lastCreatedAt:serverTimestamp()});first.set(ref,lobby);await assertSucceeds(first.commit());
  const second=writeBatch(db);second.set(doc(db,'roomCreation','a'),{roomCode:'EFGH2345',lastCreatedAt:serverTimestamp()});second.set(doc(db,'rooms','EFGH2345'),{...lobby,roomCode:'EFGH2345'});await assertFails(second.commit());
  console.log('Integridad de cartas, victoria, salidas, desempates y cuota de altas: OK');
} finally { await env.cleanup(); }
