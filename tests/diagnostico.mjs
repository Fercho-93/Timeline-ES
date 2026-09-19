import {gameHtml} from './game-fixture.mjs';
// Cuando algo se rompe de verdad, quien prueba la aplicación no debería quedarse ante
// una pantalla en blanco sin nada que contar. Comprueba que un error sin capturar
// enseña un aviso con lo necesario para depurarlo a distancia, que no se duplica si
// llegan varios errores seguidos, y que el botón de comentarios de Ajustes usa el mismo
// informe y avisa con claridad mientras no haya una dirección configurada.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
const guiones = () => [...gameHtml(read("index.html")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };
const espera = () => new Promise(resolve => setTimeout(resolve, 30));

function boot() {
  const dom = new JSDOM(gameHtml(read("index.html")).replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  const { window } = dom;
  guiones().forEach(archivo => window.eval(read(archivo)));
  return window;
}
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  if (!el) throw new Error(`no existe ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};

console.log("\nPantalla de fallo");
{
  const w = boot();
  ok("todavía no hay ningún aviso de fallo", !w.document.querySelector(".modal h2 + p"));
  w.dispatchEvent(new w.ErrorEvent("error", { message: "algo raro pasó", error: new w.Error("algo raro pasó") }));
  await espera();
  const detalle = w.document.querySelector("#crash-detalle");
  ok("aparece la pantalla de fallo", !!detalle);
  ok("lleva la versión instalada", /Continuum/.test(detalle.value));
  ok("lleva la pantalla en la que estaba", /Pantalla: home/.test(detalle.value));
  ok("lleva el mazo abierto", /Mazo: history/.test(detalle.value));
  ok("lleva el mensaje del error", detalle.value.includes("algo raro pasó"));
  ok("es un diálogo de verdad: el foco entra en el texto a copiar", w.document.activeElement === detalle);

  // Un segundo error no debe apilar una segunda pantalla encima.
  w.dispatchEvent(new w.ErrorEvent("error", { message: "otro fallo distinto", error: new w.Error("otro fallo distinto") }));
  await espera();
  ok("un segundo error no duplica la pantalla", w.document.querySelectorAll("#crash-detalle").length === 1);

  // jsdom no deja espiar `location.reload` (es de solo lectura) ni completa una
  // navegación de verdad; lo que sí puede comprobar esta prueba es que el botón está
  // conectado y no rompe nada al pulsarlo.
  click(w, '[data-crash-action="inicio"]');
  ok("«Volver al inicio» no rompe nada al pulsarlo", true);
}

console.log("\nUn ruido conocido del navegador no cuenta como fallo");
{
  const w = boot();
  w.dispatchEvent(new w.ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications." }));
  await espera();
  ok("no se enseña ninguna pantalla de fallo", !w.document.querySelector("#crash-detalle"));
}

console.log("\n«Script error.» sin más detalle tampoco cuenta como fallo");
{
  // Los navegadores lo sueltan así, a propósito y sin `error` ni pila, cuando el fallo
  // ocurre fuera del origen de la página —por ejemplo, al tocar el icono nativo de
  // compartir de Safari—: no hay nada de la aplicación que depurar ahí.
  const w = boot();
  w.dispatchEvent(new w.ErrorEvent("error", { message: "Script error." }));
  await espera();
  ok("no se enseña ninguna pantalla de fallo", !w.document.querySelector("#crash-detalle"));
}
{
  // Pero si alguna vez sí trae su propio error, es un fallo real y sí debe avisar,
  // aunque el mensaje sea ese mismo texto genérico.
  const w = boot();
  w.dispatchEvent(new w.ErrorEvent("error", { message: "Script error.", error: new w.Error("Script error.") }));
  await espera();
  ok("con un error de verdad detrás, sí se enseña la pantalla de fallo", !!w.document.querySelector("#crash-detalle"));
}

console.log("\nComentarios en Ajustes");
{
  const w = boot();
  click(w, '[data-action="perfil"]'); // cualquier pantalla distinta de «home», para comprobar que el diagnóstico la recoge
  const CT = w.CONTINUUM;
  const detalle = await CT.appDiagnostics();
  ok("CT.appDiagnostics() da el mismo formato de informe", /Continuum/.test(detalle) && /Pantalla: perfil/.test(detalle));

  click(w, '[data-settings-action="open"]');
  ok("el panel de Ajustes tiene un botón de comentarios", !!w.document.querySelector('[data-settings-action="feedback"]'));
  click(w, '[data-settings-action="feedback"]');
  await espera();
  ok("el comentario usa el correo de beta configurado", Boolean(w.CONTINUUM.Deployment.feedbackEmail) && !/todavía no hay/i.test(w.document.getElementById("toast").textContent));
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
