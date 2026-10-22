import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync("mazos/countries.js", "utf8"), { window });

const cards = window.COUNTRY_CARDS;
assert.equal(cards.length, 72, "El mazo de superficies debe conservar sus 72 cartas");

const hashes = new Map();
for (const card of cards) {
  const path = `assets/country-cards/${card.id}.webp`;
  assert.ok(fs.existsSync(path), `Falta la ilustración de ${card.title}: ${path}`);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
  assert.ok(!hashes.has(hash), `Ilustración duplicada entre ${hashes.get(hash)} y ${card.title}`);
  hashes.set(hash, card.title);
}

// Huellas de las asociaciones que se corrigieron tras contrastar visualmente cada mapa
// con el país declarado. Si una lámina se reemplaza de forma deliberada, debe volver a
// revisarse y actualizar aquí su huella.
const reviewed = {
  2005: ["India", "c7ad31a6f93d224b47053efbf5717e7d83a6df172bfe7ffe4f61592a12366e35"],
  2006: ["Argentina", "e6e5bf49b2f87d9328600282b129c367f775346d52a834400a3d5a51b27875cb"],
  2007: ["Argelia", "1a235a5cdeabe80f2849efb084509a858cc26da0b5716468897f066cd97bc3bc"],
  2010: ["Irán", "5e7bfb69e7b9070bd6a88e1035a1b1a33d5bdb59e9f633aec078210ea0f38bec"],
  2013: ["Egipto", "ea4d9e70749755d6bd5f81d4e41c467ff926b8ed089e14a201d2ed6fb7aa8e9d"],
  2014: ["Nigeria", "636af418a320571ec9f42c5374b98a4706b3c99c61d398b169d1955f2162c29b"],
  2015: ["Turquía", "f1440794834a77da428dee7b259d63c6d7b68b07bb6f75694ee2e034dce5e41f"],
  2016: ["Afganistán", "a56470bca0ae17d1b7157e8e8de6237eb6d1b70950b26de35d9729f861c00275"],
  2017: ["Ucrania", "e491bfa4fc500fb0f297ee54bda72135a7f70248b8c1964f2b4f472670687ff0"],
  2018: ["Francia metropolitana", "402318d9bd9500caab53932752d6cd25d605a10021f2784b2ffc85289b3af79f"],
  2025: ["Reino Unido", "1200c6e33b7f5ab5afa8353e15ea1930bdee2ff8b97fd5b7fcbfcf69e38ebc4f"],
  2040: ["Suiza", "35938dc1d81b9f0729940b3db1913699a0a40eb50c17dcf8bcfb50772a502c5a"],
  2041: ["Bélgica", "de1c0179619f0fe481e699dfd061c1cf2f381eba8dddc9942ba92d5d30b8f559"],
  2042: ["Israel", "80b5cbd78caac1b95ef290847b0a81cb490db1ae689bd54af8cc8582e0513a6c"],
  2043: ["Eslovenia", "faba5878016743e53a63ab436885a30902073296721e2e9520daa37642ec7f39"],
  2045: ["Catar", "42d5f80794391b87e5a501f58b8705707ad67eacb7a8c03b2a9961038680d258"],
  2046: ["Líbano", "17e79c2df4e339abb0e00526fd12fe8f064aee7572360f697b82592ed24e88eb"],
  2050: ["Luxemburgo", "f7410f4e0a75864144bcdf1514ef3fc770f0347e3374a4e1a096250d04dea21a"],
  2051: ["Mauricio", "7c902f052a6e13ac0318ed326193533e0b36e70c30d4d01148de07c3a4375d1c"],
  2060: ["Kazajistán", "e5fc5a33999a7dcf2c2ffd93757b2db06d4e741048542949a0f87c9b3b970ec1"],
  2061: ["Indonesia", "52edc68d29f6325f5fa316243c08d402e2720a8d20a12b1f1c902adc4c06c08a"],
  2063: ["Chile", "505bf484fe577051f8029ef81df8c3bf6b0b05563b83ad55de3385d4c95df47b"],
  2067: ["Uganda", "27a428cb16e1d0125de2cc9419c64d1bf6d1e805308d11fb84e2fe59b0dccdd0"],
  2070: ["Panamá", "e251a1bbcf1e13590ce68204ee35092afc9aab81b5046ce39aec6ad41472176e"],
  2071: ["Sri Lanka", "d4088fa77499806f02741342c416d645349e22b782aa4672fe032c43e88e4f57"]
};

for (const [id, [title, expectedHash]] of Object.entries(reviewed)) {
  const card = cards.find(item => item.id === Number(id));
  assert.equal(card?.title, title, `Ha cambiado el país asociado al ID ${id}`);
  const actualHash = crypto.createHash("sha256")
    .update(fs.readFileSync(`assets/country-cards/${id}.webp`)).digest("hex");
  assert.equal(actualHash, expectedHash, `Debe revisarse de nuevo la lámina de ${title}`);
}

console.log("Referencias visuales de países correctas");
