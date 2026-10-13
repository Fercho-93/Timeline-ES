# Cuentas, Apple y ranking de Continuum

El código está en `accounts.js` (cuenta, progreso y ranking), `account-storage.js` (espacio
local de cada cuenta), `avatares.js` e `identidad.js` (alias y avatar) y, en iPhone,
`ios/App/App/AppleSignInPlugin.swift`. Las colecciones de Firestore que usa se describen en
[docs/MODELO_DE_DATOS.md](docs/MODELO_DE_DATOS.md).

## Invitado

- La primera apertura con conexión crea un invitado anónimo de Firebase y un alias aleatorio
  `Player 4821`. No hay formulario ni registro previo: la bienvenida solo propone cambiar el alias
  y avisa de que el progreso se guarda en un servidor, sin correo, y de que el ranking es opcional,
  con enlace a la política de privacidad.
- Firebase conserva la sesión en el dispositivo. Volver a abrir usa el mismo UID.
- El alias es único sin distinguir mayúsculas (`playerNames`), de 2 a 24 caracteres: letras
  españolas, números, espacios interiores, guiones y guion bajo. Atlas → cambiar nombre actualiza
  el perfil y el ranking de forma atómica y libera el nombre anterior. Un nombre ocupado por otra
  cuenta se rechaza con un aviso.
- El avatar se elige en la bienvenida o en el Atlas entre los 36 retratos de `assets/avatars/`; se guarda en el
  perfil y en las filas del ranking, y es el que ven los demás en salas, duelos y mesas.
- Sin conexión al abrir, el juego arranca igualmente sin cuenta y guarda lo jugado en un espacio
  local aparte (`locked`). Al abrir después con conexión, eso pasa a la cuenta si esta aún no tiene
  progreso en la nube; si ya lo tiene, prevalece el de la nube y no se mezclan. No se crea otro
  invitado ante un fallo de red.
- Una vez abierto, el progreso se guarda en local y se sube a `playerProgress` con revisiones, para
  no pisar cambios concurrentes; Web Locks impide abrir la misma cuenta en dos pestañas.
- En la web y en Android, desinstalar o borrar los datos del navegador deja el invitado
  inaccesible (no hay correo ni contraseña para recuperarlo). Sus datos y su nombre reservado se
  borran con la limpieza anual de invitados sin uso (ver
  [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#conservación-y-limpieza-de-datos)).
  Para pasar de un dispositivo a otro sin cuenta de Apple está «Copiar mi perfil» / «Recuperar
  ese perfil» en el Atlas.
- La temporada `launch-1` empezó de cero; los datos locales de antes de las cuentas no se
  importaron.

## Iniciar sesión con Apple

Disponible en la app de iPhone (AuthenticationServices + Firebase Authentication). La web y
Android siguen siendo de invitado: Apple solo se ofrece donde el sistema da la identidad. Google
todavía no está incorporado.

- El invitado se **vincula** con Apple (`linkWithCredential`): conserva su UID y su progreso.
- El juego **no pide a Apple ni nombre ni correo** (`requestedScopes = []`): solo recibe el
  identificador que Apple asigna a la app. Los tokens no se guardan ni se registran. Las cuentas
  vinculadas antes del 10 de octubre de 2026 pudieron entregar un correo, que Firebase conserva en
  el registro de acceso y el juego no usa.
- Si la cuenta de Apple ya tenía progreso (`auth/credential-already-in-use`), se pregunta cuál
  conservar; nunca se mezclan. Si se elige el del móvil, se deja apartado en
  `continuum-progress-handoff` (fuera del espacio de cada cuenta, caduca a los diez minutos) y se
  sube a la cuenta tras recargar. El invitado descartado se borra del servidor.
- **Cerrar sesión de Apple** está en el Atlas. El progreso sigue en la cuenta y el móvil vuelve a
  empezar con un invitado nuevo hasta que se vuelva a entrar.
- Las reglas de Firestore tratan igual a una cuenta de Apple que a un invitado. La antigua lista
  `appleBetaTesters` ya no existe (`tests/apple-auth-rules.mjs` comprueba que está cerrada).

## Eliminar la cuenta

Atlas → «Tu cuenta y tus datos» → eliminar. Pide confirmación y no se puede deshacer.

- En una cuenta de Apple (requisito 5.1.1(v) de App Store), antes de tocar nada se pide a Apple
  confirmar la identidad, se reautentica y se revoca el acceso con `revokeAccessToken`. Si algo
  falla ahí, no se borra nada y se puede reintentar.
- `purgeServerData` borra: todas las filas del ranking diario y semanal desde que existe la
  cuenta, la fila antigua de `dailyRanking`, `socialRanking`, los tokens de avisos
  (`playerProfiles/{uid}/pushTokens`), los bloqueados y archivados (`duelPreferences/{uid}`), los
  registros de cuota (`creationQuota`, `roomCreation`), el alias en `playerNames`, el progreso y el
  perfil. Después se borra el usuario de Firebase Authentication y la copia local de la cuenta y
  de sus duelos.
- Lo compartido con otras personas (nombre y jugadas en salas y duelos) se conserva hasta que esas
  partidas caducan según los plazos de conservación.

## Ranking del reto diario

- **Opcional.** `rankingPublico` (en `hilo-retos-v1`, que viaja con el progreso) vale `true`,
  `false` o no existe. Sin decidir no se publica nada. La pregunta sale al terminar el primer reto
  diario («¿Quieres aparecer en el ranking?») y se cambia en Ajustes → «Privacidad y ranking» y en
  el Atlas.
  Al dejar de aparecer se borran todas las filas publicadas y `dailyRanking/{uid}`; si falla por
  falta de conexión, se reintenta en la siguiente apertura.
- **Por días** (aciertos del reto de ese día, de 0 a 10) y **por semanas** (de lunes a domingo,
  hasta 70). A igualdad de aciertos gana quien tardó menos (en la semana, la suma de los días).
  Cada lunes todos empiezan de cero. Con ‹ › se ven los días y semanas anteriores, hasta 8
  semanas atrás. Se muestran 50 puestos y «Ver más» llega a 200. Se abre desde el inicio, desde el
  final del reto y desde el Atlas.
- El reto diario tiene siempre 10 cartas. Las partidas libres, los duelos, la competición y el
  multijugador no cuentan.
- Datos: `dailyScores/{fecha}/players/{uid}` y `weeklyScores/{lunes}/players/{uid}` con alias,
  avatar, aciertos y `ms` (lo que se tardó). El campo `finishedAt` se publica vacío: la hora exacta
  no la usa nada. Cada fila debe coincidir, en la misma transacción, con el perfil y con
  `day/dayHits/week/weekHits` del progreso.
- `dailyRanking` y `socialRanking` (marcadores acumulados anteriores) ya no se crean: de una fila
  antigua de `dailyRanking` solo se actualizan alias y avatar. Sus reglas se mantienen para
  clientes antiguos y se borran con la cuenta.
- Son resultados declarados por el cliente: un marcador social, no una clasificación antitrampas.

## Ranking de descubrimientos

- Con el mismo consentimiento (`rankingPublico`). Ordena por **cartas descubiertas**: una carta se
  descubre la primera vez que quien juega la coloca bien en una partida suya. En Grandes colecciones
  es el álbum (`mastered` del progreso); en Retos rápidos, `quickMastered`. Volver a acertarla no
  suma.
- Tres vistas: **Todas** (el total), **Grandes colecciones** y **Retos rápidos**. No va por fechas
  ni se reinicia. A igualdad de cartas se comparte el puesto. 50 puestos y «Ver más» hasta 200.
- Datos: `discoveryScores/{uid}` con alias, avatar, `cards`, `collections` y `quick`. Cada fila
  debe coincidir, en la misma transacción, con el perfil y con `found/foundCollections/foundQuick`
  del progreso. Se borra al dejar el ranking y con la cuenta (también en la limpieza de invitados
  de `functions/index.js`).
- Se abre desde la pestaña «Cartas» del ranking y desde «Tu colección» de Retos rápidos.

Tipos de puntuación que enseña el juego: partida única (gana quien se queda sin cartas; empate →
final numérica), partida con rondas (competición: +1 al ganar la ronda, −(cartas − 1) al resto),
reto diario (X de 10; la rapidez desempata) y duelos (más aciertos; la rapidez desempata). En el
Atlas y en «Tus partidas», el cara a cara con cada amigo de los duelos por turnos.

## Seguridad y datos

`playerProfiles/{uid}` y `playerProgress/{uid}` solo los lee y escribe su dueño. El perfil solo
permite cambiar alias y avatar. Las filas del ranking las lee cualquier jugador con sesión, con
consultas limitadas, y solo exponen alias, avatar, aciertos y tiempo. Nadie puede modificar otro
UID. No se usa huella del dispositivo, IMEI ni identificador publicitario.

## Configuración del titular

1. Firebase, proyecto `timeline-es` → Authentication → Método de acceso: **Anónimo** y **Apple**
   habilitados.
2. Plan **Blaze**: lo necesitan las Cloud Functions (avisos y limpieza diaria). Poner una alerta
   de presupuesto: una alerta avisa, no corta el gasto.
3. Apple Developer → Identifiers → `com.continuum.game`: **Sign in with Apple** habilitado, y el
   perfil de distribución regenerado para que incluya esa capacidad (la compilación de GitHub lo
   descarga sola).
4. Firebase → Authentication → Apple: para que la revocación funcione, rellenar **Services ID,
   Team ID, Key ID y clave privada (.p8)** (la clave se crea en Apple Developer → Keys con «Sign
   in with Apple»). La clave privada solo se introduce en la consola de Firebase, nunca en el
   repositorio. Configurado y comprobado el 11 de octubre de 2026.
5. Reglas y Functions se publican como se explica en
   [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#despliegue).

## Validación

- `node tests/cuentas.mjs`: alta automática, reentrada, fallo de red, cambio de nombre, ranking,
  aislamiento y conflictos.
- `node tests/apple-auth.mjs`: vinculación, reentrada, cierre de sesión y borrado con revocación.
- `node tests/ranking-inicio.mjs`: el marcador del inicio y lo que suma cada reto diario.
- `npm run test:reglas` (`cuentas-reglas.mjs`, `apple-auth-rules.mjs`): las reglas reales en el
  emulador.

En iPhone real, además: entrar con Apple, cancelar, cerrar sesión y volver a entrar, entrar con
una cuenta que ya tenía progreso (probar las dos opciones), eliminar la cuenta y comprobar en
Ajustes del iPhone → Apple Account → Iniciar sesión con Apple que Continuum ya no aparece.

Referencias: <https://firebase.google.com/docs/auth/ios/apple>,
<https://firebase.google.com/docs/auth/web/apple>.
