// El catálogo que sale a la tienda: de Grandes colecciones solo Historia, Naturaleza y
// Geografía (`PUBLISHED_BLOCKS` en js/juego/modes.js). Entretenimiento, Ciencia y Gran mezcla
// temporal siguen en el juego para una segunda fase, pero ninguna pantalla los ofrece: ni
// abiertos, ni con candado, ni a la venta. Los Retos rápidos no cambian.
import { ok, fail } from "./lib/comun.mjs";
import { arrancarJuego } from "./lib/dom.mjs";

const PUBLICADAS = ["historia", "naturaleza", "geografia"];
const OCULTAS = ["cine", "ciencia", "mezcla"];
const MAZOS_OCULTOS = ["movies", "music", "videogames", "astronomy", "medicine", "mixed"];
const MAZOS_PUBLICADOS = ["history", "world", "inventions", "animals", "lifespan", "speed", "countries", "population", "languages", "distances"];
const NOMBRES_OCULTOS = /Entretenimiento|Estrenos de cine|Hitos de la música|Videojuegos|Astronom|Medicina|Gran mezcla|\bcine\b|\bciencia\b/i;

const boot = opciones => arrancarJuego({ antes: w => { w.Element.prototype.scrollIntoView = () => {}; }, ...opciones });
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error(`no existe ${sel}`); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
function irAJugar(w) { const d = w.document; if (!d.querySelector("[data-block]")) { w.CONTINUUM.ModeHubs.open("hub-solo"); if (!d.querySelector("[data-block]")) d.querySelector("[data-inline-route]")?.click(); } w.sessionStorage.removeItem("continuum-entry-route"); return w; }
const iguales = (a, b) => [...a].sort().join() === [...b].sort().join();

console.log("\nEl catálogo");
{
  const w = boot();
  const CT = w.CONTINUUM;
  ok("solo están publicadas Historia, Naturaleza y Geografía", iguales(Object.keys(CT.BLOCKS), PUBLICADAS));
  ok("los mazos ocultos siguen existiendo, con sus cartas", MAZOS_OCULTOS.every(key => CT.has(key) && CT.cards(key).length > 0));
  ok("ningún mazo oculto está publicado", MAZOS_OCULTOS.every(key => !CT.published(key)));
  ok("la cartera abre exactamente los mazos publicados", iguales(CT.Cartera.abiertos(), MAZOS_PUBLICADOS));
  ok("ningún mazo oculto se puede jugar", MAZOS_OCULTOS.every(key => !CT.Cartera.tiene(key)));
  ok("el catálogo publicado cuenta como abierto entero (sin candados)", CT.Cartera.todoAbierto());
  ok("nada oculto está a la venta", CT.Cartera.paquetes().every(p => p.mazos.every(key => !MAZOS_OCULTOS.includes(key))));
  const motivo = CT.Cartera.motivo("movies");
  ok("un mazo oculto no tiene precio ni maneras de comprarlo", motivo && !motivo.precio && motivo.opciones.length === 0);
  ok("el reto diario solo sale de mazos publicados", iguales(CT.Cartera.diarios(), MAZOS_PUBLICADOS));
  ok("los Retos rápidos siguen todos", (CT.QuickCatalog?.challenges || []).length > 0);
}

console.log("\nLa galería de Grandes colecciones");
{
  const w = irAJugar(boot());
  const d = w.document;
  const bloques = [...d.querySelectorAll("[data-block]")].map(el => el.dataset.block);
  ok("enseña solo las tres colecciones publicadas", iguales(new Set(bloques), PUBLICADAS));
  ok("ninguna colección oculta aparece", OCULTAS.every(key => !d.querySelector(`[data-block="${key}"]`)));
  for (const key of PUBLICADAS) {
    click(irAJugar(w), `[data-block="${key}"]`);
    const mazos = [...d.querySelectorAll(".collection-entry.active [data-mode]")].map(el => el.dataset.mode);
    ok(`${key}: sus mazos, sin candado`, mazos.length > 0 && mazos.every(m => MAZOS_PUBLICADOS.includes(m)) && !d.querySelector(".collection-entry.active .game-row-cerrado"));
  }
  ok("la pantalla no nombra ninguna colección oculta", !NOMBRES_OCULTOS.test(d.getElementById("app").textContent));
}

console.log("\nEl Atlas y la guía");
{
  const w = boot();
  const CT = w.CONTINUUM;
  const catalogo = CT.Enciclopedia.catalogGroups("", { lock: "all" });
  ok("la enciclopedia solo agrupa colecciones publicadas, con todos sus mazos", iguales(catalogo.map(b => b.key), PUBLICADAS) && iguales(catalogo.flatMap(b => b.decks.map(deck => deck.key)), MAZOS_PUBLICADOS));
  const guia = CT.guideMarkup?.("history") || "";
  ok("la guía habla de historia, naturaleza y geografía", /historia, naturaleza y geografía/.test(guia));
  ok("la guía no menciona cine ni ciencia en Grandes colecciones", !/historia, cine, ciencia/.test(guia));
}

console.log("\nEnlaces de duelo de un mazo oculto");
{
  const w = boot();
  const D = w.CONTINUUM.Duelo;
  const payload = D.codificar({ mode: "movies", seed: "cine9", total: 15, hits: 8, sequence: Array.from({ length: 15 }, (_, i) => i < 8), nombre: "Ana" });
  const rival = boot({ url: `https://hilo.test/?duelo=${payload}` });
  ok("abrir el enlace no deja aceptar el duelo", !rival.document.querySelector('[data-action="accept-duel"]'));
  ok("ni ofrece comprar el mazo", !rival.document.querySelector('[data-action="mazo-desbloquear"]'));
}

console.log("\nLo que llega de otro móvil (de antes del lanzamiento)");
{
  const w = boot();
  const CT = w.CONTINUUM;
  let rechazo = "";
  await CT.Quick.openCollectionDuel(() => {}, { deck: "movies", name: "Ana", length: 1, keep: true }).catch(e => { rechazo = e.message; });
  ok("no se crea un duelo de colección con un mazo oculto", /no está disponible/.test(rechazo));
  CT.UI.chooseRematchDeck({ current: "movies" });
  const dialogo = w.document.querySelector("[data-rematch-deck]");
  ok("la revancha de una partida de un mazo oculto no ofrece «Mismo mazo» con él", !!dialogo && !NOMBRES_OCULTOS.test(dialogo.textContent) && !!dialogo.querySelector('[data-rematch-pick="history"]'));
  dialogo.querySelector("[data-rematch-other]").click();
  ok("ni lo ofrece entre los demás mazos", !NOMBRES_OCULTOS.test(dialogo.textContent));
}

console.log("\nCon todo publicado (segunda fase), las colecciones guardadas vuelven");
{
  const w = irAJugar(boot({ todas: true }));
  ok("aparecen las seis colecciones", w.document.querySelectorAll("[data-block]").length === 6);
  ok("y sus mazos se pueden jugar", MAZOS_OCULTOS.every(key => w.CONTINUUM.Cartera.tiene(key)));
}

if (fail) process.exit(1);
console.log("\nCatálogo publicado correcto.");
