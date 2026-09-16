(function () {
  "use strict";
  const CT = window.CONTINUUM;
  // El ambiente pertenece a la mesa y a la navegación, nunca al arte de las cartas.
  // No añade observadores, esperas ni estado persistido a la partida.
  CT.Scene = {
    apply(mode, screen) {
      const neutral = ["home", "perfil", "comp-end", "online-entry", "online-loading"].includes(screen);
      document.documentElement.dataset.scene = !neutral && CT.has(mode) ? CT.blockOf(mode).art : "archive";
    }
  };
  let audio, haptics;
  const EFFECT_VOLUME = .45; // Solo efectos de acciones; no afecta a ambience.js.
  function hapticsAvailable() {
    try {
      const cap = window.Capacitor;
      if (!cap?.isNativePlatform?.()) return typeof navigator.vibrate === 'function';
      if (cap.isPluginAvailable?.('Haptics') === false) return false;
      haptics ||= cap.registerPlugin?.('Haptics') || cap.Plugins?.Haptics;
      return typeof haptics?.impact === 'function' && typeof haptics?.notification === 'function';
    } catch { return false; }
  }
  async function vibration(kind) {
    if (!CT.effectPrefs?.().haptics || !hapticsAvailable()) return false;
    try {
      if (window.Capacitor?.isNativePlatform?.()) {
        if (kind === 'confirm') await haptics.impact({ style: 'LIGHT' });
        else await haptics.notification({ type: kind === 'success' ? 'SUCCESS' : 'WARNING' });
        return true;
      }
      return navigator.vibrate(kind === 'failure' ? [18, 35, 18] : 18) !== false;
    } catch { return false; /* Un efecto opcional nunca impide jugar. */ }
  }
  const samples = new Map(), voices = new Set(), lastCue = new Map();
  // [textura, instante, volumen, velocidad]. El gesto decide el sonido,
  // nunca animationstart: una animación decorativa puede repetirse indefinidamente.
  const scores = {
    success: [['wood', 0, .24], ['high', .13, .19]],
    failure: [['low', 0, .22], ['paper', .09, .16]],
    tap: [['wood', 0, .12]],
    page: [['leaf', 0, .18, .85]],
    back: [['leaf', 0, .15, .7]],
    unroll: [['parchment', 0, .2]],
    expand: [['paper', 0, .19, .9]],
    open: [['paper', 0, .18, 1.1], ['wood', .06, .07]],
    close: [['paper', 0, .14, .85]],
    select: [['wood', 0, .12]],
    place: [['wood', 0, .19], ['paper', .03, .08]],
    return: [['paper', 0, .15, .85], ['low', .05, .08]],
    hover: [['wood', 0, .05, 1.1]],
    flip: [['paper', 0, .22, 1.45]],
    deal: [['paper', 0, .18, 1.2], ['wood', .09, .08]],
    turn: [['wood', 0, .13], ['high', .15, .08]],
    end: [['wood', 0, .17], ['high', .17, .14], ['wood', .34, .09]],
    zoom: [['wood', 0, .07, 1.15]],
    notice: [['high', 0, .09]]
  };
  const priority = {hover:0, zoom:1, select:2, notice:2, close:3, expand:4, open:4, flip:5, deal:6, return:6, place:7, page:8, back:8, unroll:9, turn:10, end:11};
  let pending = null, transitionTimer = null, lastResult = -Infinity;
  function transition(kind) {
    if (!(kind in priority) || !CT.effectPrefs?.().sound || document.hidden) return;
    if (!pending || priority[kind] >= priority[pending]) pending = kind;
    if (transitionTimer !== null) return;
    // Un clic puede cerrar un diálogo, seleccionar y navegar: escuchar solo
    // su desenlace. El timeout abarca todos los oyentes y el gesto nativo de details.
    transitionTimer = setTimeout(() => {
      const next = pending;
      pending = null; transitionTimer = null;
      if (next && performance.now() - lastResult >= 100) void cue(next);
    }, 0);
  }
  // Papel y resonancias de madera, sin imponer otra melodía a las seis pistas.
  // La textura utiliza su propia semilla: nunca consume el azar del reparto.
  function sample(kind) {
    if (samples.has(kind)) return samples.get(kind);
    const leaf = kind === 'leaf';
    const paper = leaf || kind === 'paper' || kind === 'parchment';
    const duration = leaf ? .42 : kind === 'parchment' ? .85 : paper ? .22 : .38;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    const base = kind === 'low' ? 145 : kind === 'high' ? 330 : 245;
    // La hoja de navegación tiene un roce más largo y dos filtros suaves:
    // quitar agudos evita el golpe áspero, incluso en altavoces de móvil.
    const smoothing = leaf ? 1 - Math.exp(-2 * Math.PI * 900 / audio.sampleRate) : .18;
    let seed = 731, soft = 0, softer = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / audio.sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = (seed >>> 0) / 2147483648 - 1;
      soft += smoothing * (noise - soft);
      softer += smoothing * (soft - softer);
      const attack = Math.min(1, t / .012);
      const tail = Math.min(1, (duration - t) / .035);
      data[i] = paper
        ? (leaf ? softer : soft) * Math.sin(Math.PI * t / duration) ** 2 * .32
        : attack * tail * (Math.sin(2 * Math.PI * base * t) * Math.exp(-t * 19) * .22 +
          Math.sin(2 * Math.PI * base * 1.47 * t) * Math.exp(-t * 32) * .09 +
          soft * Math.exp(-t * 65) * .12);
    }
    samples.set(kind, buffer);
    return buffer;
  }
  async function cue(kind) {
    if (!CT.effectPrefs?.().sound || document.hidden) return;
    const now = performance.now();
    if (now - (lastCue.get(kind) ?? -Infinity) < (kind === 'hover' ? 180 : 80)) return;
    lastCue.set(kind, now);
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === "suspended") await audio.resume();
      if (!CT.effectPrefs?.().sound || document.hidden || performance.now() - now > 300) return;
      for (const [texture, delay, volume, rate = 1] of scores[kind]) {
        if (voices.size >= 6) break;
        const source = audio.createBufferSource(), gain = audio.createGain();
        source.buffer = sample(texture);
        if (source.playbackRate) source.playbackRate.value = rate;
        gain.gain.value = volume * EFFECT_VOLUME;
        source.connect(gain); gain.connect(audio.destination);
        voices.add(source);
        source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(audio.currentTime + delay);
      }
    } catch { /* El texto y el resultado visual siguen disponibles. */ }
  }
  // El sonido y la vibración siguen siendo preferencias independientes.
  CT.Effects = {
    hapticsAvailable,
    testHaptics() { return vibration("confirm"); },
    feedback(correct) { lastResult = performance.now(); pending = null; void vibration(correct ? "success" : "failure"); void cue(correct ? 'success' : 'failure'); },
    tap() { void vibration("confirm"); void cue('tap'); },
    page(backwards = false) { transition(backwards ? 'back' : 'page'); },
    transition
  };
  document.addEventListener("click", event => {
    const tactile = event.target.closest('[data-action="confirm-place"], [data-online-action="confirm-place"], [data-action="select-card"], [data-action="solo-place"], [data-action="place"], [data-online-action="select"], [data-online-action="place"]');
    if (tactile && !tactile.disabled) void vibration("confirm");
    const summary = event.target.closest('summary');
    const details = summary?.parentElement;
    if (details?.matches('.solo-fold, .enc-deck')) transition(details.open ? 'close' : 'expand');
  }, true);
  CT.Art = {
    button(mode, card) {
      const src = CT.animalArt(mode, card).match(/src="([^"]+)"/)?.[1];
      const source = /^https:\/\//.test(card.source || '') ? `<p class="hint"><a href="${CT.escapeHtml(card.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a></p>` : ['animals','lifespan','speed'].includes(mode) ? '<p class="hint">Cifra pendiente de documentar con una fuente. Puede variar según las condiciones indicadas.</p>' : '';
      // La lámina se ve aquí mismo, no detrás de un botón: el aviso de resultado tapa la
      // mesa justo cuando uno quiere mirar la carta que acaba de colocar. Sigue siendo
      // pulsable para verla a pantalla completa.
      return (src ? `<button class="art-thumb" data-art-src="${CT.escapeHtml(src)}" data-art-title="${CT.escapeHtml(card.title)}" aria-label="Ver la ilustración de ${CT.escapeHtml(card.title)} a pantalla completa"><img src="${CT.escapeHtml(src)}" alt="" width="512" height="768" decoding="async"><span aria-hidden="true">Ampliar</span></button>` : "") + source;
    }
  };
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-art-src]");
    if (event.target.closest("[data-art-close]")) { CT.closeDialog(); return; }
    if (!button || !/^assets\/[a-z0-9/_\-.]+$/i.test(button.dataset.artSrc)) return;
    const overlay = document.createElement("div"); overlay.className = "overlay";
    const modal = document.createElement("div"); modal.className = "modal art-modal";
    const title = document.createElement("h2"); title.textContent = button.dataset.artTitle;
    const img = document.createElement("img"); img.src = button.dataset.artSrc; img.alt = "Ilustración de " + button.dataset.artTitle;
    const close = document.createElement("button"); close.className = "btn btn-primary btn-block"; close.dataset.artClose = ""; close.textContent = "Volver a la carta";
    modal.append(title, img, close); overlay.append(modal); document.getElementById("app").append(overlay); CT.openDialog(overlay, true);
  });
})();
