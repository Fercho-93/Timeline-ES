// En la app de iPhone, un enlace relativo con target="_blank" a una página legal (privacidad, condiciones…)
// acababa en capacitor://localhost/privacidad.html, que el sistema no abre: el toque no hacía nada y Apple
// exige poder leer la política de privacidad desde la app. Se abren por su dirección pública.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function app(native, url = 'https://continuumjuego.es/') {
  const dom = new JSDOM('<!doctype html><body><a id="a" href="privacidad.html" target="_blank">p</a><a id="b" href="privacidad.html#arte" target="_blank">b</a><a id="c" href="licencias.html" target="_blank">c</a><a id="d" href="https://www.ejemplo.test/x.html" target="_blank">d</a><a id="e" href="invitation.html">e</a><span id="f"><a id="g" href="soporte.html"><b id="h">s</b></a></span></body>', {url, virtualConsole: new VirtualConsole(), runScripts: 'outside-only'});
  const w = dom.window;
  const opened = [];
  w.open = (...args) => { opened.push(args); return null; };
  if (native) w.Capacitor = {isNativePlatform: () => true};
  w.CONTINUUM = {};
  w.eval(read('links.js'));
  // En el iPhone, la página se sirve desde capacitor://localhost, no desde el dominio.
  const click = id => { const e = new w.MouseEvent('click', {bubbles: true, cancelable: true}); w.document.getElementById(id).dispatchEvent(e); return e.defaultPrevented; };
  return {w, opened, click};
}

{
  // En la web (o con el dominio) y, sobre todo, tal como se sirve en el iPhone: capacitor://localhost.
  for (const url of ['https://continuumjuego.es/', 'capacitor://localhost/index.html']) {
    const {w} = app(true, url);
    const links = w.CONTINUUM.Links;
    assert.equal(w.location.protocol, url.startsWith('capacitor') ? 'capacitor:' : 'https:', url);
    for (const page of ['privacidad', 'terminos', 'aviso-legal', 'soporte', 'borrar-cuenta', 'licencias']) {
      assert.equal(links.legalUrl(page + '.html'), `https://continuumjuego.es/${page}.html`, `${page} desde ${url}`);
    }
    assert.equal(links.legalUrl('privacidad.html#arte'), 'https://continuumjuego.es/privacidad.html#arte', 'conserva el ancla');
    assert.equal(links.legalUrl('invitation.html'), null, 'solo las páginas legales');
    assert.equal(links.legalUrl('https://www.ejemplo.test/privacidad.html'), null, 'ni páginas de otros sitios');
  }
}

{
  const {opened, click} = app(true, 'capacitor://localhost/index.html');
  assert.equal(click('a'), true, 'en la app, el enlace no sigue su camino');
  assert.deepEqual(opened.pop().slice(0, 2), ['https://continuumjuego.es/privacidad.html', '_blank']);
  click('b'); assert.equal(opened.pop()[0], 'https://continuumjuego.es/privacidad.html#arte', 'conserva el ancla');
  click('c'); assert.equal(opened.pop()[0], 'https://continuumjuego.es/licencias.html');
  click('h'); assert.equal(opened.pop()[0], 'https://continuumjuego.es/soporte.html', 'también al tocar un elemento dentro del enlace');
  assert.equal(click('d'), false, 'un enlace de otro sitio no se toca');
  assert.equal(click('e'), false, 'tampoco una página que no es legal');
  assert.equal(opened.length, 0);
}

{
  const {opened, click} = app(false);
  assert.equal(click('a'), false, 'en la web, el navegador sigue abriendo la pestaña sin ayuda');
  assert.equal(opened.length, 0);
}

// Todos los enlaces legales del juego están en los textos de la interfaz con target="_blank" relativo
// (lo que el manejador cubre) o ya son absolutos.
for (const file of ['settings.js', 'accounts.js', 'app.js']) {
  for (const [, href] of read(file).matchAll(/href="([^"]*\.html[^"]*)"/g)) {
    assert.ok(/^(https:\/\/continuumjuego\.es\/)?(privacidad|terminos|aviso-legal|soporte|borrar-cuenta|licencias)\.html(#[a-z-]+)?$/.test(href) || /^invitation\.html/.test(href), `${file}: enlace a ${href} sin tratar`);
  }
}

// Guardar una ilustración en Fotos (al mantenerla pulsada en la lámina ampliada) exige declarar el permiso:
// sin esa clave iOS cierra la app.
const plist = read('ios/App/App/Info.plist');
assert.match(plist, /<key>NSPhotoLibraryAddUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/,
  'iOS cierra la app al guardar en Fotos si falta NSPhotoLibraryAddUsageDescription');
assert.doesNotMatch(plist, /NSPhotoLibraryUsageDescription/, 'el juego solo añade a Fotos, nunca lee la fototeca');

console.log('Enlaces legales en la app nativa y permiso de Fotos: OK');
