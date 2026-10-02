(function () {
  'use strict';
  const CT = window.CONTINUUM = window.CONTINUUM || {};
  const PUBLIC_URL = 'https://fercho-93.github.io/Timeline-ES/';
  CT.Links = {
    base() { return window.Capacitor?.isNativePlatform?.() ? PUBLIC_URL : location.origin + location.pathname; },
    parse(value) {
      try {
        const url = new URL(value), trusted = new URL(PUBLIC_URL);
        const nativeLink = url.protocol === 'continuum:' && url.hostname === 'invite' && (url.pathname === '' || url.pathname === '/');
        if (!nativeLink && (url.protocol !== 'https:' || url.origin !== trusted.origin || ![trusted.pathname, trusted.pathname+'index.html', trusted.pathname+'invitation.html'].includes(url.pathname))) return null;
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
    params(target) {
      const params = new URLSearchParams();
      for (const [field, key] of [['room','room'], ['duelo','duelo'], ['turnDuel','turnoduelo'], ['quickRoom','quick-room'], ['quickDuel','quick-duel']]) {
        if (target?.[field]) params.set(key, target[field]);
      }
      return params;
    },
    invitation(value) {
      const target = typeof value === 'string' ? CT.Links.parse(value) : value;
      const url = new URL('invitation.html', PUBLIC_URL);
      url.hash = CT.Links.params(target).toString();
      return url.href;
    },
    nativeUrl(target) { return 'continuum://invite?' + CT.Links.params(target).toString(); },
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
})();
