// Une las reglas de sala (`local-room.js`) con WebRTC (`local-transport.js`). La
// respuesta WebRTC puede volver automáticamente por LAN en la app instalada.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;
  const HOST_ID = "host";

  // Bootstrap local: mantiene el flujo operativo aunque una build antigua aún no incluya
  // local-lan-signal.js en index.html.
  if (!CT.LocalLanSignal) {
    const P = () => window.Capacitor?.Plugins?.LocalLanSignal || null;
    CT.LocalLanSignal = {
      available: () => !!P(),
      token: () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return [...b].map(v => v.toString(16).padStart(2, "0")).join(""); },
      encodeInvite: d => { if (!d.host || !d.token || !d.peerId || !d.signal) throw new Error("INVALID_LAN_INVITE"); return "CTL1:" + JSON.stringify({ v: 1, ...d, peerId: String(d.peerId) }); },
      decodeInvite: text => { const v = String(text || "").trim(); if (!v.startsWith("CTL1:")) throw new Error("INVALID_LAN_INVITE"); let d; try { d = JSON.parse(v.slice(5)); } catch { throw new Error("INVALID_LAN_INVITE"); } if (d?.v !== 1 || !d.host || !d.port || !d.token || !d.peerId || !d.signal) throw new Error("INVALID_LAN_INVITE"); return d; },
      startHost: async ({ port = 8765, token, onAnswer }) => { const p = P(); if (!p) throw new Error("LAN_SIGNAL_UNAVAILABLE"); await p.start({ port, token }); const info = await p.getAddress(); const listener = await p.addListener("answer", e => { if (e?.token === token && typeof e.answer === "string") onAnswer?.(e.answer, e.peerId || null); }); return { host: info.address, port: info.port || port, stop: async () => { try { await listener.remove(); } catch {} await p.stop(); } }; },
      sendAnswer: async (invite, answer, peerId = invite?.peerId) => { const p = P(); if (!p) throw new Error("LAN_SIGNAL_UNAVAILABLE"); return p.sendAnswer({ host: invite.host, port: invite.port, token: invite.token, answer, peerId: String(peerId || "") }); }
    };
  }

  // Identificadores de plaza: los de `randomPlayerId` (base 36) y el del anfitrión.
  const validId = id => typeof id === "string" && /^[0-9a-z]{1,40}$/.test(id);
  const isInt = v => Number.isInteger(v);
  const intList = v => Array.isArray(v) && v.length <= 2000 && v.every(x => isInt(x) || (typeof x === "string" && x.length <= 64));
  // El estado que manda el anfitrión se pinta tal cual en el invitado: se comprueba su forma
  // antes de aceptarlo (como `QuickRoom.validate` en los Retos rápidos), así un anfitrión
  // malicioso no puede colar marcado en lugar de un número o de un identificador.
  function validRoom(room) {
    if (!room || typeof room !== "object" || !Array.isArray(room.playerOrder) || room.playerOrder.length < 1 || room.playerOrder.length > 9
      || !room.playerOrder.every(validId) || !room.players || typeof room.players !== "object") return false;
    for (const key of ["capacity", "round", "turnsInRound", "current", "version", "handSize"]) if (key in room && !isInt(room[key])) return false;
    if ("turnSeconds" in room && !isInt(room.turnSeconds)) return false;
    for (const key of ["deck", "timeline", "discard"]) if (key in room && !intList(room[key])) return false;
    if (typeof room.hostId !== "string") return false;
    if (room.tournament != null && (typeof room.tournament !== "object" || !isInt(room.tournament.index) || !isInt(room.tournament.handSize) || !Array.isArray(room.tournament.queue))) return false;
    return room.playerOrder.every(id => {
      const p = Object.prototype.hasOwnProperty.call(room.players, id) ? room.players[id] : null;
      return p && typeof p.name === "string" && p.name.length <= 24 && intList(p.hand) && (p.avatarId == null || typeof p.avatarId === "string");
    });
  }

  function valueOfForMode(modeKey) { const byId = new Map(CT.cards(modeKey).map(card => [card.id, card])); return id => CT.sortValue(modeKey, byId.get(id)); }
  function buildDeck(modeKey, shuffle = CT.shuffle, exclude = []) { return shuffle((CT.uniqueValueIds || ((_, ids) => ids))(modeKey, CT.cards(modeKey).map(card => card.id).filter(id => !exclude.includes(id)))); }

  // Lo que el reductor necesita y no puede inventar él solo: valores de las cartas,
  // barajar, azar, la hora y la carta de la final. Viaja con todas las acciones.
  function contextFor(modeKey, now = () => Date.now()) {
    return {
      modeKey, now,
      valueOf: valueOfForMode(modeKey),
      shuffle: CT.shuffle,
      random: Math.random,
      makeFinal: (players, previous, exposed) => CT.Final.create(modeKey, players, previous, exposed),
      rank: (final, answers) => CT.Final.rank(final, answers)
    };
  }

  const TYPES = ["join", "starter-draw", "starter-guess", "start", "place-card", "use-ghost", "pulse-start", "pulse-place", "pulse-defend",
    "finish-turn", "skip-turn", "final-answer", "final-next", "remove-player", "player-away", "rematch", "competition-next"];

  // Traduce un mensaje del canal a una acción del reductor. `playerId` es siempre quién
  // habla (el anfitrión lo fija por el canal, ver más abajo) y va también como
  // `requesterId`, que es como lo llaman las acciones de gestionar la sala.
  function actionFromMessage(message, context, room = null) {
    const data = message?.data || {};
    if (!TYPES.includes(message?.type)) throw new Error("UNKNOWN_ACTION");
    const { modeKey, valueOf, shuffle, random, now, makeFinal, rank } = context;
    const action = {
      ...data, type: message.type, playerId: data.playerId, requesterId: data.playerId,
      valueOf, shuffle, random, makeFinal, rank, now: now()
    };
    if (message.type === "start") {
      // El mazo se baraja sin la carta del minijuego: ya se ha visto de sobra. El orden de
      // la mesa sale del propio minijuego, con el mismo criterio que el resto del juego.
      const draw = room?.starterDraw;
      action.deck = buildDeck(modeKey, shuffle, draw ? [draw.cardId] : []);
      if (draw && CT.Starter) action.order = CT.Starter.order(modeKey, draw.cardId, room.playerOrder.map(id => ({ id, value: draw.guesses[id] ?? null })));
    }
    // Al pasar de tema en una competición, la huella del mazo nuevo: con ella se comprueba que
    // quien vuelva a sentarse lleva la misma versión de ese mazo.
    if (message.type === "competition-next" && room?.tournament) {
      const nextMode = room.tournament.queue[room.tournament.index + 1];
      action.deckFingerprint = nextMode && CT.deckFingerprint ? CT.deckFingerprint(nextMode) : null;
    }
    if (message.type === "starter-draw" && data.cardId == null) {
      const ids = CT.cards(modeKey).map(card => card.id);
      action.cardId = ids[Math.floor(random() * ids.length)];
    }
    return action;
  }

  // Cada canal queda atado a la persona que se unió por él: sus mensajes siguientes hablan
  // siempre en su nombre, aunque manden otro `playerId`. Si el canal se cae a mitad de
  // partida, esa persona conserva su plaza y sus cartas (`player-away`) y puede volver a
  // sentarse con una invitación nueva; en la sala de espera, simplemente se libera la
  // plaza. `onPeerLost` y `onPeerBack` reciben el nombre, para avisar en pantalla.
  function createHostSession({ roomCode, hostName, avatarId = null, modeKey, deckFingerprint = null, tournament = null, capacity, now = () => Date.now(), onChange, onPeerLost, onPeerBack }) {
    // El mazo de cada acción es el de la ronda en juego: en una competición cambia de un tema a otro.
    const contexts = new Map();
    const contextOf = mode => { if (!contexts.has(mode)) contexts.set(mode, contextFor(mode, now)); return contexts.get(mode); };
    let room = CT.LocalRoom.createRoom({ roomCode, hostId: HOST_ID, hostName, avatarId, modeKey, deckFingerprint, tournament, capacity, now: now() });
    onChange(room);
    const peerPlayers = new Map();
    function peerOf(playerId) { for (const [peerId, id] of peerPlayers) if (id === playerId) return peerId; return null; }

    function onGuestMessage(peerId, message) {
      const bound = peerPlayers.get(peerId);
      const data = { ...(message?.data || {}) };
      if (!bound && nearby?.owns(peerId) && String(data.pin ?? "") !== nearbyPin) {
        // Por «salas cercanas» se conecta cualquier iPhone que esté al alcance, sin QR: solo
        // se sienta quien escribe el código que ve el anfitrión. Cada intento fallido cierra
        // el canal, y tras cinco el código cambia.
        transport.sendTo(peerId, "error", { message: "BAD_PIN" });
        setTimeout(() => transport.removePeer(peerId), 300);
        if (++badPins >= 5) { badPins = 0; nearbyPin = newPin(); onChange(room); }
        return;
      }
      if (!bound) {
        // Antes de unirse no se puede hacer nada más; y solo se ocupa una plaza que ya
        // existe si su dueño está desconectado (es quien vuelve).
        // El identificador y el nombre llegan de otro móvil: se pintan en todas las pantallas
        // y viajan en cada estado, así que solo se aceptan con la forma que genera el juego.
        if (!validId(data.playerId)) { transport.sendTo(peerId, "error", { message: "NOT_ALLOWED" }); return; }
        data.name = typeof data.name === "string" ? data.name.trim().slice(0, 24) : "";
        if (!data.name) data.name = "Invitado";
        data.avatarId = typeof data.avatarId === "string" && data.avatarId.length <= 40 ? data.avatarId : null;
        const existing = Object.prototype.hasOwnProperty.call(room.players, data.playerId) ? room.players[data.playerId] : null;
        if (message?.type !== "join" || data.playerId === HOST_ID || (existing && !existing.away)) {
          transport.sendTo(peerId, "error", { message: existing && !existing.away ? "SEAT_TAKEN" : "NOT_ALLOWED" });
          return;
        }
      } else data.playerId = bound;
      try {
        const wasAway = !!room.players[data.playerId]?.away;
        const next = CT.LocalRoom.reduce(room, actionFromMessage({ type: message.type, data }, contextOf(room.mode), room));
        if (!bound && next.playerOrder.includes(data.playerId)) peerPlayers.set(peerId, data.playerId);
        setRoom(next);
        if (!bound && wasAway) onPeerBack?.(next.players[data.playerId]?.name || "");
      } catch (error) { transport.sendTo(peerId, "error", { message: error.message }); }
    }

    function onGuestLost(peerId) {
      const playerId = peerPlayers.get(peerId);
      peerPlayers.delete(peerId);
      if (!playerId || !room.playerOrder.includes(playerId)) return;
      const name = room.players[playerId]?.name || "";
      try { setRoom(CT.LocalRoom.reduce(room, actionFromMessage({ type: "player-away", data: { playerId: HOST_ID, targetId: playerId } }, contextOf(room.mode), room))); }
      catch (error) { console.error(error); }
      onPeerLost?.(name, room.status === "playing");
    }

    // En la app de iOS los iPhones se unen por MultipeerConnectivity (`local-peer.js`), sin
    // QR; el resto —Android, la web, o quien prefiera el QR— sigue por WebRTC. Las dos
    // vías conviven en la misma sala detrás de una sola interfaz.
    const webrtc = CT.LocalTransport.createHostSession(onGuestMessage, null, onGuestLost);
    const nearby = CT.LocalPeer?.available?.() ? CT.LocalPeer.createHostTransport(onGuestMessage, null, onGuestLost) : null;
    const newPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0");
    let nearbyPin = nearby ? newPin() : "", badPins = 0;
    const transport = nearby ? {
      addPeer: webrtc.addPeer,
      removePeer: id => (nearby.owns(id) ? nearby : webrtc).removePeer(id),
      broadcast: (type, data) => { webrtc.broadcast(type, data); nearby.broadcast(type, data); },
      sendTo: (id, type, data) => (nearby.owns(id) ? nearby : webrtc).sendTo(id, type, data),
      isPeerReady: id => nearby.isPeerReady(id) || webrtc.isPeerReady(id),
      closeAll: () => { webrtc.closeAll(); nearby.closeAll(); }
    } : webrtc;
    if (nearby) nearby.advertise({ room: roomCode, mode: modeKey, host: hostName, fp: deckFingerprint || "" }).catch(error => console.warn("LocalPeer advertise", error));
    let lan = null, lanSecret = null;
    const pendingPeers = new Map();

    // Quien ya no está en la sala (expulsado o que se marchó) recibe la última foto, en la
    // que ya no aparece, y después se le cierra el canal.
    // El estado (con las manos y el mazo) solo va a quien ya tiene plaza: un móvil conectado
    // que aún no se ha unido no recibe nada.
    function setRoom(next) {
      room = next;
      onChange(room);
      for (const peerId of peerPlayers.keys()) transport.sendTo(peerId, "state", room);
      for (const [peerId, playerId] of [...peerPlayers]) {
        if (!room.playerOrder.includes(playerId)) { peerPlayers.delete(peerId); transport.removePeer(peerId); }
      }
    }
    function act(type, data = {}) {
      setRoom(CT.LocalRoom.reduce(room, actionFromMessage({ type, data: { ...data, playerId: HOST_ID } }, contextOf(room.mode), room)));
    }

    async function ensureLan() {
      if (!CT.LocalLanSignal.available()) return null;
      if (lan) return lan;
      lanSecret = CT.LocalLanSignal.token();
      lan = await CT.LocalLanSignal.startHost({
        token: lanSecret,
        onAnswer: async (answer, peerId) => {
          const pending = pendingPeers.get(String(peerId || ""));
          if (!pending) return;
          try { await pending.acceptAnswer(answer); pendingPeers.delete(String(peerId)); }
          catch (error) { console.error("LAN answer rejected", error); }
        }
      });
      return lan;
    }
    async function invitePeer() {
      const peer = transport.addPeer(), rawOffer = await peer.offerSignal();
      try {
        const endpoint = await ensureLan();
        if (endpoint) {
          pendingPeers.set(String(peer.peerId), peer);
          const automaticOffer = CT.LocalLanSignal.encodeInvite({ host: endpoint.host, port: endpoint.port, token: lanSecret, peerId: peer.peerId, roomCode, modeKey, deckFingerprint, signal: rawOffer });
          return { peerId: peer.peerId, offerSignal: automaticOffer, acceptAnswer: peer.acceptAnswer, automaticLan: true, peerConnection: peer.peerConnection };
        }
      } catch (error) { console.warn("LAN signaling unavailable; using manual fallback", error); }
      return { peerId: peer.peerId, offerSignal: rawOffer, acceptAnswer: peer.acceptAnswer, automaticLan: false, peerConnection: peer.peerConnection };
    }
    function close() {
      try { transport.closeAll(); }
      finally { pendingPeers.clear(); peerPlayers.clear(); if (lan) void lan.stop(); lan = null; lanSecret = null; }
    }
    return { HOST_ID, nearby: !!nearby, get nearbyPin() { return nearbyPin; }, invitePeer, removePeer: transport.removePeer, peerOf, act, currentRoom: () => room, close };
  }

  function createGuestSession({ offerSignal, nearbyHostId = null, pin = "", onFail, playerId, name, avatarId = null, deckFingerprint = null, onChange, onError, onDisconnect }) {
    let room = null, lanInvite = null, rawOffer = offerSignal;
    if (!nearbyHostId && typeof offerSignal === "string" && offerSignal.startsWith("CTL1:")) { lanInvite = CT.LocalLanSignal.decodeInvite(offerSignal); rawOffer = lanInvite.signal; }
    const onMessage = message => { if (message.type === "state") { if (!validRoom(message.data)) { onError?.("INVALID_ROOM"); return; } room = message.data; onChange(room); } else if (message.type === "error") onError?.(message.data?.message); };
    const onOpen = () => peer.send("join", { playerId, name, avatarId, deckFingerprint, ...(nearbyHostId ? { pin: String(pin) } : {}) });
    const peer = nearbyHostId
      ? CT.LocalPeer.createGuestPeer(nearbyHostId, onMessage, onOpen, () => onDisconnect?.(), () => onFail?.())
      : CT.LocalTransport.createGuestPeer(rawOffer, onMessage, onOpen, () => onDisconnect?.());
    async function answerSignal() {
      const answer = await peer.answerSignal();
      if (lanInvite) { await CT.LocalLanSignal.sendAnswer(lanInvite, answer, lanInvite.peerId); return ""; }
      return answer;
    }
    // Todas las jugadas del invitado pasan por aquí: el anfitrión las resuelve y reparte.
    const send = (type, data = {}) => peer.send(type, { ...data, playerId });
    return {
      answerSignal, send, peerConnection: peer.peerConnection, connect: () => peer.connect(),
      placeCard: (cardId, index) => send("place-card", { cardId, index }),
      finishTurn: () => send("finish-turn"),
      skipTurn: () => send("skip-turn"),
      removePlayer: targetId => send("remove-player", { targetId }),
      leave: () => { send("remove-player", { targetId: playerId }); setTimeout(peer.close, 300); },
      currentRoom: () => room, close: peer.close, automaticLan: !!lanInvite
    };
  }

  CT.LocalSession = { HOST_ID, validId, validRoom, valueOfForMode, buildDeck, actionFromMessage, contextFor, createHostSession, createGuestSession };
})();
