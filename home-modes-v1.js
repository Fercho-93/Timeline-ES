(function () {
  'use strict';

  const app = document.getElementById('app');
  if (!app) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function modeDoor(action, icon, title, text, featured = false, attrs = '') {
    return `<button class="mode-entry${featured ? ' mode-entry-featured' : ''}" data-action="${action}" ${attrs}>
      <span class="mode-entry-icon" aria-hidden="true">${icon}</span>
      <span class="mode-entry-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(text)}</small></span>
      <span class="mode-entry-arrow" aria-hidden="true">→</span>
    </button>`;
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

    const legacyPlay = doors.querySelector('.home-door[data-action="jugar"]');
    if (legacyPlay) legacyPlay.classList.add('mode-legacy-entry');

    const choices = document.createElement('section');
    choices.className = 'mode-entry-grid';
    choices.setAttribute('aria-label', 'Cómo quieres jugar');
    choices.innerHTML = [
      modeDoor('online-hub', '🌐', 'Jugar online', 'Encuentra jugadores y entra en una mesa pública.', true),
      modeDoor('solo-hub', '●', 'Jugar solo', 'Grandes colecciones, retos rápidos y Gran mezcla.'),
      modeDoor('friends-hub', '◆', 'Jugar con amigos', 'Mismo móvil, sala privada, Wi‑Fi local o duelo.'),
      modeDoor('competition-menu', '♜', 'Competición', 'Varias rondas, distintas temáticas y marcador acumulado.')
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

  function hub(title, eyebrow, body) {
    app.dataset.screen = 'mode-hub';
    app.innerHTML = `<div class="shell home-shell mode-hub-shell">
      <header class="mode-hub-head"><button class="icon-btn" data-mode-home>Volver</button><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1></div></header>
      <section class="mode-hub-list">${body}</section>
    </div>`;
  }

  function existing(action, icon, title, text) {
    return modeDoor(action, icon, title, text);
  }

  function openOnlineHub() {
    hub('Jugar online', 'Mesas públicas', [
      modeDoor('public-match', '⚡', 'Sorpréndeme', 'Entra en la primera mesa compatible disponible.', false, 'data-online-kind="surprise"'),
      modeDoor('public-match', '▦', 'Grandes colecciones', 'Partidas completas con temas amplios.', false, 'data-online-kind="collections"'),
      modeDoor('quick-challenges', '◫', 'Retos rápidos', 'Temas breves y concretos; entra en su zona de juego online.', false, 'data-online-kind="quick"')
    ].join(''));
  }

  function openSoloHub() {
    hub('Jugar solo', 'A tu ritmo', [
      existing('jugar', '▦', 'Grandes colecciones', 'Mazos amplios de historia, ciencia, naturaleza, geografía y más.'),
      existing('quick-challenges', '◫', 'Retos rápidos', 'Temas muy concretos para partidas cortas.'),
      existing('jugar', '∞', 'Gran mezcla', 'Explora la colección transversal de cartas.')
    ].join(''));
  }

  function openFriendsHub() {
    hub('Jugar con amigos', 'Juntos', [
      existing('jugar', '◉', 'Un solo móvil', 'Pasad el teléfono en cada turno.'),
      existing('jugar', '⌁', 'Sala privada', 'Cada persona con su móvil mediante código o enlace.'),
      existing('jugar', '⌂', 'Wi‑Fi local', 'Varios móviles cerca, sin depender de internet.'),
      existing('jugar', '⚔', 'Duelo por turnos', 'Reta a una persona y jugad cuando podáis.')
    ].join(''));
  }

  app.addEventListener('click', event => {
    const publicEntry = event.target.closest('[data-action="public-match"][data-online-kind]');
    if (publicEntry) {
      sessionStorage.setItem('continuum-public-kind', publicEntry.dataset.onlineKind || 'surprise');
    }
    const home = event.target.closest('[data-mode-home]');
    if (home) {
      event.preventDefault();
      location.reload();
      return;
    }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (!['online-hub','solo-hub','friends-hub'].includes(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'online-hub') openOnlineHub();
    else if (action === 'solo-hub') openSoloHub();
    else openFriendsHub();
  }, true);

  const observer = new MutationObserver(restructureHome);
  observer.observe(app, { childList: true, subtree: true });
  restructureHome();
})();
