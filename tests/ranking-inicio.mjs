// El marcador del mes del inicio y lo que suma cada reto diario al ranking.
// El almacenamiento de la cuenta guarda cada clave con un prefijo por invitado: leer `localStorage`
// a pelo (como hacía el inicio) encontraba siempre vacío y los puntos salían a 0.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { gameHtml } from "./game-fixture.mjs";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const scripts = [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
const w = dom.window;
const pulsa = d => { const b = d.querySelector('[data-action="jugar"]'); if (b) b.dataset.homeTransition = "done"; };
w.eval(`(function(){ const base = window.localStorage; window.__scoped = k => 'continuum-account:launch-1:uid-x:' + k; })();`);
scripts.forEach(file => w.eval(read(file)));
const CT = w.CONTINUUM;
// Como con una cuenta abierta: todo lo del juego se guarda bajo el prefijo del invitado.
const base = CT.Storage;
CT.Storage = { ...base, getItem: k => base.getItem(w.__scoped(k)), setItem: (k, v) => base.setItem(w.__scoped(k), v), removeItem: k => base.removeItem(w.__scoped(k)) };
const hoy = new Date().toLocaleDateString("sv-SE");
CT.Storage.setItem("hilo-retos-v1", JSON.stringify({ retoDiario: { days: { [hoy]: { hits: 2, total: 15 } } } }));
w.sessionStorage.removeItem("continuum-entry-route");
CT.localNavigate("home");
CT.ModeHubs?.refreshHome?.();
await new Promise(r => setTimeout(r, 30));
const caja = w.document.querySelector(".mode-ranking-summary");
assert.ok(caja, "el inicio enseña el marcador del mes");
assert.equal(caja.querySelector("b").textContent.trim(), "13", "2 de 15 son 13 puntos, leídos del almacenamiento de la cuenta");
assert.equal(caja.querySelector("[data-account-action]"), null, "sin cuenta abierta no hay botón de ranking");
CT.Accounts = { ready: true, profile: { alias: "Ana" } };
w.document.querySelector(".mode-ranking-summary")?.remove();
CT.localNavigate("home"); CT.ModeHubs?.refreshHome?.();
await new Promise(r => setTimeout(r, 30));
assert.ok(w.document.querySelector('.mode-ranking-summary [data-account-action="ranking"]'), "con cuenta, el inicio lleva al ranking");

// Un reto diario de Retos rápidos suma al ranking igual que uno de Grandes colecciones.
const antes = CT.Progreso.read().totals;
CT.Progreso.finishQuickDaily({ hits: 6, total: 8, streak: 3 });
const despues = CT.Progreso.read();
assert.equal(despues.totals.dailyHits - antes.dailyHits, 6);
assert.equal(despues.totals.dailyGames - antes.dailyGames, 1);
assert.equal(despues.marks.bestStreak, 3);
CT.Progreso.finishQuickDaily({ hits: 99, total: 8 });
assert.equal(CT.Progreso.read().totals.dailyHits - antes.dailyHits, 6 + 8, "los aciertos nunca superan las cartas");
assert.equal(CT.Progreso.read().marks.perfectDaily, 1, "un reto completo cuenta como perfecto");
dom.window.close();
console.log("Inicio y ranking: puntos del mes desde la cuenta, acceso al ranking y retos rápidos diarios suman.");
