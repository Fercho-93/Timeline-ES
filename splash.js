(() => {
  const root=document.documentElement;
  root.classList.add('splash-active');
  let timeout;
  const show=()=>{
    root.classList.add('splash-active');
    const el=document.getElementById('app-splash');
    el?.classList.add('splash-ready');
    el?.setAttribute('aria-hidden','false');
    clearTimeout(timeout);
    timeout=setTimeout(()=>{
      finish();
      if(!document.getElementById('app')?.textContent.trim()) {
        const app=document.getElementById('app');
        app.innerHTML='<section class="account-shell"><h1>Continuum</h1><p>La conexión está tardando más de lo esperado.</p><button class="btn" id="splash-retry">Reintentar</button></section>';
        document.getElementById('splash-retry').onclick=()=>location.reload();
      }
    },20000);
  };
  const finish=()=>{clearTimeout(timeout);root.classList.remove('splash-active');document.getElementById('app-splash')?.setAttribute('aria-hidden','true');};
  window.CONTINUUM_SPLASH={show,finish};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
})();
