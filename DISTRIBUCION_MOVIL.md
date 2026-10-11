# Distribución de Continuum en iPhone y Android

No hace falta un Mac propio: todo se compila en GitHub Actions. Cada propuesta y cada subida a
`main` compilan Android (APK de depuración) y un iPhone sin firma (`.github/workflows/pruebas.yml`)
como comprobación técnica; eso no sustituye una prueba física.

## Beta firmada y TestFlight

`.github/workflows/beta-firmada.yml` prepara las compilaciones firmadas. Se lanza de dos maneras:

- **Subiendo a `main` un cambio en `.github/beta-request.json`.** Es la vía habitual (también
  desde una sesión sin acceso a `workflow_dispatch`). Compila Android e iOS y **sube el IPA a
  TestFlight**. El archivo es un registro de la petición (versión, caché y motivo); lo que dispara
  el workflow es el cambio, no su contenido. Hacerlo solo cuando el titular pida una beta.
- **A mano**, desde Actions, eligiendo plataforma; ahí la subida a TestFlight es una opción
  desactivada por defecto.

Ya se ha ejecutado con credenciales reales: la firma y la subida a TestFlight funcionan. Cada
subida necesita un número de compilación nuevo (`github.run_number`). La versión visible de la
beta (`0.1.1`) está en `android/app/build.gradle` (`versionName`) y en
`ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`), y es distinta del número de caché
del service worker.

Para iOS se usan las variables `APPLE_TEAM_ID`, `APPLE_PROFILE_NAME`, `APPSTORE_ISSUER_ID` y
`APPSTORE_API_KEY_ID`, y los secretos `APPSTORE_CERTIFICATES_FILE_BASE64`,
`APPSTORE_CERTIFICATES_PASSWORD` y `APPSTORE_API_PRIVATE_KEY`, en el entorno de GitHub
`ios-beta`. El flujo importa el certificado en un llavero temporal, descarga el perfil, compila y
exporta con el método `app-store-connect`, sube con la clave API y lo borra todo en un paso
`always()`. Las acciones de Apple que reciben los certificados están fijadas a un commit. Nada de
esto va al repositorio, a los registros ni a los artefactos.

Para Android, los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`,
`ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD` en el entorno `android-beta`. El keystore se decodifica
en el temporal del runner y se borra al acabar; el resultado (AAB y APK) queda 7 días como
artefacto. Conservar una copia segura del keystore fuera del repositorio y usar siempre el mismo
certificado, o las actualizaciones no conservarán los datos. Si se usa Play App Signing,
registrar sus claves según el procedimiento de Google.

## TestFlight y Google Play

- La app está en App Store Connect con el identificador `com.continuum.game`.
- Añadir a las personas como testers, no como miembros del equipo. La primera beta externa pasa
  la revisión de Apple; sigue pendiente invitar y probar con testers externos.
- Google Play Console sigue pendiente. Ficha, textos y declaraciones en
  [docs/TIENDAS.md](docs/TIENDAS.md).

## Enlaces

El juego vive en `https://continuumjuego.es/` (GitHub Pages, archivo `CNAME`). `links.js` acepta
`continuumjuego.es`, `www.continuumjuego.es` y la dirección antigua
`https://fercho-93.github.io/Timeline-ES/` (GitHub redirige la antigua, así que los enlaces ya
enviados siguen funcionando), y procesa `appUrlOpen` y el enlace de arranque. Las invitaciones
salen con `PUBLIC_URL`, que es el dominio.

Para que el sistema abra la app al tocar un enlace:

1. **iOS — hecho.** `node scripts/domain-associations.mjs TEAM_ID HUELLA` generó
   `.well-known/apple-app-site-association` con el Team ID `ZRFCQ78M82`; GitHub Pages lo publica en
   `https://continuumjuego.es/.well-known/`. El proyecto declara `applinks:continuumjuego.es`,
   `applinks:www.continuumjuego.es` (y conserva el antiguo). Verificado en TestFlight: tocar un
   enlace abre la app.
2. **Android — pendiente.** Falta la huella SHA-256 del certificado con que se distribuya (en Play
   App Signing, el de la app distribuida): `node scripts/domain-associations.mjs - HUELLA` escribe
   `.well-known/assetlinks.json`. El filtro HTTPS con `autoVerify` ya está en el manifiesto.
3. Verificar con la app cerrada y abierta, y en otro móvil sin la app.

Cada dirección web guarda sus propios datos: quien jugaba en la dirección antigua de GitHub
empieza en `continuumjuego.es` con otro invitado. Para llevarse el progreso sin cuenta de Apple,
«Copiar mi perfil» en el Atlas y «Recuperar ese perfil» en la nueva dirección. Las apps nativas no
se ven afectadas.

Referencia: https://capacitorjs.com/docs/guides/deep-links .

## Prueba de actualización

Instalar una beta, guardar una competición a medias y progreso, actualizar sin desinstalar y
reanudar. Repetir con la app en segundo plano, sin red y con una sala pendiente. Registrar los
modelos y versiones de sistema. Ninguna compilación sin firma acredita esta prueba.

Fuentes: https://capacitorjs.com/docs/ios , https://developer.apple.com/testflight/ ,
https://developer.android.com/studio/publish/app-signing .
