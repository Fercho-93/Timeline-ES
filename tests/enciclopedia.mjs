// La enciclopedia: filtrado puro (CT.Enciclopedia) y la pantalla que lo usa, sobre el
// DOM real de index.html, igual que el resto de pantallas del juego.
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
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const escribir = (w, sel, valor) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.value = valor;
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
};
const elegir = (w, sel, valor) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.value = valor;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;

console.log("\nFiltrado puro (CT.Enciclopedia)");
{
  const w = boot();
  const todas = w.CONTINUUM.Enciclopedia.filterCards("history", {});
  ok("sin filtro devuelve las 167 cartas", todas.length === 167);
  const ordenado = todas.every((card, i) => i === 0 || card.year >= todas[i - 1].year);
  ok("el orden es ascendente por el eje del mazo", ordenado);

  const conAcento = w.CONTINUUM.Enciclopedia.filterCards("history", { query: "Córdoba" });
  const sinAcento = w.CONTINUUM.Enciclopedia.filterCards("history", { query: "cordoba" });
  ok("la búsqueda encuentra resultados", conAcento.length > 0);
  ok("la búsqueda ignora tildes y mayúsculas", sinAcento.length === conAcento.length);
  ok("todos los resultados mencionan Córdoba", conAcento.every(c => `${c.title} ${c.detail}`.includes("Córdoba")));

  const sinNada = w.CONTINUUM.Enciclopedia.filterCards("history", { query: "esto-no-existe-en-ningun-hecho-xyz" });
  ok("una búsqueda sin coincidencias no rompe nada", sinNada.length === 0);
  ok("el estado vacío se indica en el resultado", /Ninguna carta coincide/.test(w.CONTINUUM.Enciclopedia.resultsMarkup("history", sinNada)));

  const bandas = w.CONTINUUM.Enciclopedia.bands("history");
  ok("history tiene sus propias bandas", bandas.length > 0 && bandas[0].key === "antigua");
  const primeraBanda = w.CONTINUUM.Enciclopedia.filterCards("history", { band: bandas[0].key });
  ok("filtrar por banda narrows el resultado", primeraBanda.length > 0 && primeraBanda.length < todas.length);
  ok("toda carta filtrada pertenece a esa banda", primeraBanda.every(c => w.CONTINUUM.eraForCard("history", c).key === bandas[0].key));

  const conFuente = w.ANIMAL_WEIGHT_CARDS.find(c => c.source);
  ok("hay una carta con fuente en Peso de animales", !!conFuente);
  const markup = w.CONTINUUM.Enciclopedia.cardMarkup("animals", conFuente);
  ok("la carta con fuente enlaza a esa fuente", markup.includes(`href="${conFuente.source}"`));
  const sinFuente = w.CONTINUUM.Enciclopedia.cardMarkup("history", w.HISTORY_CARDS[0]);
  ok("una carta sin fuente no inventa un enlace", !sinFuente.includes("enc-source"));
}

console.log("\nSe entra desde la portada");
{
  const w = boot();
  ok("la portada ofrece la enciclopedia", existe(w, '[data-action="enciclopedia"]'));
  click(w, '[data-action="enciclopedia"]');
  ok("se abre con el mazo elegido en la portada (Historia de España)", /Historia de España/.test(texto(w)));
  ok("aparece el selector de mazo", existe(w, "#enc-mode-select"));
  ok("aparece el buscador", existe(w, "#enc-search-input"));
  ok("aparecen las bandas como filtro", w.document.querySelectorAll(".band-chip").length > 1);
  ok("se listan las 167 cartas del mazo", w.document.querySelectorAll("#enc-results .timeline-card").length === 167);
  ok("cada carta enseña su valor ya revelado", /class="year"/.test(w.document.getElementById("enc-results").innerHTML));
}

console.log("\nCambiar de mazo desde el desplegable");
{
  const w = boot();
  click(w, '[data-action="enciclopedia"]');
  elegir(w, "#enc-mode-select", "movies");
  ok("el título cambia al mazo elegido", /Estrenos de cine/.test(texto(w)));
  ok("se listan las 87 películas", w.document.querySelectorAll("#enc-results .timeline-card").length === 87);
}

console.log("\nBuscar sin perder el campo ni el foco");
{
  const w = boot();
  click(w, '[data-action="enciclopedia"]');
  const antes = w.document.getElementById("enc-search-input");
  antes.focus();
  escribir(w, "#enc-search-input", "cordoba");
  const despues = w.document.getElementById("enc-search-input");
  ok("escribir en el buscador no destruye el campo", antes === despues);
  ok("el foco se conserva en el campo mientras se escribe", w.document.activeElement === despues);
  const resultados = w.document.querySelectorAll("#enc-results .timeline-card").length;
  ok("la búsqueda reduce los resultados", resultados > 0 && resultados < 167);
  ok("el contador de resultados se actualiza", new RegExp(`${resultados} de 167`).test(w.document.getElementById("enc-count").textContent));

  escribir(w, "#enc-search-input", "esto-no-existe-en-ningun-hecho-xyz");
  ok("una búsqueda sin resultados muestra el estado vacío", /Ninguna carta coincide/.test(w.document.getElementById("enc-results").textContent));
}

console.log("\nFiltrar por banda desde la pantalla");
{
  const w = boot();
  click(w, '[data-action="enciclopedia"]');
  const total = w.document.querySelectorAll("#enc-results .timeline-card").length;
  const chip = w.document.querySelector(".band-chip:not(#enc-band-all)");
  const clave = chip.dataset.band;
  click(w, `#enc-band-${clave}`);
  ok("la banda elegida queda marcada", w.document.getElementById(`enc-band-${clave}`).getAttribute("aria-pressed") === "true");
  const filtrado = w.document.querySelectorAll("#enc-results .timeline-card").length;
  ok("el filtro de banda reduce los resultados", filtrado > 0 && filtrado < total);
  click(w, "#enc-band-all");
  ok("volver a «Todas» recupera el mazo entero", w.document.querySelectorAll("#enc-results .timeline-card").length === total);
}

console.log("\nSin entrada desde dentro de una partida");
{
  const w = boot();
  click(w, '[data-action="setup"]');
  click(w, '[data-action="start"]');
  ok("no hay enciclopedia en la pantalla de pasar el móvil", !existe(w, '[data-action="enciclopedia"]'));
  click(w, '[data-action="ready"]');
  ok("no hay enciclopedia en la partida local", !existe(w, '[data-action="enciclopedia"]'));
}
{
  const w = boot();
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  ok("no hay enciclopedia en el solitario", !existe(w, '[data-action="enciclopedia"]'));
}
{
  // online.js no se puede ejecutar en Node (carga Firebase desde una CDN), así que se
  // comprueba en su propio texto que ninguna cabecera de sala ofrece la enciclopedia.
  const online = read("online.js");
  ok("no hay enciclopedia en ninguna pantalla de varios móviles", !online.includes('data-action="enciclopedia"'));
}

console.log("\nEl repaso enlaza con la enciclopedia");
{
  const w = boot();
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  const cards = new Map(w.HISTORY_CARDS.map(c => [c.id, c]));
  let vueltas = 0;
  while (!/Se acabaron las vidas|Reto completado/.test(texto(w)) && vueltas++ < 400) {
    const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    const años = estado.timeline.map(id => cards.get(id).year);
    let index = años.findIndex(y => y > cards.get(estado.current).year);
    if (index < 0) index = años.length;
    const equivocado = index === 0 ? años.length : 0; // fallo deliberado
    w.document.querySelectorAll('[data-action="solo-place"]')[equivocado].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  ok("la partida en solitario termina", /Se acabaron las vidas|Reto completado/.test(texto(w)));
  ok("hay algo que repasar", existe(w, '[data-action="review-solo"]'));
  click(w, '[data-action="review-solo"]');
  const boton = w.document.querySelector('[data-action="enc-view"]');
  ok("cada carta fallada ofrece ir a la enciclopedia", !!boton);
  const cardId = boton.dataset.id;
  const cardMode = boton.dataset.mode;
  click(w, '[data-action="enc-view"]');
  ok("la enciclopedia abre en el mazo de la carta fallada", w.document.getElementById("enc-mode-select").value === cardMode);
  const carta = w.document.querySelector(`[data-enc-card="${cardId}"]`);
  ok("la carta fallada aparece destacada", !!carta && carta.classList.contains("enc-card-highlight"));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
