# Verificación de la expansión de Entretenimiento, Ciencia y Naturaleza

Fecha de revisión: 29 de agosto de 2026.

## Resultado

- **Hitos de la música:** 51 cartas, de 1607 a 2023.
- **Historia de los videojuegos:** 51 cartas, de 1952 a 2024.
- **Astronomía y espacio:** 49 cartas, de 1543 a 2024.
- **Historia de la medicina:** 48 cartas, desde aproximadamente 400 a. C. hasta 2024.
- **Peso de animales:** 38 cartas, de 0,1 g a 150 t.
- **Distancias entre ciudades:** 38 cartas, de 17 km a 19.597 km.
- **Esperanza de vida de animales:** 38 cartas, de días a milenios.
- **Velocidad de animales:** 38 cartas, de 0,03 km/h a 360 km/h.
- 351 identificadores nuevos, todos únicos y reservados por mazo: 6000 música, 7000
  videojuegos, 8000 astronomía, 9000 medicina, 10000 peso, 11000 distancias,
  12000 longevidad y 13000 velocidad.
- Ningún título repetido, ningún campo vacío y ningún año repetido dentro de un mismo mazo.
- Todos superan las 38 cartas necesarias para repartir cuatro a nueve participantes y dejar
  una carta inicial sobre la línea.

## Criterio de selección

1. Se priorizaron hitos reconocibles y con una fecha concreta: estreno, publicación,
   lanzamiento, llegada, demostración, aprobación o intervención.
2. Si un producto tuvo lanzamientos regionales distintos, la carta dice qué primer lanzamiento
   toma como referencia. No se mezclan fechas de Japón, Europa y Estados Unidos sin avisar.
3. Música y videojuegos son deliberadamente densos en las décadas recientes. Se exige un año
   único, pero no el espaciado de un relato que cubre milenios: quitar cada pareja de años
   consecutivos borraría la mayor parte de su historia.
4. En medicina se evita atribuir procesos colectivos a una sola persona y se distingue entre
   observar una posibilidad y convertirla en un tratamiento disponible.
5. En astronomía se diferencia descubrimiento, anuncio y fecha de misión; por ejemplo, James
   Webb se lanza en 2021 y publica sus primeras imágenes científicas en 2022.
6. Los pesos son masas típicas de adultos, expresadas en kilogramos; no se presentan como un
   máximo de la especie ni como el peso de un individuo excepcional.
7. Cada distancia es la geodésica de círculo máximo entre coordenadas de centros urbanos,
   calculada con Haversine y radio terrestre de 6.371 km. No es una distancia por carretera,
   ferrocarril ni una ruta comercial de aviación.
8. La longevidad no se presenta como una promesa individual: cada carta usa una referencia
   documentada y especifica los casos de vida máxima, cautividad o estimación de colonia.
9. La velocidad es una punta de referencia; las cartas indican el movimiento concreto para no
   confundir una carrera, un nado y un picado.

## Fuentes de contraste principales

### Música

- [Library of Congress — historia de la grabación sonora](https://www.loc.gov/collections/national-jukebox/articles-and-essays/acoustical-recording/): paso de la grabación acústica a la eléctrica.
- [Smithsonian — fonógrafo de Edison](https://americanhistory.si.edu/collections/object/nmah_852303): desarrollo y demostración del fonógrafo en 1877.
- [The Beatles — cronología oficial](https://www.thebeatles.com/): lanzamientos y evolución discográfica del grupo.
- [Recording Academy — archivo de premios y artistas](https://www.grammy.com/awards): contraste de álbumes, canciones y fechas de la era popular.

### Videojuegos

- [The Strong National Museum of Play — World Video Game Hall of Fame](https://www.museumofplay.org/exhibits/world-video-game-hall-of-fame/): contexto e influencia de los juegos seleccionados.
- [Computer History Museum — Timeline of Computer History](https://www.computerhistory.org/timeline/): primeros programas, ordenadores domésticos y plataformas.
- [Nintendo — historia de la compañía](https://www.nintendo.co.jp/corporate/en/history/): fechas de sus consolas y principales cambios de generación.

### Astronomía y espacio

- [NASA — 60 momentos de su historia](https://www.nasa.gov/specials/timeline/): misiones tripuladas, sondas y telescopios.
- [NASA Science — misiones lunares](https://science.nasa.gov/moon/missions/): cronología de la exploración de la Luna.
- [NASA Science — Marte](https://science.nasa.gov/mars/): Viking, Pathfinder, Curiosity y otras misiones marcianas.
- [ESA — Rosetta](https://www.esa.int/Science_Exploration/Space_Science/Rosetta): llegada de Rosetta y aterrizaje de Philae.
- [LIGO — detección de ondas gravitacionales](https://www.ligo.org/science/Publication-GW150914/index.php): anuncio y datos de la primera detección directa.

### Medicina

- [Organización Mundial de la Salud — erradicación de la viruela](https://www.who.int/health-topics/smallpox): campaña mundial y declaración de 1980.
- [Nobel Prize — hitos de la insulina](https://www.nobelprize.org/prizes/medicine/1923/summary/): aislamiento y aplicación terapéutica.
- [Proyecto Genoma Humano — cronología](https://www.genome.gov/human-genome-project): inicio, publicación y finalización del proyecto internacional.
- [Nobel Prize — CRISPR-Cas9](https://www.nobelprize.org/prizes/chemistry/2020/press-release/): desarrollo de la edición genética programable.
- [FDA — vacunas contra la COVID-19](https://www.fda.gov/vaccines-blood-biologics/coronavirus-covid-19-cber-regulated-biologics): autorizaciones y documentación regulatoria.

### Animales y distancias

- [Animal Diversity Web](https://animaldiversity.org/): contraste de masas y rangos de especies.
- [NOAA Fisheries — especies marinas](https://www.fisheries.noaa.gov/species-directory): contraste de grandes mamíferos y tiburón ballena.
- [GeoNames](https://www.geonames.org/): coordenadas de referencia de las ciudades.
- [Movable Type Scripts — fórmula de Haversine](https://www.movable-type.co.uk/scripts/latlong.html): método de cálculo de distancia de círculo máximo.
- [Smithsonian's National Zoo](https://nationalzoo.si.edu/animals): contraste de longevidad y velocidad de especies.
- [San Diego Zoo Wildlife Alliance](https://animals.sandiegozoo.org/): fichas de vida, locomoción y tamaño de especies.

## Control automático

`node tests/mazos.mjs` comprueba tamaño mínimo, años, títulos e identificadores únicos, campos
obligatorios y colisiones entre todos los mazos. `node tests/partidas-al-azar.mjs` reparte sus
cuarenta simulaciones entre los catorce juegos y confirma que ninguna carta se crea, duplica o
desaparece y que la línea permanece ordenada.
