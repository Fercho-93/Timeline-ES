import { auth, db } from './firebase-client.js';
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { publicQueueKey, isJoinablePublicRoom, makePublicRoomCode, normalizePublicCapacity } from './public-matchmaking.js';

const CT = window.CONTINUUM;
const CLIENT_VERSION = 42;
let busy = false;
let watchedCode = '';

// El nombre que se ve en la mesa es el de este móvil (el de la bienvenida); el alias de
// la cuenta queda como respaldo.
const alias = () => (CT.Identidad?.propio?.() || 'Explorador').slice(0, 18);
const avatarId = () => CT.Avatares?.ownId?.() || null;
const notify = text => {
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;toast.classList.add('show');
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600);
};

function roomData(code, mode, capacity, uid, seconds = 30) {
  const name=alias();
  return {
    roomCode:code, mode, deckFingerprint:CT.deckFingerprint(mode), hostUid:uid,
    matchmaking:'public', capacity, clientVersion:CLIENT_VERSION, queueKey:publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:CT.deckFingerprint(mode)}),
    status:'lobby', phase:'lobby', version:1, handSize:4, turnSeconds:seconds,
    playerOrder:[uid],
    players:{[uid]:{name,avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
    deck:[],discard:[],timeline:[],current:0,starter:uid,turnsInRound:0,round:1,
    winner:null,winners:null,reveal:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  };
}

// Una mesa que espera jugadores renueva su cola cada 45 s mientras alguien sigue en ella
// (online.js). Si la cola lleva más de dos minutos sin renovarse, la mesa está abandonada
// y no se entra: se abre una nueva en su lugar.
const STALE_QUEUE_MS = 120000;
const queueFresh = queue => {
  const at = queue?.updatedAt?.toMillis?.();
  return Number.isFinite(at) && Date.now() - at < STALE_QUEUE_MS;
};

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
        && isJoinablePublicRoom(oldRoom,{mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint})){
      const order=[...oldRoom.playerOrder,user.uid];
      tx.update(oldRef,{
        players:{...oldRoom.players,[user.uid]:{name:alias(),avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
        playerOrder:order,version:oldRoom.version+1,updatedAt:serverTimestamp()
      });
      if(order.length===capacity) tx.update(queueRef,{status:'full',updatedAt:serverTimestamp()});
      return oldRoom.roomCode;
    }
    const code=makePublicRoomCode(),roomRef=doc(db,'rooms',code);
    tx.set(roomRef,roomData(code,mode,capacity,user.uid));
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

function watchPublicRoom(code) {
  if(!code || watchedCode===code) return;
  watchedCode=code;
  const reference=doc(db,'rooms',code);
  const stop=onSnapshot(reference,snap=>{
    if(!snap.exists()){watchedCode='';stop();return;}
    const room=snap.data();
    if(room.matchmaking!=='public'){watchedCode='';stop();return;}
    const full=room.status==='lobby' && room.playerOrder?.length===room.capacity;
    const panel=document.querySelector('[data-public-waiting]');
    if(panel) panel.textContent=full?'Mesa completa. Preparando partida…':`Esperando jugadores · ${room.playerOrder?.length||0}/${room.capacity}`;
    // El arranque ya no se dispara desde aquí: online.js juega primero el minijuego de
    // quién empieza con la mesa completa y reparte al terminarlo (o al agotarse el plazo).
    if(room.status!=='lobby'){watchedCode='';stop();}
  },()=>{});
  return stop;
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
async function createTable(mode, capacityInput, seconds) {
  const capacity=normalizePublicCapacity(capacityInput);
  if(![0,15,20,30].includes(Number(seconds))) throw Error('INVALID_PUBLIC_SECONDS');
  const user=await readyUser();
  const code=makePublicRoomCode(), roomRef=doc(db,'rooms',code);
  // Una sala que no existe no se puede leer con las reglas de las salas: se escribe sin
  // mirar antes (con siete caracteres al azar, repetir un código es improbable, y si
  // ocurriera las reglas lo tratarían como una modificación y la rechazarían).
  await setDoc(roomRef,roomData(code,mode,capacity,user.uid,Number(seconds)));
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
  for(const capacity of capacities){
    const fingerprint=CT.deckFingerprint(mode);
    const key=publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint});
    const snap=await getDoc(doc(db,'publicQueues',key));
    if(snap.exists() && snap.data().status==='waiting' && queueFresh(snap.data())) return {code:await findOrCreate(mode,capacity),capacity};
  }
  return {code:await findOrCreate(mode,4),capacity:4};
}

async function findAcrossModes(modes, capacityInput) {
  const pool=[...new Set(modes.filter(mode=>CT.MODES?.[mode] && mode!=='mixed'))];
  if(!pool.length) throw Error('NO_PUBLIC_MODES');
  const capacities=capacityOrder(capacityInput);
  for(const capacity of capacities){
    for(const mode of pool){
      const key=publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:CT.deckFingerprint(mode)});
      const snap=await getDoc(doc(db,'publicQueues',key));
      if(snap.exists() && snap.data().status==='waiting' && queueFresh(snap.data())) return {mode,...await findFlexible(mode,capacity)};
    }
  }
  return {mode:pool[0],...await findFlexible(pool[0],capacities[0])};
}

function refresh() {
  if(document.getElementById('app')?.dataset?.screen==='online-lobby'){
    const code=CT.Storage.getItem('continuum-last-room');
    if(code) watchPublicRoom(code);
  }
}
new MutationObserver(refresh).observe(document.getElementById('app'),{childList:true,subtree:true});
refresh();

export { findOrCreate, findFlexible, findAcrossModes, watchPublicRoom, createTable, joinTable, CLIENT_VERSION };
