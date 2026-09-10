# Distribución de Continuum desde Windows

Las comprobaciones de cada propuesta compilan Android y un simulador de iPhone en GitHub Actions. Además, el workflow manual de beta firmada ya ha generado y subido un IPA a TestFlight. No requieren un Mac propio ni credenciales de tiendas. El trabajo manual de iPhone genera un IPA sin firma; no está listo para TestFlight ni para instalar directamente sin un proceso adicional de firma. El resultado de CI no sustituye una prueba física.

`beta-firmada.yml` prepara APK/AAB o IPA firmados cuando el titular haya configurado los
entornos y secretos descritos. Solo se lanza manualmente; la subida a TestFlight requiere
marcar su opción y está desactivada por defecto. Ya se ha ejecutado con credenciales reales en el entorno configurado; debe repetirse para cada versión candidata.
Para iOS se utilizan `APPLE_TEAM_ID`, `APPLE_PROFILE_NAME`, `APPSTORE_ISSUER_ID` y
`APPSTORE_API_KEY_ID` como variables, y `APPSTORE_CERTIFICATES_FILE_BASE64`,
`APPSTORE_CERTIFICATES_PASSWORD` y `APPSTORE_API_PRIVATE_KEY` como secretos. El flujo usa
las acciones de Apple-Actions para importar, descargar perfiles y subir la compilación.

## Enlaces

Las invitaciones nativas apuntan a `https://fercho-93.github.io/Timeline-ES/`, verificada como página de Continuum. `links.js` procesa `appUrlOpen` y el enlace de arranque; acepta solo ese origen y ruta. Conserva la alternativa web. Para que el sistema operativo abra la app falta completar la asociación con el titular:

1. Obtener el Team ID de Apple y la huella SHA-256 del certificado de firma de Android (en Play App Signing, usar el certificado de la app distribuida).
2. Ejecutar `node scripts/domain-associations.mjs TEAM_ID HUELLA` después del build.
3. Publicar ambos archivos en `https://fercho-93.github.io/.well-known/`, desde el alojamiento de la raíz del dominio. Publicarlos solo dentro de este proyecto no sirve. Alternativa: un dominio propio cuya raíz pueda administrarse.
4. Activar Associated Domains en el portal y en el perfil de firma. El proyecto incluye la capacidad `applinks:fercho-93.github.io` y el filtro Android HTTPS con `autoVerify` para ese host y ruta `/Timeline-ES/`; solo se verifican cuando los archivos de asociación de la raíz son accesibles y coinciden con los certificados reales.
5. Instalar una compilación firmada y verificar enlaces con la app cerrada/abierta, y en otro móvil sin instalar. No se declara verificada la asociación antes de esas pruebas.

Referencia: https://capacitorjs.com/docs/guides/deep-links .

## iPhone y TestFlight

Se necesita Apple Developer y una app en App Store Connect con identificador `com.continuum.game`, si está disponible en la cuenta del titular. Antes de distribuir, confirmar la propiedad del identificador y configurar el equipo de firma.

Crear un entorno de GitHub `ios-beta` con acceso restringido a la rama de lanzamiento. Guardar certificado de distribución, contraseña, perfil y clave de App Store Connect únicamente como secretos. Importar el certificado en un llavero temporal del runner, compilar un archive con el Team ID real, exportar con método `app-store-connect` y cargar a App Store Connect con la clave API. Eliminar llavero, perfil y archivos de clave en un paso `always()`. Nunca incluirlos en repositorio, logs ni artefactos. Cada subida necesita un número de compilación nuevo.

La primera beta externa requiere el proceso de revisión correspondiente. Añadir las personas como testers, no como miembros administradores del equipo. La firma y la subida inicial a TestFlight ya se han ejecutado correctamente mediante GitHub Actions. Sigue pendiente la incorporación y prueba con testers externos.

## Android

CI deja un APK de depuración para comprobación técnica. Para distribución estable crear un keystore de lanzamiento y conservar una copia segura fuera del repositorio. Configurar los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD` en un entorno restringido; decodificar el archivo en el temporal del runner. Generar un AAB firmado para una pista de pruebas de Google Play o un APK firmado si se distribuye directamente. Conservar el mismo certificado para que las actualizaciones mantengan datos. Si se usa Play App Signing, registrar sus claves según el procedimiento de Google.

## Prueba de actualización

Instalar una beta, guardar una competición a medias y progreso, actualizar sin desinstalar y reanudar. Repetir con la app en segundo plano, sin red y con una sala pendiente. Registrar los modelos y versiones reales de sistema. Ninguna compilación sin firma acredita que esta prueba se haya realizado.

Fuentes: https://capacitorjs.com/docs/ios , https://developer.apple.com/testflight/ , https://developer.android.com/studio/publish/app-signing , https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md .
