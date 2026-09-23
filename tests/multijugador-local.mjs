// Humo del modo "Sin conexión" sobre el DOM real de index.html: entra por el menú de
// verdad, crea una sala, comprueba el vestíbulo y confirma que lo que sí necesita WebRTC
// falla con un aviso claro en vez de romper la pantalla — no hay RTCPeerConnection en
// Node, así que una partida completa de dos personas solo se puede probar en un móvil
// real (pendiente en el roadmap).
import { gameHtml } from "./game-fixture.mjs";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// La colección y la competición viven ahora en «Jugar», no en la portada: desde la
// portada, se entra primero ahí. Devuelve la misma ventana para poder encadenarlo.
// La tarjeta de la portada gira antes de navegar; `homeTransition = "done"` es la
// marca con la que la propia portada se salta ese giro, y aquí se usa para no esperarlo.
function pulsaPuerta(d, accion) { const b = d.querySelector(`[data-action="${accion}"]`); if (!b) return; b.dataset.homeTransition = "done"; b.click(); }
function irAJugar(w) { const d = w.document; if (!d.querySelector('[data-block], [data-action="competition-menu"]')) { if (!d.querySelector('[data-action="jugar"]')) d.querySelector('.home-nav [data-action="home-top"]')?.click(); pulsaPuerta(d, "jugar"); } return w; }


const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function guiones() { return [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]); }
function boot() {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
const submit = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); };

console.log("\nEntrar en el modo desde el menú de verdad");
let w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
ok("el menú real ofrece la tercera opción, sin tocar nada aparte", !!w.document.querySelector('[data-action="local-multiplayer"]'));
ok("un solo móvil y varios móviles siguen ahí, sin quitar nada", !!w.document.querySelector('[data-action="setup"]') && !!w.document.querySelector('[data-action="online"]'));
click(w, '[data-action="local-multiplayer"]');
ok("lleva a la entrada del modo sin conexión", w.document.body.innerHTML.includes("Una mesa"));
ok("avisa del punto de acceso Wi-Fi antes de nada", /punto de acceso Wi-Fi/.test(w.document.body.innerHTML));
ok("pide activar la cámara aquí, no cuando ya haga falta escanear", !!w.document.querySelector('[data-local-action="warm-camera"]'));

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
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="local-multiplayer"]');
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

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
