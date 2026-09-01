# Correcciones de las auditorías de Continuum

Fecha: 30 de agosto de 2026. Base revisada: `61c73e96935108bae49e5a2c594e6e81edf9038d`.

## Alcance y criterio

Se modifican 133 cartas entre correcciones de valores, títulos, explicaciones, contexto y avisos.
31 cambian su valor de ordenación. Se conservan los 14 mazos base, sus 933 identificadores y las
673 cartas cronológicas de la Gran mezcla; no se añaden animales ni geografía a esa mezcla.

Las dos auditorías incluyeron lectura completa y contrastes externos dirigidos, no una
certificación externa individual de las 933 cartas. Que una prueba automática pase tampoco
certifica un dato. Esta entrega distingue errores confirmados, matices y 25 cartas de animales
que siguen pendientes. Estas últimas conservan valores **provisionales** y se avisan en el
propio juego; no se consideran fiables solo por haberse conservado.

En Naturaleza se compara una **referencia con contexto visible en el título**, no una supuesta
media universal. Cuando una fuente solo ofrece un intervalo y se toma su extremo superior,
se dice expresamente; no se calcula un punto medio y se llama promedio. Una edad de colonia
no es la vida de un pólipo, ni una media de carrera es velocidad instantánea. Los títulos
identifican estas diferencias antes de descubrir la respuesta. Los valores y métodos de
fuentes distintas siguen teniendo incertidumbre: estos mazos no son una clasificación
biológica de precisión ni tres tablas estadísticas homogéneas.

«Esperanza de vida» se renombra «Longevidad de animales». Las correcciones numéricas de animales
incorporan un campo `source` con la página de respaldo. Se mantiene el número de cartas para no
romper el reparto de hasta nueve jugadores; la eliminación o sustitución de los pendientes
requiere completar su documentación, no inventar una cifra para cubrir el hueco.

## Valores de ordenación modificados

Los números se interpretan junto al nuevo título y la explicación; en algunos casos cambia
el contexto de comparación. «Hasta» significa el límite publicado por esa fuente, no un
récord universal verificado. La conversión de libras a kg usa 0,45359237 y la de mph a km/h,
1,609344, con el redondeo declarado en la carta.

| ID | Referencia corregida | Antes | Ahora | Unidad | Fuente |
|---|---|---:|---:|---|---|
| 10006 | Rata parda (media publicada) | 0,12 | 0,4 | kg | [Fuente](https://animaldiversity.org/accounts/Rattus_norvegicus/) |
| 10012 | Castor europeo (límite del rango) | 11 | 35 | kg | [Fuente](https://animaldiversity.org/accounts/Castor_fiber/) |
| 10013 | Lince ibérico (media publicada) | 18 | 12,8 | kg | [Fuente](https://animaldiversity.org/accounts/Lynx_pardinus/) |
| 10014 | Gran danés macho (límite del rango) | 30 | 79,4 | kg | [Fuente](https://www.akc.org/dog-breeds/great-dane/) |
| 10017 | Chimpancé macho silvestre (límite del rango) | 80 | 70 | kg | [Fuente](https://animaldiversity.org/accounts/Pan_troglodytes/) |
| 10032 | Orca (macho excepcional documentado) | 12.000 | 10.000 | kg | [Fuente](https://seaworld.org/animals/all-about/killer-whale/characteristics/) |
| 10037 | Ballena franca austral (hasta, aprox.) | 100.000 | 80.000 | kg | [Fuente](https://www.fisheries.noaa.gov/species/southern-right-whale) |
| 2052 | Singapur (superficie de 2025) | 734 | 744,3 | km² | [Fuente](https://www.singstat.gov.sg/find-data/explore-data-themes/society/environment/our-data-explained) |
| 4011 | El astrolabio en el mundo islámico (siglo VIII, fecha aproximada) | 610 | 750 | año | [Fuente](https://antiquities.bibalex.org/Collection/Detail.aspx?a=949&collection=42&lang=en) |
| 4012 | El tratado de álgebra de Al-Juarismi (fecha aproximada) | 850 | 830 | año | [Fuente](https://mathshistory.st-andrews.ac.uk/Biographies/Al-Khwarizmi/) |
| 12006 | Monarca migratoria (límite habitual) | 0,16 | 8 meses (8/12 años) | años | [Fuente](https://www.fws.gov/press-release/2020-12/endangered-species-act-listing-monarch-butterfly-warranted-precluded) |
| 12009 | Hámster doméstico (duración habitual) | 0,65 | 2 | años | [Fuente](https://www.rspca.org.uk/adviceandwelfare/pets/rodents/hamsters) |
| 12010 | Gerbillo doméstico (límite habitual) | 1 | 4 | años | [Fuente](https://www.rspca.org.uk/adviceandwelfare/pets/rodents/gerbils) |
| 12011 | Cobaya doméstica (límite habitual) | 1,6 | 6 | años | [Fuente](https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs) |
| 12021 | Bisonte americano (límite habitual en libertad) | 46 | 20 | años | [Fuente](https://animaldiversity.org/accounts/Bison_bison/) |
| 12022 | Hipopótamo común (mediana publicada) | 58 | 36 | años | [Fuente](https://animals.sandiegozoo.org/animals/hippo) |
| 12026 | Guacamayo rojo (límite habitual) | 145 | 50 | años | [Fuente](https://animaldiversity.org/accounts/Ara_macao/) |
| 12027 | Koi (media publicada) | 185 | 40 | años | [Fuente](https://nationalzoo.si.edu/animals/japanese-koi) |
| 12030 | Almeja de Islandia (ejemplar Ming) | 390 | 507 | años | [Fuente](https://www.bangor.ac.uk/news/latest/clam-found-to-be-over-500-years-old-16781) |
| 12031 | Coral negro (colonia datada) | 500 | 4265 | años | [Fuente](https://ocean.si.edu/ecosystems/coral-reefs/deep-sea-corals) |
| 12036 | Coral dorado (colonia datada) | 1900 | 2742 | años | [Fuente](https://ocean.si.edu/ecosystems/coral-reefs/deep-sea-corals) |
| 12037 | Monorhaphis chuni (ejemplar, edad estimada) | 2500 | 11.000 | años | [Fuente](https://www.sciencedirect.com/science/article/abs/pii/S0009254112000277) |
| 13007 | Koala (máximo observado en un estudio) | 0,6 | 10 | km/h | [Fuente](https://journals.biologists.com/jeb/article/222/24/jeb207506/223548/Quantifying-koala-locomotion-strategies) |
| 13010 | Manatí de Florida (aceleración nadando) | 2,8 | 24,1 | km/h | [Fuente](https://myfwc.com/education/wildlife/manatee/facts-and-information/) |
| 13014 | Oso polar (nadando) | 19 | 10 | km/h | [Fuente](https://seaworld.org/animals/all-about/polar-bears/adaptations/) |
| 13018 | Emú (corriendo) | 65 | 48 | km/h | [Fuente](https://animals.sandiegozoo.org/animals/emu) |
| 13020 | Avestruz (esprint) | 90 | 70 | km/h | [Fuente](https://animals.sandiegozoo.org/animals/ostrich) |
| 13021 | Caballo Winning Brew (media de carrera) | 105 | 70,35 | km/h | [Fuente](https://www.guinnessworldrecords.com/world-records/fastest-speed-for-a-race-horse) |
| 13023 | Berrendo americano (carrera, referencia NPS) | 138 | 97 | km/h | [Fuente](https://www.nps.gov/wica/learn/nature/pronghorn.htm) |
| 13024 | Guepardo (límite del rango de esprint) | 158 | 112 | km/h | [Fuente](https://nationalzoo.si.edu/animals/cheetah) |
| 13038 | Abeja melífera (vuelo de crucero sin carga) | 9,5 | 27 | km/h | [Fuente](https://journals.biologists.com/jeb/article/209/5/978/16690/Visual-regulation-of-ground-speed-and-headwind) |

El astrolabio islámico se documenta desde el siglo VIII: 750 es una **convención de ordenación
aproximada para ese siglo**, explicitada en la carta, no una invención datada en ese año.
Al-Juarismi se sitúa hacia 830 dentro del reinado de al-Mamún (813–833), no en su fecha de muerte.
La fotografía de Niépce conserva 1826 como referencia aproximada entre 1826 y 1827; no se
impone como año indiscutible. El dato de Monorhaphis conserva la incertidumbre de ±3.000 años.

## Correcciones de títulos y explicaciones

### Historia e inventos

- **10, 29, 127 y 181:** independencia del califato abasí; excepción de Valladolid en la sede
  de la Corte; aprobación de Leyes de Indias en 1680 frente a impresión en 1681; y papel
  diferenciado de partidos y agentes sociales en los Pactos de la Moncloa. La carta original
  de Moncloa decía «acuerdan», no «firman»: se precisa el texto sin atribuirle otro error.
  [UNAM: aprobación y publicación de la recopilación](https://revistas.juridicas.unam.mx/index.php/historia-derecho/article/download/20619/20959/46938),
  [Archivo de la Transición: Pactos de la Moncloa](https://archivodelatransicion.es/archivo-organizaciones/los-pactos-de-la-moncloa-2).
- **4007, 4008, 4020:** la fecha de Arquímedes es su muerte; el calendario distingue decreto
  de 46 a. C. y entrada en vigor en 45 a. C.; Lippershey solicita la patente, no se afirma
  que se le concediera.
- **4030 y 4031:** termómetro y publicación de escala no son el mismo hito; la primera edición
  de Systema Naturae de 1735 no se confunde con los puntos de partida binomiales de 1753/1758.
  [Linnean Society](https://www.linnean.org/the-society/building-and-collections).
- **4041, 4043, 4047 y 4051:** fecha discutida de Niépce; desarrollo de Morse en 1837 frente a
  patente de 1840; ventas de Otis en 1853 frente a demostración de 1854; presentación de Mendel
  en 1865 frente a publicación de 1866.
  [Harry Ransom Center](https://www.hrc.utexas.edu/press/releases/2012/first-photograph-to-travel.html),
  [Smithsonian: patentes](https://npg.si.edu/exhibition/spirit-invention-patent-office),
  [Historia de Otis](https://www.otis.com/en/kw/our-company/history),
  [Estudio histórico de Mendel](https://pmc.ncbi.nlm.nih.gov/articles/PMC5586364/).
- **4059, 4065 y 4094:** descubrimiento de radio/polonio frente al posterior aislamiento
  metálico; interpretación nuclear de Rutherford en 1911 a partir de Geiger y Marsden en
  1909; espejo primario de Hubble, no lente.
  [Conferencia Nobel de Curie](https://www.nobelprize.org/prizes/chemistry/1911/marie-curie/lecture/),
  [AIP: Rutherford](https://history.aip.org/exhibits/rutherford/sections/alpha-particles-atom.html),
  [NASA: defecto del espejo](https://science.nasa.gov/mission/hubble/observatory/design/optics/hubbles-mirror-flaw/).
- **5047, 5068, 5070, 5071, 5074, 5075 y 5077:** tres naves, no tres carabelas; aprobación
  británica de 1833 y aplicación en 1834; se elimina el recuento indefinido de cincuenta
  países en 1848; llegada de Perry en 1853 frente al tratado de 1854; muerte de Lincoln
  seis días después de la rendición de Lee y abolición constitucional en diciembre;
  Suez sin tiempos de viaje carentes de puertos; Berlín no fijó todas las fronteras actuales.
  [National Archives: abolición británica](https://www.nationalarchives.gov.uk/explore-the-collection/explore-by-time-period/georgians/1833-abolition-of-slavery-act-and-compensation-claims/),
  [Departamento de Estado: Perry](https://history.state.gov/milestones/1830-1860/opening-to-japan),
  [NPS: Lincoln](https://www.nps.gov/people/abraham-lincoln.htm),
  [National Archives: XIII enmienda](https://www.archives.gov/milestone-documents/13th-amendment),
  [Investigación sobre fronteras africanas](https://www.aehnetwork.org/blog/african-borders-neither-random-nor-decided-at-the-berlin-conference/).
- **5096, 5097, 5109, 5114 y 5115:** línea de demarcación coreana cercana al paralelo 38;
  boicot de Montgomery como hito, no comienzo de todo el movimiento; sufragio universal
  sin exclusión racial en Sudáfrica; expansión de la Primavera Árabe en 2011 con origen en
  diciembre de 2010; margen del Brexit de 3,8 puntos porcentuales.
  [Amnistía: Primavera Árabe](https://www.amnesty.org/en/documents/mde03/3096/2015/en/),
  [Parlamento británico: resultados del referéndum](https://commonslibrary.parliament.uk/research-briefings/cbp-7639/).

### Entretenimiento, ciencia y medicina

- **1030, 1043, 1052:** Sad Hill está en Burgos; Steadicam ya se usaba en 1976; Sebastián
  canta Bajo el mar.
  [Turismo de Burgos](https://turismoburgos.org/el-cementerio-de-sad-hill/),
  [Historia de Steadicam](https://tiffen.com/pages/history-of-steadicam).
- **1054, 1060, 1082, 1083, 1085 y 1087:** se elimina la afirmación no sólida de los 16
  minutos de Hopkins; Titanic iguala once Óscars en 1998; se corrige la frase de Parásitos;
  Soul tuvo distribución diferente según mercado; As bestas tiene tres idiomas; se evita
  presentar un récord de taquilla como permanente.
  [Cronometraje independiente de Hopkins](https://www.screentimecentral.com/leading-actor-oscar-nominees),
  [Academia: ceremonia de 1998](https://www.oscars.org/oscars/ceremonies/1998/memorable-moments),
  [Disney: distribución de Soul](https://d23.com/just-announced-soul-to-debut-exclusively-on-disney-this-christmas/),
  [Cannes: As bestas](https://www.festival-cannes.com/en/2022/as-bestas-the-beasts-rodrigo-sorogoyen-s-new-psychological-thriller/).
- **6006, 6010, 7014:** Umlauf dirige la ejecución de la Novena; el cilindro de 1888 no es
  el registro musical más antiguo; Zelda japonés de 1986 guarda en disco, no en cartucho.
  [Archivo Beethoven: programa del estreno](https://katalog.beethoven.de/cgi-bin/biblio/kat_en.pl?dtyp=xx&q_0=op.+124&t_multi=x&treu=x&v_0=SSW&x=u),
  [Library of Congress: fonautogramas anteriores](https://blogs.loc.gov/now-see-hear/2021/08/from-the-recording-registry-phonautograms-c-1853-61/),
  [Nintendo: Famicom Disk System](https://iwataasks.nintendo.com/interviews/wii/super_mario_galaxy/2/3/).
- **8005, 8038, 8044, 9024 y 9030:** Kepler publica en 1619 una ley formulada en 1618;
  Sojourner es el rover de Pathfinder; detección de LIGO en 2015 y anuncio en 2016;
  banco de sangre de Chicago primero de Estados Unidos; fallo temprano del marcapasos
  sin atribuirlo a una causa de batería no confirmada.
  [Archivo matemático de St Andrews: Kepler](https://mathshistory.st-andrews.ac.uk/Biographies/Kepler/),
  [Anuncio de LIGO](https://www.ligo.caltech.edu/news/ligo20160211),
  [Historia de AABB](https://www.aabb.org/blood-biotherapies/blood/transfusion-medicine/transfusion-medicine-resources/transfusion-medicine-history),
  [Revisión histórica del marcapasos](https://www.ahajournals.org/doi/10.1161/01.cir.97.19.1978).

### Geografía

Se mantienen las 49 cifras de población de la serie contrastada y se corrige su fecha:
**proyección a 1 de julio de 2026, WPP 2024, vía Worldometer**, no 1 de enero.
Se corrigen comparaciones de Indonesia, Sri Lanka, Bangladesh y Andorra; el superlativo
juvenil de Nigeria; media frente a mediana en Paraguay; ámbito territorial de Francia;
la descripción de Italia y la comparación ambigua Ecuador/Países Bajos.
[Worldometer: tabla](https://www.worldometers.info/world-population/population-by-country/),
[Definición de mitad de año](https://www.worldometers.info/world-population/india-population/),
[UNFPA: nota 10 del ámbito francés](https://www.unfpa.org/data/world-population/WORLD),
[ISTAT: indicadores de 2025](https://www.istat.it/en/press-release/demographic-indicators-year-2025/),
[Banco Mundial: superficies de 2023](https://data.worldbank.org/indicator/AG.SRF.TOTL.K2?locations=NL),
[Cuenca: población del 1 de enero de 2025](https://www.vocesdecuenca.com/cuenca/la-ciudad-de-cuenca-gana-118-habitantes-en-un-ano-pero-crece-menos-que-otras-capitales-de-tamano-similar/).

En superficie, los títulos de Francia y Marruecos muestran el ámbito antes de contestar.
Singapur se actualiza a 744,3 km² de diciembre de 2025. Las distancias no cambian: la
recomputación aproximada mantuvo su orden; faltan las coordenadas originales para una
reproducción exacta y no se sustituyen por distancias de carretera.

## Pendientes visibles en el juego

Estas cifras no se modifican sin evidencia. La marca `reviewStatus: "pending"` no implica
que se haya probado su falsedad; indica que no hay respaldo suficiente para darlas por
cerradas. Siguen siendo seleccionables y, por tanto, **también pueden aparecer en competición**.

| Mazo | ID | Falta por resolver |
|---|---|---|
| Longevidad | 12001 | Falta identificar la especie y documentar por separado la fase adulta y el ciclo completo. |
| Longevidad | 12002 | «Mosca de mayo» y «efímera» son nombres solapados; falta una especie y una duración documentadas. |
| Longevidad | 12007 | Falta una fuente que respalde el promedio silvestre de tres meses. |
| Longevidad | 12008 | Falta una fuente que respalde el valor silvestre de 0,4 años. |
| Longevidad | 12028 | La longevidad superior a dos siglos está documentada, pero falta justificar los 235 años concretos. |
| Longevidad | 12032 | Faltan especie, ejemplar y método que justifiquen esta estimación. |
| Longevidad | 12033 | Faltan especie, ejemplar y método que justifiquen esta estimación. |
| Longevidad | 12034 | Falta precisar la identificación taxonómica y la fuente de la edad. |
| Longevidad | 12035 | Falta identificar la colonia y el estudio que respalden los 1.450 años. |
| Longevidad | 12038 | La categoría es demasiado amplia y falta documentar la estimación. |
| Velocidad | 13002 | Falta identificar la especie y documentar la cifra. |
| Velocidad | 13003 | Falta identificar la especie y documentar la cifra. |
| Velocidad | 13006 | Falta identificar la especie y documentar la cifra. |
| Velocidad | 13008 | El texto describe una marcha habitual; falta una fuente para su valor numérico. |
| Velocidad | 13009 | El modo terrestre está especificado, pero falta una fuente para la cifra. |
| Velocidad | 13016 | Falta una fuente para elefantes africanos; una medición en elefantes asiáticos no resuelve esta carta. |
| Velocidad | 13022 | Los 120 km/h no tienen respaldo suficiente; falta cerrar la sustitución con una fuente adecuada. |
| Velocidad | 13025 | Falta verificar la medición y la discrepancia entre 182 y 170 km/h. |
| Velocidad | 13026 | Falta documentar la cifra y distinguirla del otro descenso de águila real. |
| Velocidad | 13027 | Falta documentar la cifra y distinguirla del otro descenso de águila real. |
| Velocidad | 13028 | No se ha encontrado respaldo suficiente para los 275 km/h. |
| Velocidad | 13029 | No se ha encontrado respaldo suficiente para los 315 km/h. |
| Velocidad | 13033 | Falta identificar la especie y documentar la cifra. |
| Velocidad | 13034 | Se compara la marcha por el fondo, pero falta documentar su cifra. |
| Peso | 10009 | Falta una fuente homogénea que respalde 2,5 kg como peso típico de un adulto. |

Otros matices abiertos en los informes no se convierten automáticamente en cambios:
por ejemplo, el recuento de acompañantes de Elcano, Andrómeda (observación frente a anuncio),
Prontosil y el ámbito de determinados países. Esta lista no significa que el resto esté
externamente certificado. Su Song conserva 1088, compatible con la ficha del
[Science Museum Group](https://collection.sciencemuseumgroup.org.uk/objects/co894/scale-model-of-su-songs-water-balance-escapement).
Tampoco se altera JFK por una supuesta afirmación de retransmisión en directo que la carta no hacía.

## Integridad del juego y actualización

- Se mantienen identificadores, claves de modalidades y composición de Competición y Gran mezcla.
- El 8 % deja de exigirse a los animales: se admiten empates reales y cifras próximas con
  respaldo. Geografía mantiene su criterio de selección. El formato no debe colapsar dos
  valores distintos; conserva 12,8 kg y distingue 70 de 70,35 km/h.
- `tests/referencias-animales.mjs` comprueba el motor local y el DOM con ambos lados de un
  empate y con valores cercanos; comprueba también los avisos visibles. `tests/mazos.mjs`
  conserva integridad, cardinalidad y controles de formato. Ninguna de estas pruebas verifica
  hechos científicos por sí sola.
- La caché pasa a `continuum-v26`. Tras recibir la actualización conviene iniciar partidas
  nuevas, especialmente de animales y longevidad: una línea guardada con las cifras anteriores
  puede haber quedado desordenada. No se borran partidas ni puntuaciones automáticamente.
  En multijugador todos deben actualizar antes de crear una sala nueva.

## Ronda 3: matices publicados

Se corrigen afirmaciones demasiado absolutas o imprecisas sin cambiar las fechas de Rocroi,
la destrucción del Primer Templo, la guerra de los Siete Años, el fin de la guerra de Vietnam,
Hong Kong, *Viaje a la Luna*, *Star Wars*, *Avatar*, las medias de nailon y Chang'e 6.

- Rocroi se sitúa junto a la localidad de las Ardenas francesas, no «en Flandes».
  [Visit Ardenne](https://www.visitardenne.com/en/best-ardennes/iconic-sites/rocroi)
- El exilio babilónico había empezado antes de la destrucción del templo; la carta refleja
  nuevas deportaciones en 586 a. C. [Metropolitan Museum](https://www.metmuseum.org/perspectives/cyrus-and-the-judean-diaspora)
- La guerra de Sucesión Austríaca ya tuvo conflictos en Europa, Canadá e India, por lo que se
  elimina la prioridad geográfica absoluta atribuida a la guerra de los Siete Años.
  [National Army Museum](https://www.nam.ac.uk/explore/war-austrian)
- Se suprime «primera derrota estadounidense» para Vietnam: el NPS documenta la victoria de
  Nube Roja frente a Estados Unidos antes de 1868. [National Park Service](https://www.nps.gov/places/1868-treaty-field-area.htm)
- Hong Kong pasa a describirse por el fin de la administración británica, sin atribuirle el
  cierre de todo ciclo imperial europeo; Macao continuó bajo administración portuguesa hasta 1999.
  [Gobierno de Macao](https://www.gov.mo/en/news/288348/)
- Alan Ladd Jr. aprobó y defendió *Star Wars*, frente a las dudas de otros ejecutivos.
  [Lucasfilm](https://www.starwars.com/news/alan-ladd-jr)
- *Viaje a la Luna* se describe como hito, no como inicio literal del cine fantástico: Méliès ya
  había realizado *Le Manoir du diable* en 1896. [BFI](https://www.bfi.org.uk/film/903dde01-68ea-536a-9be3-471d59cf83bb/le-manoir-du-diable)
- El lanzamiento nacional de las medias de nailon es de 1940; hubo ventas limitadas en 1939.
  [American Chemical Society](https://www.acs.org/education/whatischemistry/landmarks/carotherspolymers.html)
- La cara oculta lunar se formula sin «nunca»: las libraciones permiten observar alrededor del
  59 % de la superficie lunar con el tiempo. [Observatorio de Hong Kong](https://www.hko.gov.hk/en/education/astronomy-and-time/astronomy/00777-what-is-lunar-libration.html)

La carta del lince ibérico pasa de 22 años sin respaldo a Aura, una hembra del programa
Ex-situ que murió a los 20 años en 2022. Es una edad individual, no una esperanza de vida ni
un récord vigente de especie. [Boletín del programa de conservación](https://www.lynxexsitu.es/ficheros/boletines_pdf/124/Boletin_2semestre2022_Exsitu.pdf).
La liebre europea se mantiene jugable, pero se marca como pendiente: la ficha consultada da un
rango de 3–5 kg y no respalda 2,5 kg como peso típico. [Animal Diversity Web](https://animaldiversity.org/accounts/Lepus_europaeus/).

## Ronda 4: contraste con fuentes oficiales (1 de septiembre de 2026)

Repaso carta a carta de los catorce mazos y contraste dirigido de las afirmaciones con más
riesgo de errata: cifras concretas dentro de una explicación (horas, kilos, edades, víctimas),
relaciones de causa y fecha, y superlativos. Se confirman ocho erratas y se corrigen. El resto
de las comprobaciones dirigidas —Bessemer (1855), *El libro de la selva* como último largo
supervisado por Walt Disney, Singapur (744,3 km²)— sostiene lo que ya decían las cartas y no
se toca nada.

Como en las rondas anteriores, esto no es una certificación externa de las 933 cartas: es una
lectura completa más un contraste dirigido de los puntos dudosos.

### Datos numéricos dentro de la explicación

| ID | Mazo | Antes | Ahora | Fuente |
|---|---|---|---|---|
| 70 | Historia de España | «causan 193 víctimas mortales» | 192 muertes en los trenes; 193 al sumar al GEO de Leganés | [Ayuntamiento de Leganés](https://www.leganes.org/w/leganes-rinde-homenaje-a-las-victimas-del-11m-y-al-geo-fallecido-en-acto-de-servicio-en-el-municipio-el-3-de-abril-de-2004) |
| 4055 | Inventos | filamento que «aguanta cuarenta horas» | trece horas y media el 22 de octubre de 1879 | [Edison Papers, Rutgers](https://edison.rutgers.edu/life-of-edison/biographical-essays/lighting/the-carbon-filament-lamp) |
| 4071 | Inventos | Whittle patenta «con veintitrés años» | con veintidós; solicitud del 16 de enero de 1930 y concesión en 1932 | [The First Patent, frankwhittle.co.uk](https://frankwhittle.co.uk/the-first-patent/) |
| 4087 | Inventos | «un aparato de casi un kilo» | «un prototipo de más de un kilo» | [CBS News: 40 años del DynaTAC](https://www.cbsnews.com/news/cell-phone-turns-40-martin-coopers-first-call-on-the-dynatac/) |
| 3008 | Población | «Pierde medio millón al año desde 2010» | más de una década de descensos; ~550.000 en 2024 | [Statistics Bureau of Japan](https://www.stat.go.jp/english/data/jinsui/2024np/index.html) |

Las cuatro primeras decían un número que la fuente no sostiene. La de Japón mezclaba el ritmo
de pérdida actual con el del principio de la década: el descenso encadena catorce años, pero en
los primeros la caída era de unos cientos de miles, no de medio millón.

### Relación de causa y fecha

- **89 (910):** García I no llega al trono «tras la muerte de Alfonso III». Alfonso III abdicó y
  repartió sus dominios entre sus hijos, y murió después, el 20 de diciembre de ese mismo año.
  La carta pasa a describir la abdicación y el reparto, y sitúa la muerte al final.
  [Alfonso III de Asturias](https://es.wikipedia.org/wiki/Alfonso_III_de_Asturias)

### Valores de ordenación modificados

Dos cartas de Longevidad ordenaban por un número que su propia explicación contradecía. Se
corrigen con el criterio del mazo: el valor es el de la fuente y el título dice de qué
referencia se trata.

| ID | Referencia corregida | Antes | Ahora | Unidad | Fuente |
|---|---|---:|---:|---|---|
| 12013 | Erizo europeo (límite en libertad) | 4 | 6 | años | [Animal Diversity Web](https://animaldiversity.org/accounts/Erinaceus_europaeus/) |
| 12019 | Dragón de Komodo (referencia en libertad) | 28 | 30 | años | [Smithsonian's National Zoo](https://nationalzoo.si.edu/animals/komodo-dragon) |

El erizo ordenaba por 4 años mientras su texto hablaba de siete; ADW da hasta seis en libertad
y hasta diez en cautividad, y la carta usa ahora ese límite en libertad. El dragón de Komodo
ordenaba por 28 y su texto decía «alrededor de treinta»: se adopta la referencia del
Smithsonian, que además distingue la vida en libertad de la mediana en cuidado humano.
El erizo queda empatado con la cobaya en 6 años; es un empate real y los motores ya lo aceptan
en ambos órdenes.

### Distancias entre ciudades: queda cerrado el punto abierto

La ronda anterior dejó anotado que faltaban las coordenadas originales para reproducir el mazo
con exactitud. Se ha recalculado entero con el método que declara el propio archivo
—círculo máximo, radio de 6.371 km— y coordenadas de centro urbano de uso corriente: **las 38
cartas salen dentro del 0,1 %**, salvo París–Versalles, que redondea 17,4 a 17. El mazo queda
reproducido y no se cambia ninguna cifra.

### Integridad

- No se añaden ni se retiran cartas: se conservan los 933 identificadores y los 14 mazos.
- `npm test` pasa las 339 comprobaciones de las doce pruebas, incluidas cardinalidad, empates,
  formato de valores y avisos visibles. Ninguna de ellas verifica un hecho por sí sola.
- La caché pasa a `continuum-v39`. Conviene empezar partidas nuevas de Longevidad: una línea
  guardada con los valores anteriores del erizo o el dragón de Komodo puede haber quedado
  desordenada.
- Los 25 pendientes de la ronda anterior siguen pendientes: no se ha encontrado respaldo nuevo
  y no se inventa una cifra para cerrarlos.

## Ronda 5: se atacan los 25 pendientes (1 de septiembre de 2026)

Los pendientes de la ronda 2 no eran una lista cerrada, sino un encargo. Se ha buscado fuente
para los 25. **Doce quedan cerrados y trece siguen abiertos.** Peso pasa a no tener ninguno.

El criterio no cambia: si la fuente sostiene otra cifra, se cambia la cifra; si el problema es
el animal —una atribución que nadie ha medido, o dos cartas para el mismo bicho—, se sustituye
la carta y se dice por quién. No se inventa un número para tapar un hueco y no se retoca
ninguna cifra para separarla de su vecina.

### Cerrados con cifra corregida

| ID | Mazo | Antes | Ahora | Fuente |
|---|---|---:|---:|---|
| 10009 | Peso | 2,5 | 5 kg | [ADW: Lepus europaeus](https://animaldiversity.org/accounts/Lepus_europaeus/) (rango 3–5 kg) |
| 12007 | Longevidad | 0,25 | 1,5 años | [ADW: Mus musculus](https://animaldiversity.org/accounts/Mus_musculus/) (12–18 meses en libertad) |
| 12008 | Longevidad | 0,4 | 2 años | [ADW: Rattus norvegicus](https://animaldiversity.org/accounts/Rattus_norvegicus/) |
| 12028 | Longevidad | 235 | 211 años | [George et al., 1999](https://cdnsciencepub.com/doi/10.1139/z99-015), racemización del aspártico |
| 13016 | Velocidad | 45 | 24,5 km/h | [Hutchinson et al., 2006, JEB](https://journals.biologists.com/jeb/article/209/19/3812/16362/The-locomotor-kinematics-of-Asian-and-African) (6,8 m/s) |
| 13022 | Velocidad | 120 | 80 km/h | [Zoo de Granby](https://www.zoodegranby.com/en/animals/blue-wildebeest) |
| 13028 | Velocidad | 275 | 209 km/h | [Tucker, 1998, JEB](https://journals.biologists.com/jeb/article/201/13/2061/7683/Diving-Speeds-and-Angles-of-a-Gyrfalcon-Falco) (52–58 m/s, seguimiento óptico) |

Los 45 km/h del elefante eran el caso más claro: Hutchinson midió más de 2.400 zancadas de
elefantes africanos y asiáticos y la mayor velocidad fiable fue de 6,8 m/s. El gerifalte pasa
de una cifra sin origen a once picados cronometrados con aparato óptico.

### Cerrados sustituyendo la carta

Cuatro cartas no tenían arreglo cambiando el número, porque el problema era el animal.

| ID | Antes | Ahora | Motivo y fuente |
|---|---|---|---|
| 12038 | Esponja de aguas profundas, 3.300 años | Esponja barril gigante de Curaçao, 2.300 años | «Esponja de aguas profundas» no es una especie. Se sustituye por un ejemplar concreto de *Xestospongia muta* datado con las ecuaciones de [McMurray et al., 2008](https://link.springer.com/article/10.1007/s00227-008-1014-z) |
| 13025 | Vencejo de garganta blanca, 182 km/h | Ser humano: Usain Bolt, 44,7 km/h | Los 170 km/h del vencejo de garganta blanca se citan en todas partes, pero el método nunca se publicó. Se sustituye por la punta mejor medida de cualquier animal: [informe biomecánico de World Athletics, Berlín 2009](https://worldathletics.org/download/download?filename=76ade5f9-75a0-4fda-b9bf-1b30be6f60d2.pdf&urlslug=1+-+Biomechanics+Report+WC+Berlin+2009+Sprint+Men) |
| 13026 | Águila real, 210 km/h | Murciélago de cola libre brasileño, 160 km/h | Había **dos** cartas de águila real haciendo lo mismo. Se conserva una y esta pasa al vuelo horizontal más rápido registrado: [McCracken et al., 2016](https://royalsocietypublishing.org/doi/10.1098/rsos.160398) |
| 13029 | Halcón sacre, 315 km/h | Vencejo común, 111,6 km/h | Ningún picado de sacre está medido. Se sustituye por el récord de vuelo horizontal de un ave, con radar de la Universidad de Lund: [Guinness World Records](https://www.guinnessworldrecords.com/world-records/fastest-bird-level-flight) |

La carta que se conserva del águila real (13027) queda en 240 km/h, el extremo inferior del
rango de [Birds of the World](https://birdsoftheworld.org/bow/species/goleag/cur/behavior), y
dice en su explicación que son cifras referidas y no cronometradas.

### Empates y cifras próximas que esto genera

Tres parejas quedan a menos de un 8 %, y se dejan así a propósito: son dos valores documentados
que resultan estar cerca, y el mazo tiene prohibido moverlos para separarlos.

- **Guepardo 112 y vencejo común 111,6 km/h** (0,4 %). Es el peor par del mazo para jugar y a la
  vez el mejor dato: un vencejo en vuelo horizontal va tan rápido como un guepardo esprintando.
- **Manatí 24,1 y elefante 24,5 km/h** (1,7 %).
- **León 78 y ñu azul 80 km/h** (2,6 %). El 78 del león sigue sin fuente; si algún día se cierra,
  este par se recoloca solo.

Si alguno resulta molesto en la mesa, la salida correcta es cambiar de animal, no de cifra.

### Los trece que siguen abiertos

| Mazo | ID | Por qué no se cierra |
|---|---|---|
| Longevidad | 12001, 12002 | «Efímera» y «mosca de mayo» son el mismo orden de insectos: son dos cartas del mismo animal. Falta elegir especie y separar fase adulta de ciclo completo. |
| Longevidad | 12032, 12033, 12034 | Las estimaciones publicadas de esponjas van de 15.000 a 40.000 años y un seguimiento de McMurdo no detectó crecimiento en 22 años, lo que invalida los modelos de crecimiento. Ninguna sostiene 650, 850 ni 1.100. |
| Longevidad | 12035 | Sin colonia identificada ni estudio para los 1.450 años del coral de bambú. |
| Velocidad | 13002, 13003, 13006, 13033, 13034 | Invertebrados lentos. No hay fuente institucional ni experimental que dé una cifra por especie. |
| Velocidad | 13008 | Sin fuente para la marcha del panda gigante. |
| Velocidad | 13009 | Las referencias divulgativas dan 2,5–2,8 km/h caminando, por encima del 1,7 de la carta, pero no se ha localizado la medición original. |

Las tres esponjas y el coral de bambú son ahora el bloque más flojo del juego: cuatro cartas
seguidas con cifras redondas que ninguna literatura respalda. Cerrarlas pide sustituirlas por
organismos datados, y no hay cuatro con fecha publicada en ese tramo. Se dejan marcadas.

### Integridad

- Se conservan las 38 cartas de cada mazo de Naturaleza y los 933 identificadores.
- **Peso queda sin pendientes**, así que su aviso «en revisión» desaparece del juego. La prueba
  de accesibilidad comprobaba ese aviso sobre el mazo de peso; ahora comprueba las dos caras
  —que aparece donde quedan pendientes y que desaparece donde no— en vez de dar por hecho que
  siempre hay alguno.
- `npm test` pasa 340 comprobaciones.
- La caché pasa a `continuum-v40`. Conviene empezar partidas nuevas de Naturaleza: cambian
  valores en los tres mazos.

## Ronda 6: el problema no eran los pendientes (1 de septiembre de 2026)

Al buscar cómo cerrar los trece pendientes que quedaban apareció el dato que cambia el
diagnóstico: en los tres mazos de Naturaleza hay **114 cartas y 58 no tenían fuente ni aviso**.
El peregrino a 360 km/h, el león a 78, la jirafa a 55, el rinoceronte a 2,3 t: ninguna llevaba
respaldo y ninguna avisaba. La marca «en revisión» cubría trece cartas de un problema de
cincuenta y ocho, y al hacerlo daba a entender que el resto estaba comprobado.

Así que perseguir los trece de uno en uno no era lo eficiente: arreglaba la etiqueta, no el
mazo, y dejaba intacto el mecanismo que permitió que la deuda creciera sin que nadie la viera.

### Lo que se ha hecho

**1. Longevidad queda cerrada: cero pendientes.** Los seis que quedaban se sustituyen por
animales con edad documentada. Cuatro eran esponjas y un coral de bambú con cifras redondas
que ninguna literatura sostiene —para el coral de bambú las colonias vivas rondan de 50 a 150
años, no 1.450— y las dos primeras eran, literalmente, el mismo insecto dos veces.

| ID | Antes | Ahora | Fuente |
|---|---|---|---|
| 12001 | Efímera, 5 días | Efímera *Dolania americana*, **5 minutos** | [Portal de biodiversidad de Georgia](https://georgiabiodiversity.org/portal/profile?group=all&es_id=21325) |
| 12002 | Mosca de mayo, 9 días | Caballo Old Billy, **62 años** | [Guinness](https://www.guinnessworldrecords.com/news/2021/10/worlds-oldest-animals-cats-dogs-deep-sea-creatures-and-more-678003) |
| 12032 | Esponja de vidrio, 650 | Erizo rojo del Pacífico, **100 años** | [Ebert y Southon, NOAA](https://spo.nmfs.noaa.gov/content/red-sea-urchins-strongylocentrotus-franciscanus-can-live-over-100-years-confirmation-bomb) |
| 12033 | Esponja antártica, 850 | Tortuga Jonathan, **194 años** | [Guinness](https://www.guinnessworldrecords.com/news/icons/jonathan-the-tortoise-the-oldest-terrestrial-animal) |
| 12034 | Esponja barril antártica, 1.100 | Mejillón perlífero de río, **280 años** | [ADW](https://animaldiversity.org/accounts/Margaritifera_margaritifera/) |
| 12035 | Coral de bambú, 1.450 | Cacatúa Cookie, **83 años** | [Guinness](https://www.guinnessworldrecords.com/news/2021/10/worlds-oldest-animals-cats-dogs-deep-sea-creatures-and-more-678003) |

La efímera es el mejor cambio del lote: pasa de una cifra inventada a la vida adulta más corta
registrada en un animal, cinco minutos, con la ninfa pasando hasta dos años enterrada en la
arena del río.

**2. Se corrige de paso una carta muda.** El tiburón de Groenlandia ordenaba por 300 años sin
fuente; la datación por radiocarbono del cristalino de Nielsen y colaboradores da **392 ± 120**
para el mayor ejemplar. [Science, 2016](https://www.science.org/doi/10.1126/science.aaf1703).

**3. Velocidad cierra tres de siete.** Los récords institucionales existen justo donde no hay
medias por especie, así que se nombra el récord en vez de la especie, como ya hacían las cartas
de Winning Brew o la orca.

| ID | Antes | Ahora | Fuente |
|---|---|---|---|
| 13003 | Estrella de mar, 0,08 | Estrella de mar girasol, **0,06 km/h** | [Guinness, estrella más rápida](https://www.guinnessworldrecords.com/world-records/118353-fastest-starfish) |
| 13006 | Caballito de mar, 0,36 | Caballito de mar enano, **0,016 km/h** | [Guinness, el pez más lento](https://www.guinnessworldrecords.com/world-records/70705-slowest-fish) |
| 13009 | Pingüino emperador en tierra, 1,7 | Pingüino papúa nadando, **36 km/h** | [Guinness, ave nadadora más rápida](https://www.guinnessworldrecords.com/world-records/70933-fastest-bird-swimmer) |

Aviso sobre el caballito de mar: muchos sitios repiten «1,5 m/h». La ficha de Guinness dice
0,016 km/h, diez veces más. Se usa la del récord.

**4. El formato deja de aplastar el dato.** Cinco minutos se enseñaban como «0 días». La escala
de longevidad baja ahora hasta minutos y horas, y de paso se arreglan dos concordancias que ya
fallaban: decía «1 días» y «1 meses».

**5. La deuda se cuenta y solo puede bajar.** `tests/mazos.mjs` cuenta las cartas de Naturaleza
sin `source` y las marcadas en revisión, y falla si alguna de las dos cifras sube. Hoy el techo
está en **57 mudas y 4 en revisión**. Esto no comprueba que un dato sea cierto —ninguna prueba
puede—, pero convierte una deuda invisible en una cifra que se ve en cada ejecución y que solo
se mueve en una dirección. Bajarla es documentar cartas; subirla exige explicarlo en el commit.

### Los cuatro que siguen abiertos

Babosa, caracol marino, cangrejo de río y panda gigante. Son invertebrados lentos y un
mamífero para los que no existe una velocidad por especie publicada por ninguna institución.
Se quedan marcados, ahora ya sin la compañía de los otros veintiuno.

### Lo que queda por hacer, con nombre

Las 57 mudas son el trabajo pendiente real, y algunas ya huelen mal:

- **Caracol de jardín, 0,03 km/h.** Guinness da 0,03 **millas** por hora, que son 0,048 km/h.
  Tiene toda la pinta de un cambio de unidad perdido, pero no se toca sin confirmarlo.
- **Perezoso de tres dedos, 0,22 km/h.** Guinness da 1,8–2,4 m/min *en el suelo*, o sea
  0,11–0,14. La carta habla de moverse entre las ramas, que es otra cosa; hay que decidir cuál
  de las dos mide.
- **Halcón peregrino, 360 km/h** y **león africano, 78 km/h**: las dos cifras más altas del
  mazo de velocidad no llevan respaldo. Cerrar la del león recolocaría además el par que
  ahora queda a un 2,6 % del ñu.

### Integridad

- 38 cartas por mazo y 933 identificadores, sin cambios.
- `npm test` pasa 344 comprobaciones.
- La caché pasa a `continuum-v41`. Cambian valores en Longevidad y Velocidad y cambia el
  formato de los valores pequeños: conviene empezar partidas nuevas de Naturaleza.

## Ronda 7: primera tanda contra las 57 mudas (1 de septiembre de 2026)

Se ataca la deuda de fuentes documentada en la ronda anterior. **La deuda baja de 57 a 45.**
Doce cartas de Peso pasan a llevar respaldo, y en el camino aparecen dos cifras que estaban mal.

### Cómo se ha trabajado, y por qué importa

La red de esta sesión no deja descargar páginas: solo se ven resúmenes de búsqueda. Para que
eso no se convierta en citar de oído, se ha seguido una regla estricta: **solo se anota una
fuente cuando la búsqueda estaba restringida al dominio de esa fuente y devolvió una cifra
concreta para esa especie.** Todo lo que salió vago, ausente o mezclado con otra especie se ha
dejado sin tocar. De unas quince consultas, cuatro se descartaron por eso.

No es una precaución teórica. En esta misma tanda, una consulta sobre la cebra devolvió el peso
de la cebra de Grevy, y otra sobre el zorro llegó a mezclar tres cánidos. Anotar esas
respuestas habría metido errores nuevos en el mazo con aspecto de estar documentado, que es
justo lo que estas auditorías intentan evitar.

### Cartas cerradas (12)

| ID | Carta | Valor | Fuente |
|---|---|---:|---|
| 10011 | Zorro rojo (adulto típico) | 6,5 kg | ADW, rango 3–14 |
| 10015 | Lobo gris (media de hembras publicada) | 45 kg | ADW, hembras 23–55 (media 45), machos 30–80 (media 55) |
| 10016 | Capibara (adulto grande) | 60 kg | ADW, rango 35–66 |
| 10018 | Panda gigante (adulto típico) | 110 kg | Smithsonian: Mei Xiang 112 kg, Tian Tian 123,6 kg en 2022 |
| 10019 | Oso negro americano (adulto típico) | 150 kg | ADW, machos 47–409, hembras 39–236 |
| 10020 | León africano (macho adulto) | 190 kg | San Diego Zoo, machos 150–260 |
| 10021 | Tigre de Bengala (macho adulto) | 250 kg | San Diego Zoo, hasta 295 |
| 10024 | Alce (macho de la subespecie de Alaska) | 700 kg | ADW, machos 360–600 y hasta 771 en Alaska |
| 10026 | Jirafa (límite de las hembras) | 1.200 kg | ADW, hembras hasta 1.180, machos hasta 1.930 |
| 10027 | Hipopótamo común (hembra adulta) | 1.500 kg | San Diego Zoo, hembras 1.400 de media |
| 10033 | Ballena gris (hasta, aprox.) | **40.800 kg** | NOAA, unas 90.000 libras |
| 10022 | Cebra de llanura | — | pasa a revisión, ver abajo |

En casi todas, el número ya era razonable y lo que faltaba era decir de dónde salía y de qué
es medida: si es una media, un límite de rango o un sexo concreto. Los títulos ahora lo dicen.

### Dos cifras que estaban mal

- **Ballena gris: 25.000 → 40.800 kg.** NOAA da unas 90.000 libras. Las 25 toneladas no salían
  de ninguna parte. Con el cambio, la ballena gris pasa por delante de la jorobada en la línea.
- **Cebra de llanura, 350 kg: pasa a revisión.** San Diego Zoo describe la de llanura como la
  **más pequeña** de las tres especies de cebra, y sitúa en 350–450 kg a la de Grevy, que es la
  **mayor**. Darle 350 kg a la más pequeña no encaja. No se ha encontrado cifra publicada con la
  que sustituirla, así que se marca en vez de dejarla como si estuviera comprobada.

Esto sube los avisos de 4 a 5. El techo del test se sube a la vez y con motivo: el mecanismo
existe para que la deuda no crezca **en silencio**, no para empujar a esconder un hallazgo con
tal de mantener un contador en verde. Encontrar un error y marcarlo es el test funcionando.

### Estado de la deuda

| | Antes | Ahora |
|---|---:|---:|
| Sin fuente y sin aviso | 57 | **45** |
| En revisión | 4 | 5 |
| Con fuente | 53 | 64 |

Techos del test actualizados a 45 y 5. Reparto de lo que queda: 18 en Peso, 12 en Longevidad
y 15 en Velocidad.

### Lo que falta y a qué ritmo va

Quedan 45. Al ritmo real de esta tanda —con los descartes incluidos— son del orden de cincuenta
consultas más. Se puede seguir por tandas; el orden sensato es acabar Peso, que es el que mejor
cubre Animal Diversity Web, y dejar para el final las tres señaladas en la ronda anterior
(caracol de jardín, perezoso y el peregrino a 360 km/h), que necesitan decidir antes **qué**
miden, no solo de dónde sale el número.

### Integridad

- 38 cartas por mazo y 933 identificadores, sin cambios.
- `npm test` pasa 344 comprobaciones. La prueba de accesibilidad apuntaba al mazo de Peso para
  comprobar que un mazo sin pendientes no muestra el aviso; como Peso vuelve a tener uno, ahora
  apunta a Longevidad, que sí está limpio.
- La caché pasa a `continuum-v42`. Cambia el peso de la ballena gris, así que conviene empezar
  partidas nuevas de Naturaleza.

## Ronda 8: segunda tanda contra las mudas (1 de septiembre de 2026)

**La deuda baja de 45 a 35.** Diez cartas más de Peso pasan a llevar respaldo. Peso queda con
ocho mudas y una en revisión; Longevidad con doce; Velocidad con quince y cuatro en revisión.

Se mantiene la regla de la ronda anterior: fuente solo cuando la búsqueda iba restringida a ese
dominio y devolvió cifra concreta para esa especie. En esta tanda se descartaron seis consultas
—bisonte por ADW tres veces, cachalote, tiburón ballena, cobaya por la RSPCA— antes de dar con
una fuente utilizable o dejarlas para otra vez.

### Cartas cerradas (10)

| ID | Carta | Valor | Fuente |
|---|---|---:|---|
| 10005 | Ratón doméstico (adulto típico) | 25 g | ADW, rango 12–30 g |
| 10008 | Cobaya (adulto típico) | 900 g | ADW, rango 700–1.200 g |
| 10010 | Gato doméstico (adulto típico) | 4,5 kg | ADW, rango 4,1–5,4 kg |
| 10025 | Bisonte americano (macho adulto) | 900 kg | NPS, machos hasta 2.000 libras |
| 10028 | Rinoceronte blanco (límite publicado) | 2.300 kg | San Diego Zoo, 6.000 libras el más pesado |
| 10029 | Elefante marino del sur (macho adulto) | 4.000 kg | ADW, machos de más de 3.700 kg |
| 10030 | Elefante africano de sabana (macho grande) | 6.000 kg | San Diego Zoo, machos 12.000–15.000 libras |
| 10034 | Ballena jorobada (hasta, aprox.) | **36.300 kg** | NOAA, 40 toneladas cortas |
| 10036 | Rorcual común (hasta, aprox.) | **68.900 kg** | NOAA, 76 toneladas cortas |
| 10038 | Ballena azul (hasta, aprox.) | 150.000 kg | NOAA, más de 330.000 libras en las antárticas |

### Una ambigüedad de unidades que conviene dejar anotada

Las fichas de NOAA dan pesos «in tons» sin decir cuáles. En la ballena jorobada la propia ficha
las traduce —40 toneladas ≈ 80.000 libras—, lo que confirma que **son toneladas cortas**, no
métricas. La diferencia no es menor: 76 toneladas del rorcual son 68,9 métricas, no 76.
Con eso resuelto, jorobada y rorcual se ajustan a la cifra publicada. La ballena azul ya venía
en libras y salía clavada.

### Lo que queda, y una decisión que no es mía

Quedan **35**: 8 en Peso (abeja, monarca, mantis, rana arborícola, paloma, caballo de silla,
tiburón ballena y cachalote), 12 en Longevidad y 15 en Velocidad.

Para Longevidad aparece un atajo real: **AnAge**, la base de longevidad animal de Human Ageing
Genomic Resources, tiene ficha por especie con URL predecible y responde bien a la búsqueda.
Cubriría casi todo el mazo de una vez.

El problema es que AnAge publica **longevidad máxima registrada**, no la típica, y las cartas
actuales dicen otra cosa. Adoptarla significaría que el conejo pasa de 2,5 a 9 años, la ardilla
roja de 6,5 a 12 y el zorro de 10 a 21,3. Y llevado al perro o al gato daría 29 y 30 años, que
son Bluey y Creme Puff: el mazo se convertiría en una lista de récords, cuando ya tiene a Old
Billy, Cookie y Jonathan cumpliendo ese papel.

Es una decisión sobre qué mide el mazo, no sobre si un dato es cierto, así que se deja abierta:

1. **Convertir Longevidad a máximos de AnAge.** Rápido, una sola fuente, cierra casi todo. El
   mazo pasa a comparar récords en vez de vidas corrientes.
2. **Mantener valores típicos** y buscar fuente caso a caso. Conserva el carácter del mazo y es
   bastante más lento; algunas cartas quizá no se cierren nunca.
3. **Mezclar con etiqueta**, como ahora: cada carta dice si es media, límite o récord.

### Integridad

- 38 cartas por mazo y 933 identificadores, sin cambios.
- `npm test` pasa 344 comprobaciones. Techo de mudas actualizado a 35.
- La caché pasa a `continuum-v43`. Cambian los pesos de la jorobada y el rorcual.

## Ronda 9: criterio de medias y típicas, y el folclore de las velocidades (1 de septiembre de 2026)

Decisión del autor: **el mazo compara medidas medias o típicas, no récords ni ejemplares
excepcionales.** Se adopta como criterio para lo que queda por documentar y se empieza a
aplicar hacia atrás. Deuda: **35 → 29 mudas**, con 7 avisos.

### Lo que este criterio destapa

Al aplicarlo a Velocidad aparece un patrón que va más allá de una carta suelta: **las cifras
populares de velocidad animal son sistemáticamente más altas que las institucionales, y no
traen procedencia.** Cuatro casos en esta tanda:

| Carta | Cifra popular (la que tenía) | Lo que dice la fuente |
|---|---:|---|
| Halcón peregrino | 360 km/h | Picados medidos de 39 a 51 m/s (140–184). Los autores subrayan que quedan **muy por debajo** de la velocidad terminal posible: el halcón modera el picado para no perder precisión |
| Hipopótamo | 30 km/h | San Diego Zoo: carga de hasta 14 mph, **22,5 km/h** |
| León africano | 78 km/h | Los 80 km/h que se repiten en todas partes no traen procedencia; el GPS en Botsuana da puntas menores y variables; San Diego Zoo baja a 53 km/h en leonas |
| Caracol de jardín | 0,03 km/h | El **récord** Guinness de caracol terrestre es 0,233 cm/s, o sea **0,0084 km/h** |

El caracol es el más llamativo: la carta iba 3,5 veces más rápida que el ejemplar más veloz
jamás cronometrado. No era una velocidad típica; no era ni siquiera posible.

Los 389 km/h del peregrino, que es de donde venían los 360, son de un ejemplar entrenado
lanzándose junto a un paracaidista. Es el ejemplo de manual de lo que el criterio nuevo excluye.

### Cartas cerradas (6)

| ID | Carta | Antes | Ahora | Fuente |
|---|---|---:|---:|---|
| 13005 | Perezoso de tres dedos (entre las ramas) | 0,22 | **0,27 km/h** | Guinness: 4,6 m/min en las ramas, 1,8–2,4 en el suelo |
| 13015 | Hipopótamo común (carga en tierra) | 30 | **22,5 km/h** | San Diego Zoo |
| 13017 | Jirafa (galopando) | 55 | **56,3 km/h** | San Diego Zoo, unas 35 mph |
| 13030 | Halcón peregrino (picado medido) | 360 | **184 km/h** | Ponitz et al., PLOS ONE |

Más las de Peso de la ronda anterior que ya seguían el criterio. El perezoso tenía además el
problema de mezclar medidas: Guinness da una cifra para el suelo y otra para las ramas, y la
carta habla de las ramas.

### Dos que pasan a revisión

- **León africano.** Tres fuentes, tres cifras que no se pueden conciliar. Marcarlo es más
  honesto que elegir una.
- **Caracol de jardín.** Se ha demostrado que la cifra es imposible, pero no hay una velocidad
  típica publicada con la que sustituirla.

Los avisos suben de 5 a 7 y el techo del test con ellos. Es la tercera vez que pasa y conviene
decirlo claro: **el contador de avisos subiendo es el sistema funcionando**, no fallando. Baja
cuando se documenta y sube cuando se descubre que algo estaba mal. Lo que no puede hacer es
moverse sin que quede escrito por qué.

### Una consecuencia que hay que decidir

Con el peregrino en 184, la carta más rápida del mazo pasa a ser el **águila real en picado, con
240 km/h**, y es la cifra peor sostenida de las cinco primeras: Birds of the World la da como
«referida, no cronometrada». La carta lo dice en su explicación y lleva fuente, así que se
mantiene, pero hay una elección pendiente:

1. **Dejarlo.** El águila encabeza el mazo con una cifra de referencia honestamente etiquetada.
2. **Pasarla también a revisión.** Entonces encabeza el **halcón gerifalte con 209 km/h**, que es
   el mejor picado realmente medido del mazo (seguimiento óptico de once picados).

La segunda es más coherente con el criterio nuevo. Tiene el coste de que el peregrino deje de
ser el animal más rápido de la baraja, que es lo que todo el mundo espera.

### Inventario: 40 cartas con marco de récord

Aplicar el criterio hacia atrás no es trivial. Hoy hay **40 de 114 cartas** enmarcadas como
récord, extremo o ejemplar concreto: 12 en Peso, 21 en Longevidad y 7 en Velocidad. Se agrupan
en tres tipos que no admiten el mismo trato:

- **Límites de rango publicados** («hasta», «límite del rango»): 20 cartas. Convertibles a un
  valor central cuando la fuente da el rango entero.
- **Ejemplares con nombre** (Ming, Aura, Jonathan, Old Billy, Cookie, Winning Brew, Usain Bolt):
  convertibles solo si existe una cifra típica publicada para la especie.
- **Dataciones de un individuo o una colonia** (Monorhaphis, corales, esponja de Curaçao,
  ballena boreal, tiburón de Groenlandia): **no tienen equivalente típico**. La edad del
  ejemplar datado *es* el hallazgo científico; no existe «la longevidad media de un coral negro».
  Para estas, el criterio de medias obliga a elegir entre conservarlas etiquetadas o retirar el
  animal del mazo.

### Integridad

- 38 cartas por mazo y 933 identificadores, sin cambios.
- `npm test` pasa 344 comprobaciones. Techos a 29 mudas y 7 avisos.
- La caché pasa a `continuum-v44`. Cambian cuatro velocidades, una de ellas la más alta del
  mazo: conviene empezar partidas nuevas de Naturaleza.

## Ronda 10: si el dato no está atado, fuera la carta (1 de septiembre de 2026)

Decisión del autor: **si la veracidad y la oficialidad del dato no están atadas, se quita el
concepto.** Se aplica. El resultado es que **`reviewStatus` queda a cero**: ya no se publica
ninguna carta avisada; o tiene fuente o no está en el mazo.

Restricción que condiciona todo: cada mazo necesita **38 cartas** para repartir a nueve
jugadores. Cada baja obliga a un alta documentada. No se puede solo quitar.

### Siete cartas fuera, siete dentro

| Fuera | Por qué | Dentro | Fuente |
|---|---|---|---|
| Caracol de jardín, 0,03 km/h | Iba 3,5 veces más rápido que el récord de la especie | Escarabajo tigre, **9 km/h** | Guinness, insecto terrestre más rápido |
| Babosa, 0,05 km/h | Sin especie ni cifra | Cangrejo fantasma, **14,4 km/h** | Guinness, crustáceo terrestre más rápido |
| Panda gigante, 1 km/h | Sin fuente para su marcha | Mamba negra, **19 km/h** | Guinness, serpiente terrestre más rápida |
| León africano, 78 km/h | Tres fuentes irreconciliables (53, GPS variable, 80 sin procedencia) | Iguana espinosa, **34,9 km/h** | Guinness, reptil terrestre más rápido |
| Caracol marino, 0,46 km/h | Sin especie ni cifra | León marino de California, **40 km/h** | Guinness, mamífero marino más rápido |
| Cangrejo de río, 0,75 km/h | Sin cifra documentada | Cebra (huida), **64 km/h** | San Diego Zoo, más de 40 mph |
| Cebra de llanura, 350 kg | Se le habían dado los kilos de la de Grevy | Cebra de Grevy, **400 kg** | San Diego Zoo, rango 350–450 |

Además, la tortuga gigante pasa de 0,13 a **0,37 km/h**, el récord Guinness de lentitud entre
los quelonios, y deja de ser una muda.

Sobre el criterio de medias: estos siete altas son **récords de grupo**, no ejemplares con
nombre. «El insecto terrestre más rápido» es una medida de especie, que es la comparable
natural en un mazo de velocidad; no es Usain Bolt. La distinción importa y se mantiene.

### La cebra: el error se explica solo

La carta de peso decía «cebra de llanura, 350 kg». San Diego Zoo describe la de llanura como la
**más pequeña** de las tres especies y da 350–450 kg para la de **Grevy**, la mayor. Alguien
tomó los kilos de una especie y les puso el nombre de otra. Se corrige poniendo el nombre que
corresponde a la cifra publicada, y se ordena por el centro del rango, no por su extremo.

### El aviso «en revisión» queda apagado

Con cero pendientes, el mecanismo de aviso deja de encenderse. Se conserva en el código como
red de seguridad, pero **el techo del test baja a cero**: si alguna carta vuelve a marcarse,
la prueba falla. La prueba de accesibilidad, que antes comprobaba que el aviso aparecía en el
mazo que tuviera pendientes, ahora comprueba lo contrario en los tres mazos.

### Estado

| | Ronda 6 | Ahora |
|---|---:|---:|
| Con fuente | 53 | **86** |
| Sin fuente y sin aviso | 57 | **28** |
| En revisión | 4 | **0** |

Por mazo: Peso 30 con fuente y 8 mudas; Longevidad 26 y 12; Velocidad 30 y 8.

### Los dos outliers que quedan, y por qué no salen todavía

Bajo el criterio de medias siguen sobrando dos cartas, las dos de ejemplar con nombre:

- **Ser humano: Usain Bolt (44,7 km/h)**
- **Caballo Winning Brew (70,35 km/h)** — que además está a un 0,5 % del avestruz, o sea que
  ese par se juega a cara o cruz.

No salen en esta ronda por un motivo concreto: hacen falta **dos velocidades de especie
documentadas que no apelmacen la banda de 55 a 70 km/h**, y las cuatro candidatas encontradas
caen todas dentro de un 7 % de una carta vecina: hiena manchada 60, canguro rojo 56, facóquero
55 y coyote 72,4. Quitarlas sin recambio dejaría el mazo en 36 cartas y rompería el reparto a
nueve jugadores. Queda pendiente de encontrar dos huecos limpios.

### Lo que queda por documentar

28 mudas: 8 en Peso (abeja, monarca, mantis, rana arborícola, paloma, caballo de silla, tiburón
ballena y cachalote), 12 en Longevidad y 8 en Velocidad (hormiga roja, lapa, cangrejo araña,
topo, cangrejo ermitaño, cucaracha, gallina y erizo).

Las 8 de Velocidad son el bloque difícil y conviene decirlo pronto: **son invertebrados y
animales pequeños para los que ninguna institución publica una velocidad por especie**. Si el
criterio se aplica hasta el final, no se pueden documentar y hay que sustituirlas, lo que exige
ocho velocidades documentadas más. Puede que el mazo de Velocidad no dé para 38 cartas con
dato atado y haya que decidir qué hacer con él.

### Integridad

- 38 cartas por mazo y 933 identificadores: las bajas reutilizan el identificador de la carta
  que sustituyen, así que la numeración no se mueve.
- `npm test` pasa 345 comprobaciones. Techos a 28 mudas y **0 avisos**.
- La caché pasa a `continuum-v45`. Cambian siete cartas de golpe: hay que empezar partidas
  nuevas de Naturaleza.

## Ronda 11: el resto, y por qué se para aquí (1 de septiembre de 2026)

Se cierra el cachalote y la deuda queda en **27 mudas de 114 cartas**. Pero lo importante de
esta ronda no es la carta que entra, sino que las 27 que quedan ya no son un resto cualquiera:
tienen todas la misma forma, y conviene decir cuál antes de seguir gastando esfuerzo.

### Lo cerrado

**Cachalote: 50.000 → 40.800 kg.** NOAA da machos de unos 52 pies y casi 45 toneladas cortas,
frente a las 15 toneladas de las hembras. Queda **empatado con la ballena gris**, porque NOAA
da a las dos la misma cifra: 45 toneladas cortas son exactamente 90.000 libras. Es un empate
real, no un descuido, y los motores lo aceptan en los dos órdenes.

### Las 27 que quedan tienen todas la misma pinta

| Mazo | Quedan | Qué son |
|---|---:|---|
| Peso | 7 | abeja, monarca, mantis, rana arborícola, paloma, caballo de silla, tiburón ballena |
| Longevidad | 12 | mosquito, mosca de la fruta, abeja obrera, conejo, ardilla, zorro, perro, gato, águila harpía, elefante, ballena azul, tortuga de Galápagos |
| Velocidad | 8 | hormiga, lapa, cangrejo araña, topo, cangrejo ermitaño, cucaracha, gallina, erizo |

Son **animales pequeños, domésticos o muy corrientes**. Y ese es justo el problema: las
instituciones publican fichas de las especies carismáticas, amenazadas o espectaculares. Nadie
publica cuánto pesa una mantis, a qué velocidad anda una lapa o cuántos años vive una mosca de
la fruta, porque no hay ninguna razón institucional para hacerlo.

En esta ronda se consultaron, sin éxito y con búsqueda restringida al dominio: los campos de
longevidad de Animal Diversity Web (no aparecen en los resúmenes), las fichas de San Diego Zoo
para águila harpía y elefante, All About Birds de Cornell para la paloma, los CDC para el
mosquito y Georgia Aquarium para el tiburón ballena. Solo el tiburón ballena devolvió cifra
—20,6 toneladas «como mucho»— y es un máximo, no el valor típico que pide el criterio.

### Lo que esto significa para el criterio

El criterio es «si no está atado, fuera la carta». Aplicado a estas 27:

- **Peso y Longevidad aguantan.** Son 7 y 12 sobre 38. Sustituirlas por especies documentadas
  es trabajo, pero hay candidatas: el mundo está lleno de mamíferos y aves con ficha.
- **Velocidad no aguanta bien.** Sus 8 mudas son invertebrados y animales pequeños, y ya se
  gastaron seis de las siete altas disponibles en la ronda anterior. Los récords de grupo de
  Guinness —el insecto, el crustáceo, el reptil, la serpiente, el mamífero marino más rápidos—
  están **agotados**: eran la veta y ya se ha usado.

Hay además dos ejemplares con nombre que el criterio de medias sigue rechazando y que no han
podido salir: **Usain Bolt** y el **caballo Winning Brew**, este a un 0,5 % del avestruz.

### Las tres decisiones que quedan sobre la mesa

1. **Velocidad.** Con la veta agotada, llevar el mazo a 38 cartas documentadas exige encontrar
   ocho velocidades más de especies que no apelmacen las bandas ya ocupadas. Puede no existir.
   Las salidas son: aceptar el mazo con menos ambición, rehacerlo con otro criterio, o retirarlo.
2. **Bolt y Winning Brew.** Salen en cuanto aparezcan dos velocidades de especie limpias.
3. **La ballena gris.** Sigue ordenando por un «llega a pesar» de NOAA, que es un máximo. Bajo
   el criterio de medias necesitaría un valor típico que no se ha encontrado.

### Integridad

- 38 cartas por mazo, 933 identificadores, cero cartas avisadas.
- `npm test` pasa 345 comprobaciones. Techo de mudas a 27.
- La caché pasa a `continuum-v46`.
