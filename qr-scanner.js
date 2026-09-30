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

  // `onFrame` se llama con el texto del QR en cuanto la cámara consigue leerlo, y puede
  // repetirse mientras el código siga a la vista — quien llama decide qué hacer con eso
  // (aquí, aceptar la primera lectura y parar) y cuándo dejar de escuchar (`stop()`).
  async function start(videoEl, onFrame, onError) {
    if (!isSupported()) throw new Error("CAMERA_UNAVAILABLE");
    await ensureLibrary();
    // Sin pedir resolución, el navegador puede elegir una muy baja por su cuenta (varía
    // según el móvil y el navegador) — de sobra para una videollamada, no para resolver
    // los cuadraditos finos de un código QR denso como el de una invitación completa. Se
    // pide la más alta que el propio móvil ofrezca, y enfoque continuo donde exista: sin
    // esto un lado de la conversación puede leer perfectamente al otro y el otro no leer
    // nada, según qué resolución eligiera cada navegador por defecto.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" }] },
      audio: false
    });
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "true");
    videoEl.muted = true;
    try { await videoEl.play(); } catch { /* Algunos navegadores ya lo reproducen solos al asignar srcObject. */ }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let stopped = false, frameHandle = null, busy = false, lastRun = 0, frameCount = 0;
    // El lector nativo (Chrome/Android) es más tolerante que jsQR con pantallas de iPhone
    // (muaré, brillo, reflejos); si no existe o falla, sigue jsQR como antes.
    let detector = null;
    try { if (typeof BarcodeDetector === "function") detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch { detector = null; }

    // jsQR a resolución completa es lento en Android y, sin tolerar colores invertidos, falla
    // con algunas pantallas: se reduce a ~900 px y cada pocos fotogramas se prueba también
    // la imagen invertida.
    function decodeWithJsQr() {
      const w = videoEl.videoWidth, h = videoEl.videoHeight;
      const scale = Math.min(1, 900 / Math.max(w, h));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const mode = frameCount % 3 === 2 ? "attemptBoth" : "dontInvert";
      return jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: mode })?.data || "";
    }

    async function scan() {
      busy = true;
      try {
        let text = "";
        if (detector) {
          try { text = (await detector.detect(videoEl))[0]?.rawValue || ""; } catch { detector = null; }
        }
        if (!text && !stopped) text = decodeWithJsQr();
        if (text && !stopped) onFrame(text);
      } catch (error) { onError?.(error); }
      busy = false;
    }

    function tick(now) {
      if (stopped) return;
      if (!busy && now - lastRun > 120 && videoEl.readyState >= 2 && videoEl.videoWidth) {
        lastRun = now;
        frameCount += 1;
        void scan();
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
