// Superficie de escritura y borrado de firestore.rules, sin emulador: lee el archivo y comprueba lo que nunca debe
// cambiar sin que alguien lo decida a propósito. Una regla de borrado nueva, un `write` abierto o una escritura sin
// sesión hacen fallar esta prueba; para añadir un borrado legítimo hay que apuntarlo en DELETES, con su motivo.
import assert from 'node:assert/strict';
import fs from 'node:fs';

// RULES_FILE permite comprobar otro archivo (por ejemplo, una copia con un fallo a propósito).
const source = fs.readFileSync(process.env.RULES_FILE ?? new URL('../firestore.rules', import.meta.url), 'utf8');

// Quita los comentarios `//` respetando las comillas.
function stripComments(text) {
  let out = '', quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { out += c; if (c === '\\') out += text[++i] ?? ''; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  return out;
}
// Lee hasta el cierre de la llave que acaba de abrirse (`start` apunta justo después de ella), respetando comillas.
function blockEnd(text, start) {
  let depth = 1, quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  throw new Error('Llave sin cerrar en firestore.rules');
}
function statementEnd(text, start) {
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') quote = c;
    else if (c === ';') return i;
  }
  throw new Error('Regla sin punto y coma');
}

const text = stripComments(source);
const allows = [], functions = new Map();
function walk(from, to, path) {
  let i = from;
  while (i < to) {
    const rest = text.slice(i, to);
    let m;
    if ((m = /^\s*match\s+(\S+)\s*\{/.exec(rest))) {
      const open = i + m[0].length, close = blockEnd(text, open);
      walk(open, close, path + m[1]);
      i = close + 1;
    } else if ((m = /^\s*function\s+(\w+)\s*\([^)]*\)\s*\{/.exec(rest))) {
      const open = i + m[0].length, close = blockEnd(text, open);
      functions.set(m[1], text.slice(open, close));
      i = close + 1;
    } else if ((m = /^\s*allow\s+([\w\s,]+?)\s*(?::\s*if\s+|;)/.exec(rest))) {
      const open = i + m[0].length, end = m[0].endsWith(';') ? i + m[0].length - 1 : statementEnd(text, open);
      allows.push({ path: path.replace('/databases/{database}/documents', '') || '/', methods: m[1].split(',').map(x => x.trim()), condition: text.slice(open, end).trim() || 'true' });
      i = end + 1;
    } else {
      i += Math.max(1, rest.search(/\S/) + 1 || rest.length);
    }
  }
}
walk(text.indexOf('service cloud.firestore') >= 0 ? text.indexOf('{', text.indexOf('service cloud.firestore')) + 1 : 0, text.length, '');
assert.ok(allows.length > 60, `se han leído ${allows.length} reglas allow`);

// 1. Nada es público: ninguna regla se concede con `if true`.
const open = allows.filter(a => a.condition === 'true');
assert.deepEqual(open, [], 'ninguna regla allow es incondicional');

// 2. Nada de `write` salvo cerrado: `write` junta crear, actualizar y borrar, y esconde lo que concede.
const writes = allows.filter(a => a.methods.includes('write') && a.condition !== 'false');
assert.deepEqual(writes, [], 'ningún allow write abierto: cada operación lleva su propia regla');

// 3. Toda escritura exige sesión (directamente o por una función auxiliar que la exija).
const authFunctions = new Set();
for (let changed = true; changed;) {
  changed = false;
  for (const [name, body] of functions) {
    if (authFunctions.has(name)) continue;
    if (/request\.auth/.test(body) || /\bregistered\(\)/.test(body) || [...authFunctions].some(f => new RegExp(`\\b${f}\\(`).test(body))) { authFunctions.add(name); changed = true; }
  }
}
const needsAuth = condition => /request\.auth/.test(condition) || /\bregistered\(\)/.test(condition) || [...authFunctions].some(f => new RegExp(`\\b${f}\\(`).test(condition));
const mutating = allows.filter(a => a.condition !== 'false' && a.methods.some(m => ['create', 'update', 'delete', 'write'].includes(m)));
const anonymousWrites = mutating.filter(a => !needsAuth(a.condition)).map(a => `${a.path} (${a.methods})`);
assert.deepEqual(anonymousWrites, [], 'toda escritura exige sesión iniciada');

// 4. Superficie de borrado: la lista exacta de lo que un cliente puede borrar, y quién.
const DELETES = {
  '/quickRooms/{code}': 'quien lleva la sala',
  '/duelPreferences/{player}/blocked/{rival}': 'su dueño, al desbloquear',
  '/duelPreferences/{player}/archived/{gameId}': 'su dueño, al desarchivar',
  '/playerNames/{key}': 'su dueño, solo si el perfil ya no usa ese nombre',
  '/playerProfiles/{uid}': 'su dueño, solo soltando el nombre en la misma operación',
  '/playerProfiles/{uid}/pushTokens/{tokenId}': 'su dueño',
  '/playerProgress/{uid}': 'su dueño, solo al borrar la cuenta (el perfil desaparece en la misma operación)',
  '/socialRanking/{uid}': 'su dueño',
  '/dailyScores/{day}/players/{uid}': 'su dueño, fila del ranking diario',
  '/weeklyScores/{week}/players/{uid}': 'su dueño, fila del ranking semanal',
  '/discoveryScores/{uid}': 'su dueño, al dejar el ranking',
  '/dailyRanking/{uid}': 'su dueño',
  '/publicTables/{code}': 'quien la lleva, o cualquiera si está abandonada (ficha efímera de un día)',
  '/creationQuota/{owner}': 'su dueño, pasados 10 s',
  '/roomCreation/{owner}': 'su dueño, pasados 30 s',
  '/rooms/{roomId}/presence/{playerId}': 'cada participante, la suya',
  '/rooms/{roomId}/starter/{playerId}': 'cada participante, la suya',
  '/rooms/{roomId}': 'quien lleva la sala',
};
const deletable = allows.filter(a => a.condition !== 'false' && a.methods.some(m => m === 'delete')).map(a => a.path).sort();
assert.deepEqual(deletable, Object.keys(DELETES).sort(), 'la lista de lo que un cliente puede borrar es exactamente la aprobada');

// 5. Lo que ningún cliente toca: informes, configuración remota y capacidades no se escriben ni se listan.
for (const path of ['/reports/{reportId}', '/appConfig/current', '/capabilities/secretFinal', '/capabilities/multiCompetition']) {
  const rules = allows.filter(a => a.path === path);
  assert.ok(rules.length, `${path} tiene reglas`);
  assert.ok(rules.every(a => !a.methods.includes('update') && !a.methods.includes('delete') || a.condition === 'false'), `${path}: ningún cliente actualiza ni borra`);
}
// Las colecciones del servidor (avisos, presupuestos de recordatorio) no tienen ninguna regla: quedan cerradas.
for (const name of ['duelNotificationEvents', 'duelReminderBudgets']) assert.ok(!allows.some(a => a.path.startsWith(`/${name}`)), `${name} sin reglas: solo el servidor`);
console.log(`OK: ${allows.length} reglas leídas; sin escrituras abiertas ni sin sesión; ${Object.keys(DELETES).length} borrados aprobados.`);
