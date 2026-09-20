(function () {
  'use strict';
  const CT = window.CONTINUUM, E = CT.QuickEngine, esc = CT.escapeHtml;
  const KEY = 'continuum-quick-challenges-v1';
  let paint, state, record, selected = null, slot = null, error = '';
  const app = () => document.getElementById('app');
  function load() {
    error = '';
    try {
      const raw = CT.Storage.getItem(KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      E.restore(saved);
      return saved;
    } catch {error = 'No se ha podido recuperar la partida anterior. Puedes empezar una nueva.'; return null;}
  }
  function shell(content) {
    paint(`<div class="shell quick-shell">${CT.UI.header('data-action="home"', state ? 'data-quick="menu"' : '', !!state)}<div class="quick-content">${content}</div></div>`, !!state);
  }
  const button = (action, text, cls = 'btn btn-primary') => `<button class="${cls}" data-quick="${action}">${text}</button>`;
  function setup() {
    state = null; record = null; selected = null; slot = null;
    const saved = load();
    shell(`<div class="eyebrow">Una carta. Una decisión.</div><h1 data-focus tabindex="-1">Retos rápidos</h1>
      <p class="quick-lead">Elige una carta, colócala y decide cuándo asegurar tus puntos.</p>
      <div class="panel quick-panel"><h2>Un solo móvil</h2><p>De 2 a 4 jugadores o equipos. Con más personas, formad equipos y alternad quién coloca.</p>
      <label for="quick-count">Participantes</label><select id="quick-count"><option>2</option><option>3</option><option>4</option></select>
      <div id="quick-names">${nameFields(2)}</div>
      <label for="quick-length">Duración</label><select id="quick-length"><option value="3">Tres retos variados</option><option value="1">Un solo reto</option></select>
      <div id="quick-choice-wrap" hidden><label for="quick-choice">Elige el reto</label><select id="quick-choice">${CT.QuickCatalog.challenges.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div>
      <p>El primer turno rota entre retos. En una partida de tres retos puede haber un turno inicial más para algunas personas.</p>
      ${button('start', 'Barajar y empezar', 'btn btn-primary btn-block')}
      ${saved ? button('resume', 'Continuar partida guardada', 'btn btn-secondary btn-block') : ''}
      <p id="quick-error" role="alert">${esc(error)}</p></div>
      <details class="panel quick-panel"><summary>Cómo se juega</summary><ol><li>Una carta revelada inicia la línea, sin dar puntos.</li><li>Elige una de las cartas comunes y toca un hueco. Confirma para revelar el dato.</li><li>Acertar suma un punto provisional y pasa el turno.</li><li>En tu siguiente turno puedes plantarte: aseguras tus puntos y sales de este reto.</li><li>Fallar pierde tus puntos de este reto y te retira. Los de retos anteriores se conservan.</li><li>Al agotarse las cartas, los puntos pendientes se aseguran. El reto también termina si nadie sigue activo.</li></ol><p>La carta fallada queda corregida en la línea. Si queda una sola persona, puede seguir arriesgando. Los empates de valor admiten cualquier orden equivalente. Gana quien suma más puntos; un empate final se comparte.</p></details>
      <section class="quick-catalog" aria-label="Retos disponibles">${CT.QuickCatalog.challenges.map(c => `<article class="panel quick-panel"><h2>${esc(c.title)}</h2><p>${esc(c.rule)}</p><small>${c.cards.length} cartas · una de referencia</small></article>`).join('')}</section>`);
  }
  function nameFields(count, names = []) {
    return Array.from({length: count}, (_, i) => `<label for="quick-name-${i}">Jugador o equipo ${i + 1}</label><input id="quick-name-${i}" data-quick-name maxlength="24" value="${esc(names[i] || `Jugador ${i + 1}`)}" autocomplete="off">`).join('');
  }
  function save() { CT.Storage.setItem(KEY, JSON.stringify(record)); }
  function dispatch(command) {
    state = E.step(state, command);
    record.commands.push(command); save(); selected = null; slot = null; render();
  }
  function scores() {
    return `<ul class="quick-scores" aria-label="Marcador">${state.players.map((p, i) => `<li class="${state.phase === 'turn' && i === state.current ? 'current' : ''}"><strong>${esc(p.name)}</strong><span>${p.score} asegurados${p.points ? ` · ${p.points} en juego` : ''}</span><small>${p.status === 'failed' ? 'Fuera de este reto' : p.status === 'banked' ? 'Puntos asegurados' : 'Sigue jugando'}</small></li>`).join('')}</ul>`;
  }
  function cardMarkup(c, item) {
    return `<article class="timeline-card quick-card"><div class="card-visual"><span aria-hidden="true">◇</span><small>${esc(c.title)}</small></div><div class="card-content"><div class="year">${esc(item.label)}</div><h3>${esc(item.title)}</h3></div></article>`;
  }
  function render() {
    const c = E.challenge(state.config.rounds[state.index].id), p = state.players[state.current];
    const get = id => c.cards.find(item => item.id === id);
    const heading = `<div class="eyebrow">Reto ${state.index + 1} de ${state.config.rounds.length}</div><h1 data-focus tabindex="-1">${esc(c.title)}</h1><p class="quick-rule">${esc(c.rule)}</p><p>${esc(c.context)}</p>${scores()}`;
    if (state.phase === 'round-end') {
      const final = state.index + 1 === state.config.rounds.length;
      const best = Math.max(...state.players.map(player => player.score));
      const winners = state.players.filter(player => player.score === best).map(player => esc(player.name));
      shell(`${heading}<section class="panel quick-panel"><h2>${final ? winners.length > 1 ? 'Victoria compartida' : `Gana ${winners[0]}` : 'Reto terminado'}</h2>
        ${final ? `<p>${winners.join(' y ')} · ${best} puntos.</p>` : '<p>Los puntos de este reto ya están asegurados.</p>'}
        <ul>${state.players.map(player => `<li>${esc(player.name)}: ${player.roundScore} puntos en este reto.</li>`).join('')}</ul>
        ${final ? button('setup', 'Otra partida') : button('next', 'Siguiente reto')}
        <button class="btn btn-secondary" data-action="home">Guardar y volver al inicio</button></section>
        <details class="panel quick-panel"><summary>Ver el orden completo y las fuentes</summary><ol>${[...c.cards].sort((a, b) => (a.value - b.value) * c.direction).map(item => `<li><strong>${esc(item.title)} · ${esc(item.label)}</strong><p>${esc(item.detail)} <a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Fuente</a></p></li>`).join('')}</ol></details>`);
      return;
    }
    if (state.phase === 'result') {
      const r = state.result, item = get(r.cardId);
      shell(`${heading}<section class="panel quick-panel quick-result ${r.correct ? 'success' : 'failure'}" role="status"><h2>${r.correct ? '¡Bien colocado!' : 'No encaja ahí'}</h2><h3>${esc(item.title)}</h3><div class="year">${esc(item.label)}</div><p>${esc(item.detail)}</p><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a>
        <p>${r.correct ? `${esc(p.name)} tiene ${p.points} ${p.points === 1 ? 'punto provisional' : 'puntos provisionales'}.` : `${esc(p.name)} pierde ${r.lost} puntos de este reto y queda fuera hasta el siguiente. La carta ya está en su lugar correcto.`}</p>
        ${button('ack', 'Continuar', 'btn btn-primary btn-block')}</section><div class="quick-line" aria-label="Orden actual">${state.timeline.map(id => cardMarkup(c, get(id))).join('')}</div>`);
      return;
    }
    const gap = i => `<button class="quick-slot${slot === i ? ' selected' : ''}" data-quick="slot" data-index="${i}" ${selected ? '' : 'disabled'} aria-pressed="${slot === i}" aria-label="${esc(i === 0 ? `Colocar antes de ${get(state.timeline[0]).title}` : i === state.timeline.length ? `Colocar después de ${get(state.timeline[i-1]).title}` : `Colocar entre ${get(state.timeline[i-1]).title} y ${get(state.timeline[i]).title}`)}">+</button>`;
    shell(`${heading}<section class="quick-turn panel quick-panel"><h2>Turno de ${esc(p.name)}</h2><p>${p.points} puntos en juego · ${state.remaining.length} cartas disponibles</p>${button('bank', p.points ? `Plantarse y asegurar ${p.points} puntos` : 'Pasar este reto', 'btn btn-secondary')}</section>
      <p class="hint">${selected ? 'Elige un hueco de la línea y confirma la colocación.' : 'Elige una carta común para colocarla en la línea.'}</p>
      <div class="quick-line" aria-label="Línea de cartas: orden de izquierda a derecha">${state.timeline.map((id, i) => gap(i) + cardMarkup(c, get(id))).join('')}${gap(state.timeline.length)}</div>
      ${slot !== null ? `<section class="panel quick-panel quick-confirm"><h2>¿Colocar «${esc(get(selected).title)}» aquí?</h2>${button('confirm', 'Confirmar colocación')}${button('cancel', 'Cancelar', 'btn btn-ghost')}</section>` : ''}
      <h2>Cartas comunes</h2><div class="hand quick-hand">${state.remaining.map(id => `<button class="hand-card${selected === id ? ' selected' : ''}" data-quick="select" data-id="${id}" aria-pressed="${selected === id}"><span class="hidden-date">Valor oculto</span><span class="carta-reverso" aria-hidden="true"><img class="reverso-coleccion" src="assets/hero-${c.cover}-400.webp" alt="" width="400" height="560"></span><strong>${esc(get(id).title)}</strong></button>`).join('')}</div>`);
  }
  document.addEventListener('change', event => {
    if (!app().querySelector('.quick-shell')) return;
    if (event.target.id === 'quick-count') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value);
      app().querySelector('#quick-names').innerHTML = nameFields(Number(event.target.value), names);
    }
    if (event.target.id === 'quick-length') app().querySelector('#quick-choice-wrap').hidden = event.target.value !== '1';
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-quick]');
    if (!target || !app().contains(target) || !paint) return;
    const action = target.dataset.quick;
    if (action === 'menu') {CT.UI.confirmExit('La partida se conserva para que puedas continuar después.', setup); return;}
    if (action === 'setup') {setup(); return;}
    if (action === 'start') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value.trim());
      if (names.some(n => !n) || new Set(names.map(n => n.toLocaleLowerCase('es'))).size !== names.length) {
        app().querySelector('#quick-error').textContent = 'Escribe nombres diferentes para cada participante.'; return;
      }
      const count = Number(app().querySelector('#quick-length').value);
      const list = count === 1 ? [E.challenge(app().querySelector('#quick-choice').value)] : CT.shuffle(CT.QuickCatalog.challenges).slice(0, count);
      const config = {names, rounds: list.map(c => ({id: c.id, order: CT.shuffle(c.cards.map(item => item.id))}))};
      record = {version: CT.QuickCatalog.version, config, commands: []}; state = E.create(config);
      save(); selected = null; slot = null; render(); return;
    }
    if (action === 'resume') {record = load(); if (!record) {setup(); return;} state = E.restore(record); selected = null; slot = null; render(); return;}
    if (!state) return;
    if (action === 'select' && state.phase === 'turn' && state.remaining.includes(target.dataset.id)) {selected = target.dataset.id; slot = null; render();}
    else if (action === 'slot' && selected && state.phase === 'turn') {slot = Number(target.dataset.index); render(); app().querySelector('.quick-confirm')?.scrollIntoView?.({block: 'nearest'});}
    else if (action === 'cancel') {slot = null; render();}
    else if (action === 'confirm' && selected && slot !== null) dispatch({type: 'place', cardId: selected, index: slot});
    else if (['bank', 'ack', 'next'].includes(action)) dispatch({type: action});
  });
  CT.Quick = {
    open(renderPage) {paint = renderPage; state = null; record = null; selected = null; slot = null; setup();},
    promo() {return `<section class="home-competition"><div class="collection-heading"><div class="eyebrow">Pequeños desafíos, grandes decisiones</div><h2>Retos rápidos</h2></div><button class="comp-promo quick-promo" data-action="quick-challenges"><span><b>Ordena. Arriesga. Asegura.</b><small>Hasta diez cartas por reto · turnos en un solo móvil</small></span><span aria-hidden="true">→</span></button><article class="panel quick-upcoming"><span class="eyebrow">Gran mazo · En preparación</span><h2>¿Cuántos hay…?</h2><p>Conceptos muy distintos, una misma pregunta: ¿qué cantidad es mayor?</p><small>La selección de cartas llegará más adelante.</small></article></section>`;}
  };
})();
