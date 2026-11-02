// Lo que se cerró en las reglas antes de publicar en las tiendas (revisión de noviembre de 2026): retos solo a
// quien ya jugó contigo, nombres que no se hacen pasar por el juego, documentos que no se pueden inflar, mesas
// públicas que nadie puede secuestrar, denuncias con cuota y turnos de Retos rápidos que no se quedan parados.
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, writeBatch, Timestamp } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = await initializeTestEnvironment({
  projectId: "demo-hilo",
  firestore: { rules: fs.readFileSync(path.join(REPO, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 }
});
const ctx = uid => env.authenticatedContext(uid, { email_verified: true, firebase: { sign_in_provider: "password" } }).firestore();
const seed = (route, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), ...route.split("/")), data));
const ago = ms => Timestamp.fromMillis(Date.now() - ms);
// Lo que las versiones anteriores de la app escriben se acepta hasta esta fecha (firestore.rules).
const LEGACY = Date.now() < Date.UTC(2026, 10, 20);
let pass = 0, fail = 0;
async function check(label, expected, promise) {
  try {
    await (expected === "allow" ? assertSucceeds(promise) : assertFails(promise));
    pass++; console.log(`  ok   ${label}`);
  } catch (e) { fail++; console.log(`  FALLA ${label} → ${String(e).split("\n")[0]}`); }
}
const free = uid => env.withSecurityRulesDisabled(c => Promise.all(["creationQuota", "roomCreation", "reportQuota"].map(col => deleteDoc(doc(c.firestore(), col, uid)))));

// ── Retos rápidos ──
const quick = (over = {}) => ({ version: 1, capacity: 2, host: "ana", members: ["ana"], names: ["Ana"], config: null, commands: [], revision: 0, phase: "lobby", actor: "ana", catalog: 1, ...over });
async function createQuick(uid, code, data) {
  await free(uid);
  const db = ctx(uid), b = writeBatch(db);
  b.set(doc(db, "quickRooms", code), { ...data, updatedAt: serverTimestamp() });
  b.set(doc(db, "creationQuota", uid), { lastCreatedAt: serverTimestamp(), kind: "quickRoom", target: code });
  return b.commit();
}

console.log("\nRetos solo a quien ya jugó contigo");
await env.clearFirestore();
await seed("quickRooms/ORIGEN2345", quick({ members: ["ana", "bea"], names: ["Ana", "Bea"], phase: "finished", updatedAt: ago(1000) }));
await seed("quickRooms/AJENAS2345", quick({ members: ["ana", "cid"], names: ["Ana", "Cid"], phase: "finished", updatedAt: ago(1000) }));
await check("retar a quien estuvo contigo en la sala de origen", "allow",
  createQuick("ana", "RETOBE2345", quick({ invitedUid: "bea", invitedName: "Bea", sourceRoom: "ORIGEN2345" })));
await check("retar a alguien que no estuvo en la sala de origen", "deny",
  createQuick("ana", "RETOXX2345", quick({ invitedUid: "zoe", invitedName: "Zoe", sourceRoom: "ORIGEN2345" })));
await check("retar desde una sala en la que tú no estabas", "deny",
  createQuick("bea", "RETOCC2345", quick({ host: "bea", members: ["bea"], names: ["Bea"], actor: "bea", invitedUid: "cid", invitedName: "Cid", sourceRoom: "AJENAS2345" })));
await check("retar desde una sala que no existe", "deny",
  createQuick("ana", "RETONO2345", quick({ invitedUid: "bea", invitedName: "Bea", sourceRoom: "NOEXIS2345" })));
await check("sala de origen sin rival fijo", "deny", createQuick("ana", "RETOSS2345", quick({ sourceRoom: "ORIGEN2345" })));
await check(LEGACY ? "sin sala de origen: se acepta mientras dure la transición" : "sin sala de origen ya no se acepta", LEGACY ? "allow" : "deny",
  createQuick("ana", "RETOLG2345", quick({ invitedUid: "bea", invitedName: "Bea" })));

console.log("\nNombres que ven los demás");
await check("crear una sala de Retos con nombre «Soporte Continuum»", "deny", createQuick("ana", "NOMBRA2345", quick({ names: ["Soporte Continuum"] })));
await check("crear una sala de Retos con nombre «Admin»", "deny", createQuick("ana", "NOMBRB2345", quick({ names: ["Admin"] })));
await check("crear una sala de Retos con nombre con símbolos", "deny", createQuick("ana", "NOMBRC2345", quick({ names: ["Ana<b>"] })));
await check("crear una sala de Retos con «María José»", "allow", createQuick("ana", "NOMBRD2345", quick({ names: ["María José"] })));
await check("entrar en una sala de Retos como «Staff»", "deny",
  updateDoc(doc(ctx("bea"), "quickRooms", "NOMBRD2345"), { members: ["ana", "bea"], names: ["María José", "Staff"], revision: 1, updatedAt: serverTimestamp() }));
await check("entrar en una sala de Retos como «Bea»", "allow",
  updateDoc(doc(ctx("bea"), "quickRooms", "NOMBRD2345"), { members: ["ana", "bea"], names: ["María José", "Bea"], revision: 1, updatedAt: serverTimestamp() }));

console.log("\nTurno de quien no responde (Retos rápidos)");
const live = (over = {}) => quick({
  capacity: 3, members: ["ana", "bea", "cid"], names: ["Ana", "Bea", "Cid"], phase: "turn", actor: "bea", revision: 5,
  config: { names: ["Ana", "Bea", "Cid"], rounds: [{ id: "poker", order: ["poker-1", "poker-2"] }], kind: "network", seconds: 15 }, ...over });
const forced = (by, writer, over = {}) => ({ commands: [{ type: "place", cardId: "poker-2", index: 0, by, forcedBy: writer }], phase: "result", actor: "bea", revision: 6, updatedAt: serverTimestamp(), ...over });
await seed("quickRooms/PARADA2345", live({ updatedAt: ago(60000) }));
await check("jugar por quien lleva un minuto sin responder (plazo de 15 s)", "allow", updateDoc(doc(ctx("cid"), "quickRooms", "PARADA2345"), forced("bea", "cid")));
await seed("quickRooms/PARADA2345", live({ updatedAt: ago(10000) }));
await check("jugar por otro antes de que se le acabe el tiempo", "deny", updateDoc(doc(ctx("cid"), "quickRooms", "PARADA2345"), forced("bea", "cid")));
await seed("quickRooms/PARADA2345", live({ updatedAt: ago(60000) }));
await check("firmar el turno forzado en nombre de otro", "deny", updateDoc(doc(ctx("cid"), "quickRooms", "PARADA2345"), forced("bea", "ana")));
await check("forzar un turno que no es de quien no responde", "deny", updateDoc(doc(ctx("cid"), "quickRooms", "PARADA2345"), forced("ana", "cid")));
await check("alguien de fuera de la sala fuerza el turno", "deny", updateDoc(doc(ctx("zoe"), "quickRooms", "PARADA2345"), forced("bea", "zoe")));
await seed("quickRooms/PARADA2345", live({ updatedAt: ago(60000), config: { names: ["Ana", "Bea", "Cid"], rounds: [{ id: "poker", order: ["poker-1", "poker-2"] }], kind: "network" } }));
await check("sin plazo por jugada, a los 60 s todavía no se fuerza", "deny", updateDoc(doc(ctx("cid"), "quickRooms", "PARADA2345"), forced("bea", "cid")));
await seed("quickRooms/PARADA2345", live({ updatedAt: ago(100000), config: { names: ["Ana", "Bea", "Cid"], rounds: [{ id: "poker", order: ["poker-1", "poker-2"] }], kind: "network" } }));
await check("sin plazo por jugada, a los 100 s sí", "allow", updateDoc(doc(ctx("cid"), "quickRooms", "PARADA2345"), forced("bea", "cid")));
await seed("quickRooms/PARADA2345", live({ phase: "result", updatedAt: ago(60000) }));
await check("seguir por quien no pulsa tras ver su resultado", "allow", updateDoc(doc(ctx("ana"), "quickRooms", "PARADA2345"),
  { commands: [{ type: "ack", by: "bea", forcedBy: "ana" }], phase: "turn", actor: "cid", revision: 6, updatedAt: serverTimestamp() }));
await seed("quickRooms/DUELOS2345", live({ capacity: 2, members: ["ana", "bea"], names: ["Ana", "Bea"], updatedAt: ago(600000), config: { names: ["Ana", "Bea"], rounds: [{ id: "poker", order: ["poker-1", "poker-2"] }], kind: "duel" } }));
await check("en un duelo por turnos no se fuerza nada", "deny", updateDoc(doc(ctx("ana"), "quickRooms", "DUELOS2345"), forced("bea", "ana")));

console.log("\nRetos rápidos en juego: saltar turnos y sacar de la partida");
// Sala privada de tres, en el turno de Bea, que acaba de empezar (no ha pasado su plazo).
await seed("quickRooms/PRIVAD2345", live({ updatedAt: ago(2000) }));
await check("quien lleva una sala privada salta el turno de quien no juega, sin esperar al plazo", "allow", updateDoc(doc(ctx("ana"), "quickRooms", "PRIVAD2345"), forced("bea", "ana")));
await seed("quickRooms/PRIVAD2345", live({ updatedAt: ago(2000) }));
await check("otra persona de la sala no puede saltarlo antes de tiempo", "deny", updateDoc(doc(ctx("cid"), "quickRooms", "PRIVAD2345"), forced("bea", "cid")));
const drop = (who, player, over = {}) => ({ commands: [{ type: "drop", player, by: who }], phase: "turn", actor: "cid", revision: 6, updatedAt: serverTimestamp(), ...over });
await seed("quickRooms/PRIVAD2345", live({ updatedAt: ago(2000) }));
await check("quien lleva la sala saca a alguien de la partida", "allow", updateDoc(doc(ctx("ana"), "quickRooms", "PRIVAD2345"), drop("ana", 1)));
await seed("quickRooms/PRIVAD2345", live({ updatedAt: ago(2000) }));
await check("otra persona no puede sacar a nadie", "deny", updateDoc(doc(ctx("cid"), "quickRooms", "PRIVAD2345"), drop("cid", 1)));
await seed("quickRooms/PRIVAD2345", live({ updatedAt: ago(2000) }));
await check("quien lleva la sala no se saca a sí mismo", "deny", updateDoc(doc(ctx("ana"), "quickRooms", "PRIVAD2345"), drop("ana", 0, { actor: "bea" })));
await seed("quickRooms/MESAPU2345", live({ matchmaking: "public", updatedAt: ago(2000) }));
await check("en una mesa pública no se saca a quien sigue jugando a tiempo", "deny", updateDoc(doc(ctx("ana"), "quickRooms", "MESAPU2345"), drop("ana", 1)));
await check("ni se le salta el turno", "deny", updateDoc(doc(ctx("ana"), "quickRooms", "MESAPU2345"), forced("bea", "ana")));
await seed("quickRooms/MESAPU2345", live({ matchmaking: "public", updatedAt: ago(60000) }));
await check("en una mesa pública se saca a quien tiene el turno y no responde", "allow", updateDoc(doc(ctx("ana"), "quickRooms", "MESAPU2345"), drop("ana", 1)));
await seed("quickRooms/MESAPU2345", live({ matchmaking: "public", updatedAt: ago(60000) }));
await check("pero no a otra persona que no tiene el turno", "deny", updateDoc(doc(ctx("ana"), "quickRooms", "MESAPU2345"), drop("ana", 2, { actor: "bea", phase: "turn" })));

// ── Salas de las colecciones ──
const HOST = "host-uid", P2 = "p2-uid", P3 = "p3-uid";
const base = (code, over = {}) => ({ winners: null,
  roomCode: code, mode: "history", deckFingerprint: "167.test1", hostUid: HOST, status: "lobby", phase: "lobby", version: 1, handSize: 4,
  playerOrder: [HOST], players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 } },
  deck: [], discard: [], timeline: [], current: 0, starter: HOST,
  turnsInRound: 0, round: 1, winner: null, reveal: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over });
async function createRoom(code, data) {
  await free(HOST);
  const db = ctx(HOST), b = writeBatch(db);
  b.set(doc(db, "roomCreation", HOST), { roomCode: code, lastCreatedAt: serverTimestamp() });
  b.set(doc(db, "rooms", code), data);
  return b.commit();
}
console.log("\nSalas: nombres, campos y código");
await check("crear una sala normal", "allow", createRoom("SALA2345", base("SALA2345")));
await check("crear una sala con nombre «Soporte Continuum»", "deny", createRoom("SALB2345", base("SALB2345", { players: { [HOST]: { name: "Soporte Continuum", hand: [], joinedAt: 1 } } })));
await check("crear una sala con un campo de 900 KB", "deny", createRoom("SALC2345", base("SALC2345", { pad: "x".repeat(900000) })));
await check("crear una sala con una hora de entrada de 900 KB", "deny", createRoom("SALD2345", base("SALD2345", { players: { [HOST]: { name: "Ana", hand: [], joinedAt: "x".repeat(900000) } } })));
await check("crear una sala con un código de diez caracteres (el de una mesa de Retos)", "deny", createRoom("SALAQUICK2", base("SALAQUICK2")));
await check("entrar en una sala con una hora de entrada de texto", "deny", updateDoc(doc(ctx(P2), "rooms", "SALA2345"),
  { players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: "ayer" } }, playerOrder: [HOST, P2], version: 2, updatedAt: serverTimestamp() }));
await check("entrar en una sala como «Moderador»", "deny", updateDoc(doc(ctx(P2), "rooms", "SALA2345"),
  { players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Moderador", hand: [], joinedAt: 2 } }, playerOrder: [HOST, P2], version: 2, updatedAt: serverTimestamp() }));

console.log("\nMesas públicas en juego: expulsar y saltar turnos");
const PUB = "PUBL2345";
const publicPlaying = (over = {}) => ({ ...base(PUB), matchmaking: "public", capacity: 3, clientVersion: 1, queueKey: "history:3:v1:test",
  status: "playing", phase: "turn", turnSeconds: 30, turnStartedAt: Timestamp.now(),
  playerOrder: [HOST, P2, P3],
  players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, clientVersion: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, clientVersion: 1 }, [P3]: { name: "Cid", hand: [5], joinedAt: 3, clientVersion: 1 } },
  deck: [10, 11, 12], timeline: [20], current: 1, createdAt: ago(600000), updatedAt: Timestamp.now(), ...over });
const presence = (who, age, visible = true) => seed(`rooms/${PUB}/presence/${who}`, { seenAt: ago(age), visible });
const kickP3 = () => updateDoc(doc(ctx(HOST), "rooms", PUB), {
  players: { [HOST]: { name: "Ana", hand: [1, 2], joinedAt: 1, clientVersion: 1 }, [P2]: { name: "Bea", hand: [3, 4], joinedAt: 2, clientVersion: 1 } },
  playerOrder: [HOST, P2], discard: [5], version: 2, updatedAt: serverTimestamp() });
await seed(`rooms/${PUB}`, publicPlaying({ version: 1 })); await presence(P3, 5000);
await check("echar a quien sigue jugando en una mesa pública", "deny", kickP3());
await seed(`rooms/${PUB}`, publicPlaying({ version: 1 })); await presence(P3, 120000);
await check("echar a quien lleva dos minutos sin señal", "allow", kickP3());
await seed(`rooms/${PUB}`, publicPlaying({ version: 1 })); await presence(P3, 60000, false);
await check("echar a quien lleva un minuto con la app en segundo plano", "allow", kickP3());
const skipP2 = () => updateDoc(doc(ctx(HOST), "rooms", PUB), { current: 2, turnsInRound: 1, phase: "turn", reveal: null, turnStartedAt: serverTimestamp(), version: 2, updatedAt: serverTimestamp() });
await seed(`rooms/${PUB}`, publicPlaying({ version: 1, turnStartedAt: ago(5000) })); await presence(P2, 3000);
await check("saltar el turno de quien está jugando a tiempo", "deny", skipP2());
await seed(`rooms/${PUB}`, publicPlaying({ version: 1, turnStartedAt: ago(40000) })); await presence(P2, 3000);
await check("saltar el turno de quien agotó sus 30 s", "allow", skipP2());
await seed(`rooms/${PUB}`, publicPlaying({ version: 1, turnSeconds: 0, turnStartedAt: ago(40000) })); await presence(P2, 120000);
await check("sin tiempo por jugada, saltar a quien dejó de dar señales", "allow", skipP2());
await seed(`rooms/${PUB}`, publicPlaying({ version: 1, matchmaking: null, turnStartedAt: ago(5000) })); await presence(P2, 3000);
await check("entre amigos (sala privada) el anfitrión puede saltar cuando quiera", "allow", skipP2());

console.log("\nRevancha en la sala por internet");
const REV = "REVA2345";
const ended = (over = {}) => ({ ...base(REV), status: "ended", phase: "finished", playerOrder: [HOST, P2],
  players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1, pulseUsed: true, shieldRound: 2 }, [P2]: { name: "Bea", hand: [7, 8], joinedAt: 2, pulseUsed: false, shieldRound: 0 } },
  deck: [10, 11], discard: [12], timeline: [20, 21, 22], current: 1, turnsInRound: 1, round: 3, winner: HOST, winners: [HOST], reveal: null,
  final: { round: 3, cardId: 5 }, createdAt: ago(600000), updatedAt: ago(1000), version: 9, ...over });
const rematch = (who, over = {}) => updateDoc(doc(ctx(who), "rooms", REV), {
  status: "lobby", phase: "lobby", players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1, pulseUsed: true, shieldRound: 2 }, [P2]: { name: "Bea", hand: [], joinedAt: 2, pulseUsed: false, shieldRound: 0 } },
  deck: [], discard: [], timeline: [], current: 0, starter: HOST, turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
  final: deleteField(), finalRoundOffset: 3, version: 10, updatedAt: serverTimestamp(), ...over });
await seed(`rooms/${REV}`, ended());
await check("quien lleva la sala pide revancha: la misma mesa vuelve a la sala de espera", "allow", rematch(HOST));
await seed(`rooms/${REV}`, ended());
await check("otra persona de la sala no puede pedirla", "deny", rematch(P2));
await seed(`rooms/${REV}`, ended());
await check("la revancha no puede cambiar el nombre de nadie", "deny", rematch(HOST, { players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1 }, [P2]: { name: "Otra", hand: [], joinedAt: 2 } } }));
await seed(`rooms/${REV}`, ended());
await check("ni repartir cartas", "deny", rematch(HOST, { players: { [HOST]: { name: "Ana", hand: [1, 2, 3], joinedAt: 1 }, [P2]: { name: "Bea", hand: [], joinedAt: 2 } } }));
await seed(`rooms/${REV}`, ended());
await check("ni reiniciar la numeración de la final", "deny", rematch(HOST, { finalRoundOffset: 0 }));
await seed(`rooms/${REV}`, ended({ status: "playing", phase: "turn" }));
await check("con la partida en juego no hay revancha", "deny", rematch(HOST));
await seed(`rooms/${REV}`, ended({ matchmaking: "public", capacity: 2, clientVersion: 1, queueKey: "history:2:v1:x" }));
await check("en una mesa pública tampoco: se busca otra partida", "deny", rematch(HOST));

console.log("\nTablón de mesas");
await seed("quickRooms/MESAQK2345", quick({ capacity: 4, matchmaking: "public", updatedAt: ago(1000) }));
await seed("publicTables/MESAQK2345", { kind: "quick", code: "MESAQK2345", mode: "quick", capacity: 4, seconds: 30, players: 1, names: ["Ana"], hostUid: "ana", hostAvatar: null, clientVersion: 1, fingerprint: 1, length: 3, keep: false, updatedAt: ago(1000) });
// Una sala de las colecciones con el mismo código (solo posible saltándose las reglas) no sirve para quedarse la ficha.
await seed("rooms/MESAQK2345", { ...base("MESAQK2345"), hostUid: "eve", matchmaking: "public", capacity: 4, playerOrder: ["eve"], players: { eve: { name: "Eve", hand: [], joinedAt: 1 } }, createdAt: ago(1000), updatedAt: ago(1000) });
await check("convertir la ficha de una mesa ajena en una de las colecciones", "deny", setDoc(doc(ctx("eve"), "publicTables", "MESAQK2345"),
  { kind: "collections", code: "MESAQK2345", mode: "history", capacity: 4, seconds: 30, handSize: 4, players: 1, names: ["Eve"], hostUid: "eve", hostAvatar: null, clientVersion: 1, fingerprint: "167.test1", updatedAt: serverTimestamp() }));
await check("anunciar una mesa con nombre «Soporte»", "deny", setDoc(doc(ctx("ana"), "publicTables", "MESAQK2345"),
  { kind: "quick", code: "MESAQK2345", mode: "quick", capacity: 4, seconds: 30, players: 1, names: ["Soporte"], hostUid: "ana", hostAvatar: null, clientVersion: 1, fingerprint: 1, length: 3, keep: false, updatedAt: serverTimestamp() }));
await check("renovar la ficha de tu mesa", "allow", setDoc(doc(ctx("ana"), "publicTables", "MESAQK2345"),
  { kind: "quick", code: "MESAQK2345", mode: "quick", capacity: 4, seconds: 30, players: 1, names: ["Ana"], hostUid: "ana", hostAvatar: null, clientVersion: 1, fingerprint: 1, length: 3, keep: false, updatedAt: serverTimestamp() }));

console.log("\nCola de la partida rápida (colecciones)");
await seed("rooms/COLA2345", { ...base("COLA2345"), matchmaking: "public", capacity: 4, clientVersion: 1, queueKey: "history:4:v1:167.test1", roomCode: "COLA2345", createdAt: ago(1000), updatedAt: ago(1000), players: { [HOST]: { name: "Ana", hand: [], joinedAt: 1, clientVersion: 1 } } });
await seed("publicQueues/history:4:v1:167.test1", { queueKey: "history:4:v1:167.test1", roomCode: "COLA2345", mode: "history", capacity: 4, clientVersion: 1, deckFingerprint: "167.test1", status: "waiting", updatedAt: ago(100000) });
await check("alguien de fuera renueva la cola de otra mesa", "deny", updateDoc(doc(ctx("zoe"), "publicQueues", "history:4:v1:167.test1"), { updatedAt: serverTimestamp() }));
await check("quien lleva la mesa renueva su cola", "allow", updateDoc(doc(ctx(HOST), "publicQueues", "history:4:v1:167.test1"), { updatedAt: serverTimestamp() }));

console.log("\nDuelos por turnos: campos con tope");
async function createDuel(uid, id, over = {}) {
  await free(uid);
  const db = ctx(uid), b = writeBatch(db);
  b.set(doc(db, "turnDuels", id), { id, mode: "history", kind: "orden", seed: "abc", total: 10, turnIndex: 0, turnUid: null, playersOrder: [uid], players: { [uid]: { alias: "Ana" } },
    status: "waiting", plays: [], timeline: [], scores: { [uid]: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over });
  b.set(doc(db, "creationQuota", uid), { lastCreatedAt: serverTimestamp(), kind: "turnDuel", target: id });
  return b.commit();
}
await check("crear un duelo normal", "allow", createDuel("ana", "duelo-normal"));
await check("crear un duelo con un identificador de 900 KB", "deny", createDuel("ana", "duelo-inflado", { id: "x".repeat(900000) }));
await check("crear un duelo con datos de revancha sin rival", "deny", createDuel("ana", "duelo-revancha", { sourceDuel: "x".repeat(1000) }));
await check("crear un duelo con una carta de texto en la línea", "deny", createDuel("ana", "duelo-linea", { timeline: ["x".repeat(1000)] }));
await check("crear un duelo con el alias «Admin»", "deny", createDuel("ana", "duelo-admin", { players: { ana: { alias: "Admin" } } }));

console.log("\nDenuncias");
const report = (uid, target, withQuota = true) => {
  const db = ctx(uid), b = writeBatch(db);
  b.set(doc(db, "reports", `${uid}_${target}`), { reporter: uid, target, targetAlias: "X", reason: "otro", context: "mesa", createdAt: serverTimestamp() });
  if (withQuota) b.set(doc(db, "reportQuota", uid), { lastAt: serverTimestamp(), target });
  return b.commit();
};
await free("ana");
await check("denunciar con su registro de cuota", "allow", report("ana", "uidobjetivo1"));
await check("otra denuncia en menos de 15 s", "deny", report("ana", "uidobjetivo2"));
await check("denunciar a un identificador con símbolos", "deny", report("bea", "uid malo!"));
await free("cid");
await check(LEGACY ? "sin cuota: se acepta mientras dure la transición" : "sin cuota ya no se acepta", LEGACY ? "allow" : "deny", report("cid", "uidobjetivo3", false));

await env.cleanup();
console.log(`\n${pass} correctas, ${fail} fallidas`);
if (fail) process.exit(1);
console.log("Lanzamiento: retos, nombres, tamaños, mesas públicas, denuncias y turnos forzados: OK");
