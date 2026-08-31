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
