// Final numérica compartida. Los enteros escalados evitan falsos desempates por
// redondeo decimal (por ejemplo, dos cifras equidistantes de 0,3 kg).
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  // La unidad sale del eje del mazo, la misma con la que responde el duelo de cifras: una
  // tabla propia aquí se quedó sin Idiomas («Tu cifra secreta (undefined)»). Solo las
  // fechas cambian de forma, porque la pregunta va en plural: «¿Cuál es su cifra en años?».
  const unit = mode => CT.mode(mode).axis === 'time' ? 'años' : CT.axis(mode).cifra.unidad;
  function factor(mode) {
    const axis = CT.mode(mode).axis;
    return ['time','population'].includes(axis) ? 1 : axis === 'mass' ? 1e9 : 1e6;
  }
  // La cifra se escribe igual que en el minijuego de quién empieza (`CT.Duelo.Cifras`): con la unidad
  // detrás («47 millones», «300 g») y, en las fechas, el botón «a. C.», que pone el menos delante.
  // `bc` es el selector de era de las versiones anteriores del formulario.
  function parse(mode, raw, bc = false) {
    const value = CT.Duelo.Cifras.leer(mode, raw);
    if (value === null) throw Error(CT.mode(mode).axis === 'time'
      ? 'Escribe el año. Para los anteriores a Cristo, toca «a. C.».'
      : 'Escribe una cifra. Puedes tocar la unidad para no escribir tantos ceros.');
    const signed = bc ? -Math.abs(value) : value;
    if (CT.mode(mode).axis !== 'time' && signed < 0) throw Error('La cifra no puede ser negativa.');
    const scaled = signed * factor(mode), rounded = Math.round(scaled);
    if (!Number.isSafeInteger(rounded) || Math.abs(rounded) > 4e15 || Math.abs(scaled - rounded) > 1e-6) throw Error('La cifra es demasiado grande o tiene demasiados decimales.');
    return rounded;
  }
  // `exposed` son las cartas cuyo valor ya se ha visto en la partida: la línea, el descarte (una carta
  // fallada se enseña al fallarla) y la del minijuego de quién empieza. La final no repite ninguna
  // mientras quede otra carta; si el mazo no da para más, se aparta al menos la de la ronda anterior.
  function create(mode, players, previous = null, exposed = []) {
    const cards = CT.cards(mode);
    const used = previous?.used || [];
    const seen = new Set(exposed.map(String));
    let pool = cards.filter(card => !used.includes(card.id) && !seen.has(String(card.id)));
    if (!pool.length) pool = cards.filter(card => !seen.has(String(card.id)) && card.id !== previous?.cardId);
    if (!pool.length) pool = cards.filter(card => card.id !== previous?.cardId);
    if (!pool.length) pool = cards;
    if (!pool.length) throw Error('No hay cartas para la final.');
    const card = CT.shuffle(pool)[0];
    const target = Math.round(CT.sortValue(mode, card) * factor(mode));
    if (!Number.isSafeInteger(target)) throw Error('Valor de carta fuera de rango.');
    return {round:(previous?.round || 0) + 1, players:[...players], cardId:card.id, target, submitted:[], used:used.includes(card.id) ? [card.id] : [...used, card.id]};
  }
  // La cifra correcta sale siempre de la carta. En una sala online la escribe quien abre la
  // final y las reglas no pueden recalcularla (los valores viven en el cliente): cada móvil
  // comprueba que coincide antes de dar la final por buena.
  function targetOf(mode, cardId) {
    const card = CT.cards(mode).find(item => item.id === cardId);
    if (!card) return null;
    const target = Math.round(CT.sortValue(mode, card) * factor(mode));
    return Number.isSafeInteger(target) ? target : null;
  }
  const valid = (mode, final) => !!final && Number.isSafeInteger(final.target) && targetOf(mode, final.cardId) === final.target;
  function rank(final, answers) {
    const rows = final.players.map(uid => {
      if (!Number.isSafeInteger(answers[uid])) throw Error('Faltan respuestas.');
      return {uid, answer:answers[uid], distance:Math.abs(answers[uid] - final.target)};
    });
    const best = Math.min(...rows.map(row => row.distance));
    return {rows, winners:rows.filter(row => row.distance === best).map(row => row.uid)};
  }
  function value(mode, scaled) {
    return `${new Intl.NumberFormat('es-ES', {maximumFractionDigits:9}).format(scaled / factor(mode))} ${unit(mode)}`;
  }
  function question(mode, final) {
    const card = CT.cards(mode).find(card => card.id === final.cardId);
    return `<article class="panel final-card starter-presentation cifra-presentation">${CT.StarterPresentation.plate(mode, card, false, {heading: true, kicker: `Carta neutral · Final ${final.round}`, question: `¿Cuál es su cifra en ${unit(mode)}?`})}</article>`;
  }
  // El mismo campo que el minijuego de quién empieza, con sus botones de unidad (y «a. C.» en las
  // fechas), dentro de un formulario que se envía una sola vez.
  function form(mode, attribute) {
    const field = CT.StarterPresentation.answer(mode, 'final-guess', {attrs: 'name="guess" required', hintId: 'final-number-hint', describedBy: 'final-number-hint final-lock-hint'})
      .replace(/<label for="final-guess">[\s\S]*?<\/label>/, `<label for="final-guess">Tu cifra secreta (${unit(mode)})</label>`);
    return `<form ${attribute} class="panel final-form starter-presentation cifra-presentation">${field}
      <p id="final-lock-hint" class="hint">Tras enviarla no podrás cambiarla.</p><button class="btn btn-primary btn-block" type="submit">Guardar respuesta secreta</button></form>`;
  }
  function results(mode, final, answers, name) {
    const ranked = rank(final, answers);
    return `<section class="panel final-results"><h2>Valor real: ${value(mode, final.target)}</h2><table><thead><tr><th>Finalista</th><th>Respuesta</th><th>Diferencia</th></tr></thead><tbody>${ranked.rows.map(row => `<tr${ranked.winners.includes(row.uid) ? ' class="final-best"' : ''}><th>${CT.escapeHtml(name(row.uid))}</th><td>${value(mode, row.answer)}</td><td>${value(mode, row.distance)}</td></tr>`).join('')}</tbody></table><p>${ranked.winners.length === 1 ? `${CT.escapeHtml(name(ranked.winners[0]))} gana la final.` : `Empate: ${ranked.winners.map(uid => CT.escapeHtml(name(uid))).join(', ')} pasan a otra carta.`}</p></section>`;
  }
  // La frase bajo «X gana» al terminar, igual en un solo móvil, en la sala online y por Wi-Fi.
  // `quedan` es cuánta gente sigue en la mesa: si los demás se marcharon, no ganó por cartas.
  function verdict({ ganadores, final, quedan }) {
    if (final) return ganadores > 1 ? "Han empatado en la final con la misma diferencia." : "Ha ganado la final con la cifra más cercana.";
    if (quedan === 1) return "Es la última persona que queda en la partida.";
    return ganadores > 1 ? "Han terminado la vuelta empatadas sin cartas." : "Ha sido la única persona en terminar la vuelta sin cartas.";
  }
  CT.Final = {factor, parse, create, rank, value, question, form, results, targetOf, valid, verdict};

  // El minijuego de quién empieza, igual en todas las modalidades con turnos: cada
  // persona escribe la cifra de la misma carta, empieza quien más se acerque y el resto
  // juega por orden de cercanía. En años y siglos el error se mide en unidades (errar un
  // siglo pesa igual en el año 200 que en el 1900); en el resto, en proporción (errar 100
  // habitantes no es lo mismo en un pueblo que en una capital).
  function starterError(mode, card, guess) {
    const real = CT.sortValue(mode, card);
    const anos = !!CT.axis(mode).cifra?.anos;
    return anos || real === 0 ? Math.abs(guess - real) : Math.abs(guess - real) / Math.abs(real);
  }
  // `entries` va en el orden de la mesa: [{id, value}] con `value` null si esa persona no
  // respondió (por ejemplo, en una mesa pública en la que se agotó el tiempo). Devuelve
  // los identificadores de más cerca a más lejos; a igual distancia se respeta el orden
  // de la mesa, y quien no respondió va al final.
  function starterOrder(mode, cardId, entries) {
    const card = CT.cards(mode).find(item => item.id === cardId);
    const rows = entries.map((entry, seat) => ({ id: entry.id, seat,
      error: card && Number.isFinite(entry.value) ? starterError(mode, card, entry.value) : Infinity }));
    return rows.sort((a, b) => a.error - b.error || a.seat - b.seat).map(row => row.id);
  }
  CT.Starter = { error: starterError, order: starterOrder };
})();
