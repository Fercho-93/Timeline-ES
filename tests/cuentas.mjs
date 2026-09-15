import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=name=>fs.readFileSync(name,'utf8');
function setup(user=null,seed={}){
 const dom=new JSDOM('<main id="app"></main>',{url:'https://example.com',runScripts:'outside-only'}),w=dom.window;
 const data=new Map(Object.entries(seed));
 w.CONTINUUM={escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),Scene:{apply(){}},Storage:{getItem:k=>w.localStorage.getItem(k),setItem:(k,v)=>{w.localStorage.setItem(k,v);return true;},removeItem:k=>w.localStorage.removeItem(k),notice(){}},openDialog:html=>w.document.body.insertAdjacentHTML('beforeend',html),closeDialog(){},isSessionActive:()=>false};
 w.eval(read('account-storage.js'));
 const auth={currentUser:user,authStateReady:async()=>{}};w.auth=auth;w.db={};
 const snap=key=>({exists:()=>data.has(key),data:()=>data.get(key)});
 Object.assign(w,{doc:(_,col,id)=>`${col}/${id}`,getDocFromServer:async key=>snap(key),serverTimestamp:()=>123,onAuthStateChanged:()=>{},runTransaction:async(_,fn)=>{
  const pending=[];await fn({get:async key=>snap(key),set:(key,value)=>pending.push([key,value])});for(const [k,v]of pending)data.set(k,v);
 },reload:async()=>{},signOut:async()=>{auth.currentUser=null;},sendEmailVerification:async()=>{},sendPasswordResetEmail:async()=>{},GoogleAuthProvider:class{},OAuthProvider:class{}});
 let source=read('accounts.js').replace(/^import .*;\n/gm,'').replace('export async function startAccounts','async function startAccounts');
 w.eval(source+'\nwindow.testAccounts={startAccounts,enter,flush};');
 return {w,dom,auth,data};
}
const user=id=>({uid:id,emailVerified:true,email:'a@example.com',isAnonymous:false,getIdToken:async()=>'',providerData:[{providerId:'password'}]});
const profile={alias:'Fer',avatar:'compass',season:'launch-1',privacyVersion:1};
{
 const {w,dom}=setup();let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,0);assert.ok(w.document.querySelector('#account-email'));assert.equal(w.CONTINUUM.Accounts.ready,false);dom.window.close();
}
{
 const {w,dom}=setup({...user('a'),emailVerified:false});let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,0);assert.ok(w.document.querySelector('#account-verified'));dom.window.close();
}
{
 const {w,dom}=setup(user('a'));let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,0);assert.ok(w.document.querySelector('#account-profile'));dom.window.close();
}
{
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':profile});let started=0;
 w.localStorage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:999}}));
 await w.testAccounts.startAccounts(()=>started++);assert.equal(started,1);assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),'{}');
 w.CONTINUUM.Storage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:9,games:4,rankedHits:5,rankedGames:2}}));await w.testAccounts.flush();
 assert.equal(data.get('playerProgress/a').revision,1);assert.equal(data.get('socialRanking/a').hits,5);
 assert.equal(w.localStorage.getItem('hilo-perfil-v1'),JSON.stringify({totals:{hits:999}}));
 w.CONTINUUM.AccountStorage.use('b');assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),null);w.CONTINUUM.AccountStorage.use('a');
 // A simultaneous device update must never be overwritten.
 data.set('playerProgress/a',{...data.get('playerProgress/a'),revision:2,hits:20});
 w.CONTINUUM.Storage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:10,games:4,rankedHits:6,rankedGames:2}}));
 await assert.rejects(w.testAccounts.flush());assert.equal(data.get('playerProgress/a').hits,20);assert.equal(w.CONTINUUM.Accounts.ready,false);assert.ok(w.document.querySelector('#account-cloud'));
 dom.window.close();
}
{
 const p=JSON.stringify({totals:{hits:42}});const {w,dom}=setup(user('a'),{'playerProfiles/a':profile,'playerProgress/a':{progress:p,records:'{}',revision:4}});
 await w.testAccounts.startAccounts(()=>{});assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),p);dom.window.close();
}
assert.match(read('index.html'),/src="boot.js"/);assert.doesNotMatch(read('index.html'),/src="app.js"/);
assert.doesNotMatch(read('online.js'),/signInAnonymously/);
console.log('Cuentas: bloqueo inicial, verificación, alta, inicio desde cero, persistencia, aislamiento y conflictos correctos.');
