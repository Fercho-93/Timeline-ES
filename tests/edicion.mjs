// Recorridos que podrían desincronizar la ambientación o bloquear la apertura.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = read('index.html');
function boot({ reduce = false, seen = false, saved = {}, userAgent = null } = {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {
    runScripts: 'outside-only', url: 'https://continuum.test/'
  }).window;
  w.scrollTo = () => {};
  if (userAgent) Object.defineProperty(w.navigator, 'userAgent', { value: userAgent });
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
for (const [userAgent, expected] of [['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'ios'], ['Mozilla/5.0 (Linux; Android 14)', 'android']]) {
  const w = boot({userAgent});
  try { assert.equal(w.document.getElementById('app').dataset.device, expected); }
  finally { w.close(); }
}
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
    click(w, '[data-action="home-encyclopedia"]');
    assert.equal(doc.getElementById('app').dataset.screen, 'enciclopedia');
    assert.equal(doc.querySelector('.home-nav [aria-current="page"]').dataset.action, 'home-encyclopedia');
    click(w, '[data-action="home-top"]');
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
    assert.equal(doc.querySelector('.home-nav [aria-current="page"]').dataset.action, 'home-top');
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
{
  const w = boot({ seen: true });
  const turns = [];
  const bends = [];
  try {
    w.Element.prototype.animate = function (frames) {
      const entry = { frames, cancelled: false };
      if (this.classList.contains('book-turn-leaf')) turns.push(entry);
      if (this.classList.contains('book-turn-sheet') || this.classList.contains('book-turn-front') || this.classList.contains('book-turn-back')) bends.push(entry);
      return { finished: new Promise(() => {}), cancel() { entry.cancelled = true; } };
    };
    click(w, '[data-block="historia"]');
    click(w, '[data-mode="history"]');
    assert.equal(turns[0].frames.at(-1).transform, 'rotate3d(1, -1, 0, 178deg)');
    assert.equal(w.document.querySelector('.book-turn-leaf').style.transformOrigin, 'left top');
    assert.equal(bends.length, 3);
    assert.match(bends[0].frames[1].transform, /translateZ\(45px\)/);
    assert.equal(bends[1].frames[1].borderRadius, '0% 4% 32% 4%');
    assert.equal(w.document.querySelector('.book-turn').getAttribute('aria-hidden'), 'true');
    assert.equal(w.document.querySelector('.book-turn [id]'), null);
    click(w, '#app [data-action="collection-back"]');
    assert.equal(turns[0].cancelled, true);
    assert.ok(bends.slice(0, 3).every(effect => effect.cancelled));
    assert.equal(turns[1].frames.at(-1).transform, 'rotate3d(1, -1, 0, -178deg)');
    assert.equal(w.document.querySelector('.book-turn-leaf').style.transformOrigin, 'right bottom');
    assert.equal(bends[4].frames[1].borderRadius, '32% 4% 0% 4%');
    assert.equal(w.document.querySelectorAll('.book-turn').length, 1);
    w.matchMedia = () => ({ matches: true });
    click(w, '#app [data-mode="history"]');
    assert.equal(w.document.querySelector('.book-turn'), null);
    assert.equal(turns.length, 2, 'movimiento reducido evita el giro');
  } finally { w.close(); }
}
console.log('Paso de página: giro inverso, interrupciones y movimiento reducido: OK');
for (const userAgent of ['Mozilla/5.0 (Linux; Android 14; Samsung)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)']) {
  for (const textSize of ['100', '150', '200']) {
    const w = boot({ userAgent, seen: true, saved: { 'hilo-ajustes-v1': JSON.stringify({ theme: 'auto', textSize }) } });
    try {
      const root = w.document.documentElement;
      assert.equal(root.dataset.platform, userAgent.includes('Android') ? 'android' : 'other');
      assert.equal(root.dataset.textSize, textSize);
      assert.equal(root.style.fontSize, textSize === '100' ? 'var(--normal-text-size, 100%)' : textSize + '%');
    } finally { w.close(); }
  }
}
console.log('Vista Android compacta: detección independiente y ampliación del usuario conservada: OK');
{
  const w = boot({ seen: true });
  const turns = [];
  try {
    w.Element.prototype.animate = function (frames) {
      if (this.classList.contains('book-turn-leaf')) turns.push(frames);
      return { finished: new Promise(() => {}), cancel() {} };
    };
    const render = screen => w.CONTINUUM.paint(w.document.getElementById('app'), '<div class="shell"><h2 data-focus tabindex="-1">Pantalla</h2></div>', screen);
    for (const screen of ['play-menu', 'setup', 'pass', 'game']) render(screen);
    assert.equal(turns.length, 4, 'cada paso hasta la primera mano gira la hoja');
    for (const screen of ['game', 'pass', 'game']) render(screen);
    assert.equal(turns.length, 4, 'las jugadas y los siguientes turnos no giran la hoja');
    render('home'); render('play-menu'); render('solo-home'); render('solo');
    assert.equal(turns.length, 7, 'solitario incluye la entrada a partida');
    render('home'); render('comp-intro'); render('solo');
    assert.equal(turns.length, 9, 'competición incluye el cartel y el inicio');
    render('home'); render('play-menu'); render('online-loading'); render('online-entry'); render('online-lobby'); render('online-game');
    assert.equal(turns.length, 14, 'la preparación online completa usa el efecto');
    render('home'); render('play-menu'); render('setup'); render('play-menu');
    assert.match(turns.at(-1).at(-1).transform, /-178deg/);
  } finally { w.close(); }
}
console.log('Hoja en toda la preparación, sin animar las jugadas posteriores: OK');
{
  const w = boot({ seen: true });
  const effects = [];
  try {
    w.Element.prototype.animate = function (frames, timing) {
      const effect = { frames, timing, target: this, cancelled: false };
      effects.push(effect);
      return { finished: new Promise(() => {}), cancel() { effect.cancelled = true; } };
    };
    click(w, '[data-action="perfil"]');
    assert.ok(w.document.querySelector('.profile-roll-edge'));
    const reveal = effects.find(effect => effect.frames[0].clipPath);
    assert.ok(reveal.target.classList.contains('shell'), 'se desenrolla la hoja completa');
    assert.equal(reveal.timing.duration, 2300);
    assert.equal(w.document.querySelectorAll('.parchment-dust').length, 40);
    assert.match(reveal.frames[1].clipPath, new RegExp(w.innerHeight + 'px'));
    click(w, '[data-action="back-menu"]');
    assert.equal(w.document.querySelector('.profile-roll-edge'), null);
    assert.ok(reveal.cancelled);
    click(w, '[data-action="home-encyclopedia"]');
    assert.ok(w.document.querySelector('.shell.parchment-unrolling'), 'Enciclopedia se despliega como Perfil');
    assert.equal(effects.filter(effect => effect.frames[0].clipPath).at(-1).timing.duration, 2300);
    click(w, '[data-action="home-top"]');
    assert.equal(w.document.querySelector('.profile-roll-edge'), null);
    const originalBounds = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      return this.matches('.home-nav') ? { top: 600, height: 60 } : originalBounds.call(this);
    };
    click(w, '[data-block="historia"]');
    assert.ok(w.document.querySelector('.collection-entry.parchment-unrolling'));
    assert.equal(effects.filter(effect => effect.frames[0].clipPath).at(-1).timing.duration, 3100);
    assert.match(effects.filter(effect => effect.frames[0].clipPath).at(-1).frames.at(-1).clipPath, /600px/);
    assert.equal(effects.filter(effect => effect.target.classList.contains('profile-roll-edge')).at(-1).frames.at(-1).transform, 'translateY(572px)');
    assert.equal(w.document.querySelectorAll('.parchment-dust').length, 0, 'colecciones sin polvo');
    click(w, '[data-block="historia"]');
    assert.equal(w.document.querySelector('.profile-roll-edge'), null);
    click(w, '[data-action="rules"]');
    assert.ok(w.document.querySelector('.rules.parchment-unrolling'));
    assert.equal(w.document.querySelectorAll('.parchment-dust').length, 40, 'guía con polvo');
    click(w, '.guide-close');
    assert.equal(w.document.querySelector('.profile-roll-edge'), null, 'cerrar guía limpia el efecto');
    w.matchMedia = () => ({ matches: true });
    click(w, '[data-action="perfil"]');
    assert.equal(w.document.querySelector('.profile-roll-edge'), null);
  } finally { w.close(); }
}
console.log('Perfil: desenrollado completo, borde móvil y cancelación segura: OK');
