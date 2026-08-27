// Reglas de calidad de los seis mazos: sin cartas repetidas, sin huecos y, sobre todo,
// sin parejas tan pegadas que colocarlas bien sea cuestión de suerte.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
for (const archivo of ["cards.js", "movies.js", "inventos.js", "mundo.js", "countries.js", "population.js", "modes.js"]) {
  new Function(fs.readFileSync(path.join(REPO, archivo), "utf8")).call(globalThis);
}
const { HISTORY_CARDS, MOVIE_CARDS, INVENTION_CARDS, WORLD_CARDS, COUNTRY_CARDS, POPULATION_CARDS } = globalThis.window;
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function comunes(nombre, mazo, valor) {
  console.log(`\n${nombre}`);
  ok(`${mazo.length} cartas con identificador único`, new Set(mazo.map(c => c.id)).size === mazo.length);
  ok("títulos sin repetir", new Set(mazo.map(c => c.title)).size === mazo.length);
  ok("ninguna carta sin título, explicación o valor", mazo.every(c => c.title && c.detail && Number.isFinite(valor(c))));
  ok("suficientes cartas para nueve jugadores", mazo.length >= 9 * 4 + 2);
}

comunes("Historia de España", HISTORY_CARDS, c => c.year);
comunes("Estrenos de cine", MOVIE_CARDS, c => c.year);
ok("cada año aparece una sola vez", new Set(MOVIE_CARDS.map(c => c.year)).size === MOVIE_CARDS.length);

// En los mazos nuevos del bloque de historia la fecha es el juego entero, así que no
// puede haber dos cartas del mismo año —serían una moneda al aire— ni demasiadas en
// años seguidos, que se razonan igual de mal.
function fechadas(nombre, mazo) {
  comunes(nombre, mazo, c => c.year);
  ok("cada año aparece una sola vez", new Set(mazo.map(c => c.year)).size === mazo.length);
  const orden = [...mazo].sort((a, b) => a.year - b.year);
  const pegados = orden.filter((card, i) => i && card.year - orden[i - 1].year <= 1).length;
  ok(`pocos pares en años seguidos (${pegados} de ${orden.length - 1})`, pegados <= orden.length / 10);
}

fechadas("Inventos y descubrimientos", INVENTION_CARDS);
fechadas("Historia mundial", WORLD_CARDS);

// En los mazos numéricos, dos cartas demasiado próximas no se razonan: se aciertan por
// suerte. El margen es el mismo para todos.
function separadas(nombre, mazo, unidad) {
  comunes(nombre, mazo, c => c.value);
  const orden = [...mazo].sort((a, b) => b.value - a.value);
  let peor = { salto: Infinity, par: "" };
  orden.forEach((card, i) => {
    if (!i) return;
    const salto = orden[i - 1].value / card.value;
    if (salto < peor.salto) peor = { salto, par: `${orden[i - 1].title} y ${card.title}` };
  });
  ok(`ningún par a menos del 8% (el más justo: ${peor.par}, ${((peor.salto - 1) * 100).toFixed(0)}%)`, peor.salto >= 1.08);
  ok(`${unidad} sin repetir`, new Set(mazo.map(c => c.value)).size === mazo.length);
  ok(`${unidad} siempre positivas`, mazo.every(c => c.value > 0));
}

separadas("Superficie de países", COUNTRY_CARDS, "superficies");
separadas("Población de países", POPULATION_CARDS, "poblaciones");
ok("las poblaciones son números enteros de personas", POPULATION_CARDS.every(c => Number.isInteger(c.value)));

// Las cifras grandes se muestran redondeadas a millones. El redondeo solo vale si no
// borra el orden: dos cartas contiguas nunca pueden acabar enseñando la misma cifra, o
// la partida pediría adivinar en vez de razonar.
function redondeoLegible(nombre, modo, mazo) {
  console.log(`\n${nombre}, ya redondeado`);
  const orden = [...mazo].sort((a, b) => a.value - b.value);
  const textos = orden.map(card => CT.formatValue(modo, card));
  const repetido = textos.find((texto, i) => i && texto === textos[i - 1]);
  ok(`ninguna cifra se repite tras redondear${repetido ? ` (${repetido})` : ""}`, !repetido);
  ok("la cifra más pequeña no se queda en cero", !/^0[.,]?0*\s/.test(textos[0]));
  const largo = textos.reduce((a, b) => b.length > a.length ? b : a);
  ok(`la cifra más larga cabe en una carta: «${largo}»`, largo.length <= 22);
}

const CT = globalThis.window.CONTINUUM;
redondeoLegible("Superficie de países", "countries", COUNTRY_CARDS);
redondeoLegible("Población de países", "population", POPULATION_CARDS);

const todos = [...HISTORY_CARDS, ...MOVIE_CARDS, ...INVENTION_CARDS, ...WORLD_CARDS, ...COUNTRY_CARDS, ...POPULATION_CARDS];
console.log("\nEntre mazos");
ok("los identificadores no chocan entre modalidades", new Set(todos.map(c => c.id)).size === todos.length);

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
