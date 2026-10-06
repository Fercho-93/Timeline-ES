(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const catalog = CT.QuickCatalog;
  const challenge = id => catalog.challenges.find(c => c.id === id);
  const clone = value => JSON.parse(JSON.stringify(value));
  function create(config) {
    if (!config || !Array.isArray(config.names) || config.names.length < 1 || config.names.length > 8 ||
        config.names.some(n => typeof n !== 'string' || !n.trim() || n.length > 24) ||
        !Array.isArray(config.rounds) || config.rounds.length < 1 || config.rounds.length > catalog.challenges.length) throw Error('INVALID_CONFIG');
    if (config.keep !== undefined && typeof config.keep !== 'boolean') throw Error('INVALID_CONFIG');
    // `first`: quién abre el primer reto (0 = el primero de la lista, 1 = el segundo); la revancha de un duelo lo alterna.
    if (config.first !== undefined && !(config.first === 0 || config.first === 1)) throw Error('INVALID_CONFIG');
    // `seconds`: plazo por jugada (0 = sin tiempo). Al agotarse se juega `timeoutPlacement`.
    if (config.seconds !== undefined && ![0, 15, 20, 30].includes(config.seconds)) throw Error('INVALID_CONFIG');
    const ids = new Set();
    for (const round of config.rounds) {
      const c = challenge(round.id);
      // El reto diario juega un recorte fijo del mazo (ver DAILY_QUICK_CARDS en quick-challenges.js); el resto, el mazo entero.
      if (!c || !Array.isArray(round.order) || round.order.length < 2 || round.order.length > c.cards.length ||
          new Set(round.order).size !== round.order.length || round.order.some(id => !c.cards.some(card => card.id === id))) throw Error('INVALID_DECK');
      ids.add(c.id);
    }
    const s = {config: clone(config), index: 0, players: config.names.map(name => ({name: name.trim(), score: 0, points: 0, status: 'active'}))};
    startRound(s);
    return s;
  }
  // ¿Un fallo deja fuera del reto? Con `config.keep` explícito manda él: true = se sigue hasta agotar las cartas (el fallo
  // solo no suma), false = quien falla pierde lo provisional y no vuelve a jugar hasta el siguiente reto. Sin él (partidas
  // guardadas antes de existir la opción) se mantiene lo de entonces: sigue quien juega solo sin ser un duelo.
  const keepPlaying = s => typeof s.config.keep === 'boolean' ? s.config.keep : s.config.names.length === 1 && s.config.kind !== 'duel';
  function startRound(s) {
    const round = s.config.rounds[s.index];
    s.timeline = [round.order[0]];
    s.remaining = round.order.slice(1);
    // El inicio rota en cada reto: nadie tiene ventaja por ser quien crea la sala.
    s.starter = (s.index + (s.config.first || 0)) % s.players.length;
    s.current = s.starter;
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
      const keep = keepPlaying(s);
      const lost = correct || keep ? 0 : p.points;
      if (correct) p.points++; else if (!keep) {p.points = 0; p.status = 'failed';}
      s.result = {cardId: command.cardId, correct, lost, player: s.current, keep};
      s.phase = 'result';
    } else if (command?.type === 'bank' && s.phase === 'turn' && !keepPlaying(s)) {
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
    if (!record || record.version !== catalog.version || !Array.isArray(record.commands) || record.commands.length > 2000) throw Error('INVALID_SAVE');
    return record.commands.reduce(step, create(record.config));
  }
  // La jugada que se hace sola cuando se agota el tiempo: la primera carta pendiente en un hueco
  // donde no encaja, así cuenta como fallo con un comando normal (vale igual en salas y enlaces).
  function timeoutPlacement(s) {
    const c = challenge(s.config.rounds[s.index].id), cardId = s.remaining[0];
    const value = id => c.cards.find(card => card.id === id).value * c.direction;
    for (let index = 0; index <= s.timeline.length; index++) if (!CT.Engine.fits(s.timeline, cardId, index, value)) return {type: 'place', cardId, index};
    return {type: 'place', cardId, index: 0};
  }
  CT.QuickEngine = {create, step, restore, challenge, keepPlaying, timeoutPlacement};
})();
