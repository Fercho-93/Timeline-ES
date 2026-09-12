import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

// jsdom no calcula la maquetación: estos rectángulos modelan una tira más ancha
// que el móvil, con la confirmación al principio o al final. Se ejecuta paint real.
for (const screen of ['game', 'solo', 'online-game']) {
  for (const index of [0, 12]) {
    const dom = new JSDOM('<div id="app"></div>', {runScripts:'outside-only'});
    const w = dom.window;
    w.CONTINUUM = {};
    w.matchMedia = () => ({matches:true});
    w.scrollTo = () => {};
    for (const file of ['a11y.js', 'mapa.js']) w.eval(fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8'));
    const app = w.document.getElementById('app');
    w.Element.prototype.getBoundingClientRect = function () {
      const wrap = this.closest('.timeline-wrap');
      if (this.matches('.timeline-wrap')) return {left:0,width:360,top:100,height:220};
      if (this.matches('.slot-confirm')) return {left:index * 210 - wrap.scrollLeft,width:150,top:100,height:220};
      return {left:0,width:100,top:0,height:100};
    };
    const board = body => `${w.CONTINUUM.timelineMap('history', [1,2])}<div class="timeline-wrap"><div class="timeline">${body}</div></div>`;
    w.CONTINUUM.paint(app, board(`<button class="slot" data-index="${index}">Hueco</button>`), screen);
    app.querySelector('.slot').focus();
    app.querySelector('[data-timeline-zoom="out"]').click();
    w.CONTINUUM.paint(app, board(`<div class="slot-confirm" data-index="${index}"><button data-autofocus>Confirmar</button></div>`), screen);
    const box = app.querySelector('.slot-confirm').getBoundingClientRect();
    assert.ok(box.left >= 0 && box.left + box.width <= 360, `${screen}: confirmar visible en extremo ${index}`);
    assert.equal(app.querySelector('output').textContent, '100%');
    assert.equal(w.document.activeElement.textContent, 'Confirmar');
    dom.window.close();
  }
}
console.log('OK: confirmar visible y con foco en ambos extremos, en local, solitario y online.');
