// Partida rápida con desconocidos: busca una mesa pública libre y entra en ella a través de Firestore.
import { auth, db } from '../nube/firebase-client.js';
import { doc, getDoc, runTransaction, serverTimestamp } from '../../vendor/firebase/firebase-firestore.js';
import { publicQueueKey, isJoinablePublicRoom, makePublicRoomCode, normalizePublicCapacity, queueFresh, CLIENT_VERSION } from './public-matchmaking.js';

const CT = window.CONTINUUM;

// El nombre que se ve en la mesa es el de este móvil (el de la bienvenida); el alias de
// la cuenta queda como respaldo.
const alias = () => (CT.Identidad?.propio?.() || 'Explorador').slice(0, 18);
const avatarId = () => CT.Avatares?.ownId?.() || null;

function roomData(code, mode, capacity, uid, seconds = 30, handSize = 4) {
  const name=alias();
  return {
    roomCode:code, mode, deckFingerprint:CT.deckFingerprint(mode), hostUid:uid,
    matchmaking:'public', capacity, clientVersion:CLIENT_VERSION, queueKey:publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:CT.deckFingerprint(mode)}),
    status:'lobby', phase:'lobby', version:1, handSize, turnSeconds:seconds,
    playerOrder:[uid],
    players:{[uid]:{name,avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
    deck:[],discard:[],timeline:[],current:0,starter:uid,turnsInRound:0,round:1,
    winner:null,winners:null,reveal:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  };
}

// Una mesa que espera jugadores renueva su cola cada 45 s mientras alguien sigue en ella
// (`keepPublicQueueAlive`, online.js). Una cola caducada (`queueFresh`, public-matchmaking.js)
// es de una mesa abandonada: no se entra y se abre una nueva en su lugar.

async function findOrCreate(mode, capacityInput, { allowStale = false } = {}) {
  const capacity=normalizePublicCapacity(capacityInput);
  const user=await readyUser();
  const fingerprint=CT.deckFingerprint(mode);
  const queueKey=publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint});
  const queueRef=doc(db,'publicQueues',queueKey);
  // La cola puede apuntar a una mesa que ya está jugando: esa no se puede leer (ahí están
  // las manos) y leerla dentro de la transacción haría fallar toda la búsqueda. Se mira
  // antes, fuera, y si no se puede leer se abre una mesa nueva en su lugar.
  const pre=await getDoc(queueRef);
  const preCode=pre.exists()?pre.data().roomCode:null;
  let preHidden=false;
  if(preCode){
    try{await getDoc(doc(db,'rooms',preCode));}
    catch(error){if(error?.code==='permission-denied')preHidden=true;else throw error;}
  }
  return runTransaction(db,async tx=>{
    const freshQueue=await tx.get(queueRef);
    const queuedCode=freshQueue.exists()?freshQueue.data().roomCode:null;
    const oldRef=queuedCode&&!(preHidden&&queuedCode===preCode)?doc(db,'rooms',queuedCode):null;
    const roomSnap=oldRef?await tx.get(oldRef):null;
    const oldRoom=roomSnap?.exists()?roomSnap.data():null;
    if(oldRoom?.playerOrder?.includes(user.uid)) return oldRoom.roomCode;
    if(freshQueue.exists() && freshQueue.data().status==='waiting' && (allowStale || queueFresh(freshQueue.data()))
        && isJoinablePublicRoom(oldRoom,{mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint})
        && !oldRoom.playerOrder.some(other=>CT.Bloqueos?.has(other))){
      const order=[...oldRoom.playerOrder,user.uid];
      tx.update(oldRef,{
        players:{...oldRoom.players,[user.uid]:{name:alias(),avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
        playerOrder:order,version:oldRoom.version+1,updatedAt:serverTimestamp()
      });
      if(order.length===capacity) tx.update(queueRef,{status:'full',updatedAt:serverTimestamp()});
      return oldRoom.roomCode;
    }
    const code=makePublicRoomCode(),roomRef=doc(db,'rooms',code);
    await CT.creationSlot?.();
    tx.set(roomRef,roomData(code,mode,capacity,user.uid));
    tx.set(doc(db,'creationQuota',user.uid),{lastCreatedAt:serverTimestamp(),kind:'publicRoom',target:code});
    tx.set(queueRef,{queueKey,roomCode:code,mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint,status:'waiting',updatedAt:serverTimestamp()});
    return code;
  }).catch(error=>{
    // Con las reglas anteriores no se puede sustituir una mesa abandonada: se entra en
    // ella como antes, y el relevo automático del anfitrión la pondrá en marcha.
    // También cubre que la mesa de la cola empezase justo entre la comprobación y la
    // transacción: al repetir, ya no se puede leer y se abre otra.
    if(!allowStale && error?.code==='permission-denied') return findOrCreate(mode,capacityInput,{allowStale:true});
    throw error;
  });
}

async function readyUser() {
  let user=auth.currentUser;
  if(!user || !CT.Accounts?.ready) {
    await auth.authStateReady?.();
    user=auth.currentUser;
  }
  if(!user || !CT.Accounts?.ready) throw Error('AUTH_NOT_READY');
  return user;
}

// «Crear mesa»: una mesa nueva con la configuración elegida (mazo, plazas y tiempo). No
// ocupa la cola de la partida rápida; se encuentra en el tablón de mesas abiertas.
async function createTable(mode, capacityInput, seconds, handSize = 4) {
  const capacity=normalizePublicCapacity(capacityInput);
  if(![0,15,20,30].includes(Number(seconds))) throw Error('INVALID_PUBLIC_SECONDS');
  if(![1,2,3,4,5,6].includes(Number(handSize))) throw Error('INVALID_PUBLIC_HAND');
  const user=await readyUser();
  const code=makePublicRoomCode(), roomRef=doc(db,'rooms',code);
  // Una sala que no existe no se puede leer con las reglas de las salas: se escribe sin
  // mirar antes (con siete caracteres al azar, repetir un código es improbable, y si
  // ocurriera las reglas lo tratarían como una modificación y la rechazarían).
  await CT.creationSlot?.();
  await runTransaction(db,async tx=>{
    tx.set(roomRef,roomData(code,mode,capacity,user.uid,Number(seconds),Number(handSize)));
    tx.set(doc(db,'creationQuota',user.uid),{lastCreatedAt:serverTimestamp(),kind:'publicRoom',target:code});
  });
  return code;
}

// Entrar en una mesa elegida en el tablón. Si con esta plaza se llena y la cola de la
// partida rápida apuntaba a ella, la cola se marca llena, como al entrar desde la búsqueda.
async function joinTable(code) {
  const user=await readyUser();
  const roomRef=doc(db,'rooms',code);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(roomRef);
    if(!snap.exists()) throw Error('TABLE_GONE');
    const room=snap.data();
    if(room.playerOrder?.includes(user.uid)) return room.mode;
    const queueRef=room.queueKey?doc(db,'publicQueues',room.queueKey):null;
    const queue=queueRef?await tx.get(queueRef):null;
    if(!isJoinablePublicRoom(room,{clientVersion:CLIENT_VERSION,deckFingerprint:CT.deckFingerprint(room.mode)})) throw Error('TABLE_FULL');
    const order=[...room.playerOrder,user.uid];
    tx.update(roomRef,{
      players:{...room.players,[user.uid]:{name:alias(),avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
      playerOrder:order,version:room.version+1,updatedAt:serverTimestamp()
    });
    if(order.length===room.capacity && queue?.exists() && queue.data().roomCode===code && queue.data().status==='waiting')
      tx.update(queueRef,{status:'full',updatedAt:serverTimestamp()});
    return room.mode;
  });
}

function capacityOrder(value) {
  const n=Number(value);
  if([2,3,4].includes(n)) return [n];
  return [4,3,2];
}

async function findFlexible(mode, capacityInput) {
  const capacities=capacityOrder(capacityInput);
  // “Cualquiera” comparte una única cola lógica por modalidad: intentamos las mesas
  // grandes primero, pero si no hay ninguna compatible creamos una de 4. No creamos
  // tres salas vacías a la vez, que fragmentaría justo la población que queremos juntar.
  if(capacities.length===1) return {code:await findOrCreate(mode,capacities[0]),capacity:capacities[0]};
  // Las colas de las tres capacidades se miran a la vez (antes, una detrás de otra).
  const waiting=await Promise.all(capacities.map(capacity=>queueWaiting(mode,capacity)));
  const at=waiting.indexOf(true);
  if(at>=0) return {code:await findOrCreate(mode,capacities[at]),capacity:capacities[at]};
  return {code:await findOrCreate(mode,4),capacity:4};
}
// ¿Hay en esta cola una mesa esperando y viva? Una lectura que falla cuenta como «no».
async function queueWaiting(mode,capacity){
  const key=publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:CT.deckFingerprint(mode)});
  try{const snap=await getDoc(doc(db,'publicQueues',key));return snap.exists() && snap.data().status==='waiting' && queueFresh(snap.data());}
  catch{return false;}
}

// Se baraja antes de buscar: sin mesa esperando, se abre la del primer mazo de la lista, y
// sin barajar ese era siempre Historia de España aunque la pantalla prometa «al azar».
async function findAcrossModes(modes, capacityInput) {
  const pool=CT.shuffle([...new Set(modes.filter(mode=>CT.MODES?.[mode] && mode!=='mixed'))]);
  if(!pool.length) throw Error('NO_PUBLIC_MODES');
  const capacities=capacityOrder(capacityInput);
  // Todas las colas (mazos × capacidades) se leen a la vez: antes eran ~87 lecturas en fila, de 5 a 13 s en un
  // móvil, y dos personas buscando a la vez solían acabar cada una en una mesa vacía de un mazo distinto.
  const pairs=capacities.flatMap(capacity=>pool.map(mode=>({mode,capacity})));
  const waiting=await Promise.all(pairs.map(({mode,capacity})=>queueWaiting(mode,capacity)));
  const found=pairs.find((_,i)=>waiting[i]);
  if(found) return {mode:found.mode,...await findFlexible(found.mode,found.capacity)};
  return {mode:pool[0],...await findFlexible(pool[0],capacities[0])};
}

// Quien dejó de esperar (se agotó el tiempo de búsqueda) pero acabó sentado igualmente, porque la búsqueda terminó
// tarde: se libera la plaza para que no quede una persona fantasma en la mesa. Si era la única, la mesa se cierra.
async function abandonSeat(code){
  const user=auth.currentUser;
  if(!user||!code) return;
  const ref=doc(db,'rooms',code);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()) return;
    const room=snap.data();
    if(room.status!=='lobby'||!room.playerOrder.includes(user.uid)) return;
    const playerOrder=room.playerOrder.filter(uid=>uid!==user.uid);
    if(!playerOrder.length){ if(room.hostUid===user.uid) tx.delete(ref); return; }
    const players={...room.players}; delete players[user.uid];
    tx.update(ref,{players,playerOrder,...(room.hostUid===user.uid?{hostUid:playerOrder[0]}:{}),version:room.version+1,updatedAt:serverTimestamp()});
  }).catch(error=>console.warn('PUBLIC_ABANDON',error?.code||error));
}

export { findOrCreate, findFlexible, findAcrossModes, createTable, joinTable, abandonSeat, CLIENT_VERSION };
