// Muchos jugadores online a la vez, como prueba que falla: lanza scripts/carga.mjs (bots con el código real de la
// búsqueda de partida, las salas de Retos rápidos y el tablón de mesas, cada uno con su conexión) contra el emulador
// de Firestore y comprueba sus cifras.
//
// - Ráfaga: BOTS personas buscan partida a la vez. Todas se sientan, nadie da error, ninguna mesa se queda con una
//   sola persona ni pasa de su capacidad (las transacciones aguantan los choques) y el 95 % se sienta a tiempo.
// - Tablón: mucha gente mirando la lista de mesas abiertas. Cada consulta lee como mucho 50 mesas
//   (js/online/public-tables.js), así que por encima de ese número las lecturas no crecen con las mesas.
//
// El emulador no reproduce la red ni los índices: el límite de tiempo solo caza atascos (reintentos sin fin,
// transacciones que se pisan); las cifras de verdad salen contra el proyecto de pruebas (docs/BETA_CHECKLIST.md).
// El escenario de jugadores que abandonan a mitad de partida tarda minutos y sigue siendo manual (`npm run carga`).
// CARGA_BOTS cambia el tamaño de la ráfaga (por defecto 60).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import path from 'node:path';
import { REPO } from './lib/comun.mjs';

const BOTS = Number(process.env.CARGA_BOTS) || 60;
const CAPACIDAD = 4;
const LIMITES = { sentarseP95Ms: 20000, erroresPct: 1, lecturasPorConsulta: 50, tablonCrece: 1.2 };

async function carga(...args) {
  const { stdout } = await promisify(execFile)(process.execPath, [path.join(REPO, 'scripts/carga.mjs'), ...args], { cwd: REPO, timeout: 240000, maxBuffer: 1 << 24 });
  return JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1));
}
const errores = r => Object.values(r.errores).reduce((a, b) => a + b, 0);

// ── Ráfaga ──
const rafaga = await carga('--escenario', 'rafaga', '--bots', String(BOTS), '--capacidad', String(CAPACIDAD));
console.log('Ráfaga:', JSON.stringify(rafaga));
assert.ok(100 * errores(rafaga) / BOTS <= LIMITES.erroresPct, `errores en la ráfaga: ${JSON.stringify(rafaga.errores)}`);
assert.equal(rafaga.sentados, BOTS, `se sientan ${rafaga.sentados} de ${BOTS}`);
assert.equal(rafaga.mesasDeUno, 0, `${rafaga.mesasDeUno} mesas con una sola persona`);
const ocupacion = Object.keys(rafaga.reparto).map(Number);
assert.ok(Math.max(...ocupacion) <= CAPACIDAD, `ninguna mesa pasa de ${CAPACIDAD}: ${JSON.stringify(rafaga.reparto)}`);
assert.equal(Object.entries(rafaga.reparto).reduce((t, [n, v]) => t + n * v, 0), BOTS, 'cada persona está en una sola mesa');
assert.ok(rafaga.sentarseMs.p95 < LIMITES.sentarseP95Ms, `el 95 % se sienta en ${rafaga.sentarseMs.p95} ms (límite ${LIMITES.sentarseP95Ms})`);

// ── Tablón con muchas mesas y con más del doble ──
const tablon = mesas => carga('--escenario', 'tablon', '--bots', '30', '--mesas', String(mesas), '--segundos', '15');
const muchas = await tablon(60), masAun = await tablon(150);
console.log('Tablón con 60 mesas:', JSON.stringify(muchas));
console.log('Tablón con 150 mesas:', JSON.stringify(masAun));
for (const r of [muchas, masAun]) {
  assert.equal(errores(r), 0, `errores en el tablón: ${JSON.stringify(r.errores)}`);
  assert.ok(r.consultas > 0, 'el tablón se llega a leer');
  assert.ok(r.lecturas / r.consultas <= LIMITES.lecturasPorConsulta, `${r.mesas} mesas: ${r.lecturas / r.consultas} lecturas por consulta (límite ${LIMITES.lecturasPorConsulta})`);
}
assert.ok(masAun.lecturasPorPersonaYMinuto <= LIMITES.tablonCrece * muchas.lecturasPorPersonaYMinuto,
  `las lecturas del tablón crecen con las mesas: ${muchas.lecturasPorPersonaYMinuto} → ${masAun.lecturasPorPersonaYMinuto} por persona y minuto`);

console.log(`Carga online: OK (${BOTS} personas buscando partida a la vez; p95 para sentarse ${rafaga.sentarseMs.p95} ms en el emulador)`);
