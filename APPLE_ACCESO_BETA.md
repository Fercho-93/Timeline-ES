# Acceso con Apple

Disponible para todos los jugadores de la app de iPhone (AuthenticationServices + Firebase
Authentication en `timeline-es`). La web y Android siguen siendo de invitado: Apple solo se
ofrece donde el sistema da la identidad. Google todavía no se incorpora.

## Cómo funciona

- El invitado se **vincula** con Apple (`linkWithCredential`), así que conserva su UID y su
  progreso. Si la cuenta de Apple ya tenía progreso, se pregunta cuál conservar; nunca se mezclan.
- Se pide solo el correo (que el usuario puede ocultar). No se importa el nombre real: el juego
  usa su alias público. Los tokens no se guardan ni se registran.
- **Eliminar cuenta** (requisito 5.1.1(v) de App Store): se pide a Apple confirmar la identidad, se
  reautentica, se revoca el acceso con `revokeAccessToken` y solo entonces se borran los datos y el
  usuario. Si la revocación falla, no se borra nada y se puede reintentar.
- Las reglas de Firestore tratan igual a una cuenta de Apple que a un invitado; ya no existe la
  lista `appleBetaTesters`.

## Configuración del titular (una vez)

1. Apple Developer → Identifiers → `com.continuum.game`: habilitar **Sign in with Apple**.
2. Regenerar el perfil de distribución (Profiles → editar → guardar) para que incluya esa capacidad.
   La compilación de GitHub lo descarga sola.
3. Firebase → proyecto `timeline-es` → Authentication → Sign-in method → habilitar **Apple**. Para que
   la revocación funcione hay que rellenar el **Services ID, Team ID, Key ID y clave privada (.p8)**
   de Apple (la clave se crea en Keys con «Sign in with Apple»). La clave privada se introduce solo en
   la consola de Firebase, nunca en el repositorio.
4. Desplegar las reglas nuevas: `firebase deploy --only firestore:rules`.

## Pruebas en iPhone

Entrar con Apple como invitado, con correo oculto, cancelar, cerrar sesión y volver a entrar, entrar con una
cuenta que ya tenía progreso (elegir cada opción), eliminar la cuenta y comprobar en Ajustes del iPhone →
Apple Account → Contraseña y seguridad → Apps que usan Apple Account que Continuum ya no aparece.

Referencias:
- https://firebase.google.com/docs/auth/ios/apple
- https://firebase.google.com/docs/auth/web/apple
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
