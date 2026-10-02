import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {collection,getDocs,query,where,doc,getDoc,setDoc,updateDoc,serverTimestamp,runTransaction,onSnapshot} from 'firebase/firestore';
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
  const adapter=(uid,db)=>new Function('auth','db','collection','getDocs','query','where','getDoc','doc','runTransaction','onSnapshot','serverTimestamp','window',source+'\nreturn connect;')({currentUser:{uid},authStateReady:async()=>{}},db,collection,getDocs,query,where,getDoc,doc,runTransaction,onSnapshot,serverTimestamp,w);
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
  // Duelo por turnos «sigue hasta el final»: la configuración lleva `keep` y plantarse deja de ser una acción válida.
  const hk=await adapter('host',host)({name:'Ana',create:true,onChange:r=>rooms.hk=r,onError:e=>failures.push(e)});
  const gk=await adapter('guest',guest)({name:'Bea',code:hk.code,onChange:r=>rooms.gk=r,onError:e=>failures.push(e)});
  await wait(()=>rooms.hk?.members.length===2&&rooms.gk?.members.length===2);
  await hk.act({type:'start',rounds,keep:true});await wait(()=>rooms.gk?.phase==='turn');
  assert.equal(rooms.gk.config.keep,true);
  await assert.rejects(hk.act({type:'bank'}));
  assert.deepEqual(failures,[]);hk.close();gk.close();
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
  // Dejar una mesa pública antes de empezar: se libera la plaza y, si se va quien la
  // llevaba, la lleva quien queda primero.
  await env.clearFirestore();
  let mesa=R.create('host','Ana',4);mesa.matchmaking='public';
  mesa=R.reduce(mesa,'guest',{type:'join',name:'Bea'});
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'quickRooms','ABCDEFGH23'),{...JSON.parse(JSON.stringify(mesa)),catalog:1,updatedAt:new Date()}));
  const sinAna=R.reduce(mesa,'host',{type:'leave'});
  assert.equal(sinAna.host,'guest');
  await assertFails(write(guest,{...sinAna,host:'host'}));
  await assertSucceeds(write(host,sinAna));
  // Duelo por turnos: quien lo crea empieza sin esperar y el amigo entra a mitad de partida.
  await env.clearFirestore();
  const duelRounds=Array.from({length:3},()=>({id:'poker',order:E.challenge('poker').cards.map(c=>c.id)}));
  let du=R.create('host','Ana',2);
  await assertSucceeds(write(host,du));
  du=R.reduce(du,'host',{type:'start',rounds:duelRounds,kind:'duel',keep:true,first:0});
  await assertFails(write(guest,du));
  await assertSucceeds(write(host,du));
  du=R.reduce(du,'host',{type:'place',cardId:'poker-2',index:1});await assertSucceeds(write(host,du));
  du=R.reduce(du,'host',{type:'ack'});await assertSucceeds(write(host,du));
  assert.equal(du.actor,'host');
  await assertSucceeds(getDoc(ref(guest)));
  const entra=R.reduce(du,'guest',{type:'join',name:'Bea'});
  await assertFails(write(guest,{...entra,names:['Impostor','Bea']}));
  await assertFails(write(guest,{...entra,commands:[]}));
  await assertSucceeds(write(guest,entra));du=entra;
  assert.equal(du.actor,'guest');
  await assertFails(write(out,R.reduce(R.reduce(du,'guest',{type:'place',cardId:'poker-3',index:0}),'guest',{type:'ack'})));
  du=R.reduce(du,'guest',{type:'place',cardId:'poker-3',index:0});await assertSucceeds(write(guest,du));
  // Una sala de dos que ya es de dos no admite a un tercero ni deja leer a quien no está.
  await assertFails(getDoc(ref(out)));
  // La lista de duelos de tu cuenta: solo se consultan las salas en las que estás.
  await assertSucceeds(getDocs(query(collection(guest,'quickRooms'),where('members','array-contains','guest'))));
  await assertFails(getDocs(query(collection(out,'quickRooms'),where('members','array-contains','guest'))));
  await assertFails(getDocs(collection(guest,'quickRooms')));
  const minePeek=new Function('auth','db','collection','getDocs','query','where','getDoc','doc','runTransaction','onSnapshot','serverTimestamp','window',source+'\nreturn mine;')({currentUser:{uid:'guest'},authStateReady:async()=>{}},guest,collection,getDocs,query,where,getDoc,doc,runTransaction,onSnapshot,serverTimestamp,w);
  const mias=await minePeek();assert.equal(mias.length,1);assert.equal(mias[0].code,'ABCDEFGH23');assert.equal(mias[0].room.members.includes('guest'),true);
  // Archivar un duelo terminado de Retos rápidos va con la cuenta, como en las colecciones.
  {
    let fin=R.reduce(R.reduce(R.create('host','Ana',2),'host',{type:'start',rounds:duelRounds,kind:'duel',keep:true}),'guest',{type:'join',name:'Bea'});
    const ongoing=fin;
    for(let g=0;g<600&&fin.phase!=='finished';g++){if(fin.phase==='round-end'){fin=R.reduce(fin,fin.host,{type:'next'});continue;}const st=R.state(fin),id=fin.members[st.current];fin=R.reduce(fin,id,st.phase==='result'?{type:'ack'}:{type:'place',cardId:st.remaining[0],index:st.timeline.length});}
    assert.equal(fin.phase,'finished');
    await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
      await setDoc(doc(d,'quickRooms','FINISHEDX2'),{...JSON.parse(JSON.stringify(fin)),catalog:1,updatedAt:new Date()});
      await setDoc(doc(d,'quickRooms','ONGOINGXX2'),{...JSON.parse(JSON.stringify(ongoing)),catalog:1,updatedAt:new Date()});});
    const arch=(db,uid,code)=>setDoc(doc(db,'duelPreferences',uid,'archived',code),{updatedAt:serverTimestamp()});
    await assertSucceeds(arch(guest,'guest','FINISHEDX2'));
    await assertFails(arch(guest,'guest','ONGOINGXX2'));
    await assertFails(arch(out,'outsider','FINISHEDX2'));
    await assertFails(arch(out,'guest','FINISHEDX2'));
    await assertSucceeds(getDocs(collection(guest,'duelPreferences','guest','archived')));
  }
  console.log('Retos online: reglas de acceso, turnos, historial, sala real, sincronización y reconexión: OK');
} finally {await env.cleanup();}
