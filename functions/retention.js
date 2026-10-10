// Plazos de conservación: cuánto tiempo se guarda cada cosa desde su última actividad. Los
// recoge la política de privacidad (privacidad.html); si cambian aquí, hay que cambiarlos allí.
const DAY = 86400000;
const RETENTION = Object.freeze({
  rooms: 7 * DAY,             // salas online (y sus subcolecciones: presencia, quién empieza, final)
  quickRooms: 30 * DAY,       // salas y duelos de Retos rápidos: el historial de duelos los muestra un mes
  turnDuels: 30 * DAY,        // duelos por turnos (a los siete días sin jugar ya caducan solos)
  publicTables: DAY,          // fichas del tablón de mesas públicas
  publicQueues: DAY,          // colas de la partida rápida (sin datos personales)
  quickPublicQueues: DAY,
  creationQuota: 7 * DAY,     // registros de la cuota de altas
  roomCreation: 7 * DAY,
  duelNotificationEvents: 30 * DAY,
  duelReminderBudgets: 30 * DAY,
  ranking: 90 * DAY,          // filas del ranking diario y semanal (la tabla enseña ocho semanas)
  anonymousAccounts: 365 * DAY // invitados sin vincular que llevan un año sin abrir el juego
});
// Campo con la última actividad de cada colección.
const ACTIVITY = Object.freeze({
  rooms: 'updatedAt', quickRooms: 'updatedAt', turnDuels: 'updatedAt', publicTables: 'updatedAt',
  publicQueues: 'updatedAt', quickPublicQueues: 'updatedAt', creationQuota: 'lastCreatedAt',
  roomCreation: 'lastCreatedAt', duelNotificationEvents: 'claimedAt', duelReminderBudgets: 'lastSentAt'
});
const cutoff = (collection, now) => new Date(now - RETENTION[collection]);
// Las tablas del ranking van por fecha (`dailyScores/2026-10-09`, `weeklyScores/2026-10-05`): se
// borra la tabla entera cuando su fecha queda fuera del plazo.
function expiredRankingKey(key, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return new Date(`${key}T00:00:00Z`).getTime() < now - RETENTION.ranking;
}
// Un invitado anónimo (sin Apple ni otro acceso) que lleva más del plazo sin abrir el juego.
function staleAnonymous(user, now) {
  if (!user || (user.providerData || []).length) return false;
  const last = Date.parse(user.metadata?.lastRefreshTime || user.metadata?.lastSignInTime || user.metadata?.creationTime || '');
  return Number.isFinite(last) && now - last > RETENTION.anonymousAccounts;
}
module.exports = { DAY, RETENTION, ACTIVITY, cutoff, expiredRankingKey, staleAnonymous };
