// Duelo por turnos entre dos móviles. El documento de la partida es la autoridad:
// el cliente solo puede escribir la jugada del turno que le corresponde.
import { auth, db } from './firebase-client.js';
import { collection, doc, getDocs, limit, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const TURN_SECONDS = 15;
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
function timelineCardMarkup(game, card) {
  const era = CT.eraForCard(game.mode, card), art = CT.animalArt(game.mode, card);
  const visual = art || `<span>${era.symbol}</span><small>${safe(era.name)}</small>`;
  return `<article class="timeline-card card-flippable" data-id="${card.id}"><div class="card-visual era-${era.key}">${visual}</div><div class="card-content">${CT.categoryBadge(game.mode, card)}<div class="year">${safe(CT.formatValue(game.mode, card))}</div><h3>${safe(card.title)}</h3><p>${safe(card.detail)}</p></div></article>`;
}
function orderBoard(game, card) {
  const line = timelineCards(game), slots = [];
  for (let index = 0; index <= line.length; index++) {
    slots.push(pendingIndex === index
      ? `<div class="slot-confirm"><small>Colocar aquí</small><strong>${safe(card.title)}</strong><button class="btn btn-primary btn-block" data-turn-action="confirm-place">Sí, aquí</button><button class="btn btn-ghost btn-block" data-turn-action="cancel-place">Cancelar</button></div>`
      : `<button class="slot" data-turn-action="select-slot" data-index="${index}" aria-label="Colocar en la posición ${index + 1} de ${line.length + 1}"><span>+</span></button>`);
    if (index < line.length) slots.push(timelineCardMarkup(game, line[index]));
  }
  return `<section><div class="hand-title"><h3>${safe(CT.timelineTitle(game.mode))}</h3><small>${line.length} ${line.length === 1 ? 'carta' : 'cartas'}</small></div>${CT.timelineMap?.(game.mode, line) || ''}<div class="timeline-wrap"><div class="timeline">${slots.join('')}</div></div></section><section><div class="hand-title"><h3>Tu carta</h3></div><div class="hand hand-solo"><div class="hand-card selected" data-id="${card.id}">${CT.categoryBadge(game.mode, card)}<span class="hidden-date">${safe(CT.hiddenLabel(game.mode))}</span>${CT.cardBack(game.mode)}<strong>${safe(card.title)}</strong></div></div><p class="hint">${pendingIndex === null ? 'Toca el hueco donde quieres colocar la carta.' : 'Confirma el hueco elegido o toca otro.'}</p></section>`;
}
function cifraBoard(game, card) { return `<div class="cifra-card">${CT.categoryBadge(game.mode, card)}<strong>${safe(card.title)}</strong><span>${safe(CT.Duelo.Cifras.regla(game.mode)?.pregunta || 'Escribe la cifra')}</span></div><input id="turn-cifra-input" type="text" inputmode="numeric" autocomplete="off" placeholder="Tu cifra"><button class="btn btn-primary btn-block" data-turn-action="submit-cifra">Enviar cifra</button>`; }
async function share() { if (!shareLink) return; if (navigator.share) { try { await navigator.share({ title: 'Duelo por turnos en Continuum', text: 'Únete a mi duelo por turnos en Continuum', url: shareLink }); return; } catch {} } await navigator.clipboard?.writeText(shareLink).catch(() => {}); notify('Enlace copiado. Ya puedes enviárselo a tu rival.'); }
function render() {
  if (!current) return;
  const mine = current.turnUid === uid();
  const elapsed = enteredAt ? Math.max(0, TURN_SECONDS - Math.floor((Date.now() - enteredAt) / 1000)) : TURN_SECONDS;
  const card = mine && !current.timeout ? localCard(current) : null;
  const waiting = current.status === 'waiting';
  const kindLabel = current.kind === 'cifras' ? 'Escribir la cifra' : 'Ordenar las cartas';
  const rival = current.players?.[current.playersOrder?.find(x => x !== uid())]?.alias || '';
  const html = `<div class="shell"><section class="pass-screen"><div class="panel turn-duel-screen">
    <div class="eyebrow">Duelo por turnos · ${safe(kindLabel)}${rival ? ` · ${safe(rival)}` : ''}</div>
    <h1 data-focus tabindex="-1">${current.status === 'finished' ? 'Duelo terminado' : waiting ? 'Comparte tu duelo' : statusText(current)}</h1>
    <p class="lead">${current.status === 'finished' ? 'La partida ya ha terminado.' : waiting ? 'Elige a quién quieres retar y envíale este enlace. La partida empezará cuando se una.' : mine ? `Te toca en «${safe(kindLabel)}». El otro jugador no verá tu pantalla.` : 'Te avisaremos cuando el otro jugador coloque su carta.'}</p>
    ${waiting ? `<div class="turn-duel-share"><span class="turn-duel-share-icon" aria-hidden="true">↗</span><b>Invita a tu rival</b><code>${safe(shareLink)}</code><button class="btn btn-primary btn-block" data-turn-action="share">Compartir el duelo</button><small>El enlace lleva las mismas cartas y la modalidad «${safe(kindLabel)}».</small></div>` : ''}
    ${current.status !== 'finished' && !waiting && mine ? `<div class="turn-duel-countdown" role="timer"><b id="turn-duel-seconds">${elapsed}s</b><span>de seguridad para jugar este turno</span></div>${current.timeout ? '<p class="lead">Tiempo agotado. Pasando el turno…</p>' : card ? (current.kind === 'cifras' ? cifraBoard(current, card) : orderBoard(current, card)) : '<p class="lead">No se pudo cargar la carta. Actualiza Continuum en los dos móviles.</p>'}` : ''}
    ${current.status !== 'finished' && !mine ? `<div class="turn-duel-wait" role="status"><span aria-hidden="true">⌛</span><b>Esperando al oponente</b><small>Esta pantalla se actualizará automáticamente.</small></div>` : ''}
    ${current.status === 'finished' ? `<p class="lead">${safe(current.resultText || 'Gracias por jugar.')}</p>` : `<small class="turn-duel-progress">Turno ${Math.min(current.turnIndex + 1, current.total)} de ${current.total} · Tu puntuación: ${current.scores?.[uid()] || 0}</small>`}
    <button class="btn btn-ghost btn-block" data-turn-action="back">Volver al menú</button>
  </div></section></div>`;
  document.getElementById('app').innerHTML = html;
  clearInterval(timer); if (mine && current.status === 'playing' && !current.timeout) timer = setInterval(() => { const left = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - enteredAt) / 1000)), counter = document.getElementById('turn-duel-seconds'); if (counter) counter.textContent = `${left}s`; if (left <= 0) { clearInterval(timer); expireTurn(); } }, 250);
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
async function join(gameId, back) {
  onBack = back; const ref = doc(db, 'turnDuels', gameId); await runTransaction(db, async tx => { const snap = await tx.get(ref); const game = snap.data(); if (!game) throw Error('no encontrado'); if (game.playersOrder.includes(uid())) return; if (game.playersOrder.length >= 2) throw Error('lleno'); game.playersOrder.push(uid()); game.players[uid()] = { alias: alias() }; game.scores[uid()] = 0; if (game.kind === 'orden' && !game.timeline?.length) game.timeline = [deckCards(game)[0].id]; game.status = 'playing'; game.turnUid = game.playersOrder[0]; game.updatedAt = serverTimestamp(); tx.update(ref, game); }); subscribe(gameId);
}
function subscribe(gameId) { stop?.(); stop = onSnapshot(doc(db, 'turnDuels', gameId), snap => { const next = snap.data(); if (!next) return; const previousTurn = current?.turnIndex; const wasPlayingAway = current?.status === 'playing' && current.turnUid !== uid(); const becamePlayable = current?.status === 'waiting' && next.status === 'playing' && next.turnUid === uid(); current = { ...next, id: gameId, shareLink }; if (previousTurn !== current.turnIndex) pendingIndex = null; if ((wasPlayingAway && current.turnUid === uid()) || becamePlayable) { enteredAt = Date.now(); sessionStorage.setItem(`continuum-turn-entry-${gameId}-${current.turnIndex}`, String(enteredAt)); if (wasPlayingAway) notify('Tu oponente ha colocado una carta. Te toca.'); } render(); }, () => notify('No se pudo sincronizar el duelo.')); const key = `continuum-turn-entry-${gameId}-${current?.turnIndex || 0}`; enteredAt = Number(sessionStorage.getItem(key)) || Date.now(); sessionStorage.setItem(key, String(enteredAt)); document.addEventListener('visibilitychange', leaveGuard); render(); }
async function list() { if (!uid()) return []; const q = query(collection(db, 'turnDuels'), where('playersOrder', 'array-contains', uid()), limit(20)); const snaps = await getDocs(q); return snaps.docs.map(s => ({ ...s.data(), id: s.id })); }
function open({ mode = 'history', kind = 'orden', gameId = '', back } = {}) { onBack = back; shareLink = ''; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); if (gameId) join(gameId, back).catch(() => notify('No se pudo abrir este duelo.')); else create(mode, kind, back).catch(() => notify('No se pudo crear el duelo.')); }
function close() { stop?.(); stop = null; clearInterval(timer); document.removeEventListener('visibilitychange', leaveGuard); current = null; onBack?.(); }
document.addEventListener('click', e => { const target = e.target.closest('[data-turn-action]'), action = target?.dataset.turnAction; if (action === 'select-slot') { pendingIndex = Number(target.dataset.index); render(); } if (action === 'confirm-place') place(pendingIndex); if (action === 'cancel-place') { pendingIndex = null; render(); } if (action === 'submit-cifra') submitCifra(); if (action === 'share') share(); if (action === 'back') close(); });
CT.TurnDuel = { open, close, list, TURN_SECONDS };
