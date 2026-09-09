import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../online.js", import.meta.url), "utf8");
const joinAt = source.indexOf('data-online-form="join"');
const createAt = source.indexOf('data-online-form="create"');

assert.ok(joinAt >= 0, "el formulario para entrar debe existir");
assert.ok(createAt >= 0, "el formulario para crear debe existir");
assert.ok(joinAt < createAt, "entrar en una sala debe aparecer antes que crear una sala");
assert.match(source, /online-entry-invited/, "las invitaciones deben tener un estado visual propio");
assert.match(source, /const CLIENT_VERSION = 40/, "la versión mínima debe estar centralizada");
assert.equal((source.match(/clientVersion: CLIENT_VERSION/g) || []).length, 2, "crear y unirse deben registrar la misma versión");
assert.doesNotMatch(source, /UPDATE_CLIENTS.*v39/, "el aviso no debe seguir mostrando la versión antigua");
assert.match(source, /invited \? "" : '<form class="panel online-form" data-online-form="create"/, "una invitación no debe mostrar el formulario de creación");

console.log("ok  el flujo de entrada prioriza unirse y oculta crear cuando hay invitación");
