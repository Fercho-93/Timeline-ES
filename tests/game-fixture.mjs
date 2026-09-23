// Fixtures del motor: arrancan después de la frontera de acceso. El flujo real de
// registro y su almacenamiento se verifica por separado en cuentas.mjs.
// También arrancan después de la bienvenida, con una identidad puesta; la bienvenida se
// prueba en identidad.mjs con `{ bienvenida: true }`.
export function gameHtml(html, { bienvenida = false } = {}) {
  const base = html.replace('<script src="account-storage.js"></script>','').replace('<script src="boot.js"></script>','<script src="app.js"></script>');
  return bienvenida ? base : base.replace('<script src="app.js"></script>','<script src="tests/identidad-fixture.js"></script><script src="app.js"></script>');
}
