(function () {
  'use strict';
  const CT = typeof window === 'undefined' ? null : window.CONTINUUM;
  const Engine = Object.freeze({
    draw(deckInput, discardInput, shuffle = CT?.shuffle || (cards => [...cards])) {
      let deck = [...deckInput], discard = [...discardInput];
      if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
      return {cardId:deck.shift(), deck, discard};
    },
    fits(timeline, cardId, index, value) {
      if (!Number.isInteger(index) || index < 0 || index > timeline.length) throw new Error('INVALID_SLOT');
      const number = value(cardId);
      if (!Number.isFinite(number)) throw new Error('INVALID_CARD');
      return (index === 0 || number >= value(timeline[index - 1]))
        && (index === timeline.length || number <= value(timeline[index]));
    },
    play(state, cardId, index, value, shuffle) {
      if (!state.hand.includes(cardId)) throw new Error('NO_CARD');
      const correct = Engine.fits(state.timeline, cardId, index, value);
      const hand = state.hand.filter(id => id !== cardId), timeline = [...state.timeline];
      let deck = [...state.deck], discard = [...state.discard], drawnCardId, returned = false;
      if (correct) timeline.splice(index, 0, cardId);
      else {
        const drawn = Engine.draw(deck, discard, shuffle);
        deck = drawn.deck; discard = drawn.discard; drawnCardId = drawn.cardId;
        if (drawnCardId == null) { hand.push(cardId); returned = true; }
        else { hand.push(drawnCardId); discard.push(cardId); }
      }
      return {hand, timeline, deck, discard, correct, returned, drawnCardId};
    },
    pulse(state, pulse, targetIndex, value, shuffle) {
      const byOk = Engine.fits(state.timeline, pulse.cardId, pulse.byIndex, value);
      const targetOk = Engine.fits(state.timeline, pulse.cardId, targetIndex, value);
      const timeline = [...state.timeline], byHand = [...state.byHand], targetHand = [...state.targetHand];
      let deck = [...state.deck], discard = [...state.discard], giftId = null, drawnCardId;
      if (byOk || targetOk) timeline.splice(byOk ? pulse.byIndex : targetIndex, 0, pulse.cardId);
      else discard.push(pulse.cardId);
      if (byOk && !targetOk) {
        if (!byHand.includes(pulse.giftId)) throw new Error('NO_GIFT');
        giftId = pulse.giftId;
        byHand.splice(byHand.indexOf(giftId), 1); targetHand.push(giftId);
      } else if (!byOk) {
        const drawn = Engine.draw(deck, discard, shuffle);
        deck = drawn.deck; discard = drawn.discard; drawnCardId = drawn.cardId;
        if (drawnCardId != null) byHand.push(drawnCardId);
      }
      return {timeline, deck, discard, byHand, targetHand, byOk, targetOk, giftId, drawnCardId,
        penaltySkipped: !byOk && drawnCardId == null};
    },
    roundOutcome(order, players, available) {
      const empty = order.filter(id => players[id].hand.length === 0);
      return {empty, ended:empty.length === 1 || (empty.length > 1 && available < empty.length)};
    }
  });
  if (CT) CT.Engine = Engine;
  else globalThis.ContinuumEngine = Engine;
})();
