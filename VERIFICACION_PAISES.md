# Verificación del mazo de superficies

Fecha de revisión: 25 de agosto de 2026.

## Resultado

- 59 países revisados uno a uno, con la superficie total en km².
- 59 identificadores, títulos y valores únicos.
- Rango: de 17.098.246 km² (Rusia) a 0,49 km² (Ciudad del Vaticano).
- **Separación mínima entre cartas contiguas: 8%** (Afganistán y Ucrania). El resto está más
  separado, y la mayoría por encima del 15%.

## Por qué faltan países muy conocidos

El mazo se construyó al revés de lo habitual: primero los países que cualquiera espera encontrar
y después descartando los que quedaban demasiado cerca de otro ya elegido. Un par de cartas que
se diferencian en un 2% no se puede razonar, solo acertar por suerte, y eso es justo lo que
estropeaba el mazo de cine antes de rehacerlo.

Ausencias que llaman la atención, con su motivo:

- **China y Canadá:** ambos a menos de un 3% de Estados Unidos (9,83 · 9,60 · 9,98 millones de km²).
- **Alemania:** a un 5% de Japón.
- **Francia sí está**, pero obligó a ajustar España, que queda a un 9%.
- **Suecia y Noruega:** chocaban con Marruecos y Finlandia respectivamente.
- **Chile, Colombia, Perú, Países Bajos, Dinamarca, Polonia, Austria:** todos a menos de un 8% de
  alguna carta ya incluida.

También se dejaron fuera países pequeños poco conocidos para el público general (Kiribati, Santo
Tomé y Príncipe, San Cristóbal y Nieves, Islas Marshall…), con el mismo criterio que en el mazo
de cine: ni rarezas ni cartas imposibles de situar.

## Fechas y cifras con matiz

- **Francia (551.695 km²):** es la Francia metropolitana. Con los territorios de ultramar supera
  los 640.000 km², y se dice en la propia carta.
- **Marruecos (446.550 km²):** sin el Sáhara Occidental, cuyo estatus sigue sin resolverse.
- **Estados Unidos (9.833.517 km²):** superficie total, con aguas interiores incluidas.
- **Irlanda (70.273 km²):** solo la República; Irlanda del Norte no cuenta.
- **Singapur y Mónaco:** ganan terreno al mar, así que su superficie crece poco a poco.

## Comprobación automática

`node tests/mazos.mjs` verifica en cada cambio que no haya identificadores, títulos ni
superficies repetidas, que ninguna carta esté a menos de un 8% de otra y que el mazo tenga
cartas suficientes para nueve jugadores.
