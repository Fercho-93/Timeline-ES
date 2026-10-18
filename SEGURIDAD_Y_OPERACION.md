# Seguridad y operación de la beta

Cómo se publica cada pieza (web, reglas, Functions, beta) está en
[CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#despliegue); los plazos de conservación,
en la sección «Conservación y limpieza de datos» del mismo documento; el mapa de colecciones, en
[docs/MODELO_DE_DATOS.md](docs/MODELO_DE_DATOS.md).

## Modelo de confianza

Las reglas de Firestore validan permisos, fases y transformaciones de cartas, pero la exactitud
factual de una jugada se calcula en el cliente: el catálogo es público y una sala comparte mazo,
manos y poderes con todos sus participantes. Esta arquitectura sirve para jugar entre personas
de confianza; no acredita resultados de una competición pública ni oculta secretos frente a un
cliente modificado. El ranking diario es un marcador social con resultados declarados por cada
dispositivo.

## Medidas implementadas

- **Retos rápidos firmados.** Cada comando de una sala de Retos rápidos (`quickRooms`) lleva
  quién lo jugó (`by`). Las reglas exigen que `by` sea quien escribe, y `QuickRoom.validate`
  (`quick-room.js`) reconstruye la partida en cada cliente y rechaza un comando cuyo autor no sea
  el participante de turno (o el anfitrión, para pasar de reto). Así nadie juega las cartas de
  otro apuntándose como `actor`. Los comandos sin firma de salas anteriores se siguen aceptando.
- **Expulsar de la sala de espera de Retos rápidos.** Solo quien lleva la sala (`host`, siempre el
  primero de `members`) puede echar a otra persona, y solo en una sala privada y antes de empezar
  (rama `kicking` de las reglas, y la acción `kick` de `QuickRoom.reduce`); no se echa en mitad de
  una partida ni en una mesa pública. Lo único que cambia además es la respuesta del minijuego de
  quién empieza de quien se va. Quien es expulsado puede volver a entrar con el código: no hay lista
  de bloqueados, como en las colecciones.
- **Final numérica validada contra la carta.** La final de las salas guarda cada respuesta de forma
  inmutable en `rooms/{sala}/finalRounds/{ronda}/answers/{uid}` con un recibo público en la misma
  transacción; antes de que todos respondan solo la lee su autor. Las reglas comprueban las
  diferencias y quién puede ganar. Además, cada cliente comprueba con `CT.Final.valid` que la cifra
  correcta guardada en la sala es la de la carta: una final manipulada se rechaza y el resultado se
  declara no válido.
- **Salas cercanas con código.** En las salas entre iPhones por MultipeerConnectivity
  (`local-peer.js`), cualquier iPhone al alcance puede conectarse, pero solo se sienta quien
  escribe el código de 4 cifras que ve el anfitrión (`local-session.js`). Cada intento fallido
  cierra el canal y, tras cinco, el código cambia.
- **Sala Wi-Fi local.** El anfitrión es la fuente de verdad. Cada canal queda atado a la persona que
  se unió por él, así que sus mensajes siempre hablan en su nombre; el identificador, el nombre
  (recortado a 24 caracteres) y el avatar que llegan de otro móvil solo se aceptan con la forma que
  genera el juego, y una plaza ocupada solo se puede recuperar si su dueño está desconectado.
- **Cuota de altas.** Una partida online nueva (duelo por turnos, sala de Retos rápidos o mesa
  pública) cada 10 s por persona (`creationQuota`) y una sala privada cada 30 s (`roomCreation`).
  El registro se escribe en la misma operación que crea la partida, y las reglas exigen que lo
  apunte: no se puede crear sin pasar por la cuota. No impide crear otra identidad anónima (eso lo
  cubre App Check), pero frena los bucles; no es un límite global de costes.
- **Capacidades.** Las lecturas de `/capabilities/secretFinal` y `/capabilities/multiCompetition`
  (el documento no necesita existir) detectan si las reglas publicadas admiten la final privada y
  la competición multijugador; sin ellas, el cliente avisa antes de empezar en vez de fallar a
  mitad de partida.
- **Borrado y limpieza.** Borrado completo de la cuenta desde el juego (lo hace el servidor con
  `deleteMyAccount`, y el móvil si el servidor no responde), borrado manual por el titular (workflow
  «Borrar cuenta de un jugador») y limpieza diaria de lo caducado (`purgeExpiredData`).

## App Check

App Check añade a cada petición a Firebase una prueba de que sale de Continuum y no de un script.
Se inicia en `firebase-client.js` antes de abrir Firestore.

- **Web:** reCAPTCHA Enterprise, con la clave pública `appCheckSiteKey` de `deployment.js`.
- **iPhone:** App Attest. El plugin nativo `ios/App/App/AppAttestationPlugin.swift` obtiene el token
  con el SDK de Firebase usando los datos públicos de `deployment.iosAppCheck` (no hace falta
  `GoogleService-Info.plist`); el entitlement `appattest-environment` está en `production`.
- **Android:** no cubierto. Play Integrity exige que la app esté publicada en Google Play.

**El *enforcement* todavía no está activado:** hoy las peticiones sin token se aceptan. Para
activarlo:

1. Firebase → App Check → APIs → Cloud Firestore: revisar las métricas hasta que casi todo el
   tráfico aparezca como verificado. Mientras haya usuarios de Android o versiones de iPhone sin App
   Attest, sus peticiones aparecen como no verificadas y dejarían de funcionar.
2. Pulsar **«Aplicar»** en Cloud Firestore (y, si se quiere, en Authentication).
3. Comprobar en un móvil y en la web que se puede entrar, crear una sala y reconectar.

Depurar:

- Las métricas de la consola distinguen peticiones verificadas, no verificadas, con token
  inválido y obsoletas.
- Si la inicialización falla, la consola del navegador muestra «App Check no disponible» y el juego
  sigue sin token.
- En iPhone, el plugin rechaza con `APP_CHECK_NOT_CONFIGURED` si faltan los datos de
  `deployment.iosAppCheck`; App Attest no funciona en el simulador.
- Para probar desde `localhost` con el *enforcement* activado hace falta un token de depuración
  registrado en la consola (`self.FIREBASE_APPCHECK_DEBUG_TOKEN`). El código no lo incluye y no
  debe distribuirse nunca en una versión publicada.

App Check no sustituye a las reglas, no oculta cartas y no evita por sí solo todo abuso. La
autenticación anónima puede regenerarse: revisar altas de identidades, creación de salas,
lecturas, escrituras, errores y consumo; configurar avisos y un procedimiento de cierre de altas.
Un presupuesto no es un corte automático.

## Al publicar reglas

El workflow `reglas-firestore.yml` publica en producción en cuanto llega a `main` un cambio de
`firestore.rules`, después de pasar las pruebas del emulador. Antes de subirlo, ejecutar
`npm run test:reglas` y comprobar que los clientes ya instalados siguen funcionando con las reglas
nuevas. Ante una duda, comparar el contenido activo (consola o Firebase Rules API) con el archivo
del repositorio, y comprobar una sala desde dos dispositivos.

## Arquitectura para una futura competición pública

Crear una versión de protocolo independiente con estas fronteras:

- `matches/{id}`: participantes, fase, versión, turno y línea pública, sin manos ni orden del mazo.
- `matches/{id}/private/{uid}`: lectura únicamente del titular; escritura solo desde servidor.
- `matchSecrets/{id}`: orden del mazo, semilla y respuestas de Pulso; ningún acceso de cliente.
- Endpoint de jugada autenticado y atestado: recibe ID de carta, hueco, versión esperada e ID de
  acción. Verifica pertenencia, turno, catálogo versionado y resultado; actualiza dentro de una
  transacción e impide repetir la acción.
- Resolución de Pulso: conservar las dos respuestas privadas hasta resolver ambas.
- Resultados: un registro de servidor con versión del motor y del catálogo, ganador y secuencia de
  acciones. Las clasificaciones solo aceptarían estos registros.

Hubo un prototipo de este servicio en `server/`, nunca desplegado; se retiró en octubre de 2026 y
sigue en el historial de git.

## Fuentes operativas

- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/app-check/ios/app-attest-provider
- https://firebase.google.com/docs/app-check/enable-enforcement
- https://firebase.google.com/docs/app-check/web/debug-provider
