// El reductor de la sala sin conexión (`local-room.js`) es puro: sin red, sin fecha del
// sistema, sin baraja propia. Eso permite probar una partida entera aquí, en Node, sin
// levantar WebRTC ni un móvil real.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "https://hilo.test/" });
  // `engine.js` solo se cuelga de `window.CONTINUUM` si ya existe cuando se ejecuta —en la
  // app real lo crea `modes.js` antes—, así que aquí se adelanta a mano.
  dom.window.CONTINUUM = {};
  dom.window.eval(read("engine.js"));
  dom.window.eval(read("local-room.js"));
  return dom.window;
}

const noShuffle = cards => [...cards];
const valueOf = id => Number(id.split("-")[1]);
const mazo = (n, prefix = "c") => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

const w = boot();
const Room = w.CONTINUUM.LocalRoom;
const intenta = fn => { try { fn(); return null; } catch (e) { return e.message; } };

console.log("\nCrear sala y unirse");
let sala = Room.createRoom({ roomCode: "ABC123", hostId: "host", hostName: "Fer", modeKey: "history", deckFingerprint: "v1", now: 1000 });
ok("empieza en el vestíbulo, con solo el anfitrión", sala.status === "lobby" && sala.playerOrder.length === 1);
sala = Room.reduce(sala, { type: "join", playerId: "ana", name: "Ana", deckFingerprint: "v1", now: 1001 });
sala = Room.reduce(sala, { type: "join", playerId: "leo", name: "Leo", deckFingerprint: "v1", now: 1002 });
ok("los tres están en la sala, por orden de entrada", sala.playerOrder.join(",") === "host,ana,leo");
const salaConAvatar = Room.createRoom({ roomCode: "ART123", hostId: "host", hostName: "Fer", avatarId: "panda", modeKey: "history", now: 1000 });
const invitadaConAvatar = Room.reduce(salaConAvatar, { type: "join", playerId: "ana", name: "Ana", avatarId: "cleopatra", now: 1001 });
ok("los retratos elegidos viajan en el estado de la sala", invitadaConAvatar.players.host.avatarId === "panda" && invitadaConAvatar.players.ana.avatarId === "cleopatra");
ok("unirse dos veces no rompe nada, simplemente no hace nada", intenta(() => Room.reduce(sala, { type: "join", playerId: "ana", name: "Ana", now: 1003 })) === null);
ok("un mazo de otra versión se rechaza al entrar", intenta(() => Room.reduce(sala, { type: "join", playerId: "raro", name: "?", deckFingerprint: "v2", now: 1003 })) === "DECK_MISMATCH");

console.log("\nSala llena y partida ya empezada");
let llena = Room.createRoom({ roomCode: "FULL01", hostId: "h", hostName: "H", modeKey: "history", now: 0 });
for (let i = 0; i < Room.MAX_PLAYERS - 1; i++) llena = Room.reduce(llena, { type: "join", playerId: `p${i}`, name: `P${i}`, now: i + 1 });
ok("la sala admite hasta el máximo de jugadores", llena.playerOrder.length === Room.MAX_PLAYERS);
ok("una vez llena, no admite a nadie más", intenta(() => Room.reduce(llena, { type: "join", playerId: "extra", name: "Extra", now: 999 })) === "ROOM_FULL");
let empezada = Room.reduce(sala, { type: "start", requesterId: "host", handSize: 4, starterId: "host", deck: mazo(20), now: 1500 });
ok("una partida ya empezada no admite a nadie nuevo", intenta(() => Room.reduce(empezada, { type: "join", playerId: "tarde", name: "Tarde", now: 1600 })) === "ALREADY_STARTED");

console.log("\nEmpezar la partida");
ok("un invitado no puede empezar la partida", intenta(() => Room.reduce(sala, { type: "start", requesterId: "ana", handSize: 4, starterId: "host", deck: mazo(20), now: 2000 })) === "NOT_HOST");
sala = Room.reduce(sala, { type: "start", requesterId: "host", handSize: 4, turnSeconds: 20, starterId: "leo", deck: mazo(20), now: 2000 });
ok("reparte cuatro cartas por jugador", Object.values(sala.players).every(p => p.hand.length === 4));
ok("una carta sale del mazo a la línea temporal antes de repartir turnos", sala.timeline.length === 1);
ok("empieza quien se decidió como más joven", sala.playerOrder[sala.current] === "leo");
ok("la partida pasa a jugarse", sala.status === "playing" && sala.phase === "turn");

console.log("\nColocar cartas y pasar turno");
ok("solo puede jugar quien tiene el turno", intenta(() => Room.reduce(sala, { type: "place-card", playerId: "ana", cardId: sala.players.ana.hand[0], index: 0, valueOf, shuffle: noShuffle, now: 2100 })) === "NOT_TURN");
// El hueco correcto no importa aquí para el reductor: lo decide `CT.Engine.fits`, no esta
// prueba. Se calcula el hueco que sí encaja para poder comprobar el camino de acierto.
const cartaLeo = sala.players.leo.hand[0];
let huecoCorrecto = 0;
while (huecoCorrecto <= sala.timeline.length && !w.CONTINUUM.Engine.fits(sala.timeline, cartaLeo, huecoCorrecto, valueOf)) huecoCorrecto++;
sala = Room.reduce(sala, { type: "place-card", playerId: "leo", cardId: cartaLeo, index: huecoCorrecto, valueOf, shuffle: noShuffle, now: 2100 });
ok("colocarla bien la mete en la línea temporal", sala.timeline.includes(cartaLeo));
ok("y deja el resultado a la vista antes de pasar turno", sala.phase === "reveal" && sala.reveal.correct === true);
sala = Room.reduce(sala, { type: "finish-turn", requesterId: "leo", now: 2200 });
ok("el turno pasa a quien sigue en la sala", sala.playerOrder[sala.current] === "host");

console.log("\nSaltar un turno y expulsar");
sala = Room.reduce(sala, { type: "skip-turn", requesterId: "host", now: 2300 });
ok("saltar el turno avanza al siguiente", sala.playerOrder[sala.current] === "ana");
const antesDeExpulsar = sala.playerOrder.length;
sala = Room.reduce(sala, { type: "remove-player", requesterId: "host", targetId: "ana", now: 2400 });
ok("expulsar quita a esa persona de la sala", sala.playerOrder.length === antesDeExpulsar - 1 && !sala.playerOrder.includes("ana"));
ok("sus cartas vuelven al descarte, no desaparecen", sala.discard.length > 0);
ok("el anfitrión no puede ser expulsado ni puede salir por su cuenta", intenta(() => Room.reduce(sala, { type: "remove-player", requesterId: "host", targetId: "host", now: 2500 })) === "HOST");

console.log("\nQuedarse sin cartas decide la partida");
const casiGanada = {
  hostId: "a", playerOrder: ["a", "b"],
  players: { a: { name: "A", hand: [] }, b: { name: "B", hand: ["x"] } },
  deck: [], discard: [], status: "playing", phase: "reveal", current: 0, turnsInRound: 1, round: 1, version: 9
};
const terminada = Room.finishTurn(casiGanada, { requesterId: "a", now: 3000 });
ok("gana quien se queda sin cartas si nadie más se queda igual en la misma ronda", terminada.status === "ended" && terminada.winner === "a");
ok("la sala queda marcada como terminada, no solo el ganador anotado", terminada.phase === "finished");

console.log("\nVarias personas sin cartas a la vez: comparten la victoria");
const empatan = {
  hostId: "a", playerOrder: ["a", "b"],
  players: { a: { name: "A", hand: [] }, b: { name: "B", hand: [] } },
  deck: [], discard: [], status: "playing", phase: "reveal", current: 0, turnsInRound: 1, round: 1, version: 9
};
const empate = Room.finishTurn(empatan, { requesterId: "a", now: 3100 });
ok("la partida termina en vez de quedarse atascada", empate.status === "ended" && empate.phase === "finished");
ok("las dos personas figuran como ganadoras", empate.winners.join(",") === "a,b" && empate.winner === null);

console.log("\nSaltar turno (tiempo agotado o móvil sin batería)");
const enTurno = {
  hostId: "a", playerOrder: ["a", "b", "c"],
  players: { a: { name: "A", hand: ["x"] }, b: { name: "B", hand: ["y"] }, c: { name: "C", hand: ["z"] } },
  deck: ["w"], discard: [], status: "playing", phase: "turn", current: 1, turnsInRound: 1, round: 2, version: 20, turnStartedAt: 100
};
ok("solo el anfitrión puede saltar un turno", intenta(() => Room.skipTurn(enTurno, { requesterId: "b", now: 200 })) === "NOT_ALLOWED");
const saltado = Room.skipTurn(enTurno, { requesterId: "a", expectedVersion: 20, now: 200 });
ok("pasa al siguiente y reinicia el reloj del turno", saltado.current === 2 && saltado.turnsInRound === 2 && saltado.turnStartedAt === 200);
ok("un salto con una versión ya superada no hace nada", Room.skipTurn(saltado, { requesterId: "a", expectedVersion: 20, now: 300 }) === saltado);
const sinCartasAlSaltar = { ...enTurno, current: 2, turnsInRound: 2, players: { ...enTurno.players, a: { name: "A", hand: [] } } };
const cierraRonda = Room.skipTurn(sinCartasAlSaltar, { requesterId: "a", now: 400 });
ok("saltar el último turno de la ronda también declara ganador", cierraRonda.status === "ended" && cierraRonda.winner === "a");

console.log("\nRevancha con la misma mesa");
ok("no se puede pedir revancha a mitad de partida", intenta(() => Room.rematch(enTurno, { requesterId: "a", now: 500 })) === "NOT_ALLOWED");
ok("solo el anfitrión la pide", intenta(() => Room.rematch(cierraRonda, { requesterId: "b", now: 500 })) === "NOT_ALLOWED");
const revancha = Room.reduce(cierraRonda, { type: "rematch", requesterId: "a", now: 500 });
ok("vuelve al vestíbulo con las mismas personas", revancha.status === "lobby" && revancha.playerOrder.join(",") === "a,b,c");
ok("sin manos, mesa ni ganador de la partida anterior", Object.values(revancha.players).every(p => p.hand.length === 0) && revancha.timeline.length === 0 && revancha.winner === null && revancha.winners === null);
const otraVez = Room.startRoom(revancha, { requesterId: "a", handSize: 2, turnSeconds: 0, starterId: "b", deck: mazo(20), now: 600 });
ok("y se puede barajar otra vez desde ahí", otraVez.status === "playing" && otraVez.playerOrder[otraVez.current] === "b");

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
