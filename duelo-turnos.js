// Duelo por turnos entre dos móviles. El documento de la partida es la autoridad:
// el cliente solo puede escribir la jugada del turno que le corresponde.
import { auth, db } from './firebase-client.js';
import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const TURN_SECONDS = 15;
const READY_SECONDS = 3;
const INACTIVE_DAYS = 7;
const ended = game => ['finished', 'cancelled', 'expired'].includes(game.status);
const inactive = game => !ended(game) && game.updatedAt?.seconds && Date.now() - game.updatedAt.seconds * 1000 >= INACTIVE_DAYS * 86400000;
const asVisible = game => inactive(game) ? { ...game, status: 'expired', turnUid: null, resultText: 'Duelo caducado tras siete días sin actividad.' } : game;
let cachedGames = [], busy = false;
let prepareUntil = 0, preparingTurn = null;
const TOTAL = CT.Duelo.CARTAS;
let stop = null, current = null, onBack = null, timer = null, enteredAt = 0, shareLink = '', pendingIndex = null, expiring = false;

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
  const card = mine && !current.timeout && !preparing ? localCard(current) : null;
  const waiting = current.status === 'waiting';
  const kindLabel = current.kind === 'cifras' ? 'Escribir la cifra' : 'Ordenar las cartas';
  const rival = current.players?.[current.playersOrder?.find(x => x !== uid())]?.alias || '';
  const finished = ended(current);
  const active = mine && !waiting && !finished && !current.timeout && !preparing;
  const heading = finished ? current.status === 'expired' ? 'Duelo caducado' : current.status === 'cancelled' ? 'Duelo cerrado' : 'Duelo terminado' : waiting ? current.invitedUid ? current.invitedUid === uid() ? 'Te han retado' : 'Reto enviado' : 'Invita a tu rival' : statusText(current);
  const waitingHint = current.invitedUid ? 'La invitación se acepta desde el perfil, sin compartir enlaces.' : 'Comparte el enlace para empezar vuestra partida.';
  const link = shareLink || `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${current.id}`;
  const html = `<div class="shell turn-duel-shell" data-duel-id="${safe(current.id)}" data-turn="${current.turnIndex}">
    <nav class="turn-duel-nav" aria-label="Duelo"><span>CONTINUUM <small>Duelo por turnos</small></span><button class="btn btn-ghost" data-turn-action="back">Volver</button></nav>
    <section class="turn-duel-screen">
      <header class="turn-duel-heading"><div><div class="eyebrow">${safe(kindLabel)}</div><h1 data-focus tabindex="-1">${heading}</h1><p>${waiting ? waitingHint : finished ? 'Así queda vuestra partida.' : `Carta ${Math.min(current.turnIndex + 1, current.total)} de ${current.total}${rival ? ` · Contra ${safe(rival)}` : ''}`}</p></div>${active ? clockMarkup(elapsed) : ''}</header>
      <div class="turn-duel-scores" aria-label="Marcador">${current.playersOrder.map(player => `<div class="turn-duel-player ${current.turnUid === player ? 'is-active' : ''}"><span>${safe(current.players?.[player]?.alias || 'Jugador')}${player === uid() ? ' · tú' : ''}</span><b>${current.scores?.[player] || 0}<small>${current.kind === 'cifras' ? 'puntos' : 'aciertos'}</small></b></div>`).join('')}</div>
      ${waiting ? current.invitedUid ? `<div class="panel turn-duel-share"><h2>${current.invitedUid === uid() ? 'Te han retado' : `Reto enviado a ${safe(current.invitedAlias || 'tu rival')}`}</h2><p>${current.invitedUid === uid() ? 'Mismo mazo y modalidad. Cartas nuevas para otra partida.' : 'La invitación ya aparece en su perfil. No necesitas enviar otro enlace.'}</p>${current.invitedUid === uid() ? '<button class="btn btn-primary" data-turn-action="accept">Aceptar el duelo</button><button class="btn btn-ghost" data-turn-action="decline">Rechazar</button>' : ''}</div>` : `<div class="panel turn-duel-share"><span class="turn-duel-share-icon" aria-hidden="true">↗</span><h2>Una partida, dos móviles</h2><p>Envía la invitación por WhatsApp, mensaje o la aplicación que prefieras.</p><button class="btn btn-primary btn-block" data-turn-action="share">Compartir el duelo</button><details><summary>Ver enlace de invitación</summary><code>${safe(link)}</code></details><small>La partida empezará cuando se una tu rival.</small></div>` : ''}
      ${lastMove(current)}
      ${preparing ? `<div class="turn-duel-ready" role="status"><b id="turn-ready-seconds">${Math.ceil((prepareUntil - Date.now()) / 1000)}</b><h2>Prepárate</h2><p>La carta aparecerá al terminar la cuenta. Después tendrás 15 segundos.</p></div>` : ''}
      ${!waiting && !finished && !active && !preparing ? `<p class="turn-duel-status" role="status">${current.timeout ? 'Tiempo agotado. Pasando el turno…' : 'Tu rival está jugando. La mesa se actualizará automáticamente.'}</p>` : ''}
      ${!waiting && current.kind === 'orden' ? orderBoard(current, active ? card : null) : ''}
      ${active && current.kind === 'cifras' && card ? cifraBoard(current, card) : ''}
      ${active && !card ? '<p role="alert">No se pudo cargar la carta. Actualiza Continuum en los dos móviles.</p>' : ''}
      ${finished ? `<p class="turn-duel-status">${safe(current.resultText || 'Gracias por jugar.')}</p>` : ''}
      ${!active && !preparing ? `<div class="turn-duel-actions">${finished && current.playersOrder.length === 2 ? '<button class="btn btn-primary" data-turn-action="rematch">Revancha</button>' : ''}<button class="btn btn-secondary" data-turn-action="next">Siguiente duelo · tu turno</button></div>` : ''}
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
  if (!current || current.turnUid !== uid() || current.status !== 'playing' || expiring) return;
  expiring = true; current = { ...current, timeout: true }; render();
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'turnDuels', current.id), snap = await tx.get(ref), game = snap.data();
      if (!game || game.turnUid !== uid() || game.turnIndex !== current.turnIndex) throw Error('turno');
      const card = localCard(game), nextIndex = game.turnIndex + 1, finished = nextIndex >= game.total;
      const play = game.kind === 'cifras'
        ? { uid: uid(), cardId: card.id, respuesta: 0, points: 0, timeout: true, at: Timestamp.now() }
        : { uid: uid(), cardId: card.id, index: -1, correct: false, timeout: true, at: Timestamp.now() };
      tx.update(ref, { plays: [...(game.plays || []), play], timeline: game.timeline || [], scores: game.scores || {}, turnIndex: nextIndex, turnUid: finished ? null : game.playersOrder[nextIndex % 2], status: finished ? 'finished' : 'playing', updatedAt: serverTimestamp(), resultText: finished ? 'Los dos jugadores han completado la partida.' : null });
    });
  } catch { notify('No se pudo cerrar el turno agotado. Actualiza la pantalla.'); }
  finally { expiring = false; }
}
async function place(index) {
  if (Date.now() < prepareUntil) return;
  if (!current || current.turnUid !== uid() || current.timeout) return notify('El tiempo de seguridad de este turno ha terminado.');
  const card = localCard(current);
  if (!Number.isInteger(index) || index < 0) return;
  await runTransaction(db, async tx => {
    const ref = doc(db, 'turnDuels', current.id), snap = await tx.get(ref), game = snap.data();
    if (!game || game.turnUid !== uid() || game.turnIndex !== current.turnIndex) throw Error('turno');
    const nextIndex = game.turnIndex + 1, finished = nextIndex >= game.total, ok = correctPlacement(game, card, index), line = ok ? timelineCards(game).map(item => item.id) : [...(game.timeline || [])]; if (ok) line.splice(Math.max(0, Math.min(index, line.length)), 0, card.id);
    tx.update(ref, { plays: [...(game.plays || []), { uid: uid(), cardId: card.id, index, correct: ok, at: Timestamp.now() }], timeline: line, scores: { ...(game.scores || {}), [uid()]: (game.scores?.[uid()] || 0) + (ok ? 1 : 0) }, turnIndex: nextIndex, turnUid: finished ? null : game.playersOrder[nextIndex % 2], status: finished ? 'finished' : 'playing', updatedAt: serverTimestamp(), resultText: finished ? 'Los dos jugadores han colocado todas las cartas.' : null });
  }).catch(() => notify('El turno ha cambiado o ya se ha jugado. Actualiza la pantalla.'));
}
async function submitCifra() {
  if (Date.now() < prepareUntil) return;
  if (!current || current.kind !== 'cifras' || current.turnUid !== uid() || current.timeout) return notify('El tiempo de seguridad de este turno ha terminado.');
  const value = CT.Duelo.Cifras.leer(current.mode, document.getElementById('turn-cifra-input')?.value || '');
  if (value === null) return notify('Escribe una cifra válida.');
  await runTurn({ respuesta: value, ms: Math.max(0, Date.now() - enteredAt) });
}
async function runTurn(extra) {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'turnDuels', current.id), snap = await tx.get(ref), game = snap.data();
    if (!game || game.turnUid !== uid() || game.turnIndex !== current.turnIndex) throw Error('turno');
    const card = localCard(game), nextIndex = game.turnIndex + 1, finished = nextIndex >= game.total;
    const points = game.kind === 'cifras' ? CT.Duelo.Cifras.puntosCarta(game.mode, card, extra, CT.Duelo.Cifras.MS) : 0;
    tx.update(ref, { plays: [...(game.plays || []), { uid: uid(), cardId: card.id, ...extra, points, at: Timestamp.now() }], timeline: game.timeline || [], scores: { ...(game.scores || {}), [uid()]: (game.scores?.[uid()] || 0) + points }, turnIndex: nextIndex, turnUid: finished ? null : game.playersOrder[nextIndex % 2], status: finished ? 'finished' : 'playing', updatedAt: serverTimestamp(), resultText: finished ? 'Los dos jugadores han completado todas las cartas.' : null });
  }).catch(() => notify('El turno ha cambiado o ya se ha jugado. Actualiza la pantalla.'));
}
async function create(mode, kind, back) {
  onBack = back; const gameId = id();
  const total = kind === 'cifras' ? CT.Duelo.Cifras.CARTAS : TOTAL;
  const seed = CT.Duelo.crearSemilla(), openingCard = kind === 'orden' ? CT.Duelo.reparto(mode, seed, total)[0] : null;
  const game = { id: gameId, mode, kind, seed, total, turnIndex: 0, turnUid: null, playersOrder: [uid()], players: { [uid()]: { alias: alias() } }, status: 'waiting', plays: [], timeline: openingCard == null ? [] : [openingCard], scores: { [uid()]: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  shareLink = `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${gameId}`;
  await setDoc(doc(db, 'turnDuels', gameId), game); current = { ...game, shareLink }; render();
  await navigator.clipboard?.writeText(shareLink).catch(() => {}); notify('Duelo creado. Comparte el enlace con tu rival.');
  subscribe(gameId);
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
function prepareTurn() {
  if (current?.status !== 'playing' || current.turnUid !== uid()) return;
  const key = `continuum-turn-entry-${current.id}-${current.turnIndex}`;
  if (preparingTurn === key) return;
  preparingTurn = key;
  // Persist the deadline: reopening an already revealed card never grants extra time.
  const saved = Number(localStorage.getItem(key) || sessionStorage.getItem(key));
  enteredAt = saved || Date.now() + READY_SECONDS * 1000;
  localStorage.setItem(key, String(enteredAt));
  prepareUntil = Math.max(Date.now(), enteredAt);
}
function subscribe(gameId) {
  stop?.();
  stop = onSnapshot(doc(db, 'turnDuels', gameId), snap => {
    const next = snap.data(); if (!next) return;
    const previousTurn = current?.turnIndex;
    const wasPlayingAway = current?.status === 'playing' && current.turnUid !== uid();
    current = asVisible({ ...next, id: gameId, shareLink });
    if (previousTurn !== current.turnIndex) pendingIndex = null;
    prepareTurn();
    if (wasPlayingAway && current.turnUid === uid()) notify('Tu oponente ha colocado una carta. Te toca.');
    render();
  }, () => notify('No se pudo sincronizar el duelo.'));
  document.addEventListener('visibilitychange', leaveGuard);
}
async function cancel(gameId) {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'turnDuels', gameId), game = (await tx.get(ref)).data();
    if (!game || !(game.playersOrder.includes(uid()) || game.invitedUid === uid())) throw Error('No perteneces a este duelo.');
    if (!['waiting', 'playing'].includes(game.status)) return;
    tx.update(ref, { status: 'cancelled', turnUid: null, closedBy: uid(), updatedAt: serverTimestamp(), resultText: `${alias()} ha cerrado el duelo.` });
  });
}
async function list() {
  if (!uid()) return [];
  const results = await Promise.all([
    getDocs(query(collection(db, 'turnDuels'), where('playersOrder', 'array-contains', uid()))),
    getDocs(query(collection(db, 'turnDuels'), where('invitedUid', '==', uid())))
  ]);
  cachedGames = [...new Map(results.flatMap(s => s.docs.map(d => [d.id, asVisible({ ...d.data(), id: d.id })]))).values()];
  return cachedGames;
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
    const gameId = `direct-${sourceId}-${uid()}`;
    const seed = CT.Duelo.crearSemilla(), total = source.kind === 'cifras' ? CT.Duelo.Cifras.CARTAS : TOTAL;
    await runTransaction(db, async tx => {
      const ref = doc(db, 'turnDuels', gameId);
      if ((await tx.get(ref)).exists()) return; // Repeated taps reuse the invitation.
      tx.set(ref, { id: gameId, sourceDuel: sourceId, invitedUid, invitedAlias: source.players[invitedUid].alias,
        mode: source.mode, kind: source.kind, seed, total, turnIndex: 0, turnUid: null,
        playersOrder: [uid()], players: { [uid()]: { alias: alias() } }, scores: { [uid()]: 0 },
        status: 'waiting', plays: [], timeline: source.kind === 'orden' ? [CT.Duelo.reparto(source.mode, seed, total)[0]] : [],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    open({ gameId, back });
  } finally { busy = false; }
}
async function next(back = onBack) {
  const games = await list();
  const target = games.filter(g => g.id !== current?.id && g.status === 'playing' && g.turnUid === uid()).sort((a,b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0))[0];
  if (!target) return notify('No tienes más duelos pendientes de jugar.');
  open({ gameId: target.id, back });
}
function open({ mode = 'history', kind = 'orden', gameId = '', back } = {}) { stop?.(); clearInterval(timer); current = null; prepareUntil = 0; preparingTurn = null; pendingIndex = null; onBack = back; shareLink = ''; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); if (gameId) join(gameId, back).catch(() => notify('No se pudo abrir este duelo.')); else create(mode, kind, back).catch(() => notify('No se pudo crear el duelo.')); }
function close() { stop?.(); stop = null; clearInterval(timer); document.removeEventListener('visibilitychange', leaveGuard); current = null; onBack?.(); }
document.addEventListener('click', e => { const target = e.target.closest('[data-turn-action]'), action = target?.dataset.turnAction; if (action === 'select-slot') { pendingIndex = Number(target.dataset.index); render(); } if (action === 'confirm-place') place(pendingIndex); if (action === 'cancel-place') { pendingIndex = null; render(); } if (action === 'submit-cifra') submitCifra(); if (action === 'share') share(); if (action === 'back') close(); });
CT.TurnDuel = { open, close, list, cancel, TURN_SECONDS, READY_SECONDS };
Object.assign(CT.TurnDuel, { rivals, favorite, challenge, next });
document.addEventListener('click', event => {
  const button = event.target.closest('[data-turn-action]');
  const actions = { rematch: () => challenge(current.id), next: () => next(), accept: () => join(current.id, onBack, true), decline: () => cancel(current.id) };
  const action = actions[button?.dataset.turnAction];
  if (!action || button.disabled) return;
  button.disabled = true;
  Promise.resolve().then(action).catch(() => notify('No se pudo completar la acción. Comprueba tu conexión.')).finally(() => { button.disabled = false; });
});
