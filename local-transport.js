// Transporte local para el multijugador sin conexión: conecta varios móviles por WebRTC
// cuando comparten una red Wi-Fi sin internet (un móvil crea el punto de acceso Wi-Fi, el
// resto se une como a cualquier red). No hay servidor de señalización porque no hay
// internet: la oferta y la respuesta de WebRTC viajan por un código QR que se enseña y se
// escanea, igual que el duelo por enlace (`duelo.js`) mete la partida entera en una URL.
//
// Topología en estrella: el anfitrión abre una `RTCPeerConnection` por cada invitado y hace
// de fuente de verdad de la sala, el mismo papel que tiene hoy Firestore en `online.js`,
// solo que aquí el propio anfitrión es el servidor.
//
// Este archivo solo abre y mantiene el canal de datos; no sabe nada de cartas, turnos ni
// mazos. La lógica de sala (crear, unirse, colocar carta…) vive aparte y habla con esto por
// mensajes `{type, data}`, para poder enchufarse igual a esto o a Firestore.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  // Sin STUN ni TURN: no hay internet para alcanzarlos, y no hace falta — dentro de la
  // misma red Wi-Fi los candidatos locales son justo los que conectan. Si algún día se
  // añade un STUN alcanzable en la propia red local, va aquí.
  const ICE_CONFIG = Object.freeze({ iceServers: [] });

  // Cuántos caracteres tolera de sobra un QR pensado para leerse con la cámara de un móvil,
  // a la distancia normal a la que se enseña una pantalla a otra. Por encima de esto el QR
  // se vuelve denso y falla la lectura con luz mala o pulso inestable — como en un avión.
  // Es solo una referencia para la interfaz que use este transporte; aquí no se aplica.
  const MAX_SIGNAL_LENGTH = 1200;

  function hasBtoa() { return typeof btoa === "function"; }

  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const raw = hasBtoa() ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromBase64Url(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = hasBtoa() ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Versión de la carga útil de la señal, no del formato de la sala: si algún día cambia
  // qué campos lleva, una versión vieja se puede rechazar con un aviso claro en vez de
  // fallar el `JSON.parse` o, peor, conectar mal.
  const SIGNAL_VERSION = 1;

  // Una señal WebRTC completa pesa varios cientos de bytes (más en Safari, que añade IPv6 y
  // varias interfaces) y el QR resultante llega a versiones de 150+ módulos que la cámara de
  // otro móvil casi no lee. Entre datachannels solo hace falta un puñado de datos: usuario y
  // clave ICE, huella DTLS, quién inicia y los candidatos IPv4. Se envían solo esos y el otro
  // lado reconstruye una SDP mínima equivalente. Si la SDP trae algo que no se sabe resumir
  // (varias secciones, otra huella…) se cae al formato completo de siempre.
  const COMPACT_PREFIX = "S2|";
  const MAX_COMPACT_CANDIDATES = 6;
  const SETUP_CODE = { active: "a", passive: "p", actpass: "x" };
  const SETUP_NAME = { a: "active", p: "passive", x: "actpass" };

  // `toBase64Url` codifica texto UTF-8; para bytes crudos hace falta la variante binaria.
  function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const raw = hasBtoa() ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64UrlToBytes(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = hasBtoa() ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }

  function compactSignal(role, description) {
    const sdp = description.sdp;
    if ((sdp.match(/^m=/gm) || []).length !== 1 || !/^m=application /m.test(sdp)) return null;
    const grab = re => (sdp.match(re) || [])[1];
    const ufrag = grab(/^a=ice-ufrag:(\S+)/m), pwd = grab(/^a=ice-pwd:(\S+)/m);
    const fingerprint = grab(/^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/m);
    const setup = SETUP_CODE[grab(/^a=setup:(\S+)/m)];
    if (!ufrag || !pwd || !fingerprint || !setup) return null;
    const seen = new Set(), candidates = [];
    for (const match of sdp.matchAll(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host\b/gm)) {
      // IPv6 fuera: dentro de un Wi-Fi de móvil no aporta y engorda el código.
      if (match[1].includes(":")) continue;
      const entry = `${match[1]}:${match[2]}`;
      if (!seen.has(entry)) { seen.add(entry); candidates.push(entry); }
    }
    if (!candidates.length) return null;
    const bytes = fingerprint.split(":").map(pair => parseInt(pair, 16));
    if (bytes.length !== 32 || bytes.some(Number.isNaN)) return null;
    return COMPACT_PREFIX + [role === "offer" ? "o" : "a", ufrag, pwd, bytesToBase64Url(bytes), setup, candidates.slice(0, MAX_COMPACT_CANDIDATES).join(",")].join("|");
  }

  function expandSignal(text) {
    const parts = text.split("|");
    if (parts.length !== 7) throw new Error("INVALID_SIGNAL");
    const [, roleCode, ufrag, pwd, fp, setupCode, candidateList] = parts;
    const role = roleCode === "o" ? "offer" : roleCode === "a" ? "answer" : null;
    const setup = SETUP_NAME[setupCode];
    if (!role || !setup || !ufrag || !pwd || !candidateList) throw new Error("INVALID_SIGNAL");
    let fingerprint;
    try { fingerprint = [...base64UrlToBytes(fp)].map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(":"); }
    catch { throw new Error("INVALID_SIGNAL"); }
    if (fingerprint.split(":").length !== 32) throw new Error("INVALID_SIGNAL");
    const lines = [
      "v=0", "o=- 4611731400430051336 2 IN IP4 127.0.0.1", "s=-", "t=0 0", "a=group:BUNDLE 0", "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0",
      `a=ice-ufrag:${ufrag}`, `a=ice-pwd:${pwd}`,
      `a=fingerprint:sha-256 ${fingerprint}`, `a=setup:${setup}`, "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144"
    ];
    candidateList.split(",").forEach((entry, index) => {
      const cut = entry.lastIndexOf(":");
      const address = entry.slice(0, cut), port = Number(entry.slice(cut + 1));
      if (!address || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_SIGNAL");
      lines.push(`a=candidate:${index + 1} 1 udp ${2113937151 - index} ${address} ${port} typ host generation 0`);
    });
    lines.push("a=end-of-candidates");
    return { role, description: { type: role, sdp: lines.join("\r\n") + "\r\n" } };
  }

  function encodeSignal(role, description) {
    if (role !== "offer" && role !== "answer") throw new Error("INVALID_ROLE");
    if (!description || typeof description.sdp !== "string" || typeof description.type !== "string") throw new Error("INVALID_DESCRIPTION");
    const compact = compactSignal(role, description);
    if (compact) return compact;
    return toBase64Url(JSON.stringify({ v: SIGNAL_VERSION, role, sdp: description.sdp, type: description.type }));
  }

  // Resumen para la pantalla de diagnóstico: cuánto pesa la señal y con qué candidatos viaja.
  function describeSignal(encoded) {
    const text = String(encoded || "");
    const compact = text.startsWith(COMPACT_PREFIX);
    let candidates = 0, mdns = 0;
    try {
      const sdp = compact ? expandSignal(text).description.sdp : decodeSignal(text).description.sdp;
      for (const match of sdp.matchAll(/^a=candidate:\S+ \d+ \S+ \d+ (\S+) \d+ typ /gm)) { candidates++; if (match[1].endsWith(".local")) mdns++; }
    } catch { /* Sin desglose si no se puede leer. */ }
    return { length: text.length, compact, candidates, mdns };
  }

  function decodeSignal(encoded) {
    if (typeof encoded !== "string" || !encoded.trim()) throw new Error("EMPTY_SIGNAL");
    if (encoded.trim().startsWith(COMPACT_PREFIX)) return expandSignal(encoded.trim());
    let payload;
    try { payload = JSON.parse(fromBase64Url(encoded.trim())); }
    catch { throw new Error("INVALID_SIGNAL"); }
    if (!payload || payload.v !== SIGNAL_VERSION) throw new Error("VERSION_MISMATCH");
    if (payload.role !== "offer" && payload.role !== "answer") throw new Error("INVALID_SIGNAL");
    if (typeof payload.sdp !== "string" || typeof payload.type !== "string") throw new Error("INVALID_SIGNAL");
    return { role: payload.role, description: { sdp: payload.sdp, type: payload.type } };
  }

  // Cada mensaje del canal de datos lleva su tipo aparte del contenido, para que quien lo
  // recibe pueda descartar uno que no reconozca sin que la sala entera se caiga — la misma
  // tolerancia que ya tiene `online.js` con salas creadas por una versión anterior.
  function encodeMessage(type, data) {
    if (typeof type !== "string" || !type) throw new Error("INVALID_MESSAGE_TYPE");
    return JSON.stringify({ type, data: data === undefined ? null : data });
  }
  function decodeMessage(raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!parsed || typeof parsed.type !== "string") return null;
    return { type: parsed.type, data: parsed.data ?? null };
  }

  // Sin trickle ICE: se espera a que termine de reunir candidatos antes de leer la
  // descripción local, para que la oferta (o la respuesta) quepa entera en un solo QR, en
  // vez de tener que enseñar uno nuevo por cada candidato que vaya llegando.
  const GATHER_TIMEOUT_MS = 3000;
  function waitIceGatheringComplete(peerConnection) {
    if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
    // Con un tope: hay redes en las que el navegador tarda en dar por terminada la búsqueda
    // aunque los candidatos locales ya estén, y sin él el QR no llegaba a mostrarse.
    return new Promise(resolve => {
      const timer = setTimeout(done, GATHER_TIMEOUT_MS);
      function done() {
        clearTimeout(timer);
        peerConnection.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
      function check() { if (peerConnection.iceGatheringState === "complete") done(); }
      peerConnection.addEventListener("icegatheringstatechange", check);
    });
  }

  // Chrome y Safari esconden la IP real del móvil tras un nombre `.local` (mDNS) salvo que la
  // página tenga la cámara en uso. Entre un Android y un iPhone, resolver ese nombre por
  // multicast suele fallar —sobre todo en el punto de acceso de un móvil—, y entonces los
  // QR se leen bien pero el canal no llega a abrirse. Con la cámara abierta mientras se
  // reúnen los candidatos, la señal lleva la IP de verdad. Si no hay cámara o permiso, se
  // sigue igual que antes: es una ayuda, nunca un requisito.
  const CAPTURE_WAIT_MS = 4000;
  async function withCapture(work) {
    let stream = null, late = false;
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const pending = navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        // Si el permiso tarda (aviso del sistema abierto), no se bloquea la invitación: la
        // cámara que llegue tarde se cierra en cuanto aparezca.
        pending.then(s => { if (late) s.getTracks().forEach(t => t.stop()); else stream = s; }, () => {});
        await Promise.race([pending.catch(() => null), new Promise(resolve => setTimeout(resolve, CAPTURE_WAIT_MS))]);
      }
    } catch { /* Sin cámara: se sigue sin ella. */ }
    try { return await work(); }
    finally { late = true; stream?.getTracks().forEach(track => track.stop()); }
  }

  function createPeerConnection() {
    if (typeof RTCPeerConnection === "undefined") throw new Error("WEBRTC_UNAVAILABLE");
    return new RTCPeerConnection(ICE_CONFIG);
  }

  // Un invitado: una única RTCPeerConnection hacia el anfitrión. `onOpen` avisa cuando el
  // canal ya admite mensajes, para no tener que sondear `isReady()` desde fuera, y
  // `onClose` cuando se cae después de haber estado abierto (el anfitrión cerró la sala,
  // se apagó su Wi-Fi…): sin eso, la pantalla se quedaba esperando para siempre.
  function createGuestPeer(offerEncoded, onMessage, onOpen, onClose) {
    const { role, description: offerDescription } = decodeSignal(offerEncoded);
    if (role !== "offer") throw new Error("EXPECTED_OFFER");
    const peerConnection = createPeerConnection();
    let channel = null, ready = false, closing = false;
    peerConnection.addEventListener("datachannel", event => {
      channel = event.channel;
      channel.addEventListener("open", () => { ready = true; onOpen?.(); });
      channel.addEventListener("close", () => { const wasReady = ready; ready = false; if (wasReady && !closing) onClose?.(); });
      channel.addEventListener("message", messageEvent => {
        const message = decodeMessage(messageEvent.data);
        if (message) onMessage(message);
      });
    });
    async function answerSignal() {
      await peerConnection.setRemoteDescription(offerDescription);
      const answer = await peerConnection.createAnswer();
      return withCapture(async () => {
        await peerConnection.setLocalDescription(answer);
        await waitIceGatheringComplete(peerConnection);
        return encodeSignal("answer", peerConnection.localDescription);
      });
    }
    function send(type, data) {
      if (!ready || !channel) return false;
      channel.send(encodeMessage(type, data));
      return true;
    }
    function close() { closing = true; try { channel?.close(); } catch {} try { peerConnection.close(); } catch {} }
    return { peerConnection, answerSignal, send, close, isReady: () => ready };
  }

  // El anfitrión: una RTCPeerConnection por invitado, todas independientes entre sí — la
  // estrella. `onMessage` recibe el id de quién manda, para que la sala sepa distinguirlos.
  function createHostPeer(onMessage, onOpen, onClose) {
    const peerConnection = createPeerConnection();
    const channel = peerConnection.createDataChannel("sala", { ordered: true });
    let ready = false, closing = false;
    channel.addEventListener("open", () => { ready = true; onOpen?.(); });
    channel.addEventListener("close", () => { const wasReady = ready; ready = false; if (wasReady && !closing) onClose?.(); });
    channel.addEventListener("message", event => {
      const message = decodeMessage(event.data);
      if (message) onMessage(message);
    });
    async function offerSignal() {
      const offer = await peerConnection.createOffer();
      return withCapture(async () => {
        await peerConnection.setLocalDescription(offer);
        await waitIceGatheringComplete(peerConnection);
        return encodeSignal("offer", peerConnection.localDescription);
      });
    }
    async function acceptAnswer(encoded) {
      const { role, description } = decodeSignal(encoded);
      if (role !== "answer") throw new Error("EXPECTED_ANSWER");
      await peerConnection.setRemoteDescription(description);
    }
    function send(type, data) {
      if (!ready) return false;
      channel.send(encodeMessage(type, data));
      return true;
    }
    function close() { closing = true; try { channel.close(); } catch {} try { peerConnection.close(); } catch {} }
    return { peerConnection, offerSignal, acceptAnswer, send, close, isReady: () => ready };
  }

  // Agrupa las conexiones de todos los invitados detrás de una sola sesión, para que la
  // lógica de sala no tenga que llevar la cuenta de cada `RTCPeerConnection` por su cuenta.
  // `onPeerClose` avisa de un invitado cuyo canal se ha caído solo (no de los que cierra el
  // propio anfitrión), para que la sala no se quede esperando su turno para siempre.
  function createHostSession(onMessage, onPeerOpen, onPeerClose) {
    const peers = new Map();
    let nextId = 1;
    function addPeer() {
      const peerId = String(nextId++);
      const peer = createHostPeer(message => onMessage(peerId, message), () => onPeerOpen?.(peerId), () => { peers.delete(peerId); onPeerClose?.(peerId); });
      peers.set(peerId, peer);
      return { peerId, offerSignal: peer.offerSignal, acceptAnswer: peer.acceptAnswer, peerConnection: peer.peerConnection };
    }
    function removePeer(peerId) {
      const peer = peers.get(peerId);
      if (!peer) return;
      peer.close();
      peers.delete(peerId);
    }
    function broadcast(type, data) { for (const peer of peers.values()) peer.send(type, data); }
    function sendTo(peerId, type, data) { return peers.get(peerId)?.send(type, data) ?? false; }
    function isPeerReady(peerId) { return !!peers.get(peerId)?.isReady(); }
    function closeAll() { for (const peer of peers.values()) peer.close(); peers.clear(); }
    return { addPeer, removePeer, broadcast, sendTo, isPeerReady, closeAll };
  }

  CT.LocalTransport = {
    ICE_CONFIG, MAX_SIGNAL_LENGTH,
    encodeSignal, decodeSignal, describeSignal, encodeMessage, decodeMessage,
    // Codificación de texto genérica, sin las validaciones propias de la señal WebRTC:
    // la usa `local-multiplayer.js` para meter en una sola invitación la señal y los
    // datos de la sala (código, modalidad, huella del mazo) que el invitado todavía no
    // conoce antes de unirse.
    encodeText: text => toBase64Url(String(text)),
    decodeText: encoded => fromBase64Url(String(encoded).trim()),
    createGuestPeer, createHostPeer, createHostSession
  };
})();
