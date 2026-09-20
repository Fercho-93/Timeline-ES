# Auditoría de cartas e ilustraciones — 20 de septiembre de 2026

Se revisaron los catálogos cargados desde index.html, su inclusión en modes.js y en las colecciones, las asociaciones por ID, las rutas con mayúsculas exactas, la representación de cartas descubiertas en la enciclopedia y la herencia de ilustraciones en Gran mezcla.

## Resultado

- 1.272 cartas únicas en 15 mazos; Gran mezcla contiene otras 769 referencias a las cartas temporales, sin contarlas dos veces.
- 1.201 archivos de ilustración de carta. Varios animales comparten dibujo entre peso, longevidad y velocidad.
- Ninguna carta sin ilustración, ninguna ruta inexistente, ningún dibujo de las carpetas de cartas sin asociación y ningún mazo fuera de una colección.
- Recuperadas las 45 ilustraciones nuevas y las versiones optimizadas del lote e1f9fb9 que permanecía en integration-ready.
- Recuperadas 19 cartas de longevidad (12067–12085) del mismo lote, con sus datos y fuentes existentes.
- Añadidas 89 asociaciones: 39 de peso, 31 de velocidad y las 19 cartas recuperadas de longevidad.
- Actualizada la caché a v254 para que las instalaciones web reciban el catálogo corregido.
- Añadida tests/arte-catalogo.mjs al comienzo de npm test: comprueba automáticamente todos los catálogos, las colecciones, la enciclopedia, las rutas, los IDs, Gran mezcla y las imágenes huérfanas.

## Validación

Pasan la nueva auditoría completa, las pruebas de enciclopedia, service worker, empaquetado móvil, el inventario de fuentes y los límites de recursos. El build incluye assets completo. Todos los archivos de carta cumplen 512×768 y el tamaño máximo configurado; Naturaleza cumple además su límite de 100 KB.

La batería general no está completamente verde. Los fallos siguientes ya se reproducen en el commit original 65df8b6:

- tests/marca.mjs intenta evaluar como script clásico un módulo con import.
- tests/mazos.mjs exige años únicos en Música y Videojuegos aunque sus catálogos contienen empates.
- tests/referencias-animales.mjs mantiene dos expectativas de orden entre reno y avestruz que no corresponden a los datos actuales. Las comprobaciones de imágenes de este test quedan corregidas.
- tests/imagenes-unicas.mjs detecta que Automatic for the People y Losing My Religion usan el mismo dibujo de R.E.M.; ambos archivos se actualizaron juntos en 197a2ce y f2e5435. Se conserva esa edición reciente. No es un archivo ausente ni una asociación rota.

Las láminas de la enciclopedia conservan el descubrimiento jugando y los mazos conservan su configuración de acceso existente. Esta revisión no cambia las reglas de desbloqueo.
