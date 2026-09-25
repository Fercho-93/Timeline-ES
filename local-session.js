// Une `local-room.js` (las reglas) con `local-transport.js` (el canal): la pieza que
// `online.js` no necesita porque Firestore ya hace de intermediario entre las dos. Aquí no
// hay nadie más escuchando, así que alguien tiene que aplicar cada acción y repartir el
// resultado — ese alguien es siempre el anfitrión, nunca un invitado.
//
// Protocolo por el canal de datos, todo `{type, data}` (ver `local-transport.js`):
//   invitado → anfitrión: "join", "start", "place-card", "finish-turn", "skip-turn",
//                          "remove-player" — cada uno con su `data.playerId`, elegido por
//                          el propio invitado antes de unirse (no el id de la conexión:
//                          ese es solo de transporte, y no sobrevive a una reconexión).
//   anfitrión → todos:    "state" (la sala entera, tras cada acción aplicada) y "error"
//                          (solo a quien mandó una acción inválida).
//
// El anfitrión juega con las mismas reglas que reparte: sus propias jugadas pasan por el
// mismo `buildAction`, no por un atajo aparte.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  const HOST_ID = "host";

  function valueOfForMode(modeKey) {
    const byId = new Map(CT.cards(modeKey).map(card => [card.id, card]));
    return id => CT.sortValue(modeKey, byId.get(id));
  }

  // El mazo que reparte `startRoom`: barajado aquí, no dentro del reductor, porque el
  // reductor es puro y barajar no lo es. Sin la carta del sorteo inicial todavía —esta
  // primera versión no tiene la minipartida de "quién es más joven"—, así que la primera
  // carta de la línea temporal sale, sin más, de la cabeza del mazo ya barajado.
  function buildDeck(modeKey, shuffle = CT.shuffle) {
    return shuffle(CT.cards(modeKey).map(card => card.id));
  }

  // Puro: de un mensaje del canal a una acción del reductor. Sin esto no se podría probar
  // el protocolo sin abrir una conexión WebRTC de verdad.
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

  // --- Anfitrión: aplica, guarda y reparte. ---
  function createHostSession({ roomCode, hostName, avatarId = null, modeKey, deckFingerprint = null, now = () => Date.now(), onChange }) {
    const valueOf = valueOfForMode(modeKey);
    const context = { modeKey, valueOf, shuffle: CT.shuffle, now };
    let room = CT.LocalRoom.createRoom({ roomCode, hostId: HOST_ID, hostName, avatarId, modeKey, deckFingerprint, now: now() });
    onChange(room);

    const transport = CT.LocalTransport.createHostSession((peerId, message) => {
      try { setRoom(CT.LocalRoom.reduce(room, actionFromMessage(message, context))); }
      catch (error) { transport.sendTo(peerId, "error", { message: error.message }); }
    });

    function setRoom(next) {
      room = next;
      onChange(room);
      transport.broadcast("state", room);
    }

    // Las jugadas del propio anfitrión no dan la vuelta por el canal: se resuelven igual,
    // con el mismo `actionFromMessage`, y de ahí se reparten al resto.
    function act(type, data = {}) {
      setRoom(CT.LocalRoom.reduce(room, actionFromMessage({ type, data: { ...data, playerId: HOST_ID } }, context)));
    }

    async function invitePeer() {
      const peer = transport.addPeer();
      return { peerId: peer.peerId, offerSignal: await peer.offerSignal(), acceptAnswer: peer.acceptAnswer };
    }

    return {
      HOST_ID, invitePeer, removePeer: transport.removePeer, act,
      currentRoom: () => room, close: transport.closeAll
    };
  }

  // --- Invitado: manda acciones, refleja lo que el anfitrión reparte. Nunca aplica el
  // reductor por su cuenta — jugaría con datos que podrían no coincidir con los del resto. ---
  function createGuestSession({ offerSignal, playerId, name, avatarId = null, deckFingerprint = null, onChange, onError }) {
    let room = null;
    const peer = CT.LocalTransport.createGuestPeer(
      offerSignal,
      message => {
        if (message.type === "state") { room = message.data; onChange(room); }
        else if (message.type === "error") onError?.(message.data?.message);
      },
      () => peer.send("join", { playerId, name, avatarId, deckFingerprint })
    );

    return {
      answerSignal: peer.answerSignal,
      start: ({ handSize, turnSeconds, starterId }) => peer.send("start", { playerId, handSize, turnSeconds, starterId }),
      placeCard: (cardId, index) => peer.send("place-card", { playerId, cardId, index }),
      finishTurn: () => peer.send("finish-turn", { playerId }),
      skipTurn: () => peer.send("skip-turn", { playerId }),
      removePlayer: targetId => peer.send("remove-player", { playerId, targetId }),
      currentRoom: () => room, close: peer.close
    };
  }

  CT.LocalSession = { HOST_ID, valueOfForMode, buildDeck, actionFromMessage, createHostSession, createGuestSession };
})();
