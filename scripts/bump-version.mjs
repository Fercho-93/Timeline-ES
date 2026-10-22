// Sube la versión de caché en los tres sitios a la vez: `CACHE` del service worker, `CT.APP_VERSION` de
// updates.js y los `?v=` de edition.css y tablet.css en index.html (tests/version-cache.mjs los vigila).
//
//   node scripts/bump-version.mjs          sube una sobre la mayor de la copia local y de origin/main
//   node scripts/bump-version.mjs 812      fija esa versión (debe ser mayor que la actual)
//
// Hay que lanzarlo después del último `git fetch origin main` y justo antes de commitear (CLAUDE.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = name => path.join(root, name);
const SW = 'service-worker-258.js', UPDATES = 'updates.js', INDEX = 'index.html';
const PATTERNS = {
  [SW]: /(const CACHE = "continuum-v)(\d+)(")/,
  [UPDATES]: /(CT\.APP_VERSION = "continuum-v)(\d+)(")/,
};
const SHEETS = ['edition', 'tablet'];

const read = name => readFileSync(file(name), 'utf8');
const versionIn = (text, pattern) => Number(text.match(pattern)?.[2] ?? NaN);

function remoteVersion() {
  try {
    const text = execFileSync('git', ['show', `origin/main:${SW}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return versionIn(text, PATTERNS[SW]);
  } catch { return NaN; }
}

const current = [versionIn(read(SW), PATTERNS[SW]), versionIn(read(UPDATES), PATTERNS[UPDATES]), remoteVersion()].filter(Number.isFinite);
if (current.length < 2) throw new Error('No encuentro la versión actual en el service worker o en updates.js.');
const highest = Math.max(...current);
const requested = process.argv[2] === undefined ? highest + 1 : Number(process.argv[2]);
if (!Number.isInteger(requested) || requested <= highest) {
  throw new Error(`La versión nueva (${process.argv[2] ?? 'siguiente'}) tiene que ser un entero mayor que ${highest}, la más alta entre esta copia y origin/main.`);
}

for (const name of [SW, UPDATES]) {
  const text = read(name);
  if (!PATTERNS[name].test(text)) throw new Error(`No encuentro la versión en ${name}.`);
  writeFileSync(file(name), text.replace(PATTERNS[name], `$1${requested}$3`));
}
let index = read(INDEX);
for (const sheet of SHEETS) {
  const pattern = new RegExp(`(href="${sheet}\\.css\\?v=)\\d+(")`);
  if (!pattern.test(index)) throw new Error(`No encuentro ${sheet}.css?v= en ${INDEX}.`);
  index = index.replace(pattern, `$1${requested}$2`);
}
writeFileSync(file(INDEX), index);
console.log(`Versión de caché: continuum-v${requested} (antes v${highest}).`);
