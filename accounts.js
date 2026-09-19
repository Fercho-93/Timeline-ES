import { auth, db } from './firebase-client.js';
import { signInAnonymously, setPersistence, browserLocalPersistence, deleteUser, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { doc, getDocFromServer, runTransaction, serverTimestamp, writeBatch, collection, query, orderBy, limit, getDocsFromServer } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const app = document.getElementById('app');
const esc = CT.escapeHtml;
const season = CT.AccountStorage.season;
const avatars = { compass:'🧭', globe:'🌍', star:'⭐', book:'📖', rocket:'🚀', owl:'🦉' };
const P = 'hilo-perfil-v1', R = 'hilo-retos-v1', META = 'continuum-cloud-v1';
let identity = null, profile = null, ready = false, active = false, busy = false;
let startGame, stopStorage, timer, saving, suppress = false, change = 0, revision = 0;
let failedConflict = false, lockedUid = null;
async function acquireTab(uid) {
  if (!navigator.locks || lockedUid === uid) return true;
  return new Promise(resolve => {
    navigator.locks.request(`continuum:${season}:${uid}`, {ifAvailable:true}, lock => {
      if (!lock) { resolve(false); return; }
      lockedUid=uid;resolve(true);return new Promise(() => {});
    }).catch(() => resolve(false));
  });
}
const refs = uid => ({profile:doc(db,'playerProfiles',uid), progress:doc(db,'playerProgress',uid), ranking:doc(db,'dailyRanking',uid)});
function message(error) {
  const texts = {
    'auth/operation-not-allowed':'El acceso de invitado aún no está activado. Contacta con soporte.',
    'auth/network-request-failed':'No hay conexión. Reinténtalo cuando tengas internet.',
    'auth/too-many-requests':'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    'permission-denied':'No se puede acceder al perfil. Comprueba tu sesión; si persiste, falta activar las reglas de cuentas.',
    'unavailable':'No hay conexión con tu progreso. Conservamos los cambios en este dispositivo.',
    'auth/requires-recent-login':'No se pudo eliminar el invitado. Vuelve a abrir el juego e inténtalo de nuevo.'
  };
  return texts[error?.code] || error?.message || 'No se pudo completar. Vuelve a intentarlo.';
}
function feedback(text) { const el = document.getElementById('account-message'); if (el) el.textContent = text; }
function shell(body) {
  window.CONTINUUM_SPLASH?.finish();
  CT.Scene?.apply(CT.DEFAULT_MODE, 'account');
  app.dataset.screen = 'account';
  app.innerHTML = `<section class="account-shell"><img class="account-emblem" src="assets/continuum-emblem-800.webp" alt=""><h1>Continuum</h1>${body}<p id="account-message" class="account-error" role="status" aria-live="polite"></p><p class="account-foot"><a href="privacidad.html" target="_blank" rel="noopener">Privacidad y datos de tu cuenta</a></p></section>`;
}
async function perform(fn) {
  if (busy) return;
  busy = true;
  app.querySelectorAll('button').forEach(b => { b.disabled = true; });
  feedback('');
  try { await fn(); } catch (error) { feedback(message(error)); }
  finally { busy = false; app.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
}
const button = (id, fn) => document.getElementById(id)?.addEventListener('click', () => perform(fn));
function randomAlias() {
  const number = new Uint32Array(1);
  crypto.getRandomValues(number);
  return `Player ${1000 + number[0] % 9000}`;
}
const nameRef = key => doc(db,'playerNames',key);
const nameKey = alias => alias.toLowerCase();
function validateAlias(alias) {
  if (alias.length < 2 || alias.length > 24 || !/^[a-z0-9áéíóúüñ_-](?:[a-z0-9áéíóúüñ _-]*[a-z0-9áéíóúüñ_-])$/i.test(alias)) throw Error('Usa de 2 a 24 caracteres: letras, números, espacios, guion o guion bajo.');
}
async function ensureProfile(uid) {
  const ref=refs(uid).profile;
  for(let attempt=0;attempt<12;attempt++) {
    const fallback=randomAlias();
    try {
      return await runTransaction(db,async tx=>{
        const existing=await tx.get(ref), old=existing.exists()?existing.data():null;
        if(old?.aliasKey) return old;
        let alias=attempt===0 && old ? old.alias : fallback;
        try {validateAlias(alias);} catch {alias=fallback;}
        const aliasKey=nameKey(alias), reservation=await tx.get(nameRef(aliasKey));
        if(reservation.exists() && reservation.data().uid!==uid) throw Object.assign(Error('Nombre ocupado'),{code:'name/taken'});
        const rank=await tx.get(refs(uid).ranking);
        const value=old ? {...old,alias,aliasKey} : {alias,aliasKey,avatar:'compass',season,createdAt:serverTimestamp(),privacyVersion:1};
        tx.set(nameRef(aliasKey),{uid});tx.set(ref,value);
        if(rank.exists())tx.set(refs(uid).ranking,{...rank.data(),alias,updatedAt:serverTimestamp()});
        return value;
      });
    } catch(error) {if(error.code!=='name/taken')throw error;}
  }
  throw Error('No se pudo reservar un nombre. Vuelve a intentarlo.');
}
function accountDialog(html) {
  app.insertAdjacentHTML('beforeend',html);
  CT.openDialog(app.lastElementChild,true);
}
function editNameScreen() {
  accountDialog(`<div class="overlay"><section class="modal"><h2>Cambiar nombre</h2><p>Este nombre será público en el ranking. No uses datos personales.</p><label>Nombre<input id="account-alias" minlength="2" maxlength="24" autocomplete="nickname" value="${esc(profile.alias)}"></label><p id="account-delete-message" role="status"></p><button class="btn btn-primary" data-account-action="rename">Guardar nombre</button><button class="btn btn-secondary" data-account-action="close">Cancelar</button></section></div>`,true);
}
async function rename() {
  const alias = document.getElementById('account-alias').value.trim();
  validateAlias(alias);
  const aliasKey=nameKey(alias);
  if (alias.length < 2 || alias.length > 24 || /[<>\x00-\x1f]/.test(alias)) throw Error('Elige un nombre de 2 a 24 caracteres sin símbolos < o >.');
  await flush();
  if (failedConflict) return;
  const r=refs(identity.uid);
  await runTransaction(db,async tx => {
    const p=await tx.get(r.profile), rank=await tx.get(r.ranking), reservation=await tx.get(nameRef(aliasKey));
    if(reservation.exists() && reservation.data().uid!==identity.uid) throw Error('Este nombre de usuario ya está en uso. Elige otro.');
    if (!p.exists()) throw Error('No se ha encontrado tu perfil. Vuelve a abrir el juego.');
    const previous=p.data().aliasKey;
    tx.set(nameRef(aliasKey),{uid:identity.uid});
    tx.set(r.profile,{...p.data(),alias,aliasKey});
    if(previous && previous!==aliasKey) tx.delete(nameRef(previous));
    if (rank.exists()) tx.set(r.ranking,{...rank.data(),alias,updatedAt:serverTimestamp()});
  });
  profile={...profile,alias,aliasKey};
  CT.Storage.setItem('hilo-nombre-v1',alias);
  const card=document.querySelector('.account-card');
  if(card) card.outerHTML=accountCard();
  CT.closeDialog();
}
function metadata() { try { return JSON.parse(CT.Storage.getItem(META)) || {}; } catch { return {}; } }
function setMeta(dirty) { CT.Storage.setItem(META,JSON.stringify({revision,dirty})); }
function payload() {
  const progress = CT.Storage.getItem(P) || '{}', records = CT.Storage.getItem(R) || '{}';
  const totals = JSON.parse(progress).totals || {};
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {progress,records,hits:count(totals.dailyHits),games:count(totals.dailyGames),season};
}
function restoreRemote(data) {
  suppress = true;
  CT.Storage.setItem(P,data?.progress || '{}'); CT.Storage.setItem(R,data?.records || '{}');
  revision = data?.revision || 0;
  setMeta(false); suppress = false;
}
function syncNotice(text) {
  CT.Storage.notice(text,[['Reintentar',() => flush().catch(e => syncNotice(message(e)))],['Guardar copia',downloadProgress]]);
}
function downloadProgress() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({season,uid:identity?.uid,...payload()},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='continuum-progreso.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function conflictScreen() {
  failedConflict = true;
  // No se fusionan totales ni se pisa el otro dispositivo: el usuario elige expresamente.
  ready = false; app.inert = false;
  shell('<h2>Tu progreso cambió en otro dispositivo</h2><p>Hay dos versiones. Puedes descargar una copia de la de este móvil antes de cargar la guardada en tu cuenta. Para evitar duplicados, juega desde un dispositivo cada vez.</p><button class="btn btn-secondary" id="account-copy">Descargar copia de este móvil</button><button class="btn btn-primary" id="account-cloud">Usar el progreso de mi cuenta</button>');
  button('account-copy',downloadProgress);
  button('account-cloud',async () => {
    if (!confirm('¿Sustituir los cambios pendientes de este móvil por el progreso de tu cuenta?')) return;
    const snap=await getDocFromServer(refs(identity.uid).progress);restoreRemote(snap.exists()?snap.data():null);location.reload();
  });
}
async function flush() {
  if (saving) { await saving; if (metadata().dirty) return flush(); return; }
  if (!identity || !profile || !metadata().dirty || failedConflict) return;
  const uid=identity.uid, expected=revision, generation=change, data=payload(), r=refs(uid);
  saving = runTransaction(db,async tx => {
    const snap=await tx.get(r.progress), remote=snap.exists()?snap.data():null;
    if ((remote?.revision || 0) !== expected) { const e=Error('Conflicto de progreso');e.code='account/conflict';throw e; }
    tx.set(r.progress,{...data,revision:expected+1,updatedAt:serverTimestamp()});
    if (data.games > 0) tx.set(r.ranking,{alias:profile.alias,avatar:profile.avatar,hits:data.hits,games:data.games,season,updatedAt:serverTimestamp()});
  }).then(() => {
    revision=expected+1;setMeta(change !== generation);
    if (!metadata().dirty) document.getElementById('storage-notice')?.remove();
  }).catch(error => { if (error.code === 'account/conflict') conflictScreen(); throw error; }).finally(() => { saving=null; });
  await saving;
}
function schedule(key) {
  if (suppress || ![P,R].includes(key)) return;
  change++;setMeta(true);clearTimeout(timer);
  timer=setTimeout(() => flush().catch(e => { if (!failedConflict) syncNotice(message(e)); }),2000);
}
// `navigator.onLine` no es de fiar: en Chrome para Android dice "conectado" en cuanto
// el Wi-Fi está encendido, aunque sea el propio punto de acceso sin salida a internet
// —así que un móvil que crea el hotspot lo ve como "con conexión" y nunca entra por
// aquí. Lo que sí es de fiar es el error que ha devuelto de verdad Firebase al
// intentarlo: estos códigos son justo los que `message()` ya reconoce como "sin red".
const NETWORK_ERROR_CODES = ['auth/network-request-failed', 'unavailable', 'deadline-exceeded', 'auth/timeout'];
function isNetworkError(error) { return !navigator.onLine || NETWORK_ERROR_CODES.includes(error?.code); }
// Sin internet no hay invitado ni progreso en la nube que abrir, pero el resto del
// juego —incluido el modo sin conexión— no necesita ninguno de los dos: entra igual,
// sin cuenta, tal como ya hace boot.js cuando accounts.js ni siquiera llega a
// importarse. `delete CT.Accounts` deshace el marcador que puso `startAccounts`, para
// que el resto de la aplicación tome exactamente ese mismo camino ya probado en vez de
// quedarse esperando una cuenta que nunca llega a estar lista.
function offlineFallback() {
  delete CT.Accounts;
  if (!active) { active=true;startGame(); }
}
async function enter() {
  let u=auth.currentUser;
  if (!u) {
    try { u=(await signInAnonymously(auth)).user; }
    catch(error) {
      if (isNetworkError(error)) { offlineFallback(); return; }
      shell('<p>No hemos podido crear tu invitado. Conéctate a internet y vuelve a intentarlo.</p><button class="btn btn-primary" id="account-load">Reintentar</button>');
      feedback(message(error));button('account-load',enter);return;
    }
  }
  if (!await acquireTab(u.uid)) {
    shell('<h2>Tu cuenta está abierta en otra pestaña</h2><p>Cierra la otra pestaña para continuar aquí sin duplicar el progreso.</p><button class="btn btn-primary" id="account-tab">Reintentar</button>');
    button('account-tab',enter);return;
  }
  identity=u;CT.AccountStorage.use(u.uid);

  try {
    await u.getIdToken(true);
    const r=refs(u.uid);
    profile=await ensureProfile(u.uid);
    if (profile.season !== season) throw Error('Este perfil pertenece a otra temporada. Contacta con soporte.');
    const snap=await getDocFromServer(r.progress), remote=snap.exists()?snap.data():null;
    const meta=metadata();revision=meta.revision || 0;
    if (meta.dirty) {
      if (revision !== (remote?.revision || 0)) { conflictScreen(); return; }
      await flush();
    } else restoreRemote(remote);
    // Un UID compartido con Firebase y un alias guardado para los modos que piden nombre.
    CT.Storage.setItem('hilo-jugador-v1',u.uid);CT.Storage.setItem('hilo-nombre-v1',profile.alias);
    ready=true;stopStorage?.();stopStorage=CT.AccountStorage.subscribe(schedule);
    if (!active) { active=true;startGame(); }
  } catch (error) {
    if (failedConflict) return;
    if (isNetworkError(error)) { offlineFallback(); return; }
    shell('<h2>No hemos podido abrir tu progreso</h2><p>Necesitas conexión para abrir tu invitado. Tus datos no se han sustituido.</p><button class="btn btn-primary" id="account-load">Reintentar</button>');
    feedback(message(error));button('account-load',enter);
  }
}
function accountCard() {
  const stats=payload(), dirty=metadata().dirty;
  return `<div class="account-card">
    <div class="account-hero"><span class="account-kicker">TU HISTORIA EN CONTINUUM</span><div class="account-identity"><span class="account-avatar" aria-hidden="true">${avatars[profile?.avatar] || '🧭'}</span><div><span class="account-kicker">EXPLORADOR</span><strong>${esc(profile?.alias || '')}</strong><span class="account-save-state" role="status">${dirty ? '◌ Cambios pendientes' : '✓ Progreso guardado'}</span></div></div>
    <div class="account-metrics"><div><b>${stats.hits}</b><span>Aciertos diarios</span></div><div><b>${stats.games}</b><span>Retos completados</span></div></div></div>
    <button class="account-ranking-link" data-account-action="ranking"><span class="account-action-icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v6a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 13v5 M8 21h8 M9 18h6v3H9z"/></svg></span><span><small>EL RETO CONTINÚA</small><b>Ranking de retos diarios</b><span>Descubre tu lugar entre exploradores</span></span><span aria-hidden="true">↗</span></button>
    <div class="account-actions"><button class="btn btn-secondary" data-account-action="edit-name"><span aria-hidden="true">✎</span> Cambiar nombre</button><button class="btn btn-secondary" data-account-action="sync"><span aria-hidden="true">↻</span> Guardar ahora</button></div>
    <details class="account-details"><summary>Tu invitado y tus datos</summary><p>Invitado de esta instalación. Si borras los datos de la app o cambias de móvil, no podrás recuperar tu progreso.</p><a href="privacidad.html" target="_blank" rel="noopener">Privacidad</a><button class="btn btn-ghost account-delete" data-account-action="delete">Eliminar invitado y progreso</button></details>
  </div>`;
}
async function ranking() {
  await flush();
  if (failedConflict) return;
  const snap=await getDocsFromServer(query(collection(db,'dailyRanking'),orderBy('hits','desc'),limit(50)));
  const entries=snap.docs.map(d=>({id:d.id,...d.data()}));
  const position=i=>1+entries.filter(v=>(Number(v.hits)||0)>(Number(entries[i].hits)||0)).length;
  const mine=entries.findIndex(v=>v.id===identity.uid);
  const ownSnap=mine<0?await getDocFromServer(refs(identity.uid).ranking):null;
  const own=mine>=0?entries[mine]:ownSnap?.exists()?{id:identity.uid,...ownSnap.data()}:null;
  const player=(v,i)=>`<tr class="${v.id===identity.uid?'is-you':''}"><td><span class="ranking-place">${position(i)}</span></td><td><span aria-hidden="true">${avatars[v.avatar] || '🧭'}</span> <span class="ranking-name">${esc(v.alias)}</span>${v.id===identity.uid?'<small class="ranking-you">Tú</small>':''}</td><td><b>${Number(v.hits)||0}</b></td></tr>`;
  const podium=entries.slice(0,3).map((v,i)=>`<article class="ranking-medallion ranking-medallion-${i+1}${v.id===identity.uid?' is-you':''}"><span class="ranking-medal" aria-label="Puesto ${position(i)}">${['Ⅰ','Ⅱ','Ⅲ'][i]}</span><span class="ranking-avatar" aria-hidden="true">${avatars[v.avatar] || '🧭'}</span><b>${esc(v.alias)}</b>${v.id===identity.uid?'<small class="ranking-you">Tú</small>':''}<strong>${Number(v.hits)||0}</strong><span>aciertos</span></article>`).join('');
  accountDialog(`<div class="overlay"><section class="modal ranking-modal"><header class="ranking-hero"><span class="account-kicker">CONTINUUM · RETOS DIARIOS</span><span class="ranking-emblem" aria-hidden="true">✦</span><h2>La cima te espera</h2><p>Un nuevo día. Un nuevo reto. Tu siguiente puesto.</p><span class="ranking-caption">Ranking de retos diarios · Top 50</span></header>
    <div class="ranking-body">${entries.length?`<div class="ranking-podium" aria-label="Los tres primeros exploradores">${podium}</div><div class="ranking-personal${own?' has-result':''}">${mine>=0?`<span>Tu puesto <b>#${position(mine)}</b></span><span><b>${Number(own.hits)||0}</b> aciertos</span>`:own?`<span>Tu posición <b>Fuera del top 50</b></span><span><b>${Number(own.hits)||0}</b> aciertos</span>`:'Completa un reto diario para sumar tus aciertos al ranking.'}</div>${entries.length>3?`<table class="account-ranking"><thead><tr><th scope="col">Puesto</th><th scope="col">Explorador</th><th scope="col">Aciertos</th></tr></thead><tbody>${entries.slice(3).map((v,i)=>player(v,i+3)).join('')}</tbody></table>`:''}`:`<div class="ranking-empty"><span aria-hidden="true">✧</span><h3>La primera huella puede ser tuya</h3><p>Todavía no hay resultados. Completa un reto diario y estrena el ranking.</p><button class="btn btn-primary ranking-daily" data-account-action="daily">Jugar un reto diario <span aria-hidden="true">→</span></button></div>`}
    <details class="account-details ranking-rules"><summary>Cómo se suman los aciertos</summary><p>Aciertos acumulados en retos diarios completados. Cada reto cuenta una vez por día y mazo; las partidas libres y multijugador no puntúan. Resultados enviados por el juego, sin validación competitiva.</p><p>Primeros 50 jugadores. Las igualdades comparten puesto y no se consideran un desempate competitivo.</p></details></div>
    <footer class="ranking-footer"><button class="btn btn-primary" data-account-action="close">Cerrar</button></footer></section></div>`,true);
}
function deleteScreen() {
  if (CT.isSessionActive?.()) throw Error('Sal de la partida antes de eliminar el invitado.');
  accountDialog(`<div class="overlay"><section class="modal"><h2>Eliminar invitado y progreso</h2><p>Se borrarán tu perfil, progreso y entrada en el ranking. Esta acción no se puede deshacer. Al volver a entrar se creará un invitado nuevo desde cero.</p><button class="btn btn-ghost" data-account-action="delete-confirm">Eliminar definitivamente</button><button class="btn btn-primary" data-account-action="close">Cancelar</button><p id="account-delete-message" role="status"></p></section></div>`,true);
}
async function removeAccount() {
  const u=auth.currentUser;
  clearTimeout(timer);stopStorage?.();if (saving) await saving;
  const r=refs(u.uid), batch=writeBatch(db);
  if(profile?.aliasKey) batch.delete(nameRef(profile.aliasKey));
  batch.delete(r.ranking);batch.delete(doc(db,'socialRanking',u.uid));batch.delete(r.progress);batch.delete(r.profile);await batch.commit();
  active=false;
  try { await deleteUser(u); } catch(error) { active=true; throw error; }
  CT.AccountStorage.clear();ready=false;location.reload();
}
export async function startAccounts(callback) {
  startGame=callback;
  CT.Accounts={get ready(){return ready;},get user(){return identity;},get profile(){return profile;},card:accountCard,flush};
  await auth.authStateReady();
  await setPersistence(auth,browserLocalPersistence);
  onAuthStateChanged(auth,u=>{
    if (active && (!u || u.uid!==identity?.uid)) {
      ready=false;stopStorage?.();clearTimeout(timer);app.inert=true;location.reload();
    }
  });
  window.addEventListener('online',()=>flush().catch(e=>{if(!failedConflict)syncNotice(message(e));}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush().catch(()=>{});});
  window.addEventListener('beforeunload',event=>{if(metadata().dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-account-action]');if(!target)return;
    const action=target.dataset.accountAction;
    if(action==='close'){CT.closeDialog();return;}
    if(action==='daily'){CT.closeDialog();CT.localNavigate?.('daily');return;}
    if(busy)return;busy=true;target.disabled=true;
    const fn={ranking,sync:async()=>{await flush();const card=document.querySelector('.account-card');if(card)card.outerHTML=accountCard();},'edit-name':editNameScreen,rename,delete:deleteScreen,'delete-confirm':removeAccount}[action];
    Promise.resolve().then(fn).catch(error=>{
      const text=message(error), el=document.getElementById('account-delete-message');
      if(el)el.textContent=text;else if(!failedConflict)syncNotice(text);
    }).finally(()=>{busy=false;target.disabled=false;});
  });
  await enter();
}
