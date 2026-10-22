// Edad de quien juega: la política de privacidad pide el permiso de la madre, el padre o el tutor para jugar
// online y aparecer en el ranking con menos de 14 años. El juego lo pregunta una vez (app-config.js, al
// arrancar) y guarda la respuesta en este dispositivo. Sin ese permiso, Continuum funciona sin conexión:
// app-config.js corta la conexión con el servidor y accounts.js no deja activar el ranking.
// Es una declaración de quien juega, como en cualquier juego: no se pide ningún documento.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const KEY = "continuum-edad-v1";
  const VALUES = ["mayor", "permiso", "menor"];

  // 'mayor' (14 o más), 'permiso' (menor con permiso), 'menor' (sin permiso) o null si aún no se ha preguntado.
  function estado() {
    try { const value = CT.Storage.getItem(KEY); return VALUES.includes(value) ? value : null; } catch { return null; }
  }
  function fijar(value) {
    try { if (VALUES.includes(value)) CT.Storage.setItem(KEY, value); else CT.Storage.removeItem?.(KEY); } catch { /* sin almacenamiento */ }
    document.dispatchEvent(new CustomEvent("continuum:edad", { detail: { estado: estado() } }));
  }
  const permiteOnline = () => estado() !== "menor";

  function style() {
    if (document.getElementById("edad-style")) return;
    const node = document.createElement("style");
    node.id = "edad-style";
    node.textContent = ".edad-overlay{position:fixed;inset:0;z-index:9600;display:grid;place-items:center;padding:24px;background:rgba(20,14,8,.88)}"
      + ".edad-card{max-width:380px;padding:28px 22px;border-radius:16px;background:#fffdf8;color:#231f1a;text-align:center;font:16px/1.5 system-ui,sans-serif}"
      + ".edad-card h2{margin:0 0 10px;font-family:Georgia,serif}.edad-card p{margin:0 0 18px}"
      + ".edad-card button{display:block;width:100%;box-sizing:border-box;margin-top:10px;padding:12px;border-radius:10px;font:700 16px system-ui,sans-serif;cursor:pointer}"
      + ".edad-card .edad-si{background:#b65331;color:#fff;border:0}.edad-card .edad-no{background:transparent;color:#4f463c;border:1px solid #b9ad9b}";
    document.head.append(node);
  }

  // Un paso del diálogo: título, texto y dos botones. Devuelve qué botón se pulsó.
  function paso(titulo, texto, si, no) {
    return new Promise(resolve => {
      style();
      const overlay = document.createElement("div");
      overlay.className = "edad-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "edad-title");
      const card = document.createElement("div");
      card.className = "edad-card";
      const h = document.createElement("h2"); h.id = "edad-title"; h.textContent = titulo;
      const p = document.createElement("p"); p.textContent = texto;
      const yes = document.createElement("button"); yes.type = "button"; yes.className = "edad-si"; yes.textContent = si; yes.dataset.edad = "si";
      const nope = document.createElement("button"); nope.type = "button"; nope.className = "edad-no"; nope.textContent = no; nope.dataset.edad = "no";
      const done = answer => { overlay.remove(); resolve(answer); };
      yes.onclick = () => done(true);
      nope.onclick = () => done(false);
      card.append(h, p, yes, nope);
      overlay.append(card);
      document.body.append(overlay);
      yes.focus();
    });
  }

  let preguntando = null;
  // Pregunta la edad si aún no se sabe (o si se pide `otra vez`) y devuelve el estado guardado.
  function preguntar(otraVez = false) {
    if (!otraVez && estado()) return Promise.resolve(estado());
    if (preguntando) return preguntando;
    preguntando = (async () => {
      const mayor = await paso("¿Tienes 14 años o más?", "Lo preguntamos una vez para saber si puedes jugar online y aparecer en el ranking. La respuesta se guarda solo en este dispositivo.", "Sí, 14 o más", "No, tengo menos de 14");
      if (mayor) { fijar("mayor"); return "mayor"; }
      const permiso = await paso("¿Tienes permiso de tu madre, padre o tutor?", "Con menos de 14 años necesitas su permiso para jugar online y aparecer en el ranking. Sin él, Continuum funciona igual sin conexión: tu progreso se guarda solo en este dispositivo.", "Sí, tengo su permiso", "No, jugar sin conexión");
      fijar(permiso ? "permiso" : "menor");
      return estado();
    })().finally(() => { preguntando = null; });
    return preguntando;
  }

  // Texto para Ajustes: qué se declaró y un botón para cambiarlo.
  function resumen() {
    const texto = { mayor: "14 años o más", permiso: "menos de 14, con permiso", menor: "menos de 14, sin permiso: solo sin conexión" }[estado()] || "sin indicar";
    return `<p class="hint" style="text-align:left">Edad declarada: ${texto}.</p><button type="button" class="btn btn-secondary" data-edad-action="cambiar">Cambiar la edad</button>`;
  }
  document.addEventListener("click", event => {
    if (!event.target.closest?.('[data-edad-action="cambiar"]')) return;
    event.preventDefault();
    preguntar(true).then(() => CT.AppConfig?.check?.());
  });

  CT.Edad = { estado, fijar, permiteOnline, preguntar, resumen };
})();
