// Juega partidas completas del modo de un solo móvil sobre el DOM real de index.html.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  // Los scripts se toman de index.html, que es la única lista de verdad: así un mazo
  // nuevo no obliga a tocar cada prueba (y no se olvida, que ya pasó).
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };

console.log("\nArranque");
let w = boot();
ok("la portada se pinta con el mazo de historia", /167 hechos/.test(w.document.body.innerHTML));
ok("los seis bloques están en la galería", w.document.querySelectorAll("[data-block]").length === 6);
// Elegir bloque selecciona su primer juego; el clic en el juego es explícito de todos
// modos, que es como funcionará cuando un bloque tenga varios.
click(w, '[data-block="cine"]');
click(w, '[data-mode="movies"]');
ok("Entretenimiento reúne cine, música y videojuegos", w.document.querySelectorAll(".game-row").length === 3);
ok("cambiar a Estrenos de cine muestra las 87 películas", /87 películas/.test(w.document.body.innerHTML));

console.log("\nUna partida entera");
w = boot();
click(w, '[data-action="setup"]');
click(w, '[data-action="add-player"]');
w.document.getElementById("hand-size").value = "2";
click(w, '[data-action="start"]');
ok("empieza pidiendo pasar el móvil", /El turno es de/.test(w.document.body.innerHTML));

const cardsById = new Map(w.HISTORY_CARDS.map(c => [c.id, c]));
let turns = 0, revealed = 0, emptyTurn = false;
while (!/gana(n)?<\/h1>/.test(w.document.body.innerHTML) && turns < 4000) {
  turns++;
  click(w, '[data-action="ready"]');
  const hand = [...w.document.querySelectorAll('[data-action="select-card"]')];
  if (!hand.length) { emptyTurn = true; break; }
  // Dos fallos pueden coincidir en una ronda. Con tres jugadores y solo un fallo
  // cada cinco turnos, siempre quedaban dos finalistas y se repetía el desempate
  // hasta agotar casi todo el mazo: esta prueba de humo tardaba miles de repintados.
  const pick = hand[0];
  const id = Number(pick.dataset.id);
  pick.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const slots = [...w.document.querySelectorAll('[data-action="place"]')];
  const timeline = [...w.document.querySelectorAll(".timeline-card .year")].map(el => el.textContent);
  const years = timeline.map(t => t.endsWith("a. C.") ? -parseInt(t) : parseInt(t));
  let index = years.findIndex(y => y > cardsById.get(id).year);
  if (index < 0) index = years.length;
  if (turns % 5 === 0 || turns % 6 === 0) index = index === 0 ? years.length : 0; // fallo deliberado
  slots[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  click(w, '[data-action="confirm-place"]');
  const modal = w.document.querySelector(".modal");
  if (modal && /class="year"/.test(modal.innerHTML)) revealed++;
  click(w, '[data-action="finish-turn"]');
}
ok("nadie empieza un turno con la mano vacía", !emptyTurn);
ok("la partida termina con ganador", /gana(n)?<\/h1>/.test(w.document.body.innerHTML));
console.log("  final:", w.document.querySelector("h1").textContent, "· turnos:", turns);
ok(`cada turno revela la fecha de su carta (${revealed} de ${turns})`, revealed === turns);

console.log("\nFechas ocultas y persistencia");
w = boot();
click(w, '[data-action="setup"]');
click(w, '[data-action="start"]');
click(w, '[data-action="ready"]');
const manoCartas = [...w.document.querySelectorAll('[data-action="select-card"]')];
const handHtml = manoCartas.map(el => el.innerHTML).join(" ");
ok("ninguna carta de la mano enseña su valor", manoCartas.every(el => !el.querySelector(".year")));
ok("todas anuncian que el dato está oculto", manoCartas.every(el => /oculta/i.test(el.textContent)));
ok("las cartas de la mano no llevan distintivo de época", !/card-era|reveal-era|era-[a-z]/.test(handHtml));
ok("la partida queda guardada en el dispositivo", !!w.localStorage.getItem("hilo-game-history-v1"));

console.log("\nPartida heredada de la versión anterior");
w = boot();
const legacy = JSON.stringify({ mode: "history", players: [{ id: 1, name: "Ana", hand: [1] }, { id: 2, name: "Bea", hand: [2] }], deck: [3], discard: [], timeline: [4], current: 0, starter: 0, turnsInRound: 0, round: 1, winner: null });
w.localStorage.setItem("hilo-espana-game-v1", legacy);
w = (() => { const w2 = boot(); w2.localStorage.setItem("hilo-espana-game-v1", legacy); w2.eval(read("app.js")); return w2; })();
ok("se migra a la clave nueva", w.localStorage.getItem("hilo-game-history-v1") === legacy);
ok("y se borra la vieja", w.localStorage.getItem("hilo-espana-game-v1") === null);

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
