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
  let topTitle = '';
  function shell(content) {
    const playing=!!state || !!connection || page==='network-lobby';
    // Desde la pantalla por la que se entró, la flecha sale de Retos rápidos a la pantalla
    // anterior del juego; desde cualquier otra, vuelve a esa pantalla de entrada.
    const back=playing ? 'data-quick="exit"' : page===entry ? 'data-action="ui-back"' : 'data-quick="formats"';
    paint(`<div class="shell quick-shell">${CT.UI.header(back, state ? 'data-quick="menu"' : '', playing, state ? topTitle : '')}${state ? content : `<div class="quick-content">${content}</div>`}</div>`, playing ? state ? true : 'lobby' : false);
    if(state && room && !myTurn()) for(const el of app().querySelectorAll('[data-quick="select"],[data-quick="slot"],[data-quick="confirm"],[data-quick="bank"],[data-quick="next"],[data-quick="ack"]')) el.disabled=true;
  }
  let entry = 'menu', format = 'local', page = 'menu', connection = null, room = null, myId = null, busy = false, invite = null, netKind = 'internet', networkEpoch = 0, roomCapacity = 4, roomLength = 3, pendingConfig = null;
  const BEST = 'continuum-quick-best-v1', NET = 'continuum-quick-room-v1', HISTORY = 'continuum-quick-history-v1';
  const day = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function readJSON(key, fallback=null) {try{return JSON.parse(CT.Storage.getItem(key)) || fallback;}catch{return fallback;}}
  function historyId() {return globalThis.crypto?.randomUUID?.() || `quick-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  function quickHistory() {return readJSON(HISTORY, []);}
  function saveHistory() {
    if (!record || state?.phase !== 'round-end' || !record.config || record.historySaved) return;
    const final = state.index + 1 === record.config.rounds.length;
    if (!final) return;
    const key = record.config.historyId || `${record.config.kind}-${record.config.rounds.map(r=>r.id).join(',')}-${record.config.names?.join('|')}`;
    const history = quickHistory();
    if (!history.some(item => item.id === key)) {
      history.unshift({id:key,date:day(),kind:record.config.kind || 'network',rounds:record.config.rounds.length,score:Math.max(...state.players.map(p=>p.score)),players:state.players.map(p=>p.name)});
      CT.Storage.setItem(HISTORY, JSON.stringify(history.slice(0, 50)));
    }
    if(record.config.kind==='daily' && record.config.day===day()){
      const key='hilo-retos-v1', all=readJSON(key,{}) || {};
      const daily=all.retoDiario || {best:0,streak:0,lastDay:'',days:{}};
      daily.days ||= {};
      if(!daily.days[day()]){
        const hits=state.players[0].score;
        const total=record.config.rounds[0].order.length-1;
        const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
        const previous=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
        daily.streak=daily.lastDay===previous?(daily.streak||0)+1:1;
        daily.lastDay=day();daily.best=Math.max(daily.best||0,hits);
        daily.days[day()]={hits,total,family:'quick',challenge:record.config.rounds[0].id,finishedAt:new Date().toISOString(),ms:record.startedAt?Math.max(0,Date.now()-record.startedAt):null};
        all.retoDiario=daily;CT.Storage.setItem(key,JSON.stringify(all));
        CT.Progreso?.finishQuickDaily?.({hits,total,streak:daily.streak});
      }
    }
    record.historySaved = true;
    if(!room) CT.Storage.setItem(KEY, JSON.stringify(record));
  }
  function statsPanel() {
    const history = quickHistory(), games = history.length, points = history.reduce((n,item)=>n + (Number(item.score)||0),0), best = history.reduce((n,item)=>Math.max(n,Number(item.score)||0),0);
    const rows = history.slice(0, 12).map(item => `<li><strong>${esc(item.score)} aciertos</strong><span>${esc(item.date)} · ${esc(item.kind === 'daily' ? 'Reto diario' : item.kind === 'duel' ? 'Duelo de Retos rápidos' : `${item.rounds} ${item.rounds === 1 ? 'reto' : 'retos'}`)}</span></li>`).join('');
    const layer = document.createElement('div'); layer.className='overlay';
    layer.innerHTML = `<div class="modal quick-stats-modal"><h2>Historial y estadísticas</h2><div class="quick-stats-grid"><span><b>${games}</b><small>partidas terminadas</small></span><span><b>${points}</b><small>aciertos acumulados</small></span><span><b>${best}</b><small>mejor resultado</small></span></div><h3>Últimas partidas</h3>${rows ? `<ol class="quick-history">${rows}</ol>` : '<p class="hint">Todavía no hay partidas terminadas. Tu historial aparecerá aquí.</p>'}<button class="btn btn-primary btn-block" data-quick="close-menu">Cerrar</button></div>`;
    app().append(layer); CT.openDialog(layer,true);
  }
  function guide() {
    const layer=document.createElement('div'); layer.className='overlay';
    layer.innerHTML=`<div class="modal rules quick-guide-modal"><div class="guide-tools"><button type="button" class="icon-btn guide-close" data-quick="close-menu" aria-label="Cerrar guía">×</button></div><div class="guide-content"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2>Cómo se juega</h2><section><h3>Un reto, una línea</h3><p>Comienza con una carta de referencia y coloca cada carta nueva en el hueco que le corresponde. El dato se revela al confirmar.</p></section><section><h3>Arriesga o asegura</h3><p>Cada acierto suma un acierto provisional. Puedes plantarte para asegurarlo. Si fallas, pierdes los aciertos provisionales de ese reto.</p></section><section><h3>Mazos sorpresa</h3><p>Los mazos se sortean automáticamente. Solo conocerás la temática cuando empiece el reto; los siguientes permanecen ocultos.</p></section><section><h3>Turnos justos</h3><p>El primer turno rota en cada reto. En partidas por Internet o por enlace, siempre juega una persona cada vez.</p></section></div><button class="btn btn-primary btn-block" data-quick="close-menu">Entendido</button></div>`;
    app().append(layer); CT.openDialog(layer,true);
  }
  function myTurn() {return !room || room.actor === myId;}
  let publicClock=null;
  function stopNetwork() {clearInterval(publicClock);publicClock=null;networkEpoch++;connection?.close();connection=null;room=null;myId=null;busy=false;invite=null;}
  function errorNotice(e) {busy=false;let el=app().querySelector('#quick-error');if(!el){el=document.createElement('p');el.id='quick-error';el.setAttribute('role','alert');(app().querySelector('.modal') || app().querySelector('.quick-shell'))?.append(el);}if(el)el.textContent=e.message || String(e);CT.announce(e.message || String(e));}
  function rounds(count=3, selectedId=null, seed=null) {
    const random=seed===null?Math.random:CT.seededRandom(CT.seedFrom(seed));
    if (selectedId) return [E.challenge(selectedId)].map(c=>({id:c.id,order:CT.shuffleWith(c.cards.map(x=>x.id),random)}));
    const catalog=CT.shuffleWith(CT.QuickCatalog.challenges,random);
    const list=Array.from({length:count},(_,i)=>catalog[i % catalog.length]);
    return list.map(c=>({id:c.id,order:CT.shuffleWith(c.cards.map(x=>x.id),random)}));
  }
  function begin(config) {pendingConfig=null;config.historyId ||= historyId();record={version:CT.QuickCatalog.version,config,commands:[],startedAt:Date.now()};state=E.create(config);selected=null;slot=null;save();render();}
  function prepare(config) {
    pendingConfig=config; page='prepare'; state=null; record=null;
    const c=E.challenge(config.rounds[0].id);
    shell(`<section class="setup-section quick-ready"><div class="eyebrow"><span class="eyebrow-line"></span> Reto preparado</div><h2 data-focus tabindex="-1">${esc(c.title)}</h2>${config.rounds.length === 1 ? '' : `<p class="lead">${config.rounds.length} mazos sorpresa, uno detrás de otro.</p>`}<div class="panel quick-ready-card"><div class="quick-ready-seal" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="23"/><path d="M32 9l3.2 19.8L55 32l-19.8 3.2L32 55l-3.2-19.8L9 32l19.8-3.2z"/><circle cx="32" cy="32" r="3.2"/></svg></div><span class="quick-ready-kicker">La regla del mazo</span><p class="quick-ready-rule">${esc(c.rule)}</p>${c.asOf ? `<p class="quick-ready-asof">Datos a ${esc(c.asOf)}</p>` : ''}<div class="quick-ready-divider" aria-hidden="true"><i></i><b>◆</b><i></i></div><p class="hint">Cuando estés preparado, empieza el reto. Los siguientes mazos seguirán ocultos hasta que lleguen.</p>${button('ready','Estoy preparado <span>→</span>','btn btn-primary btn-block')}<p id="quick-error" role="alert"></p></div></section>`);
    deckSplash(config);
  }
  // Antes de la explicación, una portada breve con el mazo que toca. Es una capa sobre la
  // pantalla «Reto preparado» (que ya está pintada debajo): solo se retira con un toque.
  // También se usa al pasar al siguiente reto de una partida, con `index` el número de ese reto.
  function deckSplash(config, index=0) {
    const c=E.challenge(config.rounds[index].id), total=config.rounds.length;
    const art=c.cards.filter(card=>card.image), pick=[...new Set([art[0],art[Math.floor(art.length/2)],art.at(-1)].filter(Boolean))];
    const lead=config.kind==='daily'?'Reto diario':total===1?'Vas a jugar a':`Reto ${index+1} de ${total}`;
    const layer=document.createElement('div');layer.className='quick-splash';layer.dataset.quickSplash='';layer.setAttribute('role','button');layer.tabIndex=0;layer.setAttribute('aria-label',`${lead}: ${c.title}. Toca para continuar.`);
    layer.innerHTML=`<div class="quick-splash-inner"><div class="quick-splash-fan" aria-hidden="true">${pick.map(card=>`<img src="${esc(card.image)}" alt="" decoding="async">`).join('')}</div><div class="eyebrow">${esc(lead)}</div><h2>${esc(c.title)}</h2><span class="quick-splash-hint">Toca para continuar</span></div>`;
    const close=()=>{if(!layer.isConnected)return;layer.classList.add('is-leaving');setTimeout(()=>layer.remove(),260);};
    layer.addEventListener('click',close);layer.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();close();}});
    app().append(layer);
  }
  function freeSetup() {
    stopNetwork(); page='free-setup'; format='free'; state=null; record=null; selected=null; slot=null;
    const total=CT.QuickCatalog.challenges.length;
    const options=[[1,'Partida rápida'],[3,'Partida estándar'],[5,'Partida larga'],[10,'Maratón'],[15,'Gran maratón'],[20,'Resistencia']].filter(([n])=>n<total);
    const chip=(n,label,extra='')=>`<button type="button" class="quick-length-chip${n===3?' is-selected':''}${extra}" role="radio" aria-checked="${n===3}" data-quick="length" data-length="${n}"><b>${n}</b><span>${n===1?'mazo':'mazos'}</span><small>${label}</small></button>`;
    shell(`<section class="setup-section quick-free-setup"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2 data-focus tabindex="-1">¿Cuánto quieres jugar?</h2><p class="lead">Elige una duración. Los mazos se sortearán sin mostrarte cuáles son.</p><div class="quick-length" role="radiogroup" aria-label="Duración de la partida">${options.map(([n,label])=>chip(n,label)).join('')}${chip(total,'Todos los mazos del catálogo',' quick-length-all')}</div><input type="hidden" id="quick-free-length" value="3">${button('start-free','Sortear y empezar <span>→</span>','btn btn-primary btn-block')}${load() ? button('resume','Continuar partida guardada','btn btn-secondary btn-block') : ''}<div class="quick-secondary-actions">${button('guide','Guía de Retos rápidos','btn btn-secondary btn-block')}${button('stats','Historial y estadísticas','btn btn-ghost btn-block')}</div><p id="quick-error" role="alert">${esc(error)}</p></section>`);
  }
  // El duelo de Retos rápidos por enlace: juegas tú, mandas el enlace y tu amigo juega los mismos mazos.
  // Los mazos salen de una semilla y las jugadas viajan abreviadas, así que el enlace es corto aunque la
  // partida sea larga. Quien lo abre reconstruye la partida con el motor, que es quien da por buena la marca.
  const DUEL_VERSION=2;
  const duelFingerprint=()=>CT.QuickNetwork?.fingerprint?.() || CT.seedFrom(JSON.stringify(CT.QuickCatalog));
  function packCommands(commands, rounds) {
    let r=0;
    return commands.map(c=>{
      if(c.type==='place'){const k=rounds[r].order.indexOf(c.cardId);if(k<0)throw Error('INVALID_DUEL');return `p${k}.${c.index}`;}
      if(c.type==='bank')return 'b';
      if(c.type==='ack')return 'a';
      if(c.type==='next'){r++;return 'n';}
      throw Error('INVALID_DUEL');
    }).join(',');
  }
  function unpackCommands(text, rounds) {
    let r=0;
    return String(text||'').split(',').filter(Boolean).map(token=>{
      if(token==='b')return {type:'bank'};
      if(token==='a')return {type:'ack'};
      if(token==='n'){r++;return {type:'next'};}
      const m=/^p(\d{1,3})\.(\d{1,3})$/.exec(token), cardId=m&&rounds[r]?.order[Number(m[1])];
      if(!cardId)throw Error('INVALID_DUEL');
      return {type:'place',cardId,index:Number(m[2])};
    });
  }
  function duelPayload(rec) {
    const c=rec.config, rs=c.rounds;
    return {v:DUEL_VERSION,f:duelFingerprint(),s:c.seed,n:rs.length,c:packCommands(rec.commands,rs),p:String(CT.Identidad?.propio?.()||'').slice(0,24)};
  }
  function duelLink() {
    const url=new URL(location.href);url.hash='quick-duel='+CT.LocalTransport.encodeText(JSON.stringify(duelPayload(record)));return url.href;
  }
  // Lee un enlace de duelo y devuelve la partida del rival terminada y comprobada. Lanza un error legible si
  // el enlace está cortado, es de otra versión del juego o no es una partida terminada.
  function readDuel(encoded) {
    let p;
    try{p=JSON.parse(CT.LocalTransport.decodeText(encoded));}catch{throw Error('Este enlace no es un duelo de Retos rápidos.');}
    if(!p||p.v!==DUEL_VERSION||typeof p.s!=='string'||!Number.isInteger(p.n)||p.n<1||p.n>CT.QuickCatalog.challenges.length)throw Error('Este enlace no es un duelo de Retos rápidos.');
    if(p.f!==duelFingerprint())throw Error('Este duelo se creó con otra versión de Continuum. Actualizad la aplicación en los dos móviles.');
    const rs=rounds(p.n,null,p.s);
    let s;
    try{s=E.restore({version:CT.QuickCatalog.version,config:{names:['Tú'],rounds:rs,kind:'duel'},commands:unpackCommands(p.c,rs)});}
    catch{throw Error('El enlace del duelo está dañado o incompleto.');}
    if(s.players.length!==1 || s.phase!=='round-end' || s.index!==rs.length-1)throw Error('Tu rival no ha terminado su duelo: pídele que lo termine antes de mandártelo.');
    return {rounds:rs,seed:p.s,score:s.players[0].score,name:String(p.p||'').replace(/[<>\x00-\x1f]/g,'').slice(0,24)};
  }
  function acceptDuel(value=location.href) {
    const url=new URL(value,location.href),encoded=new URLSearchParams(url.hash.slice(1)).get('quick-duel');
    if(!encoded || encoded.length>16000)throw Error('Este enlace no es un duelo de Retos rápidos.');
    const rival=readDuel(encoded);
    format='duel';begin({names:['Tú'],rounds:rival.rounds,kind:'duel',seed:rival.seed,length:rival.rounds.length,rivalScore:rival.score,rivalName:rival.name});
    history.replaceState(null,'',location.pathname+location.search);
  }
  // El duelo de Retos rápidos tiene los mismos dos ritmos que el de las colecciones, y aquí siempre se ordenan
  // cartas: «Partida completa» (juegas tú y mandas un enlace; tu amigo juega cuando pueda) y «Por turnos»
  // (una sala de dos: cada uno juega desde su móvil y la partida se guarda entre turnos).
  const DUEL_PACE='continuum-quick-duel-pace-v1';
  const duelPace=()=>CT.Storage.getItem(DUEL_PACE)==='turnos'?'turnos':'seguidos';
  const soloGlyph=paths=>`<svg class="solo-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const PACE_GLYPH={
    seguidos:'<path d="M7 3h10M7 21h10M8 3v2a4 4 0 0 0 1.6 3.2L12 10l2.4-1.8A4 4 0 0 0 16 5V3M8 21v-2a4 4 0 0 1 1.6-3.2L12 14l2.4 1.8A4 4 0 0 1 16 19v2"/>',
    turnos:'<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    reloj:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };
  function duelSetup() {
    stopNetwork(); page='duel-setup'; format='duel'; netKind='internet'; roomCapacity=2; state=null; record=null; selected=null; slot=null;
    const pace=duelPace(), ownName=esc(CT.Identidad?.propio?.() || '');
    const chip=(n,label)=>`<button type="button" class="quick-length-chip${n===3?' is-selected':''}" role="radio" aria-checked="${n===3}" data-quick="length" data-length="${n}"><b>${n}</b><span>${n===1?'mazo':'mazos'}</span><small>${label}</small></button>`;
    const option=([key,title,foot])=>`<label class="segmented-option${key===pace?' is-on':''}"><input type="radio" name="quick-duel-pace" value="${key}"${key===pace?' checked':''}><i class="duel-option-mark" aria-hidden="true">${soloGlyph(PACE_GLYPH[key])}</i><span><b>${title}</b><small>${foot}</small></span></label>`;
    const block=(key,body)=>`<div data-quick-duel-block="${key}"${key===pace?'':' hidden'}>${body}</div>`;
    shell(`<section class="setup-section solo-home"><div class="solo-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2 class="solo-title" data-focus tabindex="-1">Duelo con un amigo</h2>
        <p class="lead">Los mismos mazos para los dos. Gana quien asegure más aciertos.</p><p class="solo-intro-rule">Ordenas las cartas de mazos sorpresa: arriesga o asegura.</p></div>
      <div class="panel solo-panel">
        <div class="solo-panel-head"><h3>Duelo de Retos rápidos</h3></div>
        <div class="field duel-kind-field"><span class="field-label" id="quick-pace-label">Ritmo del duelo</span>
          <div class="segmented" role="radiogroup" aria-labelledby="quick-pace-label">${[['seguidos','Partida completa','Juegas y esperas al rival'],['turnos','Por turnos','Cada uno desde su móvil']].map(option).join('')}</div></div>
        <div class="field duel-kind-field"><span class="field-label" id="quick-length-label">Mazos</span>
          <div class="quick-length" role="radiogroup" aria-labelledby="quick-length-label">${chip(1,'Duelo rápido')}${chip(3,'Duelo estándar')}${chip(5,'Duelo largo')}</div><input id="quick-free-length" type="hidden" value="3"></div>
        ${block('seguidos',`<div class="duel-brief"><p>Juegas tú ahora y le mandas un enlace a tu amigo: juega los mismos mazos cuando quiera, sin coincidir contigo.</p></div>
          ${button('start-duel','Jugar y retar <span>→</span>','btn btn-primary btn-block')}`)}
        ${block('turnos',`<div class="duel-brief"><p>Jugáis por turnos en una sala de dos, cada uno desde su móvil. Creas la sala y le mandas el código, el enlace o el QR; la partida se guarda entre turnos y podéis volver más tarde.</p></div>
          <div class="field"><label for="quick-net-name">Tu nombre</label><input id="quick-net-name" maxlength="24" value="${ownName}"></div>
          ${button('create-room','Crear sala de duelo <span>→</span>','btn btn-primary btn-block')}
          <details class="duel-join"><summary>Mi amigo ya creó la sala</summary><div class="field"><label for="quick-net-code">Código o enlace de sala</label><textarea id="quick-net-code" rows="2"></textarea></div>
            ${button('scan-code','Escanear código QR','btn btn-secondary btn-block')}${button('join-room','Unirme a la sala <span>→</span>','btn btn-secondary btn-block')}</details>
          ${readJSON(NET)?button('reconnect','Volver a mi sala','btn btn-ghost btn-block'):''}<p id="quick-error" role="alert"></p>`)}
      </div></section>`);
  }
  function networkSetup(kind,capacity=4) {
    roomCapacity=capacity;
    stopNetwork();state=null;record=null;page='network';netKind=kind;
    const net=kind==='internet', ownName=esc(CT.Identidad?.propio?.() || '');
    shell(`<section class="setup-section"><h2 data-focus tabindex="-1">${capacity===2?'Duelo de Retos rápidos':net?'Varios móviles':'Sin conexión'}</h2><p class="lead">${net?'Cread una sala o uníos con su código. También podéis volver más tarde para seguir por turnos.':'Conectad todos los móviles a la misma red Wi-Fi. Quien crea la sala debe mantenerla abierta.'}</p>
      <div class="online-entry-grid">
        <section class="panel online-form"><span class="form-number">01</span><h3>${net?'Entrar en una sala':'Unirme a una sala'}</h3><p>${net?'Usa el código, el enlace o el QR de quien creó la sala.':'Pega la invitación o escanea su código QR.'}</p>
          <div class="field"><label for="quick-net-code">${net?'Código o enlace de sala':'Invitación recibida'}</label><textarea id="quick-net-code" rows="2"></textarea></div>
          <div class="field"><label for="quick-net-name-join">Tu nombre</label><input id="quick-net-name-join" maxlength="24" value="${ownName}"></div>
          ${button('scan-code','Escanear código QR','btn btn-secondary btn-block')}${button('join-room','Unirme a la partida <span>→</span>','btn btn-primary btn-block')}</section>
        <section class="panel online-form"><span class="form-number">02</span><h3>Crear una sala</h3><p>Tú preparas la partida y compartes el código, el enlace o el QR.</p>
          <div class="field"><label for="quick-net-name">Tu nombre</label><input id="quick-net-name" maxlength="24" value="${ownName}"></div>${capacity===2?'':`<div class="field"><label for="quick-net-players">Participantes</label><select id="quick-net-players">${[2,3,4,5,6,7,8].map(n=>`<option value="${n}"${n===capacity?' selected':''}>${n} jugadores</option>`).join('')}</select></div>`}<div class="field"><label for="quick-net-length">Duración de la partida</label><select id="quick-net-length"><option value="1">1 reto · partida rápida</option><option value="3" selected>3 retos · partida estándar</option><option value="5">5 retos · partida larga</option></select></div>
          ${button('create-room','Crear sala','btn btn-secondary btn-block')}</section>
      </div>
      ${net && readJSON(NET) ? button('reconnect','Volver a mi sala','btn btn-secondary btn-block') : ''}
      <p class="hint">El primer turno rota en cada reto para que todos tengan las mismas oportunidades.</p><p id="quick-error" role="alert"></p></section>`);
  }
  function roomChanged(next,id,code) {
    room=CT.QuickRoom.validate(next);myId=id;busy=false;page='network-lobby';
    if(code)CT.Storage.setItem(NET,JSON.stringify({code,name:room.names[room.members.indexOf(id)]}));
    if(room.config){record=CT.QuickRoom.record(room);state=E.restore(record);selected=null;slot=null;render();}
    else lobby(code || connection?.code);
  }
  // Mesa pública de Retos rápidos: la misma sala de espera que en Grandes colecciones.
  // Empieza sola al completarse o, con al menos dos personas, cuando pasan 30 s sin que
  // entre nadie más; se puede dejar de buscar sin dejar la plaza ocupada.
  function publicLobby() {
    clearInterval(publicClock);publicClock=null;
    const count=room.members.length, cap=room.capacity, left=()=>connection?.secondsLeft?.() ?? 30;
    const clock=s=>`0:${String(Math.max(0,s)).padStart(2,'0')}`;
    const status=()=>count<2
      ? `<div class="public-status-title">Buscando jugadores…</div><p>En cuanto entre alguien más, empieza una cuenta atrás de 30 s.</p>`
      : left()===0 || count>=cap ? `<div class="public-status-title">Empezando la partida…</div><p>Preparando los retos.</p>`
      : `<div class="public-status-title">La partida empieza en <b id="quick-public-clock" class="public-clock">${clock(left())}</b></div><p>Puede entrar alguien más (${count} de ${cap}). Si entra, la cuenta vuelve a 30 s.</p>`;
    const seats=Array.from({length:cap},(_,i)=>{
      const name=room.names[i], mine=room.members[i]===myId;
      return name ? `<li class="public-seat${mine?' is-you':''}"><span class="public-seat-avatar">${playerAvatar({name},i)}</span><span class="public-seat-copy"><b>${esc(name)}${mine?' <span class="public-you">tú</span>':''}</b><small>En la mesa</small></span></li>`
        : `<li class="public-seat is-empty"><span class="public-seat-avatar" aria-hidden="true">+</span><span class="public-seat-copy"><b>Plaza libre</b><small>Esperando a alguien…</small></span></li>`;
    }).join('');
    shell(`<section class="setup-section public-lobby"><div class="eyebrow"><span class="eyebrow-line"></span> Mesa pública · hasta ${cap} jugadores</div><h2 data-focus tabindex="-1">Retos rápidos</h2><p class="hint">Tres retos con las mismas cartas para toda la mesa. Arriesga para sumar aciertos o plántate para asegurarlos.</p>
      <div class="panel public-status" role="status" aria-live="polite">${status()}</div>
      <div class="panel public-roster"><div class="section-label">Jugadores <small>${count}/${cap}</small></div><ul class="public-seats">${seats}</ul></div>
      ${button('leave-public','Dejar de buscar','btn btn-ghost btn-block')}<p id="quick-error" role="alert"></p></section>`);
    publicClock=setInterval(()=>{const el=document.getElementById('quick-public-clock');if(!el||page!=='network-lobby'){if(!el)clearInterval(publicClock);return;}const s=left();el.textContent=clock(s);el.classList.toggle('is-low',s<=5);},500);
  }
  // Sala privada: la misma mesa de exploradores que en Grandes colecciones, con las plazas
  // repartidas alrededor según cuántos caben.
  const SEAT_SLOTS={2:[7,2],3:[0,3,6],4:[0,2,5,7],5:[0,2,3,6,7],6:[1,2,3,6,7,8],7:[0,1,2,3,6,7,8],8:[1,2,3,4,5,6,7,8]};
  function lobby(code) {
    if(room.matchmaking==='public'){state=null;publicLobby();return;}
    clearInterval(publicClock);publicClock=null;
    state=null;const host=myId===room.host, cap=room.capacity, count=room.members.length;
    const slots=SEAT_SLOTS[cap]||SEAT_SLOTS[8], table=Array(9).fill('<div class="table-seat is-unused" aria-hidden="true"></div>');
    slots.forEach((slot,i)=>{
      const name=room.names[i], mine=room.members[i]===myId;
      table[slot]=name
        ? `<div class="table-seat occupied${mine?' is-you':''}"><span class="seat-avatar">${CT.Avatares.markup(name,mine?{size:44,seed:CT.Avatares.ownSeed(),id:CT.Avatares.ownId()}:{size:44,seed:'room:'+room.members[i]})}</span><strong>${esc(name)}${mine?' · tú':''}</strong><small>${room.members[i]===room.host?'Anfitrión':`Plaza ${i+1}`}</small><i class="ready-seal">Listo</i></div>`
        : `<div class="table-seat empty" aria-label="Plaza ${i+1} libre"><span>+</span><small>Libre</small></div>`;
    });
    const length=roomLength||3;
    const side=host
      ? `<div class="section-label">Partida</div><p>${length} ${length===1?'reto':'retos'} con las mismas cartas para toda la mesa. El primer turno rota en cada reto.</p>
        ${count<2?'<div class="waiting-orbit"><span></span></div><p class="hint">Esperando a alguien más…</p>':''}
        ${button('start-room','Sortear y empezar <span>→</span>','btn btn-primary btn-block')}
        ${connection?.kind==='local'?button('invite-peer','Invitar otro móvil','btn btn-secondary btn-block'):''}`
      : `<div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>La partida comenzará en todos los móviles al mismo tiempo.</p>`;
    shell(`<section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Sala de espera · Retos rápidos</div><h2 data-focus tabindex="-1">Preparando la mesa</h2></div>
      <div class="room-code-card"><small>${code?'Código de sala':'Red Wi-Fi local'}</small><strong>${code?esc(code):count+'/'+cap}</strong>${code?`<div class="room-invite-actions"><button data-quick="share-room">Compartir enlace</button><button data-quick="qr-room">Mostrar QR</button></div>`:''}</div></section>
      <div class="online-lobby-grid"><section class="panel lobby-table-panel"><div class="section-label">Mesa de exploradores <small>${count}/${cap}</small></div><div class="lobby-table"><div class="lobby-table-core"><span>CONTINUUM</span><strong>${count}</strong><small>${count===1?'explorador':'exploradores'}</small></div>${table.join('')}</div><p class="lobby-ready-note"><i>Listo</i> La plaza queda preparada al entrar en la sala.</p></section>
        <section class="panel lobby-settings">${side}<p id="quick-error" role="alert"></p></section></div>`);
    const start=app().querySelector('[data-quick="start-room"]');if(start)start.disabled=count<2;
  }
  async function connectRoom(create) {
    const nameInput=app().querySelector(create?'#quick-net-name':'#quick-net-name-join') || app().querySelector('#quick-net-name'), name=nameInput.value.trim();if(!name)throw Error('Escribe tu nombre.');
    if (create) roomCapacity = Number(app().querySelector('#quick-net-players')?.value) || roomCapacity;
    // La duración que se eligió al crear la sala; en la sala ya no hay desplegable, y sin esto siempre eran 3 retos.
    if (create) roomLength = Number(app().querySelector('#quick-net-length')?.value || app().querySelector('#quick-free-length')?.value) || 3;
    let code=app().querySelector('#quick-net-code').value.trim();
    const epoch=networkEpoch, change=(...args)=>{if(epoch===networkEpoch)roomChanged(...args);}, fail=e=>{if(epoch===networkEpoch)errorNotice(e);};
    if(netKind==='internet') {
      code=roomCodeFromText(code);
      const opened=await CT.QuickNetwork.internet({create,code,name,capacity:roomCapacity,onChange:change,onError:fail});
      if(epoch!==networkEpoch){opened.close();return;}connection=opened;
    } else if(create) connection=CT.QuickNetwork.localHost(name,change,fail,roomCapacity);
    else {
      connection=CT.QuickNetwork.localGuest(code,name,change,fail);
      const answer=await connection.answer();if(epoch!==networkEpoch)return;
      shell(`<section class="setup-section"><h2 data-focus tabindex="-1">Devuelve esta respuesta</h2><div class="panel"><p>Compártela con quien creó la sala para completar la conexión.</p><div class="field"><textarea id="quick-signal" readonly rows="4">${esc(answer)}</textarea></div>${button('share-signal','Compartir respuesta','btn btn-primary btn-block')}${button('qr-signal','Mostrar QR de la respuesta','btn btn-secondary btn-block')}<p>La sala aparecerá al conectar. Si no conecta, comprobad que estáis en la misma red Wi-Fi.</p><p id="quick-error" role="alert"></p></div></section>`);
    }
  }
  async function networkAction(action) {
    if(busy)return;busy=true;
    try{await connection.act(action);}catch(e){errorNotice(e);}
    finally{busy=false;}
  }
  // Muestra el QR; si el texto no cabe en un código, lo dice en vez de dejar la pantalla igual.
  function showQrOrExplain(options) {
    if(!CT.LocalShare.showQr(options))throw Error('Este contenido es demasiado largo para un código QR. Usa «Compartir».');
  }
  // Abre la cámara y, al leer un código, sigue con `next`. Sin cámara lo explica.
  // Enlace de invitación: en la app nativa location.href es capacitor://localhost, inútil para otro móvil.
  function roomUrl(code){const url=new URL(CT.Links?.base?.()||location.origin+location.pathname);url.search='';url.hash='quick-room='+code;return url;}
  // Vale el enlace (con #quick-room=, ?quick-room= o cualquier texto con el código) o el código suelto.
  function roomCodeFromText(text){
    const raw=String(text||'').trim();
    try{const url=new URL(raw);const found=new URLSearchParams(url.hash.slice(1)).get('quick-room')||url.searchParams.get('quick-room');if(found)return found.trim();}catch{}
    const match=raw.match(/quick-room=([^&#\s]+)/);
    return match?decodeURIComponent(match[1]):raw;
  }
  async function scanQrInto(title,hint,next) {
    if(!CT.QrScanner?.isSupported())throw Error('Este navegador no permite usar la cámara aquí.');
    await CT.LocalShare.scanQr({title,hint,onText:text=>{Promise.resolve(next(text)).catch(errorNotice);}});
  }
  async function formatAction(action) {
    if(action==='formats'){toEntry();return true;}
    if(action==='leave-public'){const leaving=connection;connection=null;clearInterval(publicClock);await leaving?.leave?.();toEntry();return true;}
    if(action==='share-duel'){await CT.LocalShare.shareSignal(duelLink());return true;}
    if(action==='create-room'||action==='join-room'){await connectRoom(action==='create-room');return true;}
    if(action==='start-room'){const count=Number(app().querySelector('#quick-net-length')?.value)||roomLength||3;await networkAction({type:'start',rounds:rounds(count),kind:roomCapacity===2?'duel':'network',historyId:historyId()});return true;}
    if(action==='share-room'){const url=roomUrl(connection.code);await CT.LocalShare.shareSignal(url.href);return true;}
    if(action==='qr-room'){const url=roomUrl(connection.code);showQrOrExplain({eyebrow:'Sala de Retos rápidos',title:'Escanea para entrar',text:url.href,code:connection.code,hint:'Abre la cámara del otro móvil y apunta al código.'});return true;}
    if(action==='qr-signal'){showQrOrExplain({eyebrow:'Conexión sin internet',title:'Enséñalo al otro móvil',text:app().querySelector('#quick-signal').value,hint:'El otro móvil lo lee con «Escanear QR».'});return true;}
    if(action==='scan-code'){await scanQrInto('Escanear QR de la sala','Encuadra el código QR de la sala o de la invitación.',text=>{
      const code=app().querySelector('#quick-net-code');code.value=roomCodeFromText(text);
      const name=app().querySelector('#quick-net-name-join');
      if(name&&!name.value.trim()){code.closest('details')?.setAttribute('open','');name.focus();throw Error('Sala leída. Escribe tu nombre y pulsa «Unirme».');}
      return formatAction('join-room');});return true;}
    if(action==='scan-answer'){await scanQrInto('Escanear QR de la respuesta','Encuadra el código QR que enseña el otro móvil.',text=>{app().querySelector('#quick-answer').value=text;return formatAction('accept-answer');});return true;}
    if(action==='share-signal'){await CT.LocalShare.shareSignal(app().querySelector('#quick-signal').value);return true;}
    if(action==='invite-peer'){
      invite=await connection.invite();
      shell(`<section class="setup-section"><h2>Invita otro móvil</h2><div class="panel"><p>Comparte esta invitación. El otro móvil la pega en «Unirme a la sala» y te devuelve su respuesta.</p><div class="field"><textarea id="quick-signal" readonly rows="3">${esc(invite.signal)}</textarea></div>${button('share-signal','Compartir invitación','btn btn-primary btn-block')}${button('qr-signal','Mostrar QR de la invitación','btn btn-secondary btn-block')}<div class="field"><label for="quick-answer">Respuesta del otro móvil</label><textarea id="quick-answer" rows="3"></textarea></div>${button('scan-answer','Escanear QR de la respuesta','btn btn-secondary btn-block')}${button('accept-answer','Conectar','btn btn-secondary btn-block')}<p id="quick-error" role="alert"></p></div></section>`);return true;
    }
    if(action==='accept-answer'){await invite.accept(app().querySelector('#quick-answer').value.trim());lobby();return true;}
    if(action==='reconnect') {const saved=readJSON(NET);if(!saved)throw Error('No hay ninguna sala guardada.');networkSetup('internet');app().querySelector('#quick-net-name').value=saved.name;app().querySelector('#quick-net-name-join').value=saved.name;app().querySelector('#quick-net-code').value=saved.code;await connectRoom(false);return true;}
    return false;
  }

  // Minijuego de «quién empieza» (un solo móvil): el orden resultante pasa a ser el orden de los nombres.
  let starter = null, starterDraw = null;
  const starterClose = () => {app().querySelector('[data-quick-starter]')?.remove(); starterDraw = null;};
  function starterPaint(html) {
    let layer = app().querySelector('[data-quick-starter]');
    if (layer) {layer.querySelector('.modal').innerHTML = html; return;}
    layer = document.createElement('div'); layer.className = 'overlay'; layer.dataset.quickStarter = '';
    layer.innerHTML = `<div class="modal">${html}</div>`; app().append(layer); CT.openDialog(layer, true);
  }
  function starterFieldMarkup(names) {
    if (starter && starter.key === names.join('|')) {
      const order = starter.order.map(i => esc(names[i])).join(' → ');
      return `<span class="field-label">Quién empieza</span><p class="starter-result"><strong>${esc(names[starter.order[0]])}</strong> ha acertado más cerca y empieza.</p><p class="hint">Orden de juego: ${order}</p><button type="button" class="btn btn-ghost" data-quick="draw-starter">Repetir el minijuego</button>`;
    }
    return `<span class="field-label">Quién empieza</span><button type="button" class="btn btn-block starter-draw-cta" data-quick="draw-starter"><span class="starter-draw-icon" aria-hidden="true">🂠</span><span class="starter-draw-copy"><b>Adivinar la cifra</b><small>Cada uno prueba con una carta y gana quien más se acerque</small></span><span class="starter-draw-arrow" aria-hidden="true">→</span></button>`;
  }
  const quickNames = () => [...app().querySelectorAll('[data-quick-name]')].map(el => el.value.trim());
  function refreshStarterField() {const box = app().querySelector('.quick-starter-field'); if (box) box.innerHTML = starterFieldMarkup(quickNames());}
  function beginStarter(names) {
    const modeKey = CT.shuffle(CT.Tournament.modes())[0];
    const card = CT.shuffle(CT.cards(modeKey))[0];
    starterDraw = {names, modeKey, card, step: 0, guesses: []};
    starterAsk();
  }
  function starterAsk() {
    const {modeKey, card, names, step} = starterDraw, regla = CT.axis(modeKey).cifra || {};
    starterPaint(`<h2 data-dialog-focus tabindex="-1">Pasa el móvil a ${esc(names[step])}</h2><div class="cifra-card starter-card"><strong>${esc(card.title)}</strong><span>${esc(regla.pregunta || '')}</span></div>
      <div class="field cifra-field"><label for="quick-starter-input">Tu respuesta${regla.unidad ? ` <span class="cifra-unidad">(en ${esc(regla.unidad)})</span>` : ''}</label><input id="quick-starter-input" type="text" inputmode="${regla.decimales ? 'decimal' : 'numeric'}" autocomplete="off" enterkeyhint="send"><p class="hint">${esc(regla.pista || '')}</p></div>
      <div class="actions"><button class="btn btn-primary btn-block" data-quick="starter-guess">Adivinar <span>→</span></button><button class="btn btn-ghost btn-block" data-quick="starter-back">Volver a la preparación</button></div>`);
    const field = app().querySelector('#quick-starter-input');
    field?.addEventListener('keydown', e => {if (e.key === 'Enter') {e.preventDefault(); starterGuess();}});
  }
  function starterGuess() {
    const field = app().querySelector('#quick-starter-input'), value = CT.Duelo.Cifras.leer(starterDraw.modeKey, field ? field.value : '');
    if (value === null) {field?.setAttribute('aria-invalid','true'); field?.focus(); return;}
    starterDraw.guesses.push(value); starterDraw.step++;
    if (starterDraw.step < starterDraw.names.length) {starterAsk(); return;}
    const {modeKey, card, names, guesses} = starterDraw;
    const order = CT.Starter.order(modeKey, card.id, guesses.map((v, id) => ({id, value: v})));
    starter = {key: names.join('|'), order}; refreshStarterField();
    starterPaint(`<h2>¿Quién empieza?</h2><div class="starter-winner-banner"><b>${esc(names[order[0]])}</b><span>Empieza la partida</span></div>
      <div class="cifra-card starter-card"><strong>${esc(card.title)}</strong><span>El valor real era ${esc(CT.formatValue(modeKey, card))}</span></div>
      <ol class="starter-draw-list">${order.map((i, n) => `<li${n === 0 ? ' class="starter-draw-winner"' : ''}><span>${n + 1}.º ${esc(names[i])}</span><span>${esc(CT.Duelo.Cifras.formato(modeKey, guesses[i]))}</span></li>`).join('')}</ol>
      <div class="actions"><button class="btn btn-primary btn-block" data-quick="starter-go">Barajar y empezar <span>→</span></button></div>`);
  }
  const button = (action, text, cls = 'btn btn-primary') => `<button class="${cls}" data-quick="${action}">${text}</button>`;
  function setup() {
    stopNetwork();page="setup";const solo=format!=="local";
    state = null; record = null; selected = null; slot = null;
    const saved = load();
    shell(`<section class="setup-section"><h2 data-focus tabindex="-1">Retos rápidos</h2><p class="lead">${solo ? "Juega a tu ritmo y asegura tus aciertos antes de fallar." : "De 2 a 8 jugadores o equipos en un solo móvil."}</p><div class="panel">
      <div class="setup-block"><div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Jugadores</span></div>
      <div id="quick-names">${nameFields(solo ? 1 : 2, solo ? ["Tú"] : [CT.Identidad?.propio?.() || "Jugador 1"])}</div>
      ${solo ? '' : button('add-player', '＋ Añadir participante', 'btn btn-ghost')}</div>
      <div class="setup-block"><div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Cómo empezar</span></div>
      <div class="setup-grid">${solo ? '' : `<div class="field starter-field quick-starter-field">${starterFieldMarkup(['Jugador 1','Jugador 2'])}</div>`}<div class="field"><label for="quick-length">Duración de la partida</label><select id="quick-length"><option value="1">1 reto · partida rápida</option><option value="3" selected>3 retos · partida estándar</option><option value="5">5 retos · partida larga</option><option value="10">10 retos · maratón</option><option value="15">15 retos · gran maratón</option><option value="20">20 retos · resistencia</option><option value="${CT.QuickCatalog.challenges.length}">Todos los mazos · ${CT.QuickCatalog.challenges.length} retos</option></select></div></div>
      <p class="hint">${solo ? "Puedes plantarte para asegurar los aciertos del reto." : "Empieza quien gane el minijuego; el primer turno rota en cada reto."}</p></div>
      ${button('start', 'Barajar y empezar <span>→</span>', 'btn btn-primary btn-block')}
      ${saved ? button('resume', 'Continuar partida guardada', 'btn btn-secondary btn-block') : ''}
      <p id="quick-error" role="alert">${esc(error)}</p></div></section>
      <details class="panel quick-panel"><summary>Cómo se juega</summary><ol><li>Una carta revelada inicia la línea, sin contar como acierto.</li><li>Elige una de las cartas comunes y toca un hueco. Confirma para revelar el dato.</li><li>Acertar suma un acierto provisional y pasa el turno.</li><li>En tu siguiente turno puedes plantarte: aseguras tus aciertos y sales de este reto.</li><li>Fallar pierde tus aciertos de este reto y te retira. Los de retos anteriores se conservan.</li><li>Al agotarse las cartas, los aciertos pendientes se aseguran. El reto también termina si nadie sigue activo.</li></ol><p>La carta fallada queda corregida en la línea. Si queda una sola persona, puede seguir arriesgando. Los empates de valor admiten cualquier orden equivalente. Gana quien asegura más aciertos; un empate final se comparte.</p></details>`);
    if (!solo) {refreshStarterField(); app().querySelector('#quick-names')?.addEventListener('input', () => {if (starter && starter.key !== quickNames().join('|')) {starter = null;} refreshStarterField();});}
  }
  function nameFields(count, names = []) {
    return Array.from({length: count}, (_, i) => `<div class="player-row"><input id="quick-name-${i}" data-quick-name aria-label="Nombre del jugador o equipo ${i + 1}" maxlength="24" value="${esc(names[i] ?? `Jugador ${i + 1}`)}" autocomplete="off"><button class="remove" data-quick="remove-player" data-index="${i}" aria-label="Quitar jugador ${i + 1}" ${count <= 2 ? 'disabled' : ''}>×</button></div>`).join('');
  }
  function save() {
    if(room)return;
    CT.Storage.setItem(KEY, JSON.stringify(record));
    if(record.config.kind==='free' && state.phase==='round-end' && state.index===record.config.rounds.length-1)CT.Storage.setItem(BEST,JSON.stringify(Math.max(Number(readJSON(BEST,0))||0,state.players[0].score)));
  }
  function dispatch(command) {
    if(room){if(myTurn())void networkAction(command);return;}
    state = E.step(state, command);
    if (command.type === 'place') CT.Effects?.feedback(state.result.correct);
    record.commands.push(command); save(); selected = null; slot = null; render();
  }
  function scores() {
    return `<div class="scoreboard" aria-label="Marcador">${state.players.map((p, i) => `<span class="score ${i === state.current ? 'active' : ''}" aria-label="${esc(p.name)}: ${p.score} asegurados, ${p.points} en juego. ${p.status === 'failed' ? 'Fuera de este reto' : p.status === 'banked' ? 'Se ha plantado' : 'Sigue jugando'}"><i class="score-avatar">${playerAvatar(p, i)}</i><b>${esc(p.name)}</b><em>${p.score}${p.points ? ` +${p.points}` : ''}${p.status !== 'active' ? ' ·' : ''}</em></span>`).join('')}</div>`;
  }
  // En solitario la única persona eres tú (se llama «Tú», no por tu nombre); en una sala,
  // el sitio que ocupa tu identificador. Los demás se reconocen por su nombre o su plaza.
  function playerAvatar(p, i) {
    const mine = room ? room.members?.[i] === myId : state.players.length === 1;
    if (mine) return CT.Avatares.markup(p.name, {size:28, seed:CT.Avatares.ownSeed(), id:CT.Avatares.ownId()});
    return CT.Avatares.markup(p.name, room?.members?.[i] ? {size:28, seed:'room:'+room.members[i]} : {size:28});
  }
  // Qué significa cada extremo de la línea, según la naturaleza de cada mazo.
  const ENDS = {
    'sports-players': ['Menos jugadores', 'Más jugadores'], drinks: ['Menos alcohol', 'Más alcohol'],
    festivities: ['Primera fecha', 'Última fecha'], social: ['Más antigua', 'Más reciente'],
    wwii: ['Más antiguo', 'Más reciente'], 'civil-war': ['Más antiguo', 'Más reciente'],
    kings: ['Reinado más antiguo', 'Reinado más reciente'], consoles: ['Más antigua', 'Más reciente'],
    oscars: ['Más premios', 'Menos premios'], 'companies-founded': ['Más antigua', 'Más reciente'],
    'timezones-june': ['Más por detrás', 'Más por delante'], 'cities-east-west': ['Oeste', 'Este'],
    'cities-north-south': ['Norte', 'Sur'], body: ['Arriba', 'Abajo'],
    'series-seasons': ['Menos temporadas', 'Más temporadas'], buildings: ['Más bajo', 'Más alto'],
    'rivers-spain': ['Más corto', 'Más largo'], 'foods-kcal': ['Menos kcal', 'Más kcal'],
    'albums-sales': ['Menos ventas', 'Más ventas'], stadiums: ['Menor aforo', 'Mayor aforo'],
    'capitals-altitude': ['Menor altitud', 'Mayor altitud'], 'eurovision-wins': ['Menos victorias', 'Más victorias'],
    storage: ['Menor capacidad', 'Mayor capacidad'], airports: ['Menos pasajeros', 'Más pasajeros'],
    metros: ['Red más corta', 'Red más larga'], 'companies-revenue': ['Menos facturación', 'Más facturación'],
    'spanish-tv': ['Menos años', 'Más años'], 'minimum-wages': ['Menor salario', 'Mayor salario'],
    poker: ['Más débil', 'Más fuerte']
  };
  function timelineEnds(c) {
    const m = /^De (.+?) a (.+)$/.exec(c.rule || '');
    const [left, right] = ENDS[c.id] || (m ? [m[1], m[2]] : ['Primero', 'Último']);
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    return `<div class="timeline-ends" aria-hidden="true"><span>← ${esc(cap(left))}</span><span>${esc(cap(right))} →</span></div>`;
  }
  function cardMarkup(c, item) {
    return `<article class="timeline-card card-flippable animal-timeline-card" data-id="${item.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(item.title)}. Toca para ver la explicación."><div class="card-category">${esc(c.title)}</div><div class="card-visual"><img class="animal-card-art" src="${esc(item.image || 'assets/hero-quick-400.webp')}" alt="" width="400" height="600"></div><div class="card-content"><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><div class="year">${esc(item.label)}</div></div></article>`;
  }
  // Lo que pasa tras colocar una carta, dicho a quien juega solo («Pierdes 2 aciertos…») o a una mesa
  // («Ana pierde 2 aciertos…»). Con 0 aciertos provisionales no hay nada que «perder»: se dice tal cual.
  function resultNote(r, p) {
    const solo = !room && state.players.length === 1, name = esc(p.name);
    const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
    if (r.correct) return solo ? `Tienes ${n(p.points, 'acierto provisional', 'aciertos provisionales')}.` : `${name} tiene ${n(p.points, 'acierto provisional', 'aciertos provisionales')}.`;
    const fuera = 'La carta ya está en su lugar correcto.';
    if (r.lost > 0) return solo ? `Pierdes ${n(r.lost, 'acierto', 'aciertos')} de este reto y quedas fuera hasta el siguiente. ${fuera}` : `${name} pierde ${n(r.lost, 'acierto', 'aciertos')} de este reto y queda fuera hasta el siguiente. ${fuera}`;
    return solo ? `No tenías aciertos provisionales que perder, pero quedas fuera de este reto hasta el siguiente. ${fuera}` : `${name} no tenía aciertos provisionales, pero queda fuera de este reto hasta el siguiente. ${fuera}`;
  }
  // Qué partida y qué reto se han pintado ya: al pasar al siguiente reto se enseña su portada, igual que al
  // empezar, en vez de soltar directamente las cartas. Reanudar una partida no la vuelve a enseñar.
  let shownGame = null, shownIndex = 0;
  function render() {
    page="game";
    const nextDeck = state.phase === 'turn' && shownGame === (state.config.historyId || 'sin-id') && state.index > shownIndex;
    shownGame = state.config.historyId || 'sin-id'; shownIndex = state.index;
    if (nextDeck) { const config = state.config, index = state.index; setTimeout(() => { if (state && state.index === index && page === 'game') deckSplash(config, index); }, 0); }
    saveHistory();
    const c = E.challenge(state.config.rounds[state.index].id), p = state.players[state.current];
    const get = id => c.cards.find(item => item.id === id);
    topTitle = `${state.config.rounds.length === 1 ? '' : `${state.index + 1}/${state.config.rounds.length} · `}${esc(c.title)}`;
    const pass = `<button class="quick-pass" data-quick="bank" aria-label="${p.points ? `Plantarse y asegurar ${p.points} ${p.points === 1 ? 'acierto' : 'aciertos'}` : 'Pasar este reto'}">${p.points ? `Asegurar ${p.points} pts` : 'Pasar reto'}</button>`;
    const heading = `${room ? `<p class="hint">${myTurn() ? "Tu turno" : `Turno de ${esc(p.name)}`} · ${connection?.kind==='local' ? 'Red Wi-Fi local' : 'Sala por internet'}</p>` : ''}<h1 class="solo-lectores" data-focus tabindex="-1">${esc(c.title)}${!room && state.players.length === 1 ? '' : ` · Turno de ${esc(p.name)}`}</h1><div class="quick-bar"><span class="quick-left"><b>${state.remaining.length}</b> por colocar</span><div class="quick-right">${state.phase === 'turn' && myTurn() ? pass : ''}${scores()}</div></div>`;
    if (state.phase === 'round-end') {
      const final = state.index + 1 === state.config.rounds.length;
      const best = Math.max(...state.players.map(player => player.score));
      const winners = state.players.filter(player => player.score === best).map(player => esc(player.name));
      const duelo = final && !room && record.config.kind==='duel' && Number.isFinite(record.config.rivalScore);
      shell(`${heading}<section class="panel quick-panel"><h2>${final ? duelo ? (best>record.config.rivalScore ? '¡Has ganado el duelo!' : best===record.config.rivalScore ? 'Empate' : `${esc(record.config.rivalName||'Tu rival')} gana`) : state.players.length===1 ? 'Tu resultado' : winners.length > 1 ? 'Victoria compartida' : `Gana ${winners[0]}` : 'Reto terminado'}</h2>
        ${final ? `<p>${winners.join(' y ')} · ${best} ${best === 1 ? 'acierto' : 'aciertos'}.</p>` : '<p>Los aciertos de este reto ya están asegurados.</p>'}
        <ul>${state.players.map(player => `<li>${esc(player.name)}: ${player.roundScore} ${player.roundScore === 1 ? 'acierto' : 'aciertos'} en este reto.</li>`).join('')}</ul>
        ${final && Number.isFinite(record.config.rivalScore) ? `<p>${esc(record.config.rivalName||'Tu rival')}: ${record.config.rivalScore} ${record.config.rivalScore===1?'acierto':'aciertos'}. Tú: ${best}. ${best > record.config.rivalScore ? '¡Has superado su resultado!' : best === record.config.rivalScore ? 'Habéis empatado.' : 'Ha asegurado más aciertos.'}</p>` : ''}
        ${final ? (record.config.kind==='duel' && !room ? '' : button('formats', 'Elegir otra partida')) : button('next', 'Siguiente reto')}
        ${final && record.config.kind==='duel' && !room ? button('share-duel', Number.isFinite(record.config.rivalScore) ? 'Devolver el reto' : 'Retar a un amigo', 'btn btn-primary btn-block') + `<div class="field"><label for="quick-result-link">Enlace del duelo</label><input id="quick-result-link" readonly value="${esc(duelLink())}"></div><p class="hint">${Number.isFinite(record.config.rivalScore) ? 'Tu amigo jugará los mismos mazos y tendrá que superar tu resultado.' : 'Tu amigo juega los mismos mazos cuando quiera y ve quién ha ganado.'}</p>` : ''}
        ${final && record.config.kind==='duel' && !room ? button('rematch', 'Crear un duelo nuevo', 'btn btn-secondary btn-block') : ''}
        ${final && record.config.kind==='daily' && CT.Accounts?.ready ? '<button class="btn btn-secondary" data-account-action="ranking">Ver ranking</button>' : ''}
        <button class="btn btn-secondary" data-action="home">Guardar y volver al inicio</button>${button('abandon','Salir sin guardar','btn btn-ghost exit-discard')}</section>
        <details class="panel quick-panel"><summary>Ver el orden completo y las fuentes</summary><ol>${[...c.cards].sort((a, b) => (a.value - b.value) * c.direction).map(item => `<li><strong>${esc(item.title)} · ${esc(item.label)}</strong><p>${esc(item.detail)} <a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Fuente</a></p></li>`).join('')}</ol></details>`);
      return;
    }
    if (state.phase === 'result') {
      const r = state.result, item = get(r.cardId);
      if(room && !myTurn()){shell(`${heading}${CT.timelineMap(null,state.timeline)}<div class="timeline-wrap"><div class="timeline">${state.timeline.map(id=>cardMarkup(c,get(id))).join('')}</div></div><section class="panel quick-panel"><h2>${r.correct?'¡Bien colocado!':'No encaja ahí'}</h2><p>${esc(item.title)} · ${esc(item.label)}</p><p>Esperando a que continúe ${esc(p.name)}.</p></section>`);return;}
      shell(`${heading}${CT.timelineMap(null, state.timeline)}<div class="timeline-wrap"><div class="timeline">${state.timeline.map(id => cardMarkup(c, get(id))).join('')}</div></div><div class="overlay" data-quick-result><section class="modal quick-result ${r.correct ? 'success' : 'failure'}"><div class="result-mark" aria-hidden="true">${r.correct ? '✓' : '×'}</div><h2>${r.correct ? '¡Bien colocado!' : 'No encaja ahí'}</h2><h3>${esc(item.title)}</h3><div class="reveal"><div class="year">${esc(item.label)}</div><p>${esc(item.detail)}</p></div><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a>
        <p class="quick-result-note">${resultNote(r, p)}</p>
        ${button('ack', 'Continuar', 'btn btn-primary btn-block')}${room ? button('exit','Salir de la sala','btn btn-ghost btn-block') : ''}</section></div>`);
      CT.openDialog(app().querySelector('[data-quick-result]'), false);
      return;
    }
    const gap = i => slot === i && selected ? `<div class="slot-confirm quick-confirm provisional-placement" data-index="${i}"><div class="slot-confirm-card"><small>Vista previa · sin confirmar</small><strong>${esc(get(selected).title)}</strong><span aria-hidden="true">Valor oculto</span></div>${button('confirm', 'Sí, aquí', 'btn btn-primary btn-block')}${button('cancel', 'Cancelar', 'btn btn-ghost btn-block')}</div>` : `<button class="slot" data-quick="slot" data-index="${i}" ${selected ? '' : 'disabled'} aria-label="${esc(i === 0 ? `Colocar antes de ${get(state.timeline[0]).title}` : i === state.timeline.length ? `Colocar después de ${get(state.timeline[i-1]).title}` : `Colocar entre ${get(state.timeline[i-1]).title} y ${get(state.timeline[i]).title}`)}"><span>+</span></button>`;
    shell(`${heading}<section><h3 class="solo-lectores">Cartas comunes</h3><div class="hand">${state.remaining.filter(id => !(slot !== null && selected === id)).map(id => `<button class="hand-card${selected === id ? ' selected' : ''}" data-quick="select" data-id="${id}" aria-pressed="${selected === id}"><span class="hidden-date">Valor oculto</span>${CT.cardBack('quick')}<strong>${esc(get(id).title)}</strong><span class="card-arrow">→</span></button>`).join('')}</div>
      <p class="hint">${selected ? 'Toca un hueco y confirma, o arrastra la carta hasta su lugar.' : 'Toca una carta o mantenla pulsada para arrastrarla hasta un hueco.'}</p></section>
      <section class="board-timeline-section"><div class="hand-title"><h3>Línea de cartas</h3></div>${timelineEnds(c)}${CT.timelineMap(null, state.timeline)}
      <div class="timeline-wrap"><div class="timeline" aria-label="Línea de cartas: orden de izquierda a derecha">${state.timeline.map((id, i) => gap(i) + cardMarkup(c, get(id))).join('')}${gap(state.timeline.length)}</div></div></section>`);
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
  function abandonQuick() {
    const hadRoom=!!room;
    stopNetwork();
    CT.Storage.removeItem(KEY);
    if (hadRoom) CT.Storage.removeItem(NET);
    pendingConfig=null; state=null; record=null; selected=null; slot=null;
    toEntry();
  }
  // Vuelve a la pantalla por la que se entró en Retos rápidos. El reto del día y la mesa
  // pública no tienen una propia: se sale a la pantalla anterior del juego.
  function toEntry() {
    if (entry === 'free-setup') freeSetup();
    else if (entry === 'duel-setup') duelSetup();
    else {stopNetwork();pendingConfig=null;state=null;record=null;selected=null;slot=null;CT.navigateBack?.();}
  }
  function menu() {
    const c = E.challenge(state.config.rounds[state.index].id);
    const layer = document.createElement('div'); layer.className = 'overlay';
    layer.innerHTML = `<div class="modal"><h2>Retos rápidos</h2><p>${esc(c.rule)}. ${esc(c.context)}${c.asOf ? ` Datos a ${esc(c.asOf)}.` : ''}</p><p>Acertar suma un acierto provisional. Plantarse lo asegura; fallar pierde los aciertos de este reto y te retira. Los aciertos anteriores se conservan.</p><div class="actions exit-actions">${button('close-menu', 'Seguir jugando', 'btn btn-primary btn-block')}${button('guide', 'Guía', 'btn btn-secondary btn-block')}<button class="btn btn-secondary btn-block" data-settings-action="open">Ajustes</button>${button('formats', 'Guardar y salir', 'btn btn-secondary btn-block')}${button('abandon', 'Salir sin guardar', 'btn btn-ghost btn-block exit-discard')}</div></div>`;
    app().append(layer); CT.openDialog(layer, true);
  }
  document.addEventListener('change', event => {
    if (event.target.name === 'quick-duel-pace' && app().querySelector('[data-quick-duel-block]')) {
      // Cambiar de ritmo no repinta: se enseña un bloque y se esconde el otro, como en el duelo de las colecciones.
      const pace = event.target.value === 'turnos' ? 'turnos' : 'seguidos';
      CT.Storage.setItem(DUEL_PACE, pace);
      app().querySelectorAll('[data-quick-duel-block]').forEach(b => { b.hidden = b.dataset.quickDuelBlock !== pace; });
      app().querySelectorAll('.segmented-option').forEach(o => o.classList.toggle('is-on', o.querySelector('input').checked));
      return;
    }
    if (!app().querySelector('.quick-shell')) return;
    if (event.target.id === 'quick-net-length') app().querySelector('#quick-net-choice-wrap')?.setAttribute('hidden','');
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-quick]');
    if (!target || !app().contains(target) || !paint) return;
    const action = target.dataset.quick;
    const formatActions=['formats','leave-public','share-duel','create-room','join-room','start-room','share-room','qr-room','qr-signal','scan-code','scan-answer','share-signal','invite-peer','accept-answer','reconnect'];
    if(formatActions.includes(action)){target.disabled=true;Promise.resolve(formatAction(action)).catch(errorNotice).finally(()=>{if(target.isConnected)target.disabled=false;});return;}
    if (action === 'add-player' || action === 'remove-player') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value);
      if (action === 'add-player' && names.length < 8) names.push(`Jugador ${names.length + 1}`);
      else if (action === 'remove-player' && names.length > 2) names.splice(Number(target.dataset.index), 1);
      app().querySelector('#quick-names').innerHTML = nameFields(names.length, names);
      app().querySelector('[data-quick="add-player"]').disabled = names.length >= 8;
      refreshStarterField();
      app().querySelector(`#quick-name-${names.length - 1}`)?.focus(); return;
    }
    if (action === 'menu') {menu(); return;}
    if (action === 'close-menu') {CT.closeDialog(); return;}
    if (action === 'guide') {guide(); return;}
    if (action === 'stats') {statsPanel(); return;}
    if (action === 'rematch') {entry='duel-setup'; duelSetup(); return;}
    if (action === 'ready') { if (pendingConfig) begin(pendingConfig); return; }
    if (action === 'length') {
      app().querySelectorAll('.quick-length-chip').forEach(chip => {const on = chip === target; chip.classList.toggle('is-selected', on); chip.setAttribute('aria-checked', String(on));});
      const input = app().querySelector('#quick-free-length'); if (input) input.value = target.dataset.length; return;
    }
    if (action === 'start-duel') {
      const count=Number(app().querySelector('#quick-free-length')?.value) || 3, seed=historyId();
      prepare({names:['Tú'],rounds:rounds(count,null,seed),kind:'duel',seed,length:count}); return;
    }
    if (action === 'start-free') {
      const count=Number(app().querySelector('#quick-free-length')?.value) || 3;
      prepare({names:['Tú'],rounds:rounds(count),kind:'free',length:count}); return;
    }
    if (action === 'exit') {CT.UI.confirmExit(connection?.kind==='local' ? 'Al salir se cierra la conexión con la sala local.' : 'La partida se conserva para que puedas continuar después.', toEntry, undefined, undefined, state ? {label:'Salir sin guardar', proceed:abandonQuick} : null); return;}
    if (action === 'abandon') {CT.UI.confirmExit('Se borrará esta partida y no podrás continuarla después.', abandonQuick, '¿Salir sin guardar?', 'Salir sin guardar'); return;}
    if (action === 'setup') {setup(); return;}
    if (action === 'starter-guess') {starterGuess(); return;}
    if (action === 'starter-go') {starterClose(); app().querySelector('[data-quick="start"]')?.click(); return;}
    if (action === 'starter-back') {starterClose(); return;}
    if (action === 'draw-starter') {const n = quickNames(); if (n.length < 2 || n.some(x => !x) || new Set(n.map(x => x.toLocaleLowerCase('es'))).size !== n.length) {app().querySelector('#quick-error').textContent = 'Escribe nombres diferentes para cada participante.'; return;} starter = null; beginStarter(n); return;}
    if (action === 'start') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value.trim());
      if (names.some(n => !n) || new Set(names.map(n => n.toLocaleLowerCase('es'))).size !== names.length) {
        app().querySelector('#quick-error').textContent = 'Escribe nombres diferentes para cada participante.'; return;
      }
      // En un solo móvil se decide quién empieza como en Grandes colecciones: una carta al azar de
      // esas colecciones (no de los mazos sorpresa) y cada persona adivina su cifra.
      if (format === 'local' && names.length > 1 && !(starter && starter.key === names.join('|'))) {beginStarter(names); return;}
      let ordered = names;
      if (format === 'local' && starter && starter.key === names.join('|')) ordered = starter.order.map(i => names[i]);
      const count = Number(app().querySelector('#quick-length').value);
      const list = rounds(count).map(round => E.challenge(round.id));
      const config = {names: ordered, rounds: list.map(c => ({id: c.id, order: CT.shuffle(c.cards.map(item => item.id))})),kind:format,historyId:historyId()};
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
  function block(title, subtitle, art, action, count) {
    const cover = art === 'quick' ? 'menu-quick.webp' : `hero-${art}-400.webp`;
    return `<div class="collection-entry"><button class="gallery-panel panel-${art}" data-action="${action}" aria-label="${esc(title)}. ${esc(subtitle)}"><span class="panel-backdrop" aria-hidden="true"><img src="assets/${cover}" alt="" width="400" height="600"></span><span class="panel-depth-light" aria-hidden="true"></span><span class="panel-art" aria-hidden="true"><img src="assets/${cover}" alt="" width="400" height="600"></span><span class="panel-depth-ground" aria-hidden="true"></span><span class="collection-foil" aria-hidden="true"></span><span class="collection-index" aria-hidden="true">${count}</span><span class="collection-open" aria-hidden="true">↗</span><span class="panel-spine" aria-hidden="true"><i>◇</i><b>${esc(title)}</b></span><span class="panel-label" aria-hidden="true"><i></i><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span></button></div>`;
  }
  // El reto diario tiene siempre 10 cartas que ordenar, igual que el de Grandes colecciones: así los
  // aciertos de un día valen lo mismo que los de otro, sin cuentas. Una carta más abre la línea, y solo
  // entran los mazos que llegan a ese tamaño.
  const DAILY_QUICK_CARDS = 10;
  function dailyQuick(dayValue) {
    const seed=CT.seedFrom('quick-daily-'+dayValue), random=CT.seededRandom(seed);
    const all=CT.QuickCatalog.challenges, pool=all.filter(c=>c.cards.length>DAILY_QUICK_CARDS);
    const list=pool.length?pool:all;
    const challenge=list[Math.floor(random()*list.length)];
    const order=CT.shuffleWith(challenge.cards.map(x=>x.id),random).slice(0,DAILY_QUICK_CARDS+1);
    return {names:['Tú'],rounds:[{id:challenge.id,order}],kind:'daily',day:dayValue};
  }

  async function openPublic(renderPage, capacity=0) {
    paint=renderPage; entry='public'; stopNetwork(); page='network-lobby'; state=null; record=null; selected=null; slot=null; format='public'; netKind='internet';
    const name=CT.Identidad?.propio?.() || 'Explorador';
    const change=(...args)=>roomChanged(...args), fail=e=>errorNotice(e);
    shell('<section class="setup-section"><h2>Buscando mesa…</h2><div class="panel"><p>Retos rápidos · jugadores aleatorios</p><p class="hint">Entrarás en la primera mesa compatible.</p></div></section>');
    connection=await (await import('./quick-online.js')).connectPublic({name,capacity,onChange:change,onError:fail});
  }

  CT.Quick = {
    leave:stopNetwork,
    openPublic,
    openSolo(renderPage){paint=renderPage;entry='free-setup';format='free';freeSetup();},
    openLocal(renderPage){paint=renderPage;entry='setup';format='local';setup();},
    openDuel(renderPage){paint=renderPage;entry='duel-setup';format='duel';duelSetup();},
    Duel:{pack:packCommands,unpack:unpackCommands,payload:duelPayload,read:readDuel,fingerprint:duelFingerprint,rounds},
    openNetwork(renderPage,kind,capacity){paint=renderPage;entry='network';networkSetup(kind,capacity);},
    // El mazo y la regla del reto rápido de un día, para enseñarlos en la guía sin empezar la partida.
    dailyChallenge(dayValue) {const c=E.challenge(dailyQuick(dayValue).rounds[0].id);return {id:c.id,title:c.title,rule:c.rule,asOf:c.asOf,cards:dailyQuick(dayValue).rounds[0].order.length};},
    startDaily(dayValue, renderPage) {
      paint=renderPage; entry='prepare'; stopNetwork(); page='prepare'; state=null; record=null; selected=null; slot=null;
      const saved=load();
      if(saved?.config?.kind==='daily' && saved.config.day===dayValue && !saved.historySaved){
        record=saved;state=E.restore(record);render();return;
      }
      prepare(dailyQuick(dayValue));
    },
    // Sin ruta de entrada (al abrir un enlace de sala o de duelo, o si se pierde la ruta) ya no hay un menú de
    // formatos propio: un duelo o una sala se abren directos y, sin enlace, se vuelve a las puertas de Jugar.
    open(renderPage) {
      paint = renderPage; entry = 'network'; state = null; record = null; selected = null; slot = null;
      const params = new URLSearchParams(location.hash.slice(1));
      try {
        if (params.has('quick-duel')) acceptDuel();
        else if (params.has('quick-room')) {
          networkSetup('internet'); app().querySelector('#quick-net-code').value = params.get('quick-room');
          // Con el nombre ya conocido se entra directamente a la mesa, como en Grandes colecciones.
          if (app().querySelector('#quick-net-name-join')?.value.trim()) formatAction('join-room').catch(errorNotice);
        }
        else CT.ModeHubs.open('hub-solo');
      } catch (e) {
        CT.ModeHubs.open('hub-solo');
        CT.UI.askDialog({ title: 'No se pudo abrir el enlace', message: e.message || 'El enlace no es válido.', stay: 'Entendido' });
      }
    },
    blocks() {return block('Retos rápidos', 'Ordena. Arriesga. Asegura.', 'quick', 'quick-challenges', `${CT.QuickCatalog.challenges.length} retos`);}
  };
})();
