// Une las reglas de sala con WebRTC. La señalización LAN permite que el invitado solo
// escanee una vez: la respuesta WebRTC vuelve automáticamente al anfitrión por la Wi-Fi local.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;
  const HOST_ID = "host";

  function valueOfForMode(modeKey) {
    const byId = new Map(CT.cards(modeKey).map(card => [card.id, card]));
    return id => CT.sortValue(modeKey, byId.get(id));
  }
  function buildDeck(modeKey, shuffle = CT.shuffle) { return shuffle(CT.cards(modeKey).map(card => card.id)); }
  function actionFromMessage(message, context) {
    const data = message?.data || {};
    const { modeKey, valueOf, shuffle, now } = context;
    switch (message?.type) {
      case "join": return { type: "join", playerId: data.playerId, name: data.name, avatarId: data.avatarId, deckFingerprint: data.deckFingerprint, now: now() };
      case "start": return { type: "start", requesterId: data.playerId, handSize: data.handSize, turnSeconds: data.turnSeconds, starterId: data.starterId, deck: buildDeck(modeKey, shuffle), now: now() };
      case "place-card": return { type: "place-card", playerId: data.playerId, cardId: data.cardId, index: data.index, valueOf, shuffle, now: now() };
      case "finish-turn": return { type: "finish-turn", requesterId: data.playerId, now: now() };
      case "skip-turn": return { type: "skip-turn", requesterId: data.playerId, now: now() };
      case "remove-player": return { type: "remove-player", requesterId: data.playerId, targetId: data.targetId, now: now() };
      default: throw new Error("UNKNOWN_ACTION");
    }
  }

  function createHostSession({ roomCode, hostName, avatarId = null, modeKey, deckFingerprint = null, now = () => Date.now(), onChange }) {
    const valueOf = valueOfForMode(modeKey);
    const context = { modeKey, valueOf, shuffle: CT.shuffle, now };
    let room = CT.LocalRoom.createRoom({ roomCode, hostId: HOST_ID, hostName, avatarId, modeKey, deckFingerprint, now: now() });
    onChange(room);
    const transport = CT.LocalTransport.createHostSession((peerId, message) => {
      try { setRoom(CT.LocalRoom.reduce(room, actionFromMessage(message, context))); }
      catch (error) { transport.sendTo(peerId, "error", { message: error.message }); }
    });
    let lan = null;
    let lanSecret = null;
    const pendingPeers = new Map();

    function setRoom(next) { room = next; onChange(room); transport.broadcast("state", room); }
    function act(type, data = {}) { setRoom(CT.LocalRoom.reduce(room, actionFromMessage({ type, data: { ...data, playerId: HOST_ID } }, context))); }

    async function ensureLan() {
      if (!CT.LocalLanSignal?.available?.()) return null;
      if (lan) return lan;
      lanSecret = CT.LocalLanSignal.token();
      lan = await CT.LocalLanSignal.startHost({ token: lanSecret, onAnswer: async (answer, peerId) => {
        const pending = pendingPeers.get(String(peerId || ""));
        if (!pending) return;
        try { await pending.acceptAnswer(answer); pendingPeers.delete(String(peerId)); }
        catch (error) { console.error("LAN answer rejected", error); }
      }});
      return lan;
    }

    async function invitePeer() {
      const peer = transport.addPeer();
      const rawOffer = await peer.offerSignal();
      try {
        const endpoint = await ensureLan();
        if (endpoint) {
          pendingPeers.set(String(peer.peerId), peer);
          const automaticOffer = CT.LocalLanSignal.encodeInvite({
            host: endpoint.host, port: endpoint.port, token: lanSecret,
            roomCode, modeKey, deckFingerprint, signal: rawOffer
          });
          return { peerId: peer.peerId, offerSignal: automaticOffer, acceptAnswer: peer.acceptAnswer, automaticLan: true };
        }
      } catch (error) { console.warn("LAN signaling unavailable; using manual fallback", error); }
      return { peerId: peer.peerId, offerSignal: rawOffer, acceptAnswer: peer.acceptAnswer, automaticLan: false };
    }

    function close() {
      try { transport.closeAll(); } finally { pendingPeers.clear(); if (lan) void lan.stop(); lan = null; lanSecret = null; }
    }
    return { HOST_ID, invitePeer, removePeer: transport.removePeer, act, currentRoom: () => room, close };
  }

  function createGuestSession({ offerSignal, playerId, name, avatarId = null, deckFingerprint = null, onChange, onError }) {
    let room = null;
    let lanInvite = null;
    let rawOffer = offerSignal;
    if (typeof offerSignal === "string" && offerSignal.startsWith("CTL1:")) {
      lanInvite = CT.LocalLanSignal.decodeInvite(offerSignal);
      rawOffer = lanInvite.signal;
    }
    const peer = CT.LocalTransport.createGuestPeer(
      rawOffer,
      message => {
        if (message.type === "state") { room = message.data; onChange(room); }
        else if (message.type === "error") onError?.(message.data?.message);
      },
      () => peer.send("join", { playerId, name, avatarId, deckFingerprint })
    );
    async function answerSignal() {
      const answer = await peer.answerSignal();
      if (lanInvite) {
        await CT.LocalLanSignal.sendAnswer(lanInvite, answer, lanInvite.peerId || "");
        return "";
      }
      return answer;
    }
    return {
      answerSignal,
      start: ({ handSize, turnSeconds, starterId }) => peer.send("start", { playerId, handSize, turnSeconds, starterId }),
      placeCard: (cardId, index) => peer.send("place-card", { playerId, cardId, index }),
      finishTurn: () => peer.send("finish-turn", { playerId }),
      skipTurn: () => peer.send("skip-turn", { playerId }),
      removePlayer: targetId => peer.send("remove-player", { playerId, targetId }),
      currentRoom: () => room, close: peer.close,
      automaticLan: !!lanInvite
    };
  }

  CT.LocalSession = { HOST_ID, valueOfForMode, buildDeck, actionFromMessage, createHostSession, createGuestSession };
})();
