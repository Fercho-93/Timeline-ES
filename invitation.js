(function () {
  'use strict';
  // Esta página no carga Firebase ni crea usuarios: solo entrega la invitación a la app.
  const links = window.CONTINUUM.Links;
  const target = links.parse(location.href);
  const button = document.getElementById('open-app');
  const status = document.getElementById('status');
  if (!target) {
    status.textContent = 'Esta invitación no es válida. Pide a tu amigo que te vuelva a enviar el enlace.';
    return;
  }
  button.href = links.nativeUrl(target);
  button.hidden = false;
  button.addEventListener('click', () => {
    status.textContent = 'Si no se abre Continuum, comprueba que tienes instalada la última beta. Puedes copiar el enlace y abrirlo en Safari o Chrome si WhatsApp no permite abrir la app.';
  });
})();
