// Humo del modo "Sin conexión" sobre el DOM real de index.html: entra por el menú de
// verdad, crea una sala, comprueba el vestíbulo y confirma que lo que sí necesita WebRTC
// falla con un aviso claro en vez de romper la pantalla. No hay RTCPeerConnection en
// Node, así que la partida completa de dos personas se juega con un transporte de
// mentira que pasa los mensajes de una ventana a otra: todo lo demás (sesión, sala,
// pantallas) es el código real.
import { gameHtml } from "./game-fixture.mjs";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Se entra como en la aplicación: Inicio → Jugar con amigos → Wi-Fi local → mazo. Ya no
// hay que volver a elegir el formato después del mazo: la sala se abre directamente.
async function entrarWifi(w) {
  const pausa = () => new Promise(resolve => setTimeout(resolve, 0));
  await pausa();
  for (const sel of ['[data-action="friends-hub"]', '[data-friend-route="wifi"]', '[data-block="historia"]', '[data-mode="history"]']) { click(w, sel); await pausa(); }
  return w.document;
}

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function guiones() { return [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]); }
function boot() {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  window.scrollTo = () => {}; window.Element.prototype.scrollIntoView = () => {};
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
const submit = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); };

console.log("\nEntrar en el modo desde el menú de verdad");
let w = boot();
await entrarWifi(w);
ok("lleva a la entrada del modo sin conexión", w.document.body.innerHTML.includes("Una mesa"));
ok("avisa del punto de acceso Wi-Fi antes de nada", /punto de acceso Wi-Fi/.test(w.document.body.innerHTML));
ok("pide activar la cámara aquí, no cuando ya haga falta escanear", !!w.document.querySelector('[data-local-action="warm-camera"]'));
ok("el nombre llega ya escrito con el de este móvil", !!w.document.getElementById("local-name-host").value);

console.log("\nCrear una sala");
w.document.getElementById("local-name-host").value = "Fer";
submit(w, '[data-local-form="create"]');
ok("el vestíbulo muestra un código de ocho caracteres", /<strong>[A-Z2-9]{8}<\/strong>/.test(w.document.body.innerHTML));
ok("el anfitrión ya está sentado a la mesa", /Fer/.test(w.document.body.innerHTML) && w.document.body.innerHTML.includes("Anfitrión"));
ok("con una sola persona no se puede empezar todavía", !w.document.querySelector('[data-local-action="start"]') && /Esperando a alguien más/.test(w.document.body.innerHTML));
ok("invitar a alguien está disponible", !!w.document.querySelector('[data-local-action="invite"]'));

console.log("\nInvitar sin WebRTC disponible (como en esta prueba)");
click(w, '[data-local-action="invite"]');
await new Promise(resolve => setTimeout(resolve, 0));
ok("no revienta: vuelve al vestíbulo con un aviso, no con una pantalla en blanco", w.document.body.innerHTML.includes("Preparando la mesa") || w.document.body.innerHTML.includes("Sala de espera") || w.document.body.innerHTML.includes("Mesa de exploradores"));

console.log("\nUnirse a una sala con un código inválido");
w = boot();
await entrarWifi(w);
click(w, '[data-local-action="go-unirse"]');
ok("pide el nombre y el código pegado", !!w.document.getElementById("local-guest-name") && !!w.document.getElementById("local-guest-offer"));
w.document.getElementById("local-guest-name").value = "Ana";
w.document.getElementById("local-guest-offer").value = "esto no es un código válido";
submit(w, '[data-local-form="join-offer"]');
await new Promise(resolve => setTimeout(resolve, 0));
ok("un código inválido no rompe la pantalla, se queda en la misma", !!w.document.getElementById("local-guest-offer"));

console.log("\nVolver atrás no se queda a medias");
click(w, '[data-local-action="go-entrada"]');
ok("vuelve a la entrada del modo, no al menú principal", w.document.body.innerHTML.includes("Una mesa"));


// ---------------------------------------------------------------------------
// Transporte de mentira: el mismo contrato que `local-transport.js`, pero los mensajes
// viajan entre dos ventanas de JSDOM en vez de por WebRTC. Se copian por JSON, como en
// el cable, y llegan en otra vuelta del bucle de eventos.
function fakeNetwork() {
  const offers = new Map();
  let n = 0;
  const later = fn => setTimeout(fn, 0);
  const wire = value => JSON.parse(JSON.stringify(value));
  function host(onMessage, onPeerOpen, onPeerClose) {
    const peers = new Map();
    return {
      addPeer() {
        const peerId = String(++n);
        const peer = { peerId, guest: null, open: false };
        peers.set(peerId, peer);
        offers.set(`FAKE-OFFER-${peerId}`, peer);
        peer.toHost = message => later(() => onMessage(peerId, wire(message)));
        peer.lost = () => { if (!peers.has(peerId)) return; peers.delete(peerId); later(() => onPeerClose?.(peerId)); };
        return {
          peerId,
          offerSignal: async () => `FAKE-OFFER-${peerId}`,
          acceptAnswer: async answer => { 
            if (answer !== `FAKE-ANSWER-${peerId}` || !peer.guest) throw new Error("INVALID_SIGNAL");
            peer.open = true;
            later(() => { onPeerOpen?.(peerId); peer.guest.onOpen?.(); });
          }
        };
      },
      removePeer(peerId) { const peer = peers.get(peerId); peers.delete(peerId); if (peer?.guest) later(() => peer.guest.onClose?.()); },
      broadcast(type, data) { for (const peer of peers.values()) if (peer.open && peer.guest) { const message = wire({ type, data }); later(() => peer.guest.onMessage(message)); } },
      sendTo(peerId, type, data) { const peer = peers.get(peerId); if (!peer?.guest) return false; const message = wire({ type, data }); later(() => peer.guest.onMessage(message)); return true; },
      isPeerReady: peerId => !!peers.get(peerId)?.open,
      closeAll() { for (const peer of peers.values()) if (peer.guest) later(() => peer.guest.onClose?.()); peers.clear(); }
    };
  }
  function guest(offer, onMessage, onOpen, onClose) {
    const peer = offers.get(offer);
    if (!peer) throw new Error("INVALID_SIGNAL");
    peer.guest = { onMessage, onOpen, onClose };
    let closed = false;
    return {
      answerSignal: async () => `FAKE-ANSWER-${peer.peerId}`,
      send(type, data) { if (closed || !peer.open) return false; peer.toHost({ type, data }); return true; },
      close() { if (closed) return; closed = true; peer.lost(); },
      isReady: () => peer.open && !closed
    };
  }
  return { install(win) { win.CONTINUUM.LocalTransport = { ...win.CONTINUUM.LocalTransport, createHostSession: host, createGuestPeer: guest }; } };
}

const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
// Pintar una pantalla entera en JSDOM tarda lo suyo: se espera a que se cumpla lo
// esperado (con un límite) en vez de fiarlo a una pausa fija.
const until = async (cond, ms = 3000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await tick(5); };
const html = win => win.document.body.innerHTML;
const pantalla = win => win.document.getElementById("app").dataset.screen;

console.log("\nPartida completa entre dos móviles");
const red = fakeNetwork();
const anfitrion = boot(), invitada = boot();
for (const win of [anfitrion, invitada]) { red.install(win); win.confirm = () => true; }
const erroresAnfitrion = [];
anfitrion.addEventListener("error", event => erroresAnfitrion.push(event.message));
await entrarWifi(anfitrion);
anfitrion.document.getElementById("local-name-host").value = "Fer";
submit(anfitrion, '[data-local-form="create"]');
click(anfitrion, '[data-local-action="invite"]');
await tick();
const invitacion = anfitrion.document.querySelector(".signal-box")?.value || anfitrion.document.querySelector(".signal-box")?.textContent;
ok("el anfitrión tiene una invitación que compartir", /^CTM1:/.test(invitacion || ""));

await entrarWifi(invitada);
click(invitada, '[data-local-action="go-unirse"]');
invitada.document.getElementById("local-guest-name").value = "Ana";
invitada.document.getElementById("local-guest-offer").value = invitacion;
submit(invitada, '[data-local-form="join-offer"]');
await tick();
const respuesta = invitada.document.querySelector(".signal-box")?.value || invitada.document.querySelector(".signal-box")?.textContent;
ok("la invitada genera su respuesta", respuesta === "FAKE-ANSWER-1");

anfitrion.document.getElementById("local-answer").value = respuesta;
submit(anfitrion, '[data-local-form="accept-answer"]');
await until(() => pantalla(anfitrion) === "local-lobby" && pantalla(invitada) === "local-lobby");
ok("el anfitrión ve a las dos personas en la mesa", /Ana/.test(html(anfitrion)) && pantalla(anfitrion) === "local-lobby");
ok("la invitada pasa sola al vestíbulo", pantalla(invitada) === "local-lobby" && /Fer/.test(html(invitada)));

anfitrion.document.getElementById("local-hand-size").value = "2";
anfitrion.document.getElementById("local-turn-seconds").value = "0";
click(anfitrion, '[data-local-action="start"]');
await until(() => pantalla(invitada) === "local-game");
ok("la partida arranca en los dos móviles", pantalla(anfitrion) === "local-game" && pantalla(invitada) === "local-game");
ok("el anfitrión ve su propia mano (antes la pantalla se rompía)", anfitrion.document.querySelectorAll(".hand-card").length === 2 && !erroresAnfitrion.length);
ok("sin límite de tiempo no se enseña reloj", !anfitrion.document.getElementById("turn-timer"));

let jugadas = 0;
for (let i = 0; i < 400 && pantalla(anfitrion) === "local-game"; i++) {
  const turno = [anfitrion, invitada].find(win => win.document.querySelector(".hand-card:not([disabled])"));
  const sigue = [anfitrion, invitada].find(win => win.document.querySelector('[data-local-action="finish-turn"]'));
  if (sigue && !turno) { click(sigue, '[data-local-action="finish-turn"]'); await tick(); continue; }
  if (!turno) { await tick(); continue; }
  // Se juega bien, para que la partida termine en pocas vueltas: el hueco correcto se
  // calcula con las mismas funciones del juego.
  const CTg = turno.CONTINUUM;
  const carta = turno.document.querySelector(".hand-card:not([disabled])");
  const porId = id => CTg.cards("history").find(card => card.id === Number(id));
  const linea = [...turno.document.querySelectorAll(".timeline .timeline-card")].map(el => porId(el.dataset.id));
  const hueco = CTg.correctIndex("history", linea, porId(carta.dataset.id));
  click(turno, `.hand-card[data-id="${carta.dataset.id}"]`);
  click(turno, `.slot[data-local-action="place"][data-index="${hueco}"]`);
  click(turno, '[data-local-action="confirm-place"]');
  jugadas++;
  await until(() => [anfitrion, invitada].every(win => win.document.querySelector('[data-local-action="finish-turn"], .local-final, [data-local-action="rematch"], [data-local-action="leave"]') || pantalla(win) === "local-final"), 1000);
}
await until(() => pantalla(anfitrion) === "local-final" && pantalla(invitada) === "local-final");
ok(`la partida termina en los dos móviles (${jugadas} jugadas)`, pantalla(anfitrion) === "local-final" && pantalla(invitada) === "local-final");
ok("se anuncia quién gana", /gana|ganan/.test(html(anfitrion)));
ok("el anfitrión puede pedir la revancha", !!anfitrion.document.querySelector('[data-local-action="rematch"]'));
ok("la invitada puede salir de la pantalla final (antes el botón no hacía nada)", !!invitada.document.querySelector('[data-local-action="leave"]'));

console.log("\nRevancha con la misma mesa");
click(anfitrion, '[data-local-action="rematch"]');
await until(() => pantalla(invitada) === "local-lobby");
ok("los dos vuelven al vestíbulo, con las mismas personas", pantalla(anfitrion) === "local-lobby" && pantalla(invitada) === "local-lobby" && /Ana/.test(html(anfitrion)));

console.log("\nReloj del turno y menú de la sala");
anfitrion.document.getElementById("local-turn-seconds").value = "20";
click(anfitrion, '[data-local-action="start"]');
await until(() => pantalla(invitada) === "local-game");
ok("con límite de tiempo se enseña la cuenta atrás", !!anfitrion.document.getElementById("turn-timer") && !!invitada.document.getElementById("turn-timer"));
click(anfitrion, '[data-local-action="room-menu"]');
ok("volver abre el menú de la sala en vez del vestíbulo", !!anfitrion.document.querySelector("[data-local-room-overlay]") && pantalla(anfitrion) === "local-game");
const turnoDeAna = /Turno de Ana/.test(anfitrion.document.querySelector(".turn-name").textContent);
ok("el anfitrión puede saltar el turno ajeno desde el menú", !!anfitrion.document.querySelector('[data-local-action="skip"]') === turnoDeAna);
click(anfitrion, '[data-local-action="close-room-menu"]');

console.log("\nSi el móvil de la invitada se desconecta");
click(invitada, '[data-local-action="room-menu"]');
click(invitada, '[data-local-action="leave"]');
await until(() => pantalla(anfitrion) === "local-final");
ok("la invitada vuelve a la entrada del modo", pantalla(invitada) === "local-entrada");
ok("la partida del anfitrión termina en vez de esperar un turno que no llegará", pantalla(anfitrion) === "local-final" && /Fer/.test(html(anfitrion)));

console.log("\nSi el anfitrión cierra la sala");
const red2 = fakeNetwork();
const h2 = boot(), g2 = boot();
for (const win of [h2, g2]) { red2.install(win); win.confirm = () => true; }
await entrarWifi(h2); submit(h2, '[data-local-form="create"]');
click(h2, '[data-local-action="invite"]'); await tick();
await entrarWifi(g2); click(g2, '[data-local-action="go-unirse"]');
g2.document.getElementById("local-guest-offer").value = h2.document.querySelector(".signal-box").textContent;
submit(g2, '[data-local-form="join-offer"]'); await tick();
h2.document.getElementById("local-answer").value = g2.document.querySelector(".signal-box").textContent;
submit(h2, '[data-local-form="accept-answer"]');
await until(() => pantalla(g2) === "local-lobby");
click(h2, '[data-local-action="leave"]');
await until(() => pantalla(g2) === "local-entrada");
ok("la invitada no se queda congelada: vuelve a la entrada con un aviso", pantalla(g2) === "local-entrada" && /conexión|cerrado/.test(g2.document.getElementById("toast")?.textContent || ""));

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
