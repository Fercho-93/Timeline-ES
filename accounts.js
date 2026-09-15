import { auth, db } from './firebase-client.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, deleteUser, reload, onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithCredential, reauthenticateWithCredential, reauthenticateWithPopup, EmailAuthProvider, revokeAccessToken } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { doc, getDocFromServer, runTransaction, serverTimestamp, writeBatch, collection, query, orderBy, limit, getDocsFromServer } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const app = document.getElementById('app');
const esc = CT.escapeHtml;
const season = CT.AccountStorage.season;
const avatars = { compass:'🧭', globe:'🌍', star:'⭐', book:'📖', rocket:'🚀', owl:'🦉' };
const P = 'hilo-perfil-v1', R = 'hilo-retos-v1', META = 'continuum-cloud-v1';
let identity = null, profile = null, ready = false, active = false, busy = false;
let startGame, stopStorage, timer, saving, suppress = false, change = 0, revision = 0;
let registration = false, failedConflict = false, lockedUid = null;
async function acquireTab(uid) {
  if (!navigator.locks || lockedUid === uid) return true;
  return new Promise(resolve => {
    navigator.locks.request(`continuum:${season}:${uid}`, {ifAvailable:true}, lock => {
      if (!lock) { resolve(false); return; }
      lockedUid=uid;resolve(true);return new Promise(() => {});
    }).catch(() => resolve(false));
  });
}
const refs = uid => ({profile:doc(db,'playerProfiles',uid), progress:doc(db,'playerProgress',uid), ranking:doc(db,'socialRanking',uid)});
const native = () => window.Capacitor?.isNativePlatform?.();
function message(error) {
  const texts = {
    'auth/operation-not-allowed':'Este método de acceso aún no está activado. Prueba otro método.',
    'auth/invalid-credential':'El correo o la contraseña no son correctos.',
    'auth/email-already-in-use':'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    'auth/account-exists-with-different-credential':'Ya tienes una cuenta con otro método. Utiliza el método con el que te registraste.',
    'auth/weak-password':'La contraseña debe tener al menos 8 caracteres.',
    'auth/popup-closed-by-user':'Has cancelado el acceso.',
    'auth/popup-blocked':'Permite la ventana de acceso y vuelve a pulsar el botón.',
    'auth/unauthorized-domain':'El acceso todavía no está configurado para esta dirección.',
    'auth/network-request-failed':'No hay conexión. Reinténtalo cuando tengas internet.',
    'auth/too-many-requests':'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    'permission-denied':'No se puede acceder al perfil. Comprueba tu sesión; si persiste, falta activar las reglas de cuentas.',
    'unavailable':'No hay conexión con tu progreso. Conservamos los cambios en este dispositivo.',
    'auth/requires-recent-login':'Vuelve a identificarte para confirmar esta operación.'
  };
  return texts[error?.code] || error?.message || 'No se pudo completar. Vuelve a intentarlo.';
}
function feedback(text) { const el = document.getElementById('account-message'); if (el) el.textContent = text; }
function shell(body) {
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
function authScreen() {
  shell(`<p>Tu próxima historia empieza aquí. Entra para guardar tu progreso y participar en el ranking.</p>
    <div class="account-social"><button class="btn btn-secondary" id="account-google">Continuar con Google</button><button class="btn account-apple" id="account-apple">Continuar con Apple</button></div>
    <form id="account-email"><label>Correo electrónico<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Contraseña<input name="password" type="password" autocomplete="${registration ? 'new-password' : 'current-password'}" minlength="${registration ? 8 : 1}" required maxlength="128"></label><button class="btn btn-primary" type="submit">${registration ? 'Crear cuenta' : 'Iniciar sesión'}</button></form>
    <button class="btn btn-secondary" id="account-toggle">${registration ? 'Ya tengo una cuenta' : 'Crear una cuenta con correo'}</button><button class="btn btn-ghost" id="account-reset">He olvidado mi contraseña</button>`);
  button('account-google', async () => { await social('google.com'); await enter(); });
  button('account-apple', async () => { await social('apple.com'); await enter(); });
  button('account-toggle', () => { registration = !registration; authScreen(); });
  button('account-reset', async () => {
    const email = app.querySelector('[name=email]');
    if (!email.reportValidity()) return;
    try { await sendPasswordResetEmail(auth,email.value.trim()); }
    catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
    feedback('Si el correo tiene una cuenta, recibirás instrucciones para recuperar la contraseña.');
  });
  document.getElementById('account-email').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.target);
    perform(async () => {
      const email = data.get('email').trim(), password = data.get('password');
      if (registration) {
        await createUserWithEmailAndPassword(auth,email,password);
        await enter();
        try { await sendEmailVerification(auth.currentUser); feedback('Te hemos enviado un correo. Revisa también la carpeta de spam.'); }
        catch (e) { feedback(message(e)); }
      } else { await signInWithEmailAndPassword(auth,email,password); await enter(); }
    });
  });
}
async function social(providerId, reauth = false) {
  const provider = providerId === 'google.com' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
  provider.addScope('email');
  if (!native()) return reauth ? reauthenticateWithPopup(auth.currentUser,provider) : signInWithPopup(auth,provider);
  if (!window.Capacitor.isPluginAvailable?.('FirebaseAuthentication')) throw Error('Esta instalación necesita actualizarse para acceder con Google o Apple. Puedes utilizar correo y contraseña.');
  const plugin = window.Capacitor.registerPlugin('FirebaseAuthentication');
  const result = await (providerId === 'google.com' ? plugin.signInWithGoogle({skipNativeAuth:true}) : plugin.signInWithApple({skipNativeAuth:true,scopes:['email','name']}));
  const data = result.credential;
  if (!data?.idToken) throw Error('No se ha recibido la confirmación del proveedor.');
  const credential = providerId === 'google.com' ? GoogleAuthProvider.credential(data.idToken,data.accessToken) : provider.credential({idToken:data.idToken,rawNonce:data.nonce});
  const signed = await (reauth ? reauthenticateWithCredential(auth.currentUser,credential) : signInWithCredential(auth,credential));
  return { ...signed, nativeCredential: data };
}
function verifyScreen() {
  shell(`<h2>Confirma tu correo</h2><p>Abre el enlace de verificación enviado a ${esc(auth.currentUser.email || 'tu correo')} y vuelve aquí.</p><button class="btn btn-primary" id="account-verified">Ya he verificado mi correo</button><button class="btn btn-secondary" id="account-resend">Reenviar correo</button><button class="btn btn-ghost" id="account-out">Usar otra cuenta</button>`);
  button('account-verified', async () => { await reload(auth.currentUser); await auth.currentUser.getIdToken(true); await enter(); });
  button('account-resend', async () => { await sendEmailVerification(auth.currentUser); feedback('Correo enviado. Revisa también la carpeta de spam.'); });
  button('account-out', async () => { await signOut(auth); authScreen(); });
}
function setupScreen() {
  shell(`<h2>Crea tu perfil</h2><p>Empiezas de cero. Tu alias y avatar aparecerán junto a tus aciertos en el ranking social.</p><form id="account-profile"><label>Alias público<input name="alias" required minlength="2" maxlength="24" autocomplete="nickname" placeholder="¿Cómo quieres aparecer?"></label><label>Avatar<select name="avatar">${Object.entries(avatars).map(([key,value]) => `<option value="${key}">${value} ${key}</option>`).join('')}</select></label><label class="account-check"><input name="privacy" type="checkbox" required>He leído la información de privacidad y entiendo que mi alias y puntuación serán visibles para otros jugadores.</label><button class="btn btn-primary" type="submit">Entrar al juego</button></form><button class="btn btn-ghost" id="account-out">Usar otra cuenta</button>`);
  button('account-out', async () => { await signOut(auth); authScreen(); });
  document.getElementById('account-profile').onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.target);
    perform(async () => {
      const alias = data.get('alias').trim();
      if (alias.length < 2 || alias.length > 24 || /[<>\x00-\x1f]/.test(alias)) throw Error('Elige un alias de 2 a 24 caracteres sin símbolos < o >.');
      const u = auth.currentUser, r = refs(u.uid);
      await runTransaction(db, async tx => {
        const existing = await tx.get(r.profile);
        if (existing.exists()) return;
        tx.set(r.profile,{alias,avatar:data.get('avatar'),season,createdAt:serverTimestamp(),privacyVersion:1});
      });
      await enter();
    });
  };
}
function metadata() { try { return JSON.parse(CT.Storage.getItem(META)) || {}; } catch { return {}; } }
function setMeta(dirty) { CT.Storage.setItem(META,JSON.stringify({revision,dirty})); }
function payload() {
  const progress = CT.Storage.getItem(P) || '{}', records = CT.Storage.getItem(R) || '{}';
  const totals = JSON.parse(progress).totals || {};
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {progress,records,hits:count(totals.rankedHits),games:count(totals.rankedGames),season};
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
    tx.set(r.ranking,{alias:profile.alias,avatar:profile.avatar,hits:data.hits,games:data.games,season,updatedAt:serverTimestamp()});
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
async function enter() {
  const u=auth.currentUser;
  if (!u || u.isAnonymous) { authScreen(); return; }
  if (!u.emailVerified) { verifyScreen(); return; }
  if (!await acquireTab(u.uid)) {
    shell('<h2>Tu cuenta está abierta en otra pestaña</h2><p>Cierra la otra pestaña para continuar aquí sin duplicar el progreso.</p><button class="btn btn-primary" id="account-tab">Reintentar</button>');
    button('account-tab',enter);return;
  }
  identity=u;CT.AccountStorage.use(u.uid);
  shell('<p role="status">Abriendo tu perfil…</p>');
  try {
    await u.getIdToken(true);
    const r=refs(u.uid), p=await getDocFromServer(r.profile);
    if (!p.exists()) { setupScreen(); return; }
    profile=p.data();
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
    shell('<h2>No hemos podido abrir tu progreso</h2><p>Necesitas conexión para recuperar tu cuenta. Tus datos no se han sustituido.</p><button class="btn btn-primary" id="account-load">Reintentar</button><button class="btn btn-ghost" id="account-out">Usar otra cuenta</button>');
    feedback(message(error));button('account-load',enter);button('account-out',async () => { await signOut(auth);location.reload(); });
  }
}
function accountCard() {
  return `<div class="account-card"><strong>${avatars[profile?.avatar] || '🧭'} ${esc(profile?.alias || '')}</strong><span>${metadata().dirty ? "Hay cambios pendientes de guardar en tu cuenta." : "Tu progreso está sincronizado con esta cuenta."}</span><div class="account-actions"><button class="btn btn-secondary" data-account-action="ranking">Ranking social</button><button class="btn btn-secondary" data-account-action="sync">Guardar ahora</button><button class="btn btn-ghost" data-account-action="logout">Cerrar sesión</button><button class="btn btn-ghost" data-account-action="delete">Eliminar cuenta</button></div></div>`;
}
async function ranking() {
  await flush();
  if (failedConflict) return;
  const snap=await getDocsFromServer(query(collection(db,'socialRanking'),orderBy('hits','desc'),limit(50)));
  CT.openDialog(`<div class="overlay"><section class="modal"><h2>Ranking social</h2><p>Aciertos personales en solitario y varios móviles. Las partidas pasando un móvil no puntúan. Resultados enviados por los jugadores, sin validación competitiva.</p><table class="account-ranking"><thead><tr><th>Puesto</th><th>Jugador</th><th>Aciertos</th></tr></thead><tbody>${snap.docs.map((d,i)=>{const v=d.data();return `<tr><td>${i+1}</td><td>${avatars[v.avatar] || '🧭'} ${esc(v.alias)}${d.id===identity.uid?' · tú':''}</td><td>${Number(v.hits)||0}</td></tr>`;}).join('') || '<tr><td colspan="3">Todavía no hay resultados. ¡Estrena el ranking!</td></tr>'}</tbody></table><p>Primeros 50 jugadores. Las igualdades no se consideran un desempate competitivo.</p><button class="btn btn-primary" data-account-action="close">Cerrar</button></section></div>`,true);
}
async function logout() {
  if (CT.isSessionActive?.()) throw Error('Termina o sal de la partida antes de cerrar sesión.');
  await flush();if (failedConflict) return;
  stopStorage?.();ready=false;
  if (native() && window.Capacitor.isPluginAvailable?.('FirebaseAuthentication')) await window.Capacitor.registerPlugin('FirebaseAuthentication').signOut();
  await signOut(auth);location.reload();
}
function deleteScreen() {
  if (CT.isSessionActive?.()) throw Error('Sal de la partida antes de eliminar la cuenta.');
  CT.openDialog(`<div class="overlay"><section class="modal"><h2>Eliminar mi cuenta</h2><p>Se borrarán tu perfil, progreso y entrada en el ranking. Esta acción no se puede deshacer. Primero confirma tu identidad.</p>${auth.currentUser.providerData.some(p=>p.providerId==='password')?'<label>Contraseña actual<input id="account-confirm-password" type="password" autocomplete="current-password"></label>':''}<button class="btn btn-ghost" data-account-action="delete-confirm">Confirmar y eliminar</button><button class="btn btn-primary" data-account-action="close">Cancelar</button><p id="account-delete-message" role="status"></p></section></div>`,true);
}
async function removeAccount() {
  const u=auth.currentUser, providers=u.providerData.map(p=>p.providerId);
  if (providers.includes('password')) {
    const pass=document.getElementById('account-confirm-password').value;
    await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,pass));
  } else {
    const providerId=providers.includes('apple.com')?'apple.com':'google.com';
    const result=await social(providerId,true);
    if (providerId==='apple.com') {
      if (native() && window.Capacitor.getPlatform() === 'ios') {
        const code=result.nativeCredential?.authorizationCode;
        if (!code) throw Error('No se pudo obtener la autorización para revocar Apple. Vuelve a intentarlo.');
        await window.Capacitor.registerPlugin('FirebaseAuthentication').revokeAccessToken({token:code});
      } else {
        const token=native() ? result.nativeCredential?.accessToken : OAuthProvider.credentialFromResult(result)?.accessToken;
        if (!token) throw Error('No se pudo revocar el acceso de Apple. Vuelve a intentarlo.');
        await revokeAccessToken(auth,token);
      }
    }
  }
  clearTimeout(timer);stopStorage?.();if (saving) await saving;
  const r=refs(u.uid), batch=writeBatch(db);
  batch.delete(r.ranking);batch.delete(r.progress);batch.delete(r.profile);await batch.commit();
  active=false;
  try { await deleteUser(u); } catch(error) { active=true; throw error; }
  CT.AccountStorage.clear();ready=false;location.reload();
}
export async function startAccounts(callback) {
  startGame=callback;
  CT.Accounts={get ready(){return ready;},get user(){return identity;},get profile(){return profile;},card:accountCard,flush};
  await auth.authStateReady();
  onAuthStateChanged(auth,u=>{
    if (active && (!u || u.uid!==identity?.uid || u.isAnonymous)) {
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
    if(busy)return;busy=true;target.disabled=true;
    const fn={ranking,sync:flush,logout,delete:deleteScreen,'delete-confirm':removeAccount}[action];
    Promise.resolve().then(fn).catch(error=>{
      const text=message(error), el=document.getElementById('account-delete-message');
      if(el)el.textContent=text;else if(!failedConflict)syncNotice(text);
    }).finally(()=>{busy=false;target.disabled=false;});
  });
  await enter();
}
