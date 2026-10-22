# Multijugador: Firebase, despliegue y operación

El juego online usa el proyecto de Firebase `timeline-es` (el identificador conserva el nombre
antiguo; ver «Nombre del proyecto» más abajo): Authentication para el invitado y la cuenta de
Apple, Firestore para salas, duelos, mesas, progreso y ranking, Cloud Functions para avisos y
limpieza, y App Check. La configuración pública está en `firebase-client.js` y `deployment.js`.
El mapa de colecciones está en [docs/MODELO_DE_DATOS.md](docs/MODELO_DE_DATOS.md).

## Despliegue

Cada pieza se publica por su propio camino. Los demás documentos enlazan aquí en vez de
repetirlo.

| Pieza | Cómo se publica | Cuándo |
| --- | --- | --- |
| Web (`continuumjuego.es`) | GitHub Pages sirve la rama `main` tal cual, con el dominio del archivo `CNAME` | Al subir a `main` |
| Reglas de Firestore (`firestore.rules`) | `.github/workflows/reglas-firestore.yml`: pasa `npm run test:reglas` contra el emulador y, si todo está en verde, publica en **producción** | Automático al subir a `main` un cambio en `firestore.rules` (también a mano desde Actions) |
| Cloud Functions (`functions/`) | `.github/workflows/functions.yml`, «Publicar Cloud Functions» | Solo a mano |
| Beta de iPhone (TestFlight) | `.github/workflows/beta-firmada.yml` | Al subir a `main` un cambio en `.github/beta-request.json` |

### Web

GitHub Pages publica `main` sin compilar nada. Lo que cambie lo que ve el jugador (JS, CSS,
HTML, recursos) tiene que subir a la vez la versión en tres sitios, o el service worker seguirá
sirviendo la anterior:

- `service-worker-258.js`: `const CACHE = "continuum-vNNN";`
- `updates.js`: `CT.APP_VERSION = "continuum-vNNN";`
- `index.html`: `edition.css?v=NNN`

Las reglas para hacerlo sin pisar a otras sesiones están en `CLAUDE.md`. Ajustes → «Versión y
conexión» enseña la versión que tiene guardada cada móvil, que es la forma rápida de comprobar
si un cambio ha llegado.

### Reglas de Firestore

No hay que copiar ni pegar nada en la consola. Al subir a `main` un cambio en `firestore.rules`,
el workflow «Publicar reglas de Firestore» ejecuta las suites de `npm run test:reglas` en el
emulador y, solo si pasan, ejecuta `firebase deploy --only firestore:rules --project timeline-es`
con el secreto `FIREBASE_SERVICE_ACCOUNT`. Si faltara el secreto, el workflow explica cómo
crearlo. También se puede lanzar a mano: Actions → «Publicar reglas de Firestore» → «Run
workflow».

Como se publica en producción al momento, antes de subir un cambio de reglas:

- Ejecutar `npm run test:reglas` en local.
- Asegurarse de que los clientes ya instalados siguen funcionando: las reglas tienen que aceptar
  lo que escriben las versiones anteriores de la app (lo vigila
  `tests/compatibilidad-version-anterior.mjs`).

### Cloud Functions

Las Functions (`functions/index.js`) son seis:

| Función | Disparo | Qué hace |
| --- | --- | --- |
| `notifyTurnDuel` | Al actualizarse un `turnDuels/{id}` | Avisa a quien le toca |
| `notifyQuickDuel` | Al actualizarse un `quickRooms/{code}` de un duelo de Retos rápidos | Avisa a quien le toca o del final |
| `notifyDuelInvitation` | Al crearse un `turnDuels/{id}` con invitado | Avisa del reto, salvo bloqueo |
| `maintainTurnDuels` | Cada 60 minutos (Europe/Madrid) | Recordatorio a las 48 h sin jugar y caducidad a los 7 días |
| `deleteMyAccount` | Al pulsar «Eliminar» en el Atlas (llamada del juego) | Borra todo lo que el servidor guarda de la cuenta de quien llama —datos, filas de ranking de todos los días y semanas, nombre— y su acceso (`functions/account-purge.js`) |
| `purgeExpiredData` | Cada día a las 04:17 (Europe/Madrid) | Limpieza según `functions/retention.js` |

Corren en **`europe-southwest1`** (Madrid), junto a la base de datos, para que los datos no salgan de
España al procesarse y los avisos de Firestore no crucen de región (`setGlobalOptions` en `functions/index.js`).
Las dos programadas (`maintainTurnDuels` y `purgeExpiredData`) van en **`europe-west1`** (Bélgica, también en la
UE): Cloud Scheduler no está disponible en Madrid y publicarlas allí falla (`SCHEDULED_REGION`).
Historia: hasta octubre de 2026 la mayoría estaba en `us-central1` y los avisos de duelos en Madrid; el 20 de
octubre pasaron todas a `europe-west1` (Bélgica) y después a Madrid. Cada publicación crea las nuevas en su región
y borra las de las demás (por el `--force` del workflow). El juego llama a `deleteMyAccount` primero en Madrid y,
si no responde, en Bélgica; si tampoco, borra desde el móvil.

Se publican solo a mano, con el workflow **Publicar Cloud Functions**: GitHub → Actions →
«Publicar Cloud Functions» → «Run workflow». Funciona desde el móvil y usa el mismo secreto
`FIREBASE_SERVICE_ACCOUNT` que las reglas. Requisitos:

- El proyecto debe estar en el plan **Blaze** (pago por uso): las Functions y las tareas
  programadas no funcionan en el plan gratuito. El uso de esta beta cabe en la cuota gratuita
  de Blaze, pero conviene poner una alerta de presupuesto.
- La cuenta de servicio del secreto necesita, en Google Cloud → IAM, los roles **Administrador de
  Cloud Functions**, **Usuario de cuenta de servicio**, **Administrador de Cloud Scheduler**,
  **Administrador de Eventarc** y **Administrador de Artifact Registry**. Si el workflow falla con
  un error de permisos (`403`, `PERMISSION_DENIED`), el mensaje dice cuál falta.
- Las APIs que pide Firebase al desplegar (Cloud Functions, Cloud Build, Artifact Registry,
  Cloud Scheduler, Eventarc) deben estar habilitadas; el primer despliegue avisa de las que falten.

Alternativa con ordenador: instalar Node 22, `npm install -g firebase-tools`, `firebase login`,
`npm install --prefix functions` y `firebase deploy --only functions --project timeline-es`.

### Beta de iPhone

Editar `.github/beta-request.json` y subirlo a `main` lanza `beta-firmada.yml`: compila y firma la
app y sube el IPA a TestFlight (la compilación Android firmada se lanza en el mismo
workflow). El contenido del archivo es un registro de la petición; lo que dispara la
compilación es el cambio. Detalles de firma y secretos en
[DISTRIBUCION_MOVIL.md](DISTRIBUCION_MOVIL.md).

## Cartel remoto: pedir actualizar o pausar el online

El juego lee al abrirse (y cada cinco minutos con la app a la vista) el documento `appConfig/current` de
Firestore. Solo se edita a mano en la consola de Firebase (Firestore Database → Datos → colección
`appConfig` → documento `current`); ningún cliente puede escribirlo. Si no existe, o no se puede leer,
no pasa nada. Campos, todos opcionales:

| Campo | Tipo | Efecto |
| --- | --- | --- |
| `minBuild` | número entero | Las versiones con un número menor ven «Hay una versión nueva de Continuum» y su conexión con el servidor se desactiva. Pueden pulsar «Seguir sin conexión» para jugar sin internet. El número es el de `CT.APP_VERSION` (`continuum-v749` → `749`); una app de tienda lleva el de la web con la que se compiló. |
| `onlineEnabled` | `false` | Pausa las partidas por internet para todos: aviso arriba, y solitario y un solo móvil siguen. Al quitarlo o ponerlo a `true`, el juego se reconecta en el siguiente chequeo (hasta cinco minutos). |
| `message` | texto, hasta 200 | Sustituye al texto por defecto del aviso. |
| `updateUrl` | enlace `https://` | Destino del botón «Actualizar» (la ficha de la tienda). Sin él: en la web lleva a `actualizar.html`; en la app, no hay botón. |

Antes de subir `minBuild`, comprueba que el número que pones no deja fuera a la versión que ya está en
las tiendas. Para volver a la normalidad, borra el documento o quita los campos. Esto no sustituye a la
compatibilidad de las reglas con clientes anteriores (`tests/compatibilidad-version-anterior.mjs`): es la
salida de emergencia para cuando algo se rompe de todos modos. Lo prueban `tests/config-remota.mjs` y
`tests/config-remota-reglas.mjs`.

## Denuncias de nombres

Junto al nombre de otra persona (ranking, tablón y plazas de las mesas, rivales de los duelos) hay un
botón «Denunciar o bloquear». Escribe un documento en la colección `reports`, que **ningún jugador puede leer**:
se mira en la consola de Firebase → Firestore Database → Datos → `reports` (ordena por `createdAt`).
Cada documento se llama `{denunciante}_{denunciado}` y lleva:

| Campo | Qué es |
| --- | --- |
| `target` | El identificador (UID) de la persona denunciada |
| `targetAlias` | Su nombre cuando se denunció |
| `reason` | `nombre-ofensivo`, `suplantacion` u `otro` |
| `context` | Dónde se vio: `ranking`, `mesa`, `duelo` o `sala` |
| `reporter` | El identificador de quien denuncia |
| `createdAt` | Cuándo |

Una persona solo puede denunciar a otra una vez. La limpieza diaria (`purgeExpiredData`) las borra a los
90 días, como dice la política de privacidad; **esa función se publica a mano** (ver «Cloud Functions»
arriba): hasta publicarla con este cambio, las denuncias no caducan.

Qué hacer con una denuncia: en Authentication busca el UID de `target` y pulsa «Inhabilitar cuenta» para que
no pueda volver a entrar, o bórrala del todo con el workflow **Borrar cuenta de un jugador** (ver abajo);
en Firestore, `playerProfiles/{UID}` tiene su nombre (`alias`, `aliasKey`). Apple espera que respondas con rapidez: conviene mirar
`reports` cada pocos días mientras haya jugadores.

### Borrar la cuenta de un jugador

Dos caminos, que borran lo mismo (`functions/account-purge.js`):

- **El propio jugador**, desde el Atlas → «Tu cuenta y tus datos» → «Eliminar». El móvil llama a la función
  `deleteMyAccount`; si no está publicada o no responde, borra desde el móvil como hacían las versiones
  anteriores. Por eso **la función hay que publicarla a mano** (workflow «Publicar Cloud Functions»): hasta
  entonces el borrado sigue funcionando por el camino antiguo.
- **El titular**, por moderación o porque alguien lo pide por correo: GitHub → Actions → **Borrar cuenta de un
  jugador** → «Run workflow», con el nombre del jugador (o su UID) y el motivo. Antes de borrar por petición de
  correo, comprueba que quien escribe es la persona de la cuenta (por ejemplo, que pueda decir su nombre en el
  juego y cambiarlo por otro que le indiques). Usa la misma credencial que el resto
  (`FIREBASE_SERVICE_ACCOUNT`); no hay vuelta atrás.

Lo que no se borra al momento, por ser compartido con otras personas (salas, duelos, retos rápidos, denuncias), caduca
según los plazos de conservación.

## Qué validan las reglas

Cada escritura en una sala entra por una sola rama de las reglas, según lo que intente cambiar:
entrar en el vestíbulo, repartir, colocar una carta, cerrar el turno, saltar un turno, expulsar
o marcharse. Las reglas comprueban quién escribe, en qué fase está la sala, qué campos toca y
que las cartas ni se creen ni se dupliquen:

- Solo el participante de turno coloca carta, y solo puede tocar su propia mano.
- Al acertar, la carta sale de la mano y entra en la línea temporal; no se roba nada de paso.
- Nadie puede vaciarse la mano sin jugar, repartir cartas a otras personas fuera del
  desempate ni declararse ganador con cartas en la mano.
- El juego es un identificador corto que no cambia después de crear la sala, igual que el
  código y el anfitrión. Un valor que el cliente no conozca cae en el mazo por defecto: las
  reglas no llevan la lista de juegos, así que añadir un mazo no obliga a tocarlas.
- Expulsar es cosa del anfitrión; marcharse, de cada cual.
- La sala guarda una huella del mazo, igual de inmutable. Si un móvil con otra versión del mazo
  intenta entrar o repartir, se rechaza con un aviso claro.
- Pulso y Fantasma: las reglas validan la obtención privada y el uso de cada poder, y la
  recolocación de un Fantasma duplicado solo tras un robo válido.

**Lo que las reglas no pueden comprobar:** si el valor de la carta encaja de verdad en el hueco
elegido. Los datos de los mazos viven en el cliente, así que quien sepa manipular su navegador
puede declarar acertada una jugada fallida en su turno, aunque no puede robar cartas ajenas,
saltarse turnos ni forzar la victoria. La final numérica sí se comprueba contra la carta en cada
cliente (`CT.Final.valid`). Cerrar del todo esa puerta exige un servidor autoritativo (ver
[SEGURIDAD_Y_OPERACION.md](SEGURIDAD_Y_OPERACION.md)); para un juego de sobremesa entre conocidos no compensa.
Más detalles en [SEGURIDAD_Y_OPERACION.md](SEGURIDAD_Y_OPERACION.md).

## Conservación y limpieza de datos

Los plazos viven en un único sitio, `functions/retention.js`, y los aplica cada día
`purgeExpiredData` (04:17, hora de Madrid). Cuentan desde la última actividad de cada documento
y se borran con sus subcolecciones (una sala se lleva su presencia, su minijuego y su final):

| Datos | Plazo |
| --- | --- |
| Salas online (`rooms`, con `presence`, `starter` y `finalRounds`) | 7 días |
| Salas y duelos de Retos rápidos (`quickRooms`) | 30 días |
| Duelos por turnos (`turnDuels`; a los 7 días sin jugar ya caducan) | 30 días |
| Tablón de mesas públicas y colas de partida rápida (`publicTables`, `publicQueues`, `quickPublicQueues`) | 1 día |
| Registros de la cuota de altas (`creationQuota`, `roomCreation`) | 7 días |
| Registros técnicos de avisos (`duelNotificationEvents`, `duelReminderBudgets`) | 30 días |
| Tablas del ranking (`dailyScores`, `weeklyScores`, por fecha) | 90 días |
| Invitados anónimos sin vincular que no abren el juego | 1 año (se borran con sus datos) |

Estos plazos los cuenta también la política de privacidad: si cambian en `retention.js`, hay
que cambiarlos en `privacidad.html` y `PRIVACIDAD.md`. `tests/retencion.mjs` comprueba que
coinciden. No hace falta configurar políticas TTL en la consola.

Configurar alertas de presupuesto y observar lecturas, escrituras y autenticaciones antes de
ampliar la beta. Una alerta avisa; no limita el gasto. Conservar un procedimiento de cierre
temporal de altas y revisar picos de creación de identidades.

## Authentication

- **Anónimo** habilitado: cada instalación crea su invitado al abrir (ver
  [CUENTAS_Y_RANKING.md](CUENTAS_Y_RANKING.md)).
- **Apple** habilitado para la app de iPhone. Para que el borrado de cuenta pueda revocar el
  acceso, el proveedor necesita en la consola el Services ID, el Team ID, el Key ID y la clave
  privada (.p8); la clave nunca va al repositorio. Pasos en
  [CUENTAS_Y_RANKING.md](CUENTAS_Y_RANKING.md#configuración-del-titular).
- **Dominios autorizados:** `continuumjuego.es`, `www.continuumjuego.es` y la dirección antigua
  `fercho-93.github.io`. Si la clave web de Firebase tiene restricción por referente HTTP, esos
  dominios también tienen que estar en esa lista.

### Nombre del proyecto

Sigue pendiente cambiar el nombre visible del proyecto a **Continuum** en Configuración del
proyecto → General. El nombre visible y el identificador son distintos: hay que conservar el
`projectId`, `authDomain` y `storageBucket` actuales. El identificador de un proyecto existente no
se puede renombrar; sustituirlo desconectaría salas y cuentas y exigiría una migración.

## Probar con dos móviles

1. Abre la web (`https://continuumjuego.es/`) o la app con conexión a internet.
2. Jugar → **Jugar con amigos → Cada uno en su móvil → Crear partida**, elige un mazo y el ritmo
   **En directo**.
3. Crea la sala y comparte el enlace, el código o el QR.
4. En el segundo móvil: **Unirme a una partida** y escanea el QR o pega el enlace o el código.
5. En la sala de espera, el anfitrión ajusta cartas, tiempo por turno (sin tiempo, 15, 20 o
   30 s) y poderes, y pulsa **Empezar**. Antes de repartir se juega el minijuego de
   quién empieza.

Durante la partida, el menú de la sala permite compartir el enlace y el QR y, al anfitrión,
saltar el turno de quien se haya quedado sin batería o expulsar a quien ya no juegue: sus cartas
vuelven al descarte y la partida sigue. Cualquiera puede marcharse desde ese mismo menú.

## Privacidad y límites

- El invitado se gestiona con Firebase Authentication; no se pide correo.
- Las salas usan códigos aleatorios de ocho caracteres; los QR se generan en el propio
  dispositivo.
- La interfaz solo enseña a cada participante su propia mano, pero el documento de la sala viaja
  entero a cada móvil: quien sepa inspeccionar el navegador puede ver las manos ajenas y el orden
  del mazo. Las reglas impiden manipular la partida, no mirar.
- Las partidas compartidas necesitan internet, salvo las salas por Wi-Fi local. Un solo móvil y
  el solitario funcionan sin conexión.
- Cada participante envía una señal de presencia cada 45 segundos mientras tiene la sala a la
  vista; cuenta en lecturas y escrituras de Firestore.
