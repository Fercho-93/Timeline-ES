// El build móvil (npm run build → dist/) es lo que Capacitor empaqueta dentro de Android
// e iPhone. Un dist/ incompleto o desincronizado con capacitor.config.json se traduciría
// en una aplicación que abre en blanco o con imágenes rotas, sin que ningún test web lo
// detecte porque esos tests corren contra los archivos sueltos, no contra el build.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(REPO, "dist");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

console.log("\nBuild móvil");

execFileSync("node", ["scripts/build.mjs"], { cwd: REPO, stdio: "pipe" });
ok("npm run build termina sin errores y deja dist/", fs.existsSync(DIST));

const indexHtml = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
const scripts = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const faltanScripts = scripts.filter(archivo => !fs.existsSync(path.join(DIST, archivo)));
ok(`dist/ contiene todos los scripts de index.html${faltanScripts.length ? ` (falta ${faltanScripts.join(", ")})` : ""}`, !faltanScripts.length);

for (const archivo of ["index.html", "actualizar.html", "manifest.webmanifest", "icon.svg", "service-worker.js"]) {
  ok(`dist/${archivo} existe`, fs.existsSync(path.join(DIST, archivo)));
}
ok("dist/assets existe y no está vacío", fs.existsSync(path.join(DIST, "assets")) && fs.readdirSync(path.join(DIST, "assets")).length > 0);

const capacitorConfig = JSON.parse(fs.readFileSync(path.join(REPO, "capacitor.config.json"), "utf8"));
ok("Capacitor apunta a dist/ como webDir", capacitorConfig.webDir === "dist");
ok("el nombre de la app es Continuum", capacitorConfig.appName === "Continuum");
ok("hay un identificador de app definido", /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(capacitorConfig.appId || ""));

// Rutas rotas: cada imagen referenciada de forma literal (no armada a partir de una
// variable en tiempo de ejecución) debe existir de verdad dentro de dist/assets.
const jsFuentes = fs.readdirSync(REPO).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(path.join(REPO, f), "utf8")).join("\n");
const imagenesLiterales = [...jsFuentes.matchAll(/assets\/([a-z0-9_-]+\.(?:webp|svg|png))/gi)].map(m => `assets/${m[1]}`);
const imagenesRotas = imagenesLiterales.filter(ruta => !fs.existsSync(path.join(DIST, ruta)));
ok(`ninguna imagen referenciada de forma literal falta en dist/${imagenesRotas.length ? ` (falta ${[...new Set(imagenesRotas)].join(", ")})` : ""}`, !imagenesRotas.length);

const formerBrand = /\btimeline(?:[-_ ]es)?\b/i;
ok("dist/index.html no menciona el nombre antiguo (Timeline)", !formerBrand.test(fs.readFileSync(path.join(DIST, "index.html"), "utf8")));

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
