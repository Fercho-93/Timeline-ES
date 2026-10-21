// Tabletas: el diseño adaptable (tablet.css) y cuándo la mesa deja de escalarse como un iPhone.
// - Móvil y ordenador con ratón: la mesa a escala, como siempre.
// - Tableta vertical: sigue la mesa a escala (cabe entera a lo alto y las cartas salen grandes).
// - Tableta horizontal: la partida usa las medidas reales, con dos columnas (tablet.css).
// Girar la tableta en plena partida cambia de un modo al otro.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function entorno({width, height, coarse = true}) {
  const dom = new JSDOM('<div id="app" class="atlas-board"></div>', {runScripts: 'outside-only'});
  const w = dom.window;
  const medidas = {width, height};
  const poner = (ancho, alto) => { medidas.width = ancho; medidas.height = alto; Object.defineProperty(w, 'innerWidth', {value: ancho, configurable: true}); Object.defineProperty(w, 'innerHeight', {value: alto, configurable: true}); };
  poner(width, height);
  // La consulta que usa mesa-escala.js: pantalla táctil de al menos 700 × 600.
  w.matchMedia = consulta => ({get matches() { return consulta.includes('pointer: coarse') ? coarse && medidas.width >= 700 && medidas.height >= 600 : false; }, addEventListener() {}});
  w.CONTINUUM = {};
  w.eval(read('mesa-escala.js'));
  const app = w.document.getElementById('app');
  return {w, app, CT: w.CONTINUUM, atributo: () => w.document.documentElement.getAttribute('data-tablet'), gira: (ancho, alto) => { poner(ancho, alto); w.dispatchEvent(new w.Event('resize')); }};
}

{
  // Móvil: mesa a escala y sin marca de tableta.
  const {app, CT, atributo} = entorno({width: 390, height: 844});
  assert.equal(atributo(), null);
  CT.Mesa.aplica(app, true);
  assert.equal(CT.Mesa.activa(), true);
  assert.equal(CT.Mesa.tablet(), false);
}
{
  // Ordenador con ratón (aunque la ventana sea grande): la mesa a escala de siempre.
  const {app, CT, atributo} = entorno({width: 1280, height: 900, coarse: false});
  assert.equal(atributo(), null);
  CT.Mesa.aplica(app, true);
  assert.equal(CT.Mesa.activa(), true, 'el ordenador conserva la mesa escalada');
}
{
  // Tableta vertical (iPad 11"): mesa a escala.
  const {app, CT, atributo} = entorno({width: 834, height: 1194});
  assert.equal(atributo(), 'vertical');
  CT.Mesa.aplica(app, true);
  assert.equal(CT.Mesa.activa(), true, 'en vertical la mesa a escala llena el alto de la tableta');
  assert.ok(app.classList.contains('mesa-escena'));
}
{
  // Tableta horizontal: medidas reales, sin escalar.
  const {app, CT, atributo} = entorno({width: 1194, height: 834});
  assert.equal(atributo(), 'horizontal');
  CT.Mesa.aplica(app, true);
  assert.equal(CT.Mesa.activa(), false, 'en horizontal no se escala como un iPhone');
  assert.ok(!app.classList.contains('mesa-escena'));
  assert.equal(CT.Mesa.escala(), 1);
  assert.equal(CT.Mesa.ancho(), 1194, 'las medidas son las de la pantalla');
  assert.equal(CT.Mesa.tabletHorizontal(), true);
  // Salir de la partida no deja rastro.
  CT.Mesa.aplica(app, false);
  assert.equal(CT.Mesa.activa(), false);
}
{
  // Girar la tableta en plena partida cambia de modo.
  const {app, CT, atributo, gira} = entorno({width: 834, height: 1194});
  CT.Mesa.aplica(app, true);
  assert.equal(CT.Mesa.activa(), true);
  gira(1194, 834);
  assert.equal(atributo(), 'horizontal');
  assert.equal(CT.Mesa.activa(), false, 'al girar a horizontal se pasa a las dos columnas');
  assert.ok(!app.classList.contains('mesa-escena'));
  gira(834, 1194);
  assert.equal(atributo(), 'vertical');
  assert.equal(CT.Mesa.activa(), true, 'al volver a vertical vuelve la mesa a escala');
  assert.ok(app.classList.contains('mesa-escena'));
  // Fuera de la partida, girar no activa nada.
  CT.Mesa.aplica(app, false);
  app.classList.remove('atlas-board');
  gira(1194, 834);
  assert.equal(CT.Mesa.activa(), false);
  gira(834, 1194);
  assert.equal(CT.Mesa.activa(), false, 'fuera de una partida no hay mesa');
}
{
  // Una ventana dividida (Split View) estrecha es un móvil, no una tableta.
  const {app, CT, atributo, gira} = entorno({width: 1194, height: 834});
  gira(507, 834);
  assert.equal(atributo(), null);
  CT.Mesa.aplica(app, true);
  assert.equal(CT.Mesa.activa(), true);
}

// tablet.css: todo cuelga de html[data-tablet], para no tocar móvil ni ordenador.
const css = read('tablet.css').replace(/\/\*[\s\S]*?\*\//g, '');
const reglas = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(m => m[1].trim()).filter(Boolean);
assert.ok(reglas.length >= 10, 'tablet.css tiene reglas');
for (const lista of reglas) for (const selector of lista.split(/,(?![^()]*\))/).map(s => s.trim())) {
  assert.match(selector, /^html\[data-tablet(="(horizontal|vertical)")?\]/, `selector fuera de html[data-tablet]: ${selector}`);
}
assert.doesNotMatch(css, /@media/, 'la condición de tableta la marca mesa-escala.js, no una consulta de CSS');

// Cableado: se carga, se guarda para jugar sin conexión y entra en el paquete móvil.
const index = read('index.html');
assert.match(index, /<link rel="stylesheet" href="tablet\.css\?v=\d+"/);
assert.ok(index.indexOf('tablet.css') > index.indexOf('edition.css'), 'tablet.css va después de edition.css para poder redefinirla');
assert.equal(index.match(/tablet\.css\?v=(\d+)/)[1], index.match(/edition\.css\?v=(\d+)/)[1], 'tablet.css sube de versión a la vez que edition.css');
assert.match(read('service-worker-258.js'), /"\.\/tablet\.css"/);
assert.match(read('scripts/build.mjs'), /"tablet\.css"/);

console.log('Tabletas: mesa a escala en móvil, ordenador y tableta vertical; dos columnas en horizontal; giro en partida; CSS acotado: OK');
