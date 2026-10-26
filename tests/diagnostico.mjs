import { ok, fail } from "./lib/comun.mjs";
import { arrancarJuego } from "./lib/dom.mjs";
// Cuando algo se rompe de verdad, quien prueba la aplicación no debería quedarse ante
// una pantalla en blanco sin nada que contar. Comprueba que un error sin capturar
// enseña un aviso con lo necesario para depurarlo a distancia, que no se duplica si
// llegan varios errores seguidos, y que el botón de comentarios de Ajustes usa el mismo
// informe y avisa con claridad mientras no haya una dirección configurada.

const espera = () => new Promise(resolve => setTimeout(resolve, 30));

function boot() {
  return arrancarJuego();
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
  ok("es un diálogo de verdad: el foco entra en «Ir al inicio»", w.document.activeElement?.dataset?.crashAction === "inicio");
  ok("el aviso no asusta: no dice «ha fallado» y el informe va plegado", !/ha fallado/i.test(w.document.querySelector(".modal").textContent.split("Ver el informe")[0]) && !!w.document.querySelector(".modal details"));

  // Un segundo error no debe apilar una segunda pantalla encima.
  w.dispatchEvent(new w.ErrorEvent("error", { message: "otro fallo distinto", error: new w.Error("otro fallo distinto") }));
  await espera();
  ok("un segundo error no duplica la pantalla", w.document.querySelectorAll("#crash-detalle").length === 1);

  // jsdom no deja espiar `location.reload` (es de solo lectura) ni completa una
  // navegación de verdad; lo que sí puede comprobar esta prueba es que el botón está
  // conectado y no rompe nada al pulsarlo.
  click(w, '[data-crash-action="inicio"]');
  ok("«Ir al inicio» no rompe nada al pulsarlo", true);
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

console.log("\nUna petición sin conexión no cuenta como fallo");
{
  const w = boot();
  for (const reason of [Object.assign(new w.Error("Firebase: Error (auth/network-request-failed)."), { code: "auth/network-request-failed" }), new w.TypeError("Load failed"), Object.assign(new w.Error("client offline"), { code: "unavailable" })]) {
    w.dispatchEvent(Object.assign(new w.Event("unhandledrejection"), { reason }));
  }
  await espera();
  ok("ninguna se enseña como fallo", !w.document.querySelector("#crash-detalle"));
  w.dispatchEvent(Object.assign(new w.Event("unhandledrejection"), { reason: new w.Error("algo de verdad roto") }));
  await espera();
  ok("un rechazo que no es de red sí se enseña", !!w.document.querySelector("#crash-detalle"));
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
