# Acceso Apple: primera prueba interna

Esta integración usa AuthenticationServices en iPhone y Firebase Authentication en
`timeline-es`. Google todavía no se incorpora. La web y Android mantienen Apple
desactivado; no intentan abrir un acceso web dentro de la app.

## Configuración del titular

1. En Apple Developer, Identifiers, abrir el App ID `com.continuum.game` y habilitar
   **Sign in with Apple**. No crear otro identificador de aplicación.
2. Regenerar el perfil de distribución usado por el entorno `ios-beta` de GitHub
   para incluir esa capacidad. La compilación normal mantiene sus permisos anteriores;
   solo la prueba interna utiliza `AppAppleTesting.entitlements`.
3. En Firebase, proyecto `timeline-es`, Authentication, Sign-in method, habilitar
   **Apple**. En Configuración del proyecto registrar también la app iOS con
   bundle ID `com.continuum.game` si aún no está registrada.
   La configuración OAuth con Services ID, Team ID, Key ID y clave privada es
   necesaria para los flujos web, Android y la revocación; verificar los campos
   exigidos por la consola siguiendo la documentación oficial. Las claves privadas
   se introducen únicamente en la consola/gestor de secretos, nunca en el repositorio.
4. Abrir Perfil en la app y desplegar **Identificador para pruebas internas**.
   En Firestore crear el documento `appleBetaTesters/IDENTIFICADOR_DEL_INVITADO`
   con el campo booleano `enabled: true`. Solo el administrador puede crear,
   modificar o borrar estas autorizaciones. No dar este permiso a todos los jugadores.
5. En GitHub Actions, **Preparar beta firmada**, Run workflow: plataforma `ios`,
   marcar **Habilitar Apple para probadores autorizados**. No marcar la subida a
   TestFlight hasta tener preparado el grupo interno que recibirá la compilación.
6. Instalar la nueva compilación en el mismo iPhone, abrir Perfil y tocar
   **Continuar con Apple**. La primera entrada vincula Apple al invitado autorizado.
   Firebase conserva su UID y la autorización. No hay migración entre perfiles.

El usuario puede ocultar su correo. El juego conserva el alias público; no importa
su nombre real ni publica su correo. No se almacenan tokens Apple en localStorage
ni se registran en mensajes de diagnóstico.

## Límites de esta primera fase

- La identidad Apple requiere la configuración externa y una app firmada con la
  capacidad correspondiente. Pasar las pruebas de código no verifica ese acceso real.
- Las compilaciones normales devuelven `enabled: false` desde el plugin nativo y
  rechazan sus llamadas de acceso aunque se fuerce el botón desde JavaScript.
- Firestore rechaza el acceso de identidades Apple sin autorización de probador,
  incluso si alguien consigue autenticarse directamente con el SDK. Esto limita
  el acceso a los datos del juego; no es un bloqueo de creación de usuarios en
  Firebase Authentication. Las identidades de invitado siguen funcionando.
- Tras cerrar sesión, una marca local permite volver a mostrar el botón en ese
  dispositivo. Esa marca no concede permisos: la cuenta Apple resultante debe
  seguir autorizada en el servidor. En otro dispositivo hay que autorizar primero
  su invitado para abrir el botón de esta fase interna.
- No hay borrado ni reinicio de datos de beta en este cambio. Los datos podrán
  reiniciarse en una operación aparte antes del lanzamiento.
- El borrado automático de cuentas Apple queda pendiente de la integración de
  revocación de Apple. La prueba interna no borra sus datos parcialmente: ofrece
  el contacto del titular. Antes de habilitar el registro público se debe terminar
  la reautenticación, revocación y eliminación completa, y probarlas.
- Para publicar el acceso Apple a todos habrá que cambiar tanto la configuración
  de compilación como la restricción de probadores del servidor. No basta con
  modificar un botón o el texto «beta».

## Pruebas en iPhone

Comprobar: invitado no autorizado, invitado autorizado, cancelación, correo
oculto, primera vinculación, cerrar sesión y volver a entrar, otra cuenta Apple
no autorizada, revocación del permiso de probador y regreso como invitado.
Comprobar también el juego y los perfiles con los dos tipos de sesión.

Referencias:
- https://firebase.google.com/docs/auth/ios/apple
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
- https://firebase.google.com/docs/auth/web/apple
