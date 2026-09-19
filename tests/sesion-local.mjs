// `local-session.js` es la pieza que junta `local-room.js` (las reglas) con
// `local-transport.js` (el canal). La traducción de mensaje a acción (`actionFromMessage`)
// y la sesión del anfitrión se pueden probar sin WebRTC de verdad: solo `invitePeer` (que
// abre una `RTCPeerConnection`) y la sesión de invitado (que abre una nada más crearse)
// lo necesitan, y ahí basta con comprobar que fallan con un motivo claro.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

// Un mazo de juguete, igual que en `tests/sala-local.mjs`: no hace falta cargar ningún
// mazo real para probar el protocolo.
const MODE = "modo-de-prueba";
const CARTAS = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}` }));

function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "https://hilo.test/" });
  dom.window.CONTINUUM = {
    cards: key => (key === MODE ? CARTAS : []),
    sortValue: (key, card) => Number(card.id.split("-")[1]),
    shuffle: cards => [...cards]
  };
  ["engine.js", "local-transport.js", "local-room.js", "local-session.js"].forEach(file => dom.window.eval(read(file)));
  return dom.window;
}

const w = boot();
const Session = w.CONTINUUM.LocalSession;
const intenta = fn => { try { fn(); return null; } catch (e) { return e.message; } };
const intentaAsync = async fn => { try { await fn(); return null; } catch (e) { return e.message; } };

console.log("\nTraducir mensajes del canal a acciones de la sala");
const contexto = { modeKey: MODE, valueOf: id => Number(id.split("-")[1]), shuffle: cards => [...cards], now: () => 42 };
const unirse = Session.actionFromMessage({ type: "join", data: { playerId: "ana", name: "Ana", deckFingerprint: "v1" } }, contexto);
ok("un mensaje de unirse se traduce con quien lo manda", unirse.type === "join" && unirse.playerId === "ana" && unirse.now === 42);
const empezar = Session.actionFromMessage({ type: "start", data: { playerId: "host", handSize: 4, starterId: "host" } }, contexto);
ok("empezar reparte un mazo ya barajado, no vacío", empezar.type === "start" && empezar.deck.length === CARTAS.length);
const colocar = Session.actionFromMessage({ type: "place-card", data: { playerId: "ana", cardId: "c-3", index: 1 } }, contexto);
ok("colocar carta lleva quién juega, no quién lo pidió", colocar.type === "place-card" && colocar.playerId === "ana" && typeof colocar.valueOf === "function");
const expulsar = Session.actionFromMessage({ type: "remove-player", data: { playerId: "host", targetId: "ana" } }, contexto);
ok("expulsar lleva quién lo pide y a quién afecta, por separado", expulsar.requesterId === "host" && expulsar.targetId === "ana");
ok("un tipo de mensaje que no existe se rechaza en vez de intentarlo", intenta(() => Session.actionFromMessage({ type: "lo-que-sea", data: {} }, contexto)) === "UNKNOWN_ACTION");

console.log("\nEl anfitrión: crear la sala y jugar sus propias jugadas");
let ultimoEstado = null;
const host = Session.createHostSession({ roomCode: "LOC001", hostName: "Fer", modeKey: MODE, deckFingerprint: "v1", now: () => 1000, onChange: room => { ultimoEstado = room; } });
ok("crear la sesión ya avisa del estado inicial", ultimoEstado?.status === "lobby" && ultimoEstado.hostId === Session.HOST_ID);
ok("saltar turno antes de jugar se rechaza igual que en el reductor", intenta(() => host.act("skip-turn")) === "NOT_ALLOWED");
// El anfitrión no puede empezar solo: hacen falta dos, igual que en `online.js`.
ok("el anfitrión solo no puede empezar la partida", intenta(() => host.act("start", { handSize: 4, starterId: Session.HOST_ID })) === "INVALID_START");

console.log("\nEl anfitrión: solo abre conexiones de verdad al invitar");
const motivoInvitar = await intentaAsync(() => host.invitePeer());
ok("invitar a alguien sí necesita WebRTC, y falla con un motivo claro en Node", motivoInvitar === "WEBRTC_UNAVAILABLE");

console.log("\nEl invitado: manda acciones, nunca las resuelve por su cuenta");
ok("un invitado sin conexión real falla igual al intentar unirse", intenta(() => Session.createGuestSession({ offerSignal: "loquesea", playerId: "ana", name: "Ana", onChange: () => {}, onError: () => {} })) !== null);

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
