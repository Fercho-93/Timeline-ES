import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const source = fs.readFileSync(new URL("../online.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const joinAt = source.indexOf('data-online-form="join"');
const createAt = source.indexOf('data-online-form="create"');

assert.ok(joinAt >= 0, "el formulario para entrar debe existir");
assert.ok(createAt >= 0, "el formulario para crear debe existir");
assert.ok(joinAt < createAt, "entrar en una sala debe aparecer antes que crear una sala");
assert.match(source, /online-entry-invited/, "las invitaciones deben tener un estado visual propio");
assert.match(source, /const CLIENT_VERSION = 42/, "la versión mínima debe estar centralizada");
assert.equal((source.match(/clientVersion: CLIENT_VERSION/g) || []).length, 2, "crear y unirse deben registrar la misma versión");
assert.doesNotMatch(source, /Para usar esta sala, actualizad todos los móviles a v39/, "el aviso no debe seguir mostrando la versión antigua");
assert.match(source, /paint\(`<div class="shell">\$\{header\(\x27<button class="icon-btn" data-online-action="room"/, "la partida debe mostrar un menú de controles de sala");
assert.match(source, /Terminar partida y cerrar sala/, "el anfitrión debe poder terminar y cerrar la sala durante la partida");
assert.match(source, /Salir de la partida/, "un jugador debe poder salir de la partida");
assert.match(source, /roomState\.status === "playing"[\s\S]*?room-connection/, "la presencia debe ocultarse durante la partida");
assert.match(source, /invited \? "" : '<form class="panel online-form" data-online-form="create"/, "una invitación no debe mostrar el formulario de creación");

assert.doesNotMatch(appSource, /Volver a mi sala/, "la portada no debe mostrar el acceso rápido a la sala");
assert.match(appSource, /Continuar partida/, "la portada debe conservar la continuación de partidas locales");

console.log("ok  el flujo de entrada prioriza unirse y oculta crear cuando hay invitación");

// Ejecutar el renderizador real sin conectar los tests a una sala de producción.
const w = new JSDOM('<div id="app"></div>', { runScripts: 'outside-only' }).window;
try {
  w.eval(`const appEl = document.getElementById('app');
    const user = {uid:'yo'};
    const roomState = {players:{otro:{name:'Ana <López>'},yo:{name:'Yo'}}};
    const escapeHtml = s => s.replaceAll('<','&lt;').replaceAll('>','&gt;');
    ${source.slice(source.indexOf('function showTurnChangeSplash('), source.indexOf('function anotaProgreso('))}`);
  const result = (uid, state) => {
    w.showTurnChangeSplash(uid, state);
    assert.equal(w.document.querySelectorAll('[data-turn-change-splash]').length, 1);
    return w.document.querySelector('[data-turn-change-splash]').textContent;
  };
  const reveal = correct => ({phase:'reveal', reveal:{playerUid:'yo',correct}});
  assert.match(result('otro', reveal(true)), /¡Carta bien colocada!/);
  assert.match(result('otro', reveal(false)), /Turno completado/);
  assert.match(result('otro', {phase:'turn'}), /Cambio de turno/);
  assert.doesNotMatch(result('otro', {phase:'turn'}), /perdido|bien colocada/);
  assert.match(result('yo', reveal(true)), /Ahora te toca a ti/);
  assert.doesNotMatch(result('otro', null), /perdido|bien colocada/);
  assert.match(result('otro', {phase:'reveal',reveal:{playerUid:'tercero',correct:true}}), /Cambio de turno/);
  assert.match(w.document.body.textContent, /Ana <López>/);
  console.log('ok  acierto, fallo, salto, reconexión y espectadores tienen avisos coherentes');
} finally { w.close(); }
