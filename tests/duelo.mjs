import {gameHtml} from './game-fixture.mjs';
// El duelo por enlace: que dos móviles independientes reciban las mismas cartas, que la
// carga útil dé la vuelta entera, que un enlace manipulado o de otra versión del mazo se
// rechace sin romper nada, y que la partida se juegue con el motor del solitario.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

// `url` permite arrancar un «móvil» directamente sobre un enlace de duelo, que es como
// llega de verdad: alguien abre la dirección que le han mandado.
function boot({ url = "https://hilo.test/", almacen = {} } = {}) {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = function () {};
  const reloj = { ahora: Date.now() };
  window.Date.now = () => reloj.ahora;
  let oculto = false;
  Object.defineProperty(window.document, "hidden", { configurable: true, get: () => oculto });
  Object.defineProperty(window.document, "visibilityState", { configurable: true, get: () => (oculto ? "hidden" : "visible") });
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
  guiones().forEach(archivo => window.eval(read(archivo)));
  // Salirse de la aplicación y volver `ms` milisegundos después.
  window.seVaYVuelve = ms => {
    oculto = true;
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    reloj.ahora += ms;
    oculto = false;
    window.document.dispatchEvent(new window.Event("visibilitychange"));
  };
  window.avanza = ms => { reloj.ahora += ms; };
  return window;
}
const duerme = ms => new Promise(listo => setTimeout(listo, ms));
// Entre elegir el duelo y jugarlo hay una pantalla que explica la modalidad y una cuenta
// atrás. Las pruebas la acortan a unos milisegundos: lo que importa aquí es la partida.
async function jugar(w) {
  w.CONTINUUM.Duelo.CUENTA_PASO_MS = 4;
  click(w, '[data-action="duel-play"]');
  await duerme(80);
}
const partida = w => JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
// Entra en un duelo de orden recién creado.
async function abreDuelo(w) {
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-duel"]');
  await jugar(w);
}
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;
const abreMazo = (w, block, mode) => { click(w, `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); };

// Juega el duelo que hay en curso hasta el final, acertando o fallando a voluntad.
// Devuelve la secuencia real, para contrastarla con lo que viaja en el enlace.
function juegaDuelo(w, mode, { falla = () => false } = {}) {
  const cards = new Map(w.CONTINUUM.cards(mode).map(c => [c.id, c]));
  const valor = card => w.CONTINUUM.sortValue(mode, card);
  const secuencia = [];
  let vueltas = 0;
  while (existe(w, '[data-action="solo-place"]') && vueltas++ < 100) {
    const estado = JSON.parse(w.localStorage.getItem(`hilo-solo-${mode}-v1`));
    if (!estado || estado.finished) break;
    const valores = estado.timeline.map(id => valor(cards.get(id)));
    let index = valores.findIndex(v => v > valor(cards.get(estado.current)));
    if (index < 0) index = valores.length;
    const fallar = falla(secuencia.length);
    if (fallar) index = index === 0 ? valores.length : 0;
    secuencia.push(!fallar);
    w.document.querySelectorAll('[data-action="solo-place"]')[index].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  return secuencia;
}

console.log("\nDos móviles, la misma semilla, las mismas cartas");
{
  const uno = boot();
  const otro = boot();
  const semilla = uno.CONTINUUM.Duelo.crearSemilla();
  ok("la semilla es corta y admisible", /^[a-z0-9]{1,12}$/.test(semilla));
  for (const mazo of ["history", "animals", "distances"]) {
    const a = uno.CONTINUUM.Duelo.reparto(mazo, semilla);
    const b = otro.CONTINUUM.Duelo.reparto(mazo, semilla);
    ok(`${mazo}: los dos móviles reciben el mismo reparto`, a.length === b.length && a.every((id, i) => id === b[i]));
    ok(`${mazo}: son ${uno.CONTINUUM.Duelo.CARTAS} cartas más la que abre la línea`, a.length === uno.CONTINUUM.Duelo.CARTAS + 1);
    ok(`${mazo}: no se repite ninguna carta`, new Set(a).size === a.length);
  }
  const distinta = uno.CONTINUUM.Duelo.reparto("history", "otrasemi");
  const igual = uno.CONTINUUM.Duelo.reparto("history", semilla);
  ok("otra semilla reparte otras cartas", distinta.join() !== igual.join());
  ok("el mismo mazo con otra semilla no cambia de tamaño", distinta.length === igual.length);
}

console.log("\nLa carga útil da la vuelta entera");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const sequence = [true, false, true, true, false, true, true, true, false, true, true, false, true, true, true];
  const payload = D.codificar({ mode: "history", seed: "ab12cd34", total: 15, hits: 11, sequence, nombre: "Iñaki Muñoz" });
  ok("el enlace no lleva caracteres que haya que escapar", /^[A-Za-z0-9_-]+$/.test(payload));

  const leido = D.descodificar(payload);
  ok("se descodifica sin problemas", leido.ok === true);
  ok("vuelve el mazo", leido.duelo.mode === "history");
  ok("vuelve la semilla", leido.duelo.seed === "ab12cd34");
  ok("vuelven las cartas y los aciertos", leido.duelo.total === 15 && leido.duelo.rival.hits === 11);
  ok("vuelve la secuencia entera", leido.duelo.rival.sequence.join() === sequence.join());
  ok("las tildes y las eñes sobreviven", leido.duelo.rival.nombre === "Iñaki Muñoz");

  // El nombre es lo único que escribe una persona, y el separador de campos es la barra.
  const conBarra = D.descodificar(D.codificar({ mode: "history", seed: "x1", total: 1, hits: 1, sequence: [true], nombre: "Ana|Luis" }));
  ok("una barra en el nombre no parte la carga útil", conBarra.ok === true && conBarra.duelo.rival.nombre === "Ana Luis");
  const largo = D.descodificar(D.codificar({ mode: "history", seed: "x1", total: 1, hits: 1, sequence: [true], nombre: "N".repeat(60) }));
  ok("un nombre desmesurado se recorta", largo.ok === true && largo.duelo.rival.nombre.length === D.MAX_NOMBRE);
  const vacio = D.descodificar(D.codificar({ mode: "history", seed: "x1", total: 1, hits: 0, sequence: [false], nombre: "" }));
  ok("sin nombre también vale", vacio.ok === true && vacio.duelo.rival.nombre === "");

  ok("el enlace apunta a la propia aplicación sin enviar el duelo en la consulta HTTP", D.enlace(payload).startsWith("https://hilo.test/") && D.enlace(payload).includes("#duelo="));
}

console.log("\nLa huella del mazo impide comparar dos partidas distintas");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const original = D.huella("history");
  ok("la huella lleva su versión y el número de cartas", original.startsWith(`v3.${w.HISTORY_CARDS.length}.`));
  ok("mazos distintos dan huellas distintas", D.huella("history") !== D.huella("movies"));

  const payload = D.codificar({ mode: "history", seed: "abc", total: 2, hits: 1, sequence: [true, false], nombre: "Ana" });
  ok("con el mazo intacto se acepta", D.descodificar(payload).ok === true);

  // Se le quita una carta al mazo, como si el otro móvil llevara otra versión.
  const guardadas = w.HISTORY_CARDS.slice();
  w.CONTINUUM.MODES.history.cards = guardadas.slice(0, -1);
  const conMazoCambiado = D.descodificar(payload);
  ok("con el mazo cambiado se rechaza", conMazoCambiado.ok === false);
  ok("y se dice por qué, para poder explicarlo", conMazoCambiado.motivo === "mazo-distinto");
  ok("la huella también ha cambiado", D.huella("history") !== original);

  // Reordenar el mazo sin quitar ni poner nada también cambia el reparto.
  w.CONTINUUM.MODES.history.cards = [guardadas[1], guardadas[0], ...guardadas.slice(2)];
  ok("reordenar el mazo cuenta como mazo distinto", D.huella("history") !== original);
  w.CONTINUUM.MODES.history.cards = guardadas;
  ok("al dejarlo como estaba, la huella vuelve", D.huella("history") === original);
}

console.log("\nUn enlace roto no rompe nada");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const bueno = D.codificar({ mode: "history", seed: "abc", total: 3, hits: 2, sequence: [true, true, false], nombre: "Ana" });
  const casos = [
    ["vacío", ""],
    ["nulo", null],
    ["que no es base64", "esto no es base64 !!!"],
    ["cortado por la mitad", bueno.slice(0, Math.floor(bueno.length / 2))],
    ["con un campo de menos", D.codificar({ mode: "history", seed: "abc", total: 3, hits: 2, sequence: [true, true, false], nombre: "Ana" }).slice(0, 4)],
    ["con la secuencia más corta que las cartas", cruda(w, "1|history|abc|5|2|110|" + D.huella("history") + "|Ana")],
    ["con más aciertos que cartas", cruda(w, "1|history|abc|3|9|111|" + D.huella("history") + "|Ana")],
    ["con aciertos que no cuadran con la secuencia", cruda(w, "1|history|abc|3|3|110|" + D.huella("history") + "|Ana")],
    ["con cero cartas", cruda(w, "1|history|abc|0|0||" + D.huella("history") + "|Ana")],
    ["con un número desmesurado de cartas", cruda(w, "1|history|abc|9999|0|" + "0".repeat(9999) + "|" + D.huella("history") + "|Ana")],
    ["con una semilla rara", cruda(w, "1|history|../etc|3|2|110|" + D.huella("history") + "|Ana")],
    ["de un mazo que no existe", cruda(w, "1|inventado|abc|3|2|110|x|Ana")],
    ["de una versión futura", cruda(w, "9|history|abc|3|2|110|" + D.huella("history") + "|Ana")]
  ];
  for (const [nombre, payload] of casos) {
    let resultado;
    try { resultado = D.descodificar(payload); }
    catch (error) { resultado = { excepcion: String(error) }; }
    ok(`un enlace ${nombre} se rechaza sin excepción`, resultado.ok === false && !resultado.excepcion);
  }
  ok("un mazo desconocido se distingue de un enlace roto", D.descodificar(cruda(w, "1|inventado|abc|3|2|110|x|Ana")).motivo === "mazo");
  ok("una versión futura también", D.descodificar(cruda(w, "9|history|abc|3|2|110|x|Ana")).motivo === "version");
}

function plano(w, payload) {
  const relleno = payload.replace(/-/g, "+").replace(/_/g, "/");
  const binario = w.atob(relleno + "=".repeat((4 - (relleno.length % 4)) % 4));
  return new w.TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
}

function cruda(w, texto) {
  // La misma codificación que usa la aplicación, para poder fabricar cargas útiles
  // inválidas a propósito sin pasar por `codificar`, que las construye siempre bien.
  const bytes = new w.TextEncoder().encode(texto);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return w.btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

console.log("\nCrear un duelo y jugarlo");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  ok("el duelo es un formato más del solitario", /Duelo por enlace/.test(texto(w)));
  w.document.getElementById("duel-name").value = "Fernando";
  click(w, '[data-action="start-duel"]');
  ok("antes de jugar se explica la modalidad", existe(w, ".demo-orden") && existe(w, '[data-action="duel-play"]'));
  await jugar(w);
  ok("empieza la partida", existe(w, '[data-action="solo-place"]'));
  ok("el nombre se guarda para la próxima", w.localStorage.getItem("hilo-nombre-v1") === "Fernando");
  ok("un duelo no enseña vidas: se juegan todas las cartas", !existe(w, ".solo-lives"));

  const secuencia = juegaDuelo(w, "history", { falla: n => n % 4 === 3 });
  ok(`se juegan las ${w.CONTINUUM.Duelo.CARTAS} cartas enteras`, secuencia.length === w.CONTINUUM.Duelo.CARTAS);
  ok("la partida termina", /Duelo listo/.test(texto(w)));
  ok("y ofrece mandar el reto", existe(w, '[data-action="share-duel"]'));
  ok("todavía no hay marcador: no hay rival contra quien compararse", !existe(w, ".duel-grid"));

  const perfil = JSON.parse(w.localStorage.getItem("hilo-perfil-v1"));
  ok("el perfil lo registra como duelo", perfil.byMode.history.byKind.duel === secuencia.length);
  ok("crear un duelo no cuenta como victoria", perfil.totals.wins === 0);
}

console.log("\nAceptar un duelo por enlace");
{
  const retador = boot();
  const D = retador.CONTINUUM.Duelo;
  const semilla = "duelo123";
  const sequence = [true, true, false, true, true, true, false, true, true, true, true, false, true, true, true];
  const marca = sequence.filter(Boolean).length;
  const payload = D.codificar({ mode: "history", seed: semilla, total: 15, hits: marca, sequence, nombre: "Fernando" });
  ok("la marca del retador cuadra con su secuencia", marca === 12);

  const rival = boot({ url: `https://hilo.test/?duelo=${payload}` });
  ok("al abrir el enlace se ve quién reta", /Fernando te reta/.test(texto(rival)));
  ok("se dice el mazo y cuántas cartas", /Historia de España/.test(texto(rival)) && /15 cartas/.test(texto(rival)));
  ok("y la marca que hay que batir", new RegExp(`${marca} de 15`).test(texto(rival)));
  ok("no se enseña ninguna carta todavía", !existe(rival, ".timeline-card"));

  rival.document.getElementById("duel-name").value = "Marta";
  click(rival, '[data-action="accept-duel"]');
  ok("aceptar lleva a la pantalla de preparación", existe(rival, '[data-action="duel-play"]'));
  await jugar(rival);
  ok("y al jugar reparte el duelo", existe(rival, '[data-action="solo-place"]'));

  // Las cartas del rival tienen que ser exactamente las del retador.
  const esperado = D.reparto("history", semilla, 15);
  const repartido = JSON.parse(rival.localStorage.getItem("hilo-solo-history-v1"));
  ok("recibe exactamente las mismas cartas y en el mismo orden",
    [...repartido.timeline, repartido.current, ...repartido.deck].join() === esperado.join());

  const mia = juegaDuelo(rival, "history", { falla: n => n % 5 === 4 });
  ok("juega las quince", mia.length === 15);
  const aciertos = mia.filter(Boolean).length;
  ok("al terminar hay cara a cara", existe(rival, ".duel-grid"));
  ok("con las dos tiradas, carta a carta", rival.document.querySelectorAll(".duel-row").length === 2);
  ok("se ve el nombre de quien retaba", /Fernando/.test(texto(rival)));
  ok("y se puede devolver el reto", existe(rival, '[data-action="start-duel"]'));

  const gano = aciertos > marca;
  ok(`el veredicto corresponde al marcador (${aciertos} a ${marca})`,
    gano ? /Has ganado el duelo/.test(texto(rival)) : aciertos === marca ? /Empate/.test(texto(rival)) : /Duelo perdido/.test(texto(rival)));
  const perfil = JSON.parse(rival.localStorage.getItem("hilo-perfil-v1"));
  ok("la victoria en un duelo sí es tuya: hay una marca concreta enfrente", perfil.totals.wins === (gano ? 1 : 0));
  ok("y el logro va con ella", !!perfil.achievements.duelo === gano);
}

console.log("\nDevolver el reto conserva tu nombre");
{
  // «Devolver el reto» sale en el cara a cara, donde no hay campo de nombre. Guardar lo
  // que devuelve un campo inexistente dejaría el nombre en blanco sin que nadie lo pida.
  const D = boot().CONTINUUM.Duelo;
  const sequence = [true, true, false];
  const payload = D.codificar({ mode: "history", seed: "vuelta", total: 3, hits: 2, sequence, nombre: "Fernando" });
  const w = boot({ url: `https://hilo.test/?duelo=${payload}` });
  w.document.getElementById("duel-name").value = "Marta";
  click(w, '[data-action="accept-duel"]');
  ok("el nombre queda guardado al aceptar", w.localStorage.getItem("hilo-nombre-v1") === "Marta");
  await jugar(w);
  juegaDuelo(w, "history");
  ok("se llega al cara a cara", existe(w, ".duel-grid"));
  ok("y ahí no hay campo de nombre", !existe(w, "#duel-name"));
  click(w, '[data-action="start-duel"]');
  ok("devolver el reto no borra tu nombre", w.localStorage.getItem("hilo-nombre-v1") === "Marta");
  await jugar(w);
  ok("y empieza un duelo nuevo", existe(w, '[data-action="solo-place"]'));
  const nuevo = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
  ok("con semilla nueva, para no repetir cartas ya vistas", nuevo.duelo.seed !== "vuelta");
  ok("y sin rival: es un reto que estrenas tú", nuevo.duelo.rival === null);
}

console.log("\nUn duelo de otro mazo cambia de mazo al aceptarlo");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const payload = D.codificar({ mode: "movies", seed: "cine9", total: 15, hits: 8, sequence: Array.from({ length: 15 }, (_, i) => i < 8), nombre: "Ana" });
  const rival = boot({ url: `https://hilo.test/?duelo=${payload}`, almacen: { "hilo-selected-mode-v1": "history" } });
  ok("se abre con otro mazo elegido de antes", rival.localStorage.getItem("hilo-selected-mode-v1") === "history");
  ok("la invitación nombra el mazo del duelo", /Estrenos de cine/.test(texto(rival)));
  click(rival, '[data-action="accept-duel"]');
  await jugar(rival);
  ok("al aceptar se juega el mazo del duelo, no el que tenías abierto", rival.localStorage.getItem("hilo-selected-mode-v1") === "movies");
  const repartido = JSON.parse(rival.localStorage.getItem("hilo-solo-movies-v1"));
  ok("y con su reparto", [...repartido.timeline, repartido.current, ...repartido.deck].join() === D.reparto("movies", "cine9", 15).join());
}

console.log("\nUn enlace que no vale se explica y no rompe la aplicación");
{
  const roto = boot({ url: "https://hilo.test/?duelo=esto-no-vale-nada" });
  ok("se pinta una pantalla, no un error", /Este enlace no vale/.test(texto(roto)));
  ok("y se puede seguir usando el juego", existe(roto, '[data-action="home"]'));
  click(roto, '[data-action="home"]');
  ok("volver al inicio funciona", existe(roto, ".home-masthead"));

  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const futuro = cruda(w, "9|history|abc|3|2|110|" + D.huella("history") + "|Ana");
  const conVersion = boot({ url: `https://hilo.test/?duelo=${futuro}` });
  ok("un enlace de una versión más nueva pide actualizar", /Actualiza la aplicación/.test(texto(conVersion)));
}

console.log("\nEl duelo no se cuela donde no debe");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  ok("no hay duelo en el menú de formatos", !existe(w, '[data-action="start-duel"]'));
  click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
  ok("ni en la preparación de una partida local", !existe(w, '[data-action="start-duel"]'));
  click(w, '[data-action="start"]');
  click(w, '[data-action="ready"]');
  ok("ni dentro de una partida", !existe(w, '[data-action="start-duel"]'));
}


console.log("\nEl duelo de orden también se juega a reloj");
{
  const w = boot();
  await abreDuelo(w);
  ok("la carta lleva reloj", existe(w, ".reloj-bar"));
  ok("y queda apuntado el instante en que empezó", Number.isFinite(partida(w).cartaEmpezadaEn));

  // Un vistazo fuera por debajo del margen de gracia no cuesta la carta.
  w.seVaYVuelve(w.CONTINUUM.Duelo.GRACIA_MS - 400);
  ok("un vistazo corto no cierra la carta", !existe(w, ".overlay") && partida(w).played === 0);

  // Irse el tiempo que se tarda en consultar algo, sí.
  w.seVaYVuelve(5000);
  ok("irse más allá de la gracia da la carta por fallada", existe(w, ".overlay"));
  ok("se dice qué pasó, sin llamar tramposo a nadie", /Has salido de la aplicación/.test(texto(w)));
  const tras = partida(w);
  ok("la carta cuenta como jugada y no suma", tras.played === 1 && tras.hits === 0 && tras.sequence.join() === "false");
  ok("un duelo no gasta vidas ni por salirse", tras.lives === 3);

  // La siguiente carta estrena plazo entero: la penalización es de la carta, no de la partida.
  click(w, '[data-action="solo-next"]');
  ok("la siguiente carta arranca con su reloj", existe(w, ".reloj-bar") && Number.isFinite(partida(w).cartaEmpezadaEn));
}

console.log("\nSe acaban los veinte segundos");
{
  const w = boot();
  await abreDuelo(w);
  w.avanza(w.CONTINUUM.Duelo.MS + 200);
  await duerme(250);
  ok("agotado el plazo, la carta se cierra sola", existe(w, ".overlay"));
  ok("y se dice que fue el tiempo, no una mala colocación", /Se acabó el tiempo/.test(texto(w)));
  ok("la carta no suma", partida(w).hits === 0 && partida(w).sequence.join() === "false");
}

console.log("\nCerrar la aplicación no devuelve el plazo");
{
  const w = boot();
  await abreDuelo(w);
  const guardada = partida(w);
  const vuelta = boot({ almacen: {
    "hilo-selected-mode-v1": "history",
    "hilo-solo-history-v1": JSON.stringify({ ...guardada, cartaEmpezadaEn: Date.now() - 60000 })
  } });
  abreMazo(vuelta, "historia", "history");
  click(vuelta, '[data-action="solo"]');
  click(vuelta, '[data-action="resume-solo"]');
  ok("al continuar, la carta que seguía abierta se cierra", existe(vuelta, ".overlay"));
  ok("y se cierra como salida", /Has salido de la aplicación/.test(texto(vuelta)));

  const rapida = boot({ almacen: {
    "hilo-selected-mode-v1": "history",
    "hilo-solo-history-v1": JSON.stringify({ ...guardada, cartaEmpezadaEn: Date.now() - 500 })
  } });
  abreMazo(rapida, "historia", "history");
  click(rapida, '[data-action="solo"]');
  click(rapida, '[data-action="resume-solo"]');
  ok("volver enseguida deja seguir con la carta", !existe(rapida, ".overlay") && partida(rapida).played === 0);
}

console.log("\nLas reglas viajan en la versión del enlace");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const payload = D.codificar({ mode: "history", seed: "abc", total: 3, hits: 2, sequence: [true, true, false], nombre: "Ana" });
  ok("un duelo creado hoy lleva la versión de las reglas de hoy", plano(w, payload).split("|")[0] === "4");
  ok("y al leerlo vuelve el plazo con el que se jugó", D.descodificar(payload).duelo.ms === D.MS);

  // Los enlaces anteriores al reloj siguen valiendo y se juegan como se jugaron.
  const viejo = cruda(w, "1|history|abc|3|2|110|" + D.huella("history") + "|Ana");
  const leido = D.descodificar(viejo);
  ok("un enlace anterior al reloj se sigue aceptando", leido.ok === true);
  ok("y se marca como jugado sin plazo", leido.duelo.ms === 0);

  const rival = boot({ url: `https://hilo.test/?duelo=${viejo}` });
  ok("al abrirlo se avisa de que ese reto se juega sin reloj", /se juega sin plazo/.test(texto(rival)));
  click(rival, '[data-action="accept-duel"]');
  await jugar(rival);
  ok("y efectivamente se juega sin reloj", !existe(rival, ".reloj-bar"));
  ok("aunque sigue siendo un duelo", partida(rival).kind === "duel" && partida(rival).duelo.ms === 0);

  // Un enlace de cuando el duelo de orden iba a veinte segundos se juega a veinte, no a
  // los quince de hoy: la marca de enfrente se hizo con aquel plazo.
  const deVeinte = cruda(w, "3|history|abc|3|2|110|" + D.huella("history") + "|Ana");
  const leidoVeinte = D.descodificar(deVeinte);
  ok("un enlace de otro plazo se acepta", leidoVeinte.ok === true);
  ok("y conserva el plazo con el que se jugó", leidoVeinte.duelo.ms === 20000);
  const conVeinte = boot({ url: `https://hilo.test/?duelo=${deVeinte}` });
  ok("la invitación anuncia ese plazo y no el de hoy", /20 segundos por carta/.test(texto(conVeinte)));
}

console.log("\nEl nombre de quien reta no se cuela como HTML (XSS)");
{
  // limpiaNombre() solo quita barras y saltos de línea: el nombre puede llevar < > " sin
  // que el enlace se rompa. Si algún sitio lo pinta sin escapar, esta etiqueta se convierte
  // en un <img> de verdad en vez de quedarse como texto.
  const D = boot().CONTINUUM.Duelo;
  // Exactamente MAX_NOMBRE (18) caracteres: limpiaNombre() trunca, no filtra < > ", así
  // que cabe entera y llega intacta.
  const maligno = "<img src=x data-a>";
  const sequence = [true, true, true, true, true, true, true, true, true, true, true, true, false, false, false];
  const payload = D.codificar({ mode: "history", seed: "xss1", total: 15, hits: 12, sequence, nombre: maligno });

  const rival = boot({ url: `https://hilo.test/?duelo=${payload}` });
  ok("la invitación no crea la etiqueta del rival como HTML real", !existe(rival, "img[data-a]"));
  ok("se ve como texto escapado", texto(rival).includes(maligno));

  rival.document.getElementById("duel-name").value = "Marta";
  click(rival, '[data-action="accept-duel"]');
  await jugar(rival);
  ok("tampoco en la pantalla de partida, nada más entrar", !existe(rival, "img[data-a]"));

  // Empate deliberado (12 de 15 en los dos lados): es la rama que en su día se dejó sin escapar.
  juegaDuelo(rival, "history", { falla: n => n >= 12 });
  ok("ni en el resultado final, tampoco en empate", !existe(rival, "img[data-a]"));
  ok("el resultado sigue mostrando el nombre, pero como texto", texto(rival).includes(maligno));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
