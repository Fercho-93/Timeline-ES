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
 const lobby=fixture();lobby.status='lobby';lobby.phase='lobby';delete lobby.ghost;lobby.timeline=[];lobby.deck=[];lobby.mode='animals';lobby.playerOrder=[A,B,C,'d','e','f','g','h','i'];lobby.players=Object.fromEntries(lobby.playerOrder.map(id=>[id,{name:id,hand:[],clientVersion:36} ]));await seed(lobby);
 await clients[0].call('renderLobby');clients[0].w.document.getElementById('online-hand-size').value='6';await clients[0].call('startRoom');
 s=await snapshot();assert.equal(s.handSize,4);assert.equal(s.timeline.length,1);assert.ok(Object.values(s.players).every(p=>p.hand.length===4));
 assert.equal(new Set([...s.timeline,...s.deck,...Object.values(s.players).flatMap(p=>p.hand)]).size,38);
 // Máximo de poderes y jugadores: también debe caber en el límite de reglas.
 const maximum=clone(s);maximum.ghost={cards:[s.players[A].hand[0],s.players[B].hand[0],s.players[C].hand[0]],owners:[A,B,C],used:[],pending:[],cooldown:[],actor:'',fresh:false};
 await seed(lobby);await updateDoc(ref(A),maximum);
 const stale=clone(lobby);stale.players[B].clientVersion=35;await seed(stale);await assertFails(updateDoc(ref(A),maximum));
 const three=fixture();three.phase='reveal';three.current=2;three.turnsInRound=2;Object.values(three.players).forEach(p=>p.hand=[]);three.reveal={cardId:12,correct:true,playerUid:C,playerName:'Carlos'};three.ghost.cards=[15,16,17];three.ghost.owners=['','',''];
 await seed(three);await clients[2].call('finishTurn');assert.deepEqual((await snapshot()).ghost.owners,[A,B,C]);
 console.log('  Inicio, activación, turnos, dos clientes, robos, Pulso, salidas y escrituras rechazadas: OK');
} finally {clients.forEach(c=>c.w.close());await env.cleanup();}
