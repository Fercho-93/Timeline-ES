import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,serverTimestamp,runTransaction,onSnapshot} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-hilo',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
const w={};for(const p of ['cards.js','movies.js','music.js','videogames.js','animals.js','lifespan.js','speed.js','inventos.js','mundo.js','astronomy.js','medicine.js','countries.js','population.js','idiomas.js','distances.js','modes.js','engine.js','quick-challenges-data.js','quick-challenges-engine.js','quick-room.js'])vm.runInNewContext(fs.readFileSync(p,'utf8'),{window:w});
const R=w.CONTINUUM.QuickRoom, E=w.CONTINUUM.QuickEngine;
const rounds=[{id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}];
const host=env.authenticatedContext('host').firestore(),guest=env.authenticatedContext('guest').firestore(),out=env.authenticatedContext('outsider').firestore();
const ref=db=>doc(db,'quickRooms','ABCDEFGH23');
const write=(db,r)=>setDoc(ref(db),{...JSON.parse(JSON.stringify(r)),catalog:1,updatedAt:serverTimestamp()});
try {
  let r=R.create('host','Ana');
  await assertSucceeds(write(host,r));
  await assertFails(write(out,r));
  await assertSucceeds(getDoc(ref(guest)));
  r=R.reduce(r,'guest',{type:'join',name:'Bea'});await assertSucceeds(write(guest,r));
  let started=R.reduce(r,'host',{type:'start',rounds});
  await assertFails(write(guest,started));await assertSucceeds(write(host,started));r=started;
  await assertFails(getDoc(ref(out)));
  await assertFails(write(out,R.reduce(r,'host',{type:'bank'})));
  await assertFails(write(guest,R.reduce(r,'host',{type:'bank'})));
  let next=R.reduce(r,'host',{type:'place',cardId:'poker-2',index:1});await assertSucceeds(write(host,next));r=next;
  next=R.reduce(r,'host',{type:'ack'});await assertSucceeds(write(host,next));r=next;
  assert.equal(r.actor,'guest');
  await assertFails(write(host,R.reduce(r,'guest',{type:'bank'})));
  next=R.reduce(r,'guest',{type:'bank'});await assertSucceeds(write(guest,next));r=next;
  await assertFails(write(host,{...r,revision:r.revision+1,commands:[]}));
  await assertFails(write(host,{...r,revision:r.revision+1,names:['Impostor','Bea']}));
  next=R.reduce(r,'host',{type:'bank'});await assertSucceeds(write(host,next));
  assert.equal(next.phase,'finished');
  await assertFails(write(host,{...next,revision:next.revision+1,commands:[...next.commands,{type:'next'}],phase:'turn'}));
  // The production adapter uses the real SDK against the emulator, including listeners,
  // concurrent join transactions, late reconnect and stale-turn rejection.
  const source=fs.readFileSync('quick-online.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  w.CONTINUUM.QuickNetwork={fingerprint:()=>1};
  w.CONTINUUM.QuickRoom={...R,create:(...args)=>JSON.parse(JSON.stringify(R.create(...args))),reduce:(...args)=>JSON.parse(JSON.stringify(R.reduce(...args)))};
  const adapter=(uid,db)=>new Function('auth','db','doc','runTransaction','onSnapshot','serverTimestamp','window',source+'\nreturn connect;')({currentUser:{uid},authStateReady:async()=>{}},db,doc,runTransaction,onSnapshot,serverTimestamp,w);
  const rooms={};let failures=[];
  const h=await adapter('host',host)({name:'Ana',create:true,onChange:r=>rooms.h=r,onError:e=>failures.push(e)});
  const g=await adapter('guest',guest)({name:'Bea',code:h.code,onChange:r=>rooms.g=r,onError:e=>failures.push(e)});
  const wait=async predicate=>{for(let n=0;n<100&&!predicate();n++)await new Promise(r=>setTimeout(r,30));assert.ok(predicate());};
  await wait(()=>rooms.h?.members.length===2&&rooms.g?.members.length===2);
  await h.act({type:'start',rounds});await wait(()=>rooms.g?.phase==='turn');
  await assert.rejects(g.act({type:'bank'}));
  await h.act({type:'bank'});await wait(()=>rooms.g?.actor==='guest');
  g.close();
  const rejoined=await adapter('guest',guest)({name:'Bea',code:h.code,onChange:r=>rooms.rejoined=r,onError:e=>failures.push(e)});
  await wait(()=>rooms.rejoined?.actor==='guest');await rejoined.act({type:'bank'});await wait(()=>rooms.h?.phase==='finished');
  assert.deepEqual(failures,[]);h.close();rejoined.close();
  // La primera persona crea sala y cola en una transacción; la segunda ocupa la
  // última plaza y cierra la cola antes de que una tercera pueda unirse.
  const publicAdapter=(uid,db)=>new Function('auth','db','doc','getDoc','runTransaction','onSnapshot','serverTimestamp','window',source+'\nreturn connectPublic;')(
    {currentUser:{uid},authStateReady:async()=>{}},db,doc,getDoc,runTransaction,onSnapshot,serverTimestamp,w);
  const publicRooms={};
  const first=await publicAdapter('host',host)({name:'Ana',capacity:2,onChange:r=>publicRooms.host=r,onError:e=>failures.push(e)});
  const second=await publicAdapter('guest',guest)({name:'Bea',capacity:2,onChange:r=>publicRooms.guest=r,onError:e=>failures.push(e)});
  assert.equal(first.code,second.code);
  await wait(()=>publicRooms.host?.members.length===2 && publicRooms.guest?.members.length===2);
  const queue=await getDoc(doc(host,'quickPublicQueues','quick:2:v1:1'));
  assert.equal(queue.data().status,'full');
  await wait(()=>publicRooms.guest?.phase==='turn');
  assert.deepEqual(failures,[]);
  first.close();second.close();
  // Mesa abandonada: quien la abrió se fue y su cola lleva más de dos minutos sin
  // renovarse. La búsqueda no entra en ella: abre otra mesa y la cola apunta a la nueva.
  await env.clearFirestore();
  const viejo=new Date(Date.now()-5*60000);
  await env.withSecurityRulesDisabled(async c=>{
    const d=c.firestore();
    await setDoc(doc(d,'quickRooms','ZZZZZZZZZ2'),{...JSON.parse(JSON.stringify(R.create('fantasma','Nadie',2))),catalog:1,matchmaking:'public',updatedAt:viejo});
    await setDoc(doc(d,'quickPublicQueues','quick:2:v1:1'),{code:'ZZZZZZZZZ2',status:'waiting',capacity:2,updatedAt:viejo});
  });
  const nueva=await publicAdapter('guest',guest)({name:'Bea',capacity:2,onChange:()=>{},onError:e=>failures.push(e)});
  assert.notEqual(nueva.code,'ZZZZZZZZZ2','no entra en la mesa abandonada');
  assert.equal((await getDoc(doc(guest,'quickPublicQueues','quick:2:v1:1'))).data().code,nueva.code);
  // Solo quien abrió la mesa la mantiene viva en la búsqueda.
  await assertSucceeds(updateDoc(doc(guest,'quickPublicQueues','quick:2:v1:1'),{updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(out,'quickPublicQueues','quick:2:v1:1'),{updatedAt:serverTimestamp()}));
  // Una mesa viva no se puede sustituir.
  await assertFails(env.withSecurityRulesDisabled(async()=>{}).then(()=>setDoc(doc(out,'quickPublicQueues','quick:2:v1:1'),{code:'YYYYYYYYY2',status:'waiting',capacity:2,updatedAt:serverTimestamp()})));
  assert.deepEqual(failures,[]);
  nueva.close();
  console.log('Retos online: reglas de acceso, turnos, historial, sala real, sincronización y reconexión: OK');
} finally {await env.cleanup();}
