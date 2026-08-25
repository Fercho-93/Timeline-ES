import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = await initializeTestEnvironment({
  projectId: "demo-compat",
  firestore: { rules: fs.readFileSync(path.join(REPO, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 }
});
const HOST = "host-uid", P2 = "p2-uid", ROOM = "ABCD2345";
const ctx = uid => env.authenticatedContext(uid).firestore();
const ref = db => doc(db, "rooms", ROOM);
let pass = 0, fail = 0;
async function check(label, expected, p) {
  try { await (expected === "allow" ? assertSucceeds(p) : assertFails(p)); pass++; console.log(`  ok    ${label}`); }
  catch (e) { fail++; console.log(`  FALLA ${label} → ${String(e).split("\n")[0]}`); }
}
// Sala tal y como la creaba la versión anterior: sin el campo winners.
const vieja = {
  roomCode: ROOM, mode: "history", hostUid: HOST, status: "lobby", phase: "lobby", version: 1, handSize: 4,
  playerOrder: [HOST, P2],
  players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: 2 } },
  deck: [], discard: [], timeline: [], current: 0, starter: HOST,
  turnsInRound: 0, round: 1, winner: null, reveal: null, createdAt: 1, updatedAt: 1
};
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "rooms", ROOM), vieja); });

console.log("\nSala antigua (sin campo winners) contra las reglas nuevas");
// Escritura tal cual la enviaba el cliente antiguo al pulsar "Barajar y empezar".
await check("empezar partida con el cliente ANTIGUO", "allow", updateDoc(ref(ctx(HOST)), {
  handSize: 2, players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 } },
  deck: [10], timeline: [20], discard: [], status: "playing", phase: "turn", current: 0, starter: HOST,
  turnsInRound: 0, round: 1, winner: null, reveal: null, version: 2, updatedAt: 2 }));
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "rooms", ROOM), vieja); });
await check("empezar partida con el cliente NUEVO", "allow", updateDoc(ref(ctx(HOST)), {
  handSize: 2, players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2 } },
  deck: [10], timeline: [20], discard: [], status: "playing", phase: "turn", current: 0, starter: HOST,
  turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null, version: 2, updatedAt: 2 }));

// Y el final de partida del cliente antiguo, que no enviaba winners.
const jugando = { ...vieja, status: "playing", phase: "reveal", deck: [10], timeline: [20],
  players: { [HOST]: { name: "Ana", hand: [1] }, [P2]: { name: "Bea", hand: [] } }, current: 1, turnsInRound: 1,
  reveal: { cardId: 3, correct: true, playerUid: P2, playerName: "Bea" } };
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "rooms", ROOM), jugando); });
await check("declarar ganador con el cliente ANTIGUO", "allow", updateDoc(ref(ctx(P2)), { status: "ended", phase: "finished", winner: P2, reveal: null, version: 2, updatedAt: 2 }));

await env.cleanup();
console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
