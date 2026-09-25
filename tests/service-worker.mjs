// El service worker decide qué versión de la aplicación ve el móvil, así que conviene
// comprobarlo: sirve una copia estable por versión, activa la nueva al instalar
// y conserva la petición explícita de clientes antiguos. Se ejecuta el archivo real
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
    // La precarga pide cada archivo con `?v=<versión>`; la ruta `fetch` lo busca ignorando
    // la consulta, así que aquí se guarda por su ruta de siempre.
    addAll: async requests => { requests.forEach(request => { precargas.push(request); const url = request.url.split("?")[0]; guardado.set(url, respuesta(`${url} precargado`)); }); }
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
  vm.runInContext(fs.readFileSync(path.join(REPO, "service-worker-258.js"), "utf8"), contexto);

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
  ok("cada archivo se pide con la versión en la URL, para no mezclar archivos viejos de la CDN", sw.precargas.every(request => /[?&]v=continuum-v\d+/.test(request.url)));
  ok("instalar activa la versión nueva", sw.activaciones() === 1);
  let tarea;
  const mensajes = [];
  sw.contexto.self.clients.matchAll = async () => [{url:"https://hilo.test/", navigate: async () => {}},{url:"https://hilo.test/?room=X", navigate: async () => {}}];
  sw.listeners.message({data:{type:"ACTIVATE_UPDATE"},source:{postMessage:m=>mensajes.push(m)},waitUntil:p=>{tarea=p;}});
  await tarea;
  ok("la petición antigua avisa si hay otra pestaña", sw.activaciones() === 1 && mensajes[0].type === "UPDATE_BLOCKED");
  sw.contexto.self.clients.matchAll = async () => [{url:"https://hilo.test/", navigate: async () => {}}];
  sw.listeners.message({data:{type:"ACTIVATE_UPDATE"},waitUntil:p=>{tarea=p;}});
  await tarea;
  ok("la petición antigua también puede activar desde una pestaña", sw.activaciones() === 2);
  // Casi cien archivos y 5,5 MB: quien nunca abre Naturaleza no debería pagar esa
  // descarga solo por instalar la aplicación. Se cachean por demanda, no al instalar.
  const animalAssets = fs.readdirSync(path.join(REPO, "assets", "animal-cards"))
    .filter(file => file.endsWith(".webp"))
    .map(file => `./assets/animal-cards/${file}`);
  const cachedAssets = new Set(sw.precargas.map(request => request.url.split("?")[0]));
  const avatars = fs.readdirSync(path.join(REPO, "assets", "avatars"))
    .filter(file => file.endsWith(".webp")).map(file => `./assets/avatars/${file}`);
  ok("los 36 medallones se precargan para jugar sin conexión", avatars.length === 36 && avatars.every(file => cachedAssets.has(file)));

  const animalesPrecargados = animalAssets.filter(file => cachedAssets.has(file));
  ok(`las ${animalAssets.length} ilustraciones de animales NO se precargan al instalar${animalesPrecargados.length ? ` (se coló ${animalesPrecargados.join(", ")})` : ""}`, !animalesPrecargados.length);
  const populationAssets = fs.readdirSync(path.join(REPO, "assets", "population-cards"))
    .filter(file => file.endsWith(".webp"))
    .map(file => `./assets/population-cards/${file}`);
  const populationNoPrecargadas = populationAssets.filter(file => !cachedAssets.has(file));
  ok(`las ${populationAssets.length} ilustraciones de población sí se precargan al instalar${populationNoPrecargadas.length ? ` (faltan ${populationNoPrecargadas.join(", ")})` : ""}`, !populationNoPrecargadas.length);
  const languageAssets = fs.readdirSync(path.join(REPO, "assets", "language-cards"))
    .filter(file => file.endsWith(".webp"))
    .map(file => `./assets/language-cards/${file}`);
  const languageNoPrecargadas = languageAssets.filter(file => !cachedAssets.has(file));
  ok(`las ${languageAssets.length} ilustraciones de idiomas sí se precargan al instalar${languageNoPrecargadas.length ? ` (faltan ${languageNoPrecargadas.join(", ")})` : ""}`, !languageNoPrecargadas.length);
  // Lo mismo con las seis canciones —27 MB de un ajuste que viene apagado—: instalar no
  // las baja, pero quedan guardadas para poder sonar sin conexión.
  const musica = Array.from({ length: 6 }, (unused, i) => `./assets/audio/v${i + 1}.mp3`);
  ok("las seis canciones NO se precargan al instalar", musica.every(file => !cachedAssets.has(file)));
  let activada;
  sw.listeners.activate({ waitUntil: tarea => { activada = tarea; } });
  await activada;
  // La descarga va aparte del `waitUntil`: activar no puede quedarse esperando 27 MB,
  // porque mientras tanto las peticiones de la página no se atienden.
  ok("activar no espera a que baje la música", sw.guardado.get(musica[5]) === undefined);
  for (let i = 0; i < 8; i++) await espera();
  ok("y la música se guarda al activar la versión", musica.every(file => sw.guardado.get(file)?.cuerpo === `${file} del servidor`));
  ok("activar solo va a la red a por la música", sw.peticiones.every(url => musica.includes(url)));
}
{
  // Al activarse, la versión nueva no recarga en seco a quien puede estar escribiendo:
  // avisa a la página y solo la recarga ella si no contesta (una versión anterior).
  const sw = arrancar();
  const avisos = [], recargas = [];
  const pagina = id => ({ id, url: "https://hilo.test/", postMessage: m => avisos.push([id, m.type]), navigate: async () => { recargas.push(id); } });
  sw.contexto.self.clients.matchAll = async () => [pagina("nueva"), pagina("antigua")];
  let activada;
  sw.listeners.activate({ waitUntil: tarea => { activada = tarea; } });
  await activada;
  ok("activar avisa a cada página en vez de recargarla", avisos.length === 2 && avisos.every(([, tipo]) => tipo === "VERSION_READY") && !recargas.length);
  sw.listeners.message({ data: { type: "VERSION_ACK" }, source: { id: "nueva" } });
  await new Promise(resolve => setTimeout(resolve, 4300));
  ok("la página que contesta recarga ella misma; la que no, se recarga como antes", recargas.length === 1 && recargas[0] === "antigua");
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
  const fuente = fs.readFileSync(path.join(REPO, "service-worker-258.js"), "utf8");
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
