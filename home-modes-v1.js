(function () {
  'use strict';

  const start = () => {
  const app = document.getElementById('app');
  if (!app) return;
  let playExpanded = false;
  let revealAnimations = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const modeArt = {
    'online-hub': 'menu-online.webp',
    'solo-hub': 'mode-walk-solo.webp',
    'friends-hub': 'mode-walk-multi.webp',
    'competition-menu': 'competition-engraving.webp',
    'public-match': 'menu-online.webp',
    'online-collections': 'menu-collections.webp',
    'quick-public': 'menu-quick.webp',
    'quick-challenges': 'menu-quick.webp'
  };

  function modeDoor(action, art, title, description, featured = false, attrs = '', cta = '') {
    const image = art || modeArt[action] || 'home-door-jugar.webp';
    return `<button class="mode-entry${featured ? ' mode-entry-featured' : ''}" data-action="${action}" ${attrs}>
      <span class="mode-entry-art" aria-hidden="true"><img src="assets/${image}" alt="" loading="lazy" decoding="async"></span>
      <span class="mode-entry-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small><span class="mode-entry-cta" aria-hidden="true">${escapeHtml(cta || (action === 'public-match' || action === 'quick-public' ? 'Buscar mesa' : action === 'online-collections' ? 'Elegir temas' : action === 'wifi-join' ? 'Escanear' : 'Explorar'))} <span>→</span></span></span>
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
    if (!daily) return;

    const dailyWrap = document.createElement('section');
    dailyWrap.className = 'mode-daily-zone';
    dailyWrap.setAttribute('aria-label', 'Reto del día');
    dailyWrap.append(daily);
    const family=document.createElement('p');family.className='mode-daily-family';family.innerHTML=`Hoy · <strong>${dailyFamily()}</strong> · un único reto del día`;dailyWrap.append(family);

    const play = doors.querySelector('.home-door[data-action="jugar"]');
    if (!play) return;
    play.classList.add('mode-play-card');
    play.dataset.action = 'toggle-modes';
    play.setAttribute('aria-controls', 'home-mode-choices');
    play.setAttribute('aria-expanded', String(playExpanded));
    play.querySelector('.home-door-copy b').textContent = 'Jugar';
    play.querySelector('.home-door-copy small').textContent = 'Elige cómo quieres vivir la partida.';
    play.querySelector('.home-door-cta').innerHTML = '<span class="mode-play-cta-label">Elegir modalidad</span> <span class="mode-play-chevron" aria-hidden="true">⌄</span>';

    const choices = document.createElement('section');
    choices.className = 'mode-entry-grid';
    choices.id = 'home-mode-choices';
    choices.setAttribute('aria-label', 'Cómo quieres jugar');
    choices.innerHTML = [
      modeDoor('solo-hub', modeArt['solo-hub'], 'Jugar solo', 'Elige un mazo o una competición.', true),
      modeDoor('friends-hub', modeArt['friends-hub'], 'Jugar con amigos', 'En el mismo móvil o cada uno en el suyo.'),
      modeDoor('online-hub', modeArt['online-hub'], 'Jugar online', 'Encuentra jugadores en una mesa pública.')
    ].join('').replaceAll('loading="lazy"', 'loading="eager"'); // decodificadas de antemano: si no, se pintan al desplegar y la tarjeta «Jugar» parpadea
    choices.setAttribute('aria-hidden', String(!playExpanded));
    choices.inert = !playExpanded;

    const reveal = document.createElement('div');
    reveal.className = `mode-choices-reveal${playExpanded ? ' is-open' : ''}`;
    reveal.append(choices);
    const playWrap = document.createElement('section');
    playWrap.className = 'mode-play-zone';
    playWrap.setAttribute('aria-label', 'Jugar');
    playWrap.append(play, reveal);

    doors.replaceChildren(playWrap, dailyWrap);
    doors.dataset.modesV1 = 'true';
  }

  // Cada elección es una pantalla más del juego: pinta por app.js para que la flecha de
  // volver la recuerde y regrese a la pantalla anterior, no siempre al inicio.
  function hub(screen, title, eyebrow, body, art) {
    delete app.dataset.pendingHub;
    const html = `<div class="shell home-shell mode-hub-shell">
      ${window.CONTINUUM?.UI?.header?.('data-action="ui-back"') || ''}
      <header class="mode-hub-head"><div class="mode-hub-title"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1 data-focus tabindex="-1">${escapeHtml(title)}</h1></div><img src="assets/${art}" alt="" aria-hidden="true" decoding="async"></header>
      <section class="mode-hub-list">${body}</section>
    </div>`;
    if (window.CONTINUUM?.showScreen) window.CONTINUUM.showScreen(screen, html);
    else { app.dataset.screen = screen; app.innerHTML = html; }
  }

  function openOnlineHub() {
    hub('hub-online', 'Jugar online', 'Mesas públicas', [
      `<div class="mode-online-config"><label for="mode-public-capacity">Mesa</label><select id="mode-public-capacity"><option value="0">Cualquier mesa · más rápido</option><option value="2">Hasta 2 jugadores</option><option value="3">Hasta 3 jugadores</option><option value="4">Hasta 4 jugadores</option></select><small>La partida empieza al completarse la mesa o, con al menos 2 personas, cuando pasan 30 s sin que entre nadie más.</small></div>`,
      modeDoor('public-match', modeArt['public-match'], 'Sorpréndeme', 'Un mazo sorpresa: entra en la primera mesa disponible.', false, 'data-online-kind="surprise"'),
      modeDoor('online-collections', modeArt['online-collections'], 'Grandes colecciones', 'Elige hasta tres temas para buscar mesa.', false, 'data-online-kind="collections"'),
      modeDoor('quick-public', modeArt['quick-public'], 'Retos rápidos', 'Ordena, arriesga y asegura tus aciertos con otros jugadores.', false, 'data-online-kind="quick"')
    ].join(''), modeArt['online-hub']);
  }

  function openOnlineCollections() {
    // El catálogo completo de colecciones (menos la mezcla), las mismas que entran en el sorteo de mesas.
    const modes=Object.entries(window.CONTINUUM?.MODES||{}).filter(([key])=>key!=='mixed' && (!window.CONTINUUM?.Cartera?.tiene || window.CONTINUUM.Cartera.tiene(key)));
    hub('hub-online-collections', 'Grandes colecciones', 'Mesa pública · temas', `
      <div class="mode-topic-picker"><p>Marca hasta 3 temas. Buscaremos mesa en esos temas; si no eliges ninguno, buscaremos en todas las colecciones.</p>
      <div class="mode-topic-grid">${modes.map(([key,m])=>`<label><input type="checkbox" value="${escapeHtml(key)}" data-public-topic> <span>${escapeHtml(m.name)}</span></label>`).join('')}</div>
      ${modeDoor('public-match', modeArt['online-hub'], 'Buscar mesa', 'La mesa compartirá un único tema.', true, 'data-online-kind="collections-vote"')}</div>`, modeArt['online-collections']);
  }

  // «Grandes colecciones» se despliega dentro de la propia pantalla; `route` decide qué pasa al
  // elegir un mazo (jugar solo o preparar una partida en un solo móvil).
  // Pantallas con las colecciones desplegadas al salir de ellas: al volver, siguen así.
  const inlineOpen = {};
  function inlineCollections(route, texto = 'Elige un tema o combina los ocho mazos cronológicos.') {
    const open = !!inlineOpen[app.dataset.pendingHub || ''];
    return `<div class="mode-inline-collections">${modeDoor('jugar', 'menu-collections.webp', 'Grandes colecciones', texto, false, `data-inline-route="${route}" data-solo-route="collections" aria-expanded="${open}" aria-controls="mode-inline-drawer"`, 'Elegir mazo')}<div id="mode-inline-drawer" class="mode-inline-drawer" data-route="${route}"${open ? '' : ' hidden'}>${open ? window.CONTINUUM.collectionsGallery(true) : ''}</div></div>`;
  }

  // Dos maneras de jugar con amigos: en un solo móvil o cada uno en el suyo. La sala, el
  // Wi-Fi local y los duelos ya no son puertas aparte: el ritmo se elige al crear la partida.
  const FRIEND_HUBS = {
    local: ['hub-friends-local', 'Un solo móvil', 'Pasad el teléfono', 'menu-local.webp'],
    online: ['hub-friends-online', 'Cada uno en su móvil', 'Juntos o a distancia', 'menu-private.webp']
  };
  // Cada uno en su móvil: por un lado unirse a lo que ya ha creado otro; por otro, crear (mazo, retos o competición).
  let createRoomOpen = false;
  function createRoomGroup(route) {
    return `<div class="mode-create-room"><button type="button" class="mode-entry mode-create-toggle" data-action="create-room-toggle" aria-expanded="${createRoomOpen}" aria-controls="mode-create-list"><span class="mode-entry-art" aria-hidden="true"><img src="assets/menu-private.webp" alt="" loading="lazy" decoding="async"></span><span class="mode-entry-copy"><b>Crear partida</b><small>Elige qué jugar y después el ritmo: en directo, por turnos o con las mismas cartas.</small><span class="mode-entry-cta" aria-hidden="true">${createRoomOpen ? 'Ocultar' : 'Elegir qué jugar'} <span>${createRoomOpen ? '↑' : '↓'}</span></span></span></button>
      <div id="mode-create-list" class="mode-create-list"${createRoomOpen ? '' : ' hidden'}>${inlineCollections(route)}${modeDoor('quick-challenges', modeArt['quick-challenges'], 'Retos rápidos', 'Mazos sorpresa: arriesga o asegura tus aciertos.', false, `data-friend-quick="${route}"`, 'Preparar partida')}${modeDoor('competition-menu', modeArt['competition-menu'], 'Competición', 'Varios temas seguidos; gana quien sume más rondas.', false, `data-competition-audience="${route}"`, 'Configurar competición')}</div></div>`;
  }
  function openFriendHub(route) {
    // `wifi` y `duel` eran puertas propias: quien vuelva a ellas llega a Cada uno en su móvil.
    if (!FRIEND_HUBS[route]) route = 'online';
    const [screen, title, eyebrow, art] = FRIEND_HUBS[route];
    app.dataset.pendingHub = screen;
    hub(screen, title, eyebrow, [
      // Quien se une no elige mazo ni ritmo: la invitación ya lo lleva.
      route === 'online' ? modeDoor('friends-join', 'menu-private.webp', 'Unirme a una partida', 'Con el código, el enlace o el QR que te han pasado. También por Wi‑Fi, sin internet.', true, '', 'Unirme') : '',
      route === 'online' ? createRoomGroup(route) : [
        inlineCollections(route, 'Elegid un tema o combinad los ocho mazos cronológicos.'),
        modeDoor('quick-challenges', modeArt['quick-challenges'], 'Retos rápidos', 'Mazos sorpresa para todos: cada uno arriesga o asegura sus aciertos.', false, `data-friend-quick="${route}"`, 'Preparar partida'),
        modeDoor('competition-menu', modeArt['competition-menu'], 'Competición', 'Varios temas seguidos; gana quien sume más rondas.', false, `data-competition-audience="${route}"`, 'Configurar competición')
      ].join(''),
      route === 'online' ? modeDoor('duels-list', 'mode-walk-duel.webp', 'Tus partidas', 'Los duelos por turnos en curso y a quién le toca.', false, '', 'Ver') : ''
    ].join(''), art);
  }
  const openLocalHub = () => openFriendHub('local');

  function openSoloHub() {
    app.dataset.pendingHub = 'hub-solo';
    hub('hub-solo', 'Jugar solo', 'A tu ritmo', [
      inlineCollections('collections'),
      modeDoor('quick-challenges', modeArt['quick-challenges'], 'Retos rápidos', 'Mazos sorpresa: ordena y suma aciertos.', false, 'data-solo-route="quick"', 'Preparar partida'),
      modeDoor('competition-menu', modeArt['competition-menu'], 'Competición', 'Varios temas seguidos; suma tus aciertos ronda a ronda.', false, 'data-competition-audience="solo"', 'Configurar competición')
    ].join(''), modeArt['solo-hub']);
  }

  function openFriendsHub() {
    hub('hub-friends', 'Jugar con amigos', 'Juntos', [
      modeDoor('local-hub', 'menu-local.webp', 'Un solo móvil', 'Pasad un mismo teléfono en cada turno.'),
      modeDoor('friend-hub', 'menu-private.webp', 'Cada uno en su móvil', 'En directo, por turnos o con las mismas cartas. Por internet o en la misma Wi‑Fi.', false, 'data-friend-hub="online"')
    ].join(''), modeArt['friends-hub']);
  }

  app.addEventListener('click', event => {
    const playToggle = event.target.closest('[data-action="toggle-modes"]');
    if (playToggle && app.dataset.screen === 'home') {
      event.preventDefault();
      event.stopImmediatePropagation();
      playExpanded = !playExpanded;
      playToggle.setAttribute('aria-expanded', String(playExpanded));
      const choices = app.querySelector('#home-mode-choices');
      const reveal = choices.parentElement;
      const daily = app.querySelector('.mode-daily-zone');
      choices.setAttribute('aria-hidden', String(!playExpanded));
      choices.inert = !playExpanded;
      // El despliegue no anima la altura (recalcular la maquetación en cada fotograma hacía
      // temblar las tarjetas): la maquetación final se aplica de golpe y solo se anima, con
      // transformaciones y opacidad, que se componen aparte, el desplazamiento de lo de debajo.
      const animate = reveal.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      revealAnimations.forEach(animation => animation.cancel());
      revealAnimations = [];
      if (!animate) { reveal.classList.toggle('is-open', playExpanded); return; }
      const OPTIONS = { duration: 380, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'both' };
      if (playExpanded) {
        reveal.classList.add('is-open');
        const height = reveal.getBoundingClientRect().height + 12;
        revealAnimations = [
          reveal.animate([{ opacity: 0, transform: 'translateY(-14px)', clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }], OPTIONS),
          ...(daily ? [daily.animate([{ transform: `translateY(${-height}px)` }, { transform: 'none' }], OPTIONS)] : [])
        ];
        revealAnimations.forEach(animation => { animation.onfinish = () => animation.cancel(); });
      } else {
        const height = reveal.getBoundingClientRect().height + 12;
        revealAnimations = [
          reveal.animate([{ opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }, { opacity: 0, transform: 'translateY(-14px)', clipPath: 'inset(0 0 100% 0)' }], OPTIONS),
          ...(daily ? [daily.animate([{ transform: 'none' }, { transform: `translateY(${-height}px)` }], OPTIONS)] : [])
        ];
        revealAnimations[0].onfinish = () => { reveal.classList.remove('is-open'); revealAnimations.forEach(animation => animation.cancel()); revealAnimations = []; };
      }
      return;
    }
    const wifiJoin = event.target.closest('[data-action="wifi-join"]');
    if (wifiJoin) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sessionStorage.setItem('continuum-entry-route', 'wifi');
      const fromJoin = app.dataset.screen === 'friends-join' && window.CONTINUUM.openFriendsJoin;
      window.CONTINUUM.LocalMultiplayer.open({ join: true, onBack: fromJoin ? () => window.CONTINUUM.openFriendsJoin() : () => openFriendHub('online') });
      return;
    }
    const friendsJoin = event.target.closest('[data-action="friends-join"]');
    if (friendsJoin) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sessionStorage.setItem('continuum-entry-route', 'online');
      window.CONTINUUM.openFriendsJoin();
      return;
    }
    const createToggle = event.target.closest('[data-action="create-room-toggle"]');
    if (createToggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      createRoomOpen = createToggle.getAttribute('aria-expanded') !== 'true';
      createToggle.setAttribute('aria-expanded', String(createRoomOpen));
      document.getElementById('mode-create-list').hidden = !createRoomOpen;
      createToggle.querySelector('.mode-entry-cta').innerHTML = `${createRoomOpen ? 'Ocultar' : 'Elegir qué jugar'} <span>${createRoomOpen ? '↑' : '↓'}</span>`;
      return;
    }
    const friendQuick = event.target.closest('[data-friend-quick]');
    if (friendQuick) sessionStorage.setItem('continuum-entry-route', `${friendQuick.dataset.friendQuick}-quick`);
    const competitionEntry = event.target.closest('[data-competition-audience]');
    if (competitionEntry) sessionStorage.setItem('continuum-competition-audience', competitionEntry.dataset.competitionAudience);
    const inlineCollections = event.target.closest('[data-inline-route]');
    if (inlineCollections && /^hub-(solo|friends-)/.test(app.dataset.screen || '')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sessionStorage.setItem('continuum-entry-route', inlineCollections.dataset.inlineRoute);
      const drawer = document.getElementById('mode-inline-drawer');
      const open = drawer.hidden;
      drawer.innerHTML = open ? window.CONTINUUM.collectionsGallery().replaceAll('loading="lazy"', 'loading="eager"') : '';
      drawer.hidden = !open;
      inlineOpen[app.dataset.screen] = open;
      inlineCollections.setAttribute('aria-expanded', String(open));
      // El efecto de profundidad al inclinar el móvil también vale para las portadas desplegadas.
      window.CONTINUUM.UI?.updateEffects?.();
      return;
    }
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
    // Elegir un mazo del cajón de colecciones fija de nuevo la ruta del cajón: si antes se entró en
    // otra puerta (por ejemplo Retos rápidos) y se volvió, la ruta guardada ya no es esta.
    const drawerDeck = event.target.closest('#mode-inline-drawer [data-action="set-mode"]');
    if (drawerDeck) { const drawerRoute = drawerDeck.closest('#mode-inline-drawer').dataset.route; const stale = sessionStorage.getItem('continuum-entry-route'); if (drawerRoute && stale && /(^|-)quick$/.test(stale)) sessionStorage.setItem('continuum-entry-route', drawerRoute); }
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
      window.CONTINUUM.openQuickPublic(cap)
        .catch(error=>{console.error('QUICK_PUBLIC_MATCH_ERROR',error);openOnlineHub();const note=document.createElement('p');note.setAttribute('role','alert');note.textContent=error?.message || 'No se pudo encontrar una mesa. Inténtalo de nuevo.';app.querySelector('.mode-hub-list')?.prepend(note);});return;
    }
    if (!['online-hub','online-collections','solo-hub','friends-hub','local-hub','friend-hub'].includes(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ['hub-solo', 'hub-friends-local', 'hub-friends-online'].forEach(key => { inlineOpen[key] = false; });
    if (action === 'friend-hub' || action === 'friends-hub') createRoomOpen = false;
    if (action === 'online-hub') openOnlineHub();
    else if (action === 'online-collections') openOnlineCollections();
    else if (action === 'solo-hub') openSoloHub();
    else if (action === 'local-hub') openLocalHub();
    else if (action === 'friend-hub') openFriendHub(target.dataset.friendHub);
    else openFriendsHub();
  }, true);

  const hubs = {'hub-online': openOnlineHub, 'hub-online-collections': openOnlineCollections, 'hub-solo': openSoloHub, 'hub-friends-local': openLocalHub, 'hub-friends-online': () => openFriendHub('online'), 'hub-friends-wifi': () => openFriendHub('wifi'), 'hub-friends-duel': () => openFriendHub('duel'), 'hub-friends': openFriendsHub};
  if (window.CONTINUUM) window.CONTINUUM.ModeHubs = { open(screen) { (hubs[screen] || openSoloHub)(); }, refreshHome() { restructureHome(); } };

  function seasonKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  // El resumen del inicio habla el mismo idioma que el ranking: aciertos de hoy, de esta semana y la racha.
  function rankingSummary() {
    const key = d => d.toLocaleDateString('sv-SE');
    const now = new Date(), monday = new Date(now), yesterday = new Date(now);
    monday.setHours(12,0,0,0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    yesterday.setDate(yesterday.getDate() - 1);
    const today = key(now), week = key(monday);
    let day = null, weekHits = 0, streak = 0;
    try {
      const records=JSON.parse((window.CONTINUUM?.Storage||localStorage).getItem('hilo-retos-v1')||'{}');
      const daily=records.retoDiario||{}, days=daily.days||{};
      const hits = entry => Math.max(0, Math.min(10, Number(entry?.hits) || 0));
      if (days[today]) day = hits(days[today]);
      for (const [date, result] of Object.entries(days)) if (date >= week && date <= today) weekHits += hits(result);
      if (daily.lastDay === today || daily.lastDay === key(yesterday)) streak = Number(daily.streak) || 0;
    } catch {}
    return {day, weekHits, streak};
  }

  function addRankingSummary() {
    if(app.dataset.screen!=='home' || app.querySelector('.mode-ranking-summary')) return;
    const doors=app.querySelector('.home-doors'); if(!doors)return;
    const r=rankingSummary(), box=document.createElement('section');
    box.className='mode-ranking-summary';
    box.setAttribute('aria-label','Tus retos diarios');
    box.innerHTML=`<div class="mode-ranking-stats"><span><b>${r.day===null?'–':`${r.day}/10`}</b><small>Hoy</small></span><span><b>${r.weekHits}</b><small>Esta semana</small></span><span><b>${r.streak}</b><small>${r.streak===1?'Día seguido':'Días seguidos'}</small></span></div>${window.CONTINUUM?.Accounts?.ready?'<button type="button" class="btn btn-secondary mode-ranking-link" data-account-action="ranking">Ver ranking <span aria-hidden="true">→</span></button>':''}`;
    doors.append(box);
  }

  // Si la ventana ya se ha cerrado (pruebas), no queda documento sobre el que trabajar.
  const observer = new MutationObserver(()=>{if(typeof document==='undefined'||!document||!app.ownerDocument?.defaultView)return;restructureHome();addRankingSummary();});
  observer.observe(app, { childList: true, subtree: true });
  restructureHome();
  addRankingSummary();
  };
  // El script va al final de <body>: #app ya existe y se puede montar sin esperar al evento.
  if (document.readyState !== 'loading' || document.getElementById('app')) start(); else document.addEventListener('DOMContentLoaded', start, {once:true});
})();
