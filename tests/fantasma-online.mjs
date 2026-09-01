// Ejecuta online.js real con dos clientes DOM y transacciones contra las reglas reales.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const env = await initializeTestEnvironment({projectId:'demo-ghost',firestore:{host:'127.0.0.1',port:8080,rules:read('firestore.rules')}});
const ROOM='GHOST123', A='ana', B='bea', C='carlos';
const db=uid=>env.authenticatedContext(uid).firestore();
const ref=uid=>doc(db(uid),'rooms',ROOM);
const snapshot=async()=> (await getDoc(ref(A))).data();
const seed=async data=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'rooms',ROOM),data));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){return {roomCode:ROOM,mode:'history',hostUid:A,status:'playing',phase:'turn',version:1,handSize:3,playerOrder:[A,B,C],players:{[A]:{name:'Ana',hand:[6,7,8],pulseUsed:false,shieldRound:0},[B]:{name:'Bea',hand:[9,10,11],pulseUsed:false,shieldRound:0},[C]:{name:'Carlos',hand:[12,13,14],pulseUsed:false,shieldRound:0}},deck:[15,16,17,18],discard:[],timeline:[1,2,3,4,5],current:0,starter:A,turnsInRound:0,round:1,winner:null,winners:null,reveal:null,createdAt:1,updatedAt:1,pulse:true,pulseTurn:null,ghost:{cards:[6,15],owners:[A,''],used:[],pending:[],cooldown:[],actor:'',fresh:false}};}
function client(uid){
 const html=read('index.html'),w=new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''),{runScripts:'outside-only',url:'https://continuum.test'}).window;
 w.structuredClone=structuredClone;
 for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))w.eval(read(m[1]));
 const errors=[];w.console.error=e=>errors.push(e);
 w.__sdk={initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>db(uid),doc,getDoc,runTransaction:(db,callback)=>runTransaction(db,tx=>callback({get:ref=>tx.get(ref),update:(ref,data)=>tx.update(ref,clone(data))})),serverTimestamp:()=>Date.now()};
 const src=read('online.js').replace(/^import .+;\n/gm,'').replace('export async function','async function');
 w.eval(`(()=>{const {initializeApp,getAuth,getFirestore,doc,getDoc,runTransaction,serverTimestamp}=window.__sdk;${src}\nwindow.onlineTest={set(data){roomState=data;user={uid:${JSON.stringify(uid)}};roomRef=doc(db,'rooms',${JSON.stringify(ROOM)});roomCode=${JSON.stringify(ROOM)};},choose(id){selectedCardId=id;},startRoom,useGhost,placeCard,finishTurn,skipTurn,removePlayer,startPulse,placePulse,renderGame,renderLobby};})();`);
 return {w,api:w.onlineTest,errors,async load(){this.api.set(await snapshot());},async call(name,...args){await this.load();await this.api[name](...args);assert.equal(errors.length,0,errors.map(String).join('\n'));}};
}
const clients=[client(A),client(B),client(C)];
try {
 console.log('\nFantasma: clientes online y reglas Firebase');
 await seed(fixture());
 await clients[0].call('useGhost');
 let s=await snapshot();assert.deepEqual(s.ghost.used,[A]);assert.equal(s.ghost.pending.length,3);
 for(const cl of clients){await cl.call('renderGame');assert.equal(cl.w.document.querySelectorAll('.ghost-card').length,5);}
 // No puede usar Pulso en el mismo turno ni prestar el poder a otro jugador.
 const blockedPulse={players:{...s.players,[A]:{...s.players[A],pulseUsed:true}},deck:s.deck.slice(1),phase:'pulse',pulseTurn:{targetUid:B,cardId:s.deck[0]},version:s.version+1,updatedAt:2};
 await assertFails(updateDoc(ref(A),blockedPulse));
 const forged=clone(s.ghost);forged.pending=[A,B,C,'intruso'];
 await assertFails(updateDoc(ref(A),{ghost:forged,version:s.version+1,updatedAt:2}));
 const ct=clients[0].w.CONTINUUM, cards=new Map(ct.cards('history').map(c=>[c.id,c]));
 async function play(cl, correct=true){await cl.load();const s=await snapshot(),id=s.players[s.playerOrder[s.current]].hand[0];cl.api.choose(id);const at=ct.correctIndex('history',s.timeline.map(id=>cards.get(id)),cards.get(id));await cl.api.placeCard(correct?at:at===0?s.timeline.length:0);assert.equal(cl.errors.length,0,cl.errors.map(String).join('\n'));}
 for(const cl of clients){await play(cl);await cl.call('renderGame');assert.ok(cl.w.document.querySelector('.modal .year'));assert.ok(cl.w.document.querySelector('.ghost-card'));await cl.call('finishTurn');}
 s=await snapshot();assert.deepEqual(s.ghost.pending,[]);assert.deepEqual(s.ghost.cooldown,[A,B,C]);
 const stolen=clone(s.ghost);stolen.used=[];stolen.pending=[A,B,C];stolen.cooldown=[];stolen.fresh=true;
 await assertFails(updateDoc(ref(B),{ghost:stolen,version:s.version+1,updatedAt:2}));
 await clients[0].call('skipTurn');await clients[0].call('skipTurn');await clients[0].call('skipTurn');
 assert.deepEqual((await snapshot()).ghost.cooldown,[]);
 // Robo que entrega el segundo poder; sin crear cartas ni sustituir la penalización.
 await seed(fixture());await clients[0].call('skipTurn');await play(clients[1],false);
 s=await snapshot();assert.equal(s.ghost.owners[1],B);assert.equal(s.players[B].hand.length,3);
 const cheating=clone(s.ghost);cheating.owners[0]=B;
 await assertFails(updateDoc(ref(B),{ghost:cheating,version:s.version+1,updatedAt:2}));
 // Un jugador que sale no retiene el efecto hasta un turno que nunca llegará.
 await seed(fixture());await clients[0].call('useGhost');await clients[0].call('removePlayer',B);
 s=await snapshot();assert.deepEqual(s.ghost.pending,[A,C]);
 await clients[0].call('skipTurn');await clients[0].call('skipTurn');
 s=await snapshot();assert.deepEqual(s.ghost.pending,[]);assert.deepEqual(s.ghost.cooldown,[A,C]);
 // Si sale el jugador de turno también se descuenta y se limpia fresh.
 await seed(fixture());await clients[0].call('useGhost');await clients[0].call('skipTurn');await clients[1].call('removePlayer',B);
 s=await snapshot();assert.deepEqual(s.ghost.pending,[C]);
 // Un Pulso durante Fantasma conserva el efecto y reclama poderes al sacar carta.
 await seed(fixture());await clients[0].call('useGhost');await clients[0].call('skipTurn');await clients[1].call('startPulse',C);
 s=await snapshot();assert.equal(s.ghost.owners[1],B);assert.equal(s.phase,'pulse');
 await clients[1].load();let at=ct.correctIndex('history',s.timeline.map(id=>cards.get(id)),cards.get(s.pulseTurn.cardId));await clients[1].api.placePulse(at);assert.equal(clients[1].errors.length,0,clients[1].errors.map(String).join('\n'));await clients[1].call('finishTurn');
 assert.deepEqual((await snapshot()).ghost.pending,[C]);
 // Cancelar un Pulso al saltar o salir devuelve la carta apartada al descarte.
 await seed(fixture());await clients[0].call('startPulse',B);await clients[0].call('skipTurn');
 s=await snapshot();assert.equal(s.pulseTurn,null);assert.ok(s.discard.includes(15));
 await seed(fixture());await clients[0].call('startPulse',B);await clients[1].call('removePlayer',B);
 s=await snapshot();assert.equal(s.pulseTurn,null);assert.ok(s.discard.includes(15));assert.equal(s.phase,'turn');
 // No se puede inyectar el poder en una sala anterior.
 const old=fixture();delete old.ghost;await seed(old);
 await assertFails(updateDoc(ref(A),{ghost:fixture().ghost,version:2,updatedAt:2}));
 // Ganar conservando el poder y desempatar con un robo que lo entrega.
 const winning=fixture();winning.phase='reveal';winning.turnsInRound=2;winning.players[A].hand=[];winning.reveal={cardId:6,correct:true,playerUid:A,playerName:'Ana'};
 await seed(winning);await clients[0].call('finishTurn');assert.equal((await snapshot()).winner,A);
 const tie=fixture();tie.phase='reveal';tie.current=2;tie.turnsInRound=2;tie.players[A].hand=[];tie.players[B].hand=[];tie.reveal={cardId:12,correct:true,playerUid:C,playerName:'Carlos'};
 await seed(tie);await clients[2].call('finishTurn');s=await snapshot();assert.equal(s.ghost.owners[1],A);assert.equal(s.players[A].hand.length,1);assert.equal(s.players[B].hand.length,1);
 // Una salida ajena no cierra ni repite un resultado ya resuelto.
 await seed(fixture());await clients[0].call('useGhost');await play(clients[0]);await clients[0].call('removePlayer',B);
 s=await snapshot();assert.equal(s.phase,'reveal');await clients[0].call('finishTurn');assert.deepEqual((await snapshot()).ghost.pending,[C]);
 // No se inicia Fantasma si un cliente anterior todavía podría enseñar valores.
 const outdated=fixture();outdated.status='lobby';outdated.phase='lobby';delete outdated.ghost;outdated.timeline=[];outdated.deck=[];Object.values(outdated.players).forEach(p=>p.hand=[]);await seed(outdated);
 await clients[0].call('renderLobby');await clients[0].api.startRoom();assert.match(String(clients[0].errors.pop()),/UPDATE_CLIENTS/);assert.equal((await snapshot()).status,'lobby');
 // Arranque real, nueve personas y mazo pequeño: reparto igual y una carta reservada.
 const lobby=fixture();lobby.status='lobby';lobby.phase='lobby';delete lobby.ghost;lobby.timeline=[];lobby.deck=[];lobby.mode='animals';lobby.playerOrder=[A,B,C,'d','e','f','g','h','i'];lobby.players=Object.fromEntries(lobby.playerOrder.map(id=>[id,{name:id,hand:[],clientVersion:38} ]));await seed(lobby);
 await clients[0].call('renderLobby');clients[0].w.document.getElementById('online-hand-size').value='6';await clients[0].call('startRoom');
 s=await snapshot();assert.equal(s.handSize,4);assert.equal(s.timeline.length,1);assert.ok(Object.values(s.players).every(p=>p.hand.length===4));
 assert.equal(new Set([...s.timeline,...s.deck,...Object.values(s.players).flatMap(p=>p.hand)]).size,38);
 assert.equal(s.ghost.distribution,2);assert.equal(s.ghost.cards.length,3);
 // Pulso usa el mismo reparto, sin compartir posiciones con Fantasma.
 await seed(lobby);await clients[0].call('renderLobby');clients[0].w.document.getElementById('online-pulse').checked=true;await clients[0].call('startRoom');
 s=await snapshot();assert.equal(s.pulsePower.cards.length,3);assert.equal(s.pulsePower.used.length,0);
 assert.equal(s.pulsePower.cards.filter(id=>s.ghost.cards.includes(id)).length,0);
 assert.equal(new Set([...s.pulsePower.cards,...s.ghost.cards]).size,6);
 // Pulso también bloquea el arranque normal si queda un cliente v37 en la mesa.
 const pulsePrevious=clone(lobby);pulsePrevious.players[B].clientVersion=37;await seed(pulsePrevious);
 await clients[0].call('renderLobby');clients[0].w.document.getElementById('online-pulse').checked=true;
 await clients[0].api.startRoom();assert.match(String(clients[0].errors.pop()),/UPDATE_CLIENTS/);assert.equal((await snapshot()).status,'lobby');
 const three=fixture();three.phase='reveal';three.current=2;three.turnsInRound=2;Object.values(three.players).forEach(p=>p.hand=[]);three.reveal={cardId:12,correct:true,playerUid:C,playerName:'Carlos'};three.ghost.cards=[15,16,17];three.ghost.owners=['','',''];
 await seed(three);await clients[2].call('finishTurn');assert.deepEqual((await snapshot()).ghost.owners,[A,B,C]);
 const modernThree=clone(three);modernThree.ghost.distribution=2;
 await seed(modernThree);await clients[2].call('finishTurn');assert.deepEqual((await snapshot()).ghost.owners,[A,B,C]);
 // Reparto v37: recolocar solo después de un robo real de un poder duplicado.
 const balanced=fixture();balanced.ghost.distribution=2;
 await seed(balanced);await play(clients[0],false);s=await snapshot();
 assert.equal(s.players[A].hand.length,3);assert.equal(s.ghost.owners[1],'');assert.ok(s.deck.includes(s.ghost.cards[1]));
 for(const [i,cl] of clients.entries()){
  await cl.call('renderGame');assert.equal(cl.w.document.querySelectorAll('.hand-card').length,s.players[[A,B,C][i]].hand.length);
  assert.deepEqual([...cl.w.document.querySelectorAll('.scoreboard em')].map(el=>Number(el.textContent)),[3,3,3],'los contadores públicos no incluyen poderes');
 }
 await clients[0].call('finishTurn');
 await clients[0].call('renderGame');assert.ok(clients[0].w.document.querySelector('.ghost-power'));
 await clients[1].call('renderGame');assert.equal(clients[1].w.document.querySelector('.ghost-power'),null,'el rival no ve el poder ajeno');
 await seed(balanced);const switched=clone(balanced.ghost);switched.cards[1]=18;
 await assertFails(updateDoc(ref(A),{ghost:switched,version:2,updatedAt:2}));
 const early=clone(balanced.ghost);early.owners[1]=B;
 await assertFails(updateDoc(ref(A),{ghost:early,version:2,updatedAt:2}));
 // Ni una jugada correcta permite cambiar posiciones ni quitar la versión.
 await seed(balanced);await play(clients[0]);const correct=await snapshot();await seed(balanced);
 const moved=clone(correct);moved.ghost.cards[1]=18;await assertFails(updateDoc(ref(A),moved));
 const downgrade=clone(correct);delete downgrade.ghost.distribution;await assertFails(updateDoc(ref(A),downgrade));
 // Tampoco se recoloca el primer poder de una persona que aún no tiene otro.
 const unowned=clone(balanced);unowned.ghost.owners[0]='';await seed(unowned);await play(clients[0],false);const claimed=await snapshot();await seed(unowned);
 claimed.ghost.owners[1]='';claimed.ghost.cards[1]=18;await assertFails(updateDoc(ref(A),claimed));
 // Pulso roba sin cambiar el contador, y también recoloca duplicados.
 await seed(balanced);await clients[0].call('startPulse',B);s=await snapshot();
 assert.equal(s.players[A].hand.length,3);assert.equal(s.ghost.owners[1],'');assert.ok(s.deck.includes(s.ghost.cards[1]));
 // Dos robos en una transacción: el duplicado puede llegar a otra persona.
 const retie=clone(tie);retie.ghost.distribution=2;await seed(retie);
 const savedRandom=clients[2].w.Math.random;clients[2].w.Math.random=()=>0;
 await clients[2].call('finishTurn');clients[2].w.Math.random=savedRandom;s=await snapshot();
 assert.equal(s.ghost.cards[1],16);assert.equal(s.ghost.owners[1],B);
 // Sin sitio se consume, sin conceder otro uso ni volver al reciclar descartes.
 const exhausted=clone(balanced);exhausted.deck=[15];exhausted.ghost.used=[A];await seed(exhausted);await play(clients[0],false);s=await snapshot();
 assert.deepEqual(s.ghost.owners,[A,A]);assert.deepEqual(s.ghost.used,[A]);
 assert.equal(clients[0].w.CONTINUUM.Ghost.owns(s.ghost,A),false);
 // Pulso robable: solo su dueño lo ve, se consume al lanzarlo y no cuenta en la mano.
 const pulseOwned=fixture();pulseOwned.ghost.distribution=2;pulseOwned.pulsePower={distribution:2,cards:[7,16],owners:[A,''],used:[]};
 await seed(pulseOwned);
 await clients[0].call('renderGame');assert.ok(clients[0].w.document.querySelector('.pulse-power'));
 assert.equal(clients[0].w.document.querySelectorAll('.hand-card').length,3);
 await clients[1].call('renderGame');assert.equal(clients[1].w.document.querySelector('.pulse-power'),null);
 await clients[0].call('startPulse',B);s=await snapshot();assert.deepEqual(s.pulsePower.used,[A]);assert.equal(s.players[A].hand.length,3);
 assert.equal(s.phase,'pulse');assert.equal(s.pulsePower.owners[1],'');
 const forgedPulse=clone(s);forgedPulse.pulsePower.used=[A,B];forgedPulse.version++;
 await assertFails(updateDoc(ref(B),forgedPulse));
 // Recibir un Pulso en un robo normal no sustituye la penalización.
 const pulseDraw=fixture();pulseDraw.ghost={...pulseDraw.ghost,distribution:2,cards:[6,17]};pulseDraw.pulsePower={distribution:2,cards:[15],owners:[''],used:[]};
 await seed(pulseDraw);await play(clients[0],false);s=await snapshot();assert.equal(s.pulsePower.owners[0],A);assert.equal(s.players[A].hand.length,3);
 console.log('  Inicio, activación, turnos, dos clientes, robos, Pulso, salidas y escrituras rechazadas: OK');
} finally {clients.forEach(c=>c.w.close());await env.cleanup();}
