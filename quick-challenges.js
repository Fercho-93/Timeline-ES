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
    const playing=!!state || !!connection || page==='network-lobby';
    paint(`<div class="shell quick-shell${page==='menu'?' home-shell play-menu-shell':''}">${CT.UI.header(playing ? 'data-quick="exit"' : page==='menu' ? 'data-action="home"' : 'data-quick="formats"', state ? 'data-quick="menu"' : '', playing)}${state || page==='menu' ? content : `<div class="quick-content">${content}</div>`}</div>`, playing ? state ? true : 'lobby' : false);
    if(state && room && !myTurn()) for(const el of app().querySelectorAll('[data-quick="select"],[data-quick="slot"],[data-quick="confirm"],[data-quick="bank"],[data-quick="next"],[data-quick="ack"]')) el.disabled=true;
  }
  let format = 'local', page = 'menu', connection = null, room = null, myId = null, busy = false, invite = null, netKind = 'internet', networkEpoch = 0, roomCapacity = 4;
  const DAILY = 'continuum-quick-daily-v1', BEST = 'continuum-quick-best-v1', NET = 'continuum-quick-room-v1';
  const day = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function readJSON(key, fallback=null) {try{return JSON.parse(CT.Storage.getItem(key)) || fallback;}catch{return fallback;}}
  function myTurn() {return !room || room.actor === myId;}
  function stopNetwork() {networkEpoch++;connection?.close();connection=null;room=null;myId=null;busy=false;invite=null;}
  function errorNotice(e) {busy=false;let el=app().querySelector('#quick-error');if(!el){el=document.createElement('p');el.id='quick-error';el.setAttribute('role','alert');(app().querySelector('.modal') || app().querySelector('.quick-shell'))?.append(el);}if(el)el.textContent=e.message || String(e);CT.announce(e.message || String(e));}
  function formatMenu() {
    stopNetwork();page='menu';state=null;record=null;const saved=load();
    shell(`${masthead('Retos rápidos','Ordena. Arriesga. Asegura.','quick')}<section class="home-play"><section class="play-choices" aria-labelledby="quick-formats-title"><div class="play-choices-head"><div><div class="eyebrow">Elegir formato</div><h2 id="quick-formats-title">¿Cómo quieres jugar?</h2></div></div>
    <div class="play-choice-block"><button class="play-block-toggle walking-choice" data-quick="show-multi" aria-expanded="false"><img class="walking-art" src="assets/mode-walk-multi.webp" alt="" width="720" height="480"><span class="walking-copy"><b>Multijugador</b><small>Un solo móvil o varios.</small></span><i aria-hidden="true">⌄</i></button><div id="quick-multi" class="play-choice-grid" hidden>${choice('local','Un solo móvil','Pasad el teléfono en cada turno.','local')}${choice('internet','Varios móviles','Crear sala o unirse por internet.','internet')}${choice('offline','Sin conexión','Varios móviles en la misma red Wi-Fi.','offline')}</div></div>
    <div class="direct-solo"><button class="play-choice walking-choice" data-quick="solo-menu"><img class="walking-art" src="assets/mode-walk-solo.webp" alt="" width="720" height="480"><span class="walking-copy"><b>Jugar solo</b><small>Reto diario, partida libre o duelo por enlace.</small></span><i aria-hidden="true">→</i></button></div>
    ${saved ? button('resume','Continuar partida guardada','continue-choice') : ''}${readJSON(NET) ? button('reconnect','Volver a mi sala por internet','continue-choice') : ''}<p id="quick-error" role="alert">${esc(error)}</p></section></section>`);
  }
  function choiceIcon(kind) {
    const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if(kind==='local')return `<svg ${common}><rect x="7" y="2.75" width="10" height="18.5" rx="2.2"></rect><path d="M10.5 18h3"></path></svg>`;
    if(kind==='internet')return `<svg ${common}><rect x="3" y="6" width="10" height="15" rx="2"></rect><rect x="11" y="2.75" width="10" height="15" rx="2"></rect><path d="M14 14.75h4"></path></svg>`;
    return `<svg ${common}><rect x="3" y="6" width="8" height="13" rx="1.8"></rect><rect x="13" y="5" width="8" height="13" rx="1.8"></rect><path d="M11 12h2"></path></svg>`;
  }
  function choice(action,title,subtitle,kind) {return `<button class="play-choice" data-quick="${action}"><span class="choice-icon">${choiceIcon(kind)}</span><span><b>${title}</b><small>${subtitle}</small></span><i aria-hidden="true">→</i></button>`;}
  function soloMenu() {
    page='solo-menu';state=null;record=null;const daily=readJSON(DAILY),today=day();const done=daily?.config?.day===today;let score='';
    if(done){try{const s=E.restore(daily);score=`${s.players[0].score} puntos asegurados`;}catch{}}
    shell(`<section class="setup-section solo-home"><div class="solo-intro"><div class="eyebrow">Retos rápidos</div><h2 class="solo-title" data-focus tabindex="-1">Jugar en solitario</h2><p class="lead">Ordena, descubre y supera tu marca.</p><p class="solo-intro-rule">Acertar suma. Plantarte asegura tus puntos. Fallar termina el reto y pierde los puntos provisionales.</p></div>
    <div class="panel solo-panel"><div class="solo-panel-head"><h3>Reto diario</h3><time>${today}</time></div><p>Las mismas cartas para todo el mundo. Un intento al día, que puedes continuar.</p>${button('daily',done?'Ver o continuar el reto de hoy':'Jugar el reto de hoy','btn btn-primary btn-block')}${score?`<p>${score}</p>`:''}</div>
    <div class="panel solo-panel"><div class="solo-panel-head"><h3>Partida libre</h3></div><p>Elige un reto o juega tres temáticas variadas.</p><p class="hint">Mejor marca en tres retos: ${Number(readJSON(BEST,0)) || 0} puntos.</p>${button('free','Empezar','btn btn-primary btn-block')}</div>
    <div class="panel solo-panel"><div class="solo-panel-head"><h3>Duelo por enlace</h3></div><p>De seguidos: juega y comparte las mismas cartas con otra persona. Por turnos: crea una sala para dos y volved cuando os toque.</p>${button('duel','Duelo de seguidos','btn btn-primary btn-block')}${button('turn-duel','Duelo por turnos','btn btn-secondary btn-block')}<div class="field"><label for="quick-duel-link">Enlace recibido</label><input id="quick-duel-link" type="url" placeholder="Pega aquí el enlace"></div>${button('accept-duel','Abrir duelo','btn btn-ghost btn-block')}</div><p id="quick-error" role="alert"></p></section>`);
  }
  function rounds(count=3, selectedId=null, seed=null) {
    const random=seed===null?Math.random:CT.seededRandom(CT.seedFrom(seed));
    const list=selectedId?[E.challenge(selectedId)]:CT.shuffleWith(CT.QuickCatalog.challenges,random).slice(0,count);
    return list.map(c=>({id:c.id,order:CT.shuffleWith(c.cards.map(x=>x.id),random)}));
  }
  function begin(config) {record={version:CT.QuickCatalog.version,config,commands:[]};state=E.create(config);selected=null;slot=null;save();render();}
  function dailyGame() {
    const today=day(),saved=readJSON(DAILY);
    format='daily';
    if(saved?.config?.day===today){record=saved;state=E.restore(record);render();return;}
    begin({names:['Tú'],rounds:rounds(1,null,`quick-${CT.QuickCatalog.version}-${today}`),kind:'daily',day:today});
  }
  function duelLink() {
    const url=new URL(location.href);url.hash='quick-duel='+CT.LocalTransport.encodeText(JSON.stringify(record));return url.href;
  }
  function acceptDuel(value=location.href) {
    const url=new URL(value,location.href),encoded=new URLSearchParams(url.hash.slice(1)).get('quick-duel');
    if(!encoded || encoded.length>16000)throw Error('Este enlace no es un duelo de Retos rápidos.');
    const rival=JSON.parse(CT.LocalTransport.decodeText(encoded)),s=E.restore(rival);
    if(s.players.length!==1 || s.phase!=='round-end' || s.index!==s.config.rounds.length-1 || rival.config.kind!=='duel')throw Error('El rival debe terminar su duelo antes de compartirlo.');
    format='duel';begin({names:['Tú'],rounds:rival.config.rounds,kind:'duel',rivalScore:s.players[0].score});
    history.replaceState(null,'',location.pathname+location.search);
  }
  function networkSetup(kind,capacity=4) {
    roomCapacity=capacity;
    stopNetwork();state=null;record=null;page='network';netKind=kind;
    shell(`<section class="setup-section"><h2 data-focus tabindex="-1">${capacity===2?'Duelo por turnos':kind==='internet'?'Varios móviles':'Sin conexión'}</h2><p class="lead">${kind==='internet'?'Cread una sala o uníos con su código. También podéis volver más tarde para seguir por turnos.':'Conectad todos los móviles a la misma red Wi-Fi. Quien crea la sala debe mantenerla abierta.'}</p><div class="panel"><div class="field"><label for="quick-net-name">Tu nombre</label><input id="quick-net-name" maxlength="24" value="${esc(CT.Accounts?.profile?.alias || '')}"></div>${button('create-room','Crear sala','btn btn-primary btn-block')}<div class="field"><label for="quick-net-code">${kind==='internet'?'Código o enlace de sala':'Invitación recibida'}</label><textarea id="quick-net-code" rows="2"></textarea></div>${button('join-room','Unirme a la sala','btn btn-secondary btn-block')}<p id="quick-error" role="alert"></p></div></section>`);
  }
  function roomChanged(next,id,code) {
    room=CT.QuickRoom.validate(next);myId=id;busy=false;page='network-lobby';
    if(code)CT.Storage.setItem(NET,JSON.stringify({code,name:room.names[room.members.indexOf(id)]}));
    if(room.config){record=CT.QuickRoom.record(room);state=E.restore(record);selected=null;slot=null;render();}
    else lobby(code || connection?.code);
  }
  function lobby(code) {
    state=null;const host=myId===room.host;
    shell(`<section class="setup-section"><h2 data-focus tabindex="-1">Sala de Retos rápidos</h2><div class="panel"><p>${code?`Código: <strong>${esc(code)}</strong>`:'Sala en la red Wi-Fi local'}</p><ul>${room.names.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><p>${room.capacity===2 ? "Dos participantes." : "De 2 a 4 participantes."} ${host?'Empieza cuando estéis todos.':'Quien creó la sala elige cuándo empezar.'}</p>
    ${host ? `<div class="field"><label for="quick-net-length">Duración</label><select id="quick-net-length"><option value="3">Tres retos variados</option><option value="1">Un solo reto</option></select></div><div id="quick-net-choice-wrap" class="field" hidden><label for="quick-net-choice">Elige el reto</label><select id="quick-net-choice"><option value="">Al azar</option>${CT.QuickCatalog.challenges.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div>${button('start-room','Empezar partida','btn btn-primary btn-block')}`:''}
    ${connection?.kind==='local'&&host ? button('invite-peer','Invitar otro móvil','btn btn-secondary btn-block'):''}
    ${code?button('share-room','Compartir enlace de sala','btn btn-secondary btn-block'):''}
    ${button('formats','Volver a los formatos','btn btn-ghost btn-block')}<p id="quick-error" role="alert"></p></div></section>`);
    const start=app().querySelector('[data-quick="start-room"]');if(start)start.disabled=room.members.length<2;
  }
  async function connectRoom(create) {
    const name=app().querySelector('#quick-net-name').value.trim();if(!name)throw Error('Escribe tu nombre.');
    let code=app().querySelector('#quick-net-code').value.trim();
    const epoch=networkEpoch, change=(...args)=>{if(epoch===networkEpoch)roomChanged(...args);}, fail=e=>{if(epoch===networkEpoch)errorNotice(e);};
    if(netKind==='internet') {
      if(code.includes('#'))code=new URLSearchParams(new URL(code).hash.slice(1)).get('quick-room') || '';
      const opened=await CT.QuickNetwork.internet({create,code,name,capacity:roomCapacity,onChange:change,onError:fail});
      if(epoch!==networkEpoch){opened.close();return;}connection=opened;
    } else if(create) connection=CT.QuickNetwork.localHost(name,change,fail);
    else {
      connection=CT.QuickNetwork.localGuest(code,name,change,fail);
      const answer=await connection.answer();if(epoch!==networkEpoch)return;
      shell(`<section class="setup-section"><h2 data-focus tabindex="-1">Devuelve esta respuesta</h2><div class="panel"><p>Compártela con quien creó la sala para completar la conexión.</p><div class="field"><textarea id="quick-signal" readonly rows="4">${esc(answer)}</textarea></div>${button('share-signal','Compartir respuesta','btn btn-primary btn-block')}<p>La sala aparecerá al conectar. Si no conecta, comprobad que estáis en la misma red Wi-Fi.</p><p id="quick-error" role="alert"></p></div></section>`);
    }
  }
  async function networkAction(action) {
    if(busy)return;busy=true;
    try{await connection.act(action);}catch(e){errorNotice(e);}
    finally{busy=false;}
  }
  async function formatAction(action) {
    if(action==='formats'){formatMenu();return true;}
    if(action==='show-multi'){const target=app().querySelector('[data-quick="show-multi"]'),panel=app().querySelector('#quick-multi');panel.hidden=!panel.hidden;target.setAttribute('aria-expanded',String(!panel.hidden));target.parentElement.classList.toggle('open',!panel.hidden);return true;}
    if(action==='solo-menu'){soloMenu();return true;}
    if(['local','free','duel'].includes(action)){format=action;setup();return true;}
    if(action==='daily'){dailyGame();return true;}
    if(action==='accept-duel'){acceptDuel(app().querySelector('#quick-duel-link').value);return true;}
    if(action==='share-duel'){await CT.LocalShare.shareSignal(duelLink());return true;}
    if(['internet','offline','turn-duel'].includes(action)){networkSetup(action==='offline'?'local':'internet',action==='turn-duel'?2:4);return true;}
    if(action==='create-room'||action==='join-room'){await connectRoom(action==='create-room');return true;}
    if(action==='start-room'){await networkAction({type:'start',rounds:rounds(Number(app().querySelector('#quick-net-length').value),app().querySelector('#quick-net-length').value==='1' ? app().querySelector('#quick-net-choice').value || null : null)});return true;}
    if(action==='share-room'){const url=new URL(location.href);url.hash='quick-room='+connection.code;await CT.LocalShare.shareSignal(url.href);return true;}
    if(action==='share-signal'){await CT.LocalShare.shareSignal(app().querySelector('#quick-signal').value);return true;}
    if(action==='invite-peer'){
      invite=await connection.invite();
      shell(`<section class="setup-section"><h2>Invita otro móvil</h2><div class="panel"><p>Comparte esta invitación. El otro móvil la pega en «Unirme a la sala» y te devuelve su respuesta.</p><div class="field"><textarea id="quick-signal" readonly rows="3">${esc(invite.signal)}</textarea></div>${button('share-signal','Compartir invitación','btn btn-primary btn-block')}<div class="field"><label for="quick-answer">Respuesta del otro móvil</label><textarea id="quick-answer" rows="3"></textarea></div>${button('accept-answer','Conectar','btn btn-secondary btn-block')}<p id="quick-error" role="alert"></p></div></section>`);return true;
    }
    if(action==='accept-answer'){await invite.accept(app().querySelector('#quick-answer').value.trim());lobby();return true;}
    if(action==='reconnect') {const saved=readJSON(NET);if(!saved)throw Error('No hay ninguna sala guardada.');networkSetup('internet');app().querySelector('#quick-net-name').value=saved.name;app().querySelector('#quick-net-code').value=saved.code;await connectRoom(false);return true;}
    return false;
  }

  const button = (action, text, cls = 'btn btn-primary') => `<button class="${cls}" data-quick="${action}">${text}</button>`;
  function setup() {
    stopNetwork();page="setup";const solo=format!=="local";
    state = null; record = null; selected = null; slot = null;
    const saved = load();
    shell(`<section class="setup-section"><h2 data-focus tabindex="-1">Retos rápidos</h2><p class="lead">${solo ? "Juega a tu ritmo y asegura tus puntos antes de fallar." : "De 2 a 4 jugadores o equipos en un solo móvil."}</p><div class="panel">
      <div class="setup-block"><div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Jugadores</span></div>
      <div id="quick-names">${nameFields(solo ? 1 : 2, solo ? ["Tú"] : [])}</div>
      ${solo ? '' : button('add-player', '＋ Añadir participante', 'btn btn-ghost')}</div>
      <div class="setup-block"><div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Cómo empezar</span></div>
      <div class="setup-grid"><div class="field"><label for="quick-length">Duración de la partida</label><select id="quick-length"><option value="3">Tres retos variados</option><option value="1">Un solo reto</option></select></div>
      <div id="quick-choice-wrap" class="field" hidden><label for="quick-choice">Elige el reto</label><select id="quick-choice">${CT.QuickCatalog.challenges.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div></div>
      <p class="hint">${solo ? "Puedes plantarte para asegurar los puntos del reto." : "El primer turno rota en cada reto."}</p></div>
      ${button('start', 'Barajar y empezar <span>→</span>', 'btn btn-primary btn-block')}
      ${saved ? button('resume', 'Continuar partida guardada', 'btn btn-secondary btn-block') : ''}
      <p id="quick-error" role="alert">${esc(error)}</p></div></section>
      <details class="panel quick-panel"><summary>Cómo se juega</summary><ol><li>Una carta revelada inicia la línea, sin dar puntos.</li><li>Elige una de las cartas comunes y toca un hueco. Confirma para revelar el dato.</li><li>Acertar suma un punto provisional y pasa el turno.</li><li>En tu siguiente turno puedes plantarte: aseguras tus puntos y sales de este reto.</li><li>Fallar pierde tus puntos de este reto y te retira. Los de retos anteriores se conservan.</li><li>Al agotarse las cartas, los puntos pendientes se aseguran. El reto también termina si nadie sigue activo.</li></ol><p>La carta fallada queda corregida en la línea. Si queda una sola persona, puede seguir arriesgando. Los empates de valor admiten cualquier orden equivalente. Gana quien suma más puntos; un empate final se comparte.</p></details>
      <section class="quick-catalog" aria-label="Retos disponibles">${CT.QuickCatalog.challenges.map(c => `<article class="panel quick-panel"><h2>${esc(c.title)}</h2><p>${esc(c.rule)}</p><small>${c.cards.length} cartas · una de referencia</small></article>`).join('')}</section>`);
  }
  function nameFields(count, names = []) {
    return Array.from({length: count}, (_, i) => `<div class="player-row"><input id="quick-name-${i}" data-quick-name aria-label="Nombre del jugador o equipo ${i + 1}" maxlength="24" value="${esc(names[i] ?? `Jugador ${i + 1}`)}" autocomplete="off"><button class="remove" data-quick="remove-player" data-index="${i}" aria-label="Quitar jugador ${i + 1}" ${count <= 2 ? 'disabled' : ''}>×</button></div>`).join('');
  }
  function save() {
    if(room)return;
    CT.Storage.setItem(KEY, JSON.stringify(record));
    if(record.config.kind==='daily')CT.Storage.setItem(DAILY,JSON.stringify(record));
    if(record.config.kind==='free' && state.phase==='round-end' && state.index===2)CT.Storage.setItem(BEST,JSON.stringify(Math.max(Number(readJSON(BEST,0))||0,state.players[0].score)));
  }
  function dispatch(command) {
    if(room){if(myTurn())void networkAction(command);return;}
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
    page="game";
    const c = E.challenge(state.config.rounds[state.index].id), p = state.players[state.current];
    const get = id => c.cards.find(item => item.id === id);
    const heading = `${room ? `<p class="hint">${myTurn() ? "Tu turno" : `Turno de ${esc(p.name)}`} · ${connection?.kind==='local' ? 'Red Wi-Fi local' : 'Sala por internet'}</p>` : ''}<h1 class="solo-lectores" data-focus tabindex="-1">${esc(c.title)} · Turno de ${esc(p.name)}</h1><div class="game-head"><div><div class="turn-label">Reto ${state.index + 1} de ${state.config.rounds.length} · ${esc(c.title)}</div><div class="turn-name">${esc(p.name)}</div></div><div class="deck-count"><strong>${state.remaining.length}</strong><span>cartas</span></div></div>${scores()}<p class="quick-rule">${esc(c.rule)}</p>`;
    if (state.phase === 'round-end') {
      const final = state.index + 1 === state.config.rounds.length;
      const best = Math.max(...state.players.map(player => player.score));
      const winners = state.players.filter(player => player.score === best).map(player => esc(player.name));
      shell(`${heading}<section class="panel quick-panel"><h2>${final ? state.players.length===1 ? 'Tu resultado' : winners.length > 1 ? 'Victoria compartida' : `Gana ${winners[0]}` : 'Reto terminado'}</h2>
        ${final ? `<p>${winners.join(' y ')} · ${best} puntos.</p>` : '<p>Los puntos de este reto ya están asegurados.</p>'}
        <ul>${state.players.map(player => `<li>${esc(player.name)}: ${player.roundScore} puntos en este reto.</li>`).join('')}</ul>
        ${final ? button('formats', 'Elegir otra partida') : button('next', 'Siguiente reto')}
        ${final && record.config.kind==='duel' ? button('share-duel','Compartir duelo','btn btn-secondary btn-block') + `<div class="field"><label for="quick-result-link">Enlace del duelo</label><input id="quick-result-link" readonly value="${esc(duelLink())}"></div>` : ''}
        ${final && Number.isFinite(record.config.rivalScore) ? `<p>Tu rival: ${record.config.rivalScore} puntos. ${best > record.config.rivalScore ? '¡Has superado su resultado!' : best === record.config.rivalScore ? 'Habéis empatado.' : 'Tu rival ha asegurado más puntos.'}</p>` : ''}
        <button class="btn btn-secondary" data-action="home">Guardar y volver al inicio</button></section>
        <details class="panel quick-panel"><summary>Ver el orden completo y las fuentes</summary><ol>${[...c.cards].sort((a, b) => (a.value - b.value) * c.direction).map(item => `<li><strong>${esc(item.title)} · ${esc(item.label)}</strong><p>${esc(item.detail)} <a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Fuente</a></p></li>`).join('')}</ol></details>`);
      return;
    }
    if (state.phase === 'result') {
      const r = state.result, item = get(r.cardId);
      if(room && !myTurn()){shell(`${heading}${CT.timelineMap(null,state.timeline)}<div class="timeline-wrap"><div class="timeline">${state.timeline.map(id=>cardMarkup(c,get(id))).join('')}</div></div><section class="panel quick-panel"><h2>${r.correct?'¡Bien colocado!':'No encaja ahí'}</h2><p>${esc(item.title)} · ${esc(item.label)}</p><p>Esperando a que continúe ${esc(p.name)}.</p></section>`);return;}
      shell(`${heading}${CT.timelineMap(null, state.timeline)}<div class="timeline-wrap"><div class="timeline">${state.timeline.map(id => cardMarkup(c, get(id))).join('')}</div></div><div class="overlay" data-quick-result><section class="modal quick-result ${r.correct ? 'success' : 'failure'}"><div class="result-mark" aria-hidden="true">${r.correct ? '✓' : '×'}</div><h2>${r.correct ? '¡Bien colocado!' : 'No encaja ahí'}</h2><h3>${esc(item.title)}</h3><div class="reveal"><div class="year">${esc(item.label)}</div><p>${esc(item.detail)}</p></div><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a>
        <p>${r.correct ? `${esc(p.name)} tiene ${p.points} ${p.points === 1 ? 'punto provisional' : 'puntos provisionales'}.` : `${esc(p.name)} pierde ${r.lost} puntos de este reto y queda fuera hasta el siguiente. La carta ya está en su lugar correcto.`}</p>
        ${button('ack', 'Continuar', 'btn btn-primary btn-block')}${room ? button('exit','Salir de la sala','btn btn-ghost btn-block') : ''}</section></div>`);
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
      if (!myTurn() || !app().querySelector('.quick-shell') || state?.phase !== 'turn' || !state.remaining.includes(id)) return;
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
    layer.innerHTML = `<div class="modal"><h2>Retos rápidos</h2><p>${esc(c.rule)}. ${esc(c.context)}</p><p>Acertar suma un punto provisional. Plantarse lo asegura; fallar pierde los puntos de este reto y te retira. Los puntos anteriores se conservan.</p><div class="actions">${button('close-menu', 'Seguir jugando', 'btn btn-primary btn-block')}<button class="btn btn-secondary btn-block" data-settings-action="open">Ajustes</button>${button('formats', 'Guardar y salir', 'btn btn-secondary btn-block')}</div></div>`;
    app().append(layer); CT.openDialog(layer, true);
  }
  document.addEventListener('change', event => {
    if (!app().querySelector('.quick-shell')) return;
    if (event.target.id === 'quick-net-length') app().querySelector('#quick-net-choice-wrap').hidden=event.target.value!=='1';
    if (event.target.id === 'quick-length') app().querySelector('#quick-choice-wrap').hidden = event.target.value !== '1';
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-quick]');
    if (!target || !app().contains(target) || !paint) return;
    const action = target.dataset.quick;
    const formatActions=['formats','show-multi','solo-menu','local','free','duel','daily','accept-duel','share-duel','internet','offline','turn-duel','create-room','join-room','start-room','share-room','share-signal','invite-peer','accept-answer','reconnect'];
    if(formatActions.includes(action)){target.disabled=true;Promise.resolve(formatAction(action)).catch(errorNotice).finally(()=>{if(target.isConnected)target.disabled=false;});return;}
    if (action === 'add-player' || action === 'remove-player') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value);
      if (action === 'add-player' && names.length < 4) names.push(`Jugador ${names.length + 1}`);
      else if (action === 'remove-player' && names.length > 2) names.splice(Number(target.dataset.index), 1);
      app().querySelector('#quick-names').innerHTML = nameFields(names.length, names);
      app().querySelector('[data-quick="add-player"]').disabled = names.length >= 4;
      app().querySelector(`#quick-name-${names.length - 1}`)?.focus(); return;
    }
    if (action === 'menu') {menu(); return;}
    if (action === 'close-menu') {CT.closeDialog(); return;}
    if (action === 'exit') {CT.UI.confirmExit(connection?.kind==='local' ? 'Al salir se cierra la conexión con la sala local.' : 'La partida se conserva para que puedas continuar después.', formatMenu); return;}
    if (action === 'setup') {setup(); return;}
    if (action === 'start') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value.trim());
      if (names.some(n => !n) || new Set(names.map(n => n.toLocaleLowerCase('es'))).size !== names.length) {
        app().querySelector('#quick-error').textContent = 'Escribe nombres diferentes para cada participante.'; return;
      }
      const count = Number(app().querySelector('#quick-length').value);
      const list = count === 1 ? [E.challenge(app().querySelector('#quick-choice').value)] : CT.shuffle(CT.QuickCatalog.challenges).slice(0, count);
      const config = {names, rounds: list.map(c => ({id: c.id, order: CT.shuffle(c.cards.map(item => item.id))})),kind:format};
      record = {version: CT.QuickCatalog.version, config, commands: []}; state = E.create(config);
      save(); selected = null; slot = null; render(); return;
    }
    if (action === 'resume') {record = load(); format=record?.config?.kind || 'local'; if (!record) {setup(); return;} state = E.restore(record); selected = null; slot = null; render(); return;}
    if (!state || !myTurn()) return;
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
    leave:stopNetwork,
    open(renderPage) {paint = renderPage; state = null; record = null; selected = null; slot = null;formatMenu();const params=new URLSearchParams(location.hash.slice(1));try{if(params.has('quick-duel'))acceptDuel();else if(params.has('quick-room')){networkSetup('internet');app().querySelector('#quick-net-code').value=params.get('quick-room');}}catch(e){errorNotice(e);}},
    blocks() {return block('Retos rápidos', 'Ordena. Arriesga. Asegura.', 'quick', 'quick-challenges', `${CT.QuickCatalog.challenges.length} retos`) + block('¿Cuántos hay…?', 'Un gran mazo de cantidades por descubrir.', 'science', 'quick-counts', 'En preparación');},
    counts(renderPage) {stopNetwork();page='counts';paint = renderPage; state = null; record = null; shell(`${masthead('¿Cuántos hay…?', 'Conceptos muy distintos, una misma pregunta: ¿qué cantidad es mayor?', 'science')}<section class="panel quick-panel"><div class="eyebrow">Gran mazo · En preparación</div><h2>De menos a más</h2><p>Este bloque tendrá su propio gran mazo de cantidades. La selección de cartas llegará más adelante.</p><button class="btn btn-secondary" data-action="home">Volver a las colecciones</button></section>`);}
  };
})();
