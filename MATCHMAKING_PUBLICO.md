# Jugar online: mesas públicas y partida rápida

«Jugar online» sienta a desconocidos en mesas públicas de 2 a 4 personas, sin tocar las salas
privadas ni el modo Wi-Fi. Tiene dos caminos en la misma pantalla:

- **Tablón de mesas** (como el vestíbulo de Risk): alguien pulsa **Crear mesa**, elige juego,
  plazas y tiempo, y la mesa aparece en «Mesas abiertas»; los demás eligen dónde sentarse.
- **Partida rápida:** sin elegir mesa, te sientan en la primera libre. Se elige el tamaño de
  mesa («Cualquier mesa», hasta 2, 3 o 4) y el contenido: **Grandes colecciones** (hasta tres
  temas o ninguno, o un mazo al azar) o **Retos rápidos**.

| Pieza | Archivo |
| --- | --- |
| Pantallas de Jugar online | `js/interfaz/home-modes-v1.js` |
| Tablón de mesas (`publicTables`) | `js/online/public-tables.js` |
| Claves de cola, compatibilidad y arranque | `js/online/public-matchmaking.js` |
| Transacciones de Grandes colecciones (`rooms` + `publicQueues`) | `js/online/online.js`, `js/online/public-matchmaking-online.js` |
| Transacciones de Retos rápidos (`quickRooms` + `quickPublicQueues`) | `js/retos/quick-online.js`, `js/retos/quick-room.js` |
| Reglas | `firestore.rules` (`publicTables`, `publicQueues`, `quickPublicQueues`, `rooms`, `quickRooms`) |

## Principios

- **Firebase es la autoridad de emparejamiento.** Ningún teléfono decide por sí solo que una mesa
  está llena; entrar es una transacción y dos personas no pueden ocupar la última plaza.
- **Idempotencia.** Pulsar dos veces o reintentar tras una pérdida de red no mete al mismo UID dos
  veces.
- **Compatibilidad.** La versión del cliente (`CLIENT_VERSION`, hoy 42) y la huella del mazo
  forman parte de la clave de la cola: instalaciones incompatibles no se mezclan.
- **La sala manda.** La cola y la ficha del tablón solo sirven para encontrar la mesa; la verdad
  está en `rooms/{código}` o `quickRooms/{código}`.
- **Sin anfitrión visible.** Hay un anfitrión técnico para el motor, pero la mesa sobrevive a que
  se vaya quien la creó.

## Modelo

**`publicQueues/{queueKey}`** (Grandes colecciones): un único puntero por modalidad, capacidad,
versión y huella, con la clave `modo:capacidad:vVersión:huella`. Campos: `queueKey`, `roomCode`,
`mode`, `capacity`, `clientVersion`, `deckFingerprint`, `status` (`waiting` | `full`) y
`updatedAt`. Las reglas exigen que coincida con su sala.

**`quickPublicQueues/{key}`** (Retos rápidos): `code`, `status`, `capacity` y `updatedAt`.

**`rooms/{código}`** público: la sala de siempre con `matchmaking: 'public'`, `capacity`,
`queueKey`, `clientVersion` y `deckFingerprint`. Los códigos públicos empiezan por `P`.

**`publicTables/{código}`**: la ficha del tablón (`kind` `collections` o `quick`, modo, plazas,
tiempo por turno, jugadores, nombres, anfitrión y su avatar, versión, huella y opciones). Solo la
escribe quien lleva la mesa; cualquiera con sesión la lista (máximo 50). Se renueva cada 40–45 s;
sin renovar en dos minutos deja de enseñarse y cualquiera puede borrarla. La limpieza diaria
borra las fichas y colas con más de un día.

Las reglas impiden capacidades fuera de 2–4, añadir o quitar a otro, superar la capacidad,
cambiar modo, versión, código o clave después de crear la cola, entrar en una cola `full`,
apuntar una cola a una sala incompatible y modificar una partida pública sin pertenecer a ella.
Cada mesa nueva va con su registro de cuota (`creationQuota`): una partida nueva cada 10 s por
persona.

## Orden de juego y relevo del anfitrión

- **Quién empieza.** Al completarse la mesa se juega el mismo minijuego que en las salas
  privadas: el anfitrión técnico reparte una carta automáticamente y cada persona tiene 30
  segundos para escribir su cifra. La mesa se sienta por orden de cercanía; quien no respondió
  juega al final.
- **Relevo automático.** Si el anfitrión técnico deja de dar señales (15 s si dejó la pantalla de
  la sala o la app pasó a segundo plano, 90 s si simplemente dejó de responder), la primera
  persona conectada toma el relevo sin pulsar nada. En la sala de espera, además, se saca de la
  mesa a quien se fue y la cola vuelve a ofrecerla (`status: waiting`).
- **Reglas antiguas.** Reordenar la mesa al empezar necesita las reglas actuales (`validStart`
  admite una permutación de `playerOrder`). Con reglas anteriores, el cliente reintenta sin
  reordenar.
- **Mesas abandonadas.** Mientras alguien espera en una mesa con plazas libres, su móvil renueva
  la cola cada 45 s. Una cola sin renovar en dos minutos se da por abandonada: la búsqueda no
  entra en ella y abre una mesa nueva.
- **Retos rápidos.** Sus mesas usan `quickPublicQueues` y solo las puede empezar quien las abrió
  (no hay relevo). Esa persona renueva la cola cada 45 s; quien estaba esperando en una mesa
  abandonada recibe un aviso para volver a buscar.

## Sala de espera

Referencia: las salas públicas de juegos como Among Us o Risk. Nadie organiza, el juego lleva la
mesa y nadie se queda esperando para siempre.

- **Cuándo empieza.** Al completarse la mesa (y responder todos al minijuego) o, con al menos dos
  personas, cuando pasan 30 s sin que entre nadie más. Cada entrada reinicia la cuenta atrás,
  medida con la hora del servidor (`updatedAt` de la sala). Las reglas no dejan empezar antes de
  25 s desde la última entrada.
- **Minijuego mientras se espera.** La carta sale en cuanto hay dos personas; quien entra después
  responde a la misma.
- **Salir.** «Dejar de buscar» o la flecha de volver liberan la plaza al momento. Si se va quien
  lleva la mesa, la pasa a quien queda primero (`validPublicHostLeave`); si no queda nadie, la mesa
  se cierra.
- **Cola que apunta a una mesa ya en juego.** Se comprueba antes de la transacción y se abre una
  mesa nueva, en vez de fallar la búsqueda.
- **Pantalla.** Arriba, la colección y el estado con la cuenta atrás; debajo, los jugadores con su
  estado (tú, en la mesa, pensando su cifra, ha respondido, sin señal) y el minijuego. Sin
  «Anfitrión». Al terminar, «Buscar otra partida».
- **Retos rápidos.** Las mismas reglas de arranque y de salida (acción `leave` en `js/retos/quick-room.js`
  y regla `leaving`).

## Pruebas

- `node tests/public-matchmaking.mjs`: claves, capacidad y compatibilidad.
- `npm run test:reglas` (`public-matchmaking-rules.mjs`, `quick-online-rules.mjs`,
  `orden-salida-online.mjs`): carreras por la última plaza, idempotencia, salas llenas, versiones
  distintas, abandono, relevo y cuota contra el emulador.
- `npm run test:online-e2e`: recorrido completo con varias personas a la vez, en Chromium y contra
  los emuladores de Auth y Firestore con las reglas reales.

Pendiente: pruebas con 2 y 4 dispositivos reales a la vez.

Fuera de alcance por ahora: chat, ranking o ELO de mesas, filtros por nivel, espectadores, bots y
emparejamiento por habilidad.
