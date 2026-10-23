// Lo que repetían las suites: la raíz del repositorio, leer un archivo suyo y el contador de fallos.
// `fail` es un enlace vivo: la suite lo lee al final (`process.exit(fail ? 1 : 0)`) con el valor actual.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const read = f => fs.readFileSync(path.join(REPO, f), "utf8");

export let fail = 0;
export const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };
