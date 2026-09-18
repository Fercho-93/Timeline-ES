import {gameHtml} from './game-fixture.mjs';
// Recorridos que podrían desincronizar la ambientación o bloquear la apertura.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = gameHtml(read('index.html'));
function boot({ reduce = false, darkScheme = false, seen = false, saved = {}, userAgent = null } = {}) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {
    runScripts: 'outside-only', url: 'https://continuum.test/'
  }).window;
  w.scrollTo = () => {};
  if (userAgent) Object.defineProperty(w.navigator, 'userAgent', { value: userAgent });
  w.Element.prototype.scrollIntoView = () => {};
  w.matchMedia = query => ({ matches: query.includes('prefers-color-scheme') ? darkScheme : reduce });
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
    // El ambiente de cada colección se prueba con todo el catálogo a mano: aquí se mira
    // qué se ve al jugar, y un mazo cerrado no se juega. Que la puerta cerrada esté bien
    // puesta es cosa de `cartera.mjs`.
    w.CONTINUUM.Cartera.concede({ origen: 'prueba' });
    for (const block of Object.values(w.CONTINUUM.BLOCKS)) {
      click(w, `[data-block="${block.key}"]`);
      click(w, `[data-mode="${block.games[0]}"]`);
      assert.equal(w.document.documentElement.dataset.scene, block.art);
      click(w, '[data-action="solo"]');
      click(w, '[data-action="start-free"]');
      assert.equal(w.document.documentElement.dataset.scene, block.art);
      assert.ok(w.document.querySelector('.hand-card'), 'el ambiente no sustituye la partida');
      // Ninguna lámina en la mano: situaría la carta en su época sin saber nada del hecho
      // que cuenta, y eso vale para los treinta y pico mazos por igual. En su sitio va el
      // reverso de la colección, el mismo para todas sus cartas.
      assert.equal(w.document.querySelector('.hand .animal-card-art'), null, `${block.key}: la mano no enseña láminas`);
      assert.ok(w.document.querySelector('.hand img').getAttribute('src').startsWith('assets/hero-'), `${block.key}: solo se usa la portada común`);
      assert.ok(w.document.querySelector('.hand .carta-reverso .reverso-coleccion'), `${block.key}: la mano enseña el reverso del mazo`);
      click(w, '[data-action="ui-back"]');
      click(w, '[data-exit-confirm]');
      click(w, '[data-action="back-menu"]');
      click(w, '[data-action="collection-back"]');
      assert.equal(w.document.documentElement.dataset.scene, 'archive');
    }
    click(w, '[data-action="competition-menu"]'); click(w, '[data-action="start-competition"]');
    const saved = JSON.parse(w.localStorage.getItem('continuum-competition-v1'));
    const expected = w.CONTINUUM.blockOf(saved.queue[0]).art;
    assert.equal(w.document.documentElement.dataset.scene, expected, 'el cartel usa el tema siguiente');
    assert.ok(w.document.querySelector('.chapter-art img').getAttribute('src').startsWith('assets/hero-'));
    click(w, '[data-action="comp-next-round"]');
    assert.equal(w.document.documentElement.dataset.scene, expected, 'cartel y mesa comparten tema');
  } finally { w.close(); }
}
{
  const w = boot();
  try {
    // Cada colección tiene su portada, que es lo que hace que el reverso diga de qué se
    // está jugando sin decir nada de la carta que tapa.
    const reversos = Object.values(w.CONTINUUM.BLOCKS).map(block => w.CONTINUUM.cardBack(block.games[0]));
    assert.equal(new Set(reversos).size, reversos.length, 'cada colección trae su propia portada');
    for (const reverso of reversos) {
      assert.match(reverso, /class="carta-reverso" aria-hidden="true"/, 'el reverso no se lee en voz alta');
      assert.match(reverso, /src="assets\/hero-[a-z]+-400\.webp"/, 'el reverso usa la portada común de la colección');
    }
    // Y la lámina no desaparece del juego: la enseñan la carta ya colocada —donde su
    // valor está a la vista y no hay nada que adivinar— y la enciclopedia.
    const conLamina = w.CONTINUUM.cards('history').find(card => w.CONTINUUM.cardArt('history', card));
    assert.match(w.CONTINUUM.animalArt('history', conLamina), /<img class="animal-card-art"/, 'la carta colocada sigue enseñando su lámina');
  } finally { w.close(); }
}
// Reloj virtual: la lectura mínima, el arranque lento y el límite de espera
// se comprueban sin hacer esperar veinte segundos a cada ejecución.
function splashClock(reduce = false) {
  const w = new JSDOM('<div id="app-splash"></div><main id="app">Juego listo</main>', {runScripts:'outside-only'}).window;
  let time = 0, id = 0;
  const timers = new Map();
  w.performance.now = () => time;
  w.matchMedia = () => ({matches:reduce});
  w.setTimeout = (callback, delay = 0) => { timers.set(++id, {callback, at:time + delay}); return id; };
  w.clearTimeout = id => timers.delete(id);
  Object.defineProperty(w.document, 'readyState', {value:'complete'});
  w.eval(read('splash.js'));
  const advance = ms => {
    const end = time + ms;
    for (;;) {
      const next = [...timers].sort((a,b) => a[1].at-b[1].at)[0];
      if (!next || next[1].at > end) break;
      timers.delete(next[0]); time = next[1].at; next[1].callback();
    }
    time = end;
  };
  return {w, advance, active:()=>w.document.documentElement.classList.contains('splash-active')};
}
for (const reduce of [false, true]) {
  const {w, advance, active} = splashClock(reduce);
  try {
    advance(100); w.CONTINUUM_SPLASH.show(); w.CONTINUUM_SPLASH.finish();
    advance(3399);
    assert.ok(active(), 'una carga rápida mantiene tiempo para leer');
    w.CONTINUUM_SPLASH.finish(); // la segunda notificación no prolonga el mínimo
    advance(1);
    if (!reduce) {
      assert.ok(w.document.getElementById('app-splash').classList.contains('splash-exit'));
      assert.ok(w.document.getElementById('app').classList.contains('app-arrive'), 'la pantalla de detrás se aclara mientras el telón se disuelve');
      advance(1099); assert.ok(active()); advance(1);
    }
    assert.ok(!active(), 'el splash cierra tras lectura y fundido');
    assert.equal(w.document.getElementById('app-splash').getAttribute('aria-hidden'), 'true');
  } finally { w.close(); }
}
{
  // La puerta de entrada: el juego no entra solo, entra cuando alguien pulsa «Jugar».
  // Ese toque es además lo único que deja al navegador encender el audio, así que el
  // botón tiene que estar antes de que se monte nada y esperar lo que haga falta.
  const {w, advance, active} = splashClock();
  try {
    let ambiente = true;
    const cambios = [];
    w.CONTINUUM = {
      effectPrefs: () => ({ambience: ambiente}),
      setAmbience: enabled => { ambiente = enabled; cambios.push(enabled); }
    };
    let abierto = false;
    w.CONTINUUM_SPLASH.gate().then(() => { abierto = true; });
    await new Promise(resolve => setImmediate(resolve));
    const boton = w.document.getElementById('splash-play');
    assert.ok(boton, 'la portada ofrece el botón de jugar');
    assert.equal(boton.textContent, 'Jugar');
    const sonido = w.document.getElementById('splash-ambience');
    assert.ok(sonido, 'la primera pantalla permite decidir la música');
    assert.equal(sonido.tagName, 'BUTTON', 'la elección es un botón sutil, no un bloque de opciones');
    assert.equal(sonido.getAttribute('aria-pressed'), 'true', 'el control refleja la configuración guardada');
    assert.equal(sonido.getAttribute('aria-label'), 'Desactivar música ambiente');
    sonido.click();
    assert.deepEqual(cambios, [false], 'la elección actualiza la misma configuración de audio');
    assert.equal(sonido.getAttribute('aria-pressed'), 'false');
    assert.equal(sonido.getAttribute('aria-label'), 'Activar música ambiente');
    advance(20000);
    assert.ok(active(), 'esperar a una persona no dispara el aviso de carga lenta');
    boton.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(abierto, 'pulsar abre el juego');
    assert.ok(!w.document.getElementById('splash-actions'), 'y los controles dejan paso');
    w.CONTINUUM_SPLASH.entering();
    assert.equal(w.document.getElementById('splash-status').textContent, 'Entrando al juego…');
    w.CONTINUUM_SPLASH.finish();
    advance(1199); assert.ok(active(), 'el segundo telón se ve un momento');
    advance(1); advance(1100);
    assert.ok(!active(), 'y se disuelve sin repetir la lectura entera de la portada');
  } finally { w.close(); }
}
{
  const arranque = read('boot.js');
  assert.match(arranque, /CONTINUUM_SPLASH\?\.gate\(\)/, 'el arranque espera al botón');
  assert.ok(arranque.indexOf('gate()') < arranque.indexOf('startAccounts('), 'y lo espera antes de montar la cuenta');
  assert.match(arranque, /Ambience\?\.sync\(true\)/, 'y aprovecha ese toque para encender la música');
}
{
  const {w, advance, active} = splashClock();
  try {
    advance(6000); assert.ok(active(), 'una carga lenta no descubre una pantalla vacía');
    w.CONTINUUM_SPLASH.finish(); advance(1100);
    assert.ok(!active(), 'una carga lenta no añade otros 3,5 segundos');
    w.CONTINUUM_SPLASH.show();
    w.document.getElementById('app').textContent = '';
    advance(20000);
    assert.ok(!active(), 'el arranque bloqueado libera la pantalla');
    assert.ok(w.document.getElementById('splash-retry'), 'se puede reintentar');
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
    // Reto diario, partida libre y duelo por enlace. El duelo es uno solo: sus dos
    // modalidades se eligen dentro, no son dos opciones del menú.
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
    click(w, '[data-action="competition-menu"]'); click(w, '[data-action="start-competition"]');
    assert.equal(w.document.querySelector('.hand-card'), null);
    click(w, '[data-action="comp-next-round"]');
    saved = w.localStorage.getItem(key);
  } finally { w.close(); }
  w = boot({ seen: true, saved: { [key]: saved } });
  try {
    click(w, '[data-action="competition-menu"]'); click(w, '[data-action="resume-competition"]');
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
  try {
    w.Element.prototype.animate = function (frames) {
      const entry = { frames, cancelled: false };
      if (this.classList.contains('camera-move-frame')) turns.push(entry);
      return { finished: new Promise(() => {}), cancel() { entry.cancelled = true; } };
    };
    click(w, '[data-block="historia"]');
    click(w, '[data-mode="history"]');
    assert.ok(w.document.querySelector('.camera-move'), 'el mazo entra con un giro de cámara');
    const style = w.document.createElement('style');
    style.textContent = '#app .snapshot-probe { width: 28px; height: 28px; display: none; }';
    w.document.head.append(style);
    const probe = w.document.createElement('span');
    probe.className = 'snapshot-probe';
    w.document.getElementById('app').append(probe);
    click(w, '[data-action="solo"]');
    const frozen = w.document.querySelector('.camera-move-copy .snapshot-probe');
    assert.equal(w.getComputedStyle(frozen).width, '28px', 'la cámara conserva tamaños que dependían de #app');
    assert.equal(w.getComputedStyle(frozen).display, 'none', 'un icono oculto no reaparece al mover la cámara');
    assert.equal(w.document.querySelectorAll('.camera-move-view').length, 2, 'origen y destino conviven en un mismo escenario');
    assert.ok(turns[1].frames.every(frame => !('opacity' in frame)), 'el viaje no funde ninguna de las dos vistas');
    assert.match(turns[1].frames.at(-1).transform, /translate3d\(-100vw/);
    assert.equal(w.document.querySelector('.camera-move-frame').dataset.direction, 'forward');
    assert.equal(w.document.querySelector('.camera-move').getAttribute('aria-hidden'), 'true');
    assert.equal(w.document.querySelector('.camera-move [id]'), null);
    click(w, '#app [data-action="back-menu"]');
    assert.equal(turns[1].cancelled, true);
    assert.match(turns[2].frames.at(-1).transform, /translate3d\(0vw/);
    assert.equal(w.document.querySelector('.camera-move-frame').dataset.direction, 'back');
    assert.equal(w.document.querySelectorAll('.camera-move').length, 1);
    w.matchMedia = () => ({ matches: true });
    click(w, '#app [data-action="solo"]');
    assert.equal(w.document.querySelector('.camera-move'), null);
    assert.equal(turns.length, 3, 'movimiento reducido evita el giro');
  } finally { w.close(); }
}
console.log('Movimiento de cámara: giro inverso, interrupciones y movimiento reducido: OK');
for (const userAgent of ['Mozilla/5.0 (Linux; Android 14; Samsung)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)']) {
  for (const textSize of ['100', '150', '200']) {
    const w = boot({ userAgent, seen: true, saved: { 'hilo-ajustes-v1': JSON.stringify({ theme: 'light', textSize }) } });
    try {
      const root = w.document.documentElement;
      assert.equal(root.dataset.platform, userAgent.includes('Android') ? 'android' : 'other');
      assert.equal(root.dataset.textSize, textSize);
      assert.equal(root.style.fontSize, textSize === '100' ? 'var(--normal-text-size, 100%)' : textSize + '%');
    } finally { w.close(); }
  }
}
console.log('Vista Android compacta: detección independiente y ampliación del usuario conservada: OK');
// Los dos temas. Lo que se elige tiene que llegar al elemento raíz, a las dos etiquetas
// de color de la barra del navegador y al almacenamiento.
{
  const ASPECTOS = ['light', 'dark'];
  const COLORES = { light: '#f3eee4', dark: '#18110b' };
  const colores = w => [...w.document.querySelectorAll('meta[name="theme-color"]')].map(m => m.getAttribute('content'));
  for (const theme of ASPECTOS) {
    const w = boot({ seen: true, saved: { 'hilo-ajustes-v1': JSON.stringify({ theme, textSize: '100' }) } });
    try {
      const root = w.document.documentElement;
      assert.equal(root.dataset.theme, theme, `el aspecto ${theme} llega al elemento raíz`);
      assert.deepEqual(colores(w), [COLORES[theme], COLORES[theme]], `${theme} fija las dos etiquetas`);
      // El desplegable ofrece solo Claro y Oscuro y llega marcando el que está puesto.
      w.document.querySelector('[data-settings-action="open"]').click();
      const opciones = [...w.document.querySelectorAll('#ajuste-tema option')];
      assert.deepEqual(opciones.map(o => o.value), ASPECTOS);
      assert.equal(w.document.querySelector('#ajuste-tema option[selected]').value, theme);
      assert.ok(opciones.every(o => o.textContent.trim()), 'cada aspecto tiene su nombre');
      assert.equal(w.document.querySelectorAll('#ajuste-tema optgroup').length, 0, 'dos opciones directas, sin grupos vacíos');
    } finally { w.close(); }
  }
  const estilos = read('edition.css') + read('styles.css');
  for (const theme of ASPECTOS.filter(t => t !== 'light')) {
    assert.ok(estilos.includes(`[data-theme="${theme}"]`), `el aspecto ${theme} tiene paleta en la hoja de estilo`);
  }
  // Elegir se ve primero en la muestra; la apariencia solo cambia al confirmarla.
  {
    const w = boot({ seen: true });
    try {
      w.document.querySelector('[data-settings-action="open"]').click();
      const select = w.document.querySelector('#ajuste-tema');
      select.value = 'dark';
      select.dispatchEvent(new w.Event('change', { bubbles: true }));
      assert.equal(w.document.documentElement.dataset.theme, 'light');
      assert.equal(w.document.querySelector('[data-look-preview]').dataset.previewTheme, 'dark');
      w.document.querySelector('[data-settings-action="apply-look"]').click();
      assert.equal(w.document.documentElement.dataset.theme, 'dark');
      assert.equal(colores(w).join('|'), '#18110b|#18110b');
      assert.equal(JSON.parse(w.localStorage.getItem('hilo-ajustes-v1')).theme, 'dark');
      // Y un valor que no existe no llega a aplicarse: el aspecto anterior se queda.
      select.value = 'inventado';
      select.dispatchEvent(new w.Event('change', { bubbles: true }));
      assert.equal(w.document.documentElement.dataset.theme, 'dark');
    } finally { w.close(); }
  }
  // Las seis preferencias anteriores migran una sola vez a su equivalente más cercano,
  // sin perder el tamaño de texto ni el resto de ajustes.
  for (const [legacy, expected, darkScheme = false] of [
    ['auto', 'light'], ['auto', 'dark', true], ['sepia', 'light'],
    ['contrast', 'light'], ['night', 'dark'], ['retirado', 'light']
  ]) {
    const w = boot({ darkScheme, seen: true, saved: { 'hilo-ajustes-v1': JSON.stringify({ theme: legacy, textSize: '150', ambience: true }) } });
    try {
      assert.equal(w.document.documentElement.dataset.theme, expected, `${legacy} migra a ${expected}`);
      const migrated = JSON.parse(w.localStorage.getItem('hilo-ajustes-v1'));
      assert.deepEqual(migrated, { theme: expected, textSize: '150', ambience: true });
      assert.deepEqual(colores(w), [COLORES[expected], COLORES[expected]]);
    } finally { w.close(); }
  }
}
console.log('Temas: selección Claro/Oscuro, barra del navegador y migración de preferencias: OK');
// El atajo al inicio es el único botón de la barra que es un dibujo y no una palabra, así
// que necesita su propia caja. Se le escapó una vez: el tamaño estaba puesto en styles.css
// y lo pisaba la barra agrupada del móvil, que aprieta todos sus botones y les quita el
// ancho mínimo. Esto fija las dos cosas a la vez —que ese aprieto sigue existiendo y que
// el del atajo le gana—, porque comprobar solo la caja dejaría pasar el mismo fallo.
{
  const w = boot({ seen: true });
  try {
    click(w, '[data-block="historia"]'); click(w, '[data-mode="history"]');
    const boton = w.document.querySelector('.home-nav [data-action="home-top"]');
    assert.ok(boton, 'la casa vive en el menú inferior');
    assert.ok(boton.querySelector('svg[aria-hidden="true"]'), 'icono de casa dibujado');
    assert.equal(w.document.querySelector('.brand-mark'), null, 'sin rosa de los vientos de navegación');
    assert.ok(w.document.querySelector('.topbar .atlas-back'), 'flecha de vuelta a la izquierda');
  } finally { w.close(); }
}
console.log('Atajo al inicio: marca dibujada, caja propia y especificidad que gana a la barra agrupada: OK');
{
  const w = boot({ seen: true });
  const turns = [];
  try {
    w.Element.prototype.animate = function (frames) {
      if (this.classList.contains('camera-move-frame')) turns.push(frames);
      return { finished: new Promise(() => {}), cancel() {} };
    };
    const render = screen => w.CONTINUUM.paint(w.document.getElementById('app'), '<div class="shell"><h2 data-focus tabindex="-1">Pantalla</h2></div>', screen);
    for (const screen of ['play-menu', 'setup', 'pass', 'game']) render(screen);
    assert.equal(turns.length, 4, 'el mazo y la preparación avanzan con el giro de cámara');
    for (const screen of ['game', 'pass', 'game']) render(screen);
    assert.equal(turns.length, 4, 'las jugadas y los siguientes turnos no mueven toda la cámara');
    render('home'); render('play-menu'); render('solo-home'); render('solo');
    assert.equal(turns.length, 7, 'solitario incluye la entrada a partida');
    render('home'); render('comp-intro'); render('solo');
    assert.equal(turns.length, 9, 'competición incluye el cartel y el inicio');
    render('home'); render('play-menu'); render('online-loading'); render('online-entry'); render('online-lobby'); render('online-game');
    assert.equal(turns.length, 14, 'la preparación online completa usa el efecto');
    render('home'); render('play-menu'); render('setup'); render('play-menu');
    assert.equal(turns.length, 17);
    assert.match(turns.at(-1).at(-1).transform, /translate3d\(0vw/);
  } finally { w.close(); }
}
console.log('Cámara en toda la preparación, sin animar las jugadas posteriores: OK');
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
    assert.ok(w.document.querySelector('.dialog-enter .settings-modal.enc-modal[role="dialog"]'), 'Enciclopedia se despliega como Ajustes');
    assert.ok(w.document.querySelector('.enc-background[inert]'), 'el fondo no recibe pulsaciones');
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
    assert.equal(w.document.querySelector('[data-overlay="encyclopedia"]'), null);
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
