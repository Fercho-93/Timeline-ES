import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("index.html");
function boot(entries = {}, setup = () => {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://continuum.test/" }).window;
  w.scrollTo = () => {};
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  for (const [key, value] of Object.entries(entries)) w.localStorage.setItem(key, value);
  setup(w);
  for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(match[1]));
  return w;
}
const windows = [];
const open = (...args) => { const w = boot(...args); windows.push(w); return w; };
const click = (w, action) => {
  const button = w.document.querySelector(`[data-action="${action}"]`);
  assert.ok(button, action); button.click();
};
const key = "continuum-competition-v1";
const saved = w => JSON.parse(w.localStorage.getItem(key));
const json = value => JSON.parse(JSON.stringify(value));
const entries = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
try {
  console.log("\nEstabilización: guardados, competición y actualizaciones");
  let w = open();
  click(w, "start-competition");
  const intro = saved(w);
  assert.equal(intro.queue.length, 14);
  assert.equal(intro.saveVersion, 2);
  const originalMode = intro.previousModeKey;
  w = open(entries(w)); click(w, "resume-competition");
  assert.deepEqual(saved(w).queue, intro.queue);
  click(w, "comp-next-round");
  let state = saved(w);
  assert.equal(state.solo.mode, intro.queue[0]);
  assert.equal(state.queue.length, 13);
  assert.equal(state.difficulty, intro.difficulty);
  const beforePlay = json(state.solo);
  // Cerrar en medio de la ronda mantiene exactamente el reparto.
  w = open(entries(w)); click(w, "resume-competition");
  assert.deepEqual(saved(w).solo, beforePlay);
  click(w, "comp-confirm-resume");
  const ct = w.CONTINUUM;
  const cards = new Map(state.solo.savedDeck.map(c => [c.id, c]));
  const at = ct.correctIndex(state.solo.mode, state.solo.timeline.map(id => cards.get(id)), cards.get(state.solo.current));
  w.document.querySelector(`[data-action="solo-place"][data-index="${at}"]`).click();
  click(w, "confirm-place");
  state = saved(w); assert.equal(state.solo.hits, 1); assert.ok(state.solo.pendingResult);
  w = open(entries(w)); click(w, "resume-competition");
  click(w, "comp-confirm-resume");
  assert.ok(w.document.querySelector('[data-action="solo-next"]'));
  assert.equal(saved(w).solo.hits, 1);
  click(w, "solo-next"); assert.equal(saved(w).solo.played, 1);
  click(w, "abandon-comp");
  assert.equal(saved(w).previousModeKey, originalMode);
  assert.ok(w.document.querySelector('[data-action="resume-competition"]'));
  // Jugar el resto: cada resultado y cada cambio de tema sobrevive a recargar.
  click(w, "resume-competition");
  click(w, "comp-confirm-resume");
  let steps = 0;
  while (!saved(w).finished && steps++ < 100) {
    state = saved(w);
    if (!state.solo) { w = open(entries(w)); click(w, "resume-competition"); click(w, "comp-next-round"); continue; }
    const s = state.solo, c = new Map(s.savedDeck.map(c => [c.id, c]));
    const index = w.CONTINUUM.correctIndex(s.mode, s.timeline.map(id => c.get(id)), c.get(s.current));
    w.document.querySelector(`[data-action="solo-place"][data-index="${index}"]`).click();
    click(w, "confirm-place"); click(w, "solo-next");
  }
  assert.ok(saved(w).finished); assert.equal(saved(w).roundsSummary.length, 14);
  assert.equal(saved(w).totalHits, 70);
  assert.equal(saved(w).queue.length, 0);
  console.log("  ok competición: reparto, resultado pendiente, pausa, 14 rondas y marcador sin duplicación");

  w = open();
  const CT = w.CONTINUUM;
  const deck = json(CT.cards("history"));
  const fingerprint = CT.deckFingerprint("history", deck);
  deck[0].year += 1;
  assert.notEqual(CT.deckFingerprint("history", deck), fingerprint);
  const legacy = { mode: "history", timeline: [1], deck: [2, 3], current: 0, players: [{ id: 0, name: "Ana", hand: [4] }], discard: [] };
  CT.Storage.setItem("hilo-test", JSON.stringify(legacy));
  const migrated = CT.Saves.read("hilo-test", "history");
  assert.equal(migrated.saveVersion, 2);
  CT.Storage.setItem("hilo-test", JSON.stringify(migrated));
  const oldYear = migrated.savedDeck[0].year;
  CT.cards("history")[0].year += 100;
  assert.equal(CT.Saves.read("hilo-test", "history").savedDeck[0].year, oldYear);
  const oldChallenge = CT.Duelo.codificar({ mode: "history", seed: "test", total: 1, hits: 1, sequence: [true], nombre: "Ana", deck: migrated.savedDeck });
  assert.equal(CT.Duelo.descodificar(oldChallenge).ok, false, "un duelo recuperado conserva la huella de su catálogo original");
  CT.Storage.setItem("hilo-test", '{"saveVersion":999}');
  assert.equal(CT.Saves.read("hilo-test", "history"), null);
  assert.equal(CT.Storage.getItem("hilo-test"), '{"saveVersion":999}');
  CT.Storage.setItem("hilo-test", JSON.stringify(legacy));
  assert.ok(Object.keys(w.localStorage).some(k => k.startsWith("hilo-test-recovery-")));
  console.log("  ok migración, conservación de valores originales y formatos futuros protegidos");

  w = open({}, win => {
    const native = win.Storage.prototype.setItem;
    win.Storage.prototype.setItem = function (key, value) {
      if (win.full) throw new win.DOMException("Sin espacio", "QuotaExceededError");
      return native.call(this, key, value);
    };
  });
  w.full = true; click(w, "start-competition");
  assert.ok(w.CONTINUUM.Storage.hasPending());
  assert.ok(w.document.querySelector("#storage-notice"));
  assert.ok(JSON.parse(w.CONTINUUM.Storage.getItem(key)).queue.length);
  w.full = false; w.CONTINUUM.Storage.flush();
  assert.equal(w.CONTINUUM.Storage.hasPending(), false);
  assert.equal(saved(w).queue.length, 14);
  assert.equal(w.document.querySelector("#storage-notice"), null);
  assert.throws(() => w.CONTINUUM.Storage.restore(JSON.stringify({ format: "continuum-backup", version: 1, entries: {} })), /Sal de la partida/);
  click(w, "abandon-comp");
  const copy = JSON.stringify({ format: "continuum-backup", version: 1, entries: { "hilo-ejemplo": "recuperado" } });
  assert.equal(w.CONTINUUM.Storage.restore(copy), true);
  assert.equal(w.localStorage.getItem("hilo-ejemplo"), "recuperado");
  assert.throws(() => w.CONTINUUM.Storage.restore('{"format":"otra-app"}'));
  console.log("  ok almacenamiento lleno: progreso en memoria, aviso y recuperación al reintentar");

  const handlers = {}, messages = [];
  const registration = { waiting: { postMessage: message => messages.push(message) }, addEventListener() {}, async update() {} };
  w = open({}, win => Object.defineProperty(win.navigator, "serviceWorker", { value: {
    async register() { return registration; }, addEventListener(name, fn) { handlers[name] = fn; }
  } }));
  await tick();
  const updateButton = w.document.querySelector("#update-notice button"); assert.ok(updateButton);
  click(w, "start-competition"); await tick(); assert.equal(updateButton.disabled, true);
  updateButton.click(); assert.equal(messages.length, 0);
  handlers.controllerchange(); assert.equal(w.document.getElementById("app").hasAttribute("inert"), false);
  click(w, "abandon-comp"); await tick(); assert.equal(updateButton.disabled, false);
  updateButton.click(); assert.equal(messages[0].type, "ACTIVATE_UPDATE");
  assert.ok(w.document.getElementById("app").hasAttribute("inert"));
  handlers.message({ data: { type: "UPDATE_BLOCKED" } });
  assert.equal(w.document.getElementById("app").hasAttribute("inert"), false);
  assert.match(w.document.getElementById("update-notice").textContent, /otras pestañas/);
  registration.waiting = null;
  handlers.controllerchange();
  assert.equal(w.document.getElementById("update-notice"), null, "una instalación ya activada retira el aviso");
  w = open({}, win => Object.defineProperty(win.navigator, "serviceWorker", { value: {
    async register() { throw Error("Sin conexión"); }, addEventListener() {}
  } }));
  await tick(); assert.match(w.document.getElementById("update-notice").textContent, /seguir jugando/);
  assert.ok(w.document.querySelector('[data-action="start-competition"]'));
  w = open({}, win => { win.Storage.prototype.getItem = () => { throw new win.DOMException("Bloqueado", "SecurityError"); }; });
  assert.ok(w.document.querySelector("#storage-notice"));
  assert.ok(w.document.querySelector('[data-action="start-competition"]'));
  console.log("  ok actualización diferida, bloqueo durante partidas y errores offline no fatales");
} finally { for (const w of windows) w.close(); }
