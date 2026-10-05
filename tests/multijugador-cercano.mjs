// Multijugador Wi-Fi local entre iPhones con MultipeerConnectivity (`local-peer.js`): no hay
// plugin nativo en Node, así que dos ventanas se hablan a través de un "sistema operativo"
// de mentira (anuncio, búsqueda, invitación, mensajes). Todo lo demás —sesión, sala,
// pantallas— es el código real.
import { gameHtml } from "./game-fixture.mjs";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };
const pausa = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

// El sistema operativo de mentira: qué móviles anuncian sala, quién busca y quién está conectado.
const so = { moviles: new Map(), anuncios: new Map() };
function movil(id) {
  const oyentes = {};
  const emitir = (nombre, datos) => (oyentes[nombre] || []).forEach(fn => fn(datos));
  const yo = { id, emitir, buscando: false };
  so.moviles.set(id, yo);
  const plugin = {
    addListener: async (nombre, fn) => { (oyentes[nombre] ||= []).push(fn); return { remove() {} }; },
    advertise: async ({ info }) => { so.anuncios.set(id, info); for (const otro of so.moviles.values()) if (otro.buscando) otro.emitir("found", { id, info }); return { id }; },
    stopAdvertising: async () => { so.anuncios.delete(id); },
    browse: async () => { yo.buscando = true; for (const [otroId, info] of so.anuncios) emitir("found", { id: otroId, info }); return { id }; },
    stopBrowsing: async () => { yo.buscando = false; },
    connect: async ({ id: destino }) => {
      const otro = so.moviles.get(destino);
      if (!otro || !so.anuncios.has(destino)) throw new Error("PEER_NOT_FOUND");
      yo.con = destino; (otro.con ||= new Set()); otro.con = otro.con instanceof Set ? otro.con : new Set(); otro.con.add(id);
      setTimeout(() => { emitir("state", { id: destino, state: "connected" }); otro.emitir("state", { id, state: "connected" }); }, 0);
    },
    send: async ({ id: destino, data }) => {
      const destinos = destino ? [destino] : [...(yo.con instanceof Set ? yo.con : yo.con ? [yo.con] : [])];
      for (const d of destinos) setTimeout(() => so.moviles.get(d)?.emitir("message", { id, data }), 0);
      return { sent: destinos.length };
    },
    disconnect: async () => {}, stop: async () => { so.anuncios.delete(id); yo.buscando = false; }
  };
  return plugin;
}

function boot(id, ios = true) {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  window.scrollTo = () => {}; window.Element.prototype.scrollIntoView = () => {};
  if (ios) window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: { LocalPeer: movil(id) } };
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
const submit = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); };
const html = w => w.document.body.innerHTML;

console.log("\nDisponibilidad");
const web = boot("web", false);
ok("fuera de la app de iOS no hay conexión cercana", web.CONTINUUM.LocalPeer.available() === false);
await pausa();
for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="online"]', '[data-action="friends-join"]']) { click(web, sel); await pausa(); }
ok("en la web no se ofrece «Buscar salas cercanas»", !web.document.querySelector('[data-action="friends-join-nearby"]'));

console.log("\nAnfitrión en un iPhone");
const anfitrion = boot("anfitrion");
ok("dentro de la app de iOS sí está disponible", anfitrion.CONTINUUM.LocalPeer.available() === true);
await pausa();
for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="online"]', '[data-action="create-room-toggle"]', '[data-inline-route="online"]', '#mode-inline-drawer [data-block="historia"]', '#mode-inline-drawer [data-mode="history"]']) { click(anfitrion, sel); await pausa(); }
for (const [name, value] of [['duel-pace', 'directo'], ['live-net', 'wifi']]) { const input = anfitrion.document.querySelector(`input[name="${name}"][value="${value}"]`); input.checked = true; input.dispatchEvent(new anfitrion.Event('change', { bubbles: true })); }
click(anfitrion, '[data-action="start-live-room"]'); await pausa();
anfitrion.document.getElementById("local-name-host").value = "Fer";
submit(anfitrion, '[data-local-form="create"]');
await pausa(10);
ok("la sala se anuncia sola con su código, el mazo y el nombre", (() => { const a = so.anuncios.get("anfitrion"); return !!a && /^[A-Z2-9]{8}$/.test(a.room) && a.mode === "history" && a.host === "Fer" && !!a.fp; })());
ok("el vestíbulo avisa de que es visible para iPhones y deja el QR para Android", !!anfitrion.document.querySelector("[data-nearby-note]") && /Invitar por QR/.test(html(anfitrion)));

console.log("\nInvitado en otro iPhone");
const invitado = boot("invitado");
await pausa();
for (const sel of ['[data-action="friends-hub"]', '[data-friend-hub="online"]', '[data-action="friends-join"]']) { click(invitado, sel); await pausa(); }
ok("«Unirme» ofrece buscar salas cercanas", !!invitado.document.querySelector('[data-action="friends-join-nearby"]'));
invitado.CONTINUUM.Identidad.guarda({ nombre: "Ana" });
click(invitado, '[data-action="friends-join-nearby"]');
await pausa(10);
ok("con nombre de perfil se busca directamente, sin otra pantalla", invitado.document.getElementById("app").dataset.screen === "local-cercanas");
ok("aparece la lista con la sala del anfitrión y su mazo", !!invitado.document.querySelector('[data-local-action="nearby-join"]') && /Fer/.test(html(invitado)));
click(invitado, '[data-local-action="nearby-join"]');
await pausa(30);
ok("el invitado entra en la sala de espera sin escanear nada", /Preparando la mesa|Sala de espera/.test(html(invitado)) && /Ana/.test(html(invitado)));
ok("el anfitrión ve llegar a la invitada", /Ana/.test(html(anfitrion)));
ok("con dos personas el anfitrión ya puede sortear quién empieza", !!anfitrion.document.querySelector('[data-local-action="starter-draw"]'));

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
