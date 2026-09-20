// Al cambiar cualquier archivo hay que subir este número: es lo que hace que el
// navegador reinstale el service worker y descarte la caché anterior.
const CACHE = "continuum-v298";
// Las láminas de animales —5,5 MB en casi cien archivos— no se precargan: quien nunca
// abre ese bloque no debería pagar esa descarga solo por instalar la aplicación. La ruta
// `fetch` de más abajo ya guarda en caché cualquier respuesta válida la primera vez que
// se pide, así que la primera carta de un mazo de animales la baja de la red y a partir
// de ahí, con esa carta ya vista, funciona sin conexión igual que el resto.
const ASSETS = [
  "./assets/hero-quick-400.webp", "./assets/hero-quick-700.webp", "./assets/quick-cards/social-1.webp", "./assets/quick-cards/social-2.webp", "./assets/quick-cards/social-3.webp", "./assets/quick-cards/social-4.webp", "./assets/quick-cards/social-5.webp", "./assets/quick-cards/social-6.webp", "./assets/quick-cards/social-7.webp", "./assets/quick-cards/social-8.webp", "./assets/quick-cards/social-9.webp", "./assets/quick-cards/social-10.webp", "./assets/quick-cards/social-11.webp", "./assets/quick-cards/social-12.webp", "./assets/quick-cards/social-13.webp", "./assets/quick-cards/social-14.webp", "./assets/quick-cards/social-15.webp", "./assets/quick-cards/wwii-1.webp", "./assets/quick-cards/wwii-2.webp", "./assets/quick-cards/wwii-3.webp", "./assets/quick-cards/wwii-4.webp", "./assets/quick-cards/wwii-5.webp", "./assets/quick-cards/wwii-6.webp", "./assets/quick-cards/wwii-7.webp", "./assets/quick-cards/wwii-8.webp", "./assets/quick-cards/wwii-9.webp", "./assets/quick-cards/wwii-10.webp", "./assets/quick-cards/wwii-11.webp", "./assets/quick-cards/civil-war-1.webp", "./assets/quick-cards/civil-war-2.webp", "./assets/quick-cards/civil-war-3.webp", "./assets/quick-cards/civil-war-4.webp", "./assets/quick-cards/civil-war-5.webp", "./assets/quick-cards/civil-war-6.webp", "./assets/quick-cards/civil-war-7.webp", "./assets/quick-cards/civil-war-8.webp", "./assets/quick-cards/kings-1.webp", "./assets/quick-cards/kings-2.webp", "./assets/quick-cards/kings-3.webp", "./assets/quick-cards/kings-4.webp", "./assets/quick-cards/kings-5.webp", "./assets/quick-cards/kings-6.webp", "./assets/quick-cards/kings-7.webp", "./assets/quick-cards/kings-8.webp", "./assets/quick-cards/kings-9.webp", "./assets/quick-cards/kings-10.webp", "./assets/quick-cards/consoles-1.webp", "./assets/quick-cards/consoles-2.webp", "./assets/quick-cards/consoles-3.webp", "./assets/quick-cards/consoles-4.webp", "./assets/quick-cards/consoles-5.webp", "./assets/quick-cards/consoles-6.webp", "./assets/quick-cards/consoles-7.webp", "./assets/quick-cards/consoles-8.webp", "./assets/quick-cards/consoles-9.webp", "./assets/quick-cards/consoles-10.webp", "./assets/quick-cards/consoles-11.webp", "./assets/quick-cards/consoles-12.webp", "./assets/quick-cards/oscars-1.webp", "./assets/quick-cards/oscars-2.webp", "./assets/quick-cards/oscars-3.webp", "./assets/quick-cards/oscars-4.webp", "./assets/quick-cards/oscars-5.webp", "./assets/quick-cards/oscars-6.webp", "./assets/quick-cards/oscars-7.webp", "./assets/quick-cards/oscars-8.webp", "./assets/quick-cards/oscars-9.webp", "./assets/quick-cards/oscars-10.webp", "./assets/quick-cards/companies-founded-1.webp", "./assets/quick-cards/companies-founded-2.webp", "./assets/quick-cards/companies-founded-3.webp", "./assets/quick-cards/companies-founded-4.webp", "./assets/quick-cards/companies-founded-5.webp", "./assets/quick-cards/companies-founded-6.webp", "./assets/quick-cards/companies-founded-7.webp", "./assets/quick-cards/companies-founded-8.webp", "./assets/quick-cards/companies-founded-9.webp", "./assets/quick-cards/companies-founded-10.webp", "./assets/quick-cards/companies-founded-11.webp", "./assets/quick-cards/companies-founded-12.webp", "./assets/quick-cards/timezones-june-1.webp", "./assets/quick-cards/timezones-june-2.webp", "./assets/quick-cards/timezones-june-3.webp", "./assets/quick-cards/timezones-june-4.webp", "./assets/quick-cards/timezones-june-5.webp", "./assets/quick-cards/timezones-june-6.webp", "./assets/quick-cards/timezones-june-7.webp", "./assets/quick-cards/timezones-june-8.webp", "./assets/quick-cards/timezones-june-9.webp", "./assets/quick-cards/timezones-june-10.webp", "./assets/quick-cards/timezones-june-11.webp", "./assets/quick-cards/timezones-june-12.webp", "./assets/quick-cards/cities-east-west-1.webp", "./assets/quick-cards/cities-east-west-2.webp", "./assets/quick-cards/cities-east-west-3.webp", "./assets/quick-cards/cities-east-west-4.webp", "./assets/quick-cards/cities-east-west-5.webp", "./assets/quick-cards/cities-east-west-6.webp", "./assets/quick-cards/cities-east-west-7.webp", "./assets/quick-cards/cities-east-west-8.webp", "./assets/quick-cards/cities-east-west-9.webp", "./assets/quick-cards/cities-east-west-10.webp", "./assets/quick-cards/cities-north-south-1.webp", "./assets/quick-cards/cities-north-south-2.webp", "./assets/quick-cards/cities-north-south-3.webp", "./assets/quick-cards/cities-north-south-4.webp", "./assets/quick-cards/cities-north-south-5.webp", "./assets/quick-cards/cities-north-south-6.webp", "./assets/quick-cards/cities-north-south-7.webp", "./assets/quick-cards/cities-north-south-8.webp", "./assets/quick-cards/cities-north-south-9.webp", "./assets/quick-cards/body-1.webp", "./assets/quick-cards/body-2.webp", "./assets/quick-cards/body-3.webp", "./assets/quick-cards/body-4.webp", "./assets/quick-cards/body-5.webp", "./assets/quick-cards/body-6.webp", "./assets/quick-cards/body-7.webp", "./assets/quick-cards/body-8.webp", "./assets/quick-cards/body-9.webp", "./assets/quick-cards/body-10.webp", "./assets/quick-cards/series-seasons-1.webp", "./assets/quick-cards/series-seasons-2.webp", "./assets/quick-cards/series-seasons-3.webp", "./assets/quick-cards/series-seasons-4.webp", "./assets/quick-cards/series-seasons-5.webp", "./assets/quick-cards/series-seasons-6.webp", "./assets/quick-cards/series-seasons-7.webp", "./assets/quick-cards/series-seasons-8.webp", "./assets/quick-cards/series-seasons-9.webp", "./assets/quick-cards/series-seasons-10.webp", "./assets/quick-cards/series-seasons-11.webp", "./assets/quick-cards/buildings-1.webp", "./assets/quick-cards/buildings-2.webp", "./assets/quick-cards/buildings-3.webp", "./assets/quick-cards/buildings-4.webp", "./assets/quick-cards/buildings-5.webp", "./assets/quick-cards/buildings-6.webp", "./assets/quick-cards/buildings-7.webp", "./assets/quick-cards/buildings-8.webp", "./assets/quick-cards/buildings-9.webp", "./assets/quick-cards/rivers-spain-1.webp", "./assets/quick-cards/rivers-spain-2.webp", "./assets/quick-cards/rivers-spain-3.webp", "./assets/quick-cards/rivers-spain-4.webp", "./assets/quick-cards/rivers-spain-5.webp", "./assets/quick-cards/rivers-spain-6.webp", "./assets/quick-cards/rivers-spain-7.webp", "./assets/quick-cards/rivers-spain-8.webp", "./assets/quick-cards/rivers-spain-9.webp", "./assets/quick-cards/rivers-spain-10.webp", "./assets/quick-cards/foods-kcal-1.webp", "./assets/quick-cards/foods-kcal-2.webp", "./assets/quick-cards/foods-kcal-3.webp", "./assets/quick-cards/foods-kcal-4.webp", "./assets/quick-cards/foods-kcal-5.webp", "./assets/quick-cards/foods-kcal-6.webp", "./assets/quick-cards/foods-kcal-7.webp", "./assets/quick-cards/foods-kcal-8.webp", "./assets/quick-cards/foods-kcal-9.webp", "./assets/quick-cards/foods-kcal-10.webp", "./assets/quick-cards/foods-kcal-11.webp", "./assets/quick-cards/foods-kcal-12.webp", "./assets/quick-cards/foods-kcal-13.webp", "./assets/quick-cards/foods-kcal-14.webp", "./assets/quick-cards/albums-sales-1.webp", "./assets/quick-cards/albums-sales-2.webp", "./assets/quick-cards/albums-sales-3.webp", "./assets/quick-cards/albums-sales-4.webp", "./assets/quick-cards/albums-sales-5.webp", "./assets/quick-cards/albums-sales-6.webp", "./assets/quick-cards/albums-sales-7.webp", "./assets/quick-cards/albums-sales-8.webp", "./assets/quick-cards/albums-sales-9.webp", "./assets/quick-cards/stadiums-1.webp", "./assets/quick-cards/stadiums-2.webp", "./assets/quick-cards/stadiums-3.webp", "./assets/quick-cards/stadiums-4.webp", "./assets/quick-cards/stadiums-5.webp", "./assets/quick-cards/stadiums-6.webp", "./assets/quick-cards/stadiums-7.webp", "./assets/quick-cards/stadiums-8.webp", "./assets/quick-cards/stadiums-9.webp", "./assets/quick-cards/stadiums-10.webp",
  "./quick-room.js", "./quick-network.js", "./quick-online.js", "./quick-challenges.css", "./quick-challenges-data.js", "./quick-challenges-engine.js", "./quick-challenges.js",
  "./assets/audio/CREDITS.md",
  "./assets/competition-engraving.webp",
  "./assets/mode-walk-solo.webp", "./assets/mode-walk-multi.webp",
  "./deployment.js", "./accounts.css", "./firebase-client.js", "./account-storage.js", "./recent-players.js", "./accounts.js", "./boot.js",
  "./privacidad.html",
  "./engine.js", "./final.js", "./tournament.js", "./links.js",
  "./", "./index.html", "./splash.css", "./splash.js", "./styles.css", "./edition.css", "./service-worker-258.js", "./cards.js", "./movies.js", "./music.js", "./videogames.js",
  "./animals.js", "./lifespan.js", "./speed.js", "./inventos.js", "./mundo.js", "./astronomy.js",
  "./medicine.js", "./countries.js", "./population.js", "./idiomas.js", "./distances.js", "./modes.js", "./storage.js", "./saves.js", "./updates.js", "./session.js", "./enciclopedia.js", "./progreso.js", "./cartera.js", "./duelo.js", "./duelo-turnos.js", "./push.js", "./local-transport.js", "./local-room.js", "./local-session.js", "./local-share.js", "./local-multiplayer.js",
  "./ghost.js", "./drag.js", "./swipe.js", "./a11y.js", "./mapa.js", "./settings.js", "./effects.js", "./ambience.js", "./immersion.js", "./app.js", "./online.js",
  "./manifest.webmanifest", "./icon.svg", "./assets/continuum-emblem-800.webp", "./assets/continuum-splash-clean-v3.webp",
  "./assets/world-cards/5009-battle-marathon.webp", "./assets/medicine-cards/9001-hippocratic-corpus.webp", "./assets/astronomy-cards/first-earth-photo.webp",
  "./assets/world-cards/5022-vesuvius-eruption.webp", "./assets/world-cards/5002-great-pyramid-giza.webp",
  "./assets/hero-history-400.webp", "./assets/hero-history-700.webp",
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
  "./assets/country-cards/2072.webp",
  "./assets/population-cards/3001.webp",
  "./assets/population-cards/3002.webp",
  "./assets/population-cards/3003.webp",
  "./assets/population-cards/3004.webp",
  "./assets/population-cards/3005.webp",
  "./assets/population-cards/3006.webp",
  "./assets/population-cards/3007.webp",
  "./assets/population-cards/3008.webp",
  "./assets/population-cards/3009.webp",
  "./assets/population-cards/3010.webp",
  "./assets/population-cards/3011.webp",
  "./assets/population-cards/3012.webp",
  "./assets/population-cards/3013.webp",
  "./assets/population-cards/3014.webp",
  "./assets/population-cards/3015.webp",
  "./assets/population-cards/3016.webp",
  "./assets/population-cards/3017.webp",
  "./assets/population-cards/3018.webp",
  "./assets/population-cards/3019.webp",
  "./assets/population-cards/3020.webp",
  "./assets/population-cards/3021.webp",
  "./assets/population-cards/3022.webp",
  "./assets/population-cards/3023.webp",
  "./assets/population-cards/3024.webp",
  "./assets/population-cards/3025.webp",
  "./assets/population-cards/3026.webp",
  "./assets/population-cards/3027.webp",
  "./assets/population-cards/3028.webp",
  "./assets/population-cards/3029.webp",
  "./assets/population-cards/3030.webp",
  "./assets/population-cards/3031.webp",
  "./assets/population-cards/3032.webp",
  "./assets/population-cards/3033.webp",
  "./assets/population-cards/3034.webp",
  "./assets/population-cards/3035.webp",
  "./assets/population-cards/3036.webp",
  "./assets/population-cards/3037.webp",
  "./assets/population-cards/3038.webp",
  "./assets/population-cards/3039.webp",
  "./assets/population-cards/3040.webp",
  "./assets/population-cards/3041.webp",
  "./assets/population-cards/3042.webp",
  "./assets/population-cards/3043.webp",
  "./assets/population-cards/3044.webp",
  "./assets/population-cards/3045.webp",
  "./assets/population-cards/3046.webp",
  "./assets/population-cards/3047.webp",
  "./assets/population-cards/3048.webp",
  "./assets/population-cards/3049.webp",
  "./assets/population-cards/3050.webp",
  "./assets/population-cards/3051.webp",
  "./assets/population-cards/3052.webp",
  "./assets/population-cards/3053.webp",
  "./assets/population-cards/3054.webp",
  "./assets/population-cards/3055.webp",
  "./assets/population-cards/3056.webp",
  "./assets/population-cards/3057.webp",
  "./assets/population-cards/3058.webp",
  "./assets/population-cards/3059.webp",
  "./assets/population-cards/3060.webp",
  "./assets/population-cards/3061.webp",
  "./assets/population-cards/3062.webp",
  "./assets/population-cards/3063.webp",
  "./assets/population-cards/3064.webp",
  "./assets/population-cards/3065.webp",
  "./assets/population-cards/3066.webp",
  "./assets/population-cards/3067.webp",
  "./assets/population-cards/3068.webp",
  "./assets/population-cards/3069.webp",
  "./assets/population-cards/3070.webp",
  "./assets/population-cards/3071.webp",
  "./assets/population-cards/3072.webp",
  "./assets/population-cards/3073.webp",
  "./assets/population-cards/3074.webp",
  "./assets/population-cards/3075.webp",
  "./assets/population-cards/3076.webp",
  "./assets/population-cards/3077.webp",
  "./assets/language-cards/14001.webp",
  "./assets/language-cards/14002.webp",
  "./assets/language-cards/14003.webp",
  "./assets/language-cards/14004.webp",
  "./assets/language-cards/14005.webp",
  "./assets/language-cards/14006.webp",
  "./assets/language-cards/14007.webp",
  "./assets/language-cards/14008.webp",
  "./assets/language-cards/14009.webp",
  "./assets/language-cards/14010.webp",
  "./assets/language-cards/14011.webp",
  "./assets/language-cards/14012.webp",
  "./assets/language-cards/14013.webp",
  "./assets/language-cards/14014.webp",
  "./assets/language-cards/14015.webp",
  "./assets/language-cards/14016.webp",
  "./assets/language-cards/14017.webp",
  "./assets/language-cards/14018.webp",
  "./assets/language-cards/14019.webp",
  "./assets/language-cards/14020.webp",
  "./assets/language-cards/14021.webp",
  "./assets/language-cards/14022.webp",
  "./assets/language-cards/14023.webp",
  "./assets/language-cards/14024.webp",
  "./assets/language-cards/14025.webp",
  "./assets/language-cards/14026.webp",
  "./assets/language-cards/14027.webp",
  "./assets/language-cards/14028.webp",
  "./assets/language-cards/14029.webp",
  "./assets/language-cards/14030.webp",
  "./assets/language-cards/14031.webp",
  "./assets/language-cards/14032.webp",
  "./assets/language-cards/14033.webp",
  "./assets/language-cards/14034.webp",
  "./assets/language-cards/14035.webp",
  "./assets/language-cards/14036.webp",
  "./assets/language-cards/14037.webp",
  "./assets/language-cards/14038.webp",
  "./assets/language-cards/14039.webp",
  "./assets/language-cards/14040.webp",
  "./assets/language-cards/14041.webp",
  "./assets/language-cards/14042.webp",
  "./assets/language-cards/14043.webp",
  "./assets/language-cards/14044.webp",
  "./assets/language-cards/14045.webp",
  "./assets/language-cards/14046.webp",
  "./assets/language-cards/14047.webp",
  "./assets/language-cards/14048.webp",
  "./assets/language-cards/14049.webp",
  "./assets/language-cards/14050.webp"
];

// Las seis canciones —27 MB— tampoco entran en la instalación. La música es un ajuste
// opcional y apagado de fábrica: nadie debería descargar eso solo por abrir el juego, y
// mientras se descargaba competía por la conexión justo cuando la primera pista tiene
// que sonar. Se guardan de una en una al activar la versión, sin bloquear la instalación,
// y si esa tarea se interrumpe la ruta `fetch` las conserva la primera vez que suenan.
const MUSIC = [
  "./assets/audio/v1.mp3", "./assets/audio/v2.mp3", "./assets/audio/v3.mp3",
  "./assets/audio/v4.mp3", "./assets/audio/v5.mp3", "./assets/audio/v6.mp3"
];

async function storeMusic() {
  const cache = await caches.open(CACHE);
  for (const url of MUSIC) {
    try {
      if (await cache.match(url)) continue;
      const request = new Request(url, { cache: "reload" });
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response);
    } catch { return; /* Sin conexión: se intentará en la siguiente activación. */ }
  }
}

self.addEventListener("install", event => {
  // Una caché de aplicación nueva no basta si la caché HTTP aún considera frescos los
  // archivos antiguos. Cada instalación debe obtener realmente la versión publicada.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && /^(continuum-|hilo-modos-)/.test(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
  // Fuera de `waitUntil` a propósito: mientras el trabajador está activándose, las
  // peticiones de la página esperan, y esto son 27 MB. La música se va guardando por su
  // cuenta; si el navegador detiene el trabajador antes de acabar, la ruta `fetch` la
  // guarda igual la primera vez que suena y la siguiente activación retoma el resto.
  void storeMusic();
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
