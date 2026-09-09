import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../online.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const joinAt = source.indexOf('data-online-form="join"');
const createAt = source.indexOf('data-online-form="create"');

assert.ok(joinAt >= 0, "el formulario para entrar debe existir");
assert.ok(createAt >= 0, "el formulario para crear debe existir");
assert.ok(joinAt < createAt, "entrar en una sala debe aparecer antes que crear una sala");
assert.match(source, /online-entry-invited/, "las invitaciones deben tener un estado visual propio");
assert.match(source, /const CLIENT_VERSION = 40/, "la versión mínima debe estar centralizada");
assert.equal((source.match(/clientVersion: CLIENT_VERSION/g) || []).length, 2, "crear y unirse deben registrar la misma versión");
assert.doesNotMatch(source, /Para usar esta sala, actualizad todos los móviles a v39/, "el aviso no debe seguir mostrando la versión antigua");
assert.ok(source.includes('paint(`<div class="shell">${header("")}'), "la partida no debe mostrar controles de sala en el encabezado");
assert.doesNotMatch(source, /data-online-action="room"[^]*?renderGame/, "la partida no debe incluir el botón de gestión de sala");
assert.match(source, /roomState\.status === "playing"[\s\S]*?room-connection/, "la presencia debe ocultarse durante la partida");
assert.match(source, /invited \? "" : '<form class="panel online-form" data-online-form="create"/, "una invitación no debe mostrar el formulario de creación");

assert.doesNotMatch(appSource, /Volver a mi sala/, "la portada no debe mostrar el acceso rápido a la sala");
assert.match(appSource, /Continuar partida/, "la portada debe conservar la continuación de partidas locales");

console.log("ok  el flujo de entrada prioriza unirse y oculta crear cuando hay invitación");
