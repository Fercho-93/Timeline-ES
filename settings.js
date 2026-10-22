// La pantalla de Ajustes y las preferencias que no dependen de la partida: apariencia
// (tema y tamaño del texto), sonido, vibración y profundidad, más la ayuda (comentarios
// con diagnóstico, edad declarada, privacidad). Vive aparte porque se abre igual desde
// cualquier pantalla (la barra de abajo y el menú de cada partida, local u online) y
// porque se guarda por móvil, no por cuenta ni por modalidad (`hilo-ajustes-v1`, ver
// account-storage.js).
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  const KEY = "hilo-ajustes-v1";
  const TEXT_SIZES = [['100','Normal'],['125','Grande'],['150','Muy grande'],['200','Doble']];
  const DEFAULTS = { theme: "light", textSize: "100", haptics: false, depth: false, sfx: true, sfxVolume: 70 };
  // Las dos apariencias, en un solo sitio: de aquí salen el desplegable, la validación
  // de lo guardado y el color de la barra del navegador.
  const THEMES = {
    light: { label: "Claro", barra: "#f3eee4" },
    dark: { label: "Oscuro", barra: "#18110b" }
  };
  // El correo al que llegan los comentarios (deployment.js). Si estuviera vacío, el botón
  // avisa de que aún no hay dirección.
  const FEEDBACK_EMAIL = CT.Deployment.feedbackEmail;

  function migratedTheme(theme) {
    if (THEMES[theme]) return theme;
    if (theme === "night") return "dark";
    if (theme === "sepia" || theme === "contrast") return "light";
    if (theme === "auto") {
      try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
      catch { return "light"; }
    }
    return DEFAULTS.theme;
  }

  function read() {
    try {
      const stored = JSON.parse(CT.Storage.getItem(KEY));
      const settings = { ...DEFAULTS, ...stored };
      // La música ambiente se quitó del juego: se descartan sus ajustes guardados.
      delete settings.ambience; delete settings.ambienceVolume;
      // La versión anterior ofrecía seis aspectos. Se reducen a los dos equivalentes
      // sin tocar el resto de preferencias y se persiste la migración para hacerla una
      // sola vez. Un valor desconocido vuelve al aspecto principal.
      const previousTheme = settings.theme;
      settings.theme = migratedTheme(previousTheme);
      if (previousTheme !== settings.theme) {
        try { CT.Storage.setItem(KEY, JSON.stringify(settings)); } catch { /* almacenamiento lleno */ }
      }
      return settings;
    } catch { return { ...DEFAULTS }; }
  }

  let settings = read();
  let draftLook = { theme: settings.theme, textSize: settings.textSize };

  function save() {
    try { CT.Storage.setItem(KEY, JSON.stringify(settings)); } catch { /* almacenamiento lleno */ }
  }

  // El tema se aplica de forma explícita en el elemento raíz para que la aplicación y
  // la barra del navegador siempre compartan la misma apariencia.
  function applyTheme() {
    document.documentElement.dataset.platform = /Android/i.test(navigator.userAgent) ? 'android' : 'other';
    document.documentElement.style.fontSize = ({100:'var(--normal-text-size, 100%)',125:'125%',150:'150%',200:'200%'})[settings.textSize] || '100%';
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.setAttribute("data-theme", settings.theme);
    const elegido = THEMES[settings.theme].barra;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.setAttribute("content", elegido);
    });
  }

  applyTheme();

  function themeOptions(elegido) {
    const opcion = key => `<option value="${key}"${key === elegido ? " selected" : ""}>${THEMES[key].label}</option>`;
    return Object.keys(THEMES).map(opcion).join("");
  }

  function panelHtml() {
    const s = settings;
    const hapticsSupported = CT.Effects?.hapticsAvailable?.() === true;
    // Sin `data-dialog-focus`, `openDialog` mete el foco en el primer control del
    // panel: el desplegable de tema. En iOS/Safari, enfocar un `<select>` dentro del
    // mismo gesto que abre el diálogo hace que el propio selector nativo se despliegue
    // de inmediato, como si ya se hubiera tocado. El foco inicial va aquí en su lugar.
    return `<div class="overlay" data-overlay="settings"><div class="modal settings-modal">
      <div class="settings-head">
        <button class="settings-close" data-settings-action="close" aria-label="Cerrar ajustes">×</button>
      </div>
      <header class="atlas-page-heading settings-illustrated-heading"><img class="settings-heading-art" src="assets/menu-collections.webp" alt="" aria-hidden="true" decoding="async"><div class="eyebrow">A tu manera</div><h1 tabindex="-1" data-dialog-focus>Ajustes</h1><p>Encuentra tu forma de leer, escuchar y jugar.</p></header><div class="settings-layout">

      <section class="settings-section settings-appearance">
        <div class="settings-section-heading"><span aria-hidden="true">01</span><div><h2>Apariencia y lectura</h2><p>Prueba los cambios antes de aplicarlos.</p></div></div>
        <div class="settings-look-preview" data-look-preview data-preview-theme="${s.theme}" style="--preview-text:${Number(s.textSize)/100}">
          <div class="look-preview-page"><span>CONTINUUM</span><h3>Una página del atlas</h3><p>Así se verán el papel, la tinta y el tamaño de lectura.</p><div><i></i><b>1640</b></div></div>
        </div>
        <div class="field">
          <label for="ajuste-tema">Cómo se ve la aplicación</label>
          <select id="ajuste-tema" data-settings-action="theme">${themeOptions(s.theme)}</select>
        </div>
        <div class="field">
          <label for="ajuste-texto">Tamaño del texto</label>
          <select id="ajuste-texto" data-settings-action="text-size">
            ${TEXT_SIZES.map(([value,label])=>`<option value="${value}"${s.textSize===value?' selected':''}>${label}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary btn-block settings-apply-look" data-settings-action="apply-look" disabled>Aplicar apariencia</button>
      </section>

      <section class="settings-section settings-effects">
        <div class="settings-section-heading"><span aria-hidden="true">02</span><div><h2>Sonido y movimiento</h2><p>Pequeños detalles para acompañar la partida.</p></div></div>
        <label class="opt-row"><span>Vibración suave</span><input type="checkbox" data-settings-action="haptics" aria-describedby="haptics-help" ${s.haptics === true && hapticsSupported ? "checked" : ""} ${hapticsSupported ? "" : "disabled"}></label>
        <p class="hint" id="haptics-help" role="status">${hapticsSupported ? 'Un toque breve al elegir posición, confirmar y recibir el resultado.' : (window.Capacitor?.isNativePlatform?.() ? 'La vibración no está disponible en esta versión de la app. Comprueba si hay una actualización.' : 'Este navegador no ofrece vibración. En iPhone necesitas la app de TestFlight o App Store.')}</p>
        ${hapticsSupported ? `<button class="btn btn-secondary" data-settings-action="test-haptics" ${s.haptics ? '' : 'disabled'}>Probar vibración</button>` : ''}
        <label class="opt-row"><span>Efectos de sonido</span><input type="checkbox" data-settings-action="sfx" aria-describedby="sfx-help" ${s.sfx === true ? "checked" : ""}></label>
        <div class="field settings-volume">
          <label for="ajuste-volumen-efectos">Volumen de los efectos <output id="ajuste-volumen-efectos-valor">${Number(s.sfxVolume) || 0}%</output></label>
          <input id="ajuste-volumen-efectos" type="range" min="0" max="100" step="5" value="${Math.max(0, Math.min(100, Number(s.sfxVolume) || 0))}" data-settings-action="sfx-volume" aria-describedby="sfx-help">
          <p class="hint" id="sfx-help">Notas suaves al coger y colocar cartas, acertar o fallar. En iPhone respetan el modo silencio.</p>
        </div>
        <label class="opt-row"><span>Profundidad al mover el móvil</span><input type="checkbox" data-settings-action="depth" ${s.depth === true ? "checked" : ""}></label>
        <p class="hint" data-depth-help>La profundidad solo actúa en las portadas y respeta «reducir movimiento».</p>
        <p class="hint">Los efectos acompañan al resultado; toda la información también se muestra en texto.</p>
      </section>

      </div><details class="settings-section settings-support"><summary><span><b>Versión y conexión</b><small>Uso sin conexión e información de la aplicación</small></span><i aria-hidden="true">+</i></summary><div class="settings-support-body">
        <p class="hint">Versión instalada: ${CT.escapeHtml(CT.APP_VERSION || "desconocida")}</p>
        <p class="hint">Las partidas locales y las cartas ya descargadas funcionan sin conexión. Las salas, duelos por turnos, ranking y comentarios necesitan conexión. Si una ilustración no aparece, recarga cuando tengas internet.</p>
      </div></details>

      ${window.CONTINUUM?.Accounts?.ready ? `<details class="settings-section settings-support settings-privacy"><summary><span><b>Privacidad y ranking</b><small>Qué se guarda y quién lo ve</small></span><i aria-hidden="true">+</i></summary><div class="settings-support-body">
        <p class="hint" style="text-align:left">Tu progreso (partidas, aciertos, logros y retos diarios) se guarda en un servidor (Firebase) para que no se pierda, sin correo ni datos personales. El ranking del reto diario es público y opcional: solo apareces si lo decides.</p>
        <label class="opt-row"><span>Aparecer en el ranking público <small>Nombre de perfil, avatar, aciertos y tiempo</small></span><input type="checkbox" data-ranking-toggle ${window.CONTINUUM.Accounts.rankingPublico === true ? "checked" : ""}></label>
        <p class="hint" style="text-align:left"><a href="privacidad.html" target="_blank" rel="noopener noreferrer">Política de privacidad</a> · <a href="borrar-cuenta.html" target="_blank" rel="noopener noreferrer">Cómo borrar tus datos</a> (en el juego: Atlas → Tu cuenta y tus datos).</p>
      </div></details>` : ""}

      <details class="settings-section settings-support"><summary><span><b>Ayuda y comentarios</b><small>Cuéntanos cómo mejorar tu experiencia</small></span><i aria-hidden="true">+</i></summary><div class="settings-support-body">
        ${window.CONTINUUM.Edad?.resumen?.() || ""}
        <p class="hint" style="text-align:left;margin-top:0"><a href="privacidad.html#arte" target="_blank" rel="noopener noreferrer">Privacidad, datos y procedencia del arte</a> · <a href="terminos.html" target="_blank" rel="noopener noreferrer">Condiciones de uso</a> · <a href="aviso-legal.html" target="_blank" rel="noopener noreferrer">Aviso legal</a> · <a href="soporte.html" target="_blank" rel="noopener noreferrer">Soporte</a> · <a href="licencias.html" target="_blank" rel="noopener noreferrer">Licencias de terceros</a></p>
        <div class="field">
          <label for="feedback-note">Tu comentario</label>
          <textarea id="feedback-note" rows="3" maxlength="4000" placeholder="Qué ocurrió y qué esperabas"></textarea>
        </div>
        <button class="btn btn-secondary btn-block" data-settings-action="download-feedback">${window.Capacitor?.isNativePlatform?.() ? "Compartir comentario con diagnóstico" : "Guardar comentario con diagnóstico"}</button>
        <p class="hint">¿Algo no va bien o se te ocurre algo? Manda un correo con la versión instalada y la pantalla en la que estás, para no tener que describirlo de memoria.</p>
        <button class="btn btn-secondary btn-block" data-settings-action="feedback">Enviar comentario</button>
      </div></details>

      <button class="btn btn-ghost btn-block settings-reset" data-settings-action="reset-preferences">Restablecer preferencias</button>
      <p class="hint settings-reset-help">Restablece solo apariencia y efectos; conserva tu progreso, cartas y partidas guardadas.</p>

      <button class="btn btn-primary btn-block settings-done" data-settings-action="close">Hecho</button>
    </div></div>`;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    if (!toast.classList.contains('show') || toast.textContent !== message) CT.Effects?.transition?.('notice');
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  async function testHaptics() {
    const accepted = await CT.Effects?.testHaptics?.();
    const help = document.getElementById('haptics-help');
    if (help) help.textContent = accepted
      ? 'Prueba enviada. Si no la notas, revisa la vibración en los ajustes del teléfono.'
      : 'No se pudo activar la vibración en este dispositivo.';
  }

  async function sendFeedback() {
    if (!FEEDBACK_EMAIL) { showToast("Todavía no hay una dirección de contacto configurada."); return; }
    const detalle = await CT.appDiagnostics?.() ?? "";
    const nota = document.getElementById('feedback-note')?.value.trim() || 'Cuéntame qué ha pasado:';
    const cuerpo = encodeURIComponent(`${nota}\n\n---\n${detalle}`);
    location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Continuum: comentario")}&body=${cuerpo}`;
  }

  function resetPreferences() {
    if (!window.confirm('¿Restablecer apariencia y efectos? Tu progreso no cambiará.')) return;
    settings = { ...DEFAULTS };
    draftLook = { theme: settings.theme, textSize: settings.textSize };
    save();
    applyTheme();
    CT.UI?.updateEffects();
    CT.closeDialog();
    showToast('Preferencias restablecidas');
  }

  // Cada motor pinta a su manera, así que abrir y cerrar el panel pasa por lo que ya
  // tienen: `CT.openDialog`/`CT.closeDialog`, los mismos diálogos que usan las reglas o
  // el menú de partida.
  function open() {
    draftLook = { theme: settings.theme, textSize: settings.textSize };
    document.getElementById("app").insertAdjacentHTML("beforeend", panelHtml());
    CT.openDialog(document.querySelector('[data-overlay="settings"]'), true);
  }

  CT.effectPrefs = () => ({ sound: false, haptics: settings.haptics === true, depth: settings.depth === true, sfx: settings.sfx === true, sfxVolume: settings.sfxVolume / 100 });
  function previewLook() {
    const preview=document.querySelector('[data-look-preview]'), apply=document.querySelector('[data-settings-action="apply-look"]');
    if(!preview||!apply)return;
    preview.dataset.previewTheme=draftLook.theme;
    preview.style.setProperty('--preview-text',String(Number(draftLook.textSize)/100));
    apply.disabled=draftLook.theme===settings.theme&&draftLook.textSize===settings.textSize;
    apply.textContent=apply.disabled?'Apariencia aplicada':'Aplicar apariencia';
  }
  document.addEventListener("change", async event => {
    if (event.target.dataset.settingsAction === 'sfx-volume') {
      const volume = Math.max(0, Math.min(100, Number(event.target.value) || 0));
      settings.sfxVolume = volume;
      const output = document.getElementById('ajuste-volumen-efectos-valor');
      if (output) output.value = `${volume}%`;
      save();
      CT.Sonidos?.test();
      return;
    }
    if (event.target.dataset.settingsAction === 'text-size') {
      if (!['100','125','150','200'].includes(event.target.value)) return;
      draftLook.textSize = event.target.value; previewLook(); CT.Effects?.transition?.('select'); return;
    }
    if (["haptics", "depth", "sfx"].includes(event.target.dataset.settingsAction)) {
      const key = event.target.dataset.settingsAction;
      let enabled = event.target.checked;
      if (key === 'depth' && enabled) {
        event.target.disabled = true;
        enabled = await CT.UI.requestDepth();
        event.target.disabled = false;
        event.target.checked = enabled;
        const help = document.querySelector('[data-depth-help]');
        if (!enabled && help) help.textContent = 'Este dispositivo no ha permitido usar el movimiento. Las portadas siguen funcionando.';
      }
      settings[key] = enabled; save(); CT.UI?.updateEffects();
      CT.Effects?.transition?.('select');
      if (key === 'haptics') {
        const test = document.querySelector('[data-settings-action="test-haptics"]');
        if (test) test.disabled = !enabled;
        if (enabled) await testHaptics();
      }
      return;
    }
    if (event.target.dataset.settingsAction !== "theme") return;
    if (!THEMES[event.target.value]) return;
    draftLook.theme = event.target.value;
    CT.Effects?.transition?.('select');
    previewLook();
  });

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-settings-action]");
    if (!target) return;
    if (target.dataset.settingsAction === "open") open();
    else if (target.dataset.settingsAction === "close") CT.closeDialog();
    else if (target.dataset.settingsAction === "apply-look") {
      settings.theme=draftLook.theme;settings.textSize=draftLook.textSize;save();applyTheme();CT.Effects?.transition?.('select');previewLook();
    }
    else if (target.dataset.settingsAction === "feedback") sendFeedback();
    else if (target.dataset.settingsAction === "reset-preferences") resetPreferences();
    else if (target.dataset.settingsAction === "test-haptics") void testHaptics();
    else if (target.dataset.settingsAction === "download-feedback") {
      void (async () => {
        const note = document.getElementById('feedback-note')?.value || '';
        const diagnostic = await CT.appDiagnostics?.() || '';
        try {
          const result = await CT.Storage.saveFile('continuum-comentario.txt', note + '\n\n' + diagnostic);
          if (result === 'copied') showToast('Comentario copiado al portapapeles.');
        } catch { showToast('No se ha podido guardar el comentario en este dispositivo.'); }
      })();
    }
  });

  // Elegir el tamaño del texto en la bienvenida: se aplica al momento, sin el paso de
  // «Aplicar» de Ajustes, porque la propia pantalla es la vista previa.
  CT.textSizePicker = () => {
    const actual = settings.textSize;
    return `<fieldset class="bienvenida-letra"><legend>Tamaño de la letra</legend>
      <div class="bienvenida-muestra" aria-hidden="true"><small>Carta de ejemplo</small><strong>Llegada de Colón a América</strong><b>1492</b></div>
      <div class="segmented bienvenida-letra-opciones">${TEXT_SIZES.map(([value, label]) => `<label class="segmented-option${value === actual ? " is-on" : ""}"><input type="radio" name="bienvenida-letra" value="${value}" data-text-size-pick${value === actual ? " checked" : ""}><span><b>${label}</b></span></label>`).join("")}</div>
      <p class="hint">Puedes cambiarlo luego en Ajustes.</p></fieldset>`;
  };
  document.addEventListener("change", event => {
    const input = event.target.closest?.("input[data-text-size-pick]");
    if (!input || !TEXT_SIZES.some(([value]) => value === input.value)) return;
    settings.textSize = input.value;
    draftLook.textSize = input.value;
    save();
    applyTheme();
    input.closest(".segmented")?.querySelectorAll(".segmented-option").forEach(op => op.classList.toggle("is-on", op.querySelector("input").checked));
  });

  CT.settingsButton = () => '<button class="icon-btn" data-settings-action="open">Ajustes</button>';
})();
