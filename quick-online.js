import {auth, db} from './firebase-client.js';
import {collection, deleteDoc, doc, getDoc, getDocs, query, where, runTransaction, onSnapshot, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
const CT=window.CONTINUUM, R=CT.QuickRoom;
export const PUBLIC_VERSION=1;
function publicKey(capacity){return 'quick:'+capacity+':v'+PUBLIC_VERSION+':'+CT.QuickNetwork.fingerprint();}
// Solo quien abre una mesa pública puede empezarla, así que la mesa vive mientras esa
// persona siga esperando: su móvil renueva la cola cada 45 s. Una cola sin renovar en dos
// minutos es una mesa abandonada: la búsqueda no entra y abre otra en su lugar.
const STALE_QUEUE_MS=120000, PUBLIC_WAIT_MS=30000;
const queueFresh=q=>{const at=q?.updatedAt?.toMillis?.();return Number.isFinite(at)&&Date.now()-at<STALE_QUEUE_MS;};
// El tablón de mesas abiertas (`public-tables.js`): quien lleva la mesa mantiene su ficha.
// Se carga aparte y sin bloquear: si no está, la mesa funciona igual por la cola.
let tablesModule=null;
const tables=()=>(tablesModule??=import('./public-tables.js'));
const freshCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');
// «Crear mesa» abre una mesa nueva con su configuración, sin pasar por la cola de la
// partida rápida; «Unirme» desde el tablón entra en esa mesa concreta.
async function claimTable({uid,name,create,code,capacity}){
  if(create){
    const fresh=freshCode();
    await runTransaction(db,async tx=>{
      tx.set(doc(db,'quickRooms',fresh),{...R.create(uid,name,capacity),catalog:CT.QuickNetwork.fingerprint(),matchmaking:'public',updatedAt:serverTimestamp()});
    });
    return fresh;
  }
  const ref=doc(db,'quickRooms',code);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists())throw Error('Esa mesa ya no existe. Elige otra en la lista.');
    const room=snap.data();
    if(room.members.includes(uid))return;
    if(room.matchmaking!=='public'||room.phase!=='lobby'||room.members.length>=room.capacity)throw Error('Esa mesa ya está completa o ha empezado. Elige otra en la lista.');
    if(room.catalog!==CT.QuickNetwork.fingerprint())throw Error('Esa mesa usa otra versión de los retos. Actualiza Continuum o elige otra.');
    const qref=doc(db,'quickPublicQueues',publicKey(room.capacity)), queue=await tx.get(qref);
    const next=R.reduce(room,uid,{type:'join',name});
    tx.update(ref,{...next,updatedAt:serverTimestamp()});
    if(next.members.length===room.capacity&&queue.exists()&&queue.data().code===code&&queue.data().status==='waiting')tx.update(qref,{status:'full',updatedAt:serverTimestamp()});
  });
  return code;
}
async function publicConnect(options) {
  const {name,capacity=4,onChange,onError,allowStale=false}=options;
  await auth.authStateReady(); const uid=auth.currentUser?.uid;
  if(!uid)throw Error('Espera a que se prepare tu perfil e inténtalo de nuevo.');
  if(options.create||options.code){
    const code=await claimTable({uid,name,create:!!options.create,code:String(options.code||'').toUpperCase(),capacity:[2,3,4].includes(Number(capacity))?Number(capacity):4});
    return watchPublic({...options,uid,code,seconds:options.create?options.seconds:undefined});
  }
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
    const fresh=freshCode();
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
  // La partida rápida juega sin tiempo, como siempre.
  return watchPublic({...options,uid,code,seconds:0,queueRef:qref});
}
async function watchPublic({uid,code,seconds,queueRef:qref=null,onChange,onError}) {
  const ref=doc(db,'quickRooms',code);
  // El tiempo por carta es de la mesa: quien la crea lo elige y quien entra (o hereda la
  // mesa si se va quien la llevaba) lo lee de su ficha del tablón.
  let tableSeconds=[0,15,20,30].includes(Number(seconds))?Number(seconds):null;
  if(tableSeconds===null){const entry=await tables().then(t=>t.readTable(code)).catch(()=>null);tableSeconds=[0,15,20,30].includes(entry?.seconds)?entry.seconds:0;}
  let tableState='';
  const syncTable=()=>{
    if(!latest||latest.host!==uid)return;
    if(latest.phase==='lobby'&&latest.members.length<latest.capacity){
      tableState='open';
      const entry={kind:'quick',code,mode:'quick',capacity:latest.capacity,seconds:tableSeconds,players:latest.members.length,
        names:latest.names.slice(0,4).map(n=>String(n).slice(0,24)),hostUid:uid,hostAvatar:CT.Avatares?.ownId?.()||null,
        clientVersion:PUBLIC_VERSION,fingerprint:CT.QuickNetwork.fingerprint()};
      void tables().then(t=>t.publishTable(entry)).catch(()=>{});
    } else if(tableState!=='closed'){tableState='closed';void tables().then(t=>t.removeTable(code)).catch(()=>{});}
  };
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
    api.act({type:'start',rounds:catalog.map(x=>({id:x.id,order:CT.shuffle(x.cards.map(c=>c.id))})),kind:'public',historyId:'public-'+code,...(tableSeconds?{seconds:tableSeconds}:{})}).catch(()=>{setTimeout(()=>{started=false;},2000);});
  };
  const stop=onSnapshot(ref,snap=>{try{if(!snap.exists())throw Error('La mesa ya no existe.');latest=R.validate(snap.data());onChange(latest,uid,code);syncTable();tryStart();
  }catch(e){onError(e);}},onError);
  const startTimer=setInterval(tryStart,1000);
  let warned=false;
  const keepAlive=async()=>{
    if(!latest||latest.phase!=='lobby'||latest.members.length>=latest.capacity)return;
    if(latest.host===uid){
      syncTable();
      if(!qref)return;
      try{await runTransaction(db,async tx=>{const q=await tx.get(qref);if(!q.exists()||q.data().code!==code||q.data().status!=='waiting')return;tx.update(qref,{updatedAt:serverTimestamp()});});}
      catch(error){console.warn('QUICK_QUEUE_KEEPALIVE',error?.code||error);}
      return;
    }
    // Nadie más puede empezar la mesa: si quien la abrió ya no la mantiene (ni su cola ni
    // su ficha del tablón se renuevan), se avisa.
    try{
      const table=await tables().then(t=>t.readTable(code).then(entry=>entry&&t.tableFresh(entry))).catch(()=>false);
      if(table)return;
      const q=qref?await getDoc(qref):null;
      if(!(q?.exists()&&q.data().code===code&&queueFresh(q.data()))&&!warned){warned=true;onError(Error('Quien abrió la mesa se ha ido y nadie más puede empezarla. Vuelve a buscar para encontrar otra.'));}
    }
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
      if(data.members.length<=1){if(data.host===uid){tableState='closed';tx.delete(ref);void tables().then(t=>t.removeTable(code)).catch(()=>{});}return;}
      tx.update(ref,{...R.reduce(data,uid,{type:'leave'}),updatedAt:serverTimestamp()});
    });}catch(error){console.warn('QUICK_PUBLIC_LEAVE',error?.code||error);}
  }
  const api={kind:'internet',public:true,code,secondsLeft,leave,get seconds(){return tableSeconds;},get host(){return latest?.host===uid;},close,async act(action){if(!latest)throw Error('Espera a que se cargue la mesa.');const revision=latest.revision;await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('La mesa ya no existe.');const next=R.reduce(snap.data(),uid,action,revision);tx.update(ref,{...next,updatedAt:serverTimestamp()});});}};
  return api;
}

export async function connectPublic(options){return publicConnect(options);}
// Las salas en las que estás (por tu cuenta, desde cualquier móvil): la lista de duelos las usa para saber a quién le toca.
export async function mine(){
  await auth.authStateReady();
  const uid=auth.currentUser?.uid;
  if(!uid)throw Error('Sin perfil todavía.');
  // Las tuyas y los retos que te han mandado (todavía sin aceptar), como en los duelos de las colecciones.
  const [mineSnap,invitedSnap]=await Promise.all([
    getDocs(query(collection(db,'quickRooms'),where('members','array-contains',uid))),
    getDocs(query(collection(db,'quickRooms'),where('invitedUid','==',uid)))
  ]);
  const docs=[...new Map([...mineSnap.docs,...invitedSnap.docs].map(d=>[d.id,d])).values()];
  const found=[];
  for(const d of docs){try{found.push({code:d.id,room:{...R.validate(d.data()),updatedAt:d.data().updatedAt?.seconds||0},uid});}catch{/* sala dañada: no se enseña */}}
  return found;
}
// Cancela una invitación que aún nadie ha aceptado: se borra la sala.
export async function cancelRoom(code){
  await auth.authStateReady();
  const ref=doc(db,'quickRooms',String(code||'').toUpperCase());
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);if(!snap.exists())return;
    const room=snap.data();
    if(room.host!==auth.currentUser?.uid)throw Error('Solo quien creó el duelo puede cancelar la invitación.');
    if(room.capacity!==2||room.config?.kind!=='duel'||room.members.length!==1||room.phase==='finished')
      throw Error('La invitación ya no está pendiente. Actualiza la lista; si tu amigo entró, puedes rendirte.');
    tx.delete(ref);
  });
}
// Una jugada suelta sobre una sala en la que estás (rendirse desde la lista de duelos, sin abrirla).
export async function actOnce(code,action,expected){
  await auth.authStateReady();
  const uid=auth.currentUser?.uid;
  if(!uid)throw Error('Sin perfil todavía.');
  const ref=doc(db,'quickRooms',String(code||'').toUpperCase());
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);if(!snap.exists())throw Error('La sala ya no existe.');
    const room=snap.data();
    if(expected){
      if(expected.uid!==uid)throw Error('Esta jugada pertenece a otra cuenta.');
      const commands=room.commands,base=expected.commands;
      if(JSON.stringify(commands.slice(0,base.length))!==JSON.stringify(base))throw Error('La partida cambió: revisa tu jugada pendiente.');
      const tail=commands.slice(base.length);
      // A retry after a lost acknowledgement must not apply the same command twice.
      if(tail.length && JSON.stringify(tail[0])===JSON.stringify(action))return;
      if(tail.length)throw Error('La partida avanzó antes de enviar tu jugada. Vuelve a abrirla.');
    }
    tx.update(ref,{...R.reduce(room,uid,action),updatedAt:serverTimestamp()});
  });
}
export async function connect({code, name, create=false, capacity=4, invite=null, onChange, onError}) {
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
      tx.set(ref,{...R.create(uid,name,capacity),...(invite?.uid?{invitedUid:String(invite.uid).slice(0,128),invitedName:String(invite.name||'').slice(0,24)}:{}),catalog:CT.QuickNetwork.fingerprint(),updatedAt:serverTimestamp()});
    } else {
      if(!snap.exists())throw Error('No se encuentra esta sala.');
      const room=snap.data();
      if(!CT.QuickNetwork.compatible(room.catalog))throw Error('Actualizad Continuum para usar las mismas cartas.');
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
