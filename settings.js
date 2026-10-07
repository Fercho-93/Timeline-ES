// El único ajuste que no depende de la partida: el tema. Vive aparte porque los dos
// motores (el local en `app.js` y el compartido en `online.js`) lo necesitan por igual,
// y porque no se guarda por modalidad como una partida: es del móvil, no del juego que
// se esté jugando.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  const KEY = "hilo-ajustes-v1";
  const DEFAULTS = { theme: "light", textSize: "100", haptics: false, ambience: false, depth: false, ambienceVolume: 50 };
  // Las dos apariencias, en un solo sitio: de aquí salen el desplegable, la validación
  // de lo guardado y el color de la barra del navegador.
  const THEMES = {
    light: { label: "Claro", barra: "#f3eee4" },
    dark: { label: "Oscuro", barra: "#18110b" }
  };
  // Pendiente de rellenar antes de repartir la beta: el correo donde debe llegar el
  // informe de comentarios. Hasta entonces el botón avisa de que aún no hay dirección.
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
      <header class="atlas-page-heading"><div class="eyebrow">A tu manera</div><h1 tabindex="-1" data-dialog-focus>Ajustes</h1><p>Encuentra tu forma de leer, escuchar y jugar.</p></header><div class="settings-layout">

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
            ${[['100','Normal'],['125','Grande'],['150','Muy grande'],['200','Doble']].map(([value,label])=>`<option value="${value}"${s.textSize===value?' selected':''}>${label}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary btn-block settings-apply-look" data-settings-action="apply-look" disabled>Aplicar apariencia</button>
      </section>

      <section class="settings-section settings-effects">
        <div class="settings-section-heading"><span aria-hidden="true">02</span><div><h2>Sonido y movimiento</h2><p>Pequeños detalles para acompañar la partida.</p></div></div>
        <label class="opt-row"><span>Vibración suave</span><input type="checkbox" data-settings-action="haptics" aria-describedby="haptics-help" ${s.haptics === true && hapticsSupported ? "checked" : ""} ${hapticsSupported ? "" : "disabled"}></label>
        <p class="hint" id="haptics-help" role="status">${hapticsSupported ? 'Un toque breve al elegir posición, confirmar y recibir el resultado.' : (window.Capacitor?.isNativePlatform?.() ? 'La vibración no está disponible en esta versión de la app. Comprueba si hay una actualización.' : 'Este navegador no ofrece vibración. En iPhone necesitas la app de TestFlight o App Store.')}</p>
        ${hapticsSupported ? `<button class="btn btn-secondary" data-settings-action="test-haptics" ${s.haptics ? '' : 'disabled'}>Probar vibración</button>` : ''}
        <label class="opt-row"><span>Música ambiente</span><input type="checkbox" data-settings-action="ambience" ${s.ambience === true ? "checked" : ""}></label>
        <div class="field settings-volume">
          <label for="ajuste-volumen">Volumen de la música <output id="ajuste-volumen-valor">${Number(s.ambienceVolume) || 0}%</output></label>
          <input id="ajuste-volumen" type="range" min="0" max="100" step="5" value="${Math.max(0, Math.min(100, Number(s.ambienceVolume) || 0))}" data-settings-action="ambience-volume" aria-describedby="volume-help">
          <p class="hint" id="volume-help">Puedes dejar la música activa y bajar su volumen hasta 0 %.</p>
        </div>
        <label class="opt-row"><span>Profundidad al mover el móvil</span><input type="checkbox" data-settings-action="depth" ${s.depth === true ? "checked" : ""}></label>
        <p class="hint"><a href="assets/audio/CREDITS.md" target="_blank" rel="noopener noreferrer">Créditos de la música</a></p>
        <p class="hint" data-depth-help>La profundidad solo actúa en las portadas y respeta «reducir movimiento».</p>
        <p class="hint">Los efectos acompañan al resultado; toda la información también se muestra en texto.</p>
      </section>

      </div><details class="settings-section settings-support"><summary><span><b>Versión y conexión</b><small>Uso sin conexión e información de la aplicación</small></span><i aria-hidden="true">+</i></summary><div class="settings-support-body">
        <p class="hint">Versión instalada: ${CT.escapeHtml(CT.APP_VERSION || "desconocida")}</p>
        <button class="btn btn-secondary" data-settings-action="device-check">Comprobar sonido, vibración y movimiento</button>
        <pre class="hint" id="device-check-result" role="status" aria-live="polite" style="white-space:pre-wrap;margin:10px 0 0;font:.78rem/1.5 ui-monospace,monospace"></pre>
        <p class="hint">Las partidas locales y las cartas ya descargadas funcionan sin conexión. Las salas, duelos por turnos, ranking y comentarios necesitan conexión. Si una ilustración no aparece, recarga cuando tengas internet.</p>
      </div></details>

      ${window.CONTINUUM?.Accounts?.ready ? `<details class="settings-section settings-support settings-privacy"><summary><span><b>Privacidad y ranking</b><small>Qué se guarda y quién lo ve</small></span><i aria-hidden="true">+</i></summary><div class="settings-support-body">
        <p class="hint" style="text-align:left">Tu progreso (partidas, aciertos, logros y retos diarios) se guarda en un servidor (Firebase) para que no se pierda, sin correo ni datos personales. El ranking del reto diario es público y opcional: solo apareces si lo decides.</p>
        <label class="opt-row"><span>Aparecer en el ranking público <small>Nombre de perfil, avatar, aciertos y tiempo</small></span><input type="checkbox" data-ranking-toggle ${window.CONTINUUM.Accounts.rankingPublico === true ? "checked" : ""}></label>
        <p class="hint" style="text-align:left"><a href="privacidad.html" target="_blank" rel="noopener noreferrer">Política de privacidad</a> · Para borrar tus datos: Atlas → Tu cuenta y tus datos.</p>
      </div></details>` : ""}

      <details class="settings-section settings-support"><summary><span><b>Ayuda y comentarios</b><small>Cuéntanos cómo mejorar tu experiencia</small></span><i aria-hidden="true">+</i></summary><div class="settings-support-body">
        <p class="hint" style="text-align:left;margin-top:0"><a href="privacidad.html#arte" target="_blank" rel="noopener noreferrer">Privacidad, datos y procedencia del arte</a></p>
        <div class="field">
          <label for="feedback-note">Comentario para la beta</label>
          <textarea id="feedback-note" rows="3" maxlength="4000" placeholder="Qué ocurrió y qué esperabas"></textarea>
        </div>
        <button class="btn btn-secondary btn-block" data-settings-action="download-feedback">Guardar comentario con diagnóstico</button>
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

  // Comprobación en el propio dispositivo: ejecuta de verdad cada efecto y cuenta qué ocurre. Sirve
  // para saber, en un móvil concreto, si falla el sonido, la vibración o el movimiento y por qué.
  async function runDeviceCheck() {
    const out = document.getElementById('device-check-result');
    const lines = [];
    const say = text => { lines.push(text); if (out) out.textContent = lines.join('\n'); };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const cap = window.Capacitor;
    const native = cap?.isNativePlatform?.() === true;
    say(`Plataforma: ${native ? 'app nativa (' + (cap.getPlatform?.() || '?') + ')' : 'navegador'} · ${CT.APP_VERSION || 'versión desconocida'}`);
    say(`Ajustes: vibración ${settings.haptics ? 'sí' : 'no'} · música ${settings.ambience ? 'sí' : 'no'} · profundidad ${settings.depth ? 'sí' : 'no'} · volumen ${settings.ambienceVolume}%`);
    // El permiso se solicita dentro del gesto, antes de esperar al audio o al plugin.
    let orientationPermission = null;
    try {
      if (typeof window.DeviceOrientationEvent?.requestPermission === 'function')
        orientationPermission = window.DeviceOrientationEvent.requestPermission().then(value => ({value}), error => ({error}));
    } catch (error) { orientationPermission = Promise.resolve({error}); }
    // Vibración
    try {
      if (native) {
        say(`Vibración: plugin ${cap.isPluginAvailable?.('Haptics') === false ? 'NO disponible' : 'disponible'}`);
        const plugin = cap.registerPlugin?.('Haptics') || cap.Plugins?.Haptics;
        await plugin.impact({ style: 'MEDIUM' });
        say('Vibración: orden enviada sin error (¿la has notado?)');
      } else say(`Vibración: navegador ${typeof navigator.vibrate === 'function' ? 'con' : 'sin'} soporte`);
    } catch (error) { say(`Vibración: ERROR ${error?.message || error}`); }
    // Sonido
    let ctx = null;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('este móvil no tiene Web Audio');
      ctx = new Context();
      say(`Sonido: contexto creado (estado «${ctx.state}»)`);
      await Promise.race([ctx.resume(), wait(1500)]);
      say(`Sonido: tras reanudar, estado «${ctx.state}»`);
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = 440; gain.gain.value = 0.2;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      say('Sonido: pitido de 0,5 s enviado (¿lo has oído?)');
    } catch (error) { say(`Sonido: ERROR ${error?.message || error}`); }
    try {
      const data = await CT.AudioAssets.read('assets/audio/v1.mp3');
      say(`Música: pista leída (${Math.round(data.byteLength / 1024)} KB)`);
      if (ctx) {
        const decoded = await ctx.decodeAudioData(data);
        say(`Música: decodificada (${Math.round(decoded.duration)} s)`);
      }
    } catch (error) { say(`Música: ERROR ${error?.message || error}`); }
    // Movimiento (profundidad)
    try {
      if (!window.DeviceOrientationEvent) throw new Error('sin sensor de orientación');
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await orientationPermission;
        if (result.error) throw result.error;
        const permission = result.value;
        say(`Movimiento: permiso «${permission}»`);
        if (permission !== 'granted') throw new Error('permiso no concedido: revisa Ajustes del iPhone → Continuum');
      }
      let events = 0;
      const count = () => { events += 1; };
      window.addEventListener('deviceorientation', count);
      await wait(1500);
      window.removeEventListener('deviceorientation', count);
      say(`Movimiento: ${events} lecturas en 1,5 s ${events ? '(bien)' : '(ninguna: mueve el móvil durante la prueba)'}`);
    } catch (error) { say(`Movimiento: ERROR ${error?.message || error}`); }
    try { await ctx?.close(); } catch { /* ya cerrado */ }
    say('Hecho. Cuéntame qué has oído y notado, y mándame esta lista.');
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
    CT.setAmbience?.(false);
    CT.Ambience?.setVolume?.(settings.ambienceVolume / 100);
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

  CT.effectPrefs = () => ({ sound: false, haptics: settings.haptics === true, ambience: settings.ambience === true, depth: settings.depth === true, ambienceVolume: settings.ambienceVolume / 100 });
  CT.setAmbience = enabled => {
    settings.ambience = enabled === true;
    save();
    CT.UI?.updateEffects();
    document.dispatchEvent(new CustomEvent('continuum:settings-changed'));
    return settings.ambience;
  };
  function previewLook() {
    const preview=document.querySelector('[data-look-preview]'), apply=document.querySelector('[data-settings-action="apply-look"]');
    if(!preview||!apply)return;
    preview.dataset.previewTheme=draftLook.theme;
    preview.style.setProperty('--preview-text',String(Number(draftLook.textSize)/100));
    apply.disabled=draftLook.theme===settings.theme&&draftLook.textSize===settings.textSize;
    apply.textContent=apply.disabled?'Apariencia aplicada':'Aplicar apariencia';
  }
  document.addEventListener("change", async event => {
    if (event.target.dataset.settingsAction === 'ambience-volume') {
      const volume = Math.max(0, Math.min(100, Number(event.target.value) || 0));
      settings.ambienceVolume = volume;
      const output = document.getElementById('ajuste-volumen-valor');
      if (output) output.value = `${volume}%`;
      save();
      CT.Ambience?.setVolume?.(volume / 100);
      return;
    }
    if (event.target.dataset.settingsAction === 'text-size') {
      if (!['100','125','150','200'].includes(event.target.value)) return;
      draftLook.textSize = event.target.value; previewLook(); CT.Effects?.transition?.('select'); return;
    }
    if (["haptics", "ambience", "depth"].includes(event.target.dataset.settingsAction)) {
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
      if (key === 'ambience') CT.setAmbience(enabled);
      else { settings[key] = enabled; save(); CT.UI?.updateEffects(); }
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
    else if (target.dataset.settingsAction === "device-check") void runDeviceCheck();
    else if (target.dataset.settingsAction === "download-feedback") {
      void (async () => {
        const note = document.getElementById('feedback-note')?.value || '';
        const diagnostic = await CT.appDiagnostics?.() || '';
        const url = URL.createObjectURL(new Blob([note + '\n\n' + diagnostic], {type:'text/plain;charset=utf-8'}));
        const a = document.createElement('a'); a.href=url; a.download='continuum-comentario.txt'; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      })();
    }
  });

  CT.settingsButton = () => '<button class="icon-btn" data-settings-action="open">Ajustes</button>';
})();
