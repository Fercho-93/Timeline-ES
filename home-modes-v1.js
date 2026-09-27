(function () {
  'use strict';

  const start = () => {
  const app = document.getElementById('app');
  if (!app) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const modeArt = {
    'online-hub': 'mode-walk-duel.webp',
    'solo-hub': 'mode-walk-solo.webp',
    'friends-hub': 'mode-walk-multi.webp',
    'competition-menu': 'competition-engraving.webp',
    'public-match': 'mode-walk-duel.webp',
    'online-collections': 'hero-mixed-700.webp',
    'quick-public': 'hero-quick-700.webp',
    'jugar': 'hero-mixed-700.webp',
    'quick-challenges': 'hero-quick-700.webp'
  };

  function modeDoor(action, art, title, description, featured = false, attrs = '') {
    const image = art || modeArt[action] || 'home-door-jugar.webp';
    return `<button class="mode-entry${featured ? ' mode-entry-featured' : ''}" data-action="${action}" ${attrs}>
      <span class="mode-entry-art" aria-hidden="true"><img src="assets/${image}" alt="" loading="lazy" decoding="async"></span>
      <span class="mode-entry-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small><span class="mode-entry-cta" aria-hidden="true">Explorar <span>→</span></span></span>
    </button>`;
  }

  function dailyFamily() {
    const d=new Date(), stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const n=Number(stamp);
    return n%2===0?'Grandes colecciones':'Retos rápidos';
  }

  function restructureHome() {
    if (app.dataset.screen !== 'home') return;
    const doors = app.querySelector('.home-doors');
    if (!doors || doors.dataset.modesV1 === 'true') return;

    const daily = doors.querySelector('.home-door-daily');
    const atlas = doors.querySelector('.home-door[data-action="perfil"]');
    if (!daily || !atlas) return;

    const dailyWrap = document.createElement('section');
    dailyWrap.className = 'mode-daily-zone';
    dailyWrap.setAttribute('aria-label', 'Reto del día');
    dailyWrap.append(daily);
    const family=document.createElement('p');family.className='mode-daily-family';family.innerHTML=`Hoy · <strong>${dailyFamily()}</strong> · un único reto del día`;dailyWrap.append(family);

    const legacyPlay = doors.querySelector('.home-door[data-action="jugar"]');
    if (legacyPlay) legacyPlay.classList.add('mode-legacy-entry');

    const choices = document.createElement('section');
    choices.className = 'mode-entry-grid';
    choices.setAttribute('aria-label', 'Cómo quieres jugar');
    choices.innerHTML = [
      modeDoor('online-hub', modeArt['online-hub'], 'Jugar online', 'Encuentra jugadores en una mesa pública.', true),
      modeDoor('solo-hub', modeArt['solo-hub'], 'Jugar solo', 'Colecciones, retos rápidos y Gran mezcla.'),
      modeDoor('friends-hub', modeArt['friends-hub'], 'Jugar con amigos', 'En el mismo móvil o cada uno en el suyo.'),
      modeDoor('competition-menu', modeArt['competition-menu'], 'Competición', 'Rondas y temas con marcador acumulado.')
    ].join('');

    const secondary = document.createElement('section');
    secondary.className = 'mode-secondary';
    secondary.setAttribute('aria-label', 'Tu colección');
    atlas.classList.add('mode-atlas-entry');
    secondary.append(atlas);

    doors.replaceChildren(dailyWrap, choices, secondary);
    if (legacyPlay) doors.append(legacyPlay);
    doors.dataset.modesV1 = 'true';
  }

  function hub(title, eyebrow, body, art) {
    app.dataset.screen = 'mode-hub';
    app.innerHTML = `<div class="shell home-shell mode-hub-shell">
      <header class="mode-hub-head"><button class="icon-btn" data-mode-home>Volver</button><div class="mode-hub-title"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1></div><img src="assets/${art}" alt="" aria-hidden="true" decoding="async"></header>
      <section class="mode-hub-list">${body}</section>
    </div>`;
  }

  function openOnlineHub() {
    hub('Jugar online', 'Mesas públicas', [
      `<div class="mode-online-config"><label for="mode-public-capacity">Mesa</label><select id="mode-public-capacity"><option value="0">Cualquiera · más rápido</option><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4">4 jugadores</option></select><small>Si eliges “Cualquiera”, buscamos primero una mesa de 4 y después de 3 o 2.</small></div>`,
      modeDoor('public-match', modeArt['public-match'], 'Sorpréndeme', 'Entra en la primera mesa disponible.', false, 'data-online-kind="surprise"'),
      modeDoor('online-collections', modeArt['online-collections'], 'Grandes colecciones', 'Elige hasta tres temas para buscar mesa.', false, 'data-online-kind="collections"'),
      modeDoor('quick-public', modeArt['quick-public'], 'Retos rápidos', 'Partidas breves con jugadores aleatorios.', false, 'data-online-kind="quick"')
    ].join(''), modeArt['online-hub']);
  }

  function openOnlineCollections() {
    const modes=Object.entries(window.CONTINUUM?.MODES||{}).filter(([key])=>key!=='mixed').slice(0,12);
    hub('Grandes colecciones', 'Mesa pública · temas', `
      <div class="mode-topic-picker"><p>Marca hasta 3 temas. Buscaremos mesa en esos temas; si no eliges ninguno, buscaremos en todas las colecciones.</p>
      <div class="mode-topic-grid">${modes.map(([key,m])=>`<label><input type="checkbox" value="${escapeHtml(key)}" data-public-topic> <span>${escapeHtml(m.name)}</span></label>`).join('')}</div>
      ${modeDoor('public-match', modeArt['online-hub'], 'Buscar mesa', 'La mesa compartirá un único tema.', true, 'data-online-kind="collections-vote"')}</div>`, modeArt['online-collections']);
  }

  function openSoloHub() {
    hub('Jugar solo', 'A tu ritmo', [
      modeDoor('jugar', 'hero-history-700.webp', 'Grandes colecciones', 'Historia, ciencia, naturaleza y más.', false, 'data-solo-route="collections"'),
      modeDoor('quick-challenges', 'hero-quick-700.webp', 'Retos rápidos', 'Temas concretos para partidas cortas.', false, 'data-solo-route="quick"'),
      modeDoor('jugar', 'hero-mixed-700.webp', 'Gran mezcla', 'Cartas de todas las colecciones.', false, 'data-solo-route="mixed"')
    ].join(''), modeArt['solo-hub']);
  }

  function openFriendsHub() {
    hub('Jugar con amigos', 'Juntos', [
      modeDoor('jugar', 'mode-walk-duel.webp', 'Un solo móvil', 'Pasad el teléfono en cada turno.', false, 'data-friend-route="local"'),
      modeDoor('jugar', 'mode-walk-multi.webp', 'Sala privada', 'Cada persona con su móvil, por código o enlace.', false, 'data-friend-route="online"'),
      modeDoor('jugar', 'mode-walk-multi.webp', 'Wi‑Fi local', 'Varios móviles cerca, sin internet.', false, 'data-friend-route="wifi"'),
      modeDoor('jugar', 'mode-walk-duel.webp', 'Duelo por turnos', 'Jugad cuando podáis, por enlace.', false, 'data-friend-route="duel"')
    ].join(''), modeArt['friends-hub']);
  }

  app.addEventListener('click', event => {
    const topicInput=event.target.closest('[data-public-topic]');
    if(topicInput){
      const checked=[...document.querySelectorAll('[data-public-topic]:checked')];
      if(checked.length>3){topicInput.checked=false;return;}
    }
    const publicEntry = event.target.closest('[data-action="public-match"][data-online-kind]');
    if (publicEntry) {
      sessionStorage.setItem('continuum-public-kind', publicEntry.dataset.onlineKind || 'surprise');
      const topics=[...document.querySelectorAll('[data-public-topic]:checked')].slice(0,3).map(x=>x.value);
      if(topics.length) sessionStorage.setItem('continuum-public-topics',JSON.stringify(topics)); else sessionStorage.removeItem('continuum-public-topics');
      const cap=document.getElementById('mode-public-capacity')?.value ?? sessionStorage.getItem('continuum-public-capacity') ?? '0';
      sessionStorage.setItem('continuum-public-capacity',cap);
    }
    const home = event.target.closest('[data-mode-home]');
    if (home) {
      event.preventDefault();
      window.CONTINUUM?.localNavigate?.('home');
      return;
    }
    const routed=event.target.closest('[data-solo-route],[data-friend-route]');
    if(routed){
      const route=routed.dataset.soloRoute||routed.dataset.friendRoute;
      sessionStorage.setItem('continuum-entry-route',route);
      if(route==='mixed') try{localStorage.setItem('hilo-selected-mode-v1','mixed');}catch{}
    }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if(action==='online-collections') sessionStorage.setItem('continuum-public-capacity',document.getElementById('mode-public-capacity')?.value ?? '0');
    if(action==='quick-public'){
      event.preventDefault();event.stopImmediatePropagation();
      const cap=Number(document.getElementById('mode-public-capacity')?.value||sessionStorage.getItem('continuum-public-capacity')||0);
      window.CONTINUUM.Quick.openPublic((html,playing)=>{app.dataset.screen=playing?'quick-game':'quick-lobby';app.innerHTML=html;},cap)
        .catch(error=>{console.error('QUICK_PUBLIC_MATCH_ERROR',error);openOnlineHub();const note=document.createElement('p');note.setAttribute('role','alert');note.textContent=error?.message || 'No se pudo encontrar una mesa. Inténtalo de nuevo.';app.querySelector('.mode-hub-list')?.prepend(note);});return;
    }
    if (!['online-hub','online-collections','solo-hub','friends-hub'].includes(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'online-hub') openOnlineHub();
    else if (action === 'online-collections') openOnlineCollections();
    else if (action === 'solo-hub') openSoloHub();
    else openFriendsHub();
  }, true);

  function seasonKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function rankingSummary() {
    let classic=0, quick=0;
    try {
      const records=JSON.parse(localStorage.getItem('hilo-retos-v1')||'{}');
      const raw=records.retoDiario||{};
      for(const [date,result] of Object.entries(raw.days||{})){
        if(!date.startsWith(seasonKey()) || !(Number(result.total)>0))continue;
        const points=Math.round(100*Math.max(0,Math.min(1,Number(result.hits)/Number(result.total))));
        if(result.family==='quick')quick+=points;else classic+=points;
      }
    } catch {}
    return {classic,quick,total:classic+quick};
  }

  function addRankingSummary() {
    if(app.dataset.screen!=='home' || app.querySelector('.mode-ranking-summary')) return;
    const doors=app.querySelector('.home-doors'); if(!doors)return;
    const r=rankingSummary(), box=document.createElement('section');
    box.className='mode-ranking-summary';
    box.innerHTML=`<div><small>TUS RETOS · ${seasonKey()} · PUNTOS</small><b>${r.total}</b></div><p>Grandes colecciones <strong>${r.classic}</strong> · Retos rápidos <strong>${r.quick}</strong></p>`;
    doors.append(box);
  }

  const observer = new MutationObserver(()=>{restructureHome();addRankingSummary();});
  observer.observe(app, { childList: true, subtree: true });
  restructureHome();
  addRankingSummary();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
