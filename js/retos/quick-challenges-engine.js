// Reglas de Retos rápidos, sin pantallas: preparar la partida, colocar cartas, puntuar y decidir el
// ganador.
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
    if (config.first !== undefined && !(Number.isInteger(config.first) && config.first >= 0 && config.first < config.names.length)) throw Error('INVALID_CONFIG');
    // `seconds`: plazo por jugada (0 = sin tiempo). Al agotarse se juega `timeoutPlacement`.
    if (config.seconds !== undefined && ![0, 15, 20, 30].includes(config.seconds)) throw Error('INVALID_CONFIG');
    for (const round of config.rounds) {
      const c = challenge(round.id);
      // Cada partida juega un recorte del mazo (SOLO_CARDS en solitario, MULTI_CARDS con más gente); las guardadas antes
      // del recorte, el mazo entero.
      if (!c || !Array.isArray(round.order) || round.order.length < 2 || round.order.length > c.cards.length ||
          new Set(round.order).size !== round.order.length || round.order.some(id => !c.cards.some(card => card.id === id))) throw Error('INVALID_DECK');
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
    // Quien ha salido de la partida (`gone`, comando `drop`) ya no juega: se salta su turno en cada reto.
    s.players.forEach(p => {p.points = 0; p.status = p.gone ? 'gone' : 'active'; p.roundScore = 0;});
    for (let guard = 0; s.players[s.current].gone && guard < s.players.length; guard++) s.current = (s.current + 1) % s.players.length;
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
      // `attempted`: el hueco donde se puso (sobre la línea sin la carta), para enseñar dónde falló.
      s.result = {cardId: command.cardId, correct, lost, player: s.current, keep, attempted: command.index};
      s.phase = 'result';
    } else if (command?.type === 'bank' && s.phase === 'turn' && !keepPlaying(s)) {
      p.score += p.points; p.roundScore = p.points; p.points = 0; p.status = 'banked';
      settle(s);
    } else if (command?.type === 'ack' && s.phase === 'result') {
      s.result = null; settle(s);
    } else if (command?.type === 'next' && s.phase === 'round-end' && s.index + 1 < s.config.rounds.length) {
      s.index++; startRound(s);
    } else if (command?.type === 'drop' && ['turn', 'result', 'round-end'].includes(s.phase) && Number.isInteger(command.player)
        && s.players[command.player] && !s.players[command.player].gone && s.players.some((q, i) => i !== command.player && !q.gone)) {
      // Sacar a alguien de la partida (se quedó sin batería, no responde): conserva lo asegurado, pierde lo que tenía en
      // juego y no vuelve a jugar. Si era su turno, o su resultado a la vista, la partida sigue con quien toca.
      const out = s.players[command.player];
      out.gone = true; out.points = 0; out.status = 'gone';
      if (s.phase === 'result' && s.result?.player === command.player) {s.result = null; settle(s);}
      else if (s.phase === 'turn' && s.current === command.player) settle(s);
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
  // Partidas con más de una persona (sala, mesa pública, un solo móvil, duelo): siempre 10 cartas al azar del mazo.
  const MULTI_CARDS = 10;
  // Jugando solo (mazos del día, partida sorpresa y reto diario): 10 cartas que colocar en cada reto, como una ronda de
  // Grandes colecciones, más la que abre la línea. Un mazo más pequeño se juega entero.
  const SOLO_CARDS = 10;
  CT.QuickEngine = {create, step, restore, challenge, keepPlaying, timeoutPlacement, MULTI_CARDS, SOLO_CARDS};
})();
