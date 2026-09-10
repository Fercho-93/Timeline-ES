// Recorridos que podrían desincronizar la ambientación o bloquear la apertura.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = read('index.html');
function boot({ reduce = false, seen = false, saved = {} } = {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {
    runScripts: 'outside-only', url: 'https://continuum.test/'
  }).window;
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: reduce });
  for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
  if (seen) w.localStorage.setItem('continuum-splash-seen-v2', '1');
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
  return w;
}
const click = (w, selector) => {
  const node = w.document.querySelector(selector);
  assert.ok(node, selector); node.click();
};
{
  const w = boot();
  try {
    for (const block of Object.values(w.CONTINUUM.BLOCKS)) {
      click(w, `[data-block="${block.key}"]`);
      click(w, `[data-mode="${block.games[0]}"]`);
      assert.equal(w.document.documentElement.dataset.scene, block.art);
      click(w, '[data-action="solo"]');
      click(w, '[data-action="start-free"]');
      assert.equal(w.document.documentElement.dataset.scene, block.art);
      assert.ok(w.document.querySelector('.hand-card'), 'el ambiente no sustituye la partida');
      click(w, '[data-action="solo-menu"]');
      click(w, '[data-action="back-menu"]');
      click(w, '[data-action="collection-back"]');
      assert.equal(w.document.documentElement.dataset.scene, 'archive');
    }
    click(w, '[data-action="start-competition"]');
    const saved = JSON.parse(w.localStorage.getItem('continuum-competition-v1'));
    const expected = w.CONTINUUM.blockOf(saved.queue[0]).art;
    assert.equal(w.document.documentElement.dataset.scene, expected, 'el cartel usa el tema siguiente');
    assert.ok(w.document.querySelector('.chapter-art img').getAttribute('src').startsWith('assets/hero-'));
    click(w, '[data-action="comp-next-round"]');
    assert.equal(w.document.documentElement.dataset.scene, expected, 'cartel y mesa comparten tema');
  } finally { w.close(); }
}
for (const options of [{ reduce: true }, { seen: true }]) {
  const w = boot(options);
  try { assert.ok(!w.document.documentElement.classList.contains('splash-active')); }
  finally { w.close(); }
}
{
  const w = boot();
  try {
    await new Promise(resolve => w.setTimeout(resolve, 0));
    assert.ok(w.document.documentElement.classList.contains('splash-active'));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    assert.equal(w.document.getElementById('app-splash'), null, 'el teclado retira la apertura');
    assert.ok(w.document.querySelector('[data-action="rules"]'), 'la aplicación sigue disponible');
  } finally { w.close(); }
}
{
  const w = boot({ seen: true });
  try {
    const doc = w.document;
    click(w, '[data-action="perfil"]');
    click(w, '[data-action="home-collection"]');
    assert.equal(doc.getElementById('app').dataset.screen, 'home');
    assert.equal(doc.querySelector('.home-nav [aria-current="page"]').dataset.action, 'home-collection');
    click(w, '[data-block="historia"]');
    click(w, '[data-mode="history"]');
    click(w, '[data-action="solo"]');
    const folds = [...doc.querySelectorAll('.solo-fold')];
    assert.equal(folds.length, 3);
    assert.ok(folds.every(fold => !fold.open && fold.querySelector('summary')));
    folds[0].open = true;
    folds[0].dispatchEvent(new w.Event('toggle'));
    folds[1].open = true;
    folds[1].dispatchEvent(new w.Event('toggle'));
    assert.equal(folds[0].open, false);
    click(w, '[data-action="back-menu"]');
    assert.equal(doc.getElementById('app').dataset.screen, 'play-menu');
    click(w, '[data-format="multi"]');
    click(w, '[data-action="setup"]');
    click(w, '[data-action="back-menu"]');
    assert.equal(doc.getElementById('app').dataset.screen, 'play-menu');
    click(w, '[data-action="collection-back"]');
    assert.equal(doc.querySelector('.home-nav [aria-current="page"]').dataset.action, 'home-collection');
    click(w, '[data-action="home-top"]');
    assert.equal(doc.querySelector('.home-nav [aria-current="page"]').dataset.action, 'home-top');
  } finally { w.close(); }
}
{
  const key = 'continuum-competition-v1';
  let w = boot({ seen: true });
  let saved;
  try {
    click(w, '[data-action="start-competition"]');
    assert.equal(w.document.querySelector('.hand-card'), null);
    click(w, '[data-action="comp-next-round"]');
    saved = w.localStorage.getItem(key);
  } finally { w.close(); }
  w = boot({ seen: true, saved: { [key]: saved } });
  try {
    click(w, '[data-action="resume-competition"]');
    assert.ok(w.document.querySelector('.comp-splash'));
    assert.equal(w.document.querySelector('.hand-card'), null);
    const before = JSON.parse(saved);
    assert.equal(w.document.documentElement.dataset.scene, w.CONTINUUM.blockOf(before.solo.mode).art);
    click(w, '[data-action="comp-confirm-resume"]');
    const after = JSON.parse(w.localStorage.getItem(key));
    assert.deepEqual(after.queue, before.queue);
    assert.equal(after.solo.current, before.solo.current);
    assert.ok(w.document.querySelector('.hand-card'));
  } finally { w.close(); }
}
console.log('Edición: ambientes, navegación, menús plegables y confirmación de competición: OK');
