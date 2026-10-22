# Procedencia del arte generado con IA

## Declaración del titular

El titular del proyecto declara que todos los recursos visuales incorporados a Continuum —antes Timeline— fueron generados con ChatGPT/OpenAI. La declaración incluye las ilustraciones de las cartas, las portadas de las familias, el icono, el logo, el splash y los demás elementos gráficos incorporados al repositorio.

Esta declaración se basa en la confirmación expresa del titular y en el historial disponible de conversaciones del proyecto. El inventario `docs/inventario-arte.json` enlaza cada archivo con esta declaración y conserva su huella SHA-256.

La declaración es general y también vale para el futuro: todas las imágenes del juego se generan con IA, y de ninguna otra manera. `node scripts/audit-content.mjs --write` asigna esta declaración a cada imagen nueva o modificada.

## Lenguaje visual

Los 36 retratos de `assets/avatars/` se generaron con ChatGPT/OpenAI el 25 de
septiembre de 2026 y se recortaron de las láminas aprobadas por el titular.
Las variantes de animales tomaron como referencia las ilustraciones de cartas
ya presentes en Continuum. Las seis últimas variantes de videojuegos son
personajes originales, sin marcas ni diseños de una franquicia concreta. Cada
archivo WebP individual figura con su huella en `docs/inventario-arte.json`.

El sistema visual común se ha construido mediante instrucciones de continuidad entre cartas:

- Formato vertical de carta.
- Ilustración sin texto añadido y sin marcos blancos.
- Tratamiento de grabado o lámina antigua.
- Fondo de pergamino y paleta sepia, marfil, marrón, cobre y otros tonos cálidos.
- Composición integrada en la carta, sin bordes visibles.
- Variaciones temáticas: grabado naturalista para animales, grabado científico para Astronomía, grabado cartográfico para Geografía y tratamientos históricos o culturales equivalentes para los demás mazos.

## Evidencia recuperada

- Astronomía: se documentaron 26 imágenes generadas con ChatGPT, en WebP de 512 × 768, con estilo sepia/pergamino y sin texto ni marcos. Hoy el mazo tiene 55 cartas, todas con lámina propia.
- Superficie de países: se documentaron 64 ilustraciones generadas e integradas, con siluetas, mapas, relieve y paisaje en grabado cartográfico sobre pergamino.
- Longevidad de animales: 26 imágenes nuevas y 12 reutilizadas, con lámina naturalista antigua, sepia, animal completo y formato WebP de 512 × 768.
- Velocidad de animales: 31 imágenes nuevas y 7 reutilizadas, manteniendo el mismo lenguaje naturalista.
- Logo e icono: se conserva evidencia conversacional de generación mediante el prompt «crea un icono y logo para el juego de timeline/continuum».
- Portada de apertura: la primera versión (`continuum-splash-v2.webp`, ya retirada del juego) se generó con ChatGPT/OpenAI el 18 de septiembre de 2026 a partir de un mockup aportado por el titular. El mockup se utilizó como referencia de composición, luz, paleta y materiales; el recurso final se pidió sin texto, logotipo ni controles para superponer en HTML la marca y los botones accesibles del juego.
- Fondo animable de portada: `assets/continuum-splash-clean-v3.webp` se derivó con ChatGPT/OpenAI el 19 de septiembre de 2026 de la portada anterior, eliminando únicamente las cartas periféricas para reconstruir el pergamino, las nubes y las líneas que quedaban detrás. El mar del globo se tiñó después de azul grisáceo con un retoque de color propio (procesado de imagen, sin IA). Las cartas visibles se componen ahora como capas HTML con ilustraciones propias del juego para poder darles un movimiento independiente; el rayo y los destellos son CSS.
- Portada ilustrada: `assets/home-deco-left.webp`, `assets/home-deco-right.webp` y `assets/home-door-jugar.webp` se recortaron el 25 de septiembre de 2026 del mockup de la portada aportado por el titular (generado con ChatGPT/OpenAI). Se tomaron solo zonas sin texto ni controles —la columna con el olivo y la ilustración de cartas y esfera armilar de la lámina «Jugar»— y a las dos piezas de fondo se les añadió transparencia para que la marca, las láminas y los botones sigan siendo HTML. `assets/home-deco-right.webp` es la misma columna con el olivo reflejada en horizontal, para que las dos esquinas de la portada sean simétricas.
- Recursos recuperados: la ilustración de Austria fue generada el 8 de septiembre de 2026 con la herramienta de imágenes de OpenAI. El recurso de agujero negro se recuperó reutilizando otra ilustración existente del proyecto (ver `docs/procedencia-recuperaciones.md`).
- Idiomas: las 50 láminas, con la escena de cada una, en `docs/procedencia-idiomas.md`.
- Retos rápidos: las 567 cartas de los 29 retos tienen lámina propia en `assets/quick-cards/` (WebP de 512 × 768, grabado sepia sobre pergamino). Para las generadas o sustituidas desde el 29 de septiembre de 2026 hay ficha individual con prompt, fecha, generador y huella en `docs/arte-*.json` (256 imágenes del 4 y 5 de octubre: las ampliaciones y las 43 sustituciones o añadidos de la revisión visual) y en `docs/ilustraciones-unicas-2026-09-29.json` (13). La revisión visual del 4 de octubre está en [docs/revisiones/revision-ilustraciones-retos-2026-10-04.md](docs/revisiones/revision-ilustraciones-retos-2026-10-04.md); los logos de redes sociales y los símbolos del póker son excepciones deliberadas a la regla de no dibujar texto ni marcas. La portada del modo está en `docs/retos-portada.md`.

## Límites de la documentación

Salvo las fichas individuales citadas arriba, no se han recuperado los prompts completos, la fecha individual de generación, las imágenes de referencia ni el modelo utilizado para cada una de las 1.836 imágenes de `assets/` (recuento del inventario del 11 de octubre de 2026). Por ello, el inventario marca la procedencia como declarada por el titular y no como una ficha individual completa de generación.

Antes de una publicación comercial se deben conservar, junto con la documentación del proyecto, los términos aplicables al plan y servicio utilizados en cada generación. Esta documentación no afirma que OpenAI sea el titular de las imágenes ni sustituye una revisión jurídica; deja registrada la procedencia declarada y evita presentar los recursos como imágenes descargadas de terceros.

Los textos, datos, fuentes y marcas representadas en las cartas tienen una revisión independiente. Que una ilustración haya sido generada con IA no convierte automáticamente en libres de derechos los nombres, logotipos o elementos identificables de terceros que pudiera representar.
