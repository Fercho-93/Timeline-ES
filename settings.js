// El único ajuste que no depende de la partida: el tema. Vive aparte porque los dos
// motores (el local en `app.js` y el compartido en `online.js`) lo necesitan por igual,
// y porque no se guarda por modalidad como una partida: es del móvil, no del juego que
// se esté jugando.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  const KEY = "hilo-ajustes-v1";
  const DEFAULTS = { theme: "auto" };
  // Pendiente de rellenar antes de repartir la beta: el correo donde debe llegar el
  // informe de comentarios. Hasta entonces el botón avisa de que aún no hay dirección.
  const FEEDBACK_EMAIL = "";

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
    const claro = "#d7b778", oscuro = "#21170d";
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      if (settings.theme === "auto") meta.setAttribute("content", (meta.getAttribute("media") || "").includes("dark") ? oscuro : claro);
      else meta.setAttribute("content", settings.theme === "dark" ? oscuro : claro);
    });
  }

  applyTheme();

  function panelHtml() {
    const s = settings;
    return `<div class="overlay" data-overlay="settings"><div class="modal settings-modal">
      <div class="eyebrow">Ajustes</div>
      <h2>Tema</h2>
      <div class="field">
        <label for="ajuste-tema">Cómo se ve la aplicación</label>
        <select id="ajuste-tema" data-settings-action="theme">
          <option value="auto"${s.theme === "auto" ? " selected" : ""}>Automático, según el móvil</option>
          <option value="light"${s.theme === "light" ? " selected" : ""}>Claro</option>
          <option value="dark"${s.theme === "dark" ? " selected" : ""}>Oscuro</option>
        </select>
      </div>
      <h2>Comentarios</h2>
      <p class="hint">¿Algo no va bien o se te ocurre algo? Manda un correo con la versión instalada y la pantalla en la que estás, para no tener que describirlo de memoria.</p>
      <button class="btn btn-secondary btn-block" data-settings-action="feedback">Enviar comentario</button>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-settings-action="close">Hecho</button>
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

  document.addEventListener("change", event => {
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
  });

  CT.settingsButton = () => '<button class="icon-btn" data-settings-action="open">Ajustes</button>';
})();
