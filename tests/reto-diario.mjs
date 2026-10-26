// La marca del reto diario (js/jugador/reto-diario.js): racha, día repetido, saltos de día y recorte del historial.
// Es la misma para Grandes colecciones y Retos rápidos; que cada uno la use bien lo comprueban partida-local y quick-challenges.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../js/jugador/reto-diario.js', import.meta.url), 'utf8'), { window });
const R = window.CONTINUUM.RetoDiario;

assert.equal(R.clave(new Date(2026, 9, 5, 23, 59)), '2026-10-05', 'la clave es la fecha local, con ceros');
assert.equal(R.anterior('2026-03-01'), '2026-02-28', 'el día anterior cruza el mes');
assert.equal(R.anterior('2027-01-01'), '2026-12-31', 'y el año');

let r = R.vacio();
assert.ok(R.registrar(r, '2026-10-01', { hits: 7, total: 10 }), 'el primer día se apunta');
assert.equal(r.streak, 1);
assert.equal(r.best, 7);
assert.ok(R.registrar(r, '2026-10-02', { hits: 5, total: 10 }));
assert.equal(r.streak, 2, 'un día seguido suma a la racha');
assert.equal(r.best, 7, 'la mejor marca no baja');
assert.equal(r.days['2026-10-02'].hits, 5);
assert.ok(r.days['2026-10-02'].finishedAt, 'cada día guarda cuándo se terminó');

// El primer resultado del día es el que vale.
const antes = JSON.stringify(r);
assert.equal(R.registrar(r, '2026-10-02', { hits: 10, total: 10 }), null, 'jugar otra vez el mismo día no se apunta');
assert.equal(JSON.stringify(r), antes, 'y no cambia nada');

// Un día sin jugar rompe la racha.
R.registrar(r, '2026-10-04', { hits: 9, total: 10 });
assert.equal(r.streak, 1, 'saltarse un día la reinicia');
assert.equal(r.lastDay, '2026-10-04');
assert.equal(r.best, 9);

// Un reto empezado ayer y apuntado hoy cuenta contra el día en que se empezó: la racha sigue.
r = R.vacio();
R.registrar(r, '2026-10-01', { hits: 5, total: 10 });
R.registrar(r, '2026-10-02', { hits: 6, total: 10 });
assert.equal(r.streak, 2);

// Solo se conservan los últimos 60 días, y es independiente del orden en que se apunten.
r = R.vacio();
for (let i = 0; i < 70; i++) R.registrar(r, R.clave(new Date(2026, 0, 1 + i)), { hits: 1, total: 10 });
const dias = Object.keys(r.days);
assert.equal(dias.length, R.DIAS_GUARDADOS);
assert.equal(dias[0], R.clave(new Date(2026, 0, 11)), 'se quitan los más antiguos');
assert.equal(r.streak, 70, 'recortar el historial no recorta la racha');

// Los campos propios de cada modo viajan con el día.
r = R.vacio();
R.registrar(r, '2026-10-01', { hits: 3, total: 10, family: 'quick', challenge: 'poker', ms: 1234 });
assert.deepEqual([r.days['2026-10-01'].family, r.days['2026-10-01'].challenge, r.days['2026-10-01'].ms], ['quick', 'poker', 1234]);

// Un día Grandes colecciones y al siguiente Retos rápidos, sin falta: la paridad de AAAAMMDD
// repetía Retos rápidos del 31 al 1. El día del cambio sigue tocando lo mismo que con la regla antigua.
assert.equal(R.familia('2026-10-26'), 'collections', 'el día del cambio no cambia el reto de nadie');
assert.equal(R.familia('2026-10-31'), 'quick');
assert.equal(R.familia('2026-11-01'), 'collections', 'del 31 al 1 se alterna');
for (let fecha = new Date(2026, 9, 26); fecha < new Date(2028, 0, 1); fecha.setDate(fecha.getDate() + 1)) {
  const hoy = R.clave(fecha), ayer = R.anterior(hoy);
  assert.notEqual(R.familia(hoy), R.familia(ayer), `${ayer} y ${hoy} no repiten familia`);
}
console.log('Reto diario: racha, día repetido, saltos, recorte a 60 días, campos propios de cada modo y alternancia de familias: OK');
