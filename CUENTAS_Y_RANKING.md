# Invitados y ranking de Continuum

## Experiencia

- La primera apertura con conexión crea un invitado Firebase automáticamente y un alias aleatorio `Player 4821`. No hay formulario ni registro previo.
- Firebase conserva la sesión local. Volver a abrir usa el mismo UID; el nombre puede repetirse entre invitados, pero sus puntos se separan por UID.
- Perfil → Cambiar nombre actualiza el perfil y la entrada del ranking de forma atómica, conservando los puntos. Los nombres aceptan de 2 a 24 caracteres.
- No hay cierre de sesión ni recuperación por correo. Si se pierde la instalación o se borran sus datos, se pierde acceso al invitado. No se promete recuperación por copias del sistema operativo.
- La apertura requiere conexión para preparar el invitado y leer su progreso. Una vez abierto, el juego conserva cambios locales y reintenta guardarlos al recuperar conexión. No se crea otro invitado ante un fallo de red.
- La temporada `launch-1` empieza de cero; los datos locales antiguos no se importan. No se borra masivamente la base de datos.
- Ranking de hasta 50 invitados por aciertos acumulados en retos diarios terminados desde esta actualización. Solo la primera finalización por día y mazo puntúa; las partidas normales y multijugador no puntúan. La colección nueva `dailyRanking` separa las marcas anteriores. Son resultados declarados por cliente, no una clasificación antitrampas.
- Eliminar invitado y progreso requiere confirmación y borra sus documentos e identidad; la siguiente apertura comienza desde cero. Desinstalar no borra automáticamente documentos remotos ni entradas del ranking.

## Configuración del propietario

1. Firebase, proyecto `timeline-es` → Authentication → Método de acceso: mantener **Anónimo habilitado**.
2. Mantener el plan **Spark** para no habilitar facturación por consumo. Tiene cuotas; no es uso ilimitado. No activar Identity Platform ni limpieza automática de invitados mayores de 30 días.
3. Ya no hace falta configurar Google, Apple, correo de asistencia, SHA de OAuth ni secretos `GOOGLE_SERVICES_JSON_BASE64` / `GOOGLE_SERVICE_INFO_PLIST_BASE64`. Los proveedores ya habilitados pueden permanecer mientras se valida el cambio; el cliente no los ofrece.
4. Publicar `firestore.rules` mediante el flujo existente `reglas-firestore.yml` (requiere `FIREBASE_SERVICE_ACCOUNT`) o desde la consola. Desplegar el cliente de esta misma PR.
5. Generar nuevas versiones Android/iOS por los flujos de beta existentes. Se mantienen los certificados de firma habituales; se retira el plugin nativo de OAuth y sus requisitos de configuración.
6. Probar en móvil real: primera entrada sin formulario; cerrar y abrir conserva nombre/puntos; cambiar nombre conserva ranking; dos instalaciones tienen identidades distintas; invitación multijugador; eliminar invitado empieza de cero.

## Seguridad y datos

`playerProfiles/{uid}` y `playerProgress/{uid}` son privados para su UID autenticado, también anónimo. El perfil permite cambiar solo el alias. `dailyRanking/{uid}` expone solo alias, avatar y marcadores a usuarios autenticados con consultas limitadas. Nadie puede modificar otro UID. Las escrituras de ranking deben coincidir con perfil y progreso en la misma transacción. Las salas conservan sus reglas de participantes y turnos.

El progreso se guarda con revisiones para evitar sobrescribir cambios concurrentes; Web Locks limita pestañas simultáneas cuando está disponible. No se usa huella del dispositivo, IMEI ni identificador publicitario. El UID es de Firebase y su sesión se conserva en almacenamiento local.

## Validación

`node tests/cuentas.mjs` prueba alta automática, reentrada, fallo de red, nombre editable, ranking, aislamiento y conflictos. `npm run test:reglas` ejecuta el emulador real de Firestore. Las compilaciones y estas pruebas no sustituyen la comprobación en dispositivos reales.

El splash cubre el arranque real en cada apertura, con animaciones reducidas si el dispositivo lo solicita y salida ante errores de conexión. La publicación del ranking diario requiere actualizar las reglas de Firestore incluidas.
