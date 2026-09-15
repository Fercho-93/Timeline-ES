// Copia los mazos y `modes.js` dentro de `functions/` antes de desplegar.
//
// Firebase solo sube lo que hay en la carpeta de la función, así que los archivos del
// juego tienen que estar dentro. Copiarlos en vez de mantener una segunda lista de
// fechas es lo que evita el fallo que de verdad importa: que la función y el móvil
// repartan mazos distintos y todas las partidas queden rechazadas.
//
// La lista sale de `index.html`, que es donde ya está escrita en el orden correcto: un
// mazo nuevo no obliga a tocar este archivo. Se copia el tramo que va del primer mazo a
// `modes.js` incluido, que es lo último que hace falta para saber el valor de una carta.
// Ni lo de antes —`splash.js` vive en la cabecera y toca el DOM nada más cargarse— ni lo
// de después, que son pantallas, sonido y accesibilidad, pintan nada aquí.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(AQUI, "..");
const DESTINO = path.join(AQUI, "juego");

const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
const guiones = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(coincidencia => coincidencia[1]);
const inicio = guiones.indexOf("cards.js");
const corte = guiones.indexOf("modes.js");
if (inicio === -1 || corte === -1 || corte < inicio) throw Error("index.html ya no carga cards.js y modes.js en ese orden: revisa esta lista.");
const necesarios = guiones.slice(inicio, corte + 1);

fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(DESTINO, { recursive: true });
for (const archivo of necesarios) fs.copyFileSync(path.join(REPO, archivo), path.join(DESTINO, archivo));
fs.writeFileSync(path.join(DESTINO, "lista.json"), `${JSON.stringify(necesarios, null, 2)}\n`);

console.log(`Copiados ${necesarios.length} archivos del juego en functions/juego/`);
