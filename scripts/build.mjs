// Empaqueta Continuum en dist/: una copia literal de los archivos que la
// aplicación necesita para funcionar, sin bundler ni transformación, porque
// el juego se sirve como scripts clásicos (no módulos ES) cargados por
// index.html. Capacitor (y cualquier alojamiento estático) apunta a dist/.
import { cp, mkdir, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");

// La lista de archivos es la de precarga del service worker (ASSETS en
// service-worker-258.js): lo que la web guarda para funcionar sin conexión es
// lo mismo que la app lleva dentro. El nombre "-258" es un accidente histórico
// que se ha quedado así a propósito: es la URL exacta que `updates.js`
// registra, y cambiarla dejaría sin caché a quien ya lo tenga instalado.
// Se añaden las páginas que no pasan por el service worker (la invitación y
// «Actualizar Continuum», con sus scripts) y las carpetas enteras de imágenes
// y bibliotecas, que incluyen lo que se pide bajo demanda.
const EXTRA = ["invitation.html", "js/online/invitation.js", "actualizar.html", "js/arranque/actualizar.js"];
const DIRS = ["assets", "vendor"];

async function build() {
  const sw = await readFile(path.join(root, "service-worker-258.js"), "utf8");
  const assets = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (!assets) throw new Error("No se encuentra la lista ASSETS en service-worker-258.js");
  const precargados = [...assets[1].matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]).filter(Boolean);
  // Lo que cuelga de DIRS se copia con su carpeta; el resto, archivo a archivo.
  const files = [...new Set([...precargados, ...EXTRA])].filter(file => !DIRS.some(dir => file.startsWith(`${dir}/`)));

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const file of files) {
    const from = path.join(root, file);
    if (!existsSync(from)) throw new Error(`Falta ${file}, referenciado por el build`);
    await mkdir(path.dirname(path.join(dist, file)), { recursive: true });
    await cp(from, path.join(dist, file));
  }
  for (const dir of DIRS) {
    await cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
  }
  console.log(`dist/ generado con ${files.length} archivos y ${DIRS.length} carpetas.`);
}

build().catch(error => {
  console.error(error.message);
  process.exit(1);
});
