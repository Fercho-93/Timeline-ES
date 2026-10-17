// Textos legales públicos: terminos.html, aviso-legal.html, soporte.html y borrar-cuenta.html.
// Comprueba que existen, que todo enlace interno (y su ancla) lleva a algún sitio, que viajan en
// la app y en la caché, que el juego y la política los enlazan y que repiten los datos de contacto
// y los plazos de la política de privacidad. Los huecos «[PENDIENTE: …]» (NIF y domicilio) los
// rellena el titular: esta prueba los lista para que no se publiquen por descuido.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const PAGES = ['terminos.html', 'aviso-legal.html', 'soporte.html', 'borrar-cuenta.html'];
const MAIL = 'feedbackcontinuum@gmail.com';
const html = Object.fromEntries([...PAGES, 'privacidad.html', 'licencias.html'].map(page => [page, read(page)]));
const ids = page => new Set([...html[page].matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

for (const page of PAGES) {
  const text = html[page];
  assert.match(text, /^<!doctype html>\n<html lang="es">/i, `${page} declara el idioma`);
  assert.match(text, /<title>[^<]+ · Continuum<\/title>/, `${page} tiene título`);
  assert.match(text, /<h1>[^<]+<\/h1>/, `${page} tiene encabezado`);
  assert.doesNotMatch(text, /\btimeline(?:[-_ ]es)?\b/i, `${page} no usa el nombre antiguo`);
  assert.ok(text.includes(MAIL), `${page} da el correo de contacto`);
  // Enlaces internos: el archivo existe y la ancla también.
  for (const [, target] of text.matchAll(/href="([^":]+)"/g)) {
    const [file, anchor] = target.split('#');
    if (file && file !== 'index.html') assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), `${page}: ${target} existe`);
    if (anchor) assert.ok(ids(file || page).has(anchor), `${page}: la ancla #${anchor} existe en ${file || page}`);
  }
  // Viaja en la app móvil y en la caché del juego.
  assert.ok(read('scripts/build.mjs').includes(`"${page}"`), `${page} entra en la app móvil`);
  assert.ok(read('service-worker-258.js').includes(`"./${page}"`), `${page} entra en la caché sin conexión`);
}

// Enlaces de la app y de la política.
const places = { 'Ajustes': read('settings.js'), 'la política': html['privacidad.html'], 'PRIVACIDAD.md': read('PRIVACIDAD.md') };
for (const [where, text] of Object.entries(places)) for (const page of ['terminos.html', 'aviso-legal.html', 'soporte.html', 'borrar-cuenta.html']) {
  assert.ok(text.includes(page), `${where} enlaza ${page}`);
}
assert.ok(read('app.js').includes('terminos.html'), 'la bienvenida enlaza las condiciones');

// Coherencia con la política y con el juego.
assert.match(html['terminos.html'], /14 años/, 'las condiciones repiten la edad de la política');
assert.match(html['terminos.html'], /Denunciar/, 'las condiciones explican la denuncia');
assert.match(html['aviso-legal.html'], /Fernando Sirvent Merino/);
assert.match(html['aviso-legal.html'], /continuumjuego\.es/);
assert.match(html['borrar-cuenta.html'], /Atlas[\s\S]*Tu cuenta y tus datos[\s\S]*Eliminar/, 'los pasos coinciden con los del juego');
assert.match(html['borrar-cuenta.html'], /un mes/, 'el plazo del RGPD');
assert.match(read('accounts.js'), /Tu cuenta y tus datos/, 'el juego tiene la sección que nombran los textos');
for (const plazo of ['90 días', '30 días']) assert.ok(html['borrar-cuenta.html'].includes(plazo) || html['privacidad.html'].includes(plazo));

const pending = PAGES.flatMap(page => [...html[page].matchAll(/\[PENDIENTE: ([^\]]+)\]/g)].map(m => `${page}: ${m[1]}`));
console.log(`Textos legales: enlaces, caché, app y coherencia con la política: OK${pending.length ? `\n  Por rellenar antes de publicar en tiendas: ${pending.join('; ')}` : ''}`);
