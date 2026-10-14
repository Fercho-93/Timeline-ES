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
  const CAJA_ABRE = 2750, CAJA_SE_VA = 500;
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
  const CARTAS = ['assets/splash-card-marathon.webp', 'assets/splash-card-hippocrates.webp', 'assets/splash-card-vesuvius.webp'];
  // El mar, dibujado: cielo, sol bajo, tierra al fondo, oleaje, la borda del barco y la
  // cubierta de tablones en perspectiva. Un solo SVG que se recorta por el centro en
  // cualquier pantalla (todo lo importante está en la franja central).
  const mar = () => {
    const ola = (y, n = 16) => `M-120 ${y}` + Array.from({ length: n }, () => ' q40 -7 80 0 t80 0').join('');
    const postes = [60, 300, 540, 780, 1020, 1260];
    const cuerda = postes.slice(0, -1).map((x, i) => `<path d="M${x + 7} 522 Q${(x + postes[i + 1]) / 2} 556 ${postes[i + 1] - 7} 522"/>`).join('');
    const tablas = Array.from({ length: 15 }, (_, i) => {
      const k = (i - 7) * .19, k2 = (i - 6) * .19;
      const x1 = 600 + k * 315, x2 = 600 + k * 500, x3 = 600 + k2 * 500, x4 = 600 + k2 * 315;
      return `<polygon points="${x1},615 ${x2},800 ${x3},800 ${x4},615" fill="${['#8c5a33', '#7e4f2a', '#946239'][i % 3]}"/>`;
    }).join('');
    return `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="cf-cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa5c2"/><stop offset=".55" stop-color="#bdd5de"/><stop offset="1" stop-color="#f4dcb0"/></linearGradient>
        <radialGradient id="cf-sol"><stop offset="0" stop-color="#fff7d6"/><stop offset=".35" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
        <linearGradient id="cf-mar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86b7c8"/><stop offset=".3" stop-color="#4a8ca6"/><stop offset="1" stop-color="#22607b"/></linearGradient>
        <linearGradient id="cf-tierra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93a7b2"/><stop offset="1" stop-color="#6c8591"/></linearGradient>
        <linearGradient id="cf-madera" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5713f"/><stop offset="1" stop-color="#6b4323"/></linearGradient>
        <radialGradient id="cf-vineta" cx=".5" cy=".55" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1a0e05" stop-opacity=".5"/></radialGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#cf-cielo)"/>
      <circle cx="640" cy="330" r="130" fill="url(#cf-sol)"/><circle cx="640" cy="330" r="36" fill="#fff6d8"/>
      <g class="nube" fill="#fff9ee" opacity=".82"><ellipse cx="250" cy="150" rx="90" ry="26"/><ellipse cx="300" cy="135" rx="60" ry="30"/><ellipse cx="200" cy="140" rx="50" ry="22"/></g>
      <g class="nube nube-2" fill="#fff9ee" opacity=".7"><ellipse cx="900" cy="210" rx="110" ry="24"/><ellipse cx="950" cy="195" rx="70" ry="30"/><ellipse cx="850" cy="200" rx="55" ry="20"/></g>
      <g class="gaviota" fill="none" stroke="#3f4a52" stroke-width="2.4" stroke-linecap="round"><path d="M380 180q12-12 24 0q12-12 24 0"/><path d="M440 160q9-9 18 0q9-9 18 0"/></g>
      <g class="gaviota gaviota-2" fill="none" stroke="#3f4a52" stroke-width="2" stroke-linecap="round"><path d="M760 230q10-10 20 0q10-10 20 0"/></g>
      <path fill="url(#cf-tierra)" stroke="#4d5e6a" stroke-width="1.5" d="M-10 414 L-10 392 C60 372 120 362 190 374 C240 382 280 366 330 384 C370 398 420 404 470 412 Z"/>
      <path fill="url(#cf-tierra)" stroke="#4d5e6a" stroke-width="1.5" d="M820 413 C860 394 900 386 950 394 C990 400 1030 388 1070 398 C1100 404 1150 410 1210 412 L1210 416 L820 416Z"/>
      <path fill="#8ea3af" stroke="#56687400" stroke-width="1.3" d="M300 413 C360 398 410 386 470 392 C520 397 560 380 610 388 C660 396 700 386 745 393 C800 401 850 408 900 413 Z"/>
      <path d="M736 400 L739 380 L746 380 L749 400Z" fill="#f1e6cf" stroke="#4d5e6a" stroke-width="1.2"/><rect x="738" y="375" width="9" height="6" fill="#b43f2a"/>
      <path d="M1000 398 L1004 370 L1013 370 L1017 398Z" fill="#f1e6cf" stroke="#4d5e6a" stroke-width="1.2"/><rect x="1003" y="364" width="11" height="7" fill="#b43f2a"/>
      <rect y="410" width="1200" height="200" fill="url(#cf-mar)"/>
      <g class="destello" fill="#fff4cf"><ellipse cx="640" cy="424" rx="36" ry="2"/><ellipse cx="628" cy="438" rx="22" ry="2"/><ellipse cx="652" cy="452" rx="30" ry="2.2"/><ellipse cx="636" cy="470" rx="18" ry="2"/><ellipse cx="648" cy="490" rx="26" ry="2.4"/></g>
      <g class="ola" fill="none" stroke="#dbeef3" stroke-opacity=".55" stroke-width="2"><path d="${ola(432)}"/><path d="${ola(452)}"/></g>
      <g class="ola ola-2" fill="none" stroke="#d2e8ee" stroke-opacity=".45" stroke-width="2.4"><path d="${ola(478)}"/><path d="${ola(500)}"/></g>
      <g class="ola ola-3" fill="none" stroke="#c6e0e8" stroke-opacity=".35" stroke-width="3"><path d="${ola(528)}"/><path d="${ola(560)}"/></g>
      <g stroke="#2b1a0e" stroke-width="2">
        ${postes.map(x => `<rect x="${x - 8}" y="506" width="16" height="80" fill="#5a3a20"/>`).join('')}
        <rect x="-10" y="500" width="1220" height="18" rx="4" fill="url(#cf-madera)"/>
        <rect x="-10" y="580" width="1220" height="42" fill="#7d5231"/><line x1="-10" y1="600" x2="1210" y2="600" stroke="#5a3a20" stroke-width="1.5"/>
      </g>
      <g fill="none" stroke="#d6b57c" stroke-width="5" stroke-linecap="round">${cuerda}</g>
      <rect y="615" width="1200" height="185" fill="#85552f"/>
      <g stroke="#3a2210" stroke-width="1.2">${tablas}</g>
      <g transform="translate(340 752) scale(1 .45)" fill="none" stroke="#5a3a20" stroke-width="11"><circle r="58"/><circle r="42"/><circle r="26"/><circle r="11"/></g>
      <g transform="translate(340 752) scale(1 .45)" fill="none" stroke="#cfae72" stroke-width="7"><circle r="58"/><circle r="42"/><circle r="26"/><circle r="11"/></g>
      <rect width="1200" height="800" fill="url(#cf-vineta)"/>
    </svg>`;
  };
  const montaCaja = el => {
    // Mientras el cofre espera un toque no corre el aviso de carga lenta: se espera a una persona.
    clearTimeout(timeout);
    const escena = document.createElement('div');
    escena.className = 'splash-caja-escena';
    escena.innerHTML = `<div class="cofre-mar">${mar()}</div>
      <p class="caja-etiqueta">Rumbo a <b>Continuum</b></p>
      <div class="caja-mundo"><div class="caja-zoom">
        <div class="caja-mesa"><i class="caja-sombra"></i><i class="caja-rayos"></i>
          <span class="caja-cae"><div class="caja" role="button" tabindex="0" aria-label="Abrir el cofre de Continuum">
            <span class="caja-cuerpo">
              <i class="caja-cara caja-suelo"></i><i class="caja-luz"></i>
              <i class="caja-cara caja-atras"></i><i class="caja-cara caja-izquierda"></i><i class="caja-cara caja-derecha"></i><i class="caja-cara caja-frente"></i>
            </span>
            <span class="caja-cartas">${CARTAS.map((src, i) => `<i class="caja-carta" style="--n:${i}"><img src="${src}" alt="" /></i>`).join('')}</span>
            <span class="caja-tapa">
              <i class="caja-cara caja-tapa-arriba"><img src="assets/continuum-emblem-800.webp" alt="" width="800" height="533" /></i><i class="caja-cara caja-tapa-dentro"></i>
              <i class="caja-cara caja-tapa-atras"></i><i class="caja-cara caja-tapa-izquierda"></i><i class="caja-cara caja-tapa-derecha"></i><i class="caja-cara caja-tapa-frente"></i>
            </span>
            <i class="caja-sello"></i>
          </div></span>
        </div>
      </div></div>
      <p class="caja-pista">Toca el cofre para abrirlo</p>`;
    el.append(escena);
    let abierta = false;
    const abre = () => {
      if (abierta) return;
      abierta = true;
      try { localStorage.setItem(CAJA, '1'); } catch { /* Se verá otra vez: mejor eso que no entrar. */ }
      el.classList.add('splash-caja-abriendo');
      // Un botón de verdad aplanaría la caja (los navegadores no respetan `preserve-3d` en
      // <button>): es un div con rol de botón, así que al abrirse deja de ser pulsable a mano.
      const caja = escena.querySelector('.caja');
      caja.setAttribute('aria-disabled', 'true'); caja.tabIndex = -1;
      setTimeout(() => {
        // La cámara ya está dentro, a oscuras: arranca la intro de siempre bajo la escena,
        // que se disuelve sobre su telón. El reloj de «Jugar» empieza a contar ahora.
        root.classList.remove('splash-caja');
        escena.classList.add('caja-se-va');
        introStart = performance.now();
        asienta(el);
        if (!esperandoJugar) guard();
        setTimeout(() => escena.remove(), CAJA_SE_VA);
        quitaCaja = null;
        resuelve();
      }, CAJA_ABRE);
    };
    let resuelve;
    cajaAbierta = new Promise(resolve => { resuelve = resolve; });
    // Si el telón se cierra con la caja aún en la mesa (arranque fallido), no se deja a nadie esperando.
    quitaCaja = () => { escena.remove(); root.classList.remove('splash-caja'); el.classList.remove('splash-caja-abriendo'); quitaCaja = null; resuelve(); };
    // Un toque en cualquier parte de la escena vale; la caja, además, responde al teclado.
    escena.addEventListener('click', abre);
    escena.querySelector('.caja').addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abre(); }
    });
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
