import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
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
  roomCode: ROOM, mode: "history", hostUid: HOST, status: "lobby", phase: "lobby", version: 1, handSize: 4,
  playerOrder: [HOST], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 } },
  deck: [], discard: [], timeline: [], current: 0, starter: HOST,
  turnsInRound: 0, round: 1, winner: null, reveal: null, createdAt: 1, updatedAt: 1
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
await check("un invitado entra en el vestíbulo", "allow", updateDoc(ref(ctx(P2)), { players: { ...base().players, [P2]: { name: "Bea", hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: 2 }));
await seed(base());
await check("entrar con nombre de 30 caracteres", "deny", updateDoc(ref(ctx(P2)), { players: { ...base().players, [P2]: { name: "B".repeat(30), hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: 2 }));
await check("entrar borrando al anfitrión", "deny", updateDoc(ref(ctx(P2)), { players: { [P2]: { name: "Bea", hand: [], joinedAt: 2 } }, playerOrder: [P2], version: 2, updatedAt: 2 }));
await check("entrar cambiando la modalidad", "deny", updateDoc(ref(ctx(P2)), { mode: "movies", players: { ...base().players, [P2]: { name: "Bea", hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: 2 }));

await check("crear una sala de la modalidad de países", "allow", setDoc(doc(ctx(HOST), "rooms", "PAIS2345"), { ...base(), roomCode: "PAIS2345", mode: "countries" }));
// La lista de juegos ya no vive en las reglas, para no republicarlas con cada juego
// nuevo. Lo que sí se sigue exigiendo es que el campo sea un identificador corto.
await check("crear una sala de un juego aún no publicado", "allow", setDoc(doc(ctx(HOST), "rooms", "NUEV2345"), { ...base(), roomCode: "NUEV2345", mode: "population" }));
await check("crear una sala sin juego", "deny", setDoc(doc(ctx(HOST), "rooms", "SINM2345"), { ...base(), roomCode: "SINM2345", mode: "" }));
await check("crear una sala con un juego desmesurado", "deny", setDoc(doc(ctx(HOST), "rooms", "LARG2345"), { ...base(), roomCode: "LARG2345", mode: "x".repeat(33) }));

console.log("\nEmpezar la partida");
const lobby3 = { ...base(), playerOrder: [HOST, P2, P3], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: 2 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } } };
const startPayload = { winners: null, handSize: 2, players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 }, [P3]: { name: "Cid", hand: [6, 7], joinedAt: 3 } }, deck: [10, 11], discard: [], timeline: [20], status: "playing", phase: "turn", current: 1, starter: P2, turnsInRound: 0, round: 1, winner: null, reveal: null, version: 2, updatedAt: 2 };
await seed(lobby3);
await check("el anfitrión reparte y empieza", "allow", updateDoc(ref(ctx(HOST)), startPayload));
await seed(lobby3);
await check("un invitado intenta empezar", "deny", updateDoc(ref(ctx(P2)), startPayload));
await check("empezar con 20 cartas en mano", "deny", updateDoc(ref(ctx(HOST)), { ...startPayload, handSize: 20 }));

console.log("\nJugar una carta");
await seed(playing());
await check("el jugador de turno acierta", "allow", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2], joinedAt: 1 } }, deck: [10, 11, 12], discard: [], timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: 2 }));
await seed(playing());
await check("el jugador de turno falla y roba", "allow", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2, 10] } }, deck: [11, 12], discard: [1], timeline: [20], phase: "reveal", reveal: { cardId: 1, correct: false, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: 2 }));
await seed(playing());
await check("jugar fuera de turno", "deny", updateDoc(ref(ctx(P2)), { players: { ...playing().players, [P2]: { name: "Bea", hand: [4] } }, timeline: [3, 20], phase: "reveal", reveal: { cardId: 3, correct: true, playerUid: P2, playerName: "Bea" }, version: 2, updatedAt: 2 }));
await check("TRAMPA: vaciarse la mano sin jugar", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [] } }, phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, timeline: [1, 20], version: 2, updatedAt: 2 }));
await check("TRAMPA: cargarle cartas a otro jugador", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2] }, [P2]: { name: "Bea", hand: [3, 4, 11, 12] } }, timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: 2 }));
await check("TRAMPA: acertar sin soltar la carta", "deny", updateDoc(ref(ctx(HOST)), { timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: 2 }));
await check("TRAMPA: robar del mazo al acertar", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2, 10] } }, deck: [11, 12], timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, version: 2, updatedAt: 2 }));
await check("TRAMPA: jugar sin subir la versión", "deny", updateDoc(ref(ctx(HOST)), { players: { ...playing().players, [HOST]: { name: "Ana", hand: [2] } }, timeline: [1, 20], phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, updatedAt: 2 }));
await check("alguien de fuera escribe en la sala", "deny", updateDoc(ref(ctx(OUT)), { phase: "reveal", version: 2, updatedAt: 2 }));

console.log("\nCerrar el turno");
const revealed = playing({ phase: "reveal", reveal: { cardId: 1, correct: true, playerUid: HOST, playerName: "Ana" }, players: { [HOST]: { name: "Ana", hand: [2] }, [P2]: { name: "Bea", hand: [3, 4] }, [P3]: { name: "Cid", hand: [5] } }, timeline: [1, 20] });
await seed(revealed);
await check("el jugador de turno pasa el turno", "allow", updateDoc(ref(ctx(HOST)), { players: revealed.players, deck: revealed.deck, discard: [], current: 1, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await seed(revealed);
await check("saltarse a un jugador al pasar turno", "deny", updateDoc(ref(ctx(HOST)), { players: revealed.players, deck: revealed.deck, discard: [], current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await check("TRAMPA: repartirse cartas a mitad de ronda", "deny", updateDoc(ref(ctx(HOST)), { players: { ...revealed.players, [P2]: { name: "Bea", hand: [3, 4, 10] } }, deck: [11, 12], discard: [], current: 1, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));

const lastTurn = playing({ phase: "reveal", current: 2, turnsInRound: 2, reveal: { cardId: 5, correct: true, playerUid: P3, playerName: "Cid" }, players: { [HOST]: { name: "Ana", hand: [1, 2] }, [P2]: { name: "Bea", hand: [3, 4] }, [P3]: { name: "Cid", hand: [] } } });
await seed(lastTurn);
await check("se declara ganador a quien se quedó sin cartas", "allow", updateDoc(ref(ctx(P3)), { status: "ended", phase: "finished", winner: P3, winners: [P3], reveal: null, version: 2, updatedAt: 2 }));
await seed(lastTurn);
await check("victoria compartida al agotarse el mazo", "allow", updateDoc(ref(ctx(P3)), { status: "ended", phase: "finished", winner: P3, winners: [P3, HOST], reveal: null, version: 2, updatedAt: 2 }));
await seed(lastTurn);
await check("terminar sin declarar ganadores", "deny", updateDoc(ref(ctx(P3)), { status: "ended", phase: "finished", winner: P3, winners: [], reveal: null, version: 2, updatedAt: 2 }));
await seed(lastTurn);
await check("TRAMPA: declararse ganador con cartas en mano", "deny", updateDoc(ref(ctx(HOST)), { status: "ended", phase: "finished", winner: HOST, winners: [HOST], reveal: null, version: 2, updatedAt: 2 }));
await seed(lastTurn);
await check("final de ronda: reparto de desempate", "allow", updateDoc(ref(ctx(P3)), { players: { ...lastTurn.players, [P3]: { name: "Cid", hand: [10] } }, deck: [11, 12], discard: [], current: 0, turnsInRound: 0, round: 2, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));

console.log("\nControles del anfitrión");
await seed(playing({ current: 1 }));
await check("el anfitrión salta el turno del ausente", "allow", updateDoc(ref(ctx(HOST)), { current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await seed(playing({ current: 1 }));
await check("un jugador cualquiera salta turnos", "deny", updateDoc(ref(ctx(P3)), { current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await seed(playing({ current: 1 }));
await check("el anfitrión expulsa a un participante", "allow", updateDoc(ref(ctx(HOST)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [HOST, P3], discard: [3, 4], current: 1, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await seed(playing({ current: 1 }));
await check("un participante expulsa a otro", "deny", updateDoc(ref(ctx(P2)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 } }, playerOrder: [HOST, P2], discard: [5], current: 0, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await check("TRAMPA: expulsar al anfitrión y quedarse la sala", "deny", updateDoc(ref(ctx(P2)), { players: { [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [P2, P3], discard: [1, 2], current: 0, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));

await seed(playing({ current: 0 }));
await check("un participante se marcha por su cuenta", "allow", updateDoc(ref(ctx(P2)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [HOST, P3], discard: [3, 4], current: 0, turnsInRound: 0, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));
await seed(playing({ current: 0 }));
await check("marcharse y declararse ganador de paso", "deny", updateDoc(ref(ctx(P2)), { players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3 } }, playerOrder: [HOST, P3], discard: [3, 4], current: 0, turnsInRound: 0, phase: "turn", status: "ended", winner: P2, reveal: null, version: 2, updatedAt: 2 }));
await seed({ ...base(), playerOrder: [HOST, P2], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: 2 } } });
await check("el anfitrión expulsa desde el vestíbulo", "allow", updateDoc(ref(ctx(HOST)), { players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 } }, playerOrder: [HOST], discard: [], version: 2, updatedAt: 2 }));
await seed(playing({ current: 1, phase: "reveal", reveal: { cardId: 3, correct: true, playerUid: P2, playerName: "Bea" } }));
await check("el anfitrión salta un turno ya revelado", "allow", updateDoc(ref(ctx(HOST)), { current: 2, turnsInRound: 1, round: 1, phase: "turn", reveal: null, version: 2, updatedAt: 2 }));

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
// Estado a mitad de Pulso: Ana ya gastó el suyo y tiene la carta 10 en la mano del reto.
const enPulso = (over = {}) => conPulso({
  phase: "pulse", deck: [11, 12], pulseTurn: { targetUid: P2, cardId: 10 },
  players: {
    [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: true, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  }, ...over
});
const lanzar = (over = {}) => ({
  players: {
    [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: true, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  },
  deck: [11, 12], discard: [], phase: "pulse", pulseTurn: { targetUid: P2, cardId: 10 },
  version: 2, updatedAt: 2, ...over
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
await check("retarse a uno mismo", "deny", updateDoc(ref(ctx(HOST)), lanzar({ pulseTurn: { targetUid: HOST, cardId: 10 } })));
await seed(conPulso({ players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, pulseUsed: false, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } }));
await check("retar a quien ya recibió una carta esta ronda", "deny", updateDoc(ref(ctx(HOST)), lanzar()));
await seed(conPulso());
await check("aprovechar el lanzamiento para robar una carta", "deny", updateDoc(ref(ctx(HOST)), lanzar({ players: { [HOST]: { name: "Ana", hand: [1, 2, 3], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [4], joinedAt: 2, pulseUsed: false, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } })));

// Resolverlo: acertando pasa una carta mía al rival; fallando solo cambia mi mano.
const acierta = (over = {}) => ({
  players: {
    [HOST]: { name: "Ana", hand: [2], joinedAt: 1, pulseUsed: true, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4, 1], joinedAt: 2, pulseUsed: false, shieldRound: 1 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  },
  deck: [11, 12], discard: [], timeline: [20, 10], phase: "reveal", pulseTurn: null,
  reveal: { cardId: 10, correct: true, playerUid: HOST, playerName: "Ana", targetUid: P2, targetName: "Bea", giftId: 1 },
  version: 2, updatedAt: 2, ...over
});
const falla = (over = {}) => ({
  players: {
    [HOST]: { name: "Ana", hand: [1, 2, 11], joinedAt: 1, pulseUsed: true, shieldRound: 0 },
    [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, pulseUsed: false, shieldRound: 0 },
    [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 }
  },
  deck: [12], discard: [10], timeline: [20], phase: "reveal", pulseTurn: null,
  reveal: { cardId: 10, correct: false, playerUid: HOST, playerName: "Ana", targetUid: P2, targetName: "Bea", giftId: null },
  version: 2, updatedAt: 2, ...over
});

await seed(enPulso());
await check("acertar el Pulso y pasarle una carta al rival", "allow", updateDoc(ref(ctx(HOST)), acierta()));
await seed(enPulso());
await check("fallar el Pulso y robar del mazo", "allow", updateDoc(ref(ctx(HOST)), falla()));
await seed(enPulso());
await check("resolver el Pulso de otra persona", "deny", updateDoc(ref(ctx(P2)), acierta()));
// Lo que de verdad protege la regla nueva: que abrir dos manos no sea un permiso general.
await seed(enPulso());
await check("acertar quitándole una carta al rival en vez de dársela", "deny", updateDoc(ref(ctx(HOST)), acierta({ players: { [HOST]: { name: "Ana", hand: [1, 2, 3], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [4], joinedAt: 2, pulseUsed: false, shieldRound: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } })));
await seed(enPulso());
await check("fallar quitándole una carta al rival", "deny", updateDoc(ref(ctx(HOST)), falla({ players: { [HOST]: { name: "Ana", hand: [1, 2, 11], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3], joinedAt: 2, pulseUsed: false, shieldRound: 0 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } })));
await seed(enPulso());
await check("acertar tocando de paso la mano de quien no está en el Pulso", "deny", updateDoc(ref(ctx(HOST)), acierta({ players: { [HOST]: { name: "Ana", hand: [2], joinedAt: 1, pulseUsed: true, shieldRound: 0 }, [P2]: { name: "Bea", hand: [3, 4, 1], joinedAt: 2, pulseUsed: false, shieldRound: 1 }, [P3]: { name: "Cid", hand: [], joinedAt: 3, pulseUsed: false, shieldRound: 0 } } })));
await seed(enPulso());
await check("acertar sin dejar la carta en la línea", "deny", updateDoc(ref(ctx(HOST)), acierta({ timeline: [20] })));
await seed(enPulso());
await check("fallar sin descartar la carta del reto", "deny", updateDoc(ref(ctx(HOST)), falla({ discard: [], deck: [12] })));
await seed(enPulso());
await check("resolver diciendo que la carta era otra", "deny", updateDoc(ref(ctx(HOST)), acierta({ reveal: { cardId: 11, correct: true, playerUid: HOST, playerName: "Ana", targetUid: P2, targetName: "Bea", giftId: 1 } })));
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
