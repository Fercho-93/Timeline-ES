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
  async function tone(correct) {
    if (!CT.effectPrefs?.().sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === "suspended") await audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = correct ? 660 : 220;
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(); oscillator.stop(audio.currentTime + 0.16);
    } catch { /* El texto y el resultado visual siguen disponibles. */ }
  }
  CT.Effects = { feedback(correct) { void vibration(correct ? "success" : "failure"); void tone(correct); } };
  document.addEventListener("click", event => {
    if (event.target.closest('[data-action="confirm-place"], [data-online-action="confirm-place"]')) void vibration("confirm");
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
