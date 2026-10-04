# Diez nuevas ciudades para Redes de metro por longitud

Se añaden Barcelona (TMB), Lisboa, Berlín, Viena, Praga, Budapest, Copenhague, Ciudad de México, Santiago de Chile y Buenos Aires. El mazo pasa de 9 a 19 cartas. Conserva el criterio de menor a mayor longitud en kilómetros y los identificadores de las nueve cartas anteriores, con compatibilidad de partidas guardadas.

Cada carta nueva enlaza una fuente oficial para la cifra y otra para su curiosidad. `fuentes-metros-ampliacion-2026-10-04.json` registra la fecha del dato, ubicación en la fuente y alcance de la medida. La consulta se realiza el 4 de octubre de 2026; esta fecha no implica que todos los datos estadísticos sean de 2026. Las nueve cartas anteriores conservan sus datos y no se revalidan en esta ampliación.

## Alcance de las cifras

- Barcelona: se suman las filas de metro TMB (124,7 km); el total de la tabla, 125,4 km, incluye 0,7 km del funicular. No se incluyen FGC. L9/L10 tienen tramos comunes agrupados.
- Lisboa: ficha institucional actualizada el 30 de enero de 2026, 44,5 km. La futura línea Circular permanece en obras; su estado se contrastó en https://projetos.metrolisboa.pt/acompanhe-o-avanco-das-obras-da-linha-circular/.
- Berlín: 155 km de líneas diurnas de U-Bahn, estadística BVG 2024; excluye S-Bahn.
- Viena: 83 km de longitud de líneas, estadística municipal 2024 con fuente Wiener Linien. La cifra promocional de unos 84 km del operador corresponde a otra presentación de la longitud y no se mezcla con esta serie.
- Praga: 65,4 km, DPP con datos al cierre de 2025; excluye D en construcción.
- Budapest: KSH distingue «Metro» y «Underground». Se suman ambas columnas de longitud de rutas en 2025: 33,5 + 4,4 = 37,9 km. No se emplean las columnas de longitud construida (37,3 + 4,5) ni un total de infraestructura tomado de otra definición.
- Copenhague: 43 km, total redondeado publicado por Metroselskabet para M1–M4, con la extensión de 2024 incluida. La página está fechada en septiembre de 2025 y su bloque de datos incluye estadísticas de 2025; se registra la fecha de consulta sin atribuirle una fecha de corte inexistente.
- Ciudad de México: 226,488 km, total publicado por el STC para las doce líneas. Incluye tramos auxiliares; no equivale al subconjunto de 200,881 km de vías de servicio comercial. Esta diferencia se muestra en la descripción. El total y los componentes se contrastan en la cronología y en https://www.metro.cdmx.gob.mx/operacion/cifras-de-operacion; las definiciones también constan en https://transparencia.cdmx.gob.mx/storage/app/uploads/public/5a7/b79/43e/5a7b7943e11a0461015179.pdf.
- Santiago: 149 km, tabla DTPM 2025; siete líneas, sin cercanías ni proyectos futuros.
- Buenos Aires: 56,57 km, informe Emova 2025, página 17. Se excluye el Premetro (7,76 km). Se utiliza la cifra del operador y no el redondeo de 56,7 km difundido por otras fuentes.

La comparación es aproximada: cada organismo publica su propia definición de longitud. Las cartas explicitan diferencias de cobertura y no comparan kilómetros recorridos por trenes, vías duplicadas en ambos sentidos o futuras extensiones.

## Ilustraciones y comprobaciones

Diez ilustraciones originales, verticales de 512 × 768, grabado sepia sobre papel envejecido, sin títulos, cifras, logos ni marcos. Se revisan visualmente; el prompt, dimensiones y SHA-256 se registran en `arte-metros-ampliacion-2026-10-04.json` y en el inventario de arte.

Comprobación del orden de las 19 cartas, recuperación de una partida con las nueve cartas originales, fuentes y alcance del dato, carga de imágenes, precarga sin conexión, presupuesto de recursos y vista móvil/escritorio.

Las diez ilustraciones nuevas añaden 772.636 bytes. Las 19 imágenes se precargan para jugar sin conexión. Se registra el prompt y SHA-256 de cada WebP en `arte-metros-ampliacion-2026-10-04.json`.
