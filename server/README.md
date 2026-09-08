# Servicio experimental de competición

Este servicio es independiente de las salas familiares del protocolo 40. Implementa creación y entrada a sala, inicio con tres cartas, jugadas normales, Pulso con respuestas privadas, cierre de ronda, desempates y resultados registrados por el servidor. Comparte la resolución de cartas con `engine.js`.

**No está desplegado ni conectado a las pantallas de la aplicación.** No ofrece todavía Fantasma, expulsión, recuperación de anfitrión ni resolución por tiempo: una desconexión conserva la partida, pero no sustituye al participante. El abandono voluntario sí está validado: devuelve las cartas al descarte, cancela un Pulso a medias y transfiere el anfitrión si procede. No debe anunciarse como una modalidad pública disponible.

## Fronteras de seguridad

- `matches/{id}` contiene fase, línea pública, tamaños de manos y resultados ya resueltos. Solo sus miembros pueden leerlo.
- `matches/{id}/private/{uid}` solo lo lee su titular. Ningún cliente puede escribirlo.
- `matchSecrets/{id}` contiene mazo, manos completas, catálogo de valores y primera respuesta del Pulso. Ningún cliente puede leerlo ni escribirlo.
- `matchResults/{id}` se crea desde la transacción del servidor al terminar. Incluye ganadores, versión, huella del catálogo y huella encadenada del estado. Las reglas impiden resultados escritos por jugadores. La huella no es una firma digital pública ni permite verificar una partida sin acceso al registro del servidor.
- `matchRequests/{uid}/requests/{requestId}` guarda la respuesta para reintentos. La misma clave con otra acción o sala se rechaza; dos acciones distintas sobre la misma versión no se aplican ambas.
- `matchQuotas/{uid}` limita a 60 acciones aceptadas por minuto entre todas las salas y una creación cada 30 segundos. No es una defensa global contra muchas identidades ni limita por sí sola solicitudes fallidas.

El servidor calcula el acierto usando su catálogo: no acepta valores, barajas, manos, booleanos de acierto ni ganadores del cliente. Baraja con aleatoriedad criptográfica. La primera posición del Pulso y la carta de regalo se mantienen privadas hasta resolver la defensa.

## Ejecución y configuración pendiente

Instalar con `npm ci` desde la raíz del repositorio. El SDK de servidor está declarado entre las dependencias de desarrollo porque este servicio aún es experimental; no usar `--omit=dev` para ejecutarlo.

`npm run server:start` requiere `CONTINUUM_SERVER_CATALOGS`: ruta a un JSON controlado por el operador con forma `{ "nombre": [{ "id": 1, "value": 1900 }, ...] }`. Usar un catálogo revisado y versionado. No se selecciona automáticamente todo el contenido de la beta como catálogo competitivo.

Configurar credenciales del entorno mediante Application Default Credentials y `CONTINUUM_ALLOWED_ORIGINS` con los orígenes web permitidos separados por comas. El proceso escucha únicamente en `127.0.0.1`, puerto `PORT` o 8081; necesita un proxy HTTPS y límites de entrada antes de exponerse. No se han creado cuentas de servicio ni añadido credenciales al repositorio.

`POST /actions` recibe `{ "matchId": "...", "requestId": "...", "command": { ... } }`. El usuario se obtiene exclusivamente del token Firebase de `Authorization: Bearer ...`; también exige `X-Firebase-AppCheck`. El cuerpo tiene un límite de 8 KiB y los comandos, 2 KiB. Las acciones después de crear requieren `version`; ante 409, volver a leer el estado y pedir una nueva acción al jugador, sin mover automáticamente su carta a otro hueco. Ante una respuesta perdida, reenviar la misma acción y el mismo `requestId`.

Acciones: `create` con `catalog`; `join`; `start`; `play` con `cardId,index`; `pulse` con `target`; `answer` con `index`; `endTurn`; `leave` para abandonar voluntariamente.

Antes de cualquier exposición: integrar la interfaz, completar reconexión/abandono, añadir control global de abuso y alertas, revisar IAM, probar revocación real y proveedores App Check web/nativos. El HTTP verifica tokens, pero la atestación de dispositivos necesita configurar el proyecto y las aplicaciones.

Las reglas de `server/firestore.rules` se prueban en un proyecto de emulador independiente. **No reemplazar con ellas las reglas de las salas familiares.** Para producción elegir un proyecto/base independiente o incorporar cuidadosamente los nuevos bloques, manteniendo las denegaciones. Ninguna regla se ha desplegado.

Los documentos llevan `expireAt` de tipo Timestamp. Configurar TTL para cada grupo de colección: matches, private, matchSecrets, matchResults, requests y matchQuotas. Borrar un padre no elimina sus subcolecciones. El plazo previsto es siete días; TTL es asíncrono y aún no está activado. Preparar además un procedimiento explícito de borrado por usuario.

## Evidencia

`tests/competicion-servidor.mjs` juega partidas completas de 2–9 participantes y comprueba conservación e inmutabilidad. `tests/servidor-http.mjs` comprueba autenticación, App Check obligatorio y límites. `tests/servidor-reglas.mjs` verifica permisos y carreras contra Firestore real emulado, incluyendo cuotas y reintentos.

Referencias de integración: [verificación de identidad](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [verificación de App Check](https://firebase.google.com/docs/app-check/custom-resource-backend), [TTL](https://firebase.google.com/docs/firestore/ttl).
