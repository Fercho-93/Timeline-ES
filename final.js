// Final numérica compartida. Los enteros escalados evitan falsos desempates por
// redondeo decimal (por ejemplo, dos cifras equidistantes de 0,3 kg).
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const units = {time:'años', mass:'kg', lifespan:'años', speed:'km/h', area:'km²', population:'habitantes', distance:'km'};
  function factor(mode) {
    const axis = CT.mode(mode).axis;
    return ['time','population'].includes(axis) ? 1 : axis === 'mass' ? 1e9 : 1e6;
  }
  function parse(mode, raw, bc = false) {
    const text = String(raw).trim().replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw Error('Escribe una cifra sin separadores de miles. Puedes usar coma decimal.');
    let value = Number(text);
    if (bc) value = -Math.abs(value);
    if (CT.mode(mode).axis !== 'time' && value < 0) throw Error('La cifra no puede ser negativa.');
    const scaled = value * factor(mode), rounded = Math.round(scaled);
    if (!Number.isSafeInteger(rounded) || Math.abs(rounded) > 4e15 || Math.abs(scaled - rounded) > 1e-6) throw Error('La cifra es demasiado grande o tiene demasiados decimales.');
    return rounded;
  }
  function create(mode, players, previous = null, exposed = []) {
    const cards = CT.cards(mode);
    const used = previous?.used || [];
    let pool = cards.filter(card => !used.includes(card.id) && !exposed.includes(card.id));
    if (!pool.length) pool = cards.filter(card => !used.includes(card.id));
    if (!pool.length) pool = cards.filter(card => card.id !== previous?.cardId);
    if (!pool.length) pool = cards;
    if (!pool.length) throw Error('No hay cartas para la final.');
    const card = CT.shuffle(pool)[0];
    const target = Math.round(CT.sortValue(mode, card) * factor(mode));
    if (!Number.isSafeInteger(target)) throw Error('Valor de carta fuera de rango.');
    return {round:(previous?.round || 0) + 1, players:[...players], cardId:card.id, target, submitted:[], used:used.includes(card.id) ? [card.id] : [...used, card.id]};
  }
  function rank(final, answers) {
    const rows = final.players.map(uid => {
      if (!Number.isSafeInteger(answers[uid])) throw Error('Faltan respuestas.');
      return {uid, answer:answers[uid], distance:Math.abs(answers[uid] - final.target)};
    });
    const best = Math.min(...rows.map(row => row.distance));
    return {rows, winners:rows.filter(row => row.distance === best).map(row => row.uid)};
  }
  function value(mode, scaled) {
    return `${new Intl.NumberFormat('es-ES', {maximumFractionDigits:9}).format(scaled / factor(mode))} ${units[CT.mode(mode).axis]}`;
  }
  function question(mode, final) {
    const card = CT.cards(mode).find(card => card.id === final.cardId);
    return `<article class="panel final-card"><small>Carta neutral · Final ${final.round}</small><h2>${CT.escapeHtml(card.title)}</h2><p>¿Cuál es su cifra en ${units[CT.mode(mode).axis]}?</p></article>`;
  }
  function form(mode, attribute) {
    return `<form ${attribute} class="panel final-form"><div class="field"><label for="final-guess">Tu cifra secreta (${units[CT.mode(mode).axis]})</label><input id="final-guess" name="guess" inputmode="decimal" type="text" autocomplete="off" required aria-describedby="final-number-hint"></div>
      ${CT.mode(mode).axis === 'time' ? '<div class="field"><label for="final-era">Era</label><select id="final-era" name="era"><option value="ad">d. C.</option><option value="bc">a. C.</option></select></div>' : ''}
      <p id="final-number-hint" class="hint">Sin separadores de miles. Admite coma decimal. Tras enviarla no podrás cambiarla.</p><button class="btn btn-primary btn-block" type="submit">Guardar respuesta secreta</button></form>`;
  }
  function results(mode, final, answers, name) {
    const ranked = rank(final, answers);
    return `<section class="panel final-results"><h2>Valor real: ${value(mode, final.target)}</h2><table><thead><tr><th>Finalista</th><th>Respuesta</th><th>Diferencia</th></tr></thead><tbody>${ranked.rows.map(row => `<tr${ranked.winners.includes(row.uid) ? ' class="final-best"' : ''}><th>${CT.escapeHtml(name(row.uid))}</th><td>${value(mode, row.answer)}</td><td>${value(mode, row.distance)}</td></tr>`).join('')}</tbody></table><p>${ranked.winners.length === 1 ? `${CT.escapeHtml(name(ranked.winners[0]))} gana la final.` : `Empate: ${ranked.winners.map(uid => CT.escapeHtml(name(uid))).join(', ')} pasan a otra carta.`}</p></section>`;
  }
  CT.Final = {factor, parse, create, rank, value, question, form, results};
})();
