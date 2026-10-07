import { auth, db } from './firebase-client.js';
import { signInAnonymously, setPersistence, browserLocalPersistence, deleteUser, onAuthStateChanged, OAuthProvider, linkWithCredential, signInWithCredential, signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { doc, getDocFromServer, runTransaction, serverTimestamp, writeBatch, collection, query, orderBy, limit, getDocsFromServer } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const app = document.getElementById('app');
const esc = CT.escapeHtml;
const season = CT.AccountStorage.season;
const P = 'hilo-perfil-v1', R = 'hilo-retos-v1', META = 'continuum-cloud-v1';
let identity = null, profile = null, ready = false, active = false, busy = false;
let startGame, stopStorage, timer, saving, suppress = false, change = 0, revision = 0;
let failedConflict = false, lockedUid = null;
let appleNativeEnabled = false, appleTester = false, authChanging = false;
const appleUser = u => !!u?.providerData?.some(p => p.providerId === 'apple.com');
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
// El ranking tiene dos tablas: la del reto de hoy y la de esta semana (de lunes a domingo). Cada día y cada
// semana es una colección propia, así que el lunes todo el mundo empieza de cero sin borrar nada.
const dayScore = (uid, key) => doc(db,'dailyScores',key,'players',uid);
const weekScore = (uid, key) => doc(db,'weeklyScores',key,'players',uid);
const DAILY_MAX = 10, DAY_MS = 86400000;
const shiftKey = (key, days) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + days); return dateKey(d); };
const dateKey = date => date.toLocaleDateString('sv-SE');
// Aciertos de hoy y de esta semana, leídos de los retos diarios guardados. Solo se suman aciertos:
// un reto vale de 0 a 10 y la semana, como mucho, 70.
function periods(records, now = new Date()) {
  const today = dateKey(now), monday = new Date(now);
  monday.setHours(12,0,0,0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const weekKey = dateKey(monday), days = records?.retoDiario?.days || {};
  const hitsOf = entry => Math.max(0, Math.min(DAILY_MAX, Number.isSafeInteger(entry?.hits) ? entry.hits : 0));
  // Lo que se tardó en cada reto desempata. Un reto jugado antes de medirlo cuenta como diez minutos.
  const msOf = entry => Math.max(0, Math.min(DAY_MS, Number.isSafeInteger(entry?.ms) ? entry.ms : 600000));
  const hoy = days[today], semana = Object.keys(days).filter(key => key >= weekKey && key <= today);
  return {
    today, weekKey,
    day: hoy ? today : '', dayHits: hoy ? hitsOf(hoy) : 0, dayMs: hoy ? msOf(hoy) : 0, finishedAt: String(hoy?.finishedAt || '').slice(0, 40),
    week: semana.length ? weekKey : '', weekHits: Math.min(DAILY_MAX * 7, semana.reduce((n, key) => n + hitsOf(days[key]), 0)),
    weekMs: semana.reduce((n, key) => n + msOf(days[key]), 0)
  };
}
function readRecords() { try { return JSON.parse(CT.Storage.getItem(R) || '{}'); } catch { return {}; } }
// ¿Aparece quien juega en el ranking público? Se pregunta al terminar su primer reto diario y la respuesta
// viaja con su progreso (dentro de los retos), así que vale en cualquier móvil con la misma cuenta. Sin
// decidir, no se publica nada: ni aciertos, ni tiempo, ni nombre.
const rankingPublico = () => { const v = readRecords().rankingPublico; return v === true ? true : v === false ? false : null; };
let rankingPreguntado = false;
// La cuenta con la que se ha vinculado el invitado (Apple o Google), si la hay.
const PROVIDERS = {'apple.com':'Apple','google.com':'Google'};
const linkedProvider = u => u?.providerData?.map(p => p.providerId).find(id => PROVIDERS[id]) || null;
function message(error) {
  const texts = {
    'auth/operation-not-allowed':'Este método de acceso aún no está activado en Firebase. Contacta con soporte.',
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
// Sin argumento lee el diálogo de la tarjeta; con él, lo llama la identidad del juego
// (bienvenida y Atlas) con el nombre ya elegido.
// Las filas de hoy y de esta semana que ya tiene quien juega, para cambiarles el nombre o el avatar en la
// misma transacción que el perfil. Solo las que corresponden al progreso guardado: las reglas comprueban
// que la fila coincide con él.
async function scoreRows(tx, uid) {
  const s = await tx.get(refs(uid).progress), data = s.exists() ? s.data() : {};
  const rows = [];
  for (const ref of [data.day && dayScore(uid, data.day), data.week && weekScore(uid, data.week)].filter(Boolean)) {
    const row = await tx.get(ref);
    if (row.exists()) rows.push([ref, row.data()]);
  }
  return rows;
}
async function rename(aliasArg) {
  const desdeDialogo = typeof aliasArg !== 'string';
  const alias = (desdeDialogo ? document.getElementById('account-alias').value : aliasArg).trim();
  if (alias === profile?.alias) return;
  validateAlias(alias);
  const aliasKey=nameKey(alias);
  if (alias.length < 2 || alias.length > 24 || /[<>\x00-\x1f]/.test(alias)) throw Error('Elige un nombre de 2 a 24 caracteres sin símbolos < o >.');
  await flush();
  if (failedConflict) return;
  const r=refs(identity.uid);
  await runTransaction(db,async tx => {
    const p=await tx.get(r.profile), rank=await tx.get(r.ranking), reservation=await tx.get(nameRef(aliasKey));
    const tablas=await scoreRows(tx, identity.uid);
    if(reservation.exists() && reservation.data().uid!==identity.uid) throw Error('Este nombre de usuario ya está en uso. Elige otro.');
    if (!p.exists()) throw Error('No se ha encontrado tu perfil. Vuelve a abrir el juego.');
    const previous=p.data().aliasKey;
    tx.set(nameRef(aliasKey),{uid:identity.uid});
    tx.set(r.profile,{...p.data(),alias,aliasKey});
    if(previous && previous!==aliasKey) tx.delete(nameRef(previous));
    if (rank.exists()) tx.set(r.ranking,{...rank.data(),alias,updatedAt:serverTimestamp()});
    for (const [ref, row] of tablas) tx.set(ref,{...row,alias,updatedAt:serverTimestamp()});
  });
  profile={...profile,alias,aliasKey};
  CT.Storage.setItem('hilo-nombre-v1',alias);
  const card=document.querySelector('.account-card');
  if(card) card.outerHTML=accountCard();
  if (desdeDialogo) CT.closeDialog();
}
// El avatar que se ve en el ranking es el que cada persona eligió, no uno calculado. Se guarda en
// el perfil (y en su fila del ranking, si la hay) cada vez que cambia. Si las reglas aún no
// admiten el avatar nuevo, falla en silencio y se reintenta en la próxima apertura.
async function syncAvatar() {
  const wanted = CT.Avatares?.ownId?.();
  if (!identity || !profile || !wanted || wanted === profile.avatar || !CT.Avatares.ids.includes(wanted)) return;
  const r = refs(identity.uid);
  try {
    await runTransaction(db, async tx => {
      const p = await tx.get(r.profile), rank = await tx.get(r.ranking), tablas = await scoreRows(tx, identity.uid);
      if (!p.exists()) return;
      tx.set(r.profile, {...p.data(), avatar: wanted});
      if (rank.exists()) tx.set(r.ranking, {...rank.data(), avatar: wanted, updatedAt: serverTimestamp()});
      for (const [ref, row] of tablas) tx.set(ref, {...row, avatar: wanted, updatedAt: serverTimestamp()});
    });
    profile = {...profile, avatar: wanted};
  } catch { /* sin conexión o reglas sin actualizar: se reintenta al entrar */ }
}
// Solo consulta datos públicos ya permitidos por las reglas; los perfiles son privados.
// Si el rival no tiene fila pública o estamos sin conexión, Avatares conserva el UID.
const avatarReads = new Map();
async function loadAvatars(players) {
  if (!identity) return;
  await Promise.all([...new Set(players)].filter(player => typeof player === 'string' && player && player !== identity.uid).map(player => {
    const old = avatarReads.get(player);
    if (old?.pending) return old.pending;
    if (old && Date.now() - old.at < 60000) return Promise.resolve();
    const entry = { at: Date.now() };
    entry.pending = (async () => {
      try {
        const row = await getDocFromServer(refs(player).ranking);
        const avatar = row.exists() ? row.data().avatar : null;
        if (CT.Avatares?.ids.includes(avatar)) CT.Avatares.rememberUser(player, avatar);
      } catch { /* sin conexión: avatar conocido o alternativa estable por UID */ }
      finally { entry.pending = null; }
    })();
    avatarReads.set(player, entry);
    return entry.pending;
  }));
}
function metadata() { try { return JSON.parse(CT.Storage.getItem(META)) || {}; } catch { return {}; } }
function setMeta(dirty) { CT.Storage.setItem(META,JSON.stringify({revision,dirty})); }
function payload() {
  const progress = CT.Storage.getItem(P) || '{}', records = CT.Storage.getItem(R) || '{}';
  const totals = JSON.parse(progress).totals || {};
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const {day,dayHits,week,weekHits} = periods(readRecords());
  return {progress,records,hits:count(totals.dailyHits),games:count(totals.dailyGames),season,day,dayHits,week,weekHits};
}
// Lo jugado sin conexión antes de tener invitado vive en un espacio aparte («locked»). Si la cuenta
// es nueva y no tiene progreso en la nube, ese progreso pasa a ser el suyo en vez de perderse.
function adoptOffline() {
  const raw = key => { try { return localStorage.getItem(`continuum-account:${season}:locked:${key}`); } catch { return null; } };
  const progress = raw(P), records = raw(R);
  if (!progress && !records) return false;
  suppress = true;
  if (progress) CT.Storage.setItem(P, progress);
  if (records) CT.Storage.setItem(R, records);
  suppress = false;
  revision = 0; change++; setMeta(true);
  try { localStorage.removeItem(`continuum-account:${season}:locked:${P}`); localStorage.removeItem(`continuum-account:${season}:locked:${R}`); } catch { /* ya está copiado */ }
  return true;
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
// Pregunta con el mismo aspecto que el resto de diálogos del juego. Esta pantalla sale antes de que
// cargue el resto de la interfaz, así que no puede depender de `CT.UI`: pinta su propia capa.
function askConfirm(message,title,confirmLabel,proceed) {
  if (CT.UI?.confirmDialog) { CT.UI.confirmDialog(message,proceed,{title,confirmLabel,cancelLabel:'Cancelar'}); return; }
  if (app.querySelector('[data-exit-dialog]')) return;
  const layer=document.createElement('div');layer.className='overlay';layer.dataset.exitDialog='';
  const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  layer.innerHTML=`<div class="modal" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="actions exit-actions"><button class="btn btn-primary btn-block" data-ask-stay>Cancelar</button><button class="btn btn-secondary btn-block" data-ask-ok>${esc(confirmLabel)}</button></div></div>`;
  layer.querySelector('[data-ask-stay]').addEventListener('click',()=>layer.remove());
  layer.querySelector('[data-ask-ok]').addEventListener('click',()=>{layer.remove();proceed();});
  app.append(layer);layer.querySelector('[data-ask-stay]').focus();
}
function conflictScreen() {
  failedConflict = true;
  // No se fusionan totales ni se pisa el otro dispositivo: el usuario elige expresamente.
  ready = false; app.inert = false;
  shell('<h2>Tu progreso cambió en otro dispositivo</h2><p>Hay dos versiones. Puedes descargar una copia de la de este móvil antes de cargar la guardada en tu cuenta. Para evitar duplicados, juega desde un dispositivo cada vez.</p><button class="btn btn-secondary" id="account-copy">Descargar copia de este móvil</button><button class="btn btn-primary" id="account-cloud">Usar el progreso de mi cuenta</button>');
  button('account-copy',downloadProgress);
  button('account-cloud',() => {
    askConfirm('Se sustituirán los cambios pendientes de este móvil por el progreso de tu cuenta.','¿Cargar el progreso de tu cuenta?','Cargar el de mi cuenta',async () => {
      const snap=await getDocFromServer(refs(identity.uid).progress);restoreRemote(snap.exists()?snap.data():null);location.reload();
    });
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
    const who = {alias:profile.alias, avatar:profile.avatar};
    const per = periods(readRecords());
    const publico = rankingPublico() === true;
    if (publico && data.day) tx.set(dayScore(uid,data.day),{...who,hits:data.dayHits,ms:per.dayMs,finishedAt:per.finishedAt,updatedAt:serverTimestamp()});
    if (publico && data.week) tx.set(weekScore(uid,data.week),{...who,hits:data.weekHits,ms:per.weekMs,updatedAt:serverTimestamp()});
  }).then(() => {
    revision=expected+1;setMeta(change !== generation);
    if (!metadata().dirty) document.getElementById('storage-notice')?.remove();
  }).catch(error => { if (error.code === 'account/conflict') conflictScreen(); throw error; }).finally(() => { saving=null; });
  await saving;
}
function schedule(key) {
  if (suppress || ![P,R].includes(key)) return;
  change++;setMeta(true);clearTimeout(timer);
  // Recién terminado un reto diario y sin haber decidido todavía: se pregunta sobre su resultado.
  if (key === R && ready && !rankingPreguntado && rankingPublico() === null && periods(readRecords()).day) {
    rankingPreguntado = true; setTimeout(askRanking, 1800);
  }
  timer=setTimeout(() => flush().catch(e => { if (!failedConflict) syncNotice(message(e)); }),2000);
}
// Adivinar todos los códigos con los que Firebase puede anunciar "sin red" no
// funciona: en un Wi-Fi conectado pero sin salida a internet (justo el caso de un
// punto de acceso sin internet) puede fallar de formas que ninguna lista cubre entera
// —tampoco `navigator.onLine`, que en Chrome para Android dice "conectado" en cuanto
// el Wi-Fi está encendido, aunque sea el propio punto de acceso—. Mejor al revés: una
// lista corta y estable de los problemas de cuenta que sí son reales (y deben seguir
// avisando) y tratar cualquier otra cosa como falta de conexión, que es con mucho el
// motivo más probable de que esto falle.
const ACCOUNT_ERROR_CODES = ['auth/operation-not-allowed', 'auth/too-many-requests', 'permission-denied', 'auth/requires-recent-login', 'account/wrong-season', 'apple/not-authorized'];
function isNetworkError(error) { return !ACCOUNT_ERROR_CODES.includes(error?.code); }
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

async function appleAccess(uid) {
  const snap = await getDocFromServer(doc(db, 'appleBetaTesters', uid));
  return snap.exists() && snap.data().enabled === true;
}
async function prepareApple(u) {
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() && cap.getPlatform?.() === 'ios') {
    try { appleNativeEnabled = (await cap.Plugins?.AppleSignIn?.availability())?.enabled === true; }
    catch { appleNativeEnabled = false; }
  }
  appleTester = false;
  if (appleNativeEnabled || appleUser(u)) appleTester = await appleAccess(u.uid);
  if (appleUser(u) && !appleTester) throw Object.assign(Error('El acceso de Apple está reservado a las pruebas internas de esta beta.'), {code:'apple/not-authorized'});
  // Solo es una ayuda para volver a mostrar el botón tras cerrar sesión, no un permiso.
  if (appleTester) try { localStorage.setItem('continuum-apple-test-device', '1'); } catch {}
}
function appleControls() {
  const signed = appleUser(identity);
  let hint = false;
  try { hint = localStorage.getItem('continuum-apple-test-device') === '1'; } catch {}
  const enabled = appleNativeEnabled && (appleTester || hint);
  return `<section class="account-signin" aria-label="Acceso a tu cuenta"><p>${signed ? 'Cuenta de pruebas con Apple' : 'Durante la beta puedes jugar como invitado.'}</p>
    ${signed ? '<button class="btn btn-secondary" data-account-action="signout">Cerrar sesión de Apple</button>' : `<button class="btn account-apple" data-account-action="apple"${enabled ? '' : ' disabled'} aria-describedby="apple-beta-note">Continuar con Apple</button>`}
    <p id="apple-beta-note">${signed || enabled ? 'Prueba interna. Los datos de la beta podrán reiniciarse antes del lanzamiento.' : 'No disponible en esta fase beta. Continúa como invitado.'}</p>
    <details><summary>Identificador para pruebas internas</summary><code>${esc(identity?.uid || '')}</code></details>
    <p id="account-auth-message" role="status"></p></section>`;
}
// Al vincular una cuenta de Apple o Google que ya tenía progreso propio, se pregunta cuál conservar en vez
// de cambiar sin avisar. Si se elige el de este móvil, se deja apartado (fuera del espacio de cada cuenta)
// para recogerlo tras recargar con la otra cuenta; caduca a los diez minutos.
const HANDOFF = 'continuum-progress-handoff';
function chooseProgress(provider) {
  return new Promise(resolve => {
    const layer = document.createElement('div'); layer.className = 'overlay';
    layer.innerHTML = `<section class="modal" role="alertdialog" aria-modal="true" aria-labelledby="choose-progress-title"><h2 id="choose-progress-title">Esta cuenta de ${esc(PROVIDERS[provider] || 'acceso')} ya tiene progreso</h2>
      <p>¿Con cuál te quedas? El otro se descarta.</p>
      <div class="actions" style="display:grid;gap:10px"><button class="btn btn-primary" data-choose="cuenta">El de mi cuenta</button><button class="btn btn-secondary" data-choose="movil">El de este móvil</button><button class="btn btn-ghost" data-choose="">Cancelar</button></div></section>`;
    layer.addEventListener('click', event => { const b = event.target.closest('[data-choose]'); if (!b) return; layer.remove(); resolve(b.dataset.choose || null); });
    app.append(layer); layer.querySelector('[data-choose="cuenta"]').focus();
  });
}
function takeHandoff() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(HANDOFF) || 'null'); localStorage.removeItem(HANDOFF); } catch { /* sin almacenamiento */ }
  return data && Date.now() - Number(data.at) < 600000 ? data : null;
}
async function signInApple() {
  if (CT.isSessionActive?.()) throw Error('Sal de la partida antes de acceder con Apple.');
  if (!appleNativeEnabled) throw Object.assign(Error('Apple no está habilitado en esta beta.'),{code:'apple/beta-disabled'});
  let hint = false;
  try { hint = localStorage.getItem('continuum-apple-test-device') === '1'; } catch {}
  if (!await appleAccess(identity.uid) && !hint) throw Object.assign(Error('Este invitado no está autorizado para probar Apple.'),{code:'apple/not-authorized'});
  await flush();
  const result = await window.Capacitor.Plugins.AppleSignIn.authorize();
  if (!result?.idToken || !result?.rawNonce) throw Error('Apple no devolvió una identidad válida.');
  const credential = new OAuthProvider('apple.com').credential({idToken:result.idToken,rawNonce:result.rawNonce});
  authChanging = true;
  try {
    let signed;
    try { signed = await linkWithCredential(auth.currentUser, credential); }
    catch (error) {
      if (error.code !== 'auth/credential-already-in-use') throw error;
      // La cuenta ya existía con su propio progreso: se pregunta cuál conservar. Nunca se mezclan.
      const choice = await chooseProgress('apple.com');
      if (!choice) throw Object.assign(Error('Cancelado'), {code:'apple/cancelled'});
      if (choice === 'movil') { const {progress, records} = payload(); try { localStorage.setItem(HANDOFF, JSON.stringify({progress, records, at: Date.now()})); } catch {} }
      signed = await signInWithCredential(auth, credential);
    }
    await signed.user.getIdToken(true);
    if (!await appleAccess(signed.user.uid)) {
      await signOut(auth);
      try { localStorage.setItem('continuum-apple-auth-notice','Esta cuenta Apple no está autorizada para la beta. Has vuelto al acceso de invitado.'); } catch {}
      location.reload();return;
    }
    location.reload();
  } catch (error) {
    authChanging = false;
    // Si Firebase ya cambió de identidad, reabrir su perfil antes de permitir
    // escrituras. Nunca dejar la pantalla del invitado usando otra sesión.
    if (auth.currentUser?.uid !== identity.uid || appleUser(auth.currentUser)) { location.reload();return; }
    throw error;
  }
}
async function signOutApple() {
  if (CT.isSessionActive?.()) throw Error('Sal de la partida antes de cerrar sesión.');
  if (ready) await flush();authChanging = true;
  try { await signOut(auth);location.reload(); }
  catch (error) { authChanging = false;throw error; }
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
    await prepareApple(u);
    const r=refs(u.uid);
    profile=await ensureProfile(u.uid);
    if (profile.season !== season) throw Object.assign(Error('Este perfil pertenece a otra temporada. Contacta con soporte.'),{code:'account/wrong-season'});
    const snap=await getDocFromServer(r.progress), remote=snap.exists()?snap.data():null;
    const meta=metadata();revision=meta.revision || 0;
    const handoff=takeHandoff();
    if (handoff) {
      // Se eligió conservar el progreso del móvil al entrar con una cuenta que ya tenía el suyo.
      suppress=true;CT.Storage.setItem(P,handoff.progress || '{}');CT.Storage.setItem(R,handoff.records || '{}');suppress=false;
      revision=remote?.revision || 0;change++;setMeta(true);await flush();
    } else if (meta.dirty) {
      if (revision !== (remote?.revision || 0)) { conflictScreen(); return; }
      await flush();
    } else if (!remote && adoptOffline()) {
      await flush();
    } else restoreRemote(remote);
    // Un UID compartido con Firebase y un alias guardado para los modos que piden nombre.
    CT.Storage.setItem('hilo-jugador-v1',u.uid);CT.Storage.setItem('hilo-nombre-v1',profile.alias);
    await syncAvatar();
    try { const note=localStorage.getItem('continuum-apple-auth-notice');if(note){localStorage.removeItem('continuum-apple-auth-notice');syncNotice(note);} } catch {}
    ready=true;stopStorage?.();stopStorage=CT.AccountStorage.subscribe(schedule);
    // Quien dijo que no y no tenía conexión al decirlo: se terminan de retirar sus filas.
    if (rankingPublico() === false) void removeRankingRows().catch(() => {});
    if (!active) { active=true;startGame(); }
  } catch (error) {
    if (failedConflict) return;
    if (error.code === 'apple/not-authorized') {
      shell('<h2>Apple está en pruebas internas</h2><p>Esta cuenta todavía no está autorizada para probar Apple. Puedes continuar como invitado.</p><button class="btn btn-primary" data-account-action="signout">Continuar como invitado</button><p id="account-auth-message" role="status"></p>');
      return;
    }
    if (isNetworkError(error)) { offlineFallback(); return; }
    shell('<h2>No hemos podido abrir tu progreso</h2><p>Necesitas conexión para abrir tu invitado. Tus datos no se han sustituido.</p><button class="btn btn-primary" id="account-load">Reintentar</button>');
    feedback(message(error));button('account-load',enter);
  }
}
// Aparecer o dejar de aparecer en el ranking. Al dejarlo se borran las filas de hoy y de esta semana (y la
// antigua tabla única); si no hay conexión, se reintenta al volver a abrir el juego.
async function removeRankingRows() {
  if (!identity) return;
  const uid = identity.uid, per = periods(readRecords());
  await runTransaction(db, async tx => { tx.delete(dayScore(uid, per.today)); tx.delete(weekScore(uid, per.weekKey)); tx.delete(refs(uid).ranking); });
}
async function setRanking(value) {
  const records = readRecords();
  records.rankingPublico = value === true;
  CT.Storage.setItem(R, JSON.stringify(records));
  if (value !== true) await removeRankingRows().catch(() => {});
  await flush().catch(() => {});
  refreshCard();
}
function refreshCard() { const card = document.querySelector('.account-card'); if (card) card.outerHTML = accountCard(); }
function askRanking() {
  if (!ready || rankingPublico() !== null || document.querySelector('.ranking-consent')) return;
  accountDialog(`<div class="overlay"><section class="modal ranking-consent"><h2>¿Quieres aparecer en el ranking?</h2>
    <p>El ranking del reto diario es público: lo ven los demás jugadores. Si aceptas, mostrará tu nombre de perfil, tu avatar, tus aciertos y tu tiempo, del día y de la semana.</p>
    <p class="hint">Puedes cambiarlo cuando quieras en Ajustes o en el Atlas.</p>
    <div class="actions" style="display:grid;gap:10px"><button class="btn btn-primary" data-account-action="ranking-yes">Sí, aparecer en el ranking</button><button class="btn btn-ghost" data-account-action="ranking-no">Ahora no</button></div></section></div>`);
}
function rankingControls() {
  const publico = rankingPublico() === true;
  return `<section class="account-privacy" aria-label="Ranking público"><p><b>Ranking público:</b> ${publico ? 'apareces con tu nombre de perfil, tu avatar, tus aciertos y tu tiempo.' : 'no apareces. Tus resultados solo los ves tú.'}</p>
    <button class="btn btn-secondary" data-account-action="ranking-toggle" aria-pressed="${publico}">${publico ? 'Dejar de aparecer' : 'Aparecer en el ranking'}</button></section>`;
}
function accountText() {
  const provider = linkedProvider(identity);
  if (provider) return `Tu progreso está guardado en tu cuenta de ${PROVIDERS[provider]}. Entrando con ella en otro móvil lo recuperas.`;
  return 'Juegas como invitado: tu progreso se guarda en un servidor (Firebase) ligado a esta instalación, sin correo ni datos personales. Si borras la app o cambias de móvil, normalmente no podrás recuperarlo; algunos móviles lo restauran desde su copia de seguridad.';
}
function accountCard() {
  const stats=payload(), dirty=metadata().dirty;
  return `<div class="account-card">
    <div class="account-hero"><span class="account-kicker">TU CUENTA</span><span class="account-save-state" role="status">${dirty ? '◌ Cambios pendientes' : '✓ Progreso guardado'}</span>
    <div class="account-metrics"><div><b>${stats.day ? `${stats.dayHits}/${DAILY_MAX}` : '–'}</b><span>Reto de hoy</span></div><div><b>${stats.weekHits}</b><span>Aciertos esta semana</span></div></div></div>
    <button class="account-ranking-link" data-account-action="ranking"><span class="account-action-icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v6a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 13v5 M8 21h8 M9 18h6v3H9z"/></svg></span><span><small>EL RETO CONTINÚA</small><b>Ranking de retos diarios</b><span>Hoy y esta semana</span></span><span aria-hidden="true">↗</span></button>
    ${appleControls()}
    <div class="account-actions"><button class="btn btn-secondary" data-account-action="sync"><span aria-hidden="true">↻</span> Guardar ahora</button></div>
    ${rankingControls()}
    <details class="account-details"><summary>Tu cuenta y tus datos</summary><p>${esc(accountText())}</p><a href="privacidad.html" target="_blank" rel="noopener">Privacidad</a><button class="btn btn-ghost account-delete" data-account-action="delete">${appleUser(identity) ? 'Eliminar cuenta y progreso' : 'Eliminar invitado y progreso'}</button></details>
  </div>`;
}
// Qué tabla se está mirando: hoy o esta semana, o un día o una semana anteriores (flechas ‹ ›).
let rankingView = { tab: 'day', key: '', all: false };
const RANKING_PAGE = 50, RANKING_ALL = 200, RANKING_BACK_WEEKS = 8;
function duration(ms) {
  const total = Math.round((Number(ms) || 0) / 1000), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), sec = total % 60;
  return h ? `${h} h ${m} min` : m ? `${m} min ${sec} s` : `${sec} s`;
}
async function ranking(tab = 'day', key = '', all = false) {
  await flush();
  if (failedConflict) return;
  const semana = tab === 'week', uid = identity.uid, per = periods(readRecords());
  const actual = semana ? per.weekKey : per.today, oldest = shiftKey(per.weekKey, -7 * RANKING_BACK_WEEKS);
  key = key && key <= actual && key >= oldest ? key : actual;
  rankingView = { tab: semana ? 'week' : 'day', key, all };
  const snap=await getDocsFromServer(query(collection(db, semana ? 'weeklyScores' : 'dailyScores', key, 'players'),orderBy('hits','desc'),limit(all ? RANKING_ALL : RANKING_PAGE)));
  const hits = v => Number(v.hits) || 0, ms = v => Number.isFinite(Number(v.ms)) ? Number(v.ms) : Infinity;
  const entries=snap.docs.map(d=>({id:d.id,...d.data()}));
  // Más aciertos primero; a igualdad, quien tardó menos. Solo comparten puesto aciertos y tiempo idénticos.
  entries.sort((a,b) => hits(b) - hits(a) || ms(a) - ms(b));
  const position = i => 1 + entries.filter(v => hits(v) > hits(entries[i]) || (hits(v) === hits(entries[i]) && ms(v) < ms(entries[i]))).length;
  const mine=entries.findIndex(v=>v.id===uid);
  const ownSnap=mine<0?await getDocFromServer(semana ? weekScore(uid,key) : dayScore(uid,key)):null;
  const own=mine>=0?entries[mine]:ownSnap?.exists()?{id:uid,...ownSnap.data()}:null;
  const rankAvatar = (v, size) => CT.Avatares.markup(v.alias, { size, seed: 'uid:' + v.id, id: v.id === uid ? CT.Avatares.ownId() : v.avatar });
  const you = v => v.id===uid?'<small class="ranking-you">Tú</small>':'';
  const time = v => Number.isFinite(ms(v)) ? `<small class="ranking-time">${duration(ms(v))}</small>` : '';
  const player=(v,i)=>`<tr class="${v.id===uid?'is-you':''}"><td><span class="ranking-place">${position(i)}</span></td><td><span aria-hidden="true">${rankAvatar(v, 32)}</span> <span class="ranking-name">${esc(v.alias)}</span>${you(v)}</td><td><b>${hits(v)}</b>${time(v)}</td></tr>`;
  const podium=entries.slice(0,3).map((v,i)=>`<article class="ranking-medallion ranking-medallion-${i+1}${v.id===uid?' is-you':''}"><span class="ranking-medal" aria-label="Puesto ${position(i)}">${['Ⅰ','Ⅱ','Ⅲ'][i]}</span><span class="ranking-avatar" aria-hidden="true">${rankAvatar(v, 46)}</span><b>${esc(v.alias)}</b>${you(v)}<strong>${hits(v)}</strong><span>aciertos</span>${time(v)}</article>`).join('');
  const esActual = key === actual;
  const fecha = k => new Date(`${k}T12:00:00`).toLocaleDateString('es-ES', {weekday: semana ? undefined : 'long', day:'numeric', month:'long'});
  const titulo = semana ? (esActual ? 'Esta semana' : `Semana del ${fecha(key)}`) : (esActual ? 'Hoy' : fecha(key).replace(/^./, c => c.toUpperCase()));
  const subtitulo = semana ? `Del lunes ${fecha(key)} al domingo ${fecha(shiftKey(key, 6))}.${esActual ? ' El lunes que viene, todos a cero.' : ''}` : `Aciertos en el reto ${esActual ? 'de hoy' : 'de ese día'}, de 0 a 10. A igualdad, gana quien tardó menos.`;
  const tabs = `<div class="ranking-tabs" role="group" aria-label="Periodo"><button type="button" class="btn ${semana?'btn-secondary':'btn-primary'}" data-account-action="ranking-day" aria-pressed="${!semana}">Por días</button><button type="button" class="btn ${semana?'btn-primary':'btn-secondary'}" data-account-action="ranking-week" aria-pressed="${semana}">Por semanas</button></div>`;
  const nav = `<div class="ranking-nav"><button type="button" class="btn btn-ghost" data-account-action="ranking-prev" aria-label="${semana ? 'Semana anterior' : 'Día anterior'}"${key <= oldest ? ' disabled' : ''}>‹</button><span>${esc(titulo)}</span><button type="button" class="btn btn-ghost" data-account-action="ranking-next" aria-label="${semana ? 'Semana siguiente' : 'Día siguiente'}"${esActual ? ' disabled' : ''}>›</button></div>`;
  const personal = mine>=0 ? `<span>Tu puesto <b>#${position(mine)}</b></span><span><b>${hits(own)}</b> aciertos${time(own)}</span>`
    : own ? `<span>Tu posición <b>Fuera de los ${entries.length} primeros</b></span><span><b>${hits(own)}</b> aciertos</span>`
    : esActual ? (semana ? 'Juega el reto diario para entrar en la tabla de esta semana.' : 'Todavía no has jugado el reto de hoy.') : (semana ? 'No jugaste esa semana.' : 'No jugaste ese día.');
  const vacio = `<div class="ranking-empty"><span aria-hidden="true">✧</span><h3>${esActual ? (semana ? 'La semana acaba de empezar' : 'Nadie ha jugado todavía el reto de hoy') : 'Nadie jugó ' + (semana ? 'esa semana' : 'ese día')}</h3>${esActual ? `<p>${semana ? 'Cada lunes todo el mundo empieza de cero.' : 'Juega el reto y estrena la tabla de hoy.'}</p><button class="btn btn-primary ranking-daily" data-account-action="daily">Jugar el reto de hoy <span aria-hidden="true">→</span></button>` : ''}</div>`;
  const mas = !all && entries.length >= RANKING_PAGE ? `<button type="button" class="btn btn-secondary ranking-more" data-account-action="ranking-more">Ver más</button>` : '';
  if (document.querySelector('.ranking-modal')) CT.closeDialog();
  accountDialog(`<div class="overlay"><section class="modal ranking-modal"><header class="ranking-hero"><span class="account-kicker">CONTINUUM · RETO DIARIO</span><span class="ranking-emblem" aria-hidden="true">✦</span>${tabs}${nav}<h2 class="solo-lectores">${esc(titulo)}</h2><p>${esc(subtitulo)}</p></header>
    <div class="ranking-body"><p class="ranking-public-note">Ranking público: solo aparece quien lo ha decidido, con su nombre de perfil, avatar, aciertos y tiempo.</p>${rankingPublico() === true ? '' : '<div class="ranking-optin"><p>No apareces en esta tabla.</p><button type="button" class="btn btn-secondary" data-account-action="ranking-join">Aparecer en el ranking</button></div>'}${entries.length?`<div class="ranking-podium" aria-label="Los tres primeros">${podium}</div><div class="ranking-personal${own?' has-result':''}">${personal}</div>${entries.length>3?`<table class="account-ranking"><thead><tr><th scope="col">Puesto</th><th scope="col">Explorador</th><th scope="col">Aciertos</th></tr></thead><tbody>${entries.slice(3).map((v,i)=>player(v,i+3)).join('')}</tbody></table>`:''}${mas}`:vacio}
    <details class="account-details ranking-rules"><summary>Cómo funciona</summary><p>Cada día hay un reto de 10 cartas; cada carta bien colocada es un acierto. <b>Por días</b> ordena por los aciertos de ese día; <b>por semanas</b>, por los de lunes a domingo, y cada lunes todo el mundo vuelve a empezar, así que da igual cuándo empezaste a jugar. A igualdad de aciertos gana quien tardó menos en jugar el reto (en la semana, sumando los días).</p><p>Con ‹ › ves quién ganó los días y las semanas anteriores. Solo cuenta el reto diario. Resultados enviados por el juego, sin validación competitiva.</p></details></div>
    <footer class="ranking-footer"><button class="btn btn-primary" data-account-action="close">Cerrar</button></footer></section></div>`,true);
}
function deleteScreen() {
  if (appleUser(identity)) throw Error('El borrado de cuentas Apple de esta prueba requiere revocar el acceso. Solicítalo a feedbackcontinuum@gmail.com. El borrado automático se completará antes del lanzamiento.');
  if (CT.isSessionActive?.()) throw Error('Sal de la partida antes de eliminar el invitado.');
  accountDialog(`<div class="overlay"><section class="modal"><h2>Eliminar invitado y progreso</h2><p>Se borrarán tu perfil, progreso y entrada en el ranking. Esta acción no se puede deshacer. Al volver a entrar se creará un invitado nuevo desde cero.</p><button class="btn btn-ghost" data-account-action="delete-confirm">Eliminar definitivamente</button><button class="btn btn-primary" data-account-action="close">Cancelar</button><p id="account-delete-message" role="status"></p></section></div>`,true);
}
async function removeAccount() {
  const u=auth.currentUser;
  if (appleUser(u)) throw Error('La cuenta Apple necesita revocación antes del borrado.');
  clearTimeout(timer);stopStorage?.();if (saving) await saving;
  const r=refs(u.uid), batch=writeBatch(db);
  if(profile?.aliasKey) batch.delete(nameRef(profile.aliasKey));
  const per=periods(readRecords());batch.delete(dayScore(u.uid,per.today));batch.delete(weekScore(u.uid,per.weekKey));
  batch.delete(r.ranking);batch.delete(doc(db,'socialRanking',u.uid));batch.delete(r.progress);batch.delete(r.profile);await batch.commit();
  active=false;
  try { await deleteUser(u); } catch(error) { active=true; throw error; }
  CT.AccountStorage.clear();ready=false;location.reload();
}
export async function startAccounts(callback) {
  startGame=callback;
  CT.Accounts={get ready(){return ready;},get user(){return identity;},get profile(){return profile;},card:accountCard,flush,rankingDe:(tab)=>ranking(tab),renombra:alias=>rename(alias),sincronizaAvatar:syncAvatar,cargaAvatares:loadAvatars,get rankingPublico(){return rankingPublico();},setRanking};
  await auth.authStateReady();
  await setPersistence(auth,browserLocalPersistence);
  onAuthStateChanged(auth,u=>{
    if (authChanging && u?.uid !== identity?.uid) {
      ready=false;stopStorage?.();clearTimeout(timer);return;
    }
    if (!authChanging && active && (!u || u.uid!==identity?.uid)) {
      ready=false;stopStorage?.();clearTimeout(timer);app.inert=true;location.reload();
    }
  });
  // El interruptor de Ajustes («Aparecer en el ranking público»).
  document.addEventListener('change',event=>{
    const box=event.target.closest?.('[data-ranking-toggle]');if(!box||!ready)return;
    box.disabled=true;setRanking(box.checked).finally(()=>{box.disabled=false;box.checked=rankingPublico()===true;});
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
    const fn={ranking:()=>ranking('day'),'ranking-day':()=>ranking('day'),'ranking-week':()=>ranking('week'),
      'ranking-prev':()=>ranking(rankingView.tab,shiftKey(rankingView.key,rankingView.tab==='week'?-7:-1)),'ranking-next':()=>ranking(rankingView.tab,shiftKey(rankingView.key,rankingView.tab==='week'?7:1)),'ranking-more':()=>ranking(rankingView.tab,rankingView.key,true),sync:async()=>{await flush();const card=document.querySelector('.account-card');if(card)card.outerHTML=accountCard();},apple:signInApple,signout:signOutApple,'ranking-yes':async()=>{CT.closeDialog();await setRanking(true);},'ranking-no':async()=>{CT.closeDialog();await setRanking(false);},'ranking-toggle':()=>setRanking(rankingPublico()!==true),'ranking-join':async()=>{await setRanking(true);await ranking(rankingView.tab,rankingView.key);},'edit-name':editNameScreen,rename,delete:deleteScreen,'delete-confirm':removeAccount}[action];
    Promise.resolve().then(fn).catch(error=>{
      if (error.code === 'apple/cancelled') return;
      const text=message(error), el=document.getElementById('account-auth-message') || document.getElementById('account-delete-message');
      if(el)el.textContent=text;else if(!failedConflict)syncNotice(text);
    }).finally(()=>{busy=false;target.disabled=false;});
  });
  await enter();
}
