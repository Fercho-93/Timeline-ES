import {gameHtml} from './game-fixture.mjs';
// Modo solitario, reto diario y confirmación antes de colocar, sobre el DOM real.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// La colección y la competición viven ahora en «Jugar», no en la portada: desde la
// portada, se entra primero ahí. Devuelve la misma ventana para poder encadenarlo.
function irAJugar(w) { const d = w.document; if (!d.querySelector('[data-block], [data-action="competition-menu"]')) d.querySelector('[data-action="jugar"]')?.click(); return w; }


const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot(almacen = {}) {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
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
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;
const colocaHistoriaBien = w => {
  const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
  const cards = new Map([...w.HISTORY_CARDS].map(card => [card.id, card]));
  const at = w.CONTINUUM.correctIndex("history", estado.timeline.map(id => cards.get(id)), cards.get(estado.current));
  click(w, `[data-action="solo-place"][data-index="${at}"]`);
};

// El solitario, como cualquier otro formato, se elige ahora desde el menú de un mazo
// concreto (`playMenu`), al que se llega desplegando su bloque en la portada.
const abreMazo = (w, block, mode) => { click(irAJugar(w), `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); };

console.log("\nConfirmar antes de colocar");
{
  const w = boot();
  abreMazo(w, "historia", "history");
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
  ok("al confirmar se revela la carta", existe(w, ".modal") && !!w.document.querySelector(".modal .year"));
}

console.log("\nPartida libre");
{
  const w = boot();
  abreMazo(w, "historia", "history");
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

// El reto diario es uno para todo el mundo y se entra desde la portada: cada día sale
// un mazo, sorteado con la fecha, y de él las mismas cartas en todos los móviles.
const DIARIO = "continuum-reto-diario-partida-v2";
const estadoDiario = w => JSON.parse(w.localStorage.getItem(DIARIO));
const retoDiario = w => JSON.parse(w.localStorage.getItem("hilo-retos-v1") || "{}").retoDiario;
const colocaDiarioBien = w => {
  const estado = estadoDiario(w);
  const cards = new Map(w.CONTINUUM.cards(estado.mode).map(card => [card.id, card]));
  const at = w.CONTINUUM.correctIndex(estado.mode, estado.timeline.map(id => cards.get(id)), cards.get(estado.current));
  click(w, `[data-action="solo-place"][data-index="${at}"]`);
};
const juegaDiarioEntero = w => {
  let vueltas = 0;
  while (!/Reto completado|Se acabaron las vidas/.test(texto(w)) && vueltas++ < 60) {
    colocaDiarioBien(w);
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
};

console.log("\nReto diario");
{
  const uno = boot();
  abreMazo(uno, "historia", "history");
  click(uno, '[data-action="solo"]');
  click(uno, '[data-action="start-free"]');
  const libreAntes = uno.localStorage.getItem("hilo-solo-history-v1");
  click(uno, '[data-action="ui-back"]');
  click(uno, '[data-exit-confirm]');
  click(uno, '[data-action="home-top"]');
  ok("la portada ofrece el reto del día", existe(uno, '[data-action="daily-start"]'));
  click(uno, '[data-action="daily-start"]');
  ok("empezar el reto no pisa la partida libre a medias", uno.localStorage.getItem("hilo-solo-history-v1") === libreAntes);
  const otro = boot();
  click(otro, '[data-action="daily-start"]');
  const a = estadoDiario(uno), b = estadoDiario(otro);
  ok("dos móviles juegan hoy el mismo mazo", a.mode === b.mode);
  ok("y reciben las mismas cartas", JSON.stringify([a.current, ...a.deck, ...a.timeline]) === JSON.stringify([b.current, ...b.deck, ...b.timeline]));
  ok("el mazo sale del bote de gratuitos", uno.CONTINUUM.Cartera.diarios().includes(a.mode));
  ok("la portada no desvela el mazo de hoy", (() => { const w = boot(); const puerta = w.document.querySelector(".home-door-daily"); return puerta.querySelector("b").textContent === "Reto diario" && !puerta.textContent.includes(w.CONTINUUM.mode(a.mode).name); })());
  ok("el reto reparte 15 cartas por colocar", a.total === 15 && a.deck.length + 1 === 15);

  // Terminar el reto de hoy y comprobar que no se puede repetir.
  const w = otro;
  juegaDiarioEntero(w);
  ok("jugando bien se completa el reto entero", /Reto completado/.test(texto(w)));
  const marcas = retoDiario(w);
  ok("cuenta un día de racha", marcas.streak === 1);
  ok("guarda el resultado del día", Object.values(marcas.days)[0].hits === 15);
  click(w, '[data-action="home"]');
  ok("el reto no se puede repetir el mismo día", /15 de 15/.test(w.document.querySelector(".home-door-daily").textContent) && !existe(w, '[data-action="daily-start"]'));
  ok("una vez jugado, la portada dice qué mazo era", w.document.querySelector(".home-door-daily").textContent.includes(w.CONTINUUM.mode(a.mode).name));
  ok("y la portada ofrece compartir el resultado", existe(w, '[data-action="share-daily-home"]'));
}

console.log("\nRacha de días");
{
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const marcas = { retoDiario: { best: 3, streak: 4, lastDay: ayer.toLocaleDateString("sv-SE"), days: {} } };
  const w = boot({ "hilo-retos-v1": JSON.stringify(marcas) });
  ok("la portada muestra la racha", /4 días seguidos/.test(w.document.querySelector(".home-door-daily").textContent));
  click(w, '[data-action="daily-start"]');
  juegaDiarioEntero(w);
  ok("jugar ayer y hoy encadena la racha", retoDiario(w).streak === 5);
}

console.log("\nLas rachas del antiguo reto por mazo empiezan de cero");
{
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const dia = ayer.toLocaleDateString("sv-SE");
  const marcas = { history: { best: 7, streak: 9, lastDay: dia, days: { [dia]: { hits: 10, total: 15 } } } };
  const w = boot({ "hilo-retos-v1": JSON.stringify(marcas) });
  const tras = JSON.parse(w.localStorage.getItem("hilo-retos-v1"));
  ok("la racha y los días del mazo se borran", tras.history.streak === undefined && tras.history.days === undefined);
  ok("la mejor marca de la partida libre se conserva", tras.history.best === 7);
  ok("el reto nuevo empieza sin racha", tras.retoDiario.streak === 0 && /Empieza hoy tu racha/.test(w.document.querySelector(".home-door-daily").textContent));
}

console.log("\nReto diario que cruza la medianoche");
{
  const w = boot();
  click(w, '[data-action="daily-start"]');
  const diaInicio = estadoDiario(w).day;
  // El reloj avanza un día a mitad de partida, como si se terminara pasada la
  // medianoche: la partida ya había empezado con la fecha de antes.
  const RealDate = w.Date;
  class DateManana extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(RealDate.now() + 24 * 60 * 60 * 1000);
    }
    static now() { return RealDate.now() + 24 * 60 * 60 * 1000; }
  }
  w.Date = DateManana;
  juegaDiarioEntero(w);
  ok("el reto se completa aunque el reloj haya cambiado de día", /Reto completado/.test(texto(w)));
  const marcas = retoDiario(w);
  ok("convalida en el día en que se empezó, no en el que se terminó", Object.keys(marcas.days).includes(diaInicio));
  ok("cuenta como un día de racha", marcas.streak === 1);
}

console.log("\nSalir sin guardar");
{
  const w = boot();
  click(w, '[data-action="daily-start"]');
  colocaDiarioBien(w);
  click(w, '[data-action="confirm-place"]');
  click(w, '[data-action="solo-next"]');
  ok("hay progreso a medio reto", estadoDiario(w).hits > 0);
  click(w, '[data-action="solo-options"]');
  ok("el menú ofrece salir sin guardar", existe(w, '[data-action="abandon-solo"]'));
  click(w, '[data-action="abandon-solo"]');
  click(w, '[data-exit-confirm]');
  ok("no queda partida guardada", !w.localStorage.getItem(DIARIO));
  ok("el reto de hoy se puede volver a empezar", existe(w, '[data-action="daily-start"]'));
  const marcas = retoDiario(w);
  ok("no cuenta para las estadísticas ni la racha", !marcas || !marcas.days || !Object.keys(marcas.days).length);
}

console.log("\nSalir guardando y continuar el reto");
{
  const w = boot();
  click(w, '[data-action="daily-start"]');
  colocaDiarioBien(w);
  click(w, '[data-action="confirm-place"]');
  click(w, '[data-action="solo-next"]');
  click(w, '[data-action="ui-back"]');
  ok("el diálogo de salir ofrece también salir sin guardar", existe(w, '[data-exit-discard]'));
  click(w, '[data-exit-confirm]');
  ok("guardar y salir vuelve a la portada", w.document.getElementById("app").dataset.screen === "home");
  ok("la portada ofrece continuar el reto", /Continuar el reto/.test(w.document.querySelector(".home-door-daily").textContent));
  const antes = estadoDiario(w).hits;
  click(w, '[data-action="daily-start"]');
  ok("continuar recupera los aciertos", estadoDiario(w).hits === antes && antes > 0);
  click(w, '[data-action="ui-back"]');
  click(w, '[data-exit-discard]');
  ok("salir sin guardar desde la flecha no deja partida", !w.localStorage.getItem(DIARIO));
  ok("el reto de hoy se puede volver a empezar", existe(w, '[data-action="daily-start"]'));
}

console.log("\nBloque de geografía");
{
  const w = boot();
  click(irAJugar(w), '[data-block="geografia"]');
  ok("elegir el bloque selecciona su primer juego", /72 países/.test(texto(w)));
  ok("el bloque lista sus cuatro juegos", w.document.querySelectorAll(".game-row").length === 4);
  ok("los cuatro juegos del bloque aparecen por su nombre",
     /Superficie de países/.test(texto(w)) && /Población de países/.test(texto(w))
     && /Idiomas por hablantes nativos/.test(texto(w)) && /Distancias entre ciudades/.test(texto(w)));
  ok("la galería ofrece los seis bloques más Retos rápidos", w.document.querySelectorAll(".gallery-panel").length === 7);
  const portada = w.document.querySelector(".gallery-panel.active").outerHTML;
  // Las tres carátulas están siempre, pero solo la desplegada pide el tamaño grande.
  ok("la carátula desplegada es la de geografía, no otra",
    /hero-geography-700\.webp/.test(portada) && !/hero-(entertainment|science|nature|history)-700/.test(portada));
  ok("el rótulo es el del bloque de geografía", /Geografía/.test(portada) && !/Entretenimiento|Naturaleza|Ciencia|Historia/.test(portada));
  ok("el juego aparece listado bajo la carátula", /Superficie de países/.test(w.document.querySelector(".games").textContent));
  click(w, '[data-mode="population"]');
  ok("cambiar de juego dentro del bloque cambia el mazo", w.document.querySelector("h1")?.textContent === "Población de países");
  click(w, '[data-action="collection-back"]');
  click(w, '[data-mode="countries"]');
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
    abreMazo(w, "geografia", "countries");
    click(w, '[data-action="solo"]');
    click(w, '[data-action="resume-solo"]');
    w.document.querySelectorAll('[data-action="solo-place"]')[hueco].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    return /Bien colocado/.test(w.document.querySelector(".modal").textContent);
  };
  ok("San Marino (61 km²) va ANTES que Suiza (41.291 km²)", resultado(0));
  ok("y colocarlo después es un fallo", !resultado(1));
}

// El mapa de la línea: una tira de paradas para recorrer una línea que en un móvil no
// cabe ni de lejos. No coloca nada, solo lleva la vista.
console.log("\nEl mapa de la línea");
{
  const dia = new Date().toLocaleDateString("sv-SE");
  const conLinea = ids => {
    const estado = { kind: "free", mode: "history", day: dia, deck: [], timeline: ids, current: 100, lives: 3, hits: 0, played: 0, total: null, finished: false };
    const w = boot({ "hilo-solo-history-v1": JSON.stringify(estado) });
    abreMazo(w, "historia", "history");
    click(w, '[data-action="solo"]');
    click(w, '[data-action="resume-solo"]');
    return w;
  };

  const corta = conLinea([1, 2, 3, 4]);
  ok("el zoom está disponible también en líneas cortas", existe(corta, ".timeline-zoom"));

  const w = conLinea([1, 2, 3, 4, 5, 6, 7, 8]);
  ok("el minimapa se sustituye por zoom sobre las cartas reales", !existe(w, '.map-stop') && existe(w, '.timeline-zoom'));
  click(w, '[data-timeline-zoom="out"]');
  click(w, '[data-timeline-zoom="out"]');
  click(w, '[data-timeline-zoom="out"]');
  ok("se puede alejar hasta el 80%", w.document.querySelector('.timeline-zoom output').textContent === '80%');
  ok("alejar conserva las ocho cartas", w.document.querySelectorAll('.timeline .timeline-card').length === 8);
  click(w, '[data-action="solo-place"][data-index="8"]');
  ok("confirmar en el extremo vuelve a tamaño legible", w.document.querySelector('.timeline-zoom output').textContent === '100%' && w.document.querySelector('.slot-confirm').dataset.index === '8');
  click(w, '[data-action="cancel-place"]');
  click(w, '[data-timeline-zoom="out"]');
  const zoom = w.document.querySelector('[data-timeline-range]'); zoom.value = '1';
  zoom.dispatchEvent(new w.Event('input', {bubbles:true}));
  ok("tamaño normal restaura el 100%", w.document.querySelector('.timeline-zoom output').textContent === '100%');
}

// De Normal en adelante el tablero coloca cartas por su cuenta. Antes aparecían ya
// puestas y solo lo contaba un aviso de texto; ahora se ven llegar desde el centro hasta
// su sitio, que es lo que permite entender qué ha cambiado en la línea.
console.log("\nLas cartas que coloca el tablero se ven llegar");
{
  const w = boot({ "continuum-difficulty-v1": "normal" });
  const animaciones = [];
  // jsdom no maquetiza: sin una caja con medidas, no hay recorrido que calcular.
  w.Element.prototype.getBoundingClientRect = function () {
    return { left: 40, top: 60, width: 150, height: 220, right: 190, bottom: 280, x: 40, y: 60 };
  };
  w.Element.prototype.animate = function (frames, timing) {
    animaciones.push({ elemento: this, frames, timing });
    return { finished: new Promise(() => {}), cancel() {} };
  };
  const llegadas = () => animaciones.filter(a => a.elemento.classList?.contains("timeline-card") && /translate3d\([^,]+,\s*-/.test(a.frames[0].transform));
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  colocaHistoriaBien(w);
  click(w, '[data-action="confirm-place"]');
  ok("en Normal el tablero coloca una carta por turno", /incorporado/.test(texto(w)) === false);
  click(w, '[data-action="solo-next"]');
  await new Promise(resolve => w.setTimeout(resolve, 1050));
  const vistas = llegadas();
  ok(`la carta automática se anima al llegar (${vistas.length})`, vistas.length === 1);
  ok("entra desde el centro de la pantalla y acaba en su sitio",
    /translate3d/.test(vistas[0].frames[0].transform) && vistas[0].frames.at(-1).transform === "none");
  ok("empieza invisible, para no verse dos veces", vistas[0].frames[0].opacity === 0 && vistas[0].timing.fill === "backwards");
  ok("la línea la ha incorporado de verdad, no solo en la animación", /incorporado/.test(texto(w)));
  click(w, '[data-action="solo-place"]');
  ok("repintar al elegir hueco no la vuelve a repartir", llegadas().length === 1);
  w.close();
}
{
  // En Difícil son dos, y cada una cae en un punto distinto de la línea: llegan de una en
  // una y la vista va con cada una, o la segunda se colocaría fuera de la pantalla.
  const w = boot({ "continuum-difficulty-v1": "hard" });
  const animaciones = [];
  const seguidas = [];
  w.Element.prototype.getBoundingClientRect = function () {
    return { left: 40, top: 60, width: 150, height: 220, right: 190, bottom: 280, x: 40, y: 60 };
  };
  w.Element.prototype.animate = function (frames, timing) {
    if (this.classList?.contains("timeline-card") && /translate3d\([^,]+,\s*-/.test(frames[0].transform)) animaciones.push({ elemento: this, frames, timing });
    return { finished: new Promise(() => {}), cancel() {} };
  };
  // La vista se mueve escribiendo en el desplazamiento de la tira. Se anota en el
  // prototipo y no en el elemento: cada repintado trae una tira nueva.
  Object.defineProperty(w.HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    get() { return 0; },
    set(valor) { if (this.classList?.contains("timeline-wrap")) seguidas.push(valor); }
  });
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  colocaHistoriaBien(w);
  click(w, '[data-action="confirm-place"]');
  click(w, '[data-action="solo-next"]');
  await new Promise(resolve => w.setTimeout(resolve, 1050));
  ok("la primera llega sola, no las dos a la vez", animaciones.length === 1);
  const segunda = w.document.querySelectorAll(".timeline-card")[1];
  ok("la que espera su turno no está puesta todavía", [...w.document.querySelectorAll(".timeline-card")].some(c => c.style.visibility === "hidden"));
  ok("y la vista ya se ha movido hasta la primera", seguidas.length >= 1);
  // Tras el segundo extra solicitado antes de que actúe la IA, la segunda carta
  // empieza su llegada algo después de los dos segundos desde «Siguiente carta».
  await new Promise(resolve => w.setTimeout(resolve, 1100));
  ok("la segunda llega después, con la vista detrás", animaciones.length === 2 && seguidas.length >= 2);
  ok("y ninguna se queda escondida al terminar", ![...w.document.querySelectorAll(".timeline-card")].some(c => c.style.visibility === "hidden"));
  w.close();
}
{
  // Con movimiento reducido la carta sigue apareciendo: lo que no hay es recorrido.
  const w = boot({ "continuum-difficulty-v1": "normal" });
  const animaciones = [];
  w.matchMedia = () => ({ matches: true });
  w.Element.prototype.getBoundingClientRect = function () {
    return { left: 40, top: 60, width: 150, height: 220, right: 190, bottom: 280, x: 40, y: 60 };
  };
  w.Element.prototype.animate = function (frames) { if (/translate3d\([^,]+,\s*-/.test(frames[0].transform)) animaciones.push(this); return { finished: new Promise(() => {}), cancel() {} }; };
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  colocaHistoriaBien(w);
  click(w, '[data-action="confirm-place"]');
  click(w, '[data-action="solo-next"]');
  await new Promise(resolve => w.setTimeout(resolve, 1050));
  ok("con movimiento reducido no se anima nada", !animaciones.some(el => el.classList?.contains("timeline-card")));
  ok("y la carta automática está igualmente en la línea", /incorporado/.test(texto(w)));
  w.close();
}
{
  // En Fácil no hay cartas automáticas, así que tampoco hay nada que ver llegar.
  const w = boot({ "continuum-difficulty-v1": "easy" });
  const animaciones = [];
  w.Element.prototype.animate = function (frames) { if (/translate3d\([^,]+,\s*-/.test(frames[0].transform)) animaciones.push(this); return { finished: new Promise(() => {}), cancel() {} }; };
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  colocaHistoriaBien(w);
  click(w, '[data-action="confirm-place"]');
  click(w, '[data-action="solo-next"]');
  await new Promise(resolve => w.setTimeout(resolve, 1050));
  ok("en Fácil no llega ninguna carta automática", !animaciones.some(el => el.classList?.contains("timeline-card")) && !/incorporado/.test(texto(w)));
  w.close();
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
