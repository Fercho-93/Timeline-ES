// Al cambiar cualquier archivo hay que subir este número: es lo que hace que el
// navegador reinstale el service worker y descarte la caché anterior.
const CACHE = "continuum-v26";
const ASSETS = ["./", "./index.html", "./styles.css", "./cards.js", "./movies.js", "./music.js", "./videogames.js", "./animals.js", "./lifespan.js", "./speed.js", "./inventos.js", "./mundo.js", "./astronomy.js", "./medicine.js", "./countries.js", "./population.js", "./distances.js", "./modes.js", "./drag.js", "./a11y.js", "./mapa.js", "./settings.js", "./app.js", "./online.js", "./manifest.webmanifest", "./icon.svg", "./assets/hero-history-400.webp", "./assets/hero-history-700.webp", "./assets/hero-entertainment-400.webp", "./assets/hero-entertainment-700.webp", "./assets/hero-science-400.webp", "./assets/hero-science-700.webp", "./assets/hero-nature-400.webp", "./assets/hero-nature-700.webp", "./assets/hero-geography-400.webp", "./assets/hero-geography-700.webp", "./assets/hero-mixed-400.webp", "./assets/hero-mixed-700.webp", "./assets/hero-competicion-400.webp", "./assets/hero-competicion-700.webp"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

// Se responde con la copia guardada, que es lo que permite jugar sin conexión, pero
// además se pide la versión del servidor y se guarda para el próximo arranque. Así, si
// se olvida subir el número de la caché, la actualización llega igualmente al abrir la
// aplicación la siguiente vez, en lugar de quedarse congelada.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => {
    const fresh = fetch(event.request).then(response => {
      // Solo se guardan respuestas propias y correctas: un 404 cacheado sobrevive a los despliegues.
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    });
    if (cached) {
      fresh.catch(() => {});
      return cached;
    }
    return fresh.catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : Response.error());
  }));
});
