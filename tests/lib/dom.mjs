// Arrancar el juego en jsdom como lo hacen las suites: los scripts salen de index.html (la única lista
// de verdad: un mazo nuevo no obliga a tocar cada prueba), tras la frontera de acceso (game-fixture.mjs).
import { JSDOM } from "jsdom";
import { gameHtml } from "../game-fixture.mjs";
import { read } from "./comun.mjs";

// Los scripts de index.html, en orden. `bienvenida: true` arranca como la primera vez (sin identidad puesta).
export const guiones = ({ bienvenida = false } = {}) =>
  [...gameHtml(read("index.html"), { bienvenida }).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

// Abre el juego y devuelve su ventana. Orden: crear la ventana, `antes(window)` (parches de jsdom, reloj…),
// localStorage (`almacen`), sessionStorage (`sesion`) y, por último, ejecutar los scripts.
// `transformar(archivo, texto)` deja cambiar el código de un script antes de ejecutarlo.
export function arrancarJuego({ url = "https://hilo.test/", bienvenida = false, almacen = {}, sesion = {}, antes, transformar } = {}) {
  const html = gameHtml(read("index.html"), { bienvenida }).replace(/<script src="[^"]*"><\/script>/g, "");
  const { window } = new JSDOM(html, { runScripts: "outside-only", url });
  antes?.(window);
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
  Object.entries(sesion).forEach(([clave, valor]) => window.sessionStorage.setItem(clave, valor));
  guiones({ bienvenida }).forEach(archivo => window.eval(transformar ? transformar(archivo, read(archivo)) : read(archivo)));
  return window;
}
