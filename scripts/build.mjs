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

// Misma lista que ASSETS en service-worker-258.js (sin el "./"), más las páginas
// y scripts que no pasan por el service worker (actualizar.*) y las carpetas
// de imágenes que se piden bajo demanda. El nombre "-258" es un accidente
// histórico que se ha quedado así a propósito: es la URL exacta que
// `updates.js` registra, y cambiarla dejaría sin caché a quien ya lo tenga
// instalado, como si abriera la aplicación por primera vez sin conexión.
const FILES = [
  "quick-room.js", "quick-network.js", "quick-online.js", "quick-challenges.css", "quick-challenges-data.js", "quick-challenges-engine.js", "quick-challenges.js",
  "index.html", "actualizar.html", "privacidad.html", "manifest.webmanifest", "icon.svg",
  "splash.css", "splash.js", "styles.css", "edition.css", "service-worker-258.js",
  "cards.js", "movies.js", "music.js", "videogames.js", "animals.js",
  "lifespan.js", "speed.js", "inventos.js", "mundo.js", "astronomy.js",
  "medicine.js", "countries.js", "population.js", "idiomas.js", "distances.js", "modes.js",
  "deployment.js", "accounts.css", "firebase-client.js", "account-storage.js", "recent-players.js", "accounts.js", "boot.js", "engine.js", "final.js", "tournament.js", "links.js", "storage.js", "saves.js", "updates.js", "session.js", "enciclopedia.js", "progreso.js", "cartera.js", "duelo.js", "local-transport.js", "local-room.js", "local-session.js", "local-share.js", "qrcode-generator.js", "qr-encode.js", "qr-scanner.js", "jsqr.js", "local-multiplayer.js", "ghost.js", "drag.js", "swipe.js",
  "a11y.js", "mapa.js", "settings.js", "effects.js", "ambience.js", "immersion.js", "duelo-turnos.js", "push.js", "app.js", "online.js", "actualizar.js"
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
  const sw = await readFile(path.join(root, "service-worker-258.js"), "utf8");
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
