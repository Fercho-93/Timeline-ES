// El service worker decide qué versión de la aplicación ve el móvil, así que conviene
// comprobarlo: sirve lo guardado (para jugar sin conexión) pero refresca por detrás, de
// modo que un archivo nuevo llega en el siguiente arranque aunque se olvide subir el
// número de la caché. Se ejecuta el archivo real con un entorno de service worker falso.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };
const espera = () => new Promise(resolve => setTimeout(resolve, 10));

function respuesta(cuerpo, { ok: correcta = true, type = "basic" } = {}) {
  return { cuerpo, ok: correcta, type, clone() { return respuesta(cuerpo, { ok: correcta, type }); } };
}

function arrancar() {
  const guardado = new Map();
  const listeners = {};
  const peticiones = [];
  const opciones = [];
  const tareas = [];
  const precargas = [];
  let servidor = url => respuesta(`${url} del servidor`);
  const cache = {
    match: async request => guardado.get(request.url),
    put: async (request, response) => { guardado.set(request.url, response); },
    addAll: async requests => { requests.forEach(request => { precargas.push(request); guardado.set(request.url, respuesta(`${request.url} precargado`)); }); }
  };
  const contexto = {
    self: {
      addEventListener: (name, fn) => { listeners[name] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    },
    caches: {
      open: async () => cache,
      match: async request => guardado.get(request.url || request),
      keys: async () => ["hilo-modos-v9"],
      delete: async () => true
    },
    fetch: async (request, options) => { peticiones.push(request.url); opciones.push(options); return servidor(request.url); },
    Request: class { constructor(url, options) { this.url = url; this.cache = options.cache; } },
    Response: { error: () => respuesta("error de red", { ok: false }) },
    setTimeout, Promise
  };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(REPO, "service-worker.js"), "utf8"), contexto);

  const pedir = async (url, mode = "same-origin", method = "GET") => {
    let devuelta;
    listeners.fetch({ request: { url, method, mode }, respondWith: valor => { devuelta = valor; }, waitUntil: tarea => tareas.push(tarea) });
    return devuelta ? await devuelta : undefined;
  };
  return { pedir, guardado, peticiones, opciones, tareas, precargas, listeners, cache, servidor: fn => { servidor = fn; } };
}

console.log("\nService worker");
{
  const sw = arrancar();
  let instalada;
  sw.listeners.install({ waitUntil: tarea => { instalada = tarea; } });
  await instalada;
  ok("instalar una versión nueva evita reutilizar archivos viejos de la caché HTTP", sw.precargas.length > 0 && sw.precargas.every(request => request.cache === "reload"));
}
{
  const sw = arrancar();
  sw.guardado.set("./online.js", respuesta("online.js viejo"));
  const primera = await sw.pedir("./online.js");
  ok("responde con la copia guardada, para poder jugar sin conexión", primera.cuerpo === "online.js viejo");
  await espera();
  ok("pero pide la versión del servidor por detrás", sw.peticiones.includes("./online.js"));
  ok("el refresco revalida la caché HTTP", sw.opciones[0].cache === "no-cache");
  ok("el trabajador espera a completar el refresco", sw.tareas.length === 1);
  await Promise.all(sw.tareas);
  const segunda = await sw.pedir("./online.js");
  ok("y en el siguiente arranque ya sirve la nueva", segunda.cuerpo === "./online.js del servidor");
}
{
  const sw = arrancar();
  sw.guardado.set("./styles.css", respuesta("estilos anteriores"));
  let terminaGuardado;
  const pendiente = new Promise(resolve => { terminaGuardado = resolve; });
  const guardar = sw.cache.put;
  sw.cache.put = async (...args) => { await pendiente; await guardar(...args); };
  const primera = await sw.pedir("./styles.css");
  let terminada = false;
  sw.tareas[0].then(() => { terminada = true; });
  await espera();
  ok("la respuesta local no espera a una escritura lenta", primera.cuerpo === "estilos anteriores" && !terminada);
  terminaGuardado();
  await Promise.all(sw.tareas);
  ok("la tarea de fondo incluye la escritura completa", sw.guardado.get("./styles.css").cuerpo === "./styles.css del servidor");
}
{
  const sw = arrancar();
  sw.cache.put = async () => { throw new Error("sin espacio"); };
  const response = await sw.pedir("./app.js");
  ok("sin espacio de caché sigue entregando la respuesta de red", response.cuerpo === "./app.js del servidor");
}
{
  const sw = arrancar();
  sw.servidor(() => respuesta("página de error", { ok: false }));
  await sw.pedir("./app.js");
  await espera();
  ok("no guarda respuestas con error", !sw.guardado.has("./app.js"));
}
{
  const sw = arrancar();
  sw.servidor(url => respuesta(`${url} de otro dominio`, { type: "cors" }));
  await sw.pedir("./ajeno.js");
  await espera();
  ok("no guarda respuestas de otros dominios", !sw.guardado.has("./ajeno.js"));
}
{
  const sw = arrancar();
  sw.guardado.set("./index.html", respuesta("portada guardada"));
  sw.servidor(() => { throw new Error("sin conexión"); });
  const sinRed = await sw.pedir("./nueva-ruta", "navigate");
  ok("sin conexión y sin copia, devuelve la portada guardada", sinRed.cuerpo === "portada guardada");
}
{
  const sw = arrancar();
  const envio = await sw.pedir("./sala", "same-origin", "POST");
  ok("no se mete en las peticiones que no son GET", envio === undefined);
}
{
  // Un archivo nuevo en `index.html` que no esté en la lista de precarga no se guarda al
  // instalar: la aplicación se abriría rota al quedarse sin conexión.
  const fuente = fs.readFileSync(path.join(REPO, "service-worker.js"), "utf8");
  const precargados = [...fuente.matchAll(/"(\.\/[^"]+)"/g)].map(m => m[1]);
  const guiones = [...fs.readFileSync(path.join(REPO, "index.html"), "utf8")
    .matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => `./${m[1]}`);
  const olvidados = guiones.filter(archivo => !precargados.includes(archivo));
  ok(`todos los guiones de index.html se precargan${olvidados.length ? ` (falta ${olvidados.join(", ")})` : ""}`, !olvidados.length);

  // Y lo mismo con las carátulas, que se piden por su nombre montado a mano.
  const app = fs.readFileSync(path.join(REPO, "app.js"), "utf8");
  const archivos = [...new Set([...app.matchAll(/archivo: "(hero-[a-z]+)"/g)].map(m => m[1]))];
  const anchos = (app.match(/const ancho = active \? (\d+) : (\d+);/) || []).slice(1);
  const caratulas = archivos.flatMap(nombre => anchos.map(ancho => `./assets/${nombre}-${ancho}.webp`));
  ok(`se deducen dos tamaños por cada carátula (${caratulas.length})`, caratulas.length === archivos.length * 2);
  const sinPrecargar = caratulas.filter(archivo => !precargados.includes(archivo));
  ok(`todas se precargan${sinPrecargar.length ? ` (falta ${sinPrecargar.join(", ")})` : ""}`, !sinPrecargar.length);
  const sinArchivo = caratulas.filter(archivo => !fs.existsSync(path.join(REPO, archivo)));
  ok(`y todas existen en disco${sinArchivo.length ? ` (falta ${sinArchivo.join(", ")})` : ""}`, !sinArchivo.length);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
