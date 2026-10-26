// Reglas compartidas de Fantasma y dificultad. No introduce cartas con valores
// falsos: los poderes acompañan a robos normales y viven fuera de las manos.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  // Cada nivel lleva su propio tiempo por carta: así la mejor marca de un nivel se
  // consigue siempre con el mismo reloj y se puede comparar.
  const LEVELS = {
    easy: { name: "Fácil", extra: 0, seconds: 0, hidden: "never", description: "Valores visibles. Sin cartas automáticas. Sin tiempo." },
    normal: { name: "Normal", extra: 1, seconds: 30, hidden: "never", description: "Valores visibles. Cada acierto añade una carta bien colocada: la línea se estrecha. 30 segundos por carta." },
    hard: { name: "Difícil", extra: 2, seconds: 20, hidden: "sometimes", description: "Cada acierto añade dos cartas bien colocadas y hay turnos Fantasma ocasionales. 20 segundos por carta." },
    expert: { name: "Experto", extra: 2, seconds: 15, hidden: "always", description: "Cada acierto añade dos cartas bien colocadas. Valores siempre ocultos (la ilustración se ve). 15 segundos por carta." }
  };

  // Siempre ceil(P/3) poderes, máximo 3. Cada posición elegible pesa
  // 0.5/N + (está entre las primeras 12*P ? 0.5/W : 0), con W=min(N,12*P).
  // Es la mezcla 50/50 entre todo el mazo y la zona inicial, sin reemplazo:
  // también puede tocar la última carta. N excluye la que inicia el tablero.
  function choose(deck, count, handSize, amount, random = Math.random) {
    const dealt = count * handSize;
    const eligible = deck.filter((_, i) => i !== dealt);
    const windowSize = Math.min(eligible.length, 12 * count);
    const slots = eligible.map((id, i) => ({ id, weight: 0.5 / eligible.length + (i < windowSize ? 0.5 / windowSize : 0) }));
    const picked = [];
    const limit = Math.min(slots.length, amount);
    for (let n = 0; n < limit; n++) {
      let pick = random() * slots.reduce((sum, slot) => sum + slot.weight, 0);
      let at = 0;
      while (at < slots.length - 1 && (pick -= slots[at].weight) >= 0) at++;
      picked.push(slots.splice(at, 1)[0].id);
    }
    return picked;
  }
  function create(deck, count, handSize, random = Math.random) {
    const chosen = choose(deck, count, handSize, Math.min(3, Math.ceil(count / 3)), random);
    return { distribution: 2, cards: chosen, owners: chosen.map(() => ""), used: [], pending: [], cooldown: [], actor: "", fresh: false };
  }

  function claim(ghost, cardId, playerId, remainingDeck = [], random = Math.random, occupied = []) {
    if (!ghost) return;
    const index = ghost.cards.indexOf(cardId);
    if (index < 0 || ghost.owners[index]) return;
    const id = String(playerId);
    if (ghost.owners.includes(id)) {
      const candidates = remainingDeck.filter(card => !ghost.cards.includes(card) && !occupied.includes(card));
      if (candidates.length) {
        ghost.cards[index] = candidates[Math.floor(random() * candidates.length)];
        return;
      }
      // Sin posiciones libres queda consumido por este jugador, sin otro uso.
    }
    ghost.owners[index] = id;
  }
  function owns(ghost, playerId) {
    const id = String(playerId);
    return !!ghost && ghost.owners.includes(id) && !ghost.used.includes(id);
  }
  function available(ghost, playerId, timelineSize, handSize) {
    return owns(ghost, playerId) && timelineSize >= 5 && handSize > 0
      && !ghost.pending.length && !ghost.cooldown.length;
  }
  function activate(ghost, playerId, order) {
    const ids = order.map(String), id = String(playerId), at = ids.indexOf(id);
    ghost.used.push(id);
    ghost.pending = [...ids.slice(at), ...ids.slice(0, at)];
    ghost.actor = id;
    ghost.fresh = true;
  }
  function advance(ghost, playerId, order) {
    if (!ghost) return;
    const id = String(playerId);
    ghost.fresh = false;
    if (ghost.pending.length) {
      ghost.pending = ghost.pending.filter(p => p !== id);
      if (!ghost.pending.length) ghost.cooldown = order.map(String);
    } else ghost.cooldown = ghost.cooldown.filter(p => p !== id);
  }
  function remove(ghost, playerId, order) {
    if (!ghost) return;
    const wasActive = ghost.pending.length > 0;
    ghost.pending = ghost.pending.filter(p => p !== String(playerId));
    ghost.cooldown = ghost.cooldown.filter(p => p !== String(playerId));
    if (wasActive && !ghost.pending.length) ghost.cooldown = order.map(String);
    // No se resucita el poder de quien se marcha ni se entrega al robar su descarte.
  }
  function hiddenCard(card) {
    return `<article class="timeline-card ghost-card" data-id="${card.id}"><div class="card-visual"><span aria-hidden="true">◌</span><small>Fantasma</small></div><div class="card-content"><div class="year ghost-value" aria-label="Valor oculto">— —</div><h3>${CT.escapeHtml(card.title)}</h3><p>Valor y explicación ocultos durante esta jugada.</p></div></article>`;
  }
  function banner(ghost, players) {
    if (!ghost?.pending.length) return "";
    const actor = players.find(p => String(p.id) === ghost.actor)?.name || "Un jugador";
    return `<div class="ghost-banner" role="status"><span aria-hidden="true">◌</span><div><b>${CT.escapeHtml(actor)} ha activado Fantasma</b><small>Valores ocultos · ${ghost.pending.length} ${ghost.pending.length === 1 ? "turno restante" : "turnos restantes"}</small></div></div>`;
  }
  function power(ghost, id, size, handSize, action, enabled = true) {
    if (!owns(ghost, id)) return "";
    const ready = enabled && available(ghost, id, size, handSize);
    const hint = size < 5 ? "Disponible con 5 cartas en el tablero" : ghost.pending.length ? "Ya hay un Fantasma activo" : ghost.cooldown.length ? "Espera una vuelta con valores visibles" : "Oculta los valores durante una vuelta";
    return `<button class="ghost-power" ${action} ${ready ? "" : "disabled"}><span aria-hidden="true">◌</span><span><b>Carta Fantasma</b><small>${hint}</small><small>No cuenta para ganar · un uso</small></span></button>`;
  }
  function createPowers(deck, count, handSize, ghostEnabled = true, pulseEnabled = false, random = Math.random) {
    const each = Math.min(3, Math.ceil(count / 3));
    const types = [...(ghostEnabled ? Array(each).fill("ghost") : []), ...(pulseEnabled ? Array(each).fill("pulse") : [])];
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    const cards = choose(deck, count, handSize, types.length, random);
    const byType = type => cards.filter((_, i) => types[i] === type);
    const ghostCards = byType("ghost"), pulseCards = byType("pulse");
    return {
      ghost: ghostEnabled ? { distribution: 2, cards: ghostCards, owners: ghostCards.map(() => ""), used: [], pending: [], cooldown: [], actor: "", fresh: false } : null,
      pulsePower: pulseEnabled ? { distribution: 2, cards: pulseCards, owners: pulseCards.map(() => ""), used: [] } : null
    };
  }
  function claimPowers(state, cardId, playerId, remainingDeck = [], random = Math.random) {
    if (state?.ghost?.cards.includes(cardId)) claim(state.ghost, cardId, playerId, remainingDeck, random, state.pulsePower?.cards || []);
    else if (state?.pulsePower?.cards.includes(cardId)) claim(state.pulsePower, cardId, playerId, remainingDeck, random, state.ghost?.cards || []);
  }
  function ownsPulse(pulsePower, playerId) { return owns(pulsePower, playerId); }
  function consumePulse(pulsePower, playerId) {
    if (pulsePower && ownsPulse(pulsePower, playerId)) pulsePower.used.push(String(playerId));
  }
  function pulsePower(pulse, id, handSize, action, enabled = true) {
    if (!ownsPulse(pulse, id)) return "";
    const ready = enabled && handSize >= 2;
    const hint = handSize < 2 ? "Necesitas dos cartas normales para lanzarlo" : "Duelo: una carta del mazo la colocáis los dos";
    return `<button class="ghost-power pulse-power" ${action} ${ready ? "" : "disabled"}><span aria-hidden="true">ϟ</span><span><b>Carta Pulso</b><small>${hint}</small><small>No cuenta para ganar · un uso</small></span></button>`;
  }
  function level(key) { return LEVELS[key] || LEVELS.easy; }
  // Las cuatro dificultades como tarjetas: en cada una, en lenguaje llano, el tiempo por
  // carta, qué le pasa a la línea al acertar y si las cifras se ven.
  function difficultyCards(name, selected = "easy") {
    const linea = n => n ? `Cada acierto añade ${n} ${n === 1 ? "carta" : "cartas"} a la línea` : "La línea no se complica";
    const cifras = { never: "Cifras a la vista", sometimes: "Cifras ocultas a veces", always: "Cifras siempre ocultas" };
    const icon = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    const clock = icon('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3M19 5l2 2"/>');
    const cards = icon('<rect x="4" y="7" width="11" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3M7 14h5M9.5 11.5v5"/>');
    const eye = icon('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>');
    const hiddenEye = icon('<path d="m3 3 18 18M9.5 6.3A12 12 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.5M6 7.5A17 17 0 0 0 2 12s3.5 6 10 6a12 12 0 0 0 4-.7"/>');
    const check = icon('<path d="m6 12 4 4 8-8"/>');
    return `<fieldset class="field difficulty-field difficulty-cards"><legend class="field-label">Dificultad</legend><div class="difficulty-grid">${Object.entries(LEVELS).map(([key, info], index) => `<label class="difficulty-card${key === selected ? " is-on" : ""}" data-difficulty="${key}">
      <input type="radio" name="${name}" value="${key}"${key === selected ? " checked" : ""}>
      <div class="difficulty-art" aria-hidden="true"><img src="assets/difficulty-${key}-v1.webp" alt="" width="480" height="320" decoding="async"></div>
      <div class="difficulty-heading"><small class="difficulty-level" aria-hidden="true">${["I", "II", "III", "IV"][index]}</small><b>${info.name}</b><i class="difficulty-mark" aria-hidden="true">${check}</i></div>
      <div class="difficulty-details">
        <span>${clock}<em>${info.seconds ? `${info.seconds} s por carta` : "Sin tiempo"}</em></span>
        <span>${cards}<em>${linea(info.extra)}</em></span>
        <span>${info.hidden === "never" ? eye : hiddenEye}<em>${cifras[info.hidden]}</em></span>
      </div>
    </label>`).join("")}</div></fieldset>`;
  }
  // Se sortea una carta Fantasma por bloque de cuatro turnos a partir del cuarto.
  // Hay al menos un turno normal entre efectos, sin temporizadores ni sorteos al
  // repintar: el calendario entero queda guardado con la partida.
  function soloSchedule(turns, random = Math.random) {
    const schedule = [];
    for (let start = 3; start < turns; start += 4) {
      const slot = start + Math.floor(random() * Math.min(4, turns - start));
      if (slot > (schedule.at(-1) ?? -2) + 1 && random() < 0.7) schedule.push(slot);
    }
    return schedule;
  }
  CT.Ghost = { create, claim, owns, available, activate, advance, remove, hiddenCard, banner, power, level, difficultyCards, soloSchedule, LEVELS };
  // ¿Tiene esta persona un poder por usar (Fantasma o Pulso)? Sirve para avisar cuando le llega uno.
  function holds(state, playerId) { return owns(state?.ghost, playerId) || ownsPulse(state?.pulsePower, playerId); }
  CT.Powers = { create: createPowers, claim: claimPowers, ownsPulse, consumePulse, pulsePower, holds };
})();
