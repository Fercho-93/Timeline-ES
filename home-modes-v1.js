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
    'public-create': 'menu-wifi.webp',
    'online-collections': 'menu-collections.webp',
    'quick-public': 'menu-quick.webp',
    'quick-challenges': 'menu-quick.webp'
  };

  function modeDoor(action, art, title, description, featured = false, attrs = '', cta = '') {
    const image = art || modeArt[action] || 'home-door-jugar.webp';
    return `<button class="mode-entry${featured ? ' mode-entry-featured' : ''}" data-action="${action}" ${attrs}>
      <span class="mode-entry-art" aria-hidden="true"><img src="assets/${image}" alt="" loading="lazy" decoding="async"></span>
      <span class="mode-entry-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small><span class="mode-entry-cta" aria-hidden="true">${escapeHtml(cta || (action === 'public-match' || action === 'quick-public' ? 'Buscar mesa' : action === 'online-collections' ? 'Elegir temas' : 'Explorar'))} <span>→</span></span></span>
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
      modeDoor('solo-hub', modeArt['solo-hub'], 'Jugar solo', 'Colecciones, retos rápidos o competición.', true),
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
    // Quien recibe un QR o un código en persona entra desde aquí, sin bajar por Jugar con amigos.
    const join = document.createElement('button');
    join.type = 'button';
    // Misma tarjeta que «Jugar» y el reto diario (ilustración, título y enlace), más baja.
    join.className = 'home-door mode-join-shortcut';
    join.dataset.action = 'friends-join';
    join.innerHTML = '<span class="home-door-art" aria-hidden="true"><img src="assets/menu-private.webp" alt="" decoding="async"></span><span class="home-door-copy"><b>Unirme a una partida</b><small>¿Te han invitado? Escanea el QR o pega el código.</small><span class="home-door-cta" aria-hidden="true">Unirme →</span></span>';
    playWrap.append(play, reveal, join);

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

  // El tamaño de la mesa se recuerda durante la sesión y se enseña igual en las dos pantallas.
  function publicCapacity() { return sessionStorage.getItem('continuum-public-capacity') || '0'; }
  // `nota`: la explicación de cuándo empieza la partida (en «Jugar online» ya sale en Crear mesa).
  function capacityField(nota = true) {
    const cap = publicCapacity();
    const options = [['0', 'Cualquier mesa · más rápido'], ['2', 'Hasta 2 jugadores'], ['3', 'Hasta 3 jugadores'], ['4', 'Hasta 4 jugadores']];
    return `<div class="panel mode-online-config"><div class="field"><label for="mode-public-capacity">Tamaño de mesa</label><select id="mode-public-capacity">${options.map(([value, label]) => `<option value="${value}"${value === cap ? ' selected' : ''}>${label}</option>`).join('')}</select></div>${nota ? '<p class="hint">La partida empieza al completarse la mesa o, con al menos 2 personas, cuando pasan 30 s sin que entre nadie más.</p>' : ''}</div>`;
  }
  // Jugar online, como el vestíbulo de Risk: alguien abre una mesa con su configuración
  // (juego, plazas y tiempo), la mesa aparece en la lista de mesas abiertas y los demás
  // eligen dónde sentarse. La partida rápida sigue ahí para quien no quiere elegir.
  function openOnlineHub() {
    hub('hub-online', 'Jugar online', 'Mesas públicas', [
      modeDoor('public-create', modeArt['public-create'], 'Crear mesa', 'Elige el juego, las plazas y el tiempo. Los demás la verán en la lista y se sentarán.', true, '', 'Crear'),
      `<section class="public-board" aria-labelledby="public-board-title"><h2 class="mode-section-title" id="public-board-title">Mesas abiertas <small data-board-count></small></h2>
        <ul class="public-board-list" data-public-board aria-live="polite"><li class="public-board-empty">Buscando mesas…</li></ul></section>`,
      `<h2 class="mode-section-title public-quick-label">Partida rápida</h2><p class="hint public-quick-hint">Sin elegir mesa: te sentamos en la primera libre.</p>`,
      capacityField(false),
      modeDoor('online-collections', modeArt['online-collections'], 'Grandes colecciones', 'Elige hasta tres temas o ninguno, y te sentamos en la primera mesa libre.', false, 'data-online-kind="collections"'),
      modeDoor('quick-public', modeArt['quick-public'], 'Retos rápidos', 'Tres retos sorpresa: arriesga o plántate para asegurar tus aciertos.', false, 'data-online-kind="quick"')
    ].join(''), modeArt['online-hub']);
    watchBoard();
  }

  // La lista de mesas abiertas se mantiene al día mientras se ve; al salir de la pantalla
  // se deja de escuchar.
  let stopBoard = null;
  const boardVersions = () => Promise.all([import('./public-matchmaking-online.js'), import('./quick-online.js')])
    .then(([collections, quick]) => ({ collections: collections.CLIENT_VERSION, quick: quick.PUBLIC_VERSION }));
  function watchBoard() {
    stopBoard?.(); stopBoard = null;
    Promise.all([import('./public-tables.js'), boardVersions()]).then(([tables, versions]) => {
      if (!app.querySelector('[data-public-board]')) return;
      const stop = tables.watchTables(list => {
        const box = app.querySelector('[data-public-board]');
        if (!box) { stop(); if (stopBoard === stop) stopBoard = null; return; }
        renderBoard(box, list.filter(t => usableTable(t, tables, versions)));
      }, () => {
        const box = app.querySelector('[data-public-board]');
        if (box) box.innerHTML = '<li class="public-board-empty">No se pudo cargar la lista de mesas. Puedes crear una o usar la partida rápida.</li>';
      });
      stopBoard = stop;
    }).catch(() => {
      const box = app.querySelector('[data-public-board]');
      if (box) box.innerHTML = '<li class="public-board-empty">No se pudo cargar la lista de mesas. Puedes crear una o usar la partida rápida.</li>';
    });
  }
  // Solo las mesas en las que se puede entrar desde este móvil: vivas, con sitio y con el
  // mismo mazo y la misma versión del juego.
  function usableTable(t, tables, versions) {
    const CT = window.CONTINUUM;
    if (!tables.tableFresh(t) || !(t.players < t.capacity)) return false;
    if (t.kind === 'quick') return t.clientVersion === versions.quick && t.fingerprint === CT.QuickNetwork?.fingerprint?.();
    if (t.kind !== 'collections' || !CT.MODES?.[t.mode] || t.clientVersion !== versions.collections) return false;
    if (CT.Cartera?.tiene && !CT.Cartera.tiene(t.mode)) return false;
    return t.fingerprint === CT.deckFingerprint(t.mode);
  }
  const tableTime = seconds => seconds ? `${seconds} s por carta` : 'Sin tiempo';
  function renderBoard(box, list) {
    const CT = window.CONTINUUM;
    // Primero las que están a punto de llenarse; después, las más nuevas.
    const sorted = [...list].sort((a, b) => (b.players / b.capacity) - (a.players / a.capacity));
    const count = app.querySelector('[data-board-count]');
    if (count) count.textContent = sorted.length ? String(sorted.length) : '';
    if (!sorted.length) {
      box.innerHTML = '<li class="public-board-empty">No hay mesas abiertas ahora mismo. Crea la tuya: aparecerá aquí para los demás.</li>';
      return;
    }
    box.innerHTML = sorted.map(t => {
      const game = t.kind === 'quick' ? 'Retos rápidos' : CT.MODES[t.mode]?.name || 'Grandes colecciones';
      const host = t.names?.[0] || 'Explorador';
      const avatar = CT.Avatares?.markup?.(host, { size: 44, id: t.hostAvatar, seed: 'uid:' + t.hostUid }) || '';
      const seats = Array.from({ length: t.capacity }, (_, i) => `<i class="${i < t.players ? 'is-taken' : ''}"></i>`).join('');
      return `<li class="public-table">
        <span class="public-table-avatar">${avatar}</span>
        <span class="public-table-copy"><b>${escapeHtml(game)}</b><small>Mesa de ${escapeHtml(host)} · ${t.kind === 'quick' && t.length ? `${t.length} ${t.length === 1 ? 'reto' : 'retos'} · ` : t.kind !== 'quick' && t.handSize ? `${t.handSize} ${t.handSize === 1 ? 'carta' : 'cartas'} · ` : ''}${tableTime(t.seconds)}</small>
          <span class="public-table-seats" aria-label="${t.players} de ${t.capacity} plazas ocupadas">${seats}<em>${t.players}/${t.capacity}</em></span></span>
        <button type="button" class="btn btn-primary public-table-join" data-action="public-join" data-code="${escapeHtml(t.code)}" data-kind="${t.kind === 'quick' ? 'quick' : 'collections'}" data-capacity="${t.capacity}" aria-label="Unirme a la mesa de ${escapeHtml(host)} · ${escapeHtml(game)}">Unirme</button>
      </li>`;
    }).join('');
  }

  // Crear mesa: lo que se elige aquí es lo que verán los demás en la lista.
  const CREATE_KEY = 'continuum-public-create-v1';
  function createChoice() {
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(CREATE_KEY) || '{}'); } catch {}
    return { kind: saved.kind === 'quick' ? 'quick' : 'collections', mode: typeof saved.mode === 'string' ? saved.mode : '', capacity: [2, 3, 4].includes(saved.capacity) ? saved.capacity : 4, length: [1, 3, 5].includes(saved.length) ? saved.length : 3, keep: saved.keep === 'seguir' ? 'seguir' : 'fuera' };
  }
  function pills(name, options, current, columns) {
    return `<div class="segmented public-create-segmented" style="--pills:${columns}" role="radiogroup">${options.map(([value, label]) => `<label class="segmented-option${String(value) === String(current) ? ' is-on' : ''}">
      <input type="radio" name="${name}" value="${value}" data-public-create="${name}"${String(value) === String(current) ? ' checked' : ''}><span><b>${escapeHtml(label)}</b></span></label>`).join('')}</div>`;
  }
  function availableDecks() {
    const CT = window.CONTINUUM;
    return Object.entries(CT?.MODES || {}).filter(([key]) => key !== 'mixed' && (!CT?.Cartera?.tiene || CT.Cartera.tiene(key)));
  }
  function openPublicCreate() {
    const CT = window.CONTINUUM, choice = createChoice();
    const decks = availableDecks();
    hub('hub-online-create', 'Crear mesa', 'Mesa pública', `<div class="panel public-create">
      <div class="field"><span class="field-label">Juego</span>${pills('kind', [['collections', 'Grandes colecciones'], ['quick', 'Retos rápidos']], choice.kind, 2)}</div>
      <div class="field" data-public-deck${choice.kind === 'quick' ? ' hidden' : ''}><label for="public-create-mode">Mazo</label><select id="public-create-mode"><option value="">Al azar</option>${decks.map(([key, m]) => `<option value="${escapeHtml(key)}"${key === choice.mode ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}</select></div>
      <div class="field"><span class="field-label">Jugadores</span>${pills('capacity', [[2, '2'], [3, '3'], [4, '4']], choice.capacity, 3)}</div>
      <div data-public-deck${choice.kind === 'quick' ? ' hidden' : ''}>${CT?.ManoInicial?.field?.('public-hand-size') || ''}</div>
      <div class="field" data-public-quick${choice.kind === 'quick' ? '' : ' hidden'}><span class="field-label">Duración</span>${pills('length', [[1, '1 reto'], [3, '3 retos'], [5, '5 retos']], choice.length, 3)}</div>
      <div class="field" data-public-quick${choice.kind === 'quick' ? '' : ' hidden'}><span class="field-label">Si alguien falla</span>${pills('keep', [['fuera', 'Arriesgar o plantarse'], ['seguir', 'Seguir hasta el final']], choice.keep, 2)}</div>
      ${CT?.Tiempo?.field?.('publica', { porDefecto: 30 }) || ''}
      <p class="hint">La partida empieza al completarse la mesa o, con al menos 2 personas, cuando pasan 30 s sin que entre nadie más. Quién empieza se decide con un minijuego: cada uno adivina la cifra de una carta.</p>
      <button type="button" class="btn btn-primary btn-block" data-action="public-create-go">Abrir mesa</button>
    </div>`, modeArt['online-hub']);
  }
  function saveCreateChoice() {
    const kind = app.querySelector('input[data-public-create="kind"]:checked')?.value === 'quick' ? 'quick' : 'collections';
    const capacity = Number(app.querySelector('input[data-public-create="capacity"]:checked')?.value) || 4;
    const mode = app.querySelector('#public-create-mode')?.value || '';
    const length = Number(app.querySelector('input[data-public-create="length"]:checked')?.value) || 3;
    const keep = app.querySelector('input[data-public-create="keep"]:checked')?.value === 'seguir' ? 'seguir' : 'fuera';
    try { sessionStorage.setItem(CREATE_KEY, JSON.stringify({ kind, capacity, mode, length, keep })); } catch {}
    return { kind, capacity, mode, length, keep };
  }
  // Si algo falla al entrar en una mesa de Retos rápidos, se vuelve a la lista con el aviso.
  function quickTableFailed(error) {
    console.error('QUICK_PUBLIC_TABLE_ERROR', error);
    openOnlineHub();
    const note = document.createElement('p'); note.setAttribute('role', 'alert'); note.className = 'public-board-alert';
    note.textContent = error?.message || 'No se pudo entrar en la mesa. Elige otra o crea la tuya.';
    app.querySelector('.mode-hub-list')?.prepend(note);
  }
  function publicTableAction(action, target) {
    const CT = window.CONTINUUM;
    if (action === 'public-create') { openPublicCreate(); return true; }
    if (action === 'public-create-go') {
      const { kind, capacity, mode, length, keep } = saveCreateChoice();
      const seconds = CT.Tiempo?.chosen?.('publica', 30) ?? 30;
      if (kind === 'quick') { CT.openQuickPublic(capacity, { create: true, seconds, length, keep: keep === 'seguir' }).catch(quickTableFailed); return true; }
      const decks = availableDecks().map(([key]) => key);
      const deck = decks.includes(mode) ? mode : decks[Math.floor(Math.random() * decks.length)];
      if (!deck) return true;
      CT.openPublicTable({ create: true, mode: deck, capacity, seconds, handSize: CT.ManoInicial?.get?.() ?? 4 });
      return true;
    }
    if (action === 'public-join') {
      const code = target.dataset.code;
      if (target.dataset.kind === 'quick') CT.openQuickPublic(Number(target.dataset.capacity) || 4, { code }).catch(quickTableFailed);
      else CT.openPublicTable({ code });
      return true;
    }
    return false;
  }

  function openOnlineCollections() {
    // El catálogo completo de colecciones (menos la mezcla), las mismas que entran en el sorteo de mesas.
    const modes=Object.entries(window.CONTINUUM?.MODES||{}).filter(([key])=>key!=='mixed' && (!window.CONTINUUM?.Cartera?.tiene || window.CONTINUUM.Cartera.tiene(key)));
    hub('hub-online-collections', 'Grandes colecciones', 'Mesa pública · temas', `
      <div class="mode-topic-picker"><p>Marca hasta 3 temas. Buscaremos mesa en esos temas; si no eliges ninguno, buscaremos en todas las colecciones.</p>
      <div class="mode-topic-grid">${modes.map(([key,m])=>`<label class="mode-topic"><input type="checkbox" value="${escapeHtml(key)}" data-public-topic> <span>${escapeHtml(m.name)}</span></label>`).join('')}</div>
      <p class="hint mode-topic-count" data-topic-count aria-live="polite">Ningún tema elegido: buscaremos en todas.</p>
      ${capacityField()}
      ${modeDoor('public-match', modeArt['online-hub'], 'Buscar mesa al azar', 'Un mazo al azar de las Grandes colecciones, en la primera mesa libre.', true, 'data-online-kind="collections-vote"')}</div>`, modeArt['online-collections']);
  }

  // «Grandes colecciones» se despliega dentro de la propia pantalla; `route` decide qué pasa al
  // elegir un mazo (jugar solo o preparar una partida en un solo móvil).
  // Pantallas con las colecciones desplegadas al salir de ellas: al volver, siguen así.
  const inlineOpen = {};
  // La competición va al final de la lista de colecciones, con su misma carátula (app.js).
  const compAudience = route => route === 'collections' ? 'solo' : route;
  function inlineCollections(route, texto = 'Elige un tema o combina los ocho mazos cronológicos, o juega una competición.') {
    const open = !!inlineOpen[app.dataset.pendingHub || ''];
    return `<div class="mode-inline-collections">${modeDoor('jugar', 'menu-collections.webp', 'Grandes colecciones', texto, false, `data-inline-route="${route}" data-solo-route="collections" aria-expanded="${open}" aria-controls="mode-inline-drawer"`, 'Elegir mazo')}<div id="mode-inline-drawer" class="mode-inline-drawer" data-route="${route}"${open ? '' : ' hidden'}>${open ? window.CONTINUUM.collectionsGallery(true, compAudience(route)) : window.CONTINUUM.competitionPanel(compAudience(route))}</div></div>`;
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
      <div id="mode-create-list" class="mode-create-list"${createRoomOpen ? '' : ' hidden'}>${inlineCollections(route)}${modeDoor('quick-challenges', modeArt['quick-challenges'], 'Retos rápidos', 'Mazos sorpresa: los mismos retos para todos.', false, `data-friend-quick="${route}"`, 'Preparar partida')}</div></div>`;
  }
  function openFriendHub(route) {
    // `wifi` y `duel` eran puertas propias: quien vuelva a ellas llega a Cada uno en su móvil.
    if (!FRIEND_HUBS[route]) route = 'online';
    const [screen, title, eyebrow, art] = FRIEND_HUBS[route];
    app.dataset.pendingHub = screen;
    hub(screen, title, eyebrow, [
      // Quien se une no elige mazo ni ritmo: la invitación ya lo lleva.
      route === 'online' ? modeDoor('friends-join', 'menu-private.webp', 'Unirme a una partida', 'Escanea el QR o pega el enlace o el código. Por internet o por Wi‑Fi.', true, '', 'Unirme') : '',
      route === 'online' ? createRoomGroup(route) : [
        inlineCollections(route, 'Elegid un tema o combinad los ocho mazos cronológicos, o jugad una competición.'),
        modeDoor('quick-challenges', modeArt['quick-challenges'], 'Retos rápidos', 'Mazos sorpresa: los mismos retos para todos.', false, `data-friend-quick="${route}"`, 'Preparar partida')
      ].join(''),
      route === 'online' ? modeDoor('duels-list', 'mode-walk-duel.webp', 'Tus partidas', 'Los duelos por turnos en curso y a quién le toca.', false, '', 'Ver') : ''
    ].join(''), art);
  }
  const openLocalHub = () => openFriendHub('local');

  function openSoloHub() {
    app.dataset.pendingHub = 'hub-solo';
    hub('hub-solo', 'Jugar solo', 'A tu ritmo', [
      inlineCollections('collections'),
      modeDoor('quick-challenges', modeArt['quick-challenges'], 'Retos rápidos', 'Mazos sorpresa: ordena y suma aciertos.', false, 'data-solo-route="quick"', 'Preparar partida')
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
      const audience = inlineCollections.dataset.inlineRoute === 'collections' ? 'solo' : inlineCollections.dataset.inlineRoute;
      drawer.innerHTML = open ? window.CONTINUUM.collectionsGallery(false, audience).replaceAll('loading="lazy"', 'loading="eager"') : window.CONTINUUM.competitionPanel(audience);
      drawer.hidden = !open;
      inlineOpen[app.dataset.screen] = open;
      inlineCollections.setAttribute('aria-expanded', String(open));
      // El efecto de profundidad al inclinar el móvil también vale para las portadas desplegadas.
      window.CONTINUUM.UI?.updateEffects?.();
      return;
    }
    const topicInput=event.target.closest('[data-public-topic]');
    if(topicInput){
      let checked=[...document.querySelectorAll('[data-public-topic]:checked')];
      const full=checked.length>3;
      if(full){topicInput.checked=false;checked=checked.filter(x=>x!==topicInput);}
      const count=app.querySelector('[data-topic-count]');
      if(count) count.textContent=full?'Ya tienes 3 temas: quita uno para elegir otro.':checked.length?`${checked.length} de 3 temas elegidos.`:'Ningún tema elegido: buscaremos en todas.';
      // Sin temas el botón busca mesa con un mazo al azar; con temas, en esos temas.
      const door=app.querySelector('[data-online-kind="collections-vote"]');
      if(door){
        door.querySelector('b').textContent=checked.length?'Buscar mesa':'Buscar mesa al azar';
        door.querySelector('small').textContent=checked.length?'La mesa compartirá un único tema de los que has marcado.':'Un mazo al azar de las Grandes colecciones, en la primera mesa libre.';
      }
      return;
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
    if (['public-create', 'public-create-go', 'public-join'].includes(action)) {
      event.preventDefault(); event.stopImmediatePropagation();
      publicTableAction(action, target);
      return;
    }
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

  app.addEventListener('change', event => {
    if (event.target.id === 'mode-public-capacity') sessionStorage.setItem('continuum-public-capacity', event.target.value);
    const pill = event.target.closest?.('input[data-public-create]');
    if (pill) {
      pill.closest('.segmented')?.querySelectorAll('.segmented-option').forEach(op => op.classList.toggle('is-on', op.querySelector('input').checked));
      if (pill.dataset.publicCreate === 'kind') app.querySelectorAll('[data-public-deck]').forEach(box => { box.hidden = pill.value === 'quick'; });
      if (pill.dataset.publicCreate === 'kind') app.querySelectorAll('[data-public-quick]').forEach(box => { box.hidden = pill.value !== 'quick'; });
    }
    if (pill || event.target.id === 'public-create-mode') saveCreateChoice();
  });

  const hubs = {'hub-online': openOnlineHub, 'hub-online-create': openPublicCreate, 'hub-online-collections': openOnlineCollections, 'hub-solo': openSoloHub, 'hub-friends-local': openLocalHub, 'hub-friends-online': () => openFriendHub('online'), 'hub-friends-wifi': () => openFriendHub('wifi'), 'hub-friends-duel': () => openFriendHub('duel'), 'hub-friends': openFriendsHub};
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
