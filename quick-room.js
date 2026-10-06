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
    // Quien se rinde cierra el duelo: la partida queda como terminada y el otro gana.
    if (room.resigned || room.declined) {room.phase = 'finished'; room.actor = room.host; return room;}
    const s = state(room);
    room.phase = s.phase === 'round-end' && s.index === s.config.rounds.length - 1 ? 'finished' : s.phase;
    // En un duelo por turnos el amigo puede no haber entrado aún: mientras tanto el móvil de quien creó la sala hace de turno.
    room.actor = room.phase === 'round-end' || room.phase === 'finished' ? room.host : room.members[s.current] || room.host;
    return room;
  }
  // Duelo por turnos recién empezado por quien lo crea: la partida ya tiene dos jugadores, pero el segundo aún no ha entrado.
  const FRIEND = 'Tu amigo';
  function waitingFriend(room) {
    return room.capacity === 2 && room.members.length === 1 && room.config?.kind === 'duel' && room.config.names.length === 2 && room.config.names[0] === room.names[0];
  }
  function validate(room) {
    if (!room || room.version !== 1 || !Array.isArray(room.members) || room.members.length < 1 || !Number.isInteger(room.capacity) || room.capacity < 2 || room.capacity > 8 || room.members.length > room.capacity || new Set(room.members).size !== room.members.length || room.members[0] !== room.host || !Array.isArray(room.names) || room.names.length !== room.members.length || room.names.some(n => typeof n !== 'string' || !n.trim() || n.length > 24) || !Number.isInteger(room.revision) || room.revision < 0) throw Error('Sala no válida.');
    if (room.resigned !== undefined && (!room.config || room.config.kind !== 'duel' || !room.members.includes(room.resigned))) throw Error('Sala no válida.');
    if (room.declined !== undefined && (!room.config || room.declined !== room.invitedUid || room.members.includes(room.declined))) throw Error('Sala no válida.');
    if (room.config) {
      if (JSON.stringify(room.config.names) !== JSON.stringify(room.names) && !waitingFriend(room)) throw Error('Participantes no válidos.');
      const derived = metadata(copy(room));
      if (derived.actor !== room.actor || derived.phase !== room.phase) throw Error('Turno no válido.');
    } else if (room.phase !== 'lobby' || room.actor !== room.host || room.commands.length) throw Error('Sala no válida.');
    // El minijuego de quién empieza: una carta sorteada y la cifra de cada persona.
    if (room.starter !== undefined) {
      const s = room.starter;
      if (!s || typeof s.modeKey !== 'string' || !s.modeKey || s.modeKey.length > 32 || !Number.isInteger(s.cardId) || !s.guesses || typeof s.guesses !== 'object'
          || Object.entries(s.guesses).some(([who, value]) => !room.members.includes(who) || !Number.isFinite(value))) throw Error('Sala no válida.');
    }
    return room;
  }
  function reduce(input, id, action, revision = input.revision) {
    validate(input);
    if (revision !== input.revision) throw Error('La sala ha cambiado. Vuelve a intentarlo.');
    const r = copy(input);
    if (action.type === 'join') {
      if (r.members.includes(id)) return r;
      const lateFriend = r.phase !== 'lobby' && r.phase !== 'finished' && r.matchmaking !== 'public' && waitingFriend(r);
      if ((r.phase !== 'lobby' && !lateFriend) || r.members.length >= r.capacity) throw Error('La sala está completa o ya ha empezado.');
      if (r.invitedUid && r.invitedUid !== id) throw Error('Este duelo es de otra persona.');
      const name = typeof action.name === 'string' ? action.name.trim() : '';
      if (!name || name.length > 24 || r.names.some(n=>n.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw Error('Escribe un nombre diferente.');
      r.members.push(id); r.names.push(name);
      if (lateFriend) {r.config.names = r.names.slice(); metadata(r);}
    } else if (action.type === 'leave') {
      // Dejar una mesa pública antes de empezar: se libera la plaza y, si se iba quien la
      // llevaba, la lleva quien queda primero.
      const at = r.members.indexOf(id);
      if (r.matchmaking !== 'public' || r.phase !== 'lobby' || at < 0 || r.members.length < 2) throw Error('No se puede salir ahora.');
      r.members.splice(at, 1); r.names.splice(at, 1);
      if (r.starter) delete r.starter.guesses[id];
      r.host = r.members[0]; r.actor = r.host;
    } else if (action.type === 'starter-draw') {
      // Sortear la carta: solo quien lleva la sala, con al menos dos personas; repetirlo borra las respuestas.
      if (r.phase !== 'lobby' || id !== r.host || r.members.length < 2 || typeof action.modeKey !== 'string' || !action.modeKey || action.modeKey.length > 32 || !Number.isInteger(action.cardId)) throw Error('No se puede sortear ahora.');
      r.starter = {modeKey: action.modeKey, cardId: action.cardId, guesses: {}};
    } else if (action.type === 'starter-guess') {
      // Cada persona responde una vez, sin poder cambiarla después de ver las demás.
      if (r.phase !== 'lobby' || !r.starter || !r.members.includes(id) || id in r.starter.guesses || !Number.isFinite(action.value)) throw Error('No puedes responder ahora.');
      r.starter.guesses[id] = action.value;
    } else if (action.type === 'decline') {
      // Rechazar un reto dirigido sin haberlo aceptado: el duelo se cierra y a quien retó le sale cancelado.
      if (!r.config || !r.invitedUid || r.invitedUid !== id || r.members.includes(id) || r.phase === 'finished' || r.declined) throw Error('No puedes rechazar este reto.');
      r.declined = id; metadata(r);
    } else if (action.type === 'resign') {
      // Rendirse en un duelo por turnos con los dos dentro: el rival gana y el duelo queda en el historial.
      if (r.capacity !== 2 || r.members.length !== 2 || r.config?.kind !== 'duel' || r.phase === 'finished' || !r.members.includes(id)) throw Error('No te puedes rendir ahora.');
      r.resigned = id; metadata(r);
    } else if (action.type === 'start') {
      // Un duelo por turnos lo empieza quien lo crea, sin esperar al amigo: su sitio queda reservado hasta que abra el enlace.
      const alone = r.capacity === 2 && r.members.length === 1 && action.kind === 'duel' && r.matchmaking !== 'public';
      if (id !== r.host || r.phase !== 'lobby' || (r.members.length < 2 && !alone)) throw Error('Solo quien crea la sala puede empezar, con al menos dos personas.');
      r.config = {names:alone ? [...r.names, FRIEND] : r.names, rounds:action.rounds, kind: action.kind || (r.capacity === 2 ? 'duel' : 'network'), historyId: action.historyId || null, ...(typeof action.keep === 'boolean' ? {keep: action.keep} : {}), ...([15, 20, 30].includes(action.seconds) ? {seconds: action.seconds} : {}), ...(alone ? (action.first === 0 || action.first === 1 ? {first: action.first} : {}) : (Number.isInteger(action.first) && action.first >= 0 && action.first < r.members.length ? {first: action.first} : {}))}; E.create(r.config); metadata(r);
    } else {
      if (!r.config || r.phase === 'finished' || id !== r.actor) throw Error('Espera tu turno.');
      const now = state(r);
      if ((now.phase === 'turn' || now.phase === 'result') && r.members[now.current] !== id) throw Error('Espera tu turno.');
      const s = E.step(now, action);
      r.commands.push(copy(action));
      if (!s) throw Error('Jugada no válida.');
      metadata(r);
    }
    r.revision++;
    return validate(r);
  }
  // Orden del minijuego: índices de la mesa de quien más se acercó a quien menos (quien no respondió, al final).
  function starterOrder(room) {
    if (!room.starter) return null;
    const ids = CT.Starter.order(room.starter.modeKey, room.starter.cardId, room.members.map(who => ({id: who, value: Number.isFinite(room.starter.guesses[who]) ? room.starter.guesses[who] : null})));
    return ids.map(who => room.members.indexOf(who));
  }
  // Carta del minijuego: de una colección al azar que se pueda responder con una cifra.
  function starterPick() {
    const modeKey = CT.shuffle(CT.Tournament.modes())[0];
    return {modeKey, cardId: CT.shuffle(CT.cards(modeKey))[0].id};
  }
  const starterComplete = room => !!room.starter && room.members.every(who => Number.isFinite(room.starter.guesses[who]));
  CT.QuickRoom = {create, reduce, record, state, validate, starterOrder, starterComplete, starterPick};
})();
