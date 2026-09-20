// El código QR de la invitación (`qr-encode.js`, sobre la librería vendorizada
// `qrcode-generator.js`) es la pieza más delicada del modo "Sin conexión": si genera un
// código que parece válido pero no decodifica bien, la sala nunca llegaría a conectar y
// nadie lo sabría hasta probarlo con dos móviles de verdad. Por eso esta prueba no se
// queda en "genera una matriz" — la renderiza a píxeles reales y la decodifica con el
// mismo `jsQR` que usa la cámara (`qr-scanner.js`), para varios tamaños de texto,
// incluido uno del tamaño real de una invitación completa.
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
  dom.window.eval(read("qrcode-generator.js"));
  dom.window.eval(read("qr-encode.js"));
  dom.window.eval(read("jsqr.js"));
  return dom.window;
}

const w = boot();
const { QrEncode } = w.CONTINUUM;
const jsQR = w.jsQR;

console.log("\nGeneración de la matriz");
ok("un texto corto genera una matriz cuadrada", (() => { const m = QrEncode.matrix("ABC"); return m.length > 0 && m.every(row => row.length === m.length); })());
ok("dos textos distintos no generan la misma matriz", JSON.stringify(QrEncode.matrix("ABC")) !== JSON.stringify(QrEncode.matrix("XYZ")));
ok("el mismo texto siempre genera la misma matriz", JSON.stringify(QrEncode.matrix("ABC")) === JSON.stringify(QrEncode.matrix("ABC")));
ok("un texto más largo usa una matriz más grande, no la misma de siempre", QrEncode.matrix("Q".repeat(2000)).length > QrEncode.matrix("ABC").length);

// Renderiza la matriz a un buffer RGBA en memoria, con el mismo esquema de colores que
// draw() en qr-encode.js, y la decodifica con jsQR — sin esto, un bug en el orden de los
// bits o en la máscara de la librería podría producir un código que "se ve" como un QR
// pero que ninguna cámara real llegaría a leer.
function decodifica(text) {
  const modules = QrEncode.matrix(text);
  const quietZone = 4;
  const scale = Math.max(2, Math.min(8, Math.round(600 / modules.length)));
  const size = (modules.length + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 0xff; data[i + 1] = 0xfa; data[i + 2] = 0xf0; data[i + 3] = 255; }
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = (x + quietZone) * scale + dx, py = (y + quietZone) * scale + dy;
      const idx = (py * size + px) * 4;
      data[idx] = 0x21; data[idx + 1] = 0x1b; data[idx + 2] = 0x16; data[idx + 3] = 255;
    }
  }));
  const result = jsQR(data, size, size, { inversionAttempts: "dontInvert" });
  return result?.data ?? null;
}

console.log("\nDecodificado real con jsQR (no solo generar, también leer)");
ok("un código corto (como el de sala de online.js) decodifica igual", decodifica("HOLA1234") === "HOLA1234");
ok("un texto de tamaño medio decodifica igual", decodifica("X".repeat(300)) === "X".repeat(300));

// El tamaño real de una invitación completa (código de sala + huella del mazo + la señal
// WebRTC entera) — esto es justo lo que antes obligaba a trocear en varios códigos QR
// seguidos (`qr-frames.js`, ya retirado) y ahora cabe en uno solo.
const sdp = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:abcd\r\na=ice-pwd:abcdefghijklmnopqrstuvwx\r\na=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\na=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=candidate:1 1 udp 2130706431 192.168.1.5 54321 typ host generation 0\r\na=end-of-candidates\r\n";
const toBase64Url = text => Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const signal = toBase64Url(JSON.stringify({ v: 1, role: "offer", sdp, type: "offer" }));
const inviteText = "CTM1:" + JSON.stringify({ v: 1, roomCode: "ABC123XY", modeKey: "history", deckFingerprint: "v3.502.1a2b3c4", signal });
ok(`una invitación real (${inviteText.length} caracteres) cabe en un único código y decodifica igual`, decodifica(inviteText) === inviteText);

console.log("\nLímites");
ok("un texto absurdamente largo se rechaza en vez de fallar en silencio", (() => { try { QrEncode.matrix("Q".repeat(4000)); return false; } catch (e) { return e.message === "QR_TEXT_TOO_LONG"; } })());

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
