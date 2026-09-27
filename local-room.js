// La lógica de una sala del multijugador sin conexión, separada de cómo viajan los
// mensajes. `online.js` lleva las mismas reglas mezcladas con las llamadas a Firestore
// (una `runTransaction` por jugada); aquí es al revés: un reductor puro, sin red ni fechas
// del sistema — todo lo que no es determinista entra como argumento (`now`, `shuffle`,
// `random`, el mazo ya barajado, la carta de la final) para poder probarlo sin navegador.
//
// El anfitrión es quien aplica cada acción y reparte el resultado por `local-transport.js`;
// un invitado nunca toca este reductor directamente, le manda la acción al anfitrión y
// espera el estado que vuelve. Es el mismo papel que tiene Firestore hoy en `online.js`,
// solo que aquí el servidor es el propio móvil anfitrión.
//
// Las reglas son las mismas que en la sala online y en un solo móvil:
// - Quién empieza: minijuego de la cifra. La mesa se sienta por orden de cercanía.
// - Varias personas sin cartas en la misma ronda: final secreta (`CT.Final`), y si
//   empatan otra vez, otra carta solo entre quienes empataron.
// - Poderes opcionales: Fantasma y Pulso (`CT.Powers`, `CT.Ghost`, `CT.Engine.pulse`).
// Lo propio de aquí: quien pierde la conexión conserva su plaza y sus cartas (sus turnos se
// saltan mientras tanto) y puede volver a sentarse con una invitación nueva.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 9;
  const PULSE_MIN_HAND = 2;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

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
      starterDraw: null, ghost: null, pulsePower: null, pulse: false, pulseTurn: null,
      final: null, finalAnswers: null,
      createdAt: now, updatedAt: now
    };
  }

  // Misma comprobación que en `joinRoom` de `online.js`: si algún móvil lleva una versión
  // distinta de la app, el mazo puede haber cambiado y un mismo identificador de carta
  // dejaría de significar lo mismo en cada pantalla.
  //
  // Quien vuelve tras perder la conexión entra con su mismo identificador y recupera su
  // plaza tal cual la dejó; con la plaza ocupada por alguien conectado, no hay nada que
  // hacer (el anfitrión no ata un segundo canal a esa plaza).
  function joinRoom(state, { playerId, name, avatarId = null, deckFingerprint = null, now }) {
    if (state.deckFingerprint && deckFingerprint && state.deckFingerprint !== deckFingerprint) throw new Error("DECK_MISMATCH");
    if (state.playerOrder.includes(playerId)) {
      if (!state.players[playerId].away) return state;
      return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], away: false } }, version: state.version + 1, updatedAt: now };
    }
    if (state.status !== "lobby") throw new Error("ALREADY_STARTED");
    if (state.playerOrder.length >= MAX_PLAYERS) throw new Error("ROOM_FULL");
    return {
      ...state,
      players: { ...state.players, [playerId]: { name, ...(avatarId ? { avatarId } : {}), hand: [], joinedAt: now } },
      playerOrder: [...state.playerOrder, playerId],
      starterDraw: null,
      version: state.version + 1, updatedAt: now
    };
  }

  // ---------------------------------------------------------------------------
  // El minijuego de quién empieza. El anfitrión reparte una carta y cada persona escribe
  // su cifra; el orden lo calcula `CT.Starter.order` fuera del reductor y llega a `start`.
  function starterDraw(state, { requesterId, cardId, now }) {
    if (state.hostId !== requesterId || state.status !== "lobby") throw new Error("NOT_HOST");
    if (cardId == null) throw new Error("NOT_ALLOWED");
    return { ...state, starterDraw: { cardId, guesses: {} }, version: state.version + 1, updatedAt: now };
  }
  function starterGuess(state, { playerId, value, now }) {
    if (state.status !== "lobby" || !state.starterDraw || !state.playerOrder.includes(playerId) || !Number.isFinite(value)) throw new Error("NOT_ALLOWED");
    if (playerId in state.starterDraw.guesses) return state;
    return { ...state, starterDraw: { ...state.starterDraw, guesses: { ...state.starterDraw.guesses, [playerId]: value } }, version: state.version + 1, updatedAt: now };
  }
  function starterComplete(state) {
    return !!state.starterDraw && state.playerOrder.every(id => id in state.starterDraw.guesses);
  }

  // `deck` llega ya barajado y sin la carta del minijuego; `order` es la mesa por orden de
  // cercanía. Igual que en la sala online, no se empieza sin haber jugado el minijuego.
  function startRoom(state, { requesterId, handSize, turnSeconds, order, deck: shuffledDeck, ghost = false, pulse = false, random = Math.random, now }) {
    if (state.hostId !== requesterId) throw new Error("NOT_HOST");
    if (state.status !== "lobby") throw new Error("INVALID_START");
    if (state.playerOrder.length < MIN_PLAYERS) throw new Error("INVALID_START");
    if (!starterComplete(state)) throw new Error("STARTER_PENDING");
    const sameTable = Array.isArray(order) && order.length === state.playerOrder.length && state.playerOrder.every(id => order.includes(id));
    if (!sameTable) throw new Error("INVALID_START");
    const deck = [...shuffledDeck];
    const actualHand = Math.min(handSize, Math.floor((deck.length - 1) / order.length));
    const powers = CT.Powers && (ghost || pulse) ? CT.Powers.create(deck, order.length, actualHand, ghost, pulse, random) : { ghost: null, pulsePower: null };
    const players = {};
    order.forEach(id => { players[id] = { ...state.players[id], hand: deck.splice(0, actualHand), pulseUsed: false, shieldRound: 0, away: false }; });
    const timeline = [deck.shift()];
    order.forEach(id => players[id].hand.forEach(cardId => CT.Powers?.claim(powers, cardId, id, deck, random)));
    return {
      ...state, playerOrder: [...order], handSize: actualHand, turnSeconds: turnSeconds ?? state.turnSeconds,
      players, deck, timeline, discard: [], status: "playing", phase: "turn",
      ghost: powers.ghost, pulsePower: powers.pulsePower, pulse: !!pulse, pulseTurn: null,
      current: 0, starter: order[0], starterDraw: null, final: null, finalAnswers: null,
      turnsInRound: 0, round: 1, winner: null, winners: null, reveal: null,
      turnStartedAt: now, version: state.version + 1, updatedAt: now
    };
  }

  // ---------------------------------------------------------------------------
  // Jugadas normales
  function placeCard(state, { playerId, cardId, index, valueOf, shuffle, random = Math.random, now }) {
    const currentId = state.playerOrder[state.current];
    if (state.status !== "playing" || state.phase !== "turn" || currentId !== playerId) throw new Error("NOT_TURN");
    const played = CT.Engine.play(
      { hand: state.players[playerId].hand, timeline: state.timeline, deck: state.deck, discard: state.discard },
      cardId, index, valueOf, shuffle
    );
    const ghost = clone(state.ghost), pulsePower = clone(state.pulsePower);
    if (played.drawnCardId != null) CT.Powers?.claim({ ghost, pulsePower }, played.drawnCardId, playerId, played.deck, random);
    return {
      ...state, ghost, pulsePower,
      players: { ...state.players, [playerId]: { ...state.players[playerId], hand: played.hand } },
      deck: played.deck, discard: played.discard, timeline: played.timeline, phase: "reveal",
      reveal: { cardId, correct: played.correct, returned: played.returned, playerId, playerName: state.players[playerId].name },
      version: state.version + 1, updatedAt: now
    };
  }

  function useGhost(state, { playerId, now }) {
    const currentId = state.playerOrder[state.current];
    if (state.status !== "playing" || state.phase !== "turn" || currentId !== playerId
      || !CT.Ghost?.available(state.ghost, playerId, state.timeline.length, state.players[playerId].hand.length)) throw new Error("NOT_ALLOWED");
    const ghost = clone(state.ghost);
    CT.Ghost.activate(ghost, playerId, state.playerOrder);
    return { ...state, ghost, version: state.version + 1, updatedAt: now };
  }

  // ---------------------------------------------------------------------------
  // El Pulso, con las mismas reglas que en `app.js` y `online.js`: quien reta coloca
  // primero, sin que se vea; después coloca quien defiende en su propio móvil, y se
  // descubre todo a la vez.
  function pulseTargets(state, playerId) {
    return state.playerOrder.filter(id => id !== playerId && !state.players[id].away && (state.players[id].shieldRound || 0) !== state.round);
  }
  function pulseAvailable(state, playerId) {
    const me = state.players[playerId];
    if (!me || state.status !== "playing") return false;
    const hasPower = state.pulsePower ? !!CT.Powers?.ownsPulse(state.pulsePower, playerId) : !!state.pulse;
    return !state.ghost?.fresh && hasPower && !me.pulseUsed && me.hand.length >= PULSE_MIN_HAND
      && state.deck.length + state.discard.length > 0 && pulseTargets(state, playerId).length > 0;
  }
  function pulseStart(state, { playerId, targetId, shuffle = cards => [...cards], random = Math.random, now }) {
    const currentId = state.playerOrder[state.current];
    if (state.status !== "playing" || state.phase !== "turn" || currentId !== playerId) throw new Error("NOT_TURN");
    if (!pulseAvailable(state, playerId) || !pulseTargets(state, playerId).includes(targetId)) throw new Error("NOT_ALLOWED");
    let deck = [...state.deck], discard = [...state.discard];
    if (!deck.length) { deck = shuffle(discard); discard = []; }
    const cardId = deck.shift();
    if (cardId == null) throw new Error("NOT_ALLOWED");
    const me = state.players[playerId];
    const ghost = clone(state.ghost), pulsePower = clone(state.pulsePower);
    CT.Powers?.consumePulse(pulsePower, playerId);
    CT.Powers?.claim({ ghost, pulsePower }, cardId, playerId, deck, random);
    return {
      ...state, ghost, pulsePower, deck, discard, phase: "pulse",
      players: { ...state.players, [playerId]: { ...me, pulseUsed: true } },
      pulseTurn: { targetId, cardId, stage: "reto", giftId: me.hand[Math.floor(random() * me.hand.length)] },
      version: state.version + 1, updatedAt: now
    };
  }
  function pulsePlace(state, { playerId, index, valueOf, now }) {
    const currentId = state.playerOrder[state.current];
    if (state.status !== "playing" || state.phase !== "pulse" || currentId !== playerId || state.pulseTurn.stage !== "reto") throw new Error("NOT_TURN");
    const byOk = CT.Engine.fits(state.timeline, state.pulseTurn.cardId, index, valueOf);
    return { ...state, pulseTurn: { ...state.pulseTurn, stage: "defensa", byIndex: index, byOk }, version: state.version + 1, updatedAt: now };
  }
  function pulseDefend(state, { playerId, index, valueOf, shuffle, random = Math.random, now }) {
    if (state.status !== "playing" || state.phase !== "pulse" || state.pulseTurn.stage !== "defensa" || state.pulseTurn.targetId !== playerId) throw new Error("NOT_TURN");
    const byId = state.playerOrder[state.current];
    const resolved = CT.Engine.pulse({ ...state, byHand: state.players[byId].hand, targetHand: state.players[playerId].hand }, state.pulseTurn, index, valueOf, shuffle);
    const players = {
      ...state.players,
      [byId]: { ...state.players[byId], hand: resolved.byHand },
      [playerId]: { ...state.players[playerId], hand: resolved.targetHand }
    };
    if (resolved.giftId != null) players[playerId].shieldRound = state.round;
    const ghost = clone(state.ghost), pulsePower = clone(state.pulsePower);
    if (resolved.drawnCardId != null) CT.Powers?.claim({ ghost, pulsePower }, resolved.drawnCardId, byId, resolved.deck, random);
    return {
      ...state, players, ghost, pulsePower, deck: resolved.deck, discard: resolved.discard, timeline: resolved.timeline,
      phase: "reveal", pulseTurn: null,
      reveal: {
        cardId: state.pulseTurn.cardId, correct: resolved.byOk, returned: false, pulse: true, duel: true,
        targetOk: resolved.targetOk, penaltySkipped: resolved.penaltySkipped,
        giftId: resolved.giftId, byIndex: state.pulseTurn.byIndex, targetIndex: index,
        playerId: byId, playerName: state.players[byId].name, targetId: playerId, targetName: state.players[playerId].name
      },
      version: state.version + 1, updatedAt: now
    };
  }
  // Un Pulso a medias que se queda sin una de sus dos personas se anula: la carta del
  // duelo va al descarte y el turno vuelve a empezar (igual que al saltarlo en online).
  function cancelPulse(state) {
    if (state.phase !== "pulse" || !state.pulseTurn) return state;
    return { ...state, discard: [...state.discard, state.pulseTurn.cardId], pulseTurn: null, phase: "turn" };
  }

  // ---------------------------------------------------------------------------
  // Pasar de turno. Al cerrar la ronda se mira quién se ha quedado sin cartas: una sola
  // persona gana; varias pasan a la final secreta. Quien está desconectado no juega: su
  // turno se salta solo, igual que si se le hubiera agotado el tiempo.
  function advance(state, now, makeFinal) {
    let next = state;
    for (let guard = 0; guard <= next.playerOrder.length; guard++) {
      const ghost = clone(next.ghost);
      CT.Ghost?.advance(ghost, next.playerOrder[next.current], next.playerOrder);
      let turnsInRound = next.turnsInRound + 1, round = next.round;
      if (turnsInRound >= next.playerOrder.length) {
        const { empty } = CT.Engine.roundOutcome(next.playerOrder, next.players, next.deck.length + next.discard.length);
        if (empty.length === 1) {
          return { ...next, ghost, status: "ended", phase: "finished", winner: empty[0], winners: empty, reveal: null, pulseTurn: null, version: state.version + 1, updatedAt: now };
        }
        if (empty.length > 1) {
          if (typeof makeFinal !== "function") throw new Error("NOT_ALLOWED");
          return { ...next, ghost, phase: "final", final: makeFinal(empty, null, next.timeline), finalAnswers: {}, reveal: null, pulseTurn: null, version: state.version + 1, updatedAt: now };
        }
        turnsInRound = 0; round += 1;
      }
      next = { ...next, ghost, current: (next.current + 1) % next.playerOrder.length, turnsInRound, round, phase: "turn", reveal: null, pulseTurn: null, turnStartedAt: now };
      if (!next.players[next.playerOrder[next.current]].away) break;
    }
    return { ...next, version: state.version + 1, updatedAt: now };
  }

  function finishTurn(state, { requesterId, now, makeFinal }) {
    const currentId = state.playerOrder[state.current];
    if (state.phase !== "reveal" || (requesterId !== currentId && requesterId !== state.hostId)) throw new Error("NOT_ALLOWED");
    return advance(state, now, makeFinal);
  }

  // Solo el anfitrión: cuando se agota el tiempo del turno o alguien se ha quedado sin
  // batería. `expectedVersion` evita saltar un turno que ya ha cambiado por su cuenta.
  function skipTurn(state, { requesterId, expectedVersion = null, now, makeFinal }) {
    if (state.hostId !== requesterId || state.status !== "playing" || !["turn", "pulse"].includes(state.phase)) throw new Error("NOT_ALLOWED");
    if (expectedVersion !== null && (state.version !== expectedVersion || state.phase !== "turn")) return state;
    return advance(cancelPulse(state), now, makeFinal);
  }

  // ---------------------------------------------------------------------------
  // La final secreta: cada finalista escribe su cifra en su móvil; al estar todas, se
  // enseñan juntas y cualquiera puede pasar al resultado (o a otra carta si empatan).
  function finalAnswer(state, { playerId, value, now }) {
    if (state.phase !== "final" || !state.final.players.includes(playerId) || !Number.isSafeInteger(value)) throw new Error("NOT_ALLOWED");
    if (playerId in state.finalAnswers) return state;
    return { ...state, finalAnswers: { ...state.finalAnswers, [playerId]: value }, version: state.version + 1, updatedAt: now };
  }
  function finalComplete(state) {
    return state.phase === "final" && state.final.players.every(id => id in (state.finalAnswers || {}));
  }
  function finalNext(state, { requesterId, rank, makeFinal, now }) {
    if (!state.playerOrder.includes(requesterId) || !finalComplete(state)) throw new Error("NOT_ALLOWED");
    const { winners } = rank(state.final, state.finalAnswers);
    if (winners.length === 1) {
      return { ...state, status: "ended", phase: "finished", winner: winners[0], winners, version: state.version + 1, updatedAt: now };
    }
    return { ...state, final: makeFinal(winners, state.final, state.timeline), finalAnswers: {}, version: state.version + 1, updatedAt: now };
  }

  // ---------------------------------------------------------------------------
  // Expulsar (cosa del anfitrión) o marcharse (cosa de cada cual); las cartas de quien sale
  // vuelven al descarte. El anfitrión no puede salir: cerrar la sala es la única salida.
  function removePlayer(state, { requesterId, targetId, now, makeFinal }) {
    if (targetId !== requesterId && state.hostId !== requesterId) throw new Error("NOT_ALLOWED");
    const index = state.playerOrder.indexOf(targetId);
    if (index < 0) return state;
    if (targetId === state.hostId) throw new Error("HOST");
    const wasCurrent = index === state.current;
    const involvedInPulse = state.phase === "pulse" && (wasCurrent || state.pulseTurn?.targetId === targetId);
    const source = involvedInPulse ? cancelPulse(state) : state;
    const playerOrder = source.playerOrder.filter(id => id !== targetId);
    const players = { ...source.players };
    const hand = players[targetId]?.hand || [];
    delete players[targetId];
    const ghost = clone(source.ghost);
    if (wasCurrent) CT.Ghost?.advance(ghost, targetId, playerOrder);
    CT.Ghost?.remove(ghost, targetId, playerOrder);
    const base = { ...source, ghost, players, playerOrder, discard: [...source.discard, ...hand], starterDraw: null, version: state.version + 1, updatedAt: now };
    if (state.status !== "playing") return base;
    if (playerOrder.length < 2) {
      return { ...base, status: "ended", phase: "finished", winner: playerOrder[0] ?? null, winners: playerOrder.slice(0, 1), current: 0, turnsInRound: 0, reveal: null, pulseTurn: null };
    }
    if (state.phase === "final") {
      const finalists = state.final.players.filter(id => id !== targetId);
      const finalAnswers = { ...state.finalAnswers };
      delete finalAnswers[targetId];
      const current = Math.min(state.current - (index < state.current ? 1 : 0), playerOrder.length - 1);
      if (finalists.length === 1) return { ...base, current, status: "ended", phase: "finished", winner: finalists[0], winners: finalists };
      return { ...base, current, final: { ...state.final, players: finalists }, finalAnswers };
    }
    const before = index < state.current;
    const current = ((before ? state.current - 1 : state.current) + playerOrder.length) % playerOrder.length;
    const turnsInRound = Math.min(before ? Math.max(0, state.turnsInRound - 1) : state.turnsInRound, playerOrder.length - 1);
    const next = {
      ...base, current, turnsInRound,
      phase: wasCurrent || involvedInPulse ? "turn" : base.phase,
      reveal: wasCurrent ? null : base.reveal,
      ...(wasCurrent || involvedInPulse ? { turnStartedAt: now } : {})
    };
    // Si el turno ha caído en alguien desconectado, se salta como cualquier otro: `advance`
    // cuenta su turno y sigue hasta alguien conectado.
    return next.phase === "turn" && next.players[next.playerOrder[next.current]].away
      ? { ...advance(next, now, makeFinal), version: state.version + 1 } : next;
  }

  // Un canal que se cae no saca a nadie de la partida: la plaza y las cartas se guardan
  // para cuando vuelva, y mientras tanto sus turnos se saltan. En la sala de espera, en
  // cambio, no hay nada que guardar: se libera la plaza.
  function playerAway(state, { requesterId, targetId, now, makeFinal }) {
    if (state.hostId !== requesterId || !state.playerOrder.includes(targetId) || targetId === state.hostId) throw new Error("NOT_ALLOWED");
    if (state.status !== "playing") return removePlayer(state, { requesterId, targetId, now, makeFinal });
    if (state.players[targetId].away) return state;
    let next = { ...state, players: { ...state.players, [targetId]: { ...state.players[targetId], away: true } }, version: state.version + 1, updatedAt: now };
    const currentId = next.playerOrder[next.current];
    if (next.phase === "pulse" && (currentId === targetId || next.pulseTurn?.targetId === targetId)) next = cancelPulse(next);
    if (next.phase === "turn" && currentId === targetId) next = { ...advance(next, now, makeFinal), version: state.version + 1 };
    return next;
  }

  // Revancha: la misma mesa vuelve al vestíbulo, lista para otro minijuego y otro reparto.
  // Solo el anfitrión, y solo con la partida terminada; quien seguía desconectado se va.
  function rematch(state, { requesterId, now }) {
    if (state.hostId !== requesterId || state.status !== "ended") throw new Error("NOT_ALLOWED");
    const playerOrder = state.playerOrder.filter(id => !state.players[id].away);
    const players = {};
    playerOrder.forEach(id => { const { away, pulseUsed, shieldRound, ...rest } = state.players[id]; players[id] = { ...rest, hand: [] }; });
    return {
      ...state, status: "lobby", phase: "lobby", players, playerOrder,
      deck: [], discard: [], timeline: [], current: 0, turnsInRound: 0, round: 1,
      winner: null, winners: null, reveal: null, turnStartedAt: null,
      starterDraw: null, ghost: null, pulsePower: null, pulseTurn: null, final: null, finalAnswers: null,
      version: state.version + 1, updatedAt: now
    };
  }

  // Un único punto de entrada para lo que llega por `local-transport.js`: el anfitrión
  // recibe `{type, data}` de un invitado (o se manda uno a sí mismo) y no necesita saber
  // qué función concreta aplicar.
  const ACTIONS = {
    join: joinRoom, "starter-draw": starterDraw, "starter-guess": starterGuess, start: startRoom,
    "place-card": placeCard, "use-ghost": useGhost, "pulse-start": pulseStart, "pulse-place": pulsePlace, "pulse-defend": pulseDefend,
    "finish-turn": finishTurn, "skip-turn": skipTurn, "final-answer": finalAnswer, "final-next": finalNext,
    "remove-player": removePlayer, "player-away": playerAway, rematch
  };
  function reduce(state, action) {
    const handler = ACTIONS[action?.type];
    if (!handler) throw new Error("UNKNOWN_ACTION");
    return handler(state, action);
  }

  CT.LocalRoom = {
    MIN_PLAYERS, MAX_PLAYERS, createRoom, joinRoom, startRoom, placeCard, finishTurn, skipTurn, rematch, removePlayer,
    starterComplete, finalComplete, pulseAvailable, pulseTargets, reduce
  };
})();
