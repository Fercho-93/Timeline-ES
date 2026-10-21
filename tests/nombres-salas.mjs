// Los nombres que se escriben al crear o unirse a una sala (internet, Retos rápidos y Wi-Fi) los ven los demás
// jugadores: pasan por el mismo filtro de nombres ofensivos y reservados que el perfil (moderacion.js).
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const online = read('online.js'), quick = read('quick-challenges.js'), local = read('local-multiplayer.js');

// Cada punto de entrada de un nombre consulta CT.Moderacion.problema antes de usarlo.
assert.match(online, /const rechazado = CT\.Moderacion\?\.problema\(name\);\s*if \(rechazado\) return showToast\(rechazado\);\s*if \(form\.dataset\.onlineForm === "create"\) createRoom\(name\);/);
assert.match(quick, /const rechazado=CT\.Moderacion\?\.problema\(name\);if\(rechazado\)throw Error\(rechazado\);/);
assert.equal(local.match(/if \(rejectName\(name\)\) return;/g)?.length, 4, 'crear, unirse con código, buscar cerca y escanear');
assert.match(local, /function rejectName\(name\) \{\s*const reason = CT\.Moderacion\?\.problema\(name\);/);

// Y el filtro hace lo que se espera con esos nombres.
const vm = await import('node:vm');
const CT = {};
vm.runInNewContext(read('moderacion.js'), {window: {CONTINUUM: CT}});
for (const malo of ['Hitler', 'p u t a m a d r e', 'Admin', 'Continuum oficial']) assert.ok(CT.Moderacion.problema(malo), `${malo} se rechaza`);
for (const bueno of ['Ana', 'Mario_23', 'Los Cuatro']) assert.equal(CT.Moderacion.problema(bueno), null, `${bueno} se admite`);
console.log('Nombres de sala: internet, Retos rápidos y Wi-Fi pasan por el filtro de moderación: OK');
