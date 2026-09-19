import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync("population.js", "utf8"), { window });
const cards = window.POPULATION_CARDS;

assert.equal(cards.length, 77, "El mazo de población debe conservar sus 77 cartas");
assert.ok(cards.every(card => card.source && card.reviewedAt), "Cada carta debe conservar fuente y fecha de revisión");

const hashes = new Map();
for (const card of cards) {
  const path = `assets/population-cards/${card.id}.webp`;
  assert.ok(fs.existsSync(path), `Falta la ilustración de ${card.title}: ${path}`);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
  assert.ok(!hashes.has(hash), `Ilustración duplicada entre ${hashes.get(hash)} y ${card.title}`);
  hashes.set(hash, card.title);
}

assert.equal(hashes.size, cards.length, "Cada carta debe tener una ilustración propia");
console.log("Referencias y láminas de población correctas");
