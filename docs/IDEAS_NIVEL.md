# Continuum — ideas para subir el nivel del juego

Fecha: 12 de septiembre de 2026. Contexto: la beta ya está en manos de testers, con catorce
mazos, cinco formatos (un móvil, sala, solitario, competición, duelo por enlace), dos poderes
(Pulso y Fantasma), cuatro dificultades, enciclopedia y perfil con diecisiete logros.

Este documento no es una hoja de ruta ni un compromiso: es el catálogo de ideas con su coste
y sus riesgos, para poder elegir. Lo que se decida entra en `ROADMAP.md`, no aquí.

## Criterio con el que está ordenado

Lo que hoy limita el juego no es la falta de funciones, es que casi todas las decisiones del
jugador son la misma decisión: *¿dónde va esta carta?* Sabes o no sabes. Subir el nivel
significa añadir decisiones que no dependan solo de saber la fecha, y darle al que no está
colocando algo que hacer. Por eso las ideas se ordenan por **profundidad por coste**, y cada
una respeta cuatro límites que el proyecto ya tiene ganados:

1. **Nada de contenido nuevo sin fuente.** Los mazos actuales cuestan lo que cuesta verificar
   (`docs/catalogo-fuentes.json`, `VERIFICACION_CORRECCIONES.md`). Una función que sube el
   nivel sin pedir cartas nuevas vale más que un mazo más.
2. **Lo congelado sigue congelado.** El reto diario mantiene sus quince cartas, su semilla y
   las marcas de `hilo-retos-v1`; el formato de guardado 2 y las huellas de mazo
   (`CT.deckFingerprint`) no se rompen; `firestore.rules` solo se toca cuando no hay
   alternativa, y entonces con sus pruebas de emulador.
3. **Sin conexión y en un solo móvil primero.** Si una idea necesita servidor, va después de
   la beta (§7), porque el apartado 6 del roadmap ya está pendiente.
4. **Cada idea dice qué suite le hace falta.** Aquí no se da por hecho que algo funciona
   porque esté escrito, igual que el roadmap no da por probada una compilación por existir.

Las estimaciones de coste son relativas: **bajo** es un archivo y una suite; **medio**, varios
archivos y un formato de guardado nuevo; **alto**, tocar `online.js` y `firestore.rules`.

---

## 1. Capas de decisión sobre la regla que ya existe

Son las tres que más nivel dan por lo poco que cuestan: no cambian los mazos ni el tablero,
cambian lo que se puede decidir en un turno.

### 1.1 La Duda — la mejor de todas

**Qué es.** Cuando alguien confirma un hueco, antes de revelar, cualquier rival puede *dudar*.
Si la carta estaba mal colocada, quien dudó se quita una carta de la mano; si estaba bien, roba
una. Una duda por persona y ronda, y quien coloca no se enfada más de lo justo porque el que
duda se está jugando lo mismo.

**Por qué sube el nivel.** Hoy, en una mesa de seis, cinco personas miran el móvil sin hacer
nada durante cada turno. La Duda convierte el turno ajeno en una decisión propia, y además es
una decisión de *conocimiento*, no de azar: para dudar hay que tener una opinión sobre la fecha.
Es la función que más cambia la sensación de la partida en un solo móvil, que es el formato
principal del juego.

**Dónde encaja.** En `app.js`, entre la confirmación del hueco y la resolución (el camino que
hoy va directo a `CT.Progreso.record(...)` con `kind: "local"`). Necesita una pantalla intermedia
—la misma idea de la pantalla de pasar el turno— para que el que duda pulse sin que el que
coloca vea la línea. Interruptor propio al montar la partida, junto a «Cartas Pulso» y «Cartas
Fantasma», desmarcado por defecto.

**Coste.** Bajo en un móvil. **Alto en salas**: `online.js` tendría que añadir una fase
(`phase: "duda"`) a las que hay hoy —`lobby`, `turn`, `pulse`, `reveal`, `tiebreak`— y
`firestore.rules` validar quién puede dudar y cuándo, con su suite de emulador. Hacerlo en dos
etapas: primero un móvil, y solo si los testers lo piden, la sala.

**Riesgos.** Con nueve personas alarga el turno; conviene un tope (la duda la coge el primero
que pulsa, no todos) y que nunca sea obligatoria. En el perfil son dos contadores nuevos en
`marks` (`doubtsWon`, `doubtsLost`): `normalizeMarks` solo acepta claves conocidas, así que
añadirlas es aditivo y una copia antigua se importa igual.

**Suites.** `tests/duda.mjs` (una por resultado: acierto con duda, fallo con duda, duda no
usada, mano a cero por duda ganada) y ampliar `tests/partidas-al-azar.mjs` para que el conteo
de cartas siga cuadrando con dudas por medio.

### 1.2 La Apuesta

**Qué es.** Antes de confirmar el hueco, opcionalmente subes la apuesta. Si aciertas, descartas
además otra carta de tu mano a elegir; si fallas, robas dos en vez de una. En solitario: si
aciertas cuenta doble en el marcador, si fallas cuesta una vida.

**Por qué sube el nivel.** Introduce gestión de riesgo sin tocar el conocimiento: un jugador
mediocre que sabe *cuándo* está seguro le puede ganar a uno que sabe más y apuesta mal. Y
funciona en todos los formatos, incluido el solitario, donde hoy no hay ninguna decisión
aparte de la colocación.

**Dónde encaja.** En el mismo paso de confirmación de `app.js` (y el equivalente de `online.js`,
que aquí es barato: no hace falta fase nueva, solo un campo en la jugada; `firestore.rules`
sí tendría que validar que un robo doble es legítimo).

**Coste.** Bajo en un móvil y en solitario; medio en salas.

**Riesgos.** El reto diario **no** debería admitirla: cambiaría el significado de la puntuación
compartida y de la cuadrícula que se comparte, y las marcas existentes dejarían de ser
comparables. Igual en el duelo por enlace, salvo que la apuesta viaje dentro del enlace, que es
complicarlo para nada. Queda para partida libre, competición, local y sala.

### 1.3 La Consulta

**Qué es.** Una ayuda que se paga: revelar la banda de época o de magnitud de una carta de tu
mano a cambio de robar otra (o de una vida en solitario). Las bandas ya existen en cada mazo
(`bands` en `modes.js`) y el Fantasma ya sabe ocultarlas y mostrarlas.

**Por qué sube el nivel.** Da una salida a la mano bloqueada —esa carta que no tienes ni idea de
dónde va y te ancla la partida— al precio de ir a peor en el marcador. Es la decisión de
recursos más simple que se puede añadir.

**Coste.** Bajo. **Riesgo.** Puede volver plano el mazo de un mismo siglo; conviene que la
consulta diga la banda, nunca el valor, y que se limite a una vez por partida y persona.

---

## 2. Formatos nuevos con el motor que ya hay

Ninguno pide cartas nuevas ni reglas de Firestore: son la partida local con otra condición de
victoria.

### 2.1 Equipos (2v2, 3v3) — coste bajo

Una línea, dos o tres equipos, turnos alternos por equipo y victoria cuando un equipo entero se
queda sin cartas. La regla que lo hace jugable es la de no hablar de años: se puede señalar,
no fechar. Encaja en el array de jugadores de `app.js` (un campo `team`) y en la comprobación
de final de ronda. Abre el juego a mesas de seis y ocho, donde hoy un turno propio llega cada
mucho. El perfil sigue contando la partida como jugada y no como ganada, por lo mismo que hoy:
el móvil no sabe quién lo sostiene.

### 2.2 Cooperativo contra el mazo — coste bajo

Todo el mundo contra el mazo, con un número de fallos compartido (tres o cinco) y una sola
condición: vaciar todas las manos antes de agotarlos. Se puede consultar entre todos antes de
colocar. Es el formato para jugar en familia y con niños, y es el único en el que la persona
que menos sabe no lo pasa mal. Cambia la condición de victoria y el contador de vidas; nada más.

### 2.3 Superviviente — coste bajo

Variante de la local: tres fallos y quedas fuera, gana el último en pie. Sube la tensión sin
reglas nuevas, pero hay que decidir qué pasa con las cartas del eliminado (al descarte, como
en el abandono de sala) y evitar que alguien quede fuera en el minuto dos de una partida larga.

### 2.4 Contrarreloj — coste bajo, prioridad baja

Sesenta segundos, tantas cartas como puedas. Lo pongo con una advertencia: el juego ha decidido
a propósito que no hay cronómetro («no hay prisa; la dificultad la pone lo llena que esté la
línea», dice la regla del Pulso), y el reloj de las salas existe para que una sala no se quede
colgada, no como dificultad. Si entra, que sea un formato aparte y opcional, nunca un ajuste
que contamine los demás, y con cuidado en accesibilidad: un cronómetro empeora la partida de
quien usa lector de pantalla o motricidad reducida.

### 2.5 Torneo de sala — coste alto

La competición (catorce temas seguidos) existe en solitario pero no en sala. Sería la misma
rotación de temas con marcador acumulado entre varios móviles. Es atractivo y es caro: obliga a
encadenar partidas dentro del mismo documento de sala, con reconexión y abandono por medio.
Después de la beta.

---

## 3. Dificultad sin escribir una carta nueva

### 3.1 Tramos densos («modo apretado») — coste medio, mucho retorno

**Qué es.** Un mazo no es igual de difícil en toda su longitud: en Historia de España hay siglos
con una carta cada ochenta años y décadas con cinco. Un filtro derivado de los propios datos
—quedarse con las cartas cuyos huecos con la vecina están en el cuartil más estrecho, usando
`sortValue`— produce un mazo *mucho* más difícil sin añadir nada. El mismo truco vale para
todos los ejes: pesos parecidos, poblaciones parecidas, distancias parecidas.

**Por qué sube el nivel.** Es la única forma barata de que el jugador que ya se sabe el mazo
siga teniendo un reto. Hoy, cuando alguien domina un mazo, el juego se le acaba.

**Riesgo importante.** Un mazo filtrado **cambia la huella** (`CT.deckFingerprint` va sobre los
identificadores en orden), así que la variante tiene que viajar dentro del enlace del duelo y
del documento de la sala, o esos dos formatos compararían partidas distintas sin avisar. Es
exactamente el fallo que la huella se inventó para evitar; no se puede resolver con descuido.

**Suites.** `tests/mazos.mjs` debería comprobar que cada variante conserva orden y valores, y
`tests/duelo.mjs` que un enlace de variante contra un mazo completo se rechaza con explicación.

### 3.2 Maestría por mazo — coste bajo

Cinco grados por mazo (de Aprendiz a Maestro) a partir de lo que el perfil ya cuenta: cartas
jugadas, aciertos y racha por mazo (`byMode` en `progreso.js`). El grado no es decoración: es
lo que abre el modo apretado de ese mazo. Da una razón para volver a un mazo concreto en vez de
picotear catorce.

---

## 4. Que se aprenda de verdad (aquí está la diferencia con un juego de cartas cualquiera)

### 4.1 Entrenador de fallos — coste medio, el más valioso del documento

**Qué es.** Un formato de solitario que no reparte al azar: construye la tirada con **tus**
cartas falladas y **tus** tramos débiles, priorizando las que fallaste más veces y hace más
tiempo (repaso espaciado de toda la vida).

**Por qué es posible ya.** El perfil guarda exactamente eso y nadie lo usa todavía para jugar:
`misses` (hasta 300 cartas con `mode`, `count` y `lastDay`) y `byBand` (aciertos y fallos por
banda). Hoy solo se pintan como dos listas de puntos débiles que enlazan a la enciclopedia.

**Por qué sube el nivel.** Convierte el juego en algo que te hace mejor, no solo en algo en lo
que puntúas. Es también el mejor argumento comercial que tiene el proyecto y el que ningún
clon copia sin tener antes un perfil bien hecho.

**Dónde encaja.** Un `kind` nuevo del solitario en `app.js`, junto a `daily`, `free`, `comp` y
`duel`, con su clave de guardado propia. Debería contar cartas y aciertos en el perfil pero
**no** escribir récords por mazo: una tirada elegida a propósito entre tus peores cartas no es
comparable con una partida libre.

**Riesgos.** Con menos de veinte fallos registrados no hay sesión que montar: el formato tiene
que aparecer solo cuando haya material, y decir por qué si no lo hay. Y un jugador nuevo no lo
verá nunca el primer día, lo cual está bien.

**Suites.** `tests/entrenador.mjs` (selección determinista con semilla, perfil vacío, perfil con
una sola carta fallada, cartas que ya no existen en el mazo).

### 4.2 «Qué más pasó ese año» — coste bajo

Al revelar una carta de un mazo temporal, una línea con uno o dos hechos de **otros** mazos
alrededor de ese año: colocas el Quijote y descubres qué estaba pasando en Europa o qué se
inventó esa década. No hay que escribir nada: `MODES.mixed.cards` ya concatena los ocho mazos
cronológicos con su `sourceMode`, y `MIXED_DUPLICATE_INVENTION_IDS` ya resuelve los duplicados.

Sube el nivel porque es lo que hace que alguien cuente el juego en una cena. Dos cuidados: solo
después de revelar (antes filtraría la respuesta), y nunca en Fantasma ni en Experto, que
precisamente ocultan las bandas.

### 4.3 Enciclopedia con vista de línea — coste bajo

La enciclopedia ordena y filtra, pero no se ve la *forma* del mazo. Una tira con la distribución
real por décadas —la misma idea de escala real que ya usa el minimapa de partida— enseña de un
vistazo dónde se acumulan las cartas, que es justo lo que hay que saber para jugar bien.

---

## 5. Progresión y volver al día siguiente

### 5.1 Misiones semanales — coste bajo

Tres objetivos rotativos por semana («coloca diez cartas seguidas», «juega un mazo de Naturaleza»,
«gana un Pulso»), sorteados con la semana ISO como semilla mediante `CT.seedFrom` y
`CT.seededRandom`, igual que el reto diario usa la fecha: sin servidor, iguales para todo el
mundo y verificables sin conexión. Reaprovecha los contadores del perfil tal cual.

### 5.2 Logros por niveles — coste bajo

Los diecisiete logros actuales son de una sola pieza. Varios piden repetición y ya enseñan el
progreso, así que darles tres escalones (bronce/plata/oro: 100/500/2.000 cartas) multiplica el
recorrido sin inventar condiciones nuevas. `normalizeAchievements` solo acepta claves que existan
hoy, así que hay que añadir las nuevas claves antes de poder importarlas.

### 5.3 Marcador de amigos del reto diario — coste alto, después de la beta

El código ya guarda lo que haría falta: un identificador anónimo y estable por dispositivo y la
secuencia de aciertos de cada día, y el README dice explícitamente que no sale del móvil
«todavía». Un marcador entre amigos sería el paso natural, pero es Firebase: reglas nuevas, TTL,
App Check, borrado por usuario y coste. Va después del apartado 4 del roadmap, no antes.

### 5.4 Cadena de duelos por enlace — coste medio

El duelo es de dos. Que el enlace pueda acumular varias tiradas —cada persona añade su
cuadrícula y lo reenvía— daría un marcador de grupo asíncrono sin servidor, sin cuentas y sin
que los móviles coincidan encendidos, que es la virtud que hace especial al duelo actual. Hay
que vigilar el tamaño del enlace y mantener la franqueza de hoy: las marcas las afirma el móvil
de cada uno, no un árbitro.

---

## 6. Contenido: qué mazos costarían menos de defender

Cada carta nueva cuesta fuente, criterio y fecha, y el proyecto ya decidió que una URL no
verifica nada. Ordenados por facilidad de datación, no por interés:

- **Arquitectura e ingeniería:** año de inauguración, dato único y documentado.
- **Literatura:** primera edición. Mismo criterio que Cine, con el mismo riesgo de ediciones
  discutidas.
- **Deporte:** finales, récords y primeras ediciones de competiciones. Fechas limpias.
- **Historia de América Latina:** amplía mercado hispanohablante y encaja en el bloque Historia.
- **Tratados y constituciones:** fecha de firma, inequívoca.
- **Arte:** año de la obra. Más discutible de lo que parece; iría después.

Ejes nuevos con datos estructurados y estables: **altura de montañas**, **profundidad marina**,
**altura de edificios**, **antigüedad de universidades**. Evitaría cifras económicas: cambian
cada año y obligarían a mantener el mazo, que es lo que ya se sufre con población.

**Mazos propios (importar un JSON y compartirlo por enlace):** mucha profundidad y muchos
problemas —moderación, derechos, enlaces de tamaño imprevisible—. Si alguna vez, solo local y sin
compartir.

---

## 7. Qué no haría todavía

- **Competición pública con servidor** y **rankings globales**: es el apartado 6 del roadmap y
  no está desplegado. Añadir funciones que dependan de él multiplica lo que hay que terminar
  antes de publicar.
- **Monetización y mazos de pago**: el roadmap ya dice que se decide después de la beta.
- **Poderes nuevos en sala antes que en un solo móvil**: cada poder en sala es fase nueva,
  reglas publicadas y suite de emulador. Se prueba primero donde es barato.
- **Cualquier cosa que cambie el reto diario**: sus quince cartas, su semilla y sus marcas son lo
  único del juego que compara a dos personas hoy.

---

## 8. Orden que propongo

**Iteración A — lo que los testers pueden notar ya (coste bajo, ningún servidor).**
La Duda en un solo móvil (§1.1), la Apuesta fuera del reto diario (§1.2) y «qué más pasó ese
año» (§4.2). Tres funciones que cambian la sensación de una partida sin tocar mazos, guardados
ni reglas de Firestore. Es también lo mejor que se puede preguntar a un tester: si la Duda
divierte, el juego tiene otro nivel; si no, se quita y no ha costado nada.

**Iteración B — profundidad para quien ya se sabe los mazos.**
Entrenador de fallos (§4.1), maestría por mazo (§3.2) y tramos densos (§3.1, con el cuidado de
la huella). Aquí está el argumento de que el juego enseña algo, que es lo que lo distingue.

**Iteración C — mesa y vuelta al día siguiente.**
Equipos (§2.1), cooperativo (§2.2), misiones semanales (§5.1) y logros por niveles (§5.2).

**Después de la beta:** la Duda en salas, el torneo de sala, el marcador de amigos y los mazos
nuevos, por ese orden.

Si solo se pudiera hacer una cosa de todo el documento, sería **la Duda**: es la que convierte
a los cinco que miran en cinco que juegan.
