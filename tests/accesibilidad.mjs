import {gameHtml} from './game-fixture.mjs';
// Que la partida se pueda seguir con teclado y con lector de pantalla. Son dos cosas
// distintas y las dos se rompen solas en cuanto alguien añade una pantalla nueva:
//
// - El foco. La aplicación repinta entera en cada acción, así que el foco hay que
//   devolverlo a mano. Si esto falla, tras cada jugada hay que tabular desde el principio.
// - Lo que se anuncia. Colocar una carta no cambia ningún titular, así que si no pasa por
//   la región viva, quien no ve la pantalla no se entera de nada.
//
// Y al final, el contraste de las bandas de época, que es puro dato y no cuesta nada
// comprobar: texto blanco sobre color, mínimo 4,5 a 1.
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

function boot(mode = null) {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://continuum.test/" });
  const { window } = dom;
  // jsdom no maquetiza, así que no tiene scrollIntoView; y al pulsar tampoco enfoca, que
  // es lo que hace un navegador de verdad con un botón. Las dos cosas se suplen aquí.
  window.Element.prototype.scrollIntoView = function () {};
  if (mode) window.localStorage.setItem("hilo-selected-mode-v1", mode);
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const el = (w, sel) => { const nodo = w.document.querySelector(sel); if (!nodo) throw new Error(`no existe ${sel}`); return nodo; };
const click = (w, sel) => {
  const nodo = el(w, sel);
  nodo.focus();
  nodo.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const tecla = (w, key) => w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const activo = w => w.document.activeElement;
// `announce` espera un poco antes de escribir, para que repetir el mismo texto vuelva a
// anunciarse; hay que darle ese margen.
const respira = () => new Promise(r => setTimeout(r, 80));

function partida(w) {
  click(irAJugar(w), '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  click(w, '[data-format="multi"]');
  click(w, '[data-action="setup"]');
  click(w, '[data-action="start"]');
  click(w, '[data-action="ready"]');
}

console.log("\nEl foco no se pierde al repintar");
{
  const w = boot();
  partida(w);
  ok("al entrar en la partida el foco va a su titular", activo(w) === el(w, "h1[data-focus]"));

  const carta = w.document.querySelector(".hand-card");
  const id = carta.dataset.id;
  click(w, ".hand-card");
  ok("elegir una carta deja el foco en esa misma carta", activo(w) === el(w, `.hand-card[data-id="${id}"]`));

  click(w, '.slot[data-index="1"]');
  ok("elegir un hueco lleva el foco a la confirmación", activo(w) === el(w, '[data-action="confirm-place"]'));

  click(w, '[data-action="cancel-place"]');
  ok("cancelar no deja el foco en el aire", w.document.querySelector(".shell").contains(activo(w)));
}

console.log("\nLas capas son diálogos de verdad");
{
  const w = boot();
  click(w, '[data-action="rules"]');
  const modal = el(w, ".overlay .modal");
  ok("se anuncia como diálogo", modal.getAttribute("role") === "dialog" && modal.getAttribute("aria-modal") === "true");
  ok("y con nombre, tomado de su titular", modal.getAttribute("aria-labelledby") === el(w, ".overlay .modal h1, .overlay .modal h2").id);
  ok("el foco entra dentro", modal.contains(activo(w)));

  const abrio = el(w, '[data-action="rules"]');
  tecla(w, "Escape");
  ok("Escape cierra las reglas", !w.document.querySelector(".overlay"));
  // Devolver el foco espera a que el navegador confirme que la capa se ha ido.
  await respira();
  ok("y el foco vuelve al botón que las abrió", activo(w) === abrio);
  click(w, '[data-action="rules"]');
  ok("la guía ofrece un aspa con nombre accesible", el(w, '.guide-close')?.getAttribute('aria-label') === 'Cerrar guía');
  click(w, '.guide-close');
  await respira();
  ok("el aspa cierra la guía y recupera el foco", !w.document.querySelector('.overlay') && activo(w) === abrio);
}

console.log("\nLas reglas se adaptan al mazo");
{
  const w = boot("animals");
  click(w, '[data-action="rules"]');
  const texto = el(w, ".overlay .modal").textContent;
  ok("peso muestra su dato oculto", /peso oculto/i.test(texto));
  // El aviso debe reflejar las referencias pendientes, sin ocultarlas ni inventarlas.
  ["animals", "lifespan", "speed"].forEach(mazo => ok(`${mazo} explica sus cartas pendientes de revisión`, /en revisión/.test(w.CONTINUUM.guideMarkup(mazo, "local")) === w.CONTINUUM.cards(mazo).some(card => card.reviewStatus === 'pending')));
  ok("los empates exactos se admiten", /mismo valor/.test(texto));
  // Los dos poderes se explican fuera del solitario, y la ficha dice además si están en
  // juego o hay que encenderlos antes de empezar.
  const conPulso = w.CONTINUUM.guideMarkup("history", "local", { pulse: true });
  ok("el Pulso se explica fuera de solitario", /Pulso/.test(conPulso) && /Los dos colocáis/.test(conPulso));
  ok("y la guía dice si está en juego o no", /en juego/.test(conPulso) && /opcional/.test(w.CONTINUUM.guideMarkup("history", "local", { pulse: false })));
  ok("los tres pasos de una jugada están numerados", [1, 2, 3].every(n => new RegExp(`gs-num[^>]*>${n}<`).test(conPulso)));
  ok("la primera colocación usa cartas de verdad del mazo", /data-guide-practice/.test(conPulso) && /Fecha oculta/.test(conPulso));
  ok("la colocación ofrece tres huecos interactivos", (conPulso.match(/data-guide-place=/g)||[]).length === 3);
  ok("el reto diario se explica en solitario", /reto diario/i.test(w.CONTINUUM.guideMarkup("history", "solo")));
  ok("la competición explica sus rondas", /cinco cartas/i.test(w.CONTINUUM.guideMarkup("history", "competition")));
  ok("la guía online explica al anfitrión", /anfitrión/i.test(w.CONTINUUM.guideMarkup("history", "online")));
  click(w,'[data-guide-place="1"]');
  ok("acertar la práctica revela el valor", !el(w,'[data-guide-value]').hidden && /Exacto/.test(el(w,'[data-guide-feedback]').textContent));
  click(w,'[data-guide-reset]');
  ok("la práctica se puede repetir", el(w,'[data-guide-value]').hidden && !el(w,'[data-guide-place="0"]').disabled);
  const saved = JSON.stringify({...w.localStorage});
  click(w, '[data-guide-place="0"]');
  ok("un ensayo fallido invita a volver a probar", /Prueba otro hueco/.test(el(w, '[data-guide-feedback]').textContent));
  click(w, '[data-guide-place="1"]');
  ok("el ensayo no modifica partidas ni progreso", JSON.stringify({...w.localStorage}) === saved);
  ok("el ejemplo incluye tres ilustraciones reales", w.document.querySelectorAll('.guide-practice img').length === 3);
  const chapters = [...w.document.querySelectorAll('[data-guide-chapter]')];
  ok("seis capítulos cubren todas las reglas sin desplegarlas de golpe", chapters.length === 6 && chapters.every(chapter => !chapter.open));
  chapters[0].open = true;
  await respira();
  chapters[1].open = true;
  await respira();
  ok("abrir otro capítulo recoge el anterior", !chapters[0].open && chapters[1].open);
  ok("las salas explican el reloj configurable", /20, 30 o 45/.test(chapters[1].textContent));
  ok("el duelo tiene su excepción de vidas", /Sin límite de vidas/.test(chapters[1].textContent));
  ok("Pulso explica sus cuatro resultados", chapters[2].querySelectorAll('tbody tr').length === 4);
  for (const [key, info] of Object.entries(w.CONTINUUM.MODES)) {
    const markup = w.CONTINUUM.guideMarkup(key, 'solo');
    ok(key + ": guía completa y eje correcto", markup.includes('data-guide-chapter="06"') && markup.includes(info.axis === 'time' ? 'de antes a después' : 'de menor a mayor'));
  }
}
{
  const w = boot();
  partida(w);
  click(w, ".hand-card");
  click(w, '.slot[data-index="0"]');
  click(w, '[data-action="confirm-place"]');
  const modal = el(w, ".overlay .modal");
  ok("el resultado integrado no bloquea el tablero", modal.getAttribute("role") === "dialog" && modal.getAttribute("aria-modal") === "false");
  ok("con el foco en su único botón", activo(w) === el(w, '[data-action="finish-turn"]'));
  ok("el resultado se lee junto al nombre de la carta", /Bien colocado:|No encaja ahí:/.test(el(w, ".overlay .modal h2").textContent));
  tecla(w, "Escape");
  ok("Escape no descarta el revelado, que es un paso obligado", !!w.document.querySelector(".overlay"));
}

console.log("\nLo que no se ve, se anuncia");
{
  const w = boot();
  partida(w);
  const titulo = w.document.querySelector(".hand-card strong").textContent;
  click(w, ".hand-card");
  await respira();
  const region = el(w, "#anuncio");
  ok("la región viva existe y es educada", region.getAttribute("aria-live") === "polite");
  ok("elegir carta se anuncia con su nombre", region.textContent.includes(titulo));

  click(w, '.slot[data-index="1"]');
  await respira();
  ok("elegir hueco dice cuál de cuántos", /Hueco 2 de \d+/.test(region.textContent));
}

console.log("\nEstado de los controles");
{
  const w = boot();
  partida(w);
  ok("las cartas de la mano dicen si están elegidas", [...w.document.querySelectorAll(".hand-card")].every(c => c.hasAttribute("aria-pressed")));
  click(w, ".hand-card");
  ok("y la elegida lo refleja", el(w, ".hand-card").getAttribute("aria-pressed") === "true");
  ok("el marcador señala a quién le toca", w.document.querySelectorAll('.score[aria-current="true"]').length === 1);
  ok("los huecos se describen por su posición", [...w.document.querySelectorAll(".slot")].every(s => /Colocar en la posición \d+ de \d+/.test(s.getAttribute("aria-label") || "")));
}

console.log("\nEl perfil");
{
  const w = boot();
  const nav = [...w.document.querySelectorAll(".home-nav button")];
  ok("los cinco destinos de la portada tienen nombre", nav.length === 5 && nav.every(b => b.getAttribute("aria-label")));

  click(w, '[data-action="perfil"]');
  ok("el foco va al titular de la pantalla", activo(w) === el(w, "h1[data-focus]"));
  ok("las agrupaciones de logros se nombran", [...w.document.querySelectorAll(".logro-grid")].every(g => g.getAttribute("role") === "group" && g.getAttribute("aria-label")));
  // La barra de progreso es puro color y anchura: sin esto, quien no la ve no sabe
  // cuánto lleva de un logro. El número también está escrito al lado, en texto.
  const barras = [...w.document.querySelectorAll(".logro-bar")];
  ok(`las barras de progreso dicen su valor (${barras.length})`, barras.length > 0 && barras.every(b => /^\d+ de \d+$/.test(b.getAttribute("aria-label") || "")));
  ok("la estrella de cada logro no es la única señal: hay texto", [...w.document.querySelectorAll(".logro")].every(l => l.querySelector("b")?.textContent.trim()));
  ok("los símbolos decorativos se ocultan al lector", [...w.document.querySelectorAll(".logro-mark")].every(m => m.getAttribute("aria-hidden") === "true"));
}
{
  // Un punto débil es un botón que lleva a otra pantalla: tiene que decir lo suficiente
  // por sí solo, no solo «→».
  const w = boot();
  w.localStorage.setItem("hilo-perfil-v1", JSON.stringify({
    version: 1,
    totals: { games: 1, cards: 10, hits: 1, wins: 0, run: 0, bestRun: 1 },
    byBand: { "history:antigua": { mode: "history", band: "antigua", hits: 1, misses: 9 } },
    misses: { [read("cards.js").match(/id: (\d+)/)[1]]: { mode: "history", count: 4, lastDay: "2026-02-02" } }
  }));
  click(w, '[data-action="perfil"]');
  const filas = [...w.document.querySelectorAll(".weak-row")];
  ok(`hay puntos débiles que revisar (${filas.length})`, filas.length >= 2);
  ok("cada uno dice de qué carta o tramo habla, y de qué mazo", filas.every(f => (f.textContent.match(/\S/g) || []).length > 10));
  ok("la flecha no cuenta como parte del nombre", filas.every(f => f.querySelector("i")?.getAttribute("aria-hidden") === "true"));
}

// El tema oscuro solo puede cambiar variables. Una superficie con el color escrito a pelo
// dentro de su regla se queda clara también de noche, y como la tinta sí cambia, el texto
// encima se vuelve ilegible. Pasó con los paneles, los campos, las filas y la carta de la
// línea: se leía blanco sobre papel. Esto vigila que cada superficie del pergamino siga
// teniendo su versión oscura.
console.log("\nCada superficie del tema claro tiene su versión oscura");
{
  const css = read("styles.css");
  // El último de cada uno, no el primero: los bloques de la paleta anterior siguen
  // arriba en el archivo y son los que ganarían un `indexOf`.
  const bloque = (inicio, fin) => {
    const desde = css.lastIndexOf(inicio);
    return desde === -1 ? "" : css.slice(desde, css.indexOf(fin, desde));
  };
  // El `:root` del pergamino no es el primero del archivo —antes está la paleta que
  // sustituyó—, así que se busca hacia atrás desde la primera de sus variables.
  const pergamino = css.slice(css.lastIndexOf(":root {", css.indexOf("--vitela:")));
  const superficies = [...pergamino.slice(0, pergamino.indexOf("}")).matchAll(/(--[a-z-]+):/g)].map(m => m[1])
    .filter(v => !["--font-display", "--ease-out", "--ease-spring"].includes(v));
  const interruptor = bloque(':root[data-theme="dark"] {', "}");

  ok(`se encuentran las superficies del pergamino (${superficies.length})`, superficies.length > 20);
  ok("se encuentra el bloque oscuro", interruptor.length > 200);

  // Las que son deliberadamente iguales en los dos temas, por ser objetos de la mesa y no
  // superficies de la interfaz: la carta de la línea es papel de día y de noche.
  const iguales = ["--carta-tinta", "--carta-dato", "--accent-solid", "--green-solid", "--teal", "--green", "--shadow", "--shadow-soft", "--motion-fast", "--motion-base", "--motion-slow"];
  const pendientes = superficies.filter(v => !iguales.includes(v))
    .filter(v => !interruptor.includes(`${v}:`));
  ok(`ninguna superficie se queda sin versión oscura${pendientes.length ? ` (falta ${pendientes.join(", ")})` : ""}`, !pendientes.length);

  // Y ninguna regla nueva del pergamino vuelve a escribir un fondo claro a mano. Quedan
  // seis, todas a propósito: o son objetos de la mesa —la carta de la línea, el marco de
  // la portada—, o llevan su propia tinta oscura encima y no dependen del tema. Si
  // aparece una séptima hay que decidir a cuál de los dos grupos pertenece: si no es
  // ninguno, necesita variable y versión oscura como las demás.
  const APROPOSITO = [
    "#d9b56f",              // el marco de la portada: adorno, sin texto encima
    "rgba(255,237,192,.53)", // el círculo del icono de formato, con su tinta #75451f
    "#f0d292",              // el mismo círculo en el formato destacado, con su #8d3c1b
    "rgba(232,204,149,.94)", // la barra de la portada, ya sustituida en los bloques oscuros
    "#c9a66b",              // la lámina de la carta de animal
    "#f4ddb0"               // el sello de temática, sobre esa misma carta de papel
  ];
  const desde = css.indexOf("--vitela:");
  const hasta = css.indexOf(':root[data-theme="dark"]', desde);
  const aPelo = [...css.slice(desde, hasta).matchAll(/^\.[^\n{]*\{[^}]*background: (rgba?\([^)]*\)|#[0-9a-f]{3,6})[;\s]/gm)]
    .map(m => m[1])
    .filter(color => {
      const canales = color.startsWith("#")
        ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
        : color.match(/[\d.]+/g).slice(0, 3).map(Number);
      return canales.reduce((a, b) => a + b, 0) / 3 > 150;
    })
    .filter(color => !APROPOSITO.includes(color));
  ok(`ningún fondo claro nuevo escrito a mano${aPelo.length ? ` (${aPelo.join(", ")})` : ""}`, !aPelo.length);
}

// En móvil la cabecera pasa a columna: el nombre arriba y los botones debajo, centrados.
// En una columna, la alineación horizontal la decide `align-items`, no `justify-content`,
// y un `margin-left: auto` en las acciones sobrevive al cambio y las empuja a un lado.
// Las dos cosas pasaron y dejaron los botones descolocados sin que fallara nada.
console.log("\nLa cabecera se centra en móvil");
{
  const css = read("styles.css");
  const regla = css.match(/^\.topbar \{[^}]*\}/m)?.[0] || "";
  const acciones = css.match(/^\.topbar-actions \{[^}]*\}/m)?.[0] || "";
  ok("se encuentran las dos reglas base", !!regla && !!acciones);
  ok(`la barra alinea al centro${/align-items: center/.test(regla) ? "" : ` (dice «${regla.match(/align-items: [^;]*/)?.[0]}»)`}`, /align-items: center/.test(regla));
  ok("las acciones no llevan margen automático, que sobrevive a la columna", !/margin-left: auto/.test(acciones));

  // Y el bloque que pone la columna sigue existiendo: si desapareciera, lo de arriba
  // dejaría de tener sentido y habría que revisar esta prueba entera.
  const columna = css.slice(css.indexOf("@media (max-width: 620px)"));
  ok("el bloque de móvil sigue poniendo la cabecera en columna", /\.topbar \{[^}]*flex-direction: column/.test(columna));
  ok("y centrando las acciones", /\.topbar-actions \{[^}]*justify-content: center/.test(columna));
}

// Cada aspecto nuevo es una paleta entera, y una paleta se estropea sin que falle nada:
// basta con un papel un punto más claro para que el rótulo pequeño de encima deje de
// leerse. Esto es puro dato —los seis colores de la edición, el mismo cálculo de la WCAG
// que las bandas— y cubre los dos temas.
console.log("\nContraste de los temas de la interfaz");
{
  const css = read("edition.css");
  const lineal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const completo = hex => hex.length === 4 ? "#" + [...hex.slice(1)].map(c => c + c).join("") : hex;
  const canales = hex => [1, 3, 5].map(i => parseInt(completo(hex).slice(i, i + 2), 16));
  const luz = hex => { const [r, g, b] = canales(hex).map(lineal); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const razon = (a, b) => (Math.max(luz(a), luz(b)) + 0.05) / (Math.min(luz(a), luz(b)) + 0.05);

  // El primer `:root` es el aspecto claro; los demás llevan su `data-theme` en el selector.
  const paleta = selector => {
    const desde = css.indexOf(selector);
    if (desde === -1) return null;
    const bloque = css.slice(desde, css.indexOf("}", desde));
    const color = nombre => bloque.match(new RegExp(`--edition-${nombre}: *(#[0-9a-f]{3,6})`))?.[1];
    const valores = { paper: color("paper"), surface: color("surface"), ink: color("ink"), muted: color("muted"), brass: color("brass") };
    return Object.values(valores).every(Boolean) ? valores : null;
  };
  const aspectos = {
    "claro": ":root {",
    "oscuro": ':root[data-theme="dark"] {'
  };

  for (const [nombre, selector] of Object.entries(aspectos)) {
    const tema = paleta(selector);
    ok(`${nombre}: se encuentran sus seis colores`, !!tema);
    if (!tema) continue;
    // Tinta y texto apagado son texto corriente; el latón son los rótulos pequeños (el
    // lema, los capítulos, la numeración), que es donde más se nota quedarse corto.
    const pares = [
      ["tinta sobre papel", tema.ink, tema.paper],
      ["tinta sobre superficie", tema.ink, tema.surface],
      ["texto apagado sobre papel", tema.muted, tema.paper],
      ["texto apagado sobre superficie", tema.muted, tema.surface],
      ["latón sobre papel", tema.brass, tema.paper],
      ["latón sobre superficie", tema.brass, tema.surface]
    ];
    const flojos = pares.filter(([, a, b]) => razon(a, b) < 4.5);
    ok(`${nombre}: sus seis pares llegan a 4,5:1${flojos.length ? ` (falla ${flojos.map(([e, a, b]) => `${e} ${razon(a, b).toFixed(2)}`).join(", ")})` : ""}`, !flojos.length);
  }
}

console.log("\nContraste de las bandas de época");
{
  const css = read("styles.css");
  const bandas = [...css.matchAll(/^\.era-([a-z]+) \{ background: (#[0-9a-f]{6}); \}/gm)];
  const lineal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const canales = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const luz = hex => { const [r, g, b] = canales(hex).map(lineal); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // El texto de la banda es blanco al 92% sobre el color, así que se compone antes.
  const sobre = hex => "#" + canales(hex).map(c => Math.round(255 * 0.92 + c * 0.08).toString(16).padStart(2, "0")).join("");
  const razon = (a, b) => (Math.max(luz(a), luz(b)) + 0.05) / (Math.min(luz(a), luz(b)) + 0.05);

  ok(`se encuentran las bandas en la hoja de estilo (${bandas.length})`, bandas.length > 20);
  const flojas = bandas.filter(([, , color]) => razon(sobre(color), color) < 4.5);
  ok(`todas llegan a 4,5:1${flojas.length ? ` (falla ${flojas.map(m => `${m[1]} ${razon(sobre(m[2]), m[2]).toFixed(2)}`).join(", ")})` : ""}`, !flojas.length);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
