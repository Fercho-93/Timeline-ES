import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const read = file => fs.readFileSync(file, 'utf8');
function setup({enabled = true, ios = true, apple = false} = {}) {
  const dom = new JSDOM('<main id="app"></main>', {url:'https://example.com', runScripts:'outside-only', virtualConsole:new VirtualConsole()});
  const w = dom.window, data = new Map();
  w.CONTINUUM = {escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),Storage:{getItem:k=>w.localStorage.getItem(k),setItem:(k,v)=>w.localStorage.setItem(k,v),removeItem:k=>w.localStorage.removeItem(k)},isSessionActive:()=>false,Scene:{apply(){}}};
  for (const file of ['a11y.js','account-storage.js','avatares.js']) w.eval(read(file));
  const u = {uid:'guest',isAnonymous:!apple,providerData:apple?[{providerId:'apple.com'}]:[],getIdToken:async()=>''};
  const auth = {currentUser:u,authStateReady:async()=>{}};
  let listener;
  const calls = {authorize:0,link:0,login:0,logout:0,reauth:0,revoke:[],deleted:0,batch:0};
  data.set('playerProfiles/guest',{alias:'Player 1234',avatar:'compass',season:'launch-1',privacyVersion:1});
  w.Capacitor = {isNativePlatform:()=>ios,getPlatform:()=>ios?'ios':'web',Plugins:{AppleSignIn:{availability:async()=>({enabled}),authorize:async()=>{calls.authorize++;return {idToken:'apple-token',rawNonce:'random-request-nonce',authorizationCode:'codigo-apple'};}}}};
  const snap = key => ({exists:()=>data.has(key),data:()=>data.get(key)});
  Object.assign(w,{auth,db:{},appleReloads:0,browserLocalPersistence:{},setPersistence:async()=>{},signInAnonymously:async()=>({user:u}),onAuthStateChanged:(_,fn)=>{listener=fn;},doc:(_,...parts)=>parts.join('/'),getDocFromServer:async key=>snap(key),serverTimestamp:()=>123,
    runTransaction:async(_,fn)=>fn({get:async key=>snap(key),set:(key,value)=>data.set(key,value),delete:key=>data.delete(key)}),
    OAuthProvider:class {constructor(id){assert.equal(id,'apple.com');}credential(value){assert.equal(value.rawNonce,'random-request-nonce');return value;}static credentialFromError(error){return error.credential||null;}},
    linkWithCredential:async(user,credential)=>{calls.link++;assert.equal(credential.idToken,'apple-token');user.providerData=[{providerId:'apple.com'}];user.isAnonymous=false;listener?.(user);return {user};},
    signInWithCredential:async(_,credential)=>{calls.login++;assert.equal(credential.idToken,'credencial-de-la-cuenta','nunca se reutiliza el token de Apple ya gastado al vincular');if(w.loginFails)throw Error('falla');auth.currentUser={...u,uid:'existing-apple',providerData:[{providerId:'apple.com'}]};listener?.(auth.currentUser);return {user:auth.currentUser};},
    signOut:async()=>{calls.logout++;auth.currentUser=null;listener?.(null);},
    reauthenticateWithCredential:async(user,credential)=>{calls.reauth++;assert.equal(credential.idToken,'apple-token');},
    revokeAccessToken:async(_,code)=>{calls.revoke.push(code);if(w.revokeFails)throw Error('sin red al revocar');},
    deleteUser:async()=>{calls.deleted++;},
    writeBatch:()=>({set(){},delete(){},update(){},commit:async()=>{calls.batch++;}})
  });
  const source=read('accounts.js').replace(/^import .*;\n/gm,'').replace('export async function startAccounts','async function startAccounts').replaceAll('location.reload()','window.appleReloads++');
  w.eval(source+'\nwindow.appleTest={startAccounts,signInApple,signOutApple,deleteScreen,removeAccount};');
  return {w,dom,data,auth,calls};
}
// Al vincular una cuenta que ya tenía progreso, el juego pregunta cuál conservar.
async function conEleccion(w, choice) {
  const pending = w.appleTest.signInApple();
  for (let i = 0; i < 50 && !w.document.querySelector('[data-choose]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector(`[data-choose="${choice}"]`).click();
  return pending;
}
{
  // Sin Apple en el dispositivo (web, Android): se juega como invitado y no hay botón.
  const {w,dom,calls}=setup({enabled:false});await w.appleTest.startAccounts(()=>{});
  assert.doesNotMatch(w.CONTINUUM.Accounts.card(),/data-account-action="apple"/);
  await assert.rejects(w.appleTest.signInApple(),/disponible/);assert.equal(calls.authorize,0);dom.window.close();
}
{
  // Cualquier invitado de iPhone puede entrar con Apple: ya no hace falta estar autorizado.
  const {w,dom}=setup();await w.appleTest.startAccounts(()=>{});
  assert.match(w.CONTINUUM.Accounts.card(),/data-account-action="apple">Continuar con Apple/);
  assert.doesNotMatch(w.CONTINUUM.Accounts.card(),/prueba|beta|autorizad/i);dom.window.close();
}
{
  const {w,dom,calls}=setup();await w.appleTest.startAccounts(()=>{});
  w.Capacitor.Plugins.AppleSignIn.authorize=async()=>{throw Object.assign(Error('cancelado'),{code:'apple/cancelled'});};
  await assert.rejects(w.appleTest.signInApple(),/cancelado/);assert.equal(calls.link,0);assert.equal(w.auth.currentUser.isAnonymous,true);dom.window.close();
}
{
  const {w,dom,calls,auth}=setup();await w.appleTest.startAccounts(()=>{});await w.appleTest.signInApple();
  assert.equal(calls.link,1);assert.equal(auth.currentUser.uid,'guest');assert.equal(w.appleReloads,1);
  assert.equal(w.document.getElementById('app').inert,undefined,'el observador no recarga durante el cambio de sesión');
  assert.equal(w.localStorage.getItem('apple-token'),null);dom.window.close();
}
{
  const {w,dom,calls}=setup();await w.appleTest.startAccounts(()=>{});
  w.linkWithCredential=async()=>{throw Object.assign(Error('existente'),{code:'auth/credential-already-in-use',credential:{idToken:'credencial-de-la-cuenta'}});};
  await conEleccion(w,'cuenta');assert.equal(calls.login,1);assert.equal(calls.logout,0);
  assert.equal(w.auth.currentUser.uid,'existing-apple');assert.equal(w.localStorage.getItem('continuum-apple-auth-notice'),null);dom.window.close();
}
{
  const {w,dom,data,calls}=setup();await w.appleTest.startAccounts(()=>{});
  w.linkWithCredential=async()=>{throw Object.assign(Error('existente'),{code:'auth/credential-already-in-use',credential:{idToken:'credencial-de-la-cuenta'}});};
  await conEleccion(w,'cuenta');assert.equal(calls.login,1);assert.equal(calls.logout,0);assert.equal(w.auth.currentUser.uid,'existing-apple');
  assert.equal(w.localStorage.getItem('continuum-progress-handoff'),null,'quedarse con el de la cuenta no aparta nada');dom.window.close();
}
{
  // Quedarse con el progreso del móvil: se aparta para subirlo a la cuenta tras recargar.
  const {w,dom,data,calls}=setup();await w.appleTest.startAccounts(()=>{});
  w.CONTINUUM.Storage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:42}}));
  w.linkWithCredential=async()=>{throw Object.assign(Error('existente'),{code:'auth/credential-already-in-use',credential:{idToken:'credencial-de-la-cuenta'}});};
  await conEleccion(w,'movil');assert.equal(calls.login,1);
  assert.match(JSON.parse(w.localStorage.getItem('continuum-progress-handoff')).progress,/"hits":42/);dom.window.close();
}
{
  // Cancelar la elección no cambia de cuenta.
  const {w,dom,calls}=setup();await w.appleTest.startAccounts(()=>{});
  w.linkWithCredential=async()=>{throw Object.assign(Error('existente'),{code:'auth/credential-already-in-use',credential:{idToken:'credencial-de-la-cuenta'}});};
  await assert.rejects(conEleccion(w,''),/Cancelado/);assert.equal(calls.login,0);assert.equal(w.auth.currentUser.uid,'guest');dom.window.close();
}
{
  const {w,dom}=setup();await w.appleTest.startAccounts(()=>{});
  w.auth.currentUser.getIdToken=async()=>{throw Error('sin red después de vincular');};
  await w.appleTest.signInApple();assert.equal(w.appleReloads,1,'un cambio ya aplicado se reabre, nunca reutiliza el perfil anterior');dom.window.close();
}
{
  const {w,dom,calls}=setup({apple:true});await w.appleTest.startAccounts(()=>{});
  assert.match(w.CONTINUUM.Accounts.card(),/data-account-action="signout"/);assert.doesNotMatch(w.CONTINUUM.Accounts.card(),/data-account-action="apple"/);
  await w.appleTest.signOutApple();assert.equal(calls.logout,1);dom.window.close();
}
{
  // Eliminar una cuenta de Apple: Apple confirma, se revoca el acceso y solo entonces se borran los datos.
  const {w,dom,calls}=setup({apple:true});await w.appleTest.startAccounts(()=>{});
  w.appleTest.deleteScreen();assert.match(w.document.body.textContent+w.document.getElementById('app').textContent,/Apple te pedirá confirmar/);
  await w.appleTest.removeAccount();
  assert.equal(calls.authorize,1);assert.equal(calls.reauth,1);assert.deepEqual(calls.revoke,['codigo-apple']);
  assert.equal(calls.batch,1);assert.equal(calls.deleted,1);dom.window.close();
}
{
  // Si Apple no puede revocar, no se borra nada: la persona puede reintentarlo.
  const {w,dom,calls}=setup({apple:true});await w.appleTest.startAccounts(()=>{});w.revokeFails=true;
  await assert.rejects(w.appleTest.removeAccount(),/revocar/);assert.equal(calls.batch,0);assert.equal(calls.deleted,0);dom.window.close();
}
{
  // Sin código de autorización no se puede revocar: se aborta antes de borrar.
  const {w,dom,calls}=setup({apple:true});await w.appleTest.startAccounts(()=>{});
  w.Capacitor.Plugins.AppleSignIn.authorize=async()=>({idToken:'apple-token',rawNonce:'random-request-nonce'});
  await assert.rejects(w.appleTest.removeAccount(),/No se ha borrado nada/);assert.equal(calls.batch,0);assert.equal(calls.deleted,0);dom.window.close();
}
{
  // Si entrar con la cuenta existente falla, no queda apartado el progreso del móvil.
  const {w,dom}=setup();await w.appleTest.startAccounts(()=>{});
  w.linkWithCredential=async()=>{throw Object.assign(Error('existente'),{code:'auth/credential-already-in-use',credential:{idToken:'credencial-de-la-cuenta'}});};
  w.loginFails=true;await assert.rejects(conEleccion(w,'movil'),/falla/);
  assert.equal(w.localStorage.getItem('continuum-progress-handoff'),null);dom.window.close();
}
console.log('Apple: abierto a todos, vinculación, reentrada, salida y borrado con revocación correctos.');
