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

  function encodeSignal(role, description) {
    if (role !== "offer" && role !== "answer") throw new Error("INVALID_ROLE");
    if (!description || typeof description.sdp !== "string" || typeof description.type !== "string") throw new Error("INVALID_DESCRIPTION");
    return toBase64Url(JSON.stringify({ v: SIGNAL_VERSION, role, sdp: description.sdp, type: description.type }));
  }

  function decodeSignal(encoded) {
    if (typeof encoded !== "string" || !encoded.trim()) throw new Error("EMPTY_SIGNAL");
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
  function waitIceGatheringComplete(peerConnection) {
    if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
    return new Promise(resolve => {
      function check() {
        if (peerConnection.iceGatheringState !== "complete") return;
        peerConnection.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
      peerConnection.addEventListener("icegatheringstatechange", check);
    });
  }

  function createPeerConnection() {
    if (typeof RTCPeerConnection === "undefined") throw new Error("WEBRTC_UNAVAILABLE");
    return new RTCPeerConnection(ICE_CONFIG);
  }

  // Un invitado: una única RTCPeerConnection hacia el anfitrión.
  function createGuestPeer(offerEncoded, onMessage) {
    const { role, description: offerDescription } = decodeSignal(offerEncoded);
    if (role !== "offer") throw new Error("EXPECTED_OFFER");
    const peerConnection = createPeerConnection();
    let channel = null, ready = false;
    peerConnection.addEventListener("datachannel", event => {
      channel = event.channel;
      channel.addEventListener("open", () => { ready = true; });
      channel.addEventListener("message", messageEvent => {
        const message = decodeMessage(messageEvent.data);
        if (message) onMessage(message);
      });
    });
    async function answerSignal() {
      await peerConnection.setRemoteDescription(offerDescription);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitIceGatheringComplete(peerConnection);
      return encodeSignal("answer", peerConnection.localDescription);
    }
    function send(type, data) {
      if (!ready || !channel) return false;
      channel.send(encodeMessage(type, data));
      return true;
    }
    function close() { try { channel?.close(); } catch {} try { peerConnection.close(); } catch {} }
    return { peerConnection, answerSignal, send, close, isReady: () => ready };
  }

  // El anfitrión: una RTCPeerConnection por invitado, todas independientes entre sí — la
  // estrella. `onMessage` recibe el id de quién manda, para que la sala sepa distinguirlos.
  function createHostPeer(onMessage) {
    const peerConnection = createPeerConnection();
    const channel = peerConnection.createDataChannel("sala", { ordered: true });
    let ready = false;
    channel.addEventListener("open", () => { ready = true; });
    channel.addEventListener("message", event => {
      const message = decodeMessage(event.data);
      if (message) onMessage(message);
    });
    async function offerSignal() {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitIceGatheringComplete(peerConnection);
      return encodeSignal("offer", peerConnection.localDescription);
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
    function close() { try { channel.close(); } catch {} try { peerConnection.close(); } catch {} }
    return { peerConnection, offerSignal, acceptAnswer, send, close, isReady: () => ready };
  }

  // Agrupa las conexiones de todos los invitados detrás de una sola sesión, para que la
  // lógica de sala no tenga que llevar la cuenta de cada `RTCPeerConnection` por su cuenta.
  function createHostSession(onMessage) {
    const peers = new Map();
    let nextId = 1;
    function addPeer() {
      const peerId = String(nextId++);
      const peer = createHostPeer(message => onMessage(peerId, message));
      peers.set(peerId, peer);
      return { peerId, offerSignal: peer.offerSignal, acceptAnswer: peer.acceptAnswer };
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
    encodeSignal, decodeSignal, encodeMessage, decodeMessage,
    createGuestPeer, createHostPeer, createHostSession
  };
})();
