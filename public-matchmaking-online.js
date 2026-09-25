import { auth, db } from './firebase-client.js';
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { publicQueueKey, isJoinablePublicRoom, makePublicRoomCode, normalizePublicCapacity } from './public-matchmaking.js';

const CT = window.CONTINUUM;
const CLIENT_VERSION = 42;
let busy = false;
let watchedCode = '';

const alias = () => (CT.Accounts?.profile?.alias || 'Explorador').slice(0, 18);
const avatarId = () => CT.Avatares?.ownId?.() || null;
const notify = text => {
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;toast.classList.add('show');
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600);
};

function roomData(code, mode, capacity, uid) {
  const name=alias();
  return {
    roomCode:code, mode, deckFingerprint:CT.deckFingerprint(mode), hostUid:uid,
    matchmaking:'public', capacity, clientVersion:CLIENT_VERSION, queueKey:publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:CT.deckFingerprint(mode)}),
    status:'lobby', phase:'lobby', version:1, handSize:4, turnSeconds:30,
    playerOrder:[uid],
    players:{[uid]:{name,avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
    deck:[],discard:[],timeline:[],current:0,starter:uid,turnsInRound:0,round:1,
    winner:null,winners:null,reveal:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  };
}

async function findOrCreate(mode, capacityInput) {
  const capacity=normalizePublicCapacity(capacityInput);
  let user=auth.currentUser;
  if(!user || !CT.Accounts?.ready) {
    await auth.authStateReady?.();
    user=auth.currentUser;
  }
  if(!user || !CT.Accounts?.ready) throw Error('AUTH_NOT_READY');
  const fingerprint=CT.deckFingerprint(mode);
  const queueKey=publicQueueKey({mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint});
  const queueRef=doc(db,'publicQueues',queueKey);
  const qSnap=await getDoc(queueRef);
  if(qSnap.exists() && qSnap.data().status==='waiting'){
    const existing=await runTransaction(db,async tx=>{
      const freshQueue=await tx.get(queueRef);
      if(!freshQueue.exists() || freshQueue.data().status!=='waiting') return null;
      const q=freshQueue.data(), roomRef=doc(db,'rooms',q.roomCode);
      const roomSnap=await tx.get(roomRef);
      if(!roomSnap.exists()) return null;
      const room=roomSnap.data();
      if(room.playerOrder?.includes(user.uid)) return room.roomCode;
      if(!isJoinablePublicRoom(room,{mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint})) return null;
      const order=[...room.playerOrder,user.uid];
      tx.update(roomRef,{
        players:{...room.players,[user.uid]:{name:alias(),avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
        playerOrder:order,version:room.version+1,updatedAt:serverTimestamp()
      });
      if(order.length===capacity) tx.update(queueRef,{status:'full',updatedAt:serverTimestamp()});
      return room.roomCode;
    });
    if(existing) return existing;
  }
  // La creación usa un batch, no una transacción con lecturas después de escrituras.
  // Firestore rechaza ese patrón en producción aunque el emulador de reglas valide los datos.
  const code=makePublicRoomCode();
  const roomRef=doc(db,'rooms',code);
  const room=roomData(code,mode,capacity,user.uid);
  const batch=writeBatch(db);
  batch.set(roomRef,room);
  batch.set(queueRef,{queueKey,roomCode:code,mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint,status:'waiting',updatedAt:serverTimestamp()});
  await batch.commit();
  return code;
}

function watchPublicRoom(code) {
  if(!code || watchedCode===code) return;
  watchedCode=code;
  const reference=doc(db,'rooms',code);
  let started=false;
  const stop=onSnapshot(reference,snap=>{
    if(!snap.exists()){watchedCode='';stop();return;}
    const room=snap.data();
    if(room.matchmaking!=='public'){watchedCode='';stop();return;}
    const full=room.status==='lobby' && room.playerOrder?.length===room.capacity;
    const panel=document.querySelector('[data-public-waiting]');
    if(panel) panel.textContent=full?'Mesa completa. Preparando partida…':`Esperando jugadores · ${room.playerOrder?.length||0}/${room.capacity}`;
    if(full && room.hostUid===auth.currentUser?.uid && !started){
      started=true;
      // online.js conserva la autoridad de reparto. El anfitrión técnico pulsa el mismo
      // arranque que una sala privada, pero las reglas impiden hacerlo antes del cupo.
      setTimeout(()=>document.querySelector('[data-online-action="start"]')?.click(),350);
    }
    if(room.status!=='lobby'){watchedCode='';stop();}
  },()=>{});
  return stop;
}

async function startQuickMatch(capacity) {
  if(busy)return;
  busy=true;
  const button=document.querySelector('[data-public-match]');
  if(button){button.disabled=true;button.textContent='Buscando mesa…';}
  try{
    const mode=document.getElementById('public-match-mode')?.value || 'history';
    const code=await findOrCreate(mode,capacity);
    CT.Storage.setItem('continuum-last-room',code);
    const online=await import('./online.js');
    await online.openOnlineMode({roomCode:code,modeKey:mode});
    watchPublicRoom(code);
    setTimeout(()=>{
      const shell=document.querySelector('.online-shell');
      if(shell && !shell.querySelector('[data-public-waiting]')){
        const note=document.createElement('p');note.className='online-note';note.dataset.publicWaiting='';
        note.textContent='Esperando jugadores…';shell.querySelector('.lobby-head')?.after(note);
      }
    },250);
  }catch(error){
    console.error(error);
    const msg=error.message==='QUEUE_STALE'?'La mesa anterior está cerrándose. Inténtalo de nuevo en unos segundos.'
      : error.message==='AUTH_NOT_READY'?'Espera a que termine de cargar tu perfil.'
      :'No se pudo encontrar una mesa. Vuelve a intentarlo.';
    notify(msg);
  }finally{busy=false;if(button){button.disabled=false;button.textContent='Buscar partida';}}
}

function inject() {
  const entry=document.querySelector('[data-screen="online-entry"], .online-shell');
  if(!entry || !document.querySelector('[data-online-form="create"]') || document.querySelector('[data-public-match-panel]'))return;
  const grid=entry.querySelector('.online-entry-grid');
  if(!grid)return;
  const panel=document.createElement('section');
  panel.className='panel online-form';
  panel.dataset.publicMatchPanel='';
  panel.innerHTML=`<span class="form-number">⚡</span><h3>Partida rápida</h3><p>Encuentra automáticamente una mesa pública y juega con otras personas.</p>
    <div class="field"><label for="public-match-mode">Colección</label><select id="public-match-mode">
      <option value="${CT.DEFAULT_MODE}">${CT.escapeHtml(CT.mode(CT.DEFAULT_MODE).name)}</option>
    </select></div>
    <div class="field"><label for="public-match-capacity">Jugadores</label><select id="public-match-capacity"><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4" selected>4 jugadores</option></select></div>
    <button class="btn btn-primary btn-block" type="button" data-public-match>Buscar partida</button>
    <small class="hint">La partida empieza cuando se complete la mesa.</small>`;
  // La modalidad abierta se añade como primera opción si no es la predeterminada.
  const current=entry.querySelector('.online-intro .eyebrow')?.textContent?.trim();
  const select=panel.querySelector('#public-match-mode');
  for(const [key,m] of Object.entries(CT.MODES||{})){
    if(key===CT.DEFAULT_MODE || (CT.Cartera?.tiene && !CT.Cartera.tiene(key)))continue;
    const option=document.createElement('option');option.value=key;option.textContent=m.name;select.append(option);
  }
  const currentKey=Object.entries(CT.MODES||{}).find(([,m])=>current?.includes(m.name))?.[0];
  if(currentKey && [...select.options].some(o=>o.value===currentKey)) select.value=currentKey;
  grid.prepend(panel);
}
function refresh() {
  inject();
  if(document.getElementById('app')?.dataset?.screen==='online-lobby'){
    const code=CT.Storage.getItem('continuum-last-room');
    if(code) watchPublicRoom(code);
  }
}
new MutationObserver(refresh).observe(document.getElementById('app'),{childList:true,subtree:true});
document.addEventListener('click',e=>{const b=e.target.closest('[data-public-match]');if(b)void startQuickMatch(Number(document.getElementById('public-match-capacity')?.value||4));});
refresh();

export { findOrCreate, watchPublicRoom };
