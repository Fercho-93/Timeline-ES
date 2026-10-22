// Cada archivo de tests/ tiene su fila en tests/README.md (hasta ahora faltaban once y nadie lo notaba),
// está en algún grupo de tests/suites.mjs (o es un auxiliar) y la columna «Dónde» dice el grupo de verdad.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { AUXILIARES, SUITES } from './suites.mjs';

const dir = new URL('../tests/', import.meta.url);
const readme = readFileSync(new URL('README.md', dir), 'utf8');
const files = readdirSync(dir).filter(name => /\.(mjs|cjs|js|html)$/.test(name) && name !== 'suites.mjs');
const missing = files.filter(name => !readme.includes(`\`${name}\``));
assert.deepEqual(missing, [], `Faltan filas en tests/README.md para: ${missing.join(', ')}`);
// Y ninguna fila apunta a un archivo que ya no existe.
const rows = [...readme.matchAll(/^\| `([^`]+\.(?:mjs|cjs|js|html))` \| ([^|]+) \|/gm)].map(m => ({ name: m[1], where: m[2].trim() }));
const ghosts = rows.map(row => row.name).filter(name => !files.includes(name));
assert.deepEqual(ghosts, [], `tests/README.md cita archivos que no existen: ${ghosts.join(', ')}`);

// Ninguna suite se queda sin ejecutar en ningún sitio, y ninguna entrada de la lista falta en disco.
const listed = Object.values(SUITES).flat();
const orphans = files.filter(name => !AUXILIARES.includes(name) && !listed.includes(`tests/${name}`));
assert.deepEqual(orphans, [], `Suites que no están en ningún grupo de tests/suites.mjs: ${orphans.join(', ')}`);
const absent = listed.filter(file => !existsSync(new URL(`../${file}`, import.meta.url)));
assert.deepEqual(absent, [], `tests/suites.mjs cita archivos que no existen: ${absent.join(', ')}`);

// «Dónde» en el README: test → juego, reglas, navegador, `test:online-e2e` → e2e, (auxiliar).
const GROUP = { test: 'juego', reglas: 'reglas', navegador: 'navegador', '`test:online-e2e`': 'e2e' };
for (const { name, where } of rows) {
  const key = Object.keys(GROUP).find(k => where === k || where.startsWith(`${k} `));
  if (!key) { assert.ok(AUXILIARES.includes(name), `${name}: «${where}» no es un grupo conocido ni un auxiliar`); continue; }
  assert.ok(SUITES[GROUP[key]].includes(`tests/${name}`), `${name}: el README dice «${where}», pero no está en el grupo ${GROUP[key]} de tests/suites.mjs`);
}
console.log(`OK: ${files.length} archivos de tests/ documentados en tests/README.md y repartidos en tests/suites.mjs.`);
