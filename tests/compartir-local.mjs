// Cómo viaja la señal WebRTC de un móvil a otro sin QR: por `navigator.share` (Bluetooth,
// AirDrop, Nearby Share — todo local, sin internet), con el portapapeles como red de
// seguridad. JSDOM no trae ninguna de las dos APIs, así que aquí se simulan a mano.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "https://hilo.test/" });
  dom.window.eval(read("local-share.js"));
  return dom.window;
}
const intentaAsync = async fn => { try { await fn(); return null; } catch (e) { return e.message; } };

console.log("\nCompartir cuando el sistema ofrece compartir");
let w = boot();
let compartido = null;
w.navigator.share = async payload => { compartido = payload; };
const resultadoCompartir = await w.CONTINUUM.LocalShare.shareSignal("señal-de-prueba", { title: "Continuum" });
ok("se manda por la hoja de compartir del sistema", resultadoCompartir === "shared");
ok("el texto que se comparte es la señal, no un enlace inventado", compartido.text === "señal-de-prueba" && compartido.title === "Continuum");

console.log("\nCancelar la hoja de compartir no es un fallo");
w = boot();
w.navigator.share = async () => { const error = new w.Error("cancelado"); error.name = "AbortError"; throw error; };
const resultadoCancelado = await w.CONTINUUM.LocalShare.shareSignal("señal-de-prueba");
ok("cancelar se distingue de un error real", resultadoCancelado === "cancelled");

console.log("\nSin hoja de compartir, cae al portapapeles");
w = boot();
let copiado = null;
w.navigator.clipboard = { writeText: async texto => { copiado = texto; } };
const resultadoCopiar = await w.CONTINUUM.LocalShare.shareSignal("señal-de-prueba");
ok("se copia al portapapeles como red de seguridad", resultadoCopiar === "copied" && copiado === "señal-de-prueba");

console.log("\nUn error real al compartir también cae al portapapeles");
w = boot();
w.navigator.share = async () => { throw new w.Error("algo raro pasó"); };
w.navigator.clipboard = { writeText: async texto => { copiado = texto; } };
ok("un fallo que no es cancelar no deja el texto sin mandar", await w.CONTINUUM.LocalShare.shareSignal("otra señal") === "copied");

console.log("\nSin nada disponible");
w = boot();
ok("sin compartir ni portapapeles, se avisa con un motivo claro", await intentaAsync(() => w.CONTINUUM.LocalShare.shareSignal("señal")) === "SHARE_UNAVAILABLE");
ok("una señal vacía se rechaza antes de intentar nada", await intentaAsync(() => w.CONTINUUM.LocalShare.shareSignal("   ")) === "EMPTY_SIGNAL");

console.log("\nPegar desde el portapapeles");
w = boot();
w.navigator.clipboard = { readText: async () => "  señal-pegada  " };
ok("se recorta el texto pegado", await w.CONTINUUM.LocalShare.pasteSignal() === "señal-pegada");
w = boot();
w.navigator.clipboard = { readText: async () => "   " };
ok("un portapapeles vacío se rechaza con su propio motivo", await intentaAsync(() => w.CONTINUUM.LocalShare.pasteSignal()) === "EMPTY_CLIPBOARD");
w = boot();
ok("sin portapapeles disponible, se avisa en vez de fallar oscuro", await intentaAsync(() => w.CONTINUUM.LocalShare.pasteSignal()) === "PASTE_UNAVAILABLE");

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
