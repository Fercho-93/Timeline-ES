import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync("countries.js", "utf8"), { window });

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
  2005: ["India", "c47d12bf7ee96f1cffff57538376b10b7c046a9514019d27c56694ab5624400f"],
  2006: ["Argentina", "daa6d417991d52b08f6e8d94316392c2a8ffa456bbdb76212628c991fdace79e"],
  2007: ["Argelia", "79fbdd7ca127469824f08f2a8ff52829a464e4403ecfe6980455825d7a0af2ee"],
  2010: ["Irán", "0f45c7498b90f67ecddf069de302e235307ba53417900cd3ae8aeae177def5d9"],
  2013: ["Egipto", "ebe6dc21aa1d8313c73f1bf0074e96b8be0a223b426856d75a591380661dfe9f"],
  2014: ["Nigeria", "d02760d2e16ef81e5dd75721ca64fadfa88fae9bcd25afe469e22a12c64fd10f"],
  2015: ["Turquía", "a6c18ac14f352e5fe61ca9971334b906e1e4cae54c81026c345458307dba6ee2"],
  2016: ["Afganistán", "733ff1df60b9840bc42a2f02290b4979e434edd2b581a6e772369409a30d6813"],
  2017: ["Ucrania", "09685c01880be0ded44405904b55eaa6ab6143b930777ffad7a13e9977c04a76"],
  2018: ["Francia metropolitana", "bc32190eff826a5ad0d98a546b0b173e848d15674ac64bdf78fcd57971b9a506"],
  2025: ["Reino Unido", "ec672ca169967c19b65d04f4188f76b70646a9e5fdc9cd0f5643186a5d046abc"],
  2040: ["Suiza", "73373636f9f047950b0aba098965cbb1192fa885a0f344aa6247c4f20af0a195"],
  2041: ["Bélgica", "1b5c52a00dfb323a34932eee07caa340aed684350d940859be790528f25b8c4d"],
  2042: ["Israel", "986d6c727d4eb1821cd92ce22a17117ed12a33c31de9a75c08b0c3b94064dd1c"],
  2043: ["Eslovenia", "4453d7291abb99799315f7b342d5d634092ca5495a96585a1d7369898fcd95c7"],
  2045: ["Catar", "41c72feba30f7ce5bb6e6699f11cff6c94e8fbee3895771e48f4c27806a981b6"],
  2046: ["Líbano", "8b0adde340b82ae587b7df8b6b63732f56c9ba6518a0a2a8043315ebee98c065"],
  2050: ["Luxemburgo", "657e18d31255970eef78e71516f881bf14045400401140cff62bb3f766755522"],
  2051: ["Mauricio", "ea42f9991a5e7cb6ac9b29960db9734a2724fa449c6aa56a63c2585eb6fcb63e"],
  2060: ["Kazajistán", "3c66f236ea73891e6766d77f77b5b7b56297e1609d3f12a0e795dfdbe695d1c2"],
  2061: ["Indonesia", "2bff2308e595c490f4a0cab6b85762f6ddb645718f9414c41b7e673f8764913e"],
  2063: ["Chile", "11de251834b5ffbfa5b5110fdeb5adbe7a4e0d5ede8756c794e812a0ae6439a2"],
  2067: ["Uganda", "53608e84d50cb3201431e7ef1e80c129cc6a6f46ac9c485b2c27313f46ee12f6"],
  2070: ["Panamá", "1e369ef1ca2777320e0bf6e6bd04597ef805dda2ce77e939dc30cc8400e04e3f"],
  2071: ["Sri Lanka", "d1dd40ef8ff8fc7da36c12e24e42bb1991f61b30f16af4fe96f7e19f94478a62"]
};

for (const [id, [title, expectedHash]] of Object.entries(reviewed)) {
  const card = cards.find(item => item.id === Number(id));
  assert.equal(card?.title, title, `Ha cambiado el país asociado al ID ${id}`);
  const actualHash = crypto.createHash("sha256")
    .update(fs.readFileSync(`assets/country-cards/${id}.webp`)).digest("hex");
  assert.equal(actualHash, expectedHash, `Debe revisarse de nuevo la lámina de ${title}`);
}

console.log("Referencias visuales de países correctas");
