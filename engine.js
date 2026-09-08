(function () {
  'use strict';
  const CT = window.CONTINUUM;
  CT.Engine = Object.freeze({
    draw(deckInput, discardInput, shuffle = CT.shuffle) {
      let deck = [...deckInput], discard = [...discardInput];
      if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
      return {cardId:deck.shift(), deck, discard};
    },
    roundOutcome(order, players, available) {
      const empty = order.filter(id => players[id].hand.length === 0);
      return {empty, ended:empty.length === 1 || (empty.length > 1 && available < empty.length)};
    }
  });
})();
