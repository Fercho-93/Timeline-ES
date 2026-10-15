// Los avisos push del móvil siguen apagados (deployment.nativePush): sin google-services.json en Android ni
// aps-environment en iPhone, pedir permiso y llamar a register() falla o cierra la app. Con el interruptor
// apagado, push.start() no puede tocar el plugin; encendido, sí, para que no sea código muerto.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
assert.match(read("deployment.js"), /nativePush:\s*false/, "los avisos push deben seguir apagados hasta integrar FCM y APNs");

// push.js importa Firebase desde internet: se sustituyen los import por piezas falsas para ejecutarlo aquí.
const fuente = read("push.js")
  .replace(/^import \{ auth, db \} from '\.\/firebase-client\.js';$/m, "const auth = {}, db = {};")
  .replace(/^import \{[^}]*\} from 'https:\/\/www\.gstatic\.com[^']*';$/m, "const doc = () => ({}), serverTimestamp = () => 0, setDoc = async () => {};");
assert.ok(!/^import /m.test(fuente), "el test debe poder sustituir todos los import de push.js");

async function arrancar(nativePush) {
  const llamadas = [];
  const metodo = nombre => async () => { llamadas.push(nombre); return { receive: "granted" }; };
  globalThis.window = {
    CONTINUUM: { Deployment: { nativePush } },
    Capacitor: {
      isNativePlatform: () => true,
      registerPlugin: () => ({
        checkPermissions: metodo("checkPermissions"), requestPermissions: metodo("requestPermissions"),
        addListener: metodo("addListener"), register: metodo("register")
      })
    }
  };
  const modulo = await import(`data:text/javascript;base64,${Buffer.from(fuente + `\n// ${nativePush}`).toString("base64")}`);
  return { resultado: await modulo.start(), llamadas };
}

const apagado = await arrancar(false);
assert.equal(apagado.resultado, false, "con nativePush apagado start() no registra nada");
assert.deepEqual(apagado.llamadas, [], "con nativePush apagado no se pide permiso ni se llama a register()");

const encendido = await arrancar(true);
assert.equal(encendido.resultado, true, "con nativePush encendido start() registra el dispositivo");
assert.ok(encendido.llamadas.includes("register"), "con nativePush encendido se llama a register()");

console.log("Avisos push del móvil: apagados por defecto, sin permiso ni registro; encendidos funcionan: OK");
