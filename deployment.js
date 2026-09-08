(function () {
  // Configuración pública, nunca contraseñas ni claves privadas.
  window.CONTINUUM.Deployment = Object.freeze({
    audience: 'private-beta',
    feedbackEmail: '',
    appCheckSiteKey: ''
  });
})();
