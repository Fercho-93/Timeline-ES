# Borrador de revisión: las 17 cartas de Naturaleza «en revisión»

**Estado: BORRADOR SIN VERIFICAR. No se ha tocado `animals.js`, `lifespan.js`, `speed.js` ni `reviewStatus`.**

## Por qué es un borrador y no un cierre

Esta investigación se hizo en un entorno donde el acceso directo a las fuentes primarias
(Animal Diversity Web, PMC/NCBI, Monarch Watch, Cornell, NOAA Fisheries, e incluso Wikipedia)
estaba bloqueado por la política de red de la sesión. Solo se pudo usar una herramienta de
búsqueda que devuelve resúmenes generados por IA, los cuales **mezclan sin avisar fuentes
serias con webs de compilación** (AZ Animals, blogs de mascotas, TikTok) — exactamente el tipo
de fuente que `VERIFICACION_CORRECCIONES.md` lleva catorce rondas rechazando por propagar
errores de conversión.

Por tanto, ninguna de las citas siguientes debe tratarse como equivalente a las de las cartas
10004 o 12005 (que citan una frase textual verificada de un artículo con DOI). Son **candidatas**
que alguien con acceso a la fuente original debe abrir, leer y confirmar palabra por palabra
antes de escribir nada en el código o en `CONTENIDO_Y_DERECHOS.md`.

## Cómo leer la tabla

- **Candidato solvente**: la institución u organismo citado (ADW, CDC, NOAA, Mammal Society,
  un estudio con PMC/DOI) es del nivel que el proyecto acepta, pero la cita exacta no se pudo
  leer directamente — hay que abrir el enlace y transcribirla.
- **Sin fuente de calidad**: lo único que devolvió la búsqueda son compilaciones no aptas
  (AZ Animals, blogs, vídeos). Sigue sin resolverse.
- **Valor actual en duda**: las fuentes consultadas, aun sin confirmar palabra por palabra,
  apuntan a un número distinto del que usa la carta hoy. Prioridad alta de revisión manual.

| ID | Carta | Valor actual | Candidato hallado | Estado | Fuente a abrir y confirmar |
|---|---|---|---|---|---|
| 10001 | Abeja melífera (obrera) | 100 mg | ~90–110 mg, obrera | Candidato solvente | [ADW Apis mellifera](https://animaldiversity.org/accounts/Apis_mellifera/); estudio morfométrico PMC7895409 |
| 10002 | Mariposa monarca | 0,5 g | ~0,5 g (rango 0,25–0,75 g según estado) | Candidato solvente, pero con cifras contradictorias entre páginas del propio FWS | [US Fish & Wildlife Service](https://www.fws.gov/species/monarch-danaus-plexippus); [Monarch Joint Venture](https://monarchjointventure.org/monarch-biology/vital-statistics-and-measuring); [Monarch Watch](https://monarchwatch.org/class/size-mass.html) |
| 10003 | Mantis religiosa | 2 g | 4–5 g (fuente floja) | **Sin fuente de calidad** | No se encontró ADW ni artículo con cifra exacta y verificable. El único paper con datos de masa (PMC3338837, riesgo de apareamiento) no pudo abrirse para confirmar si mide adultos comparables |
| 10007 | Paloma bravía | 350 g | 243–359 g según muestra; medias de 346,9–358,7 g (estudio de Kansas citado en ADW) | Candidato solvente | [ADW Columba livia](https://animaldiversity.org/accounts/Columba_livia/) |
| 10023 | Caballo doméstico | 500 kg | 410–545 kg para caballos de silla | **Sin fuente de calidad** — solo webs comerciales de equitación, ninguna extensión universitaria ni registro de raza | Buscar una fuente tipo FAO, extensión agrícola universitaria o sociedad de una raza concreta |
| 10031 | Tiburón ballena | 9 t | Entre 9 y 21,5 t según la fuente, sin consenso claro | **Sin fuente de calidad** — alta dispersión, ninguna cifra atribuible directamente a NOAA o IUCN con un número puntual | Revisar la ficha de NOAA Fisheries o el assessment de IUCN directamente |
| 12003 | Mosquito común (fase adulta) | 0,04 años (~2 semanas) | Macho ~1 semana; hembra 2–4 semanas | Candidato solvente | CDC / American Mosquito Control Association — buscar la página exacta y su cifra |
| 12004 | Mosca de la fruta (fase adulta) | 0,065 años (~3,4 semanas) | ~30 días en condiciones estándar de laboratorio | Candidato solvente | [AnAge / genomics.senescence.info, Drosophila melanogaster](https://genomics.senescence.info/species/entry.php?species=Drosophila_melanogaster) |
| 12012 | Conejo europeo (en libertad) | 2,5 años | Mammal Society: máximo 3 años; récord documentado 7,6 años (Sudáfrica/Australia, outlier) | Candidato solvente | [Mammal Society, European rabbit](https://mammal.org.uk/british-mammals/european-rabbit); AnAge |
| 12014 | Ardilla roja | 6,5 años | ~6 años (Mammal Society y Wildlife Trusts coinciden) | Candidato solvente, valor actual ya es coherente | [Mammal Society, red squirrel](https://mammal.org.uk/british-mammals/red-squirrel) |
| 12015 | Zorro rojo (ejemplar longevo) | 10 años | Récord fiable por anillamiento real (no solo desgaste dental): 12 años, hembra marcada en 1981 y hallada en 1993 en los Países Bajos | Candidato solvente — y **mejor que el valor actual**, porque tiene método de verificación (anillamiento) en vez de estimación por desgaste dental | [Wildlife Online, Red Fox Longevity](https://www.wildlifeonline.me.uk/animals/article/red-fox-longevity) |
| 12016 | Perro doméstico | 13 años | Estudios veterinarios recientes (Reino Unido): mediana 12,5 años (2024, ~585.000 historiales) o media 11,2 años (estudio de 30.000 perros) | Candidato solvente, cifra actual ya es coherente | Buscar PMC9050668 y PMC6191922 y confirmar la cifra exacta y la metodología |
| 12017 | Gato doméstico (de interior) | 17 años | Estudio 2024 (Journal of Feline Medicine and Surgery, ~8.000 gatos, incluye exteriores): 11,7 años; UC Davis: 10–15 años para gatos de interior | **Valor actual en duda** — 17 parece alto frente a los estudios con metodología declarada | Confirmar el estudio JFMS 2024 y separar si distingue interior/exterior |
| 12020 | Águila harpía | 36 años | Consenso de zoológicos (LA Zoo, San Diego Zoo, PBS): 25–35 años en libertad y en cautividad bien gestionada | **Valor actual en duda** — ligeramente por encima del rango hallado | Confirmar cifra de San Diego Zoo Wildlife Alliance o IUCN |
| 12023 | Elefante africano | 72 años | Estudio de Amboseli (Kenia, publicado en *Science*): esperanza de vida media de 41 años para hembras que llegan a edad reproductiva; mediana de supervivencia de 56 años en otra formulación del mismo estudio | **Valor actual en duda, revisión prioritaria** — 72 no aparece en ninguna fuente consultada; puede confundirse con una edad máxima registrada de un individuo, no con la esperanza de vida típica | [PMC4748003, longevity in wild female African elephants](https://pmc.ncbi.nlm.nih.gov/articles/PMC4748003/); [African Wildlife Foundation](https://www.awf.org/news/elephants-live-longer-wild-study-shows) |
| 12024 | Ballena azul (límite del rango típico) | 90 años | NOAA Fisheries: 80–90 años | Candidato solvente, valor actual ya es coherente (límite superior) | [NOAA Fisheries, Blue Whale](https://www.fisheries.noaa.gov/species/blue-whale) |
| 13036 | Topo europeo | 3,5 km/h | Sigue sin fuente primaria fiable — todo lo hallado remonta a la misma cadena de fuentes ya rechazada en `VERIFICACION_CORRECCIONES.md` (incluida una entrada de un wiki marcada explícitamente «NOT Peer Reviewed» y un vídeo de TikTok) | **Sin resolver, sin cambios respecto al análisis ya publicado** | Ninguno nuevo. Sigue pendiente de quien tenga acceso físico a Gorman & Stone (1990), *The Natural History of Moles* |

## Casos que merecen prioridad si alguien retoma esto con acceso a las fuentes

1. **Elefante africano (12023)**: la brecha entre el valor actual (72) y lo hallado (41–56) es la más grande de las 17. Es el primer caso a cerrar.
2. **Gato doméstico (12017)** y **águila harpía (12020)**: ambos valores actuales están por encima de lo que sugieren fuentes razonablemente serias; candidatos a corrección a la baja.
3. **Zorro rojo (12015)**: aquí la fuente candidata no solo confirma el valor actual, sino que ofrece un método de verificación mejor (anillamiento) que el que probablemente sostiene la cifra actual. Vale la pena aunque no sea el número el que cambie.
4. **Mantis religiosa (10003)**, **caballo doméstico (10023)** y **tiburón ballena (10031)**: no se encontró ninguna fuente de la calidad que exige el proyecto. Seguirán "en revisión" hasta que alguien busque con acceso a ADW, IUCN o literatura específica.
5. **Topo europeo (13036)**: sin novedad; requiere el libro físico o una base de datos científica no accesible por búsqueda web genérica.

## Siguiente paso

Ninguna cifra de esta tabla debe copiarse a `animals.js`, `lifespan.js` o `speed.js` sin que
alguien abra el enlace, lea la cita exacta (población, sexo o condición, unidad, criterio) y la
transcriba como se hizo con las cartas 10004 y 12005. Cuando eso ocurra, seguir el proceso ya
documentado: actualizar la carta, añadir la entrada en `docs/revision-editorial.md`, regenerar
`docs/catalogo-fuentes.json` con `node scripts/audit-content.mjs --write` y correr `npm test`.
