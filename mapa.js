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

  // Sigue a una carta mientras llega a la línea: la mantiene centrada en la tira y, si
  // hace falta, a la vista en la página. Un centrado de una sola vez no basta, porque
  // justo después de colocar el tablero se reajusta (con una carta más, todas encogen) y
  // la carta acababa a medias fuera de la pantalla. La posición se mide en la maquetación,
  // sin las transformaciones de la animación de llegada, que la desplazan a propósito.
  // Si la persona toca o desplaza la línea, se deja de seguir: manda ella.
  let stopFollow = null;
  function followElement(wrap, el, duration = 1200) {
    stopFollow?.();
    if (!wrap || !el || typeof requestAnimationFrame !== "function") return () => {};
    const timeline = el.closest(".timeline");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const until = performance.now() + duration;
    let frame = 0, verticalDone = false;
    const stop = () => {
      cancelAnimationFrame(frame);
      ["pointerdown", "wheel", "touchstart"].forEach(type => wrap.removeEventListener(type, stop));
      if (stopFollow === stop) stopFollow = null;
    };
    const step = () => {
      if (!el.isConnected || !wrap.isConnected || performance.now() > until) { stop(); return; }
      let left = el.offsetLeft, top = el.offsetTop, width = el.offsetWidth, height = el.offsetHeight;
      let origin = el.getBoundingClientRect(), scale = 1;
      if (timeline && timeline.contains(el)) {
        for (let node = el.offsetParent; node && node !== timeline && timeline.contains(node); node = node.offsetParent) {
          left += node.offsetLeft; top += node.offsetTop;
        }
        origin = timeline.getBoundingClientRect();
        scale = timeline.offsetWidth ? origin.width / timeline.offsetWidth : 1;
        left = origin.left + left * scale; top = origin.top + top * scale;
        width *= scale; height *= scale;
      } else { left = origin.left; top = origin.top; }
      const box = wrap.getBoundingClientRect();
      const inner = box.left + wrap.clientLeft;
      const delta = left - inner - (wrap.clientWidth - width) / 2;
      // Se acerca a su sitio en vez de saltar: el movimiento acompaña a la carta.
      if (Math.abs(delta) > .5) wrap.scrollLeft += reduce ? delta : delta * .35;
      if (!verticalDone) {
        verticalDone = true;
        const view = window.innerHeight || document.documentElement.clientHeight;
        const over = top - 8, under = top + height + 8 - view;
        if (over < 0 || under > 0) window.scrollBy({ top: over < 0 ? over : Math.min(under, over), behavior: reduce ? "auto" : "smooth" });
      }
      frame = requestAnimationFrame(step);
    };
    ["pointerdown", "wheel", "touchstart"].forEach(type => wrap.addEventListener(type, stop, { passive: true, once: true }));
    stopFollow = stop;
    frame = requestAnimationFrame(step);
    return stop;
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
  CT.followElement = followElement;
})();
