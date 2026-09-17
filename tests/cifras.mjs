import {gameHtml} from './game-fixture.mjs';
// El duelo de cifras: que puntúe por lo cerca que se queda uno y por lo rápido que
// responde, que la carga útil dé la vuelta entera sin creerse los puntos que trae, y
// —lo que sostiene el modo entero— que el reloj no se pueda parar. Irse de la
// aplicación, recargar la página o cerrarla no devuelven diez segundos nuevos.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

// El reloj de la partida es el del móvil, así que para probarlo hay que poder moverlo.
// `reloj.ahora` sustituye a `Date.now()` dentro de la ventana: avanzarlo es exactamente
// lo que ocurre cuando alguien se va a otra aplicación y vuelve.
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

const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;
const abreMazo = (w, block, mode) => { click(w, `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); };
const estado = (w, mode) => JSON.parse(w.localStorage.getItem(`hilo-cifras-${mode}-v1`) || "null");
const duerme = ms => new Promise(listo => setTimeout(listo, ms));

// Entra en el duelo de cifras de un mazo, con el nombre puesto.
function abreDuelo(w, { block = "geografia", mode = "population", nombre = "Fernando" } = {}) {
  abreMazo(w, block, mode);
  click(w, '[data-action="solo"]');
  w.document.getElementById("cifras-name").value = nombre;
  click(w, '[data-action="start-cifras"]');
}

// Juega el duelo en curso hasta el final. `responde` recibe la carta y decide qué
// escribir; devolver `null` deja la carta en blanco.
function juegaCifras(w, mode, responde, { tarda = () => 0 } = {}) {
  const C = w.CONTINUUM.Duelo.Cifras;
  const escritas = [];
  let vueltas = 0;
  while (existe(w, '[data-action="cifra-answer"]') && vueltas++ < 40) {
    const guardado = estado(w, mode);
    if (!guardado || guardado.finished || guardado.jugadas.length >= guardado.total) break;
    const indice = guardado.jugadas.length;
    const card = C.cartas(guardado.mode, guardado.seed, guardado.total)[indice];
    const valor = responde(card, indice);
    if (valor !== null) w.document.querySelector("#cifra-input").value = String(valor);
    w.avanza(tarda(indice));
    click(w, '[data-action="cifra-answer"]');
    escritas.push(valor);
    click(w, '[data-action="cifras-next"]');
  }
  return escritas;
}

console.log("\nCada eje sabe preguntar por su cifra");
{
  const w = boot();
  const C = w.CONTINUUM.Duelo.Cifras;
  for (const mazo of ["history", "population", "animals", "lifespan", "speed", "distances", "countries", "languages"]) {
    const regla = C.regla(mazo);
    ok(`${mazo}: tiene pregunta y unidad`, !!regla && typeof regla.pregunta === "string" && regla.pregunta.length > 3 && typeof regla.unidad === "string");
  }
  ok("solo las fechas admiten números negativos", C.regla("history").negativos === true && !C.regla("population").negativos);
  ok("y solo las fechas se puntúan por años", C.regla("history").anos === true && !C.regla("population").anos);
}

console.log("\nLas diez cartas salen de la semilla, iguales en los dos móviles");
{
  const uno = boot();
  const otro = boot();
  const C = uno.CONTINUUM.Duelo.Cifras;
  const semilla = uno.CONTINUUM.Duelo.crearSemilla();
  for (const mazo of ["population", "history", "animals"]) {
    const a = C.reparto(mazo, semilla);
    const b = otro.CONTINUUM.Duelo.Cifras.reparto(mazo, semilla);
    ok(`${mazo}: los dos móviles reciben el mismo reparto`, a.join() === b.join());
    ok(`${mazo}: son ${C.CARTAS} cartas, sin ninguna que abra línea`, a.length === C.CARTAS);
    ok(`${mazo}: no se repite ninguna`, new Set(a).size === a.length);
  }
  ok("otra semilla reparte otras cartas", C.reparto("population", "otrasemi").join() !== C.reparto("population", semilla).join());
}

console.log("\nPuntúa acercarse, y puntúa la prisa");
{
  const w = boot();
  const C = w.CONTINUUM.Duelo.Cifras;
  const carta = { id: 1, value: 1000 };
  const enSeco = respuesta => C.puntosCarta("population", carta, { respuesta, ms: C.MS, salida: false });

  ok("clavarla vale el máximo del tino", enSeco(1000) === 60);
  ok("un 4% de error sigue siendo clavarla", enSeco(1040) === 60);
  ok("un 8% se queda muy cerca", enSeco(1080) === 50);
  ok("un 20% se queda cerca", enSeco(800) === 38);
  ok("la mitad todavía puntúa", enSeco(1500) === 24);
  ok("el doble es lo último que puntúa", enSeco(2000) === 12);
  ok("más del doble ya no puntúa", enSeco(2001) === 0);
  ok("no responder no puntúa", enSeco(null) === 0);

  ok("responder al instante suma los 40 de la prisa", C.puntosCarta("population", carta, { respuesta: 1000, ms: 0, salida: false }) === 100);
  ok("a mitad de tiempo suma la mitad", C.puntosCarta("population", carta, { respuesta: 1000, ms: C.MS / 2, salida: false }) === 80);
  ok("una respuesta regular y rápida gana a una buena y lenta",
    C.puntosCarta("population", carta, { respuesta: 800, ms: 0, salida: false }) > C.puntosCarta("population", carta, { respuesta: 1000, ms: C.MS, salida: false }));
  ok("la prisa sin acierto no vale nada", C.puntosCarta("population", carta, { respuesta: 99999, ms: 0, salida: false }) === 0);

  // Salirse es lo único que anula la carta entera: agotar el tiempo con una cifra escrita
  // sigue contando, que es la diferencia entre tardar y marcharse.
  ok("salir de la aplicación deja la carta a cero aunque la cifra fuera buena",
    C.puntosCarta("population", carta, { respuesta: 1000, ms: 2000, salida: true }) === 0);
  ok("agotar el tiempo con la cifra escrita sí puntúa", enSeco(1000) === 60);

  // Las fechas van por años de diferencia, no por porcentaje.
  const anio = { id: 2, year: 1492 };
  ok("un año de diferencia es clavarla", C.puntosCarta("history", anio, { respuesta: 1493, ms: C.MS, salida: false }) === 60);
  ok("cinco años se quedan cerca", C.puntosCarta("history", anio, { respuesta: 1487, ms: C.MS, salida: false }) === 38);
  ok("medio siglo se va fuera", C.puntosCarta("history", anio, { respuesta: 1550, ms: C.MS, salida: false }) === 0);
  const viejo = { id: 3, year: -218 };
  ok("los años antes de Cristo se miden igual", C.puntosCarta("history", viejo, { respuesta: -220, ms: C.MS, salida: false }) === 50);
}

console.log("\nLa carga útil da la vuelta entera");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo, C = D.Cifras;
  const cartas = C.cartas("population", "cifras01", 10);
  const jugadas = cartas.map((card, i) => ({
    respuesta: i === 3 ? null : w.CONTINUUM.sortValue("population", card) * (1 + (i % 5) / 10),
    ms: i * 900,
    salida: i === 7
  }));
  const payload = C.codificar({ mode: "population", seed: "cifras01", total: 10, jugadas, nombre: "Iñaki Muñoz" });
  ok("el enlace no lleva caracteres que haya que escapar", /^[A-Za-z0-9_-]+$/.test(payload));

  const leido = D.descodificar(payload);
  ok("se descodifica sin problemas", leido.ok === true);
  ok("se distingue de un duelo de orden", leido.duelo.cifras === true);
  ok("vuelven el mazo y la semilla", leido.duelo.mode === "population" && leido.duelo.seed === "cifras01");
  ok("vuelven las diez jugadas", leido.duelo.rival.jugadas.length === 10);
  ok("vuelve la carta sin responder como sin responder", leido.duelo.rival.jugadas[3].respuesta === null);
  ok("y la que se cerró por salir, marcada", leido.duelo.rival.jugadas[7].salida === true);
  ok("los puntos cuadran con lo jugado", leido.duelo.rival.puntos === C.puntosPartida("population", "cifras01", 10, jugadas));
  ok("las tildes y las eñes sobreviven", leido.duelo.rival.nombre === "Iñaki Muñoz");
  ok("el enlace apunta a la propia aplicación", D.enlace(payload).includes("#duelo="));

  // Un duelo de orden y uno de cifras entran por la misma puerta y no se confunden.
  const orden = D.descodificar(D.codificar({ mode: "history", seed: "x1", total: 1, hits: 1, sequence: [true], nombre: "Ana" }));
  ok("el duelo de orden sigue funcionando por la misma puerta", orden.ok === true && orden.duelo.cifras === false);
}

console.log("\nLos puntos del enlace no se creen: se recalculan");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo, C = D.Cifras;
  const cartas = C.cartas("population", "trampa", 3);
  const jugadas = cartas.map(card => ({ respuesta: w.CONTINUUM.sortValue("population", card), ms: 1000, salida: false }));
  const honrado = C.codificar({ mode: "population", seed: "trampa", total: 3, jugadas, nombre: "Ana" });
  ok("un enlace honrado se acepta", D.descodificar(honrado).ok === true);

  const plano = deBase64url(w, honrado).split("|");
  const puntos = Number(plano[4]);
  plano[4] = String(puntos + 50);
  const inflado = aBase64url(w, plano.join("|"));
  ok("subir los puntos a mano no cuela", D.descodificar(inflado).ok === false);

  // Y tampoco cuela rebajar el tiempo empleado sin tocar los puntos: los puntos que
  // trae el enlace dejarían de corresponder con lo que se recalcula aquí.
  const otro = deBase64url(w, honrado).split("|");
  otro[5] = otro[5].split(",").map(trozo => trozo.replace(/:\d+:/, ":0:")).join(",");
  ok("rebajar los tiempos tampoco", D.descodificar(aBase64url(w, otro.join("|"))).ok === false);
}

console.log("\nUn enlace de cifras roto no rompe nada");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const huella = D.huella("population");
  const casos = [
    ["sin jugadas", `2|population|abc|3|0||${huella}|Ana`],
    ["con menos jugadas que cartas", `2|population|abc|3|0|::0,::0|${huella}|Ana`],
    ["con una jugada a medias", `2|population|abc|1|0|:0|${huella}|Ana`],
    ["con una respuesta que no es un número", `2|population|abc|1|0|hola:0:0|${huella}|Ana`],
    ["con una respuesta desmesurada", `2|population|abc|1|0|${"9".repeat(20)}:0:0|${huella}|Ana`],
    ["con más tiempo del que dura una carta", `2|population|abc|1|0|100:999999:0|${huella}|Ana`],
    ["con un tiempo negativo", `2|population|abc|1|0|100:-5:0|${huella}|Ana`],
    ["con una salida que no es sí ni no", `2|population|abc|1|0|100:0:7|${huella}|Ana`],
    ["con los puntos en negativo", `2|population|abc|1|-5|::0|${huella}|Ana`],
    ["con más puntos de los que caben", `2|population|abc|1|9999|::0|${huella}|Ana`],
    ["con una semilla rara", `2|population|../etc|1|0|::0|${huella}|Ana`],
    ["de un mazo que no existe", `2|inventado|abc|1|0|::0|x|Ana`],
    ["con más cartas de las que tiene un duelo de cifras", `2|population|abc|20|0|${new Array(20).fill("::0").join(",")}|${huella}|Ana`]
  ];
  for (const [nombre, plano] of casos) {
    let resultado;
    try { resultado = D.descodificar(aBase64url(w, plano)); }
    catch (error) { resultado = { excepcion: String(error) }; }
    ok(`un enlace ${nombre} se rechaza sin excepción`, resultado.ok === false && !resultado.excepcion);
  }
  ok("una carta sin responder y sin salir sí es válida", D.descodificar(aBase64url(w, `2|population|abc|1|0|::0|${huella}|Ana`)).ok === true);
}

console.log("\nCrear un duelo de cifras y jugarlo");
{
  const w = boot();
  abreMazo(w, "geografia", "population");
  click(w, '[data-action="solo"]');
  ok("el duelo de cifras es un formato más del solitario", /Duelo de cifras/.test(texto(w)));
  ok("y avisa de la regla que lo sostiene", /si sales de la aplicación, la carta se cierra/i.test(texto(w)));

  w.document.getElementById("cifras-name").value = "Fernando";
  click(w, '[data-action="start-cifras"]');
  ok("empieza la partida", existe(w, '[data-action="cifra-answer"]'));
  ok("el nombre se guarda para la próxima", w.localStorage.getItem("hilo-nombre-v1") === "Fernando");
  ok("se ve el reloj", existe(w, ".cifra-bar"));
  ok("y el campo donde escribir la cifra", existe(w, "#cifra-input"));
  ok("no se enseña el detalle de la carta, que muchas veces lleva la cifra dentro", !existe(w, ".reveal"));

  const C = w.CONTINUUM.Duelo.Cifras;
  const escritas = juegaCifras(w, "population", card => w.CONTINUUM.sortValue("population", card), { tarda: () => 1000 });
  ok(`se juegan las ${C.CARTAS} cartas`, escritas.length === C.CARTAS);
  ok("la partida termina", /Duelo de cifras listo/.test(texto(w)));
  ok("clavarlas todas en un segundo suma casi el máximo", /9\d\d puntos en 10 cartas/.test(texto(w)));
  ok("y ofrece mandar el reto", existe(w, '[data-action="share-duel"]'));
  ok("todavía no hay marcador: no hay rival contra quien compararse", !existe(w, ".duel-grid"));

  const perfil = JSON.parse(w.localStorage.getItem("hilo-perfil-v1"));
  ok("el perfil lo registra como cifras", perfil.byMode.population.byKind.cifras === C.CARTAS);
  ok("crear un duelo no cuenta como victoria", perfil.totals.wins === 0);
}

console.log("\nAceptar un duelo de cifras por enlace");
{
  const retador = boot();
  const C = retador.CONTINUUM.Duelo.Cifras;
  const semilla = "cifras99";
  const cartas = C.cartas("population", semilla, 10);
  // El retador se queda a un 20% en todas y tarda dos segundos: una marca batible.
  const suyas = cartas.map(card => ({ respuesta: retador.CONTINUUM.sortValue("population", card) * 1.2, ms: 2000, salida: false }));
  const marca = C.puntosPartida("population", semilla, 10, suyas);
  const payload = C.codificar({ mode: "population", seed: semilla, total: 10, jugadas: suyas, nombre: "Fernando" });

  const rival = boot({ url: `https://hilo.test/?duelo=${payload}` });
  ok("al abrir el enlace se ve quién reta", /Fernando te reta/.test(texto(rival)));
  ok("se dice que es de cifras", /Duelo de cifras/.test(texto(rival)));
  ok("y la marca que hay que batir, en puntos", new RegExp(`${marca} puntos`).test(texto(rival)));
  ok("no se enseña ninguna carta todavía", !existe(rival, ".cifra-card"));

  rival.document.getElementById("duel-name").value = "Marta";
  click(rival, '[data-action="accept-duel"]');
  ok("aceptar reparte el duelo", existe(rival, '[data-action="cifra-answer"]'));
  ok("y se ve la marca del rival durante la partida", new RegExp(`${marca}`).test(texto(rival)));

  const guardado = estado(rival, "population");
  ok("recibe exactamente las mismas cartas", C.cartas(guardado.mode, guardado.seed, guardado.total).map(c => c.id).join() === cartas.map(c => c.id).join());

  // Las clava todas y sin pensárselo: tiene que ganar.
  juegaCifras(rival, "population", card => rival.CONTINUUM.sortValue("population", card));
  ok("al terminar hay cara a cara", existe(rival, ".duel-grid"));
  ok("con las dos tiradas, carta a carta", rival.document.querySelectorAll(".duel-row").length === 2);
  ok("se ve el nombre de quien retaba", /Fernando/.test(texto(rival)));
  ok("gana quien más puntos suma", /Has ganado el duelo/.test(texto(rival)));
  ok("y se puede devolver el reto", existe(rival, '[data-action="start-cifras"]'));

  const perfil = JSON.parse(rival.localStorage.getItem("hilo-perfil-v1"));
  ok("la victoria es tuya: hay una marca concreta enfrente", perfil.totals.wins === 1);
}

console.log("\nEl reloj no se para: salir de la aplicación cierra la carta");
{
  const w = boot();
  abreDuelo(w);
  const antes = estado(w, "population");
  ok("la carta lleva apuntado el instante en que empezó", Number.isFinite(antes.empezadaEn));

  // Un aviso que se cuela y se quita: por debajo del margen de gracia no cuesta nada.
  w.seVaYVuelve(w.CONTINUUM.Duelo.Cifras.GRACIA_MS - 400);
  ok("un vistazo fuera más corto que la gracia no cierra la carta", !existe(w, ".overlay"));
  ok("y la carta sigue siendo la primera", estado(w, "population").jugadas.length === 0);

  // Irse de verdad, el tiempo que se tarda en consultar algo: la carta se cierra.
  w.seVaYVuelve(4000);
  ok("irse más allá de la gracia cierra la carta", existe(w, ".overlay"));
  ok("se dice qué ha pasado, sin llamar tramposo a nadie", /Has salido de la aplicación/.test(texto(w)));
  const despues = estado(w, "population");
  ok("la jugada queda marcada como salida", despues.jugadas[0].salida === true);
  ok("y no puntúa", despues.jugadas.length === 1 && /\+0 puntos/.test(texto(w)));

  // Y la siguiente carta empieza limpia: la penalización es de la carta, no de la partida.
  click(w, '[data-action="cifras-next"]');
  ok("la siguiente carta arranca con su reloj entero", existe(w, '[data-action="cifra-answer"]') && Number.isFinite(estado(w, "population").empezadaEn));
}

console.log("\nNi recargar ni cerrar la aplicación devuelven diez segundos nuevos");
{
  const w = boot();
  abreDuelo(w);
  const guardado = estado(w, "population");
  ok("la partida se guarda con el reloj en marcha", Number.isFinite(guardado.empezadaEn));

  // Se cierra la aplicación con la carta abierta y se vuelve un minuto después: es el
  // caso que un contador ingenuo premiaría, porque al recargar volvería a empezar.
  const vuelta = boot({ almacen: {
    "hilo-selected-mode-v1": "population",
    "hilo-cifras-population-v1": JSON.stringify({ ...guardado, empezadaEn: Date.now() - 60000 })
  } });
  abreMazo(vuelta, "geografia", "population");
  click(vuelta, '[data-action="solo"]');
  ok("se ofrece continuar el duelo empezado", existe(vuelta, '[data-action="resume-cifras"]'));
  click(vuelta, '[data-action="resume-cifras"]');
  ok("al continuar, la carta que estaba abierta se cierra", existe(vuelta, ".overlay"));
  ok("y se cierra como salida, no como un simple agotarse el tiempo", estado(vuelta, "population").jugadas[0].salida === true);

  // Volver enseguida, en cambio, no cuesta la carta.
  const rapida = boot({ almacen: {
    "hilo-selected-mode-v1": "population",
    "hilo-cifras-population-v1": JSON.stringify({ ...guardado, empezadaEn: Date.now() - 500 })
  } });
  abreMazo(rapida, "geografia", "population");
  click(rapida, '[data-action="solo"]');
  click(rapida, '[data-action="resume-cifras"]');
  ok("volver enseguida deja seguir con la carta", !existe(rapida, ".overlay") && estado(rapida, "population").jugadas.length === 0);
}

console.log("\nSe acaban los diez segundos");
{
  const w = boot();
  abreDuelo(w);
  w.document.querySelector("#cifra-input").value = "1000000";
  w.avanza(w.CONTINUUM.Duelo.Cifras.MS + 200);
  await duerme(250);
  ok("agotado el plazo, la carta se cierra sola", existe(w, ".overlay"));
  ok("se dice que se acabó el tiempo", /tiempo agotado|Se acabaron los diez segundos/.test(texto(w)));
  const guardado = estado(w, "population");
  ok("la cifra escrita cuenta igual: tardar no es marcharse", guardado.jugadas[0].salida === false && guardado.jugadas[0].respuesta === 1000000);
  ok("pero el tiempo se queda en el tope", guardado.jugadas[0].ms === w.CONTINUUM.Duelo.Cifras.MS);
}

console.log("\nLo que escribe una persona en español");
{
  const w = boot();
  abreDuelo(w);
  const escribe = valor => { w.document.querySelector("#cifra-input").value = valor; click(w, '[data-action="cifra-answer"]'); const jugada = estado(w, "population").jugadas.at(-1); click(w, '[data-action="cifras-next"]'); return jugada.respuesta; };
  ok("los puntos de millar se entienden", escribe("47.000.000") === 47000000);
  ok("los espacios también", escribe("47 000 000") === 47000000);
  ok("la coma decimal es decimal", escribe("1,5") === 1.5);
  ok("un punto que no separa millares es decimal", escribe("1.5") === 1.5);
  ok("una cifra sin adornos se entiende", escribe("930000") === 930000);
  ok("lo que no es un número se queda en nada", escribe("no sé") === null);
  ok("y el campo vacío también", escribe("") === null);
}

console.log("\nEl duelo de cifras no se cuela donde no debe");
{
  const w = boot();
  abreMazo(w, "geografia", "population");
  ok("no hay duelo de cifras en el menú de formatos", !existe(w, '[data-action="start-cifras"]'));
  click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
  ok("ni en la preparación de una partida local", !existe(w, '[data-action="start-cifras"]'));
}

// La misma codificación que usa la aplicación, para fabricar cargas útiles a mano.
function aBase64url(w, texto) {
  const bytes = new w.TextEncoder().encode(texto);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return w.btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deBase64url(w, texto) {
  const relleno = texto.replace(/-/g, "+").replace(/_/g, "/");
  const binario = w.atob(relleno + "=".repeat((4 - (relleno.length % 4)) % 4));
  return new w.TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
