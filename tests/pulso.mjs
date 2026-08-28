// El Pulso: la jugada de una vez por partida que sustituye al turno y reparte cartas
// entre dos manos. Es la única jugada del juego que toca la mano de otra persona, así que
// lo que más se comprueba aquí es que las cartas ni se creen ni se pierdan por el camino.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot(almacen = {}) {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
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
const CLAVE = "hilo-game-history-v1";
const estado = w => JSON.parse(w.localStorage.getItem(CLAVE));
const cartas = w => new Map(w.HISTORY_CARDS.map(c => [c.id, c]));

// Una partida servida a medida: así se sabe exactamente qué carta sale en el Pulso y
// dónde hay que colocarla para acertar o para fallar a propósito.
function partida({ manos, timeline, deck, pulse = true, round = 1, players: extra = {} }) {
  return JSON.stringify({
    mode: "history", pulse,
    players: manos.map((hand, i) => ({ id: i + 1, name: `J${i + 1}`, hand, pulseUsed: false, shieldRound: 0, ...(extra[i] || {}) })),
    deck, discard: [], timeline, current: 0, starter: 0, turnsInRound: 0, round,
    winner: null, winners: null, pulseTurn: null, pulseGift: null
  });
}

// Total de cartas repartidas por todas partes: tiene que ser invariante.
function inventario(w) {
  const s = estado(w);
  const todas = [...s.deck, ...s.discard, ...s.timeline, ...s.players.flatMap(p => p.hand), ...(s.pulseTurn ? [s.pulseTurn.cardId] : [])];
  return { total: todas.length, unicas: new Set(todas).size };
}

function entrar(w) {
  click(w, '[data-action="continue"]');
  click(w, '[data-action="ready"]');
}

// Coloca la carta del Pulso en el hueco pedido y confirma.
function colocar(w, index) {
  w.document.querySelectorAll('[data-action="pulse-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  click(w, '[data-action="confirm-place"]');
}

console.log("\nCuándo aparece el Pulso");
{
  // 1212 y 1492 en la línea; el mazo sacará 1478, que encaja entre las dos.
  const base = { manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25] };
  const sinPulso = boot({ [CLAVE]: partida({ ...base, pulse: false }) });
  entrar(sinPulso);
  ok("sin el interruptor no hay botón de Pulso", !existe(sinPulso, '[data-action="pulse-open"]'));

  const conPulso = boot({ [CLAVE]: partida(base) });
  entrar(conPulso);
  ok("con el interruptor sí aparece", existe(conPulso, '[data-action="pulse-open"]'));

  const unaCarta = boot({ [CLAVE]: partida({ ...base, manos: [[1], [3, 4]] }) });
  entrar(unaCarta);
  ok("con una sola carta no se puede: ganarías sin colocarla", !existe(unaCarta, '[data-action="pulse-open"]'));

  const gastado = boot({ [CLAVE]: partida({ ...base, players: { 0: { pulseUsed: true } } }) });
  entrar(gastado);
  ok("una vez gastado no vuelve a ofrecerse", !existe(gastado, '[data-action="pulse-open"]'));

  const sinMazo = boot({ [CLAVE]: partida({ ...base, deck: [] }) });
  entrar(sinMazo);
  ok("sin cartas que sacar tampoco", !existe(sinMazo, '[data-action="pulse-open"]'));
}

console.log("\nPulso acertado");
{
  const w = boot({ [CLAVE]: partida({ manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25] }) });
  const antes = inventario(w);
  entrar(w);
  click(w, '[data-action="pulse-open"]');
  ok("se puede elegir a quién retar", existe(w, '[data-action="pulse-target"]'));
  click(w, '[data-action="pulse-target"]');
  const enJuego = estado(w);
  ok("el Pulso queda marcado como gastado en cuanto se lanza", enJuego.players[0].pulseUsed === true);
  ok("la carta del reto sale del mazo, no de la mano", enJuego.pulseTurn.cardId === 20 && !enJuego.players[0].hand.includes(20));
  ok("la mano propia no se puede jugar durante el Pulso", !existe(w, '[data-action="select-card"]'));

  // 1478 (id 20) va entre 1212 (id 15) y 1492 (id 21): el hueco del medio.
  colocar(w, 1);
  const s = estado(w);
  ok("la carta acertada se queda en la línea", s.timeline.includes(20));
  ok("quien reta se queda con una carta menos", s.players[0].hand.length === 1);
  ok("el rival se lleva una carta más", s.players[1].hand.length === 3);
  ok("y es justo la que salió de la mano de quien retó", s.players[1].hand.some(id => [1, 2].includes(id)));
  ok("el rival queda protegido esta ronda", s.players[1].shieldRound === s.round);
  ok("se avisa a quien la recibe", s.pulseGift && s.pulseGift.to === 2);
  const despues = inventario(w);
  ok(`ni se crean ni se pierden cartas (${antes.total} → ${despues.total})`, despues.total === antes.total);
  ok("y ninguna se duplica", despues.unicas === despues.total);
}

console.log("\nPulso fallado");
{
  const w = boot({ [CLAVE]: partida({ manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25] }) });
  const antes = inventario(w);
  entrar(w);
  click(w, '[data-action="pulse-open"]');
  click(w, '[data-action="pulse-target"]');
  // A propósito al principio de la línea: 1478 no va antes de 1212.
  colocar(w, 0);
  const s = estado(w);
  ok("la carta fallada no entra en la línea", !s.timeline.includes(20));
  ok("va al descarte", s.discard.includes(20));
  ok("y queda anotada para el repaso final", (s.failed || []).includes(20));
  ok("quien falla roba una carta", s.players[0].hand.length === 3);
  // Lo que impide que un jugador ya sin opciones regale la partida fallando aposta.
  ok("el rival se queda exactamente como estaba", s.players[1].hand.length === 2);
  ok("y sin escudo, porque no ha recibido nada", s.players[1].shieldRound !== s.round);
  const despues = inventario(w);
  ok(`ni se crean ni se pierden cartas (${antes.total} → ${despues.total})`, despues.total === antes.total);
  ok("y ninguna se duplica", despues.unicas === despues.total);
}

console.log("\nA quién se puede retar");
{
  // J2 ya recibió una carta esta ronda; J3 no.
  const w = boot({ [CLAVE]: partida({
    manos: [[1, 2], [3, 4], [5, 6]], timeline: [15, 21], deck: [20, 24, 25],
    players: { 1: { shieldRound: 1 } }
  }) });
  entrar(w);
  click(w, '[data-action="pulse-open"]');
  const objetivos = [...w.document.querySelectorAll('[data-action="pulse-target"]')].map(b => b.dataset.target);
  ok("quien ya recibió una carta esta ronda queda fuera", !objetivos.includes("2"));
  ok("los demás siguen disponibles", objetivos.includes("3"));
}

console.log("\nRetar a quien está a punto de ganar");
{
  // J2 se ha quedado sin cartas y espera ganar al final de la ronda.
  const w = boot({ [CLAVE]: partida({ manos: [[1, 2], []], timeline: [15, 21], deck: [20, 24, 25] }) });
  entrar(w);
  click(w, '[data-action="pulse-open"]');
  const objetivos = [...w.document.querySelectorAll('[data-action="pulse-target"]')].map(b => b.dataset.target);
  ok("se puede retar a quien está a cero cartas", objetivos.includes("2"));
  click(w, '[data-action="pulse-target"]');
  colocar(w, 1);
  const s = estado(w);
  ok("acertar le quita la victoria: ya no está a cero", s.players[1].hand.length === 1);
}

console.log("\nUna partida guardada de antes del Pulso");
{
  // Sin `pulse`, sin `pulseUsed` y sin `shieldRound`: tiene que abrirse igual.
  const vieja = JSON.stringify({
    mode: "history",
    players: [{ id: 1, name: "J1", hand: [1, 2] }, { id: 2, name: "J2", hand: [3, 4] }],
    deck: [20, 24], discard: [], timeline: [15, 21], current: 0, starter: 0,
    turnsInRound: 0, round: 1, winner: null, winners: null
  });
  const w = boot({ [CLAVE]: vieja });
  entrar(w);
  ok("la partida sigue jugándose", existe(w, '[data-action="select-card"]'));
  ok("y sin Pulso, que no existía cuando se guardó", !existe(w, '[data-action="pulse-open"]'));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
