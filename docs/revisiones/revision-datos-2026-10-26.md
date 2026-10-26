# Correcciones de datos del 26 de octubre de 2026

Arreglos de la auditoría de incoherencias (bloque de datos que el jugador nota). No cierra carta a
carta ningún mazo: eso sigue en [AUDITORIA_MAZOS.md](../AUDITORIA_MAZOS.md).

## Cartas corregidas

| Carta | Antes | Ahora | Motivo |
| --- | --- | --- | --- |
| `quick` wwii-7 · Armisticio de Italia | lámina de la estación | lámina de la firma | Las láminas de wwii-7 y wwii-14 estaban cruzadas: se intercambian los ficheros (y sus huellas en `inventario-arte.json`). |
| `quick` wwii-14 · Rendición de Italia → Entrada aliada en Nápoles | 8-9-1943 | 1-10-1943 | «Rendición de Italia» era el anuncio del mismo armisticio, con otra fecha. La carta pasa a un hito distinto que encaja con su lámina (tropas aliadas entre civiles en una ciudad italiana). |
| `speed` 13008 · Mamba negra | 18 km/h | 17,5 km/h | Su explicación usa el punto medio del rango de Guinness, 17,5; con 18 empataba con el cerdo doméstico. |
| `speed` 13002 · Cangrejo fantasma | 14 km/h | 14,4 km/h | La explicación da 14,4 km/h (4 m/s). |
| `speed` 13034 · Cebra común → Cebra de Grevy | Equus quagga, Sydney Zoo | Equus grevyi, SeaWorld (40 mph ≈ 64 km/h) | La carta llevaba la lámina de la cebra de Grevy, la misma especie que la carta de peso. No hay lámina de la cebra común. |
| `quick` companies-founded-1 · Coca-Cola | 1892 | 1886 | El reto fecha por el origen del negocio (Nintendo 1889, Nokia 1865), como la carta de Inventos; la nota explica que la compañía se constituyó en 1892. |
| `countries` 2072 · Nueva Caledonia | en el mazo | retirada | Es un territorio no autónomo, no un país; el mazo es «Superficie de países». Sale también su lámina. Las partidas guardadas llevan su propio mazo y siguen valiendo. |
| Longevidad · formato | «1 años», «1 mes», «3 meses» | «1 año», «6 semanas», «80 días» | Por debajo de unos tres meses se cuenta en días, o en semanas si el dato es un número exacto de ellas; la abeja (seis semanas) y la mosca de la fruta (80 días) enseñaban otra cifra que su carta. |

Las fuentes y la nota de criterio de los dos cambios de Retos rápidos quedan registradas en
[fuentes-correcciones-2026-10-26.json](../fuentes-correcciones-2026-10-26.json).

## Explicaciones que daban el año de otra carta

Una carta colocada se puede girar y leer mientras las demás siguen en juego. Se reescriben sin la
cifra: Trienio Liberal (Constitución de 1812), primeras elecciones (1936), guerras cántabras y
Emerita Augusta (19 a. C.), guerra de Cuba (1898), Billie Jean (Thriller, 1982), Galileo (1610)
y Ceres (2006). Por coincidencia de año,
también El resplandor, Regreso al futuro, El silencio de los corderos, Titanic, Parásitos, In the
End, The Legend of Zelda, Rutherford, la invasión de Ucrania y LIGO. `tests/mazos.mjs` lo comprueba
ahora en todos los mazos de tiempo. Fernando VII, en Reyes de España, sigue citando 1808 (el año
de la carta de José I): depende del criterio de fecha de ese reto, pendiente de decidir.

## Notas de revisión retiradas de las explicaciones

Las explicaciones contaban al jugador cambios de versiones anteriores del mazo; la del solífugo,
además, decía que la gallina no tenía cifra cuando la gallina sigue en el mazo. Se quitan de la
carta y quedan aquí:

| Carta | Nota retirada |
| --- | --- |
| `animals` 10009 · Liebre europea | Antes valía 2,5 kg, una cifra sin respaldo. |
| `animals` 10022 · Cebra de Grevy | Sustituye a la cebra de llanura, la más pequeña, a la que se le habían asignado los 350 kg de la de Grevy. |
| `lifespan` 12020 · Águila harpía (referencia media) | Antes valía 36 años, presentados como longevidad típica. |
| `speed` 13001 · Escarabajo tigre (carrera en tierra) | Sustituye al caracol de jardín, cuya cifra superaba ese récord. |
| `speed` 13002 · Cangrejo fantasma (carrera en tierra) | Sustituye a la babosa, que nunca tuvo cifra documentada. |
| `speed` 13009 · Pingüino papúa (nadando) | Sustituye al pingüino emperador en tierra, cuya marcha no tenía medición localizable. |
| `speed` 13011 · Cangrejo ermitaño (media medida en playa) | Los 4,6 km/h anteriores lo hacían veinte veces más rápido de lo medido. |
| `speed` 13012 · Solífugo (esprint en tierra) | Sustituye a la gallina doméstica, sin cifra publicada. |
| `speed` 13013 · Libélula australiana (vuelo) | Sustituye al erizo europeo. |
| `speed` 13015 · Hipopótamo común (carga en tierra) | Los 30 km/h anteriores no tenían respaldo. |
| `speed` 13016 · Elefante (máximo fiable registrado) | Los 45 km/h anteriores no tenían respaldo. |
| `speed` 13019 · Iguana espinosa (esprint en tierra) | Sustituye al león africano, cuyas fuentes se contradecían entre 53 y 80 km/h. |
| `speed` 13022 · Ñu azul (huida) | Los 120 km/h anteriores no tenían respaldo. |
| `speed` 13025 · Cangrejo nadador de Henslow (nadando) | Sustituye a la punta de Usain Bolt, que era un ejemplar concreto. |
| `speed` 13029 · Vencejo común (vuelo horizontal medido) | Sustituye al halcón sacre, sin medición publicada. |
| `speed` 13031 · Hormiga plateada del Sáhara (carrera) | Sustituye a la hormiga roja, sin cifra documentada. |
| `speed` 13032 · Lapa (media de desplazamiento medida) | Los 0,17 km/h anteriores la hacían casi quinientas veces más rápida. |
| `speed` 13033 · León marino de California (velocidad media estimada) | Sustituye al caracol marino, que no tenía ni especie ni cifra documentada. |
| `speed` 13035 · Araña flic-flac de Marruecos (huida) | Sustituye al cangrejo araña, sin velocidad publicada. |
| `speed` 13023 · Berrendo americano (carrera, referencia NPS) | Antes valía 138 km/h. |
| `speed` 13028 · Halcón gerifalte (picado medido) | Antes valía 275 km/h. |
