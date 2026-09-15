(() => {
  const root = document.documentElement;
  const MIN_VISIBLE = 3500, FADE_OUT = 300, MAX_WAIT = 20000;
  root.classList.add('splash-active');
  let startedAt = null, ready = false, timeout, finishTimer, hideTimer;
  const hide = () => {
    clearTimeout(timeout); clearTimeout(finishTimer); clearTimeout(hideTimer);
    root.classList.remove('splash-active');
    const el = document.getElementById('app-splash');
    el?.setAttribute('aria-hidden', 'true');
    el?.classList.remove('splash-ready', 'splash-exit');
    startedAt = null;
  };
  const show = () => {
    // DOMContentLoaded y boot pueden pedir la misma apertura: no reiniciar su reloj.
    if (startedAt !== null) return;
    startedAt = performance.now(); ready = false;
    root.classList.add('splash-active');
    const el = document.getElementById('app-splash');
    el?.classList.remove('splash-exit');
    el?.classList.add('splash-ready');
    el?.setAttribute('aria-hidden', 'false');
    timeout = setTimeout(() => {
      hide();
      const app = document.getElementById('app');
      if (app && !app.textContent.trim()) {
        app.innerHTML = '<section class="account-shell"><h1>Continuum</h1><p>La conexión está tardando más de lo esperado.</p><button class="btn" id="splash-retry">Reintentar</button></section>';
        document.getElementById('splash-retry').onclick = () => location.reload();
      }
    }, MAX_WAIT);
  };
  const finish = () => {
    if (startedAt === null || ready) return;
    ready = true;
    clearTimeout(timeout);
    finishTimer = setTimeout(() => {
      document.getElementById('app-splash')?.classList.add('splash-exit');
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      hideTimer = setTimeout(hide, reduced ? 0 : FADE_OUT);
    }, Math.max(0, MIN_VISIBLE - (performance.now() - startedAt)));
  };
  window.CONTINUUM_SPLASH = { show, finish };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
})();
