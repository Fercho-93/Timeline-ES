// El service worker decide qué versión de la aplicación ve el móvil, así que conviene
// comprobarlo: sirve una copia estable por versión y espera una petición explícita
// para activar la siguiente, sin interrumpir otra pestaña. Se ejecuta el archivo real
// con un entorno de service worker falso.
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
  let activaciones = 0;
  let servidor = url => respuesta(`${url} del servidor`);
  const cache = {
    match: async request => guardado.get(request.url || request),
    put: async (request, response) => { guardado.set(request.url, response); },
    addAll: async requests => { requests.forEach(request => { precargas.push(request); guardado.set(request.url, respuesta(`${request.url} precargado`)); }); }
  };
  const contexto = {
    self: {
      location: { href: "https://hilo.test/", origin: "https://hilo.test" },
      registration: { scope: "https://hilo.test/" },
      addEventListener: (name, fn) => { listeners[name] = fn; },
      skipWaiting: async () => { activaciones++; },
      clients: { matchAll: async () => [], claim: async () => {} }
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
    setTimeout, Promise, URL
  };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(REPO, "service-worker.js"), "utf8"), contexto);

  const pedir = async (url, mode = "same-origin", method = "GET") => {
    let devuelta;
    listeners.fetch({ request: { url, method, mode }, respondWith: valor => { devuelta = valor; }, waitUntil: tarea => tareas.push(tarea) });
    return devuelta ? await devuelta : undefined;
  };
  return { contexto, activaciones: () => activaciones, pedir, guardado, peticiones, opciones, tareas, precargas, listeners, cache, servidor: fn => { servidor = fn; } };
}

console.log("\nService worker");
{
  const sw = arrancar();
  let instalada;
  sw.listeners.install({ waitUntil: tarea => { instalada = tarea; } });
  await instalada;
  ok("instalar una versión nueva evita reutilizar archivos viejos de la caché HTTP", sw.precargas.length > 0 && sw.precargas.every(request => request.cache === "reload"));
  ok("instalar no activa automáticamente una actualización", sw.activaciones() === 0);
  let tarea;
  const mensajes = [];
  sw.contexto.self.clients.matchAll = async () => [{url:"https://hilo.test/"},{url:"https://hilo.test/?room=X"}];
  sw.listeners.message({data:{type:"ACTIVATE_UPDATE"},source:{postMessage:m=>mensajes.push(m)},waitUntil:p=>{tarea=p;}});
  await tarea;
  ok("otra pestaña impide activar el nuevo trabajador", sw.activaciones() === 0 && mensajes[0].type === "UPDATE_BLOCKED");
  sw.contexto.self.clients.matchAll = async () => [{url:"https://hilo.test/"}];
  sw.listeners.message({data:{type:"ACTIVATE_UPDATE"},waitUntil:p=>{tarea=p;}});
  await tarea;
  ok("se activa al pedirlo desde la única pestaña", sw.activaciones() === 1);
  // Casi cien archivos y 5,5 MB: quien nunca abre Naturaleza no debería pagar esa
  // descarga solo por instalar la aplicación. Se cachean por demanda, no al instalar.
  const animalAssets = fs.readdirSync(path.join(REPO, "assets", "animal-cards"))
    .filter(file => file.endsWith(".webp"))
    .map(file => `./assets/animal-cards/${file}`);
  const cachedAssets = new Set(sw.precargas.map(request => request.url));
  const animalesPrecargados = animalAssets.filter(file => cachedAssets.has(file));
  ok(`las ${animalAssets.length} ilustraciones de animales NO se precargan al instalar${animalesPrecargados.length ? ` (se coló ${animalesPrecargados.join(", ")})` : ""}`, !animalesPrecargados.length);
}
{
  const sw = arrancar();
  sw.guardado.set("./online.js", respuesta("online.js viejo"));
  const primera = await sw.pedir("./online.js");
  ok("responde con la copia guardada, para poder jugar sin conexión", primera.cuerpo === "online.js viejo");
  await espera();
  ok("no mezcla código nuevo con la partida abierta", sw.peticiones.length === 0);
  const segunda = await sw.pedir("./online.js");
  ok("conserva la misma versión hasta activar una actualización", segunda.cuerpo === "online.js viejo");
}
{
  // Una lámina de animal no precargada: la primera vez que se pide viaja a la red
  // igualmente, y a partir de ahí queda guardada, como cualquier otro archivo que ya se
  // hubiera visto — es lo que permite jugar Naturaleza sin conexión tras la primera vez.
  const sw = arrancar();
  const lamina = "./assets/animal-cards/lion.webp";
  const primera = await sw.pedir(lamina);
  ok("una lámina no precargada se sirve igual, bajándola de la red", primera.cuerpo === `${lamina} del servidor`);
  await Promise.all(sw.tareas);
  ok("y queda guardada en caché tras esa primera vez", sw.guardado.get(lamina)?.cuerpo === `${lamina} del servidor`);
}
{
  const sw = arrancar();
  sw.guardado.set("./styles.css", respuesta("estilos anteriores"));
  sw.cache.put = async () => { throw Error("No debe modificar la copia activa"); };
  const primera = await sw.pedir("./styles.css");
  ok("los estilos activos también permanecen estables", primera.cuerpo === "estilos anteriores" && sw.peticiones.length === 0);
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
