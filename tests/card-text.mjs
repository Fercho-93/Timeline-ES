import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const css = read('edition.css');
const rule = css.match(/:is\(\.hand-card, \.timeline-card, \.slot-confirm-card, \.drag-card-preview\)[^{]+\{([^}]+)\}/)?.[1];
assert.ok(rule, 'las cartas comparten la regla de palabras completas');
for (const property of ['overflow-wrap: normal', 'word-break: normal', '-webkit-hyphens: none', 'hyphens: none']) {
  assert.ok(rule.includes(`${property} !important`), property);
}

// JSDOM no calcula medidas: simulamos el ancho de una palabra entera para probar
// el ajuste y la recuperación del tamaño al ampliar la pantalla, sin dividir el texto.
const window = new JSDOM('<style>strong {font-size: 20px}</style><div id="app"></div>', {runScripts: 'outside-only'}).window;
try {
  window.CONTINUUM = {};
  window.matchMedia = () => ({matches: true});
  const frames = new Map(); let next = 0;
  window.requestAnimationFrame = callback => {frames.set(++next, callback); return next;};
  window.cancelAnimationFrame = id => frames.delete(id);
  const flush = () => {const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());};
  window.eval(read('immersion.js'));
  const app = window.document.querySelector('#app');
  for (const screen of ['game', 'local-game', 'online-game', 'quick-game']) {
    app.dataset.screen = screen;
    app.innerHTML = '<div class="shell"><section><div class="hand"><button class="hand-card"><strong>Electroencefalograma</strong></button></div></section></div>';
    const text = app.querySelector('strong');
    let width = 100;
    Object.defineProperties(text, {
      clientWidth: {get: () => width}, clientHeight: {get: () => 30},
      scrollWidth: {get: () => Math.ceil(parseFloat(window.getComputedStyle(text).fontSize) * 14)},
      scrollHeight: {get: () => 20}
    });
    window.CONTINUUM.UI.mount(app, screen); flush();
    assert.ok(parseFloat(text.style.fontSize) < 20, `${screen}: reduce una palabra que no cabe`);
    assert.ok(text.scrollWidth <= text.clientWidth, `${screen}: la palabra cabe en el recuadro`);
    assert.equal(text.textContent, 'Electroencefalograma', 'conserva el texto completo');
    width = 300;
    window.dispatchEvent(new window.Event('resize')); flush();
    assert.equal(text.style.fontSize, '', `${screen}: recupera el tamaño normal cuando cabe`);
  }
  console.log('Texto de cartas: palabras enteras, ajuste y recuperación correctos.');
} finally {window.close();}
