# Borrador del mazo «Idiomas por hablantes»

**Estado: BORRADOR SIN CIFRAS. No se ha creado `idiomas.js` ni se ha tocado `modes.js`,
`index.html`, `service-worker.js` ni las pruebas.**

Este documento fija todo lo que se puede fijar sin la tabla de datos: la métrica, los
convenios editoriales, el método de selección, el diseño del eje y la lista de archivos que
hay que tocar. Falta lo único que no puede inventarse: las cifras.

## Por qué es un borrador y no un mazo

La sesión en la que se redactó tenía bloqueado por la política de red el acceso directo a
cualquier página: `ethnologue.com`, `cia.gov`, `en.wikipedia.org` y `wal.unesco.org` devolvieron
todos el mismo error del proxy de salida. Lo único disponible fue una herramienta de búsqueda
que devuelve resúmenes generados por IA a partir de blogs de academias de idiomas y agencias de
traducción.

Esos resúmenes ya se contradicen entre sí en el primer intento: el portugués aparece con 264 y
con 279 millones de hablantes totales, y el urdu con 232 y con 246, según qué página haya
resumido el buscador. Construir cuarenta y cinco cartas con eso sería exactamente el problema
que `VERIFICACION_CORRECCIONES.md` lleva catorce rondas persiguiendo: cifras heredadas de
compilaciones, sin corte temporal común y sin forma de rastrear de dónde salió cada una.

**Ninguna cifra vista en esa búsqueda se ha copiado aquí, ni siquiera como orientación.** Un
número aproximado escrito en un borrador acaba, tarde o temprano, dentro de una carta.

## Decisiones ya tomadas

| Decisión | Elección |
|---|---|
| Métrica | **Hablantes totales** (nativos + segunda lengua), no solo nativos |
| Corte temporal | **Uno solo para todas las lenguas**: una única edición de una única tabla |
| Bloque | **Geografía**, como cuarto juego junto a superficie, población y distancias |
| Arte | **Sin arte** en esta tanda: vista tipográfica, como videojuegos hasta que se completó su lote |

La métrica elegida es la que promete el título del mazo —lo que la gente espera al oír «idiomas
más hablados del mundo»— y es también la más blanda: las estimaciones de segunda lengua varían
en cientos de millones entre fuentes. Por eso el corte único no es un detalle de estilo, sino la
condición que hace jugable el mazo: dos cifras de ediciones distintas pueden invertir el orden
de dos cartas contiguas.

## Qué fuente hace falta

Se necesita **una sola tabla, con una sola fecha de corte, que cubra todas las lenguas del
mazo**. Ese requisito descarta casi todo:

- **Ethnologue (SIL International), edición 28 (2025).** Es la única tabla que cumple el
  requisito: mismo método, misma fecha, L1 y totales para las 200 lenguas más habladas. Es la
  fuente que citan, de segunda mano, casi todas las demás. Problemas: el conjunto de datos se
  vende por 249 USD y el dominio estaba bloqueado en esta sesión.
- **UNESCO, World Atlas of Languages.** Oficial (organismo de la ONU) y gratuito, pero sus
  cifras las aportan gobiernos y oficinas nacionales de estadística con metodologías y fechas
  distintas. Incumple el corte único.
- **CIA World Factbook.** Dominio público y sin restricciones de reutilización, pero a nivel
  mundial solo publica el porcentaje de la población mundial de unas diez lenguas. Insuficiente
  para cuarenta y cinco cartas.
- **Censos nacionales e institutos de estadística.** Oficiales, pero cada uno con su año y su
  definición de hablante. Sirven para matizar una carta concreta, nunca para ordenar la línea.
- **Anuario del Instituto Cervantes.** Fuente oficial española y muy citable para el español,
  pero su tabla comparativa procede a su vez de Ethnologue y cubre pocas lenguas.

**Conclusión:** o se trabaja sobre Ethnologue, o no hay mazo con corte único. Las alternativas
gratuitas no son peores por ser gratuitas: es que miden otra cosa.

### Antes de copiar la tabla, mirar los derechos

Una cifra aislada es un hecho y no se protege por derecho de autor, pero extraer cuarenta y
cinco de las doscientas filas de una base de datos comercial puede entrar en el derecho *sui
generis* de bases de datos del ordenamiento europeo. No es una conclusión de infracción —es el
mismo criterio que `CONTENIDO_Y_DERECHOS.md` aplica al arte— pero conviene resolverlo antes de
publicar, no después. Si se compra el conjunto de datos, sus condiciones de uso mandan.

## Convenios editoriales que hay que fijar antes de escribir cartas

El orden del mazo depende de decisiones de clasificación tanto como de las cifras. Cada una
debe quedar escrita en la carta afectada, no solo aquí.

1. **Macrolenguas.** Hay que elegir un convenio y aplicarlo siempre: árabe (¿estándar moderno o
   la suma de las variedades habladas?), chino (¿mandarín como lengua propia, con el wu y el
   cantonés como cartas aparte?), hindi y urdu (¿dos cartas o un hindustaní?), malayo e
   indonesio, persa (farsi, darí, tayiko), panyabí oriental y occidental.
2. **Segunda lengua.** Qué cuenta como hablante de segunda lengua es lo que separa al inglés del
   chino en la cabecera del mazo. La carta del inglés debe decirlo con todas las letras.
3. **Exclusiones.** Lenguas de signos (no comparables en esta escala), lenguas construidas
   (esperanto), lenguas litúrgicas o sin comunidad nativa (latín). Se excluyen por coherencia de
   la medida, y el motivo se anota aquí, no se deja implícito.
4. **Tono.** El tramo bajo del mazo son lenguas cooficiales y minorizadas. Se aplica el criterio
   de `VERIFICACION_HISTORICA.md`: lenguaje descriptivo y neutral, la clasificación es la de la
   fuente citada, y el mazo no entra en si algo es lengua o dialecto.

## Método de selección

El mismo que en población y superficie, ya probado dos veces:

1. Se ordena la tabla completa de la fuente.
2. Se marcan primero las lenguas que cualquiera espera encontrar, con prioridad para quien
   juega: español y las lenguas de España, las grandes de América, las grandes globales.
3. Se descarta toda candidata que quede a menos de un **8 %** de una ya elegida. En cada colisión
   sobrevive la más esperable.
4. Se revisa a mano que ninguna pareja contigua quede indistinguible una vez redondeada: la
   prueba `redondeoLegible()` de `tests/mazos.mjs` lo comprueba después, pero la decisión es
   editorial.

Objetivo: **entre 45 y 50 cartas**. El mínimo técnico son 38 (`9 * 4 + 2`, nueve jugadores).

## Lista de candidatas (sin cifras, pendiente de la tabla)

El corte final depende de las colisiones al 8 %, así que esta lista es más larga que el mazo. No
lleva orden ni números a propósito.

- **Globales:** inglés, chino mandarín, hindi, español, árabe, francés, portugués, ruso, bengalí,
  urdu, indonesio, alemán, japonés, italiano.
- **Asia:** chino wu, chino cantonés, panyabí, telugu, maratí, tamil, turco, vietnamita, coreano,
  javanés, persa, tailandés, birmano, filipino, guyaratí, canarés, malayalam, nepalí, sindhi,
  pastún, azerí, uzbeko, kazajo.
- **África:** suajili, hausa, yoruba, igbo, amárico, oromo, somalí, zulú, afrikáans, fula,
  wólof, malgache.
- **Europa:** neerlandés, polaco, ucraniano, rumano, griego, checo, húngaro, sueco, búlgaro,
  serbocroata, danés, finés, noruego, lituano, letón, estonio, irlandés, maltés, islandés.
- **América:** quechua, guaraní, náhuatl, aimara, maya yucateco, criollo haitiano.
- **España:** catalán, gallego, euskera, asturiano.

El tramo bajo es el más valioso para el público del juego: el islandés, el maltés o el euskera
hacen de cola de la línea igual que la Ciudad del Vaticano en el mazo de población, y las lenguas
de España y de América dan las cartas que un jugador puede razonar en vez de adivinar.

## Diseño técnico

### Eje nuevo `speakers` en `modes.js`

Reutiliza `compact()` y `shortMillions()` tal cual: el mazo de población ya muestra «1.477
millones» para la India, así que el formato aguanta las cifras de cabecera sin tocarlo.

```js
speakers: {
  sortValue: card => card.value,
  format: card => card.value >= 1e6 ? compact(card.value) : `${compact(card.value)} hablantes`,
  shortValue: card => shortMillions(card.value),
  hiddenLabel: "Hablantes ocultos",
  timelineTitle: "De menos a más hablado",
  question: "¿Menos o más hablantes?",
  bands: [
    { limit: 1000000, key: "local", name: "Local", symbol: "·" },
    { limit: 10000000, key: "regional", name: "Regional", symbol: "▪" },
    { limit: 50000000, key: "nacional", name: "Nacional", symbol: "◈" },
    { limit: 150000000, key: "internacional", name: "Internacional", symbol: "◆" },
    { limit: 500000000, key: "global", name: "Global", symbol: "★" },
    { limit: Infinity, key: "franca", name: "Lengua franca", symbol: "⬢" }
  ]
}
```

### Modalidad y bloque

```js
languages: {
  key: "languages", name: "Idiomas por hablantes",
  cardLabel: "idiomas", blurb: "Hablantes totales, nativos y de segunda lengua.",
  cards: window.LANGUAGE_CARDS,
  axis: "speakers"
}
```

Y se suma `"languages"` a `BLOCKS.geografia.games`. La portada cuenta los juegos de cada bloque
sola («N juegos»), así que pasar de tres a cuatro no pide nada de CSS ni de arte. La competición
también se arma sola (`COMP_MODES` en `app.js` filtra `mixed` sobre `Object.keys(CT.MODES)`), de
modo que el mazo entra en la rotación al declararlo: los catorce temas pasan a quince.

### Identificadores

Rango **14001+**. Está libre: 1000 historia, 2000 superficie, 3000 población, 4000 inventos,
5000 mundial, 6000 música, 7000 videojuegos, 8000 astronomía, 9000 medicina, 10000 peso, 11000
distancias, 12000 longevidad, 13000 velocidad.

### Archivos que hay que tocar

| Archivo | Cambio |
|---|---|
| `idiomas.js` | nuevo, `window.LANGUAGE_CARDS` |
| `modes.js` | eje `speakers`, entrada en `MODES`, `"languages"` en `BLOCKS.geografia.games` |
| `index.html` | `<script src="idiomas.js"></script>` antes de `modes.js` |
| `service-worker.js` | añadir a la precarga y subir la versión de caché |
| `scripts/build.mjs` | lista de archivos del paquete |
| `scripts/audit-content.mjs` | lista de mazos del catálogo de fuentes |
| `tests/mazos.mjs` | cargar el archivo, `separadas()`, `redondeoLegible()` y la unicidad de IDs entre mazos |
| `tests/partidas-al-azar.mjs` | `catalogo` y la lista de mazos que ordenan por `value` |
| `README.md` | ficha del mazo en Geografía y «catorce juegos» → quince (dos sitios) |
| `app.js` | un comentario menciona «los catorce juegos» |
| `VERIFICACION_IDIOMAS.md` | nuevo: fuente, edición, fecha de corte, convenios, método y ausencias |
| `docs/catalogo-fuentes.json` | regenerar con `node scripts/audit-content.mjs --write` |

No hace falta tocar `firestore.rules` (ya no lleva la lista de juegos) ni `usesAnimalArt()`
mientras el mazo no tenga láminas.

### Si algún día lleva arte

512×768, como manda `asset-budget.json`. La idea que se propone es **el nombre de cada lengua
escrito en su propia escritura**: no revela la cifra que hay que ordenar —igual que las láminas
de animales no revelan el peso—, es neutral y evita el error de ilustrar una lengua con la
bandera de un país, que es precisamente lo que este mazo enseña que no coincide.

## Qué falta para cerrarlo

1. Conseguir la tabla: comprar el conjunto de datos de Ethnologue, o abrir el acceso de red a la
   fuente elegida en la configuración del entorno, o aportarla a mano como se hizo con la tabla
   de Worldometer en el mazo de población.
2. Fijar los convenios de macrolenguas de la sección correspondiente.
3. Aplicar el método de selección sobre la tabla y escribir `idiomas.js` copiando las cifras sin
   redondear.
4. Escribir `VERIFICACION_IDIOMAS.md` con el mismo formato que `VERIFICACION_POBLACION.md`:
   fuente, fecha de corte, resultado, cómo se eligieron, ausencias que llaman la atención y
   cifras con matiz.
