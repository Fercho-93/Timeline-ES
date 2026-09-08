# Recuperación de recursos vacíos

- `assets/astronomy-cards/8045-black-hole.webp`: el archivo estaba vacío. Recuperado usando la ilustración existente del mismo acontecimiento, `assets/invention-cards/4101-la-primera-imagen-de-un-agujero-negro.webp`, sin modificar sus píxeles.
- `assets/country-cards/2034.webp`: el archivo de Austria estaba vacío desde su incorporación. Nueva ilustración generada el 8 de septiembre de 2026 con la herramienta de imágenes de OpenAI y la habilidad `timeline-image-style`; contorno de Austria y paisaje alpino, grabado sepia sin rótulos. Revisada visualmente y reducida a 512 × 768, guardada en WebP sin pérdida de la imagen redimensionada. Las condiciones contractuales de uso comercial deben conservarse con los demás registros del titular.

`scripts/check-assets.mjs` verifica ahora dimensiones y decodificación de todas las ilustraciones de cartas, además del presupuesto de peso; un archivo vacío vuelve a fallar la comprobación.
