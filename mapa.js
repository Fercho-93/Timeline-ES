// Zoom compartido por las partidas locales, solitarias y en línea.
// Se reducen las cartas reales para respetar los datos ocultos por el Fantasma.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const levels = [0.5, 0.75, 1];
  let level = 2;

  function timelineMap(_modeKey, cards) {
    if (!cards.length) return "";
    return `<div class="timeline-zoom" role="group" aria-label="Tamaño de las cartas en juego">
      <span>Vista de la mesa</span>
      <button type="button" data-timeline-zoom="out" aria-label="Alejar para ver más cartas">−</button>
      <output aria-live="polite">${Math.round(levels[level] * 100)}%</output>
      <button type="button" data-timeline-zoom="in" aria-label="Acercar las cartas">+</button>
      <button type="button" data-timeline-zoom="reset">Tamaño normal</button>
    </div>`;
  }

  function applyTimelineZoom(container, reset = false) {
    if (reset) level = 2;
    const wrap = container.querySelector(".timeline-wrap");
    const timeline = wrap?.querySelector(".timeline");
    if (!timeline) return;
    timeline.style.zoom = levels[level];
    timeline.style.setProperty("--timeline-scale", levels[level]);
    const controls = container.querySelector(".timeline-zoom");
    if (!controls) return;
    controls.querySelector("output").textContent = `${Math.round(levels[level] * 100)}%`;
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

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-timeline-zoom]");
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
    level = action === "reset" ? 2 : Math.max(0, Math.min(levels.length - 1, level + (action === "out" ? -1 : 1)));
    applyTimelineZoom(container);
    if (anchor) wrap.scrollLeft += anchor.getBoundingClientRect().left - oldLeft;
  });

  CT.timelineMap = timelineMap;
  CT.applyTimelineZoom = applyTimelineZoom;
  CT.scrollToElement = scrollToElement;
})();
