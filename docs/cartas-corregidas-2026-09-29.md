# Cartas e ilustraciones corregidas — 29 de septiembre de 2026

- Recuperada la carta Tomate, con 18 kcal/100 g y lámina propia. Se añade como `foods-kcal-14` para conservar los identificadores de las otras trece cartas y sus partidas guardadas. Referencia: USDA FoodData Central, registro 170457, tomate rojo maduro crudo.
- Eliminados los once duplicados exactos detectados por `tests/imagenes-unicas.mjs`, generando escenas distintas en vez de alterar ligeramente el mismo archivo.
- La lámina de R.E.M. se conserva en Automatic for the People. Losing My Religion recibe una escena de mandolina en un local de ensayo.
- Madrid conserva la lámina existente en capitales por altitud; sus variantes nuevas muestran Puerta de Alcalá (longitud), Palacio de Cristal (latitud) y Cibeles (husos horarios).
- El archivo `cities-north-south-6.webp`, asociado a El Cairo, contenía el mismo dibujo de Madrid. Ahora muestra el Nilo y la Torre de El Cairo.
- Tokio en longitud y husos horarios contenía una escena de Sídney. Ambas cartas reciben escenas japonesas diferentes: una pagoda y Tokyo Tower.
- Honolulu, Los Ángeles, Nueva York, Londres y Sídney reciben variantes propias para el mazo de husos horarios.

Las trece láminas se generaron con la herramienta integrada de OpenAI: WebP, 512 × 768, sin texto ni marcos, con grabado sepia sobre pergamino. Todos los archivos quedan por debajo de 70.000 bytes. Se revisaron visualmente después de comprimir. Los prompts completos figuran en `ilustraciones-unicas-2026-09-29.json`; las huellas se actualizan en `inventario-arte.json`.

Se añade el tomate a la precarga y se incrementa la versión a `continuum-v471` en service worker, actualizaciones y HTML. Los nombres de las imágenes existentes se mantienen.

Validación: imágenes únicas (1.543 archivos, cero duplicados exactos), imágenes de Retos rápidos (342 cartas), auditoría del catálogo, reglas y recuperación de Retos rápidos, service worker, actualización y límites de recursos. La precarga queda en 47.120.651 bytes, dentro de su límite de 47.185.920.
