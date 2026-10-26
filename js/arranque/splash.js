// La portada animada que se ve al abrir el juego mientras termina de cargar.
(() => {
  const root = document.documentElement;
  const MIN_VISIBLE = 3500, ENTER_VISIBLE = 1200, FADE_OUT = 420, MAX_WAIT = 20000;
  root.classList.add('splash-active');
  // La intro arranca con el primer pintado. El botón «Jugar» se crea más tarde (cuando boot llega a `gate`),
  // y en móviles lentos eso retrasaba su aparición: sus 5 s se cuentan desde aquí, no desde que se crea.
  let introStart = performance.now();
  window.requestAnimationFrame?.(() => { introStart = performance.now(); });
  let startedAt = null, ready = false, minVisible = MIN_VISIBLE, timeout, finishTimer, hideTimer;
  const splash = () => document.getElementById('app-splash');
  // Tras la hoja nativa de Apple el WebView de iPhone no repinta lo nuevo hasta que se toca la pantalla
  // (se quedaba solo el fondo). En esa carga se omite el fundido de entrada y se fuerza el repintado.
  let repinta = false;
  try { repinta = sessionStorage.getItem('continuum-repinta') === '1'; sessionStorage.removeItem('continuum-repinta'); } catch { /* sin almacenamiento */ }
  const empuja = () => {
    const app = document.getElementById('app');
    if (!app) return;
    app.style.opacity = '.999';
    setTimeout(() => { app.style.opacity = ''; window.dispatchEvent(new Event('resize')); }, 40);
  };
  const hide = () => {
    clearTimeout(timeout); clearTimeout(finishTimer); clearTimeout(hideTimer);
    root.classList.remove('splash-active');
    const el = splash();
    el?.setAttribute('aria-hidden', 'true');
    el?.classList.remove('splash-ready', 'splash-exit', 'splash-gate', 'splash-entering');
    document.getElementById('splash-actions')?.remove();
    document.getElementById('splash-status')?.remove();
    startedAt = null;
    if (repinta) [0, 200, 600, 1500].forEach(ms => setTimeout(empuja, ms));
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
  // En cuanto la moneda deja de girar, el emblema pasa a ser una imagen plana: algunos Android
  // componían mal la escena 3D ya quieta y dejaban el logo desplazado a la derecha.
  const asienta = el => {
    const settle = () => el?.classList.add('splash-coin-settled');
    el?.querySelector('.splash-coin')?.addEventListener('animationend', settle, { once: true });
    setTimeout(settle, 3600);
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
    asienta(el);
  };
  // Encaje de la portada. El globo es parte de la imagen de fondo (escalada con `cover`), así
  // que su altura en pantalla cambia con cada móvil y con las barras del navegador. Se calcula
  // dónde cae su borde y el bloque «Jugar» + «Ver el manual» se apoya justo encima; si así
  // tocaría el lema, la marca sube (sin pasar bajo el botón de sonido) y, si aun así no cabe,
  // se encoge lo justo. Sin esto, en pantallas bajas el botón tapaba el lema o el enlace
  // quedaba sobre el globo, donde no se lee.
  const FONDO = { ancho: 941, alto: 1672, globo: 0.785 };
  const encaja = () => {
    const el = splash(), actions = document.getElementById('splash-actions');
    const masthead = el?.querySelector('.splash-masthead');
    if (!el || !actions || !masthead) return;
    masthead.style.marginTop = ''; masthead.style.scale = ''; masthead.style.transformOrigin = ''; actions.style.bottom = '';
    const vw = el.clientWidth, vh = el.clientHeight;
    if (!vw || !vh) return;
    const escala = Math.max(vw / FONDO.ancho, vh / FONDO.alto), altoImagen = FONDO.alto * escala;
    const posY = parseFloat(getComputedStyle(el).backgroundPositionY) / 100;
    const globo = (vh - altoImagen) * (Number.isFinite(posY) ? posY : .5) + FONDO.globo * altoImagen;
    const abajo = parseFloat(getComputedStyle(actions).bottom) || 0;
    // Encima del globo con un respiro, pero nunca pegado al borde inferior.
    const nuevoAbajo = Math.max(Math.min(vh - globo + 10, vh * .45), 18);
    if (globo < vh) actions.style.bottom = `${Math.round(nuevoAbajo)}px`;
    else if (abajo > vh * .3) actions.style.bottom = `${Math.round(vh * .22)}px`;
    // Margen superior que la marca respeta (el que antes ocupaba el botón de sonido de la esquina).
    const techo = 80;
    // Dónde queda el bloque al terminar su entrada (mientras entra va 12 px más abajo): se
    // calcula con su `bottom` y su alto, no con lo que mide en este instante.
    const tope = () => vh - (parseFloat(getComputedStyle(actions).bottom) || 0) - actions.offsetHeight - 22;
    // Lo que se ve de la marca: emblema, nombre, lema y adorno. Los puntos de carga de debajo
    // no se ven mientras espera «Jugar», así que pueden quedar tras el botón.
    const visible = () => {
      const cajas = [...masthead.querySelectorAll('.splash-crest, .home-wordmark, .home-tagline, .home-ornament')]
        .map(nodo => nodo.getBoundingClientRect()).filter(caja => caja.height);
      return { top: Math.min(...cajas.map(caja => caja.top)), bottom: Math.max(...cajas.map(caja => caja.bottom)) };
    };
    let marca = visible();
    const sobra = marca.bottom - tope();
    if (sobra > 0) {
      const sube = Math.min(sobra, Math.max(0, marca.top - techo));
      masthead.style.marginTop = `${-Math.round(sube)}px`;
      marca = visible();
      if (marca.bottom > tope()) {
        // Se encoge desde el borde superior de la caja tal como se ve (la marca va subida
        // medio alto con `translateY(-50%)`, de ahí el origen en -50 %): solo sube lo de abajo.
        const caja = masthead.getBoundingClientRect();
        const factor = Math.max(.6, Math.min(1, (tope() - caja.top) / (marca.bottom - caja.top)));
        masthead.style.transformOrigin = '50% -50%';
        masthead.style.scale = factor.toFixed(3);
      }
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (startedAt !== null) encaja(); });
  // Con la tipografía definitiva el nombre y el lema cambian de tamaño: se vuelve a encajar.
  document.fonts?.ready?.then(() => { if (startedAt !== null) encaja(); });

  // El juego no entra solo: entra cuando alguien pulsa «Jugar».
  const gate = () => new Promise(resolve => {
    const el = splash();
    if (!el) { resolve(); return; }
    // Aquí se espera a una persona, no a la red: el aviso de carga lenta sobra.
    clearTimeout(timeout);
    el.classList.add('splash-gate');
    let actions = document.getElementById('splash-actions');
    let button = document.getElementById('splash-play');
    if (!button) {
      actions = document.createElement('div');
      actions.id = 'splash-actions';
      actions.className = 'splash-actions';

      button = document.createElement('button');
      button.id = 'splash-play';
      button.type = 'button';
      button.className = 'splash-play';
      button.textContent = 'Jugar';
      // Bajo «Jugar», un enlace discreto para quien quiere ver antes cómo se juega: reproduce
      // la guía en vídeo aquí mismo y, al terminar, se vuelve a esta portada.
      const guide = document.createElement('button');
      guide.id = 'splash-guide';
      guide.type = 'button';
      guide.className = 'splash-guide';
      guide.textContent = 'Ver cómo se juega';
      actions.append(button, guide);
      const elapsed = performance.now() - introStart;
      actions.style.animationDelay = `${Math.max(0, 5000 - elapsed)}ms`;
      el.append(actions);
    }
    encaja();
    let entered = false;
    const enter = () => {
      if (entered) return;
      entered = true;
      actions?.remove();
      el.classList.remove('splash-gate');
      resolve();
    };
    button.addEventListener('click', enter, { once: true });
    document.getElementById('splash-guide')?.addEventListener('click', () => verVideo(el));
    try { button.focus({ preventScroll: true }); } catch { /* Sin foco también se pulsa. */ }
  });
  // La guía en vídeo, a pantalla completa sobre la portada. No entra en el juego: al terminar
  // (o al cerrarla) se vuelve a la portada, con «Jugar» esperando.
  const verVideo = el => {
    const CT = window.CONTINUUM;
    if (!CT?.Tutorial || el.querySelector('.splash-video')) return;
    let modeKey = null;
    try { modeKey = CT.Storage?.getItem('hilo-selected-mode-v1'); } catch { /* sin almacenamiento */ }
    const video = CT.Tutorial.markup(CT.has?.(modeKey) ? modeKey : CT.DEFAULT_MODE, { portada: true });
    if (!video) return;
    const capa = document.createElement('div');
    capa.className = 'splash-video';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', 'Vídeo: cómo se juega');
    capa.innerHTML = `<div class="splash-video-head"><button type="button" class="splash-video-close" aria-label="Volver a la portada">←</button><span>Vídeo: cómo se juega</span></div>${video}`;
    const volver = () => {
      capa.querySelector('[data-tutorial]')?.tutorial?.stop();
      document.removeEventListener('keydown', escape);
      capa.remove();
      el.classList.remove('splash-viendo');
      try { document.getElementById('splash-guide')?.focus({ preventScroll: true }); } catch { /* sin foco */ }
    };
    const escape = event => { if (event.key === 'Escape') volver(); };
    capa.querySelector('.splash-video-close').addEventListener('click', volver);
    // Al acabar se deja ver un instante el cierre y se vuelve solo a la portada.
    // Si en ese instante se pulsa «Ver otra vez», el vídeo sigue y no se cierra.
    capa.addEventListener('tutorial-end', () => setTimeout(() => {
      if (capa.isConnected && capa.querySelector('[data-tutorial]')?.tutorial?.state().ended !== false) volver();
    }, 1600));
    document.addEventListener('keydown', escape);
    el.classList.add('splash-viendo');
    el.append(capa);
    CT.Tutorial.mountAll(capa);
    try { capa.querySelector('.splash-video-close').focus({ preventScroll: true }); } catch { /* sin foco */ }
  };
  // Segundo telón: ahora sí se está montando la partida.
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
      // hay detrás se aclara. Solo se anima la opacidad —una
      // transformación aquí convertiría a `#app` en el marco de su barra fija.
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const app = document.getElementById('app');
      if (app && !reduced && !repinta) {
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
