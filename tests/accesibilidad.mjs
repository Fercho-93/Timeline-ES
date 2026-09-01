// Que la partida se pueda seguir con teclado y con lector de pantalla. Son dos cosas
// distintas y las dos se rompen solas en cuanto alguien añade una pantalla nueva:
//
// - El foco. La aplicación repinta entera en cada acción, así que el foco hay que
//   devolverlo a mano. Si esto falla, tras cada jugada hay que tabular desde el principio.
// - Lo que se anuncia. Colocar una carta no cambia ningún titular, así que si no pasa por
//   la región viva, quien no ve la pantalla no se entera de nada.
//
// Y al final, el contraste de las bandas de época, que es puro dato y no cuesta nada
// comprobar: texto blanco sobre color, mínimo 4,5 a 1.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot(mode = null) {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://continuum.test/" });
  const { window } = dom;
  // jsdom no maquetiza, así que no tiene scrollIntoView; y al pulsar tampoco enfoca, que
  // es lo que hace un navegador de verdad con un botón. Las dos cosas se suplen aquí.
  window.Element.prototype.scrollIntoView = function () {};
  if (mode) window.localStorage.setItem("hilo-selected-mode-v1", mode);
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const el = (w, sel) => { const nodo = w.document.querySelector(sel); if (!nodo) throw new Error(`no existe ${sel}`); return nodo; };
const click = (w, sel) => {
  const nodo = el(w, sel);
  nodo.focus();
  nodo.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const tecla = (w, key) => w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const activo = w => w.document.activeElement;
// `announce` espera un poco antes de escribir, para que repetir el mismo texto vuelva a
// anunciarse; hay que darle ese margen.
const respira = () => new Promise(r => setTimeout(r, 80));

function partida(w) {
  click(w, '[data-action="setup"]');
  click(w, '[data-action="start"]');
  click(w, '[data-action="ready"]');
}

console.log("\nEl foco no se pierde al repintar");
{
  const w = boot();
  partida(w);
  ok("al entrar en la partida el foco va a su titular", activo(w) === el(w, "h1[data-focus]"));

  const carta = w.document.querySelector(".hand-card");
  const id = carta.dataset.id;
  click(w, ".hand-card");
  ok("elegir una carta deja el foco en esa misma carta", activo(w) === el(w, `.hand-card[data-id="${id}"]`));

  click(w, '.slot[data-index="1"]');
  ok("elegir un hueco lleva el foco a la confirmación", activo(w) === el(w, '[data-action="confirm-place"]'));

  click(w, '[data-action="cancel-place"]');
  ok("cancelar no deja el foco en el aire", w.document.querySelector(".shell").contains(activo(w)));
}

console.log("\nLas capas son diálogos de verdad");
{
  const w = boot();
  click(w, '[data-action="rules"]');
  const modal = el(w, ".overlay .modal");
  ok("se anuncia como diálogo", modal.getAttribute("role") === "dialog" && modal.getAttribute("aria-modal") === "true");
  ok("y con nombre, tomado de su titular", modal.getAttribute("aria-labelledby") === el(w, ".overlay .modal h2").id);
  ok("el foco entra dentro", modal.contains(activo(w)));

  const abrio = el(w, '[data-action="rules"]');
  tecla(w, "Escape");
  ok("Escape cierra las reglas", !w.document.querySelector(".overlay"));
  // Devolver el foco espera a que el navegador confirme que la capa se ha ido.
  await respira();
  ok("y el foco vuelve al botón que las abrió", activo(w) === abrio);
}

console.log("\nLas reglas se adaptan al mazo");
{
  const w = boot("animals");
  click(w, '[data-action="rules"]');
  const texto = el(w, ".overlay .modal").textContent;
  ok("peso muestra su dato oculto", /peso oculto/i.test(texto));
  // El aviso depende del mazo, así que se comprueban los dos lados: aparece donde
  // quedan cartas sin cerrar y desaparece en cuanto un mazo ya no tiene ninguna.
  ok("los mazos con pendientes lo explican", /en revisión/.test(w.CONTINUUM.guideMarkup("speed", "local")));
  ok("y los mazos sin pendientes no lo dicen", !/en revisión/.test(w.CONTINUUM.guideMarkup("lifespan", "local")));
  ok("los empates exactos se admiten", /mismo valor/.test(texto));
  ok("el Pulso se explica fuera de solitario", /Carta Pulso activa/.test(w.CONTINUUM.guideMarkup("history", "local", { pulse: true })));
  ok("el reto diario se explica en solitario", /reto diario/i.test(w.CONTINUUM.guideMarkup("history", "solo")));
  ok("la competición explica sus rondas", /cinco cartas/i.test(w.CONTINUUM.guideMarkup("history", "competition")));
  ok("la guía online explica al anfitrión", /anfitrión/i.test(w.CONTINUUM.guideMarkup("history", "online")));
}
{
  const w = boot();
  partida(w);
  click(w, ".hand-card");
  click(w, '.slot[data-index="0"]');
  click(w, '[data-action="confirm-place"]');
  const modal = el(w, ".overlay .modal");
  ok("el revelado también es un diálogo", modal.getAttribute("aria-modal") === "true");
  ok("con el foco en su único botón", activo(w) === el(w, '[data-action="finish-turn"]'));
  ok("el resultado se lee junto al nombre de la carta", /Bien colocado:|No encaja ahí:/.test(el(w, ".overlay .modal h2").textContent));
  tecla(w, "Escape");
  ok("Escape no descarta el revelado, que es un paso obligado", !!w.document.querySelector(".overlay"));
}

console.log("\nLo que no se ve, se anuncia");
{
  const w = boot();
  partida(w);
  const titulo = w.document.querySelector(".hand-card strong").textContent;
  click(w, ".hand-card");
  await respira();
  const region = el(w, "#anuncio");
  ok("la región viva existe y es educada", region.getAttribute("aria-live") === "polite");
  ok("elegir carta se anuncia con su nombre", region.textContent.includes(titulo));

  click(w, '.slot[data-index="1"]');
  await respira();
  ok("elegir hueco dice cuál de cuántos", /Hueco 2 de \d+/.test(region.textContent));
}

console.log("\nEstado de los controles");
{
  const w = boot();
  partida(w);
  ok("las cartas de la mano dicen si están elegidas", [...w.document.querySelectorAll(".hand-card")].every(c => c.hasAttribute("aria-pressed")));
  click(w, ".hand-card");
  ok("y la elegida lo refleja", el(w, ".hand-card").getAttribute("aria-pressed") === "true");
  ok("el marcador señala a quién le toca", w.document.querySelectorAll('.score[aria-current="true"]').length === 1);
  ok("los huecos se describen por su posición", [...w.document.querySelectorAll(".slot")].every(s => /Colocar en la posición \d+ de \d+/.test(s.getAttribute("aria-label") || "")));
}

console.log("\nContraste de las bandas de época");
{
  const css = read("styles.css");
  const bandas = [...css.matchAll(/^\.era-([a-z]+) \{ background: (#[0-9a-f]{6}); \}/gm)];
  const lineal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const canales = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const luz = hex => { const [r, g, b] = canales(hex).map(lineal); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // El texto de la banda es blanco al 92% sobre el color, así que se compone antes.
  const sobre = hex => "#" + canales(hex).map(c => Math.round(255 * 0.92 + c * 0.08).toString(16).padStart(2, "0")).join("");
  const razon = (a, b) => (Math.max(luz(a), luz(b)) + 0.05) / (Math.min(luz(a), luz(b)) + 0.05);

  ok(`se encuentran las bandas en la hoja de estilo (${bandas.length})`, bandas.length > 20);
  const flojas = bandas.filter(([, , color]) => razon(sobre(color), color) < 4.5);
  ok(`todas llegan a 4,5:1${flojas.length ? ` (falla ${flojas.map(m => `${m[1]} ${razon(sobre(m[2]), m[2]).toFixed(2)}`).join(", ")})` : ""}`, !flojas.length);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
