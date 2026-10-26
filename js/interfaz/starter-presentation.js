// Una misma lámina de apertura para colecciones, Retos rápidos y salas de amigos.
(function () {
  "use strict";
  const CT = window.CONTINUUM, escapeHtml = CT.escapeHtml;
  function cardsIcon() {
    return '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="10" y="17" width="36" height="51" rx="3" transform="rotate(-16 28 43)"/><rect x="28" y="13" width="36" height="51" rx="3" transform="rotate(12 46 39)"/><rect x="21" y="10" width="38" height="56" rx="3" fill="var(--opening-card-fill, #f5e8ce)"/><rect x="25" y="14" width="30" height="48" rx="1"/><path d="M40 23l3.5 11.5L52 38l-8.5 3.5L40 53l-3.5-11.5L28 38l8.5-3.5L40 23Z"/><path d="M40 18v2m0 36v2M28 20l2 2m20 32l2 2M52 20l-2 2M30 54l-2 2"/></svg>';
  }

  function plate(modeKey, card, revealed = false, { kicker = "La carta de apertura", id = "", question = null, heading = false } = {}) {
    const art = CT.animalArt(modeKey, card);
    return `<div${id ? ` id="${escapeHtml(id)}"` : ""} class="cifra-card starter-card${revealed ? " starter-card-revealed" : ""}">
      <div class="starter-card-art${art ? "" : " starter-art-empty"}" aria-label="Ilustración de ${escapeHtml(card.title)}">${art || cardsIcon()}<i class="starter-plate-corners" aria-hidden="true"></i><span class="starter-plate-mark" aria-hidden="true">Continuum</span></div>
      <div class="starter-card-copy"><p class="starter-card-kicker">${revealed ? "La cifra que buscábamos" : escapeHtml(kicker)}</p>${CT.categoryBadge(modeKey, card)}<${heading ? "h2" : "strong"} class="starter-card-title">${escapeHtml(card.title)}</${heading ? "h2" : "strong"}>
      ${revealed ? `<span class="starter-real-value"><span class="sr-only">El valor real era </span>${escapeHtml(CT.formatValue(modeKey, card))}</span>` : `<span class="starter-question">${escapeHtml(question ?? (CT.axis(modeKey).cifra || {}).pregunta ?? "")}</span>`}</div>
    </div>`;
  }

  function heading(name, step, count) {
    return `<header class="starter-dialog-head"><div class="starter-round-label"><span>Quién empieza</span><span>Turno ${step + 1} de ${count}</span></div><h2 id="starter-dialog-title" data-dialog-focus tabindex="-1"><span>Pasa el móvil a </span><strong>${escapeHtml(name)}</strong></h2><div class="starter-turn-track" aria-hidden="true">${Array.from({length: count}, (_, i) => `<i class="${i < step ? "is-done" : i === step ? "is-current" : ""}"></i>`).join("")}</div></header>`;
  }
  function winner(name) {
    return `<header class="starter-winner-banner"><p class="starter-card-kicker">Ya tenemos quién empieza</p><span class="starter-winner-crown" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8Z"/><path d="M5 21h14"/></svg></span><h2 id="starter-dialog-title" data-dialog-focus tabindex="-1">${escapeHtml(name)}</h2><span>Empieza la partida</span></header>`;
  }
  function order(rows) {
    return `<div class="starter-order-heading"><strong>Orden de salida</strong><span>Vuestra respuesta</span></div><ol class="starter-draw-list">${rows.map((row, i) => `<li${i === 0 ? ' class="starter-draw-winner"' : ''}><span class="starter-place" aria-label="Puesto ${i + 1}">${i + 1}.º</span> <span class="starter-order-name">${escapeHtml(row.name)}</span><span class="starter-order-value">${escapeHtml(row.value)}</span></li>`).join("")}</ol>`;
  }
  function answer(modeKey, id, { attrs = "", hintId = `${id}-hint`, describedBy = hintId } = {}) {
    const placeholder = CT.axis(modeKey).cifra?.negativos ? "Escribe el año" : "Escribe una cifra";
    const html = CT.Duelo.Cifras.campo(modeKey, id, { attrs: `placeholder="${placeholder}" aria-describedby="${escapeHtml(describedBy)}" ${attrs}`, hintId });
    // La unidad inicial y el signo de antes de Cristo indican su estado en todas las entradas.
    const marked = html.replace(/<button type="button" class="cifra-chip"([^>]*)>/g, (match, attrs) => {
      const unit = attrs.match(/data-cifra-unidad="([^"]*)"/)?.[1];
      const pressed = unit !== undefined && CT.Duelo.Cifras.factorDe(modeKey, unit) === 1;
      return `<button type="button" class="cifra-chip" aria-pressed="${pressed}"${attrs}>`;
    });
    return `<section class="starter-answer" data-starter-mode="${escapeHtml(modeKey)}">${marked}</section>`;
  }
  function drawButton(attribute, noun = "la cifra") {
    return `<button type="button" class="btn btn-block starter-draw-cta" ${attribute}><span class="starter-draw-icon" aria-hidden="true">${cardsIcon()}</span><span class="starter-draw-copy"><span class="starter-draw-kicker">El primer turno se gana</span><b>Adivinar ${escapeHtml(noun)}</b><small>Cada uno prueba con una carta y gana quien más se acerque</small></span><span class="starter-draw-arrow" aria-hidden="true">→</span></button>`;
  }
  function repeatButton(attribute) {
    return `<button type="button" class="btn btn-ghost btn-block" ${attribute}><span aria-hidden="true">↻</span> Repetir el minijuego</button>`;
  }
  function syncAnswer(field) {
    const box = field?.closest?.('.starter-answer');
    if (!box) return;
    const value = field.value.trim(), modeKey = box.dataset.starterMode;
    if (!modeKey) return;
    const suffix = value.replace(/^[+-]?[\d\s.,]*/, '').trim();
    const factor = CT.Duelo.Cifras.factorDe(modeKey, suffix);
    box.querySelectorAll('.cifra-chip').forEach(button => {
      const pressed = button.hasAttribute('data-cifra-signo') ? value.startsWith('-')
        : factor !== null && CT.Duelo.Cifras.factorDe(modeKey, button.dataset.cifraUnidad) === factor;
      button.setAttribute('aria-pressed', String(pressed));
    });
  }
  document.addEventListener('input', event => syncAnswer(event.target));
  document.addEventListener('focusin', event => {
    if (event.target.matches?.('.starter-answer input')) event.target.scrollIntoView?.({block: 'center', behavior: 'smooth'});
  });
  CT.StarterPresentation = {cardsIcon, plate, heading, winner, order, answer, drawButton, repeatButton, syncAnswer};
})();
