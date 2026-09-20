// Una señal WebRTC (o una invitación completa, que la envuelve junto al código de sala y
// la huella del mazo) pesa varios cientos de bytes — no cabe en un único QR de 106 bytes
// (`qr-encode.js`). En vez de escribir un QR de mayor capacidad desde cero, se trocea el
// texto en varios códigos que se enseñan seguidos en la misma pantalla (uno tras otro, como
// un QR animado) y la cámara del otro móvil los va leyendo hasta tener todas las partes.
//
// Cada trozo lleva su propia cabecera de seis caracteres, todos del mismo alfabeto que ya
// usa el texto que envuelven (letras y dígitos, sin acentos ni símbolos, así que cuentan
// como un byte cada uno para el límite del QR):
//   Q + una letra de sesión al azar + total en base 36 (2 cifras) + índice en base 36 (2
//   cifras) + hasta 100 caracteres del trozo.
// La letra de sesión evita mezclar trozos de dos códigos distintos si alguien vuelve a
// pedir un código nuevo a media lectura (por ejemplo, tras esperar demasiado). Sin ella, dos
// invitaciones seguidas con el mismo número de partes podrían confundirse entre sí.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  const CHUNK_SIZE = 100;
  const MAX_FRAMES = 35 * 36 + 35; // dos cifras en base 36

  function randomSessionChar() {
    const values = new Uint8Array(1);
    crypto.getRandomValues(values);
    return (values[0] % 36).toString(36).toUpperCase();
  }

  function base36(value) { return value.toString(36).toUpperCase().padStart(2, "0"); }

  // Trocea el texto en una o más piezas de QR. Con un texto que ya cabe en un solo código
  // (una respuesta corta, por ejemplo) igualmente devuelve un array de un elemento, con la
  // misma cabecera — quien lee no necesita distinguir el caso.
  function split(text) {
    const raw = String(text || "");
    if (!raw) throw new Error("EMPTY_TEXT");
    const total = Math.max(1, Math.ceil(raw.length / CHUNK_SIZE));
    if (total > MAX_FRAMES) throw new Error("TEXT_TOO_LARGE");
    const session = randomSessionChar();
    const totalTag = base36(total);
    const frames = [];
    for (let i = 0; i < total; i++) {
      frames.push(`Q${session}${totalTag}${base36(i)}${raw.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)}`);
    }
    return frames;
  }

  // Reúne lo que va leyendo la cámara. `ingest` se llama con cada texto que decodifica un
  // QR (puede llegar repetido, o de un código ajeno que no sigue este formato) y devuelve
  // el progreso, o el texto completo en cuanto están todas las partes. Si cambia la letra de
  // sesión o el total de partes a mitad de lectura, se asume que es un código nuevo y se
  // empieza de cero.
  function createReader() {
    let session = null, total = null;
    const chunks = new Map();

    function ingest(rawText) {
      const text = String(rawText || "").trim();
      if (text.length <= 6 || text[0] !== "Q") return null;
      const frameSession = text[1];
      const frameTotal = parseInt(text.slice(2, 4), 36);
      const frameIndex = parseInt(text.slice(4, 6), 36);
      if (!Number.isInteger(frameTotal) || !Number.isInteger(frameIndex) || frameTotal < 1 || frameIndex < 0 || frameIndex >= frameTotal) return null;
      if (session !== frameSession || total !== frameTotal) { session = frameSession; total = frameTotal; chunks.clear(); }
      chunks.set(frameIndex, text.slice(6));
      if (chunks.size < total) {
        const missing = [];
        for (let i = 0; i < total; i++) if (!chunks.has(i)) missing.push(i + 1);
        return { done: false, received: chunks.size, total, missing };
      }
      const ordered = [];
      for (let i = 0; i < total; i++) ordered.push(chunks.get(i));
      return { done: true, received: total, total, text: ordered.join("") };
    }

    function reset() { session = null; total = null; chunks.clear(); }

    return { ingest, reset };
  }

  CT.QrFrames = { CHUNK_SIZE, split, createReader };
})();
