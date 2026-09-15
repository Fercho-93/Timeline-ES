import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,orderBy,limit,deleteDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
import fs from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
const verified={email_verified:true,firebase:{sign_in_provider:'password'}};
const db=env.authenticatedContext('account-a',verified).firestore(), other=env.authenticatedContext('account-b',verified).firestore();
const anonymous=env.authenticatedContext('anonymous',{firebase:{sign_in_provider:'anonymous'}}).firestore();
const unverified=env.authenticatedContext('unverified',{email_verified:false,firebase:{sign_in_provider:'password'}}).firestore();
const data={alias:'Fer',avatar:'compass',season:'launch-1',privacyVersion:1,createdAt:serverTimestamp()};
try {
 await assertSucceeds(setDoc(doc(db,'playerProfiles','account-a'),data));
 await assertFails(setDoc(doc(other,'playerProfiles','account-a'),data));
 await assertFails(getDoc(doc(other,'playerProfiles','account-a')));
 await assertFails(setDoc(doc(anonymous,'playerProfiles','anonymous'),data));
 await assertFails(setDoc(doc(unverified,'playerProfiles','unverified'),data));
 await assertFails(getDoc(doc(anonymous,'capabilities','multiCompetition')));
 await assertFails(getDocs(collection(db,'playerProfiles')));
 const progress={progress:'{}',records:'{}',hits:2,games:1,revision:1,season:'launch-1',updatedAt:serverTimestamp()};
 const rank={alias:'Fer',avatar:'compass',hits:2,games:1,season:'launch-1',updatedAt:serverTimestamp()};
 let batch=writeBatch(db);batch.set(doc(db,'playerProgress','account-a'),progress);batch.set(doc(db,'socialRanking','account-a'),rank);await assertSucceeds(batch.commit());
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),progress)); // stale revision
 await assertFails(setDoc(doc(other,'playerProgress','account-a'),{...progress,revision:2}));
 await assertFails(getDoc(doc(other,'playerProgress','account-a')));
 await assertFails(setDoc(doc(db,'socialRanking','account-a'),{...rank,hits:999}));
 await assertFails(setDoc(doc(db,'socialRanking','account-a'),{...rank,email:'private@example.com'}));
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:2,progress:'x'.repeat(350001)}));
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:2,hits:-1}));
 await assertSucceeds(getDocs(query(collection(other,'socialRanking'),orderBy('hits','desc'),limit(50))));
 await assertFails(getDocs(collection(other,'socialRanking')));
 await assertFails(getDocs(query(collection(anonymous,'socialRanking'),limit(50))));
 await assertFails(deleteDoc(doc(other,'socialRanking','account-a')));
 batch=writeBatch(db);for(const name of ['playerProfiles','playerProgress','socialRanking'])batch.delete(doc(db,name,'account-a'));await assertSucceeds(batch.commit());
 console.log('Cuentas: aislamiento, verificación, revisiones, privacidad del ranking y borrado correctos.');
} finally {await env.cleanup();}
