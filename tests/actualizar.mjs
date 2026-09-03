// «Actualizar Continuum» es la página que se manda a quien tiene la app atascada en una
// versión vieja: solo debe descartar el service worker y su caché para forzar una versión
// nueva. El perfil, la racha del reto diario y las partidas guardadas viven en
// localStorage, y esta página no es sitio para perderlos. Se ejecuta el archivo real con
// un entorno falso, igual que service-worker.mjs.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function elemento() {
  return { textContent: "", classList: { added: [], add(clase) { this.added.push(clase); } } };
}

async function arrancar() {
  const status = elemento();
  const continueLink = elemento();
  const registro = { unregistered: false, unregister: async () => { registro.unregistered = true; } };
  const cachesEliminadas = [];
  let redirigidoA = null;
  let localStorageLimpiado = false;
  let sessionStorageLimpiado = false;

  // `window` es el propio ámbito global, como en un navegador de verdad: el código real
  // comprueba `"caches" in window`, así que un `window` aparte con solo `location` nunca
  // vería la caché y el bloque entero se saltaría sin que ninguna prueba lo notara.
  const contexto = {
    document: { querySelector: sel => (sel === "#status" ? status : sel === "#continue" ? continueLink : null) },
    navigator: { serviceWorker: { getRegistrations: async () => [registro] } },
    caches: { keys: async () => ["continuum-v70"], delete: async nombre => { cachesEliminadas.push(nombre); return true; } },
    localStorage: { clear: () => { localStorageLimpiado = true; } },
    sessionStorage: { clear: () => { sessionStorageLimpiado = true; } },
    location: { replace: url => { redirigidoA = url; } },
    Promise, console
  };
  contexto.window = contexto;
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(REPO, "actualizar.js"), "utf8"), contexto);
  // El script es un IIFE async que se dispara solo: hay que dejarle terminar.
  await new Promise(resolve => setTimeout(resolve, 10));

  return { status, continueLink, registro, cachesEliminadas, get redirigidoA() { return redirigidoA; },
    get localStorageLimpiado() { return localStorageLimpiado; }, get sessionStorageLimpiado() { return sessionStorageLimpiado; } };
}

console.log("\nActualizar Continuum");
{
  const a = await arrancar();
  ok("desregistra el service worker antiguo", a.registro.unregistered);
  ok("borra la caché de la aplicación", a.cachesEliminadas.includes("continuum-v70"));
  ok("NO borra el perfil ni las partidas guardadas", !a.localStorageLimpiado);
  ok("y tampoco sessionStorage", !a.sessionStorageLimpiado);
  ok("redirige a la versión nueva", /\?actualizado=\d+$/.test(a.redirigidoA || ""));
  ok("el aviso confirma que terminó", /completada/i.test(a.status.textContent));
  ok("no hace falta el botón manual", a.continueLink.classList.added.length === 0);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
