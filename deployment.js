(function () {
  // Configuración pública, nunca contraseñas ni claves privadas.
  window.CONTINUUM.Deployment = Object.freeze({
    audience: 'private-beta',
    feedbackEmail: 'feedbackcontinuum@gmail.com',
    appCheckSiteKey: '6Lcp5eYtAAAAAFymbjtUg5q2ys6tJyhrBsBOe5Gm',
    // App Check en la app de iPhone (App Attest): datos públicos de la app iOS registrada en
    // Firebase («Continuum iPhone»), los mismos que lleva su GoogleService-Info.plist.
    iosAppCheck: { appId: '', apiKey: '' }
  });
})();
