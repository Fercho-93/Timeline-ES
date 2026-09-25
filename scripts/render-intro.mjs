// Graba docs/promo/intro.html en vídeo vertical (1080×1920, 30 fps).
// Detiene todas las animaciones CSS y las sitúa fotograma a fotograma, así el
// resultado no depende de la velocidad de la máquina.
//
//   node scripts/render-intro.mjs [salida.mp4] [--sin-musica]
//
// Necesita Playwright (o PLAYWRIGHT_MODULE) y FFmpeg (o FFMPEG con su ruta).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const output = resolve(args.find(arg => !arg.startsWith('--')) ?? join(ROOT, 'docs/promo/continuum-intro.mp4'));
const withMusic = !args.includes('--sin-musica');
const FPS = 30, DURATION = 8.5, SCALE = 2;
const MUSIC = join(ROOT, 'assets/audio/v1.mp3');

// La máscara del destello necesita servir la página por HTTP, no desde file://.
const TYPES = { '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: SCALE });
await page.goto(`${base}/docs/promo/intro.html?render`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
  window.seek(0);
});
const stage = page.locator('.stage');

const audioInput = withMusic ? ['-i', MUSIC] : [];
const audioOutput = withMusic
  ? ['-map', '0:v', '-map', '1:a', '-af', `afade=t=in:d=0.8,afade=t=out:st=${DURATION - 1.6}:d=1.6`, '-c:a', 'aac', '-b:a', '160k', '-shortest']
  : [];
const ffmpeg = spawn(process.env.FFMPEG ?? 'ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  ...audioInput,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  ...audioOutput,
  '-t', String(DURATION),
  output,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const finished = new Promise((done, fail) => ffmpeg.on('close', code => code === 0 ? done() : fail(new Error(`ffmpeg terminó con código ${code}`))));

const frames = Math.round(FPS * DURATION);
for (let frame = 0; frame < frames; frame++) {
  await page.evaluate(ms => window.seek(ms), (frame * 1000) / FPS);
  const png = await stage.screenshot({ type: 'png', animations: 'allow' });
  if (!ffmpeg.stdin.write(png)) await new Promise(done => ffmpeg.stdin.once('drain', done));
  if (frame % FPS === 0) process.stdout.write(`\r${Math.round((frame / frames) * 100)} %`);
}
ffmpeg.stdin.end();
await finished;
await browser.close();
server.close();
console.log(`\rVídeo listo: ${output}`);
