// Modo solitario, reto diario y confirmación antes de colocar, sobre el DOM real.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot(almacen = {}) {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
  window.eval(read("cards.js"));
  window.eval(read("movies.js"));
  window.eval(read("countries.js"));
  window.eval(read("app.js"));
  return window;
}
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;

console.log("\nConfirmar antes de colocar");
{
  const w = boot();
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  const huecos = w.document.querySelectorAll('[data-action="solo-place"]');
  ok("la carta en juego se muestra con el valor oculto", /oculta/i.test(texto(w)));
  huecos[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok("tocar un hueco todavía no coloca la carta", !existe(w, ".modal"));
  ok("aparece la confirmación", existe(w, '[data-action="confirm-place"]'));
  click(w, '[data-action="cancel-place"]');
  ok("cancelar deja la partida como estaba", !existe(w, '[data-action="confirm-place"]') && !existe(w, ".modal"));
  click(w, '[data-action="solo-place"]');
  click(w, '[data-action="confirm-place"]');
  ok("al confirmar se revela la carta", existe(w, ".modal") && /class="year"/.test(w.document.querySelector(".modal").innerHTML));
}

console.log("\nPartida libre");
{
  const w = boot();
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  const cards = new Map([...w.HISTORY_CARDS].map(c => [c.id, c]));
  let vueltas = 0;
  while (!/Se acabaron las vidas|Reto completado/.test(texto(w)) && vueltas++ < 400) {
    const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    const años = estado.timeline.map(id => cards.get(id).year);
    let index = años.findIndex(y => y > cards.get(estado.current).year);
    if (index < 0) index = años.length;
    if (vueltas % 3 === 0) index = index === 0 ? años.length : 0; // fallo a propósito
    w.document.querySelectorAll('[data-action="solo-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    const vidas = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1")).lives;
    if (vidas === 0) ok("la partida se acaba al perder las tres vidas", true);
    click(w, '[data-action="solo-next"]');
  }
  ok("la partida libre termina sola", /Se acabaron las vidas|Reto completado/.test(texto(w)));
  const marcas = JSON.parse(w.localStorage.getItem("hilo-retos-v1"));
  ok("se guarda la mejor marca", marcas && marcas.history && marcas.history.best > 0);
}

console.log("\nReto diario");
{
  const uno = boot();
  click(uno, '[data-action="solo"]');
  click(uno, '[data-action="start-free"]');
  const otro = boot();
  click(otro, '[data-action="solo"]');
  click(otro, '[data-action="start-daily"]');
  const tercero = boot();
  click(tercero, '[data-action="solo"]');
  click(tercero, '[data-action="start-daily"]');
  const a = JSON.parse(otro.localStorage.getItem("hilo-solo-history-v1"));
  const b = JSON.parse(tercero.localStorage.getItem("hilo-solo-history-v1"));
  ok("dos móviles reciben hoy las mismas cartas", JSON.stringify([a.current, ...a.deck, ...a.timeline]) === JSON.stringify([b.current, ...b.deck, ...b.timeline]));
  ok("el reto reparte 15 cartas por colocar", a.total === 15 && a.deck.length + 1 === 15);
  const libre = JSON.parse(uno.localStorage.getItem("hilo-solo-history-v1"));
  ok("la partida libre usa el mazo entero", libre.deck.length + 2 === uno.HISTORY_CARDS.length);

  // Terminar el reto de hoy y comprobar que no se puede repetir.
  const w = tercero;
  const cards = new Map([...w.HISTORY_CARDS].map(c => [c.id, c]));
  let vueltas = 0;
  while (!/Reto completado|Se acabaron las vidas/.test(texto(w)) && vueltas++ < 60) {
    const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    const años = estado.timeline.map(id => cards.get(id).year);
    let index = años.findIndex(y => y > cards.get(estado.current).year);
    if (index < 0) index = años.length;
    w.document.querySelectorAll('[data-action="solo-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  ok("jugando bien se completa el reto entero", /Reto completado/.test(texto(w)));
  const marcas = JSON.parse(w.localStorage.getItem("hilo-retos-v1")).history;
  ok("cuenta un día de racha", marcas.streak === 1);
  ok("guarda el resultado del día", Object.values(marcas.days)[0].hits === 15);
  click(w, '[data-action="solo"]');
  ok("el reto no se puede repetir el mismo día", /ya lo has jugado/i.test(texto(w)) && !existe(w, '[data-action="start-daily"]'));
}

console.log("\nRacha de días");
{
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const marcas = { history: { best: 3, streak: 4, lastDay: ayer.toLocaleDateString("sv-SE"), days: {} } };
  const w = boot({ "hilo-retos-v1": JSON.stringify(marcas) });
  click(w, '[data-action="solo"]');
  ok("la portada de solitario muestra la racha", /4/.test(w.document.querySelector(".solo-stats").textContent));
  click(w, '[data-action="start-daily"]');
  const cards = new Map([...w.HISTORY_CARDS].map(c => [c.id, c]));
  let vueltas = 0;
  while (!/Reto completado|Se acabaron las vidas/.test(texto(w)) && vueltas++ < 60) {
    const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    const años = estado.timeline.map(id => cards.get(id).year);
    let index = años.findIndex(y => y > cards.get(estado.current).year);
    if (index < 0) index = años.length;
    w.document.querySelectorAll('[data-action="solo-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  ok("jugar ayer y hoy encadena la racha", JSON.parse(w.localStorage.getItem("hilo-retos-v1")).history.streak === 5);
}

console.log("\nModalidad de países");
{
  const w = boot();
  click(w, '[data-mode="countries"]');
  ok("la portada anuncia las 59 cartas de países", /59 países/.test(texto(w)));
  const portada = w.document.querySelector(".hero-art").outerHTML;
  ok("la carátula es la del globo, no la del cine", /hero-globe/.test(portada) && !/🎬|film-strip/.test(portada));
  ok("el sello no habla de estrenos", /países/.test(portada) && !/estrenos/i.test(portada));
  ok("el titular cambia al eje de tamaño", /más grande/i.test(texto(w)));
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  ok("la carta oculta la superficie, no la fecha", /superficie oculta/i.test(texto(w)));
  const estado = JSON.parse(w.localStorage.getItem("hilo-solo-countries-v1"));
  const cards = new Map(w.COUNTRY_CARDS.map(c => [c.id, c]));
  // La línea va de menor a mayor: un país más grande que el de la línea va DESPUÉS.
  const enLinea = cards.get(estado.timeline[0]);
  const enMano = cards.get(estado.current);
  const correcto = enMano.value > enLinea.value ? 1 : 0;
  w.document.querySelectorAll('[data-action="solo-place"]')[correcto].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  click(w, '[data-action="confirm-place"]');
  ok("ordena de menor a mayor superficie", /Bien colocado/.test(w.document.querySelector(".modal").textContent));
  ok("la superficie se muestra en km²", /km²/.test(w.document.querySelector(".modal").textContent));
}

console.log("\nSan Marino y Suiza, de menor a mayor");
{
  const dia = new Date().toLocaleDateString("sv-SE");
  const estado = { kind: "free", mode: "countries", day: dia, deck: [2001], timeline: [2040], current: 2056, lives: 3, hits: 0, played: 0, total: null, finished: false };
  const resultado = hueco => {
    const w = boot({ "hilo-selected-mode-v1": "countries", "hilo-solo-countries-v1": JSON.stringify(estado) });
    click(w, '[data-action="solo"]');
    click(w, '[data-action="resume-solo"]');
    w.document.querySelectorAll('[data-action="solo-place"]')[hueco].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    return /Bien colocado/.test(w.document.querySelector(".modal").textContent);
  };
  ok("San Marino (61 km²) va ANTES que Suiza (41.291 km²)", resultado(0));
  ok("y colocarlo después es un fallo", !resultado(1));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
