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
  async function vibration(kind) {
    if (!CT.effectPrefs?.().haptics) return;
    try {
      const cap = window.Capacitor;
      if (cap?.isNativePlatform?.()) {
        haptics ||= cap.registerPlugin?.("Haptics") || cap.Plugins?.Haptics;
        if (kind === "confirm") await haptics?.impact({ style: "LIGHT" });
        else await haptics?.notification({ type: kind === "success" ? "SUCCESS" : "WARNING" });
      } else navigator.vibrate?.(kind === "failure" ? [12, 35, 12] : 12);
    } catch { /* Un efecto opcional nunca impide jugar. */ }
  }
  const samples = new Map(), voices = new Set(), lastCue = new Map();
  // Papel y resonancias de madera, sin imponer otra melodía a las seis pistas.
  // La textura utiliza su propia semilla: nunca consume el azar del reparto.
  function sample(kind) {
    if (samples.has(kind)) return samples.get(kind);
    const paper = kind === 'paper', duration = paper ? .22 : .38;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    const base = kind === 'low' ? 145 : kind === 'high' ? 330 : 245;
    let seed = 731, soft = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / audio.sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = (seed >>> 0) / 2147483648 - 1;
      soft += .18 * (noise - soft);
      const attack = Math.min(1, t / .012);
      const tail = Math.min(1, (duration - t) / .035);
      data[i] = paper
        ? soft * Math.sin(Math.PI * t / duration) ** 2 * .32
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
    if (now - (lastCue.get(kind) ?? -Infinity) < 80) return;
    lastCue.set(kind, now);
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === "suspended") await audio.resume();
      if (!CT.effectPrefs?.().sound || document.hidden) return;
      const score = kind === 'success' ? [['wood', 0, .24], ['high', .13, .19]]
        : kind === 'failure' ? [['low', 0, .22], ['paper', .09, .16]]
        : kind === 'page' ? [['paper', 0, .3]] : [['wood', 0, .12]];
      for (const [texture, delay, volume] of score) {
        if (voices.size >= 6) break;
        const source = audio.createBufferSource(), gain = audio.createGain();
        source.buffer = sample(texture);
        gain.gain.value = volume;
        source.connect(gain); gain.connect(audio.destination);
        voices.add(source);
        source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(audio.currentTime + delay);
      }
    } catch { /* El texto y el resultado visual siguen disponibles. */ }
  }
  // El sonido y la vibración siguen siendo preferencias independientes.
  CT.Effects = {
    feedback(correct) { void vibration(correct ? "success" : "failure"); void cue(correct ? 'success' : 'failure'); },
    tap() { void vibration("confirm"); void cue('tap'); },
    page() { void cue('page'); }
  };
  document.addEventListener("click", event => {
    if (event.target.closest('[data-action="confirm-place"], [data-online-action="confirm-place"]')) void vibration("confirm");
    if (event.target.closest('.hand-card:not([disabled]), .slot:not([disabled])')) void cue('tap');
  }, true);
  CT.Art = {
    button(mode, card) {
      const src = CT.animalArt(mode, card).match(/src="([^"]+)"/)?.[1];
      const source = /^https:\/\//.test(card.source || '') ? `<p class="hint"><a href="${CT.escapeHtml(card.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a></p>` : ['animals','lifespan','speed'].includes(mode) ? '<p class="hint">Cifra pendiente de documentar con una fuente. Puede variar según las condiciones indicadas.</p>' : '';
      return (src ? `<button class="btn btn-secondary" data-art-src="${CT.escapeHtml(src)}" data-art-title="${CT.escapeHtml(card.title)}">Ver ilustración</button>` : "") + source;
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
