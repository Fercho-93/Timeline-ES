import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc,setDoc,getDoc,updateDoc,serverTimestamp,Timestamp } from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-presencia',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const room={hostUid:'ana',roomCode:'PRES1234',mode:'history',deckFingerprint:'test',playerOrder:['ana','bea'],players:{ana:{name:'Ana',hand:[]},bea:{name:'Bea',hand:[]}},status:'lobby',phase:'lobby',version:1,updatedAt:Timestamp.fromMillis(Date.now()-100000),createdAt:Timestamp.fromMillis(Date.now()-100000)};
const ref=uid=>doc(env.authenticatedContext(uid).firestore(),'rooms','PRES1234');
const presence=(uid,other=uid)=>doc(env.authenticatedContext(uid).firestore(),'rooms','PRES1234','presence',other);
async function seed(age,visible=true){await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'rooms','PRES1234'),room);await setDoc(doc(ctx.firestore(),'rooms','PRES1234','presence','ana'),{seenAt:Timestamp.fromMillis(Date.now()-age),visible});});}
try {
 await seed(0);
 await assertSucceeds(setDoc(presence('bea'),{seenAt:serverTimestamp(),visible:true}));
 await assertFails(setDoc(presence('bea','ana'),{seenAt:serverTimestamp(),visible:false}));
 await assertFails(getDoc(presence('intruso','ana')));
 await assertFails(setDoc(presence('bea'),{seenAt:Timestamp.fromMillis(0),visible:true}));
 await assertFails(updateDoc(ref('bea'),{hostUid:'bea',version:2,updatedAt:serverTimestamp()}));
 await seed(100000);await assertSucceeds(updateDoc(ref('bea'),{hostUid:'bea',version:2,updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(ref('bea'))).data().hostUid,'bea');
 await seed(20000,false);await assertSucceeds(updateDoc(ref('bea'),{hostUid:'bea',version:2,updatedAt:serverTimestamp()}));
 await seed(100000);await assertFails(updateDoc(ref('bea'),{hostUid:'bea',version:2,players:{bea:{name:'Bea',hand:[]}},updatedAt:serverTimestamp()}));
 console.log('Presencia privada, reloj de servidor y relevo tras inactividad sin alterar la partida: OK');
} finally {await env.cleanup();}
