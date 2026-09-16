(() => {
  const root = document.documentElement;
  const MIN_VISIBLE = 3500, ENTER_VISIBLE = 1200, FADE_OUT = 1100, MAX_WAIT = 20000;
  root.classList.add('splash-active');
  let startedAt = null, ready = false, minVisible = MIN_VISIBLE, timeout, finishTimer, hideTimer;
  const splash = () => document.getElementById('app-splash');
  const hide = () => {
    clearTimeout(timeout); clearTimeout(finishTimer); clearTimeout(hideTimer);
    root.classList.remove('splash-active');
    const el = splash();
    el?.setAttribute('aria-hidden', 'true');
    el?.classList.remove('splash-ready', 'splash-exit', 'splash-gate', 'splash-entering');
    document.getElementById('splash-play')?.remove();
    document.getElementById('splash-status')?.remove();
    startedAt = null;
  };
  // Un arranque que se queda a medias no puede dejar la pantalla en blanco para siempre.
  const guard = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      hide();
      const app = document.getElementById('app');
      if (app && !app.textContent.trim()) {
        app.innerHTML = '<section class="account-shell"><h1>Continuum</h1><p>La conexión está tardando más de lo esperado.</p><button class="btn" id="splash-retry">Reintentar</button></section>';
        document.getElementById('splash-retry').onclick = () => location.reload();
      }
    }, MAX_WAIT);
  };
  const show = () => {
    // DOMContentLoaded y boot pueden pedir la misma apertura: no reiniciar su reloj.
    if (startedAt !== null) return;
    startedAt = performance.now(); ready = false; minVisible = MIN_VISIBLE;
    root.classList.add('splash-active');
    const el = splash();
    el?.classList.remove('splash-exit');
    el?.classList.add('splash-ready');
    el?.setAttribute('aria-hidden', 'false');
    guard();
  };
  // El juego no entra solo: entra cuando alguien pulsa «Jugar». Ese toque es además lo
  // único que permite encender el audio —ningún navegador deja sonar nada antes—, así
  // que es lo que hace que la música ya esté puesta cuando aparece el menú.
  const gate = () => new Promise(resolve => {
    const el = splash();
    if (!el) { resolve(); return; }
    // Aquí se espera a una persona, no a la red: el aviso de carga lenta sobra.
    clearTimeout(timeout);
    el.classList.add('splash-gate');
    let button = document.getElementById('splash-play');
    if (!button) {
      button = document.createElement('button');
      button.id = 'splash-play';
      button.type = 'button';
      button.className = 'splash-play';
      button.textContent = 'Jugar';
      el.append(button);
    }
    button.addEventListener('click', () => {
      button.remove();
      el.classList.remove('splash-gate');
      resolve();
    }, { once: true });
    try { button.focus({ preventScroll: true }); } catch { /* Sin foco también se pulsa. */ }
  });
  // Segundo telón, ya con la música sonando: ahora sí se está montando la partida.
  const entering = (text = 'Entrando al juego…') => {
    const el = splash();
    if (!el) return;
    el.classList.add('splash-entering');
    let status = document.getElementById('splash-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'splash-status';
      status.className = 'splash-status';
      status.setAttribute('role', 'status');
      el.append(status);
    }
    status.textContent = text;
    // El reloj de lectura vuelve a empezar, pero corto: este telón no se lee, se cruza.
    startedAt = performance.now(); ready = false; minVisible = ENTER_VISIBLE;
    guard();
  };
  const finish = () => {
    if (startedAt === null || ready) return;
    ready = true;
    clearTimeout(timeout);
    finishTimer = setTimeout(() => {
      splash()?.classList.add('splash-exit');
      // El juego no se descubre de golpe: el telón se disuelve mientras la pantalla que
      // hay detrás se aclara, con la música ya subiendo. Solo se anima la opacidad —una
      // transformación aquí convertiría a `#app` en el marco de su barra fija.
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const app = document.getElementById('app');
      if (app && !reduced) {
        app.classList.add('app-arrive');
        const limpiar = () => app.classList.remove('app-arrive');
        app.addEventListener('animationend', limpiar, { once: true });
        setTimeout(limpiar, FADE_OUT + 700);
      }
      hideTimer = setTimeout(hide, reduced ? 0 : FADE_OUT);
    }, Math.max(0, minVisible - (performance.now() - startedAt)));
  };
  window.CONTINUUM_SPLASH = { show, finish, gate, entering };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
})();
