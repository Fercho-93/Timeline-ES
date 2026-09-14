// La enciclopedia: filtrado puro (CT.Enciclopedia) y la pantalla que lo usa, sobre el
// DOM real de index.html, igual que el resto de pantallas del juego.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
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
const escribir = (w, sel, valor) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.value = valor;
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
};
const elegir = (w, sel, valor) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.value = valor;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const texto = w => w.document.body.textContent;
// La Enciclopedia se abre desde el menú de un mazo concreto (`playMenu`), al que se
// llega desplegando antes su bloque en la portada.
const abreMazo = (w, block, mode) => { click(w, `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); };

console.log("\nFiltrado puro (CT.Enciclopedia)");
{
  const w = boot();
  const ct = w.CONTINUUM;
  for (const key of Object.keys(ct.MODES)) {
    const card = ct.cards(key).find(card => ct.cardArt(key, card));
    if (!card) continue;
    const fragment = w.document.createElement('div');
    // Ya descubierta: una carta que no se ha jugado no monta su `<img>`, y lo que se
    // comprueba aquí es que la ilustración que sí se pinta apunte a un archivo real.
    fragment.innerHTML = ct.Enciclopedia.cardMarkup(key, card, { descubiertas: new Set([card.id]) });
    const img = fragment.querySelector('img');
    ok(`${key}: la enciclopedia usa su ilustración existente`, !!img && fs.existsSync(path.join(REPO, img.getAttribute('src'))));
    ok(`${key}: imagen diferida y contenido conservado`, img?.loading === 'lazy' || img?.getAttribute('loading') === 'lazy');
    ok(`${key}: conserva el título y la explicación`, fragment.textContent.includes(card.title) && fragment.textContent.includes(card.detail));
  }
  const withoutArt = { ...ct.cards('history')[0], id: -999 };
  const markup = ct.Enciclopedia.cardMarkup('history', withoutArt);
  ok('sin lámina conserva el símbolo de época sin imagen rota', !markup.includes('<img') && markup.includes('card-visual era-'));
  w.close();
}
{
  const w = boot();
  const todas = w.CONTINUUM.Enciclopedia.filterCards("history", {});
  ok("sin filtro devuelve las 167 cartas", todas.length === 167);
  const ordenado = todas.every((card, i) => i === 0 || card.year >= todas[i - 1].year);
  ok("el orden es ascendente por el eje del mazo", ordenado);

  const conAcento = w.CONTINUUM.Enciclopedia.filterCards("history", { query: "Córdoba" });
  const sinAcento = w.CONTINUUM.Enciclopedia.filterCards("history", { query: "cordoba" });
  ok("la búsqueda encuentra resultados", conAcento.length > 0);
  ok("la búsqueda ignora tildes y mayúsculas", sinAcento.length === conAcento.length);
  ok("todos los resultados mencionan Córdoba", conAcento.every(c => `${c.title} ${c.detail}`.includes("Córdoba")));

  const sinNada = w.CONTINUUM.Enciclopedia.filterCards("history", { query: "esto-no-existe-en-ningun-hecho-xyz" });
  ok("una búsqueda sin coincidencias no rompe nada", sinNada.length === 0);
  ok("el estado vacío se indica en el resultado", /Ninguna carta coincide/.test(w.CONTINUUM.Enciclopedia.resultsMarkup("history", sinNada)));

  const bandas = w.CONTINUUM.Enciclopedia.bands("history");
  ok("history tiene sus propias bandas", bandas.length > 0 && bandas[0].key === "antigua");
  const primeraBanda = w.CONTINUUM.Enciclopedia.filterCards("history", { band: bandas[0].key });
  ok("filtrar por banda narrows el resultado", primeraBanda.length > 0 && primeraBanda.length < todas.length);
  ok("toda carta filtrada pertenece a esa banda", primeraBanda.every(c => w.CONTINUUM.eraForCard("history", c).key === bandas[0].key));

  const conFuente = w.ANIMAL_WEIGHT_CARDS.find(c => c.source);
  ok("hay una carta con fuente en Peso de animales", !!conFuente);
  const markup = w.CONTINUUM.Enciclopedia.cardMarkup("animals", conFuente);
  ok("la carta con fuente enlaza a esa fuente", markup.includes(`href="${conFuente.source}"`));
  const sinFuente = w.CONTINUUM.Enciclopedia.cardMarkup("history", w.HISTORY_CARDS[0]);
  ok("una carta sin fuente no inventa un enlace", !sinFuente.includes("enc-source"));
}

console.log("\nSe entra desde el menú del mazo elegido");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  ok("el menú de formatos ofrece la enciclopedia", existe(w, '[data-action="enciclopedia"]'));
  click(w, '[data-action="enciclopedia"]');
  ok("se abre con el mazo elegido (Historia de España)", /Historia de España/.test(texto(w)));
  ok("aparece el selector de mazo", existe(w, "#enc-mode-select"));
  ok("aparece el buscador", existe(w, "#enc-search-input"));
  ok("aparecen las bandas como filtro", w.document.querySelectorAll(".band-chip").length > 1);
  ok("se listan las 167 cartas del mazo", w.document.querySelectorAll("#enc-results .timeline-card").length === 167);
  ok("cada carta enseña su valor ya revelado", /class="year"/.test(w.document.getElementById("enc-results").innerHTML));
}

console.log("\nCambiar de mazo desde el desplegable");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="enciclopedia"]');
  elegir(w, "#enc-mode-select", "movies");
  ok("el título cambia al mazo elegido", /Estrenos de cine/.test(texto(w)));
  ok("se listan las 87 películas", w.document.querySelectorAll("#enc-results .timeline-card").length === 87);
}

console.log("\nBuscar sin perder el campo ni el foco");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="enciclopedia"]');
  const antes = w.document.getElementById("enc-search-input");
  antes.focus();
  escribir(w, "#enc-search-input", "cordoba");
  const despues = w.document.getElementById("enc-search-input");
  ok("escribir en el buscador no destruye el campo", antes === despues);
  ok("el foco se conserva en el campo mientras se escribe", w.document.activeElement === despues);
  const resultados = w.document.querySelectorAll("#enc-results .timeline-card").length;
  ok("la búsqueda reduce los resultados", resultados > 0 && resultados < 167);
  ok("el contador de resultados se actualiza", new RegExp(`${resultados} de 167`).test(w.document.getElementById("enc-count").textContent));

  escribir(w, "#enc-search-input", "esto-no-existe-en-ningun-hecho-xyz");
  ok("una búsqueda sin resultados muestra el estado vacío", /Ninguna carta coincide/.test(w.document.getElementById("enc-results").textContent));
}

console.log("\nFiltrar por banda desde la pantalla");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="enciclopedia"]');
  const total = w.document.querySelectorAll("#enc-results .timeline-card").length;
  const chip = w.document.querySelector(".band-chip:not(#enc-band-all)");
  const clave = chip.dataset.band;
  click(w, `#enc-band-${clave}`);
  ok("la banda elegida queda marcada", w.document.getElementById(`enc-band-${clave}`).getAttribute("aria-pressed") === "true");
  const filtrado = w.document.querySelectorAll("#enc-results .timeline-card").length;
  ok("el filtro de banda reduce los resultados", filtrado > 0 && filtrado < total);
  click(w, "#enc-band-all");
  ok("volver a «Todas» recupera el mazo entero", w.document.querySelectorAll("#enc-results .timeline-card").length === total);
}

console.log("\nSin entrada desde dentro de una partida");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  ok("el menú de formatos sí la ofrece, antes de empezar a jugar", existe(w, '[data-action="enciclopedia"]'));
  click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
  click(w, '[data-action="start"]');
  ok("no hay enciclopedia en la pantalla de pasar el móvil", !existe(w, '[data-action="enciclopedia"]'));
  click(w, '[data-action="ready"]');
  ok("no hay enciclopedia en la partida local", !existe(w, '[data-action="enciclopedia"]'));
}
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  ok("no hay enciclopedia en el solitario", !existe(w, '[data-action="enciclopedia"]'));
}
{
  // online.js no se puede ejecutar en Node (carga Firebase desde una CDN), así que se
  // comprueba en su propio texto que ninguna cabecera de sala ofrece la enciclopedia.
  const online = read("online.js");
  ok("no hay enciclopedia en ninguna pantalla de varios móviles", !online.includes('data-action="enciclopedia"'));
}

console.log("\nEl repaso enlaza con la enciclopedia");
{
  const w = boot();
  abreMazo(w, "historia", "history");
  click(w, '[data-action="solo"]');
  click(w, '[data-action="start-free"]');
  const cards = new Map(w.HISTORY_CARDS.map(c => [c.id, c]));
  let vueltas = 0;
  while (!/Se acabaron las vidas|Reto completado/.test(texto(w)) && vueltas++ < 400) {
    const estado = JSON.parse(w.localStorage.getItem("hilo-solo-history-v1"));
    const años = estado.timeline.map(id => cards.get(id).year);
    let index = años.findIndex(y => y > cards.get(estado.current).year);
    if (index < 0) index = años.length;
    const equivocado = index === 0 ? años.length : 0; // fallo deliberado
    w.document.querySelectorAll('[data-action="solo-place"]')[equivocado].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    click(w, '[data-action="confirm-place"]');
    click(w, '[data-action="solo-next"]');
  }
  ok("la partida en solitario termina", /Se acabaron las vidas|Reto completado/.test(texto(w)));
  ok("hay algo que repasar", existe(w, '[data-action="review-solo"]'));
  click(w, '[data-action="review-solo"]');
  const boton = w.document.querySelector('[data-action="enc-view"]');
  ok("cada carta fallada ofrece ir a la enciclopedia", !!boton);
  const cardId = boton.dataset.id;
  const cardMode = boton.dataset.mode;
  click(w, '[data-action="enc-view"]');
  ok("la enciclopedia abre en el mazo de la carta fallada", w.document.getElementById("enc-mode-select").value === cardMode);
  const carta = w.document.querySelector(`[data-enc-card="${cardId}"]`);
  ok("la carta fallada aparece destacada", !!carta && carta.classList.contains("enc-card-highlight"));
  click(w, '[data-action="enc-back"]');
  ok("Volver recupera el repaso, no abre Perfil", w.document.getElementById("app").dataset.screen === "review");
}

console.log("\nCatálogo completo desde la barra inferior");
{
  const w = boot();
  click(w, '[data-action="home-encyclopedia"]');
  const doc = w.document;
  ok("la barra abre una pantalla distinta a Inicio", doc.getElementById('app').dataset.screen === 'enciclopedia');
  ok("Enciclopedia queda marcada en la barra", doc.querySelector('.home-nav [aria-current="page"]').dataset.action === 'home-encyclopedia');
  ok("se abre con todas las cartas", doc.getElementById('enc-mode-select').value === 'all');
  const groups = w.CONTINUUM.Enciclopedia.catalogGroups();
  const catalog = groups.flatMap(group => group.decks.flatMap(deck => deck.cards));
  const allIds = new Set(Object.values(w.CONTINUUM.MODES).flatMap(mode => mode.cards).map(card => card.id));
  ok("el catálogo contiene todas las cartas sin duplicar Gran mezcla", catalog.length === allIds.size && new Set(catalog.map(card => card.id)).size === allIds.size);
  ok("las temáticas y los mazos tienen sus propios apartados", doc.querySelectorAll('.enc-topic').length === groups.length && doc.querySelectorAll('[data-enc-deck]').length === groups.flatMap(group => group.decks).length);
  ok("las cartas se cargan al desplegar, sin saturar el móvil al entrar", doc.querySelectorAll('[data-enc-card]').length === 0);
  for (const deck of doc.querySelectorAll('[data-enc-deck]')) {
    deck.open = true;
    deck.dispatchEvent(new w.Event('toggle'));
  }
  ok("todos los mazos se pueden desplegar y consultar", doc.querySelectorAll('[data-enc-card]').length === catalog.length);
  const input = doc.getElementById('enc-search-input');
  input.focus();
  escribir(w, '#enc-search-input', 'cordoba');
  ok("la búsqueda global mantiene el foco", doc.activeElement === input);
  ok("los resultados globales abren sus mazos", doc.querySelectorAll('[data-enc-card]').length > 0 && [...doc.querySelectorAll('[data-enc-deck]')].every(deck => deck.open));
  escribir(w, '#enc-search-input', 'esto-no-existe-en-ningun-hecho-xyz');
  ok("se informa si la búsqueda global está vacía", /Ninguna carta coincide/.test(doc.getElementById('enc-results').textContent));
  escribir(w, '#enc-search-input', '');
  ok("borrar la búsqueda recupera todas las temáticas", doc.querySelectorAll('.enc-topic').length === groups.length);
  elegir(w, '#enc-mode-select', 'animals');
  ok("se puede consultar un mazo con sus filtros propios", doc.querySelectorAll('[data-enc-card]').length === w.CONTINUUM.cards('animals').length && existe(w, '.enc-bands'));
  elegir(w, '#enc-mode-select', 'all');
  ok("se puede volver al catálogo completo", existe(w, '.enc-topic'));
  click(w, '[data-action="perfil"]');
  ok("el perfil conserva la barra", existe(w, '.home-nav'));
  click(w, '[data-action="home-top"]');
  ok("Inicio vuelve a la portada y queda marcado", doc.getElementById('app').dataset.screen === 'home' && doc.querySelector('.home-nav [aria-current="page"]').dataset.action === 'home-top');
  w.close();
}

// Las láminas se descubren jugando. Lo que no se vela nunca es el texto: la enciclopedia
// sigue sirviendo para consultar valor, época y explicación sin haber jugado una carta.
console.log("\nLáminas por descubrir");
{
  const w = boot();
  const CT = w.CONTINUUM;
  // Un mazo con ilustración en todas sus cartas; en uno sin láminas no hay nada que velar.
  const mazo = "animals";
  const carta = CT.cards(mazo)[0];
  const ficha = modeKey => w.document.createRange().createContextualFragment(
    CT.Enciclopedia.cardMarkup(modeKey, carta)).querySelector("[data-enc-card]");

  const velada = ficha(mazo);
  ok("una carta sin jugar llega con el sello cerrado", velada.classList.contains("enc-card-velada") && !!velada.querySelector(".enc-sello"));
  ok("con su candado y sin rótulo debajo", !!velada.querySelector("svg.enc-candado") && !velada.querySelector(".enc-sello b, .enc-sello small"));
  ok("y lo que el candado dice sin decirlo, para quien no lo ve", /bloqueada/i.test(velada.querySelector(".enc-sello .solo-lectores")?.textContent || ""));
  // Ni se descarga ni se difumina lo que no se va a ver: es lo que dejaba pesada la
  // enciclopedia al abrir un mazo entero por descubrir.
  ok("y sin la imagen detrás, que no se llega a pedir", !velada.querySelector("img"));
  ok("pero su valor y su explicación se leen igual", velada.textContent.includes(carta.title) && velada.textContent.includes(carta.detail) && !!velada.querySelector(".year"));
  const antes = CT.Enciclopedia.seenProgress(mazo);
  ok(`el recuento empieza a cero (0 de ${antes.total})`, antes.seen === 0 && antes.total === CT.cards(mazo).length);

  // Jugarla la descubre, se acierte o se falle: en los dos casos se ha visto la carta.
  CT.Progreso.record({ mode: mazo, cardId: carta.id, correct: false });
  const descubierta = ficha(mazo);
  ok("jugarla descubre la lámina, aunque se falle", !descubierta.classList.contains("enc-card-velada") && !descubierta.querySelector(".enc-sello"));
  ok("y el recuento del mazo lo refleja", CT.Enciclopedia.seenProgress(mazo).seen === 1);
  ok("la carta descubierta sigue trayendo su imagen", !!descubierta.querySelector("img"));

  // Los identificadores no se repiten entre mazos, así que una carta descubierta en
  // «Gran mezcla» —que reutiliza cartas de otros— queda descubierta en el suyo.
  const enMezcla = CT.cards("mixed").find(c => CT.cards(mazo).some(a => a.id === c.id));
  if (enMezcla) {
    CT.Progreso.record({ mode: "mixed", cardId: enMezcla.id, correct: true });
    ok("descubrir en Gran mezcla descubre en el mazo de origen", CT.Progreso.seenCards().has(enMezcla.id));
  }

  // Un mazo sin ilustraciones no anuncia láminas que no existen.
  const sinLamina = Object.keys(CT.MODES).find(key => CT.cards(key).every(c => !CT.animalArt(key, c)));
  if (sinLamina) ok(`un mazo sin láminas no promete ninguna (${sinLamina})`, CT.Enciclopedia.seenProgress(sinLamina).total === 0);

  // El filtro de láminas, sobre el filtrado puro: dos jugadas y el mazo se parte en dos.
  const jugadas = CT.cards(mazo).slice(0, 3);
  jugadas.forEach(c => CT.Progreso.record({ mode: mazo, cardId: c.id, correct: true }));
  const todas = CT.Enciclopedia.filterCards(mazo, {});
  const abiertas = CT.Enciclopedia.filterCards(mazo, { lock: "seen" });
  const cerradas = CT.Enciclopedia.filterCards(mazo, { lock: "locked" });
  ok(`«todas» sigue trayendo el mazo entero (${todas.length})`, todas.length === CT.cards(mazo).length);
  ok(`«desbloqueadas» trae solo las jugadas (${abiertas.length})`, abiertas.length === 3 && abiertas.every(c => CT.Progreso.seenCards().has(c.id)));
  ok("«bloqueadas» trae justo las demás", cerradas.length === todas.length - abiertas.length && cerradas.every(c => !CT.Progreso.seenCards().has(c.id)));
  ok("y los dos filtros se combinan con la búsqueda", CT.Enciclopedia.filterCards(mazo, { lock: "locked", query: jugadas[0].title }).length === 0);
  // Una carta sin lámina no está ni bloqueada ni desbloqueada: solo sale en «todas».
  const sinLaminas = Object.keys(CT.MODES).find(key => CT.cards(key).every(c => !CT.cardArt(key, c)));
  if (sinLaminas) {
    ok(`un mazo sin láminas no reparte nada por candado (${sinLaminas})`,
      CT.Enciclopedia.filterCards(sinLaminas, { lock: "seen" }).length === 0 &&
      CT.Enciclopedia.filterCards(sinLaminas, { lock: "locked" }).length === 0 &&
      CT.Enciclopedia.filterCards(sinLaminas, {}).length === CT.cards(sinLaminas).length);
  }

  // Y lo guardado aguanta una copia ajena: identificadores inventados o de otro tipo.
  CT.Storage.setItem(CT.Progreso.KEY, JSON.stringify({ ...CT.Progreso.read(), seen: [carta.id, 99999999, "x", null] }));
  const limpio = CT.Progreso.seenCards();
  ok("una lista de descubiertas con basura se queda solo con las cartas reales", limpio.has(carta.id) && limpio.size === 1);
  w.close();
}

// El filtro en la pantalla: llega en «todas», reparte al pulsarlo y no se queda pegado al
// cambiar de mazo, que es como se acaba mirando media colección sin saber por qué falta.
console.log("\nFiltro de láminas en la pantalla");
{
  const w = boot();
  const doc = w.document;
  const CT = w.CONTINUUM;
  const chips = () => [...doc.querySelectorAll('[data-action="enc-lock"]')];
  const activo = () => chips().find(chip => chip.classList.contains("active"))?.dataset.lock;
  const cartas = () => doc.querySelectorAll("[data-enc-card]").length;

  CT.Progreso.record({ mode: "animals", cardId: CT.cards("animals")[0].id, correct: true });
  click(w, '[data-action="home-encyclopedia"]');
  elegir(w, '#enc-mode-select', 'animals');
  ok("el mazo llega con las tres opciones y «todas» puesta", chips().length === 3 && activo() === "all");
  ok("y con el mazo entero a la vista", cartas() === CT.cards("animals").length);
  ok("cada opción se anuncia como lo que es", chips().every(chip => chip.getAttribute("aria-pressed") === String(chip.dataset.lock === activo())));

  click(w, '[data-action="enc-lock"][data-lock="locked"]');
  ok("«bloqueadas» deja fuera la que ya se jugó", activo() === "locked" && cartas() === CT.cards("animals").length - 1);
  ok("y todas las que quedan traen su candado", cartas() === doc.querySelectorAll(".enc-card-velada").length);
  click(w, '[data-action="enc-lock"][data-lock="seen"]');
  ok("«desbloqueadas» deja justo la contraria", activo() === "seen" && cartas() === 1 && !doc.querySelector(".enc-card-velada"));

  // Cambiar de mazo vuelve a «todas», también en uno sin láminas, donde no hay filtro.
  elegir(w, '#enc-mode-select', 'history');
  ok("al cambiar de mazo el filtro vuelve a «todas»", activo() === "all");
  elegir(w, '#enc-mode-select', 'languages');
  ok("un mazo sin láminas no enseña el filtro", chips().length === 0 && cartas() === CT.cards("languages").length);
  w.close();
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
