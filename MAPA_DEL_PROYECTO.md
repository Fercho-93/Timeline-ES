# Mapa del proyecto

Este documento explica qué hay en cada carpeta y archivo de Continuum, en lenguaje llano y sin
dar nada por sabido. Sirve para orientarse antes de abrir un archivo: dice para qué existe cada
pieza y de qué otras depende.

## Cómo está hecho el juego, en cinco frases

1. Continuum es una **página web**: archivos de texto con instrucciones (JavaScript, `.js`),
   aspecto (hojas de estilo, `.css`) y estructura (`.html`), más imágenes.
2. Esa misma web se **empaqueta como app** de iPhone y de Android con una herramienta llamada
   Capacitor. Las carpetas `ios/` y `android/` son esos envoltorios.
3. Las partidas **online** (con otras personas por internet), las cuentas y el ranking usan
   **Firebase**, un servicio de Google que guarda datos en la nube (su base de datos se llama
   Firestore). Las reglas de quién puede leer o escribir cada dato están en `firestore.rules`.
4. Unas pocas tareas automáticas corren en los servidores de Google (**Cloud Functions**, en
   `functions/`): avisos de duelos y limpieza diaria de datos caducados.
5. Todo se guarda en GitHub. Cada vez que se sube un cambio a la rama `main`, unos **robots de
   GitHub** (workflows, en `.github/workflows/`) pasan las pruebas y publican la web.

## Raíz del proyecto: la app

Casi todo el juego vive suelto en la carpeta principal. Se agrupa aquí por función.

### Arranque y estructura

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página principal: el esqueleto que el navegador abre primero y que carga todo lo demás, en orden. |
| `boot.js` | Lo primero que se ejecuta: decide si se abre el juego, una invitación o la bienvenida. |
| `splash.js`, `splash.css` | La portada animada de apertura mientras carga el juego. |
| `app.js` | El corazón del juego en un solo móvil: dibuja cada pantalla y responde a cada toque. |
| `home-modes-v1.js`, `home-modes-v1.css` | Las entradas ilustradas de la pantalla de Inicio. |
| `modes.js` | La lista de modalidades (mazos y formas de jugar) y sus reglas. La leen tanto el juego local como el online. |
| `engine.js` | Reglas puras de una partida: robar cartas, comprobar si un hueco es correcto. |
| `final.js` | Cómo se decide el ganador cuando hay empate o final numérica. |
| `ghost.js` | El modo «Fantasma» (cartas con poderes) y los niveles de dificultad. |
| `tournament.js` | El modo Competición: varias rondas con mazos distintos. |
| `tiempo.js` | El tiempo por jugada (sin tiempo, 15, 20 o 30 segundos). |
| `session.js` | Un reloj común para que todos los móviles de una partida midan igual el tiempo. |

### Aspecto

| Archivo | Qué es |
| --- | --- |
| `styles.css` | El estilo general: colores, letras, papel, botones. |
| `edition.css` | Ajustes visuales de la interfaz (no de las cartas). Su número `?v=` en `index.html` se sube en cada cambio. |
| `accounts.css` | Estilo de las pantallas de cuenta y bienvenida. |
| `quick-challenges.css` | Estilo de Retos rápidos. |
| `mesa-escala.js`, `mesa-escala.css` | La mesa de juego siempre igual: se dibuja como en la pantalla de un iPhone Pro (402 × 874) y se escala entera a cualquier móvil u ordenador, con las mismas posiciones y proporciones. En tabletas táctiles (≥ 700 × 600) pone `data-tablet="vertical"` u `"horizontal"` en `<html>`: en vertical la mesa sigue escalada; en horizontal no se escala y la partida usa `tablet.css`. |
| `tablet.css` | Diseño adaptable para tabletas (iPad y tabletas Android): partida a dos columnas en horizontal (tu carta a la izquierda, la línea del tiempo a todo lo alto a la derecha, el resultado de cada carta bajo tu carta) e inicio en dos columnas. Todo cuelga de `html[data-tablet]`, así que móvil y ordenador no cambian. Pruebas: `tests/tablet.mjs` y `tests/tablet-browser.mjs`. |
| `tutorial.js`, `tutorial.css` | La guía en vídeo con la que se abre la Guía (y «Ver el manual», bajo «Jugar» en la portada). No se abre sola: solo desde esos dos botones. Escenas que se reproducen solas con un subtítulo corto y un dedo que hace las jugadas; quien mira no tiene que jugar nada. Tres capítulos: lo básico (cartas, línea, turno, fallo y dónde está cada cosa en Inicio), jugar solo (rondas, dificultad, Retos rápidos y reto del día) y en grupo (mano, quién empieza y desempate, con amigos, poderes y online). |
| `effects.js`, `immersion.js`, `mapa.js` | Animaciones, ambiente de la mesa y zoom de la línea de cartas. Solo decoran: no deciden jugadas. |
| `drag.js`, `swipe.js` | Arrastrar cartas con el dedo y deslizar para volver atrás. |
| `a11y.js` | Accesibilidad: poder jugar con teclado o con lector de pantalla. |
| `sonidos.js` | Los efectos de sonido (coger, colocar, acertar, fallar, fin de partida…), sintetizados al momento sin archivos de audio. |
| `icon.svg`, `manifest.webmanifest` | Icono y ficha de la web cuando se instala en el móvil desde el navegador. |

### Mazos de cartas (los datos)

Cada archivo es una lista de cartas con su título, su explicación, el valor que hay que ordenar
(un año, una superficie, una velocidad…) y la fuente de donde sale el dato.

| Archivo | Mazo |
| --- | --- |
| `cards.js` | Historia de España |
| `mundo.js` | Historia mundial |
| `inventos.js` | Inventos y descubrimientos |
| `astronomy.js` | Astronomía y espacio |
| `medicine.js` | Historia de la medicina |
| `movies.js`, `music.js`, `videogames.js` | Cine, música y videojuegos |
| `animals.js`, `speed.js`, `lifespan.js` | Peso, velocidad y longevidad de animales |
| `countries.js`, `population.js`, `distances.js`, `idiomas.js` | Superficie de países, población, distancias entre ciudades y hablantes de cada idioma |
| `quick-challenges-data.js` | Las cartas de los Retos rápidos (temas cortos) |

### Jugador, progreso y guardado

| Archivo | Qué es |
| --- | --- |
| `storage.js` | Guarda datos en el propio móvil y avisa si el guardado falla. |
| `account-storage.js` | Separa lo guardado de cada cuenta, para que dos personas en el mismo móvil no se mezclen. |
| `saves.js` | Guarda una partida a medias para poder seguirla después. |
| `progreso.js` | Estadísticas del jugador: qué ha jugado, qué acierta y qué falla. |
| `identidad.js`, `avatares.js` | El nombre y el dibujo (avatar) del jugador. |
| `moderacion.js` | Filtro de nombres ofensivos o reservados y botón «Denunciar» que se pone junto a los nombres ajenos. |
| `edad.js` | Pregunta una vez si quien juega tiene 14 años o más (o el permiso de sus padres). Sin permiso, el juego funciona sin conexión y sin ranking. |
| `enciclopedia.js` | El Atlas: el álbum de cartas descubiertas. |
| `cartera.js` | Decide a qué mazos tiene acceso cada jugador. Hoy todos están abiertos. |
| `recent-players.js` | Los nombres de las últimas personas con las que se jugó en el mismo móvil. |
| `settings.js` | La pantalla de Ajustes. |
| `updates.js`, `service-worker-258.js`, `actualizar.html`, `actualizar.js` | Actualizaciones: el *service worker* guarda una copia del juego para que funcione sin internet, y su número de versión (`continuum-vNNN`) se sube en cada cambio para que los móviles descarguen lo nuevo. |

### Cuentas y nube (Firebase)

| Archivo | Qué es |
| --- | --- |
| `firebase-client.js` | Conecta con Firebase y con App Check (la comprobación de que quien llama es el juego de verdad). |
| `deployment.js` | Configuración pública: correo de contacto, claves públicas de App Check. Nunca contraseñas. |
| `accounts.js` | Cuentas: invitado automático, entrar con Apple, ranking, borrado de cuenta. |
| `app-config.js` | Cartel remoto: lee `appConfig/current` para pedir actualizar una versión antigua o pausar el online. |
| `push.js` | Avisos al móvil (preparado y apagado: `nativePush` en `deployment.js`). |
| `firestore.rules` | Las reglas de seguridad de la base de datos. **Subirlas a `main` las publica en producción.** |
| `firebase.json`, `firebase-e2e.json` | Configuración de las herramientas de Firebase para publicar y para probar en local. |

### Formas de jugar con otras personas

| Archivo | Qué es |
| --- | --- |
| `online.js` | Partidas online con amigos (salas con código). |
| `public-tables.js`, `public-matchmaking.js`, `public-matchmaking-online.js` | Mesas públicas y partida rápida con desconocidos. |
| `duelo.js` | Duelo por enlace: los dos juegan las mismas cartas, cada uno cuando quiere. |
| `duelo-turnos.js` | Duelo por turnos entre dos móviles a través de internet. |
| `quick-challenges.js`, `quick-challenges-engine.js` | Retos rápidos: la pantalla y sus reglas. |
| `quick-room.js`, `quick-network.js`, `quick-online.js` | Retos rápidos con varias personas: por Wi-Fi local o por internet. |
| `local-multiplayer.js` | La pantalla de «Sin conexión»: jugar en la misma Wi-Fi sin internet. |
| `local-room.js` | Las reglas de una sala sin conexión. |
| `local-session.js`, `local-transport.js`, `local-share.js`, `local-peer.js` | Cómo se conectan los móviles entre sí sin internet (WebRTC por Wi-Fi, o la tecnología de AirDrop entre iPhones). |
| `qr-encode.js`, `qr-scanner.js` | Dibujar y leer los códigos QR de invitación. |
| `qrcode-generator.js`, `jsqr.js` | Bibliotecas de otros autores que hacen el trabajo de los QR (con sus licencias `LICENSE-*.txt`). |
| `links.js`, `invitation.html`, `invitation.js` | Los enlaces de invitación: qué dirección tienen y la página que los abre en la app. |

### Páginas legales

| Archivo | Qué es |
| --- | --- |
| `privacidad.html` | Política de privacidad (la que ve el jugador). `PRIVACIDAD.md` es la misma en el repositorio. |
| `terminos.html` | Condiciones de uso: conducta, nombres, denuncias, propiedad intelectual y responsabilidad. |
| `aviso-legal.html` | Identificación del titular (LSSI art. 10): nombre y correo. Sin NIF ni domicilio mientras el juego sea gratuito y sin ingresos (ver `docs/TIENDAS.md`). |
| `soporte.html` | Contacto y preguntas frecuentes; es la URL de soporte de las tiendas. |
| `borrar-cuenta.html` | Cómo borrar la cuenta (en el juego o por correo): la URL pública que pide Google Play. |
| `licencias.html` | Licencias de las piezas de otros autores. Se genera con `scripts/licencias.mjs`. |
| `LICENSE` | Los derechos del propio juego: es privado, todos los derechos reservados. |

### Configuración de herramientas

| Archivo | Qué es |
| --- | --- |
| `package.json`, `package-lock.json` | La lista de herramientas que necesita el proyecto y los atajos (`npm test`, `npm run build`…). |
| `capacitor.config.json` | Configuración del envoltorio de app móvil. |
| `vite.config.js` | Servidor de pruebas en el ordenador (`npm run dev`). |
| `asset-budget.json` | Límite de peso de las imágenes y del paquete (el de Google Play es de 200 MB), que comprueba `scripts/check-assets.mjs`. |
| `CNAME`, `.nojekyll` | Hacen que la web se publique en GitHub Pages con el dominio `continuumjuego.es`. |
| `.gitignore`, `.gitattributes` | Qué archivos no se guardan en git y cómo se tratan. |

## Carpetas

| Carpeta | Qué hay |
| --- | --- |
| `assets/` | Imágenes y sonido. Una carpeta por mazo (`*-cards/`) con la ilustración de cada carta; `avatars/` (los 36 retratos), `quick-cards/` (Retos rápidos), `texturas/`, y sueltas las portadas de cada sección (`hero-*`, `menu-*`, `mode-*`). |
| `docs/` | Documentación de trabajo: tiendas, modelo de datos, auditorías de mazos y, en `.json`, las fuentes y la procedencia del arte de cada carta. `docs/promo/` guarda el vídeo promocional y la página de la que se graba. |
| `tests/` | Las pruebas automáticas. Cada archivo comprueba una parte del juego; [tests/README.md](tests/README.md) dice qué hace cada una. |
| `scripts/` | Pequeños programas de mantenimiento (ver abajo). |
| `functions/` | Las tareas automáticas en la nube (Cloud Functions). Ver abajo. |
| `ios/` | El envoltorio de la app de iPhone (proyecto de Xcode). Ver abajo. |
| `android/` | El envoltorio de la app de Android (proyecto de Android Studio). Ver abajo. |
| `resources/` | Las imágenes originales del icono y de la pantalla de carga, a partir de las que se generan todos los tamaños (`npm run icons`). |
| `.github/` | Los robots de GitHub (`workflows/`), las plantillas para abrir incidencias y `beta-request.json`. |
| `.well-known/` | Un archivo que demuestra a Apple que el dominio es del juego, para que los enlaces de invitación abran la app (lo genera `scripts/domain-associations.mjs`). |
| `.agents/` | Instrucciones para asistentes de IA que generan ilustraciones de cartas. |
| `dist/`, `node_modules/` | No se guardan en git: los crea el ordenador al compilar (`dist/`) y al instalar herramientas (`node_modules/`). |

### `scripts/`

| Archivo | Qué hace |
| --- | --- |
| `build.mjs` | Prepara la carpeta `dist/` con lo que va dentro de la app móvil. |
| `check-assets.mjs` | Comprueba que ninguna imagen pese demasiado y que no falte ninguna. |
| `audit-content.mjs` | Cuenta las cartas con fuente y actualiza el inventario del arte (`docs/inventario-arte.json`). |
| `audit-licenses.mjs` | Lista las licencias de las herramientas instaladas. |
| `licencias.mjs` | Genera `licencias.html`. |
| `icons.mjs` | Genera los iconos y pantallas de carga de iPhone y Android en todos los tamaños. |
| `borrar-cuenta.mjs` | Borra la cuenta de un jugador entera; lo lanza el workflow «Borrar cuenta de un jugador». |
| `domain-associations.mjs` | Genera los archivos que permiten abrir los enlaces del juego directamente en la app. |
| `render-intro.mjs` | Graba el vídeo promocional de la intro. |

### `functions/` (tareas en la nube)

| Archivo | Qué hace |
| --- | --- |
| `index.js` | Las tareas: avisos de duelos, mantenimiento de duelos caducados, `deleteMyAccount` (borrado de cuenta) y `purgeExpiredData`, la limpieza diaria de las 04:17. |
| `account-purge.js` | Todo lo que se borra al eliminar una cuenta. Lo usan la función de borrado, la limpieza de invitados y el borrado manual. |
| `retention.js` | Cuánto tiempo se guarda cada tipo de dato. Debe coincidir con la política de privacidad. |
| `duel-policy.js` | Cuándo se manda un recordatorio de duelo y con qué texto. |

Se publican a mano desde GitHub (workflow «Publicar Cloud Functions»).

### `ios/` (app de iPhone)

Lo importante está en `ios/App/App/`:

| Archivo | Qué hace |
| --- | --- |
| `AppDelegate.swift`, `MainViewController.swift` | Arrancan la app y registran las piezas nativas de abajo. |
| `AppleSignInPlugin.swift` | «Iniciar sesión con Apple». |
| `AppAttestationPlugin.swift` | App Attest: Apple certifica que la app es la original (para App Check). |
| `LocalPeerPlugin.swift` | Salas cercanas entre iPhones sin Wi-Fi (la tecnología de AirDrop). |
| `LocalLanSignalPlugin.swift` | Ayuda a dos móviles de la misma Wi-Fi a encontrarse. |
| `Info.plist`, `App.entitlements` | Permisos que pide la app (cámara, red local) y capacidades (Apple, App Attest, enlaces). |
| `Assets.xcassets` | Icono y pantalla de carga. |

`ios/App/Podfile` lista las bibliotecas nativas (Capacitor, Firebase App Check).

### `android/` (app de Android)

Lo importante está en `android/app/src/main/`: `AndroidManifest.xml` (permisos), `java/com/continuum/game/`
(`MainActivity.java`, que arranca la app, y `LocalLanSignalPlugin.java`, el mismo ayudante de Wi-Fi
que en iPhone) y `res/` (iconos, pantallas de carga y textos).

### `.github/workflows/` (los robots)

| Archivo | Cuándo corre | Qué hace |
| --- | --- | --- |
| `pruebas.yml` | En cada subida | Pasa `npm test` y comprueba que la app móvil se compila. |
| `zoom-visual.yml` («Pruebas en navegador») | Al cambiar la interfaz | Abre el juego en navegadores de verdad y prueba pantallas pequeñas, zoom, duelos y partidas online. |
| `reglas-firestore.yml` | Al cambiar `firestore.rules` | Prueba las reglas y **las publica en producción**. |
| `functions.yml` | Solo a mano | Publica las Cloud Functions. |
| `borrar-cuenta.yml` | Solo a mano | Borra la cuenta de un jugador (moderación o petición por correo). |
| `beta-firmada.yml` | Al cambiar `.github/beta-request.json` | Compila la app firmada y la sube a TestFlight. Solo cuando lo pida el titular. |

## Documentación

La lista de documentos y de qué trata cada uno está en el [README](README.md#dónde-vive-cada-cosa).
