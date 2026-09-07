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

// Misma lista que ASSETS en service-worker.js (sin el "./"), más las páginas
// y scripts que no pasan por el service worker (actualizar.*) y las carpetas
// de imágenes que se piden bajo demanda.
const FILES = [
  "index.html", "actualizar.html", "manifest.webmanifest", "icon.svg",
  "splash.css", "splash.js", "styles.css", "service-worker.js",
  "cards.js", "movies.js", "music.js", "videogames.js", "animals.js",
  "lifespan.js", "speed.js", "inventos.js", "mundo.js", "astronomy.js",
  "medicine.js", "countries.js", "population.js", "distances.js", "modes.js",
  "enciclopedia.js", "progreso.js", "duelo.js", "ghost.js", "drag.js",
  "a11y.js", "mapa.js", "settings.js", "app.js", "online.js", "actualizar.js"
];

const DIRS = ["assets"];

async function build() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  for (const file of FILES) {
    const from = path.join(root, file);
    if (!existsSync(from)) throw new Error(`Falta ${file}, referenciado por el build`);
    await cp(from, path.join(dist, file));
  }

  for (const dir of DIRS) {
    await cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
  }

  // Aviso si el service worker referencia algo que el build no ha copiado, para
  // detectar antes de publicar que dist/ y la lista de caché se han desincronizado.
  const sw = await readFile(path.join(root, "service-worker.js"), "utf8");
  const assetMatch = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (assetMatch) {
    const referenced = [...assetMatch[1].matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]);
    const missing = referenced.filter(f => !existsSync(path.join(dist, f)));
    if (missing.length) throw new Error(`El build no incluye archivos que pide el service worker: ${missing.join(", ")}`);
  }

  console.log(`dist/ generado con ${FILES.length} archivos y ${DIRS.length} carpetas.`);
}

build().catch(error => {
  console.error(error.message);
  process.exit(1);
});
