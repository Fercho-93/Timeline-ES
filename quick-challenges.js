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
    paint(`<div class="shell quick-shell">${CT.UI.header(state ? 'data-quick="exit"' : 'data-action="home"', state ? 'data-quick="menu"' : '', !!state)}${state ? content : `<div class="quick-content">${content}</div>`}</div>`, !!state);
  }
  const button = (action, text, cls = 'btn btn-primary') => `<button class="${cls}" data-quick="${action}">${text}</button>`;
  function setup() {
    state = null; record = null; selected = null; slot = null;
    const saved = load();
    shell(`${masthead('Retos rápidos', 'Elige una carta, colócala y decide cuándo asegurar tus puntos.', 'quick')}
      <section class="panel quick-panel quick-setup" aria-labelledby="quick-setup-title">
      <header class="quick-setup-heading"><div><div class="eyebrow">Un solo móvil</div><h2 id="quick-setup-title">Preparad la mesa</h2></div><span class="quick-table-mark" aria-hidden="true">◇</span></header>
      <fieldset class="quick-fieldset"><legend>¿Cuántos jugáis?</legend><div class="quick-count-options"><label class="quick-count-option"><input type="radio" name="quick-count" value="2" checked><span><b>2</b><small>jugadores</small></span></label><label class="quick-count-option"><input type="radio" name="quick-count" value="3" ><span><b>3</b><small>jugadores</small></span></label><label class="quick-count-option"><input type="radio" name="quick-count" value="4" ><span><b>4</b><small>jugadores</small></span></label></div><p class="quick-help">También podéis jugar por equipos.</p></fieldset>
      <div id="quick-names" class="quick-names">${nameFields(2)}</div>
      <fieldset class="quick-fieldset quick-duration"><legend>Elegid la partida</legend><div class="quick-length-options"><label class="quick-length-option"><input type="radio" name="quick-length" value="1"><span><b>Un reto</b><small>Elegís la temática</small></span></label><label class="quick-length-option"><input type="radio" name="quick-length" value="3" checked><span><b>Tres retos</b><small>Sorpresa en cada ronda</small></span></label></div></fieldset>
      <div id="quick-choice-wrap" hidden><label for="quick-choice">¿A qué jugamos?</label><select id="quick-choice">${CT.QuickCatalog.challenges.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div>
      <p class="quick-help quick-turn-note">El primer turno rota en cada reto.</p>
      <div class="quick-start-actions">${button('start', 'Barajar y empezar <span aria-hidden="true">→</span>', 'btn btn-primary btn-block')}
      ${saved ? button('resume', 'Continuar partida guardada', 'btn btn-secondary btn-block') : ''}</div>
      <p id="quick-error" role="alert">${esc(error)}</p></section>
      <details class="panel quick-panel"><summary>Cómo se juega</summary><ol><li>Una carta revelada inicia la línea, sin dar puntos.</li><li>Elige una de las cartas comunes y toca un hueco. Confirma para revelar el dato.</li><li>Acertar suma un punto provisional y pasa el turno.</li><li>En tu siguiente turno puedes plantarte: aseguras tus puntos y sales de este reto.</li><li>Fallar pierde tus puntos de este reto y te retira. Los de retos anteriores se conservan.</li><li>Al agotarse las cartas, los puntos pendientes se aseguran. El reto también termina si nadie sigue activo.</li></ol><p>La carta fallada queda corregida en la línea. Si queda una sola persona, puede seguir arriesgando. Los empates de valor admiten cualquier orden equivalente. Gana quien suma más puntos; un empate final se comparte.</p></details>
      <section class="quick-catalog" aria-label="Retos disponibles">${CT.QuickCatalog.challenges.map(c => `<article class="panel quick-panel"><h2>${esc(c.title)}</h2><p>${esc(c.rule)}</p><small>${c.cards.length} cartas · una de referencia</small></article>`).join('')}</section>`);
  }
  function nameFields(count, names = []) {
    return Array.from({length: count}, (_, i) => `<div class="quick-player"><span class="quick-player-token" aria-hidden="true">${i + 1}</span><div><label for="quick-name-${i}">Jugador o equipo ${i + 1}</label><input id="quick-name-${i}" data-quick-name maxlength="24" value="${esc(names[i] || `Jugador ${i + 1}`)}" autocomplete="off" spellcheck="false"></div></div>`).join('');
  }
  function save() { CT.Storage.setItem(KEY, JSON.stringify(record)); }
  function dispatch(command) {
    state = E.step(state, command);
    if (command.type === 'place') CT.Effects?.feedback(state.result.correct);
    record.commands.push(command); save(); selected = null; slot = null; render();
  }
  function scores() {
    return `<div class="scoreboard" aria-label="Marcador">${state.players.map((p, i) => `<span class="score ${i === state.current ? 'active' : ''}" aria-label="${esc(p.name)}: ${p.score} asegurados, ${p.points} en juego. ${p.status === 'failed' ? 'Fuera de este reto' : p.status === 'banked' ? 'Se ha plantado' : 'Sigue jugando'}"><i>${esc(CT.initials(p.name))}</i><b>${esc(p.name)}</b><em>${p.score}${p.points ? ` +${p.points}` : ''}${p.status !== 'active' ? ' ·' : ''}</em></span>`).join('')}</div>`;
  }
  function cardMarkup(c, item) {
    return `<article class="timeline-card card-flippable animal-timeline-card" data-id="${item.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(item.title)}. Toca para ver la explicación."><div class="card-category">${esc(c.title)}</div><div class="card-visual"><img class="animal-card-art" src="assets/hero-quick-400.webp" alt="" width="400" height="600"></div><div class="card-content"><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><div class="year">${esc(item.label)}</div></div></article>`;
  }
  function render() {
    const c = E.challenge(state.config.rounds[state.index].id), p = state.players[state.current];
    const get = id => c.cards.find(item => item.id === id);
    const heading = `<h1 class="solo-lectores" data-focus tabindex="-1">${esc(c.title)} · Turno de ${esc(p.name)}</h1><div class="game-head"><div><div class="turn-label">Reto ${state.index + 1} de ${state.config.rounds.length} · ${esc(c.title)}</div><div class="turn-name">${esc(p.name)}</div></div><div class="deck-count"><strong>${state.remaining.length}</strong><span>cartas</span></div></div>${scores()}<p class="quick-rule">${esc(c.rule)}</p>`;
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
      shell(`${heading}${CT.timelineMap(null, state.timeline)}<div class="timeline-wrap"><div class="timeline">${state.timeline.map(id => cardMarkup(c, get(id))).join('')}</div></div><div class="overlay" data-quick-result><section class="modal quick-result ${r.correct ? 'success' : 'failure'}"><div class="result-mark" aria-hidden="true">${r.correct ? '✓' : '×'}</div><h2>${r.correct ? '¡Bien colocado!' : 'No encaja ahí'}</h2><h3>${esc(item.title)}</h3><div class="reveal"><div class="year">${esc(item.label)}</div><p>${esc(item.detail)}</p></div><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a>
        <p>${r.correct ? `${esc(p.name)} tiene ${p.points} ${p.points === 1 ? 'punto provisional' : 'puntos provisionales'}.` : `${esc(p.name)} pierde ${r.lost} puntos de este reto y queda fuera hasta el siguiente. La carta ya está en su lugar correcto.`}</p>
        ${button('ack', 'Continuar', 'btn btn-primary btn-block')}</section></div>`);
      CT.openDialog(app().querySelector('[data-quick-result]'), false);
      return;
    }
    const gap = i => slot === i && selected ? `<div class="slot-confirm quick-confirm" data-index="${i}"><small>Colocar aquí</small><strong>${esc(get(selected).title)}</strong>${button('confirm', 'Sí, aquí', 'btn btn-primary btn-block')}${button('cancel', 'Cancelar', 'btn btn-ghost btn-block')}</div>` : `<button class="slot" data-quick="slot" data-index="${i}" ${selected ? '' : 'disabled'} aria-label="${esc(i === 0 ? `Colocar antes de ${get(state.timeline[0]).title}` : i === state.timeline.length ? `Colocar después de ${get(state.timeline[i-1]).title}` : `Colocar entre ${get(state.timeline[i-1]).title} y ${get(state.timeline[i]).title}`)}"><span>+</span></button>`;
    shell(`${heading}<section><div class="hand-title"><h3>Línea de cartas</h3><small>${state.timeline.length} colocadas</small></div>${CT.timelineMap(null, state.timeline)}
      <div class="timeline-wrap"><div class="timeline" aria-label="Línea de cartas: orden de izquierda a derecha">${state.timeline.map((id, i) => gap(i) + cardMarkup(c, get(id))).join('')}${gap(state.timeline.length)}</div></div></section>
      <section><div class="hand-title"><h3>Cartas comunes</h3><small>${state.remaining.length} por colocar</small></div><div class="hand">${state.remaining.map(id => `<button class="hand-card${selected === id ? ' selected' : ''}" data-quick="select" data-id="${id}" aria-pressed="${selected === id}"><span class="hidden-date">Valor oculto</span><span class="carta-reverso" aria-hidden="true"><img class="reverso-coleccion" src="assets/hero-quick-400.webp" alt="" width="400" height="600"></span><strong>${esc(get(id).title)}</strong><span class="card-arrow">→</span></button>`).join('')}</div>
      <p class="hint">${selected ? 'Toca un hueco y confirma, o arrastra la carta hasta su lugar.' : 'Toca una carta o mantenla pulsada para arrastrarla hasta un hueco.'}</p></section>
      <div class="quick-bank"><p>${p.points} puntos en juego · ${p.score} asegurados</p>${button('bank', p.points ? `Plantarse y asegurar ${p.points} puntos` : 'Pasar este reto', 'btn btn-secondary btn-block')}</div>`);
    CT.enableDrag({cardSelector: '.quick-shell .hand-card', slotSelector: '.quick-shell .slot', parseCardId: id => id, onDrop(id, index) {
      if (!app().querySelector('.quick-shell') || state?.phase !== 'turn' || !state.remaining.includes(id)) return;
      selected = id; slot = index; render(); focusPlacement();
    }});
  }
  function focusPlacement() {
    const node = app().querySelector('.quick-confirm') || app().querySelector('.timeline-wrap');
    node?.scrollIntoView?.({block: 'nearest', behavior: 'auto'});
    if (slot !== null) app().querySelector('[data-quick="confirm"]')?.focus({preventScroll:true});
    CT.announce(slot === null ? 'Carta elegida. Elige un hueco.' : `Hueco ${slot + 1} elegido. Confirma la colocación.`);
  }
  function menu() {
    const c = E.challenge(state.config.rounds[state.index].id);
    const layer = document.createElement('div'); layer.className = 'overlay';
    layer.innerHTML = `<div class="modal"><h2>Retos rápidos</h2><p>${esc(c.rule)}. ${esc(c.context)}</p><p>Acertar suma un punto provisional. Plantarse lo asegura; fallar pierde los puntos de este reto y te retira. Los puntos anteriores se conservan.</p><div class="actions">${button('close-menu', 'Seguir jugando', 'btn btn-primary btn-block')}<button class="btn btn-secondary btn-block" data-settings-action="open">Ajustes</button>${button('setup', 'Guardar y salir', 'btn btn-secondary btn-block')}</div></div>`;
    app().append(layer); CT.openDialog(layer, true);
  }
  document.addEventListener('change', event => {
    if (!app().querySelector('.quick-shell')) return;
    if (event.target.name === 'quick-count') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value);
      app().querySelector('#quick-names').innerHTML = nameFields(Number(event.target.value), names);
    }
    if (event.target.name === 'quick-length') app().querySelector('#quick-choice-wrap').hidden = event.target.value !== '1';
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-quick]');
    if (!target || !app().contains(target) || !paint) return;
    const action = target.dataset.quick;
    if (action === 'menu') {menu(); return;}
    if (action === 'close-menu') {CT.closeDialog(); return;}
    if (action === 'exit') {CT.UI.confirmExit('La partida se conserva para que puedas continuar después.', setup); return;}
    if (action === 'setup') {setup(); return;}
    if (action === 'start') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value.trim());
      if (names.some(n => !n) || new Set(names.map(n => n.toLocaleLowerCase('es'))).size !== names.length) {
        app().querySelector('#quick-error').textContent = 'Escribe nombres diferentes para cada participante.'; return;
      }
      const count = Number(app().querySelector('[name="quick-length"]:checked').value);
      const list = count === 1 ? [E.challenge(app().querySelector('#quick-choice').value)] : CT.shuffle(CT.QuickCatalog.challenges).slice(0, count);
      const config = {names, rounds: list.map(c => ({id: c.id, order: CT.shuffle(c.cards.map(item => item.id))}))};
      record = {version: CT.QuickCatalog.version, config, commands: []}; state = E.create(config);
      save(); selected = null; slot = null; render(); return;
    }
    if (action === 'resume') {record = load(); if (!record) {setup(); return;} state = E.restore(record); selected = null; slot = null; render(); return;}
    if (!state) return;
    if (action === 'select' && state.phase === 'turn' && state.remaining.includes(target.dataset.id)) {selected = target.dataset.id; slot = null; CT.Effects?.tap(); render(); focusPlacement();}
    else if (action === 'slot' && selected && state.phase === 'turn') {slot = Number(target.dataset.index); CT.Effects?.tap(); render(); focusPlacement();}
    else if (action === 'cancel') {slot = null; render();}
    else if (action === 'confirm' && selected && slot !== null) {CT.Effects?.stamp(); dispatch({type: 'place', cardId: selected, index: slot});}
    else if (['bank', 'ack', 'next'].includes(action)) dispatch({type: action});
  });
  function masthead(title, subtitle, art) {
    return `<section class="mode-masthead atlas-intro" data-depth-scene><div class="atlas-landscape"><img src="assets/hero-${art}-700.webp" alt="" decoding="async"></div><div class="atlas-intro-copy"><div class="eyebrow">Continuum</div><h1 data-focus tabindex="-1">${esc(title)}</h1><p>${esc(subtitle)}</p></div></section>`;
  }
  function block(title, subtitle, art, action, count) {
    return `<div class="collection-entry"><button class="gallery-panel panel-${art}" data-action="${action}" aria-label="${esc(title)}. ${esc(subtitle)}"><span class="panel-backdrop" aria-hidden="true"><img src="assets/hero-${art}-400.webp" alt="" width="400" height="600"></span><span class="panel-depth-light" aria-hidden="true"></span><span class="panel-art" aria-hidden="true"><img src="assets/hero-${art}-400.webp" alt="" width="400" height="600"></span><span class="panel-depth-ground" aria-hidden="true"></span><span class="collection-foil" aria-hidden="true"></span><span class="collection-index" aria-hidden="true">${count}</span><span class="collection-open" aria-hidden="true">↗</span><span class="panel-spine" aria-hidden="true"><i>◇</i><b>${esc(title)}</b></span><span class="panel-label" aria-hidden="true"><i></i><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span></button></div>`;
  }
  CT.Quick = {
    open(renderPage) {paint = renderPage; state = null; record = null; selected = null; slot = null; setup();},
    blocks() {return block('Retos rápidos', 'Ordena. Arriesga. Asegura.', 'quick', 'quick-challenges', `${CT.QuickCatalog.challenges.length} retos`) + block('¿Cuántos hay…?', 'Un gran mazo de cantidades por descubrir.', 'science', 'quick-counts', 'En preparación');},
    counts(renderPage) {paint = renderPage; state = null; record = null; shell(`${masthead('¿Cuántos hay…?', 'Conceptos muy distintos, una misma pregunta: ¿qué cantidad es mayor?', 'science')}<section class="panel quick-panel"><div class="eyebrow">Gran mazo · En preparación</div><h2>De menos a más</h2><p>Este bloque tendrá su propio gran mazo de cantidades. La selección de cartas llegará más adelante.</p><button class="btn btn-secondary" data-action="home">Volver a las colecciones</button></section>`);}
  };
})();
