import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(new URL('../js/interfaz/a11y.js', import.meta.url), 'utf8');
function boot(reduce = false) {
  const w = new JSDOM('<main id="app"><section class="collection-entry"><button data-action="test">Explorar</button><p>Contenido visible</p></section></main>', { runScripts: 'outside-only', pretendToBeVisual: true }).window;
  w.matchMedia = () => ({ matches: reduce });
  w.CONTINUUM = {};
  const effects = [];
  w.Element.prototype.animate = function () {
    let resolve, reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const effect = { target: this, cancelled: 0, finished, finish: resolve,
      cancel() { this.cancelled++; reject(new Error('cancelled')); } };
    effects.push(effect);
    return effect;
  };
  w.eval(source);
  return { w, sheet: w.document.querySelector('.collection-entry'), effects };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
{
  const {w, sheet, effects} = boot();
  try {
    w.CONTINUUM.unrollCollection(sheet);
    assert.equal(effects.length, 2);
    assert(sheet.classList.contains('motion-entering'));
    effects.forEach(effect => effect.finish());
    await settle();
    assert(effects.every(effect => effect.cancelled === 1), 'se liberan todas las capas de entrada al terminar');
    assert(!sheet.classList.contains('motion-entering'));
    assert(sheet.classList.contains('motion-managed'), 'CSS no vuelve a arrancar la entrada');
    assert.equal(sheet.style.opacity, '', 'no se guarda un estado transparente inline');
  } finally { w.close(); }
}
{
  const {w, sheet, effects} = boot();
  try {
    w.CONTINUUM.unrollCollection(sheet);
    const first = effects.slice();
    w.CONTINUUM.unrollCollection(sheet);
    assert(first.every(effect => effect.cancelled === 1), 'otra entrada cancela la anterior una sola vez');
    await settle();
    assert(sheet.classList.contains('motion-entering'), 'la entrada anterior no limpia la nueva');
    effects.slice(2).forEach(effect => effect.finish());
    await settle();
    assert(!sheet.classList.contains('motion-entering'));
    assert(effects.every(effect => effect.cancelled === 1));
  } finally { w.close(); }
}
{
  const {w, sheet, effects} = boot(true);
  try {
    w.CONTINUUM.unrollCollection(sheet);
    assert.equal(effects.length, 0);
    assert(!sheet.classList.contains('motion-entering'));
    assert.equal(sheet.querySelector('button').textContent, 'Explorar');
  } finally { w.close(); }
}
console.log('Scroll estable: entradas terminadas/interrumpidas liberadas; movimiento reducido conserva contenido.');
