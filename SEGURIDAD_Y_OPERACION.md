# Seguridad y operación de la beta

## Estado y límites

Competición multijugador (cliente 42): desplegar las reglas actuales antes de distribuir la app. La lectura autenticada de `/capabilities/multiCompetition` detecta soporte sin crear un documento. Sin soporte, se informa antes de crear una sala de competición. El paso entre temas solo puede hacerlo el anfitrión después de acabar una ronda; las reglas conservan sala y participantes, exigen el siguiente tema de la cola, anexan el resultado real y reinician las manos. El catálogo y la aleatoriedad siguen siendo del cliente. No se han desplegado estas reglas a producción desde este entorno.

Las reglas validan permisos, fases y transformaciones de cartas. La exactitud factual del acierto sigue calculándose en el cliente: el catálogo es público y una sala comparte mazo, manos y poderes. Esta arquitectura sirve para pruebas entre personas de confianza; no acredita resultados de competición pública ni oculta secretos frente a clientes modificados.

Las nuevas partidas usan una final numérica. Cada respuesta se guarda de forma inmutable en `rooms/{sala}/finalRounds/{ronda}/answers/{uid}` junto con un recibo público en una transacción. Antes de que todos respondan, solo su autor puede leerla; después pueden leerlas los participantes de la sala. Las reglas comprueban las diferencias y quién puede ganar o continuar. No se permiten saltos ni expulsiones durante la final. La cola antigua se conserva solo para reanudar salas de versiones anteriores.

Antes de distribuir el cliente v41, publicar `firestore.rules` en el proyecto `timeline-es` (Firebase Console → Firestore Database → Reglas, o `firebase deploy --only firestore:rules --project timeline-es`). La lectura de capacidad `/capabilities/secretFinal` confirma que las reglas están actualizadas; no requiere crear ese documento. Sin ellas, el cliente muestra un aviso antes de iniciar una partida, evitando fallar a mitad de la final. Todos los participantes necesitan el cliente actualizado.

El catálogo y los valores correctos siguen estando en el cliente, como el resto del juego. Las reglas validan las respuestas privadas y la clasificación contra el valor de la carta registrado en la sala; no son un servidor autoritativo del catálogo. No se promete resistencia a clientes modificados que falseen dicho valor.

## Antes de ampliar el acceso

`deployment.js` identifica esta versión como `private-beta`. La integración web de App Check está preparada para una clave pública reCAPTCHA Enterprise. Registrar la app y dominios en Firebase, configurar la clave y observar métricas en ensayo antes de activar enforcement. Confirmar que peticiones sin token son rechazadas y que usuarios legítimos pueden reconectar. No usar tokens de depuración en una distribución. La app nativa necesita su proveedor de atestación y prueba específica; la configuración pública falla cerrada si aún no está preparado.

App Check no sustituye las reglas, no oculta cartas y no evita por sí solo todo abuso. La autenticación anónima puede regenerarse; cualquier cuota por UID debe acompañarse de observación y atestación. Revisar altas de identidades, creación de salas, lecturas, escrituras, errores y consumo. Configurar avisos y un procedimiento de cierre de altas; un presupuesto no es un corte automático.

Las altas de sala llevan una cuota atómica de una sala cada 30 segundos por UID. Crear una sala sin actualizar su registro `roomCreation` en la misma operación es rechazado. Estos registros necesitan limpieza por `lastCreatedAt` con el mismo desplazamiento de siete días. Esta cuota no limita las lecturas ni impide crear otra identidad: no se presenta como un límite global de costes.

La retención objetivo es de siete días para salas y presencia, con configuración separada de TTL y desplazamiento explícito. Ver `CONFIGURAR_MULTIJUGADOR.md`. Verificar en ensayo y después contrastar las políticas reales; no se han inspeccionado ni cambiado reglas o políticas de producción en esta tarea.

Al publicar, comparar el SHA-256 del archivo de reglas aprobado con el contenido activo recuperado de Firebase Rules API o de la consola, y guardar evidencia de proyecto, fecha y versión. No declarar equivalencia solo porque un despliegue local devolvió éxito. Ejecutar las pruebas contra un proyecto de ensayo y comprobar una sala desde dos dispositivos antes de abrir nuevas altas.

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
