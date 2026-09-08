(function () {
  "use strict";
  const CT = window.CONTINUUM;
  let serverAnchor = null, monotonicAnchor = 0;
  CT.Session = {
    calibrate(serverMs, sent, received = performance.now()) {
      if (!Number.isFinite(serverMs) || received < sent) return;
      serverAnchor = serverMs + (received - sent) / 2;
      monotonicAnchor = received;
    },
    now() { return serverAnchor === null ? null : serverAnchor + performance.now() - monotonicAnchor; },
    remaining(startedMs, seconds) {
      const now = this.now();
      return !seconds || now === null || !Number.isFinite(startedMs) ? null : Math.max(0, Math.ceil((startedMs + seconds * 1000 - now) / 1000));
    },
    presence(record) {
      const now = this.now();
      if (!record || now === null) return "Sin señal confirmada";
      if (now - record.seenAt > 90000) return "Sin actividad reciente";
      return record.visible ? "En la sala" : "En segundo plano";
    }
  };
})();
