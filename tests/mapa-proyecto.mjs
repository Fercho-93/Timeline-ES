// MAPA_DEL_PROYECTO.md explica cada archivo del juego (CLAUDE.md manda a él). Se quedó sin
// `reto-diario.js` ni `starter-presentation.js` y nadie lo notó: aquí se comprueba que cada
// script de js/ y cada hoja de css/ salen en el mapa, y que el mapa no cita ninguno que ya no exista.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const repo = new URL('../', import.meta.url);
const mapa = readFileSync(new URL('MAPA_DEL_PROYECTO.md', repo), 'utf8');
const enDisco = carpeta => readdirSync(new URL(carpeta, repo), { recursive: true }).filter(name => /\.(js|css)$/.test(name));

const scripts = enDisco('js/'), hojas = enDisco('css/');
const sinMapa = [...scripts, ...hojas].map(name => name.split('/').pop()).filter(name => !mapa.includes(`\`${name}\``));
assert.deepEqual(sinMapa, [], `MAPA_DEL_PROYECTO.md no explica: ${sinMapa.join(', ')}`);

// Lo que el mapa pone en la tabla de cada carpeta de js/ tiene que estar en esa carpeta.
const nombres = new Set(scripts.map(name => name.split('/').pop()));
for (const [, carpeta, cuerpo] of mapa.matchAll(/^### `js\/([^`]+)\/`[^\n]*\n([\s\S]*?)(?=^#)/gm)) {
  const citados = [...cuerpo.matchAll(/^\| ([^|]+) \|/gm)].flatMap(m => [...m[1].matchAll(/`([^`]+\.js)`/g)].map(x => x[1]));
  const fantasmas = citados.filter(name => !readdirSync(new URL(`js/${carpeta}/`, repo)).includes(name));
  assert.deepEqual(fantasmas, [], `MAPA_DEL_PROYECTO.md pone en js/${carpeta}/ archivos que no están ahí: ${fantasmas.join(', ')}`);
  citados.forEach(name => nombres.delete(name));
}
assert.deepEqual([...nombres], [], `Scripts que el mapa no pone en la tabla de su carpeta: ${[...nombres].join(', ')}`);
console.log(`MAPA_DEL_PROYECTO.md: ${scripts.length} scripts y ${hojas.length} hojas, todos en su sitio`);
