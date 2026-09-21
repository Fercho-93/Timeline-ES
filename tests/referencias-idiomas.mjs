import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync("idiomas.js", "utf8"), { window });

const cards = window.LANGUAGE_CARDS;
assert.equal(cards.length, 50, "El mazo de idiomas debe conservar sus 50 cartas");

const dimensions = file => {
  const data = fs.readFileSync(file).subarray(0, 40);
  assert.equal(data.subarray(0, 4).toString(), "RIFF", `${file} no es un WebP válido`);
  assert.equal(data.subarray(8, 12).toString(), "WEBP", `${file} no es un WebP válido`);
  const type = data.subarray(12, 16).toString();
  if (type === "VP8X") return [data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1];
  if (type === "VP8 ") return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
  if (type === "VP8L") {
    const bits = data.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  throw new Error(`Cabecera WebP no reconocida: ${file}`);
};

const hashes = new Set();
for (const card of cards) {
  const file = `assets/language-cards/${card.id}.webp`;
  assert.ok(fs.existsSync(file), `Falta la lámina de ${card.title}: ${file}`);
  assert.deepEqual(dimensions(file), [512, 768], `${card.title} debe mantener el formato 2:3`);
  assert.ok(fs.statSync(file).size <= 100 * 1024, `${card.title} supera los 100 KiB`);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert.ok(!hashes.has(hash), `La lámina de ${card.title} está duplicada`);
  hashes.add(hash);
}

const files = fs.readdirSync("assets/language-cards").filter(file => file.endsWith(".webp")).sort();
assert.deepEqual(files, Array.from(cards, card => `${card.id}.webp`).sort(), "No debe haber láminas huérfanas ni faltar cartas");

const modes = fs.readFileSync("modes.js", "utf8") + fs.readFileSync("mode-art.js", "utf8");
assert.match(modes, /LANGUAGE_ART_BY_ID[\s\S]*window\.LANGUAGE_CARDS/, "Falta el enlace por ID del mazo");
assert.match(modes, /sourceMode === "languages"\) return LANGUAGE_ART_BY_ID\[card\.id\]/, "cardArt no resuelve Idiomas");
assert.match(modes, /sourceMode === "languages" \? "language-cards"/, "animalArt no apunta a la carpeta de Idiomas");

console.log("Referencias visuales de idiomas correctas");
