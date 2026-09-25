import { auth, db } from './firebase-client.js';
import { doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { publicQueueKey, isJoinablePublicRoom, makePublicRoomCode, normalizePublicCapacity } from './public-matchmaking.js';

const CT = window.CONTINUUM;
const CLIENT_VERSION = 42;
let busy = false;

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
    matchmaking:'public', capacity, clientVersion:CLIENT_VERSION,
    status:'lobby', phase:'lobby', version:1, handSize:4, turnSeconds:30,
    playerOrder:[uid],
    players:{[uid]:{name,avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
    deck:[],discard:[],timeline:[],current:0,starter:uid,turnsInRound:0,round:1,
    winner:null,winners:null,reveal:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  };
}

async function findOrCreate(mode, capacityInput) {
  const capacity=normalizePublicCapacity(capacityInput);
  const user=auth.currentUser;
  if(!user) throw Error('AUTH_NOT_READY');
  const queueKey=publicQueueKey({mode,capacity});
  const queueRef=doc(db,'publicQueues',queueKey);
  const fingerprint=CT.deckFingerprint(mode);
  return runTransaction(db,async tx=>{
    const qSnap=await tx.get(queueRef);
    if(qSnap.exists() && qSnap.data().status==='waiting'){
      const q=qSnap.data();
      const roomRef=doc(db,'rooms',q.roomCode);
      const roomSnap=await tx.get(roomRef);
      if(roomSnap.exists()){
        const room=roomSnap.data();
        if(room.playerOrder?.includes(user.uid)) return room.roomCode;
        if(isJoinablePublicRoom(room,{mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint})){
          const order=[...room.playerOrder,user.uid];
          tx.update(roomRef,{
            players:{...room.players,[user.uid]:{name:alias(),avatarId:avatarId(),hand:[],joinedAt:Date.now(),clientVersion:CLIENT_VERSION}},
            playerOrder:order,version:room.version+1,updatedAt:serverTimestamp()
          });
          if(order.length===capacity) tx.update(queueRef,{status:'full',updatedAt:serverTimestamp()});
          return room.roomCode;
        }
      }
    }
    // La cola no sirve: solo se reemplaza si no existe o ya estaba llena. Una cola waiting
    // que apunte a una sala caducada se deja fallar de forma segura y se reintenta después.
    if(qSnap.exists() && qSnap.data().status!=='full') throw Error('QUEUE_STALE');
    for(let attempt=0;attempt<4;attempt++){
      const code=makePublicRoomCode();
      const roomRef=doc(db,'rooms',code);
      if((await tx.get(roomRef)).exists()) continue;
      const room=roomData(code,mode,capacity,user.uid);
      tx.set(doc(db,'roomCreation',user.uid),{lastCreatedAt:serverTimestamp(),roomCode:code});
      tx.set(roomRef,room);
      tx.set(queueRef,{queueKey,roomCode:code,mode,capacity,clientVersion:CLIENT_VERSION,deckFingerprint:fingerprint,status:'waiting',updatedAt:serverTimestamp()});
      return code;
    }
    throw Error('ROOM_CODE_COLLISION');
  });
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
    if(key===CT.DEFAULT_MODE)continue;
    const option=document.createElement('option');option.value=key;option.textContent=m.name;select.append(option);
  }
  grid.prepend(panel);
}
new MutationObserver(inject).observe(document.getElementById('app'),{childList:true,subtree:true});
document.addEventListener('click',e=>{const b=e.target.closest('[data-public-match]');if(b)void startQuickMatch(Number(document.getElementById('public-match-capacity')?.value||4));});
inject();

export { findOrCreate };
