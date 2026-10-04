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
 w.eval(read('avatares.js'));
 const auth={currentUser:user,authStateReady:async()=>{}};w.auth=auth;w.db={};
 const snap=key=>({exists:()=>data.has(key),data:()=>data.get(key)});
 Object.assign(w,{collection:(_,...parts)=>parts.join('/'),query:(...args)=>args,orderBy:()=>null,limit:()=>null,getDocsFromServer:async q=>{const base=(typeof q[0]==='string'?q[0]:'dailyRanking');return {docs:[...data].filter(([k])=>k.startsWith(base+'/')&&k.split('/').length===base.split('/').length+1).map(([k,v])=>({id:k.split('/').pop(),data:()=>v}))};},browserLocalPersistence:{},setPersistence:async()=>{},signInAnonymously:async()=>{auth.currentUser={uid:'guest',isAnonymous:true,getIdToken:async()=>''};return {user:auth.currentUser};},doc:(_,...parts)=>parts.join('/'),getDocFromServer:async key=>snap(key),serverTimestamp:()=>123,onAuthStateChanged:()=>{},runTransaction:async(_,fn)=>{
  const pending=[];const result=await fn({delete:key=>pending.push([key,null]),get:async key=>snap(key),set:(key,value)=>pending.push([key,value])});for(const [k,v]of pending)v===null?data.delete(k):data.set(k,v);return result;
 }});
 let source=read('accounts.js').replace(/^import .*;\n/gm,'').replace('export async function startAccounts','async function startAccounts');
 w.eval(source+'\nwindow.testAccounts={startAccounts,enter,flush,rename,editNameScreen};');
 return {w,dom,auth,data};
}
const hoy=new Date().toLocaleDateString('sv-SE'), lunes=(()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d.toLocaleDateString('sv-SE');})();
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
 assert.match(w.CONTINUUM.Accounts.card(),/data-account-action="apple" disabled/);
 dom.window.close();
}
{
 // Sin conexión de verdad, detectada por el error que devuelve Firebase, no por
 // navigator.onLine (JSDOM lo deja en `true` por defecto — el mismo valor incorrecto
 // que reporta Chrome en Android cuando el Wi-Fi está encendido para el propio punto
 // de acceso, sin salida a internet: ese fue el caso real que se quedaba bloqueado).
 // No hay invitado que crear, pero el resto del juego no necesita ninguno: entra igual
 // en vez de quedarse en la pantalla de reintentar.
 const {w,dom,auth}=setup();w.signInAnonymously=async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});};
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,1,'entra sin cuenta en vez de bloquear el arranque');
 assert.equal(auth.currentUser,null);
 assert.equal(w.CONTINUUM.Accounts,undefined,'sin cuenta: el resto de la app juega sin CT.Accounts, como cuando accounts.js no llega a cargar');
 assert.equal(w.document.querySelector('#account-load'),null);
 dom.window.close();
}
{
 // El caso real reportado: un invitado que ya existía de antes (auth.currentUser ya
 // está, signInAnonymously no hace falta) pero sin conexión para reabrir su progreso —
 // se quedaba en "Necesitas conexión para abrir tu invitado" sin dejar jugar a nada, ni
 // siquiera al modo sin conexión. El error de Firebase en un Android real resultó no
 // llevar ninguno de los códigos "de red" que se habían anticipado (ver más abajo el
 // motivo de fondo: sin código reconocido en absoluto, sin `navigator.onLine`, nada) —
 // así que aquí se simula justo eso: un error sin ningún código, para comprobar que
 // sigue entrando de todos modos.
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':profile});
 w.auth.currentUser.getIdToken=async()=>{throw Error('fallo sin código reconocible');};
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,1,'entra sin cuenta en vez de quedarse pidiendo conexión para el progreso');
 assert.equal(w.CONTINUUM.Accounts,undefined);
 assert.equal(w.document.querySelector('#account-load'),null);
 assert.equal(data.get('playerProfiles/a').alias,profile.alias,'el perfil guardado no se toca');
 dom.window.close();
}
{
 // Un perfil de otra temporada sí es un problema real de cuenta, no de red: debe
 // seguir bloqueando con su propio aviso en vez de entrar sin cuenta en silencio.
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':{...profile,season:'otra-temporada'}});
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,0,'no entra: una temporada distinta no es falta de conexión');
 assert.notEqual(w.CONTINUUM.Accounts,undefined);
 assert.ok(w.document.querySelector('#account-load'));
 dom.window.close();
}
{
 // Un fallo que de verdad no es de red (aquí, cualquier otro código de error) sigue
 // bloqueando con su aviso de siempre: la detección no puede volverse tan floja que
 // esconda un fallo real del servicio como si fuera falta de conexión.
 const {w,dom,auth}=setup();w.signInAnonymously=async()=>{throw Object.assign(Error('bloqueado'),{code:'auth/operation-not-allowed'});};
 let started=0;await w.testAccounts.startAccounts(()=>started++);
 assert.equal(started,0);assert.equal(auth.currentUser,null);assert.ok(w.document.querySelector('#account-load'));dom.window.close();
}
{
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':profile});let started=0;
 w.localStorage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:999}}));
 await w.testAccounts.startAccounts(()=>started++);assert.equal(started,1);assert.equal(w.CONTINUUM.Storage.getItem('hilo-perfil-v1'),'{}');
 w.CONTINUUM.Storage.setItem('hilo-retos-v1',JSON.stringify({retoDiario:{days:{[hoy]:{hits:7,total:10,finishedAt:'2026-01-01T10:00:00.000Z',ms:123000},'2000-01-03':{hits:9,total:10}}}}));
 w.CONTINUUM.Storage.setItem('hilo-perfil-v1',JSON.stringify({totals:{hits:9,games:4,rankedHits:500,rankedGames:200,dailyHits:5,dailyGames:2}}));await w.testAccounts.flush();
 assert.equal(data.get('playerProgress/a').revision,1);
 // Las tablas de hoy y de esta semana llevan los aciertos del reto; un día de otra semana no suma.
 assert.equal(data.get(`dailyScores/${hoy}/players/a`).hits,7);assert.equal(data.get(`dailyScores/${hoy}/players/a`).finishedAt,'2026-01-01T10:00:00.000Z');
 assert.equal(data.get(`weeklyScores/${lunes}/players/a`).hits,7);
 assert.equal(data.get(`dailyScores/${hoy}/players/a`).ms,123000,'lo que tardó en el reto desempata');assert.equal(data.get(`weeklyScores/${lunes}/players/a`).ms,123000);
 assert.equal(data.get('playerProgress/a').dayHits,7);assert.equal(data.get('playerProgress/a').weekHits,7);
 w.testAccounts.editNameScreen();w.document.getElementById('account-alias').value='Fulanito';await w.testAccounts.rename();
 assert.equal(data.get('playerProfiles/a').alias,'Fulanito');assert.equal(data.get(`dailyScores/${hoy}/players/a`).alias,'Fulanito');
 assert.equal(data.get(`weeklyScores/${lunes}/players/a`).alias,'Fulanito');assert.equal(data.get(`dailyScores/${hoy}/players/a`).hits,7);assert.equal(w.CONTINUUM.Storage.getItem('hilo-nombre-v1'),'Fulanito');
 w.testAccounts.editNameScreen();w.document.getElementById('account-alias').value='<bad>';await assert.rejects(w.testAccounts.rename());
 data.set('playerNames/ocupado',{uid:'someone-else'});
 w.document.getElementById('account-alias').value='OCUPADO';await assert.rejects(w.testAccounts.rename(),/ya está en uso/);
 assert.equal(data.get('playerNames/fulanito').uid,'a');
 assert.equal(data.has('playerNames/fer'),false);
 assert.equal(data.get('playerProfiles/a').alias,'Fulanito');w.CONTINUUM.closeDialog();
 // La identidad del juego (bienvenida y Atlas) cambia el nombre de la cuenta por la
 // misma transacción, sin pasar por el diálogo.
 await w.CONTINUUM.Accounts.renombra('Mengano');
 assert.equal(data.get('playerProfiles/a').alias,'Mengano');assert.equal(data.get('playerNames/mengano').uid,'a');
 await assert.rejects(w.CONTINUUM.Accounts.renombra('Ocupado'),/ya está en uso/);
 assert.equal(data.get('playerProfiles/a').alias,'Mengano');
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
 const {w,dom}=setup(user('a'),{'playerProfiles/a':profile,[`dailyScores/${hoy}/players/b`]:{alias:'Luna',avatar:'star',hits:9,ms:200000,finishedAt:'2026-01-01T08:00:00Z'},[`dailyScores/${hoy}/players/c`]:{alias:'Atlas',avatar:'globe',hits:9,ms:95000,finishedAt:'2026-01-01T09:00:00Z'},[`dailyScores/${hoy}/players/d`]:{alias:'Marco',avatar:'book',hits:7},[`dailyScores/${hoy}/players/a`]:{alias:'Fer',avatar:'compass',hits:5},[`weeklyScores/${lunes}/players/b`]:{alias:'Luna',avatar:'star',hits:40},[`weeklyScores/${lunes}/players/a`]:{alias:'Fer',avatar:'compass',hits:12}});
 await w.testAccounts.startAccounts(()=>{});
 w.document.getElementById('app').innerHTML=w.CONTINUUM.Accounts.card();
 const click=async action=>{w.document.querySelector(`[data-account-action="${action}"]`).click();await new Promise(r=>setTimeout(r,0));};
 // El nombre se cambia desde el Atlas (identidad del juego); la tarjeta de la cuenta ya
 // no lleva ese botón, pero el diálogo de la cuenta sigue funcionando.
 assert.equal(w.document.querySelector('[data-account-action="edit-name"]'),null);
 w.testAccounts.editNameScreen();await new Promise(r=>setTimeout(r,0));
 assert.ok(w.document.querySelector('[role="dialog"] #account-alias'));
 await click('close');assert.equal(w.document.querySelector('[role="dialog"]'),null);
 await click('ranking');assert.match(w.document.querySelector('[role="dialog"]').textContent,/Fer/);
 // A igualdad de aciertos va delante quien tardó menos, aunque terminara más tarde.
 assert.match(w.document.querySelector('.ranking-medallion-1').textContent,/Atlas/);
 assert.match(w.document.querySelector('.ranking-medallion-2').textContent,/Luna/);
 assert.equal(w.document.querySelector('[data-account-action="ranking-day"]').getAttribute('aria-pressed'),'true');
 assert.match(w.document.querySelector('.ranking-medallion-1').textContent,/1 min 35 s/,'se ve lo que tardó');
 assert.ok(w.document.querySelector('[data-account-action="ranking-next"]').disabled,'no hay días futuros');
 // El día anterior: su propia tabla, sin nadie todavía.
 await click('ranking-prev');await new Promise(r=>setTimeout(r,0));
 assert.equal(w.document.querySelectorAll('.ranking-modal').length,1);
 assert.match(w.document.querySelector('.ranking-empty').textContent,/Nadie jugó ese día/);
 assert.equal(w.document.querySelector('[data-account-action="ranking-next"]').disabled,false);
 await click('ranking-next');await new Promise(r=>setTimeout(r,0));
 assert.match(w.document.querySelector('.ranking-medallion-1').textContent,/Atlas/);
 assert.equal(w.document.querySelectorAll('.ranking-medallion').length,3);
 assert.equal(w.document.querySelectorAll('.ranking-medallion .avatar-art img').length,3);
 assert.equal(w.document.querySelectorAll('.ranking-medallion-1').length,1);
 assert.ok(w.document.querySelector('.account-ranking .is-you .ranking-you'));
 // Esta semana: la otra tabla, con su suma de lunes a domingo.
 await click('ranking-week');await new Promise(r=>setTimeout(r,0));
 assert.equal(w.document.querySelectorAll('.ranking-modal').length,1,'cambiar de pestaña no apila diálogos');
 assert.match(w.document.querySelector('.ranking-medallion-1').textContent,/Luna.*40/s);
 assert.match(w.document.querySelector('.ranking-nav span').textContent,/Esta semana/);
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
{
 // El avatar elegido se publica en el perfil y en la fila del ranking, y el ranking dibuja el de cada persona.
 const {w,dom,data}=setup(user('a'),{'playerProfiles/a':{...profile,aliasKey:'fer'},'playerProgress/a':{progress:'{}',records:JSON.stringify({retoDiario:{days:{[hoy]:{hits:3,total:10}}}}),revision:1,season:'launch-1',day:hoy,dayHits:3,week:lunes,weekHits:3},[`dailyScores/${hoy}/players/a`]:{alias:'Fer',avatar:'compass',hits:3},[`dailyScores/${hoy}/players/b`]:{alias:'Bea',avatar:'panda',hits:5}});
 await w.testAccounts.startAccounts(()=>{});
 assert.equal(data.get('playerProfiles/a').avatar,w.CONTINUUM.Avatares.ownId(),'al entrar se publica el avatar de la persona, también el que le tocó sin elegir');
 w.CONTINUUM.Avatares.choose('tigre');await w.CONTINUUM.Accounts.sincronizaAvatar();
 assert.equal(data.get('playerProfiles/a').avatar,'tigre','el elegido se publica');
 assert.equal(data.get(`dailyScores/${hoy}/players/a`).avatar,'tigre','y en su fila del ranking');
 w.CONTINUUM.Avatares.choose('lince');await w.CONTINUUM.Accounts.sincronizaAvatar();
 assert.equal(data.get('playerProfiles/a').avatar,'lince','al cambiarlo se vuelve a publicar');
 w.document.body.insertAdjacentHTML('beforeend','<button data-account-action="ranking"></button>');
 w.document.querySelector('[data-account-action="ranking"]').click();
 await new Promise(r=>setTimeout(r,50));
 const html=w.document.querySelector('.ranking-modal')?.innerHTML||'';
 assert.match(html,/avatars\/panda\.webp/,'se ve el avatar que eligió la otra persona');
 assert.match(html,/avatars\/lince\.webp/,'y el propio');
 assert.match(html,/Por semanas/);
 dom.window.close();
}
{
 // Lo jugado sin conexión (espacio «locked») pasa a una cuenta nueva sin progreso en la nube.
 const {w,dom,data}=setup(user('n'),{});
 w.localStorage.setItem('continuum-account:launch-1:locked:hilo-perfil-v1','{"totals":{"dailyHits":4,"dailyGames":1}}');
 w.localStorage.setItem('continuum-account:launch-1:locked:hilo-retos-v1','{"retoDiario":{"days":{}}}');
 await w.testAccounts.startAccounts(()=>{});
 assert.equal(JSON.parse(data.get('playerProgress/n').progress).totals.dailyHits,4,'el progreso sin conexión es ahora el de la cuenta');
 assert.equal(data.get('playerProgress/n').hits,4,'y cuenta para el ranking');
 assert.equal(w.localStorage.getItem('continuum-account:launch-1:locked:hilo-perfil-v1'),null);
 dom.window.close();
}
{
 // Una cuenta que ya tiene progreso en la nube no lo pierde por lo que haya quedado sin conexión.
 const {w,dom,data}=setup(user('m'),{'playerProfiles/m':{...profile,aliasKey:'fer'},'playerProgress/m':{progress:'{"totals":{"dailyHits":9,"dailyGames":2}}',records:'{}',hits:9,games:2,revision:1,season:'launch-1'}});
 w.localStorage.setItem('continuum-account:launch-1:locked:hilo-perfil-v1','{"totals":{"dailyHits":1,"dailyGames":1}}');
 await w.testAccounts.startAccounts(()=>{});
 assert.equal(JSON.parse(data.get('playerProgress/m').progress).totals.dailyHits,9);
 dom.window.close();
}
assert.match(read('index.html'),/src="boot.js"/);assert.doesNotMatch(read('index.html'),/src="app.js"/);
assert.doesNotMatch(read('online.js'),/signInAnonymously/);
console.log('Invitados: alta automática, reentrada, error de conexión, cambio de nombre, ranking, aislamiento y conflictos correctos.');
