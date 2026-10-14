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
    document.getElementById('splash-ambience')?.remove();
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
    // En cuanto la moneda deja de girar, el emblema pasa a ser una imagen plana: algunos Android
    // componían mal la escena 3D ya quieta y dejaban el logo desplazado a la derecha.
    const settle = () => el?.classList.add('splash-coin-settled');
    el?.querySelector('.splash-coin')?.addEventListener('animationend', settle, { once: true });
    setTimeout(settle, 3600);
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
    const techo = (document.getElementById('splash-ambience')?.getBoundingClientRect().bottom || 0) + 8;
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

  // El juego no entra solo: entra cuando alguien pulsa «Jugar». Ese toque es además lo
  // único que permite encender el audio —ningún navegador deja sonar nada antes—, así
  // que es lo que hace que la música ya esté puesta cuando aparece el menú.
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

      const sound = document.createElement('button');
      sound.type = 'button';
      sound.className = 'splash-sound';
      sound.id = 'splash-ambience';
      sound.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="sound-speaker" d="M4 9v6h4l5 4V5L8 9H4Z"/>
        <path class="sound-waves" d="M16 8.2a5 5 0 0 1 0 7.6M18.6 5.7a8.5 8.5 0 0 1 0 12.6"/>
        <path class="sound-muted" d="m16.5 9 5 5m0-5-5 5"/>
      </svg>`;
      const reflectSound = enabled => {
        sound.dataset.enabled = enabled ? 'true' : 'false';
        sound.setAttribute('aria-pressed', String(enabled));
        sound.setAttribute('aria-label', enabled ? 'Desactivar música ambiente' : 'Activar música ambiente');
        sound.title = enabled ? 'Silenciar música' : 'Activar música';
      };
      reflectSound(window.CONTINUUM?.effectPrefs?.().ambience === true);
      sound.addEventListener('click', () => {
        const enabled = sound.dataset.enabled !== 'true';
        window.CONTINUUM?.setAmbience?.(enabled);
        reflectSound(enabled);
      });

      button = document.createElement('button');
      button.id = 'splash-play';
      button.type = 'button';
      button.className = 'splash-play';
      button.textContent = 'Jugar';
      // Bajo «Jugar», un enlace discreto para quien quiere ver antes cómo se juega: entra
      // igual (y enciende igual la música) y, ya dentro, abre la Guía con su vídeo.
      const guide = document.createElement('button');
      guide.id = 'splash-guide';
      guide.type = 'button';
      guide.className = 'splash-guide';
      guide.textContent = 'Ver el manual';
      actions.append(button, guide);
      const elapsed = performance.now() - introStart;
      actions.style.animationDelay = `${Math.max(0, 5000 - elapsed)}ms`;
      sound.style.animationDelay = `${Math.max(0, 5200 - elapsed)}ms`;
      el.append(sound, actions);
    }
    encaja();
    let entered = false;
    const enter = () => {
      if (entered) return;
      entered = true;
      actions?.remove();
      document.getElementById('splash-ambience')?.remove();
      el.classList.remove('splash-gate');
      resolve();
    };
    button.addEventListener('click', enter, { once: true });
    document.getElementById('splash-guide')?.addEventListener('click', () => {
      try { sessionStorage.setItem('continuum-abrir-guia', '1'); } catch { /* sin almacenamiento: entra sin abrirla */ }
      enter();
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
