// Integridad de los mazos. Estas pruebas no verifican la verdad de una afirmación.
// La dificultad de la selección nunca justifica modificar un dato documentado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
for (const archivo of ["cards.js", "movies.js", "music.js", "videogames.js", "animals.js", "lifespan.js", "speed.js", "inventos.js", "mundo.js", "astronomy.js", "medicine.js", "countries.js", "population.js", "distances.js", "modes.js"]) {
  new Function(fs.readFileSync(path.join(REPO, archivo), "utf8")).call(globalThis);
}
const { HISTORY_CARDS, MOVIE_CARDS, MUSIC_CARDS, VIDEOGAME_CARDS, ANIMAL_WEIGHT_CARDS, ANIMAL_LIFESPAN_CARDS, ANIMAL_SPEED_CARDS, INVENTION_CARDS, WORLD_CARDS, ASTRONOMY_CARDS, MEDICINE_CARDS, COUNTRY_CARDS, POPULATION_CARDS, CITY_DISTANCE_CARDS } = globalThis.window;
const CT = globalThis.window.CONTINUUM;
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function comunes(nombre, mazo, valor) {
  console.log(`\n${nombre}`);
  ok(`${mazo.length} cartas con identificador único`, new Set(mazo.map(c => c.id)).size === mazo.length);
  ok("títulos sin repetir", new Set(mazo.map(c => c.title)).size === mazo.length);
  ok("ninguna carta sin título, explicación o valor", mazo.every(c => c.title && c.detail && Number.isFinite(valor(c))));
  ok("suficientes cartas para nueve jugadores", mazo.length >= 9 * 4 + 2);
}

comunes("Estrenos de cine", MOVIE_CARDS, c => c.year);
ok("cada año aparece una sola vez", new Set(MOVIE_CARDS.map(c => c.year)).size === MOVIE_CARDS.length);

function fechadasDensas(nombre, mazo) {
  comunes(nombre, mazo, c => c.year);
  ok("cada año aparece una sola vez", new Set(mazo.map(c => c.year)).size === mazo.length);
}

// En mazos contemporáneos hay décadas repletas de hitos imprescindibles. Se conserva
// el año único como decisión de selección, pero no se impone el espaciado pensado para
// relatos de miles de años.
fechadasDensas("Hitos de la música", MUSIC_CARDS);
fechadasDensas("Historia de los videojuegos", VIDEOGAME_CARDS);
fechadasDensas("Astronomía y espacio", ASTRONOMY_CARDS);
fechadasDensas("Historia de la medicina", MEDICINE_CARDS);

// Las fechas únicas y su distribución son criterios editoriales de estos mazos.
// Los empates reales se aceptan en ambos órdenes por los motores del juego.
function fechadas(nombre, mazo, { unicos = true } = {}) {
  comunes(nombre, mazo, c => c.year);
  if (unicos) ok("cada año aparece una sola vez", new Set(mazo.map(c => c.year)).size === mazo.length);
  const orden = [...mazo].sort((a, b) => a.year - b.year);
  const pegados = orden.filter((card, i) => i && card.year - orden[i - 1].year === 1).length;
  ok(`pocos pares a un año de diferencia (${pegados} de ${orden.length - 1})`, pegados <= orden.length / 10);
}

fechadas("Historia de España", HISTORY_CARDS, { unicos: false });
fechadas("Inventos y descubrimientos", INVENTION_CARDS);
fechadas("Historia mundial", WORLD_CARDS);

// El 8 % se conserva como criterio de selección de geografía. En animales se
// permiten proximidad y empates documentados; nunca se retocan cifras para separarlas.
function separadas(nombre, mazo, unidad, { margen = true } = {}) {
  comunes(nombre, mazo, c => c.value);
  const orden = [...mazo].sort((a, b) => b.value - a.value);
  let peor = { salto: Infinity, par: "" };
  orden.forEach((card, i) => {
    if (!i) return;
    const salto = orden[i - 1].value / card.value;
    if (salto < peor.salto) peor = { salto, par: `${orden[i - 1].title} y ${card.title}` };
  });
  if (margen) {
    ok(`ningún par a menos del 8% (el más justo: ${peor.par}, ${((peor.salto - 1) * 100).toFixed(0)}%)`, peor.salto >= 1.08);
    ok(`${unidad} sin repetir`, new Set(mazo.map(c => c.value)).size === mazo.length);
  }
  ok(`${unidad} siempre positivas`, mazo.every(c => c.value > 0));
}

separadas("Superficie de países", COUNTRY_CARDS, "superficies");
separadas("Población de países", POPULATION_CARDS, "poblaciones");
separadas("Peso de animales", ANIMAL_WEIGHT_CARDS, "pesos", { margen: false });
separadas("Longevidad de animales", ANIMAL_LIFESPAN_CARDS, "longevidades", { margen: false });
separadas("Velocidad de animales", ANIMAL_SPEED_CARDS, "velocidades", { margen: false });
separadas("Distancias entre ciudades", CITY_DISTANCE_CARDS, "distancias");
ok("las poblaciones son números enteros de personas", POPULATION_CARDS.every(c => Number.isInteger(c.value)));

// Las cifras grandes se muestran redondeadas a millones. El redondeo solo vale si no
// borra el orden: dos cartas contiguas nunca pueden acabar enseñando la misma cifra, o
// la partida pediría adivinar en vez de razonar.
function redondeoLegible(nombre, modo, mazo) {
  console.log(`\n${nombre}, ya redondeado`);
  const orden = [...mazo].sort((a, b) => a.value - b.value);
  const textos = orden.map(card => CT.formatValue(modo, card));
  const repetido = textos.find((texto, i) => i && texto === textos[i - 1] && orden[i].value !== orden[i - 1].value);
  ok(`el formato no confunde valores distintos${repetido ? ` (${repetido})` : ""}`, !repetido);
  ok("la cifra más pequeña no se queda en cero", !/^0[.,]?0*\s/.test(textos[0]));
  const largo = textos.reduce((a, b) => b.length > a.length ? b : a);
  ok(`la cifra más larga cabe en una carta: «${largo}»`, largo.length <= 22);
}

redondeoLegible("Superficie de países", "countries", COUNTRY_CARDS);
redondeoLegible("Población de países", "population", POPULATION_CARDS);
redondeoLegible("Peso de animales", "animals", ANIMAL_WEIGHT_CARDS);
redondeoLegible("Esperanza de vida de animales", "lifespan", ANIMAL_LIFESPAN_CARDS);
redondeoLegible("Velocidad de animales", "speed", ANIMAL_SPEED_CARDS);
redondeoLegible("Distancias entre ciudades", "distances", CITY_DISTANCE_CARDS);

// Deuda de fuentes. El campo `source` es lo único que separa un dato contrastado de un
// número heredado, y el aviso «en revisión» solo cubre los que alguien llegó a marcar: la
// mayoría de las cartas sin fuente no avisan de nada. Aquí no se comprueba que un dato sea
// cierto —ninguna prueba puede—, sino que la deuda no crece a escondidas. Los techos bajan
// cuando se documenta una carta; subirlos exige explicar por qué en el mensaje del commit.
console.log("\nDeuda de fuentes en Naturaleza");
{
  const naturaleza = [...ANIMAL_WEIGHT_CARDS, ...ANIMAL_LIFESPAN_CARDS, ...ANIMAL_SPEED_CARDS];
  const enRevision = naturaleza.filter(card => card.reviewStatus === "pending");
  const mudas = naturaleza.filter(card => !card.source && card.reviewStatus !== "pending");
  const TECHO_MUDAS = 20;
  const TECHO_REVISION = 0;
  ok(`${mudas.length} cartas sin fuente y sin aviso (techo ${TECHO_MUDAS}, solo puede bajar)`, mudas.length <= TECHO_MUDAS);
  ok(`${enRevision.length} cartas en revisión (techo ${TECHO_REVISION}, solo puede bajar)`, enRevision.length <= TECHO_REVISION);
  ok("toda carta en revisión lo dice en su título", enRevision.every(card => /en revisión/.test(card.title)));
  ok("ninguna carta con fuente sigue marcada en revisión", !naturaleza.some(card => card.source && card.reviewStatus === "pending"));
}

const cronologicos = [HISTORY_CARDS, WORLD_CARDS, INVENTION_CARDS, MOVIE_CARDS, MUSIC_CARDS, VIDEOGAME_CARDS, ASTRONOMY_CARDS, MEDICINE_CARDS];
const todos = [...cronologicos.flat(), ...COUNTRY_CARDS, ...POPULATION_CARDS, ...ANIMAL_WEIGHT_CARDS, ...ANIMAL_LIFESPAN_CARDS, ...ANIMAL_SPEED_CARDS, ...CITY_DISTANCE_CARDS];
console.log("\nEntre mazos");
ok("los identificadores no chocan entre modalidades", new Set(todos.map(c => c.id)).size === todos.length);

// La Gran mezcla no es un mazo propio: es la concatenación de todos los mazos con
// eje del tiempo, así que no le pide nada nuevo salvo que la concatenación en sí no rompa
// nada. No se le exige el límite de pares pegados de `fechadas()`: mezclar tantos mazos ya
// separados a propósito produce muchas más coincidencias de año que cualquiera de ellos
// por separado, y esa dificultad extra es justo lo que la hace la modalidad más difícil.
console.log("\nGran mezcla");
const mixed = CT.cards("mixed");
ok(`${mixed.length} cartas, las de los mazos de tiempo juntas`, mixed.length === cronologicos.flat().length);
ok("identificadores únicos también mezclados", new Set(mixed.map(c => c.id)).size === mixed.length);

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
