// Plazos de conservación de functions/retention.js: los usa la limpieza diaria (purgeExpiredData)
// y los cuenta la política de privacidad. Si cambian, hay que cambiar también privacidad.html.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../functions/retention.js');
const DAY = R.DAY, now = Date.parse('2026-10-10T12:00:00Z');

assert.equal(R.RETENTION.rooms, 7 * DAY);
assert.equal(R.RETENTION.turnDuels, 30 * DAY);
assert.equal(R.cutoff('rooms', now).toISOString(), '2026-10-03T12:00:00.000Z', 'una sala sin actividad en siete días se borra');
for (const name of Object.keys(R.ACTIVITY)) assert.ok(R.RETENTION[name] > 0, `${name} tiene plazo`);

assert.equal(R.expiredRankingKey('2026-07-11', now), true, 'el ranking de hace más de 90 días se borra');
assert.equal(R.expiredRankingKey('2026-09-01', now), false, 'el de hace 39 días se conserva');
assert.equal(R.expiredRankingKey('no-es-fecha', now), false);

const guest = days => ({ providerData: [], metadata: { lastRefreshTime: new Date(now - days * DAY).toUTCString() } });
assert.equal(R.staleAnonymous(guest(400), now), true, 'un invitado sin abrir el juego en más de un año se borra');
assert.equal(R.staleAnonymous(guest(200), now), false);
assert.equal(R.staleAnonymous({ ...guest(400), providerData: [{ providerId: 'apple.com' }] }, now), false, 'una cuenta de Apple nunca se borra sola');

// La política de privacidad dice los mismos plazos.
const politica = fs.readFileSync(new URL('../privacidad.html', import.meta.url), 'utf8');
for (const texto of ['siete días', '30 días', '90 días', 'un año']) assert.ok(politica.includes(texto), `la política menciona «${texto}»`);
// PRIVACIDAD.md y privacidad.html cuentan lo mismo: mismas secciones en el mismo orden.
const md = fs.readFileSync(new URL('../PRIVACIDAD.md', import.meta.url), 'utf8');
const secciones = [...politica.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m => m[1].replaceAll('&amp;', '&'));
assert.deepEqual([...md.matchAll(/^## (.+)$/gm)].map(m => m[1]), secciones, 'PRIVACIDAD.md y privacidad.html tienen las mismas secciones');
console.log('Retención: plazos de borrado automático y su reflejo en la política: OK');
