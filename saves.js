(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const VERSION = 2;
  const clone = value => JSON.parse(JSON.stringify(value));
  function prepare(state, mode) {
    state.saveVersion = VERSION;
    state.mode ||= mode;
    state.savedDeck ||= clone(CT.cards(state.mode));
    return state;
  }
  function validate(state, mode) {
    if (!state || typeof state !== "object" || ![undefined, 1, VERSION].includes(state.saveVersion) || !CT.has(state.mode || mode)) throw Error("Formato desconocido");
    prepare(state, mode);
    if (!Array.isArray(state.savedDeck) || !state.savedDeck.length) throw Error("Mazo ausente");
    const ids = new Set(state.savedDeck.map(card => card.id));
    if (ids.size !== state.savedDeck.length || state.savedDeck.some(card => typeof card.title !== "string" || !Number.isFinite(CT.sortValue(state.mode, card)))) throw Error("Mazo inválido");
    for (const list of [state.timeline, state.deck, state.discard || [], state.failed || [], ...(state.players || []).map(p => p.hand)]) {
      if (!Array.isArray(list) || list.some(id => !ids.has(id))) throw Error("Cartas ausentes");
    }
    if (!state.players && !ids.has(state.current)) throw Error("Carta actual ausente");
    if (state.players && (!state.players.length || !Number.isInteger(state.current) || !state.players[state.current])) throw Error("Turno inválido");
    if (state.pulseTurn && !ids.has(state.pulseTurn.cardId)) throw Error("Pulso inválido");
    if (state.pendingResult && !ids.has(state.pendingResult.cardId ?? state.pendingResult.card?.id)) throw Error("Resultado inválido");
    const values = new Map(state.savedDeck.map(card => [card.id, CT.sortValue(state.mode, card)]));
    if (state.timeline.some((id, i) => i > 0 && values.get(state.timeline[i - 1]) > values.get(id))) throw Error("La línea guardada necesita el catálogo original");
    return state;
  }
  function read(key, mode) {
    const raw = CT.Storage.getItem(key);
    if (!raw) return null;
    try { return validate(JSON.parse(raw), mode); }
    catch { CT.Storage.protect(key); return null; }
  }
  CT.Saves = { VERSION, prepare, validate, read, clone };
})();
