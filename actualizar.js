(async () => {
  const status = document.querySelector("#status");
  const continueLink = document.querySelector("#continue");

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    localStorage.clear();
    sessionStorage.clear();

    status.textContent = "Actualización completada. Abriendo la versión nueva…";
    window.location.replace(`./?actualizado=${Date.now()}`);
  } catch (error) {
    status.textContent = "No se pudo completar automáticamente. Pulsa el botón para continuar.";
    continueLink.classList.add("visible");
  }
})();
