import {auth, db} from './firebase-client.js';
import {collection, doc, getDoc, getDocs, query, where, runTransaction, onSnapshot, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
const CT=window.CONTINUUM, R=CT.QuickRoom;
const PUBLIC_VERSION=1;
function publicKey(capacity){return 'quick:'+capacity+':v'+PUBLIC_VERSION+':'+CT.QuickNetwork.fingerprint();}
// Solo quien abre una mesa pública puede empezarla, así que la mesa vive mientras esa
// persona siga esperando: su móvil renueva la cola cada 45 s. Una cola sin renovar en dos
// minutos es una mesa abandonada: la búsqueda no entra y abre otra en su lugar.
const STALE_QUEUE_MS=120000, PUBLIC_WAIT_MS=30000;
const queueFresh=q=>{const at=q?.updatedAt?.toMillis?.();return Number.isFinite(at)&&Date.now()-at<STALE_QUEUE_MS;};
async function publicConnect(options) {
  const {name,capacity=4,onChange,onError,allowStale=false}=options;
  await auth.authStateReady(); const uid=auth.currentUser?.uid;
  if(!uid)throw Error('Espera a que se prepare tu perfil e inténtalo de nuevo.');
  const capacities=[2,3,4].includes(Number(capacity))?[Number(capacity)]:[4,3,2];
  let chosen=null;
  for(const cap of capacities){
    const key=publicKey(cap), qref=doc(db,'quickPublicQueues',key), qs=await getDoc(qref);
    if(qs.exists()&&qs.data().status==='waiting'&&(allowStale||queueFresh(qs.data()))){chosen={cap,key};break;}
  }
  if(!chosen){const cap=capacities[0];chosen={cap,key:publicKey(cap)};}
  const qref=doc(db,'quickPublicQueues',chosen.key);
  // Una mesa que ya ha empezado no la puede leer quien no está en ella, y leerla dentro de
  // la transacción haría fallar la búsqueda: se comprueba antes y, si es así, se abre otra.
  const pre=await getDoc(qref);
  const preCode=pre.exists()?pre.data().code:null;
  let preHidden=false;
  if(preCode){try{await getDoc(doc(db,'quickRooms',preCode));}catch(error){if(error?.code==='permission-denied')preHidden=true;else throw error;}}
  const code=await runTransaction(db,async tx=>{
    const queue=await tx.get(qref);
    const current=queue.exists()&&queue.data().status==='waiting'&&(allowStale||queueFresh(queue.data()))&&!(preHidden&&queue.data().code===preCode)
      ? doc(db,'quickRooms',queue.data().code) : null;
    const snap=current?await tx.get(current):null;
    const room=snap?.exists()?snap.data():null;
    if(room && room.catalog===CT.QuickNetwork.fingerprint() && room.matchmaking==='public'
        && room.capacity===chosen.cap && room.phase==='lobby' && room.members.length<chosen.cap){
      if(!room.members.includes(uid)){
        const next=R.reduce(room,uid,{type:'join',name});
        tx.update(current,{...next,updatedAt:serverTimestamp()});
        if(next.members.length===chosen.cap)tx.update(qref,{status:'full',updatedAt:serverTimestamp()});
      }
      return queue.data().code;
    }
    const fresh=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');
    const ref=doc(db,'quickRooms',fresh);
    tx.set(ref,{...R.create(uid,name,chosen.cap),catalog:CT.QuickNetwork.fingerprint(),matchmaking:'public',updatedAt:serverTimestamp()});
    tx.set(qref,{code:fresh,status:'waiting',capacity:chosen.cap,updatedAt:serverTimestamp()});
    return fresh;
  }).catch(error=>{
    // Con las reglas anteriores no se puede sustituir una mesa abandonada: se entra como antes.
    if(!allowStale&&error?.code==='permission-denied')return null;
    throw error;
  });
  if(code===null)return publicConnect({...options,allowStale:true});
  const ref=doc(db,'quickRooms',code);
  let latest=null,started=false;
  // La mesa empieza al completarse o, con al menos dos personas, cuando lleva
  // PUBLIC_WAIT_MS sin que entre nadie (la hora es la de la última entrada, del
  // servidor). La arranca quien la lleva; si las reglas aún no lo permiten, se reintenta.
  const secondsLeft=()=>{const last=latest?.updatedAt?.toMillis?.();return Number.isFinite(last)?Math.max(0,Math.ceil((last+PUBLIC_WAIT_MS-Date.now())/1000)):PUBLIC_WAIT_MS/1000;};
  const tryStart=()=>{
    if(!latest||latest.config||latest.phase!=='lobby'||latest.host!==uid||latest.members.length<2||started)return;
    if(latest.members.length<latest.capacity&&secondsLeft()>0)return;
    started=true;
    const catalog=CT.shuffle(CT.QuickCatalog.challenges).slice(0,3);
    api.act({type:'start',rounds:catalog.map(x=>({id:x.id,order:CT.shuffle(x.cards.map(c=>c.id))})),kind:'public',historyId:'public-'+code}).catch(()=>{setTimeout(()=>{started=false;},2000);});
  };
  const stop=onSnapshot(ref,snap=>{try{if(!snap.exists())throw Error('La mesa ya no existe.');latest=R.validate(snap.data());onChange(latest,uid,code);tryStart();
  }catch(e){onError(e);}},onError);
  const startTimer=setInterval(tryStart,1000);
  let warned=false;
  const keepAlive=async()=>{
    if(!latest||latest.phase!=='lobby'||latest.members.length>=chosen.cap)return;
    if(latest.host===uid){
      try{await runTransaction(db,async tx=>{const q=await tx.get(qref);if(!q.exists()||q.data().code!==code||q.data().status!=='waiting')return;tx.update(qref,{updatedAt:serverTimestamp()});});}
      catch(error){console.warn('QUICK_QUEUE_KEEPALIVE',error?.code||error);}
      return;
    }
    // Nadie más puede empezar la mesa: si quien la abrió ya no la mantiene, se avisa.
    try{const q=await getDoc(qref);if(!(q.exists()&&q.data().code===code&&queueFresh(q.data()))&&!warned){warned=true;onError(Error('Quien abrió la mesa se ha ido y nadie más puede empezarla. Vuelve a buscar para encontrar otra.'));}}
    catch{}
  };
  const keepTimer=setInterval(keepAlive,45000);
  const close=()=>{clearInterval(keepTimer);clearInterval(startTimer);stop();};
  // Dejar de buscar: se libera la plaza (o se cierra la mesa si no quedaba nadie más).
  async function leave(){
    close();
    try{await runTransaction(db,async tx=>{
      const snap=await tx.get(ref);if(!snap.exists())return;
      const data=snap.data();if(data.phase!=='lobby'||!data.members.includes(uid))return;
      if(data.members.length<=1){if(data.host===uid)tx.delete(ref);return;}
      tx.update(ref,{...R.reduce(data,uid,{type:'leave'}),updatedAt:serverTimestamp()});
    });}catch(error){console.warn('QUICK_PUBLIC_LEAVE',error?.code||error);}
  }
  const api={kind:'internet',public:true,code,secondsLeft,leave,get host(){return latest?.host===uid;},close,async act(action){if(!latest)throw Error('Espera a que se cargue la mesa.');const revision=latest.revision;await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('La mesa ya no existe.');const next=R.reduce(snap.data(),uid,action,revision);tx.update(ref,{...next,updatedAt:serverTimestamp()});});}};
  return api;
}

export async function connectPublic(options){return publicConnect(options);}
// Las salas en las que estás (por tu cuenta, desde cualquier móvil): la lista de duelos las usa para saber a quién le toca.
export async function mine(){
  await auth.authStateReady();
  const uid=auth.currentUser?.uid;
  if(!uid)throw Error('Sin perfil todavía.');
  const snaps=await getDocs(query(collection(db,'quickRooms'),where('members','array-contains',uid)));
  const found=[];
  for(const d of snaps.docs){try{found.push({code:d.id,room:{...R.validate(d.data()),updatedAt:d.data().updatedAt?.seconds||0},uid});}catch{/* sala dañada: no se enseña */}}
  return found;
}
export async function connect({code, name, create=false, capacity=4, onChange, onError}) {
  await auth.authStateReady();
  const uid=auth.currentUser?.uid;
  if(!uid) throw Error('Espera a que se prepare tu perfil e inténtalo de nuevo.');
  if(create) code=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');
  code=String(code||'').trim().toUpperCase();
  if(!/^[A-Z2-9]{10}$/.test(code))throw Error('Escribe el código de diez caracteres de la sala.');
  const ref=doc(db,'quickRooms',code);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(create) {
      if(snap.exists())throw Error('Ese código ya existe. Vuelve a crear la sala.');
      tx.set(ref,{...R.create(uid,name,capacity),catalog:CT.QuickNetwork.fingerprint(),updatedAt:serverTimestamp()});
    } else {
      if(!snap.exists())throw Error('No se encuentra esta sala.');
      const room=snap.data();
      if(room.catalog!==CT.QuickNetwork.fingerprint())throw Error('Actualizad Continuum para usar las mismas cartas.');
      if(!room.members.includes(uid))tx.update(ref,{...R.reduce(room,uid,{type:'join',name}),updatedAt:serverTimestamp()});
    }
  });
  let latest=null;
  const stop=onSnapshot(ref,snap=>{
    try{if(!snap.exists())throw Error('La sala ya no existe.');latest=R.validate(snap.data());onChange(latest,uid,code);}catch(error){onError(error);}
  },onError);
  return {kind:'internet',code, get host(){return latest?.host===uid;},close:stop,
    async act(action) {
      if(!latest)throw Error('Espera a que se cargue la sala.');
      const revision=latest.revision;
      await runTransaction(db,async tx=>{
        const snap=await tx.get(ref);if(!snap.exists())throw Error('La sala ya no existe.');
        const next=R.reduce(snap.data(),uid,action,revision);
        tx.update(ref,{...next,updatedAt:serverTimestamp()});
      });
    }
  };
}
