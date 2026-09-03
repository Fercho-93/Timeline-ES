// El duelo por enlace: que dos móviles independientes reciban las mismas cartas, que la
// carga útil dé la vuelta entera, que un enlace manipulado o de otra versión del mazo se
// rechace sin romper nada, y que la partida se juegue con el motor del solitario.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

// `url` permite arrancar un «móvil» directamente sobre un enlace de duelo, que es como
// llega de verdad: alguien abre la dirección que le han mandado.
function boot({ url = "https://hilo.test/", almacen = {} } = {}) {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = function () {};
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

  ok("el enlace apunta a la propia aplicación", D.enlace(payload).startsWith("https://hilo.test/") && D.enlace(payload).includes("?duelo="));
}

console.log("\nLa huella del mazo impide comparar dos partidas distintas");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const original = D.huella("history");
  ok("la huella lleva el número de cartas", original.startsWith(`${w.HISTORY_CARDS.length}.`));
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
    ["de una versión futura", cruda(w, "2|history|abc|3|2|110|" + D.huella("history") + "|Ana")]
  ];
  for (const [nombre, payload] of casos) {
    let resultado;
    try { resultado = D.descodificar(payload); }
    catch (error) { resultado = { excepcion: String(error) }; }
    ok(`un enlace ${nombre} se rechaza sin excepción`, resultado.ok === false && !resultado.excepcion);
  }
  ok("un mazo desconocido se distingue de un enlace roto", D.descodificar(cruda(w, "1|inventado|abc|3|2|110|x|Ana")).motivo === "mazo");
  ok("una versión futura también", D.descodificar(cruda(w, "2|history|abc|3|2|110|x|Ana")).motivo === "version");
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
  ok("aceptar reparte el duelo", existe(rival, '[data-action="solo-place"]'));

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
  juegaDuelo(w, "history");
  ok("se llega al cara a cara", existe(w, ".duel-grid"));
  ok("y ahí no hay campo de nombre", !existe(w, "#duel-name"));
  click(w, '[data-action="start-duel"]');
  ok("devolver el reto no borra tu nombre", w.localStorage.getItem("hilo-nombre-v1") === "Marta");
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
  const futuro = cruda(w, "2|history|abc|3|2|110|" + D.huella("history") + "|Ana");
  const conVersion = boot({ url: `https://hilo.test/?duelo=${futuro}` });
  ok("un enlace de una versión más nueva pide actualizar", /Actualiza la aplicación/.test(texto(conVersion)));
}

console.log("\nEl duelo no se cuela donde no debe");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  ok("no hay duelo en el menú de formatos", !existe(w, '[data-action="start-duel"]'));
  click(w, '[data-action="setup"]');
  ok("ni en la preparación de una partida local", !existe(w, '[data-action="start-duel"]'));
  click(w, '[data-action="start"]');
  click(w, '[data-action="ready"]');
  ok("ni dentro de una partida", !existe(w, '[data-action="start-duel"]'));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
