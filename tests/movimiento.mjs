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
function abreMazo(w, block, mode) { click(w, `[data-block="${block}"]`); click(w, `[data-mode="${mode}"]`); }
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
    click(w, '[data-block="historia"]');
    click(w, '[data-mode="history"]');
    click(w, '[data-format="multi"]'); click(w, '[data-action="setup"]');
    assert.ok(el(w, ".shell").classList.contains("screen-enter"));
    click(w, '[data-action="home"]');
    click(w, '[data-block="historia"]');
    click(w, '[data-mode="history"]');
    click(w, '[data-format="solo"]'); click(w, '[data-action="solo"]');
    click(w, '[data-action="home"]');
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
  click(w, '[data-action="home"]');
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
  pointer(w, "pointerdown", card, 100, 400);
  pointer(w, "pointermove", card, 100, 360);
  await sleep(180);
  ok("deslizar antes de mantener no inicia un arrastre", !w.document.querySelector(".armed, .drag-ghost"));
  pointer(w, "pointerdown", card, 100, 400);
  await sleep(180);
  ok("mantener activa la señal táctil", card.classList.contains("armed"));
  w.document.elementFromPoint = () => el(w, '.slot[data-index="0"]');
  pointer(w, "pointermove", card, 100, 280);
  const ghost = el(w, ".drag-ghost");
  ok("la copia usa composición y no duplica el control accesible", ghost.style.transform.includes("translate3d") && ghost.getAttribute("aria-hidden") === "true" && ghost.tabIndex === -1);
  // Soltar en otro hueco antes del siguiente frame debe elegir la posición final.
  w.document.elementFromPoint = () => el(w, '.slot[data-index="1"]');
  pointer(w, "pointerup", card, 300, 280);
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

const css = read("styles.css");
const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
ok("el estilo reducido cubre navegación, cartas, diálogos y espera", [".selection-enter", ".placement-enter", ".dialog-exit", ".game-row.active", ".spinner", ".drag-ghost"].every(selector => reduced.includes(selector)));
console.log(`\n${checks} comprobaciones de movimiento correctas`);
