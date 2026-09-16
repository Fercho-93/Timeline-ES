// Zoom compartido por las partidas locales, solitarias y en línea.
// Se reducen las cartas reales para respetar los datos ocultos por el Fantasma.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const levels = [0.5, 0.65, 0.8, 1, 1.2];
  let level = 3;
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
      <button type="button" data-timeline-zoom="out" aria-label="Alejar para ver más cartas">−</button>
      <input type="range" min="0" max="4" step="1" value="${level}" data-timeline-range aria-label="Zoom del tablero" aria-valuetext="${Math.round(levels[level]*100)} por ciento">
      <button type="button" data-timeline-zoom="in" aria-label="Acercar las cartas">+</button>
      <output aria-live="polite">${Math.round(levels[level] * 100)}%</output>
    </div>`;
  }

  function applyTimelineZoom(container, reset = false) {
    if (reset) level = 3;
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
    const button = event.target.closest("[data-timeline-zoom], [data-timeline-range]");
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
    level = button.hasAttribute('data-timeline-range') ? Number(button.value) : action === "reset" ? 3 : Math.max(0, Math.min(levels.length - 1, level + (action === "out" ? -1 : 1)));
    applyTimelineZoom(container);
    if (level !== previousLevel) CT.Effects?.transition?.('zoom');
    if (anchor) wrap.scrollLeft += anchor.getBoundingClientRect().left - oldLeft;
  }
  document.addEventListener('click', event => { if (event.target.closest('[data-timeline-zoom]')) changeZoom(event); });
  document.addEventListener('input', event => { if (event.target.matches('[data-timeline-range]')) changeZoom(event); });

  CT.timelineMap = timelineMap;
  CT.applyTimelineZoom = applyTimelineZoom;
  CT.scrollToElement = scrollToElement;
})();
