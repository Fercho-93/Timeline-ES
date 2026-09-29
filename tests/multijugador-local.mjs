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
  for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="wifi"]', '[data-inline-route="wifi"]', '#mode-inline-drawer [data-block="historia"]', '#mode-inline-drawer [data-mode="history"]']) { click(w, sel); await pausa(); }
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

console.log("\nUnirse directo desde el menú de Wi-Fi local, sin elegir mazo");
w = boot();
{
  const pausa = () => new Promise(resolve => setTimeout(resolve, 0));
  await pausa();
  for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="wifi"]']) { click(w, sel); await pausa(); }
  ok("el menú de Wi-Fi local ofrece «Unirme a una sala»", !!w.document.querySelector('[data-action="wifi-join"]'));
  click(w, '[data-action="wifi-join"]'); await pausa();
  ok("abre directamente la pantalla de unirse", /Unirse a una sala/.test(w.document.body.innerHTML) && !!w.document.querySelector('[data-local-action="scan-offer"]'));
  ok("explica que no hay que elegir mazo y pide la cámara aquí", /No hace falta elegir mazo/.test(w.document.body.innerHTML) && !!w.document.querySelector('[data-local-action="warm-camera"]'));
  click(w, '[data-local-action="back"]'); await pausa();
  ok("volver lleva otra vez al menú de Wi-Fi local", !!w.document.querySelector('[data-action="wifi-join"]'));
}

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
  // Un corte de verdad (Wi-Fi que se va, móvil que se bloquea): los dos extremos se
  // enteran a la vez y nadie ha pedido salir.
  function drop() {
    for (const peer of [...offers.values()].reverse()) {
      if (!peer.open || !peer.guest || peer.dropped) continue;
      peer.dropped = true; peer.open = false;
      later(() => peer.guest.onClose?.());
      peer.lost();
      return true;
    }
    return false;
  }
  return { drop, install(win) { win.CONTINUUM.LocalTransport = { ...win.CONTINUUM.LocalTransport, createHostSession: host, createGuestPeer: guest }; } };
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
const elige = (win, id, value) => { const el = win.document.getElementById(id); if (typeof value === "boolean") el.checked = value; else el.value = value; el.dispatchEvent(new win.Event("change", { bubbles: true })); };
const valorDe = (win, titulo) => { const CTw = win.CONTINUUM; const carta = CTw.cards("history").find(item => item.title === titulo); return { carta, valor: CTw.sortValue("history", carta) }; };

// Conecta una invitada nueva (o que vuelve) al anfitrión, por el camino de pegar códigos.
async function conecta(host, guest, nombre = "Ana") {
  click(host, '[data-local-action="invite"]');
  await until(() => !!host.document.querySelector(".signal-box"));
  const invitacion = host.document.querySelector(".signal-box").textContent;
  if (pantalla(guest) !== "local-unirse") click(guest, '[data-local-action="go-unirse"]');
  guest.document.getElementById("local-guest-name").value = nombre;
  guest.document.getElementById("local-guest-offer").value = invitacion;
  submit(guest, '[data-local-form="join-offer"]');
  await until(() => !!guest.document.querySelector(".signal-box"));
  const respuesta = guest.document.querySelector(".signal-box").textContent;
  host.document.getElementById("local-answer").value = respuesta;
  submit(host, '[data-local-form="accept-answer"]');
  return { invitacion, respuesta };
}

// El minijuego de quién empieza, con las dos respuestas escritas en cada móvil. Quien
// escribe la cifra exacta empieza.
async function minijuego(host, guest, exacto = host) {
  click(host, '[data-local-action="starter-draw"]');
  await until(() => !!guest.document.getElementById("starter-guess-input") && !!host.document.getElementById("starter-guess-input"));
  const { valor } = valorDe(host, host.document.querySelector(".starter-card strong").textContent);
  for (const win of [host, guest]) {
    win.document.getElementById("starter-guess-input").value = String(win === exacto ? valor : valor + 5000);
    click(win, '[data-local-action="starter-guess"]');
    await tick();
  }
  await until(() => !!host.document.querySelector('[data-local-action="start"]'));
}

await entrarWifi(anfitrion);
anfitrion.document.getElementById("local-name-host").value = "Fer";
submit(anfitrion, '[data-local-form="create"]');
await entrarWifi(invitada);
const { invitacion, respuesta } = await conecta(anfitrion, invitada);
ok("el anfitrión tiene una invitación que compartir", /^CTM1:/.test(invitacion || ""));
ok("la invitada genera su respuesta", respuesta === "FAKE-ANSWER-1");
await until(() => pantalla(anfitrion) === "local-lobby" && pantalla(invitada) === "local-lobby");
ok("el anfitrión ve a las dos personas en la mesa", /Ana/.test(html(anfitrion)) && pantalla(anfitrion) === "local-lobby");
ok("la invitada pasa sola al vestíbulo", pantalla(invitada) === "local-lobby" && /Fer/.test(html(invitada)));

console.log("\nMinijuego de quién empieza, igual que en la sala online");
ok("sin minijuego no se puede barajar todavía", !anfitrion.document.querySelector('[data-local-action="start"]') && !!anfitrion.document.querySelector('[data-local-action="starter-draw"]'));
elige(anfitrion, "wifi-hand-size", "2");
elige(anfitrion, "wifi-turn-seconds", "0");
await minijuego(anfitrion, invitada, invitada);
await until(() => invitada.document.querySelectorAll(".starter-draw-list li").length === 2);
ok("los dos móviles ven el orden de juego", invitada.document.querySelectorAll(".starter-draw-list li").length === 2 && /1\.º Ana/.test(invitada.document.querySelector(".starter-draw-list").textContent));
ok("los ajustes elegidos no se pierden al repintar la sala", anfitrion.document.getElementById("wifi-hand-size").value === "2");
click(anfitrion, '[data-local-action="start"]');
await until(() => pantalla(invitada) === "local-game");
ok("la partida arranca en los dos móviles", pantalla(anfitrion) === "local-game" && pantalla(invitada) === "local-game");
ok("empieza quien más se acercó en el minijuego", /Tu turno/.test(invitada.document.querySelector(".turn-name").textContent));
ok("el anfitrión ve su propia mano (antes la pantalla se rompía)", anfitrion.document.querySelectorAll(".hand-card").length === 2 && !erroresAnfitrion.length);
ok("sin límite de tiempo no se enseña reloj", !anfitrion.document.getElementById("turn-timer"));

// Se juega bien, para que la partida termine en pocas vueltas: el hueco correcto se
// calcula con las mismas funciones del juego.
async function juegaBien(ventanas, limite = 400) {
  let jugadas = 0;
  for (let i = 0; i < limite && ventanas.some(win => pantalla(win) === "local-game"); i++) {
    const turno = ventanas.find(win => win.document.querySelector(".hand-card:not([disabled])"));
    const sigue = ventanas.find(win => win.document.querySelector('[data-local-action="finish-turn"]'));
    if (sigue && !turno) {
      click(sigue, '[data-local-action="finish-turn"]');
      await tick();
      await until(() => !ventanas.some(win => win.document.querySelector('[data-local-action="finish-turn"]')), 3000);
      continue;
    }
    if (!turno) { await tick(); continue; }
    const CTg = turno.CONTINUUM;
    const carta = turno.document.querySelector(".hand-card:not([disabled])");
    const porId = id => CTg.cards("history").find(card => card.id === Number(id));
    const linea = [...turno.document.querySelectorAll(".timeline .timeline-card")].map(el => porId(el.dataset.id));
    const hueco = CTg.correctIndex("history", linea, porId(carta.dataset.id));
    click(turno, `.hand-card[data-id="${carta.dataset.id}"]`);
    click(turno, `.slot[data-local-action="place"][data-index="${hueco}"]`);
    click(turno, '[data-local-action="confirm-place"]');
    jugadas++;
    // La jugada viaja al anfitrión y el resultado vuelve a los dos: se espera a que el
    // móvil que ha jugado deje de tener el turno antes de mirar otra vez.
    await tick();
    await until(() => !turno.document.querySelector(".hand-card:not([disabled])") || ventanas.every(win => pantalla(win) !== "local-game"), 3000);
  }
  return jugadas;
}
const jugadas = await juegaBien([anfitrion, invitada]);
await until(() => [anfitrion, invitada].every(win => ["local-final", "local-final-secreta"].includes(pantalla(win))));

console.log("\nLas dos terminan la misma ronda sin cartas: final secreta");
ok(`los dos móviles pasan a la final (${jugadas} jugadas)`, pantalla(anfitrion) === "local-final-secreta" && pantalla(invitada) === "local-final-secreta");
ok("cada finalista tiene su propio formulario, sin ver la cifra ajena", !!anfitrion.document.querySelector("[data-local-final]") && !!invitada.document.querySelector("[data-local-final]"));
const { valor: objetivo } = valorDe(anfitrion, anfitrion.document.querySelector(".final-card h2").textContent);
for (const [win, cifra] of [[anfitrion, objetivo], [invitada, objetivo + 300]]) {
  const form = win.document.querySelector("[data-local-final]");
  form.elements.guess.value = String(Math.abs(cifra));
  if (form.elements.era) form.elements.era.value = cifra < 0 ? "bc" : "ad";
  submit(win, "[data-local-final]");
  await tick();
}
await until(() => !!invitada.document.querySelector('[data-local-action="final-next"]'));
ok("al responder las dos se enseñan las cifras a la vez", !!invitada.document.querySelector(".final-results") && !!anfitrion.document.querySelector(".final-results"));
click(invitada, '[data-local-action="final-next"]');
await until(() => pantalla(anfitrion) === "local-final" && pantalla(invitada) === "local-final");
ok("gana quien más se acerca en la final", /Fer.*gana/.test(anfitrion.document.querySelector("h2").textContent) && /cifra más cercana/.test(html(anfitrion)));
ok("el anfitrión puede pedir la revancha", !!anfitrion.document.querySelector('[data-local-action="rematch"]'));
ok("la invitada puede salir de la pantalla final (antes el botón no hacía nada)", !!invitada.document.querySelector('[data-local-action="leave"]'));

console.log("\nRevancha con la misma mesa");
click(anfitrion, '[data-local-action="rematch"]');
await until(() => pantalla(invitada) === "local-lobby");
ok("los dos vuelven al vestíbulo, con las mismas personas", pantalla(anfitrion) === "local-lobby" && pantalla(invitada) === "local-lobby" && /Ana/.test(html(anfitrion)));
ok("y hay que volver a jugar el minijuego", !anfitrion.document.querySelector('[data-local-action="start"]'));

console.log("\nReloj del turno, poderes y menú de la sala");
elige(anfitrion, "wifi-turn-seconds", "20");
elige(anfitrion, "wifi-hand-size", "4");
elige(anfitrion, "wifi-preset", "advanced");
ok("la partida avanzada activa Pulso y Fantasma", anfitrion.document.getElementById("wifi-pulse").checked && anfitrion.document.getElementById("wifi-ghost").checked);
await minijuego(anfitrion, invitada, anfitrion);
click(anfitrion, '[data-local-action="start"]');
await until(() => pantalla(invitada) === "local-game");
ok("con límite de tiempo se enseña la cuenta atrás", !!anfitrion.document.getElementById("turn-timer") && !!invitada.document.getElementById("turn-timer"));
click(anfitrion, '[data-local-action="room-menu"]');
ok("volver abre el menú de la sala en vez del vestíbulo", !!anfitrion.document.querySelector("[data-local-room-overlay]") && pantalla(anfitrion) === "local-game");
ok("desde el menú se puede volver a invitar a alguien", !!anfitrion.document.querySelector('[data-local-room-overlay] [data-local-action="invite"]'));
click(anfitrion, '[data-local-action="close-room-menu"]');

console.log("\nSi la conexión de la invitada se corta, conserva su plaza");
const manoAntes = invitada.document.querySelectorAll(".hand-card").length;
red.drop();
await until(() => pantalla(invitada) === "local-desconectado" && /desconectado/.test(html(anfitrion)));
ok("la invitada ve que ha perdido la conexión y cómo volver", pantalla(invitada) === "local-desconectado" && !!invitada.document.querySelector('[data-local-action="go-unirse"]'));
ok("el anfitrión la sigue viendo en la mesa, marcada como desconectada", /Ana · desconectado/.test(html(anfitrion)));
ok("la partida sigue: si era su turno, pasa al anfitrión", /Tu turno/.test(anfitrion.document.querySelector(".turn-name").textContent));
click(anfitrion, '[data-local-action="room-menu"]');
await conecta(anfitrion, invitada);
await until(() => pantalla(invitada) === "local-game");
ok("vuelve a su plaza con sus cartas", pantalla(invitada) === "local-game" && invitada.document.querySelectorAll(".hand-card").length === manoAntes);
ok("el anfitrión ya no la ve desconectada", !/Ana · desconectado/.test(html(anfitrion)) && /ha vuelto/.test(anfitrion.document.getElementById("toast")?.textContent || ""));

console.log("\nSi la invitada sale de la partida");
click(invitada, '[data-local-action="room-menu"]');
click(invitada, '[data-local-action="leave"]');
click(invitada, '[data-ask-action="0"]'); // la pregunta es un diálogo del juego, no el confirm() del navegador
await until(() => pantalla(anfitrion) === "local-final");
ok("la invitada vuelve a la entrada del modo", pantalla(invitada) === "local-entrada");
ok("la partida del anfitrión termina en vez de esperar un turno que no llegará", pantalla(anfitrion) === "local-final" && /Fer/.test(html(anfitrion)));

console.log("\nSi el anfitrión cierra la sala");
const red2 = fakeNetwork();
const h2 = boot(), g2 = boot();
for (const win of [h2, g2]) { red2.install(win); win.confirm = () => true; }
await entrarWifi(h2); submit(h2, '[data-local-form="create"]');
await entrarWifi(g2);
await conecta(h2, g2);
await until(() => pantalla(g2) === "local-lobby");
click(h2, '[data-local-action="leave"]');
click(h2, '[data-ask-action="0"]');
await until(() => pantalla(g2) === "local-entrada");
ok("la invitada no se queda congelada: vuelve a la entrada con un aviso", pantalla(g2) === "local-entrada" && /conexión|cerrado/.test(g2.document.getElementById("toast")?.textContent || ""));

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
