import { gameHtml } from "./game-fixture.mjs";
// Identidad: la bienvenida pide el nombre y asigna un avatar, el Atlas deja cambiarlos
// y la partida en un móvil los usa para distinguir a cada cual.
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

console.log("\nLos nueve avatares");
{
  const w = boot();
  const A = w.CONTINUUM.Avatares;
  ok("hay nueve", A.LISTA.length === 9 && new Set(A.LISTA.map(a => a.key)).size === 9);
  ok("cada uno con su color", new Set(A.LISTA.map(a => a.color)).size === 9);
  ok("uno al azar respeta los ya usados", Array.from({ length: 30 }, () => A.aleatorio(["brujula", "buho"])).every(k => !["brujula", "buho"].includes(k)));
}

console.log("\nLa primera vez: nombre y avatar");
{
  const w = boot();
  ok("sin identidad se entra por la bienvenida", pantalla(w) === "bienvenida" && existe(w, "#bienvenida-nombre"));
  ok("la bienvenida no lleva barra inferior", !existe(w, ".home-nav"));
  escribeNombre(w, "a");
  await espera();
  ok("un nombre demasiado corto se explica", /al menos 2/.test(w.document.getElementById("bienvenida-error").textContent));
  escribeNombre(w, "Player 1234");
  await espera();
  ok("el nombre que pone el juego no vale como propio", /nombre tuyo/.test(w.document.getElementById("bienvenida-error").textContent));
  escribeNombre(w, "  Fernando  ");
  await espera();
  const asignado = w.document.querySelector('.avatar-option[aria-checked="true"]')?.dataset.avatar;
  ok("después se asigna un avatar al azar", !!asignado && w.CONTINUUM.Avatares.valido(asignado));
  ok("y se ofrecen los nueve para cambiarlo", w.document.querySelectorAll(".avatar-option").length === 9);
  ok("el nombre aparece limpio", w.document.querySelector(".bienvenida h1").textContent === "Fernando");
  const otro = w.CONTINUUM.Avatares.LISTA.find(a => a.key !== asignado).key;
  click(w, `[data-action="bienvenida-avatar"][data-avatar="${otro}"]`);
  ok("se puede elegir otro", w.document.querySelector('.avatar-option[aria-checked="true"]').dataset.avatar === otro);
  ok("todavía no se ha guardado nada", !w.localStorage.getItem("continuum-identidad-v1"));
  click(w, '[data-action="bienvenida-fin"]');
  ok("al terminar se entra en la portada", pantalla(w) === "home");
  ok("queda guardada la identidad", identidad(w).nombre === "Fernando" && identidad(w).avatar === otro);
  ok("y el nombre de siempre, para duelos y salas", w.localStorage.getItem("hilo-nombre-v1") === "Fernando");
  const vuelta = boot({ ...w.localStorage });
  ok("la segunda vez no se vuelve a preguntar", pantalla(vuelta) === "home");
}

console.log("\nQuien ya tenía nombre se reconoce");
{
  const w = boot({ "hilo-nombre-v1": "Marta" });
  ok("entra directo a la portada", pantalla(w) === "home");
  ok("con su nombre y un avatar asignado", identidad(w).nombre === "Marta" && w.CONTINUUM.Avatares.valido(identidad(w).avatar));
  const invitado = boot({ "hilo-nombre-v1": "Explorador" });
  ok("el nombre por defecto no cuenta como elegido", pantalla(invitado) === "bienvenida");
}

console.log("\nEl Atlas: ver y cambiar nombre y avatar");
{
  const w = boot({ "continuum-identidad-v1": JSON.stringify({ nombre: "Lucía", avatar: "buho" }) });
  click(w, '.home-door[data-action="perfil"]');
  ok("el Atlas enseña el nombre", w.document.querySelector(".atlas-identidad h2").textContent === "Lucía");
  ok("y el avatar", /Búho/.test(w.document.querySelector(".atlas-identidad-avatar").getAttribute("aria-label")));
  click(w, '.atlas-identidad-acciones [data-action="identidad-nombre"]');
  w.document.getElementById("identidad-nombre").value = "x";
  w.document.querySelector("[data-identidad]").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await espera();
  ok("un nombre que no vale se explica sin guardarse", /al menos 2/.test(w.document.getElementById("identidad-error").textContent) && identidad(w).nombre === "Lucía");
  w.document.getElementById("identidad-nombre").value = "Lucía G";
  w.document.querySelector("[data-identidad]").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await espera();
  ok("cambiar el nombre lo guarda y lo enseña", identidad(w).nombre === "Lucía G" && w.document.querySelector(".atlas-identidad h2").textContent === "Lucía G");
  click(w, '.atlas-identidad-acciones [data-action="identidad-avatar"]');
  ok("el selector ofrece los nueve", w.document.querySelectorAll('[data-action="identidad-avatar-elige"]').length === 9);
  click(w, '[data-action="identidad-avatar-elige"][data-avatar="ancla"]');
  ok("elegir otro avatar lo guarda", identidad(w).avatar === "ancla" && /Ancla/.test(w.document.querySelector(".atlas-identidad-avatar").getAttribute("aria-label")));
}

console.log("\nLos avatares en la partida de un móvil");
{
  const w = boot({ "continuum-identidad-v1": JSON.stringify({ nombre: "Lucía", avatar: "buho" }) });
  click(w, '[data-action="jugar"]');
  click(w, '[data-block="historia"]');
  click(w, '[data-mode="history"]');
  click(w, '[data-format="multi"]');
  click(w, '[data-action="setup"]');
  ok("el primer jugador lleva tu nombre", w.document.querySelector("#players input").value === "Lucía");
  click(w, '[data-action="add-player"]');
  click(w, '[data-action="start"]');
  const partida = JSON.parse(w.localStorage.getItem("hilo-game-history-v1"));
  const avatares = partida.players.map(p => p.avatar);
  ok("tú juegas con tu avatar", partida.players[0].avatar === "buho");
  ok("cada jugador tiene uno distinto", new Set(avatares).size === avatares.length && avatares.every(k => w.CONTINUUM.Avatares.valido(k)));
  ok("la pantalla de pasar el móvil enseña el avatar", !!w.document.querySelector(".player-medallion-avatar svg.avatar"));
  click(w, '[data-action="ready"]');
  ok("el marcador enseña un avatar por jugador", w.document.querySelectorAll(".scoreboard .score-avatar svg.avatar").length === avatares.length);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
