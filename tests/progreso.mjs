// El perfil: qué se cuenta al jugar, qué logros se desbloquean y cuándo, y que la
// pantalla que lo enseña aguante un almacenamiento vacío, corrupto o de una versión
// anterior. Se juega de verdad contra el DOM de index.html, igual que el resto.
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
const texto = w => w.document.body.textContent;
const perfil = w => JSON.parse(w.localStorage.getItem("hilo-perfil-v1"));
const abreMazo = (w, block, mode) => { click(w, `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); };

// Juega una partida en solitario entera acertando o fallando a voluntad. Devuelve
// cuántas cartas se colocaron bien, para poder contrastarlas con lo que anotó el perfil.
function juegaSolitario(w, { falla = () => false } = {}) {
  const cards = new Map(w.HISTORY_CARDS.map(c => [c.id, c]));
  let jugadas = 0, aciertos = 0;
  while (!/Se acabaron las vidas|Reto completado/.test(texto(w)) && jugadas < 400) {
    const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    if (!estado) break;
    const años = estado.timeline.map(id => cards.get(id).year);
    let index = años.findIndex(y => y > cards.get(estado.current).year);
    if (index < 0) index = años.length;
    const fallar = falla(jugadas);
    if (fallar) index = index === 0 ? años.length : 0;
    else aciertos++;
    jugadas++;
    w.document.querySelectorAll('[data-action="solo-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  return { jugadas, aciertos };
}

console.log("\nUn perfil recién estrenado");
{
  const w = boot();
  const p = w.CONTINUUM.Progreso.read();
  ok("empieza a cero", p.totals.games === 0 && p.totals.cards === 0 && p.totals.hits === 0);
  ok("no hay ningún logro desbloqueado", Object.keys(p.achievements).length === 0);
  ok("no se ha escrito nada en el almacenamiento por el mero hecho de leer", w.localStorage.getItem("hilo-perfil-v1") === null);
  const resumen = w.CONTINUUM.Progreso.summary();
  ok("un perfil vacío no divide por cero", resumen.accuracy === 0);
  ok("hay dieciséis logros definidos", w.CONTINUUM.Progreso.ACHIEVEMENTS.length === 16);
}

console.log("\nUna partida en solitario cuadra con lo anotado");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  // Un fallo de cada tres: hacen falta aciertos y fallos para comprobar las dos ramas.
  const { jugadas, aciertos } = juegaSolitario(w, { falla: n => n % 3 === 2 });
  const p = perfil(w);
  ok("se anotan todas las cartas colocadas", p.totals.cards === jugadas);
  ok("se anotan exactamente los aciertos reales", p.totals.hits === aciertos);
  ok("la partida cuenta como una sola", p.totals.games === 1);
  ok("el mazo jugado queda registrado", p.byMode.history && p.byMode.history.cards === jugadas && p.byMode.history.hits === aciertos);
  ok("se guarda de qué formato era", p.byMode.history.byKind.free === jugadas);
  const bandas = Object.values(p.byBand);
  const sumaBandas = bandas.reduce((total, b) => total + b.hits + b.misses, 0);
  ok("las bandas suman las mismas cartas", sumaBandas === jugadas);
  ok("las bandas llevan el mazo delante en su clave", Object.keys(p.byBand).every(clave => clave.startsWith("history:")));
  const fallos = Object.values(p.misses).reduce((total, m) => total + m.count, 0);
  ok("las cartas falladas suman los fallos", fallos === jugadas - aciertos);
  ok("el porcentaje de aciertos se calcula sobre lo jugado", w.CONTINUUM.Progreso.summary().accuracy === Math.round((aciertos / jugadas) * 100));
  ok("una partida jugada desbloquea «La primera»", !!p.achievements.primera);
}

console.log("\nUna partida a un solo móvil");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="setup"]');
  w.document.getElementById("hand-size").value = "1";
  click(w, '[data-action="start"]');
  const cards = new Map(w.HISTORY_CARDS.map(c => [c.id, c]));
  let turnos = 0;
  while (!/gana(n)?<\/h1>/.test(w.document.body.innerHTML) && turnos < 600) {
    turnos++;
    click(w, '[data-action="ready"]');
    const mano = [...w.document.querySelectorAll('[data-action="select-card"]')];
    if (!mano.length) break;
    const id = Number(mano[0].dataset.id);
    mano[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    const años = [...w.document.querySelectorAll(".timeline-card .year")].map(el => el.textContent)
      .map(t => t.endsWith("a. C.") ? -parseInt(t) : parseInt(t));
    let index = años.findIndex(y => y > cards.get(id).year);
    if (index < 0) index = años.length;
    if (turnos % 4 === 0) index = index === 0 ? años.length : 0;
    w.document.querySelectorAll('[data-action="place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="finish-turn"]');
  }
  const p = perfil(w);
  ok("la partida local termina", /gana(n)?<\/h1>/.test(w.document.body.innerHTML));
  ok("cada colocación quedó anotada como local", p.byMode.history.byKind.local === p.totals.cards);
  ok("la partida local se cuenta al terminar", p.totals.games === 1);
  // Con dos personas no se sabe cuál sostiene el móvil, así que la victoria no es de
  // nadie en el perfil: se cuenta la partida, no un triunfo inventado.
  ok("una victoria a un solo móvil no se apunta como tuya", p.totals.wins === 0);
}

console.log("\nCada logro se desbloquea con su condición exacta, y una sola vez");
{
  const w = boot();
  const P = w.CONTINUUM.Progreso;
  const guarda = estado => w.localStorage.setItem("hilo-perfil-v1", JSON.stringify({ ...P.read(), ...estado }));

  // Justo por debajo del umbral: nada. Justo encima: se desbloquea.
  guarda({ totals: { ...P.read().totals, bestRun: 24 } });
  ok("24 seguidas no bastan para «Veinticinco seguidas»", !P.record({ mode: "history", cardId: w.HISTORY_CARDS[0].id, correct: false }).some(l => l.key === "tirada"));
  guarda({ totals: { ...P.read().totals, run: 24, bestRun: 24 } });
  const nuevos = P.record({ mode: "history", cardId: w.HISTORY_CARDS[0].id, correct: true });
  ok("la vigesimoquinta seguida sí lo desbloquea", nuevos.some(l => l.key === "tirada"));
  ok("y solo se anuncia esa vez", !P.record({ mode: "history", cardId: w.HISTORY_CARDS[1].id, correct: true }).some(l => l.key === "tirada"));
  ok("la fecha del logro no se reescribe después", P.read().achievements.tirada.unlockedAt === JSON.parse(w.localStorage.getItem("hilo-perfil-v1")).achievements.tirada.unlockedAt);

  // Un fallo corta la tirada en curso pero no toca la mejor que hubo.
  const antes = P.read().totals.bestRun;
  P.record({ mode: "history", cardId: w.HISTORY_CARDS[2].id, correct: false });
  ok("un fallo pone la tirada en curso a cero", P.read().totals.run === 0);
  ok("pero la mejor tirada se conserva", P.read().totals.bestRun === antes);
}

console.log("\nLos logros que dependen del final de la partida");
{
  const w = boot();
  const P = w.CONTINUUM.Progreso;
  ok("una racha de 6 días no da «Una semana»", !P.finishGame({ mode: "history", kind: "daily", hits: 10, total: 15, streak: 6 }).some(l => l.key === "semana"));
  ok("la de 7 sí", P.finishGame({ mode: "history", kind: "daily", hits: 10, total: 15, streak: 7 }).some(l => l.key === "semana"));
  ok("un reto de 14 de 15 no es «Reto perfecto»", !P.finishGame({ mode: "history", kind: "daily", hits: 14, total: 15, streak: 7 }).some(l => l.key === "pleno"));
  ok("un 15 de 15 sí", P.finishGame({ mode: "history", kind: "daily", hits: 15, total: 15, streak: 7 }).some(l => l.key === "pleno"));
  ok("agotar las vidas en Experto no cuenta como completarlo", !P.finishGame({ mode: "history", kind: "free", difficulty: "expert", lives: 0 }).some(l => l.key === "experto"));
  ok("terminarlo con vidas sí", P.finishGame({ mode: "history", kind: "free", difficulty: "expert", lives: 2 }).some(l => l.key === "experto"));
  ok("una mesa de 4 no da «Mesa llena»", !P.finishGame({ mode: "history", kind: "local", players: 4 }).some(l => l.key === "mesa"));
  ok("una de 5 sí", P.finishGame({ mode: "history", kind: "local", players: 5 }).some(l => l.key === "mesa"));
  ok("terminar la competición entera da «Vuelta completa»", P.finishCompetition().some(l => l.key === "competicion"));
  ok("y no se repite en la siguiente", !P.finishCompetition().some(l => l.key === "competicion"));
}

console.log("\nUna sala no cuenta dos veces la misma instantánea");
{
  const w = boot();
  const P = w.CONTINUUM.Progreso;
  const jugada = { code: "ABCD", version: 12, mine: true, mode: "history", cardId: w.HISTORY_CARDS[0].id, correct: true };
  P.recordOnline(jugada);
  ok("la jugada propia se anota", P.read().totals.cards === 1);
  P.recordOnline(jugada);
  P.recordOnline(jugada);
  ok("repetir la misma instantánea no suma", P.read().totals.cards === 1);
  P.recordOnline({ ...jugada, version: 13, cardId: w.HISTORY_CARDS[1].id });
  ok("la siguiente versión sí es una jugada nueva", P.read().totals.cards === 2);
  // Firestore puede reenviar una instantánea anterior después de una posterior: con solo
  // «la última vista» esta volvería a parecer nueva.
  P.recordOnline(jugada);
  ok("una instantánea vieja que vuelve tampoco suma", P.read().totals.cards === 2);
  P.recordOnline({ ...jugada, version: 14, mine: false, cardId: w.HISTORY_CARDS[2].id });
  ok("las jugadas de las otras personas no son tuyas", P.read().totals.cards === 2);

  const antesDeGanar = P.read().totals.games;
  P.finishOnline({ code: "ABCD", version: 20, mode: "history", won: true });
  P.finishOnline({ code: "ABCD", version: 20, mode: "history", won: true });
  ok("el final de la sala se cuenta una sola vez", P.read().totals.games === antesDeGanar + 1);
  ok("ganar en sala sí es tuyo: ahí el juego sabe quién eres", P.read().totals.wins === 1);
  ok("y desbloquea «Ganar en sala»", !!P.read().achievements.sala);
}

console.log("\nAlmacenamiento roto, lleno o de otra versión");
{
  const w = boot({ "hilo-perfil-v1": "{ esto no es json" });
  ok("un perfil corrupto se lee como uno vacío", w.CONTINUUM.Progreso.read().totals.cards === 0);
  click(w, '[data-action="perfil"]');
  ok("y la pantalla del perfil se pinta igual", /Perfil/.test(texto(w)) && existe(w, ".logro-grid"));
}
{
  // Un perfil escrito por una versión anterior, sin los contadores que se añadieron
  // después: leerlos de menos rompería la pantalla en vez de enseñar un cero.
  const w = boot({ "hilo-perfil-v1": JSON.stringify({ version: 1, totals: { games: 3, cards: 40, hits: 30 } }) });
  const p = w.CONTINUUM.Progreso.read();
  ok("los contadores que faltan se rellenan a cero", p.totals.bestRun === 0 && p.marks.bestStreak === 0);
  ok("los que sí venían se conservan", p.totals.cards === 40 && p.totals.hits === 30);
  click(w, '[data-action="perfil"]');
  ok("la pantalla se pinta con un perfil incompleto", /30 aciertos de 40 cartas/.test(texto(w)));
}
{
  // Una instalación anterior al perfil: tiene récords y racha, pero ninguna clave nueva.
  const previo = { history: { best: 9, streak: 4, lastDay: "2026-01-01", days: { "2026-01-01": { hits: 9, total: 15 } } } };
  const w = boot({ "hilo-retos-v1": JSON.stringify(previo) });
  ok("no hay perfil todavía", w.localStorage.getItem("hilo-perfil-v1") === null);
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  ok("el solitario sigue enseñando la racha de antes", /4/.test(texto(w)));
  const guardado = JSON.parse(w.localStorage.getItem("hilo-retos-v1"));
  ok("los récords de antes no se tocan", guardado.history.best === 9 && guardado.history.streak === 4);
}

console.log("\nLa pantalla del perfil");
{
  const w = boot();
  click(w, '[data-action="perfil"]');
  ok("se llega desde la portada", w.document.querySelector("h1")?.textContent === "Perfil");
  ok("un perfil sin estrenar lo dice sin números falsos", /Todavía no hay nada que contar/.test(texto(w)));
  ok("los dieciséis logros se pintan aunque estén bloqueados", w.document.querySelectorAll(".logro").length === 16);
  ok("ninguno aparece como conseguido", w.document.querySelectorAll(".logro.unlocked").length === 0);
  ok("sin cartas jugadas no se inventa un punto débil", !existe(w, ".weak-row"));
  click(w, '[data-action="home"]');
  ok("se vuelve a la portada", existe(w, ".home-masthead"));
}
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  juegaSolitario(w, { falla: n => n % 2 === 1 });
  click(w, '[data-action="home"]');
  click(w, '[data-action="perfil"]');
  ok("el mazo jugado sale en «Por juego»", /Historia de España/.test(texto(w)));
  ok("hay puntos débiles que enseñar", existe(w, ".weak-row"));
  ok("«La primera» aparece conseguido", existe(w, ".logro.unlocked"));

  // El punto débil no es un reproche, es un enlace: tiene que llevar a algún sitio.
  const carta = w.document.querySelector('.weak-row[data-action="enc-view"]');
  ok("cada carta fallada enlaza con su ficha", !!carta);
  carta.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok("y abre la enciclopedia de su mazo", /Enciclopedia/.test(texto(w)) && existe(w, "#enc-results"));
  ok("con esa carta destacada", existe(w, ".enc-card-highlight"));
}
{
  // Un tramo flojo concreto, puesto a mano: jugando de verdad los fallos caen donde
  // caen y la prueba dependería del azar de la baraja.
  const w = boot({ "hilo-perfil-v1": JSON.stringify({
    version: 1,
    totals: { games: 1, cards: 10, hits: 1, wins: 0, run: 0, bestRun: 1 },
    byMode: { history: { games: 1, cards: 10, hits: 1, byKind: { free: 10 } } },
    byBand: { "history:antigua": { mode: "history", band: "antigua", hits: 1, misses: 9 } }
  }) });
  click(w, '[data-action="perfil"]');
  const banda = w.document.querySelector('.weak-row[data-action="enc-band-view"]');
  ok("el tramo con menos aciertos sale en «Puntos débiles»", banda?.dataset.band === "antigua" && banda.dataset.mode === "history");
  ok("con su porcentaje real", /10%/.test(banda.textContent));
  banda.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok("y abre la enciclopedia ya filtrada por ese tramo", w.document.querySelector("#enc-band-antigua")?.classList.contains("active"));
  ok("con solo las cartas de ese tramo", [...w.document.querySelectorAll("[data-enc-card]")]
    .every(el => w.CONTINUUM.eraForCard("history", w.HISTORY_CARDS.find(c => c.id === Number(el.dataset.encCard))).key === "antigua"));
}
{
  // Un tramo con muy pocas cartas jugadas no es un punto débil: es no haber jugado.
  const w = boot({ "hilo-perfil-v1": JSON.stringify({
    version: 1,
    totals: { games: 1, cards: 2, hits: 0, wins: 0, run: 0, bestRun: 0 },
    byBand: { "history:antigua": { mode: "history", band: "antigua", hits: 0, misses: 2 } }
  }) });
  click(w, '[data-action="perfil"]');
  ok("dos cartas falladas no bastan para llamarlo punto débil", !existe(w, '.weak-row[data-action="enc-band-view"]'));
}

console.log("\nCopia de seguridad");
{
  const w = boot();
  const P = w.CONTINUUM.Progreso;
  P.finishGame({ mode: "history", kind: "free", hits: 8, total: 10 });
  P.record({ mode: "history", cardId: w.HISTORY_CARDS[3].id, correct: false });
  const copia = P.exportJson();
  ok("la copia es JSON legible", JSON.parse(copia).totals.games === 1);

  P.reset();
  ok("borrar deja el perfil a cero", P.read().totals.games === 0 && P.read().totals.cards === 0);
  ok("y no deja rastro en el almacenamiento", w.localStorage.getItem("hilo-perfil-v1") === null);

  const resultado = P.importJson(copia);
  ok("recuperar la copia funciona", resultado.ok === true);
  ok("y devuelve los números que tenía", P.read().totals.games === 1 && P.read().totals.cards === 1);

  // Una copia hecha por una versión con menos logros trae los contadores pasados y
  // ninguna marca: al recuperarla se ponen al día, en vez de enseñar la barra llena con
  // el logro bloqueado.
  const antigua = JSON.stringify({ version: 1, totals: { games: 4, cards: 60, hits: 55, wins: 0, run: 0, bestRun: 30 }, achievements: {} });
  const recuperada = P.importJson(antigua);
  ok("una copia sin logros marcados los recupera al importarla", recuperada.nuevos.some(l => l.key === "tirada"));
  ok("y quedan guardados, no solo anunciados", !!P.read().achievements.tirada);

  ok("un texto que no es JSON se rechaza sin romper nada", P.importJson("{{{").ok === false);
  ok("un JSON que no es un perfil también", P.importJson('{"hola":1}').ok === false);
  ok("y el perfil sigue intacto tras los dos intentos", P.read().totals.games === 4 && P.read().totals.cards === 60);
}
{
  // Con un récord y una racha ya guardados, para poder comprobar que borrar el perfil
  // no se lleva por delante el reto diario, que vive en otra clave.
  const retos = { history: { best: 11, streak: 5, lastDay: "2026-02-02", days: { "2026-02-02": { hits: 11, total: 15 } } } };
  const w = boot({ "hilo-retos-v1": JSON.stringify(retos) });
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  juegaSolitario(w, { falla: n => n % 2 === 1 });
  click(w, '[data-action="home"]');
  click(w, '[data-action="perfil"]');
  ok("hay algo que borrar", w.CONTINUUM.Progreso.read().totals.cards > 0);
  click(w, '[data-action="perfil-reset"]');
  ok("borrar el perfil pregunta antes", existe(w, ".modal") && /¿Borrar todo el progreso\?/.test(texto(w)));
  click(w, '[data-action="close-menu"]');
  ok("decir que no deja el perfil como estaba", w.CONTINUUM.Progreso.read().totals.cards > 0);
  click(w, '[data-action="perfil-reset"]');
  click(w, '[data-action="perfil-reset-confirm"]');
  ok("confirmar sí lo borra", w.CONTINUUM.Progreso.read().totals.cards === 0);
  const tras = JSON.parse(w.localStorage.getItem("hilo-retos-v1"));
  ok("el récord del reto diario sobrevive al borrado", tras?.history?.best === 11);
  ok("y su racha también", tras.history.streak === 5 && tras.history.lastDay === "2026-02-02");
  ok("la pantalla se queda en el perfil, ya vacío", w.document.querySelector("h1")?.textContent === "Perfil");
}

console.log("\nNo se cuela en ninguna pantalla de partida");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="setup"]');
  ok("no hay perfil en la preparación de la partida", !existe(w, '[data-action="perfil"]'));
  click(w, '[data-action="start"]');
  click(w, '[data-action="ready"]');
  ok("ni dentro de la partida local", !existe(w, '[data-action="perfil"]'));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
