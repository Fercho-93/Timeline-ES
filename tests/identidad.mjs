import { gameHtml } from "./game-fixture.mjs";
// La identidad del invitado fija el avatar; el nombre se puede cambiar sin perderlo.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
// Sin la identidad de las pruebas: aquí se arranca como la primera vez.
const html = gameHtml(read("index.html"), { bienvenida: true });
const guiones = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot(almacen = {}) {
  const { window } = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = function () {};
  Object.entries(almacen).forEach(([clave, valor]) => window.localStorage.setItem(clave, valor));
  guiones.forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const existe = (w, sel) => !!w.document.querySelector(sel);
const pantalla = w => w.document.getElementById("app").dataset.screen;
const identidad = w => JSON.parse(w.localStorage.getItem("continuum-identidad-v1"));
const escribeNombre = (w, nombre) => {
  w.document.getElementById("bienvenida-nombre").value = nombre;
  w.document.querySelector("[data-bienvenida]").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
};
const espera = () => new Promise(resolve => setTimeout(resolve, 0));
// El navegador normaliza el HTML al insertarlo; comparar tras pasar por el mismo molde.
const pintado = (w, html) => { const molde = w.document.createElement("div"); molde.innerHTML = html; return molde.innerHTML; };

console.log("\nEl avatar queda ligado a la identidad");
{
  const w = boot();
  const A = w.CONTINUUM.Avatares;
  const own = A.ownSeed();
  ok("hay 36 ilustraciones y todas están en el build", A.ids.length === 36 && A.ids.every(id => fs.existsSync(path.join(REPO, "assets/avatars", id + ".webp"))));
  ok("la elección se mantiene con el mismo identificador aunque cambie el nombre",
    A.markup("Lucía", { seed: "uid:persona-1" }) === A.markup("Lucía", { seed: "uid:persona-1" })
    && A.idFor("uid:persona-1") === A.idFor("uid:persona-1"));
  ok("es una ilustración local sin SVG remoto", /src="assets\/avatars\/[\w-]+\.webp"/.test(A.markup("Ana")) && !/<svg/.test(A.markup("Ana")));
  ok("decorativo salvo que se le dé nombre", /aria-hidden="true"/.test(A.markup("Ana")) && /aria-label="Tu avatar"/.test(A.markup("Ana", { etiqueta: "Tu avatar" })));
  ok("la semilla local permanece al volver a abrir", boot({ "continuum-avatar-seed-v1": own }).CONTINUUM.Avatares.ownSeed() === own);
}

console.log("\nLa primera vez: el nombre");
{
  const w = boot();
  ok("sin identidad se entra por la bienvenida", pantalla(w) === "bienvenida" && existe(w, "#bienvenida-nombre"));
  ok("la bienvenida no lleva barra inferior", !existe(w, ".home-nav"));
  const input = w.document.getElementById("bienvenida-nombre");
  input.value = "Fernando";
  click(w, ".bienvenida-avatar");
  ok("el retrato abre la colección completa", w.document.querySelectorAll(".avatar-picker-option").length === 36);
  const elegido = w.CONTINUUM.Avatares.ids.find(id => id !== w.CONTINUUM.Avatares.ownId());
  click(w, `[data-action="avatar-select"][data-avatar-id="${elegido}"]`);
  ok("se guarda la elección sin borrar el nombre escrito", w.CONTINUUM.Avatares.ownId() === elegido && input.value === "Fernando");
  ok("la bienvenida enseña el retrato elegido", w.document.querySelector(".bienvenida-avatar img").getAttribute("src").endsWith(`/${elegido}.webp`));
  ok("persiste al volver a abrir el juego", boot({ ...w.localStorage }).CONTINUUM.Avatares.ownId() === elegido);
  const before = w.document.querySelector("[data-avatar-vivo]").innerHTML;
  input.value = "Fernando";
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("el avatar ya asignado no cambia al escribir", w.document.querySelector("[data-avatar-vivo]").innerHTML === before);
  escribeNombre(w, "a");
  await espera();
  ok("un nombre demasiado corto se explica", /al menos 2/.test(w.document.getElementById("bienvenida-error").textContent));
  escribeNombre(w, "Player 1234");
  await espera();
  ok("el nombre que pone el juego no vale como propio", /nombre tuyo/.test(w.document.getElementById("bienvenida-error").textContent));
  ok("todavía no se ha guardado nada", !w.localStorage.getItem("continuum-identidad-v1"));
  escribeNombre(w, "  Fernando  ");
  await espera();
  ok("con un nombre válido se entra en la portada", pantalla(w) === "home");
  ok("queda guardado limpio", identidad(w).nombre === "Fernando");
  ok("y como el nombre de siempre, para duelos y salas", w.localStorage.getItem("hilo-nombre-v1") === "Fernando");
  const vuelta = boot({ ...w.localStorage });
  ok("la segunda vez no se vuelve a preguntar", pantalla(vuelta) === "home");
}

console.log("\nQuien ya tenía nombre se reconoce");
{
  const w = boot({ "hilo-nombre-v1": "Marta" });
  ok("entra directo a la portada", pantalla(w) === "home" && identidad(w).nombre === "Marta");
  const invitado = boot({ "hilo-nombre-v1": "Explorador" });
  ok("el nombre por defecto no cuenta como elegido", pantalla(invitado) === "bienvenida");
  const antigua = boot({ "continuum-identidad-v1": JSON.stringify({ nombre: "Lucía", avatar: "buho" }) });
  ok("una identidad guardada con avatar elegido sigue valiendo", pantalla(antigua) === "home" && antigua.CONTINUUM.Identidad.nombre() === "Lucía");
}

console.log("\nEl Atlas: nombre y avatar");
{
  const w = boot({ "continuum-identidad-v1": JSON.stringify({ nombre: "Lucía" }) });
  click(w, '.home-door[data-action="perfil"]');
  const A = w.CONTINUUM.Avatares;
  ok("el Atlas enseña el nombre", w.document.querySelector(".atlas-identidad h2").textContent === "Lucía");
  ok("y el avatar del invitado", w.document.querySelector(".atlas-identidad-avatar").innerHTML === pintado(w, A.markup("Lucía", { size: 72, etiqueta: "Tu avatar", seed: A.ownSeed() })));
  ok("el Atlas permite cambiar de avatar", existe(w, '[data-action="identidad-avatar"]'));
  click(w, '.atlas-identidad-acciones [data-action="identidad-nombre"]');
  w.document.getElementById("identidad-nombre").value = "x";
  w.document.querySelector("[data-identidad]").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await espera();
  ok("un nombre que no vale se explica sin guardarse", /al menos 2/.test(w.document.getElementById("identidad-error").textContent) && identidad(w).nombre === "Lucía");
  w.document.getElementById("identidad-nombre").value = "Lucía G";
  w.document.querySelector("[data-identidad]").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await espera();
  ok("cambiar el nombre lo guarda y conserva el avatar", identidad(w).nombre === "Lucía G" && w.document.querySelector(".atlas-identidad-avatar").innerHTML === pintado(w, A.markup("Lucía G", { size: 72, etiqueta: "Tu avatar", seed: A.ownSeed() })));
}

console.log("\nLos avatares en la partida de un móvil");
{
  const w = boot({ "continuum-identidad-v1": JSON.stringify({ nombre: "Lucía" }) });
  click(w, '[data-action="jugar"]');
  click(w, '[data-action="toggle-play-catalog"][data-section="collections"]');
  click(w, '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  click(w, '[data-format="multi"]');
  click(w, '[data-action="setup"]');
  ok("el primer jugador lleva tu nombre", w.document.querySelector("#players input").value === "Lucía");
  click(w, '[data-action="add-player"]');
  click(w, '[data-action="start"]');
  const partida = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
  const A = w.CONTINUUM.Avatares;
  const actual = partida.players[partida.current];
  ok("la pantalla de pasar el móvil enseña el avatar de quien juega", w.document.querySelector(".player-medallion-avatar").innerHTML === pintado(w, A.markup(actual.name, { size: 76 })));
  click(w, '[data-action="ready"]');
  const marcador = [...w.document.querySelectorAll(".scoreboard .score-avatar")].map(el => el.innerHTML);
  ok("el marcador enseña el avatar de cada jugador", marcador.length === partida.players.length && marcador.every((html, i) => html === pintado(w, A.markup(partida.players[i].name, { size: 40 }))));
  ok("tú apareces con el mismo avatar que en tu Atlas", marcador[0] === pintado(w, A.markup("Lucía", { size: 40 })));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
