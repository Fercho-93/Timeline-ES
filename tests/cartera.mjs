import {gameHtml} from './game-fixture.mjs';
// La cartera: el único sitio que responde «¿tiene derecho este jugador a este mazo?».
//
// Hoy la respuesta es siempre que sí, así que la mitad de esta prueba comprueba justo
// eso: que nada ha cambiado para quien juega. La otra mitad es la que vale de verdad —se
// cierra un mazo a mano y se recorre el juego entero para ver que todos los rincones lo
// respetan—. Sin ella, la cartera sería una función que nadie llama.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot({ url = "https://hilo.test/", almacen = {} } = {}) {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = function () {};
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;

// Deja abierto todo menos los mazos que se le pasen, que es lo que haría una tienda al
// decir «esta cuenta tiene comprado esto y no aquello».
function cierra(w, ...cerrados) {
  const todos = Object.keys(w.CONTINUUM.MODES).filter(key => !cerrados.includes(key));
  w.CONTINUUM.Cartera.concede({ origen: "prueba", mazos: todos });
}

console.log("\nHoy no hay nada cerrado: la beta lo concede todo");
{
  const w = boot();
  const C = w.CONTINUUM.Cartera;
  ok("la concesión viene de la beta", C.origen() === "beta");
  ok("y está todo abierto", C.todoAbierto() === true);
  const mazos = Object.keys(w.CONTINUUM.MODES);
  ok(`los ${mazos.length} mazos son jugables`, mazos.every(key => C.tiene(key)));
  ok("no hay ninguno cerrado", C.cerrados().length === 0 && C.abiertos().length === mazos.length);
  ok("y por tanto ningún mazo tiene motivo que explicar", mazos.every(key => C.motivo(key) === null));
  ok("los bloques están abiertos enteros", Object.keys(w.CONTINUUM.BLOCKS).every(key => C.tieneBloque(key)));
  ok("un mazo que no existe nunca se tiene", C.tiene("inventado") === false);
}

console.log("\nEl catálogo: lo que se vendería si algún día se vende");
{
  const w = boot();
  const C = w.CONTINUUM.Cartera;
  const paquetes = C.paquetes();
  const bloques = Object.keys(w.CONTINUUM.BLOCKS);
  ok("hay un paquete por bloque más el que lo incluye todo", paquetes.length === bloques.length + 1);
  const todo = paquetes.find(p => p.clave === C.PAQUETE_TODO);
  ok("el paquete completo incluye todos los mazos de todos los bloques",
    todo && bloques.every(b => w.CONTINUUM.block(b).games.every(m => todo.mazos.includes(m))));
  ok("cada mazo sabe a qué paquete pertenece", C.paquete("animals").clave === "naturaleza" && C.paquete("history").clave === "historia");
  ok("y el paquete se llama por su nombre, no por su clave", C.paquete("animals").nombre === "Naturaleza");
}

console.log("\nCerrar un mazo se nota en todo el juego");
{
  const w = boot();
  cierra(w, "animals");
  const C = w.CONTINUUM.Cartera;
  ok("la cartera lo da por cerrado", C.tiene("animals") === false && C.tiene("history") === true);
  ok("su bloque deja de estar entero", C.tieneBloque("naturaleza") === false);
  ok("pero los demás mazos del bloque siguen abiertos", C.tiene("lifespan") === true && C.tiene("speed") === true);
  const razon = C.motivo("animals");
  ok("y se puede explicar, nombrando lo que haría falta", !!razon && /Naturaleza/.test(razon.texto));

  // La portada avisa de cuántos hay cerrados en cada colección.
  click(w, '[data-block="naturaleza"]');
  const indice = [...w.document.querySelectorAll(".collection-entry")].find(e => e.querySelector('[data-block="naturaleza"]'))?.querySelector(".collection-index");
  ok("la colección enseña el candado con su cuenta", /1 🔒/.test(indice?.textContent || ""));

  // El mazo se sigue viendo en la lista: lo que no se puede es abrirlo.
  const fila = w.document.querySelector('[data-mode="animals"]');
  ok("el mazo cerrado se sigue viendo en la lista", !!fila);
  ok("marcado como cerrado", fila.classList.contains("game-row-cerrado"));
  ok("y diciendo qué haría falta, en vez de cuántas cartas tiene", /Naturaleza/.test(fila.textContent));

  click(w, '[data-mode="animals"]');
  ok("tocarlo no lleva a jugar, lleva a la explicación", /Todavía no es tuyo/.test(texto(w)));
  ok("no se ha cambiado de mazo por detrás", w.localStorage.getItem("hilo-selected-mode-v1") !== "animals");
  ok("y hay salida", existe(w, '[data-action="home"]'));
}

console.log("\nUn mazo abierto sigue funcionando igual que siempre");
{
  const w = boot();
  cierra(w, "animals");
  click(w, '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  ok("se entra sin fricción", w.localStorage.getItem("hilo-selected-mode-v1") === "history");
  ok("y no aparece ninguna explicación de puerta cerrada", !/Todavía no es tuyo/.test(texto(w)));
  click(w, '[data-action="solo"]');
  ok("se puede jugar", existe(w, '[data-action="start-free"]'));
}

console.log("\nLa competición solo sortea mazos abiertos");
{
  const w = boot();
  const todos = Object.keys(w.CONTINUUM.MODES).filter(k => k !== "mixed");
  // Se deja abierta solo la mitad del catálogo.
  const abiertos = todos.slice(0, Math.ceil(todos.length / 2));
  w.CONTINUUM.Cartera.concede({ origen: "prueba", mazos: abiertos });
  const torneo = w.CONTINUUM.Tournament.create(todos.length, 5);
  ok("la rotación no mete ningún mazo cerrado", torneo.queue.every(key => abiertos.includes(key)));
  ok("y no se queda sin rondas", torneo.queue.length > 0 && torneo.queue.length <= abiertos.length);
  ok("sin repetir tema", new Set(torneo.queue).size === torneo.queue.length);
}

console.log("\nLa enciclopedia no enseña las cartas de un mazo cerrado");
{
  const w = boot();
  cierra(w, "animals");
  const bloques = w.CONTINUUM.Enciclopedia.catalogGroups("", { lock: "all" });
  const naturaleza = bloques.find(b => b.key === "naturaleza");
  ok("el mazo cerrado no aparece en el álbum", !naturaleza?.decks.some(d => d.key === "animals"));
  ok("los abiertos de su mismo bloque sí", naturaleza?.decks.some(d => d.key === "lifespan"));
  const historia = bloques.find(b => b.key === "historia");
  ok("y los demás bloques están enteros", historia?.decks.length === 3);
}

console.log("\nUn reto de un mazo que no es tuyo se explica, no se rompe");
{
  const retador = boot();
  const D = retador.CONTINUUM.Duelo;
  const payload = D.codificar({ mode: "animals", seed: "cerrado1", total: 3, hits: 2, sequence: [true, true, false], nombre: "Ana" });

  const abierto = boot({ url: `https://hilo.test/?duelo=${payload}` });
  ok("con el mazo abierto, el reto se acepta como siempre", /Ana te reta/.test(texto(abierto)));

  // Y ahora el mismo enlace en un móvil que no tiene ese mazo.
  const w = boot();
  cierra(w, "animals");
  const leido = w.CONTINUUM.Duelo.descodificar(payload);
  ok("el enlace se rechaza", leido.ok === false);
  ok("distinguiendo una puerta cerrada de un enlace roto", leido.motivo === "mazo-cerrado");
  ok("y diciendo de qué mazo se trata", leido.mode === "animals");
}

console.log("\nLa cartera decide qué se juega, nunca qué se ha jugado");
{
  // Cerrar un mazo no puede tocar el progreso: lo descubierto sigue descubierto, y si el
  // mazo vuelve a estar a mano, vuelve con todo lo que había.
  const w = boot();
  const antes = JSON.stringify(w.CONTINUUM.Progreso.read());
  cierra(w, "animals");
  ok("el progreso guardado no se toca al cerrar un mazo", JSON.stringify(w.CONTINUUM.Progreso.read()) === antes);
  w.CONTINUUM.Cartera.concede({ origen: "prueba" });
  ok("y al reabrirlo vuelve a estar todo", w.CONTINUUM.Cartera.tiene("animals") === true && JSON.stringify(w.CONTINUUM.Progreso.read()) === antes);
}

console.log("\nSolo se concede por la puerta prevista");
{
  const w = boot();
  const C = w.CONTINUUM.Cartera;
  let rompio = false;
  try { C.concede({ mazos: ["history"] }); } catch { rompio = true; }
  ok("una concesión sin decir de dónde viene se rechaza", rompio === true && C.origen() === "beta");
  C.concede({ origen: "tienda", mazos: ["history", "inventado"] });
  ok("y una concesión con un mazo que no existe lo descarta en vez de guardarlo",
    C.tiene("history") === true && C.tiene("inventado") === false && C.abiertos().join() === "history");
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
