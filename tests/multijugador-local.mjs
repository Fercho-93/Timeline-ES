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
// Se entra como en la aplicación: Inicio → Jugar con amigos → Cada uno en su móvil → Crear
// partida → mazo → En directo, sin internet → Crear sala.
async function entrarWifi(w) {
  const pausa = () => new Promise(resolve => setTimeout(resolve, 0));
  await pausa();
  for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="online"]', '[data-action="create-room-toggle"]', '[data-inline-route="online"]', '#mode-inline-drawer [data-block="historia"]', '#mode-inline-drawer [data-mode="history"]']) { click(w, sel); await pausa(); }
  for (const [name, value] of [['duel-pace', 'directo'], ['live-net', 'wifi']]) {
    const input = w.document.querySelector(`input[name="${name}"][value="${value}"]`);
    input.checked = true; input.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  click(w, '[data-action="start-live-room"]'); await pausa();
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

console.log("\nUnirse por Wi-Fi desde «Unirme», sin elegir mazo");
w = boot();
{
  const pausa = () => new Promise(resolve => setTimeout(resolve, 0));
  await pausa();
  for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="online"]', '[data-action="friends-join"]']) { click(w, sel); await pausa(); }
  ok("«Unirme» ya no separa el Wi-Fi en botones propios", !w.document.querySelector('[data-action="wifi-join"], [data-action="friends-join-quick-wifi"]'));
  ok("en la web no se ofrece buscar salas cercanas", !w.document.querySelector('[data-action="friends-join-nearby"]'));
  const prueba = (texto) => { w.document.getElementById("friends-join-code").value = texto; submit(w, '[data-friends-join-form]'); return w.document.getElementById("friends-join-error")?.textContent || ""; };
  ok("una respuesta de otro móvil se explica, no se abre", /respuesta de otro móvil/.test(prueba("S2|a|ufrag|pwd|" + "A".repeat(43) + "|a|192.168.1.2:5000")));
  ok("una oferta suelta se abre como Retos rápidos por Wi-Fi", (prueba("S2|o|ufrag|pwd|" + "A".repeat(43) + "|x|192.168.1.2:5000"), w.sessionStorage.getItem("continuum-entry-route") === "wifi-join-quick"));
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
// El tiempo por turno son pastillas (un grupo de radios con ese nombre); el resto, campos con id.
const elige = (win, id, value) => { const el = win.document.getElementById(id) || win.document.querySelector(`input[name="${id}"][value="${value}"]`); if (typeof value === "boolean" || el.type === "radio") el.checked = el.type === "radio" ? true : value; else el.value = value; el.dispatchEvent(new win.Event("change", { bubbles: true })); };
const valorDe = (win, titulo) => { const CTw = win.CONTINUUM; const carta = CTw.cards("history").find(item => item.title === titulo); return { carta, valor: CTw.sortValue("history", carta) }; };

// Conecta una invitada nueva (o que vuelve) al anfitrión, por el camino de pegar códigos.
// Con `desdeUnirme`, quien se une pega la invitación en «Unirme» de Cada uno en su móvil,
// que la reconoce como Wi-Fi de colecciones y abre la sala sin elegir nada más.
async function conecta(host, guest, nombre = "Ana", desdeUnirme = false) {
  click(host, '[data-local-action="invite"]');
  await until(() => !!host.document.querySelector(".signal-box"));
  const invitacion = host.document.querySelector(".signal-box").textContent;
  if (desdeUnirme) {
    // Quien entra por «Unirme» juega con su nombre de perfil, sin escribirlo.
    guest.CONTINUUM.Identidad.guarda({ nombre });
    for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="online"]', '[data-action="friends-join"]']) { click(guest, sel); await tick(); }
    guest.document.getElementById("friends-join-code").value = invitacion;
    submit(guest, '[data-friends-join-form]');
    await tick();
    if (!guest.document.querySelector(".signal-box")) {
      guest.document.getElementById("local-guest-name").value = nombre;
      submit(guest, '[data-local-form="join-offer"]');
    }
  } else {
    if (pantalla(guest) !== "local-unirse") click(guest, '[data-local-action="go-unirse"]');
    guest.document.getElementById("local-guest-name").value = nombre;
    guest.document.getElementById("local-guest-offer").value = invitacion;
    submit(guest, '[data-local-form="join-offer"]');
  }
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
const { invitacion, respuesta } = await conecta(anfitrion, invitada, "Ana", true);
ok("el anfitrión tiene una invitación que compartir", /^CTM1:/.test(invitacion || ""));
ok("«Unirme» reconoce la invitación Wi-Fi y abre la sala", pantalla(invitada).startsWith("local-"));
ok("la invitada genera su respuesta", respuesta === "FAKE-ANSWER-1");
await until(() => pantalla(anfitrion) === "local-lobby" && pantalla(invitada) === "local-lobby");
ok("el anfitrión ve a las dos personas en la mesa", /Ana/.test(html(anfitrion)) && pantalla(anfitrion) === "local-lobby");
ok("la invitada pasa sola al vestíbulo", pantalla(invitada) === "local-lobby" && /Fer/.test(html(invitada)));

console.log("\nMinijuego de quién empieza, igual que en la sala online");
ok("sin minijuego no se puede barajar todavía", !anfitrion.document.querySelector('[data-local-action="start"]') && !!anfitrion.document.querySelector('[data-local-action="starter-draw"]'));
ok("la sala ya no pregunta las cartas iniciales: las enseña", !anfitrion.document.querySelector("select#wifi-hand-size") && /4 por persona/.test(html(anfitrion)));
elige(anfitrion, "wifi-turn-seconds", "0");
await minijuego(anfitrion, invitada, invitada);
await until(() => invitada.document.querySelectorAll(".starter-draw-list li").length === 2);
ok("los dos móviles ven el orden de juego", invitada.document.querySelectorAll(".starter-draw-list li").length === 2 && /1\.º Ana/.test(invitada.document.querySelector(".starter-draw-list").textContent));
ok("los ajustes elegidos no se pierden al repintar la sala", anfitrion.document.querySelector('input[name="wifi-turn-seconds"]:checked')?.value === "0");
click(anfitrion, '[data-local-action="start"]');
await until(() => pantalla(invitada) === "local-game");
ok("la partida arranca en los dos móviles", pantalla(anfitrion) === "local-game" && pantalla(invitada) === "local-game");
ok("empieza quien más se acercó en el minijuego", /Tu turno/.test(invitada.document.querySelector(".turn-name").textContent));
ok("el anfitrión ve su propia mano (antes la pantalla se rompía)", anfitrion.document.querySelectorAll(".hand-card").length === 4 && !erroresAnfitrion.length);
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

console.log("\nCompetición sin internet entre dos móviles");
{
  const red3 = fakeNetwork();
  const h3 = boot(), g3 = boot();
  for (const win of [h3, g3]) { red3.install(win); win.confirm = () => true; }
  // Los temas salen al azar; aquí se fijan para saber qué mazo toca en cada ronda.
  h3.CONTINUUM.Tournament.create = (rounds, cards) => ({ queue: ["history", "inventions"], index: 0, history: [], handSize: cards });
  // Juega cada turno: quien esté en `fallan` coloca mal, el resto bien. Así la ronda tiene un ganador claro.
  async function juega(ventanas, modo, fallan = []) {
    for (let i = 0; i < 200 && ventanas.some(win => pantalla(win) === "local-game"); i++) {
      const turno = ventanas.find(win => win.document.querySelector(".hand-card:not([disabled])"));
      const sigue = ventanas.find(win => win.document.querySelector('[data-local-action="finish-turn"]'));
      if (sigue && !turno) { click(sigue, '[data-local-action="finish-turn"]'); await tick(); continue; }
      if (!turno) { await tick(); continue; }
      const CTg = turno.CONTINUUM, porId = id => CTg.cards(modo).find(card => card.id === Number(id));
      const carta = turno.document.querySelector(".hand-card:not([disabled])");
      const linea = [...turno.document.querySelectorAll(".timeline .timeline-card")].map(el => porId(el.dataset.id));
      const bueno = CTg.correctIndex(modo, linea, porId(carta.dataset.id));
      const hueco = fallan.includes(turno) ? (bueno === 0 ? linea.length : 0) : bueno;
      click(turno, `.hand-card[data-id="${carta.dataset.id}"]`);
      click(turno, `.slot[data-local-action="place"][data-index="${hueco}"]`);
      click(turno, '[data-local-action="confirm-place"]');
      await tick();
      await until(() => !turno.document.querySelector(".hand-card:not([disabled])") || ventanas.every(win => pantalla(win) !== "local-game"), 3000);
    }
  }
  h3.CONTINUUM.LocalMultiplayer.open({ modeKey: "movies", competition: { rounds: 2, cards: 1 }, onBack: () => {} });
  ok("la entrada de la competición solo ofrece crear la sala", /Competición sin internet/.test(html(h3)) && !h3.document.querySelector('[data-local-action="go-unirse"]'));
  h3.document.getElementById("local-name-host").value = "Fer";
  submit(h3, '[data-local-form="create"]');
  ok("la sala empieza por el primer tema de la competición, no por el mazo de antes", /Competición: 2 temas · 1 cartas por persona/.test(html(h3)) && !h3.document.getElementById("wifi-hand-size"));
  g3.CONTINUUM.LocalMultiplayer.open({ modeKey: "movies", onBack: () => {} });
  await conecta(h3, g3);
  await until(() => pantalla(g3) === "local-lobby");
  elige(h3, "wifi-turn-seconds", "0");
  await minijuego(h3, g3, h3);
  click(h3, '[data-local-action="start"]');
  await until(() => pantalla(g3) === "local-game");
  ok("los dos juegan el primer tema con una carta", pantalla(g3) === "local-game" && h3.document.querySelectorAll(".hand-card").length === 1 && /Competición · tema 1 de 2/.test(html(g3)));
  await juega([h3, g3], "history", [g3]);
  await until(() => [h3, g3].every(win => pantalla(win) === "local-final"));
  ok("al acabar el tema, los dos ven el marcador de la competición", [h3, g3].every(win => /tournament-board/.test(html(win)) && /Fer<\/strong><span>1 punto/.test(html(win))));
  ok("solo quien organiza puede pasar al siguiente tema", !!h3.document.querySelector('[data-local-action="competition-next"]') && !g3.document.querySelector('[data-local-action="competition-next"]'));
  click(h3, '[data-local-action="competition-next"]');
  await until(() => pantalla(g3) === "local-lobby");
  ok("el segundo tema se prepara en los dos móviles, sin minijuego", [h3, g3].every(win => pantalla(win) === "local-lobby" && /Tema 2 de 2: Inventos/.test(html(win))) && !h3.document.querySelector('[data-local-action="starter-draw"]'));
  click(h3, '[data-local-action="start"]');
  await until(() => pantalla(g3) === "local-game");
  const porId = (win, id) => win.CONTINUUM.cards("inventions").find(card => card.id === Number(id));
  ok("la invitada juega ya con cartas del segundo mazo", [...g3.document.querySelectorAll(".timeline .timeline-card, .hand-card")].every(el => porId(g3, el.dataset.id)));
  ok("y empieza ella, la siguiente de la mesa", /Tu turno/.test(g3.document.querySelector(".turn-name").textContent));
  await juega([h3, g3], "inventions", [h3]);
  await until(() => [h3, g3].every(win => pantalla(win) === "local-final"));
  ok("tras el último tema queda el resultado de la competición, sin «siguiente tema»", [h3, g3].every(win => /Resultado de la competición/.test(html(win))) && !h3.document.querySelector('[data-local-action="competition-next"]'));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
