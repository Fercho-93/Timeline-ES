import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,deleteDoc} from 'firebase/firestore';
import fs from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
const ctx=(uid,provider)=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
try {
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  for(const uid of ['tester','ordinary']) await setDoc(doc(c.firestore(),'playerProfiles',uid),{alias:'Player 1234',avatar:'compass',season:'launch-1',privacyVersion:1});
  await setDoc(doc(c.firestore(),'appleBetaTesters','tester'),{enabled:true});
 });
 const tester=ctx('tester','apple.com'),ordinary=ctx('ordinary','apple.com'),guest=ctx('ordinary','anonymous');
 await assertSucceeds(getDoc(doc(tester,'playerProfiles','tester')));
 await assertFails(getDoc(doc(ordinary,'playerProfiles','ordinary')));
 await assertSucceeds(getDoc(doc(guest,'playerProfiles','ordinary')));
 await assertSucceeds(getDoc(doc(guest,'appleBetaTesters','ordinary')));
 await assertFails(getDoc(doc(guest,'appleBetaTesters','tester')));
 await assertFails(setDoc(doc(guest,'appleBetaTesters','ordinary'),{enabled:true}));
 await assertFails(deleteDoc(doc(tester,'appleBetaTesters','tester')));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'appleBetaTesters','tester'),{enabled:false}));
 await assertFails(getDoc(doc(tester,'playerProfiles','tester')));
 console.log('Apple: permiso de probador, revocación, aislamiento y ausencia de autoautorización correctos.');
} finally {await env.cleanup();}
