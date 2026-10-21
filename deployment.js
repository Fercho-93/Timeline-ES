// Configuración pública del juego (correo de contacto y claves públicas de App Check).
// Aquí nunca van contraseñas ni claves privadas.
(function () {
  // Configuración pública, nunca contraseñas ni claves privadas.
  const config = {
    audience: 'private-beta',
    feedbackEmail: 'feedbackcontinuum@gmail.com',
    // Avisos push del móvil. Apagados hasta integrar FCM y APNs: sin google-services.json (Android) ni
    // aps-environment (iPhone), pedir permiso y registrar el dispositivo falla o cierra la app.
    nativePush: false,
    appCheckSiteKey: '6Lcp5eYtAAAAAFymbjtUg5q2ys6tJyhrBsBOe5Gm',
    // App Check en la app de iPhone (App Attest): datos públicos de la app iOS registrada en
    // Firebase («Continuum iPhone»), los mismos que lleva su GoogleService-Info.plist.
    iosAppCheck: { appId: '1:572227626442:ios:c4b437e879e17fcbd79b33', apiKey: 'AIzaSyBEL34uq5nTN00Xsq6tMbl9aO_zbVEGOVY' }
  };
  // ¿Tiene esta plataforma su prueba de que las peticiones salen de Continuum (App Check)? Web: reCAPTCHA;
  // iPhone: App Attest; Android aún no (Play Integrity exige que la app esté en Google Play). Una versión
  // `public` no abre salas donde no la tenga. Cambiar `audience` a `public` no debe cerrar las salas del iPhone.
  config.salasProtegidas = capacitor => {
    if (!capacitor?.isNativePlatform?.()) return !!config.appCheckSiteKey;
    return capacitor.getPlatform?.() === 'ios' && !!(config.iosAppCheck?.appId && config.iosAppCheck?.apiKey);
  };
  window.CONTINUUM.Deployment = Object.freeze(config);
})();
