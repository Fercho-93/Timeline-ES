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
  let haptics;
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
  // Las acciones son silenciosas, incluso con preferencias antiguas sound:true.
  // Conservamos la API de avisos para no afectar al juego ni a la vibración.
  // La música ambiente tiene su reproductor independiente en ambience.js.
  CT.Effects = {
    hapticsAvailable,
    stamp() { void vibration("confirm"); },
    testHaptics() { return vibration("confirm"); },
    feedback(correct) { void vibration(correct ? "success" : "failure"); },
    tap() { void vibration("confirm"); },
    page() {},
    transition() {}
  };
  document.addEventListener("click", event => {
    const tactile = event.target.closest('[data-action="confirm-place"], [data-online-action="confirm-place"], [data-action="select-card"], [data-action="solo-place"], [data-action="place"], [data-online-action="select"], [data-online-action="place"]');
    if (tactile && !tactile.disabled) void vibration("confirm");
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
