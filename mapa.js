// Zoom compartido por las partidas locales, solitarias y en línea.
// Se reducen las cartas reales para respetar los datos ocultos por el Fantasma.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const levels = [0.8, 1, 1.2];
  let level = 1;
  let observedTimeline = null, sizeObserver = null;

  // Transformar la tira completa conserva exactamente las proporciones: CSS zoom
  // puede recalcular sus medidas relativas al viewport y sus imágenes flexibles.
  function sizeTimeline(timeline) {
    const frame = timeline.parentElement;
    if (!frame?.classList.contains('timeline-scale-frame')) return;
    const scale = levels[level];
    frame.style.width = `${timeline.offsetWidth * scale}px`;
    frame.style.height = `${timeline.offsetHeight * scale}px`;
  }

  function timelineMap(_modeKey, cards) {
    if (!cards.length) return "";
    return `<div class="timeline-zoom" role="group" aria-label="Tamaño de las cartas en juego">
      <button hidden type="button" data-timeline-zoom="out" aria-label="Alejar para ver más cartas">−</button>
      <input hidden type="range" min="0" max="${levels.length - 1}" step="1" value="${level}" data-timeline-range aria-label="Zoom del tablero" aria-valuetext="${Math.round(levels[level]*100)} por ciento">
      <button hidden type="button" data-timeline-zoom="in" aria-label="Acercar las cartas">+</button>
      <button type="button" class="zoom-toggle" data-zoom-toggle aria-expanded="false" aria-haspopup="true" aria-label="Zoom de las cartas"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg><output aria-live="polite">${Math.round(levels[level] * 100)}%</output></button>
      <div class="zoom-menu" hidden>${levels.map((scale, index) => `<button type="button" data-zoom-level="${index}" aria-pressed="${index === level}" aria-label="Zoom ${Math.round(scale * 100)} por ciento">${Math.round(scale * 100)}%</button>`).join('')}</div>
    </div>`;
  }

  function applyTimelineZoom(container, reset = false) {
    if (reset) level = 1;
    const wrap = container.querySelector(".timeline-wrap");
    const timeline = wrap?.querySelector(".timeline");
    if (!timeline) { sizeObserver?.disconnect(); observedTimeline = null; return; }
    let frame = timeline.parentElement;
    if (!frame.classList.contains('timeline-scale-frame')) {
      frame = document.createElement('div');
      frame.className = 'timeline-scale-frame';
      timeline.before(frame);
      frame.append(timeline);
    }
    timeline.style.transform = `scale(${levels[level]})`;
    timeline.style.setProperty("--timeline-scale", levels[level]);
    sizeTimeline(timeline);
    if (observedTimeline !== timeline) {
      sizeObserver?.disconnect();
      observedTimeline = timeline;
      // También cubre giros del móvil, barras de Safari, fuentes e imágenes tardías.
      if (typeof ResizeObserver === 'function') {
        sizeObserver ||= new ResizeObserver(() => {
          if (observedTimeline?.isConnected) sizeTimeline(observedTimeline);
          else sizeObserver.disconnect();
        });
        sizeObserver.observe(timeline);
      }
    }
    const controls = container.querySelector(".timeline-zoom");
    if (!controls) return;
    controls.querySelector("output").textContent = `${Math.round(levels[level] * 100)}%`;
    const range = controls.querySelector('[data-timeline-range]');
    controls.querySelectorAll('[data-zoom-level]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.zoomLevel) === level)));
    range.value = level;
    range.setAttribute('aria-valuetext', `${Math.round(levels[level]*100)} por ciento`);
    controls.querySelector('[data-timeline-zoom="out"]').disabled = level === 0;
    controls.querySelector('[data-timeline-zoom="in"]').disabled = level === levels.length - 1;
  }

  function scrollToElement(wrap, el) {
    if (!wrap || !el || typeof wrap.scrollBy !== "function") return;
    const caja = el.getBoundingClientRect();
    const marco = wrap.getBoundingClientRect();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    wrap.scrollBy({ left: caja.left - marco.left - (marco.width - caja.width) / 2, behavior: reduce ? "auto" : "smooth" });
  }

  function changeZoom(event) {
    const button = event.target.closest("[data-timeline-zoom], [data-timeline-range], [data-zoom-level]");
    if (!button || button.disabled) return;
    const container = button.closest("#app");
    const wrap = container?.querySelector(".timeline-wrap");
    if (!wrap) return;
    const center = wrap.getBoundingClientRect().left + wrap.clientWidth / 2;
    const cards = [...wrap.querySelectorAll(".timeline-card, .slot-confirm")];
    const anchor = cards.reduce((nearest, card) => {
      const box = card.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - center);
      return !nearest || distance < nearest.distance ? { card, distance } : nearest;
    }, null)?.card;
    const oldLeft = anchor?.getBoundingClientRect().left;
    const action = button.dataset.timelineZoom;
    const previousLevel = level;
    level = button.hasAttribute('data-zoom-level') ? Number(button.dataset.zoomLevel) : button.hasAttribute('data-timeline-range') ? Number(button.value) : action === "reset" ? 1 : Math.max(0, Math.min(levels.length - 1, level + (action === "out" ? -1 : 1)));
    applyTimelineZoom(container);
    if (level !== previousLevel) CT.Effects?.transition?.('zoom');
    if (anchor) wrap.scrollLeft += anchor.getBoundingClientRect().left - oldLeft;
  }
  // La lupa abre y cierra el desplegable; elegir un nivel o tocar fuera lo cierra.
  function setZoomMenu(controls, open) {
    const toggle = controls?.querySelector('[data-zoom-toggle]'), menu = controls?.querySelector('.zoom-menu');
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-zoom-toggle]');
    document.querySelectorAll('.timeline-zoom').forEach(controls => {
      if (!toggle || !controls.contains(toggle)) setZoomMenu(controls, false);
    });
    if (toggle) { const controls = toggle.closest('.timeline-zoom'); setZoomMenu(controls, toggle.getAttribute('aria-expanded') !== 'true'); return; }
    if (event.target.closest('[data-timeline-zoom], [data-zoom-level]')) changeZoom(event);
  });
  document.addEventListener('input', event => { if (event.target.matches('[data-timeline-range]')) changeZoom(event); });

  CT.timelineMap = timelineMap;
  CT.applyTimelineZoom = applyTimelineZoom;
  CT.scrollToElement = scrollToElement;
})();
