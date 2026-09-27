// El reductor de la sala sin conexión (`local-room.js`) es puro: sin red, sin fecha del
// sistema, sin baraja propia. Eso permite probar una partida entera aquí, en Node, sin
// levantar WebRTC ni un móvil real — con las mismas reglas que la sala online: minijuego
// de quién empieza, final secreta, Fantasma, Pulso y plaza reservada al desconectarse.
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
  dom.window.CONTINUUM = { escapeHtml: String };
  ["engine.js", "ghost.js", "local-room.js"].forEach(file => dom.window.eval(read(file)));
  return dom.window;
}

const noShuffle = cards => [...cards];
const valueOf = id => Number(String(id).split("-")[1]);
const mazo = (n, prefix = "c") => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
// Final de juguete: la cifra buscada es 100; `rank` sigue el criterio de `final.js`.
let finales = 0;
const makeFinal = (players, previous) => ({ round: (previous?.round || 0) + 1, players: [...players], cardId: `f-${++finales}`, target: 100, submitted: [], used: [] });
const rank = (final, answers) => {
  const rows = final.players.map(uid => ({ uid, distance: Math.abs(answers[uid] - final.target) }));
  const best = Math.min(...rows.map(r => r.distance));
  return { rows, winners: rows.filter(r => r.distance === best).map(r => r.uid) };
};
const ctx = { valueOf, shuffle: noShuffle, random: () => 0, makeFinal, rank };

const w = boot();
const Room = w.CONTINUUM.LocalRoom;
const intenta = fn => { try { fn(); return null; } catch (e) { return e.message; } };
const act = (state, type, extra) => Room.reduce(state, { type, ...ctx, ...extra });
const hueco = (state, cardId) => { let i = 0; while (i <= state.timeline.length && !w.CONTINUUM.Engine.fits(state.timeline, cardId, i, valueOf)) i++; return i; };
const fallo = (state, cardId) => hueco(state, cardId) === 0 ? state.timeline.length : 0;

console.log("\nCrear sala y unirse");
let sala = Room.createRoom({ roomCode: "ABC123", hostId: "host", hostName: "Fer", modeKey: "history", deckFingerprint: "v1", now: 1000 });
ok("empieza en el vestíbulo, con solo el anfitrión", sala.status === "lobby" && sala.playerOrder.length === 1);
sala = act(sala, "join", { playerId: "ana", name: "Ana", deckFingerprint: "v1", now: 1001 });
sala = act(sala, "join", { playerId: "leo", name: "Leo", deckFingerprint: "v1", now: 1002 });
ok("los tres están en la sala, por orden de entrada", sala.playerOrder.join(",") === "host,ana,leo");
ok("unirse dos veces no rompe nada, simplemente no hace nada", act(sala, "join", { playerId: "ana", name: "Ana", now: 1003 }) === sala);
ok("un mazo de otra versión se rechaza al entrar", intenta(() => act(sala, "join", { playerId: "raro", name: "?", deckFingerprint: "v2", now: 1003 })) === "DECK_MISMATCH");
let llena = Room.createRoom({ roomCode: "FULL01", hostId: "h", hostName: "H", modeKey: "history", now: 0 });
for (let i = 0; i < Room.MAX_PLAYERS - 1; i++) llena = act(llena, "join", { playerId: `p${i}`, name: `P${i}`, now: i + 1 });
ok("una vez llena, no admite a nadie más", intenta(() => act(llena, "join", { playerId: "extra", name: "Extra", now: 999 })) === "ROOM_FULL");

console.log("\nMinijuego de quién empieza");
const orden = ["leo", "host", "ana"];
ok("no se puede empezar sin jugar el minijuego, igual que en la sala online", intenta(() => act(sala, "start", { requesterId: "host", handSize: 4, order: orden, deck: mazo(40), now: 1500 })) === "STARTER_PENDING");
ok("solo el anfitrión reparte la carta", intenta(() => act(sala, "starter-draw", { requesterId: "ana", cardId: "c-99", now: 1100 })) === "NOT_HOST");
sala = act(sala, "starter-draw", { requesterId: "host", cardId: "c-99", now: 1100 });
sala = act(sala, "starter-guess", { playerId: "host", value: 10, now: 1101 });
sala = act(sala, "starter-guess", { playerId: "ana", value: 20, now: 1102 });
ok("una respuesta no se cambia después de darla", act(sala, "starter-guess", { playerId: "ana", value: 99, now: 1103 }).starterDraw.guesses.ana === 20);
ok("con respuestas pendientes todavía no se puede empezar", intenta(() => act(sala, "start", { requesterId: "host", handSize: 4, order: orden, deck: mazo(40), now: 1500 })) === "STARTER_PENDING");
sala = act(sala, "starter-guess", { playerId: "leo", value: 30, now: 1104 });
ok("con todas las respuestas, el minijuego está completo", Room.starterComplete(sala));
ok("un orden que no es el de la mesa se rechaza", intenta(() => act(sala, "start", { requesterId: "host", handSize: 4, order: ["leo", "host"], deck: mazo(40), now: 1500 })) === "INVALID_START");
ok("un invitado no puede empezar la partida", intenta(() => act(sala, "start", { requesterId: "ana", handSize: 4, order: orden, deck: mazo(40), now: 1500 })) === "NOT_HOST");
sala = act(sala, "start", { requesterId: "host", handSize: 4, turnSeconds: 20, order: orden, deck: mazo(40), now: 2000 });
ok("la mesa se sienta por orden de cercanía", sala.playerOrder.join(",") === orden.join(","));
ok("empieza quien más se acercó", sala.playerOrder[sala.current] === "leo" && sala.starter === "leo");
ok("reparte cuatro cartas por jugador y una a la línea", Object.values(sala.players).every(p => p.hand.length === 4) && sala.timeline.length === 1);
ok("una partida ya empezada no admite a nadie nuevo", intenta(() => act(sala, "join", { playerId: "tarde", name: "Tarde", now: 2001 })) === "ALREADY_STARTED");

console.log("\nColocar cartas y pasar turno");
ok("solo puede jugar quien tiene el turno", intenta(() => act(sala, "place-card", { playerId: "ana", cardId: sala.players.ana.hand[0], index: 0, now: 2100 })) === "NOT_TURN");
const cartaLeo = sala.players.leo.hand[0];
sala = act(sala, "place-card", { playerId: "leo", cardId: cartaLeo, index: hueco(sala, cartaLeo), now: 2100 });
ok("colocarla bien la mete en la línea y enseña el resultado", sala.timeline.includes(cartaLeo) && sala.phase === "reveal" && sala.reveal.correct);
sala = act(sala, "finish-turn", { requesterId: "leo", now: 2200 });
ok("el turno pasa a quien sigue en el orden del minijuego", sala.playerOrder[sala.current] === "host" && sala.turnStartedAt === 2200);

console.log("\nSaltar turno (tiempo agotado o móvil sin batería)");
ok("solo el anfitrión puede saltar un turno", intenta(() => act(sala, "skip-turn", { requesterId: "ana", now: 2300 })) === "NOT_ALLOWED");
const saltado = act(sala, "skip-turn", { requesterId: "host", expectedVersion: sala.version, now: 2300 });
ok("pasa al siguiente y reinicia el reloj del turno", saltado.playerOrder[saltado.current] === "ana" && saltado.turnStartedAt === 2300);
ok("un salto con una versión ya superada no hace nada", act(saltado, "skip-turn", { requesterId: "host", expectedVersion: sala.version, now: 2400 }) === saltado);

console.log("\nQuedarse sin cartas decide la partida");
const casiGanada = {
  hostId: "a", playerOrder: ["a", "b"],
  players: { a: { name: "A", hand: [] }, b: { name: "B", hand: ["x"] } },
  deck: [], discard: [], timeline: [], status: "playing", phase: "reveal", current: 1, turnsInRound: 1, round: 1, version: 9
};
const terminada = act(casiGanada, "finish-turn", { requesterId: "a", now: 3000 });
ok("gana quien se queda sin cartas si nadie más se queda igual en la misma ronda", terminada.status === "ended" && terminada.winner === "a" && terminada.phase === "finished");

console.log("\nVarias personas sin cartas a la vez: final secreta, como en el resto del juego");
const empatan = { ...casiGanada, playerOrder: ["a", "b", "c"], players: { a: { name: "A", hand: [] }, b: { name: "B", hand: [] }, c: { name: "C", hand: ["x"] } }, current: 2, turnsInRound: 2, timeline: ["t-1"] };
let final = act(empatan, "finish-turn", { requesterId: "a", now: 3100 });
ok("no hay ganador todavía: se juega la final entre quienes empataron", final.phase === "final" && final.status === "playing" && final.final.players.join(",") === "a,b");
ok("quien no es finalista no responde", intenta(() => act(final, "final-answer", { playerId: "c", value: 5, now: 3101 })) === "NOT_ALLOWED");
final = act(final, "final-answer", { playerId: "a", value: 90, now: 3102 });
ok("con respuestas pendientes no se puede resolver", intenta(() => act(final, "final-next", { requesterId: "a", now: 3103 })) === "NOT_ALLOWED");
final = act(final, "final-answer", { playerId: "b", value: 110, now: 3104 });
final = act(final, "final-next", { requesterId: "c", now: 3105 });
ok("si vuelven a empatar, otra carta solo entre quienes empataron", final.phase === "final" && final.final.round === 2 && Object.keys(final.finalAnswers).length === 0);
final = act(final, "final-answer", { playerId: "a", value: 101, now: 3106 });
final = act(final, "final-answer", { playerId: "b", value: 50, now: 3107 });
final = act(final, "final-next", { requesterId: "a", now: 3108 });
ok("gana quien más se acerca", final.status === "ended" && final.winner === "a" && final.winners.join(",") === "a");

console.log("\nFantasma");
const conPoderes = { ...casiGanada, phase: "turn", current: 0, turnsInRound: 0, playerOrder: ["a", "b"],
  players: { a: { name: "A", hand: ["c-1", "c-2"] }, b: { name: "B", hand: ["c-3"] } }, timeline: ["c-10", "c-11", "c-12", "c-13", "c-14"], deck: ["c-20", "c-21"],
  ghost: { distribution: 2, cards: ["c-1"], owners: ["a"], used: [], pending: [], cooldown: [], actor: "", fresh: false }, pulsePower: null, pulse: true, pulseTurn: null };
ok("solo quien tiene el poder lo usa", intenta(() => act({ ...conPoderes, current: 1 }, "use-ghost", { playerId: "b", now: 4000 })) === "NOT_ALLOWED");
const fantasma = act(conPoderes, "use-ghost", { playerId: "a", now: 4000 });
ok("activarlo oculta los valores durante una vuelta", fantasma.ghost.pending.length === 2 && fantasma.ghost.used.includes("a"));

console.log("\nPulso");
ok("el Pulso necesita dos cartas en la mano", intenta(() => act({ ...conPoderes, current: 1, turnsInRound: 1 }, "pulse-start", { playerId: "b", targetId: "a", now: 4100 })) === "NOT_ALLOWED");
let pulso = act(conPoderes, "pulse-start", { playerId: "a", targetId: "b", now: 4100 });
ok("lanzarlo saca una carta del mazo para el duelo", pulso.phase === "pulse" && pulso.pulseTurn.cardId === "c-20" && pulso.players.a.pulseUsed);
ok("quien defiende no coloca antes de que ataque quien reta", intenta(() => act(pulso, "pulse-defend", { playerId: "b", index: 0, now: 4101 })) === "NOT_TURN");
pulso = act(pulso, "pulse-place", { playerId: "a", index: hueco(pulso, "c-20"), now: 4102 });
ok("la jugada de quien reta se guarda sin revelarse", pulso.pulseTurn.stage === "defensa" && pulso.pulseTurn.byOk === true && pulso.phase === "pulse");
pulso = act(pulso, "pulse-defend", { playerId: "b", index: fallo(pulso, "c-20"), now: 4103 });
ok("solo acierta quien reta: le pasa una carta a quien defiende", pulso.phase === "reveal" && pulso.reveal.duel && pulso.reveal.correct && !pulso.reveal.targetOk && pulso.players.a.hand.length === 1 && pulso.players.b.hand.length === 2);
ok("quien recibe la carta queda protegido esta ronda", pulso.players.b.shieldRound === pulso.round);

console.log("\nPerder la conexión conserva la plaza");
let fuera = act(sala, "player-away", { requesterId: "host", targetId: "ana", now: 5000 });
ok("sus cartas se quedan con ella", fuera.players.ana.away && fuera.players.ana.hand.length === sala.players.ana.hand.length && fuera.playerOrder.includes("ana"));
fuera = act(fuera, "skip-turn", { requesterId: "host", now: 5001 });
ok("su turno se salta solo mientras no vuelve", fuera.playerOrder[fuera.current] === "leo");
ok("al volver recupera su plaza", act(fuera, "join", { playerId: "ana", name: "Ana", now: 5002 }).players.ana.away === false);
const vestibulo = Room.createRoom({ roomCode: "L", hostId: "host", hostName: "Fer", modeKey: "history", now: 0 });
const conAna = act(vestibulo, "join", { playerId: "ana", name: "Ana", now: 1 });
ok("en la sala de espera no hay nada que guardar: se libera la plaza", !act(conAna, "player-away", { requesterId: "host", targetId: "ana", now: 2 }).playerOrder.includes("ana"));

console.log("\nExpulsar");
const expulsada = act(sala, "remove-player", { requesterId: "host", targetId: "ana", now: 6000 });
ok("expulsar quita a esa persona y devuelve sus cartas al descarte", !expulsada.playerOrder.includes("ana") && expulsada.discard.length >= 4);
ok("el anfitrión no puede ser expulsado ni puede salir por su cuenta", intenta(() => act(expulsada, "remove-player", { requesterId: "host", targetId: "host", now: 6001 })) === "HOST");

console.log("\nRevancha con la misma mesa");
ok("no se puede pedir revancha a mitad de partida", intenta(() => act(sala, "rematch", { requesterId: "host", now: 7000 })) === "NOT_ALLOWED");
const acabada = { ...sala, status: "ended", phase: "finished", winner: "leo", winners: ["leo"] };
ok("solo el anfitrión la pide", intenta(() => act(acabada, "rematch", { requesterId: "ana", now: 7000 })) === "NOT_ALLOWED");
const revancha = act(acabada, "rematch", { requesterId: "host", now: 7000 });
ok("vuelve al vestíbulo con las mismas personas, sin manos ni ganador", revancha.status === "lobby" && revancha.playerOrder.length === 3 && Object.values(revancha.players).every(p => p.hand.length === 0) && revancha.winner === null);
ok("y hay que volver a jugar el minijuego", revancha.starterDraw === null && intenta(() => act(revancha, "start", { requesterId: "host", handSize: 2, order: revancha.playerOrder, deck: mazo(20), now: 7100 })) === "STARTER_PENDING");

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
