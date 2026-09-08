import {createMatch,applyAction,publicMatch,hash} from './competition.mjs';
import {Timestamp} from 'firebase-admin/firestore';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,128}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
// store.atomic lee y escribe en una sola transacción; la cuota se comparte entre salas.
export function createService({store,catalogs,now=Date.now}) {
 return async function execute({uid,matchId,requestId,command}) {
  if(!validId(uid)||!validId(matchId)||!validId(requestId)||!command||JSON.stringify(command).length>2048)throw Error('INVALID_REQUEST');
  const fingerprint=hash(command),time=now();
  return store.atomic(uid,matchId,requestId,async ({state,receipt,quota})=>{
   if(receipt){if(receipt.fingerprint!==fingerprint)throw Error('IDEMPOTENCY_CONFLICT');return {response:receipt.response};}
   quota=quota||{windowStart:time,count:0,lastCreatedAt:0};
   if(time-quota.windowStart>=60000)quota={...quota,windowStart:time,count:0};
   if(quota.count>=60)throw Error('RATE_LIMIT');
   let next;
   if(command.type==='create') {
    if(state||Object.keys(command).some(k=>!['type','catalog'].includes(k))||!Object.hasOwn(catalogs,command.catalog))throw Error('INVALID_CREATE');
    if(quota.lastCreatedAt&&time-quota.lastCreatedAt<30000)throw Error('RATE_LIMIT');
    next=createMatch(uid,catalogs[command.catalog],time);quota.lastCreatedAt=time;
   } else {if(!state)throw Error('NOT_FOUND');next=applyAction(state,uid,command,time);}
   quota.count++;
   const response={public:publicMatch(next),private:next.players[uid]};
   const result=next.status==='ended'?{matchId,version:next.version,winners:next.winners,catalogHash:next.catalogHash,
     completedAt:time,auditHash:next.auditHash}:null;
   return {state:next,quota,receipt:{fingerprint,response,expiresAt:next.expiresAt},result,response};
  });
 };
}
export function firestoreStore(db) {
 return {atomic(uid,matchId,requestId,fn){
  const secret=db.doc(`matchSecrets/${matchId}`),receipt=db.doc(`matchRequests/${uid}/requests/${requestId}`),quota=db.doc(`matchQuotas/${uid}`);
  return db.runTransaction(async tx=>{
   const [s,r,q]=await tx.getAll(secret,receipt,quota);
   // La clave de idempotencia pertenece a la identidad, e incluye la sala en la huella.
   if(r.exists&&r.data().matchId!==matchId)throw Error('IDEMPOTENCY_CONFLICT');
   const state=s.data();if(state)delete state.expireAt;
   const out=await fn({state,receipt:r.data(),quota:q.data()});
   if(out.state){
    const expireAt=Timestamp.fromMillis(out.state.expiresAt);
    tx.set(secret,{...out.state,expireAt});tx.set(db.doc(`matches/${matchId}`),{...publicMatch(out.state),expireAt});
    for(const id of out.state.order)tx.set(db.doc(`matches/${matchId}/private/${id}`),{...out.state.players[id],expireAt});
    tx.set(quota,{...out.quota,expireAt:Timestamp.fromMillis(out.state.updatedAt+7*86400000)});
    tx.create(receipt,{...out.receipt,matchId,expireAt});
    if(out.result)tx.create(db.doc(`matchResults/${matchId}`),{...out.result,expireAt});
   }
   return out.response;
  });
 }};
}
