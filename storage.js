(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const pending = new Map();
  const protectedKeys = new Set();
  let message = "";
  function noticeHost() {
    let host = document.getElementById("system-notices");
    if (!host) { host = document.createElement("div"); host.id = "system-notices"; document.body.append(host); }
    return host;
  }
  function notice(text) {
    message = text;
    let box = document.getElementById("storage-notice");
    if (!box) {
      box = document.createElement("aside");
      box.id = "storage-notice";
      box.className = "system-notice";
      box.setAttribute("role", "alert");
      noticeHost().append(box);
    }
    box.replaceChildren();
    const label = document.createElement("span");
    label.textContent = text;
    box.append(label);
    for (const [title, action] of [["Reintentar guardado", flush], ["Descargar copia", backup]]) {
      const button = document.createElement("button");
      button.className = "btn btn-secondary";
      button.textContent = title;
      button.addEventListener("click", action);
      box.append(button);
    }
  }
  function failed() { notice("No se ha podido guardar. El progreso sigue en esta pantalla: mantén la app abierta y reintenta o descarga una copia."); }
  function getItem(key) {
    if (pending.has(key)) return pending.get(key);
    try { return window.localStorage.getItem(key); }
    catch { protectedKeys.add(key); failed(); return null; }
  }
  function write(key, value) {
    pending.set(key, value);
    try {
      // Conservar una partida ilegible antes de reemplazarla por una nueva.
      if (protectedKeys.has(key)) {
        const old = window.localStorage.getItem(key);
        if (old !== null) window.localStorage.setItem(`${key}-recovery-${Date.now()}`, old);
        protectedKeys.delete(key);
      }
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
      pending.delete(key);
      return true;
    } catch { failed(); return false; }
  }
  function flush() {
    for (const [key, value] of [...pending]) write(key, value);
    if (!pending.size && !protectedKeys.size) document.getElementById("storage-notice")?.remove();
    else if (protectedKeys.size && !pending.size) notice("Hay una partida que necesita recuperación. Conservamos su copia original; puedes descargarla antes de empezar otra.");
  }
  function backup() {
    const entries = {};
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (/^(hilo-|continuum-)/.test(key)) entries[key] = window.localStorage.getItem(key);
      }
    } catch { /* La copia incluye al menos todos los cambios pendientes. */ }
    for (const [key, value] of pending) entries[key] = value;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "continuum-backup", version: 1, entries }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "continuum-recuperacion.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function restore(text) {
    if (CT.isSessionActive?.()) throw Error("Sal de la partida antes de recuperar una copia.");
    const data = JSON.parse(text);
    if (data?.format !== "continuum-backup" || data.version !== 1 || !data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)) throw Error("Copia no reconocida.");
    const list = Object.entries(data.entries);
    if (list.some(([key, value]) => !/^(hilo-|continuum-)/.test(key) || (value !== null && typeof value !== "string"))) throw Error("La copia contiene datos no válidos.");
    // Todas las claves se validan antes de escribir. Los originales quedan archivados.
    for (const [key, value] of list) { protectedKeys.add(key); write(key, value); }
    return !pending.size;
  }
  CT.Storage = {
    getItem, setItem: (key, value) => write(key, String(value)), removeItem: key => write(key, null),
    flush, backup, restore, hasPending: () => pending.size > 0,
    protect(key) { protectedKeys.add(key); notice("No podemos abrir una partida guardada con este formato. Su original se conserva para recuperarlo; no se ha borrado."); },
    notice, noticeHost, get message() { return message; }
  };
  window.addEventListener("beforeunload", event => {
    if (!pending.size) return;
    event.preventDefault(); event.returnValue = "";
  });
})();
