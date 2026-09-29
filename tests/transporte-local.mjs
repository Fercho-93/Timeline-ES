// El transporte del multijugador sin conexión (`local-transport.js`) no se puede probar de
// verdad en Node: no hay RTCPeerConnection ni cámara. Esta suite cubre lo que sí es puro —
// codificar y descodificar la señal que viaja por el QR, y los mensajes del canal de
// datos— y comprueba que el resto falla con un error claro en vez de reventar al cargar.
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
  dom.window.eval(read("local-transport.js"));
  return dom.window;
}

console.log("\nSeñal: codificar y descodificar");
let w = boot();
const LT = w.CONTINUUM.LocalTransport;

const oferta = { sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n", type: "offer" };
const señal = LT.encodeSignal("offer", oferta);
ok("la señal codificada es texto", typeof señal === "string" && señal.length > 0);
ok("la señal no lleva caracteres fuera de lo que admite un QR/URL", /^[A-Za-z0-9_-]+$/.test(señal));
const descodificada = LT.decodeSignal(señal);
ok("el papel viaja intacto", descodificada.role === "offer");
ok("el sdp viaja intacto", descodificada.description.sdp === oferta.sdp);
ok("el tipo de descripción viaja intacto", descodificada.description.type === "offer");

const conAcentosYSaltos = { sdp: "a=candidate: móvil año 1 ñ\r\nsegunda línea", type: "answer" };
const señalUnicode = LT.encodeSignal("answer", conAcentosYSaltos);
ok("una señal con acentos y saltos de línea va y vuelve igual", LT.decodeSignal(señalUnicode).description.sdp === conAcentosYSaltos.sdp);

console.log("\nSeñal: rechazos");
const intentaRol = (rol) => { try { LT.encodeSignal(rol, oferta); return null; } catch (e) { return e.message; } };
ok("un papel que no sea oferta ni respuesta se rechaza al codificar", intentaRol("host") === "INVALID_ROLE");
const intentaDescodificar = (valor) => { try { LT.decodeSignal(valor); return null; } catch (e) { return e.message; } };
ok("una cadena vacía se rechaza", intentaDescodificar("") === "EMPTY_SIGNAL");
ok("un texto que no es base64 válido se rechaza", intentaDescodificar("no es una señal") !== null);
ok("un JSON válido pero de otra cosa se rechaza", intentaDescodificar(Buffer.from(JSON.stringify({ hola: "mundo" })).toString("base64url")) !== null);
ok("una versión distinta de la actual se rechaza con su propio motivo", intentaDescodificar(Buffer.from(JSON.stringify({ v: 99, role: "offer", sdp: "x", type: "offer" })).toString("base64url")) === "VERSION_MISMATCH");

console.log("\nTexto genérico (para la invitación completa: señal + datos de sala)");
const textoOriginal = "{\"roomCode\":\"HZ7Q2K\",\"modeKey\":\"history\"}";
const textoCodificado = LT.encodeText(textoOriginal);
ok("el texto codificado es apto para una URL/QR", /^[A-Za-z0-9_-]+$/.test(textoCodificado));
ok("el texto codificado descodifica igual", LT.decodeText(textoCodificado) === textoOriginal);
ok("un texto con acentos también va y vuelve igual", LT.decodeText(LT.encodeText("año 1969, ñ")) === "año 1969, ñ");

console.log("\nMensajes del canal de datos");
const mensaje = LT.encodeMessage("place-card", { index: 3, cardId: "5009" });
ok("el mensaje codificado es JSON", (() => { try { JSON.parse(mensaje); return true; } catch { return false; } })());
const leido = LT.decodeMessage(mensaje);
ok("el tipo viaja intacto", leido.type === "place-card");
ok("el contenido viaja intacto", leido.data.index === 3 && leido.data.cardId === "5009");
ok("un mensaje sin tipo se descarta en vez de reventar", LT.decodeMessage(JSON.stringify({ data: {} })) === null);
ok("basura sin JSON se descarta en vez de reventar", LT.decodeMessage("esto no es json") === null);
const intentaMensajeSinTipo = () => { try { LT.encodeMessage("", {}); return null; } catch (e) { return e.message; } };
ok("codificar sin tipo se rechaza al escribir, no al leer", intentaMensajeSinTipo() === "INVALID_MESSAGE_TYPE");

console.log("\nSeñal compacta (la que evita QR densos)");
const FP = Array.from({ length: 32 }, (_, i) => ((i * 7 + 3) & 255).toString(16).toUpperCase().padStart(2, "0")).join(":");
const sdpReal = ["v=0", "o=- 4611731400430051336 2 IN IP4 127.0.0.1", "s=-", "t=0 0", "a=group:BUNDLE 0", "a=extmap-allow-mixed", "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0", "a=candidate:1 1 udp 2113937151 3f2a9c1e-1111-4222-8333-444455556666.local 51000 typ host generation 0",
  "a=candidate:2 1 udp 2113937151 192.168.43.1 51001 typ host generation 0", "a=candidate:3 1 udp 2113939711 fe80::1 51002 typ host generation 0", "a=candidate:4 1 tcp 1518283007 192.168.43.1 9 typ host tcptype active",
  "a=ice-ufrag:AbCd", "a=ice-pwd:0123456789abcdefghijk+/", "a=ice-options:trickle", `a=fingerprint:sha-256 ${FP}`, "a=setup:actpass", "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144", ""].join("\r\n");
const compacta = LT.encodeSignal("offer", { sdp: sdpReal, type: "offer" });
ok("una SDP real se resume en el formato compacto", compacta.startsWith("S2|"));
ok("la señal compacta pesa una fracción de la completa", compacta.length < sdpReal.length / 3);
const vuelta = LT.decodeSignal(compacta);
ok("el papel y el tipo se conservan", vuelta.role === "offer" && vuelta.description.type === "offer");
const sdpVuelta = vuelta.description.sdp;
ok("se conservan usuario, clave y huella ICE/DTLS", sdpVuelta.includes("a=ice-ufrag:AbCd") && sdpVuelta.includes("a=ice-pwd:0123456789abcdefghijk+/") && sdpVuelta.includes(`a=fingerprint:sha-256 ${FP}`));
ok("se conserva quién inicia el DTLS", sdpVuelta.includes("a=setup:actpass"));
ok("se conservan los candidatos IPv4 y los nombres .local", sdpVuelta.includes("192.168.43.1 51001 typ host") && sdpVuelta.includes("3f2a9c1e-1111-4222-8333-444455556666.local 51000"));
ok("se descartan IPv6 y TCP, que solo engordan el código", !sdpVuelta.includes("fe80") && !sdpVuelta.includes(" tcp "));
ok("la SDP reconstruida es de un solo canal de datos", (sdpVuelta.match(/^m=/gm) || []).length === 1 && sdpVuelta.includes("webrtc-datachannel"));
const resumen = LT.describeSignal(compacta);
ok("el diagnóstico cuenta candidatos y nombres .local", resumen.compact && resumen.candidates === 2 && resumen.mdns === 1 && resumen.length === compacta.length);
const conVideo = sdpReal + "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
ok("una SDP con más secciones cae al formato completo", !LT.encodeSignal("offer", { sdp: conVideo, type: "offer" }).startsWith("S2|"));
const malas = ["S2|o|x", "S2|z|u|p|" + compacta.split("|")[3] + "|x|1.2.3.4:5", "S2|o|u|p|AAAA|x|1.2.3.4:5", "S2|o|u|p|" + compacta.split("|")[3] + "|x|1.2.3.4:99999"];
ok("una señal compacta corrupta se rechaza con un motivo claro", malas.every(m => { try { LT.decodeSignal(m); return false; } catch (e) { return e.message === "INVALID_SIGNAL"; } }));

console.log("\nSin WebRTC disponible (como en esta suite de Node)");
const intentaAbrir = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
ok("abrir de anfitrión falla con un motivo claro, no revienta el módulo", intentaAbrir(() => LT.createHostPeer(() => {})) === "WEBRTC_UNAVAILABLE");
ok("abrir de invitado falla con el mismo motivo tras validar la señal", intentaAbrir(() => LT.createGuestPeer(señal, () => {})) === "WEBRTC_UNAVAILABLE");
ok("una sesión de anfitrión se crea sin RTCPeerConnection: solo falla al añadir el primer invitado", intentaAbrir(() => LT.createHostSession(() => {}).addPeer()) === "WEBRTC_UNAVAILABLE");

console.log(`\n${fail} fallos`);
process.exit(fail ? 1 : 0);
