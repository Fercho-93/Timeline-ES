# Verificación del mazo de cine

Fecha de revisión: 25 de agosto de 2026.

## Resultado

- 87 películas revisadas una a una.
- 87 identificadores, títulos y **años únicos**: no hay dos cartas que compartan año.
- Ninguna carta sin año, título o explicación.
- Periodo cubierto: de 1902 a 2024.
- Reparto por décadas: 1900 (1), 1920 (3), 1930 (5), 1940 (5), 1950 (9), 1960 (9), 1970 (10),
  1980 (10), 1990 (10), 2000 (10), 2010 (10), 2020 (5).
- Cine español o coproducido en España: 13 títulos, de *¡Bienvenido, Míster Marshall!* (1953) a
  *As bestas* (2022).

## Qué cambió respecto al mazo anterior

El mazo previo tenía 100 películas del top de IMDb con 30 años repetidos y hasta cinco títulos
en un mismo año, lo que convertía muchas jugadas en una moneda al aire: colocar bien una carta
entre dos estrenos del mismo año depende del azar, no de lo que sabes. Además empezaba en 1931,
así que la categoría «Cine pionero» del propio juego no llegaba a aparecer nunca y la portada
prometía «de Méliès a nuestros días» sin ninguna película muda.

Ahora cada año aparece una sola vez. Cuando varios títulos competían por el mismo año se
conservó el más conocido: 1994 se queda con *El rey león* (frente a *Pulp Fiction*, *Forrest
Gump* o *Cadena perpetua*), 1972 con *El padrino*, 1993 con *Parque Jurásico*.

## Criterio de selección

1. Películas muy conocidas o conocidas para un público general español; nada de rarezas de
   cinéfilo.
2. Año de estreno asentado y fácil de comprobar. Se evitaron los casos con fecha discutible
   (festival un año, salas al siguiente, o estreno internacional escalonado).
3. Reparto equilibrado por décadas, sin el amontonamiento en los años noventa del mazo anterior.
4. Presencia estable del cine español a lo largo de todas las épocas, no solo en la actual.

## Fechas comprobadas con matiz

- **Casablanca (1942):** se toma el estreno de Nueva York, de noviembre de 1942; el estreno
  general estadounidense fue en 1943.
- **El bueno, el feo y el malo (1966):** año del estreno italiano; llegó a Estados Unidos en 1967.
- **Titanic (1997) y El exorcista (1973):** estrenos de diciembre, muy cerca del cambio de año.
- **La La Land (2016):** presentada en Venecia y estrenada en Estados Unidos en 2016; en España
  llegó en enero de 2017.
- **Soul (2020):** estreno directo en streaming en diciembre de 2020 por el cierre de las salas.
- **El laberinto del fauno (2006):** coproducción hispano-mexicana dirigida por Guillermo del Toro.

## Comprobación automática

`node tests/partidas-al-azar.mjs` juega también con este mazo y verifica en cada turno que la
línea temporal queda ordenada por año y que no se pierde ni se duplica ninguna carta.
