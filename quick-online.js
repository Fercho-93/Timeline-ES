import {auth, db} from './firebase-client.js';
import {doc, getDoc, runTransaction, onSnapshot, serverTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
const CT=window.CONTINUUM, R=CT.QuickRoom;
const PUBLIC_VERSION=1;
function publicKey(capacity){return 'quick:'+capacity+':v'+PUBLIC_VERSION+':'+CT.QuickNetwork.fingerprint();}
async function publicConnect({name,capacity=4,onChange,onError}) {
  await auth.authStateReady(); const uid=auth.currentUser?.uid;
  if(!uid)throw Error('Espera a que se prepare tu perfil e inténtalo de nuevo.');
  const capacities=[2,3,4].includes(Number(capacity))?[Number(capacity)]:[4,3,2];
  let chosen=null;
  for(const cap of capacities){
    const key=publicKey(cap), qref=doc(db,'quickPublicQueues',key), qs=await getDoc(qref);
    if(qs.exists()&&qs.data().status==='waiting'){chosen={cap,key,code:qs.data().code};break;}
  }
  if(!chosen){const cap=capacities[0],key=publicKey(cap),code=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');chosen={cap,key,code};}
  const ref=doc(db,'quickRooms',chosen.code), qref=doc(db,'quickPublicQueues',chosen.key);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()){
      const room={...R.create(uid,name,chosen.cap),catalog:CT.QuickNetwork.fingerprint(),matchmaking:'public',updatedAt:serverTimestamp()};
      tx.set(ref,room);tx.set(qref,{code:chosen.code,status:'waiting',capacity:chosen.cap,updatedAt:serverTimestamp()});return;
    }
    const room=snap.data(); if(room.catalog!==CT.QuickNetwork.fingerprint())throw Error('Actualizad Continuum.');
    if(!room.members.includes(uid)){const next=R.reduce(room,uid,{type:'join',name});tx.update(ref,{...next,updatedAt:serverTimestamp()});if(next.members.length>=chosen.cap)tx.update(qref,{status:'full',updatedAt:serverTimestamp()});}
  });
  let latest=null,started=false;
  const stop=onSnapshot(ref,snap=>{try{if(!snap.exists())throw Error('La mesa ya no existe.');latest=R.validate(snap.data());onChange(latest,uid,chosen.code);
    if(latest.host===uid&&latest.members.length===chosen.cap&&!latest.config&&!started){started=true;const count=3;const catalog=CT.shuffle(CT.QuickCatalog.challenges).slice(0,count);void api.act({type:'start',rounds:catalog.map(x=>({id:x.id,order:CT.shuffle(x.cards.map(c=>c.id))})),kind:'public',historyId:'public-'+chosen.code});}
  }catch(e){onError(e);}},onError);
  const api={kind:'internet',public:true,code:chosen.code,get host(){return latest?.host===uid;},close:stop,async act(action){if(!latest)throw Error('Espera a que se cargue la mesa.');const revision=latest.revision;await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('La mesa ya no existe.');const next=R.reduce(snap.data(),uid,action,revision);tx.update(ref,{...next,updatedAt:serverTimestamp()});});}};
  return api;
}

export async function connectPublic(options){return publicConnect(options);}
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
