// Juega partidas completas del modo de un solo móvil sobre el DOM real de index.html.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  window.eval(read("cards.js"));
  window.eval(read("movies.js"));
  window.eval(read("countries.js"));
  window.eval(read("app.js"));
  return window;
}
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };

console.log("\nArranque");
let w = boot();
ok("la portada se pinta con el mazo de historia", /190 hechos/.test(w.document.body.innerHTML));
click(w, '[data-mode="movies"]');
ok("cambiar a cine muestra las 87 películas", /87 películas/.test(w.document.body.innerHTML));
ok("la portada de cine no promete lo que no hay", !/103/.test(w.document.body.innerHTML));

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
  // Juega siempre bien salvo un turno de cada cinco, para que haya fallos y robos.
  const pick = hand[0];
  const id = Number(pick.dataset.id);
  pick.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const slots = [...w.document.querySelectorAll('[data-action="place"]')];
  const timeline = [...w.document.querySelectorAll(".timeline-card .year")].map(el => el.textContent);
  const years = timeline.map(t => t.endsWith("a. C.") ? -parseInt(t) : parseInt(t));
  let index = years.findIndex(y => y > cardsById.get(id).year);
  if (index < 0) index = years.length;
  if (turns % 5 === 0) index = index === 0 ? years.length : 0; // fallo deliberado
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
const handHtml = [...w.document.querySelectorAll('[data-action="select-card"]')].map(el => el.innerHTML).join(" ");
ok("las cartas de la mano no filtran el año", !/\d{3,4}/.test(handHtml.replace(/data-id="\d+"/g, "")));
ok("las cartas de la mano no filtran la época", !/card-era|Edad Media|Hispania/.test(handHtml));
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
