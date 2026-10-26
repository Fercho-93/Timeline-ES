import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { CLIENT_VERSION } from "../js/online/public-matchmaking.js";

const source = fs.readFileSync(new URL("../js/online/online.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../js/juego/app.js", import.meta.url), "utf8");
const joinAt = source.indexOf('data-online-form="join"');
const createAt = source.indexOf('data-online-form="create"');

assert.ok(joinAt >= 0, "el formulario para entrar debe existir");
assert.ok(createAt >= 0, "el formulario para crear debe existir");
assert.ok(joinAt < createAt, "entrar en una sala debe aparecer antes que crear una sala");
assert.match(source, /online-entry-invited/, "las invitaciones deben tener un estado visual propio");
assert.equal(CLIENT_VERSION, 42, "la versión mínima debe estar centralizada en js/online/public-matchmaking.js");
assert.match(source, /^import \{ CLIENT_VERSION \} from '\.\/public-matchmaking\.js';$/m, "js/online/online.js usa la versión de js/online/public-matchmaking.js");
assert.doesNotMatch(fs.readFileSync(new URL("../js/online/public-matchmaking-online.js", import.meta.url), "utf8"), /const CLIENT_VERSION\b/, "la partida rápida no declara su propia versión");
// La capacidad de una sala se elige (de 2 a 9): el aviso de sala llena no puede dar una cifra fija.
assert.doesNotMatch(source, /ROOM_FULL: "[^"]*\d/, "el aviso de sala llena no da una cifra fija");
// Quien sale o es expulsado deja sus cartas en el descarte, no en el mazo (local-room.js y removePlayer).
for (const archivo of ["js/online/online.js", "js/sin-conexion/local-multiplayer.js"]) assert.doesNotMatch(fs.readFileSync(new URL(`../${archivo}`, import.meta.url), "utf8"), /cartas (volverán|vuelven) al mazo/, `${archivo} no dice que las cartas vuelven al mazo`);
assert.equal((source.match(/clientVersion: CLIENT_VERSION/g) || []).length, 2, "crear y unirse deben registrar la misma versión");
assert.doesNotMatch(source, /Para usar esta sala, actualizad todos los móviles a v39/, "el aviso no debe seguir mostrando la versión antigua");
assert.match(source, /paint\(`<div class="shell">\$\{header\(\x27<button class="icon-btn" data-online-action="room"/, "la partida debe mostrar un menú de controles de sala");
assert.match(source, /Terminar partida y cerrar sala/, "el anfitrión debe poder terminar y cerrar la sala durante la partida");
assert.match(source, /Salir de la partida/, "un jugador debe poder salir de la partida");
assert.match(source, /roomState\.status === "playing"[\s\S]*?room-connection/, "la presencia debe ocultarse durante la partida");
assert.match(source, /invited || joinOnly \? "" : [\x27`]<form class="panel online-form" data-online-form="create"/, "una invitación no debe mostrar el formulario de creación");
assert.doesNotMatch(source, /\x27<form[^\x27]*\$\{ownName\}/, "el nombre propio del formulario de crear sala debe interpolarse (plantilla, no comillas simples)");

assert.doesNotMatch(appSource, /Volver a mi sala/, "la portada no debe mostrar el acceso rápido a la sala");
assert.match(appSource, /Continuar partida/, "la portada debe conservar la continuación de partidas locales");

console.log("ok  el flujo de entrada prioriza unirse y oculta crear cuando hay invitación");

// Ejecutar el renderizador real sin conectar los tests a una sala de producción.
const w = new JSDOM('<div id="app"></div>', { runScripts: 'outside-only' }).window;
try {
  w.turnSounds = [];
  w.eval(`const appEl = document.getElementById('app');
    const CT = {Effects:{transition:kind=>window.turnSounds.push(kind)}};
    const user = {uid:'yo'};
    const roomState = {players:{otro:{name:'Ana <López>'},yo:{name:'Yo'}}};
    const escapeHtml = s => s.replaceAll('<','&lt;').replaceAll('>','&gt;');
    ${source.slice(source.indexOf('function showTurnChangeSplash('), source.indexOf('function anotaProgreso('))}`);
  const result = (uid, state) => {
    const before = w.turnSounds.length;
    w.showTurnChangeSplash(uid, state);
    assert.deepEqual(w.turnSounds.slice(before), ['turn'], 'el cambio de turno tiene una sola respuesta sonora');
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
assert.match(source, /autoCreate[\s\S]*?createRoom\(profileName\)/, "desde «Crear partida» la sala se crea con el nombre del perfil, sin pedirlo otra vez");

// Mesa pública: se reparten las cartas iniciales que eligió quien la abrió, no siempre 4.
// Se ejecuta el `js/online/online.js` real (sin Firebase) sobre la página del juego.
{
  const { gameHtml } = await import("./game-fixture.mjs");
  const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const html = gameHtml(read("index.html"));
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const win = new JSDOM(html.replace(/<script src="[^"]+"><\/script>/g, ""), { runScripts: "outside-only", url: "https://continuum.test", pretendToBeVisual: true }).window;
  try {
    win.scrollTo = () => {};
    win.Element.prototype.scrollIntoView = () => {};
    win.matchMedia = () => ({ matches: true });
    scripts.forEach(file => win.eval(read(file)));
    const online = read("js/online/online.js").replace(/^import .*;$/gm, "").replace("export async function", "async function");
    win.eval(`(() => {
      const CLIENT_VERSION = ${CLIENT_VERSION};
      const db = {}, doc = (...parts) => parts.slice(1).join('/'), serverTimestamp = () => 0;
      const getDoc = async () => ({ exists: () => false, data: () => undefined }), setDoc = async () => {};
      const onSnapshot = () => () => {}, deleteDoc = async () => {}, writeBatch = () => ({ set() {}, async commit() {} });
      const disableNetwork = async () => {}, enableNetwork = async () => {};
      const runTransaction = async (_db, work) => work({ get: async () => ({ exists: () => true, data: () => window.salaPublica }), update: (_ref, cambios) => { window.reparto = cambios; } });
      ${online}
      window.salaPublica = { roomCode: 'PABCDEFG', matchmaking: 'public', mode: 'history', deckFingerprint: CT.deckFingerprint('history'),
        status: 'lobby', phase: 'lobby', version: 3, capacity: 2, handSize: 6, turnSeconds: 15, hostUid: 'yo', playerOrder: ['yo', 'ana'],
        players: { yo: { name: 'Yo', hand: [], clientVersion: CLIENT_VERSION }, ana: { name: 'Ana', hand: [], clientVersion: CLIENT_VERSION } } };
      user = { uid: 'yo' }; roomCode = 'PABCDEFG'; roomRef = {}; roomState = JSON.parse(JSON.stringify(window.salaPublica));
      renderPublicLobby();
      window.empezarMesa = () => startRoom();
    })()`);
    assert.equal(win.document.getElementById("online-hand-size").value, "6", "la sala de espera pública guarda las cartas iniciales de la mesa");
    assert.match(win.document.querySelector(".public-lobby-head").textContent, /6 cartas iniciales/);
    await win.empezarMesa();
    assert.ok(win.reparto, "la mesa pública empieza");
    assert.equal(win.reparto.handSize, 6, "la mesa pública reparte las cartas que eligió quien la abrió");
    for (const uid of ["yo", "ana"]) assert.equal(win.reparto.players[uid].hand.length, 6);
    console.log("ok  la mesa pública reparte las cartas iniciales que eligió quien la abrió");
  } finally { win.close(); }
}
