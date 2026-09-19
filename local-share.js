// Cómo viaja la señal WebRTC (oferta/respuesta de `local-transport.js`) de un móvil a
// otro sin internet: no por QR —pesa varios cientos de bytes, más de lo que admite el
// generador de QR pequeño que ya usa `online.js` para los enlaces de sala—, sino por el
// "compartir" propio del móvil. `navigator.share` en modo avión sigue ofreciendo Bluetooth,
// AirDrop o Nearby Share: son transportes locales del sistema operativo, no de internet.
// Si el sistema no ofrece compartir, se cae a copiar al portapapeles; si eso tampoco está,
// queda el texto a la vista para copiarlo a mano.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  // Compartir con éxito, copiado como red de seguridad, cancelado por la propia persona
  // (no es un fallo: cerrar la hoja de compartir es una elección válida) o sin ninguna vía
  // disponible, que solo debería pasar en un navegador de escritorio sin portapapeles.
  async function shareSignal(text, { title = "Continuum", label = "Código de conexión" } = {}) {
    if (typeof text !== "string" || !text.trim()) throw new Error("EMPTY_SIGNAL");
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, text }); return "shared"; }
      catch (error) {
        // Cancelar la hoja de compartir no es un fallo del código: es la persona
        // decidiendo no mandarlo. Cualquier otro motivo cae al portapapeles.
        if (error?.name === "AbortError") return "cancelled";
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
    throw new Error("SHARE_UNAVAILABLE");
  }

  // Para cuando el texto llega por el portapapeles (se copió tras compartirlo, o alguien
  // lo pegó desde donde lo recibió) en vez de escribirlo a mano en un campo de texto.
  async function pasteSignal() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) throw new Error("PASTE_UNAVAILABLE");
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) throw new Error("EMPTY_CLIPBOARD");
    return text;
  }

  CT.LocalShare = { shareSignal, pasteSignal };
})();
