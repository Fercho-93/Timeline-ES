// Motor autoritativo. No depende de DOM, Firebase ni de valores enviados por clientes.
import '../engine.js';
import {createHash, randomInt, randomUUID} from 'node:crypto';
const E=globalThis.ContinuumEngine;
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function shuffle(input) {
 const cards=[...input];
 for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
 return cards;
}
export function createMatch(uid,catalog,now,randomize=shuffle) {
 if(!uid||!Array.isArray(catalog)||catalog.length<7||catalog.length>1500)throw Error('INVALID_CATALOG');
 const values=Object.fromEntries(catalog.map(c=>[c.id,c.value]));
 if(Object.keys(values).length!==catalog.length||catalog.some(c=>!Number.isSafeInteger(c.id)||!Number.isFinite(c.value)))throw Error('INVALID_CATALOG');
 return {protocol:1,version:0,status:'lobby',phase:'lobby',host:uid,order:[uid],players:{[uid]:{hand:[],pulseUsed:false,shieldRound:0}},
   deck:randomize(catalog.map(c=>c.id)),discard:[],timeline:[],values,catalogHash:hash(catalog),current:0,round:1,turnsInRound:0,
   pulse:null,reveal:null,winners:[],createdAt:now,updatedAt:now,expiresAt:now+7*86400000,auditHash:hash([uid,now,randomUUID()])};
}
export function publicMatch(state) {
 return {protocol:state.protocol,version:state.version,status:state.status,phase:state.phase,host:state.host,order:state.order,
   hands:Object.fromEntries(state.order.map(uid=>[uid,state.players[uid].hand.length])),timeline:state.timeline,
   current:state.current,round:state.round,catalogHash:state.catalogHash,winners:state.winners,
   pulse:state.pulse?{cardId:state.pulse.cardId,by:state.pulse.by,target:state.pulse.target,stage:state.pulse.stage}:null,
   reveal:state.reveal,updatedAt:state.updatedAt,expiresAt:state.expiresAt};
}
const fields={join:[],start:[],play:['cardId','index'],pulse:['target'],answer:['index'],endTurn:[]};
export function applyAction(input,uid,action,now,randomize=shuffle) {
 if(!action||!Object.hasOwn(fields,action.type)||Object.keys(action).some(k=>!['type','version',...fields[action.type]].includes(k)))throw Error('INVALID_ACTION');
 if(!Number.isSafeInteger(action.version)||action.version!==input.version)throw Error('STALE_VERSION');
 if(now>=input.expiresAt)throw Error('EXPIRED');
 const s=structuredClone(input), value=id=>s.values[id];
 if(action.type==='join') {
  if(s.status!=='lobby'||s.order.includes(uid)||s.order.length>=9)throw Error('CANNOT_JOIN');
  s.order.push(uid);s.players[uid]={hand:[],pulseUsed:false,shieldRound:0};
 } else {
  if(!s.order.includes(uid))throw Error('NOT_MEMBER');
  const actor=s.order[s.current],me=s.players[uid];
  if(action.type==='start') {
   if(uid!==s.host||s.status!=='lobby'||s.order.length<2||s.deck.length<1+s.order.length*3)throw Error('CANNOT_START');
   s.timeline=[s.deck.shift()];for(const id of s.order)s.players[id].hand=s.deck.splice(0,3);
   s.status='playing';s.phase='turn';
  } else {
   if(s.status!=='playing')throw Error('NOT_PLAYING');
   if(action.type==='play') {
    if(uid!==actor||s.phase!=='turn')throw Error('NOT_TURN');
    const r=E.play({...s,hand:me.hand},action.cardId,action.index,value,randomize);
    me.hand=r.hand;for(const k of ['timeline','deck','discard'])s[k]=r[k];
    s.phase='reveal';s.reveal={cardId:action.cardId,correct:r.correct,returned:r.returned,by:uid};
   } else if(action.type==='pulse') {
    if(uid!==actor||s.phase!=='turn'||me.pulseUsed||me.hand.length<2||!s.order.includes(action.target)||action.target===uid||s.players[action.target].shieldRound===s.round)throw Error('NO_PULSE');
    const r=E.draw(s.deck,s.discard,randomize);if(r.cardId==null)throw Error('NO_CARDS');
    s.deck=r.deck;s.discard=r.discard;me.pulseUsed=true;
    s.pulse={by:uid,target:action.target,cardId:r.cardId,giftId:randomize(me.hand)[0],stage:'challenge'};s.phase='pulse';
   } else if(action.type==='answer') {
    if(s.phase!=='pulse'||!s.pulse)throw Error('NO_PULSE');
    const p=s.pulse;
    if(p.stage==='challenge') {
     if(uid!==p.by)throw Error('NOT_TURN');
     E.fits(s.timeline,p.cardId,action.index,value); // valida el índice sin publicar el resultado
     p.byIndex=action.index;p.stage='defense';
    } else {
     if(uid!==p.target)throw Error('NOT_DEFENSE');
     const r=E.pulse({...s,byHand:s.players[p.by].hand,targetHand:me.hand},p,action.index,value,randomize);
     s.players[p.by].hand=r.byHand;me.hand=r.targetHand;
     if(r.giftId!=null)me.shieldRound=s.round;
     for(const k of ['timeline','deck','discard'])s[k]=r[k];
     s.reveal={cardId:p.cardId,by:p.by,target:p.target,byIndex:p.byIndex,targetIndex:action.index,
       correct:r.byOk,targetOk:r.targetOk,giftId:r.giftId,penaltySkipped:r.penaltySkipped};
     s.pulse=null;s.phase='reveal';
    }
   } else if(action.type==='endTurn') {
    if(uid!==actor||s.phase!=='reveal')throw Error('NOT_TURN');
    s.turnsInRound++;
    if(s.turnsInRound===s.order.length) {
     const r=E.roundOutcome(s.order,s.players,s.deck.length+s.discard.length);
     if(r.ended){s.status='ended';s.phase='ended';s.winners=r.empty;}
     else {
      for(const id of r.empty){const d=E.draw(s.deck,s.discard,randomize);s.deck=d.deck;s.discard=d.discard;s.players[id].hand.push(d.cardId);}
      s.round++;s.turnsInRound=0;
     }
    }
    if(s.status!=='ended'){s.current=(s.current+1)%s.order.length;s.phase='turn';s.reveal=null;}
   }
  }
 }
 s.version++;s.updatedAt=now;s.auditHash=hash([input.auditHash,uid,action,s.version,hash([s.deck,s.discard,s.timeline,s.players])]);
 return s;
}
