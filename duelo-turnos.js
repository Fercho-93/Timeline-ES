// Duelo por turnos entre dos móviles. El documento de la partida es la autoridad:
// el cliente solo puede escribir la jugada del turno que le corresponde.
import { auth, db } from './firebase-client.js';
import { collection, doc, getDocs, limit, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
const TURN_SECONDS = 15;
const TOTAL = CT.Duelo.CARTAS;
let stop = null, current = null, onBack = null, timer = null, enteredAt = 0, shareLink = '';

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
  if (document.visibilityState === 'hidden' && current?.turnUid === uid() && enteredAt && Date.now() - enteredAt > TURN_SECONDS * 1000) { current = { ...current, timeout: true }; render(); }
}
function deckCards(game) { const ids = game.kind === 'cifras' ? CT.Duelo.Cifras.cartas(game.mode, game.seed, game.total).map(card => card.id) : CT.Duelo.reparto(game.mode, game.seed, game.total); return ids.map(item => CT.cards(game.mode).find(card => card.id === item)).filter(Boolean); }
function localCard(game) { const cards = deckCards(game); return cards[game.turnIndex % cards.length]; }
function correctPlacement(game, card, index) { const line = (game.timeline || []).map(item => CT.cards(game.mode).find(candidate => candidate.id === item)).filter(Boolean); const value = CT.sortValue(game.mode, card); const left = line[index - 1], right = line[index]; return (!left || CT.sortValue(game.mode, left) <= value) && (!right || value <= CT.sortValue(game.mode, right)); }
function statusText(game) { return game.turnUid === uid() ? 'Es tu turno' : `Turno de ${game.players?.[game.turnUid]?.alias || 'tu oponente'}`; }
function cardMarkup(game, card) { const era = CT.eraForCard(game.mode, card); return `<div class="turn-duel-card turn-duel-real-card">${CT.categoryBadge(game.mode, card)}<div class="card-visual era-${era.key}">${CT.animalArt(game.mode, card)}<span>${era.symbol}</span><small>${safe(era.name)}</small></div><div class="card-content"><h3>${safe(card?.title || 'Carta')}</h3><p>${safe(card?.detail || '')}</p><div class="year">${safe(CT.formatValue(game.mode, card))}</div></div></div>`; }
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
    ${current.status !== 'finished' && !waiting && mine ? `<div class="turn-duel-countdown" role="timer"><b>${elapsed}s</b><span>de seguridad para jugar este turno</span></div>${cardMarkup(current, card)}<p class="hint">${current.kind === 'cifras' ? safe(CT.Duelo.Cifras.regla(current.mode)?.pregunta || 'Escribe la cifra') : 'Elige el hueco correcto en la línea temporal compartida.'}</p>${current.kind === 'cifras' ? `<input id="turn-cifra-input" type="text" inputmode="numeric" autocomplete="off" placeholder="Tu cifra">` : ''}<button class="btn btn-primary btn-block" data-turn-action="${current.kind === 'cifras' ? 'submit-cifra' : 'place'}">${current.kind === 'cifras' ? 'Enviar cifra' : 'Colocar carta'}</button>` : ''}
    ${current.status !== 'finished' && !mine ? `<div class="turn-duel-wait" role="status"><span aria-hidden="true">⌛</span><b>Esperando al oponente</b><small>Esta pantalla se actualizará automáticamente.</small></div>` : ''}
    ${current.status === 'finished' ? `<p class="lead">${safe(current.resultText || 'Gracias por jugar.')}</p>` : `<small class="turn-duel-progress">Turno ${Math.min(current.turnIndex + 1, current.total)} de ${current.total} · Tu puntuación: ${current.scores?.[uid()] || 0}</small>`}
    <button class="btn btn-ghost btn-block" data-turn-action="back">Volver al menú</button>
  </div></section></div>`;
  document.getElementById('app').innerHTML = html;
  clearInterval(timer); if (mine && current.status !== 'finished') timer = setInterval(() => { if (Date.now() - enteredAt >= TURN_SECONDS * 1000) { clearInterval(timer); current = { ...current, timeout: true }; } render(); }, 250);
}
async function place() {
  if (!current || current.turnUid !== uid() || current.timeout) return notify('El tiempo de seguridad de este turno ha terminado.');
  const card = localCard(current), index = Number(prompt('¿En qué posición de tu línea temporal va la carta?'));
  if (!Number.isInteger(index) || index < 0) return;
  await runTransaction(db, async tx => {
    const ref = doc(db, 'turnDuels', current.id), snap = await tx.get(ref), game = snap.data();
    if (!game || game.turnUid !== uid() || game.turnIndex !== current.turnIndex) throw Error('turno');
    const nextIndex = game.turnIndex + 1, finished = nextIndex >= game.total, ok = correctPlacement(game, card, index), line = [...(game.timeline || [])]; line.splice(Math.max(0, Math.min(index, line.length)), 0, card.id);
    tx.update(ref, { plays: [...(game.plays || []), { uid: uid(), cardId: card.id, index, correct: ok, at: serverTimestamp() }], timeline: line, scores: { ...(game.scores || {}), [uid()]: (game.scores?.[uid()] || 0) + (ok ? 1 : 0) }, turnIndex: nextIndex, turnUid: finished ? null : game.playersOrder[nextIndex % 2], status: finished ? 'finished' : 'playing', updatedAt: serverTimestamp(), resultText: finished ? 'Los dos jugadores han colocado todas las cartas.' : null });
  }).catch(() => notify('El turno ha cambiado o ya se ha jugado. Actualiza la pantalla.'));
}
async function submitCifra() {
  if (!current || current.kind !== 'cifras' || current.turnUid !== uid() || current.timeout) return notify('El tiempo de seguridad de este turno ha terminado.');
  const value = CT.Duelo.Cifras.leer(current.mode, document.getElementById('turn-cifra-input')?.value || '');
  if (value === null) return notify('Escribe una cifra válida.');
  await runTurn({ respuesta: value, ms: 0 });
}
async function runTurn(extra) {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'turnDuels', current.id), snap = await tx.get(ref), game = snap.data();
    if (!game || game.turnUid !== uid() || game.turnIndex !== current.turnIndex) throw Error('turno');
    const card = localCard(game), nextIndex = game.turnIndex + 1, finished = nextIndex >= game.total;
    const points = game.kind === 'cifras' ? CT.Duelo.Cifras.puntosCarta(game.mode, card, extra, CT.Duelo.Cifras.MS) : 0;
    tx.update(ref, { plays: [...(game.plays || []), { uid: uid(), cardId: card.id, ...extra, points, at: serverTimestamp() }], timeline: game.kind === 'cifras' ? (game.timeline || []) : [...(game.timeline || []), card.id], scores: { ...(game.scores || {}), [uid()]: (game.scores?.[uid()] || 0) + (game.kind === 'cifras' ? points : 0) }, turnIndex: nextIndex, turnUid: finished ? null : game.playersOrder[nextIndex % 2], status: finished ? 'finished' : 'playing', updatedAt: serverTimestamp(), resultText: finished ? 'Los dos jugadores han completado todas las cartas.' : null });
  }).catch(() => notify('El turno ha cambiado o ya se ha jugado. Actualiza la pantalla.'));
}
async function create(mode, kind, back) {
  onBack = back; const gameId = id();
  const total = kind === 'cifras' ? CT.Duelo.Cifras.CARTAS : TOTAL;
  const game = { id: gameId, mode, kind, seed: CT.Duelo.crearSemilla(), total, turnIndex: 0, turnUid: null, playersOrder: [uid()], players: { [uid()]: { alias: alias() } }, status: 'waiting', plays: [], timeline: [], scores: { [uid()]: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  shareLink = `${CT.Links?.base?.() || location.origin + location.pathname}#turnoduelo=${gameId}`;
  await setDoc(doc(db, 'turnDuels', gameId), game); current = { ...game, shareLink }; render();
  await navigator.clipboard?.writeText(shareLink).catch(() => {}); notify('Duelo creado. Comparte el enlace con tu rival.');
  subscribe(gameId);
}
async function join(gameId, back) {
  onBack = back; const ref = doc(db, 'turnDuels', gameId); await runTransaction(db, async tx => { const snap = await tx.get(ref); const game = snap.data(); if (!game) throw Error('no encontrado'); if (game.playersOrder.includes(uid())) return; if (game.playersOrder.length >= 2) throw Error('lleno'); game.playersOrder.push(uid()); game.players[uid()] = { alias: alias() }; game.status = 'playing'; game.turnUid = game.playersOrder[0]; game.updatedAt = serverTimestamp(); tx.update(ref, game); }); subscribe(gameId);
}
function subscribe(gameId) { stop?.(); stop = onSnapshot(doc(db, 'turnDuels', gameId), snap => { const next = snap.data(); if (!next) return; const wasPlayingAway = current?.status === 'playing' && current.turnUid !== uid(); const becamePlayable = current?.status === 'waiting' && next.status === 'playing' && next.turnUid === uid(); current = { ...next, id: gameId, shareLink }; if ((wasPlayingAway && current.turnUid === uid()) || becamePlayable) { enteredAt = Date.now(); sessionStorage.setItem(`continuum-turn-entry-${gameId}-${current.turnIndex}`, String(enteredAt)); if (wasPlayingAway) notify('Tu oponente ha colocado una carta. Te toca.'); } render(); }, () => notify('No se pudo sincronizar el duelo.')); const key = `continuum-turn-entry-${gameId}-${current?.turnIndex || 0}`; enteredAt = Number(sessionStorage.getItem(key)) || Date.now(); sessionStorage.setItem(key, String(enteredAt)); document.addEventListener('visibilitychange', leaveGuard); render(); }
async function list() { if (!uid()) return []; const q = query(collection(db, 'turnDuels'), where('playersOrder', 'array-contains', uid()), limit(20)); const snaps = await getDocs(q); return snaps.docs.map(s => ({ ...s.data(), id: s.id })); }
function open({ mode = 'history', kind = 'orden', gameId = '', back } = {}) { onBack = back; shareLink = ''; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); if (gameId) join(gameId, back).catch(() => notify('No se pudo abrir este duelo.')); else create(mode, kind, back).catch(() => notify('No se pudo crear el duelo.')); }
function close() { stop?.(); stop = null; clearInterval(timer); document.removeEventListener('visibilitychange', leaveGuard); current = null; onBack?.(); }
document.addEventListener('click', e => { const action = e.target.closest('[data-turn-action]')?.dataset.turnAction; if (action === 'place') place(); if (action === 'submit-cifra') submitCifra(); if (action === 'share') share(); if (action === 'back') close(); });
CT.TurnDuel = { open, close, list, TURN_SECONDS };
