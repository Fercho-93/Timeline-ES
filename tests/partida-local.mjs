// Juega partidas completas del modo de un solo móvil sobre el DOM real de index.html.
import { finishLocalFinal } from './final-helper.mjs';
import { ok, fail } from "./lib/comun.mjs";
import { arrancarJuego } from "./lib/dom.mjs";
// Antes de repartir se juega el minijuego de quién empieza: todos dicen la misma cifra.
function jugarQuienEmpieza(w) { const d = w.document; const tap = el => el?.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); for (let i = 0; i < 12 && d.getElementById('starter-guess-input'); i++) { d.getElementById('starter-guess-input').value = '1900'; tap(d.querySelector('[data-action="starter-guess-submit"]')); } tap(d.querySelector('[data-action="starter-start"]')); return w; }

// La colección y la competición viven ahora en «Jugar», no en la portada: desde la
// portada, se entra primero ahí. Devuelve la misma ventana para poder encadenarlo.
// La tarjeta de la portada gira antes de navegar; `homeTransition = "done"` es la
// marca con la que la propia portada se salta ese giro, y aquí se usa para no esperarlo.
function pulsaPuerta(d, accion) { const b = d.querySelector(`[data-action="${accion}"]`); if (!b) return; b.dataset.homeTransition = "done"; b.click(); }
function irAJugar(w) { const d = w.document; if (!d.querySelector('[data-block]')) { w.CONTINUUM.ModeHubs.open('hub-solo'); if (!d.querySelector('[data-block]')) d.querySelector('[data-inline-route]')?.click(); } w.sessionStorage.removeItem('continuum-entry-route'); return w; }
function irAInicio(w) { w.sessionStorage.removeItem('continuum-entry-route'); w.CONTINUUM.localNavigate('home'); w.CONTINUUM.ModeHubs.refreshHome(); return w; }




function boot() {
  return arrancarJuego({ antes: w => { w.Element.prototype.scrollIntoView = () => {}; } });
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
ok("Entretenimiento reúne cine, música y videojuegos", w.document.querySelectorAll(".collection-entry.active .game-row").length === 3);
ok("el bloque de cine muestra sus películas", /\d+ películas/.test(w.document.querySelector(".collection-entry.active").innerHTML));
click(w, '[data-mode="movies"]');
ok("elegir un juego lleva a jugar Estrenos de cine en solitario", w.document.getElementById("app").dataset.screen === "solo-home" && /Estrenos de cine/.test(w.document.querySelector(".solo-intro .eyebrow")?.textContent || ""));

console.log("\nUna partida entera");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
(w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
click(w, '[data-action="add-player"]');
w.document.getElementById("hand-size").value = "2";
click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
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
(w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
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
(w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
// La lámina anuncia el minijuego y lo abre «Empezar»: una sola llamada principal.
ok("al principio se anuncia que hay que adivinar una cifra", !!w.document.querySelector('.starter-draw-info') && !w.document.querySelector('[data-action="draw-starter"]'));
click(w, '[data-action="start"]');
ok("pide pasar el móvil al primer jugador, que lleva tu nombre", /Pasa el móvil a Prueba/.test(w.document.body.textContent));
ok("el sorteo enseña la ilustración de la carta", !!w.document.querySelector('.starter-card-art img.animal-card-art'));
ok("la ayuda está asociada a la respuesta", w.document.getElementById(w.document.getElementById("starter-guess-input").getAttribute("aria-describedby"))?.textContent.length > 0);
click(w, '[data-cifra-signo]');
ok("antes de Cristo queda marcado al elegirlo", w.document.querySelector('[data-cifra-signo]').getAttribute('aria-pressed') === 'true');
click(w, '[data-cifra-signo]');
ok("volver a tocarlo quita la marca y el signo", w.document.querySelector('[data-cifra-signo]').getAttribute('aria-pressed') === 'false' && w.document.getElementById('starter-guess-input').value === '');
w.document.getElementById("starter-guess-input").value = "1900";
click(w, '[data-action="starter-guess-submit"]');
ok("después pide pasar el móvil al segundo jugador", /Pasa el móvil a Jugador 2/.test(w.document.body.textContent));
ok("el turno siguiente anuncia su título y conserva el nombre accesible del diálogo", w.document.activeElement.id === 'starter-dialog-title' && !!w.document.getElementById(w.document.querySelector('[data-starter-dialog] .modal').getAttribute('aria-labelledby')));
w.document.getElementById("starter-guess-input").value = "1901";
click(w, '[data-action="starter-guess-submit"]');
ok("el resultado enseña la cifra de cada jugador", w.document.querySelectorAll(".starter-draw-list li").length === 2);
ok("hay una persona ganadora marcada", !!w.document.querySelector(".starter-draw-winner"));
ok("el resultado mantiene visible la ilustración de la carta", !!w.document.querySelector('.starter-card-art img.animal-card-art'));
click(w, '[data-action="close-menu"]');
ok("el campo pasa a ofrecer repetir el minijuego", /Repetir el minijuego/.test(w.document.body.innerHTML));
click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
const partidaSorteada = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
ok("la partida arranca con quien ganó el sorteo", partidaSorteada.current === partidaSorteada.starter);
const enJuego = new Set([...partidaSorteada.deck, ...partidaSorteada.discard, ...partidaSorteada.timeline, ...partidaSorteada.players.flatMap(p => p.hand)]);
const valoresHistoria = new Set(w.HISTORY_CARDS.map(c => w.CONTINUUM.sortValue("history", c))).size;
ok("la carta que se adivinó no entra en la partida", !enJuego.has(partidaSorteada.starterCardId ?? -1) && enJuego.size <= valoresHistoria && enJuego.size >= valoresHistoria - 1);
ok("no se reparten dos cartas con el mismo valor", new Set([...enJuego].map(id => w.CONTINUUM.sortValue("history", w.HISTORY_CARDS.find(c => c.id === id)))).size === enJuego.size);

console.log("\nEmpezar sin pasar por el sorteo también decide quién empieza");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
(w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
const partidaSinPasar = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
const repartidasSinPasar = [...partidaSinPasar.deck, ...partidaSinPasar.discard, ...partidaSinPasar.timeline, ...partidaSinPasar.players.flatMap(p => p.hand)];
const distintos = new Set(w.HISTORY_CARDS.map(c => w.CONTINUUM.sortValue("history", c))).size;
ok("aun así se aparta la carta del sorteo", repartidasSinPasar.length <= distintos && repartidasSinPasar.length >= distintos - 1 && new Set(repartidasSinPasar).size === repartidasSinPasar.length);

console.log("\nAbandonar partida también desde la flecha de volver");
w = boot();
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
(w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
click(w, '[data-action="ready"]');
click(w, '[data-action="ui-back"]');
ok("el diálogo de salir ofrece también abandonar la partida", !!w.document.querySelector('[data-exit-discard]'));
click(w, '[data-exit-discard]');
ok("no queda partida guardada", !w.localStorage.getItem("hilo-game-history-v1"));

console.log("\n«Guardar y salir» con tiempo por turno no hace perder el turno");
{
  w = arrancarJuego({ almacen: { "continuum-tiempo-local-v1": "15" }, antes: w => { w.Element.prototype.scrollIntoView = () => {}; } });
  const ahora = w.Date.now.bind(w.Date);
  let desfase = 0;
  w.Date.now = () => ahora() + desfase;
  click(irAJugar(w), '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  w.CONTINUUM.openDeckAs('local');
  click(w, '[data-action="add-player"]');
  click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
  click(w, '[data-action="ready"]');
  const guardada = () => JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
  ok("el turno lleva reloj", guardada().turnSeconds === 15 && Number.isFinite(guardada().turnClock?.at));
  click(w, '[data-action="ui-back"]');
  click(w, '[data-exit-confirm]');
  ok("se guarda sin la hora de inicio del turno", guardada() && !guardada().turnClock);
  desfase = 5 * 60000;
  w.sessionStorage.setItem('continuum-entry-route', 'local');
  w.CONTINUUM.openDeckAs('local');
  click(w, '[data-action="continue"]');
  if (w.document.querySelector('[data-action="ready"]')) click(w, '[data-action="ready"]');
  await new Promise(resolve => w.setTimeout(resolve, 400));
  ok("al volver, el turno sigue en juego con plazo nuevo",
    !/Se acabó el tiempo/.test(w.document.body.textContent) && guardada().turnClock?.at >= ahora() + desfase - 1000);
  w.close();
}

console.log("\nMesa llena en un mazo pequeño");
// Velocidad tiene valores repetidos: el tope de la mano se calcula sobre el mazo que se
// reparte de verdad, no sobre todas sus cartas, o la línea empezaba sin carta.
w = boot();
click(irAJugar(w), '[data-block="naturaleza"]');
click(w, '[data-mode="speed"]');
(w.CONTINUUM||w.defaultView.CONTINUUM).openDeckAs('local');
while (w.document.querySelectorAll("#players input").length < 8) click(w, '[data-action="add-player"]');
w.document.getElementById("hand-size").value = "6";
click(w, '[data-action="start"]'); jugarQuienEmpieza(w);
const mesaLlena = JSON.parse(w.localStorage.getItem("hilo-game-speed-v1"));
const manosLlenas = mesaLlena.players.map(p => p.hand.length);
ok("la línea empieza con una carta de verdad", mesaLlena.timeline.length === 1 && Number.isInteger(mesaLlena.timeline[0]));
ok("todas las manos tienen las mismas cartas", manosLlenas.every(n => n === manosLlenas[0] && n > 0 && n < 6));
ok("queda mazo para robar", mesaLlena.deck.length > 0);

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
