// Edad declarada (edad.js): se pregunta una vez, se guarda en el dispositivo y decide si se puede jugar
// online y aparecer en el ranking. Lo aplican app-config.js (corta la conexión) y accounts.js (ranking).
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
function cargar(inicial = {}) {
  const dom = new JSDOM("<!doctype html><head></head><body></body>", { runScripts: "outside-only" });
  const w = dom.window, guardado = new Map(Object.entries(inicial)), eventos = [];
  w.CONTINUUM = { Storage: { getItem: k => guardado.has(k) ? guardado.get(k) : null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: k => guardado.delete(k) } };
  w.document.addEventListener("continuum:edad", e => eventos.push(e.detail.estado));
  w.eval(read("edad.js"));
  return { w, E: w.CONTINUUM.Edad, guardado, eventos };
}
const pulsa = (w, cual) => { const b = w.document.querySelector(`.edad-overlay [data-edad="${cual}"]`); assert.ok(b, `hay botón ${cual}`); b.click(); };
const espera = () => new Promise(r => setTimeout(r, 0));

{
  // Mayor de 14: una pregunta y online permitido.
  const { w, E, guardado, eventos } = cargar();
  assert.equal(E.estado(), null);
  assert.equal(E.permiteOnline(), true, "sin responder no se bloquea nada (se pregunta al arrancar)");
  const p = E.preguntar();
  const dialogo = w.document.querySelector(".edad-overlay");
  assert.equal(dialogo.getAttribute("role"), "dialog");
  assert.equal(dialogo.getAttribute("aria-modal"), "true");
  assert.match(dialogo.textContent, /14 años o más/);
  assert.equal(w.document.activeElement?.dataset.edad, "si", "el foco va a la primera respuesta");
  pulsa(w, "si");
  assert.equal(await p, "mayor");
  assert.equal(guardado.get("continuum-edad-v1"), "mayor");
  assert.deepEqual(eventos, ["mayor"]);
  assert.equal(w.document.querySelector(".edad-overlay"), null);
  assert.equal(await E.preguntar(), "mayor", "no se vuelve a preguntar");
  assert.equal(w.document.querySelector(".edad-overlay"), null);
}
{
  // Menor con permiso: puede jugar online.
  const { w, E } = cargar();
  const p = E.preguntar();
  pulsa(w, "no"); await espera();
  assert.match(w.document.querySelector(".edad-overlay").textContent, /permiso de tu madre, padre o tutor/);
  pulsa(w, "si");
  assert.equal(await p, "permiso");
  assert.equal(E.permiteOnline(), true);
}
{
  // Menor sin permiso: solo sin conexión, y se puede cambiar desde Ajustes.
  const { w, E } = cargar();
  const p = E.preguntar();
  pulsa(w, "no"); await espera(); pulsa(w, "no");
  assert.equal(await p, "menor");
  assert.equal(E.permiteOnline(), false);
  w.document.body.innerHTML = E.resumen();
  assert.match(w.document.body.textContent, /sin permiso: solo sin conexión/);
  w.document.querySelector('[data-edad-action="cambiar"]').click();
  pulsa(w, "si"); await espera();
  assert.equal(E.estado(), "mayor", "«Cambiar la edad» vuelve a preguntar");
}
{
  // Un valor guardado raro cuenta como «sin responder».
  const { E } = cargar({ "continuum-edad-v1": "quizá" });
  assert.equal(E.estado(), null);
}

// Cableado: se carga en la web, la app y la caché; Ajustes lo muestra; el ranking lo respeta.
assert.match(read("index.html"), /<script src="edad\.js"><\/script>/);
assert.match(read("scripts/build.mjs"), /"edad\.js"/);
assert.match(read("service-worker-258.js"), /"\.\/edad\.js"/);
assert.match(read("settings.js"), /Edad\?\.resumen/);
assert.match(read("accounts.js"), /function askRanking\(\) \{[\s\S]{0,300}CT\.Edad && !CT\.Edad\.permiteOnline\(\)\) return;/, "no se pregunta por el ranking a un menor sin permiso");
assert.match(read("accounts.js"), /async function setRanking\(value\) \{\n {2}if \(value === true && CT\.Edad && !CT\.Edad\.permiteOnline\(\)\)/, "ni se le deja activarlo");
console.log("Edad: pregunta única, permiso de los padres, solo sin conexión sin permiso y cambio desde Ajustes: OK");
