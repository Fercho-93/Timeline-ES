# Ampliación de siete retos rápidos

Se añaden 70 cartas: diez en cada uno de los siete bloques. El catálogo completo pasa de 437 a 507 cartas. Todas las cartas nuevas tienen curiosidad, ilustración propia y fuente individual. Los 19 álbumes incluyen el artista en el campo que el juego muestra bajo el título, tanto en la mano como en la carta descubierta y en el resultado; se evita duplicar el artista dentro del título.

| Bloque | Antes | Después |
| --- | ---: | ---: |
| Aeropuertos por pasajeros | 7 | 17 |
| Altitud de capitales | 9 | 19 |
| Estadios de fútbol por aforo | 10 | 20 |
| Discos por ventas | 9 | 19 |
| Alimentos por calorías | 14 | 24 |
| Ríos de España por longitud | 10 | 20 |
| Edificios por altura | 9 | 19 |

## Cartas incorporadas

- Aeropuertos: Madrid-Barajas, Barcelona-El Prat, Palma de Mallorca, Málaga-Costa del Sol, Alicante-Elche, Gran Canaria, Tenerife Sur, Valencia, París-Charles de Gaulle y Ámsterdam-Schiphol.
- Capitales: Londres, París, Roma, Berlín, Lisboa, Ámsterdam, Washington D. C., Canberra, Nairobi y Katmandú.
- Estadios: Old Trafford, Allianz Arena, Anfield, Emirates Stadium, Metropolitano, Mestalla, Benito Villamarín (antes de la reforma), Ramón Sánchez-Pizjuán, San Mamés y Balaídos.
- Discos: Hotel California (Eagles), Come On Over (Shania Twain), 21 y 25 (Adele), Appetite for Destruction (Guns N’ Roses), Born in the U.S.A. (Bruce Springsteen), Metallica (Metallica), Nevermind (Nirvana), Supernatural (Santana) y Brothers in Arms (Dire Straits).
- Alimentos: fresas, naranja, sandía, brócoli crudo, lentejas cocidas, huevo cocido, garbanzos cocidos, yogur natural entero, aceite de oliva y chocolate negro con 70–85 % de cacao.
- Ríos: Nalón, Narcea, Sella, Navia, Bidasoa, Ter, Tormes, Jarama, Genil y Pisuerga.
- Edificios: Empire State Building, Chrysler Building, Willis Tower, Shanghai World Financial Center, International Commerce Centre, Central Park Tower, Lakhta Center, Burj Al Arab, Commerzbank Tower y Gran Torre Santiago.

## Fuentes y alcance

La consulta se realiza el 5 de octubre de 2026. [fuentes-siete-retos-ampliacion-2026-10-05.json](fuentes-siete-retos-ampliacion-2026-10-05.json) recoge por carta la cifra, unidad, fecha del dato, ubicación en la publicación, alcance, curiosidad y enlaces de ambas fuentes. Incluye extractos estructurados de GeoNames, USDA e IGN y las huellas SHA-256 de los conjuntos descargados.

- **Aeropuertos:** pasajeros del año natural 2025, con datos de Aena, Groupe ADP y Royal Schiphol Group. No se suman aeropuertos de un grupo empresarial. Las ocho cifras de Aena conservan su total exacto para ordenar y se muestran redondeadas a una décima de millón; los dos operadores europeos ya publican cifras redondeadas.
- **Capitales:** altura aproximada del punto urbano de referencia de GeoNames, columna DEM del conjunto cities15000. Se usa el mismo campo en las diez nuevas cartas, sin mezclarlo con el campo elevation. La ficha contiene coordenadas, valor y fecha de modificación. El modelo SRTM3/GTOPO30 no mide una altitud media municipal: las ciudades tienen relieve y el terreno modelizado puede apartarse de una cota topográfica precisa. Esto se aclara en las cartas.
- **Estadios:** se especifica la configuración. Allianz Arena usa el aforo nacional de 75.024, no los 70.000 de la configuración internacional sin zonas de pie. El Villamarín conserva expresamente su configuración anterior a la reforma, con 60.721 plazas. Sevilla usa 43.858 de las cuentas oficiales de 2024/25, no la cifra de 43.883 difundida en otras fichas. Balaídos usa los 24.870 que publica el club y advierte de las obras. Los proyectos futuros quedan excluidos.
- **Discos:** ventas mundiales aproximadas divulgadas por artistas, sellos y publicaciones, con fechas distintas. No hay una certificación mundial uniforme de estos totales. Las fuentes promocionales se identifican como tales y las cifras históricas no se presentan como un recuento exacto a octubre de 2026. Born in the U.S.A. usa unos 25 millones del comunicado oficial de 2024; Metallica usa más de 35 millones de su tienda oficial; Hotel California y Supernatural conservan las referencias documentadas de más de 32 y más de 25 millones respectivamente. 25 utiliza los 22 millones publicados por RouteNote, una fuente secundaria que remite a recopilaciones de la industria. Se mantienen los valores anteriores de los nueve álbumes existentes.
- **Alimentos:** kcal por 100 g de parte comestible, preparación explícita y registro NDB individual de USDA SR28, septiembre de 2015. Los extractos conservan el nutriente 208 para energía y los nutrientes utilizados en la curiosidad. No se comparan legumbres secas con cocidas ni se incluyen cáscara y corteza.
- **Ríos:** longitud cartográfica del curso del IGN, con identificador individual y suma de tramos nacionales, fronterizos y no nacionales. Puede diferir de la longitud tradicional redondeada. El Bidasoa usa los 66 km del Gobierno de Navarra para su recorrido completo, porque el curso denominado Bidasoa Ibaia en el IGN no incluye toda su cabecera. Se descartan campos de nacimiento anómalos del inventario.
- **Edificios:** altura arquitectónica, con agujas integrantes del diseño y sin antenas. Se utilizan las fichas del Skyscraper Center, documentos técnicos, operadores e instituciones. Willis Tower se ordena por 442,1 m, no por su altura con antenas.

La ampliación conserva los datos, identificadores y arte de las 68 cartas anteriores de estos siete bloques. Sus cifras no se consideran revalidadas por este trabajo. La versión 3 del catálogo se mantiene para preservar partidas guardadas.

## Ilustraciones y comprobaciones

Setenta ilustraciones originales de 512 × 768, WebP, grabado sepia sobre papel envejecido y sin texto ni marco. Revisión visual por bloque; las dos imágenes de Adele se corrigieron para representar a la artista. [arte-siete-retos-ampliacion-2026-10-05.json](arte-siete-retos-ampliacion-2026-10-05.json) registra el prompt y SHA-256 de cada imagen, también incorporados al inventario de arte.

Las nuevas ilustraciones suman 5.361.922 bytes; todas se precargan para jugar sin conexión. Se reserva margen de 6 MB para imágenes y datos. Caché actualizada a continuum-v588.

Se comprueba el orden completo de los siete mazos, la recuperación de partidas con sus cartas anteriores, la correspondencia de fuentes y fechas, los registros USDA y GeoNames, las 507 imágenes únicas de retos rápidos, el inventario de arte, sintaxis, precarga y presupuesto. La revisión de pantalla recorre las 138 cartas de estos siete mazos a 360 y 1280 píxeles, incluidas las 19 referencias de artista, las fuentes y el botón de continuar.

