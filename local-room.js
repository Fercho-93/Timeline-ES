// La lógica de una sala del multijugador sin conexión, separada de cómo viajan los
// mensajes. `online.js` lleva las mismas reglas mezcladas con las llamadas a Firestore
// (una `runTransaction` por jugada); aquí es al revés: un reductor puro, sin red, sin
// fechas del sistema ni aleatoriedad propia — todo lo que no es determinista entra como
// argumento (`now`, `shuffle`, el mazo ya barajado) para poder probarlo sin un navegador.
//
// El anfitrión es quien aplica cada acción y reparte el resultado por `local-transport.js`;
// un invitado nunca toca este reductor directamente, le manda la acción al anfitrión y
// espera el estado que vuelve. Es el mismo papel que tiene Firestore hoy en `online.js`,
// solo que aquí el servidor es el propio móvil anfitrión.
//
// Alcance de esta primera versión: la partida básica (repartir, colocar, pasar turno,
// expulsar/salir, ganador único). Fantasma, Pulso, torneo y el desempate de final secreta
// —que si tres jugadores se quedan sin cartas en la misma ronda reparte una final aparte—
// todavía no están aquí; `finishTurn` avisa con un error reconocible (`TIE_NOT_SUPPORTED_YET`)
// en vez de fingir que lo resuelve.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 9;

  function createRoom({ roomCode, hostId, hostName, avatarId = null, modeKey, deckFingerprint = null, now }) {
    if (!roomCode || !hostId || !hostName || !modeKey) throw new Error("INVALID_ROOM");
    return {
      roomCode, mode: modeKey, deckFingerprint,
      hostId, status: "lobby", phase: "lobby", version: 1,
      handSize: 4, turnSeconds: 30,
      playerOrder: [hostId],
      players: { [hostId]: { name: hostName, ...(avatarId ? { avatarId } : {}), hand: [], joinedAt: now } },
      deck: [], discard: [], timeline: [], current: 0, starter: hostId,
      turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
      createdAt: now, updatedAt: now
    };
  }

  // Misma comprobación que hoy en `joinRoom`/`startRoom` de `online.js`: si algún móvil
  // lleva una versión distinta de la app, el mazo puede haber cambiado (ha pasado con
  // animales, países y distancias) y un mismo identificador de carta dejaría de significar
  // lo mismo en cada pantalla.
  function joinRoom(state, { playerId, name, avatarId = null, deckFingerprint = null, now }) {
    if (state.deckFingerprint && deckFingerprint && state.deckFingerprint !== deckFingerprint) throw new Error("DECK_MISMATCH");
    if (state.playerOrder.includes(playerId)) return state;
    if (state.status !== "lobby") throw new Error("ALREADY_STARTED");
    if (state.playerOrder.length >= MAX_PLAYERS) throw new Error("ROOM_FULL");
    return {
      ...state,
      players: { ...state.players, [playerId]: { name, ...(avatarId ? { avatarId } : {}), hand: [], joinedAt: now } },
      playerOrder: [...state.playerOrder, playerId],
      version: state.version + 1, updatedAt: now
    };
  }

  // `deck` llega ya barajado y sin la carta del sorteo inicial: barajar es aleatorio y este
  // reductor no lo es, así que la decisión de qué mazo usar es de quien llama.
  function startRoom(state, { requesterId, handSize, turnSeconds, starterId, deck: shuffledDeck, now }) {
    if (state.hostId !== requesterId) throw new Error("NOT_HOST");
    if (state.status !== "lobby") throw new Error("INVALID_START");
    if (state.playerOrder.length < MIN_PLAYERS) throw new Error("INVALID_START");
    if (!state.playerOrder.includes(starterId)) throw new Error("INVALID_START");
    const deck = [...shuffledDeck];
    const actualHand = Math.min(handSize, Math.floor((deck.length - 1) / state.playerOrder.length));
    const players = { ...state.players };
    state.playerOrder.forEach(id => { players[id] = { ...players[id], hand: deck.splice(0, actualHand) }; });
    const timeline = [deck.shift()];
    return {
      ...state, handSize: actualHand, turnSeconds: turnSeconds ?? state.turnSeconds,
      players, deck, timeline, discard: [], status: "playing", phase: "turn",
      current: state.playerOrder.indexOf(starterId), starter: starterId,
      turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
      version: state.version + 1, updatedAt: now
    };
  }

  function placeCard(state, { playerId, cardId, index, valueOf, shuffle, now }) {
    const currentId = state.playerOrder[state.current];
    if (state.status !== "playing" || state.phase !== "turn" || currentId !== playerId) throw new Error("NOT_TURN");
    const played = CT.Engine.play(
      { hand: state.players[playerId].hand, timeline: state.timeline, deck: state.deck, discard: state.discard },
      cardId, index, valueOf, shuffle
    );
    return {
      ...state,
      players: { ...state.players, [playerId]: { ...state.players[playerId], hand: played.hand } },
      deck: played.deck, discard: played.discard, timeline: played.timeline, phase: "reveal",
      reveal: { cardId, correct: played.correct, returned: played.returned, playerId, playerName: state.players[playerId].name },
      version: state.version + 1, updatedAt: now
    };
  }

  function finishTurn(state, { requesterId, now }) {
    const currentId = state.playerOrder[state.current];
    if (state.phase !== "reveal" || (requesterId !== currentId && requesterId !== state.hostId)) throw new Error("NOT_ALLOWED");
    let turnsInRound = state.turnsInRound + 1, round = state.round;
    if (turnsInRound >= state.playerOrder.length) {
      const { empty } = CT.Engine.roundOutcome(state.playerOrder, state.players, state.deck.length + state.discard.length);
      if (empty.length === 1) {
        return { ...state, status: "ended", phase: "finished", winner: empty[0], winners: empty, reveal: null, version: state.version + 1, updatedAt: now };
      }
      if (empty.length > 1) throw new Error("TIE_NOT_SUPPORTED_YET");
      turnsInRound = 0; round += 1;
    }
    return { ...state, current: (state.current + 1) % state.playerOrder.length, turnsInRound, round, phase: "turn", reveal: null, version: state.version + 1, updatedAt: now };
  }

  function skipTurn(state, { requesterId, now }) {
    if (state.hostId !== requesterId || state.status !== "playing") throw new Error("NOT_ALLOWED");
    const roundEnds = state.turnsInRound + 1 >= state.playerOrder.length;
    return {
      ...state, current: (state.current + 1) % state.playerOrder.length,
      turnsInRound: roundEnds ? 0 : state.turnsInRound + 1, round: roundEnds ? state.round + 1 : state.round,
      phase: "turn", reveal: null, version: state.version + 1, updatedAt: now
    };
  }

  // Expulsar (cosa del anfitrión) o marcharse (cosa de cada cual); las cartas de quien sale
  // vuelven al descarte. El anfitrión no puede salir: cerrar la sala es la única salida.
  function removePlayer(state, { requesterId, targetId, now }) {
    if (targetId !== requesterId && state.hostId !== requesterId) throw new Error("NOT_ALLOWED");
    const index = state.playerOrder.indexOf(targetId);
    if (index < 0) return state;
    if (targetId === state.hostId) throw new Error("HOST");
    const playerOrder = state.playerOrder.filter(id => id !== targetId);
    const players = { ...state.players };
    const hand = players[targetId]?.hand || [];
    delete players[targetId];
    const base = { ...state, players, playerOrder, discard: [...state.discard, ...hand], version: state.version + 1, updatedAt: now };
    if (state.status !== "playing") return base;
    if (playerOrder.length < 2) {
      return { ...base, status: "ended", phase: "finished", winner: playerOrder[0] ?? null, current: 0, turnsInRound: 0, reveal: null };
    }
    const before = index < state.current;
    const current = ((before ? state.current - 1 : state.current) + playerOrder.length) % playerOrder.length;
    const turnsInRound = Math.min(before ? Math.max(0, state.turnsInRound - 1) : state.turnsInRound, playerOrder.length - 1);
    return {
      ...base, current, turnsInRound,
      phase: targetId === state.playerOrder[state.current] ? "turn" : state.phase,
      reveal: targetId === state.playerOrder[state.current] ? null : state.reveal
    };
  }

  // Un único punto de entrada para lo que llega por `local-transport.js`: el anfitrión
  // recibe `{type, data}` de un invitado (o se manda uno a sí mismo) y no necesita saber
  // qué función concreta aplicar.
  const ACTIONS = { join: joinRoom, start: startRoom, "place-card": placeCard, "finish-turn": finishTurn, "skip-turn": skipTurn, "remove-player": removePlayer };
  function reduce(state, action) {
    const handler = ACTIONS[action?.type];
    if (!handler) throw new Error("UNKNOWN_ACTION");
    return handler(state, action);
  }

  CT.LocalRoom = { MIN_PLAYERS, MAX_PLAYERS, createRoom, joinRoom, startRoom, placeCard, finishTurn, skipTurn, removePlayer, reduce };
})();
