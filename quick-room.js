(function () {
  'use strict';
  const CT = window.CONTINUUM, E = CT.QuickEngine;
  const copy = x => JSON.parse(JSON.stringify(x));
  function create(id, name, capacity=4) {
    if (!id || typeof name !== 'string' || !name.trim() || name.trim().length > 24) throw Error('Escribe tu nombre.');
    return {version:1, capacity, host:id, members:[id], names:[name.trim()], config:null, commands:[], revision:0, phase:'lobby', actor:id};
  }
  function record(room) {return {version:CT.QuickCatalog.version, config:room.config, commands:room.commands};}
  function state(room) {return room.config ? E.restore(record(room)) : null;}
  function metadata(room) {
    const s = state(room);
    room.phase = s.phase === 'round-end' && s.index === s.config.rounds.length - 1 ? 'finished' : s.phase;
    room.actor = room.phase === 'round-end' || room.phase === 'finished' ? room.host : room.members[s.current];
    return room;
  }
  function validate(room) {
    if (!room || room.version !== 1 || !Array.isArray(room.members) || room.members.length < 1 || !Number.isInteger(room.capacity) || room.capacity < 2 || room.capacity > 8 || room.members.length > room.capacity || new Set(room.members).size !== room.members.length || room.members[0] !== room.host || !Array.isArray(room.names) || room.names.length !== room.members.length || room.names.some(n => typeof n !== 'string' || !n.trim() || n.length > 24) || !Number.isInteger(room.revision) || room.revision < 0) throw Error('Sala no válida.');
    if (room.config) {
      if (JSON.stringify(room.config.names) !== JSON.stringify(room.names)) throw Error('Participantes no válidos.');
      const derived = metadata(copy(room));
      if (derived.actor !== room.actor || derived.phase !== room.phase) throw Error('Turno no válido.');
    } else if (room.phase !== 'lobby' || room.actor !== room.host || room.commands.length) throw Error('Sala no válida.');
    return room;
  }
  function reduce(input, id, action, revision = input.revision) {
    validate(input);
    if (revision !== input.revision) throw Error('La sala ha cambiado. Vuelve a intentarlo.');
    const r = copy(input);
    if (action.type === 'join') {
      if (r.members.includes(id)) return r;
      if (r.phase !== 'lobby' || r.members.length >= r.capacity) throw Error('La sala está completa o ya ha empezado.');
      const name = typeof action.name === 'string' ? action.name.trim() : '';
      if (!name || name.length > 24 || r.names.some(n=>n.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw Error('Escribe un nombre diferente.');
      r.members.push(id); r.names.push(name);
    } else if (action.type === 'start') {
      if (id !== r.host || r.phase !== 'lobby' || r.members.length < 2) throw Error('Solo quien crea la sala puede empezar, con al menos dos personas.');
      r.config = {names:r.names, rounds:action.rounds, kind: action.kind || (r.capacity === 2 ? 'duel' : 'network'), historyId: action.historyId || null}; E.create(r.config); metadata(r);
    } else {
      if (!r.config || r.phase === 'finished' || id !== r.actor) throw Error('Espera tu turno.');
      const s = E.step(state(r), action);
      r.commands.push(copy(action));
      if (!s) throw Error('Jugada no válida.');
      metadata(r);
    }
    r.revision++;
    return validate(r);
  }
  CT.QuickRoom = {create, reduce, record, state, validate};
})();
