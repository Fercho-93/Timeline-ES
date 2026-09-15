// El ranking del reto diario.
//
// Lo que de verdad hay que comprobar aquí es una sola cosa, y es la que rompería todo si
// fallara: que el mazo que reparte `app.js` en el móvil y el que vuelve a repartir
// `functions/juego.mjs` en el servidor son el mismo, carta por carta. Si un día dejaran
// de serlo, la función rechazaría todas las partidas legítimas y la tabla se quedaría
// vacía sin que nada avisara, porque cada pieza por separado seguiría pareciendo
// correcta.
//
// Por eso la partida no se simula: se juega de verdad, contra el DOM y con el mismo
// `app.js` que se descarga al móvil, y lo que se envía a revisar es lo que ese código ha
// guardado. Es el mismo criterio de `tests/solitario.mjs`.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cargarJuego, mazoDelDia, revisar, CARTAS_RETO, VIDAS } from "../functions/juego.mjs";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

// La copia de los mazos para la función se genera aquí mismo: no está en el repositorio
// justo para que nadie pueda editarla por separado y creer que ha cambiado el juego.
execFileSync(process.execPath, [path.join(REPO, "functions", "preparar.mjs")], { stdio: "ignore" });
const CT = cargarJuego(path.join(REPO, "functions", "juego"));

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
const abreMazo = (w, block, mode) => { click(w, `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); };

// Juega el reto diario entero colocando cada carta donde toca (o donde se le diga) y
// devuelve la partida tal y como `app.js` la deja guardada.
function juegaRetoDiario({ fallarDesde = Infinity } = {}) {
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-daily"]');

  const valor = new Map(CT.cards("history").map(carta => [carta.id, CT.sortValue("history", carta)]));
  for (let turno = 0; turno < CARTAS_RETO; turno++) {
    const huecos = [...w.document.querySelectorAll('[data-action="solo-place"]')];
    if (!huecos.length) break;
    const guardada = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    const actual = guardada.current;
    // El hueco correcto: el primero cuya carta ya colocada valga más que la de la mano.
    let destino = guardada.timeline.findIndex(id => valor.get(id) > valor.get(actual));
    if (destino === -1) destino = guardada.timeline.length;
    // Y el incorrecto, para las partidas que tienen que fallar: cualquier otro.
    if (turno >= fallarDesde) destino = destino === 0 ? guardada.timeline.length : 0;
    click(w, `[data-action="solo-place"][data-index="${destino}"]`);
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  const retos = JSON.parse(w.localStorage.getItem("hilo-retos-v1") || "{}");
  const dia = Object.keys(retos.history?.days || {})[0] || "";
  return { partida: JSON.parse(w.localStorage.getItem("hilo-solo-history-v1")), dia, retos: retos.history };
}

console.log("\nEl mazo del día es el mismo en el móvil y en el servidor");
{
  const { partida, dia } = juegaRetoDiario();
  const { salida, porJugar } = mazoDelDia(CT, dia, "history");
  ok("el reto se ha jugado entero", partida.jugadas.length === CARTAS_RETO);
  ok("la carta de salida coincide con la del servidor", partida.timeline.includes(salida) || partida.cartas.includes(salida));
  ok("las cartas jugadas son las del servidor y en su orden", JSON.stringify(partida.cartas) === JSON.stringify(porJugar));
}

console.log("\nUna partida perfecta se acepta");
{
  const { partida, dia, retos } = juegaRetoDiario();
  const entrada = {
    dia, mazo: "history", jugadas: partida.jugadas, cartas: partida.cartas,
    aciertos: retos.days[dia].hits, total: CARTAS_RETO,
    ms: CARTAS_RETO * 3000, huella: CT.deckFingerprint("history")
  };
  const veredicto = revisar(CT, entrada);
  ok("el juego la ha dado por perfecta", retos.days[dia].hits === CARTAS_RETO);
  ok("el servidor la acepta", veredicto.valida === true);
  ok("y cuenta los mismos aciertos", veredicto.aciertos === CARTAS_RETO);
  ok("los puntos son los aciertos", veredicto.puntos === CARTAS_RETO);
}

console.log("\nUna partida con fallos cuenta lo que de verdad se acertó");
{
  // Se falla desde la duodécima carta: tres fallos agotan las vidas y la partida
  // termina antes de las quince, que es el otro final posible del reto.
  const { partida, dia, retos } = juegaRetoDiario({ fallarDesde: 11 });
  const jugadas = partida.jugadas.length;
  ok("las vidas se agotaron antes de las quince cartas", jugadas === 14 && partida.lives === 0);
  const veredicto = revisar(CT, {
    dia, mazo: "history", jugadas: partida.jugadas, cartas: partida.cartas,
    aciertos: retos.days[dia].hits, total: CARTAS_RETO, ms: jugadas * 3000
  });
  ok("el servidor acepta una partida terminada por falta de vidas", veredicto.valida === true);
  ok("y cuenta los aciertos reales, no quince", veredicto.aciertos === jugadas - VIDAS);
}

console.log("\nLo que el servidor tiene que rechazar");
{
  const { partida, dia } = juegaRetoDiario();
  const base = { dia, mazo: "history", jugadas: partida.jugadas, cartas: partida.cartas, total: CARTAS_RETO, ms: 45000 };
  const rechaza = (etiqueta, cambios, motivo) => {
    const veredicto = revisar(CT, { ...base, aciertos: CARTAS_RETO, ...cambios });
    ok(`${etiqueta} · ${veredicto.motivo}`, veredicto.valida === false && veredicto.motivo === motivo);
  };

  // Lo más obvio que intentaría quien quisiera colarse: declarar quince aciertos sin
  // haber jugado. Las reglas de Firestore no pueden verlo; el servidor sí.
  rechaza("quince aciertos con tres jugadas", { jugadas: [0, 0, 0], cartas: partida.cartas.slice(0, 3) }, "aciertos-no-coinciden");
  rechaza("aciertos inflados sobre una partida real", { aciertos: CARTAS_RETO - 1, jugadas: partida.jugadas.slice(0, 3), cartas: partida.cartas.slice(0, 3) }, "partida-incompleta");
  rechaza("cartas que no son las del día", { cartas: [...partida.cartas].reverse() }, "carta-fuera-de-orden");
  rechaza("un hueco imposible", { jugadas: [99, ...partida.jugadas.slice(1)] }, "hueco-invalido");
  rechaza("quince cartas en dos segundos", { ms: 2000 }, "demasiado-rapido");
  rechaza("el mazo de otra versión del juego", { huella: "otra-huella" }, "mazo-distinto");
  rechaza("el reto de otro día", { dia: "2020-01-01" }, "carta-fuera-de-orden");
  rechaza("un mazo que no existe", { mazo: "inventado" }, "mazo-desconocido");
  rechaza("una fecha con otro formato", { dia: "15/09/2026" }, "dia-invalido");
  rechaza("más jugadas que cartas", { cartas: partida.cartas.slice(0, 3) }, "jugadas-invalidas");
}

console.log("\nLas pantallas nuevas funcionan sin Firebase");
{
  // Ni `cuenta.js` ni `ranking.js` se pueden cargar aquí: importan Firebase desde una
  // CDN y Node no resuelve una URL https. Eso es justo lo que hay que comprobar —que la
  // aplicación siga entera cuando esos módulos no llegan—, porque es lo que le pasa a
  // cualquiera que abra el juego sin conexión.
  const w = boot();
  const texto = () => w.document.body.textContent;
  click(w, '[data-action="perfil"]');
  ok("el perfil ofrece crear una cuenta", /Crear una cuenta o entrar/.test(texto()));

  click(w, '[data-action="cuenta"]');
  ok("la pantalla de la cuenta se abre", w.document.getElementById("app").dataset.screen === "cuenta");
  ok("empieza por el registro", !!w.document.querySelector('[data-cuenta-form="registro"]'));
  ok("el registro pide un nombre para la tabla", !!w.document.querySelector("#cuenta-nick"));
  click(w, '[data-action="cuenta-modo"][data-modo="entrar"]');
  ok("se puede cambiar a entrar con una cuenta ya creada", !!w.document.querySelector('[data-cuenta-form="entrar"]'));
  ok("entrar no pide nombre, que ya lo tiene la cuenta", !w.document.querySelector("#cuenta-nick"));
  click(w, ".atlas-back");
  ok("la flecha de la cabecera devuelve al perfil", /Tu progreso/.test(texto()));

  click(w, '[data-action="home-top"]');
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  ok("el solitario enlaza con la clasificación", !!w.document.querySelector('[data-action="ranking"]'));
}

console.log("\nLa semana a la que pertenece cada día");
{
  // `semanaDe` vive en `ranking.js`, que importa Firebase desde una CDN y no se puede
  // cargar aquí. Se comprueba la misma regla ISO: la semana es la de su jueves.
  const semanaDe = dia => {
    const fecha = new Date(`${dia}T00:00:00Z`);
    const jueves = new Date(fecha);
    jueves.setUTCDate(jueves.getUTCDate() + 3 - ((jueves.getUTCDay() + 6) % 7));
    const enero4 = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
    const semana = 1 + Math.round(((jueves - enero4) / 86400000 - 3 + ((enero4.getUTCDay() + 6) % 7)) / 7);
    return `${jueves.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
  };
  ok("el código de ranking.js no se ha separado de esta copia", read("ranking.js").includes("jueves.setUTCDate(jueves.getUTCDate() + 3 - ((jueves.getUTCDay() + 6) % 7))"));
  ok("un lunes y el domingo siguiente caen en la misma semana", semanaDe("2026-09-14") === semanaDe("2026-09-20"));
  ok("el lunes siguiente ya es otra", semanaDe("2026-09-21") !== semanaDe("2026-09-20"));
  // El 1 de enero de 2027 es viernes: pertenece a la semana 53 de 2026, no a la 1 de 2027.
  ok("el cambio de año sigue la regla del jueves", semanaDe("2027-01-01") === "2026-W53");
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
