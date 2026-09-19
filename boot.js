(function () {
  const app = document.getElementById('app');
  let starting = false;
  function loadApp() {
    const script = document.createElement('script');
    script.src = 'app.js';
    script.onload = () => window.CONTINUUM_SPLASH?.finish();
    script.onerror = () => { starting = false; failed(); };
    document.body.append(script);
  }
  async function start() {
    if (starting) return;
    starting = true;
    app.innerHTML = '';
    window.CONTINUUM_SPLASH?.show();
    // El invitado se prepara mientras se ve la portada: el botón no espera a la red.
    const accounts = import('./accounts.js');
    accounts.catch(() => { /* El fallo se atiende abajo, al pedir el módulo. */ });
    try {
      // Entrar es un acto de quien juega, no del reloj. Y ese primer toque es lo único
      // que deja al navegador encender el audio, así que la música arranca aquí y ya
      // está sonando cuando aparece el menú.
      await window.CONTINUUM_SPLASH?.gate();
      window.CONTINUUM?.Ambience?.sync(true);
      window.CONTINUUM_SPLASH?.entering();
      const { startAccounts } = await accounts;
      await startAccounts(loadApp);
    } catch {
      starting = false;
      // Sin internet no hay invitado que preparar, pero el resto del juego —incluido el
      // modo sin conexión— no necesita ninguno: el resto de la aplicación ya sabe jugar
      // sin `CT.Accounts` (revisa su perfil local en vez del de la nube). Solo se bloquea
      // aquí cuando accounts.js falla teniendo internet: ahí sí puede merecer un reintento,
      // en vez de esconder en silencio un fallo real del servicio de cuentas.
      if (!navigator.onLine) { starting = true; loadApp(); return; }
      failed();
    }
  }
  function failed() {
    window.CONTINUUM_SPLASH?.finish();
    app.innerHTML = '<section class="account-shell"><h1>Continuum</h1><p role="alert">No se ha podido conectar. Necesitas internet para preparar tu invitado.</p><button class="btn btn-primary" id="account-retry">Reintentar</button></section>';
    document.getElementById('account-retry').onclick = start;
  }
  start();
})();
