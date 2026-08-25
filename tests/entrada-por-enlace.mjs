// El segundo móvil abre el enlace o el QR, lee la sala y entra por transacción.
// La primera instantánea de onSnapshot llega entonces desde la caché, con la foto
// ANTERIOR a su entrada. connectToRoom() no debe confundir eso con una expulsión:
// por eso solo trata la ausencia como salida cuando la instantánea viene del servidor
// o cuando ya se había visto dentro de la sala.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-entrada",
  firestore: { host: "127.0.0.1", port: 8080, rules: "rules_version = \'2\'; service cloud.firestore { match /databases/{db}/documents { match /{doc=**} { allow read, write: if true; } } }" }
});

const INVITADO = "invitado-uid";
const ROOM = "ABCD2345";
const db = env.authenticatedContext(INVITADO).firestore();
const ref = doc(db, "rooms", ROOM);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

await setDoc(ref, {
  roomCode: ROOM, mode: "history", hostUid: "host-uid", status: "lobby", phase: "lobby", version: 1, handSize: 4,
  playerOrder: ["host-uid"], players: { "host-uid": { name: "Ana", hand: [], joinedAt: 1 } },
  deck: [], discard: [], timeline: [], current: 0, starter: "host-uid",
  turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null, createdAt: 1, updatedAt: 1
});

// openOnlineMode(): al abrir la invitación se lee la sala.
await getDoc(ref);

// joinRoom(): entra por transacción.
await runTransaction(db, async transaction => {
  const snapshot = await transaction.get(ref);
  const data = snapshot.data();
  transaction.update(ref, {
    players: { ...data.players, [INVITADO]: { name: "Bea", hand: [], joinedAt: 2 } },
    playerOrder: [...data.playerOrder, INVITADO], version: data.version + 1, updatedAt: 2
  });
});

// connectToRoom(): decide con la misma condición que online.js.
let seenSelfInRoom = false;
let expulsadoPorError = false;
const vistas = [];
await new Promise(resolve => {
  const stop = onSnapshot(ref, snapshot => {
    const dentro = snapshot.data().playerOrder.includes(INVITADO);
    vistas.push({ cache: snapshot.metadata.fromCache, dentro });
    if (dentro) seenSelfInRoom = true;
    else if (!seenSelfInRoom && snapshot.metadata.fromCache) { /* se ignora */ }
    else expulsadoPorError = true;
    if (dentro || vistas.length >= 3) { stop(); resolve(); }
  });
  setTimeout(() => { stop(); resolve(); }, 8000);
});

console.log("\nEntrada del segundo móvil por enlace o QR");
ok("la primera instantánea llega de la caché y aún no lo incluye", vistas[0] && vistas[0].cache && !vistas[0].dentro);
ok("no se le echa de la sala por esa instantánea", !expulsadoPorError);
ok("la instantánea del servidor sí lo incluye", vistas.some(v => !v.cache && v.dentro));

await env.cleanup();
console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
