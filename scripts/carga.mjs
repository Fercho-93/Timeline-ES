// Prueba de carga del online con bots: muchas personas buscando partida a la vez, mirando el tablón de mesas o
// desapareciendo a mitad de partida. Usa el código de verdad de la búsqueda y de las salas de Retos rápidos
// (js/retos/quick-online.js, js/retos/quick-room.js) y del tablón (js/online/public-tables.js), cada bot con su
// propia conexión, y mide lo que importa: cuánto se tarda en sentarse, cuántas búsquedas fallan, cuántas mesas se
// quedan con una sola persona, cuántas lecturas cuesta el tablón y si alguna sala se queda parada.
//
// Contra el emulador (lo funcional y la contención de las transacciones; no reproduce la red ni los índices):
//   CARGA="--escenario rafaga --bots 100" npm run carga
//   CARGA="--escenario tablon --bots 200 --mesas 100 --segundos 60" npm run carga
//   CARGA="--escenario fantasmas --bots 12 --fantasmas 0.25" npm run carga
// Contra un proyecto de Firebase de pruebas (nunca el de producción), con las mismas reglas publicadas, la
// autenticación anónima activada y App Check sin exigir:
//   CONTINUUM_FIREBASE_CONFIG='{"apiKey":"…","projectId":"continuum-staging",…}' node scripts/carga.mjs --escenario rafaga --bots 300
//
// Criterios para darlo por bueno (docs/BETA_CHECKLIST.md): sentarse en menos de 5 s en el 95 % de las búsquedas,
// menos del 1 % de errores, ninguna sala parada y lecturas del tablón que no crezcan con el número de mesas.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, where, writeBatch, getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Los parámetros van en la línea de órdenes o, con `npm run carga`, en la variable CARGA.
const args = Object.fromEntries([...process.argv.slice(2), process.env.CARGA || ''].join(' ').split('--').filter(Boolean).map(part => { const [k, ...v] = part.trim().split(/\s+/); return [k, v.join(' ') || 'true']; }));
const ESCENARIO = args.escenario || 'rafaga';
const BOTS = Number(args.bots) || 50;
const CAPACIDAD = args.capacidad === 'cualquiera' ? 'any' : Number(args.capacidad) || 4;
const MESAS = Number(args.mesas) || 50;
const FANTASMAS = Number(args.fantasmas ?? 0.25);
const DURACION = Number(args.segundos) || (ESCENARIO === 'fantasmas' ? 900 : 60);
const CONFIG = process.env.CONTINUUM_FIREBASE_CONFIG ? JSON.parse(process.env.CONTINUUM_FIREBASE_CONFIG) : null;
if (CONFIG && /^timeline-es$/.test(CONFIG.projectId)) { console.error('No se lanza la prueba de carga contra el proyecto de producción.'); process.exit(1); }

// ── El juego, cargado como en las pruebas (tests/quick-online-rules.mjs) ──
const w = {};
for (const p of ['mazos/cards.js', 'mazos/movies.js', 'mazos/music.js', 'mazos/videogames.js', 'mazos/animals.js', 'mazos/lifespan.js', 'mazos/speed.js', 'mazos/inventos.js', 'mazos/mundo.js', 'mazos/astronomy.js', 'mazos/medicine.js', 'mazos/countries.js', 'mazos/population.js', 'mazos/idiomas.js', 'mazos/distances.js',
  'js/juego/modes.js', 'js/juego/engine.js', 'mazos/quick-challenges-data.js', 'js/retos/quick-challenges-engine.js', 'js/jugador/cartera.js', 'js/juego/tournament.js', 'js/juego/final.js', 'js/retos/quick-room.js'])
  vm.runInNewContext(fs.readFileSync(path.join(REPO, p), 'utf8'), { window: w, console });
const CT = w.CONTINUUM, R = CT.QuickRoom, E = CT.QuickEngine;
CT.QuickNetwork = { fingerprint: () => 1, compatible: value => value === 1 };
// Lo que sale del motor (cargado en otro contexto de vm) se pasa a objetos de este contexto: el SDK de Firestore no
// acepta listas de otro «realm».
for (const k of ['create', 'reduce']) { const f = R[k]; R[k] = (...a) => JSON.parse(JSON.stringify(f(...a))); }
const strip = file => fs.readFileSync(path.join(REPO, file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const { queueFresh, STALE_MS } = await import(path.join(REPO, 'js/online/public-matchmaking.js'));
const quickSource = strip('js/retos/quick-online.js');
const tablesSource = strip('js/online/public-tables.js');

// ── Una conexión por bot ──
// Cada ejecución con sus propios nombres: otra anterior contra el mismo emulador ya gastó la cuota de crear sala de
// `bot1`, `bot2`…
let n = 0;
const TANDA = Math.random().toString(36).slice(2, 7);
async function bot() {
  const app = initializeApp(CONFIG || { projectId: 'demo-hilo', apiKey: 'demo' }, `bot-${++n}`);
  const db = getFirestore(app);
  let uid;
  if (CONFIG) uid = (await signInAnonymously(getAuth(app))).user.uid;
  else { connectFirestoreEmulator(db, '127.0.0.1', 8080); uid = `bot${TANDA}${n}`; }
  return { app, db, uid };
}
// Sin servidor de autenticación (emulador solo de Firestore), cada bot se presenta con su uid en el token.
async function botEmulador() {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  const env = globalThis.__env ??= await initializeTestEnvironment({ projectId: 'demo-hilo', firestore: { rules: fs.readFileSync(process.env.CARGA_REGLAS || path.join(REPO, 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 } });
  const uid = `bot${TANDA}${++n}`;
  return { db: env.authenticatedContext(uid).firestore(), uid };
}
const nuevoBot = () => CONFIG ? bot() : botEmulador();
const quickApi = ({ db, uid }) => new Function('auth', 'db', 'collection', 'getDocs', 'query', 'where', 'limit', 'getDoc', 'doc', 'runTransaction', 'onSnapshot', 'serverTimestamp', 'queueFresh', 'window',
  quickSource + '\nreturn {connectPublic, overdue};')({ currentUser: { uid }, authStateReady: async () => {} }, db, collection, getDocs, query, where, limit, getDoc, doc, runTransaction, onSnapshot, serverTimestamp, queueFresh, w);

// ── Medidas ──
const pct = (list, p) => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] : null; };
const errores = new Map();
const apunta = error => { if (process.env.CARGA_DEPURAR) console.error('ERROR', String(error?.message || error).replace(/\s+/g, ' ').slice(0, 400)); const code = error?.code || error?.message || String(error); errores.set(code, (errores.get(code) || 0) + 1); };
const informe = datos => { console.log(JSON.stringify({ escenario: ESCENARIO, bots: BOTS, ...datos, errores: Object.fromEntries(errores) }, null, 2)); };
const espera = ms => new Promise(r => setTimeout(r, ms));

// Un bot que juega: responde al minijuego de quién empieza y, en su turno, coloca una carta al azar, sigue tras el
// resultado y pasa de reto si lleva la mesa. Un fantasma no hace nada (cerró la app).
function jugador(sala, uid, fantasma) {
  let ocupado = false;
  return room => {
    if (fantasma || ocupado || !room) return;
    const accion = room.phase === 'lobby' && room.starter && !(uid in room.starter.guesses) ? { type: 'starter-guess', value: 1900 + Math.floor(Math.random() * 100) }
      : room.actor !== uid ? null
      : room.phase === 'turn' ? (() => { const s = R.state(room); return { type: 'place', cardId: s.remaining[Math.floor(Math.random() * s.remaining.length)], index: Math.floor(Math.random() * (s.timeline.length + 1)) }; })()
      : room.phase === 'result' ? { type: 'ack' } : room.phase === 'round-end' ? { type: 'next' } : null;
    if (!accion) return;
    ocupado = true;
    setTimeout(() => sala.current?.act(accion).catch(apunta).finally(() => { ocupado = false; }), 200 + Math.random() * 1200);
  };
}

async function rafaga() {
  const bots = await Promise.all(Array.from({ length: BOTS }, nuevoBot));
  const tiempos = [], salas = new Map(), conexiones = [];
  const inicio = Date.now();
  await Promise.all(bots.map(async (b, i) => {
    const t0 = Date.now();
    try {
      const api = await quickApi(b).connectPublic({ name: `Bot ${i + 1}`, capacity: CAPACIDAD, onChange: () => {}, onError: apunta });
      tiempos.push(Date.now() - t0); conexiones.push(api);
      salas.set(api.code, (salas.get(api.code) || 0) + 1);
    } catch (error) { apunta(error); }
  }));
  const ocupacion = [...salas.values()];
  informe({
    sentados: tiempos.length, duracionMs: Date.now() - inicio,
    sentarseMs: { p50: pct(tiempos, 50), p95: pct(tiempos, 95), max: pct(tiempos, 100) },
    mesas: ocupacion.length, mesasDeUno: ocupacion.filter(v => v === 1).length,
    reparto: ocupacion.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {})
  });
  conexiones.forEach(c => c.close?.());
}

async function tablon() {
  // Mesas abiertas: cada una la abre un bot con su sala, su cuota y su ficha en la misma operación, como el juego.
  // Los códigos parten de un número al azar: otra ejecución contra el mismo emulador no choca con mesas ajenas.
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', BASE = Math.floor(Math.random() * 32 ** 6) * 1024;
  await Promise.all(Array.from({ length: MESAS }, async (_, i) => {
    const { db, uid } = await nuevoBot();
    const code = 'T' + Array.from({ length: 9 }, (_, k) => ALFABETO[Math.floor((BASE + i) / 32 ** k) % 32]).join('');
    const b = writeBatch(db);
    b.set(doc(db, 'quickRooms', code), { ...R.create(uid, 'Bot', 4), catalog: 1, matchmaking: 'public', updatedAt: serverTimestamp() });
    b.set(doc(db, 'creationQuota', uid), { lastCreatedAt: serverTimestamp(), kind: 'quickRoom', target: code });
    b.set(doc(db, 'publicTables', code), { kind: 'quick', code, mode: 'quick', capacity: 4, seconds: 30, players: 1, names: ['Bot'], hostUid: uid, hostAvatar: null, clientVersion: 1, fingerprint: 1, length: 3, keep: false, updatedAt: serverTimestamp() });
    await b.commit().catch(apunta);
  }));
  const bots = await Promise.all(Array.from({ length: BOTS }, nuevoBot));
  let lecturas = 0, consultas = 0;
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const paradas = bots.map(b => new Function('db', 'collection', 'deleteDoc', 'doc', 'getDoc', 'getDocs', 'limit', 'orderBy', 'query', 'serverTimestamp', 'setDoc', 'Timestamp', 'where', 'STALE_MS', 'window',
    tablesSource + '\nreturn watchTables;')(b.db, collection, async () => {}, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where, STALE_MS, { CONTINUUM: CT })(
    list => { consultas++; lecturas += Math.max(1, list.length); }, apunta));
  await espera(DURACION * 1000);
  paradas.forEach(stop => stop());
  informe({ mesas: MESAS, segundos: DURACION, consultas, lecturas, lecturasPorPersonaYMinuto: Math.round(lecturas / BOTS / (DURACION / 60)) });
}

async function fantasmas() {
  const bots = await Promise.all(Array.from({ length: BOTS }, nuevoBot));
  const vivos = new Map(), salas = new Map();
  await Promise.all(bots.map(async (b, i) => {
    const fantasma = i % Math.max(2, Math.round(1 / FANTASMAS)) === 1;
    const sala = { current: null };
    try {
      const { connectPublic } = quickApi(b);
      sala.current = await connectPublic({ name: `Bot ${i + 1}`, capacity: CAPACIDAD, onChange: (room, _uid, code) => { salas.set(code, room); vivos.get(b.uid)?.(room); }, onError: apunta });
      vivos.set(b.uid, jugador(sala, b.uid, fantasma));
    } catch (error) { apunta(error); }
  }));
  const limite = Date.now() + DURACION * 1000;
  while (Date.now() < limite && [...salas.values()].some(r => r.phase !== 'finished')) await espera(2000);
  const lista = [...salas.values()];
  const paradas = lista.filter(r => r.phase !== 'finished' && r.phase !== 'lobby' && Date.now() - (r.updatedAt?.toMillis?.() || 0) > 2 * ((Number(r.config?.seconds) || 70) + 20) * 1000);
  informe({ fantasmas: FANTASMAS, segundos: DURACION, salas: lista.length, terminadas: lista.filter(r => r.phase === 'finished').length,
    paradas: paradas.length, forzadas: lista.reduce((t, r) => t + (r.commands || []).filter(c => c.forcedBy).length, 0) });
}

try {
  if (ESCENARIO === 'rafaga') await rafaga();
  else if (ESCENARIO === 'tablon') await tablon();
  else if (ESCENARIO === 'fantasmas') await fantasmas();
  else throw Error(`Escenario desconocido: ${ESCENARIO} (rafaga, tablon o fantasmas)`);
} finally {
  await globalThis.__env?.cleanup?.();
}
process.exit(0);
