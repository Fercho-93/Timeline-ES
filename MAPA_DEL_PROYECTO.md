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

## De un vistazo

```
index.html, *.html    Las páginas: el juego y las que tienen dirección propia (legales, invitación…)
service-worker-258.js El que guarda una copia del juego para jugar sin internet
js/                   El juego, repartido por áreas (ver abajo)
css/                  Las hojas de estilo
mazos/                Los datos de las cartas, un archivo por mazo
assets/               Imágenes
vendor/               Código de otros autores que va dentro del juego (Firebase y los QR)
tests/                Pruebas automáticas      scripts/   Programas de mantenimiento
functions/            Tareas en la nube        docs/      Documentación de trabajo
ios/, android/        Los envoltorios de app   .github/   Los robots de GitHub
```

Cómo se carga: `index.html` pide, en este orden, las hojas de `css/`, los mazos, los scripts de
`js/` y por último `js/arranque/boot.js`, que abre el juego. Casi todos los scripts no se
importan entre sí: cuelgan de un objeto común, `window.CONTINUUM` (abreviado `CT` en el código),
así que **el orden de `index.html` importa**. Los que hablan con Firebase (cuentas, salas online,
duelos por turnos, mesas públicas) son módulos que se piden con `import()` cuando hacen falta.

## La raíz: lo que tiene que estar ahí

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página principal: el esqueleto que el navegador abre primero y que carga todo lo demás, en orden. |
| `service-worker-258.js` | Guarda una copia del juego para que funcione sin internet. Su número de versión (`continuum-vNNN`) se sube en cada cambio para que los móviles descarguen lo nuevo, y su lista `ASSETS` es también lo que lleva dentro la app móvil. Tiene que estar en la raíz (solo controla su carpeta y las de debajo) y llamarse así: el «258» es un accidente histórico, pero es la dirección que tienen registrada los móviles que ya lo instalaron. |
| `invitation.html` | La página que abre un enlace de invitación en la app. |
| `actualizar.html` | «Actualizar Continuum»: descarta la copia guardada sin borrar el perfil. |
| `privacidad.html`, `terminos.html`, `aviso-legal.html`, `soporte.html`, `borrar-cuenta.html`, `licencias.html` | Páginas legales, de soporte y de licencias, con dirección pública (las enlazan las tiendas). `privacidad.html` cuenta lo mismo que `PRIVACIDAD.md`; `licencias.html` la genera `scripts/licencias.mjs`. `aviso-legal.html` identifica al titular (LSSI art. 10) sin NIF ni domicilio mientras el juego sea gratuito (ver `docs/TIENDAS.md`). |
| `manifest.webmanifest`, `icon.svg` | Ficha e icono de la web cuando se instala en el móvil desde el navegador. |
| `CNAME`, `.nojekyll`, `.well-known/` | Publican la web en GitHub Pages con el dominio `continuumjuego.es`, y demuestran a Apple que el dominio es del juego para que los enlaces abran la app (`.well-known/` lo genera `scripts/domain-associations.mjs`). |
| `firestore.rules` | Las reglas de seguridad de la base de datos. **Subirlas a `main` las publica en producción.** |
| `firebase.json`, `firebase-e2e.json` | Configuración de las herramientas de Firebase para publicar y para probar en local. |
| `package.json`, `package-lock.json` | La lista de herramientas que necesita el proyecto y los atajos (`npm test`, `npm run build`…). |
| `capacitor.config.json` | Configuración del envoltorio de app móvil. |
| `vite.config.js` | Servidor de pruebas en el ordenador (`npm run dev`). |
| `eslint.config.js` | El revisor de código (`npm run lint`): solo busca errores de verdad, no estilo. |
| `asset-budget.json` | Límite de peso de las imágenes y del paquete (el de Google Play es de 200 MB), que comprueba `scripts/check-assets.mjs`. |
| `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc` | Qué no se guarda en git, cómo se tratan los archivos, el formato del editor y la versión de Node. |
| `README.md`, `CLAUDE.md`, `MAPA_DEL_PROYECTO.md` | Presentación del proyecto, normas de trabajo y este mapa. |
| `PRIVACIDAD.md`, `PROCEDENCIA_ARTE_IA.md` | La política de privacidad (igual que `privacidad.html`) y de dónde sale cada ilustración. Se quedan en la raíz porque se enlazan desde fuera. |
| `LICENSE` | Los derechos del propio juego: es privado, todos los derechos reservados. |

## `js/`: el juego

### `js/arranque/` — lo primero que corre

| Archivo | Qué es |
| --- | --- |
| `splash.js` | La portada animada de apertura mientras carga el juego. Se ejecuta en `<head>`, antes que nada. |
| `boot.js` | Lo último que carga `index.html`: espera a que se pulse «Jugar», prepara la cuenta y carga `js/juego/app.js`. |
| `updates.js` | Detecta que hay una versión nueva y la instala (`CT.APP_VERSION`, que se sube a la vez que la caché del service worker). |
| `actualizar.js` | El script de `actualizar.html`. |

### `js/juego/` — las reglas y las pantallas

| Archivo | Qué es |
| --- | --- |
| `app.js` | El corazón del juego en un solo móvil: dibuja cada pantalla y responde a cada toque. Empieza con un índice de sus secciones. |
| `modes.js` | La lista de modalidades (mazos y formas de jugar), sus ejes y unidades, y ayudantes comunes como `CT.escapeHtml`. La leen tanto el juego local como el online. |
| `engine.js` | Reglas puras de una partida: robar cartas, comprobar si un hueco es correcto. |
| `final.js` | Cómo se decide el ganador cuando hay empate o final numérica, y quién empieza (`CT.Starter`). |
| `ghost.js` | El modo «Fantasma» (cartas con poderes) y los niveles de dificultad. |
| `tournament.js` | El modo Competición: varias rondas con mazos distintos. |
| `tiempo.js` | El tiempo por jugada (sin tiempo, 15, 20 o 30 segundos) y lo demás que se elige antes de una partida en directo: cartas iniciales, poderes y máximo de participantes (`CT.ManoInicial`). |
| `session.js` | El reloj del servidor: que todos los móviles de una sala online midan igual el tiempo. |

### `js/interfaz/` — lo que se ve y se toca

| Archivo | Qué es |
| --- | --- |
| `home-modes-v1.js` | Las entradas ilustradas de la pantalla de Inicio y las pantallas de elección («Jugar solo», «Jugar con amigos»…). |
| `tutorial.js` | La guía en vídeo: escenas que se reproducen solas con subtítulos y un dedo que hace las jugadas. Se abre desde la Guía y desde «Ver el manual». |
| `settings.js` | La pantalla de Ajustes. |
| `a11y.js` | Pintar cada pantalla sin perder el foco del teclado, anunciar cambios al lector de pantalla, abrir las capas como diálogos, el aviso breve de abajo (`CT.toast`), las animaciones de las cartas y la ficha ampliada de una carta. |
| `immersion.js` | La cabecera, la barra de navegación, los diálogos de confirmación, la mano en abanico y el ajuste de la mesa al alto de la pantalla. |
| `effects.js`, `sonidos.js` | Ambiente de cada mazo y efectos al acertar, fallar o abrir diálogos; los sonidos se sintetizan al momento, sin archivos de audio. Solo decoran: no deciden jugadas. |
| `mapa.js` | El zoom de la línea de cartas. |
| `drag.js`, `swipe.js` | Arrastrar cartas con el dedo y deslizar para volver atrás. |
| `mesa-escala.js` | La mesa siempre igual: se dibuja como en la pantalla de un iPhone Pro (402 × 874) y se escala entera a cualquier móvil u ordenador. En tabletas (≥ 700 × 600) pone `data-tablet="vertical"` u `"horizontal"` en `<html>`; en horizontal no escala y la partida usa `css/tablet.css`. |

### `js/jugador/` — perfil, progreso y guardado

| Archivo | Qué es |
| --- | --- |
| `storage.js` | Guarda datos en el propio móvil y avisa si el guardado falla. |
| `account-storage.js` | Separa lo guardado de cada cuenta, para que dos personas en el mismo móvil no se mezclen. |
| `saves.js` | Guarda una partida a medias para poder seguirla después. |
| `progreso.js` | Estadísticas del jugador: qué ha jugado, qué acierta y qué falla. |
| `identidad.js`, `avatares.js` | El nombre y el dibujo (avatar) del jugador. |
| `moderacion.js` | Filtro de nombres ofensivos o reservados y botón «Denunciar» junto a los nombres ajenos. |
| `edad.js` | Pregunta una vez si quien juega tiene 14 años o más (o el permiso de sus padres). Sin permiso, el juego funciona sin conexión y sin ranking. |
| `enciclopedia.js` | El Atlas: el álbum de cartas descubiertas. |
| `cartera.js` | Decide a qué mazos tiene acceso cada jugador. Hoy todos están abiertos. |
| `recent-players.js` | Los nombres de las últimas personas con las que se jugó en el mismo móvil. |

### `js/nube/` — cuentas y Firebase

| Archivo | Qué es |
| --- | --- |
| `firebase-client.js` | Conecta con Firebase y con App Check (la comprobación de que quien llama es el juego de verdad). |
| `deployment.js` | Configuración pública: correo de contacto, claves públicas de App Check, avisos push. Nunca contraseñas. |
| `accounts.js` | Cuentas: invitado automático, entrar con Apple, ranking, borrado de cuenta. |
| `app-config.js` | Cartel remoto: lee `appConfig/current` para pedir actualizar una versión antigua o pausar el online. |
| `push.js` | Avisos al móvil (preparado y apagado: `nativePush` en `deployment.js`). |

### `js/online/` — jugar por internet

| Archivo | Qué es |
| --- | --- |
| `online.js` | Partidas online con amigos (salas con código) y mesas públicas. Empieza con un índice de sus secciones. |
| `public-tables.js`, `public-matchmaking.js`, `public-matchmaking-online.js` | El tablón de mesas públicas, las reglas puras de la partida rápida (y la versión del cliente que exigen las salas) y la cola con desconocidos. |
| `duelo.js` | Duelo por enlace: los dos juegan las mismas cartas, cada uno cuando quiere. |
| `duelo-turnos.js` | Duelo por turnos entre dos móviles a través de internet. |
| `links.js`, `invitation.js` | Los enlaces de invitación y los códigos de sala: qué dirección tienen y el script de `invitation.html`. |

### `js/retos/` — Retos rápidos

| Archivo | Qué es |
| --- | --- |
| `quick-challenges.js`, `quick-challenges-engine.js` | Retos rápidos: la pantalla y sus reglas. |
| `quick-room.js`, `quick-network.js`, `quick-online.js` | Retos rápidos con varias personas: las reglas de la sala, el enlace entre el juego y la red, y la sala por internet. |

### `js/sin-conexion/` — varios móviles sin internet

| Archivo | Qué es |
| --- | --- |
| `local-multiplayer.js` | La pantalla de «Sin conexión»: jugar en la misma Wi-Fi sin internet. |
| `local-room.js` | Las reglas de una sala sin conexión (las mismas que las de una sala online). |
| `local-session.js`, `local-transport.js`, `local-peer.js` | Cómo se conectan los móviles entre sí (WebRTC por Wi-Fi, o la tecnología de AirDrop entre iPhones). |
| `local-share.js` | Pasar un texto de un móvil a otro: compartir, pegar, enseñar un QR o leerlo con la cámara. Lo usan también las salas online y Retos rápidos. |
| `qr-encode.js`, `qr-scanner.js` | Dibujar y leer códigos QR, con las bibliotecas de `vendor/qr/`. |

## `css/`: el aspecto

Se cargan en este orden y cada una retoca a la anterior. Su `?v=` en `index.html` se sube cuando
cambian (`edition.css` y `tablet.css`, en cada cambio).

| Archivo | Qué es |
| --- | --- |
| `splash.css` | La portada animada de apertura. |
| `styles.css` | El estilo general: colores, letras, papel, botones. Es la única hoja que cargan las páginas legales. |
| `edition.css` | La piel de la interfaz sobre `styles.css`, escrita por capas: empieza con un índice de sus 29 bloques. |
| `accounts.css` | Pantallas de cuenta, bienvenida y ranking. |
| `quick-challenges.css` | Retos rápidos. |
| `home-modes-v1.css` | Las entradas ilustradas de Inicio (va con `js/interfaz/home-modes-v1.js`). |
| `atlas-voyage.css`, `guide-journal.css` | El Atlas personal y la Guía. |
| `tutorial.css` | La guía en vídeo. |
| `navigation-nautical.css` | La barra de navegación inferior que se ve hoy. |
| `mesa-escala.css` | La mesa a escala (va con `js/interfaz/mesa-escala.js`). |
| `tablet.css` | Tabletas: partida a dos columnas en horizontal e inicio en dos columnas. Todo cuelga de `html[data-tablet]`, así que móvil y ordenador no cambian. |

## `mazos/`: las cartas

Cada archivo es una lista de cartas con su título, su explicación, el valor que hay que ordenar
(un año, una superficie, una velocidad…) y la fuente de donde sale el dato. Las ilustraciones
están en `assets/<mazo>-cards/`.

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

## `vendor/`: código de otros autores

No se edita a mano.

| Carpeta | Qué es |
| --- | --- |
| `vendor/firebase/` | El SDK de Firebase (auth, firestore, app-check, functions y app), los mismos módulos que publica el paquete npm `firebase`, para que la app no descargue código en cada arranque y funcione sin red. Al subir la versión de `firebase` en `package.json`: `npm install && npm run vendor:firebase` (lo vigila `tests/firebase-local.mjs`). |
| `vendor/qr/` | `qrcode-generator.js` (dibuja los QR) y `jsqr.js` (los lee con la cámara), con sus licencias. |

## Otras carpetas

| Carpeta | Qué hay |
| --- | --- |
| `assets/` | Imágenes. Una carpeta por mazo (`*-cards/`) con la ilustración de cada carta; `avatars/` (los 36 retratos), `quick-cards/` (Retos rápidos), `texturas/`, y sueltas las portadas de cada sección (`hero-*`, `menu-*`, `mode-*`). |
| `docs/` | La documentación (ver [Documentación](#documentación) abajo) y, en `.json`, las fuentes y la procedencia del arte de cada carta, que leen las pruebas y los scripts por su ruta. `docs/revisiones/` guarda las revisiones fechadas de mazos e ilustraciones y `docs/promo/`, el vídeo promocional y la página de la que se graba. |
| `tests/` | Las pruebas automáticas. La lista de cuáles se ejecutan y dónde está en `tests/suites.mjs`; [tests/README.md](tests/README.md) dice qué comprueba cada una. |
| `scripts/` | Pequeños programas de mantenimiento (ver abajo). |
| `functions/` | Las tareas automáticas en la nube (Cloud Functions). Ver abajo. |
| `ios/`, `android/` | Los envoltorios de la app de iPhone (Xcode) y de Android (Android Studio). Ver abajo. |
| `resources/` | Las imágenes originales del icono y de la pantalla de carga, a partir de las que se generan todos los tamaños (`npm run icons`). |
| `.github/` | Los robots de GitHub (`workflows/`), las plantillas para abrir incidencias y `beta-request.json`. |
| `.claude/skills/` | Instrucciones para Claude Code: las reglas «antislop» de diseño y textos. |
| `anti-slop/` | Las auditorías hechas con esas reglas (`audit-NNN-fecha.md`): la skill las guarda ahí. |
| `.agents/skills/` | Instrucciones para asistentes de IA que generan ilustraciones de cartas. |
| `dist/`, `node_modules/`, `test-results/` | No se guardan en git: los crea el ordenador al compilar la app (`dist/`), al instalar herramientas (`node_modules/`) y al pasar las pruebas de navegador (`test-results/`). |

### `scripts/`

| Archivo | Qué hace |
| --- | --- |
| `build.mjs` | Prepara la carpeta `dist/` con lo que va dentro de la app móvil: lo mismo que precarga el service worker, más las páginas que no pasan por él. |
| `bump-version.mjs` | `npm run version:bump`: sube a la vez la versión de caché en el service worker, `js/arranque/updates.js` e `index.html`. |
| `run-tests.mjs` | Ejecuta un grupo de pruebas de `tests/suites.mjs` (`npm test`, `npm run test:rapido`, `test:reglas`, `test:navegador`…). |
| `check-assets.mjs` | Comprueba que ninguna imagen pese demasiado y que no falte ninguna. |
| `audit-content.mjs` | Cuenta las cartas con fuente y actualiza el inventario del arte (`docs/inventario-arte.json`). |
| `audit-licenses.mjs` | Lista las licencias de las herramientas instaladas. |
| `licencias.mjs` | Genera `licencias.html`. |
| `icons.mjs` | Genera los iconos y pantallas de carga de iPhone y Android en todos los tamaños. |
| `vendor-firebase.mjs` | Copia el SDK de Firebase a `vendor/firebase/`. |
| `borrar-cuenta.mjs` | Borra la cuenta de un jugador entera; lo lanza el workflow «Borrar cuenta de un jugador». |
| `domain-associations.mjs` | Genera los archivos que permiten abrir los enlaces del juego directamente en la app. |
| `render-intro.mjs` | Graba el vídeo promocional de la intro. |

### `functions/` (tareas en la nube)

| Archivo | Qué hace |
| --- | --- |
| `index.js` | Las tareas: avisos de duelos, mantenimiento de duelos caducados, `deleteMyAccount` (borrado de cuenta) y `purgeExpiredData`, la limpieza diaria de las 04:17. |
| `account-purge.js` | Todo lo que se borra al eliminar una cuenta. Lo usan la función de borrado, la limpieza de invitados y el borrado manual. |
| `purge.js` | La limpieza diaria de una colección, con un tope por ejecución para que un fallo no pueda vaciarla. |
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
| `pruebas.yml` | En cada subida | Pasa `npm test` y las reglas, y comprueba que la app móvil se compila. |
| `zoom-visual.yml` («Pruebas en navegador») | Al cambiar la interfaz | Pasa el grupo `navegador` de `tests/suites.mjs` en navegadores de verdad (pantallas pequeñas, zoom, duelos, navegación) y la partida online de extremo a extremo. |
| `reglas-firestore.yml` | Al cambiar `firestore.rules` | Prueba las reglas y **las publica en producción**. |
| `functions.yml` | Solo a mano | Prueba y publica las Cloud Functions. |
| `borrar-cuenta.yml` | Solo a mano | Borra la cuenta de un jugador (moderación o petición por correo). |
| `beta-firmada.yml` | Al cambiar `.github/beta-request.json` | Compila la app firmada y la sube a TestFlight. Solo cuando lo pida el titular. |

## Documentación

De qué trata cada documento, con más detalle, en el [README](README.md#dónde-vive-cada-cosa).

| Documento | Qué es |
| --- | --- |
| [README.md](README.md) | Presentación, índice de documentos, cómo probar, instalar y comprobar el juego. |
| [CLAUDE.md](CLAUDE.md) | Normas de trabajo: versión de caché, cambios en paralelo, pruebas, reglas y Functions. |
| [MAPA_DEL_PROYECTO.md](MAPA_DEL_PROYECTO.md) | Este mapa. |
| [PRIVACIDAD.md](PRIVACIDAD.md) | La política de privacidad, igual que `privacidad.html`. |
| [PROCEDENCIA_ARTE_IA.md](PROCEDENCIA_ARTE_IA.md) | De dónde sale cada ilustración. |
| [docs/REGLAS_Y_MODOS.md](docs/REGLAS_Y_MODOS.md) | Las reglas y el diseño de cada modo de juego. |
| [docs/SONIDOS_TRANSICIONES.md](docs/SONIDOS_TRANSICIONES.md) | Qué suena con cada acción. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Estado y lista única de pendientes. |
| [docs/BETA_CHECKLIST.md](docs/BETA_CHECKLIST.md) | Pruebas a mano, testers e incidencias. |
| [docs/TIENDAS.md](docs/TIENDAS.md) | Fichas de las tiendas, declaraciones y criterio de publicación. |
| [docs/DISTRIBUCION_MOVIL.md](docs/DISTRIBUCION_MOVIL.md) | Compilaciones firmadas, TestFlight y enlaces universales. |
| [docs/CONFIGURAR_MULTIJUGADOR.md](docs/CONFIGURAR_MULTIJUGADOR.md) | Firebase, despliegue, cartel remoto, denuncias, borrado y conservación. |
| [docs/MODELO_DE_DATOS.md](docs/MODELO_DE_DATOS.md) | Cada colección de Firestore. |
| [docs/SEGURIDAD_Y_OPERACION.md](docs/SEGURIDAD_Y_OPERACION.md) | Modelo de confianza, antitrampas y App Check. |
| [docs/CUENTAS_Y_RANKING.md](docs/CUENTAS_Y_RANKING.md) | Invitado, Apple, borrado de cuenta y ranking. |
| [docs/DUELOS-ASINCRONOS.md](docs/DUELOS-ASINCRONOS.md) | Duelos por turnos. |
| [docs/MATCHMAKING_PUBLICO.md](docs/MATCHMAKING_PUBLICO.md) | Mesas públicas y partida rápida. |
| [docs/CONTENIDO_Y_DERECHOS.md](docs/CONTENIDO_Y_DERECHOS.md) | Fuentes de las cartas e inventarios. |
| [docs/AUDITORIA_MAZOS.md](docs/AUDITORIA_MAZOS.md) | Revisión carta por carta: qué está cerrado y qué falta. |
| [docs/dependencias-seguridad.md](docs/dependencias-seguridad.md) | Correcciones fijadas en las dependencias. |
| [docs/procedencia-idiomas.md](docs/procedencia-idiomas.md), [docs/procedencia-recuperaciones.md](docs/procedencia-recuperaciones.md), [docs/retos-portada.md](docs/retos-portada.md), [docs/intro-color.md](docs/intro-color.md) | Fichas de procedencia de algunas ilustraciones (las cita `PROCEDENCIA_ARTE_IA.md`). |
| [docs/revisiones/](docs/revisiones/) | Revisiones fechadas: [facturación de empresas](docs/revisiones/revision-facturacion-empresas-2025.md), [ilustraciones de Retos rápidos](docs/revisiones/revision-ilustraciones-retos-2026-10-04.md), [metros](docs/revisiones/revision-metros-ampliacion-2026-10-04.md), [programas españoles](docs/revisiones/revision-programas-estrenos-2026-10-04.md), [salarios mínimos](docs/revisiones/revision-salarios-minimos-2026-10-04.md), [seis retos](docs/revisiones/revision-seis-retos-ampliacion-2026-10-05.md), [siete retos](docs/revisiones/revision-siete-retos-ampliacion-2026-10-05.md) y [verificación de las Grandes colecciones](docs/revisiones/revision-verificacion-2026-10-20.md). |
| [tests/README.md](tests/README.md) | Qué comprueba cada prueba y dónde se ejecuta. |
| [anti-slop/audit-001-2026-10-22.md](anti-slop/audit-001-2026-10-22.md) | Auditoría de diseño y textos de la pantalla de inicio (22 de octubre de 2026). |
