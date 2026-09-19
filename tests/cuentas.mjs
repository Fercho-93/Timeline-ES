import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=name=>fs.readFileSync(name,'utf8');
function setup(user=null,seed={}){
 const dom=new JSDOM('<main id="app"></main>',{url:'https://example.com',runScripts:'outside-only'}),w=dom.window;
 const data=new Map(Object.entries(seed));
 w.CONTINUUM={escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),Scene:{apply(){}},Storage:{getItem:k=>w.localStorage.getItem(k),setItem:(k,v)=>{w.localStorage.setItem(k,v);return true;},removeItem:k=>w.localStorage.removeItem(k),notice(){}},isSessionActive:()=>false};
 w.eval(read('a11y.js'));
 w.eval(read('account-storage.js'));
 const auth={currentUser:user,authStateReady:async()=>{}};w.auth=auth;w.db={};
 const snap=key=>({exists:()=>data.has(key),data:()=>data.get(key)});
 Object.assign(w,{collection:(_,name)=>name,query:(...args)=>args,orderBy:()=>null,limit:()=>null,getDocsFromServer:async()=>({docs:[...data].filter(([k])=>k.startsWith('dailyRanking/')).map(([k,v])=>({id:k.split('/')[1],data:()=>v}))}),browserLocalPersistence:{},setPersistence:async()=>{},signInAnonymously:async()=>{auth.currentUser={uid:'guest',isAnonymous:true,getIdToken:async()=>''};return {user:auth.currentUser};},doc:(_,col,id)=>`${col}/${id}`,getDocFromServer:async key=>snap(key),serverTimestamp:()=>123,onAuthStateChanged:()=>{},runTransaction:async(_,fn)=>{
  const pending=[];const result=await fn({delete:key=>pending.push([key,null]),get:async key=>snap(key),set:(key,value)=>pending.push([key,value])});for(const [k,v]of pending)v===null?data.delete(k):data.set(k,v);return result;
 }});
 let source=read('accounts.js').replace(/^import .*;\n/gm,'').replace('export async function startAccounts','async function startAccounts');
 w.eval(source+'\nwindow.testAccounts={startAccounts,enter,flush,rename,editNameScreen};');
 return {w,dom,auth,data};
}
const user=id=>({uid:id,emailVerified:false,email:null,isAnonymous:true,getIdToken:async()=>'',providerData:[]});
const profile={alias:'Fer',avatar:'compass',season:'launch-1',privacyVersion:1};
{
 const {w,dom,auth,data}=setup();let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,1);assert.equal(auth.currentUser.uid,'guest');assert.equal(w.CONTINUUM.Accounts.ready,true);
 assert.match(data.get('playerProfiles/guest').alias,/^Player \d{4}$/);
 assert.equal(w.document.querySelector('#account-email'),null);
 const alias=data.get('playerProfiles/guest').alias;
 await w.testAccounts.enter();assert.equal(started,1);assert.equal(data.get('playerProfiles/guest').alias,alias);
 assert.doesNotMatch(w.CONTINUUM.Accounts.card(),/Cerrar sesión|Continuar con Google|Contraseña/);
 dom.window.close();
}
{
 const {w,dom,auth}=setup();w.signInAnonymously=async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});};
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,0);assert.equal(auth.currentUser,null);assert.ok(w.document.querySelector('#account-load'));dom.window.close();
}
{
 // Sin conexión de verdad (navigator.onLine === false, no solo un fallo puntual del
 // servicio) no hay invitado que crear, pero el resto del juego no necesita ninguno:
 // entra igual en vez de quedarse en la pantalla de reintentar.
 const {w,dom}=setup();
 Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});
 w.signInAnonymously=async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});};
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,1,'entra sin cuenta en vez de bloquear el arranque');
 assert.equal(w.CONTINUUM.Accounts,undefined,'sin cuenta: el resto de la app juega sin CT.Accounts, como cuando accounts.js no llega a cargar');
 assert.equal(w.document.querySelector('#account-load'),null);
 dom.window.close();
}
{
 // El caso real reportado: un invitado que ya existía de antes (auth.currentUser ya
 // está, signInAnonymously no hace falta) pero sin conexión para reabrir su progreso —
 // se quedaba en "Necesitas conexión para abrir tu invitado" sin dejar jugar a nada,
 // ni siquiera al modo sin conexión.
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':profile});
 Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});
 w.auth.currentUser.getIdToken=async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});};
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,1,'entra sin cuenta en vez de quedarse pidiendo conexión para el progreso');
 assert.equal(w.CONTINUUM.Accounts,undefined);
 assert.equal(w.document.querySelector('#account-load'),null);
 assert.equal(data.get('playerProfiles/a').alias,profile.alias,'el perfil guardado no se toca');
 dom.window.close();
}
{
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':profile});let started=0;
 w.localStorage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:999}}));
 await w.testAccounts.startAccounts(()=>started++);assert.equal(started,1);assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),'{}');
 w.CONTINUUM.Storage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:9,games:4,rankedHits:500,rankedGames:200,dailyHits:5,dailyGames:2}}));await w.testAccounts.flush();
 assert.equal(data.get('playerProgress/a').revision,1);assert.equal(data.get('dailyRanking/a').hits,5);
 w.testAccounts.editNameScreen();w.document.getElementById('account-alias').value='Fulanito';await w.testAccounts.rename();
 assert.equal(data.get('playerProfiles/a').alias,'Fulanito');assert.equal(data.get('dailyRanking/a').alias,'Fulanito');
 assert.equal(data.get('dailyRanking/a').hits,5);assert.equal(w.CONTINUUM.Storage.getItem('hilo-nombre-v1'),'Fulanito');
 w.testAccounts.editNameScreen();w.document.getElementById('account-alias').value='<bad>';await assert.rejects(w.testAccounts.rename());
 data.set('playerNames/ocupado',{uid:'someone-else'});
 w.document.getElementById('account-alias').value='OCUPADO';await assert.rejects(w.testAccounts.rename(),/ya está en uso/);
 assert.equal(data.get('playerNames/fulanito').uid,'a');
 assert.equal(data.has('playerNames/fer'),false);
 assert.equal(data.get('playerProfiles/a').alias,'Fulanito');w.CONTINUUM.closeDialog();
 assert.equal(w.localStorage.getItem('hilo-perfil-v1'),JSON.stringify({totals:{hits:999}}));
 w.CONTINUUM.AccountStorage.use('b');assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),null);w.CONTINUUM.AccountStorage.use('a');
 // A simultaneous device update must never be overwritten.
 data.set('playerProgress/a',{...data.get('playerProgress/a'),revision:2,hits:20});
 w.CONTINUUM.Storage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:10,games:4,dailyHits:6,dailyGames:2}}));
 await assert.rejects(w.testAccounts.flush());assert.equal(data.get('playerProgress/a').hits,20);assert.equal(w.CONTINUUM.Accounts.ready,false);assert.ok(w.document.querySelector('#account-cloud'));
 dom.window.close();
}
{
 const p=JSON.stringify({totals:{hits:42}});const {w,dom}=setup(user('a'),{'playerProfiles/a':profile,'playerProgress/a':{progress:p,records:'{}',revision:4}});
 await w.testAccounts.startAccounts(()=>{});assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),p);dom.window.close();
}
{
 const {w,dom}=setup(user('a'),{'playerProfiles/a':profile,'dailyRanking/b':{alias:'Luna',avatar:'star',hits:12},'dailyRanking/c':{alias:'Atlas',avatar:'globe',hits:9},'dailyRanking/d':{alias:'Marco',avatar:'book',hits:7},'dailyRanking/a':{alias:'Fer',avatar:'compass',hits:5}});
 await w.testAccounts.startAccounts(()=>{});
 w.document.getElementById('app').innerHTML=w.CONTINUUM.Accounts.card();
 const click=async action=>{w.document.querySelector(`[data-account-action="${action}"]`).click();await new Promise(r=>setTimeout(r,0));};
 await click('edit-name');
 assert.ok(w.document.querySelector('[role="dialog"] #account-alias'));
 await click('close');assert.equal(w.document.querySelector('[role="dialog"]'),null);
 await click('ranking');assert.match(w.document.querySelector('[role="dialog"]').textContent,/Fer/);
 assert.equal(w.document.querySelectorAll('.ranking-medallion').length,3);
 assert.equal(w.document.querySelectorAll('.ranking-medallion-1').length,1);
 assert.ok(w.document.querySelector('.account-ranking .is-you .ranking-you'));
 await click('close');assert.equal(w.document.querySelector('[role="dialog"]'),null);
 await click('delete');assert.ok(w.document.querySelector('[role="dialog"] [data-account-action="delete-confirm"]'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(w.document.querySelector('[role="dialog"]'),null);
 dom.window.close();
}
{
 const {w,dom}=setup(user('a'),{'playerProfiles/a':profile});let daily=0;
 w.CONTINUUM.localNavigate=action=>{if(action==='daily')daily++;};
 await w.testAccounts.startAccounts(()=>{});w.document.getElementById('app').innerHTML=w.CONTINUUM.Accounts.card();
 w.document.querySelector('[data-account-action="ranking"]').click();await new Promise(r=>setTimeout(r,0));
 assert.ok(w.document.querySelector('.ranking-empty [data-account-action="daily"]'));
 w.document.querySelector('[data-account-action="daily"]').click();
 assert.equal(daily,1);assert.equal(w.document.querySelector('[role="dialog"]'),null);
 dom.window.close();
}
assert.match(read('index.html'),/src="boot.js"/);assert.doesNotMatch(read('index.html'),/src="app.js"/);
assert.doesNotMatch(read('online.js'),/signInAnonymously/);
console.log('Invitados: alta automática, reentrada, error de conexión, cambio de nombre, ranking, aislamiento y conflictos correctos.');
