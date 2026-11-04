import { ok, fail } from "./lib/comun.mjs";
import { arrancarJuego } from "./lib/dom.mjs";
// La competición con las mismas cartas: varios temas por enlace. Quien la crea la juega y manda
// el enlace; quien lo abre, en otro móvil, juega los mismos temas y las mismas cartas y ve el
// cara a cara. Se comprueba el formulario, el formato del enlace (también ante una aplicación
// que no lo conoce y ante enlaces estropeados), la partida entera de las dos partes, el guardado
// aparte de la competición en solitario y que el reloj no se pare al salir.

const COMP_DUELO = "continuum-competition-duel-v1";
const COMP_SOLO = "continuum-competition-v1";

// Un «móvil» con su nombre, su reloj y su menú de compartir. `url` lo arranca sobre un enlace.
function boot({ url = "https://hilo.test/", nombre = "Ana", almacen = {} } = {}) {
  const reloj = { ahora: Date.now() };
  const w = arrancarJuego({ url, almacen: { "continuum-identidad-v1": JSON.stringify({ nombre }), ...almacen }, antes: w => {
    w.Element.prototype.scrollIntoView = function () {};
    w.scrollTo = () => {};
    w.Date.now = () => reloj.ahora;
    w.navigator.share = async ({ text }) => { w.compartido = text; };
  } });
  w.avanza = ms => { reloj.ahora += ms; };
  return w;
}
const duerme = ms => new Promise(listo => setTimeout(listo, ms));
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;
const visible = el => !!el && !el.closest("[hidden]");
const guardada = w => JSON.parse(w.localStorage.getItem(COMP_DUELO) || "null");
function cambia(w, el, valor) {
  if (el.type === "radio") el.checked = true; else el.value = String(valor);
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}
function abreCompeticion(w) {
  w.CONTINUUM.ModeHubs.open("hub-friends-online");
  click(w, '[data-action="competition-menu"]');
}
// Juega la competición en curso, tema a tema, acertando o fallando a voluntad (`falla(i)`, con
// `i` la carta en el total). Devuelve la cuadrícula y las cartas que salieron, en orden.
function juegaCompeticion(w, { falla = () => false } = {}) {
  const secuencia = [], cartas = [];
  let lineaTrasFallo = null;
  for (let vueltas = 0; vueltas < 200; vueltas++) {
    if (existe(w, '[data-action="comp-next-round"]')) { click(w, '[data-action="comp-next-round"]'); continue; }
    if (!existe(w, '[data-action="solo-place"]')) break;
    const c = guardada(w), estado = c.solo, mode = estado.mode;
    const mazo = new Map(c.decks[mode].map(card => [card.id, card]));
    const bien = w.CONTINUUM.correctIndex(mode, estado.timeline.map(id => mazo.get(id)), mazo.get(estado.current));
    const fallar = falla(secuencia.length);
    secuencia.push(!fallar);
    cartas.push(`${mode}:${estado.current}`);
    const largo = estado.timeline.length;
    w.document.querySelectorAll('[data-action="solo-place"]')[fallar ? (bien === 0 ? largo : 0) : bien].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
    // La primera carta fallada a mitad de tema: la línea que queda detrás de ella.
    if (fallar && !lineaTrasFallo && guardada(w)?.solo) lineaTrasFallo = { antes: largo, despues: guardada(w).solo.timeline.length };
  }
  return { secuencia, cartas, lineaTrasFallo };
}
const enlaceDe = textoCompartido => textoCompartido.match(/#duelo=([A-Za-z0-9_-]+)/)?.[1];

console.log("\nLa competición con amigos: en directo o por turnos");
{
  const w = boot();
  abreCompeticion(w);
  const ritmos = [...w.document.querySelectorAll('input[name="comp-pace"]')].map(i => i.value);
  ok("hay dos ritmos: en directo y por turnos", ritmos.join() === "directo,turnos");
  ok("sin «Mismas cartas»", !/Mismas cartas/.test(texto(w)));
  ok("sin textos de explicación debajo de los ajustes", !existe(w, ".duel-brief"));
  // Un «Mismas cartas» guardado de antes cae en directo.
  w.localStorage.setItem("hilo-competicion-ritmo-v1", "seguidos");
  abreCompeticion(w);
  ok("un ritmo guardado que ya no existe se muestra en directo", w.document.querySelector('input[name="comp-pace"]:checked').value === "directo");
  cambia(w, w.document.querySelector('input[name="comp-pace"][value="turnos"]'));
  ok("el ritmo se recuerda", w.localStorage.getItem("hilo-competicion-ritmo-v1") === "turnos");
  ok("por turnos, sin conexión ni máximo de jugadores", [...w.document.querySelectorAll("[data-comp-net-field]")].every(el => el.hidden));
  ok("el botón dice «Empezar competición»", /Empezar competición/.test(w.document.querySelector('[data-action="comp-friends-start"]').textContent));
  w.close();
}

console.log("\nEl enlace de la competición");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo, C = D.Competicion;
  const temas = w.CONTINUUM.Tournament.modes().slice(0, 3);
  const secuencia = [true, false, true, true, false, false];
  const payload = C.codificar({ temas, seed: "ab12cd", porTema: 2, sequence: secuencia, nombre: "Ana", ms: 20000 });
  const plano = w.CONTINUUM.LocalTransport.decodeText(payload).split("|");
  ok("conserva los ocho campos del duelo", plano.length === 8);
  // Las versiones 1 a 9 son las que conocía una aplicación anterior: la de la competición no es
  // ninguna, así que esa aplicación pide actualizar en vez de dar el enlace por roto.
  ok("con una versión que una aplicación anterior no conoce", !["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(plano[0]));
  ok("el enlace es corto", D.enlace(payload).length < 400);
  const leido = D.descodificar(payload);
  ok("da la vuelta entera", leido.ok && leido.duelo.competicion && leido.duelo.temas.join() === temas.join() && leido.duelo.porTema === 2 && leido.duelo.total === 6 && leido.duelo.ms === 20000);
  ok("con la marca y la cuadrícula", leido.ok && leido.duelo.rival.hits === 3 && leido.duelo.rival.sequence.join() === secuencia.join() && leido.duelo.rival.nombre === "Ana");
  for (const ms of [0, 15000, 30000]) {
    const otro = D.descodificar(C.codificar({ temas, seed: "ab12cd", porTema: 2, sequence: secuencia, nombre: "Ana", ms }));
    ok(`el plazo de ${ms / 1000} s viaja en el enlace`, otro.ok && otro.duelo.ms === ms);
  }
  const conCampos = cambios => {
    const campos = [...plano];
    Object.entries(cambios).forEach(([i, valor]) => { campos[i] = valor; });
    return D.descodificar(w.CONTINUUM.LocalTransport.encodeText(campos.join("|")));
  };
  const huellas = plano[6].split(",");
  const malos = [
    ["con un tema repetido", { 1: [temas[0], temas[0], temas[2]].join(",") }, "roto"],
    ["con Gran mezcla", { 1: ["mixed", temas[1], temas[2]].join(","), 6: [w.CONTINUUM.Duelo.huella("mixed"), huellas[1], huellas[2]].join(",") }, "roto"],
    ["con un mazo que no existe", { 1: ["nomazo", temas[1], temas[2]].join(",") }, "mazo"],
    ["con seis temas", { 1: Array.from({ length: 6 }, (_, i) => w.CONTINUUM.Tournament.modes()[i]).join(",") }, "roto"],
    ["con siete cartas por tema", { 3: "7", 5: "1".repeat(21), 4: "21" }, "roto"],
    ["con una cuadrícula que no cuadra con los aciertos", { 4: "4" }, "roto"],
    ["con una cuadrícula corta", { 5: "10110" }, "roto"],
    ["con una huella de menos", { 6: huellas.slice(0, 2).join(",") }, "roto"],
    ["con otra versión de un mazo", { 6: [huellas[0], "v3.1.x", huellas[2]].join(",") }, "mazo-distinto"],
    ["con una semilla rara", { 2: "AB-12" }, "roto"]
  ];
  for (const [nombre, cambios, motivo] of malos) {
    const r = conCampos(cambios);
    ok(`un enlace ${nombre} se rechaza («${motivo}»)`, r.ok === false && r.motivo === motivo);
  }
  // Los duelos de un mazo siguen igual.
  const duelo = D.codificar({ mode: temas[0], seed: "xyz", total: 10, hits: 3, sequence: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0].map(Boolean), nombre: "Bea", ms: 15000 });
  const leidoDuelo = D.descodificar(duelo);
  ok("un duelo de un mazo se sigue leyendo como antes", leidoDuelo.ok && !leidoDuelo.duelo.competicion && leidoDuelo.duelo.mode === temas[0]);
  ok("y con su versión de siempre", w.CONTINUUM.LocalTransport.decodeText(duelo).split("|")[0] === "4");
  w.close();
}

// Los enlaces de competición ya no se crean desde la pantalla: se abren los que alguien mandó antes. Se prepara uno.
let enlace = null, temasAna = null;
{
  const w = boot({ nombre: "Ana" });
  const D = w.CONTINUUM.Duelo, C = D.Competicion;
  temasAna = w.CONTINUUM.Tournament.modes().slice(0, 3);
  enlace = C.codificar({ temas: temasAna, seed: "ana12345", porTema: 2, sequence: [true, false, true, true, true, true], nombre: "Ana", ms: 30000 });
  w.close();
}

console.log("\nQuien lo abre juega lo mismo y ve el cara a cara");
{
  const w = boot({ url: `https://hilo.test/#duelo=${enlace}`, nombre: "Bea" });
  ok("se presenta el reto", /Ana te reta/.test(texto(w)) && /3 temas al azar/.test(texto(w)) && /5 de 6/.test(texto(w)) && /30 segundos por carta/.test(texto(w)));
  ok("sin nombrar ningún tema", temasAna.every(t => !texto(w).includes(w.CONTINUUM.mode(t).name)));
  click(w, '[data-action="accept-duel"]');
  ok("antes de jugar, la marca de enfrente", /la marca de Ana/.test(texto(w)));
  click(w, '[data-action="back-menu"]');
  ok("volver desde ahí enseña otra vez el reto", /Ana te reta/.test(texto(w)) && existe(w, '[data-action="accept-duel"]'));
  click(w, '[data-action="accept-duel"]');
  click(w, '[data-action="duel-play"]');
  ok("con los temas del enlace, en su orden", guardada(w)?.duelo.temas.join() === temasAna.join());
  const jugada = juegaCompeticion(w);
  ok("se juegan los seis cartas de los tres temas, en su orden", jugada.cartas.length === 6 && jugada.cartas.every((c, i) => c.startsWith(temasAna[Math.floor(i / 2)] + ":")));
  ok("gana quien más acierta", /Has ganado la competición/.test(texto(w)) && /6 a 5/.test(texto(w)));
  ok("tema a tema", w.document.querySelectorAll(".comp-summary li").length === 3 && /Tú 2 · Ana 1/.test(texto(w)));
  ok("con las dos cuadrículas", w.document.querySelectorAll(".duel-row i").length === 12);
  const p = w.CONTINUUM.Progreso.read();
  ok("cuenta como duelo ganado", p.marks.duelWins === 1 && p.totals.wins === 1 && p.marks.comps === 1);
  click(w, '[data-action="share-duel"]');
  await duerme(10);
  ok("el resultado se comparte partido por temas", /Gano yo: 6 a 5/.test(w.compartido || "") && /Yo 🟩🟩 🟩🟩 🟩🟩/.test(w.compartido || ""));
  ok("ya no se ofrece devolver el reto con un enlace nuevo", !existe(w, '[data-action="comp-duel-rematch"]'));
  w.close();
}

console.log("\nCon las mismas cartas, el reloj no se para");
{
  const w = boot({ url: `https://hilo.test/#duelo=${enlace}`, nombre: "Ana" });
  click(w, '[data-action="accept-duel"]');
  click(w, '[data-action="duel-play"]');
  click(w, '[data-action="comp-next-round"]');
  ok("en la partida no hay vidas", !existe(w, ".vida"));
  const almacen = Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
  w.close();
  // El móvil se cierra con la carta delante y se vuelve a abrir más tarde.
  const otra = boot({ nombre: "Ana", almacen });
  otra.avanza(5000);
  abreCompeticion(otra);
  ok("se ofrece seguirla", existe(otra, '[data-action="resume-comp-duel"]'));
  click(otra, '[data-action="resume-comp-duel"]');
  click(otra, '[data-action="comp-confirm-resume"]');
  ok("la carta que estaba abierta se da por cerrada", /Carta cerrada/.test(texto(otra)));
  ok("y cuenta como jugada", guardada(otra).solo.played === 1 && guardada(otra).solo.hits === 0);
  otra.close();
}

console.log("\nLa Guía la explica");
{
  const w = boot();
  const guia = w.CONTINUUM.guideMarkup("history", "competition");
  ok("en el capítulo de la competición, sin «Mismas cartas»", /Por turnos/.test(guia) && !/Con las mismas cartas/.test(guia));
  w.close();
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
