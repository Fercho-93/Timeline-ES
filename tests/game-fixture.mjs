// Fixtures del motor: arrancan después de la frontera de acceso. El flujo real de
// registro y su almacenamiento se verifica por separado en cuentas.mjs.
export function gameHtml(html) {
  return html.replace('<script src="account-storage.js"></script>','').replace('<script src="boot.js"></script>','<script src="app.js"></script>');
}
