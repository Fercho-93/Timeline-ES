// `updates.js` registra "service-worker-258.js", no "service-worker.js" — un nombre
// heredado que se ha quedado así, pero que es el que de verdad controla la caché de
// cualquier móvil real. Los dos archivos tienen que ser una copia exacta el uno del otro;
// si se edita solo "service-worker.js" (como pasó aquí: cuatro cambios seguidos del modo
// "Sin conexión" y del QR, subiendo su versión de caché, sin tocar el otro archivo), el
// móvil sigue sirviendo la versión vieja para siempre y ningún aviso de actualización
// llega a aparecer — nada en el resto de la batería de pruebas lo detectaba.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

const a = fs.readFileSync(path.join(REPO, "service-worker.js"), "utf8");
const b = fs.readFileSync(path.join(REPO, "service-worker-258.js"), "utf8");
ok("service-worker.js y service-worker-258.js son una copia exacta el uno del otro", a === b);

const version = fs.readFileSync(path.join(REPO, "updates.js"), "utf8").match(/CT\.APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
const cache = a.match(/const CACHE\s*=\s*"([^"]+)"/)?.[1];
ok(`updates.js (${version}) y la versión de caché (${cache}) coinciden`, !!version && version === cache);

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
