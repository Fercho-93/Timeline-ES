// El Pulso: la jugada de una vez por partida que sustituye al turno y enfrenta a dos
// personas con la misma carta. Es la única jugada del juego que toca la mano de otra
// persona —y la única que se juega en dos mitades, una por cabeza—, así que lo que más se
// comprueba aquí son las cuatro salidas del duelo y que las cartas ni se creen ni se
// pierdan por el camino.
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
function partida({ manos, timeline, deck, pulse = true, pulsePower, ghost, round = 1, players: extra = {} }) {
  return JSON.stringify({
    mode: "history", pulse,
    players: manos.map((hand, i) => ({ id: i + 1, name: `J${i + 1}`, hand, pulseUsed: false, shieldRound: 0, ...(extra[i] || {}) })),
    deck, discard: [], timeline, current: 0, starter: 0, turnsInRound: 0, round,
    winner: null, winners: null, pulseTurn: null, pulseGift: null,
    ...(pulsePower ? { pulsePower } : {}), ...(ghost ? { ghost } : {})
  });
}

console.log("\nPulso como poder secreto");
{
  const base = { manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25],
    pulsePower: { distribution: 2, cards: [1], owners: ["1"], used: [] } };
  const owner = boot({ [CLAVE]: partida(base) }); entrar(owner);
  ok("solo el propietario ve la Carta Pulso", existe(owner, ".pulse-power"));
  ok("el poder no aumenta el contador de su mano", estado(owner).players[0].hand.length === 2);
  click(owner, '[data-action="pulse-open"]'); click(owner, '[data-action="pulse-target"]');
  ok("se consume al lanzarlo", estado(owner).pulsePower.used.includes("1"));

  const rival = boot({ [CLAVE]: partida({ ...base, pulsePower: { ...base.pulsePower, owners: ["2"] } }) }); entrar(rival);
  ok("el jugador que no lo tiene no ve ni puede lanzar Pulso", !existe(rival, '[data-action="pulse-open"]'));

  const una = boot({ [CLAVE]: partida({ ...base, manos: [[1], [3, 4]] }) }); entrar(una);
  ok("con una carta el poder se ve, pero queda bloqueado", existe(una, ".pulse-power:disabled"));

  const ganado = partida({ ...base, manos: [[], [3, 4]], pulsePower: { distribution: 2, cards: [1], owners: ["1"], used: [] } });
  const guardado = JSON.parse(ganado);guardado.current=1;guardado.turnsInRound=1;
  const w = boot({ [CLAVE]: JSON.stringify(guardado) });entrar(w);
  const card=w.HISTORY_CARDS.find(c=>c.id===3),board=estado(w).timeline.map(id=>w.HISTORY_CARDS.find(c=>c.id===id));
  const at=w.CONTINUUM.correctIndex("history",board,card);
  w.document.querySelector('[data-action="select-card"]').click();w.document.querySelectorAll('[data-action="place"]')[at].click();click(w,'[data-action="confirm-place"]');click(w,'[data-action="finish-turn"]');
  ok("guardar Pulso sin utilizar no impide ganar", estado(w).winner === 1);
}

// Total de cartas repartidas por todas partes: tiene que ser invariante.
function inventario(w) {
  const s = estado(w);
  const todas = [...s.deck, ...s.discard, ...s.timeline, ...s.players.flatMap(p => p.hand), ...(s.pulseTurn ? [s.pulseTurn.cardId] : [])];
  return { total: todas.length, unicas: new Set(todas).size };
}

// La partida guardada solo ofrece «Continuar» dentro del menú de su propio mazo
// (`playMenu`), al que hay que llegar desplegando antes el bloque de Historia.
function entrar(w) {
  entrar2(w);
  click(w, '[data-action="ready"]');
}

// Lo mismo, pero sin recoger el móvil: un duelo a medias no vuelve a la pantalla de paso
// de un turno normal, así que ahí no hay ningún «Empezar mi turno» que tocar.
function entrar2(w) {
  click(w, '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  click(w, '[data-format="multi"]');
  click(w, '[data-action="continue"]');
}

// Coloca la carta del Pulso en el hueco pedido y confirma.
function colocar(w, index) {
  w.document.querySelectorAll('[data-action="pulse-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  click(w, '[data-action="confirm-place"]');
}

// El duelo entero: reta quien tiene el turno, pasa el móvil y defiende la otra persona.
// 1478 (id 20) va entre 1212 (id 15) y 1492 (id 21), así que el hueco 1 acierta y el 0 no.
const BIEN = 1, MAL = 0;
function duelo(w, huecoReto, huecoDefensa) {
  click(w, '[data-action="pulse-open"]');
  click(w, '[data-action="pulse-target"]');
  colocar(w, huecoReto);
  click(w, '[data-action="pulse-defend"]');
  colocar(w, huecoDefensa);
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

console.log("\nEl duelo: quien reta juega primero y no se resuelve nada hasta que defiende el otro");
{
  const w = boot({ [CLAVE]: partida({ manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25] }) });
  entrar(w);
  click(w, '[data-action="pulse-open"]');
  ok("se puede elegir a quién retar", existe(w, '[data-action="pulse-target"]'));
  click(w, '[data-action="pulse-target"]');
  const enJuego = estado(w);
  ok("el Pulso queda marcado como gastado en cuanto se lanza", enJuego.players[0].pulseUsed === true);
  ok("la carta del reto sale del mazo, no de la mano", enJuego.pulseTurn.cardId === 20 && !enJuego.players[0].hand.includes(20));
  ok("la carta que se pagaría queda apalabrada desde el principio", [1, 2].includes(enJuego.pulseTurn.giftId));
  ok("la mano propia no se puede jugar durante el duelo", !existe(w, '[data-action="select-card"]'));

  colocar(w, BIEN);
  const tras = estado(w);
  ok("colocar no resuelve nada todavía: el duelo sigue abierto", tras.pulseTurn !== null && tras.pulseTurn.stage === "pase");
  ok("ninguna mano ha cambiado a media jugada", tras.players[0].hand.length === 2 && tras.players[1].hand.length === 2);
  ok("la carta no ha entrado aún en la línea", !tras.timeline.includes(20));
  ok("se pide pasar el móvil a quien defiende", existe(w, '[data-action="pulse-defend"]') && /Pásale el móvil a\s*J2/.test(w.document.body.textContent));
  ok("y no se filtra dónde la ha puesto quien reta", !/pulse-place/.test(w.document.body.innerHTML));

  click(w, '[data-action="pulse-defend"]');
  ok("quien defiende coloca la misma carta", existe(w, '[data-action="pulse-place"]') && estado(w).pulseTurn.stage === "defensa");
  ok("y la línea que ve sigue sin la carta del duelo", !estado(w).timeline.includes(20));
}

console.log("\nLas cuatro salidas del duelo");
{
  const nueva = () => {
    const w = boot({ [CLAVE]: partida({ manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25] }) });
    entrar(w);
    return w;
  };

  const empate = nueva(); const antesEmpate = inventario(empate);
  duelo(empate, BIEN, BIEN);
  const e = estado(empate);
  ok("aciertan los dos: la carta se queda en la línea", e.timeline.includes(20));
  ok("y no cambia ninguna mano", e.players[0].hand.length === 2 && e.players[1].hand.length === 2);
  ok("defenderse bien no cuesta el escudo de la ronda", e.players[1].shieldRound !== e.round);
  ok(`ni se crean ni se pierden cartas (${antesEmpate.total} → ${inventario(empate).total})`, inventario(empate).total === antesEmpate.total);
  ok("y ninguna se duplica", inventario(empate).unicas === inventario(empate).total);

  const gana = nueva(); const antesGana = inventario(gana);
  duelo(gana, BIEN, MAL);
  const g = estado(gana);
  ok("solo acierta quien reta: la carta se queda en la línea", g.timeline.includes(20));
  ok("quien reta se queda con una carta menos", g.players[0].hand.length === 1);
  ok("quien falla la defensa se lleva una carta más", g.players[1].hand.length === 3);
  ok("y es justo la que se apalabró al lanzar el reto", g.players[1].hand.some(id => [1, 2].includes(id)));
  ok("quien la recibe queda protegido esta ronda", g.players[1].shieldRound === g.round);
  ok("se le avisa de la carta recibida", g.pulseGift && g.pulseGift.to === 2);
  ok(`ni se crean ni se pierden cartas (${antesGana.total} → ${inventario(gana).total})`, inventario(gana).total === antesGana.total);
  ok("y ninguna se duplica", inventario(gana).unicas === inventario(gana).total);

  const defiende = nueva(); const antesDefiende = inventario(defiende);
  duelo(defiende, MAL, BIEN);
  const d = estado(defiende);
  ok("solo acierta quien defiende: la carta entra en la línea igual", d.timeline.includes(20));
  ok("quien retó roba una por fallar", d.players[0].hand.length === 3);
  // Lo que impide que alguien ya sin opciones falle aposta para regalar la partida.
  ok("y quien se defiende no pierde ni gana nada", d.players[1].hand.length === 2);
  ok("defenderse no consume el escudo", d.players[1].shieldRound !== d.round);
  ok(`ni se crean ni se pierden cartas (${antesDefiende.total} → ${inventario(defiende).total})`, inventario(defiende).total === antesDefiende.total);
  ok("y ninguna se duplica", inventario(defiende).unicas === inventario(defiende).total);

  const nadie = nueva(); const antesNadie = inventario(nadie);
  duelo(nadie, MAL, MAL);
  const n = estado(nadie);
  ok("fallan los dos: la carta no entra en la línea", !n.timeline.includes(20));
  ok("va al descarte", n.discard.includes(20));
  ok("y queda anotada para el repaso final", (n.failed || []).includes(20));
  ok("quien lanzó el reto roba una", n.players[0].hand.length === 3);
  ok("quien defendió se queda como estaba", n.players[1].hand.length === 2 && n.players[1].shieldRound !== n.round);
  ok(`ni se crean ni se pierden cartas (${antesNadie.total} → ${inventario(nadie).total})`, inventario(nadie).total === antesNadie.total);
  ok("y ninguna se duplica", inventario(nadie).unicas === inventario(nadie).total);
}

console.log("\nUn duelo a medias sobrevive a cerrar la aplicación");
{
  const w = boot({ [CLAVE]: partida({ manos: [[1, 2], [3, 4]], timeline: [15, 21], deck: [20, 24, 25] }) });
  entrar(w);
  click(w, '[data-action="pulse-open"]');
  click(w, '[data-action="pulse-target"]');
  colocar(w, BIEN);
  const guardado = w.localStorage.getItem(CLAVE);

  const otra = boot({ [CLAVE]: guardado });
  entrar2(otra);
  ok("al volver se retoma en el paso del móvil, no en un turno nuevo", existe(otra, '[data-action="pulse-defend"]'));
  click(otra, '[data-action="pulse-defend"]');
  colocar(otra, MAL);
  const s = estado(otra);
  ok("y el duelo se resuelve con la jugada que ya estaba guardada", s.players[1].hand.length === 3 && s.timeline.includes(20));
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
  colocar(w, BIEN);
  click(w, '[data-action="pulse-defend"]');
  colocar(w, MAL);
  const s = estado(w);
  ok("ganar el duelo le quita la victoria: ya no está a cero", s.players[1].hand.length === 1);

  // Y defendiéndose bien la conserva, que es lo que hace que el reto sea un duelo.
  const salvado = boot({ [CLAVE]: partida({ manos: [[1, 2], []], timeline: [15, 21], deck: [20, 24, 25] }) });
  entrar(salvado);
  duelo(salvado, BIEN, BIEN);
  ok("defenderse bien conserva la victoria", estado(salvado).players[1].hand.length === 0);
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

console.log("\nPulso con la última carta disponible");
for (const [reto, defensa] of [[1,1],[1,0],[0,1],[0,0]]) {
  const w = boot({ [CLAVE]: partida({ manos: [[1,2],[3,4]], timeline: [15,21], deck: [20] }) });
  entrar(w); const before = inventario(w);
  duelo(w, reto, defensa);
  const s = estado(w);
  ok("última carta: " + reto + "/" + defensa + " resuelve el Pulso", !s.pulseTurn && !!s.pendingResult);
  ok("conserva todas las cartas", inventario(w).total === before.total && inventario(w).unicas === before.total);
  if (!reto && defensa) {
    ok("no exige un robo imposible", s.players[0].hand.length === 2 && s.pendingResult.penaltySkipped);
    ok("explica que no quedan cartas", /agotados/.test(w.document.body.textContent));
  }
  w.close();
}
console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
