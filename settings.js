// El único ajuste que no depende de la partida: el tema. Vive aparte porque los dos
// motores (el local en `app.js` y el compartido en `online.js`) lo necesitan por igual,
// y porque no se guarda por modalidad como una partida: es del móvil, no del juego que
// se esté jugando.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  const KEY = "hilo-ajustes-v1";
  const DEFAULTS = { theme: "auto", textSize: "100" };
  // Pendiente de rellenar antes de repartir la beta: el correo donde debe llegar el
  // informe de comentarios. Hasta entonces el botón avisa de que aún no hay dirección.
  const FEEDBACK_EMAIL = CT.Deployment.feedbackEmail;

  function read() {
    try {
      const stored = JSON.parse(CT.Storage.getItem(KEY));
      return { ...DEFAULTS, ...stored };
    } catch { return { ...DEFAULTS }; }
  }

  let settings = read();

  function save() {
    try { CT.Storage.setItem(KEY, JSON.stringify(settings)); } catch { /* almacenamiento lleno */ }
  }

  // El tema se aplica en el elemento raíz: «auto» no pone nada y deja mandar a
  // `prefers-color-scheme`, tal como está montada la hoja de estilos.
  function applyTheme() {
    document.documentElement.style.fontSize = ({100:'100%',125:'125%',150:'150%',200:'200%'})[settings.textSize] || '100%';
    document.documentElement.dataset.textSize = settings.textSize;
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
    // El color de la barra del navegador no lee variables CSS ni `data-theme`: en
    // `index.html` hay dos etiquetas, una por preferencia del sistema, para que sea
    // correcto antes incluso de que este script se ejecute. Con una preferencia
    // explícita que no coincida con el sistema, se fuerzan las dos al mismo color; en
    // «auto» se les devuelve el suyo y vuelve a mandar el sistema.
    const claro = "#f3eee4", oscuro = "#1c211f";
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      if (settings.theme === "auto") meta.setAttribute("content", (meta.getAttribute("media") || "").includes("dark") ? oscuro : claro);
      else meta.setAttribute("content", settings.theme === "dark" ? oscuro : claro);
    });
  }

  applyTheme();

  function panelHtml() {
    const s = settings;
    // Sin `data-dialog-focus`, `openDialog` mete el foco en el primer control del
    // panel: el desplegable de tema. En iOS/Safari, enfocar un `<select>` dentro del
    // mismo gesto que abre el diálogo hace que el propio selector nativo se despliegue
    // de inmediato, como si ya se hubiera tocado. El foco inicial va aquí en su lugar.
    return `<div class="overlay" data-overlay="settings"><div class="modal settings-modal">
      <div class="eyebrow" tabindex="-1" data-dialog-focus>Ajustes</div>

      <section class="settings-section">
        <h2>Tema</h2>
        <div class="field">
          <label for="ajuste-tema">Cómo se ve la aplicación</label>
          <select id="ajuste-tema" data-settings-action="theme">
            <option value="auto"${s.theme === "auto" ? " selected" : ""}>Automático, según el móvil</option>
            <option value="light"${s.theme === "light" ? " selected" : ""}>Claro</option>
            <option value="dark"${s.theme === "dark" ? " selected" : ""}>Oscuro</option>
          </select>
        </div>
        <div class="field">
          <label for="ajuste-texto">Tamaño del texto</label>
          <select id="ajuste-texto" data-settings-action="text-size">
            ${[['100','Normal'],['125','Grande'],['150','Muy grande'],['200','Doble']].map(([value,label])=>`<option value="${value}"${s.textSize===value?' selected':''}>${label}</option>`).join('')}
          </select>
        </div>
      </section>

      <section class="settings-section">
        <h2>Efectos opcionales</h2>
        <label class="opt-row"><span>Vibración suave</span><input type="checkbox" data-settings-action="haptics" ${s.haptics === true ? "checked" : ""}></label>
        <label class="opt-row"><span>Sonidos breves</span><input type="checkbox" data-settings-action="sound" ${s.sound === true ? "checked" : ""}></label>
        <p class="hint">Los efectos acompañan al resultado; toda la información también se muestra en texto.</p>
      </section>

      <section class="settings-section">
        <h2>Jugar sin conexión</h2>
        <p class="hint">En la web instalada, las reglas y cartas funcionan sin conexión tras completar la instalación. Las ilustraciones que no se precargan necesitan haberse abierto antes con internet. La app nativa lleva el arte incluido. Las salas de varios móviles siempre necesitan conexión.</p>
      </section>

      <section class="settings-section">
        <h2>Copias de seguridad</h2>
        <button class="btn btn-secondary btn-block" data-settings-action="backup">Descargar partidas y progreso</button>
        <p class="hint">Recuperar una copia sustituye los datos que contiene y conserva un archivo de los anteriores. Sal de la partida antes de recuperarla.</p>
        <div class="field">
          <label for="restore-backup">Recuperar copia de Continuum</label>
          <!-- El control nativo trunca el nombre del archivo con puntos suspensivos y no
               hay forma de hacer que ese texto envuelva línea: es el propio navegador quien
               lo dibuja, no algo que arregle una regla CSS. El botón y el nombre de aquí son
               los que se ven; el input real sigue existiendo pero oculto, y la etiqueta de
               fuera ya lo abre sin necesitar JavaScript. -->
          <div class="file-field${CT.isSessionActive?.() ? " file-field-disabled" : ""}">
            <label class="btn btn-secondary" for="restore-backup">Seleccionar archivo</label>
            <span id="restore-backup-name">Ningún archivo seleccionado</span>
          </div>
          <input id="restore-backup" class="solo-lectores" type="file" accept="application/json,.json" data-settings-action="restore" ${CT.isSessionActive?.() ? "disabled" : ""}>
        </div>
      </section>

      <section class="settings-section">
        <h2>Comentarios</h2>
        <p class="hint" style="text-align:left;margin-top:0"><a href="privacidad.html" target="_blank" rel="noopener noreferrer">Privacidad y datos</a></p>
        <div class="field">
          <label for="feedback-note">Comentario para la beta</label>
          <textarea id="feedback-note" rows="3" maxlength="4000" placeholder="Qué ocurrió y qué esperabas"></textarea>
        </div>
        <button class="btn btn-secondary btn-block" data-settings-action="download-feedback">Guardar comentario con diagnóstico</button>
        <p class="hint">¿Algo no va bien o se te ocurre algo? Manda un correo con la versión instalada y la pantalla en la que estás, para no tener que describirlo de memoria.</p>
        <button class="btn btn-secondary btn-block" data-settings-action="feedback">Enviar comentario</button>
      </section>

      <button class="btn btn-primary btn-block settings-done" data-settings-action="close">Hecho</button>
    </div></div>`;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  async function sendFeedback() {
    if (!FEEDBACK_EMAIL) { showToast("Todavía no hay una dirección de contacto configurada."); return; }
    const detalle = await CT.appDiagnostics?.() ?? "";
    const cuerpo = encodeURIComponent(`Cuéntame qué ha pasado:\n\n\n---\n${detalle}`);
    location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Continuum: comentario")}&body=${cuerpo}`;
  }

  // Cada motor pinta a su manera, así que abrir y cerrar el panel pasa por lo que ya
  // tienen: `CT.openDialog`/`CT.closeDialog`, los mismos diálogos que usan las reglas o
  // el menú de partida.
  function open() {
    document.getElementById("app").insertAdjacentHTML("beforeend", panelHtml());
    CT.openDialog(document.querySelector('[data-overlay="settings"]'), true);
  }

  CT.effectPrefs = () => ({ sound: settings.sound === true, haptics: settings.haptics === true });
  document.addEventListener("change", event => {
    if (event.target.dataset.settingsAction === 'text-size') {
      if (!['100','125','150','200'].includes(event.target.value)) return;
      settings.textSize = event.target.value; save(); applyTheme(); return;
    }
    if (["sound", "haptics"].includes(event.target.dataset.settingsAction)) {
      settings[event.target.dataset.settingsAction] = event.target.checked; save(); return;
    }
    if (event.target.id === "restore-backup") {
      const nombre = document.getElementById("restore-backup-name");
      if (nombre) nombre.textContent = event.target.files?.[0]?.name || "Ningún archivo seleccionado";
    }
    if (event.target.dataset.settingsAction === "restore") {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          if (CT.Storage.restore(reader.result)) location.reload();
          else showToast("La copia está en memoria. Reintenta el guardado antes de cerrar.");
        } catch (error) { showToast(error.message || "No se pudo recuperar la copia."); }
      };
      reader.onerror = () => showToast("No se pudo leer la copia.");
      reader.readAsText(file);
      return;
    }
    if (event.target.dataset.settingsAction !== "theme") return;
    settings.theme = event.target.value;
    save();
    applyTheme();
  });

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-settings-action]");
    if (!target) return;
    if (target.dataset.settingsAction === "open") open();
    else if (target.dataset.settingsAction === "close") CT.closeDialog();
    else if (target.dataset.settingsAction === "feedback") sendFeedback();
    else if (target.dataset.settingsAction === "backup") CT.Storage.backup();
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
