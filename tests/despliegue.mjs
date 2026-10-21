// `deployment.js`: qué plataformas tienen App Check y, con ello, pueden abrir salas cuando el juego sea público.
// El caso que importa: pasar `audience` a «public» no debe cerrar las salas del iPhone (que tiene App Attest).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const CT = {};
vm.runInNewContext(read('deployment.js'), {window: {CONTINUUM: CT}});
const d = CT.Deployment;
const nativa = platform => ({isNativePlatform: () => true, getPlatform: () => platform});
assert.equal(d.salasProtegidas(undefined), true, 'la web tiene reCAPTCHA');
assert.equal(d.salasProtegidas({isNativePlatform: () => false}), true);
assert.equal(d.salasProtegidas(nativa('ios')), true, 'el iPhone tiene App Attest');
assert.equal(d.salasProtegidas(nativa('android')), false, 'Android aún no tiene Play Integrity');
assert.ok(Object.isFrozen(d));
// online.js usa esa pregunta, no «es nativa», para decidir si abre salas en una versión pública.
const online = read('online.js');
assert.match(online, /config\?\.audience === 'public' && !config\.salasProtegidas\?\.\(window\.Capacitor\)/);
assert.doesNotMatch(online, /appCheckSiteKey \|\| window\.Capacitor\?\.isNativePlatform/);
// El sonido del iPhone respeta el interruptor de silencio, como dice Ajustes («En iPhone respetan el modo silencio»).
const delegado = read('ios/App/App/AppDelegate.swift');
assert.match(delegado, /setCategory\(\.ambient, mode: \.default, options: \[\.mixWithOthers\]\)/);
assert.doesNotMatch(delegado, /setCategory\(\.playback/, 'la categoría «playback» ignora el interruptor de silencio');
console.log('Despliegue: App Check por plataforma, las salas del iPhone no dependen de la audiencia: OK');
