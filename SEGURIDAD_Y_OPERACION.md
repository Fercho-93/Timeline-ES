# Seguridad y operación de la beta

## Estado y límites

Competición multijugador (cliente 42): desplegar las reglas actuales antes de distribuir la app. La lectura autenticada de `/capabilities/multiCompetition` detecta soporte sin crear un documento. Sin soporte, se informa antes de crear una sala de competición. El paso entre temas solo puede hacerlo el anfitrión después de acabar una ronda; las reglas conservan sala y participantes, exigen el siguiente tema de la cola, anexan el resultado real y reinician las manos. El catálogo y la aleatoriedad siguen siendo del cliente. No se han desplegado estas reglas a producción desde este entorno.

Las reglas validan permisos, fases y transformaciones de cartas. La exactitud factual del acierto sigue calculándose en el cliente: el catálogo es público y una sala comparte mazo, manos y poderes. Esta arquitectura sirve para pruebas entre personas de confianza; no acredita resultados de competición pública ni oculta secretos frente a clientes modificados.

Las nuevas partidas usan una final numérica. Cada respuesta se guarda de forma inmutable en `rooms/{sala}/finalRounds/{ronda}/answers/{uid}` junto con un recibo público en una transacción. Antes de que todos respondan, solo su autor puede leerla; después pueden leerlas los participantes de la sala. Las reglas comprueban las diferencias y quién puede ganar o continuar. No se permiten saltos ni expulsiones durante la final. La cola antigua se conserva solo para reanudar salas de versiones anteriores.

Antes de distribuir el cliente v41, publicar `firestore.rules` en el proyecto `timeline-es` (Firebase Console → Firestore Database → Reglas, o `firebase deploy --only firestore:rules --project timeline-es`). La lectura de capacidad `/capabilities/secretFinal` confirma que las reglas están actualizadas; no requiere crear ese documento. Sin ellas, el cliente muestra un aviso antes de iniciar una partida, evitando fallar a mitad de la final. Todos los participantes necesitan el cliente actualizado.

Al desplegar `functions/` (C.4.1), publicar también `firestore.indexes.json` — `firebase deploy --only firestore` (sin `:rules`) sube las dos cosas a la vez. `maintainTurnDuels` combina `where('status','in',…)` con `orderBy` por documento, y eso exige el índice compuesto declarado ahí; sin desplegarlo, la función programada falla en silencio cada hora (el error solo se ve en los registros de Cloud Functions).

El catálogo y los valores correctos siguen estando en el cliente, como el resto del juego. Las reglas validan las respuestas privadas y la clasificación contra el valor de la carta registrado en la sala; no son un servidor autoritativo del catálogo. No se promete resistencia a clientes modificados que falseen dicho valor.

## Antes de ampliar el acceso

`deployment.js` identifica esta versión como `private-beta`. La integración web de App Check está preparada para una clave pública reCAPTCHA Enterprise. Registrar la app y dominios en Firebase, configurar la clave y observar métricas en ensayo antes de activar enforcement. Confirmar que peticiones sin token son rechazadas y que usuarios legítimos pueden reconectar. No usar tokens de depuración en una distribución. La app nativa necesita su proveedor de atestación y prueba específica; la configuración pública falla cerrada si aún no está preparado.

App Check no sustituye las reglas, no oculta cartas y no evita por sí solo todo abuso. La autenticación anónima puede regenerarse; cualquier cuota por UID debe acompañarse de observación y atestación. Revisar altas de identidades, creación de salas, lecturas, escrituras, errores y consumo. Configurar avisos y un procedimiento de cierre de altas; un presupuesto no es un corte automático.

## Secretos de servidor: dónde viven y cuándo rotarlos (B.6.3 / B.7.5)

Hoy no hay ningún secreto de servidor guardado en un fichero versionado: `functions/` usa las credenciales automáticas del propio entorno de Cloud Functions (no hace falta ninguna clave, `initializeApp()` sin argumentos ya se autentica como el proyecto); `server/` (el experimental de `server/README.md`, no desplegado) lee todo lo sensible de variables de entorno (`CONTINUUM_SERVER_CATALOGS`, `CONTINUUM_ALLOWED_ORIGINS`) en vez de tenerlo escrito en el código; y los ficheros con claves de las apps nativas (`google-services.json`, `GoogleService-Info.plist`) están en `.gitignore`, así que no llegan a GitHub. La única clave presente en el código del cliente es la `apiKey` pública de Firebase (ver B.7.4/B.6.1): esa es pública por diseño, no es un secreto.

Política de rotación, para cuando exista un secreto real que rotar (por ejemplo, la clave de RevenueCat de B.6.2 el día que se implemente, o un token del servidor experimental si se despliega):

- **Rotación por sospecha, inmediata**: si un secreto pudo haberse expuesto (aparece en un commit por error, en un log, en una captura compartida), se rota ese mismo día y se revoca el anterior, sin esperar a la siguiente ventana programada.
- **Rotación programada, cada 6 meses**: para secretos de larga vida que no dependen de una plataforma externa (tokens propios del servidor experimental, por ejemplo).
- **La plataforma que emite el secreto manda si dice otra cosa**: si Google Cloud, Apple o RevenueCat fuerzan su propio ciclo de rotación o expiración, se sigue el suyo en vez de este calendario.
- Ningún secreto nuevo se añade directamente al código: variable de entorno (como ya hace `server/`) o gestor de secretos del proveedor (Google Secret Manager), nunca un valor literal en un fichero que se sube a git.

## Cuotas por UID (B.3)

Todas las cuotas activas viven en `firestore.rules`, agrupadas junto a `roomCreation` bajo el comentario «Cuotas por UID (B.3)»: cada una es una colección `{acción}/{uid}` con un campo `last…At` que debe valer `request.time` y no puede renovarse antes de que pasen 30 segundos desde el valor anterior. La acción que dispara la cuota exige, en la misma escritura (batch o transacción), que ese documento se actualice — así un cliente no puede escribir solo la mitad. Añadir una cuota nueva ante un abuso distinto es copiar uno de esos `match` y esa misma exigencia cruzada en la acción correspondiente; no hay que buscar la comprobación repetida en otros ficheros porque no la hay.

- **Crear sala** (`roomCreation`): una sala nueva cada 30 segundos por UID. Crear una sala sin actualizar su registro en la misma operación es rechazado.
- **Unirse a sala** (`roomJoin`): una entrada cada 30 segundos por UID, sobre `rooms/{roomId}`. No cubre todavía `quickRooms` (Retos rápidos), que queda pendiente si se detecta abuso ahí.
- **Cambiar de nombre** (`nameChange`): un cambio de alias cada 30 segundos por UID, sobre `playerProfiles/{uid}`.
- **Consultar el ranking**: sin cuota. Es una lectura (`get`/`list` en `socialRanking`/`dailyRanking`), y las reglas de Firestore no pueden obligar a que una lectura vaya acompañada de una escritura de control — un cliente modificado simplemente no la escribiría. Sin un backend con estado (el `server/` experimental, no desplegado) no hay forma de exigirlo de verdad; `socialRanking`/`dailyRanking` ya limitan cada consulta a 50 documentos (`request.query.limit <= 50`), pero eso no es una cuota de repetición.

Los registros de `roomCreation`, `roomJoin` y `nameChange` necesitan limpieza por su campo `last…At` con el mismo desplazamiento de siete días. Ninguna de estas cuotas limita las lecturas ni impide crear otra identidad: no se presentan como un límite global de costes.

La retención objetivo es de siete días para salas y presencia, con configuración separada de TTL y desplazamiento explícito. Ver `CONFIGURAR_MULTIJUGADOR.md`. Verificar en ensayo y después contrastar las políticas reales; no se han inspeccionado ni cambiado reglas o políticas de producción en esta tarea.

Al publicar, comparar el SHA-256 del archivo de reglas aprobado con el contenido activo recuperado de Firebase Rules API o de la consola, y guardar evidencia de proyecto, fecha y versión. No declarar equivalencia solo porque un despliegue local devolvió éxito. Ejecutar las pruebas contra un proyecto de ensayo y comprobar una sala desde dos dispositivos antes de abrir nuevas altas.

## Respuesta ante actividad anómala (B.4.3)

Procedimiento simple, para no improvisar en caliente. «Anómalo» aquí significa: un salto brusco en el panel de uso de Firestore (Firebase Console → Firestore Database → Uso), una alerta de presupuesto de Google Cloud Billing (B.4.1, aún por configurar), o un aviso de coste/tráfico que no cuadra con el número real de jugadores.

1. **Confirmar que es de verdad anómalo, no un pico legítimo.** Cruzar la fecha con cualquier motivo esperado (publicación nueva, mención en redes, prueba propia). Un pico que coincide con una campaña no es abuso.
2. **Mirar qué colección concentra el gasto**, en el panel de uso por colección de Firestore: si son lecturas de `socialRanking`/`dailyRanking`, sospechar del ranking (B.3 ya documenta que su cuota de lectura no se puede exigir desde las reglas); si son escrituras en `rooms`/`roomCreation`/`roomJoin`, sospechar de creación o entrada masiva de salas.
3. **Cortar altas nuevas temporalmente** si el origen parece ser cuentas nuevas en bucle: Firebase Console → Authentication → Sign-in method → desactivar el proveedor anónimo. Esto no expulsa a quien ya está jugando (su sesión sigue siendo válida), solo impide que se creen identidades nuevas. Revertir en cuanto se identifique y corte el origen.
4. **Si App Check ya está activo (B.2)**, revisar en Firebase Console → App Check qué proporción de peticiones llega sin token válido: un salto ahí apunta a tráfico fuera de la app real (un script, no un cliente modificado con App Check correcto, porque ese sí lo pasaría).
5. **Si el origen es una cuota concreta que se está saltando de forma sistemática** (por ejemplo, muchas altas de `roomCreation` con menos de 30 segundos de diferencia real que sin embargo no deberían pasar), comprobar primero que las reglas desplegadas coinciden con las del repositorio (hash SHA-256, B.1.2) antes de sospechar de un fallo en la regla misma.
6. **Documentar el incidente** en el registro de incidencias (C.3.2, ver `INCIDENCIAS.md`) con fecha, qué se observó, qué se hizo y cuándo se revirtió. Sirve para no repetir el mismo diagnóstico la próxima vez.
7. **Reabrir altas** solo cuando el origen esté identificado y cortado (no solo cuando el gasto haya bajado: puede bajar solo porque el atacante se ha cansado, no porque el hueco esté cerrado).

Esto no sustituye a B.2 (App Check) ni a B.3 (cuotas): es lo que se hace cuando, aun con esas dos cosas activas, algo se sale de lo esperado.

## Repetir las pruebas antes de cada versión (C.3.3)

Antes de publicar una versión nueva (subir a las tiendas, desplegar `firestore.rules` o `functions/`), ejecutar `npm test` completo — o, como mínimo, `npm run test:seguridad` (reglas de Firestore contra el emulador) y `npm run test:infra` (que el build móvil no se rompe y todos los ficheros de `index.html` llegan a `dist/`). Un cambio que pasaba las pruebas la semana pasada puede dejar de hacerlo si otra persona tocó `firestore.rules` mientras tanto; no basta con confiar en la última ejecución en CI si hubo commits después. Ver `package.json` para el resto de grupos (`test:contenido`, `test:juego`, `test:accesibilidad`, `test:multijugador`, C.2.4).

## Arquitectura para una futura competición pública

Crear una versión de protocolo independiente con estas fronteras:

- `matches/{id}`: participantes, fase, versión, turno y línea pública, sin manos ni orden del mazo.
- `matches/{id}/private/{uid}`: lectura únicamente del titular; escritura solo desde servidor.
- `matchSecrets/{id}`: orden del mazo, semilla y respuestas de Pulso; ningún acceso de cliente.
- Endpoint de jugada autenticado y atestado: recibe ID de carta, hueco, versión esperada e ID de acción. Verifica pertenencia, turno, catálogo versionado y resultado; actualiza dentro de una transacción e impide repetir la acción.
- Resolución de Pulso: conservar las dos respuestas privadas hasta resolver ambas; no publicar la primera respuesta anticipadamente.
- Resultados: emitir un registro de servidor con versión del motor y catálogo, ganador y secuencia de acciones. Las clasificaciones solo aceptarían estos registros; nunca importaciones locales ni un resultado escrito por el cliente.

El servicio experimental de server/ implementa estas fronteras, transacciones y resultados registrados por servidor, con pruebas independientes. No está desplegado ni integrado en las pantallas; faltan Fantasma, abandono, recuperación del anfitrión y controles globales. Las salas familiares actuales conservan su arquitectura. Véase server/README.md antes de cualquier exposición pública.

## Fuentes operativas

- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/app-check/enable-enforcement
- https://firebase.google.com/docs/firestore/ttl
- https://firebase.google.com/docs/firestore/manage-data/delete-data
