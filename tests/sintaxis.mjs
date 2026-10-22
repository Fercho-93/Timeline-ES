// Comprueba que todos los archivos del juego parsean. Parece poca cosa, pero es la
// única red que cubre `js/online/online.js`: no se puede importar desde Node porque carga el SDK
// de Firebase como módulo de navegador (vendor/firebase/), así que ninguna otra suite lo ejecuta. Un nombre repetido o una llave
// suelta ahí llegaría al móvil sin que nada avisara.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

console.log("\nSintaxis de los archivos del juego");

// Los de la raíz (service worker, configuración) y los de js/, mazos/ y vendor/qr/.
const archivos = ["", "js", "mazos", "vendor/qr"].flatMap(dir => fs.readdirSync(path.join(REPO, dir), { recursive: dir !== "" }).filter(name => name.endsWith(".js")).map(name => path.posix.join(dir, name.replaceAll("\\", "/")))).sort();
ok("se encuentran los archivos del juego", archivos.length > 0);

for (const archivo of archivos) {
  let error = "";
  try {
    execFileSync(process.execPath, ["--check", path.join(REPO, archivo)], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    error = String(e.stderr || e).split("\n").filter(line => /SyntaxError|Error:/.test(line))[0] || "no parsea";
  }
  ok(`${archivo}${error ? ` · ${error.trim()}` : ""}`, !error);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
