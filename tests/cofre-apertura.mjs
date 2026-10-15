// El acceso inicial ya no debe depender del antiguo cofre, de su vídeo ni del almacenamiento.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source = fs.readFileSync(new URL('../splash.js', import.meta.url), 'utf8');
for (const returning of [false, true]) {
  const dom = new JSDOM('<div id="app-splash"></div><main id="app">Juego</main>', {url:'https://intro.test/', runScripts:'outside-only'});
  const w = dom.window, requests = [];
  if (returning) w.localStorage.setItem('continuum-caja-abierta-v1', '1');
  w.fetch = url => { requests.push(url); throw Error('La intro no necesita descargar un vídeo'); };
  w.eval(source);
  w.CONTINUUM_SPLASH.show();
  const gate = w.CONTINUUM_SPLASH.gate();
  assert.equal(w.document.querySelector('.splash-caja-escena, video'), null);
  assert.equal(w.document.documentElement.classList.contains('splash-caja'), false);
  assert.ok(w.document.getElementById('splash-play'));
  assert.ok(w.document.getElementById('splash-guide'));
  w.document.getElementById('splash-play').click();
  await gate;
  assert.deepEqual(requests, []);
  dom.window.close();
}
console.log('Intro directa: primera visita y regreso, sin cofre ni vídeo previo: OK');
