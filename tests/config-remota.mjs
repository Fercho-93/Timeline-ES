// Cartel remoto (app-config.js): pide actualizar a una versión antigua, pausa el online sin tocar el modo sin
// conexión, y ante cualquier fallo de lectura deja el juego como está. Firebase se simula; se ejecuta el archivo real.
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

// El módulo está cableado: se carga desde app.js, index.html, el build móvil y la precarga del service worker.
assert.match(read("app.js"), /import\('\.\/app-config\.js'\)/, "app.js debe cargar app-config.js");
assert.match(read("app.js"), /appConfigReady\.then\(module => module\?\.start\?\.\(\)\)/, "app.js debe arrancar el cartel remoto");
assert.match(read("index.html"), /src="app-config\.js"/, "index.html debe listar app-config.js");
assert.match(read("scripts/build.mjs"), /"app-config\.js"/, "el build móvil debe copiar app-config.js");
assert.match(read("service-worker-258.js"), /"\.\/app-config\.js"/, "el service worker debe precargar app-config.js");

const fuente = read("app-config.js")
  .replace(/^import \{ auth, db \} from '\.\/firebase-client\.js';$/m, "const { auth, db } = globalThis.__fake;")
  .replace(/^import \{[^}]*\} from 'https:\/\/www\.gstatic\.com[^']*';$/m, "const { doc, getDocFromServer, disableNetwork, enableNetwork } = globalThis.__fake;");
assert.ok(!/^import /m.test(fuente), "el test debe poder sustituir todos los import de app-config.js");

let n = 0;
async function cargar({ version = "continuum-v100", native = false, config, fallo = false, sinSesion = false }) {
  const dom = new JSDOM("<!doctype html><body></body>");
  const llamadas = [], ctl = { config };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  window.CONTINUUM = { APP_VERSION: version };
  if (native) window.Capacitor = { isNativePlatform: () => true };
  globalThis.__fake = {
    auth: { authStateReady: async () => {}, currentUser: sinSesion ? null : { uid: "ana" } },
    db: {},
    doc: (_db, ...ruta) => ruta.join("/"),
    getDocFromServer: async ruta => { llamadas.push(`get ${ruta}`); if (fallo) throw new Error("unavailable"); return { exists: () => ctl.config !== undefined, data: () => ctl.config }; },
    disableNetwork: async () => { llamadas.push("disableNetwork"); },
    enableNetwork: async () => { llamadas.push("enableNetwork"); }
  };
  const modulo = await import(`data:text/javascript;base64,${Buffer.from(`${fuente}\n// ${n++}`).toString("base64")}`);
  return { modulo, llamadas, ctl, body: dom.window.document.body };
}

// evaluate y buildOf
{
  const { modulo } = await cargar({});
  assert.equal(modulo.buildOf("continuum-v749"), 749);
  assert.equal(modulo.buildOf("raro"), 0);
  assert.equal(modulo.buildOf(undefined), 0);
  const ev = (config, build = 100) => modulo.evaluate(config, build);
  assert.equal(ev(null).mode, "ok", "sin documento no pasa nada");
  assert.equal(ev({}).mode, "ok");
  assert.equal(ev({ minBuild: 100 }).mode, "ok", "la versión mínima igual a la actual es válida");
  assert.equal(ev({ minBuild: 101 }).mode, "update", "una versión por debajo del mínimo debe actualizar");
  assert.equal(ev({ minBuild: "999" }).mode, "ok", "un minBuild que no es entero se ignora");
  assert.equal(ev({ minBuild: 999 }, 0).mode, "ok", "sin versión reconocible nunca se bloquea");
  assert.equal(ev({ onlineEnabled: false }).mode, "paused");
  assert.equal(ev({ onlineEnabled: "no" }).mode, "ok", "solo false pausa");
  assert.equal(ev({ minBuild: 200, onlineEnabled: false }).mode, "update", "actualizar manda sobre pausar");
  assert.equal(ev({ onlineEnabled: false, message: "x".repeat(500) }).message.length, 200, "el mensaje se recorta");
  assert.equal(ev({ minBuild: 200, updateUrl: "http://inseguro" }).url, "", "solo enlaces https");
  assert.equal(ev({ minBuild: 200, updateUrl: "https://apps.apple.com/x" }).url, "https://apps.apple.com/x");
}

// Sin cartel: no se toca nada.
{
  const { modulo, llamadas, body } = await cargar({ config: undefined });
  assert.equal((await modulo.check()).mode, "ok");
  assert.deepEqual(llamadas, ["get appConfig/current"], "sin cartel solo se lee");
  assert.equal(body.children.length, 0, "sin cartel no se pinta nada");
}

// Pausa: aviso visible, sin bloquear, y el online se apaga una sola vez.
{
  const { modulo, llamadas, ctl, body } = await cargar({ config: { onlineEnabled: false, message: "Volvemos a las 18:00." } });
  assert.equal((await modulo.check()).mode, "paused");
  assert.ok(llamadas.includes("disableNetwork"), "la pausa desactiva la red de Firestore");
  const aviso = body.querySelector(".app-config-banner");
  assert.ok(aviso && aviso.textContent === "Volvemos a las 18:00.", "se muestra el mensaje del cartel");
  assert.equal(aviso.getAttribute("role"), "status");
  assert.equal(body.querySelector(".app-config-update"), null, "la pausa no bloquea con una pantalla");
  // Al quitar el cartel, el siguiente chequeo reabre el online y retira el aviso.
  ctl.config = undefined;
  assert.equal((await modulo.check()).mode, "ok");
  assert.ok(llamadas.includes("enableNetwork"), "al levantar la pausa se vuelve a conectar");
  assert.equal(body.querySelector(".app-config-banner"), null, "al levantar la pausa desaparece el aviso");
}

// Actualizar: en web enlaza a la página de rescate; en la app, al enlace de la tienda o solo texto; siempre se puede seguir sin conexión.
{
  const web = await cargar({ config: { minBuild: 500 } });
  assert.equal((await web.modulo.check()).mode, "update");
  assert.ok(web.llamadas.includes("disableNetwork"), "una versión antigua no usa el servidor");
  const dialogo = web.body.querySelector(".app-config-update");
  assert.equal(dialogo.getAttribute("role"), "alertdialog");
  assert.equal(dialogo.querySelector("a").getAttribute("href"), "actualizar.html");
  dialogo.querySelector("button").click();
  assert.equal(web.body.querySelector(".app-config-update"), null, "«Seguir sin conexión» cierra el aviso");

  const tienda = await cargar({ native: true, config: { minBuild: 500, updateUrl: "https://apps.apple.com/app/continuum" } });
  await tienda.modulo.check();
  assert.equal(tienda.body.querySelector("a").getAttribute("href"), "https://apps.apple.com/app/continuum");

  const sinEnlace = await cargar({ native: true, config: { minBuild: 500 } });
  await sinEnlace.modulo.check();
  assert.equal(sinEnlace.body.querySelector("a"), null, "en la app sin enlace no se inventa uno");
  assert.ok(sinEnlace.body.querySelector("button"), "pero se puede seguir sin conexión");
}

// Fallos: sin red, sin sesión o sin permiso el juego sigue igual.
{
  const caido = await cargar({ fallo: true, config: { onlineEnabled: false } });
  assert.equal((await caido.modulo.check()).mode, "ok", "si no se puede leer, no se pausa");
  assert.ok(!caido.llamadas.includes("disableNetwork"));
  assert.equal(caido.body.children.length, 0);
  const anonimo = await cargar({ sinSesion: true, config: { onlineEnabled: false } });
  assert.equal((await anonimo.modulo.check()).mode, "ok", "sin sesión no se lee ni se pausa");
  assert.deepEqual(anonimo.llamadas, []);
}

console.log("Cartel remoto: actualizar, pausar el online, levantar la pausa y no hacer nada ante fallos: OK");
