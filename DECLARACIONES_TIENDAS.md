# Declaraciones de privacidad ante las tiendas (A.4)

Borrador de las respuestas a los cuestionarios de privacidad de Apple y Google, para copiar directamente al rellenarlos en sus paneles — yo no puedo enviarlos, necesitan tu cuenta de desarrollador. Basado en una revisión real del código: qué SDK de terceros están integrados y qué tratan (A.4.3).

## Qué SDK de terceros hay integrados

Solo **Firebase** (Google), y solo tres de sus productos — revisado en todos los imports del proyecto (`grep` de `firebasejs/.../firebase-*.js`):

- **Firebase Authentication** (`firebase-auth.js`), modo anónimo únicamente. No se pide correo ni contraseña.
- **Cloud Firestore** (`firebase-firestore.js`), la base de datos: perfil, progreso, salas, duelos, ranking.
- **Firebase Cloud Messaging**, pero solo desde el lado de servidor (`functions/index.js`, con `firebase-admin`) para enviar los avisos de turno/invitación — el cliente no importa `firebase-messaging.js`, usa el plugin nativo `@capacitor/push-notifications` en su lugar.

Lo que **no** está integrado, y por tanto no hay que declarar: Firebase Analytics, Firebase Crashlytics, Firebase Remote Config, Firebase App Check (previsto en la documentación de seguridad pero no implementado todavía en el código — ver B.2), ni ningún SDK de publicidad o analítica de terceros ajeno a Firebase.

## Borrador — App Privacy (Apple, A.4.1)

Para cada categoría que pregunta el cuestionario de App Store Connect:

- **Identificadores → ID de usuario**: SÍ se recoge (el UID anónimo de Firebase Authentication). Vinculado a tu identidad dentro de la app (es tu cuenta de invitado), NO se usa para rastrearte fuera de la app, y el motivo es «Funcionalidad de la app».
- **Contenido generado por el usuario → Otro contenido de usuario**: SÍ se recoge (el alias/nombre que eliges). Vinculado a tu cuenta, no para rastreo, motivo «Funcionalidad de la app».
- **Contactos, Información de contacto (email, teléfono), Ubicación, Información financiera, Datos de salud, Historial de navegación/búsquedas**: NO se recoge nada de esto — no hay ningún formulario ni SDK que pida estos datos.
- **Datos de uso / Diagnóstico**: NO hay SDK de analítica o crash reporting integrado hoy (ver arriba); marca que NO se recoge, y revísalo de nuevo si en el futuro se añade Crashlytics o Analytics.
- **¿Se usan los datos para rastrear al usuario entre apps o webs de terceros (tracking)?**: NO — ya confirmado que no hay anuncios ni SDK de tracking.

## Borrador — Data Safety (Google Play, A.4.2)

Mismo contenido, formato de Google: se recogen «Identificadores de la app o cuenta» (el UID anónimo) y «Otra información generada por el usuario» (el alias), ambos cifrados en tránsito (HTTPS, estándar de Firebase), con opción de borrado (Perfil → Eliminar invitado, ver A.1.7). No se comparten con terceros. No hay recogida de ubicación, contactos, financiero, salud, ni datos de uso/analítica.

**Bloqueado**: no se puede rellenar de verdad hasta que exista la cuenta de Google Play Console (ver `COMPRAS_IAP.md`).

## Qué falta cuando llegue el momento de enviarlo

- **A.4.4** (clasificación por edades) no está aquí porque depende del contenido del juego completo (cartas de Historia con temas como guerras, por ejemplo) y de qué mazos estén activos en la versión que se envíe — es una decisión a tomar mirando el cuestionario de cada tienda con el catálogo final delante, no algo que se pueda precompletar sin verlo.
- **A.4.9**: no enviar ninguna de estas declaraciones hasta tener cerrado A.1–A.3 de verdad (con compras reales, no la simulación).
- Si algún día se activa Firebase Analytics, Crashlytics o App Check, este documento hay que revisarlo — cambia lo que hay que declarar.
