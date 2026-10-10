(function () {
  // Configuración pública, nunca contraseñas ni claves privadas.
  window.CONTINUUM.Deployment = Object.freeze({
    audience: 'private-beta',
    feedbackEmail: 'feedbackcontinuum@gmail.com',
    appCheckSiteKey: '6Lcp5eYtAAAAAFymbjtUg5q2ys6tJyhrBsBOe5Gm',
    // App Check en la app de iPhone (App Attest): datos públicos de la app iOS registrada en
    // Firebase («Continuum iPhone»), los mismos que lleva su GoogleService-Info.plist.
    iosAppCheck: { appId: '1:572227626442:ios:c4b437e879e17fcbd79b33', apiKey: 'AIzaSyBEL34uq5nTN00Xsq6tMbl9aO_zbVEGOVY' }
  });
})();
