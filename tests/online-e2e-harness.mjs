// Arnés de extremo a extremo para «Jugar online»: la aplicación real (index.html con
// cuentas, online.js, matchmaking) en Chromium, contra los emuladores de Auth y
// Firestore con las reglas reales. El SDK de Firebase se sirve desde node_modules en vez
// de gstatic, y firebase-client.js se conecta a los emuladores.
// Requiere: firebase emulators:start --only auth,firestore (auth 9099, firestore 8080).
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? (await import('node:url')).pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.html': 'text/html' };
const CLIENT = `import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
export const firebaseApp = getApps().length ? getApp() : initializeApp({ apiKey: 'demo-key', authDomain: 'timeline-es.firebaseapp.com', projectId: 'timeline-es', appId: '1:1:web:1' });
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
if (!globalThis.__emu) { globalThis.__emu = true; connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }
auth.languageCode = 'es';`;

export async function startHarness() {
  const server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/firebase-client.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(CLIENT); return; }
      const f = path.join(root, p === '/' ? 'index.html' : p);
      let body = await fs.readFile(f);
      // La política de seguridad solo deja hablar con googleapis: se abre a los emuladores.
      if (f.endsWith('index.html')) body = body.toString().replace(/connect-src /, "connect-src http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080 ");
      res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  async function player(label, { viewport = { width: 390, height: 844 } } = {}) {
    const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce', deviceScaleFactor: 1 });
    await ctx.route(/https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/([\w-]+\.js)$/, async route => {
      const name = route.request().url().split('/').pop();
      // Una sola versión en todas las URLs: si no, firebase-app se cargaría dos veces.
      const body = (await fs.readFile(path.join(root, 'node_modules/firebase', name), 'utf8')).replace(/firebasejs\/[\d.]+\//g, 'firebasejs/12.15.0/');
      route.fulfill({ contentType: 'text/javascript', body });
    });
    const page = await ctx.newPage();
    const log = [];
    page.on('pageerror', e => log.push(`pageerror ${e.message}`));
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.push(`${m.type()} ${m.text()}`); });
    page.on('dialog', d => d.accept());
    await page.goto(url);
    const screen = () => page.evaluate(() => document.getElementById('app')?.dataset.screen);
    const text = () => page.evaluate(() => document.getElementById('app')?.innerText || '');
    const shot = name => page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/${label}-${name}.png`, fullPage: true });
    const click = async (sel, opts = {}) => { const el = page.locator(sel).filter({ visible: true }).first(); await el.waitFor({ timeout: opts.timeout || 8000 }); await el.scrollIntoViewIfNeeded(); await el.click(); await page.waitForTimeout(opts.wait ?? 300); };
    const waitScreen = (s, timeout = 15000) => page.waitForFunction(v => (Array.isArray(v) ? v : [v]).includes(document.getElementById('app')?.dataset.screen), s, { timeout });
    // Entrar como una persona nueva: tocar la portada y escribir el nombre de la bienvenida.
    const enter = async name => {
      await page.locator('#splash-play').waitFor({ state: 'attached', timeout: 20000 });
      await page.evaluate(() => document.getElementById('splash-play').click());
      await waitScreen(['bienvenida', 'home'], 30000);
      if (await screen() === 'bienvenida') {
        await page.fill('#bienvenida-nombre', name);
        await page.locator('[data-bienvenida] button[type="submit"]').click();
        await waitScreen('home', 20000);
      }
      await page.waitForTimeout(500);
    };
    return { label, page, ctx, log, screen, text, shot, click, waitScreen, enter };
  }
  return { url, browser, player, async close() { await browser.close(); server.close(); } };
}
