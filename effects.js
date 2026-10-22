// Efectos visuales y de sonido de la mesa (al acertar, fallar, abrir diálogos…). Solo decoran: nunca
// deciden el resultado de una jugada.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  // El ambiente pertenece a la mesa y a la navegación, nunca al arte de las cartas.
  // No añade observadores, esperas ni estado persistido a la partida.
  CT.Scene = {
    apply(mode, screen) {
      const neutral = ["home", "jugar", "duelos", "perfil", "daily-intro", "comp-end", "online-entry", "online-loading", "competition-menu"].includes(screen) || String(screen).startsWith("hub-");
      document.documentElement.dataset.scene = !neutral && CT.has(mode) ? CT.blockOf(mode).art : "archive";
    }
  };
  // Motas de polvo que suben en la luz de la lámpara. Son elementos sueltos fuera de #app,
  // así que ningún repintado las reinicia; cada una lleva su tamaño, su velocidad y su
  // vaivén. Con «reducir movimiento» y durante la partida, edition.css las oculta.
  function motas() {
    if (document.querySelector(".motas") || !document.body) return;
    const capa = document.createElement("div");
    capa.className = "motas";
    capa.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 24; i++) {
      const mota = document.createElement("i");
      const d = 14 + Math.random() * 16;
      mota.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--s:${(3 + Math.random() * 4).toFixed(1)}px;` +
        `--d:${d.toFixed(1)}s;--delay:${(-Math.random() * d).toFixed(1)}s;` +
        `--sway:${(Math.random() * 60 - 30).toFixed(0)}px;--o:${(.55 + Math.random() * .45).toFixed(2)}`;
      capa.append(mota);
    }
    document.body.append(capa);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", motas, { once: true });
  else motas();
  let haptics;
  const starterHeard = new Set();
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
      // `confirm`: toque ligero (elegir, colocar, levantar); `medium`: algo pasa sin que lo hayas
      // tocado tú (te toca); `success`/`failure`/`warning`: resultados y avisos del sistema.
      if (window.Capacitor?.isNativePlatform?.()) {
        if (kind === 'confirm') await haptics.impact({ style: 'LIGHT' });
        else if (kind === 'medium') await haptics.impact({ style: 'MEDIUM' });
        else await haptics.notification({ type: kind === 'success' ? 'SUCCESS' : 'WARNING' });
        return true;
      }
      return navigator.vibrate({ failure: [18, 35, 18], warning: [30, 40, 30], medium: 28, success: [14, 40, 22] }[kind] || 18) !== false;
    } catch { return false; /* Un efecto opcional nunca impide jugar. */ }
  }
  // Los sonidos los sintetiza sonidos.js y dependen de su propio ajuste («Efectos de
  // sonido»), no de la antigua preferencia sound:true, que sigue sin reactivar nada.
  CT.Effects = {
    hapticsAvailable,
    stamp() { void vibration("confirm"); },
    testHaptics() { return vibration("confirm"); },
    feedback(correct) { void vibration(correct ? "success" : "failure"); CT.Sonidos?.result(correct); },
    tap() { void vibration("confirm"); },
    transition(kind, info) {
      CT.Sonidos?.cue(kind, info);
      // Los momentos que se tienen que notar también en la mano: levantar una carta, que sea tu
      // turno y el final de la partida. Los toques de menú solo suenan.
      if (kind === 'lift') void vibration('confirm');
      else if (kind === 'turn') void vibration('medium');
      else if (kind === 'end') void vibration('medium');
    },
    // Una lámina nueva llega justo detrás del acierto: su vibración espera a que pase la del acierto.
    discovery() { CT.Sonidos?.discovery(); setTimeout(() => void vibration('success'), 620); },
    achievement() { CT.Sonidos?.achievement(); setTimeout(() => void vibration('success'), 1000); },
    // En los tres últimos segundos, un toque por segundo; al agotarse, un aviso.
    clock(left) { CT.Sonidos?.clock(left); void vibration(left > 0 ? 'confirm' : 'warning'); },
    // El sorteo de quién empieza ya tiene resultado. Las salas repintan su panel en cada cambio:
    // `key` (la carta sorteada y la sala) hace que suene una sola vez por sorteo.
    starterResult(key) { if (key && starterHeard.has(key)) return; if (key) starterHeard.add(key); CT.Sonidos?.cue('turn'); void vibration('medium'); },
    // Activar un poder o recibir una carta de poder.
    power() { CT.Sonidos?.cue('power'); void vibration('medium'); },
    // Plantarse en Retos rápidos: asegurar lo ganado.
    bank() { CT.Sonidos?.cue('bank'); void vibration('medium'); }
  };
  // Activar Fantasma o lanzar un Pulso (al elegir a quién), en cualquier mesa.
  document.addEventListener("click", event => {
    const poder = event.target.closest('[data-action="ghost-use"], [data-online-action="ghost-use"], [data-local-action="ghost-use"], [data-action="pulse-target"], [data-online-action="pulse-target"], [data-local-action="pulse-target"]');
    if (poder && !poder.disabled) CT.Effects.power();
  }, true);
  document.addEventListener("click", event => {
    const tactile = event.target.closest('[data-action="confirm-place"], [data-online-action="confirm-place"], [data-action="select-card"], [data-action="solo-place"], [data-action="place"], [data-online-action="select"], [data-online-action="place"], [data-local-action="select"], [data-local-action="place"], [data-local-action="confirm-place"], [data-local-action="confirm-pulse"], [data-local-action="confirm-defense"], [data-online-action="confirm-pulse"], [data-online-action="confirm-defense"]');
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
