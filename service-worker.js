// Al cambiar cualquier archivo hay que subir este número: es lo que hace que el
// navegador reinstale el service worker y descarte la caché anterior.
const CACHE = "continuum-v119";
// Las láminas de animales —5,5 MB en casi cien archivos— no se precargan: quien nunca
// abre ese bloque no debería pagar esa descarga solo por instalar la aplicación. La ruta
// `fetch` de más abajo ya guarda en caché cualquier respuesta válida la primera vez que
// se pide, así que la primera carta de un mazo de animales la baja de la red y a partir
// de ahí, con esa carta ya vista, funciona sin conexión igual que el resto.
const ASSETS = [
  "./deployment.js",
  "./privacidad.html",
  "./engine.js", "./links.js",
  "./", "./index.html", "./splash.css", "./splash.js", "./styles.css", "./edition.css", "./cards.js", "./movies.js", "./music.js", "./videogames.js",
  "./animals.js", "./lifespan.js", "./speed.js", "./inventos.js", "./mundo.js", "./astronomy.js",
  "./medicine.js", "./countries.js", "./population.js", "./distances.js", "./modes.js", "./storage.js", "./saves.js", "./updates.js", "./session.js", "./enciclopedia.js", "./progreso.js", "./duelo.js",
  "./ghost.js", "./drag.js", "./a11y.js", "./mapa.js", "./settings.js", "./effects.js", "./app.js", "./online.js",
  "./manifest.webmanifest", "./icon.svg", "./assets/continuum-emblem-800.webp", "./assets/hero-history-400.webp", "./assets/hero-history-700.webp",
  "./assets/hero-entertainment-400.webp", "./assets/hero-entertainment-700.webp", "./assets/hero-science-400.webp",
  "./assets/hero-science-700.webp", "./assets/hero-nature-400.webp", "./assets/hero-nature-700.webp",
  "./assets/hero-geography-400.webp", "./assets/hero-geography-700.webp", "./assets/hero-mixed-400.webp",
  "./assets/hero-mixed-700.webp", "./assets/hero-competicion-400.webp", "./assets/hero-competicion-700.webp",
  "./assets/country-cards/2001.webp",
  "./assets/country-cards/2002.webp",
  "./assets/country-cards/2003.webp",
  "./assets/country-cards/2004.webp",
  "./assets/country-cards/2005.webp",
  "./assets/country-cards/2006.webp",
  "./assets/country-cards/2007.webp",
  "./assets/country-cards/2008.webp",
  "./assets/country-cards/2009.webp",
  "./assets/country-cards/2010.webp",
  "./assets/country-cards/2011.webp",
  "./assets/country-cards/2012.webp",
  "./assets/country-cards/2013.webp",
  "./assets/country-cards/2014.webp",
  "./assets/country-cards/2015.webp",
  "./assets/country-cards/2016.webp",
  "./assets/country-cards/2017.webp",
  "./assets/country-cards/2018.webp",
  "./assets/country-cards/2019.webp",
  "./assets/country-cards/2020.webp",
  "./assets/country-cards/2021.webp",
  "./assets/country-cards/2022.webp",
  "./assets/country-cards/2023.webp",
  "./assets/country-cards/2024.webp",
  "./assets/country-cards/2025.webp",
  "./assets/country-cards/2026.webp",
  "./assets/country-cards/2027.webp",
  "./assets/country-cards/2028.webp",
  "./assets/country-cards/2029.webp",
  "./assets/country-cards/2030.webp",
  "./assets/country-cards/2031.webp",
  "./assets/country-cards/2032.webp",
  "./assets/country-cards/2033.webp",
  "./assets/country-cards/2034.webp",
  "./assets/country-cards/2035.webp",
  "./assets/country-cards/2036.webp",
  "./assets/country-cards/2037.webp",
  "./assets/country-cards/2038.webp",
  "./assets/country-cards/2039.webp",
  "./assets/country-cards/2040.webp",
  "./assets/country-cards/2041.webp",
  "./assets/country-cards/2042.webp",
  "./assets/country-cards/2043.webp",
  "./assets/country-cards/2044.webp",
  "./assets/country-cards/2045.webp",
  "./assets/country-cards/2046.webp",
  "./assets/country-cards/2047.webp",
  "./assets/country-cards/2048.webp",
  "./assets/country-cards/2049.webp",
  "./assets/country-cards/2050.webp",
  "./assets/country-cards/2051.webp",
  "./assets/country-cards/2060.webp",
  "./assets/country-cards/2061.webp",
  "./assets/country-cards/2062.webp",
  "./assets/country-cards/2063.webp",
  "./assets/country-cards/2064.webp",
  "./assets/country-cards/2065.webp",
  "./assets/country-cards/2066.webp",
  "./assets/country-cards/2067.webp",
  "./assets/country-cards/2068.webp",
  "./assets/country-cards/2069.webp",
  "./assets/country-cards/2070.webp",
  "./assets/country-cards/2071.webp",
  "./assets/country-cards/2072.webp"
];

self.addEventListener("install", event => {
  // Una caché de aplicación nueva no basta si la caché HTTP aún considera frescos los
  // archivos antiguos. Cada instalación debe obtener realmente la versión publicada.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && /^(continuum-|hilo-modos-)/.test(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

// Activar solo por petición explícita y sin otras pestañas que puedan estar jugando.
self.addEventListener("message", event => {
  if (event.data?.type !== "ACTIVATE_UPDATE") return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const own = clients.filter(client => client.url.startsWith(self.registration.scope));
    if (own.length > 1) event.source?.postMessage({ type: "UPDATE_BLOCKED" });
    else return self.skipWaiting();
  }));
});

// Cada versión sirve su propia copia estable; nunca mezcla código de dos despliegues.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url, self.location.href);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic") {
        try { await cache.put(event.request, response.clone()); } catch { /* La red sigue disponible aunque no quepa la imagen. */ }
      }
      return response;
    } catch {
      return event.request.mode === "navigate" ? (await cache.match("./index.html")) || Response.error() : Response.error();
    }
  })());
});
