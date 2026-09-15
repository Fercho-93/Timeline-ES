# Cuentas y ranking social de Continuum

La temporada `launch-1` exige registro desde la primera apertura. No importa perfiles,
récords ni partidas de la beta anónima. No ejecuta un borrado masivo de Firebase: los
registros históricos los reseteará el titular por separado. Las copias locales nuevas
se separan por temporada y UID; los ajustes de accesibilidad siguen siendo del dispositivo.

## Qué implementa

- Correo y contraseña con verificación, recuperación de contraseña y sesión persistente.
- Google y Apple en web; en Capacitor se obtienen credenciales con el plugin nativo y se
  inicia la misma sesión Firebase JS que usa Firestore. No se abre OAuth dentro de la WebView.
- El juego no se carga hasta tener usuario no anónimo, correo verificado y perfil inicial.
  Es necesaria conexión al abrir para confirmar la cuenta y recuperar la versión remota.
- Alias público (no necesariamente único), avatar de catálogo y aceptación informativa.
- Perfil y reto/récords se sincronizan; las partidas sin terminar permanecen en cada móvil.
- Guardado tras dos segundos sin cambios, al pasar a segundo plano y al volver la conexión.
  Los cambios pendientes quedan en el espacio local de esa cuenta. No se promete guardado
  remoto si la aplicación se cierra antes de que termine. Perfil permite Guardar ahora.
- Control de revisión por transacción: otra versión no se sobrescribe silenciosamente.
  Ante conflicto se ofrece descargar la copia local y cargar expresamente la versión remota.
  No se suman totales de dos dispositivos porque se duplicarían partidas. Se recomienda jugar
  en un dispositivo cada vez; Web Locks impide dos pestañas del mismo navegador cuando existe.
- Ranking social: primeros 50 por aciertos personales en solitario y varios móviles (se excluye pasar un móvil), con alias y avatar.
  Dos escrituras por sincronización (progreso y ranking) y consulta bajo demanda, sin listener
  global. No representa habilidad comparable entre modalidades ni resultados antitrampas.
- Cerrar sesión conserva la copia de esa cuenta sin exponerla a otra. Eliminar cuenta pide
  reautenticación y borra perfil, progreso, ranking y Firebase Auth. Apple revoca el acceso.
  Los documentos de salas compartidas no se borran con el perfil: se sujetan a su retención,
  todavía pendiente de configurar. Las copias en otros dispositivos no se borran remotamente.

## Activación externa necesaria antes de distribuir

No basta con fusionar código: comprobar y completar estos puntos en las consolas del titular.
No se ha cambiado de plan, activado facturación ni contratado servicios.

1. Firebase `timeline-es`: confirmar plan **Spark**. Authentication: habilitar **Correo y
   contraseña** (no enlace mágico), **Google** y **Apple**. Configurar el correo de soporte,
   dominios autorizados (incluido `fercho-93.github.io`) y plantillas en español.
2. Apple Developer: habilitar Sign in with Apple en `com.continuum.game`, regenerar el perfil
   de firma con esa capacidad y configurar Service ID, Team ID, Key ID y clave privada en el
   proveedor Apple de Firebase. Registrar retorno
   `https://timeline-es.firebaseapp.com/__/auth/handler`. Configurar el relay de correo de Apple.
   Nunca subir la clave privada al repositorio.
3. Firebase: registrar apps Android e iOS con `com.continuum.game`. Google Android requiere
   las huellas SHA-1/SHA-256 de la firma de pruebas y, al publicar, de Play App Signing.
   Descargar la configuración real después de habilitar Google.
4. Android: `android/app/google-services.json`, con cliente OAuth web. En Actions guardar
   su base64 como `GOOGLE_SERVICES_JSON_BASE64` en el entorno android-beta.
5. iOS: `ios/App/App/GoogleService-Info.plist`, con `REVERSED_CLIENT_ID`. En Actions guardar
   su base64 como `GOOGLE_SERVICE_INFO_PLIST_BASE64` en ios-beta. El preparador añade el plist
   a recursos Xcode y el esquema URL de Google a Info.plist. El Podfile incluye Google.
6. Las compilaciones firmadas ejecutan `scripts/prepare-native-auth.mjs`: fallan claramente si
   falta configuración real. No distribuir una compilación que omita esta comprobación.
7. Publicar `firestore.rules` **junto al cliente nuevo**. El workflow ya existente ejecuta
   las pruebas y despliega usando `FIREBASE_SERVICE_ACCOUNT`; requiere ese secreto configurado.
   Los clientes anónimos antiguos dejan de tener acceso: es un cambio de lanzamiento.
8. Probar altas, verificación, recuperación, Google/Apple, enlace de invitación tras login,
   reapertura, segundo dispositivo y eliminación en un iPhone y Android reales.
   Actualizar las fichas de privacidad de las tiendas. Completar responsable/contacto en la
   política de privacidad antes de abrir el acceso públicamente.

## Datos y permisos

- `playerProfiles/{uid}`: alias, avatar, temporada, fecha de alta y versión de privacidad;
  privado para su titular. No contiene contraseña ni publica correo.
- `playerProgress/{uid}`: JSON del perfil y récords, contadores de resumen, revisión y fecha;
  lectura/escritura solo de su titular verificado; tamaño limitado.
- `socialRanking/{uid}`: proyección pública a usuarios verificados; consultas de hasta 50.
  Las reglas exigen que los contadores coincidan con el progreso guardado en la misma operación,
  pero **ese progreso lo declara el cliente**. No es una prueba de juego limpio.
- Las salas usan el mismo UID y rechazan identidades anónimas/no verificadas.
- No se despliega el servidor experimental ni se activan Cloud Functions o Cloud Storage.
  Firestore Spark tiene cuotas compartidas con las salas. Si se agotan, puede fallar el
  guardado o la lectura. No prometer disponibilidad ilimitada por 0 €.

## Verificación

`node tests/cuentas.mjs` prueba el bloqueo, verificación, perfil, arranque limpio, recuperación,
aislamiento y conflictos con un adaptador simulado. `tests/cuentas-reglas.mjs` prueba permisos,
cuotas de consulta, revisiones y borrado en el emulador oficial, incluido en `npm run test:reglas`.
Los tests de motor usan `game-fixture.mjs` para arrancar después de la frontera de acceso;
no constituyen pruebas de los proveedores OAuth ni de un dispositivo nativo.

Fuentes: https://firebase.google.com/docs/auth/web/password-auth
https://firebase.google.com/docs/auth/web/google-signin
https://firebase.google.com/docs/auth/web/apple
https://capawesome.io/docs/sdks/capacitor/firebase/authentication/
https://firebase.google.com/pricing
