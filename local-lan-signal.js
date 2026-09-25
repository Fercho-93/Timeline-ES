// Señalización LAN para multijugador offline con un único QR visible para cada invitado.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;
  const VERSION = 1;
  const DEFAULT_PORT = 8765;
  function plugin() { return window.Capacitor?.Plugins?.LocalLanSignal || null; }
  function available() { return !!plugin(); }
  function token() {
    const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
    return [...bytes].map(v => v.toString(16).padStart(2, "0")).join("");
  }
  function encodeInvite({ host, port = DEFAULT_PORT, token: secret, peerId, roomCode, modeKey, deckFingerprint, signal }) {
    if (!host || !secret || !peerId || !roomCode || !signal) throw new Error("INVALID_LAN_INVITE");
    return "CTL1:" + JSON.stringify({ v: VERSION, host, port, token: secret, peerId: String(peerId), roomCode, modeKey, deckFingerprint, signal });
  }
  function decodeInvite(text) {
    const value = String(text || "").trim();
    if (!value.startsWith("CTL1:")) throw new Error("INVALID_LAN_INVITE");
    let data; try { data = JSON.parse(value.slice(5)); } catch { throw new Error("INVALID_LAN_INVITE"); }
    if (data?.v !== VERSION || !data.host || !data.port || !data.token || !data.peerId || !data.roomCode || !data.signal) throw new Error("INVALID_LAN_INVITE");
    return data;
  }
  async function startHost({ port = DEFAULT_PORT, token: secret, onAnswer }) {
    const p = plugin(); if (!p) throw new Error("LAN_SIGNAL_UNAVAILABLE");
    await p.start({ port, token: secret });
    const info = await p.getAddress();
    const listener = await p.addListener("answer", event => {
      if (event?.token === secret && typeof event.answer === "string") onAnswer?.(event.answer, event.peerId || null);
    });
    return { host: info.address, port: info.port || port, stop: async () => { try { await listener.remove(); } catch {} await p.stop(); } };
  }
  async function sendAnswer(invite, answer, peerId = invite?.peerId) {
    const p = plugin(); if (!p) throw new Error("LAN_SIGNAL_UNAVAILABLE");
    return p.sendAnswer({ host: invite.host, port: invite.port, token: invite.token, answer, peerId: String(peerId || "") });
  }
  CT.LocalLanSignal = { VERSION, DEFAULT_PORT, available, token, encodeInvite, decodeInvite, startHost, sendAnswer };
})();
