(function () {
  "use strict";
  // Tiempo por jugada: la misma opción en todas las formas de jugar (menos el reto diario,
  // que es igual para todo el mundo). «Sin tiempo» o un plazo de 15, 20 o 30 segundos para
  // cada carta o turno. Cada pantalla recuerda lo último que se eligió en ella.
  const CT = window.CONTINUUM;
  const OPCIONES = [0, 15, 20, 30];
  const clave = contexto => `continuum-tiempo-${contexto}-v1`;
  const valido = s => OPCIONES.includes(Number(s));
  function get(contexto, porDefecto = 0) {
    try { const guardado = CT.Storage.getItem(clave(contexto)); if (guardado !== null && valido(guardado)) return Number(guardado); } catch { /* sin almacenamiento */ }
    return porDefecto;
  }
  function set(contexto, segundos) {
    if (!valido(segundos)) return;
    try { CT.Storage.setItem(clave(contexto), String(Number(segundos))); } catch { /* almacenamiento lleno */ }
  }
  const icono = '<svg class="solo-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  // El campo: cuatro pastillas, con el mismo aspecto en todas las pantallas (edition.css).
  // `valor` fija lo marcado (la sala de espera recuerda lo que eligió el anfitrión) y
  // `nombre` el del grupo, para que quien lo lea lo reconozca.
  function field(contexto, { porDefecto = 0, etiqueta = "Tiempo por carta", attrs = "", valor = null, nombre = `tiempo-${contexto}` } = {}) {
    const actual = valor !== null && valido(valor) ? Number(valor) : get(contexto, porDefecto), id = `${nombre}-label`;
    return `<div class="field duel-kind-field tiempo-field"${attrs}>
      <span class="field-label" id="${id}">${etiqueta}</span>
      <div class="segmented tiempo-segmented" role="radiogroup" aria-labelledby="${id}">${OPCIONES.map(s => `<label class="segmented-option${s === actual ? " is-on" : ""}">
        <input type="radio" name="${nombre}" value="${s}" data-tiempo="${contexto}"${s === actual ? " checked" : ""}>
        <span><b>${s ? `${s} s` : "Sin tiempo"}</b></span>
      </label>`).join("")}</div>
    </div>`;
  }
  // Lo elegido en pantalla (o lo guardado si el campo no está).
  function chosen(contexto, porDefecto = 0) {
    const marcado = document.querySelector(`input[data-tiempo="${contexto}"]:checked`);
    return marcado ? Number(marcado.value) : get(contexto, porDefecto);
  }
  document.addEventListener("change", event => {
    const input = event.target.closest?.("input[data-tiempo]");
    if (!input) return;
    set(input.dataset.tiempo, input.value);
    input.closest(".segmented")?.querySelectorAll(".segmented-option").forEach(op => op.classList.toggle("is-on", op.querySelector("input").checked));
  });
  // La barra de cuenta atrás, igual en todas partes: se pinta con lo que queda y `tick`
  // la pone en hora sin repintar la pantalla.
  function bar(restanteMs, totalMs) {
    const s = Math.ceil(Math.max(0, restanteMs) / 1000);
    return `<div class="reloj" data-tiempo-reloj><progress class="reloj-bar ${restanteMs <= 3000 ? "reloj-apura" : ""}" max="${totalMs}" value="${Math.max(0, restanteMs)}" aria-label="Tiempo restante"></progress><span class="reloj-left" aria-live="off">${s} s</span></div>`;
  }
  // Un reloj que avisa al acabarse. `empezadoEn` es un instante (Date.now()): así sigue
  // corriendo aunque se repinte la pantalla o el móvil se vaya al fondo.
  function clock({ empezadoEn, ms, onTimeout, root = document }) {
    let parado = false;
    const paso = () => {
      if (parado) return;
      const restante = ms - (Date.now() - empezadoEn);
      root.querySelectorAll("[data-tiempo-reloj]").forEach(caja => {
        const barra = caja.querySelector(".reloj-bar"), marca = caja.querySelector(".reloj-left");
        if (barra) { barra.value = Math.max(0, restante); barra.classList.toggle("reloj-apura", restante <= 3000); }
        if (marca) marca.textContent = `${Math.ceil(Math.max(0, restante) / 1000)} s`;
      });
      if (restante <= 0) { parado = true; clearInterval(id); onTimeout?.(); }
    };
    const id = setInterval(paso, 200);
    paso();
    return { stop() { parado = true; clearInterval(id); } };
  }
  const texto = s => (Number(s) ? `${Number(s)} s por carta` : "sin tiempo");
  CT.Tiempo = { OPCIONES, get, set, field, chosen, bar, clock, valido, texto };

  // Cartas iniciales por persona de las partidas en directo con amigos: se eligen en la pantalla
  // previa y la sala de espera (online o Wi‑Fi) solo las enseña.
  const MANO = [1, 2, 3, 4, 5, 6], CLAVE_MANO = "continuum-live-hand-v1";
  function mano() {
    try { const v = Number(CT.Storage.getItem(CLAVE_MANO)); if (MANO.includes(v)) return v; } catch { /* sin almacenamiento */ }
    return 4;
  }
  function manoField(id = "live-hand-size") {
    const actual = mano();
    return `<div class="field"><label for="${id}">Cartas iniciales por persona</label><select id="${id}" data-mano-inicial>${MANO.map(n => `<option value="${n}"${n === actual ? " selected" : ""}>${n}</option>`).join("")}</select></div>`;
  }
  document.addEventListener("change", event => {
    const select = event.target.closest?.("select[data-mano-inicial]");
    if (select && MANO.includes(Number(select.value))) { try { CT.Storage.setItem(CLAVE_MANO, String(Number(select.value))); } catch { /* almacenamiento lleno */ } }
  });
  // Poderes (Pulso y Fantasma) de esas mismas partidas: también se eligen en la pantalla previa.
  const CLAVE_PODERES = "continuum-live-powers-v1";
  function poderes() {
    try { const v = JSON.parse(CT.Storage.getItem(CLAVE_PODERES) || "{}"); return { pulse: !!v.pulse, ghost: !!v.ghost }; } catch { return { pulse: false, ghost: false }; }
  }
  function poderesField() {
    const p = poderes();
    return `<div class="poderes-field"><span class="field-label" id="live-powers-label">Poderes</span>
      <p class="hint">Para una primera partida, mejor sin poderes.</p>
      <label class="opt-row"><span>Cartas Fantasma <small>De 1 a 3 poderes ocultos según los jugadores. Pueden quedarse sin descubrir.</small></span><input type="checkbox" id="live-ghost-toggle" data-poder="ghost"${p.ghost ? " checked" : ""}></label>
      <label class="opt-row"><span>Cartas Pulso <small>Esconde de 1 a 3 poderes Pulso con el mismo reparto que Fantasma.</small></span><input type="checkbox" id="live-pulse-toggle" data-poder="pulse"${p.pulse ? " checked" : ""}></label>
    </div>`;
  }
  document.addEventListener("change", event => {
    const box = event.target.closest?.("input[data-poder]");
    if (!box) return;
    const p = poderes(); p[box.dataset.poder] = box.checked;
    try { CT.Storage.setItem(CLAVE_PODERES, JSON.stringify(p)); } catch { /* almacenamiento lleno */ }
  });
  // Texto para la sala de espera, que solo enseña lo elegido.
  const poderesTexto = (p = poderes()) => p.pulse && p.ghost ? "Pulso y Fantasma" : p.pulse ? "Pulso" : p.ghost ? "Fantasma" : "sin poderes";
  // Máximo de personas de la sala (2–9): se elige antes de crearla.
  const CLAVE_MAX = "continuum-live-max-v1", MAXIMOS = [2, 3, 4, 5, 6, 7, 8, 9];
  function maximo() {
    try { const v = Number(CT.Storage.getItem(CLAVE_MAX)); if (MAXIMOS.includes(v)) return v; } catch { /* sin almacenamiento */ }
    return 4;
  }
  function maximoField() {
    const actual = maximo();
    return `<div class="field"><label for="live-max-players">Máximo de participantes</label><select id="live-max-players" data-maximo-sala>${MAXIMOS.map(n => `<option value="${n}"${n === actual ? " selected" : ""}>${n} jugadores</option>`).join("")}</select></div>`;
  }
  document.addEventListener("change", event => {
    const select = event.target.closest?.("select[data-maximo-sala]");
    if (select && MAXIMOS.includes(Number(select.value))) { try { CT.Storage.setItem(CLAVE_MAX, String(Number(select.value))); } catch { /* almacenamiento lleno */ } }
  });
  CT.ManoInicial = { get: mano, field: manoField, poderes, poderesField, poderesTexto, maximo, maximoField };
})();
