import {gameHtml} from './game-fixture.mjs';
// Juega partidas completas del modo de un solo móvil sobre el DOM real de index.html.
import { JSDOM } from "jsdom";
import { finishLocalFinal } from './final-helper.mjs';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// La colección y la competición viven ahora en «Jugar», no en la portada: desde la
// portada, se entra primero ahí. Devuelve la misma ventana para poder encadenarlo.
// La tarjeta de la portada gira antes de navegar; `homeTransition = "done"` es la
// marca con la que la propia portada se salta ese giro, y aquí se usa para no esperarlo.
function pulsaPuerta(d, accion) { const b = d.querySelector(`[data-action="${accion}"]`); if (!b) return; b.dataset.homeTransition = "done"; b.click(); }
function irAJugar(w) { const d = w.document; if (!d.querySelector('[data-block], [data-action="competition-menu"]')) { if (!d.querySelector('[data-action="jugar"]')) d.querySelector('.home-nav [data-action="home-top"]')?.click(); pulsaPuerta(d, "jugar"); } return w; }


const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  // Los scripts se toman de index.html, que es la única lista de verdad: así un mazo
  // nuevo no obliga a tocar cada prueba (y no se olvida, que ya pasó).
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };

console.log("\nArranque");
let w = boot();
ok("los seis bloques están en la galería", irAJugar(w).document.querySelectorAll("[data-block]").length === 6);
click(irAJugar(w), '[data-block="historia"]');
ok("el bloque de historia se despliega con el mazo de historia", /167 hechos/.test(w.document.body.innerHTML));
// Elegir bloque selecciona su primer juego; el clic en el juego es explícito de todos
// modos, que es como funcionará cuando un bloque tenga varios.
click(irAJugar(w), '[data-block="cine"]');
ok("Entretenimiento reúne cine, música y videojuegos", w.document.querySelectorAll(".game-row").length === 3);
ok("el bloque de cine muestra las 87 películas", /87 películas/.test(w.document.body.innerHTML));
click(w, '[data-mode="movies"]');
ok("elegir un juego lleva al menú de formatos de Estrenos de cine", w.document.querySelector("h1")?.textContent === "Estrenos de cine");

console.log("\nUna partida entera");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="setup"]');
click(w, '[data-action="add-player"]');
w.document.getElementById("hand-size").value = "2";
click(w, '[data-action="start"]');
ok("empieza pidiendo pasar el móvil", /El turno es de/.test(w.document.body.innerHTML));

const cardsById = new Map(w.HISTORY_CARDS.map(c => [c.id, c]));
let turns = 0, revealed = 0, emptyTurn = false;
while (!/gana(n)?<\/h1>/.test(w.document.body.innerHTML) && turns < 4000) {
  if (JSON.parse(w.localStorage.getItem('hilo-game-history-v1'))?.final) { finishLocalFinal(w, 'hilo-game-history-v1'); continue; }
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
  if (modal && modal.querySelector(".year")) revealed++;
  click(w, '[data-action="finish-turn"]');
}
ok("nadie empieza un turno con la mano vacía", !emptyTurn);
ok("la partida termina con ganador", /gana(n)?<\/h1>/.test(w.document.body.innerHTML));
console.log("  final:", w.document.querySelector("h1").textContent, "· turnos:", turns);
ok(`cada turno revela la fecha de su carta (${revealed} de ${turns})`, revealed === turns);

console.log("\nFechas ocultas y persistencia");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="setup"]');
click(w, '[data-action="start"]');
click(w, '[data-action="ready"]');
const manoCartas = [...w.document.querySelectorAll('[data-action="select-card"]')];
const handHtml = manoCartas.map(el => el.innerHTML).join(" ");
ok("ninguna carta de la mano enseña su valor", manoCartas.every(el => !el.querySelector(".year")));
ok("todas anuncian que el dato está oculto", manoCartas.every(el => /oculta/i.test(el.textContent)));
ok("las cartas de la mano no llevan distintivo de época", !/card-era|reveal-era|era-[a-z]/.test(handHtml));
ok("la partida queda guardada en el dispositivo", !!w.localStorage.getItem("hilo-game-history-v1"));

console.log("\nSorteo de quién empieza: adivinar la fecha");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="setup"]');
ok("al principio hay que adivinar una cifra", !!w.document.querySelector('[data-action="draw-starter"]'));
click(w, '[data-action="draw-starter"]');
ok("pide pasar el móvil al primer jugador, que lleva tu nombre", /Pasa el móvil a Prueba/.test(w.document.body.innerHTML));
ok("el sorteo enseña la ilustración de la carta", !!w.document.querySelector('.starter-card-art img.animal-card-art'));
w.document.getElementById("starter-guess-input").value = "1900";
click(w, '[data-action="starter-guess-submit"]');
ok("después pide pasar el móvil al segundo jugador", /Pasa el móvil a Jugador 2/.test(w.document.body.innerHTML));
w.document.getElementById("starter-guess-input").value = "1901";
click(w, '[data-action="starter-guess-submit"]');
ok("el resultado enseña la cifra de cada jugador", w.document.querySelectorAll(".starter-draw-list li").length === 2);
ok("hay una persona ganadora marcada", !!w.document.querySelector(".starter-draw-winner"));
ok("el resultado mantiene visible la ilustración de la carta", !!w.document.querySelector('.starter-card-art img.animal-card-art'));
click(w, '[data-action="close-menu"]');
ok("el campo pasa a ofrecer repetir el sorteo", /Repetir el sorteo/.test(w.document.body.innerHTML));
click(w, '[data-action="start"]');
const partidaSorteada = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
ok("la partida arranca con quien ganó el sorteo", partidaSorteada.current === partidaSorteada.starter);
const enJuego = new Set([...partidaSorteada.deck, ...partidaSorteada.discard, ...partidaSorteada.timeline, ...partidaSorteada.players.flatMap(p => p.hand)]);
ok("la carta que se adivinó no entra en la partida", enJuego.size === w.HISTORY_CARDS.length - 1);

console.log("\nEmpezar sin pasar por el sorteo también decide quién empieza");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="setup"]');
click(w, '[data-action="start"]');
const partidaSinPasar = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
ok("aun así se aparta la carta del sorteo", [...partidaSinPasar.deck, ...partidaSinPasar.discard, ...partidaSinPasar.timeline, ...partidaSinPasar.players.flatMap(p => p.hand)].length === w.HISTORY_CARDS.length - 1);

console.log("\nAbandonar partida también desde la flecha de volver");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="setup"]');
click(w, '[data-action="start"]');
click(w, '[data-action="ready"]');
click(w, '[data-action="ui-back"]');
ok("el diálogo de salir ofrece también abandonar la partida", !!w.document.querySelector('[data-exit-discard]'));
click(w, '[data-exit-discard]');
ok("no queda partida guardada", !w.localStorage.getItem("hilo-game-history-v1"));

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
