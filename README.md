# Continuum

Juego de ordenar cartas —por fecha, tamaño, población, peso, velocidad…— para jugar solo o con
2–9 personas, pasando un solo móvil, cada uno en el suyo o en mesas públicas. Se juega en la web,
en `https://continuumjuego.es/`, y como app de iPhone, en beta por TestFlight; la de Android está
en preparación. Las reglas de cada modo están en [docs/REGLAS_Y_MODOS.md](docs/REGLAS_Y_MODOS.md).

## Cómo está organizado el juego

La portada tiene tres puertas y un atajo:

- **Jugar.** Se despliega en la propia portada con tres caminos: **Jugar solo**, **Jugar con
  amigos** y **Jugar online**. En todos, primero se elige *qué* se juega y después *cómo*:
  - **Jugar solo:** Grandes colecciones (mazos completos, agrupados por colección, con la
    **Competición** como último panel de la lista) o Retos rápidos.
  - **Jugar con amigos:** *Un solo móvil* (pasando el teléfono) o *Cada uno en su móvil*, donde
    se puede unirse a una partida, crearla (en directo, por turnos o con las mismas cartas) o
    ver «Tus partidas».
  - **Jugar online:** mesas públicas. Se crea una mesa, se elige entre las abiertas o se busca
    una partida rápida, de Grandes colecciones o de Retos rápidos.
- **Unirme a una partida.** Atajo para quien recibe un QR, un enlace o un código.
- **Reto diario.** Uno para todo el mundo: cada día se sortea un mazo con la fecha como
  semilla y de él salen las mismas 10 cartas en todos los móviles. Un día toca Grandes
  colecciones y al siguiente Retos rápidos, siempre alternando. El mazo es sorpresa: en Grandes colecciones la portada
  enseña solo la hoja de calendario del día y, al tocarla, una presentación de unos tres
  segundos pasa los nombres de los mazos hasta pararse en el de hoy. Un reto ya empezado se
  retoma sin presentación. Enseña la racha y, una vez jugado, el mazo que era y el resultado
  para compartirlo. Debajo, un resumen con los aciertos de hoy, de la semana y la racha.

Encima, y solo cuando hay algo pendiente, un aviso de **duelos por turnos**: si es uno, lleva
directo a él; si son varios, a la lista con el estado de cada uno (tu turno, esperando al
rival, retos recibidos, invitaciones enviadas, historial).

La barra inferior tiene Inicio, Atlas, Guía y Ajustes. El **Atlas** reúne la colección de
cartas con la puerta a todas ellas, la racha del reto diario con su calendario, los duelos, las
estadísticas, los logros, el ranking y tu cuenta.

## Dónde vive cada cosa

Qué hace cada archivo y carpeta del código: [MAPA_DEL_PROYECTO.md](MAPA_DEL_PROYECTO.md). Cómo
se trabaja en el repositorio (versión de caché, cambios en paralelo, pruebas, reglas):
[CLAUDE.md](CLAUDE.md). El resto de la documentación:

| Documento | De qué trata |
| --- | --- |
| **El juego** | |
| [docs/REGLAS_Y_MODOS.md](docs/REGLAS_Y_MODOS.md) | Los mazos, las reglas comunes, cada forma de jugar, Fantasma y Pulso, Retos rápidos, duelo por enlace, enciclopedia, Atlas, cartera, ajustes, manejo en el móvil y guardado. |
| [docs/SONIDOS_TRANSICIONES.md](docs/SONIDOS_TRANSICIONES.md) | Qué suena con cada acción y dónde se conecta. |
| **Estado y lanzamiento** | |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Estado del proyecto: lo hecho y lo pendiente. Es el único sitio con la lista de pendientes. |
| [docs/BETA_CHECKLIST.md](docs/BETA_CHECKLIST.md) | Pruebas a mano en dispositivos reales, testers y registro de incidencias. |
| [docs/TIENDAS.md](docs/TIENDAS.md) | Ficha de App Store y Google Play, notas de revisión, declaraciones de privacidad, decisión comercial y criterio de publicación. |
| [docs/DISTRIBUCION_MOVIL.md](docs/DISTRIBUCION_MOVIL.md) | Compilaciones firmadas, TestFlight y enlaces universales. |
| **Servidor y operación** | |
| [docs/CONFIGURAR_MULTIJUGADOR.md](docs/CONFIGURAR_MULTIJUGADOR.md) | Firebase, **despliegue** de web, reglas, Functions y beta, cartel remoto, denuncias, borrado de cuentas y plazos de conservación. |
| [docs/MODELO_DE_DATOS.md](docs/MODELO_DE_DATOS.md) | Cada colección de Firestore: para qué, quién la lee y escribe, cuánto se conserva. |
| [docs/SEGURIDAD_Y_OPERACION.md](docs/SEGURIDAD_Y_OPERACION.md) | Modelo de confianza, medidas antitrampas y App Check. |
| [docs/CUENTAS_Y_RANKING.md](docs/CUENTAS_Y_RANKING.md) | Invitado, Iniciar sesión con Apple, borrado de cuenta y ranking. |
| [docs/DUELOS-ASINCRONOS.md](docs/DUELOS-ASINCRONOS.md) | Duelos por turnos y sus Cloud Functions. |
| [docs/MATCHMAKING_PUBLICO.md](docs/MATCHMAKING_PUBLICO.md) | Jugar online: tablón de mesas y partida rápida. |
| **Contenido, derechos y privacidad** | |
| [PRIVACIDAD.md](PRIVACIDAD.md) | Política de privacidad (la misma que `privacidad.html`). |
| [docs/CONTENIDO_Y_DERECHOS.md](docs/CONTENIDO_Y_DERECHOS.md) | Fuentes de las cartas e inventarios de fuentes y de arte. |
| [docs/AUDITORIA_MAZOS.md](docs/AUDITORIA_MAZOS.md) | Qué cartas se han contrastado una a una y cuáles faltan. |
| [docs/revisiones/](docs/revisiones/) | Revisiones fechadas de mazos e ilustraciones (registro histórico; las cita la auditoría). |
| [PROCEDENCIA_ARTE_IA.md](PROCEDENCIA_ARTE_IA.md) | De dónde sale cada ilustración, con sus fichas: [docs/procedencia-idiomas.md](docs/procedencia-idiomas.md), [docs/procedencia-recuperaciones.md](docs/procedencia-recuperaciones.md), [docs/retos-portada.md](docs/retos-portada.md) y [docs/intro-color.md](docs/intro-color.md). |
| [docs/dependencias-seguridad.md](docs/dependencias-seguridad.md) | Correcciones fijadas en las dependencias y avisos abiertos. |
| [LICENSE](LICENSE) | Los derechos del propio juego. |
| **Pruebas y herramientas** | |
| [tests/README.md](tests/README.md) | Qué comprueba cada prueba y dónde se ejecuta. |
| [anti-slop/](anti-slop/) | Auditorías de diseño y textos hechas con las reglas de `.claude/skills/antislop`. |
| [docs/promo/](docs/promo/) | El vídeo promocional y la página de la que se graba (`scripts/render-intro.mjs`). |

## Probarlo en un ordenador

La carpeta debe abrirse mediante un servidor web local (no haciendo doble clic en `index.html`):
`npm run dev` (Vite) o, por ejemplo, la extensión **Live Server** de Visual Studio Code sobre
`index.html`. Las salas online, el ranking y las cuentas usan el proyecto real de Firebase; para
probar reglas sin tocarlo están las pruebas del emulador ([tests/README.md](tests/README.md)).

## Instalarlo en el móvil

La web se publica en `https://continuumjuego.es/` con GitHub Pages, directamente desde la rama
`main` (ver «Despliegue» en [docs/CONFIGURAR_MULTIJUGADOR.md](docs/CONFIGURAR_MULTIJUGADOR.md#despliegue)).

1. Abre la dirección una vez desde el móvil.
2. En Android/Chrome, elige **Añadir a pantalla de inicio**. En iPhone/Safari, pulsa **Compartir → Añadir a pantalla de inicio**.
3. Desde ese momento se abre como una app y las partidas en solitario y en un solo móvil
   funcionan sin conexión.

En iPhone también está la app nativa en beta por TestFlight.

## App móvil (Capacitor)

La misma web se empaqueta como app de iPhone y Android con [Capacitor](https://capacitorjs.com/),
sin reescribir el juego ni duplicarlo por plataforma:

- `npm run build` genera `dist/`, una copia literal de los archivos que el juego necesita
  (el juego se sirve como scripts clásicos, no como módulos, así que el build no empaqueta ni
  transforma nada: copia lo que precarga `service-worker-258.js` y las páginas que no pasan por
  él). `npm run build && npx cap sync` deja `android/` e `ios/` al día.
- `capacitor.config.json` apunta `webDir` a `dist/`. El `appId` (`com.continuum.game`) es el que
  hay que mantener estable: las tiendas lo usan para reconocer la aplicación, así que cambiarlo
  equivaldría a crear una aplicación nueva.
- `android/` e `ios/` son los proyectos nativos, con sus ajustes de plataforma (iconos, splash,
  firma, permisos) y los plugins propios de `ios/App/App/`: Iniciar sesión con Apple, App Attest
  y salas cercanas.
- Los iconos y la pantalla de apertura se generan con `npm run icons` (usa `sharp`; las fuentes en
  alta resolución viven en `resources/`) a partir de `icon.svg` y del emblema.
- El botón Atrás de Android y el gesto de deslizar para volver se explican en
  [docs/REGLAS_Y_MODOS.md](docs/REGLAS_Y_MODOS.md#manejo-en-el-móvil).
- La versión de la beta (`0.1.1`, distinta del número de caché del service worker) vive en
  `android/app/build.gradle` (`versionName`) y en `ios/App/App.xcodeproj/project.pbxproj`
  (`MARKETING_VERSION`).
- La beta de iPhone se compila, firma y sube a TestFlight desde GitHub Actions al cambiar
  `.github/beta-request.json` (ver [docs/DISTRIBUCION_MOVIL.md](docs/DISTRIBUCION_MOVIL.md)). Lo
  que falta para Android está en [docs/ROADMAP.md](docs/ROADMAP.md).

## Conexión, cuentas y Firebase

Al abrir el juego con conexión se crea automáticamente un invitado anónimo de Firebase, también
para jugar en un solo móvil o en solitario: así el progreso, las estadísticas y los retos
diarios se guardan en la cuenta (`playerProgress`) y no solo en el dispositivo. Sin conexión al
abrir, el juego arranca igualmente y guarda lo jugado en local hasta que haya cuenta. En iPhone
se puede entrar con Apple para conservar el progreso al cambiar de móvil. Ningún modo incluye
anuncios, compras ni servicios de pago.

Las salas, los duelos, las mesas públicas, el ranking y las cuentas usan el proyecto de Firebase
`timeline-es` (plan Blaze, por las Cloud Functions). Cómo se publican las reglas, las Functions y
la web está en [docs/CONFIGURAR_MULTIJUGADOR.md](docs/CONFIGURAR_MULTIJUGADOR.md#despliegue): las
reglas se publican solas al subir `firestore.rules` a `main`, después de pasar las pruebas del
emulador, y no hay que volver a publicarlas al añadir un mazo nuevo.

## Comprobaciones

`tests/` contiene las pruebas automáticas, y la lista de cuáles se ejecutan y dónde está en
`tests/suites.mjs`. `npm test` pasa en cualquier ordenador las del juego —sintaxis de todos los
archivos, partidas completas sobre un DOM simulado, partidas al azar, calidad de los mazos,
solitario, Pulso, Fantasma, cuentas, ranking, Retos rápidos, salas Wi-Fi, duelos, service worker,
accesibilidad, build móvil, plazos de conservación y presupuesto de recursos—, `npm run test:rapido`
hace lo mismo en paralelo y `npm run test:reglas` lanza las suites de reglas contra el emulador
oficial de Firestore. Se instalan con `npm ci` y se ejecutan solas en cada propuesta de cambio y
cada subida a `main`. Qué comprueba cada archivo está en [tests/README.md](tests/README.md).

Antes de publicar un cambio que se vea hay que subir la versión de caché con
`npm run version:bump`; el procedimiento completo está en [CLAUDE.md](CLAUDE.md).

## El nombre

El nombre es **Continuum**, en la aplicación, su instalación móvil, la documentación y las fichas
comerciales. El objetivo es publicarlo en App Store y Google Play (ver
[docs/ROADMAP.md](docs/ROADMAP.md)).

El nombre del repositorio (`Timeline-ES`) y el nombre visible del proyecto de Firebase se
administran fuera del código; sigue pendiente unificarlos a **Continuum**. Con el dominio propio,
renombrar el repositorio ya no cambia la dirección de la web, pero hay que comprobar de nuevo
GitHub Pages después.

Los identificadores técnicos como `timeline` describen la línea de cartas, no la marca.
Se conservan para mantener compatibles las partidas guardadas y las reglas de las salas. Las URL y los títulos de fuentes
externas tampoco se renombran como si fueran propios.

`tests/marca.mjs` comprueba el nombre de la web, del acceso directo de iOS, del manifiesto y
de las pantallas locales. El cambio de denominación no modifica la licencia del código.
