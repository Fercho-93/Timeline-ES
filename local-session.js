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
    "finish-turn", "skip-turn", "final-answer", "final-next", "remove-player", "player-away", "rematch"];

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
  function createHostSession({ roomCode, hostName, avatarId = null, modeKey, deckFingerprint = null, now = () => Date.now(), onChange, onPeerLost, onPeerBack }) {
    const context = contextFor(modeKey, now);
    let room = CT.LocalRoom.createRoom({ roomCode, hostId: HOST_ID, hostName, avatarId, modeKey, deckFingerprint, now: now() });
    onChange(room);
    const peerPlayers = new Map();
    function peerOf(playerId) { for (const [peerId, id] of peerPlayers) if (id === playerId) return peerId; return null; }

    function onGuestMessage(peerId, message) {
      const bound = peerPlayers.get(peerId);
      const data = { ...(message?.data || {}) };
      if (!bound) {
        // Antes de unirse no se puede hacer nada más; y solo se ocupa una plaza que ya
        // existe si su dueño está desconectado (es quien vuelve).
        const existing = room.players[data.playerId];
        if (message?.type !== "join" || !data.playerId || data.playerId === HOST_ID || (existing && !existing.away)) {
          transport.sendTo(peerId, "error", { message: existing && !existing.away ? "SEAT_TAKEN" : "NOT_ALLOWED" });
          return;
        }
      } else data.playerId = bound;
      try {
        const wasAway = !!room.players[data.playerId]?.away;
        const next = CT.LocalRoom.reduce(room, actionFromMessage({ type: message.type, data }, context, room));
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
      try { setRoom(CT.LocalRoom.reduce(room, actionFromMessage({ type: "player-away", data: { playerId: HOST_ID, targetId: playerId } }, context, room))); }
      catch (error) { console.error(error); }
      onPeerLost?.(name, room.status === "playing");
    }

    const transport = CT.LocalTransport.createHostSession(onGuestMessage, null, onGuestLost);
    let lan = null, lanSecret = null;
    const pendingPeers = new Map();

    // Quien ya no está en la sala (expulsado o que se marchó) recibe la última foto, en la
    // que ya no aparece, y después se le cierra el canal.
    function setRoom(next) {
      room = next;
      onChange(room);
      transport.broadcast("state", room);
      for (const [peerId, playerId] of [...peerPlayers]) {
        if (!room.playerOrder.includes(playerId)) { peerPlayers.delete(peerId); transport.removePeer(peerId); }
      }
    }
    function act(type, data = {}) {
      setRoom(CT.LocalRoom.reduce(room, actionFromMessage({ type, data: { ...data, playerId: HOST_ID } }, context, room)));
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
          return { peerId: peer.peerId, offerSignal: automaticOffer, acceptAnswer: peer.acceptAnswer, automaticLan: true };
        }
      } catch (error) { console.warn("LAN signaling unavailable; using manual fallback", error); }
      return { peerId: peer.peerId, offerSignal: rawOffer, acceptAnswer: peer.acceptAnswer, automaticLan: false };
    }
    function close() {
      try { transport.closeAll(); }
      finally { pendingPeers.clear(); peerPlayers.clear(); if (lan) void lan.stop(); lan = null; lanSecret = null; }
    }
    return { HOST_ID, invitePeer, removePeer: transport.removePeer, peerOf, act, currentRoom: () => room, close };
  }

  function createGuestSession({ offerSignal, playerId, name, avatarId = null, deckFingerprint = null, onChange, onError, onDisconnect }) {
    let room = null, lanInvite = null, rawOffer = offerSignal;
    if (typeof offerSignal === "string" && offerSignal.startsWith("CTL1:")) { lanInvite = CT.LocalLanSignal.decodeInvite(offerSignal); rawOffer = lanInvite.signal; }
    const peer = CT.LocalTransport.createGuestPeer(rawOffer,
      message => { if (message.type === "state") { room = message.data; onChange(room); } else if (message.type === "error") onError?.(message.data?.message); },
      () => peer.send("join", { playerId, name, avatarId, deckFingerprint }),
      () => onDisconnect?.());
    async function answerSignal() {
      const answer = await peer.answerSignal();
      if (lanInvite) { await CT.LocalLanSignal.sendAnswer(lanInvite, answer, lanInvite.peerId); return ""; }
      return answer;
    }
    // Todas las jugadas del invitado pasan por aquí: el anfitrión las resuelve y reparte.
    const send = (type, data = {}) => peer.send(type, { ...data, playerId });
    return {
      answerSignal, send,
      placeCard: (cardId, index) => send("place-card", { cardId, index }),
      finishTurn: () => send("finish-turn"),
      skipTurn: () => send("skip-turn"),
      removePlayer: targetId => send("remove-player", { targetId }),
      leave: () => { send("remove-player", { targetId: playerId }); setTimeout(peer.close, 300); },
      currentRoom: () => room, close: peer.close, automaticLan: !!lanInvite
    };
  }

  CT.LocalSession = { HOST_ID, valueOfForMode, buildDeck, actionFromMessage, contextFor, createHostSession, createGuestSession };
})();
