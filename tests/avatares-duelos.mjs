import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const values = new Map();
const images = [];
const CT = {
  escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
  Storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
  Accounts: { user: { uid: 'me' } },
  Identidad: { nombre: () => 'Fer' }
};
const context = vm.createContext({window: {CONTINUUM: CT}, document: {querySelectorAll: () => images}, console});
vm.runInContext(read('avatares.js'), context);
const A = CT.Avatares;
const src = html => html.match(/src="([^"]+)"/)[1];
const node = uid => {
  const image = {src: '', setAttribute: (_, value) => {image.src = value;}};
  return {image, getAttribute: () => uid, querySelector: () => image};
};
images.push(node('makelele'), node('makelele'), node('sergio'));

// Un mismo UID conserva avatar entre partidas, tamaños y cambios de alias.
assert.equal(src(A.forUser('Makelele', 'makelele', {size: 44})), src(A.forUser('Otro nombre', 'makelele', {size: 28})));
const chosen = A.ids.find(id => id !== A.idFor('uid:makelele'));
A.rememberUser('makelele', chosen);
assert.equal(images[0].image.src, images[1].image.src);
assert.equal(images[2].image.src, '', 'La carga del rival no modifica a otro jugador');
assert.ok(src(A.forUser('Makelele', 'makelele')).includes(chosen));
A.choose('zorro');
assert.ok(src(A.forUser('Fer', 'me')).includes('zorro'), 'Se conserva el avatar propio elegido');
assert.equal(src(A.forUser('Sin UID', null)), src(A.markup('Sin UID')), 'Las partidas antiguas sin UID conservan alternativa por nombre');

// Dos filas reales con códigos diferentes muestran el mismo rival.
const turnSource = read('duelo-turnos.js');
const rowFunction = turnSource.slice(turnSource.indexOf('function quickRowMarkup('), turnSource.indexOf('function profileMarkup('));
Object.assign(context, {CT, safe: CT.escapeHtml, archivedIds: new Set()});
vm.runInContext(rowFunction, context);
const row = {rival: 'Makelele', rivalUid: 'makelele', grupo: 'su-turno', deck: 'Póker', estado: 'Turno', detalle: 'Carta 3', marcador: '', canResign: true};
const first = context.quickRowMarkup({...row, code: 'AAAAAAAA23'});
const second = context.quickRowMarkup({...row, code: 'BBBBBBBB23'});
assert.equal(src(first), src(second));
assert.ok(src(first).includes(chosen), 'La lista usa la elección pública conocida');

// El marcador real de Retos rápidos usa la misma cuenta que la lista.
const quickSource = read('quick-challenges.js');
const avatarFunction = quickSource.slice(quickSource.indexOf('  function playerAvatar('), quickSource.indexOf('  // Qué significa cada extremo'));
Object.assign(context, {room: {members: ['me', 'makelele']}, myId: 'me', state: {players: [{name: 'Fer'}, {name: 'Makelele'}]}});
vm.runInContext(avatarFunction, context);
assert.equal(src(context.playerAvatar({name: 'Makelele'}, 1)), src(first));
assert.ok(src(context.playerAvatar({name: 'Fer'}, 0)).includes('zorro'));

// La lectura pública se agrupa por UID y actualiza imágenes sin repintar el juego.
const accounts = read('accounts.js');
const resolver = accounts.slice(accounts.indexOf('const avatarReads ='), accounts.indexOf('function metadata()'));
let calls = 0, answer = 'marie-curie', unavailable = false;
Object.assign(context, {
  identity: {uid: 'me'}, refs: player => ({ranking: 'dailyRanking/' + player}),
  getDocFromServer: async () => {calls++; if (unavailable) throw Error('offline'); return {exists: () => !!answer, data: () => ({avatar: answer})};}
});
vm.runInContext(resolver, context);
await Promise.all([context.loadAvatars(['makelele', 'makelele', 'me']), context.loadAvatars(['makelele'])]);
assert.equal(calls, 1, 'Dos duelos no duplican consultas de la misma cuenta');
assert.ok(src(A.forUser('Makelele', 'makelele')).includes('marie-curie'));
assert.ok(images[0].image.src.includes('marie-curie'));
unavailable = true;
await context.loadAvatars(['sergio']);
assert.equal(src(A.forUser('Sergio', 'sergio')), src(A.markup('Sergio', {seed: 'uid:sergio'})), 'Sin conexión se usa el UID estable');
answer = 'compass'; unavailable = false;
await context.loadAvatars(['legacy']);
assert.equal(src(A.forUser('Legacy', 'legacy')), src(A.markup('Legacy', {seed: 'uid:legacy'})), 'Los avatares antiguos no generan rutas inválidas');
assert.match(read('quick-challenges.js'), /forUser\(p.name, room\?\.members\?\.\[i\], \{size:28\}\)/);
assert.doesNotMatch(read('quick-challenges.js'), /seed:'room:'\+room.members/);
assert.doesNotMatch(turnSource, /seed: 'quick:' \+ x.code/);
const cacheVersion = read('service-worker-258.js').match(/const CACHE = "([^"]+)"/)[1];
assert.ok(read('updates.js').includes(cacheVersion), 'La versión visible coincide con la caché nueva');
for (const file of ['avatares.js','accounts.js','duelo-turnos.js','quick-challenges.js']) {
  new vm.Script(read(file).replace(/^import .*;\n/gm, '').replace(/^export /gm, ''), {filename: file});
}
console.log('OK: mismo rival en dos duelos, elección pública, avatar propio, sin UID, sin conexión, consultas agrupadas y sintaxis.');
