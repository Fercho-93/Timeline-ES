(function () {
  "use strict";
  const CT = window.CONTINUUM;
  CT.APP_VERSION = "continuum-v86";
  CT.Updates = { start };
  function start() {
    if (!("serviceWorker" in navigator) || window.Capacitor?.isNativePlatform?.()) return;
    let registration, applying = false, timer, offlineFailure = false;
    const box = document.createElement("aside");
    box.id = "update-notice"; box.className = "system-notice";
    box.setAttribute("role", "status");
    const label = document.createElement("span"), button = document.createElement("button");
    button.className = "btn btn-secondary"; button.textContent = "Actualizar ahora";
    box.append(label, button);
    function refresh() {
      if (applying) return;
      if (!registration?.waiting) { if (!offlineFailure) box.remove(); return; }
      CT.Storage.noticeHost().append(box);
      button.hidden = false;
      button.disabled = !!CT.isSessionActive?.() || CT.Storage.hasPending();
      label.textContent = button.disabled ? "Nueva versión disponible. Podrás actualizar al terminar o salir de la partida." : "Nueva versión lista. Tu progreso guardado se conservará.";
    }
    function optionalError() {
      offlineFailure = true;
      if (registration?.waiting) { refresh(); return; }
      label.textContent = "No se pudo preparar el modo sin conexión. Puedes seguir jugando y reintentarlo al recuperar la conexión.";
      button.hidden = true; CT.Storage.noticeHost().append(box);
    }
    function unlock() {
      applying = false; clearTimeout(timer);
      document.getElementById("app")?.removeAttribute("inert");
    }
    button.addEventListener("click", () => {
      refresh();
      if (button.disabled || !registration?.waiting) return;
      applying = true; button.disabled = true;
      document.getElementById("app")?.setAttribute("inert", "");
      label.textContent = "Aplicando actualización…";
      registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
      timer = setTimeout(() => { unlock(); refresh(); label.textContent = "La actualización sigue pendiente. Puedes reintentarlo."; }, 15000);
    });
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type !== "UPDATE_BLOCKED") return;
      unlock(); refresh(); label.textContent = "Cierra las otras pestañas de Continuum antes de actualizar.";
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (applying) { clearTimeout(timer); location.reload(); }
      else refresh(); // Una instalación inicial nunca interrumpe la pantalla abierta.
    });
    async function check() {
      try {
        if (!registration) {
          registration = await navigator.serviceWorker.register("service-worker.js");
          registration.addEventListener("updatefound", () => {
            registration.installing?.addEventListener("statechange", refresh);
          });
        } else await registration.update();
        offlineFailure = false; refresh();
      } catch { optionalError(); }
    }
    new MutationObserver(refresh).observe(document.getElementById("app"), { childList: true, subtree: true });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void check(); });
    window.addEventListener("online", () => { CT.Storage.flush(); void check(); });
    if (document.readyState === "complete") void check();
    else window.addEventListener("load", () => void check(), { once: true });
  }
})();
