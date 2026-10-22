// Ejecuta un grupo de comprobaciones de tests/suites.mjs (la lista única) y cuenta los fallos.
//
//   npm test                            grupo `juego`, en serie y con su salida completa: se para en el primer fallo
//   npm run test:rapido                 grupo `juego` en paralelo, con tantos procesos como núcleos (máximo 6),
//                                       contando todos los fallos de una vez
//   npm run test:rapido -- duelo cuentas   solo las suites cuya ruta contiene alguna de estas palabras
//   node scripts/run-tests.mjs --grupo reglas --serie   otro grupo (reglas, navegador, e2e, functions)
//   TEST_JOBS=2 npm run test:rapido     fija el número de procesos
import { spawn } from 'node:child_process';
import os from 'node:os';
import { SUITES } from '../tests/suites.mjs';

const args = process.argv.slice(2);
const serie = args.includes('--serie');
const grupoAt = args.indexOf('--grupo');
const grupo = grupoAt >= 0 ? args[grupoAt + 1] : 'juego';
const filters = args.filter((arg, i) => !arg.startsWith('--') && (grupoAt < 0 || i !== grupoAt + 1));
if (!SUITES[grupo]) { console.error(`No existe el grupo «${grupo}». Grupos: ${Object.keys(SUITES).join(', ')}.`); process.exit(2); }
const commands = SUITES[grupo].filter(file => !filters.length || filters.some(f => file.includes(f))).map(file => `node ${file}`);
if (!commands.length) { console.error('Ninguna suite coincide con el filtro.'); process.exit(2); }
const jobs = serie ? 1 : Math.max(1, Number(process.env.TEST_JOBS) || Math.min(6, os.availableParallelism?.() ?? os.cpus().length));

const started = Date.now();
const failures = [];
let next = 0, done = 0;

function run(command) {
  return new Promise(resolve => {
    const t0 = Date.now(), chunks = [];
    // En serie la salida va directa a la consola, como antes con `a && b && c`.
    const child = spawn(command, { shell: true, stdio: serie ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    child.stdout?.on('data', d => chunks.push(d));
    child.stderr?.on('data', d => chunks.push(d));
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
  while (next < commands.length && !(serie && failures.length)) await run(commands[next++]);
}
await Promise.all(Array.from({ length: Math.min(jobs, commands.length) }, worker));

const total = ((Date.now() - started) / 1000).toFixed(0);
if (failures.length) {
  if (!serie) for (const { command, output } of failures) console.log(`\n===== ${command} =====\n${output.split('\n').slice(-40).join('\n')}`);
  console.log(serie
    ? `\nFalla ${failures[0].command} (${done} de ${commands.length} ejecutadas, ${total} s).`
    : `\n${failures.length} de ${commands.length} suites han fallado (${total} s, ${jobs} procesos).`);
  process.exit(1);
}
console.log(`\nTodas pasan (grupo ${grupo}): ${commands.length} en ${total} s${serie ? ', en serie' : ` con ${jobs} procesos`}.`);
