// La sala de Retos rápidos con varias personas: quién está, quién juega y qué jugadas se aceptan.
// La usan tanto la versión por Wi-Fi como la de internet.
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
  // Cada comando guarda quién lo jugó. Las reglas exigen que sea quien escribe, y `authors`
  // comprueba que era su turno: así nadie puede jugar las cartas de otro apuntándose como
  // `actor`. Los comandos sin firma son de salas anteriores a este cambio y se aceptan.
  const sign = (action, id) => ({...copy(action), by: id});
  const sameCommand = (command, action, id) => JSON.stringify(command) === JSON.stringify(sign(action, id)) || JSON.stringify(command) === JSON.stringify(action);
  function authors(room) {
    let s = E.create(room.config);
    for (const command of room.commands) {
      // Pasar de reto y sacar a alguien de la partida los hace quien lleva la sala.
      const expected = command?.type === 'next' || command?.type === 'drop' ? room.host : room.members[s.current];
      if (command && 'by' in command && command.by !== expected) throw Error('Turno no válido.');
      s = E.step(s, command);
    }
  }
  // Duelo por turnos recién empezado por quien lo crea: la partida ya tiene dos jugadores, pero el segundo aún no ha entrado.
  const FRIEND = 'Tu amigo', DUEL_MAX = 4;
  // El nombre provisional de cada plaza libre de un duelo (en el de dos, «Tu amigo», como siempre).
  const seatName = (capacity, i) => capacity === 2 ? FRIEND : `Jugador ${i + 1}`;
  function waitingFriend(room) {
    // De 2 a 4: quien lo crea juega sin esperar y cada amigo ocupa, al abrir el enlace, la siguiente plaza libre.
    const c = room.config;
    return c?.kind === 'duel' && room.capacity <= DUEL_MAX && room.members.length < room.capacity && Array.isArray(c.names)
      && c.names.length === room.capacity && room.names.every((n, i) => c.names[i] === n);
  }
  function validate(room) {
    if (!room || room.version !== 1 || !Array.isArray(room.members) || room.members.length < 1 || !Number.isInteger(room.capacity) || room.capacity < 2 || room.capacity > 10 || room.members.length > room.capacity || new Set(room.members).size !== room.members.length || room.members[0] !== room.host || !Array.isArray(room.names) || room.names.length !== room.members.length || room.names.some(n => typeof n !== 'string' || !n.trim() || n.length > 24) || !Number.isInteger(room.revision) || room.revision < 0) throw Error('Sala no válida.');
    if (room.resigned !== undefined && (!room.config || room.config.kind !== 'duel' || !room.members.includes(room.resigned))) throw Error('Sala no válida.');
    if (room.declined !== undefined && (!room.config || room.declined !== room.invitedUid || room.members.includes(room.declined))) throw Error('Sala no válida.');
    if (room.config) {
      if (JSON.stringify(room.config.names) !== JSON.stringify(room.names) && !waitingFriend(room)) throw Error('Participantes no válidos.');
      authors(room);
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
      if (lateFriend) {r.config.names = [...r.names, ...r.config.names.slice(r.names.length)]; metadata(r);}
    } else if (action.type === 'leave') {
      // Dejar una mesa pública antes de empezar: se libera la plaza y, si se iba quien la
      // llevaba, la lleva quien queda primero.
      const at = r.members.indexOf(id);
      if (r.matchmaking !== 'public' || r.phase !== 'lobby' || at < 0 || r.members.length < 2) throw Error('No se puede salir ahora.');
      r.members.splice(at, 1); r.names.splice(at, 1);
      if (r.starter) delete r.starter.guesses[id];
      r.host = r.members[0]; r.actor = r.host;
    } else if (action.type === 'kick') {
      // Echar a alguien de la sala de espera: solo quien la lleva, en una sala privada (en una mesa pública se
      // sienta quien llega) y antes de empezar; no puede echarse a sí mismo (si quiere irse, cierra la sala).
      // Su respuesta del minijuego de quién empieza se borra con él. Puede volver a entrar con el código.
      const at = r.members.indexOf(action.target);
      if (id !== r.host || r.matchmaking === 'public' || r.phase !== 'lobby' || at < 1) throw Error('No se puede expulsar a esa persona.');
      r.members.splice(at, 1); r.names.splice(at, 1);
      if (r.starter) delete r.starter.guesses[action.target];
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
    } else if (action.type === 'force') {
      // Jugar por quien no responde (cerró la app o se quedó sin red), pasado su plazo: lo mismo que haría el tiempo
      // agotado. El comando va firmado por quien tenía que jugar (`by`) y por quien lo fuerza (`forcedBy`); las reglas
      // exigen que haya pasado el plazo (firestore.rules, `forcing`). En un duelo por turnos no se fuerza: se juega
      // cuando cada uno puede.
      if (!r.config || r.config.kind === 'duel' || !['turn', 'result', 'round-end'].includes(r.phase) || !r.members.includes(id) || id === r.actor) throw Error('No se puede jugar por otra persona ahora.');
      const now = state(r);
      const command = now.phase === 'turn' ? E.timeoutPlacement(now) : now.phase === 'result' ? {type: 'ack'} : {type: 'next'};
      if (!E.step(now, command)) throw Error('Jugada no válida.');
      r.commands.push({...command, by: r.actor, forcedBy: id});
      metadata(r);
    } else if (action.type === 'drop') {
      // Sacar a alguien de una partida ya empezada: solo quien lleva la sala, nunca a sí mismo, y no en un duelo por
      // turnos (ahí está «Rendirse»). En una mesa pública las reglas solo lo permiten con quien ha dejado de responder.
      const at = action.player;
      if (!r.config || r.config.kind === 'duel' || id !== r.host || !['turn', 'result', 'round-end'].includes(r.phase) || !Number.isInteger(at) || at < 0 || at >= r.members.length || r.members[at] === r.host) throw Error('No se puede sacar a esa persona ahora.');
      const command = {type: 'drop', player: at};
      E.step(state(r), command);
      r.commands.push(sign(command, id));
      metadata(r);
    } else if (action.type === 'start') {
      // Un duelo por turnos lo empieza quien lo crea, sin esperar al amigo: su sitio queda reservado hasta que abra el enlace.
      const alone = r.capacity <= DUEL_MAX && r.members.length === 1 && action.kind === 'duel' && r.matchmaking !== 'public';
      if (id !== r.host || r.phase !== 'lobby' || (r.members.length < 2 && !alone)) throw Error('Solo quien crea la sala puede empezar, con al menos dos personas.');
      r.config = {names:alone ? [...r.names, ...Array.from({length: r.capacity - 1}, (_, i) => seatName(r.capacity, i + 1))] : r.names, rounds:action.rounds, kind: action.kind || (r.capacity === 2 ? 'duel' : 'network'), historyId: action.historyId || null, ...(typeof action.keep === 'boolean' ? {keep: action.keep} : {}), ...([15, 20, 30].includes(action.seconds) ? {seconds: action.seconds} : {}), ...(alone ? (Number.isInteger(action.first) && action.first >= 0 && action.first < r.capacity ? {first: action.first} : {}) : (Number.isInteger(action.first) && action.first >= 0 && action.first < r.members.length ? {first: action.first} : {}))}; E.create(r.config); metadata(r);
    } else {
      if (!r.config || r.phase === 'finished' || id !== r.actor) throw Error('Espera tu turno.');
      const now = state(r);
      if ((now.phase === 'turn' || now.phase === 'result') && r.members[now.current] !== id) throw Error('Espera tu turno.');
      const s = E.step(now, action);
      r.commands.push(sign(action, id));
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
  CT.QuickRoom = {DUEL_MAX, create, reduce, record, state, validate, sign, sameCommand, starterOrder, starterComplete, starterPick};
})();
