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
  click(w, '[data-format="multi"]');
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

// La tabla vive en modes.js —compartida con online.js—, no en app.js.
const modesSource = read("modes.js");
const animalMapBlock = (modesSource.match(/const ANIMAL_ART_BY_ID = \{([\s\S]*?)\};/) || [])[1] || "";
const artById = new Map([...animalMapBlock.matchAll(/(\d+): "([^"]+)"/g)].map(match => [Number(match[1]), match[2]]));
const weightCardIds = [...read("animals.js").matchAll(/\{\s*id:\s*(\d+),/g)].map(match => Number(match[1]));
const lifespanCardIds = [...read("lifespan.js").matchAll(/\{\s*id:\s*(\d+),/g)].map(match => Number(match[1]));
const speedCardIds = [...read("speed.js").matchAll(/\{\s*id:\s*(\d+),/g)].map(match => Number(match[1]));
const illustratedCardIds = [...weightCardIds, ...lifespanCardIds, ...speedCardIds];
check("cada carta de peso tiene una ilustración propia", weightCardIds.every(id => artById.has(id)));
check("cada carta de longevidad tiene una ilustración propia", lifespanCardIds.every(id => artById.has(id)));
check("cada carta de velocidad tiene una ilustración propia", speedCardIds.every(id => artById.has(id)));
check("no hay ilustraciones asignadas a cartas inexistentes", [...artById.keys()].every(id => illustratedCardIds.includes(id)));
check("cada carta usa un archivo WebP existente", illustratedCardIds.every(id => fs.existsSync(path.join(root, "assets", "animal-cards", `${artById.get(id)}.webp`))));
check("las ilustraciones móviles no superan 100 KB", illustratedCardIds.every(id => fs.statSync(path.join(root, "assets", "animal-cards", `${artById.get(id)}.webp`)).size <= 100_000));
const styles = read("styles.css");
const placedAnimalArt = (styles.match(/\.animal-timeline-card \.animal-card-art\s*\{([\s\S]*?)\}/) || [])[1] || "";
const embeddedAnimalCard = (styles.match(/\.timeline \.animal-timeline-card \.card-visual\s*\{([\s\S]*?)\}/) || [])[1] || "";
const embeddedAnimalContent = (styles.match(/\.timeline \.animal-timeline-card \.card-content\s*\{([\s\S]*?)\}/) || [])[1] || "";
check("la ilustración cubre su panel sin franjas ni bordes interiores", /object-fit:\s*cover/.test(placedAnimalArt));
// El panel de la imagen y el bloque de texto van uno debajo del otro (sin `position: absolute`
// superponiéndolos): así un título largo nunca tapa el dibujo, solo alarga la carta.
check("la ilustración colocada no queda tapada por el título ni el resultado", !/position:\s*absolute/.test(embeddedAnimalCard) && !/position:\s*absolute/.test(embeddedAnimalContent));

// `cover` sin franjas tiene un precio: lo que no cabe en el panel se recorta. Mientras el
// panel conserve la proporción de las láminas no se recorta nada; con un panel apaisado
// llegó a comerse el 43% del alto de cada escena. Se comprueban las dos mitades del trato:
// que el CSS mantenga la proporción y que las láminas sigan siendo las que la justifican.
const cabecera = file => {
  const d = fs.readFileSync(file).subarray(0, 40);
  if (d.subarray(0, 4).toString() !== "RIFF" || d.subarray(8, 12).toString() !== "WEBP") return null;
  const tipo = d.subarray(12, 16).toString();
  if (tipo === "VP8X") return [d.readUIntLE(24, 3) + 1, d.readUIntLE(27, 3) + 1];
  if (tipo === "VP8 ") return [d.readUInt16LE(26) & 0x3fff, d.readUInt16LE(28) & 0x3fff];
  if (tipo === "VP8L") { const b = d.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
  return null;
};
const medidas = illustratedCardIds.map(id => cabecera(path.join(root, "assets", "animal-cards", `${artById.get(id)}.webp`)));
check("el panel de la lámina conserva la proporción de los archivos", /aspect-ratio:\s*2\s*\/\s*3/.test(embeddedAnimalCard));
check("todas las láminas mantienen esa proporción 2:3", medidas.every(m => m && Math.abs(m[0] / m[1] - 2 / 3) < 0.01));

console.log(`\n${failures} fallos`);
process.exit(failures ? 1 : 0);
