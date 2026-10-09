import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync(path.join(REPO,'firestore.rules'),'utf8'),host:'127.0.0.1',port:8080}});
const H='pub-host',P2='pub-p2',P3='pub-p3';
const CODE='PAAAAAAA', KEY='history:2:v42:167.test1';
const ctx=uid=>env.authenticatedContext(uid).firestore();
const player=(name,version=42)=>({name,avatarId:null,hand:[],joinedAt:1,clientVersion:version});
const room=(host=H)=>({roomCode:CODE,mode:'history',deckFingerprint:'167.test1',hostUid:host,matchmaking:'public',capacity:2,clientVersion:42,queueKey:KEY,status:'lobby',phase:'lobby',version:1,handSize:4,turnSeconds:30,playerOrder:[host],players:{[host]:player('Ana')},deck:[],discard:[],timeline:[],current:0,starter:host,turnsInRound:0,round:1,winner:null,winners:null,reveal:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const queue=(code=CODE,status='waiting')=>({queueKey:KEY,roomCode:code,mode:'history',capacity:2,clientVersion:42,deckFingerprint:'167.test1',status,updatedAt:serverTimestamp()});
let fail=0;
// Cada mesa nueva va con su registro de cuota (`creationQuota`), en la misma operación.
const cuota=(b,db,uid,code)=>b.set(doc(db,'creationQuota',uid),{lastCreatedAt:serverTimestamp(),kind:'publicRoom',target:code});
const check=async(label,ok,p)=>{try{await(ok?assertSucceeds(p):assertFails(p));console.log('  ok  ',label);}catch(e){fail++;console.log('  FALLA',label,String(e).split('\n')[0]);}};

console.log('\nMatchmaking público');
await env.clearFirestore();
{
  const db=ctx(H),b=writeBatch(db);
  b.set(doc(db,'rooms',CODE),room());cuota(b,db,H,CODE);
  b.set(doc(db,'publicQueues',KEY),queue());
  await check('crea sala pública y su cola de forma atómica',true,b.commit());
}
await check('un usuario autenticado puede localizar la cola',true,getDoc(doc(ctx(P2),'publicQueues',KEY)));

await env.clearFirestore();
// La sala se puede preparar sin cola, pero una cola sin sala válida queda prohibida.
// Evita la lectura circular de getAfter entre ambas reglas de creación.
await check('permite preparar la sala sin cola',true,(async()=>{
  const db=ctx(H),b=writeBatch(db);
  b.set(doc(db,'rooms',CODE),room());cuota(b,db,H,CODE);
  return b.commit();
})());

await env.clearFirestore();
await check('no permite publicar una cola sin su sala',false,setDoc(doc(ctx(H),'publicQueues',KEY),queue()));

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
await check('no se puede secuestrar una cola waiting apuntándola a otra sala',false,updateDoc(doc(ctx(P2),'publicQueues',KEY),{roomCode:'PBBBBBBB',updatedAt:serverTimestamp()}));

await env.clearFirestore();
// Mesa abandonada: su cola no se ha renovado en más de dos minutos.
await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore(), old=new Date(Date.now()-5*60000);
  await setDoc(doc(db,'rooms',CODE),{...room(),createdAt:old,updatedAt:old});
  await setDoc(doc(db,'publicQueues',KEY),{...queue(),updatedAt:old});
});
{
  const db=ctx(P2),b=writeBatch(db);
  b.set(doc(db,'rooms','PBBBBBBB'),{...room(P2),roomCode:'PBBBBBBB'});cuota(b,db,P2,'PBBBBBBB');
  b.set(doc(db,'publicQueues',KEY),queue('PBBBBBBB'));
  await check('una mesa abandonada (cola sin renovar en dos minutos) se sustituye por una nueva',true,b.commit());
}
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await setDoc(doc(db,'rooms',CODE),{...room(),createdAt:new Date(),updatedAt:new Date()});
  await setDoc(doc(db,'publicQueues',KEY),{...queue(),updatedAt:new Date()});
});
{
  const db=ctx(P2),b=writeBatch(db);
  b.set(doc(db,'rooms','PBBBBBBB'),{...room(P2),roomCode:'PBBBBBBB'});cuota(b,db,P2,'PBBBBBBB');
  b.set(doc(db,'publicQueues',KEY),queue('PBBBBBBB'));
  await check('una mesa que sigue viva no se puede sustituir',false,b.commit());
}
await check('quien espera en la mesa renueva su cola',true,updateDoc(doc(ctx(H),'publicQueues',KEY),{status:'waiting',updatedAt:serverTimestamp()}));

// Mesa pública de 4 con dos personas: se puede empezar si lleva 25 s sin que entre nadie.
const empezar = extra => ({status:'playing',phase:'turn',handSize:1,players:{[H]:{...player('Ana'),hand:[1]},[P2]:{...player('Bea'),hand:[2]}},deck:[4],discard:[],timeline:[3],current:0,starter:H,turnsInRound:0,round:1,winner:null,winners:null,reveal:null,version:3,updatedAt:serverTimestamp(),...extra});
for (const [label, hace, esperado] of [['recién entrada la segunda persona no se puede empezar todavía', 5000, false], ['con dos personas y 30 s sin que entre nadie, sí', 40000, true]]) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
    const t=new Date(Date.now()-hace);
    await setDoc(doc(c.firestore(),'rooms',CODE),{...room(),capacity:4,playerOrder:[H,P2],players:{[H]:player('Ana'),[P2]:player('Bea')},version:2,createdAt:t,updatedAt:t});
  });
  await check(label, esperado, updateDoc(doc(ctx(H),'rooms',CODE), empezar()));
}
// Quien lleva una mesa pública que aún espera puede irse: la pasa a quien queda primero.
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'rooms',CODE),{...room(),capacity:4,playerOrder:[H,P2,P3],players:{[H]:player('Ana'),[P2]:player('Bea'),[P3]:player('Cid')},version:2,createdAt:new Date(),updatedAt:new Date()});
});
await check('TRAMPA: al irse, pasarle la mesa a quien no toca',false,updateDoc(doc(ctx(H),'rooms',CODE),{players:{[P2]:player('Bea'),[P3]:player('Cid')},playerOrder:[P2,P3],hostUid:P3,version:3,updatedAt:serverTimestamp()}));
await check('quien lleva la mesa se va y la lleva quien queda primero',true,updateDoc(doc(ctx(H),'rooms',CODE),{players:{[P2]:player('Bea'),[P3]:player('Cid')},playerOrder:[P2,P3],hostUid:P2,version:3,updatedAt:serverTimestamp()}));

console.log('\nSala privada con máximo de participantes');
{
  const priv=(cap)=>({...room(),matchmaking:undefined,queueKey:undefined,capacity:cap});
  const limpia=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined));
  await env.clearFirestore();
  await check('se crea una sala privada con máximo 2',true,(async()=>{const db=ctx(H),b=writeBatch(db);b.set(doc(db,'rooms',CODE),limpia(priv(2)));b.set(doc(db,'roomCreation',H),{lastCreatedAt:serverTimestamp(),roomCode:CODE});return b.commit();})());
  await env.clearFirestore();
  await check('TRAMPA: máximo de 12 en una sala privada',false,(async()=>{const db=ctx(H),b=writeBatch(db);b.set(doc(db,'rooms',CODE),limpia(priv(12)));b.set(doc(db,'roomCreation',H),{lastCreatedAt:serverTimestamp(),roomCode:CODE});return b.commit();})());
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'rooms',CODE),{...limpia(priv(2)),createdAt:new Date(),updatedAt:new Date()}));
  await check('la segunda persona entra en la sala de máximo 2',true,updateDoc(doc(ctx(P2),'rooms',CODE),{players:{[H]:player('Ana'),[P2]:player('Bea')},playerOrder:[H,P2],version:2,updatedAt:serverTimestamp()}));
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'rooms',CODE),{...limpia(priv(2)),playerOrder:[H,P2],players:{[H]:player('Ana'),[P2]:player('Bea')},version:2,createdAt:new Date(),updatedAt:new Date()}));
  await check('TRAMPA: una tercera persona no cabe en la sala de máximo 2',false,updateDoc(doc(ctx(P3),'rooms',CODE),{players:{[H]:player('Ana'),[P2]:player('Bea'),[P3]:player('Cid')},playerOrder:[H,P2,P3],version:3,updatedAt:serverTimestamp()}));
  await env.clearFirestore();
}

console.log('\nTablón de mesas públicas');
{
  const { collection, query, orderBy, limit, getDocs, deleteDoc } = await import('firebase/firestore');
  const ficha=(over={})=>({kind:'collections',code:CODE,mode:'history',capacity:2,seconds:20,players:1,names:['Ana'],hostUid:H,hostAvatar:null,clientVersion:42,fingerprint:'167.test1',updatedAt:serverTimestamp(),...over});
  const sala=async(over={})=>env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'rooms',CODE),{...room(),turnSeconds:20,createdAt:new Date(),updatedAt:new Date(),...over}));
  await env.clearFirestore();
  // Crear mesa: la sala nace con su tiempo elegido, sin pasar por la cola.
  await check('se abre una mesa pública con su tiempo, sin cola',true,(async()=>{const db=ctx(H),b=writeBatch(db);b.set(doc(db,'rooms',CODE),{...room(),turnSeconds:20});cuota(b,db,H,CODE);return b.commit();})());
  await env.withSecurityRulesDisabled(async c=>{await deleteDoc(doc(c.firestore(),'creationQuota',H));});
  await check('TRAMPA: abrir otra mesa sin su registro de cuota',false,setDoc(doc(ctx(H),'rooms','PCCCCCCC'),{...room(),roomCode:'PCCCCCCC',turnSeconds:20}));
  await check('TRAMPA: abrir otra mesa antes de 10 s',false,(async()=>{const db=ctx(H),b=writeBatch(db);b.set(doc(db,'rooms','PDDDDDDD'),{...room(),roomCode:'PDDDDDDD',turnSeconds:20});cuota(b,db,H,'PDDDDDDD');await b.commit();const b2=writeBatch(db);b2.set(doc(db,'rooms','PEEEEEEE'),{...room(),roomCode:'PEEEEEEE',turnSeconds:20});cuota(b2,db,H,'PEEEEEEE');return b2.commit();})());
  await check('quien la lleva publica su ficha en el tablón',true,setDoc(doc(ctx(H),'publicTables',CODE),ficha()));
  await check('cualquiera con perfil lista las mesas abiertas',true,getDocs(query(collection(ctx(P2),'publicTables'),orderBy('updatedAt','desc'),limit(50))));
  await check('TRAMPA: listar sin límite',false,getDocs(query(collection(ctx(P2),'publicTables'),orderBy('updatedAt','desc'))));
  await check('TRAMPA: publicar la ficha de una mesa ajena',false,setDoc(doc(ctx(P2),'publicTables',CODE),ficha({hostUid:P2})));
  await check('TRAMPA: la ficha dice otro mazo que la sala',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha({mode:'science'})));
  await check('la ficha lleva las cartas iniciales de la mesa',true,setDoc(doc(ctx(H),'publicTables',CODE),ficha({handSize:5})));
  await check('TRAMPA: cartas iniciales fuera de 1 a 6',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha({handSize:9})));
  await check('TRAMPA: un tiempo que no existe',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha({seconds:45})));
  await check('TRAMPA: más jugadores que plazas',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha({players:3})));
  await check('TRAMPA: un campo de más',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha({premio:1})));
  await check('quien entra en la mesa (elegida en el tablón) ocupa su plaza',true,updateDoc(doc(ctx(P2),'rooms',CODE),{players:{[H]:player('Ana'),[P2]:player('Bea')},playerOrder:[H,P2],version:2,updatedAt:serverTimestamp()}));
  await check('quien no lleva la mesa no puede borrar una ficha viva',false,deleteDoc(doc(ctx(P3),'publicTables',CODE)));
  await check('quien la lleva la quita al llenarse',true,deleteDoc(doc(ctx(H),'publicTables',CODE)));
  // Relevo: la nueva persona al mando reescribe la ficha a su nombre.
  await env.clearFirestore();
  await sala({hostUid:P2,playerOrder:[P2],players:{[P2]:player('Bea')}});
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'publicTables',CODE),{...ficha(),updatedAt:new Date()}));
  await check('tras el relevo, la ficha pasa a quien lleva ahora la mesa',true,setDoc(doc(ctx(P2),'publicTables',CODE),ficha({hostUid:P2,names:['Bea']})));
  // Una sala que ya ha empezado no puede seguir anunciándose.
  await env.clearFirestore();
  await sala({status:'playing',phase:'turn'});
  await check('TRAMPA: anunciar una mesa que ya juega',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha()));
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'publicTables',CODE),{...ficha(),updatedAt:new Date()}));
  await check('cualquiera retira la ficha de una mesa que ya empezó',true,deleteDoc(doc(ctx(P3),'publicTables',CODE)));
  // Ficha abandonada (más de dos minutos sin renovar): cualquiera la retira.
  await env.clearFirestore();
  await sala();
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'publicTables',CODE),{...ficha(),updatedAt:new Date(Date.now()-5*60000)}));
  await check('cualquiera retira una ficha abandonada',true,deleteDoc(doc(ctx(P3),'publicTables',CODE)));
  // Retos rápidos: la ficha la escribe quien lleva la sala de retos.
  await env.clearFirestore();
  const Q='ABCDEFGH23';
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'quickRooms',Q),{version:1,capacity:3,host:H,members:[H],names:['Ana'],config:null,commands:[],revision:0,phase:'lobby',actor:H,catalog:1,matchmaking:'public',updatedAt:new Date()}));
  const rapida=over=>ficha({kind:'quick',code:Q,mode:'quick',capacity:3,seconds:0,fingerprint:1,clientVersion:1,...over});
  await check('mesa de Retos rápidos en el tablón',true,setDoc(doc(ctx(H),'publicTables',Q),rapida()));
  await check('TRAMPA: cartas iniciales en una ficha de Retos rápidos',false,setDoc(doc(ctx(H),'publicTables',Q),rapida({handSize:4})));
  await check('mesa de Retos rápidos con duración y reglas de fallo',true,setDoc(doc(ctx(H),'publicTables',Q),rapida({length:5,keep:true})));
  await check('TRAMPA: duración que no existe',false,setDoc(doc(ctx(H),'publicTables',Q),rapida({length:4})));
  await check('TRAMPA: «seguir» que no es booleano',false,setDoc(doc(ctx(H),'publicTables',Q),rapida({keep:'si'})));
  await check('TRAMPA: duración en una ficha de colecciones',false,setDoc(doc(ctx(H),'publicTables',CODE),ficha({length:3})));
  await check('TRAMPA: ficha de Retos rápidos con otras plazas',false,setDoc(doc(ctx(H),'publicTables',Q),rapida({capacity:4})));
  await check('TRAMPA: ficha de Retos rápidos de quien no la lleva',false,setDoc(doc(ctx(P2),'publicTables',Q),rapida({hostUid:P2})));
  // Las pruebas siguientes comparten el emulador: no se dejan salas a medias.
  await env.clearFirestore();
}

await env.cleanup();
console.log(fail ? '\n'+fail+' fallos' : '\n0 fallos');
process.exit(fail?1:0);
