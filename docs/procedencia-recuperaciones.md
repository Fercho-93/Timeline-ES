# Recuperación de recursos vacíos

- `assets/astronomy-cards/8045-black-hole.webp`: el archivo estaba vacío. Recuperado usando la ilustración existente del mismo acontecimiento, `assets/invention-cards/4101-la-primera-imagen-de-un-agujero-negro.webp`, sin modificar sus píxeles.
- `assets/country-cards/2034.webp`: el archivo de Austria estaba vacío desde su incorporación. Nueva ilustración generada el 8 de septiembre de 2026 con la herramienta de imágenes de OpenAI y la habilidad `timeline-image-style`; contorno de Austria y paisaje alpino, grabado sepia sin rótulos. Revisada visualmente y reducida a 512 × 768, guardada en WebP sin pérdida de la imagen redimensionada. Las condiciones contractuales de uso comercial deben conservarse con los demás registros del titular.

`scripts/check-assets.mjs` verifica ahora dimensiones y decodificación de todas las ilustraciones de cartas, además del presupuesto de peso; un archivo vacío vuelve a fallar la comprobación.

## Sustitución de duplicados

- `assets/music-cards/dark-side-moon.webp`: sustituida el 14 de septiembre de 2026 por una ilustración nueva generada con la herramienta de imágenes de OpenAI. Representa una sesión de experimentación sonora en un estudio británico de 1973, sin reproducir la portada del álbum ni retratos reconocibles.
- `assets/invention-cards/4101-la-primera-imagen-de-un-agujero-negro.webp`: sustituida el 14 de septiembre de 2026 por una ilustración nueva generada con la herramienta de imágenes de OpenAI. Se centra en el procesamiento colaborativo de datos del Event Horizon Telescope y conserva como pieza distinta la lámina astronómica `assets/astronomy-cards/8045-black-hole.webp`.

Ambas imágenes se revisaron visualmente después de exportarlas a 512 × 768 en WebP. La suite `tests/imagenes-unicas.mjs` impide que dos archivos de cartas vuelvan a compartir la misma huella SHA-256.
