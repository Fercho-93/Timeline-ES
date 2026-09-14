# Verificación del mazo de superficies

Fecha de revisión de datos: 25 de agosto de 2026. Revisión visual de ilustraciones: 14 de
septiembre de 2026.

## Resultado

- 72 países y territorios revisados uno a uno, con la superficie total en km².
- 72 identificadores, títulos y valores únicos.
- Rango: de 0,49 km² (Ciudad del Vaticano) a 17.098.246 km² (Rusia). La línea se ordena de menor
  a mayor, igual que la del tiempo avanza de lo antiguo a lo reciente.
- La selección prioriza cartas distinguibles, aunque ya no se exige un margen porcentual mínimo
  entre valores contiguos.

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
- Otros países se omiten cuando quedan demasiado próximos a una carta ya incluida o aportan poca
  variedad al mazo.

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
superficies repetidas y que el mazo tenga cartas suficientes para nueve jugadores.

`node tests/referencias-paises.mjs` comprueba que las 72 cartas tienen una lámina WebP única y
que las 25 asociaciones corregidas en la revisión visual no vuelven a intercambiarse por error.

## Revisión visual de ilustraciones

Se contrastaron las 72 láminas de `assets/country-cards/` con el ID y el título declarados en
`countries.js`. Se corrigieron 25 archivos que estaban asociados a otro país: India, Argentina,
Kazajistán, Argelia, Indonesia, Irán, Egipto, Nigeria, Turquía, Chile, Afganistán, Ucrania,
Francia, Reino Unido, Uganda, Suiza, Bélgica, Israel, Eslovenia, Catar, Líbano, Luxemburgo,
Mauricio, Panamá y Sri Lanka.
