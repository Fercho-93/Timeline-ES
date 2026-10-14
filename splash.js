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
    el?.classList.remove('splash-ready', 'splash-exit', 'splash-gate', 'splash-entering', 'splash-caja-abriendo', 'splash-caja-cargando');
    document.getElementById('splash-actions')?.remove();
    document.getElementById('splash-ambience')?.remove();
    document.getElementById('splash-status')?.remove();
    quitaCaja?.();
    startedAt = null; esperandoJugar = false;
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

  // El cofre del juego. La primera vez que alguien abre Continuum en un dispositivo no entra
  // de golpe en la portada: está en cubierta, en alta mar, con un cofre cerrado que se abre con
  // un toque. Al abrirlo sale la luz, salen las cartas y la cámara entra en el cofre: ahí empieza
  // la intro de siempre. Solo esa primera vez; después se recuerda y la portada abre directa.
  const CAJA = 'continuum-caja-abierta-v1';
  const CAJA_SE_VA = 500;
  let quitaCaja = null, esperandoJugar = false;
  // Lo que espera `gate`: resuelto de salida (sin caja) y, si hay caja, cuando se termina de abrir.
  let cajaAbierta = Promise.resolve();
  const tocaCaja = () => {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
      if (localStorage.getItem(CAJA)) return false;
      // Quien ya guarda algo (una partida, un ajuste, una cuenta) conocía el juego antes de
      // que existiera la caja: no se le entrega ahora, se le marca como ya abierta.
      if (localStorage.length) { localStorage.setItem(CAJA, '1'); return false; }
      return true;
    } catch { return false; } // Sin almacenamiento no se podría recordar: se repetiría cada vez.
  };
  // Se decide ya, en <head>: la clase en <html> deja la intro parada antes del primer pintado,
  // con lo que al abrir la caja empieza desde su principio y no desde donde se quedó.
  const conCaja = tocaCaja();
  if (conCaja) root.classList.add('splash-caja');
  // La película se compone de las cuatro ilustraciones aportadas: cámara y
  // cuerpo fijos, tapa con espesor y cartas separadas. Sin el modelo de prueba.
  const montaCaja = el => {
    clearTimeout(timeout);
    const escena = document.createElement('div');
    escena.className = 'splash-caja-escena';
    escena.innerHTML = `<video class="cofre-pelicula" muted playsinline preload="auto" disablepictureinpicture aria-hidden="true" poster="assets/cofre-reference-v3-closed.webp"></video>
      <img class="cofre-fallback" src="assets/cofre-reference-v3-closed.webp" alt="" />
      <p class="caja-etiqueta"><span>Un mundo por descubrir</span>Rumbo a <b>Continuum</b><i aria-hidden="true">✦</i></p>
      <button type="button" class="caja-abrir" aria-label="Abrir el cofre de Continuum"></button>
      <p class="caja-pista" aria-live="polite">Toca el cofre para abrirlo</p>`;
    el.append(escena);
    const video = escena.querySelector('video'), boton = escena.querySelector('button');
    const pista = escena.querySelector('.caja-pista'), imagen = escena.querySelector('.cofre-fallback');
    video.muted = true; video.playsInline = true;
    let abierta = false, terminada = false, retirada = false, enFallback = false, falloVideo = false;
    let objeto = null, cargaTimer, watchdog, salidaTimer, resuelve;
    const pasos = [], abort = new AbortController();
    cajaAbierta = new Promise(resolve => { resuelve = resolve; });
    const limpiaTimers = () => { clearTimeout(cargaTimer); clearTimeout(watchdog); pasos.forEach(clearTimeout); };
    const retira = () => {
      if (retirada) return;
      retirada = true; limpiaTimers(); clearTimeout(salidaTimer); abort.abort();
      video.removeEventListener('ended', alTerminar); video.removeEventListener('error', alError);
      video.pause(); video.removeAttribute('src'); video.load();
      if (objeto) URL.revokeObjectURL(objeto);
      escena.remove(); quitaCaja = null;
    };
    const termina = () => {
      if (terminada || retirada) return;
      terminada = true; limpiaTimers();
      root.classList.remove('splash-caja');
      escena.classList.add('caja-se-va');
      introStart = performance.now(); asienta(el);
      if (!esperandoJugar) guard();
      salidaTimer = setTimeout(retira, CAJA_SE_VA);
      resuelve();
    };
    const empieza = () => {
      el.classList.remove('splash-caja-cargando');
      el.classList.add('splash-caja-abriendo');
    };
    // Si el navegador bloquea el vídeo, se usan las cuatro láminas originales
    // y siempre se llega a Jugar. No se vuelve a dibujar el cofre antiguo.
    const fallback = () => {
      if (terminada || retirada || enFallback) return;
      enFallback = true; clearTimeout(watchdog); video.pause(); empieza();
      escena.classList.add('cofre-sin-video');
      ['closed', 'open', 'rise', 'fan'].forEach((frame, i) => {
        pasos.push(setTimeout(() => { if (!retirada) imagen.src = `assets/cofre-reference-v3-${frame}.webp`; }, [0, 700, 1900, 3200][i]));
      });
      pasos.push(setTimeout(termina, 4700));
    };
    const alTerminar = () => { if (abierta && !enFallback) termina(); };
    const alError = () => { falloVideo = true; if (abierta) fallback(); };
    video.addEventListener('ended', alTerminar); video.addEventListener('error', alError);
    // Descargar el archivo entero evita problemas de Range/206 en Safari y
    // permite al service worker cachearlo. El reproductor lee un blob local.
    cargaTimer = setTimeout(() => abort.abort(), 6500);
    const carga = Promise.resolve().then(() => fetch('assets/cofre-opening-v3.mp4', { signal: abort.signal }))
      .then(response => { if (!response.ok) throw new Error('cofre-video'); return response.blob(); })
      .then(blob => {
        if (retirada) return false;
        objeto = URL.createObjectURL(blob); video.src = objeto; video.load(); return true;
      }).catch(() => false).finally(() => clearTimeout(cargaTimer));
    const abre = () => {
      if (abierta || retirada) return;
      abierta = true; boton.disabled = true;
      try { localStorage.setItem(CAJA, '1'); } catch { /* La entrada sigue disponible. */ }
      pista.textContent = 'Preparando la apertura…'; el.classList.add('splash-caja-cargando');
      watchdog = setTimeout(fallback, 8000);
      carga.then(ok => {
        if (terminada || retirada || enFallback) return;
        if (!ok || falloVideo) { fallback(); return; }
        empieza(); clearTimeout(watchdog); watchdog = setTimeout(termina, 10000);
        try { const play = video.play(); play?.catch?.(fallback); } catch { fallback(); }
      });
    };
    // Botón nativo: toque, Enter y espacio comparten exactamente la misma ruta.
    boton.addEventListener('click', abre);
    quitaCaja = () => { retira(); root.classList.remove('splash-caja'); el.classList.remove('splash-caja-abriendo', 'splash-caja-cargando'); resuelve(); };
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
    if (el && conCaja && !el.querySelector('.splash-caja-escena')) montaCaja(el);
    else if (!conCaja) asienta(el);
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
  // Si hay caja, «Jugar» no aparece hasta que se abre: la intro, y sus 5 s, empiezan entonces.
  const gate = () => cajaAbierta.then(() => new Promise(resolve => {
    const el = splash();
    if (!el) { resolve(); return; }
    // Aquí se espera a una persona, no a la red: el aviso de carga lenta sobra.
    clearTimeout(timeout);
    esperandoJugar = true;
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
      // Bajo «Jugar», un enlace discreto para quien quiere ver antes cómo se juega: reproduce
      // la guía en vídeo aquí mismo y, al terminar, se vuelve a esta portada.
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
    document.getElementById('splash-guide')?.addEventListener('click', () => verVideo(el));
    try { button.focus({ preventScroll: true }); } catch { /* Sin foco también se pulsa. */ }
  }));
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
    capa.setAttribute('aria-label', 'Cómo se juega');
    capa.innerHTML = `<div class="splash-video-head"><button type="button" class="splash-video-close" aria-label="Volver a la portada">←</button><span>Cómo se juega</span></div>${video}`;
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
