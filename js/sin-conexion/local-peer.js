// Conexión directa entre iPhones, sin Wi-Fi ni internet, con el plugin nativo `LocalPeer`
// (MultipeerConnectivity, la tecnología de AirDrop; ver `ios/App/App/LocalPeerPlugin.swift`).
// El anfitrión se anuncia con los datos de su sala y los invitados la ven en una lista:
// no hay QR ni hotspot. Solo existe en la app instalada de iOS; en la web y en Android
// `available()` es falso y todo sigue por WebRTC (`local-transport.js`).
//
// Ofrece a `local-session.js` lo mismo que el transporte WebRTC —`broadcast`, `sendTo`,
// `isPeerReady`…, con mensajes `{type, data}`—, para que la lógica de sala no note la
// diferencia.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  const plugin = () => window.Capacitor?.Plugins?.LocalPeer || null;
  const available = () => !!plugin() && window.Capacitor?.getPlatform?.() === "ios";

  const listeners = { message: new Set(), state: new Set(), found: new Set(), lost: new Set(), error: new Set() };
  let wired = null;
  // Los eventos nativos se registran una sola vez y se reparten a quien esté escuchando.
  function wire() {
    if (wired) return wired;
    const p = plugin();
    if (!p) return Promise.reject(new Error("LOCAL_PEER_UNAVAILABLE"));
    wired = Promise.all(Object.keys(listeners).map(name => p.addListener(name, event => listeners[name].forEach(fn => { try { fn(event); } catch (error) { console.error(error); } })))).catch(error => { wired = null; throw error; });
    return wired;
  }
  function on(name, fn) { listeners[name].add(fn); return () => listeners[name].delete(fn); }

  const encode = (type, data) => CT.LocalTransport.encodeMessage(type, data);
  const decode = raw => CT.LocalTransport.decodeMessage(raw);
  const send = (payload) => plugin().send(payload).catch(error => console.error("LocalPeer.send", error));

  // Salas cercanas: `onRooms` recibe la lista completa cada vez que cambia.
  // Cada sala: { id, room, mode, host, fp, players }.
  async function browse(onRooms) {
    await wire();
    const rooms = new Map();
    const emit = () => onRooms([...rooms.values()]);
    const offFound = on("found", event => {
      const info = event.info || {};
      if (!info.room) return;
      rooms.set(event.id, { id: event.id, room: info.room, mode: info.mode || "", host: info.host || "", fp: info.fp || "", players: Number(info.n) || 0 });
      emit();
    });
    const offLost = on("lost", event => { if (rooms.delete(event.id)) emit(); });
    await plugin().browse();
    return { stop: () => { offFound(); offLost(); plugin()?.stopBrowsing?.().catch(() => {}); } };
  }

  // Anfitrión: se anuncia y acepta a quien llegue. Los identificadores de los invitados son
  // los que da el sistema (aleatorios), distintos de los "1", "2"… del transporte WebRTC.
  function createHostTransport(onMessage, onPeerOpen, onPeerClose) {
    const ready = new Set();
    const offMessage = on("message", event => {
      const message = decode(event.data);
      if (message) onMessage(event.id, message);
    });
    const offState = on("state", event => {
      if (event.state === "connected") { if (!ready.has(event.id)) { ready.add(event.id); onPeerOpen?.(event.id); } }
      else if (event.state === "notConnected" && ready.delete(event.id)) onPeerClose?.(event.id);
    });
    return {
      async advertise(info) { await wire(); await plugin().advertise({ info }); },
      broadcast(type, data) { if (ready.size) send({ data: encode(type, data) }); },
      sendTo(peerId, type, data) { if (!ready.has(peerId)) return false; send({ id: peerId, data: encode(type, data) }); return true; },
      removePeer(peerId) {
        // Sin `ready` para que su caída no cuente como pérdida; y con un momento de margen,
        // para que le llegue antes la última foto de la sala, en la que ya no aparece.
        ready.delete(peerId);
        setTimeout(() => plugin()?.disconnect?.({ id: peerId }).catch(() => {}), 300);
      },
      isPeerReady: peerId => ready.has(peerId),
      owns: peerId => ready.has(peerId),
      closeAll() { offMessage(); offState(); ready.clear(); plugin()?.stop?.().catch(() => {}); }
    };
  }

  // Invitado: una conexión con el anfitrión elegido en la lista. `onFail` avisa si no llega
  // a conectar (el anfitrión se fue, la invitación caducó…).
  function createGuestPeer(hostId, onMessage, onOpen, onClose, onFail) {
    let ready = false, closing = false;
    const offMessage = on("message", event => {
      if (event.id !== hostId) return;
      const message = decode(event.data);
      if (message) onMessage(message);
    });
    const offState = on("state", event => {
      if (event.id !== hostId) return;
      if (event.state === "connected") { ready = true; onOpen?.(); }
      else if (event.state === "notConnected") {
        if (closing) return;
        if (ready) { ready = false; onClose?.(); } else onFail?.();
      }
    });
    function cleanup() { offMessage(); offState(); }
    return {
      async connect() { await wire(); await plugin().connect({ id: hostId }); },
      send(type, data) { if (!ready) return false; send({ id: hostId, data: encode(type, data) }); return true; },
      close() { closing = true; cleanup(); plugin()?.stop?.().catch(() => {}); },
      isReady: () => ready
    };
  }

  CT.LocalPeer = { available, browse, createHostTransport, createGuestPeer, on };
})();
