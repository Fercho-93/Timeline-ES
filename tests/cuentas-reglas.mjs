import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,orderBy,limit,deleteDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
import fs from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
const verified={firebase:{sign_in_provider:'anonymous'}};
const db=env.authenticatedContext('account-a',verified).firestore(), other=env.authenticatedContext('account-b',verified).firestore();
const anonymous=env.authenticatedContext('anonymous',{firebase:{sign_in_provider:'anonymous'}}).firestore();
const unauthenticated=env.unauthenticatedContext().firestore();
const data={aliasKey:'fer',alias:'Fer',avatar:'compass',season:'launch-1',privacyVersion:1,createdAt:serverTimestamp()};
try {
 let registration=writeBatch(db);registration.set(doc(db,'playerProfiles','account-a'),data);registration.set(doc(db,'playerNames','fer'),{uid:'account-a'});await assertSucceeds(registration.commit());
 await assertFails(setDoc(doc(other,'playerNames','fer'),{uid:'account-b'}));
 await assertFails(setDoc(doc(other,'playerProfiles','account-b'),data));
 await assertFails(setDoc(doc(other,'playerProfiles','account-a'),data));
 await assertFails(getDoc(doc(other,'playerProfiles','account-a')));
 registration=writeBatch(anonymous);registration.set(doc(anonymous,'playerProfiles','anonymous'),{...data,alias:'Guest',aliasKey:'guest'});registration.set(doc(anonymous,'playerNames','guest'),{uid:'anonymous'});await assertSucceeds(registration.commit());
 await assertFails(setDoc(doc(unauthenticated,'playerProfiles','outsider'),data));
 await assertSucceeds(getDoc(doc(anonymous,'capabilities','multiCompetition')));
 await assertFails(getDocs(collection(db,'playerProfiles')));
 const progress={progress:'{}',records:'{}',hits:2,games:1,revision:1,season:'launch-1',updatedAt:serverTimestamp()};
 const rank={alias:'Fer',avatar:'compass',hits:2,games:1,season:'launch-1',updatedAt:serverTimestamp()};
 let batch=writeBatch(db);batch.set(doc(db,'playerProgress','account-a'),progress);batch.set(doc(db,'dailyRanking','account-a'),rank);await assertSucceeds(batch.commit());
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),progress)); // stale revision
 await assertFails(setDoc(doc(other,'playerProgress','account-a'),{...progress,revision:2}));
 await assertFails(getDoc(doc(other,'playerProgress','account-a')));
 await assertFails(setDoc(doc(db,'dailyRanking','account-a'),{...rank,hits:999}));
 await assertFails(setDoc(doc(db,'dailyRanking','account-a'),{...rank,email:'private@example.com'}));
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:2,progress:'x'.repeat(350001)}));
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:2,hits:-1}));
 await assertSucceeds(getDocs(query(collection(other,'dailyRanking'),orderBy('hits','desc'),limit(50))));
 await assertFails(getDocs(collection(other,'dailyRanking')));
 await assertSucceeds(getDocs(query(collection(anonymous,'dailyRanking'),limit(50))));
 await assertFails(getDocs(query(collection(unauthenticated,'dailyRanking'),limit(50))));
 await assertFails(deleteDoc(doc(other,'dailyRanking','account-a')));
 batch=writeBatch(db);batch.update(doc(db,'playerProfiles','account-a'),{alias:'Fulanito',aliasKey:'fulanito'});batch.set(doc(db,'playerNames','fulanito'),{uid:'account-a'});batch.delete(doc(db,'playerNames','fer'));batch.update(doc(db,'dailyRanking','account-a'),{alias:'Fulanito',updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());
 // El avatar elegido (uno de los 36 del selector) se publica en el perfil y en el ranking; uno inventado, no.
 batch=writeBatch(db);batch.update(doc(db,'playerProfiles','account-a'),{avatar:'tigre'});batch.update(doc(db,'dailyRanking','account-a'),{avatar:'tigre',updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());
 await assertFails(setDoc(doc(db,'playerProfiles','account-a'),{...data,alias:'Fulanito',aliasKey:'fulanito',avatar:'inventado'}));
 await assertFails(setDoc(doc(db,'dailyRanking','account-a'),{...rank,alias:'Fulanito',avatar:'panda',updatedAt:serverTimestamp()})); // no coincide con el perfil
 // Tablas del ranking: hoy y esta semana. La fila tiene que cuadrar con el progreso, el nombre y el avatar.
 // Las filas nuevas solo valen para el día y la semana en curso (según la hora del servidor), como las del juego.
 const key=d=>d.toLocaleDateString('sv-SE'), shift=(d,n)=>{const c=new Date(d);c.setDate(c.getDate()+n);return c;};
 const now=new Date();now.setHours(12,0,0,0);
 const day=key(now), week=key(shift(now,-((now.getDay()+6)%7))), yesterday=key(shift(now,-1)), old=key(shift(now,-20)), future=key(shift(now,3));
 const who={alias:'Fulanito',avatar:'tigre'};
 batch=writeBatch(db);batch.set(doc(db,'playerProgress','account-a'),{...progress,revision:2,day,dayHits:7,week,weekHits:19});
 batch.set(doc(db,'dailyScores',day,'players','account-a'),{...who,hits:7,finishedAt:`${day}T08:00:00.000Z`,updatedAt:serverTimestamp()});
 batch.set(doc(db,'weeklyScores',week,'players','account-a'),{...who,hits:19,updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());
 await assertFails(setDoc(doc(db,'dailyScores',day,'players','account-a'),{...who,hits:9,finishedAt:'',updatedAt:serverTimestamp()})); // no cuadra con el progreso
 await assertFails(setDoc(doc(db,'dailyScores',yesterday,'players','account-a'),{...who,hits:7,finishedAt:'',updatedAt:serverTimestamp()})); // otro día
 await assertFails(setDoc(doc(db,'dailyScores',day,'players','account-a'),{...who,alias:'Otro',hits:7,finishedAt:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(other,'dailyScores',day,'players','account-a'),{...who,hits:7,finishedAt:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:3,day,dayHits:11,week,weekHits:19})); // un reto vale como mucho 10
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:3,day,dayHits:7,week,weekHits:71}));
 await assertSucceeds(getDocs(query(collection(other,'dailyScores',day,'players'),orderBy('hits','desc'),limit(50))));
 await assertSucceeds(getDocs(query(collection(other,'weeklyScores',week,'players'),orderBy('hits','desc'),limit(50))));
 await assertFails(getDocs(collection(other,'weeklyScores',week,'players')));
 await assertFails(getDocs(query(collection(unauthenticated,'dailyScores',day,'players'),limit(50))));
 await assertFails(deleteDoc(doc(other,'weeklyScores',week,'players','account-a')));
 // El tiempo que se tardó viaja con la fila y desempata; tiene que ser un número razonable.
 await assertSucceeds(setDoc(doc(db,'dailyScores',day,'players','account-a'),{...who,hits:7,ms:95000,finishedAt:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'dailyScores',day,'players','account-a'),{...who,hits:7,ms:-5,finishedAt:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'dailyScores',day,'players','account-a'),{...who,hits:7,ms:'rápido',finishedAt:'',updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(db,'weeklyScores',week,'players','account-a'),{...who,hits:19,ms:400000,updatedAt:serverTimestamp()}));
 // Resultados imposibles: menos de un segundo por acierto, o un día que no es el de hoy aunque el progreso diga eso.
 await assertFails(setDoc(doc(db,'dailyScores',day,'players','account-a'),{...who,hits:7,ms:3000,finishedAt:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'weeklyScores',week,'players','account-a'),{...who,hits:19,ms:5000,updatedAt:serverTimestamp()}));
 for (const [d, wk] of [[future, future], [old, old]]) {
  await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'playerProgress','account-a'),{...progress,revision:2,day:d,dayHits:10,week:wk,weekHits:10});});
  await assertFails(setDoc(doc(db,'dailyScores',d,'players','account-a'),{...who,hits:10,ms:60000,finishedAt:'',updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db,'weeklyScores',wk,'players','account-a'),{...who,hits:10,ms:60000,updatedAt:serverTimestamp()}));
 }
 // Una fila de un día pasado sí se puede reescribir con el mismo resultado (al cambiar de nombre o de avatar).
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'playerProgress','account-a'),{...progress,revision:2,day:old,dayHits:5,week:old,weekHits:5});
  await setDoc(doc(c.firestore(),'dailyScores',old,'players','account-a'),{alias:'Fulanito',avatar:'panda',hits:5,ms:80000,finishedAt:'',updatedAt:new Date()});
 });
 await assertSucceeds(setDoc(doc(db,'dailyScores',old,'players','account-a'),{...who,hits:5,ms:80000,finishedAt:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'dailyScores',old,'players','account-a'),{...who,hits:5,ms:70000,finishedAt:'',updatedAt:serverTimestamp()})); // otro tiempo: resultado nuevo
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'playerProgress','account-a'),{...progress,revision:2,day,dayHits:7,week,weekHits:19});});
 // «Ver más»: hasta 200 filas; más, no.
 await assertSucceeds(getDocs(query(collection(other,'dailyScores',day,'players'),orderBy('hits','desc'),limit(200))));
 await assertFails(getDocs(query(collection(other,'dailyScores',day,'players'),orderBy('hits','desc'),limit(201))));
 await assertSucceeds(deleteDoc(doc(db,'weeklyScores',week,'players','account-a')));
 // Ranking de descubrimientos: la fila cuadra con el recuento del progreso, que los clientes anteriores no envían.
 batch=writeBatch(db);batch.set(doc(db,'playerProgress','account-a'),{...progress,revision:3,found:12,foundCollections:9,foundQuick:3});
 batch.set(doc(db,'discoveryScores','account-a'),{...who,cards:12,collections:9,quick:3,updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());
 await assertFails(setDoc(doc(db,'discoveryScores','account-a'),{...who,cards:13,collections:10,quick:3,updatedAt:serverTimestamp()})); // no cuadra con el progreso
 await assertFails(setDoc(doc(db,'discoveryScores','account-a'),{...who,alias:'Otro',cards:12,collections:9,quick:3,updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'discoveryScores','account-a'),{...who,cards:12,collections:9,quick:3,email:'x@example.com',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(other,'discoveryScores','account-a'),{...who,cards:12,collections:9,quick:3,updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:4,found:13,foundCollections:9,foundQuick:3})); // la suma no cuadra
 await assertFails(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:4,found:-1,foundCollections:-1,foundQuick:0}));
 await assertSucceeds(getDocs(query(collection(other,'discoveryScores'),orderBy('cards','desc'),limit(200))));
 await assertSucceeds(getDocs(query(collection(anonymous,'discoveryScores'),orderBy('quick','desc'),limit(50))));
 await assertFails(getDocs(query(collection(other,'discoveryScores'),orderBy('cards','desc'),limit(201))));
 await assertFails(getDocs(collection(other,'discoveryScores')));
 await assertFails(getDocs(query(collection(unauthenticated,'discoveryScores'),limit(50))));
 await assertFails(deleteDoc(doc(other,'discoveryScores','account-a')));
 await assertSucceeds(setDoc(doc(db,'playerProgress','account-a'),{...progress,revision:4})); // un cliente anterior
 await assertSucceeds(deleteDoc(doc(db,'discoveryScores','account-a')));
 await assertFails(setDoc(doc(db,'playerProfiles','account-a'),{...data,alias:'x'}));
 await assertFails(setDoc(doc(db,'playerProfiles','account-a'),{...data,season:'other'}));
 await assertFails(deleteDoc(doc(db,'playerNames','fulanito')));
 await assertFails(setDoc(doc(other,'playerNames','fulanito'),{uid:'account-b'}));
 batch=writeBatch(db);batch.delete(doc(db,'playerNames','fulanito'));for(const name of ['playerProfiles','playerProgress','dailyRanking'])batch.delete(doc(db,name,'account-a'));await assertSucceeds(batch.commit());
 const race=await Promise.allSettled(['race-a','race-b'].map(async uid=>{
   const client=env.authenticatedContext(uid,verified).firestore(), claim=writeBatch(client);
   claim.set(doc(client,'playerProfiles',uid),{...data,alias:'Unico',aliasKey:'unico'});
   claim.set(doc(client,'playerNames','unico'),{uid});
   return claim.commit();
 }));
 if(race.filter(r=>r.status==='fulfilled').length!==1)throw Error('Dos jugadores reservaron el mismo nombre');
 registration=writeBatch(other);registration.set(doc(other,'playerProfiles','account-b'),{...data,alias:'UNICO',aliasKey:'UNICO'});registration.set(doc(other,'playerNames','UNICO'),{uid:'account-b'});await assertFails(registration.commit());
 console.log('Cuentas: invitados, aislamiento, nombres, revisiones, privacidad del ranking y borrado correctos.');
} finally {await env.cleanup();}
