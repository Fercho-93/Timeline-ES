(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const catalog = CT.QuickCatalog;
  const challenge = id => catalog.challenges.find(c => c.id === id);
  const clone = value => JSON.parse(JSON.stringify(value));
  function create(config) {
    if (!config || !Array.isArray(config.names) || config.names.length < 1 || config.names.length > 4 ||
        config.names.some(n => typeof n !== 'string' || !n.trim() || n.length > 24) ||
        !Array.isArray(config.rounds) || ![1, 3].includes(config.rounds.length)) throw Error('INVALID_CONFIG');
    const ids = new Set();
    for (const round of config.rounds) {
      const c = challenge(round.id);
      if (!c || ids.has(c.id) || !Array.isArray(round.order) || round.order.length !== c.cards.length ||
          new Set(round.order).size !== c.cards.length || round.order.some(id => !c.cards.some(card => card.id === id))) throw Error('INVALID_DECK');
      ids.add(c.id);
    }
    const s = {config: clone(config), index: 0, players: config.names.map(name => ({name: name.trim(), score: 0, points: 0, status: 'active'}))};
    startRound(s);
    return s;
  }
  function startRound(s) {
    const round = s.config.rounds[s.index];
    s.timeline = [round.order[0]];
    s.remaining = round.order.slice(1);
    s.current = s.index % s.players.length;
    s.phase = 'turn'; s.result = null;
    s.players.forEach(p => {p.points = 0; p.status = 'active'; p.roundScore = 0;});
  }
  function settle(s) {
    if (!s.remaining.length || s.players.every(p => p.status !== 'active')) {
      s.players.forEach(p => {
        if (p.status === 'active') {p.score += p.points; p.roundScore = p.points; p.points = 0; p.status = 'banked';}
      });
      s.phase = 'round-end';
    } else {
      do {s.current = (s.current + 1) % s.players.length;} while (s.players[s.current].status !== 'active');
      s.phase = 'turn';
    }
  }
  function step(input, command) {
    const s = clone(input), c = challenge(s.config.rounds[s.index].id), p = s.players[s.current];
    if (command?.type === 'place' && s.phase === 'turn') {
      if (!s.remaining.includes(command.cardId) || !Number.isInteger(command.index) || command.index < 0 || command.index > s.timeline.length) throw Error('INVALID_PLACEMENT');
      const value = id => c.cards.find(card => card.id === id).value * c.direction;
      const correct = CT.Engine.fits(s.timeline, command.cardId, command.index, value);
      const correction = s.timeline.findIndex(id => value(id) > value(command.cardId));
      s.timeline.splice(correct ? command.index : correction < 0 ? s.timeline.length : correction, 0, command.cardId);
      s.remaining = s.remaining.filter(id => id !== command.cardId);
      const lost = correct ? 0 : p.points;
      if (correct) p.points++; else {p.points = 0; p.status = 'failed';}
      s.result = {cardId: command.cardId, correct, lost, player: s.current};
      s.phase = 'result';
    } else if (command?.type === 'bank' && s.phase === 'turn') {
      p.score += p.points; p.roundScore = p.points; p.points = 0; p.status = 'banked';
      settle(s);
    } else if (command?.type === 'ack' && s.phase === 'result') {
      s.result = null; settle(s);
    } else if (command?.type === 'next' && s.phase === 'round-end' && s.index + 1 < s.config.rounds.length) {
      s.index++; startRound(s);
    } else throw Error('INVALID_ACTION');
    return s;
  }
  // Se reconstruye la partida con comandos legales; nunca se confía en un marcador guardado.
  function restore(record) {
    if (!record || record.version !== catalog.version || !Array.isArray(record.commands) || record.commands.length > 100) throw Error('INVALID_SAVE');
    return record.commands.reduce(step, create(record.config));
  }
  CT.QuickEngine = {create, step, restore, challenge};
})();
