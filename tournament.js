(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const modes = () => Object.keys(CT.MODES).filter(key => key !== 'mixed');
  function create(rounds, cards) {
    const queue = CT.shuffle(modes()).slice(0, Math.max(1, Math.min(modes().length, Number(rounds) || modes().length)));
    return {queue, index:0, history:[], handSize:Math.max(1, Math.min(6, Number(cards) || 5))};
  }
  function handsOf(players) {
    const entries = Array.isArray(players) ? players.map(p=>[p.id,p.hand.length]) : Object.entries(players).map(([id,p])=>[id,p.hand.length]);
    return Object.fromEntries(entries);
  }
  // Ganar la ronda suma un punto; quedarse con cartas resta su número menos uno.
  function roundDelta(handLength) {
    return handLength === 0 ? 1 : -(handLength - 1);
  }
  function next(t, players, winners) {
    if (t.index + 1 >= t.queue.length) throw Error('La competición ha terminado.');
    return {...t, index:t.index+1, history:[...t.history,{mode:t.queue[t.index],winners:[...winners],hands:handsOf(players)}]};
  }
  function journey(t) {
    return `<nav class="chapter-journey" aria-label="Recorrido de la competición"><ol>${t.queue.map((modeKey,index)=>{
      const state=index<t.index?' complete':index===t.index?' current':'';
      const label=index<t.index?'Completado':index===t.index?'Capítulo actual':'Pendiente';
      return `<li class="chapter-stop${state}"${index===t.index?' aria-current="step"':''}><span>${index<t.index?'✓':index+1}</span><small>Cap. ${String(index+1).padStart(2,'0')}</small><b>${CT.escapeHtml(CT.mode(modeKey).name)}</b><i>${label}</i></li>`;
    }).join('')}</ol></nav>`;
  }
  function board(t, players, winners = []) {
    const hands = winners.length ? handsOf(players) : {};
    const history = [...t.history, ...(winners.length ? [{winners,hands}] : [])];
    const rows = players.map(p=>({...p,points:history.reduce((sum,r)=>sum+(r.hands[p.id]!=null ? roundDelta(r.hands[p.id]) : 0),0)})).sort((a,b)=>b.points-a.points);
    const finished = winners.length && t.index+1 === t.queue.length;
    const leaders = rows.filter(p=>p.points === rows[0].points).map(p=>CT.escapeHtml(p.name));
    return `<section class="panel tournament-board">${journey(t)}<div class="tournament-score-head"><div><span>${finished?'Recorrido completado':`Capítulo ${t.index+1} de ${t.queue.length}`}</span><h2>${finished ? 'Resultado de la competición' : CT.escapeHtml(CT.mode(t.queue[t.index]).name)}</h2></div><small>${t.handSize} cartas por persona</small></div><ol class="tournament-score">${rows.map((p,index)=>`<li><i>${index+1}</i><strong>${CT.escapeHtml(p.name)}</strong><span>${p.points} ${p.points===1?'punto':'puntos'}</span></li>`).join('')}</ol>${finished ? `<p class="tournament-verdict"><strong>${leaders.join(' y ')} ${leaders.length===1?'gana':'empatan en'} la competición.</strong></p>` : '<p class="hint">Ganar la ronda suma un punto; las cartas restantes restan su número menos uno.</p>'}</section>`;
  }
  CT.Tournament = {modes,create,next,journey,board};
})();
