import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { gameHtml } from "./game-fixture.mjs";
// La colección y la competición viven ahora en «Jugar», no en la portada: desde la
// portada, se entra primero ahí. Devuelve la misma ventana para poder encadenarlo.
function irAJugar(w) { const d = w.document; if (!d.querySelector('[data-block], [data-action="competition-menu"]')) d.querySelector('[data-action="jugar"]')?.click(); return w; }


const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(REPO, file), "utf8");

function recent(storage = new Map()) {
  const w = new JSDOM("", { runScripts: "outside-only" }).window;
  w.CONTINUUM = { Storage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, String(value)); return true; },
    removeItem: key => storage.delete(key)
  } };
  w.eval(read("recent-players.js"));
  return { w, api: w.CONTINUUM.RecentPlayers };
}

const persisted = new Map();
let instance = recent(persisted);
assert.deepEqual(Array.from(instance.api.remember([" Ana ", "ana", "Bea", "Jugador 3"])), ["Ana", "Bea"]);
instance.w.close();
instance = recent(persisted);
assert.deepEqual(Array.from(instance.api.load()), ["Ana", "Bea"], "los nombres sobreviven a una nueva sesión");
assert.deepEqual(Array.from(instance.api.remember(["BEA", "Cid"])), ["BEA", "Cid", "Ana"], "la lista deduplica y antepone la partida más reciente");
assert.deepEqual(Array.from(instance.api.available(["bea"])), ["Cid", "Ana"], "no ofrece una persona ya presente");
assert.deepEqual(Array.from(instance.api.remove("CID")), ["BEA", "Ana"], "se puede olvidar una sugerencia sin distinguir mayúsculas");
instance.w.close();

function boot(seed = {}) {
  const html = gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, "");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://continuum.test/" });
  const w = dom.window;
  Object.entries(seed).forEach(([key, value]) => w.localStorage.setItem(key, value));
  const scripts = [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  scripts.forEach(file => w.eval(read(file)));
  return w;
}
const click = (w, selector) => {
  const el = w.document.querySelector(selector);
  assert.ok(el, `debe existir ${selector}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};

const key = "continuum-recent-local-players-v1";
const w = boot({ [key]: JSON.stringify(["Ana", "Bea"]) });
click(irAJugar(w), '[data-block="historia"]');
click(w, '[data-mode="history"]');
click(w, '[data-format="multi"]');
click(w, '[data-action="setup"]');
const before = [...w.document.querySelectorAll("#players input")].map(input => input.value);
click(w, '[data-action="add-recent-player"]');
const after = [...w.document.querySelectorAll("#players input")].map(input => input.value);
assert.deepEqual(after.slice(0, 2), before, "elegir un reciente no sustituye a quienes ya estaban");
assert.equal(after[2], "Ana", "elegir un reciente crea una persona nueva");
assert.equal(w.document.querySelectorAll('[data-action="add-recent-player"]').length, 1, "la persona añadida deja de ofrecerse como duplicado");
click(w, '[data-action="remove-recent-player"]');
assert.deepEqual(JSON.parse(w.localStorage.getItem(key)), ["Ana"], "retirar una sugerencia actualiza la persistencia");
w.close();

console.log("Jugadores recientes: persistencia, deduplicación, selección segura y retirada correctas.");
