# Modelo de datos en Firestore

Todas las colecciones del proyecto `timeline-es`, según `firestore.rules`, el código del cliente y
`functions/`. «Con sesión» significa cualquier jugador autenticado (invitado anónimo o cuenta de
Apple). Las colecciones sin regla (`duelNotificationEvents`, `duelReminderBudgets`) solo las toca
el servidor. Los plazos de conservación salen de `functions/retention.js` y los aplica cada día
`purgeExpiredData` (ver
[CONFIGURAR_MULTIJUGADOR.md](../CONFIGURAR_MULTIJUGADOR.md#conservación-y-limpieza-de-datos)).
Lo que borra la eliminación de una cuenta está en
[CUENTAS_Y_RANKING.md](../CUENTAS_Y_RANKING.md#eliminar-la-cuenta).

## Cuenta, progreso y ranking

| Colección | Para qué | Quién lee | Quién escribe | Conservación |
| --- | --- | --- | --- | --- |
| `playerProfiles/{uid}` | Alias, clave del alias, avatar, temporada y versión de privacidad aceptada | Su dueño | Su dueño (solo alias y avatar tras crearlo) | Mientras exista la cuenta; invitado sin uso, 1 año |
| `playerProfiles/{uid}/pushTokens/{id}` | Token de avisos del móvil y plataforma | Su dueño; las Functions para enviar | Su dueño; las Functions borran los tokens caducados | Con la cuenta (hoy la app aún no registra tokens) |
| `playerNames/{alias}` | Reserva única del alias (sin mayúsculas) → `uid` | Con sesión (`get`, sin listar) | Su dueño, en la misma transacción que el perfil | Con la cuenta |
| `playerProgress/{uid}` | Progreso, récords, aciertos, partidas, revisión, aciertos del día y la semana y cartas descubiertas (`found`, `foundCollections`, `foundQuick`) | Su dueño | Su dueño, con revisión creciente | Con la cuenta |
| `dailyScores/{fecha}/players/{uid}` | Fila del ranking del día: alias, avatar, aciertos (0–10), `ms` y `finishedAt` vacío | Con sesión (listas de hasta 200) | Su dueño, si aceptó el ranking; debe coincidir con perfil y progreso | 90 días (la tabla entera, por fecha) |
| `weeklyScores/{lunes}/players/{uid}` | Fila del ranking semanal (0–70) | Con sesión (hasta 200) | Su dueño, igual que la diaria | 90 días |
| `discoveryScores/{uid}` | Fila del ranking de descubrimientos: alias, avatar y cartas descubiertas (`cards`, `collections`, `quick`) | Con sesión (hasta 200) | Su dueño, si aceptó el ranking; debe coincidir con perfil y con `found*` del progreso | Con la cuenta o al dejar el ranking |
| `dailyRanking/{uid}` | Marcador acumulado anterior; ya no se crea | Con sesión (hasta 50) | Su dueño (solo se actualiza alias y avatar) | Con la cuenta o al dejar el ranking |
| `socialRanking/{uid}` | Marcador social anterior; ya no se escribe | Con sesión (hasta 50) | Su dueño | Con la cuenta |

## Salas con amigos y mesas públicas

| Colección | Para qué | Quién lee | Quién escribe | Conservación |
| --- | --- | --- | --- | --- |
| `rooms/{código}` | Sala de Grandes colecciones (privada o pública): jugadores, manos, línea, mazo, turno, poderes, competición y final | Con sesión mientras está en el vestíbulo; después, sus participantes | Participantes, cada escritura por su rama de reglas (anfitrión para repartir, saltar o expulsar) | 7 días sin actividad |
| `rooms/{código}/presence/{uid}` | Señal de actividad cada 45 s (`seenAt`, `visible`) | Participantes | Cada uno la suya | Con su sala |
| `rooms/{código}/starter/{uid}` | Minijuego de quién empieza: carta y cifra de cada uno | Participantes | Cada uno la suya, en el vestíbulo | Con su sala |
| `rooms/{código}/finalRounds/{ronda}/answers/{uid}` | Respuesta privada e inmutable de la final numérica | Su autor; todos cuando han respondido | Su autor, una vez | Con su sala |
| `quickRooms/{código}` | Sala o duelo de Retos rápidos: miembros, configuración e historial de comandos firmados | Con sesión en el vestíbulo; después, miembros e invitado | Miembros en su turno (comandos con `by`); el anfitrión borra | 30 días sin actividad |
| `publicTables/{código}` | Ficha del tablón de mesas: contenido, plazas, tiempo, nombres y avatar del anfitrión | Con sesión (listas de hasta 50) | Quien lleva la mesa; cualquiera borra una abandonada | 1 día |
| `publicQueues/{clave}` | Puntero de partida rápida de Grandes colecciones | Con sesión (`get`) | Quien abre o renueva la mesa | 1 día |
| `quickPublicQueues/{clave}` | Puntero de partida rápida de Retos rápidos | Con sesión (`get`) | Quien abre la mesa | 1 día |

## Duelos por turnos

| Colección | Para qué | Quién lee | Quién escribe | Conservación |
| --- | --- | --- | --- | --- |
| `turnDuels/{id}` | Duelo de Grandes colecciones: jugadores, alias, mazo, semilla, jugadas, turno y estado | Los dos jugadores e invitado; con el enlace, cualquiera mientras espera rival | Los jugadores por sus reglas; las Functions marcan recordatorio y caducidad | 30 días sin actividad (caduca a los 7) |
| `duelPreferences/{uid}/blocked/{rival}` | Bloqueos: alias del bloqueado | Su dueño | Su dueño | Con la cuenta |
| `duelPreferences/{uid}/archived/{id}` | Duelos archivados | Su dueño | Su dueño, solo partidas terminadas | Con la cuenta |
| `duelNotificationEvents/{id}` | Eventos de aviso ya procesados (sin tokens) | Servidor | Functions | 30 días |
| `duelReminderBudgets/{uid}` | Último recordatorio enviado a cada persona | Servidor | Functions | 30 días; con la cuenta |

## Control y capacidades

| Colección | Para qué | Quién lee | Quién escribe | Conservación |
| --- | --- | --- | --- | --- |
| `creationQuota/{uid}` | Última partida online creada (duelo, sala de Retos o mesa pública): una cada 10 s | Su dueño | Su dueño, en la misma operación que crea la partida | 7 días; con la cuenta |
| `roomCreation/{uid}` | Última sala privada creada: una cada 30 s | Su dueño | Su dueño, igual | 7 días; con la cuenta |
| `reports/{denunciante}_{denunciado}` | Denuncia de un nombre: denunciante, denunciado, su nombre, motivo, dónde se vio y fecha | Nadie desde el juego: solo la consola de Firebase | Quien denuncia, una vez por pareja | 90 días (limpieza diaria) |
| `appConfig/current` | Cartel remoto: `minBuild`, `onlineEnabled`, `message`, `updateUrl` (ver «Cartel remoto» en CONFIGURAR_MULTIJUGADOR.md). Sin datos personales | Con sesión | Nadie desde el juego: solo la consola de Firebase | — |
| `capabilities/secretFinal`, `capabilities/multiCompetition` | Lectura de prueba: si las reglas publicadas la permiten, el cliente sabe que admiten la final privada y la competición. El documento no existe | Con sesión | Nadie | — |

## Fuera de producción

- `appleBetaTesters` ya no existe: las reglas no la permiten (`tests/apple-auth-rules.mjs`).

Además de Firestore, Firebase Authentication guarda la identidad de cada invitado o cuenta de
Apple; los invitados anónimos sin vincular que llevan un año sin abrir el juego se borran con sus
datos.
