export function finishLocalFinal(w, key) {
  for (let step = 0; step < 20; step++) {
    const state = JSON.parse(w.localStorage.getItem(key));
    if (!state?.final || state.winners) return;
    const next = w.document.querySelector('[data-action="final-next"]');
    if (next) { next.click(); continue; }
    w.document.querySelector('[data-action="final-ready"]').click();
    const first = Object.keys(state.finalAnswers).length === 0;
    const input = w.document.querySelector('#final-guess');
    input.value = String(state.final.target / w.CONTINUUM.Final.factor(state.mode) + (first ? 0 : 1));
    w.document.querySelector('[data-final-local]').dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
  }
  throw Error('La final no terminó');
}
