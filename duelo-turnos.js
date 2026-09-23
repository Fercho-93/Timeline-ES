// Duelo por turnos entre dos móviles. El documento de la partida es la autoridad:
// el cliente solo puede escribir la jugada del turno que le corresponde.
import { auth, db } from './firebase-client.js';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const TURN_SECONDS = 15;
const READY_SECONDS = 3;
const INACTIVE_DAYS = 7;
const ended = game => ['finished', 'cancelled', 'expired', 'resigned'].includes(game.status);
const inactive = game => !ended(game) && game.updatedAt?.seconds && Date.now() - game.updatedAt.seconds * 1000 >= INACTIVE_DAYS * 86400000;
const asVisible = game => inactive(game) ? { ...game, status: 'expired', turnUid: null, resultText: 'Duelo caducado tras siete días sin actividad.' } : game;
let cachedGames = [], busy = false;
let prepareUntil = 0, preparingTurn = null, awaitingReady = false;
let archivedIds = new Set(), blockedPlayers = new Map();
const sending = new Set();
let retryTimer = null, delivery = '';
const TOTAL = CT.Duelo.CARTAS;
let stop = null, current = null, onBack = null, timer = null, enteredAt = 0, shareLink = '', pendingIndex = null;

const safe = value => CT.escapeHtml(String(value ?? ''));
const uid = () => auth.currentUser?.uid || CT.Accounts?.user?.uid;
const alias = () => CT.Accounts?.profile?.alias || 'Explorador';
const id = () => crypto.randomUUID().replaceAll('-', '');
function notify(text) {
  const toast = document.getElementById('toast');
  if (toast) { toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') new Notification('Continuum', { body: text });
}
function leaveGuard() {
  if (current?.turnUid === uid() && enteredAt && Date.now() - enteredAt >= TURN_SECONDS * 1000) expireTurn();
}
function deckCards(game) {
  const deck = CT.cards(game.mode), byId = new Map(deck.map(card => [String(card.id), card]));
  const dealt = game.kind === 'cifras' ? CT.Duelo.Cifras.reparto(game.mode, game.seed, game.total) : CT.Duelo.reparto(game.mode, game.seed, game.total);
  return dealt.map(item => byId.get(String(item?.id ?? item))).filter(Boolean);
}
function localCard(game) { const cards = deckCards(game); return cards[game.turnIndex + (game.kind === 'orden' ? 1 : 0)]; }
function timelineCards(game) {
  const byId = new Map(CT.cards(game.mode).map(card => [String(card.id), card]));
  const ids = game.timeline?.length ? game.timeline : game.kind === 'orden' ? [deckCards(game)[0]?.id] : [];
  return ids.map(item => byId.get(String(item))).filter(Boolean);
}
function correctPlacement(game, card, index) { const line = timelineCards(game); const value = CT.sortValue(game.mode, card); const left = line[index - 1], right = line[index]; return (!left || CT.sortValue(game.mode, left) <= value) && (!right || value <= CT.sortValue(game.mode, right)); }
function statusText(game) { return game.turnUid === uid() ? 'Es tu turno' : `Turno de ${game.players?.[game.turnUid]?.alias || 'tu oponente'}`; }
function lastMove(game) {
  const play = game.plays?.at(-1);
  if (!play) return '';
  const card = CT.cards(game.mode).find(c => String(c.id) === String(play.cardId));
  const who = game.players?.[play.uid]?.alias || 'Tu rival';
  const result = play.timeout ? 'agotó el tiempo' : game.kind === 'cifras' ? `sumó ${play.points || 0} puntos` : play.correct ? 'acertó la posición' : 'falló la posición';
  return `<aside class="turn-duel-last" aria-label="Última jugada"><b>Última jugada</b><p>${safe(who)} ${result}${card ? `: ${safe(card.title)}` : ''}.</p><small>${game.playersOrder.map(player => `${safe(game.players?.[player]?.alias || 'Jugador')}: ${game.scores?.[player] || 0}`).join(' · ')}</small></aside>`;
}
function solution(game) {
  const play = game.plays?.at(-1);
  const card = play && CT.cards(game.mode).find(c => String(c.id) === String(play.cardId));
  if (!card) return '';
  const cifras = game.kind === 'cifras', correct = cifras ? play.points > 0 : play.correct;
  const title = play.timeout ? 'Se acabó el tiempo' : cifras ? CT.Duelo.Cifras.banda(game.mode, card, play.respuesta).nombre : correct ? '¡Bien colocado!' : 'No encaja ahí';
  const line = timelineCards(game).filter(c => c.id !== card.id);
  const explanation = cifras
    ? `<p>${play.timeout ? 'Sin respuesta a tiempo.' : `Respuesta: <strong>${safe(CT.Duelo.Cifras.formato(game.mode, play.respuesta))}</strong>. Diferencia respecto al valor correcto: ${safe(Math.abs(play.respuesta - CT.sortValue(game.mode, card)).toLocaleString('es-ES', { maximumFractionDigits: 3 }))}${CT.Duelo.Cifras.regla(game.mode)?.anos ? ' años' : ' (en la unidad del mazo)'}.`}</p><p class="cifra-puntos"><b>+${Number(play.points) || 0}</b> puntos</p>`
    : !correct && !play.timeout ? `<p>${CT.placementHint?.(game.mode, line, card) || ''}</p>` : '';
  return `<details class="turn-duel-solution" ${play.uid === uid() ? 'open' : ''}><summary>Ver solución · ${safe(card.title)}</summary><div class="turn-duel-result ${correct ? 'success' : 'failure'}"><div class="result-mark" aria-hidden="true">${correct ? '✓' : '×'}</div><div class="eyebrow">${safe(title)}</div><h2>${safe(card.title)}</h2><div class="reveal">${CT.categoryBadge(game.mode, card)}${CT.Art?.button?.(game.mode, card) || ''}<div class="year">${safe(CT.formatValue(game.mode, card))}</div><p>${safe(card.detail)}</p></div>${explanation}</div></details>`;
}
function timelineCardMarkup(game, card) {
  const era = CT.eraForCard(game.mode, card), art = CT.animalArt(game.mode, card);
  const visual = art || `<span>${era.symbol}</span><small>${safe(era.name)}</small>`;
  return `<article class="timeline-card ${art ? 'animal-timeline-card' : ''}" data-id="${card.id}"><div class="card-visual era-${era.key}">${visual}</div><div class="card-content">${CT.categoryBadge(game.mode, card)}<div class="year">${safe(CT.formatValue(game.mode, card))}</div><h3>${safe(card.title)}</h3></div></article>`;
}
function orderBoard(game, card) {
  const line = timelineCards(game), slots = [];
  for (let index = 0; index <= line.length; index++) {
    if (card) slots.push(pendingIndex === index
      ? `<div class="slot-confirm"><small>Colocar aquí</small><strong>${safe(card.title)}</strong><button class="btn btn-primary btn-block" data-turn-action="confirm-place">Sí, aquí</button><button class="btn btn-ghost btn-block" data-turn-action="cancel-place">Cancelar</button></div>`
      : `<button class="slot" data-turn-action="select-slot" data-index="${index}" aria-label="Colocar en la posición ${index + 1} de ${line.length + 1}"><span>+</span></button>`);
    if (index < line.length) slots.push(timelineCardMarkup(game, line[index]));
  }
  return `<section class="turn-duel-board"><div class="hand-title"><h3>${safe(CT.timelineTitle(game.mode))}</h3><small>${line.length} ${line.length === 1 ? 'carta' : 'cartas'}</small></div>${CT.timelineMap?.(game.mode, line) || ''}<div class="timeline-wrap" tabindex="0" role="region" aria-label="Mesa de cartas, desplaza para ver más"><div class="timeline">${slots.join('')}</div></div><p class="hint">Desliza la línea para ver todas las cartas.</p></section>${card ? `<section class="turn-duel-hand"><div class="hand-title"><h3>Tu carta</h3><small>${safe(CT.hiddenLabel(game.mode))}</small></div><div class="hand hand-solo"><div class="hand-card selected" data-id="${card.id}">${CT.categoryBadge(game.mode, card)}<span class="hidden-date">${safe(CT.hiddenLabel(game.mode))}</span>${CT.cardBack(game.mode)}<strong>${safe(card.title)}</strong></div></div><p class="hint">${pendingIndex === null ? 'Toca el hueco donde quieres colocar la carta.' : 'Confirma el hueco elegido o toca otro.'}</p></section>` : ''}`;
}
function cifraBoard(game, card) { return `<section class="turn-duel-answer"><div class="cifra-card">${CT.categoryBadge(game.mode, card)}<strong>${safe(card.title)}</strong><span>${safe(CT.Duelo.Cifras.regla(game.mode)?.pregunta || 'Escribe la cifra')}</span></div><label for="turn-cifra-input">Tu respuesta</label><input id="turn-cifra-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Escribe la cifra"><button class="btn btn-primary btn-block" data-turn-action="submit-cifra">Enviar cifra</button></section>`; }
function clockMarkup(seconds) {
  return `<div class="turn-duel-clock" role="timer" aria-label="${seconds} segundos restantes"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="turn-clock-track" cx="24" cy="24" r="20"/><circle class="turn-clock-progress" cx="24" cy="24" r="20" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 * seconds / TURN_SECONDS}"/></svg><span><b id="turn-duel-seconds">${seconds}</b><small>s</small></span></div>`;
}
function updateClock() {
  const seconds = Math.max(0, Math.ceil((TURN_SECONDS * 1000 - (Date.now() - enteredAt)) / 1000));
  const clock = document.querySelector('.turn-duel-clock');
  if (clock) {
    clock.querySelector('b').textContent = seconds;
    clock.setAttribute('aria-label', `${seconds} segundos restantes`);
    clock.classList.toggle('is-urgent', seconds <= 5);
    clock.querySelector('.turn-clock-progress').setAttribute('stroke-dashoffset', String(100 * seconds / TURN_SECONDS));
  }
  if (seconds <= 0) { clearInterval(timer); expireTurn(); }
}
async function share() {
  if (!current) return;
  const link = shareLink || `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${current.id}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Duelo por turnos en Continuum', text: 'Únete a mi duelo por turnos en Continuum', url: link }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(link); notify('Enlace copiado. Ya puedes enviárselo a tu rival.'); }
  catch { document.querySelector('.turn-duel-share details')?.setAttribute('open', ''); notify('Copia el enlace que aparece en la invitación.'); }
}
async function reshare(gameId) {
  const link = `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${gameId}`;
  if (navigator.share) { try { await navigator.share({ title: 'Duelo en Continuum', url: link }); return; } catch (error) { if (error.name === 'AbortError') return; } }
  await navigator.clipboard.writeText(link);
  notify('Enlace copiado. La invitación es la misma, no se crea otro duelo.');
}
function render() {
  if (!current) return;
  const app = document.getElementById('app');
  const sameGame = app.querySelector('.turn-duel-shell')?.dataset.duelId === current.id;
  const oldWrap = app.querySelector('.timeline-wrap');
  const oldLeft = sameGame ? oldWrap?.scrollLeft || 0 : 0;
  const oldTop = sameGame ? window.scrollY : 0;
  const focused = document.activeElement;
  const oldInput = app.querySelector('#turn-cifra-input');
  const inputValue = oldInput?.value;
  const sameTurn = app.querySelector('.turn-duel-shell')?.dataset.turn === String(current.turnIndex);
  const mine = current.turnUid === uid();
  const elapsed = enteredAt ? Math.max(0, TURN_SECONDS - Math.floor((Date.now() - enteredAt) / 1000)) : TURN_SECONDS;
  const preparing = mine && current.status === 'playing' && Date.now() < prepareUntil;
  const pending = pendingMove(current.id);
  const card = mine && !current.timeout && !preparing && !awaitingReady && !pending ? localCard(current) : null;
  const waiting = current.status === 'waiting';
  const kindLabel = current.kind === 'cifras' ? 'Escribir la cifra' : 'Ordenar las cartas';
  const rival = current.players?.[current.playersOrder?.find(x => x !== uid())]?.alias || '';
  const finished = ended(current);
  const active = mine && !waiting && !finished && !current.timeout && !preparing && !awaitingReady && !pending;
  const heading = finished ? current.status === 'expired' ? 'Duelo caducado' : current.status === 'cancelled' ? 'Duelo cerrado' : 'Duelo terminado' : waiting ? current.invitedUid ? current.invitedUid === uid() ? 'Te han retado' : 'Reto enviado' : 'Invita a tu rival' : statusText(current);
  const waitingHint = current.invitedUid ? 'La invitación se acepta desde el perfil, sin compartir enlaces.' : 'Comparte el enlace para empezar vuestra partida.';
  const link = shareLink || `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${current.id}`;
  const nextTargets = cachedGames.filter(game => game.id !== current.id && game.status === 'playing' && game.turnUid === uid());
  const html = `<div class="shell turn-duel-shell" data-duel-id="${safe(current.id)}" data-turn="${current.turnIndex}">
    <nav class="turn-duel-nav" aria-label="Duelo"><span>CONTINUUM <small>Duelo por turnos</small></span><button class="btn btn-ghost" data-turn-action="back">Volver</button></nav>
    <section class="turn-duel-screen">
      <header class="turn-duel-heading"><div><div class="eyebrow">${safe(kindLabel)}</div><h1 data-focus tabindex="-1">${safe(heading)}</h1><p>${waiting ? waitingHint : finished ? 'Así queda vuestra partida.' : `Carta ${Math.min(current.turnIndex + 1, current.total)} de ${current.total}${rival ? ` · Contra ${safe(rival)}` : ''}`}</p></div>${active ? clockMarkup(elapsed) : ''}</header>
      <div class="turn-duel-scores" aria-label="Marcador">${current.playersOrder.map((player, index) => { const name = current.players?.[player]?.alias || 'Jugador'; const mine = player === uid(); const activePlayer = current.turnUid === player; return `<div class="turn-duel-player ${activePlayer ? 'is-active' : ''} ${mine ? 'is-you' : ''}" data-player="${safe(player)}"><span class="turn-duel-avatar" aria-hidden="true">${safe(name.trim().charAt(0).toUpperCase() || '?')}</span><span class="turn-duel-player-info"><strong>${safe(name)}</strong><small>${mine ? 'Tú' : index === 1 ? 'Rival' : 'Jugador'}</small></span><span class="turn-duel-score"><b>${current.scores?.[player] || 0}</b><small>${current.kind === 'cifras' ? 'puntos' : 'aciertos'}</small></span>${activePlayer ? '<span class="turn-duel-turn-badge">Turno</span>' : ''}</div>`; }).join('')}</div>
      ${waiting ? current.invitedUid ? `<div class="panel turn-duel-share"><h2>${current.invitedUid === uid() ? 'Te han retado' : `Reto enviado a ${safe(current.invitedAlias || 'tu rival')}`}</h2><p>${current.invitedUid === uid() ? 'Mismo mazo y modalidad. Cartas nuevas para otra partida.' : 'La invitación ya aparece en su perfil. No necesitas enviar otro enlace.'}</p>${current.invitedUid === uid() ? '<button class="btn btn-primary" data-turn-action="accept">Aceptar el duelo</button><button class="btn btn-ghost" data-turn-action="decline">Rechazar</button>' : ''}</div>` : `<div class="panel turn-duel-share"><span class="turn-duel-share-icon" aria-hidden="true">↗</span><h2>Una partida, dos móviles</h2><p>Envía la invitación por WhatsApp, mensaje o la aplicación que prefieras.</p><button class="btn btn-primary btn-block" data-turn-action="share">Compartir el duelo</button><details><summary>Ver enlace de invitación</summary><code>${safe(link)}</code></details><small>La partida empezará cuando se una tu rival.</small></div>` : ''}
      ${lastMove(current)}
      ${!active && !preparing ? solution(current) : ''}
      ${pending ? `<div class="turn-duel-status" role="status"><b>${sending.has(pending.operationId) ? 'Enviando jugada…' : 'Jugada guardada en este móvil, pendiente de confirmar'}</b><p>No vuelvas a jugar esta carta. Se enviará al recuperar la conexión, sin cambiar tu respuesta ni tu tiempo.</p>${delivery ? `<p>${safe(delivery)}</p>` : ''}<button class="btn btn-secondary" data-turn-action="retry">Comprobar y reintentar</button></div>` : delivery ? `<p class="turn-duel-status" role="status">${safe(delivery)}</p>` : ''}
      ${awaitingReady && mine && !finished && !pending ? '<div class="panel turn-duel-intro"><h2>Cuando tú estés listo</h2><p>Revisa el marcador y la última jugada. Tu carta sigue oculta.</p><button class="btn btn-primary btn-block" data-turn-action="ready">Estoy listo</button><small>3 segundos de preparación y después 15 para responder. Volver a entrar no reinicia una carta ya abierta.</small></div>' : ''}
      ${preparing ? `<div class="turn-duel-ready" role="status"><b id="turn-ready-seconds">${Math.ceil((prepareUntil - Date.now()) / 1000)}</b><h2>Prepárate</h2><p>La carta aparecerá al terminar la cuenta. Después tendrás 15 segundos.</p></div>` : ''}
      ${!waiting && !finished && !mine ? '<p class="turn-duel-status" role="status">Tu rival está jugando. La mesa se actualizará automáticamente.</p>' : ''}
      ${!waiting && current.kind === 'orden' ? orderBoard(current, active ? card : null) : ''}
      ${active && current.kind === 'cifras' && card ? cifraBoard(current, card) : ''}
      ${active && !card ? '<p role="alert">No se pudo cargar la carta. Actualiza Continuum en los dos móviles.</p>' : ''}
      ${finished ? `<p class="turn-duel-status">${safe(current.resultText || 'Gracias por jugar.')}</p>` : ''}
      ${!active && !preparing && (finished || nextTargets.length) ? `<div class="turn-duel-actions">${finished && current.playersOrder.length === 2 ? '<button class="btn btn-primary" data-turn-action="rematch">Revancha</button>' : ''}${nextTargets.length ? `<button class="btn btn-secondary" data-turn-action="next" aria-label="Abrir otro duelo pendiente">Ir al siguiente duelo pendiente <small>(${nextTargets.length})</small></button>` : ''}${finished && !nextTargets.length ? '<button class="btn btn-secondary" data-turn-action="back">Volver a mis duelos</button>' : ''}</div>` : ''}
      ${!finished ? '<p class="hint">Un recordatorio tras 48 horas. Caduca a los 7 días sin actividad.</p>' : ''}
    </section></div>`;
  app.dataset.screen = 'turn-duel';
  app.innerHTML = html;
  CT.applyTimelineZoom?.(app);
  const wrap = app.querySelector('.timeline-wrap');
  if (wrap) wrap.scrollLeft = oldLeft;
  const input = app.querySelector('#turn-cifra-input');
  if (sameTurn && input && inputValue !== undefined) {
    input.value = inputValue;
    if (focused === oldInput) input.focus({ preventScroll: true });
  }
  if (focused?.dataset.turnAction === 'select-slot') app.querySelector('[data-turn-action="confirm-place"]')?.focus({ preventScroll: true });
  window.scrollTo({ left: 0, top: oldTop, behavior: 'instant' });
  clearInterval(timer);
  if (preparing) timer = setInterval(() => {
    const left = Math.max(0, Math.ceil((prepareUntil - Date.now()) / 1000));
    const counter = document.getElementById('turn-ready-seconds');
    if (counter) counter.textContent = left;
    if (!left) { render(); updateClock(); }
  }, 100);
  else if (active) timer = setInterval(updateClock, 250);
}
async function expireTurn() {
  if (!current || current.turnUid !== uid() || current.status !== 'playing' || awaitingReady || pendingMove(current.id)) return;
  return queueMove({ timeout: true, ms: TURN_SECONDS * 1000 });
}
async function place(index) {
  if (!Number.isInteger(index) || index < 0 || !current || index > timelineCards(current).length) return;
  return queueMove({ index });
}
async function submitCifra() {
  if (!current || current.kind !== 'cifras') return;
  const value = CT.Duelo.Cifras.leer(current.mode, document.getElementById('turn-cifra-input')?.value || '');
  if (value === null) return notify('Escribe una cifra válida.');
  return queueMove({ respuesta: value });
}
const outboxKey = () => `continuum-duel-outbox-${uid()}`;
function outbox() { try { return JSON.parse(localStorage.getItem(outboxKey()) || '{}'); } catch { return {}; } }
function pendingMove(gameId) { return outbox()[gameId]; }
function savePending(gameId, move) {
  const saved = outbox();
  if (move) saved[gameId] = move; else delete saved[gameId];
  localStorage.setItem(outboxKey(), JSON.stringify(saved));
}
async function queueMove(extra) {
  if (!current || current.status !== 'playing' || current.turnUid !== uid() || awaitingReady || Date.now() < prepareUntil || !enteredAt || pendingMove(current.id)) return;
  const ms = Math.max(0, Date.now() - enteredAt);
  const move = { ...extra, ms: Math.min(ms, TURN_SECONDS * 1000), timeout: !!extra.timeout || ms >= TURN_SECONDS * 1000, gameId: current.id, turnIndex: current.turnIndex, uid: uid(), operationId: id() };
  try { savePending(current.id, move); }
  catch { return notify('No hay espacio para proteger el envío. Libera almacenamiento antes de continuar.'); }
  clearInterval(timer);
  delivery = '';
  return sendPending(move);
}
async function sendPending(move) {
  if (!move || move.uid !== uid() || sending.has(move.operationId)) return;
  sending.add(move.operationId);
  if (current?.id === move.gameId) render();
  let result;
  try {
    result = await runTransaction(db, async tx => {
      // Never use mutable current here: snapshots, navigation and retries may change it.
      const ref = doc(db, 'turnDuels', move.gameId), game = (await tx.get(ref)).data();
      if (game?.plays?.[move.turnIndex]?.operationId === move.operationId) return 'confirmed';
      if (!game || ended(game) || inactive(game) || game.turnIndex !== move.turnIndex || game.turnUid !== move.uid) return 'superseded';
      const card = localCard(game);
      if (!card) throw Error('No se pudo cargar la carta.');
      const nextIndex = game.turnIndex + 1, finished = nextIndex >= game.total;
      const play = { uid: move.uid, cardId: card.id, operationId: move.operationId, ms: move.ms, timeout: move.timeout, at: Timestamp.now() };
      let line = game.timeline || [], points = 0;
      if (game.kind === 'cifras') {
        play.respuesta = move.timeout ? 0 : move.respuesta;
        play.points = points = move.timeout ? 0 : CT.Duelo.Cifras.puntosCarta(game.mode, card, play, TURN_SECONDS * 1000);
      } else {
        play.index = move.timeout ? -1 : move.index;
        play.correct = !move.timeout && correctPlacement(game, card, move.index);
        if (play.correct) { points = 1; line = timelineCards(game).map(c => c.id); line.splice(move.index, 0, card.id); }
      }
      tx.update(ref, { plays: [...(game.plays || []), play], timeline: line, scores: { ...game.scores, [move.uid]: (game.scores?.[move.uid] || 0) + points }, turnIndex: nextIndex, turnUid: finished ? null : game.playersOrder[nextIndex % 2], status: finished ? 'finished' : 'playing', updatedAt: serverTimestamp(), resultText: finished ? 'Los dos jugadores han completado la partida.' : null });
      return 'confirmed';
    });
    // Do not delete a newer operation saved by another tab/account.
    if (move.uid === uid() && pendingMove(move.gameId)?.operationId === move.operationId) savePending(move.gameId, null);
    if (current?.id === move.gameId) delivery = result === 'confirmed' ? 'Jugada confirmada' : 'La partida ya cambió o terminó. No se ha repetido la jugada.';
  } catch (error) {
    if (current?.id === move.gameId) delivery = error.code === 'permission-denied' ? 'No se pudo confirmar el envío. Revisa los permisos o las reglas de Firebase.' : 'Esperando conexión para confirmar tu jugada.';
    if (error.code !== 'permission-denied') { clearTimeout(retryTimer); retryTimer = setTimeout(retryPending, 15000); }
  } finally {
    sending.delete(move.operationId);
    if (current?.id === move.gameId) render();
  }
}
function retryPending() { return Promise.all(Object.values(outbox()).map(sendPending)); }
window.addEventListener('online', retryPending);
async function create(mode, kind, back) {
  if (busy) return;
  busy = true;
  try {
  onBack = back;
  const existing = (await list()).find(g => g.status === 'waiting' && !g.invitedUid && g.playersOrder[0] === uid() && g.mode === mode && g.kind === kind);
  if (existing) { shareLink = ''; subscribe(existing.id); return; }
  const draftKey = `continuum-duel-draft-${uid()}-${mode}-${kind}`;
  const gameId = localStorage.getItem(draftKey) || id();
  localStorage.setItem(draftKey, gameId);
  const total = kind === 'cifras' ? CT.Duelo.Cifras.CARTAS : TOTAL;
  const seed = CT.Duelo.crearSemilla(), openingCard = kind === 'orden' ? CT.Duelo.reparto(mode, seed, total)[0] : null;
  const game = { id: gameId, mode, kind, seed, total, turnIndex: 0, turnUid: null, playersOrder: [uid()], players: { [uid()]: { alias: alias() } }, status: 'waiting', plays: [], timeline: openingCard == null ? [] : [openingCard], scores: { [uid()]: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  shareLink = `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${gameId}`;
  await runTransaction(db, async tx => { const ref = doc(db, 'turnDuels', gameId); if (!(await tx.get(ref)).exists()) tx.set(ref, game); });
  localStorage.removeItem(draftKey);
  await navigator.clipboard?.writeText(shareLink).catch(() => {}); notify('Duelo creado. Comparte el enlace con tu rival.');
  subscribe(gameId);
  } finally { busy = false; }
}
async function join(gameId, back, accept = false) {
  onBack = back;
  const ref = doc(db, 'turnDuels', gameId);
  await runTransaction(db, async tx => {
    const game = (await tx.get(ref)).data();
    if (!game) throw Error('no encontrado');
    if (game.playersOrder.includes(uid()) || ended(game) || inactive(game)) return;
    if (game.invitedUid && !accept) return;
    if (game.status !== 'waiting' || game.playersOrder.length >= 2 || (game.invitedUid && game.invitedUid !== uid())) throw Error('invitación');
    const playersOrder = [...game.playersOrder, uid()];
    tx.update(ref, { playersOrder, players: { ...game.players, [uid()]: { alias: alias() } }, scores: { ...game.scores, [uid()]: 0 }, timeline: game.kind === 'orden' && !game.timeline?.length ? [deckCards(game)[0].id] : game.timeline, status: 'playing', turnUid: playersOrder[0], updatedAt: serverTimestamp() });
  });
  subscribe(gameId);
}
function prepareTurn(start = false) {
  if (current?.status !== 'playing' || current.turnUid !== uid()) { awaitingReady = false; return; }
  const key = `continuum-turn-entry-${current.id}-${current.turnIndex}`;
  if (preparingTurn === key && !start) return;
  preparingTurn = key;
  // Persist the deadline: reopening an already revealed card never grants extra time.
  const saved = Number(localStorage.getItem(key) || sessionStorage.getItem(key));
  if (!saved && !start) { awaitingReady = true; enteredAt = 0; prepareUntil = 0; return; }
  if (!saved && navigator.onLine === false) return notify('Conéctate antes de descubrir la carta.');
  enteredAt = saved || Date.now() + READY_SECONDS * 1000;
  try { localStorage.setItem(key, String(enteredAt)); }
  catch { awaitingReady = true; enteredAt = 0; return notify('No se puede guardar el plazo en este móvil. Revisa su almacenamiento.'); }
  awaitingReady = false;
  prepareUntil = Math.max(Date.now(), enteredAt);
}
function subscribe(gameId) {
  stop?.();
  stop = onSnapshot(doc(db, 'turnDuels', gameId), snap => {
    const next = snap.data(); if (!next) return;
    const previousTurn = current?.turnIndex;
    const wasPlayingAway = current?.status === 'playing' && current.turnUid !== uid();
    current = asVisible({ ...next, id: gameId, shareLink });
    if (previousTurn !== current.turnIndex) { pendingIndex = null; delivery = ''; }
    prepareTurn();
    if (wasPlayingAway && current.turnUid === uid()) notify('Tu oponente ha colocado una carta. Te toca.');
    render();
    const pending = pendingMove(gameId);
    if (pending && !snap.metadata?.fromCache) sendPending(pending);
  }, () => notify('No se pudo sincronizar el duelo.'));
  document.addEventListener('visibilitychange', leaveGuard);
}
async function cancel(gameId, expectedStatus) {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'turnDuels', gameId), game = (await tx.get(ref)).data();
    if (!game || !(game.playersOrder.includes(uid()) || game.invitedUid === uid())) throw Error('No perteneces a este duelo.');
    if (!['waiting', 'playing'].includes(game.status)) return;
    if (expectedStatus && game.status !== expectedStatus) throw Error('La partida ha cambiado. Vuelve a revisarla antes de cerrarla.');
    const playing = game.status === 'playing';
    tx.update(ref, { status: playing ? 'resigned' : 'cancelled', turnUid: null, closedBy: uid(), ...(playing ? { winnerUid: game.playersOrder.find(player => player !== uid()) } : {}), updatedAt: serverTimestamp(), resultText: playing ? `${alias()} se ha rendido. Gana su rival.` : 'Invitación cancelada. No cuenta como derrota.' });
  });
}
async function list() {
  if (!uid()) return [];
  retryPending();
  const results = await Promise.all([
    getDocs(query(collection(db, 'turnDuels'), where('playersOrder', 'array-contains', uid()))),
    getDocs(query(collection(db, 'turnDuels'), where('invitedUid', '==', uid()))),
    getDocs(collection(db, 'duelPreferences', uid(), 'archived')),
    getDocs(collection(db, 'duelPreferences', uid(), 'blocked'))
  ]);
  archivedIds = new Set(results[2].docs.map(d => d.id));
  blockedPlayers = new Map(results[3].docs.map(d => [d.id, d.data().alias || 'Jugador']));
  cachedGames = [...new Map(results.slice(0, 2).flatMap(s => s.docs.map(d => [d.id, asVisible({ ...d.data(), id: d.id })]))).values()];
  return cachedGames;
}
async function archive(gameId, restore = false) {
  const ref = doc(db, 'duelPreferences', uid(), 'archived', gameId);
  if (restore) await deleteDoc(ref); else await setDoc(ref, { updatedAt: serverTimestamp() });
}
async function block(player, name, unblock = false) {
  const ref = doc(db, 'duelPreferences', uid(), 'blocked', player);
  if (unblock) await deleteDoc(ref); else await setDoc(ref, { alias: String(name || 'Jugador').slice(0, 24), updatedAt: serverTimestamp() });
}
function headToHead(player, games = cachedGames) {
  const totals = { orden: { wins: 0, losses: 0, draws: 0 }, cifras: { wins: 0, losses: 0, draws: 0 } };
  for (const g of games) {
    if (!['finished', 'resigned'].includes(g.status) || !g.playersOrder.includes(uid()) || !g.playersOrder.includes(player) || !totals[g.kind]) continue;
    const diff = g.status === 'resigned' ? g.winnerUid === uid() ? 1 : -1 : (g.scores?.[uid()] || 0) - (g.scores?.[player] || 0);
    totals[g.kind][diff > 0 ? 'wins' : diff < 0 ? 'losses' : 'draws']++;
  }
  return totals;
}
function profileMarkup(games) {
  const visible = games.filter(g => !archivedIds.has(g.id));
  // Primero lo que espera algo de ti (tu turno, retos recibidos), después lo que espera
  // al rival y, plegado al final, el historial.
  const groups = [ ['Tu turno', g => g.status === 'playing' && g.turnUid === uid()], ['Te han retado', g => g.status === 'waiting' && g.invitedUid === uid()], ['Esperando al rival', g => g.status === 'playing' && g.turnUid !== uid()], ['Invitaciones enviadas', g => g.status === 'waiting' && g.invitedUid !== uid()], ['Historial', ended] ];
  const rows = entries => entries.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map(g => {
    const archived = archivedIds.has(g.id), e = CT.Duelo.estadoTurnos(g, uid()), avatar = CT.Avatares?.markup(e.rival, { size: 44 }) || '';
    // La fila entera es el botón que entra en el duelo: quién, de qué mazo, a quién le
    // toca, por qué carta vais y cómo va el marcador, sin tener que abrirlo para saberlo.
    return `<div class="turn-duel-profile-row turn-duel-row-${e.grupo}"><button class="turn-duel-entry${e.pendiente ? ' is-pending' : ''}" data-action="open-turn-duel" data-turn-id="${safe(g.id)}" aria-label="${safe(`${e.rival}, ${CT.mode(g.mode).name}. ${e.estado}. ${e.detalle}. ${e.marcador}`)}"><span class="turn-duel-entry-avatar">${avatar}</span><span class="turn-duel-entry-copy"><b>${safe(e.rival)}</b><small>${safe(CT.mode(g.mode).name)} · ${g.kind === 'cifras' ? 'Cifras' : 'Ordenar'}</small><span class="turn-duel-entry-state">${safe(e.estado)} <em>· ${safe(e.detalle)}</em></span>${e.marcador ? `<span class="turn-duel-entry-score">${safe(e.marcador)}</span>` : ''}</span><i aria-hidden="true">→</i></button><div class="turn-duel-row-actions">${ended(g) ? `${g.playersOrder.length === 2 && g.playersOrder.includes(uid()) ? `<button class="btn btn-ghost" data-action="rematch-turn-duel" data-turn-id="${safe(g.id)}">Revancha</button>` : ''}<button class="btn btn-ghost" data-action="archive-turn-duel" data-turn-id="${safe(g.id)}" data-restore="${archived}">${archived ? 'Restaurar' : 'Archivar'}</button>` : `<button class="btn btn-ghost" data-action="close-turn-duel" data-turn-id="${safe(g.id)}" data-playing="${g.status === 'playing'}">${g.status === 'playing' ? 'Rendirse' : g.invitedUid === uid() ? 'Rechazar' : 'Cancelar invitación'}</button>${g.status === 'waiting' && g.playersOrder[0] === uid() ? `<button class="btn btn-ghost" data-action="reshare-turn-duel" data-turn-id="${safe(g.id)}">Reenviar enlace</button>` : ''}`}</div></div>`;
  }).join('');
  const history = groups.map(([title, filter], i) => { const entries = visible.filter(filter); return !entries.length ? '' : i === 4 ? `<details><summary>${title} (${entries.length})</summary>${rows(entries)}</details>` : `<h3>${title} (${entries.length})</h3>${rows(entries)}`; }).join('');
  const rivalRows = rivals(games).map(r => {
    const stats = headToHead(r.uid, games);
    return `<div class="turn-duel-rival"><button class="btn btn-ghost" data-action="favorite-duel-rival" data-rival-id="${safe(r.uid)}" aria-pressed="${r.favorite}" aria-label="Favorito: ${safe(r.alias)}">${r.favorite ? '★' : '☆'}</button><span><b>${safe(r.alias)}</b>${Object.entries(stats).map(([kind, s]) => `<small>${kind === 'orden' ? 'Ordenar' : 'Cifras'}: tú ${s.wins} — ${s.losses} rival · ${s.draws} empates</small>`).join('')}</span><div class="turn-duel-row-actions">${!blockedPlayers.has(r.uid) ? `<button class="btn btn-secondary" data-action="rematch-turn-duel" data-turn-id="${safe(r.source)}">Retar</button><button class="btn btn-ghost" data-action="block-duel-rival" data-rival-id="${safe(r.uid)}" data-rival-name="${safe(r.alias)}">Bloquear retos</button>` : '<small>Retos bloqueados</small>'}</div></div>`;
  }).join('');
  const archived = games.filter(g => archivedIds.has(g.id));
  const pendingCount = visible.filter(g => g.status === 'playing' && g.turnUid === uid()).length;
  return `<h2>Mis duelos</h2>${pendingCount ? `<button class="btn btn-secondary btn-block" data-action="next-turn-duel">Ir al siguiente duelo pendiente <small>(${pendingCount})</small></button><p class="hint">Abre la partida más antigua en la que te toca jugar.</p>` : ''}${history || '<p>No tienes duelos abiertos.</p>'}${archived.length ? `<details><summary>Archivados (${archived.length})</summary>${rows(archived)}</details>` : ''}${rivalRows ? `<h3>Rivales y cara a cara</h3><p class="hint">Victorias separadas por modalidad. Cancelaciones y caducidades no cuentan. Archivar solo cambia tu lista.</p>${rivalRows}` : ''}${blockedPlayers.size ? `<details><summary>Rivales bloqueados</summary>${[...blockedPlayers].map(([player, name]) => `<p>${safe(name)} <button class="btn btn-ghost" data-action="unblock-duel-rival" data-rival-id="${safe(player)}">Desbloquear</button></p>`).join('')}</details>` : ''}`;
}
function favoriteIds() { try { const saved = JSON.parse(localStorage.getItem(`continuum-duel-favorites-${uid()}`) || '[]'); return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []; } catch { return []; } }
function favorite(player) {
  const favorites = new Set(favoriteIds());
  favorites.has(player) ? favorites.delete(player) : favorites.add(player);
  localStorage.setItem(`continuum-duel-favorites-${uid()}`, JSON.stringify([...favorites]));
}
function rivals(games = cachedGames) {
  const favorites = new Set(favoriteIds()), found = new Map();
  for (const game of [...games].sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))) {
    if (!game.playersOrder.includes(uid()) || game.playersOrder.length !== 2) continue;
    const player = game.playersOrder.find(p => p !== uid());
    if (!found.has(player)) found.set(player, { uid: player, alias: game.players?.[player]?.alias || 'Jugador', source: game.id, mode: game.mode, kind: game.kind, favorite: favorites.has(player) });
  }
  return [...found.values()].sort((a,b) => Number(b.favorite) - Number(a.favorite));
}
async function challenge(sourceId, back = onBack) {
  if (busy) return;
  busy = true;
  try {
    const source = (await getDoc(doc(db, 'turnDuels', sourceId))).data();
    if (!source || source.playersOrder.length !== 2 || !source.playersOrder.includes(uid())) throw Error('rival');
    const invitedUid = source.playersOrder.find(p => p !== uid());
    const games = await list();
    if (blockedPlayers.has(invitedUid)) throw Error('Has bloqueado los retos de este rival.');
    const existing = games.find(g => g.status === 'waiting' && g.mode === source.mode && g.kind === source.kind && ((g.invitedUid === invitedUid && g.playersOrder[0] === uid()) || (g.invitedUid === uid() && g.playersOrder[0] === invitedUid)));
    if (existing) { open({ gameId: existing.id, back }); return; }
    let round = 0, gameId;
    const seed = CT.Duelo.crearSemilla(), total = source.kind === 'cifras' ? CT.Duelo.Cifras.CARTAS : TOTAL;
    // A bounded identifier avoids ever-growing rematch links. An ended invitation
    // gets another round; simultaneous/repeated taps still address the same document.
    const previous = games.filter(g => g.sourceDuel === sourceId && g.playersOrder[0] === uid() && Number.isInteger(g.invitationRound));
    if (previous.length) round = Math.max(...previous.map(g => g.invitationRound)) + 1;
    let available = false;
    while (!available && round < 1000) {
    gameId = `invite-${source.seed}-${uid()}-${round}`;
    available = await runTransaction(db, async tx => {
      const ref = doc(db, 'turnDuels', gameId);
      const existing = await tx.get(ref);
      if (existing.exists()) return !ended(existing.data()) && !inactive(existing.data());
      tx.set(ref, { id: gameId, sourceDuel: sourceId, invitationRound: round, invitedUid, invitedAlias: source.players[invitedUid].alias,
        mode: source.mode, kind: source.kind, seed, total, turnIndex: 0, turnUid: null,
        playersOrder: [uid()], players: { [uid()]: { alias: alias() } }, scores: { [uid()]: 0 },
        status: 'waiting', plays: [], timeline: source.kind === 'orden' ? [CT.Duelo.reparto(source.mode, seed, total)[0]] : [],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return true;
    });
    if (!available) round++;
    }
    if (!available) throw Error('No se pudo reservar la invitación.');
    open({ gameId, back });
  } finally { busy = false; }
}
async function next(back = onBack) {
  const games = await list();
  const target = games.filter(g => g.id !== current?.id && g.status === 'playing' && g.turnUid === uid()).sort((a,b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0))[0];
  if (!target) return notify('No tienes más duelos pendientes de jugar.');
  open({ gameId: target.id, back });
}
function open({ mode = 'history', kind = 'orden', gameId = '', back } = {}) { stop?.(); clearInterval(timer); current = null; prepareUntil = 0; preparingTurn = null; awaitingReady = false; enteredAt = 0; delivery = ''; pendingIndex = null; onBack = back; shareLink = ''; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); retryPending(); if (gameId) join(gameId, back).catch(() => notify('No se pudo abrir este duelo.')); else create(mode, kind, back).catch(() => notify('No se pudo crear el duelo.')); }
function close() { stop?.(); stop = null; clearInterval(timer); document.removeEventListener('visibilitychange', leaveGuard); current = null; onBack?.(); }
document.addEventListener('click', e => { const target = e.target.closest('[data-turn-action]'), action = target?.dataset.turnAction; if (action === 'select-slot') { pendingIndex = Number(target.dataset.index); render(); } if (action === 'confirm-place') place(pendingIndex); if (action === 'cancel-place') { pendingIndex = null; render(); } if (action === 'submit-cifra') submitCifra(); if (action === 'share') share(); if (action === 'back') close(); });
CT.TurnDuel = { open, close, list, cancel, TURN_SECONDS, READY_SECONDS };
// Los duelos que esperan algo de quien juega: los suyos en los que le toca y los retos
// que le han mandado. Es lo que la portada avisa; lo demás se ve en la lista completa.
function pending(games = cachedGames) {
  return games.filter(g => !archivedIds.has(g.id) && ((g.status === 'playing' && g.turnUid === uid()) || (g.status === 'waiting' && g.invitedUid === uid() && !blockedPlayers.has(g.playersOrder[0]))))
    .sort((a, b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0));
}
Object.assign(CT.TurnDuel, { rivals, favorite, challenge, next, archive, block, headToHead, profileMarkup, reshare, pending });
document.addEventListener('click', event => {
  const button = event.target.closest('[data-turn-action]');
  const actions = { ready: () => { prepareTurn(true); render(); }, retry: retryPending, rematch: () => challenge(current.id), next: () => next(), accept: () => join(current.id, onBack, true), decline: () => cancel(current.id, 'waiting') };
  const action = actions[button?.dataset.turnAction];
  if (!action || button.disabled) return;
  button.disabled = true;
  Promise.resolve().then(action).catch(() => notify('No se pudo completar la acción. Comprueba tu conexión.')).finally(() => { button.disabled = false; });
});
