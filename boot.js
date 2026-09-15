(function () {
  const app = document.getElementById('app');
  let starting = false;
  async function start() {
    if (starting) return;
    starting = true;
    app.innerHTML = '<section class="account-shell"><h1>Continuum</h1><p role="status">Preparando tu invitado…</p></section>';
    try {
      const { startAccounts } = await import('./accounts.js');
      await startAccounts(() => {
        const script = document.createElement('script');
        script.src = 'app.js';
        script.onerror = () => { starting = false; failed(); };
        document.body.append(script);
      });
    } catch { starting = false; failed(); }
  }
  function failed() {
    app.innerHTML = '<section class="account-shell"><h1>Continuum</h1><p role="alert">No se ha podido conectar. Necesitas internet para preparar tu invitado.</p><button class="btn btn-primary" id="account-retry">Reintentar</button></section>';
    document.getElementById('account-retry').onclick = start;
  }
  start();
})();
