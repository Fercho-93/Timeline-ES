// Competición sin internet: la sala Wi-Fi (`local-room.js`) lleva varios temas al azar, uno
// por ronda, con las mismas reglas que la sala online (`online.js`): puntos por ronda,
// cambio de mazo entre temas, sin minijuego desde la segunda ronda (empieza el siguiente de
// la mesa) y sin que entre nadie nuevo con la competición empezada.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "https://hilo.test/" });
const w = dom.window;
w.CONTINUUM = { escapeHtml: String, mode: key => ({ name: key }) };
["engine.js", "ghost.js", "local-room.js", "tournament.js"].forEach(file => w.eval(read(file)));
const Room = w.CONTINUUM.LocalRoom;
const intenta = fn => { try { fn(); return null; } catch (e) { return e.message; } };
const ctx = { valueOf: id => Number(String(id).split("-")[1]), shuffle: cards => [...cards], random: () => 0, now: 1 };
const act = (state, type, extra) => Room.reduce(state, { type, ...ctx, ...extra });
const mazo = (prefix, n = 12) => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
const tournament = { queue: ["alfa", "beta"], index: 0, history: [], handSize: 2 };

console.log("\nCrear la competición");
let sala = Room.createRoom({ roomCode: "ABC123", hostId: "host", hostName: "Fer", modeKey: "historia", deckFingerprint: "fp-alfa", tournament, now: 1 });
ok("la sala juega el primer tema de la competición", sala.mode === "alfa" && sala.tournament.index === 0);
ok("y reparte las cartas por persona de la competición", sala.handSize === 2);
sala = act(sala, "join", { playerId: "ana", name: "Ana" });
ok("se puede entrar antes de empezar", sala.playerOrder.join() === "host,ana");

console.log("\nPrimer tema: con minijuego, como siempre");
ok("sin minijuego no empieza", intenta(() => act(sala, "start", { requesterId: "host", handSize: 5, order: ["host", "ana"], deck: mazo("a") })) === "STARTER_PENDING");
sala = act(sala, "starter-draw", { requesterId: "host", cardId: "a-99" });
sala = act(sala, "starter-guess", { playerId: "host", value: 1 });
sala = act(sala, "starter-guess", { playerId: "ana", value: 2 });
sala = act(sala, "start", { requesterId: "host", handSize: 5, order: ["host", "ana"], deck: mazo("a") });
ok("empieza con las cartas de la competición, no con las que pida el ajuste", sala.status === "playing" && sala.players.host.hand.length === 2 && sala.players.ana.hand.length === 2);

// La ronda acaba: Fer se queda sin cartas y Ana con las dos.
sala = { ...sala, status: "ended", phase: "finished", winner: "host", winners: ["host"], players: { ...sala.players, host: { ...sala.players.host, hand: [] } } };
ok("la revancha no tiene sentido a mitad de competición", intenta(() => act(sala, "rematch", { requesterId: "host" })) === "NOT_ALLOWED");
ok("solo quien organiza pasa al siguiente tema", intenta(() => act(sala, "competition-next", { requesterId: "ana", deckFingerprint: "fp-beta" })) === "NOT_ALLOWED");

console.log("\nSegundo tema");
sala = act(sala, "competition-next", { requesterId: "host", deckFingerprint: "fp-beta" });
ok("la mesa vuelve a la sala de espera con el mazo del segundo tema", sala.status === "lobby" && sala.mode === "beta" && sala.deckFingerprint === "fp-beta" && sala.tournament.index === 1);
ok("la ronda anterior queda apuntada con las cartas de cada cual", sala.tournament.history.length === 1 && sala.tournament.history[0].mode === "alfa" && sala.tournament.history[0].hands.host === 0 && sala.tournament.history[0].hands.ana === 2);
ok("se limpia la mesa", sala.timeline.length === 0 && sala.deck.length === 0 && sala.players.ana.hand.length === 0);
ok("ya no entra nadie nuevo", intenta(() => act(sala, "join", { playerId: "luis", name: "Luis" })) === "ALREADY_STARTED");
ok("es una ronda posterior", Room.laterRound(sala));
sala = act(sala, "start", { requesterId: "host", handSize: 5, deck: mazo("b") });
ok("empieza sin minijuego y el turno inicial rota al siguiente de la mesa", sala.status === "playing" && sala.playerOrder[0] === "ana" && sala.timeline[0].startsWith("b-"));
sala = { ...sala, status: "ended", phase: "finished", winner: "ana", winners: ["ana"], players: { ...sala.players, ana: { ...sala.players.ana, hand: [] } } };
ok("con el último tema jugado no hay siguiente", intenta(() => act(sala, "competition-next", { requesterId: "host" })) === "NOT_ALLOWED");

console.log("\nMarcador");
const html = w.CONTINUUM.Tournament.board(sala.tournament, sala.playerOrder.map(id => ({ id, name: id === "host" ? "Fer" : "Ana", hand: sala.players[id].hand })), ["ana"]);
ok("cuenta los dos temas: cada uno ganó uno y le quedaron dos cartas en el otro", /Fer<\/strong><span>0 puntos/.test(html) && /Ana<\/strong><span>0 puntos/.test(html));
ok("y da el resultado final", /Resultado de la competición/.test(html));

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
