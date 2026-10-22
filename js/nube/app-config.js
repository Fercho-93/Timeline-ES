// Cartel remoto: un documento (`appConfig/current`) que solo se escribe desde la consola de Firebase y que
// el juego lee al abrirse. Permite pedir que se actualice una versión demasiado antigua (`minBuild`) o
// pausar las partidas por internet unas horas (`onlineEnabled: false`) sin tocar el modo sin conexión.
// Si no se puede leer (sin red, documento ausente, reglas aún sin publicar) el juego sigue como siempre.
// Campos: minBuild (entero, el número de CT.APP_VERSION), onlineEnabled (false pausa), message (texto
// opcional, hasta 200 caracteres) y updateUrl (enlace https a la tienda, opcional).
// También corta la conexión de quien declara tener menos de 14 años sin permiso (edad.js): modo «minor».
import { auth, db } from './firebase-client.js';
import { doc, getDocFromServer, disableNetwork, enableNetwork } from '../../vendor/firebase/firebase-firestore.js';

const CT = window.CONTINUUM;
const CHECK_EVERY = 5 * 60 * 1000;
const TIMEOUT = 5000;
let started = false, offline = false, lastCheck = 0, current = { mode: 'ok' }, minorDismissed = false;

// `continuum-v749` → 749. Sin número reconocible devuelve 0 y nunca se pide actualizar.
export const buildOf = version => { const match = /-v(\d+)$/.exec(String(version || '')); return match ? Number(match[1]) : 0; };

// Qué hay que hacer con una configuración leída: seguir (ok), pedir actualizar (update) o pausar el online (paused).
export function evaluate(config, build) {
  if (!config || typeof config !== 'object') return { mode: 'ok' };
  const message = typeof config.message === 'string' ? config.message.slice(0, 200) : '';
  const url = typeof config.updateUrl === 'string' && /^https:\/\//.test(config.updateUrl) ? config.updateUrl : '';
  if (Number.isInteger(config.minBuild) && build > 0 && build < config.minBuild) return { mode: 'update', message, url };
  if (config.onlineEnabled === false) return { mode: 'paused', message, url: '' };
  return { mode: 'ok' };
}

const limit = (promise, ms = TIMEOUT) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))]);

async function read() {
  await limit(auth.authStateReady());
  if (!auth.currentUser) return undefined;
  const snapshot = await limit(getDocFromServer(doc(db, 'appConfig', 'current')));
  return snapshot.exists() ? snapshot.data() : null;
}

function style() {
  if (document.getElementById('app-config-style')) return;
  const node = document.createElement('style');
  node.id = 'app-config-style';
  node.textContent = '.app-config-banner{position:fixed;z-index:9000;left:12px;right:12px;top:max(8px,env(safe-area-inset-top));padding:10px 14px;border-radius:10px;background:#3d2815;color:#f7dfaa;border:1px solid #c08a47;font:600 14px/1.4 system-ui,sans-serif;text-align:center;pointer-events:none}'
    + '.app-config-update{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;padding:24px;background:rgba(20,14,8,.88)}'
    + '.app-config-card{max-width:380px;padding:28px 22px;border-radius:16px;background:#fffdf8;color:#231f1a;text-align:center;font:16px/1.5 system-ui,sans-serif}'
    + '.app-config-card h2{margin:0 0 10px;font-family:Georgia,serif}.app-config-card p{margin:0 0 18px}'
    + '.app-config-card a,.app-config-card button{display:block;width:100%;box-sizing:border-box;margin-top:10px;padding:12px;border-radius:10px;font:700 16px system-ui,sans-serif;text-decoration:none}'
    + '.app-config-card a{background:#b65331;color:#fff;border:0}.app-config-card button{background:transparent;color:#675d51;border:1px solid #d7cdbd}'
    + '.app-config-minor{position:fixed;z-index:9000;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));padding:12px 14px;border-radius:12px;background:#3d2815;color:#f7dfaa;border:1px solid #c08a47;font:500 14px/1.4 system-ui,sans-serif}'
    + '.app-config-minor p{margin:0 0 8px}.app-config-minor button{margin:4px 8px 0 0;padding:8px 12px;border-radius:8px;border:1px solid #c08a47;background:transparent;color:#f7dfaa;font:700 14px system-ui,sans-serif}';
  document.head.append(node);
}

function clear() { document.querySelectorAll('.app-config-banner,.app-config-update,.app-config-minor').forEach(node => node.remove()); }

function show(state) {
  clear();
  if (state.mode === 'ok') return;
  style();
  if (state.mode === 'minor') {
    if (minorDismissed) return;
    const box = document.createElement('div');
    box.className = 'app-config-minor';
    box.setAttribute('role', 'status');
    const text = document.createElement('p');
    text.textContent = 'Sin el permiso de tu madre, padre o tutor, Continuum funciona sin conexión: sin partidas online ni ranking, y tu progreso se guarda solo en este dispositivo.';
    const allow = document.createElement('button'); allow.type = 'button'; allow.textContent = 'Ya tengo su permiso';
    allow.onclick = () => { CT.Edad?.fijar?.('permiso'); };
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Entendido';
    ok.onclick = () => { minorDismissed = true; box.remove(); };
    box.append(text, allow, ok);
    document.body.append(box);
    return;
  }
  if (state.mode === 'paused') {
    const banner = document.createElement('div');
    banner.className = 'app-config-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = state.message || 'Las partidas por internet están en pausa un rato. El modo sin conexión funciona con normalidad.';
    document.body.append(banner);
    return;
  }
  const native = window.Capacitor?.isNativePlatform?.() === true;
  const overlay = document.createElement('div');
  overlay.className = 'app-config-update';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'app-config-title');
  const card = document.createElement('div');
  card.className = 'app-config-card';
  const title = document.createElement('h2'); title.id = 'app-config-title'; title.textContent = 'Hay una versión nueva de Continuum';
  const text = document.createElement('p');
  text.textContent = state.message || (native ? 'Esta versión ya no puede conectarse. Actualiza desde la tienda de aplicaciones para volver a jugar con otras personas.' : 'Esta versión ya no puede conectarse. Actualiza para volver a jugar con otras personas.');
  card.append(title, text);
  const href = state.url || (native ? '' : 'actualizar.html');
  if (href) {
    const link = document.createElement('a'); link.href = href; link.textContent = 'Actualizar';
    if (state.url) { link.target = '_blank'; link.rel = 'noopener'; }
    card.append(link);
  }
  const later = document.createElement('button'); later.type = 'button'; later.textContent = 'Seguir sin conexión';
  later.onclick = () => overlay.remove();
  card.append(later);
  overlay.append(card);
  document.body.append(overlay);
  (card.querySelector('a') || later).focus();
}

async function setNetwork(enabled) {
  try { await (enabled ? enableNetwork(db) : disableNetwork(db)); offline = !enabled; } catch { /* sin efecto: el juego sigue */ }
}

// Lee el cartel y actúa. Cualquier fallo de lectura deja el juego como está (y, si estaba en pausa, lo reabre).
export async function check() {
  lastCheck = Date.now();
  // Menor sin permiso: ni siquiera se lee el cartel, para no abrir la conexión.
  if (CT.Edad && !CT.Edad.permiteOnline()) {
    current = { mode: 'minor' };
    show(current);
    // Si aparecía en el ranking, se retira antes de cortar la conexión (borra sus filas del servidor).
    if (!offline && CT.Accounts?.rankingPublico === true) { try { await CT.Accounts.setRanking(false); } catch { /* se reintenta al volver */ } }
    if (!offline) await setNetwork(false);
    return current;
  }
  if (offline) await setNetwork(true);
  let config;
  try { config = await read(); } catch { config = undefined; }
  const state = evaluate(config, buildOf(CT.APP_VERSION));
  current = state;
  show(state);
  if (state.mode !== 'ok') await setNetwork(false);
  return state;
}

export async function start() {
  if (started) return false;
  started = true;
  // La edad se pregunta una vez, antes de abrir nada online (edad.js); cambiarla vuelve a comprobar.
  await CT.Edad?.preguntar?.();
  document.addEventListener('continuum:edad', () => { minorDismissed = false; check(); });
  await check();
  setInterval(() => { if (document.visibilityState !== 'hidden') check(); }, CHECK_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > CHECK_EVERY) check();
  });
  return true;
}

CT.AppConfig = { start, check, get state() { return current; } };
