// El QR de una sola pieza (`qr-encode.js`, el mismo generador que ya usa `online.js` para
// el enlace corto de sala) y el troceo en varias piezas para lo que no cabe en una
// (`qr-frames.js`, para las señales WebRTC del modo "Sin conexión"). Sin cámara ni
// `RTCPeerConnection` — eso no se puede probar en Node — pero todo lo que no depende de
// hardware sí.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
let fail = 0;
const ok = (label, cond) => { if (!cond) fail++; console.log(`  ${cond ? "ok  " : "FALLA"} ${label}`); };

function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "https://hilo.test/" });
  dom.window.CONTINUUM = {};
  // Determinista en vez de al azar de verdad: así la letra de sesión de cada `split()` es
  // predecible y las pruebas sobre sesiones distintas no dependen de que dos números al
  // azar no coincidan (1 entre 36 de posibilidad de que sí, si se dejara el `crypto` real).
  let contador = 0;
  Object.defineProperty(dom.window, "crypto", { value: { getRandomValues: arr => { arr[0] = (contador++) % 256; return arr; } } });
  dom.window.eval(read("qr-encode.js"));
  dom.window.eval(read("qr-frames.js"));
  return dom.window;
}

const w = boot();
const { QrEncode, QrFrames } = w.CONTINUUM;

console.log("\nQrEncode: un solo código");
ok("un texto corto genera una matriz cuadrada", (() => { const m = QrEncode.matrix("ABC"); return m.length === 37 && m.every(row => row.length === 37); })());
ok("dos textos distintos no generan la misma matriz", JSON.stringify(QrEncode.matrix("ABC")) !== JSON.stringify(QrEncode.matrix("XYZ")));
ok("el mismo texto siempre genera la misma matriz", JSON.stringify(QrEncode.matrix("ABC")) === JSON.stringify(QrEncode.matrix("ABC")));
ok("hasta 106 bytes cabe en un único código", (() => { QrEncode.matrix("Q".repeat(106)); return true; })());
ok("107 bytes se rechaza en vez de truncar en silencio", (() => { try { QrEncode.matrix("Q".repeat(107)); return false; } catch (e) { return e.message === "QR_TEXT_TOO_LONG"; } })());

console.log("\nQrFrames: partir y reunir");
const corto = "hola-invitado";
const framesCortos = QrFrames.split(corto);
ok("un texto que ya cabe en un código da una sola pieza", framesCortos.length === 1);
ok("cada pieza empieza por Q y cabe en el límite del QR de una pieza", framesCortos.every(f => f.startsWith("Q") && [...new TextEncoder().encode(f)].length <= QrEncode.MAX_BYTES));

const largo = Array.from({ length: 350 }, (unused, i) => (i % 36).toString(36)).join("").toUpperCase();
const framesLargos = QrFrames.split(largo);
ok("un texto largo se reparte en varias piezas", framesLargos.length > 1);
ok("cada pieza sigue cabiendo en un solo QR", framesLargos.every(f => [...new TextEncoder().encode(f)].length <= QrEncode.MAX_BYTES));

function leerTodas(frames, orden = frames.map((unused, i) => i)) {
  const reader = QrFrames.createReader();
  let ultimo = null;
  for (const i of orden) ultimo = reader.ingest(frames[i]);
  return ultimo;
}

const resultado = leerTodas(framesLargos);
ok("tras leer todas las piezas, el texto vuelve intacto", resultado.done && resultado.text === largo);

const desordenado = leerTodas(framesLargos, [...framesLargos.keys()].reverse());
ok("da igual el orden en que lleguen las piezas", desordenado.done && desordenado.text === largo);

{
  const reader = QrFrames.createReader();
  const primera = reader.ingest(framesLargos[0]);
  ok("con una sola pieza todavía no está completo", primera.done === false && primera.received === 1);
  const repetida = reader.ingest(framesLargos[0]);
  ok("leer la misma pieza dos veces no adelanta el progreso", repetida.received === 1);
}

ok("un texto que no sigue el formato se ignora en vez de romper la lectura", QrFrames.createReader().ingest("esto no es un código nuestro") === null);

{
  // Un total de piezas más pequeño ya por sí solo reinicia la lectura.
  const otraTanda = QrFrames.split(largo.slice(0, 50));
  const reader = QrFrames.createReader();
  reader.ingest(framesLargos[0]);
  const trasCambiar = reader.ingest(otraTanda[0]);
  ok("una tanda nueva con menos piezas no arrastra restos de la anterior", trasCambiar.total === otraTanda.length && trasCambiar.received === 1);
}
{
  // Dos invitaciones seguidas con el mismo número de piezas tampoco deben mezclarse: la
  // letra de sesión al azar de cada `split()` basta para que la segunda tanda reinicie la
  // lectura aunque el total coincida por casualidad.
  const mismaLongitud = largo.split("").reverse().join("");
  const otraMismoTotal = QrFrames.split(mismaLongitud);
  ok("la comparación de abajo tiene sentido: mismo total de piezas", otraMismoTotal.length === framesLargos.length);
  const reader = QrFrames.createReader();
  reader.ingest(framesLargos[0]);
  reader.ingest(framesLargos[1]);
  const trasCambiar = reader.ingest(otraMismoTotal[0]);
  ok("una sesión distinta con el mismo total no arrastra piezas de la anterior", trasCambiar.received === 1);
}

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
