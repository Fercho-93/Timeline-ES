// El mismo generador de QR que ya dibuja `online.js` para el enlace corto de sala, sacado
// aparte para poder usarlo también en el modo "Sin conexión" sin tocar ese archivo (que no
// se toca en toda esta funcionalidad, ver `local-room.js`). Versión 5, corrección de
// errores baja: como allí, cabe hasta 106 bytes por código — una señal WebRTC entera no
// cabe en uno solo, así que quien llama la trocea antes (`qr-frames.js`) y pinta varios QR
// seguidos.
(function () {
  "use strict";
  window.CONTINUUM = window.CONTINUUM || {};
  const CT = window.CONTINUUM;

  const MAX_BYTES = 106;

  function gfMultiply(x, y) {
    let result = 0;
    for (let i = 7; i >= 0; i--) {
      result = (result << 1) ^ ((result >>> 7) * 0x11d);
      result ^= ((y >>> i) & 1) * x;
    }
    return result;
  }

  function reedSolomonDivisor(degree) {
    const result = Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = gfMultiply(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMultiply(root, 2);
    }
    return result;
  }

  function reedSolomonRemainder(data, divisor) {
    const result = Array(divisor.length).fill(0);
    data.forEach(byte => {
      const factor = byte ^ result.shift();
      result.push(0);
      divisor.forEach((value, index) => { result[index] ^= gfMultiply(value, factor); });
    });
    return result;
  }

  function matrix(text) {
    const version = 5;
    const size = version * 4 + 17;
    const dataCodewords = 108;
    const errorCodewords = 26;
    const bytes = [...new TextEncoder().encode(text)];
    if (bytes.length > MAX_BYTES) throw new Error("QR_TEXT_TOO_LONG");
    const bits = [];
    const appendBits = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    appendBits(0x4, 4);
    appendBits(bytes.length, 8);
    bytes.forEach(byte => appendBits(byte, 8));
    appendBits(0, Math.min(4, dataCodewords * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
    for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xec ^ 0x11) data.push(pad);
    const error = reedSolomonRemainder(data, reedSolomonDivisor(errorCodewords));
    const allBits = [];
    [...data, ...error].forEach(byte => { for (let i = 7; i >= 0; i--) allBits.push((byte >>> i) & 1); });

    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => Array(size).fill(false));
    const setFunction = (x, y, dark) => {
      if (x >= 0 && x < size && y >= 0 && y < size) { modules[y][x] = Boolean(dark); isFunction[y][x] = true; }
    };
    const drawFinder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    };
    const drawAlignment = (cx, cy) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    };
    for (let i = 0; i < size; i++) { setFunction(6, i, i % 2 === 0); setFunction(i, 6, i % 2 === 0); }
    drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
    drawAlignment(30, 30);

    const formatData = 8;
    let remainder = formatData;
    for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    const formatBits = ((formatData << 10) | remainder) ^ 0x5412;
    const formatBit = index => ((formatBits >>> index) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFunction(8, i, formatBit(i));
    setFunction(8, 7, formatBit(6)); setFunction(8, 8, formatBit(7)); setFunction(7, 8, formatBit(8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, formatBit(i));
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, formatBit(i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, formatBit(i));
    setFunction(8, size - 8, true);

    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical++) {
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        for (let column = 0; column < 2; column++) {
          const x = right - column;
          if (isFunction[y][x]) continue;
          let dark = bitIndex < allBits.length ? allBits[bitIndex] !== 0 : false;
          bitIndex += 1;
          if ((x + y) % 2 === 0) dark = !dark;
          modules[y][x] = dark;
        }
      }
    }
    return modules;
  }

  function draw(canvas, text) {
    const modules = matrix(text);
    const quietZone = 4;
    const targetSize = 260;
    const scale = Math.floor(targetSize / (modules.length + quietZone * 2));
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

  CT.QrEncode = { MAX_BYTES, matrix, draw };
})();
