import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import fs from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
const ctx=(uid,provider)=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
try {
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  for(const uid of ['apple','guest']) await setDoc(doc(c.firestore(),'playerProfiles',uid),{alias:'Player 1234',avatar:'compass',season:'launch-1',privacyVersion:1});
 });
 // Con el acceso abierto, una cuenta de Apple se trata igual que un invitado: lo suyo sí, lo de otros no.
 await assertSucceeds(getDoc(doc(ctx('apple','apple.com'),'playerProfiles','apple')));
 await assertSucceeds(getDoc(doc(ctx('guest','anonymous'),'playerProfiles','guest')));
 await assertFails(getDoc(doc(ctx('guest','anonymous'),'appleBetaTesters','guest')));
 await assertFails(setDoc(doc(ctx('apple','apple.com'),'appleBetaTesters','apple'),{enabled:true}));
 console.log('Apple: cuenta abierta a todos y sin lista de probadores.');
} finally {await env.cleanup();}
