(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const PUBLIC_URL = 'https://fercho-93.github.io/Timeline-ES/';
  CT.Links = {
    base() { return window.Capacitor?.isNativePlatform?.() ? PUBLIC_URL : location.origin + location.pathname; },
    parse(value) {
      try {
        const url = new URL(value), trusted = new URL(PUBLIC_URL);
        if (url.protocol !== 'https:' || url.origin !== trusted.origin || ![trusted.pathname, trusted.pathname+'index.html'].includes(url.pathname)) return null;
        const params = new URLSearchParams(url.hash.slice(1) || url.search);
        const room = params.get('room'), duelo = params.get('duelo');
        if (room && /^[A-HJ-NP-Z2-9]{8}$/.test(room)) return {room};
        if (duelo && duelo.length <= 12000) return {duelo};
      } catch { /* Ignorar enlaces ajenos o malformados. */ }
      return null;
    },
    start(open) {
      const cap = window.Capacitor;
      if (!cap?.isNativePlatform?.()) return;
      const app = cap.registerPlugin?.('App') || cap.Plugins?.App;
      const receive = event => { const target = CT.Links.parse(event?.url); if (target) open(target); };
      Promise.resolve(app?.addListener?.('appUrlOpen', receive)).catch(()=>{});
      Promise.resolve(app?.getLaunchUrl?.()).then(receive).catch(()=>{});
    }
  };
})();
