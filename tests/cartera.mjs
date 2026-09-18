import {gameHtml} from './game-fixture.mjs';
// La cartera: el único sitio que responde «¿tiene derecho este jugador a este mazo?».
//
// Mientras dure la simulación hay un mazo cerrado de verdad —«Gran mezcla temporal»—, así
// que la primera parte de esta prueba fija esa situación: qué está cerrado, qué sigue
// abierto y qué se le cuenta a quien se encuentra la puerta. La segunda cierra otros
// mazos a mano y recorre el juego entero para ver que todos los rincones lo respetan.
// Sin ella, la cartera sería una función que nadie llama.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot({ url = "https://hilo.test/", almacen = {}, sesion = {} } = {}) {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = function () {};
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
  Object.entries(sesion).forEach(([clave, valor]) => window.sessionStorage.setItem(clave, valor));
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

console.log("\nLa simulación: «Gran mezcla temporal» esperando un pago");
{
  const w = boot();
  const C = w.CONTINUUM.Cartera;
  ok("la concesión la firma la simulación, no la beta", C.origen() === "simulacion");
  ok("y cierra exactamente lo que dice su lista", C.SIMULACION.join() === "mixed" && C.cerrados().join() === "mixed");
  ok("no está todo abierto", C.todoAbierto() === false);
  const mazos = Object.keys(w.CONTINUUM.MODES);
  ok(`los otros ${mazos.length - 1} mazos siguen siendo jugables`, mazos.filter(k => k !== "mixed").every(key => C.tiene(key)));
  ok("el de la simulación no", C.tiene("mixed") === false);
  ok("su bloque deja de estar entero y los demás no se enteran",
    C.tieneBloque("mezcla") === false && Object.keys(w.CONTINUUM.BLOCKS).filter(k => k !== "mezcla").every(k => C.tieneBloque(k)));
  const razon = C.motivo("mixed");
  ok("se explica sin repetir su propio nombre, y con el precio", razon.texto === "Este mazo se desbloquea aparte por 2,99 €.");
  ok("nombrando el paquete que haría falta", razon.paquete === "mezcla" && razon.precio === "2,99 €");
  ok("los abiertos no tienen nada que explicar", mazos.filter(k => k !== "mixed").every(key => C.motivo(key) === null));
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
  ok("un bloque de un solo mazo se sabe suelto, y una colección no",
    C.paquete("mixed").solo === true && C.paquete("animals").solo === false);
  ok("solo llevan precio los paquetes de la simulación",
    paquetes.find(p => p.clave === "mezcla").precio === "2,99 €" && todo.precio === "9,99 €"
    && paquetes.find(p => p.clave === "naturaleza").precio === null);
}

console.log("\nUna compra simulada abre la puerta, y no deja huella");
{
  const w = boot();
  const C = w.CONTINUUM.Cartera;
  ok("un paquete que no existe no compra nada", C.compraSimulada("regalo") === false && C.tiene("mixed") === false);
  ok("el suyo sí", C.compraSimulada("mezcla") === true && C.tiene("mixed") === true);
  ok("y no se lleva por delante lo que ya estaba abierto", C.todoAbierto() === true);
  ok("la concesión dice de dónde vino", C.origen() === "compra-simulada");
  ok("nada de esto se guarda: al volver a abrir, la puerta está cerrada otra vez",
    boot().CONTINUUM.Cartera.tiene("mixed") === false);
}

console.log("\nLa puerta cerrada, tal y como se ve");
{
  const w = boot();
  click(w, '[data-block="mezcla"]');
  const fila = w.document.querySelector('[data-mode="mixed"]');
  ok("el mazo se sigue viendo, con su candado y su precio",
    fila && fila.classList.contains("game-row-cerrado") && /2,99 €/.test(fila.textContent));

  click(w, '[data-mode="mixed"]');
  ok("tocarlo lleva a la explicación, no a jugar", /Todavía no es tuyo/.test(texto(w)));
  ok("que dice cuántas cartas hay dentro", new RegExp(`Son ${w.CONTINUUM.cards("mixed").length} cartas`).test(texto(w)));
  ok("y ofrece desbloquear por su precio", /Desbloquear · 2,99 €/.test(texto(w)));

  click(w, '[data-action="mazo-desbloquear"]');
  ok("el botón abre una ventana de pago que se declara simulada", /no se cobra nada/i.test(texto(w)));
  ok("y avisa de que al recargar vuelve a estar cerrado", /vuelve a estar cerrado/.test(texto(w)));
  ok("sin haber concedido nada todavía", w.CONTINUUM.Cartera.tiene("mixed") === false);

  click(w, '[data-action="compra-simular"]');
  ok("simular que sale bien abre el mazo", w.CONTINUUM.Cartera.tiene("mixed") === true);
  ok("y entra en él, sin dejar el diálogo por medio",
    w.localStorage.getItem("hilo-selected-mode-v1") === "mixed" && !existe(w, ".overlay"));
}

console.log("\nEl mazo que quedó elegido, si deja de ser suyo, no arrastra al juego entero");
{
  // Quien estaba jugando a «Gran mezcla» antes de que se cerrara tiene su clave guardada.
  // Eso es el recuerdo de la última partida, no un derecho, y no puede saltarse la puerta.
  const w = boot({ almacen: { "hilo-selected-mode-v1": "mixed" } });
  click(w, '[data-block="mezcla"]');
  ok("el mazo cerrado no aparece como el elegido",
    w.document.querySelector('[data-mode="mixed"]')?.getAttribute("aria-pressed") === "false");
  click(w, '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  ok("y se puede seguir jugando a otro con normalidad", w.localStorage.getItem("hilo-selected-mode-v1") === "history");

  // Lo mismo con la vista guardada de la pestaña: recargar no la devuelve a un mazo cerrado.
  const vista = JSON.stringify({ screen: "play-menu", mode: "mixed", block: "mezcla" });
  const v = boot({ sesion: { "continuum-tab-view-v1": vista } });
  ok("una vista guardada de un mazo cerrado empieza en la portada", existe(v, ".gallery") && !/Todavía no es tuyo/.test(texto(v)));
}

console.log("\nLa enciclopedia no ofrece elegir un mazo que no es suyo");
{
  const w = boot();
  click(w, '[data-action="home-encyclopedia"]');
  const opciones = [...w.document.querySelectorAll("option")].map(o => o.value);
  ok("el mazo cerrado no está en el desplegable", !opciones.includes("mixed"));
  ok("los abiertos sí", opciones.includes("history") && opciones.includes("animals"));
  ok("y no queda ningún grupo vacío",
    [...w.document.querySelectorAll("optgroup")].every(g => g.querySelectorAll("option").length > 0));
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

  // Y así es como lo ve quien abre el enlace: un mazo que le falta, no un enlace roto.
  const suyo = retador.CONTINUUM.Duelo.codificar({ mode: "mixed", seed: "cerrado2", total: 3, hits: 3, sequence: [true, true, true], nombre: "Ana" });
  const invitado = boot({ url: `https://hilo.test/?duelo=${suyo}` });
  ok("no se le dice que el enlace no vale, porque vale", /Te falta el mazo/.test(texto(invitado)) && !/Este enlace no vale/.test(texto(invitado)));
  ok("se le nombra el mazo y lo que costaría", /Gran mezcla temporal/.test(texto(invitado)) && /2,99 €/.test(texto(invitado)));
  ok("y se le ofrece la misma salida que en la puerta cerrada", existe(invitado, '[data-action="mazo-desbloquear"]'));
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
  ok("una concesión sin decir de dónde viene se rechaza y no cambia nada",
    rompio === true && C.origen() === "simulacion" && C.tiene("history") === true);
  C.concede({ origen: "tienda", mazos: ["history", "inventado"] });
  ok("y una concesión con un mazo que no existe lo descarta en vez de guardarlo",
    C.tiene("history") === true && C.tiene("inventado") === false && C.abiertos().join() === "history");
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
