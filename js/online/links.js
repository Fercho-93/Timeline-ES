// Los enlaces del juego: cómo se escriben y se leen las invitaciones a salas y duelos, y qué dominios
// se aceptan.
(function () {
  'use strict';
  const CT = window.CONTINUUM = window.CONTINUUM || {};
  // La dirección pública de la app es su dominio propio. La antigua de GitHub se sigue aceptando
  // (enlaces ya enviados y apps sin actualizar) y GitHub la redirige al dominio.
  const PUBLIC_URL = 'https://continuumjuego.es/';
  const LEGACY_URL = 'https://fercho-93.github.io/Timeline-ES/';
  const TRUSTED = [PUBLIC_URL, 'https://www.continuumjuego.es/', LEGACY_URL];
  // Desde la web, las invitaciones usan la dirección desde la que se juega (así, al activarse el
  // dominio, salen ya con él); la app nativa usa la pública fija.
  const shareBase = () => {
    if (window.Capacitor?.isNativePlatform?.()) return PUBLIC_URL;
    try { return TRUSTED.find(base => location.href.startsWith(base)) || PUBLIC_URL; } catch { return PUBLIC_URL; }
  };
  const LEGAL_PAGES = ['privacidad.html', 'terminos.html', 'aviso-legal.html', 'soporte.html', 'borrar-cuenta.html', 'licencias.html'];
  // Alfabeto de los códigos de sala: letras y cifras sin las que se confunden al dictarlas o
  // copiarlas (I, O, 0 y 1). Es el mismo `[A-HJ-NP-Z2-9]` con el que `parse` y `fromText` los leen.
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  CT.Links = {
    // Un código de sala nuevo al azar: 8 caracteres para las salas online (online.js) y sin
    // conexión (local-multiplayer.js). 2³² es múltiplo de 32: todas las letras salen igual.
    roomCode(length = 8) {
      const values = new Uint32Array(length);
      crypto.getRandomValues(values);
      return [...values].map(value => CODE_CHARS[value % CODE_CHARS.length]).join('');
    },
    base() { return window.Capacitor?.isNativePlatform?.() ? PUBLIC_URL : location.origin + location.pathname; },
    parse(value) {
      try {
        const url = new URL(value);
        const nativeLink = url.protocol === 'continuum:' && url.hostname === 'invite' && (url.pathname === '' || url.pathname === '/');
        const fromTrusted = TRUSTED.map(base => new URL(base)).some(trusted => url.origin === trusted.origin && [trusted.pathname, trusted.pathname+'index.html', trusted.pathname+'invitation.html'].includes(url.pathname));
        if (!nativeLink && (url.protocol !== 'https:' || !fromTrusted)) return null;
        const params = new URLSearchParams(url.hash.slice(1) || url.search);
        const routes = ['room', 'duelo', 'turnoduelo', 'quick-room', 'quick-duel'];
        if (routes.filter(key => params.has(key)).length !== 1 || routes.some(key => params.getAll(key).length > 1)) return null;
        const room = params.get('room'), duelo = params.get('duelo'), turnDuel = params.get('turnoduelo');
        const quickRoom = params.get('quick-room'), quickDuel = params.get('quick-duel');
        if (room && /^[A-HJ-NP-Z2-9]{8}$/.test(room)) return {room};
        if (turnDuel && /^[a-f0-9]{32}$/.test(turnDuel)) return {turnDuel};
        if (duelo && duelo.length <= 12000) return {duelo};
        if (quickRoom && /^[A-HJ-NP-Z2-9]{10}$/.test(quickRoom)) return {quickRoom};
        if (quickDuel && quickDuel.length <= 16000 && /^[A-Za-z0-9_-]+$/.test(quickDuel)) return {quickDuel};
      } catch { /* Ignorar enlaces ajenos o malformados. */ }
      return null;
    },
    // Lo que alguien pega o escanea en «Unirme»: el enlace entero, solo su parte final o el
    // código suelto. Cada código tiene su forma: 8 caracteres es una sala, 10 una sala de
    // Retos rápidos y 32 hexadecimales un duelo por turnos.
    fromText(value) {
      const text = String(value || '').trim();
      if (!text) return null;
      const linked = CT.Links.parse(text);
      if (linked) return linked;
      const tail = text.match(/[#?]([^#?\s]*=[^#?\s]*)\s*$/) || text.match(/^((?:room|duelo|turnoduelo|quick-room|quick-duel)=\S+)$/);
      if (tail) return CT.Links.parse(PUBLIC_URL + '#' + tail[1]);
      const hex = text.replace(/\s+/g, '').toLowerCase();
      if (/^[a-f0-9]{32}$/.test(hex)) return {turnDuel: hex};
      const code = text.toUpperCase().replace(/[\s-]/g, '');
      if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) return {room: code};
      if (/^[A-HJ-NP-Z2-9]{10}$/.test(code)) return {quickRoom: code};
      return null;
    },
    params(target) {
      const params = new URLSearchParams();
      for (const [field, key] of [['room','room'], ['duelo','duelo'], ['turnDuel','turnoduelo'], ['quickRoom','quick-room'], ['quickDuel','quick-duel']]) {
        if (target?.[field]) params.set(key, target[field]);
      }
      return params;
    },
    invitation(value) {
      const target = typeof value === 'string' ? CT.Links.parse(value) : value;
      const url = new URL('invitation.html', shareBase());
      url.hash = CT.Links.params(target).toString();
      return url.href;
    },
    nativeUrl(target) { return 'continuum://invite?' + CT.Links.params(target).toString(); },
    // Las páginas legales (privacidad, condiciones, soporte…) son páginas del sitio, no pantallas del
    // juego. En la app nativa, un enlace relativo con target="_blank" se convertiría en
    // capacitor://localhost/privacidad.html, que el sistema no sabe abrir: el toque no haría nada.
    // Se abren por su dirección pública, en el navegador del sistema.
    legalUrl(href, base) {
      try {
        const url = new URL(href, base || location.href);
        // `origin` de una URL con esquema propio (capacitor://) es «null»: se compara esquema y servidor.
        if (url.protocol !== location.protocol || url.host !== location.host) return null;
        const page = url.pathname.split('/').pop();
        if (!LEGAL_PAGES.includes(page)) return null;
        return new URL(page + url.search + url.hash, PUBLIC_URL).href;
      } catch { return null; }
    },
    start(open) {
      const cap = window.Capacitor;
      if (!cap?.isNativePlatform?.()) return;
      const app = cap.registerPlugin?.('App') || cap.Plugins?.App;
      // iOS puede entregar el mismo arranque por getLaunchUrl y appUrlOpen.
      let last = '', receivedAt = 0;
      const receive = event => {
        const target = CT.Links.parse(event?.url);
        if (!target) return;
        const key = CT.Links.params(target).toString(), now = Date.now();
        if (key === last && now - receivedAt < 1500) return;
        last = key; receivedAt = now;
        open(target);
      };
      Promise.resolve(app?.addListener?.('appUrlOpen', receive)).catch(()=>{});
      Promise.resolve(app?.getLaunchUrl?.()).then(receive).catch(()=>{});
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('click', event => {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    const link = event.target?.closest?.('a[href]');
    if (!link || event.defaultPrevented) return;
    const url = CT.Links.legalUrl(link.getAttribute('href'));
    if (!url) return;
    event.preventDefault();
    window.open(url, '_blank');
  }, true);
})();
