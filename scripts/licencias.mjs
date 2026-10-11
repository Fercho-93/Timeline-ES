// Genera licencias.html: la página de «Licencias de terceros» que enlazan Ajustes y la política
// de privacidad. Las licencias de las piezas de otros autores que viajan dentro del juego (jsQR,
// qrcode-generator, Capacitor y Firebase) exigen acompañar su texto; esta página lo hace.
// Uso: node scripts/licencias.mjs (vuelve a escribir licencias.html desde los textos originales).
import fs from 'node:fs/promises';

const read = file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const block = text => `<pre style="white-space:pre-wrap;font-size:.8rem;line-height:1.45">${escape(text.trim())}</pre>`;

const apache = await read('LICENSE-JSQR.txt');
const qrcode = await read('LICENSE-QRCODE-GENERATOR.txt');
const capacitor = await read('node_modules/@capacitor/core/LICENSE');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Licencias · Continuum</title><link rel="stylesheet" href="styles.css"></head>
<body><main class="shell rules"><h1>Licencias de terceros</h1>
<p>Continuum incluye piezas de software de otros autores. Sus licencias permiten usarlas y distribuirlas siempre que se acompañe este aviso. El resto del juego (código, diseño y arte) pertenece a su autor y no se ofrece bajo estas licencias.</p>
<h2>Componentes</h2>
<ul>
<li><strong>jsQR 1.4.0</strong> — lector de códigos QR con la cámara. © Cosmo Wolfe. <a href="https://github.com/cozmo/jsqr" rel="noopener noreferrer">github.com/cozmo/jsqr</a>. Licencia Apache 2.0.</li>
<li><strong>qrcode-generator 2.0.4</strong> — dibuja los códigos QR de invitación. © 2009 Kazuhiko Arase. <a href="https://github.com/kazuhikoarase/qrcode-generator" rel="noopener noreferrer">github.com/kazuhikoarase/qrcode-generator</a>. Licencia MIT.</li>
<li><strong>Capacitor</strong> (núcleo, iOS, Android y los complementos App, Haptics y Push Notifications) — convierte el juego en app de móvil. © 2017-present Drifty Co. <a href="https://capacitorjs.com" rel="noopener noreferrer">capacitorjs.com</a>. Licencia MIT.</li>
<li><strong>Firebase</strong> (SDK web y SDK de iOS) y bibliotecas <strong>AndroidX</strong> — cuentas, partidas online, protección de la app y app de Android. © Google LLC. <a href="https://firebase.google.com" rel="noopener noreferrer">firebase.google.com</a>. Licencia Apache 2.0.</li>
</ul>
<h2>Licencia MIT · qrcode-generator</h2>
${block(qrcode)}
<h2>Licencia MIT · Capacitor</h2>
${block(capacitor)}
<h2>Licencia Apache 2.0 · jsQR, Firebase y AndroidX</h2>
${block(apache)}
<p><a href="privacidad.html">Privacidad</a> · <a href="index.html">Volver a Continuum</a></p></main></body></html>
`;
await fs.writeFile(new URL('../licencias.html', import.meta.url), html);
console.log('licencias.html escrita');
