// El avatar de cada cual sale de su nombre: el mismo nombre dibuja siempre el mismo
// personaje, en cualquier móvil (blobatar.js, MIT). Por eso no hay que elegirlo ni
// guardarlo, y en una sala de varios móviles cada uno puede pintar el de los demás con
// el nombre que ya viaja en la partida, sin mandar nada más.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const generador = () => window.CONTINUUM_BLOBATAR?.blobatar;

  // `etiqueta` lo nombra para lectores de pantalla; sin ella el dibujo es decorativo,
  // porque el nombre ya está escrito al lado.
  function markup(nombre, { size = 40, etiqueta = "", clase = "" } = {}) {
    const semilla = String(nombre ?? "").trim() || "?";
    const accesible = etiqueta ? `role="img" aria-label="${CT.escapeHtml(etiqueta)}"` : 'aria-hidden="true"';
    const dibuja = generador();
    // Sin el generador (un archivo que no llegó a cargar) se queda la inicial: nunca
    // un hueco vacío en el marcador.
    if (!dibuja) return `<span class="avatar avatar-inicial ${clase}" ${accesible} style="width:${size}px;height:${size}px">${CT.escapeHtml(CT.initials(semilla))}</span>`;
    return dibuja(semilla, { size, background: "circle" })
      .replace("<svg ", `<svg class="avatar ${clase}" ${accesible} focusable="false" `);
  }

  CT.Avatares = { markup };
})();
