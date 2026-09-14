import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const folders = fs.readdirSync("assets", { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.endsWith("-cards"))
  .map(entry => path.join("assets", entry.name));

const files = folders.flatMap(folder => fs.readdirSync(folder)
  .filter(file => /\.(?:webp|png|jpe?g)$/i.test(file))
  .map(file => path.join(folder, file)));

const seen = new Map();
const duplicates = [];
for (const file of files) {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (seen.has(hash)) duplicates.push(`${seen.get(hash)} = ${file}`);
  else seen.set(hash, file);
}

assert.deepEqual(duplicates, [], `Hay ilustraciones de carta duplicadas:\n${duplicates.join("\n")}`);
console.log(`${files.length} ilustraciones de carta, sin duplicados exactos`);
