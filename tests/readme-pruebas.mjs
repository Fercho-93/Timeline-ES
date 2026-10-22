// Cada archivo de tests/ tiene su fila en tests/README.md (hasta ahora faltaban once y nadie lo notaba).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../tests/', import.meta.url);
const readme = readFileSync(new URL('README.md', dir), 'utf8');
const files = readdirSync(dir).filter(name => /\.(mjs|cjs|js)$/.test(name));
const missing = files.filter(name => !readme.includes(`\`${name}\``));
assert.deepEqual(missing, [], `Faltan filas en tests/README.md para: ${missing.join(', ')}`);
// Y ninguna fila apunta a un archivo que ya no existe.
const listed = [...readme.matchAll(/^\| `([^`]+\.(?:mjs|cjs|js))` \|/gm)].map(m => m[1]);
const ghosts = listed.filter(name => !files.includes(name));
assert.deepEqual(ghosts, [], `tests/README.md cita archivos que no existen: ${ghosts.join(', ')}`);
console.log(`OK: ${files.length} archivos de tests/ documentados en tests/README.md.`);
