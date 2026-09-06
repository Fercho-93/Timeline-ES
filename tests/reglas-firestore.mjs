import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = await initializeTestEnvironment({
  projectId: "demo-hilo",
  firestore: { rules: fs.readFileSync(path.join(REPO, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 }
});

const HOST = "host-uid", P2 = "p2-uid", P3 = "p3-uid", OUT = "outsider-uid";
const ROOM = "ABCD2345";
let pass = 0, fail = 0;
const ctx = uid => env.authenticatedContext(uid).firestore();
const ref = db => doc(db, "rooms", ROOM);

async function seed(data) {
  await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "rooms", ROOM), data); });
}
async function check(label, expected, promise) {
  try {
    await (expected === "allow" ? assertSucceeds(promise) : assertFails(promise));
    pass++; console.log(`  ok   ${label}`);
  } catch (e) {
    fail++; console.log(`  FALLA ${label} → ${String(e).split("\n")[0]}`);
  }
}

const base = () => ({ winners: null,
  roomCode: ROOM, mode: "history", deckFingerprint: "167.test1", hostUid: HOST, status: "lobby", phase: "lobby", version: 1, handSize: 4,
  playerOrder: [HOST], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 } },
  deck: [], discard: [], timeline: [], current: 0, starter: HOST,
  turnsInRound: 0, round: 1, winner: null, reveal: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
});
const playing = (over = {}) => ({
  ...base(), status: "playing", phase: "turn",
  playerOrder: [HOST, P2, P3],
  players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } },
  deck: [10, 11, 12], discard: [], timeline: [20], current: 0, ...over
});

console.log("\nCrear y entrar");
await env.clearFirestore();
await check("el anfitrión crea la sala", "allow", setDoc(ref(ctx(HOST)), base()));
await check("crear sala con hostUid ajeno", "deny", setDoc(doc(ctx(P2), "rooms", "ZZZZ2345"), { ...base(), roomCode: "ZZZZ2345" }));
await check("crear sala repartiéndose cartas", "deny", setDoc(doc(ctx(P2), "rooms", "YYYY2345"), { ...base(), roomCode: "YYYY2345", hostUid: P2, playerOrder: [P2], players: { [P2]: { name: "Bea", hand: [1, 2, 3], joinedAt: 1 } } }));

await seed(base());
await check("un invitado entra en el vestíbulo", "allow", updateDoc(ref(ctx(P2)), { players: { ...base().players, [P2]: { name: "Bea", hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: serverTimestamp() }));
await seed(base());
await check("entrar con nombre de 30 caracteres", "deny", updateDoc(ref(ctx(P2)), { players: { ...base().players, [P2]: { name: "B".repeat(30), hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: serverTimestamp() }));
await check("entrar borrando al anfitrión", "deny", updateDoc(ref(ctx(P2)), { players: { [P2]: { name: "Bea", hand: [], joinedAt: 2 } }, playerOrder: [P2], version: 2, updatedAt: serverTimestamp() }));
await check("entrar cambiando la modalidad", "deny", updateDoc(ref(ctx(P2)), { mode: "movies", players: { ...base().players, [P2]: { name: "Bea", hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: serverTimestamp() }));

await check("crear una sala de la modalidad de países", "allow", setDoc(doc(ctx(HOST), "rooms", "PAIS2345"), { ...base(), roomCode: "PAIS2345", mode: "countries" }));
// La lista de juegos ya no vive en las reglas, para no republicarlas con cada juego
// nuevo. Lo que sí se sigue exigiendo es que el campo sea un identificador corto.
await check("crear una sala de un juego aún no publicado", "allow", setDoc(doc(ctx(HOST), "rooms", "NUEV2345"), { ...base(), roomCode: "NUEV2345", mode: "population" }));
await check("crear una sala sin juego", "deny", setDoc(doc(ctx(HOST), "rooms", "SINM2345"), { ...base(), roomCode: "SINM2345", mode: "" }));
await check("crear una sala con un juego desmesurado", "deny", setDoc(doc(ctx(HOST), "rooms", "LARG2345"), { ...base(), roomCode: "LARG2345", mode: "x".repeat(33) }));

console.log("\nEmpezar la partida");
const lobby3 = { ...base(), playerOrder: [HOST, P2, P3], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: 2 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } } };
const startPayload = { winners: null, handSize: 2, players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 }, [P3]: { name: "Cid", hand: [6, 7], joinedAt: 3 } }, deck: [10, 11], discard: [], timeline: [20], status: "playing", phase: "turn", current: 1, starter: P2, turnsInRound: 0, round: 1, winner: null, reveal: null, version: 2, updatedAt: serverTimestamp() };
await seed(lobby3);
await check("el anfitrión reparte y empieza", "allow", updateDoc(ref(ctx(HOST)), startPayload));
await seed(lobby3);
await check("un invitado intenta empezar", "deny", updateDoc(ref(ctx(P2)), startPayload));
await check("empezar con 20 cartas en mano", "deny", updateDoc(ref(ctx(HOST)), { ...startPayload, handSize: 20 }));

console.log("\nJugar una carta");
await seed(playing());
await check("el jugador de turno acierta", "allow", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2], joinedAt: 1 } }, deck: [10, 11, 12], discard: [], timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: serverTimestamp() }));
await seed(playing());
await check("el jugador de turno falla y roba", "allow", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2, 10] } }, deck: [11, 12], discard: [1], timeline: [20], phase: "reveal", reveal: { cardId: 1, correct: false, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: serverTimestamp() }));
await seed(playing());
await check("jugar fuera de turno", "deny", updateDoc(ref(ctx(P2)), { players: { ...playing().players, [P2]: { name: "Bea", hand: [4] } }, timeline: [3, 20], phase: "reveal", reveal: { cardId: 3, correct: true, playerUid: P2, playerName: "Bea" }, version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: vaciarse la mano sin jugar", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [] } }, phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, timeline: [1, 20], version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: cargarle cartas a otro jugador", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2] }, [P2]: { name: "Bea", hand: [3, 4, 11, 12] } }, timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: acertar sin soltar la carta", "deny", updateDoc(ref(ctx(HOST)), { timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: robar del mazo al acertar", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2, 10] } }, deck: [11, 12], timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: jugar sin subir la versión", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2] } }, timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, updatedAt: serverTimestamp() }));
await check("alguien de fuera escribe en la sala", "deny", updateDoc(ref(ctx(OUT)), { phase: "reveal", version: 2, updatedAt: serverTimestamp() }));

console.log("\nCerrar el turno");
const revealed = playing({ phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, players: { [HOST]: { name: "Ana", hand: [2] }, [P2]: { name: "Bea", hand: [3, 4] }, [P3]: { name: "Cid", hand: [5] } }, timeline: [1, 20] });
await seed(revealed);
await check("el jugador de turno pasa el turno", "allow", updateDoc(ref(ctx(HOST)), { players: revealed.players, deck: revealed.deck, discard: [], current: 1, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(revealed);
await check("saltarse a un jugador al pasar turno", "deny", updateDoc(ref(ctx(HOST)), { players: revealed.players, deck: revealed.deck, discard: [], current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: repartirse cartas a mitad de ronda", "deny", updateDoc(ref(ctx(HOST)), { players: { ...revealed.players, [P2]: { name: "Bea", hand: [3, 4, 10] } }, deck: [11, 12], discard: [], current: 1, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));

const lastTurn = playing({ phase: "reveal", current: 2, turnsInRound: 2, reveal: { cardId: 5, correct: true, playerUid: P3, playerName: "Cid" }, players: { [HOST]: { name: "Ana", hand: [1, 2] }, [P2]: { name: "Bea", hand: [3, 4] }, [P3]: { name: "Cid", hand: [] } } });
await seed(lastTurn);
await check("se declara ganador a quien se quedó sin cartas", "allow", updateDoc(ref(ctx(P3)), { status: "ended", phase: "finished", winner: P3, winners: [P3], reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(lastTurn);
await check("victoria compartida al agotarse el mazo", "allow", updateDoc(ref(ctx(P3)), { status: "ended", phase: "finished", winner: P3, winners: [P3, HOST], reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(lastTurn);
await check("terminar sin declarar ganadores", "deny", updateDoc(ref(ctx(P3)), { status: "ended", phase: "finished", winner: P3, winners: [], reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(lastTurn);
await check("TRAMPA: declararse ganador con cartas en mano", "deny", updateDoc(ref(ctx(HOST)), { status: "ended", phase: "finished", winner: HOST, winners: [HOST], reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(lastTurn);
await check("final de ronda: reparto de desempate", "allow", updateDoc(ref(ctx(P3)), { players: { ...lastTurn.players, [P3]: { name: "Cid", hand: [10] } }, deck: [11, 12], discard: [], current: 0, turnsInRound: 0, round: 2, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));

console.log("\nControles del anfitrión");
await seed(playing({ current: 1 }));
await check("el anfitrión salta el turno del ausente", "allow", updateDoc(ref(ctx(HOST)), { current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(playing({ current: 1 }));
await check("un jugador cualquiera salta turnos", "deny", updateDoc(ref(ctx(P3)), { current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(playing({ current: 1 }));
await check("el anfitrión expulsa a un participante", "allow", updateDoc(ref(ctx(HOST)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [HOST, P3], discard: [3, 4], current: 1, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(playing({ current: 1 }));
await check("un participante expulsa a otro", "deny", updateDoc(ref(ctx(P2)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 } }, playerOrder: [HOST, P2], discard: [5], current: 0, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await check("TRAMPA: expulsar al anfitrión y quedarse la sala", "deny", updateDoc(ref(ctx(P2)), { players: { [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [P2, P3], discard: [1, 2], current: 0, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));

await seed(playing({ current: 0 }));
await check("un participante se marcha por su cuenta", "allow", updateDoc(ref(ctx(P2)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [HOST, P3], discard: [3, 4], current: 0, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed(playing({ current: 0 }));
await check("marcharse y declararse ganador de paso", "deny", updateDoc(ref(ctx(P2)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [HOST, P3], discard: [3, 4], current: 0, turnsInRound: 0, phase: "turn", status: "ended", winner: P2, reveal: null, version: 2, updatedAt: serverTimestamp() }));
await seed({ ...base(), playerOrder: [HOST, P2], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: 2 } } });
await check("el anfitrión expulsa desde el vestíbulo", "allow", updateDoc(ref(ctx(HOST)), { players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 } }, playerOrder: [HOST], discard: [], version: 2, updatedAt: serverTimestamp() }));
await seed(playing({ current: 1, phase: "reveal", reveal: { cardId: 3, correct: true, playerUid: P2, playerName: "Bea" } }));
await check("el anfitrión salta un turno ya revelado", "allow", updateDoc(ref(ctx(HOST)), { current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: serverTimestamp() }));

console.log("\nEl Pulso");
// Es la única jugada que toca la mano de otra persona, así que lo que hay que demostrar
// aquí no es que funcione, sino que no se pueda usar para robar cartas.
const conPulso = (over = {}) => playing({
  pulse: true, pulseTurn: null,
  players: {
    [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: false, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  }, ...over
});
// Primera mitad del duelo: Ana ya gastó su Pulso, la carta 10 está fuera del mazo y le
// toca colocarla a ella. La carta que pagaría si gana (la 1) queda apalabrada desde aquí.
const enPulso = (over = {}) => conPulso({
  phase: "pulse", deck: [11, 12],
  pulseTurn: { targetUid: P2, cardId: 10, stage: "reto", giftId: 1 },
  players: {
    [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: true, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  }, ...over
});
// Segunda mitad: Ana ya ha colocado y le toca defender a Bea, que es quien firma el final.
const enDefensa = (byOk, over = {}) => enPulso({
  pulseTurn: { targetUid: P2, cardId: 10, stage: "defensa", giftId: 1, byIndex: 1, byOk },
  ...over
});
// Lo que escribe Ana al cerrar su mitad: su jugada, y nada más.
const retar = (over = {}) => ({
  pulseTurn: { targetUid: P2, cardId: 10, stage: "defensa", giftId: 1, byIndex: 1, byOk: true },
  version: 2, updatedAt: serverTimestamp(), ...over
});
const lanzar = (over = {}) => ({
  players: {
    [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: true, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  },
  deck: [11, 12], discard: [], phase: "pulse",
  pulseTurn: { targetUid: P2, cardId: 10, stage: "reto", giftId: 1 },
  version: 2, updatedAt: serverTimestamp(), ...over
});

await seed(conPulso());
await check("quien tiene el turno lanza su Pulso", "allow", updateDoc(ref(ctx(HOST)), lanzar()));
await seed(conPulso());
await check("lanzarlo fuera de turno", "deny", updateDoc(ref(ctx(P2)), lanzar()));
await seed(conPulso({ pulse: false }));
await check("lanzarlo en una partida sin Pulso", "deny", updateDoc(ref(ctx(HOST)), lanzar()));
await seed(conPulso({ players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } }));
await check("lanzarlo dos veces", "deny", updateDoc(ref(ctx(HOST)), lanzar()));
await seed(conPulso({ players: { [HOST]: { name: "Ana", hand: [1], joinedAt: 1, pulseUsed: false, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } }));
await check("lanzarlo con una sola carta", "deny", updateDoc(ref(ctx(HOST)), lanzar({ players: { [HOST]: { name: "Ana", hand: [1], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } })));
await seed(conPulso());
await check("retarse a uno mismo", "deny", updateDoc(ref(ctx(HOST)), lanzar({ pulseTurn: { targetUid: HOST, cardId: 10, stage: "reto", giftId: 1 } })));
await seed(conPulso({ players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: false, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } }));
await check("retar a quien ya recibió una carta esta ronda", "deny", updateDoc(ref(ctx(HOST)), lanzar()));
await seed(conPulso());
await check("aprovechar el lanzamiento para robar una carta", "deny", updateDoc(ref(ctx(HOST)), lanzar({ players: { [HOST]: { name: "Ana", hand: [1, 2, 3], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [4], joinedAt: 2, pulseUsed: false, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } })));

// Resolver el duelo lo firma quien defiende, no quien retó: es la única escritura del
// juego que hace alguien que no tiene el turno, así que lo que hay que demostrar aquí es
// que esa puerta no sirve para nada más que para las cuatro salidas del duelo.
const manos = (ana, bea, escudoBea = 0, cid = [5]) => ({
  [HOST]: { name: "Ana", hand: ana, joinedAt: 1, pulseUsed: true, shieldRound: 0 },
  [P2]: { name: "Bea", hand: bea, joinedAt: 2, pulseUsed: false, shieldRound: escudoBea },
  [P3]: { name: "Cid", hand: cid, joinedAt: 3, pulseUsed: false, shieldRound: 0 }
});
const revela = (correct, targetOk, giftId = null) => ({
  cardId: 10, correct, targetOk, giftId, byIndex: 1, targetIndex: 1,
  playerUid: HOST, playerName: "Ana", targetUid: P2, targetName: "Bea"
});
// Aciertan los dos: la carta se queda en la línea y no cambia ninguna mano.
const empate = (over = {}) => ({
  players: manos([1, 2], [3, 4]), deck: [11, 12], discard: [], timeline: [20, 10],
  phase: "reveal", pulseTurn: null, reveal: revela(true, true),
  version: 2, updatedAt: serverTimestamp(), ...over
});
// Solo acierta quien retó: paga la carta apalabrada y quien la recibe queda protegido.
const acierta = (over = {}) => ({
  players: manos([2], [3, 4, 1], 1), deck: [11, 12], discard: [], timeline: [20, 10],
  phase: "reveal", pulseTurn: null, reveal: revela(true, false, 1),
  version: 2, updatedAt: serverTimestamp(), ...over
});
// Solo acierta quien defiende: la carta entra igual y quien retó roba.
const defiende = (over = {}) => ({
  players: manos([1, 2, 11], [3, 4]), deck: [12], discard: [], timeline: [20, 10],
  phase: "reveal", pulseTurn: null, reveal: revela(false, true),
  version: 2, updatedAt: serverTimestamp(), ...over
});
// Fallan los dos: la carta al descarte y quien retó roba.
const falla = (over = {}) => ({
  players: manos([1, 2, 11], [3, 4]), deck: [12], discard: [10], timeline: [20],
  phase: "reveal", pulseTurn: null, reveal: revela(false, false),
  version: 2, updatedAt: serverTimestamp(), ...over
});

await seed(enPulso());
await check("quien reta cierra su mitad del duelo", "allow", updateDoc(ref(ctx(HOST)), retar()));
await seed(enPulso());
await check("cerrar la mitad de otra persona", "deny", updateDoc(ref(ctx(P2)), retar()));
await seed(enPulso());
await check("aprovechar el reto para tocar una mano", "deny", updateDoc(ref(ctx(HOST)), retar({ players: manos([1, 2, 3], [4]) })));
await seed(enPulso());
await check("cambiar de objetivo a mitad del duelo", "deny", updateDoc(ref(ctx(HOST)), retar({ pulseTurn: { targetUid: P3, cardId: 10, stage: "defensa", giftId: 1, byIndex: 1, byOk: true } })));
await seed(enPulso());
await check("subir la apuesta cambiando la carta apalabrada", "deny", updateDoc(ref(ctx(HOST)), retar({ pulseTurn: { targetUid: P2, cardId: 10, stage: "defensa", giftId: 2, byIndex: 1, byOk: true } })));

await seed(enDefensa(true));
await check("quien defiende resuelve el empate", "allow", updateDoc(ref(ctx(P2)), empate()));
await seed(enDefensa(true));
await check("quien defiende falla y paga la carta apalabrada", "allow", updateDoc(ref(ctx(P2)), acierta()));
await seed(enDefensa(false));
await check("quien defiende acierta y quien retó roba", "allow", updateDoc(ref(ctx(P2)), defiende()));
await seed(enDefensa(false));
await check("fallan los dos: la carta al descarte", "allow", updateDoc(ref(ctx(P2)), falla()));

// La puerta nueva, cerrada por todos lados.
await seed(enDefensa(true));
await check("quien retó resuelve por su cuenta el duelo", "deny", updateDoc(ref(ctx(HOST)), acierta()));
await seed(enDefensa(true));
await check("resolver el duelo de otras dos personas", "deny", updateDoc(ref(ctx(P3)), acierta()));
await seed(enDefensa(true));
await check("cobrarse una carta distinta de la apalabrada", "deny", updateDoc(ref(ctx(P2)), acierta({ players: manos([1], [3, 4, 2], 1), reveal: revela(true, false, 2) })));
await seed(enDefensa(true, { pulseTurn: { targetUid: P2, cardId: 10, stage: "defensa", giftId: 99, byIndex: 1, byOk: true } }));
await check("cobrar una carta que quien retó no tenía", "deny", updateDoc(ref(ctx(P2)), acierta({ players: manos([1, 2], [3, 4, 99], 1), reveal: revela(true, false, 99) })));
await seed(enDefensa(true));
await check("cobrarse dos cartas de una vez", "deny", updateDoc(ref(ctx(P2)), acierta({ players: manos([], [3, 4, 1, 2], 1) })));
await seed(enDefensa(true));
await check("mentir sobre lo que colocó quien retó", "deny", updateDoc(ref(ctx(P2)), defiende({ reveal: revela(false, true) })));
await seed(enDefensa(false));
await check("hacer que quien retó pague aunque hubiera fallado", "deny", updateDoc(ref(ctx(P2)), acierta({ reveal: revela(false, false, 1) })));
await seed(enDefensa(true));
await check("defenderse quitándole el Pulso gastado a quien retó", "deny", updateDoc(ref(ctx(P2)), empate({ players: { ...manos([1, 2], [3, 4]), [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: false, shieldRound: 0 } } })));
await seed(enDefensa(true));
await check("colarse un escudo sin haber recibido carta", "deny", updateDoc(ref(ctx(P2)), empate({ players: manos([1, 2], [3, 4], 1) })));
await seed(enDefensa(true, { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: true, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } }));
await check("devolverse el propio Pulso al firmar el desenlace", "deny", updateDoc(ref(ctx(P2)), empate({ players: { ...manos([1, 2], [3, 4]), [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 } } })));
await seed(enDefensa(true));
await check("tocar de paso la mano de quien no está en el duelo", "deny", updateDoc(ref(ctx(P2)), empate({ players: manos([1, 2], [3, 4], 0, []) })));
await seed(enDefensa(true));
await check("empatar sin dejar la carta en la línea", "deny", updateDoc(ref(ctx(P2)), empate({ timeline: [20] })));
await seed(enDefensa(false));
await check("fallar sin descartar la carta del reto", "deny", updateDoc(ref(ctx(P2)), falla({ discard: [], deck: [12] })));
await seed(enDefensa(false));
await check("robar dos cartas por fallar el reto", "deny", updateDoc(ref(ctx(P2)), falla({ players: manos([1, 2, 11, 12], [3, 4]), deck: [] })));
await seed(enDefensa(true));
await check("resolver diciendo que la carta era otra", "deny", updateDoc(ref(ctx(P2)), empate({ reveal: { ...revela(true, true), cardId: 11 } })));
await seed(enDefensa(true));
await check("resolver sin subir la versión", "deny", updateDoc(ref(ctx(P2)), empate({ version: 1 })));
await seed(conPulso());
await check("saltarse el paso de sacar la carta y resolver directamente", "deny", updateDoc(ref(ctx(HOST)), acierta()));

console.log("\nLectura y borrado");
await seed(playing());
await check("alguien de fuera lee una partida en curso", "deny", getDoc(ref(ctx(OUT))));
await check("un participante lee la sala", "allow", getDoc(ref(ctx(P2))));
await check("un participante borra la sala", "deny", deleteDoc(ref(ctx(P2))));
await seed(playing());
await check("el anfitrión cierra la sala", "allow", deleteDoc(ref(ctx(HOST))));

await env.cleanup();
console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
