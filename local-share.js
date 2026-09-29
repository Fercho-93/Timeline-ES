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

  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Enseña un texto (un enlace de sala, una invitación…) como código QR en una ventana. Sirve
  // para cualquier modo multijugador: el otro móvil lo lee con su cámara o con «Escanear QR».
  // Devuelve false si el texto no cabe en un QR (el llamador avisa con otra vía).
  function showQr({ eyebrow = "Invitación", title = "Escanea para entrar", text, hint = "", code = "" } = {}) {
    if (!text || !CT.QrEncode) return false;
    const layer = document.createElement("div");
    layer.className = "overlay qr-overlay"; layer.dataset.qrOverlay = "";
    layer.innerHTML = `<div class="modal qr-modal"><div class="eyebrow">${escape(eyebrow)}</div><h2>${escape(title)}</h2><div class="qr-frame"><canvas aria-label="${escape(title)}, en código QR"></canvas></div>${code ? `<div class="qr-room-code">${escape(code)}</div>` : ""}${hint ? `<p>${escape(hint)}</p>` : ""}<div class="actions"><button class="btn btn-primary btn-block" data-qr-close>Cerrar</button></div></div>`;
    try { CT.QrEncode.draw(layer.querySelector("canvas"), text); }
    catch (error) { console.error(error); return false; }
    layer.querySelector("[data-qr-close]").addEventListener("click", () => CT.closeDialog());
    (document.getElementById("app") || document.body).append(layer);
    CT.openDialog(layer, true);
    return true;
  }

  // Abre la cámara en una ventana y entrega el primer texto leído a `onText`. Vale para leer
  // invitaciones y respuestas entre móviles sin internet (el texto no cabe en un enlace).
  async function scanQr({ title = "Escanear QR", hint = "Encuadra el código QR del otro móvil.", onText } = {}) {
    if (!CT.QrScanner?.isSupported()) throw new Error("CAMERA_UNAVAILABLE");
    const layer = document.createElement("div");
    layer.className = "overlay qr-overlay"; layer.dataset.qrOverlay = "";
    layer.innerHTML = `<div class="modal qr-modal"><div class="eyebrow">Cámara</div><h2>${escape(title)}</h2><div class="qr-panel"><div class="qr-frame"><video playsinline muted aria-label="Cámara"></video></div></div><p data-qr-status aria-live="polite">${escape(hint)}</p><div class="actions"><button class="btn btn-secondary btn-block" data-qr-close>Cancelar</button></div></div>`;
    (document.getElementById("app") || document.body).append(layer);
    let handle = null, closed = false;
    const stop = () => { closed = true; handle?.stop(); };
    layer.querySelector("[data-qr-close]").addEventListener("click", () => { stop(); CT.closeDialog(); });
    CT.openDialog(layer, true, stop);
    try {
      const found = new Promise(resolve => {
        CT.QrScanner.start(layer.querySelector("video"), text => resolve(text), () => {
          const status = layer.querySelector("[data-qr-status]"); if (status) status.textContent = "No se ha podido leer el código. Sigue encuadrándolo.";
        }).then(h => { handle = h; if (closed) h.stop(); }).catch(error => {
          const status = layer.querySelector("[data-qr-status]"); if (status) status.textContent = "No se pudo acceder a la cámara. Revisa los permisos y vuelve a intentarlo."; console.error(error);
        });
      });
      const text = await found;
      stop(); CT.closeDialog();
      onText?.(text);
    } catch (error) { stop(); throw error; }
  }

  CT.LocalShare = { shareSignal, pasteSignal, showQr, scanQr };
})();
