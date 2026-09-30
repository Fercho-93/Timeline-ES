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
const key = d => d.toLocaleDateString("sv-SE");
const hoy = key(new Date());
const lunes = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return key(d); })();
const ayer = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return key(d); })();
const dias = { [hoy]: { hits: 7, total: 10 }, "2000-01-03": { hits: 9, total: 10 } };
if (ayer >= lunes) dias[ayer] = { hits: 4, total: 10 };
CT.Storage.setItem("hilo-retos-v1", JSON.stringify({ retoDiario: { days: dias, streak: 3, lastDay: hoy } }));
w.sessionStorage.removeItem("continuum-entry-route");
CT.localNavigate("home");
CT.ModeHubs?.refreshHome?.();
await new Promise(r => setTimeout(r, 30));
const caja = w.document.querySelector(".mode-ranking-summary");
assert.ok(caja, "el inicio enseña el resumen del reto diario");
const cifras = [...caja.querySelectorAll(".mode-ranking-stats b")].map(b => b.textContent.trim());
assert.equal(cifras[0], "7/10", "hoy, leído del almacenamiento de la cuenta");
assert.equal(cifras[1], String(7 + (ayer >= lunes ? 4 : 0)), "esta semana suma solo los días desde el lunes");
assert.equal(cifras[2], "3", "la racha");
assert.doesNotMatch(caja.textContent, /PUNTOS|puntos/, "ya no hay puntos del mes");
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
// El reto diario de Retos rápidos tiene 10 cartas que ordenar, como el de Grandes colecciones.
for (const dia of ["2026-10-01", "2026-10-03", "2026-10-05", "2026-11-11"]) {
  const reto = CT.Quick.dailyChallenge(dia);
  assert.equal(reto.cards, 11, `el reto rápido del ${dia} tiene 10 cartas más la que abre la línea`);
}
assert.equal(CT.Quick.dailyChallenge("2026-10-01").id, CT.Quick.dailyChallenge("2026-10-01").id, "el mismo día, el mismo reto");
const E = CT.QuickEngine, c = CT.QuickCatalog.challenges.find(x => x.cards.length > 11);
const partida = E.create({ names: ["Tú"], rounds: [{ id: c.id, order: c.cards.slice(0, 11).map(x => x.id) }] });
assert.equal(partida.remaining.length, 10, "el motor acepta un recorte del mazo");
assert.throws(() => E.create({ names: ["Tú"], rounds: [{ id: c.id, order: [c.cards[0].id, c.cards[0].id] }] }), /INVALID_DECK/, "sin cartas repetidas");
dom.window.close();
console.log("Inicio y ranking: hoy, esta semana y racha desde la cuenta; acceso al ranking; retos diarios de 10 cartas que suman.");
