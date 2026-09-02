// Regresiones introducidas por cifras documentadas cercanas y empates reales.
// Se juega sobre el DOM y el motor local, sin reemplazar su comparación.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const scripts = [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let failures = 0;
function check(label, condition) {
  if (!condition) failures++;
  console.log(`  ${condition ? "ok" : "FALLA"} ${label}`);
}
function click(w, selector) {
  const element = w.document.querySelector(selector);
  if (!element) throw new Error(selector);
  element.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
}
function play(cardId, neighbourId, slot, expected) {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), {
    runScripts: "outside-only", url: "https://hilo.test/"
  });
  const w = dom.window;
  w.localStorage.setItem("hilo-selected-mode-v1", "speed");
  w.localStorage.setItem("hilo-game-speed-v1", JSON.stringify({
    mode: "speed", players: [{ id: 1, name: "Ana", hand: [cardId] }, { id: 2, name: "Bea", hand: [13017] }],
    timeline: [neighbourId], deck: [13018, 13019], discard: [], current: 0,
    starter: 0, turnsInRound: 0, round: 1, winner: null
  }));
  scripts.forEach(file => w.eval(read(file)));
  click(w, '[data-block="naturaleza"]');
  click(w, '[data-mode="speed"]');
  click(w, '[data-action="continue"]');
  click(w, '[data-action="ready"]');
  check("la mano no revela la velocidad", !w.document.querySelector('.hand-card .year'));
  click(w, `[data-action="select-card"][data-id="${cardId}"]`);
  click(w, `[data-action="place"][data-index="${slot}"]`);
  click(w, '[data-action="confirm-place"]');
  check(`${cardId} junto a ${neighbourId}, hueco ${slot}`, !!w.document.querySelector(".modal.success") === expected);
  const CT = w.CONTINUUM;
  const byId = id => w.ANIMAL_SPEED_CARDS.find(card => card.id === id);
  check("70 y 70,35 km/h se muestran diferentes", CT.formatValue("speed", byId(13020)) !== CT.formatValue("speed", byId(13021)));
  check("un empate real conserva la misma cifra", CT.formatValue("speed", byId(13007)) === CT.formatValue("speed", byId(13014)));
  check("12,8 kg no se redondean a un entero", CT.formatValue("animals", w.ANIMAL_WEIGHT_CARDS.find(card => card.id === 10013)) === "12,8 kg");
  for (const mode of ["animals", "lifespan", "speed"]) {
    check("los pendientes se avisan en título y explicación", CT.cards(mode).filter(c => c.reviewStatus === "pending").every(c => /en revisión/.test(c.title) && /pendiente de verificación/i.test(c.detail)));
  }
  dom.window.close();
}
console.log("\nReferencias animales: empates y proximidad");
play(13007, 13014, 0, true);
play(13007, 13014, 1, true);
play(13021, 13020, 0, false);
play(13021, 13020, 1, true);
console.log(`\n${failures} fallos`);
process.exit(failures ? 1 : 0);
