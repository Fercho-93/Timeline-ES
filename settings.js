// Ajustes que no dependen de la partida: tema, sonido y vibración. Viven aparte porque
// los dos motores (el local en `app.js` y el compartido en `online.js`) los necesitan
// por igual, y porque no se guardan por modalidad como una partida: son del móvil, no
// del juego que se esté jugando.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  const KEY = "hilo-ajustes-v1";
  const DEFAULTS = { theme: "auto", sound: true, haptics: true };

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      return { ...DEFAULTS, ...stored };
    } catch { return { ...DEFAULTS }; }
  }

  let settings = read();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* almacenamiento lleno */ }
  }

  // El tema se aplica en el elemento raíz: «auto» no pone nada y deja mandar a
  // `prefers-color-scheme`, tal como está montada la hoja de estilos.
  function applyTheme() {
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
    // El color de la barra del navegador no lee variables CSS ni `data-theme`: en
    // `index.html` hay dos etiquetas, una por preferencia del sistema, para que sea
    // correcto antes incluso de que este script se ejecute. Con una preferencia
    // explícita que no coincida con el sistema, se fuerzan las dos al mismo color; en
    // «auto» se les devuelve el suyo y vuelve a mandar el sistema.
    const claro = "#f7f5f1", oscuro = "#16130e";
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      if (settings.theme === "auto") meta.setAttribute("content", (meta.getAttribute("media") || "").includes("dark") ? oscuro : claro);
      else meta.setAttribute("content", settings.theme === "dark" ? oscuro : claro);
    });
  }

  applyTheme();

  // Dos pitidos cortos con osciladores, no con archivos: no hay nada que precargar ni
  // que guardar en la caché del `service worker`, y arrancan igual de rápido la primera
  // vez que la centésima. `AudioContext` solo se crea al primer sonido —crearlo antes de
  // cualquier gesto del usuario lo deja «suspended» en algunos navegadores— y se reutiliza
  // después.
  let audioCtx = null;
  function ctx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  }

  function tone(context, frequency, start, duration, peak) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  // El acierto sube (dos notas ascendentes); el fallo baja y es más corto y más grave,
  // para que se distingan sin mirar la pantalla.
  function playSound(kind) {
    if (!settings.sound) return;
    const context = ctx();
    if (!context) return;
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    if (kind === "hit") {
      tone(context, 587.33, now, 0.16, 0.16);
      tone(context, 880, now + 0.09, 0.22, 0.16);
    } else {
      tone(context, 220, now, 0.24, 0.14);
    }
  }

  // Un patrón corto y distinto para el fallo; el acierto no vibra, que sea la excepción
  // y no la costumbre es lo que hace que se note.
  function vibrate(kind) {
    if (!settings.haptics || !navigator.vibrate) return;
    navigator.vibrate(kind === "hit" ? 12 : [40, 40, 40]);
  }

  function panelHtml() {
    const s = settings;
    return `<div class="overlay" data-overlay="settings"><div class="modal settings-modal">
      <div class="eyebrow">Ajustes</div>
      <h2>Cómo se ve y se oye</h2>
      <div class="field">
        <label for="ajuste-tema">Tema</label>
        <select id="ajuste-tema" data-settings-action="theme">
          <option value="auto"${s.theme === "auto" ? " selected" : ""}>Automático, según el móvil</option>
          <option value="light"${s.theme === "light" ? " selected" : ""}>Claro</option>
          <option value="dark"${s.theme === "dark" ? " selected" : ""}>Oscuro</option>
        </select>
      </div>
      <label class="switch-row"><span>Sonido al colocar una carta</span><input type="checkbox" data-settings-action="sound"${s.sound ? " checked" : ""}></label>
      <label class="switch-row"><span>Vibración al fallar</span><input type="checkbox" data-settings-action="haptics"${s.haptics ? " checked" : ""}></label>
      <button class="btn btn-primary btn-block" data-settings-action="close">Hecho</button>
    </div></div>`;
  }

  // Cada motor pinta a su manera, así que abrir y cerrar el panel pasa por lo que ya
  // tienen: `CT.openDialog`/`CT.closeDialog`, los mismos diálogos que usan las reglas o
  // el menú de partida.
  function open() {
    document.getElementById("app").insertAdjacentHTML("beforeend", panelHtml());
    CT.openDialog(document.querySelector('[data-overlay="settings"]'), true);
  }

  document.addEventListener("change", event => {
    const action = event.target.dataset.settingsAction;
    if (!action) return;
    if (action === "theme") settings.theme = event.target.value;
    else if (action === "sound") settings.sound = event.target.checked;
    else if (action === "haptics") settings.haptics = event.target.checked;
    save();
    if (action === "theme") applyTheme();
    if (action === "sound" && settings.sound) playSound("hit");
    if (action === "haptics" && settings.haptics) vibrate("miss");
  });

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-settings-action]");
    if (!target) return;
    if (target.dataset.settingsAction === "open") open();
    else if (target.dataset.settingsAction === "close") CT.closeDialog();
  });

  CT.playSound = playSound;
  CT.vibrate = vibrate;
  CT.settingsButton = () => '<button class="icon-btn" data-settings-action="open">Ajustes</button>';
})();
