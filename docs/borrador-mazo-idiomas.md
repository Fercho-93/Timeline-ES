# Borrador del mazo «Idiomas por hablantes»

**Estado: BORRADOR. Hay una tabla de 50 lenguas sobre la mesa, pero no alcanza para un mazo
jugable. No se ha creado `idiomas.js` ni se ha tocado `modes.js`, `index.html`,
`service-worker.js` ni las pruebas.**

Este documento fija la métrica, los convenios editoriales, el método de selección, el diseño del
eje y la lista de archivos que hay que tocar. Lo único que falta son filas: las que tiene la
tabla recibida no dan para cuarenta cartas separables.

## Los datos recibidos

Las **50 lenguas con más hablantes nativos (L1)**, de la recopilación de Wikipedia que cita
**Ethnologue 2022**, en millones y con un decimal. Van del chino mandarín (929,0) al rumano
(24,3).

Procedencia, dicha tal cual: es una compilación secundaria, no una fuente oficial, y su corte es
de 2022, no de hoy. Se acepta a sabiendas —la alternativa es no tener mazo, porque la tabla
uniforme de Ethnologue se vende y su dominio estaba bloqueado en esta sesión— pero eso tiene que
quedar escrito en `VERIFICACION_IDIOMAS.md` y en el blurb del mazo, no disimulado.

### Cambio de métrica

La tabla es de **hablantes nativos**, no de hablantes totales. Eso invierte la decisión anterior
y hay que asumir sus consecuencias, que no son cosméticas:

- El mazo se llama **«Idiomas por hablantes nativos»**, y el eje pregunta por nativos. Un jugador
  que espere el orden «más hablado del mundo» se sentirá engañado si no se lo decimos.
- El inglés cae al tercer puesto, detrás del español. Es la carta más contraintuitiva del mazo y
  conviene que su explicación lo diga.
- **No hay carta de «árabe» ni de «chino»**: Ethnologue los desagrega en variedades. Véase abajo.

## El problema que descarta esta tabla tal cual

El juego necesita **38 cartas como mínimo** (`9 * 4 + 2`, nueve jugadores). Aplicando el método
de selección del mazo de población —descartar toda candidata a menos de un 8 % de una ya
elegida— sobre estas 50 lenguas:

| Separación exigida | Cartas que sobreviven | Solo con lenguas reconocibles |
|---|---|---|
| 8 % | **19** | 16 |
| 6 % | 23 | 18 |
| 4 % | 24 | 18 |
| 2 % | 29 | 21 |

Ni bajando la exigencia a un 2 % —que ya es echarlo a suertes— se llega a 38. Y la selección al
8 % deja fuera al **francés, el portugués, el italiano, el coreano, el turco y el vietnamita**,
que es un mazo de idiomas indefendible.

La causa no es la falta de lenguas, sino dónde están: **42 de las 50 caben entre 24 y 93
millones**. Hay ocho lenguas entre 79,9 y 85,2 millones (yue, vietnamita, maratí, turco, télugu,
wu, coreano, francés) de las que solo puede sobrevivir una. Arriba pasa lo contrario: entre 929
y 125 millones hay sitio de sobra y solo siete lenguas.

El techo teórico entre 929 y 24,3 millones con un 8 % de separación son 47 cartas, así que el
espacio existe; lo que no existe en esta tabla es con qué rellenarlo.

## Qué hace falta para cerrarlo

**La cola de la lista, no la cabeza.** Concretamente:

1. **Los puestos 51 a 200 de la misma lista**, con las mismas columnas y el mismo corte. Bajan
   hasta unos 4–5 millones de hablantes, y ahí cada carta tiene su sitio: de 929 a 5 millones con
   un 8 % de separación caben unas 68 cartas. Con 150 filas más, elegir 45 bien separadas es
   trivial.
2. **Opcional pero muy recomendable: la cola corta.** Las lenguas por debajo de ese corte que el
   público de este juego sí sitúa —catalán, gallego, euskera, islandés, maltés, irlandés,
   guaraní, quechua, aimara, náhuatl, maya yucateco— son las que dan el tramo bajo de la línea,
   igual que la Ciudad del Vaticano en el mazo de población. Aviso: probablemente no estén en esa
   recopilación y haya que buscarlas por separado, lo que rompe el corte único. Si se añaden, se
   marcan como tales en su carta.

## La decisión que ya no se puede aplazar: variedades de chino y de árabe

En esta tabla hay **siete variedades de chino** (mandarín, yue, wu, min nan, hakka, jin, xiang) y
**cinco de árabe** (egipcio, levantino, argelino, sudanés, marroquí). No es un capricho de la
recopilación: es la clasificación de Ethnologue, que trata cada una como lengua propia.

Se ve el efecto en la selección automática al 8 %, que produce cartas de «chino hakka», «árabe
argelino», «árabe marroquí», «bhojpuri» y «lahnda»: un jugador español no tiene forma de
razonarlas, solo de adivinar. Y a la vez el mazo se queda **sin una carta de «árabe» y sin una de
«chino»**, que es lo primero que cualquiera buscaría.

Hay dos salidas coherentes, y hay que elegir una:

- **A — Fiel a la fuente.** Se conservan las variedades tal como las publica Ethnologue, cada una
  con su nombre completo, y las cartas explican la clasificación. Es honesto y enseña algo real,
  pero llena el mazo de cartas que solo se pueden acertar por suerte.
- **B — Solo las situables.** Se conservan el mandarín y el cantonés, y una sola variedad de
  árabe (el egipcio es el de mayor L1 de la tabla), y el resto se descarta por el mismo criterio
  que en superficie y población: «no situable por el público general». Las ausencias se explican
  en `VERIFICACION_IDIOMAS.md`. **Es la que recomienda este borrador.**

No cabe una tercera salida de sumar las variedades para fabricar una carta de «árabe» o de
«chino»: sumar cifras de una fuente que las publica separadas es inventar un dato que ella no da.

Lo mismo, en pequeño, con otras entradas de la tabla: **lahnda** es una etiqueta de agrupación de
Ethnologue, no una lengua que nadie sitúe, y aparece separada del panyabí, que sí está. Y el
nombre **«malabar»** debería ir como **malayálam**, que es como se llama la lengua.

## Convenios editoriales

1. **Macrolenguas:** resuelto arriba para chino y árabe. Queda fijar hindi/urdu (dos cartas en
   esta tabla, y así se quedan), persa (la tabla da una sola entrada) y panyabí/lahnda.
2. **Exclusiones:** lenguas de signos, construidas (esperanto) y litúrgicas sin comunidad nativa
   (latín). Se excluyen por coherencia de la medida y se anota aquí.
3. **Tono:** el tramo bajo son lenguas cooficiales y minorizadas. Se aplica el criterio de
   `VERIFICACION_HISTORICA.md`: lenguaje descriptivo y neutral, la clasificación es la de la
   fuente, y el mazo no entra en si algo es lengua o dialecto.
4. **Ninguna cifra se retoca para separar dos cartas.** Si dos lenguas están pegadas, se cae una;
   nunca se mueve un número.

## Método de selección

El mismo que en población y superficie:

1. Se ordena la tabla completa de la fuente.
2. Se marcan primero las lenguas que cualquiera espera encontrar, con prioridad para quien juega:
   español y lenguas de España, las grandes de América, las grandes globales.
3. Se descarta toda candidata a menos de un **8 %** de una ya elegida. En cada colisión sobrevive
   la más esperable. En el mazo de población el mínimo real acabó siendo del 8,1 %.
4. Se revisa a mano que ninguna pareja contigua quede indistinguible una vez redondeada;
   `redondeoLegible()` en `tests/mazos.mjs` lo comprueba después, pero la decisión es editorial.

Objetivo: **entre 45 y 50 cartas**. Mínimo técnico: 38.

## Diseño técnico

### Eje nuevo `speakers` en `modes.js`

Reutiliza `compact()` y `shortMillions()` tal cual: el mazo de población ya muestra «1.477
millones» para la India, así que el formato aguanta la cabecera del mazo sin tocarlo.

```js
speakers: {
  sortValue: card => card.value,
  format: card => card.value >= 1e6 ? compact(card.value) : `${compact(card.value)} hablantes`,
  shortValue: card => shortMillions(card.value),
  hiddenLabel: "Hablantes ocultos",
  timelineTitle: "De menos a más hablado",
  question: "¿Menos o más hablantes nativos?",
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
  key: "languages", name: "Idiomas por hablantes nativos",
  cardLabel: "idiomas", blurb: "Hablantes de lengua materna, según Ethnologue 2022.",
  cards: window.LANGUAGE_CARDS,
  axis: "speakers"
}
```

Y se suma `"languages"` a `BLOCKS.geografia.games`. La portada cuenta los juegos de cada bloque
sola («N juegos»), así que pasar de tres a cuatro no pide nada de CSS ni de arte. La competición
también se arma sola (`COMP_MODES` en `app.js` filtra `mixed` sobre `Object.keys(CT.MODES)`), de
modo que el mazo entra en la rotación al declararlo: los catorce temas pasan a quince.

### Cómo se guardan las cifras

La fuente publica millones con un decimal, así que `value` va en hablantes (`92.7` → `92700000`) y
la carta no presume de una precisión que la fuente no da: el redondeo a millones que hace
`compact()` coincide con el grano del original. En el mazo de idiomas **no** se aplica la
comprobación de enteros que sí tiene población, porque aquí el dato nace redondeado.

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
| `VERIFICACION_IDIOMAS.md` | nuevo: fuente, edición, corte, convenios, método y ausencias |
| `docs/catalogo-fuentes.json` | regenerar con `node scripts/audit-content.mjs --write` |

No hace falta tocar `firestore.rules` (ya no lleva la lista de juegos) ni `usesAnimalArt()`
mientras el mazo no tenga láminas.

### Si algún día lleva arte

512×768, como manda `asset-budget.json`. La idea que se propone es **el nombre de cada lengua
escrito en su propia escritura**: no revela la cifra que hay que ordenar —igual que las láminas
de animales no revelan el peso—, es neutral y evita el error de ilustrar una lengua con la
bandera de un país, que es precisamente lo que este mazo enseña que no coincide.

## Historial

- **Primera versión:** sin datos. La política de red de la sesión bloqueaba el acceso directo a
  Ethnologue, UNESCO, el World Factbook y Wikipedia, y los resúmenes de búsqueda disponibles se
  contradecían entre sí. No se copió ninguna cifra; se siguió el precedente de
  `docs/borrador-revision-naturaleza-17.md`.
- **Segunda versión:** con las 50 lenguas de mayor L1 (Ethnologue 2022 vía Wikipedia). Se
  comprueba que no bastan para 38 cartas separables y se documenta qué filas faltan y por qué.
