// Lee códigos QR con la cámara del móvil, para el modo "Sin conexión": la alternativa a
// pegar a mano el código de invitación o de respuesta cuando no hay ningún canal común
// entre los dos móviles (por ejemplo, Android e iPhone en modo avión, sin Bluetooth
// emparejado ni AirDrop compatible).
//
// `jsqr.js` (decodificador, vendorizado sin modificar — ver su cabecera) pesa unos 250 KB
// sin comprimir: no se carga con el resto de la aplicación, solo la primera vez que se abre
// esta pantalla. Como está en la lista de precarga del service worker, esa carga sigue
// funcionando sin conexión igual que el resto del juego — solo se difiere para no pagar su
// peso quien nunca escanea nada.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  let loadingLibrary = null;
  function ensureLibrary() {
    if (typeof jsQR === "function") return Promise.resolve();
    if (loadingLibrary) return loadingLibrary;
    loadingLibrary = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "jsqr.js";
      script.onload = () => (typeof jsQR === "function" ? resolve() : reject(new Error("CAMERA_LIBRARY_UNAVAILABLE")));
      script.onerror = () => reject(new Error("CAMERA_LIBRARY_UNAVAILABLE"));
      document.head.appendChild(script);
    }).catch(error => { loadingLibrary = null; throw error; });
    return loadingLibrary;
  }

  function isSupported() {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  // `onFrame` se llama con el texto de cada QR que la cámara consigue leer, una y otra vez
  // mientras el vídeo siga encuadrando alguno — puede ser el mismo texto repetido (el código
  // no ha cambiado todavía) o partes distintas de un código animado (`qr-frames.js`); decidir
  // cuándo ya se tiene lo necesario es cosa de quien llama, no de este archivo.
  async function start(videoEl, onFrame, onError) {
    if (!isSupported()) throw new Error("CAMERA_UNAVAILABLE");
    await ensureLibrary();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "true");
    videoEl.muted = true;
    try { await videoEl.play(); } catch { /* Algunos navegadores ya lo reproducen solos al asignar srcObject. */ }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let stopped = false, frameHandle = null;

    function tick() {
      if (stopped) return;
      if (videoEl.readyState >= 2 && videoEl.videoWidth) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        try {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (result?.data) onFrame(result.data);
        } catch (error) { onError?.(error); }
      }
      frameHandle = requestAnimationFrame(tick);
    }
    frameHandle = requestAnimationFrame(tick);

    function stop() {
      if (stopped) return;
      stopped = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      stream.getTracks().forEach(track => track.stop());
      videoEl.srcObject = null;
    }
    return { stop };
  }

  CT.QrScanner = { isSupported, start };
})();
