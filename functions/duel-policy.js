const DAY = 86400000;
const millis = value => value?.toMillis?.() || (value?.seconds || 0) * 1000;
function lifecycle(game, now) {
  if (!['waiting', 'playing'].includes(game.status)) return null;
  const last = millis(game.updatedAt || game.createdAt);
  if (!last) return null;
  if (now - last >= 7 * DAY) return { type: 'expire' };
  const recipient = game.status === 'playing' ? game.turnUid : game.invitedUid;
  const turnKey = `${game.status}:${game.turnIndex}`;
  if (recipient && now - last >= 2 * DAY && game.remindedTurn !== turnKey) return { type: 'remind', recipient, turnKey };
  return null;
}
function movementMessage(before, after) {
  if (before.turnUid === after.turnUid || !after.turnUid || after.status !== 'playing') return null;
  return { recipient: after.turnUid, title: 'Tu turno en Continuum', body: before.status === 'waiting' ? 'Tu rival ha aceptado el duelo. Puedes empezar.' : 'Tu rival ha terminado su jugada. Te toca.' };
}
module.exports = { DAY, millis, lifecycle, movementMessage };
