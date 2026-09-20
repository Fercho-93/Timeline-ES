import {auth, db} from './firebase-client.js';
import {doc, runTransaction, onSnapshot, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
const CT=window.CONTINUUM, R=CT.QuickRoom;
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
