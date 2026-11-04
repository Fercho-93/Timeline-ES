// Pantallas de Retos rápidos: elegir reto y formato, jugar solo, en un móvil, por Wi-Fi, por internet o
// en duelo, y ver el resultado.
(function () {
  'use strict';
  const CT = window.CONTINUUM, E = CT.QuickEngine, esc = CT.escapeHtml;
  const KEY = 'continuum-quick-challenges-v1';
  // El reto diario se guarda aparte: antes compartía hueco con las demás partidas y empezar una en un solo móvil
  // (o una partida libre) borraba un reto diario a medias.
  const DAILY_KEY = 'continuum-quick-daily-v1';
  const slotOf = config => config?.kind === 'daily' ? DAILY_KEY : KEY;
  let paint, state, record, selected = null, slot = null, error = '';
  const app = () => document.getElementById('app');
  // Un reto diario a medias guardado con una versión anterior pasa a su hueco propio.
  function migrateDaily() {
    try {
      const raw = CT.Storage.getItem(KEY);
      if (!raw || JSON.parse(raw)?.config?.kind !== 'daily') return;
      if (!CT.Storage.getItem(DAILY_KEY)) CT.Storage.setItem(DAILY_KEY, raw);
      CT.Storage.removeItem(KEY);
    } catch { /* sin almacenamiento o guardado dañado: lo resuelve load() */ }
  }
  function load(key = KEY) {
    error = '';
    migrateDaily();
    try {
      const raw = CT.Storage.getItem(key);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      E.restore(saved);
      return saved;
    } catch {error = 'No se pudo recuperar la partida anterior. Puedes empezar una nueva.'; return null;}
  }
  let topTitle = '';
  function shell(content) {
    const playing=!!state || !!connection || page==='network-lobby';
    // Desde la pantalla por la que se entró, la flecha sale de Retos rápidos a la pantalla
    // anterior del juego; desde cualquier otra, vuelve a esa pantalla de entrada.
    const back=playing ? 'data-quick="exit"' : page===entry ? 'data-action="ui-back"' : 'data-quick="formats"';
    paint(`<div class="shell quick-shell">${CT.UI.header(back, state ? 'data-quick="menu"' : '', playing, state ? topTitle : '')}${state ? content : `<div class="quick-content">${content}</div>`}</div>`, playing ? state ? true : 'lobby' : false);
    // En una sala, cada jugada ajena repinta la pantalla: la portada del mazo sigue encima hasta que se toque.
    if(splashLayer && !splashLayer.isConnected && !splashLayer.dataset.closed && state && splashLayer.dataset.game===(state.config.historyId||'sin-id') && splashLayer.dataset.index===String(state.index)) app().append(splashLayer);
    if(state && room && !myTurn()) for(const el of app().querySelectorAll('[data-quick="select"],[data-quick="slot"],[data-quick="confirm"],[data-quick="bank"],[data-quick="next"],[data-quick="ack"]')) el.disabled=true;
  }
  let quickClock = null;
  let entry = 'menu', format = 'local', page = 'menu', connection = null, room = null, myId = null, busy = false, invite = null, netKind = 'internet', networkEpoch = 0, roomCapacity = 4, roomLength = 3, pendingConfig = null;
  const BEST = 'continuum-quick-best-v1', NET = 'continuum-quick-room-v1', HISTORY = 'continuum-quick-history-v1';
  const day = () => CT.RetoDiario.clave();
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
    // Cuenta en el día en que se empezó (`config.day`), igual que en Grandes colecciones: uno empezado
    // antes de medianoche y acabado después sigue siendo el reto de ese día.
    if(record.config.kind==='daily' && record.config.day){
      const key='hilo-retos-v1', all=readJSON(key,{}) || {};
      const daily=all.retoDiario || CT.RetoDiario.vacio();
      const hits=state.players[0].score;
      const total=record.config.rounds[0].order.length-1;
      const ms=record.startedAt?Math.max(0,Date.now()-record.startedAt):null;
      // `registrar` devuelve null si ese día ya estaba jugado: entonces no hay nada que anotar ni que anunciar.
      if(CT.RetoDiario.registrar(daily,record.config.day,{hits,total,family:'quick',challenge:record.config.rounds[0].id,ms})){
        all.retoDiario=daily;CT.Storage.setItem(key,JSON.stringify(all));
        // Los logros del reto diario (reto perfecto, rachas) se anuncian como en las colecciones.
        const logros=CT.Progreso?.finishQuickDaily?.({hits,total,streak:daily.streak}) || [];
        if(logros.length){record.achievements=logros.map(item=>item.name);CT.Effects?.achievement?.();CT.announce?.(logros.map(item=>`Logro desbloqueado: ${item.name}.`).join(' '));}
      }
    }
    record.historySaved = true;
    if(!room) CT.Storage.setItem(slotOf(record.config), JSON.stringify(record));
  }
  function statsPanel() {
    const history = quickHistory(), games = history.length, points = history.reduce((n,item)=>n + (Number(item.score)||0),0), best = history.reduce((n,item)=>Math.max(n,Number(item.score)||0),0);
    const rows = history.slice(0, 12).map(item => `<li><strong>${esc(item.score)} ${Number(item.score) === 1 ? 'acierto' : 'aciertos'}</strong><span>${esc(item.date)} · ${esc(item.kind === 'daily' ? 'Reto diario' : item.kind === 'duel' ? 'Duelo de Retos rápidos' : `${item.rounds} ${item.rounds === 1 ? 'reto' : 'retos'}`)}</span></li>`).join('');
    const layer = document.createElement('div'); layer.className='overlay';
    layer.innerHTML = `<div class="modal quick-stats-modal"><h2>Historial de Retos rápidos</h2><div class="quick-stats-grid"><span><b>${games}</b><small>partidas terminadas</small></span><span><b>${points}</b><small>aciertos acumulados</small></span><span><b>${best}</b><small>mejor resultado</small></span></div><h3>Últimas partidas</h3>${rows ? `<ol class="quick-history">${rows}</ol>` : '<p class="hint">Todavía no hay partidas terminadas. Tu historial aparecerá aquí.</p>'}<button type="button" class="btn btn-primary btn-block" data-close-stats>Cerrar</button></div>`;
    layer.querySelector('[data-close-stats]').addEventListener('click',()=>CT.closeDialog());
    app().append(layer); CT.openDialog(layer,true);
  }
  function guide() {
    const layer=document.createElement('div'); layer.className='overlay';
    layer.innerHTML=`<div class="modal rules quick-guide-modal"><div class="guide-tools"><button type="button" class="icon-btn guide-close" data-quick="close-menu" aria-label="Cerrar guía">×</button></div><div class="guide-content"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2>Guía</h2><section><h3>Un reto, una línea</h3><p>Comienza con una carta de referencia y coloca cada carta nueva en el hueco que le corresponde. El dato se revela al confirmar.</p></section><section><h3>Si juegas solo (o en un duelo por enlace)</h3><p>Cada carta bien colocada suma un acierto. Un fallo cuenta como fallo, pero sigues hasta terminar el reto: no te echa.</p></section><section><h3>Los mazos de hoy</h3><p>En «Jugar solo» salen cada día cuatro mazos al azar, los mismos para todo el mundo, y al día siguiente salen otros. Toca uno para jugarlo. Cada carta que aciertas queda en tu colección, donde ves todos los mazos en tres grupos: Empezados, Nuevos y Completos.</p></section><section><h3>Si juegas con amigos</h3><p>En un solo móvil, en una sala o por turnos, quien prepara la partida elige qué pasa al fallar. «Arriesgar o plantarse»: cada acierto es provisional y puedes plantarte para asegurarlo; si fallas, pierdes los provisionales de ese reto y quedas fuera hasta el siguiente. «Seguir hasta el final»: un fallo no suma, pero se juega todo el reto y gana quien acierte más. Quien crea una sala puede echar a alguien mientras esperan, con la «×» de su plaza.</p></section><section><h3>Mesa pública</h3><p>La partida rápida son tres retos sorpresa con desconocidos, arriesgando o plantándote. Quien crea una mesa elige cuántos retos se juegan y qué pasa al fallar.</p></section><section><h3>Mazos sorpresa</h3><p>Los mazos se sortean automáticamente. Solo conocerás la temática cuando empiece el reto; los siguientes permanecen ocultos.</p></section><section><h3>Turnos justos</h3><p>El primer turno rota en cada reto. En partidas por internet o por enlace, siempre juega una persona cada vez.</p></section></div><button class="btn btn-primary btn-block" data-quick="close-menu">Volver</button></div>`;
    app().append(layer); CT.openDialog(layer,true);
  }
  function myTurn() {return !room || room.actor === myId;}
  let publicClock=null;
  // Una sala de duelo por turnos (la crea quien abre «Duelo con un amigo → Por turnos») no enseña mesa: se manda el enlace y
  // empieza sola cuando entra el amigo.
  let previewCode=null, serverRoom=null, duelRoom=false, duelStarting=false, duelFirst=0, backTo=null, pendingInvite=null;
  // Duelo por turnos de Grandes colecciones: el mazo elegido (su clave). Se juega con estas mismas reglas, con rondas
  // de ese mazo en vez de retos sorpresa (QuickEngine: «col:<mazo>»).
  let duelDeck=null, duelPlayers=null, duelHand=4;
  const deckOf=config=>{const id=config?.rounds?.[0]?.id;return E.isCollection(id)?E.challenge(id)?.collection||null:null;};
  // En un duelo de colección no se juegan retos sino rondas del mismo mazo: el texto se adapta.
  const R_=(reto,ronda)=>deckOf(state?.config)?ronda:reto;
  // Lo que se ve encima de un duelo: de qué parte del juego es.
  const duelSection=config=>deckOf(config)||duelDeck?'Grandes colecciones':'Retos rápidos';
  // Las rondas de un duelo: retos sorpresa o, si es de colección, rondas de su mazo.
  // Un duelo de colección es de motor propio: una sola "ronda" con el mazo entero barajado, de donde salen las manos y el mazo de reposición.
  const duelRounds=count=>duelDeck?[{id:E.COLLECTION+duelDeck,order:E.colDeck(duelDeck)}]:rounds(count,null,null,E.MULTI_CARDS);
  const isCol=()=>!!state&&E.isColDuel(state.config);
  // Tu sitio en la mesa y tus cartas: en un duelo de colección cada uno tiene la suya (las de los demás no se enseñan).
  const mySeat=()=>room?room.members.indexOf(myId):state?.current??0;
  const handIds=()=>isCol()?(state.players[mySeat()]?.hand||[]):state.remaining;
  function stopNetwork() {quickClock?.stop();quickClock=null;clearInterval(publicClock);publicClock=null;networkEpoch++;connection?.close();connection=null;room=null;serverRoom=null;myId=null;busy=false;invite=null;duelRoom=false;duelStarting=false;}
  function errorNotice(e) {busy=false;const message=e?.code==='permission-denied'||/missing or insufficient permissions/i.test(e?.message||'')?'No se pudo guardar el cambio en el duelo. Vuelve a abrirlo e inténtalo de nuevo.':e.message || String(e);let el=app().querySelector('#quick-error');if(!el){el=document.createElement('p');el.id='quick-error';el.setAttribute('role','alert');(app().querySelector('.modal') || app().querySelector('.quick-shell'))?.append(el);}if(el)el.textContent=message;CT.announce(message);}
  // `fresh`: en solitario, las cartas que aún no están en la colección salen antes que las ya descubiertas,
  // como en una ronda de Grandes colecciones; así cada partida de 10 cartas avanza la colección.
  function rounds(count=3, selectedId=null, seed=null, limit=0, fresh=false) {
    const seen=fresh?quickSeen():null;
    const random=seed===null?Math.random:CT.seededRandom(CT.seedFrom(seed)), deal=c=>{const all=CT.shuffleWith(c.cards.map(x=>x.id),random),ids=seen?[...all.filter(id=>!seen.has(id)),...all.filter(id=>seen.has(id))]:all;return limit?ids.slice(0,limit):ids;};
    if (selectedId) return [E.challenge(selectedId)].map(c=>({id:c.id,order:deal(c)}));
    const catalog=CT.shuffleWith(CT.QuickCatalog.challenges,random);
    const list=Array.from({length:count},(_,i)=>catalog[i % catalog.length]);
    return list.map(c=>({id:c.id,order:deal(c)}));
  }
  function begin(config) {pendingConfig=null;config.historyId ||= historyId();record={version:CT.QuickCatalog.version,config,commands:[],startedAt:Date.now()};state=E.create(config);selected=null;slot=null;save();render();}
  function prepare(config) {
    pendingConfig=config; page='prepare'; state=null; record=null;
    const c=E.challenge(config.rounds[0].id);
    shell(`<section class="setup-section quick-ready"><div class="eyebrow"><span class="eyebrow-line"></span> Reto preparado</div><h2 data-focus tabindex="-1">${esc(c.title)}</h2>${config.rounds.length === 1 ? '' : `<p class="lead">${config.rounds.length} mazos sorpresa, uno detrás de otro.</p>`}<div class="panel quick-ready-card"><div class="quick-ready-seal" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="23"/><path d="M32 9l3.2 19.8L55 32l-19.8 3.2L32 55l-3.2-19.8L9 32l19.8-3.2z"/><circle cx="32" cy="32" r="3.2"/></svg></div><span class="quick-ready-kicker">La regla del mazo</span><p class="quick-ready-rule">${esc(c.rule)}</p>${c.asOf ? `<p class="quick-ready-asof">Datos a ${esc(c.asOf)}</p>` : ''}<div class="quick-ready-divider" aria-hidden="true"><i></i><b>◆</b><i></i></div><p class="hint">Cuando estés preparado, empieza el reto.${config.rounds.length === 1 ? '' : ' Los siguientes mazos seguirán ocultos hasta que lleguen.'}</p>${button('ready','Estoy preparado <span>→</span>','btn btn-primary btn-block')}<p id="quick-error" role="alert"></p></div></section>`);
    // El reto diario ya tuvo su portada (la ruleta del reto diario, la misma de los días de colecciones).
    if(config.kind!=='daily')deckSplash(config);
  }
  // Antes de la explicación, una portada breve con el mazo que toca. Es una capa sobre la
  // pantalla «Reto preparado» (que ya está pintada debajo): solo se retira con un toque.
  // También se usa al pasar al siguiente reto de una partida, con `index` el número de ese reto.
  let splashLayer=null;
  function deckSplash(config, index=0) {
    const c=E.challenge(config.rounds[index].id), total=config.rounds.length;
    const art=c.cards.filter(card=>card.image), pick=[...new Set([art[0],art[Math.floor(art.length/2)],art.at(-1)].filter(Boolean))];
    const lead=config.kind==='daily'?'Reto diario':total===1?'Vas a jugar a':`${deckOf(config)?'Ronda':'Reto'} ${index+1} de ${total}`;
    const layer=document.createElement('div');layer.className='quick-splash';layer.dataset.quickSplash='';layer.setAttribute('role','button');layer.tabIndex=0;layer.setAttribute('aria-label',`${lead}: ${c.title}. Toca para continuar.`);
    layer.innerHTML=`<div class="quick-splash-inner"><div class="quick-splash-fan" aria-hidden="true">${pick.map(card=>`<img src="${esc(card.image)}" alt="" decoding="async">`).join('')}</div><div class="eyebrow">${esc(lead)}</div><h2>${esc(c.title)}</h2><span class="quick-splash-hint">Toca para continuar</span></div>`;
    app().querySelector('[data-quick-splash]')?.remove();splashLayer=layer;layer.dataset.game=config.historyId||'sin-id';layer.dataset.index=String(index);
    // Mientras la portada tapa la mesa, el reloj de la jugada no corre: empieza al retirarla (render).
    const close=()=>{if(layer.dataset.closed)return;layer.dataset.closed='1';if(splashLayer===layer)splashLayer=null;if(!layer.isConnected)return;layer.classList.add('is-leaving');setTimeout(()=>layer.remove(),260);if(state&&page==='game'&&timedTurn())render();};
    layer.addEventListener('click',close);layer.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();close();}});
    app().append(layer);
    CT.Effects?.transition?.('open');
  }
  // Duraciones de Retos rápidos: las cortas valen para todo; las largas, para jugar en un solo móvil.
  const SHORT_LENGTHS=[[1,'Corta'],[3,'Media'],[5,'Larga']];
  const LONG_LENGTHS=[...SHORT_LENGTHS,[10,'Muy larga'],[15,'Extra larga'],[20,'Resistencia']];
  // Se enseñan las tres duraciones de siempre (1, 3 y 5); las largas quedan tras «Más duraciones».
  function lengthChips(id,options,label,attrs='',illustrated=true) {
    const art=n=> {
      const layers=n===1?1:n===3?3:5;
      return `<svg class="quick-duration-art" viewBox="0 0 100 76" aria-hidden="true" focusable="false">${Array.from({length:layers},(_,j)=>{
        const angle=(j-(layers-1)/2)*12;
        return `<g transform="rotate(${angle} 50 64)"><rect x="30" y="8" width="40" height="57" rx="5" fill="var(--quick-card-paper)" stroke="currentColor" stroke-width="1.4"/><rect x="34" y="12" width="32" height="49" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4"/><path d="M50 22l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" fill="currentColor" fill-opacity=".65"/><circle cx="50" cy="35" r="12" fill="none" stroke="currentColor" stroke-opacity=".35"/></g>`;
      }).join('')}</svg>`;
    };
    const chip=([n,text],i)=>`<button type="button" class="quick-length-chip${n===3?' is-selected':''}${text==='Todo el catálogo'?' quick-length-all':''}" role="radio" aria-checked="${n===3}" data-quick="length" data-length="${n}"${i>=3?' data-length-extra hidden':''}>${illustrated?art(n):''}<b>${n}</b><span>${n===1?'reto':'retos'}</span><small>${text}</small></button>`;
    const more=options.length>3?`<button type="button" class="btn btn-ghost quick-length-more" data-quick="more-lengths" aria-expanded="false">Más duraciones</button>`:'';
    return `<div class="field duel-kind-field"${attrs}><span class="field-label" id="${id}-label">${label}</span><div class="quick-length" role="radiogroup" aria-labelledby="${id}-label">${options.map(chip).join('')}</div>${more}<input type="hidden" id="${id}" data-quick-length-input value="3"></div>`;
  }
  // Qué pasa al fallar en las partidas con amigos: se elige al crearlas, igual en un solo móvil,
  // en una sala o por turnos. Solo y «mismas cartas» siguen siempre; la mesa pública lo elige quien la crea.
  function keepField(attrs='') {
    const keep=duelKeep();
    return `<div class="field duel-kind-field"${attrs}><span class="field-label" id="quick-keep-label">Si alguien falla</span><div class="segmented" role="radiogroup" aria-labelledby="quick-keep-label">${[['fuera','Arriesgar o plantarse','Un fallo pierde los aciertos provisionales del reto; plantarse los asegura'],['seguir','Seguir hasta el final','Un fallo no suma, pero se juega todo el reto y gana quien acierte más']].map(([k,t,f])=>`<label class="segmented-option${(k==='seguir')===keep?' is-on':''}"><input type="radio" name="quick-keep" value="${k}"${(k==='seguir')===keep?' checked':''}><span><b>${t}</b><small>${f}</small></span></label>`).join('')}</div></div>`;
  }
  // El nombre de las partidas con amigos es el del perfil, como en Grandes colecciones.
  const profileName=()=>String(CT.Identidad?.propio?.()||CT.Identidad?.nombre?.()||'Explorador').slice(0,24);
  function identityField() {
    const name=profileName();
    return `<div class="field duel-identity-field"><label for="quick-profile-name">Tu nombre de perfil</label><div class="duel-identity"><span class="duel-avatar" aria-hidden="true">${CT.Avatares?.markup?.(name,{size:38,seed:CT.Avatares.ownSeed?.()})||''}</span><input id="quick-profile-name" type="text" readonly aria-readonly="true" value="${esc(name)}"></div><small class="field-help">Se usará en la partida. Puedes cambiarlo en Atlas.</small></div><input type="hidden" id="quick-net-name" value="${esc(name)}"><textarea id="quick-net-code" hidden></textarea>`;
  }
  // Lo descubierto de un reto: sus cartas acertadas alguna vez por quien juega (CT.Progreso).
  const quickSeen=()=>CT.Progreso?.quickSeenCards?.() || new Set();
  function deckProgress(c, seen=quickSeen()) {
    // Un mazo de colección cuenta lo descubierto en las colecciones (por su id original), no en el álbum de Retos rápidos.
    if (c.collection) {const found=CT.Progreso?.seenCards?.()||new Set();return {done:c.cards.filter(card=>found.has(card.raw)).length,total:c.cards.length};}
    const done=c.cards.filter(card=>seen.has(card.id)).length;return {done,total:c.cards.length};
  }
  function progressBar({done,total}) {
    return `<span class="game-progress quick-deck-progress"><span class="game-progress-bar" aria-hidden="true"><i style="width:${Math.round(100*done/total)}%"></i></span><small>${done===total?`Completo · ${total} de ${total} cartas`:`Descubiertas ${done} de ${total}`}</small></span>`;
  }
  const deckArt=c=>c.cards.find(card=>card.image)?.image || 'assets/menu-quick.webp';
  // Jugar solo en Retos rápidos: cada día salen QUICK_DAY_DECKS mazos al azar, los mismos para todo el
  // mundo. El catálogo se baraja una vez con semilla fija y cada día toma el tramo siguiente, así que
  // en una semana larga salen todos y ninguno se repite de un día al siguiente.
  const QUICK_DAY_DECKS=4;
  function todayDecks(dayValue=day()) {
    const order=CT.shuffleWith(CT.QuickCatalog.challenges,CT.seededRandom(CT.seedFrom('quick-rotation-v1')));
    const count=Math.min(QUICK_DAY_DECKS,order.length), start=(CT.RetoDiario.numero(dayValue)*count)%order.length;
    return Array.from({length:count},(_,i)=>order[(start+i)%order.length]);
  }
  // Horas que faltan para que cambien (a medianoche), redondeando hacia arriba.
  function hoursLeft(now=new Date()) {const next=new Date(now);next.setHours(24,0,0,0);return Math.max(1,Math.ceil((next-now)/3600000));}
  // La partida a medias, para enseñarla con su mazo y lo que lleva en vez de un botón suelto.
  function resumeCard(saved) {
    let c=null, done=0, total=0;
    try {const s=E.restore(saved);const r=saved.config.rounds[s.index];c=E.challenge(r.id);total=r.order.length-1;done=Math.max(0,total-s.remaining.length);} catch {/* partida ilegible: solo el botón */}
    return `<section class="quick-resume" aria-labelledby="quick-resume-title">${c?`<img src="${esc(deckArt(c))}" alt="" aria-hidden="true" decoding="async">`:''}<div class="quick-resume-copy"><span class="quick-setup-kicker">Partida a medias</span><b id="quick-resume-title">${c?esc(c.title):'Partida guardada'}</b>${c?`<small>${done} de ${total} cartas jugadas</small>`:''}</div>${button('resume','Continuar <span>→</span>','btn btn-primary quick-resume-go')}</section>`;
  }
  // Los mazos de la colección van en tres grupos, cada uno en el orden del catálogo: empezados (lo que estás
  // completando, arriba), nuevos y completos. Igual en «Jugar solo» y en «Tu colección».
  const deckRank=(c,seen)=>{const {done,total}=deckProgress(c,seen);return done===total?2:done>0?0:1;};
  const incompleteDecks=(seen=quickSeen())=>CT.QuickCatalog.challenges.filter(c=>deckRank(c,seen)<2);
  const DECK_GROUPS=[['started','Empezados'],['new','Nuevos'],['complete','Completos']];
  // `wrap` es la clase de la lista de cada grupo; `item` pinta un mazo. Los grupos vacíos no salen.
  function deckGroups(seen, wrap, item) {
    return DECK_GROUPS.map(([key,title],rank)=>{
      const list=CT.QuickCatalog.challenges.filter(c=>deckRank(c,seen)===rank);
      if(!list.length)return '';
      return `<section class="quick-deck-group" data-deck-group="${key}" aria-labelledby="quick-group-${key}"><h4 class="quick-deck-group-title" id="quick-group-${key}">${title} <small>${list.length}</small></h4><div class="${wrap}">${list.map(item).join('')}</div></section>`;
    }).join('');
  }
  function freeSetup() {
    stopNetwork(); page='free-setup'; format='free'; state=null; record=null; selected=null; slot=null;
    const decks=CT.QuickCatalog.challenges, seen=quickSeen();
    const cards=decks.reduce((n,c)=>n+c.cards.length,0), found=decks.reduce((n,c)=>n+deckProgress(c,seen).done,0);
    const complete=decks.length-incompleteDecks(seen).length;
    const deckTile=c=>`<button type="button" class="quick-day-deck" data-quick="play-deck" data-deck="${esc(c.id)}" aria-label="Jugar ${esc(c.title)}. ${esc(c.rule)}. ${deckProgress(c,seen).done} de ${c.cards.length} cartas descubiertas"><img src="${esc(deckArt(c))}" alt="" aria-hidden="true" decoding="async" loading="lazy"><span class="quick-day-deck-copy"><b>${esc(c.title)}</b><small>${esc(c.rule)} · ${c.cards.length} cartas</small>${progressBar(deckProgress(c,seen))}</span><span class="quick-day-deck-go" aria-hidden="true">→</span></button>`;
    const pendiente=load(), hoy=todayDecks();
    shell(`<section class="setup-section solo-home quick-free-setup"><div class="solo-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2 class="solo-title" data-focus tabindex="-1">Jugar solo</h2>
        <p class="lead">${E.SOLO_CARDS} cartas en cada reto: un fallo no te echa.</p>
        <p class="hint solo-dominadas">Tu colección: ${found} de ${cards} cartas · ${complete} de ${decks.length} mazos completos.</p>${button('collection','Ver tu colección','btn btn-ghost quick-collection-link')}</div>
        ${pendiente ? resumeCard(pendiente) : ''}
        <div class="panel solo-panel quick-day-panel">
          <div class="solo-panel-head quick-mode-head"><span class="quick-setup-kicker">Mazos de hoy</span><h3>Elige uno de los ${hoy.length}</h3></div>
          ${CT.Tiempo.field('quick-solo')}
          <p class="hint quick-album-note">Cambian cada día (dentro de ${hoursLeft()} h). Cada carta que aciertes queda en tu colección; salen primero las que aún te faltan.</p>
          <div class="quick-day-decks">${hoy.map(deckTile).join('')}</div>
          <p id="quick-error" role="alert">${esc(error)}</p>
        </div></section>`);
  }
  // Tu colección de Retos rápidos: todos los retos con lo descubierto de cada uno. Las cartas
  // acertadas enseñan su lámina y su dato; las que faltan, solo el título y un candado.
  // `open`: el reto que se despliega al entrar (el que se acaba de jugar).
  function collectionPage(open=null) {
    stopNetwork(); page='collection'; state=null; record=null; selected=null; slot=null;
    const seen=quickSeen(), hoy=new Set(todayDecks().map(c=>c.id));
    const decks=CT.QuickCatalog.challenges;
    const cards=decks.reduce((n,c)=>n+c.cards.length,0), found=decks.reduce((n,c)=>n+deckProgress(c,seen).done,0);
    const complete=decks.filter(c=>deckProgress(c,seen).done===c.cards.length).length;
    const card=(c,item)=>seen.has(item.id)
      ? `<li class="quick-album-card is-found">${item.image?`<img src="${esc(item.image)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`:''}<b>${esc(item.title)}</b><small>${esc(item.label)}</small></li>`
      : `<li class="quick-album-card is-locked"><span class="quick-album-lock" aria-hidden="true">?</span><b>${esc(item.title)}</b><small>Por descubrir</small></li>`;
    const deck=c=>{const pr=deckProgress(c,seen);return `<details class="quick-album-deck"${c.id===open?' open':''}><summary><img src="${esc(deckArt(c))}" alt="" aria-hidden="true" loading="lazy" decoding="async"><span><b>${esc(c.title)}</b>${hoy.has(c.id)?'<em class="quick-album-today">Hoy</em>':''}${progressBar(pr)}</span></summary>
      <p class="hint">${esc(c.rule)}.</p>${hoy.has(c.id)?button('play-deck',pr.done===pr.total?'Volver a jugarlo':'Jugarlo ahora','btn btn-primary btn-block',`data-deck="${esc(c.id)}"`):'<p class="hint">Se juega el día que salga entre los mazos de hoy.</p>'}
      <ul class="quick-album-cards">${[...c.cards].sort((a,b)=>Number(seen.has(b.id))-Number(seen.has(a.id))).map(item=>card(c,item)).join('')}</ul></details>`;};
    shell(`<section class="setup-section quick-album"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2 data-focus tabindex="-1">Tu colección</h2>
      <p class="lead">${found} de ${cards} cartas descubiertas · ${complete} ${complete===1?'mazo completo':'mazos completos'}.</p>
      <p class="hint">Una carta se descubre al colocarla bien en una partida tuya. Las que faltan siguen esperando en su mazo.</p>
      ${CT.Accounts?.ready?'<button class="btn btn-secondary" data-account-action="ranking-discoveries">Ranking de descubrimientos</button>':''}
      ${deckGroups(seen,'quick-album-decks',deck)}</section>`);
    if(open) app().querySelector('.quick-album-deck[open]')?.scrollIntoView?.({block:'start'});
  }
  // El duelo de Retos rápidos por enlace: juegas tú, mandas el enlace y tu amigo juega los mismos mazos.
  // Los mazos salen de una semilla y las jugadas viajan abreviadas, así que el enlace es corto aunque la
  // partida sea larga. Quien lo abre reconstruye la partida con el motor, que es quien da por buena la marca.
  const DUEL_VERSION=3;
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
    // En un grupo (3 o 4), el enlace lleva también lo que hicieron quienes jugaron antes (`r`): cada uno se lo pasa al siguiente.
    const group=groupOf(c), prior=Array.isArray(c.rivals)?c.rivals.slice(0,MAX_FRIENDS-1):[];
    return {v:DUEL_VERSION,f:duelFingerprint(),s:c.seed,n:rs.length,c:packCommands(rec.commands,rs),p:String(CT.Identidad?.propio?.()||'').slice(0,24),...(Number(c.seconds)>0?{t:c.seconds}:{}),...(group>2?{g:group,r:prior}:{})};
  }
  // Cuántos juegan las mismas cartas (de 2 a 4). Sin dato, dos: los enlaces de antes.
  const groupOf=config=>[3,4].includes(config?.group)?config.group:2;
  function duelLink() {
    return CT.Links.invitation({quickDuel:CT.LocalTransport.encodeText(JSON.stringify(duelPayload(record)))});
  }
  // Lee un enlace de duelo y devuelve la partida del rival terminada y comprobada. Lanza un error legible si
  // el enlace está cortado, es de otra versión del juego o no es una partida terminada.
  function readDuel(encoded) {
    let p;
    try{p=JSON.parse(CT.LocalTransport.decodeText(encoded));}catch{throw Error('Este enlace no es un duelo de Retos rápidos.');}
    if(p&&p.v===2)throw Error('Este duelo se creó con una versión anterior de Continuum (en la que un fallo te dejaba fuera). Pide a tu amigo que cree uno nuevo.');
    if(!p||p.v!==DUEL_VERSION||typeof p.s!=='string'||!Number.isInteger(p.n)||p.n<1||p.n>CT.QuickCatalog.challenges.length||(p.t!==undefined&&![15,20,30].includes(p.t)))throw Error('Este enlace no es un duelo de Retos rápidos.');
    if(!(CT.QuickNetwork?.compatible?.(p.f) ?? p.f===duelFingerprint()))throw Error('Este duelo se creó con otra versión de Continuum. Actualizad la aplicación en los dos móviles.');
    // Quien crea el duelo reparte 10 cartas al azar (E.MULTI_CARDS); los enlaces anteriores a ese cambio
    // llevan el mazo entero. Se prueba primero el reparto actual y, si no encaja, el antiguo.
    let rs,s,failure='El enlace del duelo está dañado o incompleto.';
    for(const limit of [E.MULTI_CARDS,0]){
      const candidate=rounds(p.n,null,p.s,limit);
      try{
        const restored=E.restore({version:CT.QuickCatalog.version,config:{names:['Tú'],rounds:candidate,kind:'duel',keep:true},commands:unpackCommands(p.c,candidate)});
        if(restored.players.length===1 && restored.phase==='round-end' && restored.index===candidate.length-1){rs=candidate;s=restored;break;}
        failure='Tu rival no ha terminado su duelo: pídele que lo termine antes de mandártelo.';
      }catch{ /* este reparto no corresponde a la invitación */ }
    }
    if(!s)throw Error(failure);
    const clean=n=>String(n||'').replace(/[<>\x00-\x1f]/g,'').slice(0,24);
    const group=[3,4].includes(p.g)?p.g:2;
    const prior=group>2&&Array.isArray(p.r)?p.r.slice(0,group-2).filter(x=>Array.isArray(x)&&Number.isInteger(x[1])&&x[1]>=0&&x[1]<=999).map(x=>[clean(x[0])||'Jugador',x[1]]):[];
    return {rounds:rs,seed:p.s,seconds:p.t||0,score:s.players[0].score,name:clean(p.p),group,prior};
  }
  function acceptDuel(value=location.href) {
    const url=new URL(value,location.href),encoded=new URLSearchParams(url.hash.slice(1)).get('quick-duel');
    if(!encoded || encoded.length>16000)throw Error('Este enlace no es un duelo de Retos rápidos.');
    const rival=readDuel(encoded);
    // `rivals`: quienes ya han jugado, en orden (el último, comprobado aquí con el motor). `rivalScore` y `rivalName`, el último.
    format='duel';begin({names:['Tú'],rounds:rival.rounds,kind:'duel',keep:true,seed:rival.seed,length:rival.rounds.length,seconds:rival.seconds,rivalScore:rival.score,rivalName:rival.name,...(rival.group>2?{group:rival.group,rivals:[...rival.prior,[rival.name||'Jugador',rival.score]]}:{})});
    history.replaceState(null,'',location.pathname+location.search);
  }
  // El duelo de Retos rápidos tiene los mismos dos ritmos que el de las colecciones, y aquí siempre se ordenan
  // cartas: «Partida completa» (juegas tú y mandas un enlace; tu amigo juega cuando pueda) y «Por turnos»
  // (una sala de dos: cada uno juega desde su móvil y la partida se guarda entre turnos).
  // En el duelo por turnos, quien crea la sala elige qué pasa al fallar: seguir hasta el final o quedarse sin más turnos.
  // Retos rápidos con amigos, en cualquier modalidad (un solo móvil, sala por internet o por Wi-Fi, mesa pública): de 2 a 4.
  const MAX_FRIENDS=4;
  // Un duelo de Grandes colecciones (mismo motor) admite de 2 a 10; uno de Retos rápidos, de 2 a 4.
  const DUEL_CAP=10;
  const seatsMax=()=>duelDeck?DUEL_CAP:MAX_FRIENDS;
  // Cuántos juegan por turnos o con las mismas cartas (de 2 a 4; por defecto, 2). Se recuerda con lo mismo que en las colecciones.
  const DUEL_GROUP='continuum-quick-grupo-v1';
  const duelGroup=()=>{const n=Number(CT.Storage.getItem(DUEL_GROUP));return [2,3,4].includes(n)?n:2;};
  const DUEL_KEEP='continuum-quick-duel-keep-v1';
  const duelKeep=()=>CT.Storage.getItem(DUEL_KEEP)==='seguir';
  const DUEL_PACE='continuum-quick-duel-pace-v1';
  // Como en las colecciones: en directo (una sala), por turnos o con los mismos mazos. Sin nada guardado, en directo.
  const duelPace=()=>CT.Storage.getItem(DUEL_PACE)==='turnos'?'turnos':'directo';
  // En directo, por internet o sin internet en la misma Wi-Fi.
  const LIVE_NET='continuum-quick-live-net-v1';
  const liveNet=()=>CT.Storage.getItem(LIVE_NET)==='wifi'?'wifi':'internet';
  const soloGlyph=paths=>`<svg class="solo-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const PACE_GLYPH={
    turnos:'<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    reloj:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    directo:'<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    internet:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z"/>',
    wifi:'<path d="M4 10a12 12 0 0 1 16 0"/><path d="M7.5 13.5a7 7 0 0 1 9 0"/><circle cx="12" cy="17.5" r="1"/>'
  };
  // El duelo por turnos se guarda en el servidor entre jugadas: sin internet no se puede crear.
  const OFFLINE_TURNS='Sin internet no se puede crear un duelo por turnos. Podéis jugar en directo, también por la Wi-Fi.';
  function duelSetup() {
    stopNetwork(); duelFirst=0; duelDeck=null; duelPlayers=null; page='duel-setup'; format='duel'; netKind='internet'; roomCapacity=2; state=null; record=null; selected=null; slot=null;
    const pace=duelPace();
    // Sin internet, en directo solo cabe la Wi-Fi: se marca sola, sin cambiar lo guardado.
    const offline=navigator.onLine===false, net=offline?'wifi':liveNet();
    // El máximo de la sala se recuerda con el de las colecciones (`CT.ManoInicial`), pero Retos rápidos con amigos es de 2 a 4.
    const maxRoom=Math.min(Math.max(Number(CT.ManoInicial?.maximo?.())||4,2),MAX_FRIENDS);
    const option=([key,title,foot])=>`<label class="segmented-option${key===pace?' is-on':''}"><input type="radio" name="quick-duel-pace" value="${key}"${key===pace?' checked':''}><i class="duel-option-mark" aria-hidden="true">${soloGlyph(PACE_GLYPH[key])}</i><span><b>${title}</b><small>${foot}</small></span></label>`;
    const block=(key,body)=>`<div data-quick-duel-block="${key}"${key===pace?'':' hidden'}>${body}</div>`;
    // La conexión solo cuenta en directo. El orden es el mismo que en las colecciones: ritmo, conexión, jugadores,
    // lo propio de cada juego (aquí, cuántos retos), si alguien falla, el reloj y el nombre.
    const pre=body=>`<div data-quick-duel-pre${pace==='directo'?'':' hidden'}>${body}</div>`;
    shell(`<section class="setup-section solo-home"><div class="solo-intro"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2 class="solo-title" data-focus tabindex="-1">Retos rápidos con amigos</h2>
        <p class="lead">Cada uno en su móvil, con los mismos retos sorpresa. Gana quien acierte más.</p></div>
      <div class="panel solo-panel">
        <div class="solo-panel-head"><h3>Cómo jugáis</h3></div>
        <div class="field duel-kind-field"><span class="field-label" id="quick-pace-label">Ritmo</span>
          <div class="segmented" role="radiogroup" aria-labelledby="quick-pace-label">${[['directo','En directo','Todos a la vez, en una sala'],['turnos','Por turnos','Cada uno cuando pueda']].map(option).join('')}</div></div>
        ${pre(`
          <div class="field duel-kind-field"><span class="field-label" id="quick-net-label">Conexión</span>
            <div class="segmented" role="radiogroup" aria-labelledby="quick-net-label">${[['internet','Por internet','Cada uno donde esté'],['wifi','Sin internet','Cerca, en la misma Wi-Fi']].map(([key,title,foot])=>`<label class="segmented-option${key===net?' is-on':''}"><input type="radio" name="quick-live-net" value="${key}"${key===net?' checked':''}><i class="duel-option-mark" aria-hidden="true">${soloGlyph(PACE_GLYPH[key])}</i><span><b>${title}</b><small>${foot}</small></span></label>`).join('')}</div></div>
          ${offline?'<p class="hint" data-offline-note>No hay internet: jugaréis por la Wi-Fi.</p>':''}
          <div class="field"><label for="quick-net-players">Máximo de jugadores</label><select id="quick-net-players" data-maximo-sala>${[2,3,4].map(n=>`<option value="${n}"${n===maxRoom?' selected':''}>${n} jugadores</option>`).join('')}</select></div>
        `)}
        <div class="field" data-quick-group${pace==='directo'?' hidden':''}><label for="quick-duel-group">Jugadores</label><select id="quick-duel-group">${[2,3,4].map(n=>`<option value="${n}"${n===duelGroup()?' selected':''}>${n} jugadores</option>`).join('')}</select></div>
        ${lengthChips('quick-free-length',SHORT_LENGTHS,'Retos')}
        ${keepField(` data-quick-keep-field`)}
        ${CT.Tiempo.field('amigos',{porDefecto:15})}
        ${identityField()}
        ${block('directo',button('live-room','Crear sala <span>→</span>','btn btn-primary btn-block'))}
        ${block('turnos',`${offline?`<p class="hint" data-offline-turnos>${OFFLINE_TURNS}</p>`:''}
          ${button('create-room','Crear duelo por turnos <span>→</span>','btn btn-primary btn-block')}
          ${readJSON(NET)?button('duels-list','Volver a Tus duelos','btn btn-ghost btn-block'):''}`)}
        <p id="quick-error" role="alert"></p>
      </div></section>`);
  }
  // `only` deja una sola de las dos mitades: 'create' al venir de «Crear partida» y 'join'
  // al venir de «Unirme», que ya han decidido qué se hace.
  function networkSetup(kind,capacity=4,only='') {
    roomCapacity=capacity;
    stopNetwork();state=null;record=null;page='network';netKind=kind;
    const net=kind==='internet', ownName=esc(CT.Identidad?.propio?.() || '');
    const lead=only==='create'?(net?'Cada uno juega desde su móvil, estéis donde estéis.':'Conectad todos los móviles a la misma red Wi-Fi. Quien crea la sala debe mantenerla abierta mientras jugáis.'):net?'Cread una sala o uníos con su código. También podéis volver más tarde para seguir por turnos.':'Conectad todos los móviles a la misma red Wi-Fi. Quien crea la sala debe mantenerla abierta.';
    shell(`<section class="setup-section"><h2 data-focus tabindex="-1">${capacity===2?'Duelo de Retos rápidos':net?'Sala por internet':'Sala por Wi-Fi'}</h2><p class="lead">${lead}</p>
      <div class="online-entry-grid${only?' online-entry-single':''}">
        ${only==='create'?'<textarea id="quick-net-code" hidden></textarea>':`<section class="panel online-form">${only?'':'<span class="form-number">01</span>'}<h3>Unirme a una partida</h3><p>${net?'Usa el código, el enlace o el QR de quien creó la sala.':'Pega la invitación o escanea su código QR.'}</p>
          <div class="field"><label for="quick-net-code">${net?'Código o enlace de sala':'Invitación recibida'}</label><textarea id="quick-net-code" rows="2"></textarea></div>
          <div class="field"><label for="quick-net-name-join">Tu nombre</label><input id="quick-net-name-join" maxlength="18" value="${ownName}"></div>
          ${button('scan-code','Escanear código QR','btn btn-secondary btn-block')}${button('join-room','Unirme <span>→</span>','btn btn-primary btn-block')}</section>`}
        ${only==='join'?'':`<section class="panel online-form">${only?'':'<span class="form-number">02</span>'}<h3>Crear una sala</h3><p>Tú preparas la partida y compartes el código, el enlace o el QR.</p>
          <div class="field"><label for="quick-net-name">Tu nombre</label><input id="quick-net-name" maxlength="18" value="${ownName}"></div>${capacity===2?'':`<div class="field"><label for="quick-net-players">Participantes</label><select id="quick-net-players">${[2,3,4].map(n=>`<option value="${n}"${n===capacity?' selected':''}>${n} jugadores</option>`).join('')}</select></div>`}<div class="field"><label for="quick-net-length">Duración de la partida</label><select id="quick-net-length"><option value="1">1 reto · partida rápida</option><option value="3" selected>3 retos · partida estándar</option><option value="5">5 retos · partida larga</option></select></div>
          ${button('create-room',only?'Crear sala <span>→</span>':'Crear sala',only?'btn btn-primary btn-block':'btn btn-secondary btn-block')}</section>`}
      </div>
      ${net && readJSON(NET) ? button('reconnect','Volver a mi sala','btn btn-secondary btn-block') : ''}
      <p class="hint">El primer turno rota en cada reto.</p><p id="quick-error" role="alert"></p></section>`);
  }
  // Aviso breve (el mismo cartel de toda la aplicación) para lo que pasa fuera de la pantalla en la que se está.
  function notice(message) {
    CT.announce?.(message);
    CT.toast(message, 3500);
  }
  // Quien lleva la sala te ha echado de la sala de espera: no queda sala que enseñar ni a la que volver sola.
  function kickedOut() {
    CT.Storage.removeItem(NET);
    toEntry();
    notice('El anfitrión te ha sacado de la sala.');
  }
  function roomChanged(next,id,code) {
    if(room&&!room.config&&room.members.includes(id)&&!next.members.includes(id)&&next.phase==='lobby'){kickedOut();return;}
    const wasLobby=page==='network-lobby'&&!room?.config;
    const previous=serverRoom;
    const freshOwnPlace=room && previous && room.members.includes(id) && next.commands.length===previous.commands.length+1
      && previous.actor===id && next.commands.at(-1)?.type==='place';
    serverRoom=next;
    if(!backTo&&next.capacity<=DUEL_CAP&&next.config?.kind==='duel'&&!next.matchmaking)backTo=()=>window.dispatchEvent(new CustomEvent('continuum:duels-list'));
    room=CT.QuickRoom.validate(withOutbox(next,id,code));myId=id;busy=false;page='network-lobby';
    if(readOutbox()&&!flushing&&navigator.onLine!==false)void flushOutbox();
    if(code)CT.Storage.setItem(NET,JSON.stringify({code,name:room.names[room.members.indexOf(id)],duel:duelRoom,len:roomLength,...(duelDeck?{deck:duelDeck}:{})}));
    if(room.config){
      const starting=wasLobby && !room.commands.length;
      record=CT.QuickRoom.record(room);state=E.restore(record);if(freshOwnPlace)CT.Effects?.feedback(state.result.correct);
      // Te toca: el turno acaba de pasar a tu plaza.
      if(previous?.config && previous.actor!==id && room.actor===id && state.phase==='turn')CT.Effects?.transition?.('turn');
      // Al empezar la partida de la sala, la portada del primer mazo, como en el resto de Retos rápidos.
      // Va antes de pintar la mesa para que el reloj de la primera jugada espere a que se retire.
      if(starting)deckSplash(state.config,0);
      selected=null;slot=null;render();
    }
    else {
      lobby(code || connection?.code);
      if(duelRoom && myId===room.host && !duelStarting){duelStarting=true;void networkAction({type:'start',rounds:duelRounds(roomLength||3),kind:'duel',historyId:historyId(),...(duelDeck?{hand:duelHand}:{keep:duelKeep()}),seconds:CT.Tiempo.get('amigos',15),first:duelFirst}).then(()=>{duelStarting=false;});}
    }
  }
  // Mesa pública de Retos rápidos: la misma sala de espera que en Grandes colecciones.
  // Empieza sola al completarse o, con al menos dos personas, cuando pasan 30 s sin que
  // entre nadie más; se puede dejar de buscar sin dejar la plaza ocupada.
  // Quién empieza en una sala en directo, como en las colecciones: se sortea una carta, cada persona
  // escribe su cifra y empieza quien más se acerca. En una mesa pública se sortea sola.
  function roomStarterMarkup(auto) { return `<div class="starter-presentation starter-inline">${roomStarterContent(auto)}</div>`; }
  function roomStarterContent(auto) {
    const host=myId===room.host, count=room.members.length, s=room.starter, head='<div class="section-label">Quién empieza</div>';
    // Quien lleva la sala solo ve «Empezar» (botón `start-room`): al pulsarlo sale la carta del minijuego.
    if(!s&&host&&!auto)return '';
    if(count<2)return `${head}<p class="hint">Cuando haya dos personas se sortea una carta y empieza quien más se acerque a su cifra.</p>`;
    if(!s)return `${head}<p class="hint">${auto?'Sorteando la carta…':'El anfitrión sorteará una carta para decidir quién empieza.'}</p>`;
    const card=CT.cards(s.modeKey).find(c=>c.id===s.cardId);
    if(!card)return `${head}<p class="hint">Preparando la carta…</p>`;
    const regla=CT.axis(s.modeKey).cifra||{}, mine=Number.isFinite(s.guesses[myId]), done=CT.QuickRoom.starterComplete(room);
    const cardBox=(revealed=false)=>CT.StarterPresentation.plate(s.modeKey,card,revealed);
    const redo=host&&!auto?`${CT.StarterPresentation.repeatButton('data-quick="room-starter-draw"')}`:'';
    if(!mine)return `${head}${cardBox()}${CT.StarterPresentation.answer(s.modeKey,'quick-room-starter-input')}<button type="button" class="btn btn-primary btn-block" data-quick="room-starter-guess">Adivinar <span>→</span></button>${redo}`;
    if(!done){
      const faltan=room.members.filter(who=>!Number.isFinite(s.guesses[who])).map(who=>esc(room.names[room.members.indexOf(who)]));
      return `${head}${cardBox()}<p class="hint">Has respondido. Esperando a: ${faltan.join(', ')}.</p>${redo}`;
    }
    const order=CT.QuickRoom.starterOrder(room);
    CT.Effects?.starterResult?.(`quick:${connection?.code||''}:${s.cardId}:${Object.keys(s.guesses).join(',')}`);
    const list=CT.StarterPresentation.order(order.map(i=>({name:room.names[i],value:CT.Duelo.Cifras.formato(s.modeKey,s.guesses[room.members[i]])})));
    return `${head}${cardBox(true)}${CT.StarterPresentation.winner(room.names[order[0]])}${list}${redo}`;
  }
  async function roomStarterAction(action) {
    if(action==='room-starter-draw'){await networkAction({type:'starter-draw',...CT.QuickRoom.starterPick()});return true;}
    if(action==='room-starter-guess'){
      const field=app().querySelector('#quick-room-starter-input'), s=room?.starter;
      const value=s?CT.Duelo.Cifras.leer(s.modeKey,field?field.value:''):null;
      if(value===null){field?.setAttribute('aria-invalid','true');field?.focus();return true;}
      await networkAction({type:'starter-guess',value});return true;
    }
    return false;
  }
  function publicLobby() {
    clearInterval(publicClock);publicClock=null;
    const draft=app().querySelector('#quick-room-starter-input')?.value||'';
    const count=room.members.length, cap=room.capacity, left=()=>connection?.secondsLeft?.() ?? 30;
    const clock=CT.Tiempo.minutos;
    const status=()=>count<2
      ? `<div class="public-status-title">Buscando jugadores…</div><p>En cuanto entre alguien más, empieza una cuenta atrás de 30 s.</p>`
      : left()===0 || count>=cap ? `<div class="public-status-title">Empezando la partida…</div><p>Preparando los retos.</p>`
      : `<div class="public-status-title">La partida empieza en <b id="quick-public-clock" class="public-clock">${clock(left())}</b></div><p>Puede entrar alguien más (${count} de ${cap}). Si entra, la cuenta vuelve a 30 s.</p>`;
    const seats=Array.from({length:cap},(_,i)=>{
      const mine=room.members[i]===myId, name=mine?room.names[i]:room.names[i]&&(CT.Moderacion?.visible?.(room.names[i])??room.names[i]);
      return name ? `<li class="public-seat${mine?' is-you':''}"><span class="public-seat-avatar">${playerAvatar({name},i)}</span><span class="public-seat-copy"><b>${esc(name)}${mine?' <span class="public-you">tú</span>':''}</b><small>En la mesa</small>${mine?'':CT.Moderacion?.botonDenuncia(room.members[i],name,'mesa')||''}</span></li>`
        : `<li class="public-seat is-empty"><span class="public-seat-avatar" aria-hidden="true">+</span><span class="public-seat-copy"><b>Plaza libre</b><small>Esperando a alguien…</small></span></li>`;
    }).join('');
    shell(`<section class="setup-section public-lobby"><div class="eyebrow"><span class="eyebrow-line"></span> Mesa pública · hasta ${cap} jugadores</div><h2 data-focus tabindex="-1">Retos rápidos</h2><p class="hint">Tres retos con las mismas cartas para toda la mesa. Arriesga para sumar aciertos o plántate para asegurarlos. ${connection?.seconds ? `${connection.seconds} s por carta.` : 'Sin límite de tiempo.'}</p>
      <div class="panel public-status" role="status" aria-live="polite">${status()}</div>
      <div class="panel public-roster"><div class="section-label">Jugadores <small>${count}/${cap}</small></div><ul class="public-seats">${seats}</ul></div>
      <div class="panel public-starter">${roomStarterMarkup(true)}</div>
      ${button('leave-public','Dejar de buscar','btn btn-ghost btn-block')}<p id="quick-error" role="alert"></p></section>`);
    if(draft){const input=app().querySelector('#quick-room-starter-input');if(input&&!input.value)input.value=draft;}
    publicClock=setInterval(()=>{const el=document.getElementById('quick-public-clock');if(!el||page!=='network-lobby'){if(!el)clearInterval(publicClock);return;}const s=left();el.textContent=clock(s);el.classList.toggle('is-low',s<=5);},500);
  }
  // Sala privada: la misma mesa de exploradores que en Grandes colecciones, con las plazas
  // repartidas alrededor según cuántos caben.
  const SEAT_SLOTS={2:[7,2],3:[0,3,6],4:[0,2,5,7],5:[0,2,3,6,7],6:[1,2,3,6,7,8],7:[0,1,2,3,6,7,8],8:[1,2,3,4,5,6,7,8],9:[0,1,2,3,4,5,6,7,8],10:[0,1,2,3,4,5,6,7,8,9]};
  // Duelo por turnos: no es una mesa. Quien lo crea manda el enlace y la partida empieza sola cuando el amigo lo abre.
  // Duelos por turnos de tu cuenta (los que has creado y los que te han mandado), desde cualquier móvil: salen de las salas
  // en las que estás, igual que los de Grandes colecciones salen de tu cuenta. Lo último que se supo se guarda en el móvil
  // para poder enseñar la lista sin conexión. Archivar un duelo terminado va con la cuenta (duelPreferences, como en las colecciones) y no afecta al cara a cara.
  const DUELS='continuum-quick-duels-v2';
  // Cómo se ve un duelo desde mi sitio: a quién le toca, en qué mazo y carta vais y el marcador.
  function duelRow(room,uid) {
    const at={seconds:typeof room.updatedAt==='number'?room.updatedAt:room.updatedAt?.seconds||Math.floor(Date.now()/1000)};
    const cfg=room.config,me=room.members.indexOf(uid),host=room.members[0]===uid;
    const details={length:cfg.rounds.length,keep:cfg.keep!==false,firstName:cfg.names[cfg.first||0],collection:deckOf(cfg),players:room.capacity,host,canCancel:host&&room.members.length===1&&room.phase!=='finished',canResign:room.capacity===2&&room.members.length===2&&room.phase!=='finished'};
    // Un reto que te han mandado y aún no has aceptado (o que has rechazado).
    const shown=n=>CT.Moderacion?.visible?.(n)??n;
    if(me<0&&room.declined)return {rival:shown(room.names[0]),rivalUid:room.host,rivalIn:false,me:'',deck:E.challenge(cfg.rounds[0].id).title,marcador:'',updatedAt:at,grupo:'historial',pendiente:false,estado:'Rechazaste el reto',detalle:'Cerrado',done:true,...details};
    if(me<0)return {rival:shown(room.names[0]),rivalUid:room.host,rivalIn:false,me:'',deck:E.challenge(cfg.rounds[0].id).title,marcador:'',updatedAt:at,grupo:'retado',pendiente:true,estado:`${shown(room.names[0])} te ha retado`,detalle:'Acéptalo para empezar',invited:true,...details};
    // De 2 a 4: cada plaza es de quien ya entró o, si no, espera con su nombre provisional (en el de dos, «tu amigo»).
    const s=E.restore(CT.QuickRoom.record(room)),cap=room.capacity,joined=room.members.length,pair=cap===2,other=1-me,friendIn=joined>1;
    const seat=i=>i<joined?shown(room.names[i]):pair?shown(room.invitedName||'tu amigo'):`Jugador ${i+1}`;
    const others=s.players.map((p,i)=>i).filter(i=>i!==me);
    const rival=pair?seat(other):(others.filter(i=>i<joined).map(seat).join(', ')||'tus amigos'),c=E.challenge(s.config.rounds[s.index].id),total=s.config.rounds[s.index].order.length-1;
    const col=E.isColDuel(cfg), mine=p=>p.score+p.points,mios=mine(s.players[me]),suyos=Math.max(...others.map(i=>mine(s.players[i])));
    // En un duelo de colección el marcador son las cartas que le quedan a cada uno.
    const cartas=i=>`${s.players[i].hand.length} ${s.players[i].hand.length===1?'carta':'cartas'}`;
    // El cara a cara cuenta duelos de dos: en uno de grupo no hay un único rival.
    const base={rival,rivalUid:pair?(friendIn?room.members[other]:room.invitedUid||null):null,rivalIn:pair?friendIn:joined===cap,me:room.names[me],deck:c.title,marcador:col?`Tú ${cartas(me)} · ${others.map(i=>`${seat(i)} ${cartas(i)}`).join(' · ')}`:`Tú ${mios} · ${others.map(i=>`${seat(i)} ${mine(s.players[i])}`).join(' · ')} aciertos`,updatedAt:at,...details};
    const where=col?`Vuelta ${s.round} · te quedan ${cartas(me)}`:`${deckOf(cfg)?'Ronda':'Mazo'} ${s.index+1} de ${s.config.rounds.length} · carta ${Math.max(1,Math.min(total,s.phase==='turn'?s.timeline.length:s.timeline.length-1))} de ${total}`;
    if(room.declined)return {...base,grupo:'historial',pendiente:false,estado:'Cancelado: rechazó tu reto',detalle:'Cerrado',done:true,marcador:''};
    if(room.resigned){const yo=room.resigned===uid;return {...base,grupo:'historial',pendiente:false,estado:yo?'Te rendiste':'Ganaste: tu rival se rindió',detalle:'Terminado',done:true,result:yo?'loss':'win'};}
    if(room.phase==='finished'){const result=col?(s.winners?.includes(me)?(s.winners.length>1?'draw':'win'):'loss'):mios>suyos?'win':mios<suyos?'loss':'draw';return {...base,grupo:'historial',pendiente:false,estado:{win:'Ganaste',loss:'Perdiste',draw:'Empate'}[result],detalle:'Terminado',done:true,result};}
    // Le toca a una plaza que aún nadie ha ocupado: se espera a que alguien abra el enlace.
    if(room.phase==='turn'&&s.current>=joined)return {...base,grupo:'enviada',pendiente:false,estado:pair?(room.invitedUid?`Esperando a que ${rival} acepte`:'Esperando a que tu amigo abra el enlace'):`Esperando a que entre ${seat(s.current)}`,detalle:where,marcador:pair?'':base.marcador};
    const mioTurno=room.actor===uid, turnoDe=room.phase==='round-end'?seat(0):seat(s.current);
    if(room.phase==='round-end')return mioTurno?{...base,grupo:'tu-turno',pendiente:true,estado:'Te toca',detalle:deckOf(cfg)?'Pasa a la siguiente ronda':'Pasa al siguiente mazo'}:{...base,grupo:'su-turno',pendiente:false,estado:`Turno de ${turnoDe}`,detalle:deckOf(cfg)?'Pasa a la siguiente ronda':'Pasa al siguiente mazo'};
    return mioTurno?{...base,grupo:'tu-turno',pendiente:true,estado:'Te toca',detalle:where}:{...base,grupo:'su-turno',pendiente:false,estado:`Turno de ${turnoDe}`,detalle:where};
  }
  const isDuel=room=>room.capacity<=DUEL_CAP&&room.config?.kind==='duel'&&!room.matchmaking;
  // Los duelos de tu cuenta con su estado actual. Sin conexión se enseña lo último que se supo.
  async function duels() {
    try{
      const rows=(await CT.QuickNetwork.mine()).filter(x=>isDuel(x.room)).map(x=>({...duelRow(x.room,x.uid),code:x.code}));
      CT.Storage.setItem(DUELS,JSON.stringify(rows));
      return rows;
    }catch{const cached=readJSON(DUELS,[]);return (Array.isArray(cached)?cached:[]).map(r=>({...r,stale:true}));}
  }
  // Entra en un duelo de la lista. `back` es a donde se vuelve al salir.
  // Crea un duelo nuevo con los mismos ajustes (revancha o reto desde el cara a cara). Empieza quien no abrió el anterior;
  // si se sabe contra quién es, el reto le llega a su lista de duelos, como en las colecciones.
  async function createDuelRoom({renderPage,name,length,keep,iStart,invite,back,deck=null,players=2,hand=4}) {
    paint=renderPage;entry='duel-setup';duelSetup();backTo=back||null;duelFirst=iStart?0:1;duelDeck=CT.has(deck)?deck:null;
    // El número de jugadores va por aquí y no por el desplegable (que solo llega a 4): en colecciones pueden ser hasta 10.
    duelPlayers=Math.min(Math.max(Number(players)||2,2),seatsMax());
    duelHand=Math.min(Math.max(Number(hand)||4,1),E.MAX_HAND);
    CT.Storage.setItem(DUEL_PACE,'turnos');CT.Storage.setItem(DUEL_KEEP,keep?'seguir':'fuera');
    pendingInvite=invite||null;
    app().querySelector('#quick-net-name').value=name||CT.Identidad?.propio?.()||'';
    app().querySelector('#quick-free-length').value=String(length||3);
    await connectRoom(true);
  }
  // Revancha o reto desde la lista: a partir de la fila de un duelo ya conocido.
  async function challenge(renderPage,code,back) {
    const row=(readJSON(DUELS,[])||[]).find(x=>x.code===code);
    if(!row||!row.rivalUid)throw Error('No se encuentra ese duelo.');
    if(CT.TurnDuel?.isBlocked?.(row.rivalUid))throw Error('Has bloqueado los retos de este rival.');
    // Solo se reta por su nombre a quien llegó a jugar en esa sala (las reglas lo exigen con `sourceRoom`); si no
    // entró nunca, el duelo nuevo se comparte por enlace, como uno sin rival.
    const invite=row.rivalIn===false?null:{uid:row.rivalUid,name:row.rival,source:code};
    await createDuelRoom({renderPage,name:row.me,length:row.length,keep:row.keep,iStart:row.me!==row.firstName,invite,back,deck:row.collection,players:row.players||2});
  }
  async function declineInvite(code) {await CT.QuickNetwork.actOnce(code,{type:'decline'});}
  // Un reto que te han mandado se ve antes de entrar: se acepta (entras y juegas tu turno) o se rechaza (el duelo se cierra).
  async function previewInvite(renderPage,code,back) {
    const row=(readJSON(DUELS,[])||[]).find(x=>x.code===code);
    if(!row)throw Error('No se encuentra ese reto.');
    paint=renderPage;entry='duel-setup';backTo=back||null;previewCode=code;
    shell(`<section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Duelo con un amigo · ${row.collection?'Grandes colecciones':'Retos rápidos'}</div><h2 data-focus tabindex="-1">${esc(row.rival)} te ha retado</h2></div></section>
      <section class="panel lobby-settings"><p>${row.collection?`Duelo por turnos de ${esc(row.deck)}: cada uno con su mano; si fallas, repones del mazo, y gana quien se queda sin cartas.`:`Duelo por turnos de Retos rápidos: ${row.length} ${row.length===1?'mazo':'mazos'}.`} ${row.keep?'Quien falla no suma esa carta, pero se juega todo el mazo.':'Quien falla pierde lo provisional y no juega más ese reto.'}</p><p class="hint">${esc(row.rival)} ya ha hecho su jugada: al aceptar verás cuál fue y seguirás tú.</p>
        ${button('accept-invite','Aceptar el reto <span>→</span>','btn btn-primary btn-block')}${button('decline-invite','Rechazar','btn btn-ghost btn-block exit-discard')}${button('back-invite','Volver a Tus duelos','btn btn-secondary btn-block')}<p id="quick-error" role="alert"></p></section>`);
  }
  async function resignDuel(code) {await CT.QuickNetwork.actOnce(code,{type:'resign'});}
  async function cancelInvitation(code) {await CT.QuickNetwork.cancelRoom(code);}
  function reshare(code) {return CT.LocalShare.shareSignal(roomUrl(code).href);}
  // Quien abre el enlace de una sala o de un duelo entra directo: sin formularios de sala. Solo pide el nombre si este
  // móvil aún no lo conoce (por ejemplo, al abrir el enlace en el navegador por primera vez).
  async function enterByLink(code) {
    const known=()=>CT.Identidad?.propio?.()||'';
    stopNetwork();state=null;record=null;page='network';netKind='internet';roomCapacity=2;duelRoom=false;
    shell(`<section class="setup-section"><div class="eyebrow"><span class="eyebrow-line"></span> Retos rápidos</div><h2 data-focus tabindex="-1">Entrando en la partida…</h2>
      <section class="panel lobby-settings"><div class="waiting-orbit"><span></span></div><p>Te estás uniendo con el enlace que te han mandado. Verás la última jugada y seguirás tú.</p>
        <textarea id="quick-net-code" hidden>${esc(roomCodeFromText(code))}</textarea>
        <div class="field" id="quick-link-name" hidden><label for="quick-net-name-join">Tu nombre</label><input id="quick-net-name-join" maxlength="18" value="${esc(known())}" autocomplete="nickname"></div>
        <div id="quick-link-go" hidden>${button('join-room','Entrar en la partida <span>→</span>','btn btn-primary btn-block')}</div>
        <p id="quick-error" role="alert"></p></section></section>`);
    // El perfil puede tardar un instante en cargar: se espera un poco antes de pedir el nombre.
    for(let i=0;i<15&&!known();i++)await new Promise(r=>setTimeout(r,100));
    const input=app().querySelector('#quick-net-name-join');if(input&&!input.value)input.value=known();
    if(!known()){app().querySelector('#quick-link-name')?.removeAttribute('hidden');app().querySelector('#quick-link-go')?.removeAttribute('hidden');}
    else{
      try{await connectRoom(false);}
      catch(e){errorNotice(e);app().querySelector('#quick-link-name')?.removeAttribute('hidden');app().querySelector('#quick-link-go')?.removeAttribute('hidden');}
    }
  }
  async function openRoom(renderPage,code,back) {
    const saved=(readJSON(DUELS,[])||[]).find(x=>x.code===code);
    paint=renderPage;entry='duel-setup';duelSetup();backTo=back||null;
    duelRoom=true;
    app().querySelector('#quick-net-name').value=saved?.me||CT.Identidad?.propio?.()||'';
    app().querySelector('#quick-net-code').value=code;
    await connectRoom(false);
  }
  // El móvil de quien creó el duelo, ya hecha su jugada: toca mandarle la partida al amigo, que sigue desde donde se ha quedado.
  function duelInvite() {
    // La plaza a la que le toca y que aún nadie ha ocupado (en el de dos, la del amigo). En un duelo de grupo lo ve cualquiera de
    // los que ya están: el enlace sirve igual para todos.
    const pair=room.capacity===2, seat=state.current>=room.members.length?state.current:room.members.length;
    const code=connection?.code, friend=esc(pair?state.players[1].name:`Jugador ${seat+1}`), jugadas=record.commands.filter(c=>c.type==='place'&&c.by===myId).length, invited=pair&&!!room.invitedUid;
    shell(`<section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> ${room?.capacity > 2 ? 'Duelo con amigos' : 'Duelo con un amigo'} · ${duelSection(state?.config)}</div><h2 data-focus tabindex="-1">Duelo en marcha</h2></div></section><section class="panel lobby-settings duel-invite"><div class="waiting-orbit"><span></span></div><h3>Le toca a ${invited||!pair?friend:'tu amigo'}</h3>
      <p>${jugadas?'Ya has hecho tu jugada. ':''}${invited?`El reto ya le aparece en su lista de duelos. Si quieres, mándale también el enlace.`:pair?'Mándale el enlace por WhatsApp, correo o como quieras: al abrirlo entra directo en la partida, ve tu última jugada y sigue desde ahí.':`Comparte el enlace: quien lo abra ocupa la siguiente plaza (sois ${room.members.length} de ${room.capacity}) y juega desde ahí.`}</p>
      ${code?button('share-room','Compartir enlace','btn btn-primary btn-block'):''}
      ${button('duels-list','Volver a Tus duelos','btn btn-secondary btn-block')}
      <p class="hint">La partida ya está en juego y se guarda: la verás en «Tus duelos», con a quién le toca.</p><p id="quick-error" role="alert"></p></section>`);
  }
  function duelWaiting(code,host) {
    const length=roomLength||3, keep=duelKeep(), friend=esc(room.names[0]);
    const rule=keep?'Quien falla no suma esa carta, pero se juega todo el mazo.':'Quien falla pierde lo provisional y no juega más ese reto.';
    shell(`<section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> ${room?.capacity > 2 ? 'Duelo con amigos' : 'Duelo con un amigo'} · ${duelSection(room?.config)}</div><h2 data-focus tabindex="-1">${host?'Duelo preparado':'Duelo en marcha'}</h2></div>
      <section class="panel lobby-settings"><div class="waiting-orbit"><span></span></div>
        ${host?`<h3>Esperando a tu amigo</h3><p>Mándale el enlace. En cuanto lo abra, empieza el duelo: ${duelDeck?`cada uno con su mano de ${duelHand} cartas, una carta por turno desde su móvil.`:`${length} ${length===1?'mazo':'mazos'}, un turno cada uno desde su móvil. ${rule}`}</p>${room.members.length>=2?button('start-room','Empezar el duelo <span>→</span>','btn btn-primary btn-block'):button('share-room','Compartir enlace','btn btn-primary btn-block')}<p class="hint">La partida se guarda entre turnos: puedes dejarla y volver cuando quieras.</p>`
          :`<h3>Esperando a ${friend}</h3><p>El duelo empieza en cuanto ${friend} lo abra en su móvil.</p>`}
        <p id="quick-error" role="alert"></p></section>`);
  }
  function lobby(code) {
    if(room.matchmaking==='public'){state=null;publicLobby();return;}
    clearInterval(publicClock);publicClock=null;
    const draft=app().querySelector('#quick-room-starter-input')?.value||'';
    state=null;const host=myId===room.host, cap=room.capacity, count=room.members.length;
    if((duelRoom && cap<=DUEL_CAP) || (cap===2 && !host && room.invitedUid)) {duelWaiting(code,host);return;}
    const slots=SEAT_SLOTS[cap]||SEAT_SLOTS[8], table=Array(cap===10?10:9).fill('<div class="table-seat is-unused" aria-hidden="true"></div>');
    slots.forEach((slot,i)=>{
      const mine=room.members[i]===myId, name=mine?room.names[i]:room.names[i]&&(CT.Moderacion?.visible?.(room.names[i])??room.names[i]);
      table[slot]=name
        ? `<div class="table-seat occupied${mine?' is-you':''}"><span class="seat-avatar">${CT.Avatares.forUser(name,room.members[i],{size:44})}</span><strong>${esc(name)}${mine?' · tú':''}</strong><small>${room.members[i]===room.host?'Anfitrión':`Plaza ${i+1}`}</small><i class="ready-seal">Listo</i>${host&&room.members[i]!==room.host?`<button class="kick-btn" data-quick="kick" data-uid="${esc(room.members[i])}" aria-label="Expulsar a ${esc(name)}">×</button>`:''}</div>`
        : `<div class="table-seat empty" aria-label="Plaza ${i+1} libre"><span>+</span><small>Libre</small></div>`;
    });
    const length=roomLength||3;
    const side=host
      ? `<div class="section-label">Partida</div><p>${length} ${length===1?'reto':'retos'} con las mismas cartas para toda la sala. El primer turno rota en cada reto.</p>
        ${count<2?'<div class="waiting-orbit"><span></span></div><p class="hint">Esperando a alguien más…</p>':''}
        <div class="field starter-field">${roomStarterMarkup(false)}</div>
        ${!room.starter?`${button('start-room','Empezar <span>→</span>','btn btn-primary btn-block')}<p class="hint">Al empezar, un minijuego decide quién abre la partida: todos respondéis a la misma carta.</p>`:CT.QuickRoom.starterComplete(room)?button('start-room','Empezar la partida <span>→</span>','btn btn-primary btn-block'):''}
        ${connection?.kind==='local'?button('invite-peer','Invitar otro móvil','btn btn-secondary btn-block'):''}`
      : `<div class="field starter-field">${roomStarterMarkup(false)}</div><div class="waiting-orbit"><span></span></div><h3>Esperando al anfitrión</h3><p>La partida comenzará en todos los móviles al mismo tiempo.</p>`;
    shell(`<section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Sala de espera · Retos rápidos</div><h2 data-focus tabindex="-1">Preparando la sala</h2></div>
      <div class="room-code-card"><small>${code?'Código de sala':'Red Wi-Fi local'}</small><strong>${code?esc(code):count+'/'+cap}</strong>${code?`<div class="room-invite-actions"><button data-quick="share-room">Compartir enlace</button><button data-quick="qr-room">Mostrar QR</button></div>`:''}</div></section>
      <div class="online-lobby-grid"><section class="panel lobby-table-panel"><div class="section-label">Jugadores en la sala <small>${count}/${cap}</small></div><div class="lobby-table" data-seats="${cap===10?10:9}"><div class="lobby-table-core"><span>CONTINUUM</span><strong>${count}</strong><small>${count===1?'explorador':'exploradores'}</small></div>${table.join('')}</div><p class="lobby-ready-note"><i>Listo</i> La plaza queda preparada al entrar en la sala.</p></section>
        <section class="panel lobby-settings">${side}<p id="quick-error" role="alert"></p></section></div>`);
    if(draft){const input=app().querySelector('#quick-room-starter-input');if(input&&!input.value)input.value=draft;}
    const start=app().querySelector('[data-quick="start-room"]');if(start)start.disabled=count<2;
  }
  async function connectRoom(create) {
    // Desde «Partida con amigos», solo el ritmo «Por turnos» crea un duelo; en directo es una sala.
    if(create)duelRoom=page==='duel-setup'&&duelPace()==='turnos';
    // El duelo por turnos va siempre por internet, aunque antes se probara una sala por Wi-Fi desde esta pantalla.
    // Las alternativas ya las dice el aviso de encima del botón; el error solo dice qué ha pasado.
    if(create&&duelRoom){netKind='internet';if(navigator.onLine===false)throw Error('Sin internet no se puede crear un duelo por turnos.');}
    const nameInput=app().querySelector(create?'#quick-net-name':'#quick-net-name-join') || app().querySelector('#quick-net-name'), name=nameInput.value.trim();if(!name)throw Error('Escribe tu nombre.');{const rechazado=CT.Moderacion?.problema(name);if(rechazado)throw Error(rechazado);}
    // Un duelo por turnos es de 2 a 4, como cualquier partida de Retos rápidos con amigos.
    if (create) roomCapacity = duelRoom ? (duelPlayers ?? Math.min(Math.max(Number(app().querySelector('#quick-duel-group')?.value)||2,2),MAX_FRIENDS)) : Number(app().querySelector('#quick-net-players')?.value) || roomCapacity;
    // La duración que se eligió al crear la sala; en la sala ya no hay desplegable, y sin esto siempre eran 3 retos.
    if (create) roomLength = Number(app().querySelector('#quick-net-length')?.value || app().querySelector('#quick-free-length')?.value) || 3;
    let code=app().querySelector('#quick-net-code').value.trim();
    const epoch=networkEpoch, change=(...args)=>{if(epoch===networkEpoch)roomChanged(...args);}, fail=e=>{if(epoch===networkEpoch)errorNotice(e);};
    if(netKind==='internet') {
      code=roomCodeFromText(code);
      const invite=create?pendingInvite:null;pendingInvite=null;
      const opened=await CT.QuickNetwork.internet({create,code,name,capacity:roomCapacity,invite,catalog:create&&duelDeck?CT.QuickNetwork.collectionFingerprint():null,onChange:change,onError:fail});
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
    try{await connection.act(action);}
    catch(e){
      // Sin conexión, la jugada de un duelo por turnos se guarda en este móvil y se envía sola al volver, como en las colecciones.
      if(isOffline(e)&&room?.config?.kind==='duel'&&room.phase!=='finished')queueOffline(action);
      else errorNotice(e);
    }
    finally{busy=false;}
  }
  // Jugadas sin conexión de un duelo por turnos: se guardan con la revisión de la sala en la que se hicieron. Mientras el
  // servidor no las tenga, se enseñan puestas encima de lo último que llegó, y se mandan una a una al recuperar la conexión.
  const OUTBOX='continuum-quick-outbox-v1';
  const isOffline=e=>e?.code==='unavailable'||e?.code==='deadline-exceeded'||/offline|network/i.test(e?.message||'')||(typeof navigator!=='undefined'&&navigator.onLine===false);
  const readOutbox=()=>{const o=readJSON(OUTBOX,null);return o&&typeof o.code==='string'&&Array.isArray(o.actions)&&o.actions.length?o:null;};
  const outboxHere=()=>{const o=readOutbox();return o&&room&&o.code===connection?.code&&o.uid===myId?o:null;};
  let flushing=false,flushTimer=null;
  function queueOffline(action) {
    const code=connection?.code,old=readOutbox(),o=old&&old.code===code&&old.uid===myId?old:{code,uid:myId,base:serverRoom.revision,commands:serverRoom.commands.slice(),actions:[]};
    o.actions.push(action);
    try{CT.Storage.setItem(OUTBOX,JSON.stringify(o));}catch{errorNotice(Error('No hay espacio para guardar tu jugada. Libera almacenamiento y vuelve a intentarlo.'));return;}
    roomChanged(serverRoom,myId,code);
    clearTimeout(flushTimer);flushTimer=setTimeout(flushOutbox,15000);
  }
  // Pone las jugadas pendientes sobre la sala que acaba de llegar. Las que el servidor ya tiene se descuentan.
  function withOutbox(next,id,code) {
    const o=readOutbox();if(!o||o.code!==(code||connection?.code)||o.uid!==id)return next;
    // Solo un comando confirmado da por recibida una jugada pendiente: una entrada en la sala también sube la revisión.
    if(!Array.isArray(o.commands)){
      if(next.revision!==o.base){setTimeout(()=>errorNotice(Error('Hay una jugada pendiente de una versión anterior. Revisa el duelo antes de continuar.')),0);return next;}
      o.commands=next.commands.slice();CT.Storage.setItem(OUTBOX,JSON.stringify(o));
    }
    if(JSON.stringify(next.commands.slice(0,o.commands.length))!==JSON.stringify(o.commands))return next;
    const tail=next.commands.slice(o.commands.length);
    let confirmed=0;
    while(confirmed<tail.length&&confirmed<o.actions.length&&CT.QuickRoom.sameCommand(tail[confirmed],o.actions[confirmed],id))confirmed++;
    if(confirmed){o.commands=o.commands.concat(tail.slice(0,confirmed));o.actions.splice(0,confirmed);o.base=next.revision;
      if(!o.actions.length){CT.Storage.removeItem(OUTBOX);return next;}
      CT.Storage.setItem(OUTBOX,JSON.stringify(o));
    }
    if(tail.length>confirmed){setTimeout(()=>errorNotice(Error('La partida avanzó. Revisa tu jugada pendiente antes de continuar.')),0);return next;}
    try{return o.actions.reduce((r,a)=>CT.QuickRoom.reduce(r,id,a),next);}
    catch{setTimeout(()=>errorNotice(Error('La partida cambió y tu jugada pendiente no se puede aplicar.')),0);return next;}
  }
  async function flushOutbox() {
    if(flushing)return;
    let o=readOutbox();if(!o)return;
    // Nunca se mandan jugadas pendientes con la cuenta de otra persona que haya entrado en este móvil.
    const uid=CT.Accounts?.user?.uid;
    if(uid!==o.uid)return;
    if(!Array.isArray(o.commands))return;
    flushing=true;
    try{
      while(o&&o.actions.length){
        const sent=o.actions[0],base=o.commands;
        await CT.QuickNetwork.actOnce(o.code,sent,{commands:base,uid:o.uid});
        const current=readOutbox();
        if(!current||current.code!==o.code||current.uid!==o.uid)break;
        // Mientras la transacción esperaba, una instantánea pudo dar ya por recibida esta jugada.
        if(JSON.stringify(current.commands)===JSON.stringify(base)){
          current.actions.shift();current.commands.push(CT.QuickRoom.sign(sent,o.uid));current.base++;
          if(current.actions.length)CT.Storage.setItem(OUTBOX,JSON.stringify(current));else CT.Storage.removeItem(OUTBOX);
        }
        o=readOutbox();
      }
    }catch(e){
      if(isOffline(e)){clearTimeout(flushTimer);flushTimer=setTimeout(flushOutbox,15000);}
      else errorNotice(e);
    }finally{flushing=false;}
  }
  window.addEventListener('online',flushOutbox);
  // Muestra el QR; si el texto no cabe en un código, lo dice en vez de dejar la pantalla igual.
  function showQrOrExplain(options) {
    if(!CT.LocalShare.showQr(options))throw Error('Este contenido es demasiado largo para un código QR. Usa «Compartir».');
  }
  // Enlace de invitación: en la app nativa location.href es capacitor://localhost, inútil para otro móvil.
  function roomUrl(code){return new URL(CT.Links.invitation({quickRoom:code}));}
  // Vale el enlace (con #quick-room=, ?quick-room= o cualquier texto con el código) o el código suelto.
  function roomCodeFromText(text){
    const raw=String(text||'').trim();
    try{const url=new URL(raw);const found=new URLSearchParams(url.hash.slice(1)).get('quick-room')||url.searchParams.get('quick-room');if(found)return found.trim();}catch{}
    const match=raw.match(/quick-room=([^&#\s]+)/);
    return match?decodeURIComponent(match[1]):raw;
  }
  // Abre la cámara y, al leer un código, sigue con `next`. Sin cámara lo explica.
  async function scanQrInto(title,hint,next) {
    if(!CT.QrScanner?.isSupported())throw Error('Este navegador no permite usar la cámara aquí.');
    await CT.LocalShare.scanQr({title,hint,onText:text=>{Promise.resolve(next(text)).catch(errorNotice);}});
  }
  async function formatAction(action) {
    if(action==='room-starter-draw'||action==='room-starter-guess')return roomStarterAction(action);
    if(action==='formats'){toEntry();return true;}
    if(action==='leave-public'){const leaving=connection;connection=null;clearInterval(publicClock);await leaving?.leave?.();toEntry();return true;}
    if(action==='share-duel'){await CT.LocalShare.shareSignal(duelLink());return true;}
    if(action==='live-room'){const net=app().querySelector('input[name="quick-live-net"]:checked')?.value||liveNet();netKind=net==='wifi'?'local':'internet';await connectRoom(true);return true;}
    if(action==='create-room'||action==='join-room'){await connectRoom(action==='create-room');return true;}
    // Sin la carta de quién empieza, «Empezar» la reparte primero (en el duelo por turnos no hay minijuego).
    if(action==='start-room'&&!duelRoom&&room&&!room.config&&!room.starter&&room.members.length>=2)return roomStarterAction('room-starter-draw');
    if(action==='start-room'){const count=Number(app().querySelector('#quick-net-length')?.value)||roomLength||3;await networkAction({type:'start',rounds:duelRoom?duelRounds(count):rounds(count,null,null,E.MULTI_CARDS),kind:duelRoom?'duel':'network',historyId:historyId(),keep:duelKeep(),seconds:CT.Tiempo.get('amigos',15),...(duelRoom?{first:duelFirst}:(()=>{const order=room?CT.QuickRoom.starterOrder(room):null;return Number.isInteger(order?.[0])?{first:order[0]}:{};})())});return true;}
    if(action==='rematch-room'){
      const cfg=state.config, me=state.players[room.members.indexOf(myId)].name, other=room.members.find(m=>m!==myId);
      const grupo=room.capacity>2;
      await createDuelRoom({renderPage:paint,name:me,length:cfg.rounds.length,hand:cfg.hand,keep:cfg.keep!==false,iStart:grupo||me!==cfg.names[cfg.first||0],deck:deckOf(cfg),players:room.capacity,invite:!grupo&&other?{uid:other,name:room.names[room.members.indexOf(other)],source:connection?.code}:null,back:backTo});
      return true;
    }
    if(action==='accept-invite'){const code=previewCode;await openRoom(paint,code,backTo);return true;}
    if(action==='decline-invite'){const code=previewCode;if(!window.confirm('¿Rechazar este reto? Se cerrará el duelo y a quien te retó le saldrá cancelado.'))return true;await declineInvite(code);previewCode=null;toEntry();return true;}
    if(action==='back-invite'){previewCode=null;toEntry();return true;}
    if(action==='share-room'){
      const url=roomUrl(connection.code),esperando=!!(room&&state&&page==='game'&&room.members.length<state.players.length);
      await CT.LocalShare.shareSignal(url.href);
      // Con el enlace ya mandado, el duelo sigue su curso esperando a tu amigo: se vuelve a la lista de duelos.
      if(esperando)toEntry();
      return true;
    }
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
      shell(`<section class="setup-section"><h2>Invita otro móvil</h2><div class="panel"><p>Comparte esta invitación. El otro móvil la pega en «Unirme a una partida» y te devuelve su respuesta.</p><div class="field"><textarea id="quick-signal" readonly rows="3">${esc(invite.signal)}</textarea></div>${button('share-signal','Compartir invitación','btn btn-primary btn-block')}${button('qr-signal','Mostrar QR de la invitación','btn btn-secondary btn-block')}<div class="field"><label for="quick-answer">Respuesta del otro móvil</label><textarea id="quick-answer" rows="3"></textarea></div>${button('scan-answer','Escanear QR de la respuesta','btn btn-secondary btn-block')}${button('accept-answer','Conectar','btn btn-secondary btn-block')}<p id="quick-error" role="alert"></p></div></section>`);return true;
    }
    if(action==='accept-answer'){await invite.accept(app().querySelector('#quick-answer').value.trim());lobby();return true;}
    if(action==='duels-list'){stopNetwork();state=null;record=null;backTo=null;window.dispatchEvent(new CustomEvent('continuum:duels-list'));return true;}
    if(action==='reconnect') {const saved=readJSON(NET);if(!saved)throw Error('No hay ninguna sala guardada.');networkSetup('internet');app().querySelector('#quick-net-name').value=saved.name;app().querySelector('#quick-net-name-join').value=saved.name;app().querySelector('#quick-net-code').value=saved.code;duelRoom=!!saved.duel;if(Number.isInteger(saved.len))roomLength=saved.len;duelDeck=CT.has(saved.deck)?saved.deck:null;await connectRoom(false);return true;}
    return false;
  }

  // Minijuego de «quién empieza» (un solo móvil): el orden resultante pasa a ser el orden de los nombres.
  let starter = null, starterDraw = null;
  const starterClose = () => {app().querySelector('[data-quick-starter]')?.remove(); starterDraw = null;};
  function starterPaint(html) {
    let layer = app().querySelector('[data-quick-starter]');
    if (layer) {layer.querySelector('.modal').innerHTML = html; layer.querySelector('[data-dialog-focus]')?.focus({preventScroll:true}); return;}
    layer = document.createElement('div'); layer.className = 'overlay'; layer.dataset.quickStarter = ''; layer.dataset.starterDialog = '';
    layer.innerHTML = `<div class="modal">${html}</div>`; app().append(layer); CT.openDialog(layer, true);
  }
  function starterFieldMarkup(names) {
    if (starter && starter.key === names.join('|')) {
      const order = starter.order.map(i => esc(names[i])).join(' → ');
      return `<span class="field-label">Quién empieza</span><p class="starter-result"><strong>${esc(names[starter.order[0]])}</strong> se ha acercado más y empieza.</p><p class="hint">Orden de juego: ${order}</p>${CT.StarterPresentation.repeatButton('data-quick="draw-starter"')}`;
    }
    return `<span class="field-label">Quién empieza</span>${CT.StarterPresentation.drawButton('data-quick="draw-starter"')}`;
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
    const {modeKey, card, names, step} = starterDraw;
    starterPaint(`${CT.StarterPresentation.heading(names[step], step, names.length)}${CT.StarterPresentation.plate(modeKey, card)}
      ${CT.StarterPresentation.answer(modeKey, 'quick-starter-input')}
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
    starter = {key: names.join('|'), order}; refreshStarterField(); CT.Effects?.starterResult?.();
    starterPaint(`${CT.StarterPresentation.winner(names[order[0]])}
      ${CT.StarterPresentation.plate(modeKey, card, true)}
      ${CT.StarterPresentation.order(order.map(i => ({name:names[i], value:CT.Duelo.Cifras.formato(modeKey, guesses[i])})))}
      <div class="actions"><button class="btn btn-primary btn-block" data-quick="starter-go">Empezar <span>→</span></button></div>`);
  }
  const button = (action, text, cls = 'btn btn-primary', attrs = '') => `<button class="${cls}" data-quick="${action}"${attrs ? ` ${attrs}` : ''}>${text}</button>`;
  function setup() {
    stopNetwork();page="setup";const solo=format!=="local";
    state = null; record = null; selected = null; slot = null;
    const saved = load();
    shell(`<section class="setup-section quick-local-setup"><h2 data-focus tabindex="-1">Retos rápidos</h2><p class="lead">${solo ? "Juega a tu ritmo: cada carta bien colocada suma un acierto y un fallo no te echa del reto." : "De 2 a 4 jugadores o equipos en un solo móvil."}</p><div class="panel">
      <div class="setup-block"><div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Jugadores</span></div>
      <div id="quick-names">${nameFields(solo ? 1 : 2, solo ? ["Tú"] : [CT.Identidad?.propio?.() || "Jugador 1"])}</div>
      ${solo ? '' : button('add-player', '<span aria-hidden="true">+</span> Añadir participante', 'btn btn-ghost')}</div>
      <div class="setup-block"><div class="setup-block-head"><span class="eyebrow"><span class="eyebrow-line"></span> Cómo empezar</span></div>
      ${lengthChips('quick-length',[...LONG_LENGTHS.filter(([n])=>n<CT.QuickCatalog.challenges.length),[CT.QuickCatalog.challenges.length,'Todo el catálogo']],'Duración de la partida')}
      ${solo ? '' : keepField()}
      ${CT.Tiempo.field(solo ? 'quick-solo' : 'quick-local')}
      <p class="hint">${solo ? "Juegas todas las cartas del reto; al final cuentan tus aciertos." : "Empieza quien gane el minijuego; el primer turno rota en cada reto."}</p></div>
      ${button('start', 'Empezar <span>→</span>', 'btn btn-primary btn-block')}
      ${saved ? button('resume', 'Continuar partida guardada', 'btn btn-secondary btn-block') : ''}
      <p id="quick-error" role="alert">${esc(error)}</p></div></section>
      <details class="panel quick-panel"><summary>Cómo se juega</summary><ol><li>Una carta revelada inicia la línea, sin contar como acierto.</li><li>Elige una de las cartas comunes y toca un hueco. Confirma para revelar el dato.</li>${solo ? '<li>Cada carta bien colocada suma un acierto.</li><li>Un fallo cuenta como fallo, pero sigues jugando hasta agotar las cartas del reto.</li>' : '<li>Acertar suma un acierto y pasa el turno.</li><li>Con «Arriesgar o plantarse», el acierto es provisional: en tu siguiente turno puedes plantarte para asegurarlo, y fallar pierde los de este reto y te retira. Los de retos anteriores se conservan.</li><li>Con «Seguir hasta el final», un fallo no suma pero sigues jugando.</li><li>Al agotarse las cartas, los aciertos pendientes se aseguran. El reto también termina si nadie sigue activo.</li>'}</ol><p>La carta fallada queda corregida en la línea. ${solo ? '' : 'Si queda una sola persona, puede seguir arriesgando. '} Los empates de valor admiten cualquier orden equivalente. Gana quien asegura más aciertos; un empate final se comparte.</p></details>`);
    if (!solo) {refreshStarterField(); app().querySelector('#quick-names')?.addEventListener('input', () => {if (starter && starter.key !== quickNames().join('|')) {starter = null;} refreshStarterField();});}
  }
  function nameFields(count, names = []) {
    return Array.from({length: count}, (_, i) => `<div class="player-row"><input id="quick-name-${i}" data-quick-name aria-label="Nombre del jugador o equipo ${i + 1}" maxlength="18" value="${esc(names[i] ?? `Jugador ${i + 1}`)}" autocomplete="off"><button class="remove" data-quick="remove-player" data-index="${i}" aria-label="Quitar jugador ${i + 1}" ${count <= 2 ? 'disabled' : ''}>×</button></div>`).join('');
  }
  function save() {
    if(room)return;
    CT.Storage.setItem(slotOf(record.config), JSON.stringify(record));
    if(record.config.kind==='free' && state.phase==='round-end' && state.index===record.config.rounds.length-1)CT.Storage.setItem(BEST,JSON.stringify(Math.max(Number(readJSON(BEST,0))||0,state.players[0].score)));
  }
  function dispatch(command) {
    if(room){if(myTurn())void networkAction(command);return;}
    const before = state.current;
    state = E.step(state, command);
    if (command.type === 'place') CT.Effects?.feedback(state.result.correct);
    // En un solo móvil, pasar el teléfono a otra persona suena como en Grandes colecciones.
    else if (state.players.length > 1 && state.phase === 'turn' && state.current !== before) CT.Effects?.transition?.('turn');
    record.commands.push(command); save(); selected = null; slot = null; render();
  }
  // Una ficha por jugador, con el nombre y su marcador: lo asegurado y, si lo hay, «+N» en juego (aciertos
  // provisionales de este reto). Con «seguir hasta el final» solo hay una cifra. Quien ya se ha plantado (✓) o
  // ha fallado (✕) lo lleva marcado; el nombre y las cifras se recortan solos, nunca se salen de la ficha.
  function scores() {
    const keep = E.keepPlaying(state), n = state.players.length;
    // En un duelo de colección el marcador son las cartas que le quedan a cada uno: gana quien se queda sin ninguna.
    if (isCol()) return `<div class="quick-scores" data-n="${n}" style="--cols:${Math.min(n, 4)}" role="group" aria-label="Cartas que le quedan a cada jugador">${state.players.map((p, i) => `<span class="quick-score${i === state.current ? ' is-active' : ''}"${i === state.current ? ' aria-current="true"' : ''} role="group" aria-label="${esc(`${playerName(p, i)}: ${p.hand.length} ${p.hand.length === 1 ? 'carta' : 'cartas'}`)}"><i class="quick-score-avatar">${playerAvatar(p, i)}</i><span class="quick-score-copy"><b>${esc(playerName(p, i))}</b><em><strong>${p.hand.length}</strong><small class="quick-score-open">${p.hand.length === 1 ? 'carta' : 'cartas'}</small></em></span></span>`).join('')}</div>`;
    return `<div class="quick-scores" data-n="${n}" style="--cols:${Math.min(n, 4)}" role="group" aria-label="Marcador">${state.players.map((p, i) => {
      const gone = p.status === 'gone', out = gone || (!keep && p.status === 'failed'), banked = !keep && p.status === 'banked';
      const label = `${playerName(p, i)}: ${gone ? `${p.score} asegurados. Ha salido de la partida` : keep ? `${p.points + p.score} ${p.points + p.score === 1 ? 'acierto' : 'aciertos'}. Sigue jugando` : `${p.score} asegurados, ${p.points} en juego. ${out ? 'Fuera de este reto' : banked ? 'Se ha plantado' : 'Sigue jugando'}`}`;
      const figures = keep ? `<strong>${p.score + p.points}</strong>` : `<strong>${p.score}</strong>${p.points && !out && !banked ? `<small class="quick-score-open">+${p.points}</small>` : ''}${banked ? '<small class="quick-score-state" aria-hidden="true">✓</small>' : out ? '<small class="quick-score-state" aria-hidden="true">✕</small>' : ''}`;
      return `<span class="quick-score${i === state.current ? ' is-active' : ''}${out ? ' is-out' : ''}${banked ? ' is-banked' : ''}"${i === state.current ? ' aria-current="true"' : ''} role="group" aria-label="${esc(label)}"><i class="quick-score-avatar">${playerAvatar(p, i)}</i><span class="quick-score-copy"><b>${esc(playerName(p, i))}</b><em>${figures}</em></span></span>`;
    }).join('')}</div>`;
  }
  // En solitario la única persona eres tú (se llama «Tú», no por tu nombre); en una sala,
  // el sitio que ocupa tu identificador. Los demás se reconocen por su nombre o su plaza.
  function playerAvatar(p, i) {
    const mine = room ? room.members?.[i] === myId : state.players.length === 1;
    if (mine) return CT.Avatares.markup(p.name, {size:28, seed:CT.Avatares.ownSeed(), id:CT.Avatares.ownId()});
    return CT.Avatares.forUser(p.name, room?.members?.[i], {size:28});
  }
  // Qué significa cada extremo de la línea, según la naturaleza de cada mazo.
  const ENDS = {
    'sports-players': ['Menos jugadores', 'Más jugadores'], drinks: ['Menos alcohol', 'Más alcohol'],
    festivities: ['Primera fecha', 'Última fecha'], social: ['Más antigua', 'Más reciente'],
    wwii: ['Más antiguo', 'Más reciente'], 'civil-war': ['Más antiguo', 'Más reciente'],
    kings: ['Más antiguo', 'Más reciente'], consoles: ['Más antigua', 'Más reciente'],
    oscars: ['Menos premios', 'Más premios'], 'companies-founded': ['Más antigua', 'Más reciente'],
    'timezones-june': ['Más por detrás', 'Más por delante'], 'cities-east-west': ['Oeste', 'Este'],
    'cities-north-south': ['Sur', 'Norte'], body: ['Arriba', 'Abajo'],
    'series-seasons': ['Menos temporadas', 'Más temporadas'], buildings: ['Más bajo', 'Más alto'],
    'rivers-spain': ['Más corto', 'Más largo'], 'foods-kcal': ['Menos kcal', 'Más kcal'],
    'albums-sales': ['Menos ventas', 'Más ventas'], stadiums: ['Menor aforo', 'Mayor aforo'],
    'capitals-altitude': ['Menor altitud', 'Mayor altitud'], 'eurovision-wins': ['Menos victorias', 'Más victorias'],
    storage: ['Menor capacidad', 'Mayor capacidad'], airports: ['Menos pasajeros', 'Más pasajeros'],
    metros: ['Red más corta', 'Red más larga'], 'companies-revenue': ['Menos facturación', 'Más facturación'],
    'spanish-tv': ['Más antiguo', 'Más reciente'], 'minimum-wages': ['Menor salario', 'Mayor salario'],
    poker: ['Más débil', 'Más fuerte']
  };
  // El mismo rótulo que las mesas de colecciones: «Línea temporal» si el reto va de fechas
  // y, si no, su regla («De menor a mayor altura…»), como «De más lento a más rápido».
  function timelineTitle(c) {
    if (c.timelineTitle) return c.timelineTitle;
    return /antigu|reciente|fecha|reinado|salida al mercado|estreno/i.test(c.rule || '') ? 'Línea temporal' : c.rule || 'Línea temporal';
  }
  function timelineEnds(c) {
    const m = /^De (.+?) a (.+)$/.exec(c.rule || '');
    const [left, right] = ENDS[c.id] || (m ? [m[1], m[2]] : ['Primero', 'Último']);
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    return `<div class="timeline-ends" aria-hidden="true"><span>← ${esc(cap(left))}</span><span>${esc(cap(right))} →</span></div>`;
  }
  function sourceLinks(item) {
    if (!item.source) return '';
    const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    return item.curiositySource && item.curiositySource !== item.source
      ? `${link(item.source, 'Fuente del dato')} · ${link(item.curiositySource, 'Fuente de la curiosidad')}`
      : link(item.source, 'Consultar fuente');
  }
  // La lámina en el aviso de resultado, igual que en Grandes colecciones (`CT.Art.button`): se ve
  // aquí mismo y se puede ampliar.
  function resultArt(item) {
    if (!item.image) return '';
    return `<button class="art-thumb" data-art-src="${esc(item.image)}" data-art-title="${esc(item.title)}" aria-label="Ver la ilustración de ${esc(item.title)} a pantalla completa"><img src="${esc(item.image)}" alt="" width="400" height="600" decoding="async"><span aria-hidden="true">Ampliar</span></button>`;
  }
  function cardMarkup(c, item) {
    return `<article class="timeline-card card-flippable animal-timeline-card" data-id="${item.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(item.title)}. Toca para ver la explicación."><div class="card-category">${esc(c.title)}</div><div class="card-visual"><img class="animal-card-art" src="${esc(item.image || 'assets/hero-quick-400.webp')}" alt="" width="400" height="600"></div><div class="card-content"><h3>${esc(item.title)}${item.artist?`<small class="quick-card-artist">${esc(item.artist)}</small>`:""}</h3><p>${esc(item.detail)}</p><div class="year">${esc(item.label)}</div></div></article>`;
  }
  // La línea tal y como se ve al resolver una jugada. Si se ha fallado, la carta aún no está en ella:
  // se enseña el hueco donde iba de verdad, igual que en Grandes colecciones, y entra al continuar.
  function resultLine(c, r, get) {
    // En un duelo de colección la carta fallada no entra en la línea: se descarta y se repone otra.
    if (isCol()) return state.timeline.map(id => cardMarkup(c, get(id))).join('');
    if (r.correct) return state.timeline.map(id => cardMarkup(c, get(id))).join('');
    const line = state.timeline.filter(id => id !== r.cardId), at = state.timeline.indexOf(r.cardId);
    return [...line.map((id, i) => resultGap(i, i === at) + cardMarkup(c, get(id))), resultGap(line.length, line.length === at)].join('');
  }
  const resultGap = (i, correct) => correct
    ? `<button class="slot slot-correct" disabled tabindex="-1" data-index="${i}" aria-label="Aquí iba la carta que acabas de fallar"><span>✦</span><small>Aquí</small></button>`
    : `<button class="slot" disabled tabindex="-1" data-index="${i}" aria-hidden="true"><span>${i === 0 ? '−' : '+'}</span></button>`;
  // Datos que usa la animación de corrección (a11y.js): qué carta, dónde la puso y dónde iba.
  const correctionAttrs = (r, item) => r.correct ? '' : ` data-correction-card="${esc(r.cardId)}" data-attempted-slot="${Number.isInteger(r.attempted) ? r.attempted : ''}" data-correct-slot="${state.timeline.indexOf(r.cardId)}" data-correction-title="${esc(item.title)}"${item.image ? ` data-correction-art="${esc(item.image)}"` : ''}`;
  // Lo que pasa tras colocar una carta, dicho a quien juega solo («Pierdes 2 aciertos…») o a una mesa
  // («Ana pierde 2 aciertos…»). Con 0 aciertos provisionales no hay nada que «perder»: se dice tal cual.
  function resultNote(r, p) {
    // (Sin depender de nada de fuera: la prueba extrae esta función suelta.)
    if (state.config && Number.isInteger(state.config.hand) && String(state.config.rounds?.[0]?.id || '').startsWith('col:')) {
      const name = esc(p.name), left = p.hand.length;
      if (r.correct) return left ? `Bien colocada. ${name} se queda con ${left} ${left === 1 ? 'carta' : 'cartas'}.` : `Bien colocada: ${name} se queda sin cartas.`;
      return r.returned ? `Esa carta no encaja. Ya no quedan cartas en el mazo: ${name} la conserva.` : `Esa carta no encaja: se descarta y ${name} repone otra del mazo. Sigue con ${left} ${left === 1 ? 'carta' : 'cartas'}.`;
    }
    const solo = !room && state.players.length === 1, name = esc(p.name);
    // Retos o rondas (duelo de colección), sin depender de nada de fuera de la función.
    const R_ = (reto, ronda) => String(state.config?.rounds?.[0]?.id || '').startsWith('col:') ? ronda : reto;
    const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
    if (r.keep) return `${r.correct ? 'Bien colocada.' : 'Esa carta no suma y pasa a su lugar correcto.'} ${solo ? 'Llevas' : `${name} lleva`} ${n(p.points, 'acierto', 'aciertos')}.`;
    if (r.correct) return solo ? `Tienes ${n(p.points, 'acierto provisional', 'aciertos provisionales')}.` : `${name} tiene ${n(p.points, 'acierto provisional', 'aciertos provisionales')}.`;
    const fuera = 'Al continuar, la carta pasa a su lugar correcto como referencia.';
    if (r.lost > 0) return solo ? `Pierdes ${n(r.lost, 'acierto', 'aciertos')} de ${R_('este reto y quedas fuera hasta el siguiente','esta ronda y quedas fuera hasta la siguiente')}. ${fuera}` : `${name} pierde ${n(r.lost, 'acierto', 'aciertos')} de ${R_('este reto y queda fuera hasta el siguiente','esta ronda y queda fuera hasta la siguiente')}. ${fuera}`;
    return solo ? `No tenías aciertos provisionales que perder, pero quedas fuera de ${R_('este reto hasta el siguiente','esta ronda hasta la siguiente')}. ${fuera}` : `${name} no tenía aciertos provisionales, pero queda fuera de ${R_('este reto hasta el siguiente','esta ronda hasta la siguiente')}. ${fuera}`;
  }
  // Lo último que hizo el rival (o quien sea), para verlo al entrar en el duelo: quién colocó qué carta y si acertó.
  // «Mismas cartas» en grupo: la clasificación de quienes ya han jugado y, si falta alguien, el enlace para el siguiente.
  function groupResult(heading, best, c) {
    const cfg = record.config, group = groupOf(cfg), rivals = Array.isArray(cfg.rivals) ? cfg.rivals : [];
    const rows = [...rivals.map(([name, score]) => ({name, score})), {name: 'Tú', score: best, me: true}].sort((a, b) => b.score - a.score);
    const faltan = Math.max(0, group - rows.length), top = rows[0].score, ganadores = rows.filter(r => r.score === top);
    const title = faltan ? 'Tu resultado' : ganadores.length > 1 ? (ganadores.some(r => r.me) ? 'Empate en cabeza' : `Empate: ${ganadores.map(r => esc(r.name)).join(' y ')}`) : ganadores[0].me ? '¡Has ganado!' : `Gana ${esc(ganadores[0].name)}`;
    shell(`${heading}<section class="panel quick-panel"><h2>${title}</h2>
      <ol class="quick-group-ranking">${rows.map(r => `<li${r.me ? ' class="is-you"' : ''}><b>${esc(r.name)}</b> · ${r.score} ${r.score === 1 ? 'acierto' : 'aciertos'}</li>`).join('')}</ol>
      ${faltan ? `<p>${faltan === 1 ? 'Falta 1 persona' : `Faltan ${faltan} personas`} de ${group}: pásale el reto a la siguiente. Jugará las mismas cartas y verá esta clasificación.</p>${button('share-duel', rivals.length ? 'Pasar el reto' : 'Retar a tus amigos', 'btn btn-primary btn-block')}<div class="field"><label for="quick-result-link">Enlace del reto</label><input id="quick-result-link" readonly value="${esc(duelLink())}"></div>` : `<p>Ya habéis jugado los ${group}.</p>`}
      ${collectionSummary()}
      ${button('duels-list', 'Volver a Tus duelos', 'btn btn-secondary btn-block')}
      <button class="btn btn-secondary" data-action="home">Guardar y volver al inicio</button>${button('abandon','Salir sin guardar','btn btn-ghost exit-discard')}</section>
      <details class="panel quick-panel"><summary>Ver el orden completo y las fuentes</summary><ol>${c.cards.filter(item => state.config.rounds[state.index].order.includes(item.id)).sort((a, b) => (a.value - b.value) * c.direction).map(item => `<li><strong>${esc(item.title)} · ${esc(item.label)}</strong><p>${esc(item.detail)} ${sourceLinks(item)}</p></li>`).join('')}</ol></details>`);
  }
  // La final de desempate de un duelo de colección: varios se quedaron sin cartas a la vez; cada finalista escribe en secreto
  // su cifra de una carta neutral y gana quien más se acerca (si empatan, otra carta).
  function colFinalView(heading, c) {
    const f = state.final, mode = c.collection, mine = mySeat(), iPlay = f.players.includes(mine) && !(mine in f.guesses) && state.current === mine;
    const names = f.players.map(i => esc(playerName(state.players[i], i))).join(' y ');
    const raw = c.cards.find(item => item.id === f.cardId)?.raw, plate = raw === undefined ? '' : CT.Final.question(mode, {...f, cardId: raw});
    shell(`${heading}<section class="panel quick-panel"><div class="eyebrow">Final de desempate</div><h2>${f.round > 1 ? 'Empate: otra carta' : 'Varios se han quedado sin cartas'}</h2>
      <p>Finalistas: ${names}. Cada uno escribe su cifra en secreto y gana quien más se acerque.</p>${plate}
      ${iPlay ? `${CT.Final.form(mode, 'data-quick-final-form')}<p id="quick-error" role="alert"></p>` : `<p class="hint">${f.players.every(i => i in f.guesses) ? 'Todos han respondido.' : `Esperando a ${esc(playerName(state.players[state.current], state.current))}.`}</p>`}
      ${button('exit', 'Salir de la sala', 'btn btn-ghost btn-block')}</section>`);
  }
  // El final de un duelo de colección: quién ha ganado y cuántas cartas le quedaban a cada uno.
  function colEndView(heading, c) {
    const winners = state.winners || [], names = winners.map(i => esc(playerName(state.players[i], i))), me = winners.includes(mySeat());
    const f = state.final, rank = f ? CT.Final.rank({players: f.players, target: f.target}, f.guesses) : null;
    const rows = state.players.map((p, i) => `<li${winners.includes(i) ? ' class="is-you"' : ''}><b>${esc(playerName(p, i))}</b> · ${p.hand.length} ${p.hand.length === 1 ? 'carta' : 'cartas'} · ${p.hits} ${p.hits === 1 ? 'acierto' : 'aciertos'}${f?.players.includes(i) && i in f.guesses ? ` · final: ${esc(CT.Final.value(c.collection, f.guesses[i]))}` : ''}</li>`).join('');
    shell(`${heading}<section class="panel quick-panel"><h2>${me ? '¡Has ganado!' : `Gana ${names.join(' y ')}`}</h2>
      <p>${f ? `Ganó la final con la cifra más cercana (valor real: ${esc(CT.Final.value(c.collection, f.target))}).` : 'Terminó la vuelta sin cartas en la mano.'}</p>
      <ul class="quick-group-ranking">${rows}</ul>
      ${room && room.members.length === room.capacity ? rematchButton() : ''}
      ${button('duels-list', 'Volver a Tus duelos', 'btn btn-secondary btn-block')}
      <button class="btn btn-secondary" data-action="home">Guardar y volver al inicio</button></section>
      <details class="panel quick-panel"><summary>Ver el orden completo de la línea y las fuentes</summary><ol>${[...state.timeline].map(id => c.cards.find(item => item.id === id)).map(item => `<li><strong>${esc(item.title)} · ${esc(item.label)}</strong><p>${esc(item.detail)} ${sourceLinks(item)}</p></li>`).join('')}</ol></details>`);
  }
  function lastNote() {
    if(!room||!record||state.phase!=='turn')return '';
    let s=E.create(record.config),last=null;
    for(const c of record.commands){const before=s.current,round=s.index;s=E.step(s,c);if(c.type==='place')last={by:before,cardId:c.cardId,correct:s.result.correct,round};}
    if(!last||last.by===room.members.indexOf(myId))return '';
    const item=E.challenge(record.config.rounds[last.round].id).cards.find(x=>x.id===last.cardId);
    if(!item)return '';
    return `<aside class="turn-duel-last" aria-label="Última jugada"><b>Última jugada</b><p>${esc(state.players[last.by].name)} ${last.correct?'acertó':'falló'} con «${esc(item.title)}» (${esc(item.label)}).</p></aside>`;
  }
  // «Revancha»: crea un duelo nuevo contra la misma persona, en el que empieza quien no abrió el anterior.
  function rematchButton() {
    const cfg=state.config, me=state.players[room.members.indexOf(myId)]?.name, iStart=me!==cfg.names[cfg.first||0];
    // En un duelo de grupo la revancha la empieza quien la crea y se comparte por enlace.
    if (room.capacity > 2) return button('rematch-room', 'Revancha: empiezas tú', 'btn btn-primary btn-block');
    return button('rematch-room', iStart ? 'Revancha: empiezas tú' : `Revancha: empieza ${esc(cfg.names.find(n => n !== me) || 'tu amigo')}`, 'btn btn-primary btn-block');
  }
  // Qué partida y qué reto se han pintado ya: al pasar al siguiente reto se enseña su portada, igual que al
  // empezar, en vez de soltar directamente las cartas. Reanudar una partida no la vuelve a enseñar.
  let shownGame = null, shownIndex = 0;
  // Plazo por jugada (config.seconds). La hora de inicio de cada turno se apunta una vez y se
  // recuerda aunque se repinte o se recargue: volver a entrar no regala un reloj nuevo.
  const TURN_START='continuum-quick-turn-v1';
  // Al salir con «Guardar y salir» el reloj se congela: se guarda lo que llevaba gastado (`elapsed`) y, al volver, sigue
  // desde ahí. Recargar la página sin pasar por ahí no lo para.
  function turnStartedAt(key){
    try{
      const saved=JSON.parse(CT.Storage.getItem(TURN_START)||'null');
      if(saved?.key===key&&Number.isFinite(saved.elapsed)){const at=Date.now()-Math.max(0,saved.elapsed);CT.Storage.setItem(TURN_START,JSON.stringify({key,at}));return at;}
      if(saved?.key===key&&saved.at<=Date.now())return saved.at;
    }catch{}
    const at=Date.now();try{CT.Storage.setItem(TURN_START,JSON.stringify({key,at}));}catch{}return at;
  }
  function timedTurn(){return !!state&&state.phase==='turn'&&!state.final&&myTurn()&&Number(state.config.seconds)>0&&!(room&&room.members.length<state.players.length&&state.current!==0);}
  function turnKey(){return `${state.config.historyId||'sin-id'}:${state.index}:${record?.commands?.length||0}`;}
  function stopClock(){quickClock?.stop();quickClock=null;}
  function pauseClock(){
    stopClock();
    if(room||!state||!timedTurn())return;
    try{const saved=JSON.parse(CT.Storage.getItem(TURN_START)||'null');if(saved?.key===turnKey()&&Number.isFinite(saved.at))CT.Storage.setItem(TURN_START,JSON.stringify({key:saved.key,elapsed:Date.now()-saved.at}));}catch{}
  }
  // En un solo móvil con varias personas y tiempo por carta, antes de cada turno se pasa el móvil: el reloj de quien
  // juega no empieza hasta que pulsa «Empezar mi turno». Antes corría mientras el móvil cambiaba de manos.
  let readyTurn=null;
  const needsHandoff=()=>!room&&!!state&&state.players.length>1&&state.phase==='turn'&&Number(state.config.seconds)>0&&readyTurn!==turnKey();
  // Cada acierto propio deja la carta en tu colección de Retos rápidos, como en Grandes colecciones.
  // Solo cuentan los de quien juega en este móvil (solo, reto diario, duelo por enlace) o, en una
  // sala, los de su plaza: en un móvil que se pasan varios no se sabe quién acertó.
  // `finds`: las cartas nuevas de esta partida, para celebrarlas y contarlas al final.
  let finds = {game: null, ids: []};
  function noteDiscovery() {
    const game = state?.config?.historyId || 'sin-id';
    if (finds.game !== game) finds = {game, ids: [...(Array.isArray(record?.found) ? record.found : [])]};
    const r = state?.result;
    if (state?.phase !== 'result' || !r?.correct) return false;
    const mine = room ? room.members?.[r.player] === myId : state.players.length === 1;
    if (!mine) return false;
    const c = E.challenge(state.config.rounds[state.index].id), item = c?.collection ? c.cards.find(card => card.id === r.cardId) : null;
    if (item ? CT.Progreso?.discover?.({mode: c.collection, cardId: item.raw, correct: true, mine: true}) : CT.Progreso?.discoverQuick?.(r.cardId)) {finds.ids.push(r.cardId); CT.Effects?.discovery?.(); if (record && !room) {record.found = finds.ids; save();}}
    return finds.ids.includes(r.cardId);
  }
  // Al acabar: cuántas cartas nuevas ha dejado la partida y cómo va la colección de cada mazo jugado.
  function collectionSummary() {
    if (!room && state.players.length !== 1) return '';
    noteDiscovery();
    const seen = quickSeen(), ids = [...new Set(state.config.rounds.map(r => r.id))];
    const n = finds.ids.length;
    const decks = ids.slice(0, 5).map(id => {const c = E.challenge(id); return `<li><b>${esc(c.title)}</b>${progressBar(deckProgress(c, seen))}</li>`;}).join('');
    return `<div class="quick-collection-summary"><p><span aria-hidden="true">✦</span> ${n ? `${n} ${n === 1 ? 'carta nueva' : 'cartas nuevas'} en tu colección.` : 'Ninguna carta nueva esta vez.'}</p><ul>${decks}</ul>${room ? '' : button('collection', 'Ver tu colección', 'btn btn-secondary btn-block', `data-deck="${esc(ids.at(-1))}"`)}</div>`;
  }
  // El final de la partida suena y vibra como en las colecciones; Retos rápidos no cambia de pantalla
  // al acabar, así que se avisa aquí. Solo si se ha visto llegar (no al reabrir una partida terminada).
  let lastPhase = null;
  function roundEndCue() {
    const game = state.config.historyId || 'sin-id', now = `${game}:${state.index}:${state.phase}`;
    const arrived = state.phase === 'round-end' && lastPhase && lastPhase !== now && lastPhase.startsWith(`${game}:${state.index}:`);
    lastPhase = now;
    if (arrived && state.index + 1 === state.config.rounds.length) CT.Effects?.transition?.('end');
  }
  // Quien mira la jugada de otro en una sala no abre la capa de resultado: la carta bien colocada
  // cae igualmente con su golpe, una sola vez aunque la sala repinte con cada instantánea.
  let celebrated = null;
  function celebrateOnce(r) {
    const key = `${state.config.historyId || 'sin-id'}:${state.index}:${record?.commands?.length || 0}`;
    if (!r?.correct || celebrated === key) return;
    celebrated = key;
    const placed = [...app().querySelectorAll('.timeline .timeline-card[data-id]')].find(el => el.dataset.id === String(r.cardId));
    if (placed) CT.celebrateCard?.(placed);
  }
  function render() {
    page="game";
    stopClock();
    const nextDeck = state.phase === 'turn' && shownGame === (state.config.historyId || 'sin-id') && state.index > shownIndex;
    shownGame = state.config.historyId || 'sin-id'; shownIndex = state.index;
    if (nextDeck) { const config = state.config, index = state.index; setTimeout(() => { if (state && state.index === index && page === 'game') deckSplash(config, index); }, 0); }
    saveHistory();
    roundEndCue();
    const c = E.challenge(state.config.rounds[state.index].id), p = state.players[state.current];
    const get = id => c.cards.find(item => item.id === id);
    topTitle = `${state.config.rounds.length === 1 ? '' : `${state.index + 1}/${state.config.rounds.length} · `}${esc(c.title)}`;
    const keep = E.keepPlaying(state);
    // Plantarse: botón a todo el ancho bajo la barra, para verlo a la primera. Siempre dice con cuántos puntos
    // te plantas (los aciertos provisionales de este reto); con ninguno va más discreto, con el mismo alto.
    const pass = keep ? '' : `<button class="quick-bank${p.points ? ' has-points' : ''}" data-quick="bank">${p.points ? '<span class="quick-bank-mark" aria-hidden="true">✓</span>' : ''}Plantarme con ${p.points} ${p.points === 1 ? 'acierto' : 'aciertos'}</button>`;
    const heading = `${room && outboxHere() ? '<p class="hint" role="status">Sin conexión: tu jugada está guardada en este móvil y se enviará sola al volver.</p>' : ''}${room ? `<p class="hint">${room.members.length < state.players.length ? (room.capacity === 2 ? 'Duelo por turnos: juega tu primera carta y después invita a tu rival con el enlace' : `Duelo por turnos · ${room.members.length} de ${room.capacity}: comparte el enlace para que entren los demás`) : myTurn() ? "Tu turno" : `Turno de ${esc(p.name)}`}${record?.config?.kind === 'duel' ? '' : ` · ${connection?.kind==='local' ? 'Misma Wi-Fi' : 'Sala por internet'}`}</p>` : ''}<h1 class="solo-lectores" data-focus tabindex="-1">${esc(c.title)}${!room && state.players.length === 1 ? '' : ` · Turno de ${esc(p.name)}`}</h1><div class="quick-bar${state.players.length > 2 ? ' quick-bar-many' : ''}"><span class="quick-left"><b>${handIds().length}</b> ${isCol() ? (handIds().length === 1 ? 'carta en tu mano' : 'cartas en tu mano') : 'por colocar'}</span>${scores()}</div>${state.phase === 'turn' && myTurn() ? pass : ''}`;
    if (room?.resigned) {
      const yo = room.resigned === myId, rival = esc(state.players.find((_, i) => room.members[i] !== myId)?.name || 'Tu rival');
      shell(`<section class="lobby-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> Duelo con un amigo · ${duelSection(state.config)}</div><h2 data-focus tabindex="-1">${yo ? 'Te has rendido' : `${rival} se ha rendido`}</h2></div></section>
        <section class="panel quick-panel"><p>${yo ? `${rival} gana este duelo. Se queda en tu historial.` : '¡Has ganado el duelo! Se queda en tu historial.'}</p>${rematchButton()}${button('duels-list', 'Volver a Tus duelos', 'btn btn-secondary btn-block')}</section>`);
      return;
    }
    // Le toca a una plaza del duelo que aún nadie ha ocupado: se espera a que alguien abra el enlace.
    const waitingFriend = room && state.phase === 'turn' && room.members.length < state.players.length;
    if (waitingFriend && state.current >= room.members.length) {duelInvite(); return;}
    if (isCol() && state.final && state.phase !== 'round-end') {colFinalView(heading, c); return;}
    if (isCol() && state.phase === 'round-end') {colEndView(heading, c); return;}
    if (state.phase === 'round-end') {
      const final = state.index + 1 === state.config.rounds.length;
      const best = Math.max(...state.players.map(player => player.score));
      const winners = state.players.filter(player => player.score === best).map(player => esc(player.name));
      const duelo = final && !room && record.config.kind==='duel' && Number.isFinite(record.config.rivalScore);
      if (final && !room && record.config.kind==='duel' && groupOf(record.config) > 2) {groupResult(heading, best, c); return;}
      shell(`${heading}<section class="panel quick-panel"><h2>${final ? duelo ? (best>record.config.rivalScore ? '¡Has ganado el duelo!' : best===record.config.rivalScore ? 'Empate' : `${esc(record.config.rivalName||'Tu rival')} gana`) : state.players.length===1 ? 'Tu resultado' : winners.length > 1 ? 'Victoria compartida' : `Gana ${winners[0]}` : R_('Reto terminado','Ronda terminada')}</h2>
        ${final ? `<p>${E.keepPlaying(state) && state.config.rounds.length === 1 ? `${best} de ${state.config.rounds[0].order.length - 1}` : `${winners.join(' y ')} · ${best} ${best === 1 ? 'acierto' : 'aciertos'}`}.</p>` : `<p>Los aciertos de ${R_('este reto','esta ronda')} ya están asegurados.</p>`}
        <ul>${state.players.map(player => E.keepPlaying(state) ? `<li>${state.players.length === 1 ? '' : `${esc(player.name)}: `}${player.roundScore} de ${state.config.rounds[state.index].order.length - 1} cartas bien colocadas en ${R_('este reto','esta ronda')}.</li>` : `<li>${esc(player.name)}: ${player.roundScore} ${player.roundScore === 1 ? 'acierto' : 'aciertos'} en ${R_('este reto','esta ronda')}.</li>`).join('')}</ul>
        ${final && record.achievements?.length ? `<p class="quick-new-card">✦ ${record.achievements.length === 1 ? `Logro: ${esc(record.achievements[0])}` : `${record.achievements.length} logros nuevos: ${record.achievements.map(esc).join(', ')}`}</p>` : ''}
        ${final ? collectionSummary() : ''}
        ${final && Number.isFinite(record.config.rivalScore) ? `<p>${esc(record.config.rivalName||'Tu rival')}: ${record.config.rivalScore} ${record.config.rivalScore===1?'acierto':'aciertos'}. Tú: ${best}. ${best > record.config.rivalScore ? '¡Has superado su resultado!' : best === record.config.rivalScore ? 'Habéis empatado.' : 'Ha asegurado más aciertos.'}</p>` : ''}
        ${final ? (record.config.kind==='duel' && !room ? '' : button('formats', 'Elegir otra partida')) : button('next', R_('Siguiente reto','Siguiente ronda'))}
        ${final && record.config.kind==='duel' && !room ? button('duels-list', 'Volver a Tus duelos', 'btn btn-primary btn-block') : ''}
        ${final && room && record.config.kind==='duel' && room.members.length===room.capacity ? rematchButton() : ''}
        ${final && record.config.kind==='daily' && CT.Accounts?.ready ? '<button class="btn btn-secondary" data-account-action="ranking">Ver ranking</button>' : ''}
        <button class="btn btn-secondary" data-action="home">Guardar y volver al inicio</button>${button('abandon','Salir sin guardar','btn btn-ghost exit-discard')}</section>
        <details class="panel quick-panel"><summary>Ver el orden completo y las fuentes</summary><ol>${c.cards.filter(item => state.config.rounds[state.index].order.includes(item.id)).sort((a, b) => (a.value - b.value) * c.direction).map(item => `<li><strong>${esc(item.title)} · ${esc(item.label)}</strong><p>${esc(item.detail)} ${sourceLinks(item)}</p></li>`).join('')}</ol></details>`);
      return;
    }
    if (state.phase === 'result') {
      const r = state.result, item = get(r.cardId), fresh = noteDiscovery();
      if(room && !myTurn()){shell(`${heading}${CT.timelineMap(null,state.timeline)}<div class="timeline-wrap"><div class="timeline">${resultLine(c,r,get)}</div></div><section class="panel quick-panel"><h2>${r.correct?'¡Bien colocado!':'No encaja ahí'}</h2><p>${esc(item.title)} · ${esc(item.label)}</p><p>Esperando a que continúe ${esc(p.name)}.</p></section>`);celebrateOnce(r);return;}
      shell(`${heading}${CT.timelineMap(null, state.timeline)}<div class="timeline-wrap"><div class="timeline">${resultLine(c, r, get)}</div></div><div class="overlay" data-quick-result data-result-card="${r.correct ? esc(item.id) : ''}"${correctionAttrs(r, item)}><section class="modal quick-result ${r.correct ? 'success' : 'failure'}"><div class="result-mark" aria-hidden="true">${r.correct ? '✓' : '×'}</div><div class="eyebrow" aria-hidden="true">${r.correct ? '¡Bien colocado!' : 'No encaja ahí'}</div><h2><span class="solo-lectores">${r.correct ? '¡Bien colocado!' : 'No encaja ahí'}: </span>${esc(item.title)}${item.artist?`<small class="quick-card-artist">${esc(item.artist)}</small>`:""}</h2>${fresh ? '<div class="quick-new-card"><span aria-hidden="true">✦</span> Nueva carta en tu colección</div>' : ''}<div class="reveal">${resultArt(item)}<div class="year">${esc(item.label)}</div><p>${esc(item.detail)}</p></div><p class="quick-sources">${sourceLinks(item)}</p>
        <p class="quick-result-note">${resultNote(r, p)}</p>
        ${button('ack', room && room.members.length < state.players.length ? 'Continuar y retar a mi amigo' : isCol() ? 'Siguiente turno <span>→</span>' : state.remaining.length ? 'Siguiente carta <span>→</span>' : 'Ver el resultado <span>→</span>', 'btn btn-primary btn-block')}${room ? button('exit','Salir de la sala','btn btn-ghost btn-block') : ''}</section></div>`);
      CT.openDialog(app().querySelector('[data-quick-result]'), false);
      return;
    }
    if (needsHandoff()) {
      shell(`${heading}<section class="pass-screen"><div class="panel pass-card"><div class="eyebrow">${esc(c.title)}</div><h2 data-focus tabindex="-1">El turno es de<br>${esc(p.name)}</h2><p>Pásale el móvil. Tendrá ${Number(state.config.seconds)} s por carta, que empiezan a contar cuando pulse el botón.</p>${button('turn-ready', 'Empezar mi turno <span>→</span>', 'btn btn-primary btn-block')}</div></section>`);
      return;
    }
    const gap = i => slot === i && selected ? `<div class="slot-confirm quick-confirm provisional-placement" data-index="${i}"><div class="slot-confirm-card"><small>Vista previa · sin confirmar</small><strong>${esc(get(selected).title)}</strong><span aria-hidden="true">Valor oculto</span></div>${button('confirm', 'Colocar carta →', 'btn btn-primary btn-block')}${button('cancel', 'Cambiar', 'btn btn-ghost btn-block')}</div>` : `<button class="slot" data-quick="slot" data-index="${i}" ${selected ? '' : 'disabled'} aria-label="${esc(i === 0 ? `Colocar antes de ${get(state.timeline[0]).title}` : i === state.timeline.length ? `Colocar después de ${get(state.timeline[i-1]).title}` : `Colocar entre ${get(state.timeline[i-1]).title} y ${get(state.timeline[i]).title}`)}"><span>${i === 0 ? '−' : '+'}</span></button>`;
    // Con la portada del mazo encima (o a punto de salir), el plazo aún no ha empezado: la barra
    // se ve llena y el reloj arranca cuando se toca la portada. Antes corría debajo de ella.
    const covered=nextDeck||(!!splashLayer&&!splashLayer.dataset.closed&&splashLayer.dataset.game===(state.config.historyId||'sin-id')&&splashLayer.dataset.index===String(state.index));
    const ms=Number(state.config.seconds)*1000, timed=timedTurn(), startedAt=timed&&!covered?turnStartedAt(turnKey()):0;
    shell(`${heading}${timed?CT.Tiempo.bar(covered?ms:ms-(Date.now()-startedAt),ms):''}${lastNote()}<section><div class="hand-title"><h3>${room && !isCol() ? 'Cartas comunes' : 'Tus cartas'}</h3></div><div class="hand">${handIds().filter(id => !(slot !== null && selected === id)).map(id => `<button class="hand-card${selected === id ? ' selected' : ''}" data-quick="select" data-id="${id}" aria-pressed="${selected === id}"${room && !myTurn() ? ' disabled' : ''}><span class="hidden-date">Valor oculto</span>${CT.cardBack('quick')}<strong>${esc(get(id).title)}${get(id).artist?`<small class="quick-card-artist">${esc(get(id).artist)}</small>`:""}</strong><span class="card-arrow">→</span></button>`).join('')}</div>
      <p class="hint">${selected ? 'Toca un hueco y confirma, o arrastra la carta hasta su lugar.' : 'Toca una carta o mantenla pulsada para arrastrarla hasta un hueco.'}</p></section>
      <section class="board-timeline-section"><div class="hand-title"><h3>${esc(timelineTitle(c))}</h3></div>${timelineEnds(c)}${CT.timelineMap(null, state.timeline)}
      <div class="timeline-wrap"><div class="timeline" aria-label="${esc(timelineTitle(c))}: orden de izquierda a derecha">${state.timeline.map((id, i) => gap(i) + cardMarkup(c, get(id))).join('')}${gap(state.timeline.length)}</div></div></section>`);
    CT.enableDrag({cardSelector: '.quick-shell .hand-card', slotSelector: '.quick-shell .slot', parseCardId: id => id, onDrop(id, index) {
      if (!myTurn() || !app().querySelector('.quick-shell') || state?.phase !== 'turn' || !handIds().includes(id)) return;
      selected = id; slot = index; render(); focusPlacement();
    }});
    if(timed&&!covered){const key=turnKey();quickClock=CT.Tiempo.clock({empezadoEn:startedAt,ms,root:app(),onTimeout:()=>{
      if(!state||!timedTurn()||turnKey()!==key)return;
      // Se acabó el tiempo: la jugada cuenta como fallo.
      selected=null;slot=null;dispatch(E.timeoutPlacement(state));
    }});}
  }
  function focusPlacement() {
    const node = app().querySelector('.quick-confirm') || app().querySelector('.timeline-wrap');
    node?.scrollIntoView?.({block: 'nearest', behavior: 'auto'});
    if (slot !== null) app().querySelector('[data-quick="confirm"]')?.focus({preventScroll:true});
    CT.announce(slot === null ? 'Carta elegida. Elige un hueco.' : `Hueco ${slot + 1} elegido. Confirma la colocación.`);
  }
  function abandonQuick() {
    if(connection?.kind==='internet'){toEntry();return;}
    const hadRoom=!!room;
    stopNetwork();
    CT.Storage.removeItem(slotOf(record?.config));
    if (hadRoom) CT.Storage.removeItem(NET);
    pendingConfig=null; state=null; record=null; selected=null; slot=null;
    toEntry();
  }
  // Vuelve a la pantalla por la que se entró en Retos rápidos. El reto del día y la mesa
  // pública no tienen una propia: se sale a la pantalla anterior del juego.
  function toEntry() {
    pauseClock(); readyTurn=null;
    if (backTo) {const back=backTo;backTo=null;stopNetwork();pendingConfig=null;state=null;record=null;selected=null;slot=null;back();return;}
    if (entry === 'free-setup') freeSetup();
    else if (entry === 'duel-setup') duelSetup();
    else {stopNetwork();pendingConfig=null;state=null;record=null;selected=null;slot=null;CT.navigateBack?.();}
  }
  // Quien lleva una sala privada puede, en plena partida, saltar el turno de quien no juega y sacar a alguien de la
  // partida (se quedó sin batería, se fue). En una mesa pública lo hace el juego solo con quien deja de responder.
  // Un rival de duelo por turnos que aún no ha abierto el enlace: no tiene nombre todavía.
  const pendingAt=i=>!!room&&room.config?.kind==='duel'&&i>=room.members.length;
  const playerName=(p,i)=>pendingAt(i)?'Rival por invitar':p.name;
  // Los jugadores en el menú de la partida, como en el de las salas: avatar, nombre con «Denunciar o bloquear» debajo y,
  // a quien lleva una sala privada, «Expulsar» (sale de la partida y conserva lo asegurado) y saltar el turno de quien no juega.
  // En una mesa pública lo hace el juego solo; en un duelo de dos, en vez de expulsar está «Rendirme».
  function playersSection() {
    if (!room || !state) return '';
    const playing = ['turn', 'result', 'round-end'].includes(room.phase);
    const manage = room.host === myId && room.matchmaking !== 'public' && room.config?.kind !== 'duel' && playing;
    const at = room.members.indexOf(room.actor), actor = state.players[at];
    const skip = manage && room.actor !== myId && room.phase !== 'round-end' && actor ? button('skip-turn', `Saltar el turno de ${esc(actor.name)}`, 'btn btn-secondary btn-block') : '';
    const context = room.matchmaking === 'public' ? 'mesa' : room.config?.kind === 'duel' ? 'duelo' : 'sala';
    const rows = state.players.map((p, i) => {
      const uid = room.members[i];
      if (uid === myId || p.gone) return '';
      const pending = pendingAt(i);
      const report = !pending && connection?.kind === 'internet' && uid ? CT.Moderacion?.botonDenuncia(uid, p.name, context) || '' : '';
      const action = pending ? (connection?.code ? button('share-room', 'Invitar', 'kick-btn') : '')
        : manage ? `<button class="kick-btn" data-quick="drop" data-player="${i}" aria-label="Expulsar a ${esc(p.name)}">Expulsar</button>` : '';
      return `<div class="manage-player"><span class="seat-avatar">${playerAvatar(p, i)}</span><span class="manage-player-copy"><strong>${esc(playerName(p, i))}</strong>${pending ? '<small>Aún no ha abierto el enlace</small>' : report}</span>${action}</div>`;
    }).join('');
    return skip || rows ? `<div class="manage-players"><div class="section-label">Jugadores</div>${skip}${rows}</div>` : '';
  }
  function menu() {
    const c = E.challenge(state.config.rounds[state.index].id);
    const internet = room && connection?.kind === 'internet';
    const layer = document.createElement('div'); layer.className = 'overlay';
    layer.innerHTML = `<div class="modal room-menu"><div class="eyebrow">${deckOf(state.config) ? 'Grandes colecciones' : 'Retos rápidos'}</div><h2>Opciones de la partida</h2>
      <p class="hint">${esc(c.rule)}.${c.asOf ? ` Datos a ${esc(c.asOf)}.` : ''} ${E.keepPlaying(state) ? 'Un fallo no suma, pero sigues hasta el final.' : 'Cada acierto es provisional: plantarte lo asegura.'}</p>
      <div class="actions actions-columna">${button('close-menu', 'Seguir jugando', 'btn btn-primary')}<div class="actions-par">${button('guide', 'Guía', 'btn btn-secondary')}<button class="btn btn-secondary" data-settings-action="open">Ajustes</button></div>
        ${button('formats', internet ? (state.config.kind === 'duel' ? 'Salir del duelo' : 'Salir de la sala') : 'Guardar y salir', 'btn btn-secondary')}</div>
      ${playersSection()}
      <div class="actions actions-columna">${room && room.capacity === 2 && room.members.length === 2 && state.config.kind === 'duel' && !room.resigned && room.phase !== 'finished' ? button('resign', 'Rendirme', 'btn btn-ghost exit-discard') : ''}${internet ? '' : button('abandon', 'Salir sin guardar', 'btn btn-ghost exit-discard')}</div></div>`;
    app().append(layer); CT.openDialog(layer, true);
  }
  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-quick-final-form]');
    if (!form || !state || !isCol() || !state.final) return;
    event.preventDefault();
    const mode = E.challenge(state.config.rounds[0].id).collection, err = () => app().querySelector('#quick-error');
    try {
      const value = CT.Final.parse(mode, form.elements.guess.value, form.elements.era?.value === 'bc');
      void networkAction({type: 'guess', value});
    } catch (e) { if (err()) err().textContent = e.message; }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'quick-duel-group') {CT.Storage.setItem(DUEL_GROUP, event.target.value); return;}
    if (event.target.name === 'quick-duel-pace' && app().querySelector('[data-quick-duel-block]')) {
      // Cambiar de ritmo no repinta: se enseña un bloque y se esconde el otro, como en el duelo de las colecciones.
      const pace = event.target.value === 'turnos' ? 'turnos' : 'directo';
      CT.Storage.setItem(DUEL_PACE, pace);
      app().querySelectorAll('[data-quick-duel-block]').forEach(b => { b.hidden = b.dataset.quickDuelBlock !== pace; });
      app().querySelectorAll('[data-quick-duel-pre]').forEach(b => { b.hidden = pace !== 'directo'; });
      const group = app().querySelector('[data-quick-group]');
      if (group) group.hidden = pace === 'directo';
      app().querySelectorAll('.segmented-option').forEach(o => o.classList.toggle('is-on', o.querySelector('input').checked));
      return;
    }
    if (event.target.name === 'quick-live-net') {
      CT.Storage.setItem(LIVE_NET, event.target.value === 'wifi' ? 'wifi' : 'internet');
      app().querySelectorAll('.segmented-option').forEach(o => o.classList.toggle('is-on', o.querySelector('input').checked));
      return;
    }
    if (event.target.name === 'quick-keep') {
      CT.Storage.setItem(DUEL_KEEP, event.target.value === 'fuera' ? 'fuera' : 'seguir');
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
    if (action === 'skip-turn') {CT.closeDialog(); void networkAction({type: 'force'}); return;}
    if (action === 'drop') {
      const at = Number(target.dataset.player), name = state?.players?.[at]?.name || 'esta persona';
      CT.closeDialog();
      CT.UI.confirmDialog('Dejará de jugar en esta partida: conserva los aciertos que ya tenía asegurados y su turno se salta en adelante.', () => {CT.closeDialog?.(); void networkAction({type: 'drop', player: at});}, {title: `¿Expulsar a ${name} de la partida?`, confirmLabel: 'Expulsar', cancelLabel: 'Cancelar'});
      return;
    }
    if (action === 'kick') {
      const uid = target.dataset.uid, at = room ? room.members.indexOf(uid) : -1, name = at > 0 ? room.names[at] : 'esta persona';
      CT.UI.confirmDialog('Saldrá de la sala de espera. Si quiere volver, tendrá que entrar de nuevo con el código.', () => {CT.closeDialog?.(); void networkAction({type: 'kick', target: uid});}, {title: `¿Expulsar a ${name}?`, confirmLabel: 'Expulsar', cancelLabel: 'Cancelar'});
      return;
    }
    const formatActions=['live-room','formats','leave-public','share-duel','create-room','join-room','start-room','room-starter-draw','room-starter-guess','share-room','qr-room','qr-signal','scan-code','scan-answer','share-signal','invite-peer','accept-answer','reconnect','duels-list','rematch-room','accept-invite','decline-invite','back-invite'];
    if(formatActions.includes(action)){target.disabled=true;Promise.resolve(formatAction(action)).catch(errorNotice).finally(()=>{if(target.isConnected)target.disabled=false;});return;}
    if (action === 'add-player' || action === 'remove-player') {
      const names = [...app().querySelectorAll('[data-quick-name]')].map(el => el.value);
      if (action === 'add-player' && names.length < MAX_FRIENDS) names.push(`Jugador ${names.length + 1}`);
      else if (action === 'remove-player' && names.length > 2) names.splice(Number(target.dataset.index), 1);
      app().querySelector('#quick-names').innerHTML = nameFields(names.length, names);
      app().querySelector('[data-quick="add-player"]').disabled = names.length >= MAX_FRIENDS;
      refreshStarterField();
      app().querySelector(`#quick-name-${names.length - 1}`)?.focus(); return;
    }
    if (action === 'resign') {CT.closeDialog(); if (window.confirm('¿Rendirte? Tu rival ganará este duelo y se quedará en el historial.')) void networkAction({type: 'resign'}); return;}
    if (action === 'menu') {menu(); return;}
    if (action === 'close-menu') {CT.closeDialog(); return;}
    if (action === 'guide') {guide(); return;}
    if (action === 'rematch') {entry='duel-setup'; duelSetup(); return;}
    if (action === 'ready') { if (pendingConfig) begin(pendingConfig); return; }
    if (action === 'turn-ready') { if (state) { readyTurn = turnKey(); render(); } return; }
    if (action === 'more-lengths') {
      const field = target.closest('.field');
      field?.querySelectorAll('[data-length-extra]').forEach(chip => { chip.hidden = false; });
      target.remove();
      return;
    }
    if (action === 'length') {
      app().querySelectorAll('.quick-length-chip').forEach(chip => {const on = chip === target; chip.classList.toggle('is-selected', on); chip.setAttribute('aria-checked', String(on));});
      const input = target.closest('.field')?.querySelector('[data-quick-length-input]') || app().querySelector('[data-quick-length-input]'); if (input) input.value = target.dataset.length; return;
    }
    if (action === 'collection') {collectionPage(target.dataset.deck || null); return;}
    // Un mazo de hoy: 10 cartas de ese reto (E.SOLO_CARDS), más la que abre la línea.
    if (action === 'play-deck') {
      const id=target.dataset.deck;
      if(!todayDecks().some(c=>c.id===id)){freeSetup();return;}
      prepare({names:['Tú'],rounds:rounds(1,id,null,E.SOLO_CARDS+1,true),kind:'free',length:1,seconds:CT.Tiempo.chosen('quick-solo')}); return;
    }
    if (action === 'exit') {CT.UI.confirmExit(connection?.kind==='local' ? 'Al salir se cierra la conexión con la sala local.' : 'La partida se conserva para que puedas continuar después.', toEntry, undefined, undefined, (state || room) && connection?.kind!=='internet' ? {label:'Salir sin guardar', proceed:abandonQuick} : null); return;}
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
      const list = rounds(count).map(round => E.challenge(round.id)), multi = format === 'local' && names.length > 1;
      const config = {names: ordered, rounds: list.map(c => ({id: c.id, order: CT.shuffle(c.cards.map(item => item.id)).slice(0, multi ? E.MULTI_CARDS : E.SOLO_CARDS + 1)})),kind:format,historyId:historyId(),seconds:CT.Tiempo.chosen(format === 'local' ? 'quick-local' : 'quick-solo'),...(format === 'local' && names.length > 1 ? {keep: duelKeep()} : {})};
      record = {version: CT.QuickCatalog.version, config, commands: []}; state = E.create(config);
      save(); selected = null; slot = null; render(); return;
    }
    if (action === 'resume') {record = load(); format=record?.config?.kind || 'local'; if (!record) {setup(); return;} state = E.restore(record); selected = null; slot = null; render(); return;}
    if (!state || !myTurn()) return;
    if (action === 'select' && state.phase === 'turn' && handIds().includes(target.dataset.id)) {selected = target.dataset.id; slot = null; CT.Effects?.tap(); render(); focusPlacement();}
    else if (action === 'slot' && selected && state.phase === 'turn') {slot = Number(target.dataset.index); CT.Effects?.tap(); render(); focusPlacement();}
    else if (action === 'cancel') {slot = null; render();}
    else if (action === 'confirm' && selected && slot !== null) {CT.Effects?.stamp(); dispatch({type: 'place', cardId: selected, index: slot});}
    else if (['bank', 'ack', 'next'].includes(action)) {if (action === 'bank') CT.Effects?.bank?.(); dispatch({type: action});}
  });
  function block(title, subtitle, art, action, count) {
    const cover = art === 'quick' ? 'menu-quick.webp' : `hero-${art}-400.webp`;
    return `<div class="collection-entry"><button class="gallery-panel panel-${art}" data-action="${action}" aria-label="${esc(title)}. ${esc(subtitle)}"><span class="panel-backdrop" aria-hidden="true"><img src="assets/${cover}" alt="" width="400" height="600"></span><span class="panel-depth-light" aria-hidden="true"></span><span class="panel-art" aria-hidden="true"><img src="assets/${cover}" alt="" width="400" height="600"></span><span class="panel-depth-ground" aria-hidden="true"></span><span class="collection-foil" aria-hidden="true"></span><span class="collection-index" aria-hidden="true">${count}</span><span class="collection-open" aria-hidden="true">↗</span><span class="panel-spine" aria-hidden="true"><i>◇</i><b>${esc(title)}</b></span><span class="panel-label" aria-hidden="true"><i></i><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span></button></div>`;
  }
  // El reto diario tiene siempre 10 cartas que ordenar, igual que el de Grandes colecciones: así los
  // aciertos de un día valen lo mismo que los de otro, sin cuentas. Una carta más abre la línea, y solo
  // entran los mazos que llegan a ese tamaño.
  const DAILY_QUICK_CARDS = E.SOLO_CARDS;
  function dailyQuick(dayValue) {
    const seed=CT.seedFrom('quick-daily-'+dayValue), random=CT.seededRandom(seed);
    const all=CT.QuickCatalog.challenges, pool=all.filter(c=>c.cards.length>DAILY_QUICK_CARDS);
    const list=pool.length?pool:all;
    const challenge=list[Math.floor(random()*list.length)];
    const order=CT.shuffleWith(challenge.cards.map(x=>x.id),random).slice(0,DAILY_QUICK_CARDS+1);
    return {names:['Tú'],rounds:[{id:challenge.id,order}],kind:'daily',day:dayValue};
  }

  // `table`: «Crear mesa» ({create:true, seconds}) o entrar en una mesa del tablón ({code}).
  async function openPublic(renderPage, capacity=0, table={}) {
    backTo=null; paint=renderPage; entry='public'; stopNetwork(); page='network-lobby'; state=null; record=null; selected=null; slot=null; format='public'; netKind='internet';
    const name=CT.Identidad?.propio?.() || 'Explorador';
    const change=(...args)=>roomChanged(...args), fail=e=>errorNotice(e);
    shell(table.create ? '<section class="setup-section"><h2>Abriendo tu mesa…</h2><div class="panel"><p>Retos rápidos · mesa pública</p><p class="hint">Aparecerá en la lista de mesas abiertas.</p></div></section>'
      : table.code ? '<section class="setup-section"><h2>Entrando en la mesa…</h2><div class="panel"><p>Retos rápidos · mesa pública</p></div></section>'
      : '<section class="setup-section"><h2>Buscando mesa…</h2><div class="panel"><p>Retos rápidos · jugadores aleatorios</p><p class="hint">Entrarás en la primera mesa compatible.</p></div></section>');
    connection=await (await import('./quick-online.js')).connectPublic({name,capacity,...table,onChange:change,onError:fail});
  }

  CT.Quick = {
    leave:stopNetwork,
    openPublic,
    // El historial de Retos rápidos vive en el Atlas, junto al resto de estadísticas.
    stats:statsPanel,
    openSolo(renderPage){paint=renderPage;backTo=null;entry='free-setup';format='free';freeSetup();},
    // Los mazos que se ofrecen hoy en solitario y la colección de cartas descubiertas.
    todayDecks,
    openCollection(renderPage,deck=null){paint=renderPage;backTo=null;entry='free-setup';format='free';collectionPage(deck);},
    openLocal(renderPage){paint=renderPage;backTo=null;entry='setup';format='local';setup();},
    openDuel(renderPage){paint=renderPage;entry='duel-setup';format='duel';backTo=null;duelSetup();},
    // Duelo por turnos de Grandes colecciones: el mazo elegido, con estas reglas (lo crea «Cada uno en su móvil · Por turnos»).
    openCollectionDuel(renderPage,{deck,name,length,keep,back,players=2,hand=4}){if(!CT.has(deck))return Promise.reject(Error('Ese mazo no existe.'));return createDuelRoom({renderPage,name,length,keep,iStart:true,invite:null,back,deck,players,hand});},
    duels, openRoom, challenge, resignDuel, cancelInvitation, declineInvite, previewInvite, reshare,
    Duel:{pack:packCommands,unpack:unpackCommands,payload:duelPayload,read:readDuel,fingerprint:duelFingerprint,rounds},
    openNetwork(renderPage,kind,capacity,only){paint=renderPage;backTo=null;entry='network';networkSetup(kind,capacity,only);},
    // Una invitación Wi-Fi ya escaneada en «Unirme»: con nombre de perfil se entra directamente.
    joinLocal(renderPage,signal){
      paint=renderPage;backTo=null;entry='network';networkSetup('local',4,'join');
      app().querySelector('#quick-net-code').value=signal;
      const name=app().querySelector('#quick-net-name-join');
      if(name?.value.trim()){connectRoom(false).catch(errorNotice);}else name?.focus();
    },
    // El mazo y la regla del reto rápido de un día, para enseñarlos en la guía sin empezar la partida.
    dailyChallenge(dayValue) {const c=E.challenge(dailyQuick(dayValue).rounds[0].id);return {id:c.id,title:c.title,rule:c.rule,asOf:c.asOf,cards:dailyQuick(dayValue).rounds[0].order.length};},
    // ¿Hay un reto diario rápido de ese día empezado y sin terminar? Entonces se retoma sin portada.
    dailyPending(dayValue) {const saved=load(DAILY_KEY);return !!(saved?.config?.kind==='daily' && saved.config.day===dayValue && !saved.historySaved);},
    startDaily(dayValue, renderPage) {
      paint=renderPage; entry='prepare'; stopNetwork(); page='prepare'; state=null; record=null; selected=null; slot=null;
      const saved=load(DAILY_KEY);
      if(saved?.config?.kind==='daily' && saved.config.day===dayValue && !saved.historySaved){
        record=saved;state=E.restore(record);render();return;
      }
      prepare(dailyQuick(dayValue));
    },
    // Sin ruta de entrada (al abrir un enlace de sala o de duelo, o si se pierde la ruta) ya no hay un menú de
    // formatos propio: un duelo o una sala se abren directos y, sin enlace, se vuelve a las puertas de Jugar.
    open(renderPage, target) {
      backTo = null; paint = renderPage; entry = 'network'; state = null; record = null; selected = null; slot = null;
      const params = target ? CT.Links.params(target) : new URLSearchParams(location.hash.slice(1) || location.search);
      try {
        if (params.has('quick-duel')) acceptDuel(CT.Links.base()+'#'+params.toString());
        else if (params.has('quick-room')) void enterByLink(params.get('quick-room'));
        else CT.ModeHubs.open('hub-solo');
      } catch (e) {
        CT.ModeHubs.open('hub-solo');
        CT.UI.askDialog({ title: 'No se pudo abrir el enlace', message: e.message || 'El enlace no es válido.', stay: 'Entendido' });
      }
    },
    blocks() {return block('Retos rápidos', 'Ordena. Arriesga. Asegura.', 'quick', 'quick-challenges', `${CT.QuickCatalog.challenges.length} retos`);}
  };
})();
