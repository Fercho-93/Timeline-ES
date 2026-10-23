// Lo común de las pruebas con navegador de verdad (Playwright): importarlo, lanzarlo y servir el juego.
//   PLAYWRIGHT_MODULE  ruta al index.mjs de un Playwright instalado aparte (si no, el del proyecto).
//   CHROME_PATH        Chromium concreto (también se admiten CHROMIUM_PATH y BROWSER_EXECUTABLE).
//   ENGINES=chromium   limita las pruebas de dos motores a Chromium donde no hay WebKit.
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO, read } from "./comun.mjs";
import { gameHtml } from "../game-fixture.mjs";

export const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
export const { chromium, webkit } = playwright;

// [nombre, motor] de los motores que toca probar (WebKit y Chromium salvo que ENGINES diga otra cosa).
export const motores = () => [["webkit", webkit], ["chromium", chromium]]
  .filter(([nombre]) => (process.env.ENGINES || "webkit,chromium").split(",").includes(nombre));

// Opciones de `launch`: el Chromium indicado por el entorno (solo vale para Chromium) y los `args` que pida la prueba.
export function opcionesLanzamiento(motor = "chromium", extra = {}) {
  const ruta = process.env.CHROME_PATH || process.env.CHROMIUM_PATH || process.env.BROWSER_EXECUTABLE;
  return { ...(motor === "chromium" && ruta ? { executablePath: ruta } : {}), ...extra };
}

const TIPOS = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };

// Sirve el repositorio en un puerto libre de 127.0.0.1 (ya escuchando): `/` es el HTML del juego tras la
// frontera de acceso (o `inicio`, si la prueba quiere otra página) y lo demás, los archivos de la raíz.
// Se cierra con `await new Promise(r => servidor.close(r))`; el puerto, en `servidor.address().port`.
export async function servirJuego({ inicio = gameHtml(read("index.html")) } = {}) {
  const servidor = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const archivo = path.resolve(REPO, "." + pathname);
      if (!archivo.startsWith(REPO + path.sep) && pathname !== "/") throw Error("path");
      const cuerpo = pathname === "/" ? inicio : await fs.readFile(archivo);
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "text/html" });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
  return servidor;
}
