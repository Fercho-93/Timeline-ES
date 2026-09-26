(function () {
  'use strict';

  const start = () => {
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
    const family=document.createElement('p');family.className='mode-daily-family';family.innerHTML=`Hoy · <strong>${dailyFamily()}</strong> · un único reto para el ranking global`;dailyWrap.append(family);

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
      `<div class="mode-online-config"><label for="mode-public-capacity">Mesa</label><select id="mode-public-capacity"><option value="0">Cualquiera · más rápido</option><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4">4 jugadores</option></select><small>Si eliges “Cualquiera”, buscamos primero una mesa de 4 y después de 3 o 2.</small></div>`,
      modeDoor('public-match', '⚡', 'Sorpréndeme', 'Entra en la primera mesa compatible disponible.', false, 'data-online-kind="surprise"'),
      modeDoor('online-collections', '▦', 'Grandes colecciones', 'Elige tres temas candidatos y la mesa sortea uno para todos.', false, 'data-online-kind="collections"'),
      modeDoor('quick-challenges', '◫', 'Retos rápidos', 'Temas breves y concretos; entra en su zona de juego online.', false, 'data-online-kind="quick"')
    ].join(''));
  }

  function openOnlineCollections() {
    const modes=Object.entries(window.CONTINUUM?.MODES||{}).filter(([key])=>key!=='mixed').slice(0,12);
    hub('Grandes colecciones', 'Mesa pública · temas', `
      <div class="mode-topic-picker"><p>Marca hasta 3 temas. Si no eliges ninguno, Continuum escogerá candidatos al azar.</p>
      <div class="mode-topic-grid">${modes.map(([key,m])=>`<label><input type="checkbox" value="${escapeHtml(key)}" data-public-topic> <span>${escapeHtml(m.name)}</span></label>`).join('')}</div>
      <button class="mode-entry mode-entry-featured" data-action="public-match" data-online-kind="collections-vote"><span class="mode-entry-icon">⚡</span><span class="mode-entry-copy"><b>Buscar mesa</b><small>Un único tema será común para toda la mesa.</small></span><span class="mode-entry-arrow">→</span></button></div>`);
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
      const cap=document.getElementById('mode-public-capacity')?.value ?? '0';
      sessionStorage.setItem('continuum-public-capacity',cap);
    }
    const home = event.target.closest('[data-mode-home]');
    if (home) {
      event.preventDefault();
      const nativeHome=document.querySelector('.home-nav [data-action="home-top"]');
      if(nativeHome){ nativeHome.click(); return; }
      history.back();
      return;
    }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (!['online-hub','online-collections','solo-hub','friends-hub'].includes(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'online-hub') openOnlineHub();
    else if (action === 'online-collections') openOnlineCollections();
    else if (action === 'solo-hub') openSoloHub();
    else openFriendsHub();
  }, true);

  function rankingSummary() {
    let classic=0, quick=0;
    try {
      const records=JSON.parse(localStorage.getItem('hilo-retos-v1')||'{}');
      const raw=records.retoDiario||{};
      classic=Object.values(raw.days||{}).reduce((sum,d)=>sum+(Number(d.hits)||0),0);
    } catch {}
    try {
      const raw=JSON.parse(localStorage.getItem('continuum-quick-history-v1')||'[]');
      quick=(Array.isArray(raw)?raw:[]).reduce((sum,d)=>sum+(Number(d.score)||0),0);
    } catch {}
    return {classic,quick,total:classic+quick};
  }

  function addRankingSummary() {
    if(app.dataset.screen!=='home' || app.querySelector('.mode-ranking-summary')) return;
    const doors=app.querySelector('.home-doors'); if(!doors)return;
    const r=rankingSummary(), box=document.createElement('section');
    box.className='mode-ranking-summary';
    box.innerHTML=`<div><small>RANKING GLOBAL · PUNTOS LOCALES</small><b>${r.total}</b></div><p>Grandes colecciones <strong>${r.classic}</strong> · Retos rápidos <strong>${r.quick}</strong></p>`;
    doors.append(box);
  }

  const observer = new MutationObserver(()=>{restructureHome();addRankingSummary();});
  observer.observe(app, { childList: true, subtree: true });
  restructureHome();
  addRankingSummary();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
