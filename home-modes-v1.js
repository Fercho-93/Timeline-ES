(function () {
  'use strict';

  const app = document.getElementById('app');
  if (!app) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function modeDoor(action, icon, title, text, featured = false) {
    return `<button class="mode-entry${featured ? ' mode-entry-featured' : ''}" data-action="${action}">
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

    const choices = document.createElement('section');
    choices.className = 'mode-entry-grid';
    choices.setAttribute('aria-label', 'Cómo quieres jugar');
    choices.innerHTML = [
      modeDoor('public-match', '🌐', 'Jugar online', 'Encuentra jugadores y entra en una mesa pública.', true),
      modeDoor('jugar', '●', 'Jugar solo', 'Grandes colecciones, rondas rápidas y Gran mezcla.'),
      modeDoor('jugar', '◆', 'Jugar con amigos', 'Mismo móvil, sala privada, Wi‑Fi local o duelo.'),
      modeDoor('competition-menu', '♜', 'Competición', 'Varias rondas, distintas temáticas y marcador acumulado.')
    ].join('');

    const secondary = document.createElement('section');
    secondary.className = 'mode-secondary';
    secondary.setAttribute('aria-label', 'Tu colección');
    atlas.classList.add('mode-atlas-entry');
    secondary.append(atlas);

    doors.replaceChildren(dailyWrap, choices, secondary);
    doors.dataset.modesV1 = 'true';
  }

  const observer = new MutationObserver(restructureHome);
  observer.observe(app, { childList: true, subtree: true });
  restructureHome();
})();
