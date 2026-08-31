// Reglas compartidas de Fantasma y dificultad. No introduce cartas con valores
// falsos: los poderes acompañan a robos normales y viven fuera de las manos.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const LEVELS = {
    easy: { name: "Fácil", extra: 0, description: "Valores visibles. Sin cartas automáticas." },
    normal: { name: "Normal", extra: 1, description: "Valores visibles. Una carta automática por turno." },
    hard: { name: "Difícil", extra: 2, description: "Dos cartas automáticas y turnos Fantasma ocasionales." },
    expert: { name: "Experto", extra: 2, description: "Dos cartas automáticas. Tablero siempre oculto." }
  };

  // Siempre ceil(P/3) poderes, máximo 3. Cada posición elegible pesa
  // 0.5/N + (está entre las primeras 12*P ? 0.5/W : 0), con W=min(N,12*P).
  // Es la mezcla 50/50 entre todo el mazo y la zona inicial, sin reemplazo:
  // también puede tocar la última carta. N excluye la que inicia el tablero.
  function create(deck, count, handSize, random = Math.random) {
    const dealt = count * handSize;
    const eligible = deck.filter((_, i) => i !== dealt);
    const windowSize = Math.min(eligible.length, 12 * count);
    const slots = eligible.map((id, i) => ({ id, weight: 0.5 / eligible.length + (i < windowSize ? 0.5 / windowSize : 0) }));
    const chosen = [];
    const amount = Math.min(slots.length, 3, Math.ceil(count / 3));
    for (let n = 0; n < amount; n++) {
      let pick = random() * slots.reduce((sum, slot) => sum + slot.weight, 0);
      let at = 0;
      while (at < slots.length - 1 && (pick -= slots[at].weight) >= 0) at++;
      chosen.push(slots.splice(at, 1)[0].id);
    }
    return { distribution: 2, cards: chosen, owners: chosen.map(() => ""), used: [], pending: [], cooldown: [], actor: "", fresh: false };
  }

  function claim(ghost, cardId, playerId, remainingDeck = [], random = Math.random) {
    if (!ghost) return;
    const index = ghost.cards.indexOf(cardId);
    if (index < 0 || ghost.owners[index]) return;
    const id = String(playerId);
    if (ghost.distribution === 2 && ghost.owners.includes(id)) {
      const candidates = remainingDeck.filter(card => !ghost.cards.includes(card));
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
  function level(key) { return LEVELS[key] || LEVELS.easy; }
  function difficultySelect(id, selected = "easy") {
    return `<div class="field difficulty-field"><label for="${id}">Dificultad</label><select id="${id}">${Object.entries(LEVELS).map(([key, info]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${info.name}</option>`).join("")}</select><p class="hint" data-difficulty-help>${level(selected).description}</p></div>`;
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
  CT.Ghost = { create, claim, owns, available, activate, advance, remove, hiddenCard, banner, power, level, difficultySelect, soloSchedule, LEVELS };
})();
