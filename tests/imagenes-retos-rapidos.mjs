// Cada carta de Retos rápidos con ilustración usa un fichero que existe y solo suyo, y su número
// coincide con su posición en el mazo (`foods-kcal-3.webp` es la tercera carta). Así se
// desplazaron las láminas al quitar una carta o reordenar la lista sin renombrar los ficheros:
// el arroz enseñaba un pollo. Un script no puede ver el dibujo, pero sí detectar el desajuste
// entre el número del fichero y el puesto de la carta. Las ciudades también tienen
// una ilustración propia en cada mazo; imagenes-unicas.mjs comprueba su contenido.
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window = { CONTINUUM: {} };
new Function('window', fs.readFileSync(new URL('../quick-challenges-data.js', import.meta.url), 'utf8'))(globalThis.window);
const retos = window.CONTINUUM.QuickCatalog.challenges;
const problemas = [], usadas = new Map();
for (const reto of retos) {
  for (const carta of reto.cards) {
    if (!carta.image) continue;
    if (!fs.existsSync(new URL('../' + carta.image, import.meta.url))) problemas.push(`${reto.id}: «${carta.title}» apunta a ${carta.image}, que no existe`);
    if (usadas.has(carta.image)) problemas.push(`${carta.image} lo usan «${usadas.get(carta.image)}» y «${reto.id}: ${carta.title}»`);
    usadas.set(carta.image, `${reto.id}: ${carta.title}`);
    const [, propio, numero] = /([a-z-]+?)-(\d+)\.webp$/.exec(carta.image) || [];
    if (propio === reto.id && Number(numero) !== reto.cards.indexOf(carta) + 1) problemas.push(`${reto.id}: «${carta.title}» es la carta ${reto.cards.indexOf(carta) + 1} pero usa ${carta.image}`);
    if (propio !== reto.id) problemas.push(`${reto.id}: «${carta.title}» usa una lámina de otro mazo (${carta.image})`);
  }
}
assert.deepEqual(problemas, [], problemas.join('\n'));
const alimentos = retos.find(reto => reto.id === 'foods-kcal');
const tomate = alimentos.cards.find(carta => carta.title === 'Tomate');
assert.ok(tomate, 'El tomate sigue en el catálogo de alimentos');
assert.equal(tomate.id, 'foods-kcal-14', 'Restaurar el tomate no desplaza IDs publicados');
assert.equal(tomate.value, 18);
assert.equal(tomate.image, 'assets/quick-cards/foods-kcal-14.webp');
assert.equal(alimentos.cards.find(carta => carta.title === 'Zanahoria').id, 'foods-kcal-3');
console.log(`${usadas.size} láminas de Retos rápidos, cada una en una sola carta`);
