// Genera el código QR del modo "Sin conexión" con `qrcode-generator` (vendorizado sin
// modificar en `qrcode-generator.js`, ver su cabecera) en vez del generador hecho a mano
// que traía esta primera versión, fijado a un único tamaño pequeño (106 bytes, pensado
// solo para el código corto de sala de `online.js`). Una invitación completa —la señal
// WebRTC más los datos de la sala— pesa varios cientos de bytes: con las 40 versiones del
// estándar QR que soporta esta librería, cabe siempre en un único código, sin trocear en
// varios ni tener que enseñarlos y leerlos uno a uno.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  // Corrección de errores baja: más capacidad de datos por versión, aceptable porque el
  // código se genera y se enseña en el momento —no va impreso en papel expuesto a
  // manchas o dobleces, que es para lo que sirve una corrección más alta.
  const ECC_LEVEL = "L";
  // 40 es el límite del propio estándar QR. Por encima de la versión ~25-30 el código ya
  // tiene tantos cuadraditos que cuesta leerlo con una cámara de móvil a pulso, pero se dejan
  // los 40 completos: mejor un código grande y lento de enfocar que fallar directamente.
  const MAX_TYPE_NUMBER = 40;

  function build(text) {
    const bytes = [...new TextEncoder().encode(text)];
    let lastError;
    for (let typeNumber = 1; typeNumber <= MAX_TYPE_NUMBER; typeNumber++) {
      try {
        const code = qrcode(typeNumber, ECC_LEVEL);
        code.addData(text);
        code.make();
        return code;
      } catch (error) { lastError = error; }
    }
    throw new Error("QR_TEXT_TOO_LONG");
  }

  function matrix(text) {
    const code = build(text);
    const size = code.getModuleCount();
    return Array.from({ length: size }, (unused, y) => Array.from({ length: size }, (unused2, x) => code.isDark(y, x)));
  }

  function draw(canvas, text) {
    const modules = matrix(text);
    const quietZone = 4;
    // Un código con muchos cuadraditos (una invitación larga) necesita más píxeles para
    // seguir siendo legible por una cámara; con pocos, no hace falta un lienzo enorme.
    const targetSize = Math.min(420, Math.max(260, modules.length * 6));
    const scale = Math.max(1, Math.floor(targetSize / (modules.length + quietZone * 2)));
    const size = (modules.length + quietZone * 2) * scale;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffaf0";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#211b16";
    modules.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) context.fillRect((x + quietZone) * scale, (y + quietZone) * scale, scale, scale);
    }));
  }

  CT.QrEncode = { draw, matrix };
})();
