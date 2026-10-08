import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read = path => fs.readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const base = 'https://fercho-93.github.io/Timeline-ES/';
let listener, launch;
const CT = {};
const cap = {isNativePlatform:()=>true,registerPlugin:()=>({addListener(_event, callback){listener=callback;},getLaunchUrl:async()=>launch})};
const ctx = vm.createContext({window:{CONTINUUM:CT,Capacitor:cap},URL,URLSearchParams,location:new URL('capacitor://localhost/'),Date,Promise});
vm.runInContext(read('links.js'),ctx);
const routes = [{room:'ABCD2345'},{duelo:'v1|Fer|history|123'},{turnDuel:'a'.repeat(32)},{quickRoom:'ABCD234567'},{quickDuel:'eyJ2IjozfQ'}];
for (const target of routes) {
  const invitation = CT.Links.invitation(target);
  assert.equal(new URL(invitation).origin + new URL(invitation).pathname,'https://continuumjuego.es/invitation.html');
  assert.deepEqual(plain(CT.Links.parse(invitation)),target);
  assert.deepEqual(plain(CT.Links.parse(CT.Links.nativeUrl(target))),target);
  assert.deepEqual(plain(CT.Links.parse(base+'#'+CT.Links.params(target))),target,'acepta invitaciones antiguas');
  assert.deepEqual(plain(CT.Links.parse(base+'?'+CT.Links.params(target))),target);
}
for (const invalid of ['https://evil.test/#room=ABCD2345','continuum://otro?room=ABCD2345',base+'#quick-room=bad',base+'#room=ABCD2345&quick-room=ABCD2345',base+'#room=ABCD2345&room=BCDE2345',base+'#quick-duel=%3Cscript%3E']) assert.equal(CT.Links.parse(invalid),null);
// «Unirme» acepta el enlace entero, su parte final o el código suelto.
for (const target of routes) {
  assert.deepEqual(plain(CT.Links.fromText('  '+CT.Links.invitation(target)+'\n')),target);
  assert.deepEqual(plain(CT.Links.fromText('https://otro.sitio/juego#'+CT.Links.params(target))),target,'la parte final sirve aunque cambie la dirección');
  assert.deepEqual(plain(CT.Links.fromText(String(CT.Links.params(target)))),target);
}
assert.deepEqual(plain(CT.Links.fromText('abcd 2345')),{room:'ABCD2345'});
assert.deepEqual(plain(CT.Links.fromText('ABCD-234567')),{quickRoom:'ABCD234567'});
assert.deepEqual(plain(CT.Links.fromText('A'.repeat(32))),{turnDuel:'a'.repeat(32)});
for (const nothing of ['', 'hola', 'ABCD1234', 'CTL1:{}', 'https://evil.test/#room=ABCD2345&room=BCDE2345']) assert.equal(CT.Links.fromText(nothing),null,nothing);
launch = {url:CT.Links.nativeUrl(routes[3])};
const delivered=[];
CT.Links.start(target=>delivered.push(plain(target)));
await new Promise(resolve=>setImmediate(resolve));
listener(launch);
assert.deepEqual(delivered,[routes[3]],'arranque en frío no duplica la invitación');
listener({url:CT.Links.nativeUrl(routes[4])});
assert.deepEqual(delivered,[routes[3],routes[4]],'app abierta recibe también el duelo completo');

// Ejecutar la pantalla real sin Firebase ni almacenamiento del navegador.
for (const target of routes) {
  const dom = new JSDOM(read('invitation.html'),{url:CT.Links.invitation(target),runScripts:'outside-only'});
  dom.window.eval(read('links.js'));dom.window.eval(read('invitation.js'));
  const button=dom.window.document.getElementById('open-app');
  assert.equal(button.hidden,false);
  assert.deepEqual(plain(CT.Links.parse(button.href)),target);
  assert.equal(dom.window.localStorage.length,0,'no crea un perfil web');
  dom.window.close();
}
assert.doesNotMatch(read('invitation.html'),/firebase|accounts\.js|boot\.js/);
let redirected;
vm.runInNewContext(read('boot.js'),{window:{CONTINUUM:CT},location:{href:base+'#quick-room=ABCD234567',replace:url=>redirected=url}});
assert.equal(redirected,CT.Links.invitation(routes[3]),'invitación antigua sale antes de iniciar cuentas');

// Ejecutar el receptor real de app.js. El UID ya autenticado se conserva.
const app = read('app.js');
const routeSource=app.slice(app.indexOf('  function openInvitation(target) {'),app.indexOf('  const params = new URLSearchParams(location.hash',app.indexOf('  function openInvitation(target) {')));
const opened=[];let active=false, receiver;
const currentUser={uid:'usuario-app-existente'};
vm.runInNewContext(routeSource,{CT:{Links:{start:fn=>receiver=fn},isSessionActive:()=>active,UI:{confirmDialog(_message,fn){fn();}},TurnDuel:{open:options=>opened.push(['turn',options.gameId,currentUser.uid])},Duelo:{descodificar:()=>({ok:true,duelo:'validado'})}},quickChallenges:target=>opened.push(['quick',plain(target),currentUser.uid]),launchOnline:code=>opened.push(['room',code,currentUser.uid]),turnDuelReady:Promise.resolve(),selectedModeKey:'history',home(){},duelIntro:()=>opened.push(['duel',currentUser.uid]),duelInvalido(){}});
for(const target of routes) {active=!active;receiver(target);}
await new Promise(resolve=>setImmediate(resolve));
assert.equal(opened.length,5);
assert.ok(opened.every(entry=>entry.includes(currentUser.uid)),'todos los modos usan la sesión existente');
assert.match(read('app.js'),/if \(target\?\.quickRoom \|\| target\?\.quickDuel\) CT\.Quick\.open\(render, target\)/,'invitación tiene prioridad sobre el menú guardado');
assert.match(read('ios/App/App/Info.plist'),/<string>continuum<\/string>/);
assert.match(read('android/app/src/main/AndroidManifest.xml'),/android:scheme="continuum" android:host="invite"/);
console.log('OK: cinco tipos de invitación, app cerrada/abierta, sin perfil web y sesión nativa conservada.');
