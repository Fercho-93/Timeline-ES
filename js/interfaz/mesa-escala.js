// La mesa de juego se dibuja siempre como en la pantalla de un iPhone Pro (402 × 874 puntos,
// con la isla arriba y la barra de inicio abajo) y después se escala entera, sin deformarla,
// hasta caber en la pantalla real. Así cada carta, botón y texto ocupa el mismo sitio y la
// misma proporción en cualquier móvil y en el ordenador.
//
// Tres cosas hacen falta para que el dibujo sea idéntico en todas partes:
// - Las medidas: #app mide 402 × 874 y las unidades de pantalla (vw, dvh…) y los márgenes
//   seguros del CSS pasan por variables (--vw, --safe-top…) que aquí valen lo del iPhone.
// - Las consultas @media: mientras se juega, cada una se resuelve como en ese iPhone
//   (las de tamaño); las demás (movimiento reducido, ratón…) siguen las del aparato real.
// - La plataforma: algunas reglas distinguen Android; la mesa usa siempre las del iPhone.
(() => {
  const CT = window.CONTINUUM = window.CONTINUUM || {};
  const ANCHO = 402, ALTO = 874, ARRIBA = 62, ABAJO = 34;
  const UTIL = ALTO - ARRIBA - ABAJO;
  let activa = false, escala = 1;
  const originales = new Map();
  const plataformaReal = {};
  let fondo = null, sonda = null;

  // Una consulta tal como la vería el iPhone de referencia. Solo se reinterpretan las
  // medidas; lo que no se entiende se deja en manos del navegador.
  function medida(valor) {
    const m = /^(-?[\d.]+)(px|em|rem)?$/.exec(valor.trim());
    if (!m) return null;
    return Number(m[1]) * (m[2] === 'em' || m[2] === 'rem' ? 16 : 1);
  }
  function rasgo(texto) {
    const m = /^(min-|max-)?(width|height|aspect-ratio|orientation)\s*:\s*(.+)$/.exec(texto.trim());
    if (!m) return window.matchMedia(`(${texto})`).matches;
    const [, limite, nombre, valor] = m;
    if (nombre === 'orientation') return valor.trim() === (ANCHO > ALTO ? 'landscape' : 'portrait');
    let actual = nombre === 'width' ? ANCHO : nombre === 'height' ? ALTO : ANCHO / ALTO;
    let pedido;
    if (nombre === 'aspect-ratio') {
      const r = /^([\d.]+)\s*\/\s*([\d.]+)$/.exec(valor.trim());
      pedido = r ? Number(r[1]) / Number(r[2]) : Number(valor);
    } else pedido = medida(valor);
    if (pedido === null || Number.isNaN(pedido)) return window.matchMedia(`(${texto})`).matches;
    return limite === 'min-' ? actual >= pedido : limite === 'max-' ? actual <= pedido : actual === pedido;
  }
  function consulta(texto) {
    return texto.split(',').some(parte => {
      let q = parte.trim().toLowerCase();
      let niega = false;
      if (q.startsWith('not ')) { niega = true; q = q.slice(4); }
      else if (q.startsWith('only ')) q = q.slice(5);
      const piezas = q.split(/\s+and\s+/);
      let sale = true;
      for (const pieza of piezas) {
        const p = pieza.trim();
        if (p === 'all' || p === 'screen') continue;
        if (p === 'print') { sale = false; continue; }
        const dentro = /^\((.*)\)$/.exec(p);
        if (!dentro || /\(|\)|\bor\b|[<>=]/.test(dentro[1])) return window.matchMedia(parte).matches;
        if (!rasgo(dentro[1])) sale = false;
      }
      return niega ? !sale : sale;
    });
  }
  function reglasMedia(lista, salida = []) {
    for (const regla of lista) {
      if (regla instanceof CSSMediaRule) salida.push(regla);
      if (regla.cssRules) reglasMedia(regla.cssRules, salida);
    }
    return salida;
  }
  function todasLasMedia() {
    const salida = [];
    for (const hoja of document.styleSheets) {
      let reglas;
      try { reglas = hoja.cssRules; } catch { continue; }
      if (reglas) reglasMedia(reglas, salida);
    }
    return salida;
  }
  function fijaMedia() {
    for (const regla of todasLasMedia()) {
      const texto = originales.has(regla) ? originales.get(regla) : regla.media.mediaText;
      if (!/(width|height|aspect-ratio|orientation)/.test(texto)) continue;
      originales.set(regla, texto);
      regla.media.mediaText = consulta(texto) ? 'all' : 'not all';
    }
  }
  function sueltaMedia() {
    for (const [regla, texto] of originales) {
      try { regla.media.mediaText = texto; } catch { /* hoja retirada */ }
    }
    originales.clear();
  }

  function margenes() {
    if (!sonda) {
      sonda = document.createElement('div');
      sonda.setAttribute('aria-hidden', 'true');
      sonda.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.append(sonda);
    }
    const s = getComputedStyle(sonda);
    return { top: parseFloat(s.paddingTop) || 0, right: parseFloat(s.paddingRight) || 0, bottom: parseFloat(s.paddingBottom) || 0, left: parseFloat(s.paddingLeft) || 0 };
  }
  // La parte útil del iPhone (entre la isla y la barra de inicio) tiene que caber entera en
  // la parte útil de esta pantalla. Las franjas de los márgenes del iPhone son papel vacío:
  // si aquí no hay muesca, pueden quedar fuera de la vista sin que se pierda nada.
  function coloca(app) {
    const ancho = window.innerWidth, alto = window.innerHeight;
    const m = margenes();
    const libreX = Math.max(1, ancho - m.left - m.right), libreY = Math.max(1, alto - m.top - m.bottom);
    escala = Math.min(libreX / ANCHO, libreY / UTIL);
    const x = m.left + (libreX - ANCHO * escala) / 2;
    const y = m.top + (libreY - UTIL * escala) / 2 - ARRIBA * escala;
    // En la raíz y no en #app: también las lee el papel de fondo, que está fuera de la mesa.
    const raiz = document.documentElement.style;
    raiz.setProperty('--mesa-escala', String(escala));
    raiz.setProperty('--mesa-x', `${x}px`);
    raiz.setProperty('--mesa-y', `${y}px`);
  }
  function plataforma(app, iphone) {
    const raiz = document.documentElement;
    if (iphone) {
      plataformaReal.app = { platform: app.dataset.platform, device: app.dataset.device };
      plataformaReal.raiz = raiz.dataset.platform;
      app.dataset.platform = 'other'; app.dataset.device = 'ios';
      if (raiz.dataset.platform) raiz.dataset.platform = 'other';
    } else if (plataformaReal.app) {
      if (plataformaReal.app.platform !== undefined) app.dataset.platform = plataformaReal.app.platform;
      if (plataformaReal.app.device !== undefined) app.dataset.device = plataformaReal.app.device;
      if (plataformaReal.raiz !== undefined) raiz.dataset.platform = plataformaReal.raiz;
      plataformaReal.app = null;
    }
  }
  function alDesplazar() {
    const app = document.getElementById('app');
    app?.style.setProperty('--mesa-desplazada', `${app.scrollTop}px`);
  }

  // Tabletas (iPad, tabletas Android): pantalla táctil de al menos 700 × 600. `html[data-tablet]` vale
  // «vertical» u «horizontal» (tablet.css cuelga de ahí). En vertical, la mesa sigue escalada como un
  // iPhone: cabe entera a lo alto y las cartas salen grandes. En horizontal ese iPhone dejaría una columna
  // estrecha en medio de la pantalla, así que la partida usa las medidas reales con dos columnas
  // (tablet.css). El ordenador con ratón y los móviles siguen con la mesa a escala.
  const consultaTablet = window.matchMedia?.('(min-width: 700px) and (min-height: 600px) and (pointer: coarse)');
  const esTablet = () => !!consultaTablet?.matches;
  const esTabletHorizontal = () => esTablet() && window.innerWidth > window.innerHeight;
  const marcaTablet = () => {
    const raiz = document.documentElement;
    if (esTablet()) raiz.setAttribute('data-tablet', esTabletHorizontal() ? 'horizontal' : 'vertical');
    else raiz.removeAttribute('data-tablet');
  };
  marcaTablet();

  // La pinta immersion.js en cada pantalla: dentro de la partida, la mesa; fuera, la vista normal.
  function aplica(app, mesa) {
    if (!app) return;
    if (mesa && esTabletHorizontal()) mesa = false;
    if (mesa && !activa) {
      activa = true;
      fijaMedia();
      plataforma(app, true);
      if (!fondo) {
        fondo = document.createElement('div');
        fondo.className = 'mesa-fondo';
        fondo.setAttribute('aria-hidden', 'true');
      }
      app.before(fondo);
      document.documentElement.classList.add('mesa-escalada');
      app.classList.add('mesa-escena');
      coloca(app);
      app.scrollTop = 0;
      alDesplazar();
      app.addEventListener('scroll', alDesplazar, { passive: true });
    } else if (!mesa && activa) {
      activa = false;
      app.removeEventListener('scroll', alDesplazar);
      app.classList.remove('mesa-escena');
      document.documentElement.classList.remove('mesa-escalada');
      ['--mesa-escala', '--mesa-x', '--mesa-y'].forEach(nombre => document.documentElement.style.removeProperty(nombre));
      app.style.removeProperty('--mesa-desplazada');
      fondo?.remove();
      plataforma(app, false);
      sueltaMedia();
    }
  }
  function recoloca() {
    const app = document.getElementById('app');
    marcaTablet();
    if (!app) return;
    // Girar la tableta en plena partida cambia de la mesa a escala a las dos columnas, o al revés.
    if (app.classList.contains('atlas-board') && activa === esTabletHorizontal()) aplica(app, true);
    else if (activa) coloca(app);
  }
  window.addEventListener('resize', recoloca, { passive: true });
  window.addEventListener('orientationchange', recoloca, { passive: true });

  // Medidas en puntos de la mesa (como en el iPhone), contadas desde lo alto de la
  // pantalla de la mesa. Fuera de la partida son las de la ventana.
  function caja(el) {
    const r = el.getBoundingClientRect();
    if (!activa) return r;
    const base = document.getElementById('app').getBoundingClientRect();
    const top = (r.top - base.top) / escala, left = (r.left - base.left) / escala;
    const width = r.width / escala, height = r.height / escala;
    return { top, left, width, height, bottom: top + height, right: left + width, x: left, y: top };
  }
  CT.Mesa = {
    ANCHO, ALTO,
    aplica,
    tablet: esTablet,
    tabletHorizontal: esTabletHorizontal,
    activa: () => activa,
    escala: () => (activa ? escala : 1),
    ancho: () => (activa ? ANCHO : window.innerWidth),
    alto: () => (activa ? ALTO : (window.visualViewport?.height || window.innerHeight)),
    // Lo desplazado de la mesa: dentro de la partida se desplaza #app, no la ventana.
    desplazado: () => (activa ? document.getElementById('app').scrollTop : window.scrollY),
    desplaza: (puntos, suave) => {
      if (!activa) { window.scrollBy({ top: puntos, behavior: suave ? 'smooth' : 'auto' }); return; }
      const app = document.getElementById('app');
      if (app.scrollBy) app.scrollBy({ top: puntos, behavior: suave ? 'smooth' : 'auto' });
      else app.scrollTop += puntos;
    },
    caja,
    consulta
  };
})();
