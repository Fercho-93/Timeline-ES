# Recuperación de recursos vacíos

- `assets/astronomy-cards/8045-black-hole.webp`: el archivo se recuperó como una lámina propia de Astronomía. La antigua lámina equivalente del mazo de Inventos se retiró posteriormente al consolidar duplicados entre ambos mazos.
- `assets/country-cards/2034.webp`: el archivo de Austria estaba vacío desde su incorporación. Nueva ilustración generada el 8 de septiembre de 2026 con la herramienta de imágenes de OpenAI y la habilidad `timeline-image-style`; contorno de Austria y paisaje alpino, grabado sepia sin rótulos. Revisada visualmente y reducida a 512 × 768, guardada en WebP sin pérdida de la imagen redimensionada. Las condiciones contractuales de uso comercial deben conservarse con los demás registros del titular.

`scripts/check-assets.mjs` verifica ahora dimensiones y decodificación de todas las ilustraciones de cartas, además del presupuesto de peso; un archivo vacío vuelve a fallar la comprobación.

## Sustitución de duplicados

- `assets/music-cards/dark-side-moon.webp`: sustituida el 14 de septiembre de 2026 por una ilustración nueva generada con la herramienta de imágenes de OpenAI. Representa una sesión de experimentación sonora en un estudio británico de 1973, sin reproducir la portada del álbum ni retratos reconocibles.
- La antigua lámina equivalente de Inventos se retiró al consolidar el hito del agujero negro en el mazo de Astronomía; se conserva como referencia la lámina astronómica `assets/astronomy-cards/8045-black-hole.webp`.

Ambas imágenes se revisaron visualmente después de exportarlas a 512 × 768 en WebP. La suite `tests/imagenes-unicas.mjs` impide que dos archivos de cartas vuelvan a compartir la misma huella SHA-256.
