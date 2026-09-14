// Contratos de interacción. No son una prueba visual de Safari: verifican que el
// movimiento no repita acciones, pierda foco ni altere un arrastre o la partida.
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
const source = read("index.html");
const scripts = [...source.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
function ok(label, condition) { assert.ok(condition, label); checks++; console.log(`  ok ${label}`); }
function boot({ reduce = false, animated = false } = {}) {
  const dom = new JSDOM(source.replace(/<script src="[^"]*"><\/script>/g, ""), {
    runScripts: "outside-only", url: "https://continuum.test/", pretendToBeVisual: true
  });
  const w = dom.window;
  const runtimeErrors = [];
  w.addEventListener("error", event => { runtimeErrors.push(event.error); event.preventDefault(); });
  const close = w.close.bind(w);
  w.close = () => { close(); assert.deepEqual(runtimeErrors, [], "sin excepciones durante los gestos"); };
  w.matchMedia = () => ({ matches: reduce });
  w.Element.prototype.scrollIntoView = function () {};
  if (animated) w.Element.prototype.getAnimations = () => [];
  scripts.forEach(script => w.eval(read(script)));
  return w;
}
const el = (w, selector) => {
  const element = w.document.querySelector(selector);
  assert.ok(element, `Existe ${selector}`);
  return element;
};
function click(w, selector) { const element = el(w, selector); element.focus(); element.click(); }
// Un mazo concreto se elige ahora desde la portada antes de llegar al menú de
// formatos (`playMenu`), donde de verdad viven «setup»/«start»/«ready».
function abreMazo(w, block, mode) {
  // Si ya se volvió a la colección elegida, sus mazos siguen visibles. Pulsar otra vez
  // esa misma carátula la plegaría, así que solo la abrimos cuando el mazo no está aún.
  if (!w.document.querySelector(`[data-mode="${mode}"]`)) click(w, `[data-block="${block}"]`);
  click(w, `[data-mode="${mode}"]`);
}
function game(w) { abreMazo(w, "historia", "history"); click(w, '[data-format="multi"]'); ["setup", "start", "ready"].forEach(action => click(w, `[data-action="${action}"]`)); }
function animationEnd(w, target, name) {
  const event = new w.Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: name });
  target.dispatchEvent(event);
}

console.log("\nGalería continua y navegación repetida");
{
  // La portada ya no conserva el nodo de la galería entre repintados (la colección se
  // repinta entera al desplegar un bloque o al volver de un mazo), así que aquí se
  // comprueba lo que sigue siendo cierto: el estado activo y el foco llegan al elemento
  // correcto tras cada clic, ronda tras ronda, y elegir un mazo lleva al menú de
  // formatos con su nombre.
  const w = boot();
  const blocks = Object.values(w.CONTINUUM.BLOCKS);
  for (let round = 0; round < 3; round++) {
    for (const block of blocks) {
      click(w, `[data-block="${block.key}"]`);
      assert.equal(el(w, ".gallery-panel.active").dataset.block, block.key);
      assert.equal(w.document.activeElement.dataset.block, block.key);
      for (const mode of block.games) {
        click(w, `[data-mode="${mode}"]`);
        assert.equal(el(w, "h1").textContent, w.CONTINUUM.mode(mode).name);
        click(w, '[data-action="collection-back"]');
        assert.equal(el(w, ".gallery-panel.active").dataset.block, block.key);
      }
    }
  }
  ok("tres vueltas por todos los bloques y mazos llevan el estado activo y el foco al elemento correcto", true);
  click(w, '[data-block="ciencia"]');
  ok("la imagen de Ciencia pide el tamaño grande al desplegarse", el(w, ".panel-science img").getAttribute("src").endsWith("700.webp"));
  for (let round = 0; round < 6; round++) {
    abreMazo(w, "historia", "history");
    click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
    assert.ok(el(w, ".shell").classList.contains("screen-enter"));
    click(w, '[data-action="back-menu"]');
    click(w, '[data-action="collection-back"]');
    abreMazo(w, "historia", "history");
    click(w, '[data-action="solo"]');
    click(w, '[data-action="back-menu"]');
    click(w, '[data-action="collection-back"]');
  }
  ok("seis recorridos inicio–configuración–solitario conservan controles y foco", true);
  w.close();
}

console.log("\nVolver al menú sin saltos de lectura");
{
  const w = boot();
  const calls = [];
  // `window.scrollTo` admite dos firmas (par de coordenadas u opciones); un navegador
  // real entiende las dos, así que el simulacro también debe hacerlo.
  w.scrollTo = (...args) => {
    const options = args.length === 1 ? args[0] : { top: args[1], left: args[0], behavior: "instant" };
    calls.push(options);
    w.scrollY = options.top;
  };
  w.scrollY = 520;
  click(w, '[data-block="historia"]');
  // Elegir un mazo es lo que de verdad sale de Inicio; el resto del recorrido
  // (menú de formatos, configuración) no vuelve a tocar esa posición guardada.
  click(w, '[data-mode="history"]');
  ok("elegir un mazo comienza arriba incluso si Inicio estaba desplazado", w.scrollY === 0);
  click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
  click(w, '[data-action="back-menu"]');
  click(w, '[data-action="collection-back"]');
  ok("Volver recupera la posición y el foco de cuando se dejó Inicio", w.scrollY === 520 && w.document.activeElement.dataset.mode === 'history');
  ok("el regreso tiene sentido inverso sin un segundo desplazamiento animado", el(w, '.shell').classList.contains('screen-return') && calls.every(call => call.behavior === 'instant'));
  w.close();
}

console.log("\nCambiar de categoría durante un ajuste de altura");
{
  const w = boot();
  const animations = [];
  let height = 200;
  const container = el(w, '.deck-collection');
  container.getBoundingClientRect = () => ({ height });
  container.animate = () => {
    let resolve, reject;
    const animation = {
      finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
      cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      finish() { resolve(); }
    };
    animations.push(animation);
    return animation;
  };
  w.CONTINUUM.resizeContent(container, 300);
  height = 150;
  w.CONTINUUM.resizeContent(container, 240);
  ok("una segunda selección cancela el ajuste anterior", animations.length === 2 && animations[0].cancelled);
  animations[1].finish();
  await Promise.resolve();
  ok("terminar no deja una altura fija que recorte el siguiente mazo", !container.style.height);
  w.matchMedia = () => ({ matches: true });
  w.CONTINUUM.resizeContent(container, 400);
  ok("movimiento reducido no crea ajustes animados de altura", animations.length === 2);
  w.close();
}

console.log("\nRespuesta a selección y confirmación, sin reinicios");
{
  const w = boot();
  game(w);
  click(w, ".hand-card");
  ok("elegir una carta anima solo esa carta", !!w.document.querySelector(".selection-enter") && !w.document.querySelector(".screen-enter"));
  for (let turn = 0; turn < 8; turn++) {
    click(w, '.slot[data-index="0"]');
    assert.ok(el(w, ".slot-confirm").classList.contains("placement-enter"));
    assert.equal(w.document.querySelector(".selection-enter"), null);
    click(w, '.slot[data-index="1"]');
    assert.ok(el(w, ".slot-confirm").classList.contains("placement-enter"));
    click(w, '[data-action="cancel-place"]');
    assert.equal(w.document.querySelector(".slot-confirm"), null);
  }
  ok("ocho cambios de hueco/cancelación no repiten la selección ni colocan cartas", true);
  const before = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
  ok("cancelar mantiene la carta en la mano y la línea inicial", before.timeline.length === 1 && before.players[0].hand.length === 4);
  w.close();
}

console.log("\nCierres animados, interrupciones y movimiento reducido");
{
  const w = boot({ reduce: true });
  const scrolls = [];
  w.Element.prototype.scrollIntoView = function(options) { scrolls.push(options); };
  const originalRect = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function() {
    return this.matches('.timeline-wrap') ? { top: 900, bottom: 1100, left: 0 } : originalRect.call(this);
  };
  game(w);
  // La colección se alinea arriba al abrirla; aquí medimos solo la mesa de juego.
  scrolls.length = 0;
  click(w, '.hand-card');
  await sleep(10);
  ok("acercar una línea fuera de vista respeta movimiento reducido", scrolls.length === 1 && scrolls[0].behavior === 'auto');
  click(w, '.slot[data-index="0"]');
  click(w, '.slot[data-index="1"]');
  click(w, '[data-action="cancel-place"]');
  await sleep(10);
  ok("cambiar y cancelar huecos no reinicia el desplazamiento de pantalla", scrolls.length === 1);
  click(w, '.hand-card:last-child');
  click(w, '[data-action="game-menu"]');
  // Una navegación inmediata invalida el desplazamiento pendiente de la mesa vieja.
  click(w, '[data-action="abandon"]');
  click(w, '[data-exit-confirm]');
  await sleep(10);
  ok("un desplazamiento pendiente no arrastra una pantalla nueva", scrolls.length === 1);
  w.close();
}
{
  const w = boot({ animated: true });
  const guide = el(w, '[data-action="rules"]');
  for (let round = 0; round < 6; round++) {
    click(w, '[data-action="rules"]');
    const overlay = el(w, ".overlay");
    assert.ok(overlay.classList.contains("dialog-enter"));
    assert.equal(w.document.activeElement, el(w, ".modal h2"));
    w.document.activeElement.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    assert.equal(w.document.activeElement, el(w, '[data-action="close-rules"]'));
    click(w, '[data-action="close-rules"]');
    assert.ok(overlay.classList.contains("dialog-exit") && overlay.inert);
    animationEnd(w, el(w, ".modal"), "result-in");
    assert.ok(overlay.isConnected);
    animationEnd(w, overlay, "veil-out");
    assert.ok(!overlay.isConnected);
    assert.equal(w.document.activeElement, guide);
  }
  ok("seis aperturas/cierres devuelven el foco; los eventos de hijos no acortan la salida", true);
  click(w, '[data-action="rules"]');
  const oldOverlay = el(w, ".overlay");
  click(w, '[data-action="close-rules"]');
  click(w, '[data-settings-action="open"]');
  const active = w.document.activeElement;
  animationEnd(w, oldOverlay, "veil-out");
  ok("abrir Ajustes durante una salida no pierde su foco", w.document.activeElement === active);
  click(w, '[data-settings-action="close"]');
  await sleep(250);
  ok("el cierre termina aunque el navegador no emita animationend", !w.document.querySelector(".overlay"));
  w.close();
}
{
  const w = boot({ animated: true, reduce: true });
  click(w, '[data-action="rules"]');
  click(w, '[data-action="close-rules"]');
  ok("con movimiento reducido el diálogo cierra sin espera", !w.document.querySelector(".overlay"));
  const wrap = w.document.createElement("div"), card = w.document.createElement("div");
  let scroll;
  wrap.scrollBy = options => { scroll = options; };
  w.CONTINUUM.scrollToElement(wrap, card);
  ok("el mapa también respeta movimiento reducido", scroll.behavior === "auto");
  w.close();
}

console.log("\nGestos táctiles y ratón");
function pointer(w, type, target, x, y, pointerType = "touch") {
  const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType } });
  target.dispatchEvent(event);
}
{
  const w = boot();
  game(w);
  const card = el(w, ".hand-card");
  const slots = [...w.document.querySelectorAll(".slot")];
  assert.ok(slots.every(slot => slot.disabled));
  w.document.elementFromPoint = () => slots[0];
  pointer(w, "pointerdown", card, 100, 400, "mouse");
  pointer(w, "pointermove", card, 150, 280, "mouse");
  assert.ok(slots.every(slot => !slot.disabled));
  pointer(w, "pointercancel", card, 150, 280, "mouse");
  ok("cancelar sin carta elegida restaura los huecos deshabilitados", slots.every(slot => slot.disabled));
  w.close();
}
{
  const w = boot();
  game(w);
  let card = el(w, ".hand-card");
  // jsdom no maquetiza y no trae `elementFromPoint`: mientras no se diga otra cosa, bajo
  // el dedo no hay ningún hueco. Es también lo que ve el juego en un navegador que no la
  // tenga, y por eso `slotUnder` no puede darla por hecha.
  w.document.elementFromPoint = () => null;
  // Deslizar sin esperar es desplazar la página: ni se levanta la carta ni se le quita
  // el gesto al navegador. Es la mitad del trato del arrastre con el dedo.
  pointer(w, "pointerdown", card, 100, 400);
  pointer(w, "pointermove", card, 100, 360);
  await sleep(360);
  const scroll = new w.Event('touchmove', { bubbles: true, cancelable: true });
  card.dispatchEvent(scroll);
  ok("deslizar antes de mantener desplaza y no arrastra", !w.document.querySelector(".armed, .holding, .drag-ghost") && !scroll.defaultPrevented);
  pointer(w, "pointerup", card, 100, 360);
  // Y la otra mitad: mantenerla pulsada sin mover la levanta, y a partir de ahí el dedo
  // arrastra la carta en vez de desplazar la página.
  pointer(w, "pointerdown", card, 100, 400);
  ok("mientras se espera, la carta avisa de que se está pulsando", card.classList.contains("holding"));
  await sleep(360);
  ok("mantenerla pulsada la levanta", !!w.document.querySelector(".drag-ghost") && !card.classList.contains("holding"));
  const arrastre = new w.Event('touchmove', { bubbles: true, cancelable: true });
  card.dispatchEvent(arrastre);
  ok("con la carta levantada, el dedo ya no desplaza la página", arrastre.defaultPrevented);
  w.document.elementFromPoint = () => el(w, '.slot[data-index="0"]');
  pointer(w, "pointermove", card, 220, 300);
  pointer(w, "pointerup", card, 220, 300);
  ok("soltar sobre un hueco pide confirmación, igual que con el ratón", el(w, ".slot-confirm").dataset.index === "0" && !w.document.querySelector(".drag-ghost"));
  await sleep(5);
  click(w, '[data-action="cancel-place"]');
  card = el(w, ".hand-card");
  // Un toque corto sigue siendo un toque: elige la carta y no arrastra nada.
  pointer(w, "pointerdown", card, 100, 400);
  await sleep(60);
  pointer(w, "pointerup", card, 100, 400);
  ok("un toque corto no levanta la carta", !w.document.querySelector(".drag-ghost, .holding"));
  click(w, '.hand-card');
  card = el(w, '.hand-card.selected');
  ok("un toque selecciona la carta", !!card);
  pointer(w, "pointerdown", card, 100, 400, "mouse");
  w.document.elementFromPoint = () => el(w, '.slot[data-index="0"]');
  pointer(w, "pointermove", card, 100, 280, "mouse");
  const ghost = el(w, ".drag-ghost");
  ok("la copia usa composición y no duplica el control accesible", ghost.style.transform.includes("translate3d") && ghost.getAttribute("aria-hidden") === "true" && ghost.tabIndex === -1);
  // Soltar en otro hueco antes del siguiente frame debe elegir la posición final.
  w.document.elementFromPoint = () => el(w, '.slot[data-index="1"]');
  pointer(w, "pointerup", card, 300, 280, "mouse");
  ok("soltar usa el destino final y pide confirmación", el(w, ".slot-confirm").dataset.index === "1" && !w.document.querySelector(".drag-ghost"));
  await sleep(5); // siguiente evento real: el clic sintético del arrastre ya se ha consumido
  click(w, '[data-action="cancel-place"]');
  card = el(w, ".hand-card");
  pointer(w, "pointerdown", card, 100, 400, "mouse");
  pointer(w, "pointermove", card, 150, 280, "mouse");
  pointer(w, "pointercancel", card, 150, 280, "mouse");
  ok("una interrupción del sistema limpia la copia y el estado de arrastre", !w.document.querySelector(".drag-ghost, .dragging, .armed") && !w.document.body.classList.contains("dragging-card"));
  w.close();
}

// «Volver» retrocede un paso y la casita salta al inicio de una vez. Donde no aparece es
// tan importante como donde sí: en el propio inicio no llevaría a ninguna parte, y en una
// partida sería una salida sin la pregunta que protege lo jugado.
console.log("\nLa casita del inicio");
{
  const w = boot();
  const casa = () => w.document.querySelector('.home-nav [data-action="home-top"]');
  ok("en el inicio la casa aparece activa en la barra", casa()?.getAttribute("aria-current") === "page");
  abreMazo(w, "historia", "history");
  ok("en el menú del mazo aparece, junto a «Volver»", !!casa() && !!w.document.querySelector('.topbar [data-action="collection-back"]'));
  ok("y se anuncia como lo que es", casa().textContent.trim() === "Inicio");
  click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
  ok("en la configuración también", !!casa());
  casa().click();
  ok("la casita salta al inicio de una vez, sin pasar por el menú", el(w, "#app").dataset.screen === "home");
  game(w);
  ok("dentro de una partida no está: de ahí se sale por su menú", !casa() && !!w.document.querySelector('[data-action="game-menu"]'));
  w.close();
}

console.log("\nDeslizar de izquierda a derecha para volver");
// El gesto tiene que hacer exactamente lo que el botón «Volver» de cada pantalla, y no
// hacer nada donde ese botón no existe: dentro de una partida, en el inicio, o cuando el
// dedo está desplazando una tira o escribiendo en un campo.
function swipe(w, { target = el(w, "#app"), from = 30, to = 170, y = 320, dy = 0, pointerType = "touch", steps = 3, cancelado = false } = {}) {
  pointer(w, "pointerdown", target, from, y, pointerType);
  for (let paso = 1; paso <= steps; paso++) pointer(w, "pointermove", target, from + ((to - from) * paso) / steps, y + (dy * paso) / steps, pointerType);
  pointer(w, cancelado ? "pointercancel" : "pointerup", target, to, y + dy, pointerType);
}
const pantalla = w => el(w, "#app").dataset.screen;
{
  const w = boot();
  abreMazo(w, "historia", "history");
  assert.equal(pantalla(w), "play-menu");
  swipe(w);
  ok("deslizar en el menú del mazo vuelve a la colección, como «Volver»", pantalla(w) === "home" && !!w.document.querySelector('[data-mode="history"]'));
  swipe(w);
  ok("en el inicio no hay nada detrás: el gesto no hace nada", pantalla(w) === "home");
  // Igual que tras un arrastre: el gesto se come el clic que el navegador puede disparar
  // al soltar, así que el siguiente toque de verdad llega en el turno siguiente.
  await sleep(5);
  click(w, '[data-mode="history"]');
  click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
  assert.equal(pantalla(w), "setup");
  swipe(w, { cancelado: true });
  ok("un gesto que el navegador cancela a mitad, ya cumplido, vuelve igual", pantalla(w) === "play-menu");
  await sleep(5);
  click(w, '[data-action="setup"]');
  swipe(w, { from: 200, to: 40 });
  ok("de derecha a izquierda no vuelve: ese no es el gesto", pantalla(w) === "setup");
  swipe(w, { dy: 130 });
  ok("un desplazamiento en diagonal tampoco vuelve", pantalla(w) === "setup");
  swipe(w, { to: 70 });
  ok("un roce corto no vuelve", pantalla(w) === "setup");
  swipe(w, { pointerType: "mouse" });
  ok("con el ratón se navega con los botones, no arrastrando", pantalla(w) === "setup");
  swipe(w, { target: el(w, "#players input") });
  ok("deslizar sobre un campo de texto lo respeta", pantalla(w) === "setup");
  const tira = w.document.createElement("div");
  tira.style.overflowX = "auto";
  Object.defineProperties(tira, { scrollWidth: { value: 900 }, clientWidth: { value: 360 } });
  el(w, ".shell").append(tira);
  swipe(w, { target: tira });
  ok("una tira que se desplaza a los lados se queda el gesto", pantalla(w) === "setup");
  swipe(w);
  ok("y fuera de ella el gesto sigue volviendo", pantalla(w) === "play-menu");
  w.close();
}
{
  const w = boot();
  click(w, '[data-action="rules"]');
  swipe(w, { target: el(w, ".modal") });
  ok("con la guía abierta, el gesto la cierra como Escape", !w.document.querySelector(".overlay") && pantalla(w) === "home");
  await sleep(5);
  click(w, '[data-action="home-encyclopedia"]');
  swipe(w, { target: el(w, "#enc-search-input") });
  ok("buscando en la enciclopedia, deslizar no la cierra", !!w.document.querySelector('[data-overlay="encyclopedia"]'));
  swipe(w, { target: el(w, ".enc-modal") });
  ok("y desde el resto de la enciclopedia el gesto la cierra", !w.document.querySelector('[data-overlay="encyclopedia"]') && pantalla(w) === "home");
  w.close();
}
{
  const w = boot();
  game(w);
  assert.equal(pantalla(w), "game");
  swipe(w);
  ok("en mitad de una partida el gesto no navega ni abre nada", pantalla(w) === "game" && !w.document.querySelector(".overlay"));
  await sleep(5);
  click(w, '[data-action="game-menu"]');
  swipe(w, { target: el(w, ".modal") });
  ok("pero cierra el menú de la partida, que sí es descartable", !w.document.querySelector(".overlay") && pantalla(w) === "game");
  w.close();
}

const css = read("styles.css");
const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
ok("el estilo reducido cubre navegación, cartas, diálogos y espera", [".selection-enter", ".placement-enter", ".dialog-exit", ".game-row.active", ".spinner", ".drag-ghost"].every(selector => reduced.includes(selector)));
console.log(`\n${checks} comprobaciones de movimiento correctas`);
