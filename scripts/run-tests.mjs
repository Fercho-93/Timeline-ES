// Ejecuta en paralelo las órdenes de `npm test` (la lista de package.json) y cuenta todos los fallos de una vez.
// `npm test` sigue siendo la referencia (en serie, se para en el primer fallo); esto es para iterar más rápido.
//
//   npm run test:rapido                 todas, con tantos procesos como núcleos (máximo 6)
//   npm run test:rapido -- duelo cuentas   solo las órdenes cuyo texto contiene alguna de estas palabras
//   TEST_JOBS=2 npm run test:rapido     fija el número de procesos
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const filters = process.argv.slice(2);
const commands = pkg.scripts.test.split(' && ').map(c => c.trim()).filter(Boolean)
  .filter(c => !filters.length || filters.some(f => c.includes(f)));
if (!commands.length) { console.error('Ninguna orden coincide con el filtro.'); process.exit(2); }
const jobs = Math.max(1, Number(process.env.TEST_JOBS) || Math.min(6, os.availableParallelism?.() ?? os.cpus().length));

const started = Date.now();
const failures = [];
let next = 0, done = 0;

function run(command) {
  return new Promise(resolve => {
    const t0 = Date.now(), chunks = [];
    const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => chunks.push(d));
    child.stderr.on('data', d => chunks.push(d));
    child.on('close', code => {
      const seconds = ((Date.now() - t0) / 1000).toFixed(1);
      done++;
      console.log(`${code === 0 ? 'ok   ' : 'FALLA'} [${done}/${commands.length}] ${command.replace(/^node /, '')} (${seconds} s)`);
      if (code !== 0) failures.push({ command, output: Buffer.concat(chunks).toString('utf8') });
      resolve();
    });
  });
}

async function worker() {
  while (next < commands.length) await run(commands[next++]);
}
await Promise.all(Array.from({ length: Math.min(jobs, commands.length) }, worker));

const total = ((Date.now() - started) / 1000).toFixed(0);
if (failures.length) {
  for (const { command, output } of failures) console.log(`\n===== ${command} =====\n${output.split('\n').slice(-40).join('\n')}`);
  console.log(`\n${failures.length} de ${commands.length} órdenes han fallado (${total} s, ${jobs} procesos).`);
  process.exit(1);
}
console.log(`\nTodas las órdenes pasan: ${commands.length} en ${total} s con ${jobs} procesos.`);
