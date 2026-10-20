# Comprobaciones

Las versiones de las dependencias están fijadas en `package-lock.json`, así que se instalan
siempre las mismas. `node_modules` no se guarda en el repositorio.

```sh
npm ci

# Juego, guardado, mazos, cuentas, service worker, accesibilidad, y build:
# 79 órdenes (77 suites, la comprobación de recursos y la auditoría de contenido).
npm test

# Reglas de Firestore contra el emulador oficial (necesita Java): 14 suites.
npm run test:reglas

# Las dos cosas.
npm run test:todo

# «Jugar online» de extremo a extremo, en Chromium contra los emuladores de Auth y Firestore.
npm run test:online-e2e
```

Las cuentas son de octubre de 2026; la lista exacta está en `package.json`.

Dónde se ejecutan solas:

- `.github/workflows/pruebas.yml`, en cada propuesta de cambio y cada subida a `main`, sobre un
  clon limpio: `npm test`, `npm run test:reglas`, el build móvil con `npx cap sync` y la
  compilación de Android y de iPhone sin firma.
- `.github/workflows/reglas-firestore.yml`: `npm run test:reglas` antes de publicar las reglas.
- `.github/workflows/zoom-visual.yml`: las pruebas de navegador con Playwright (Chromium y
  WebKit) cuando cambian los archivos de interfaz.
- `.github/workflows/functions.yml`: `retencion.mjs` y `duelo-policy.cjs` antes de publicar las
  Cloud Functions.

Cada suite se puede lanzar por separado con `node tests/<archivo>`. Las de navegador necesitan
Playwright y aceptan `PLAYWRIGHT_MODULE`, `CHROME_PATH` y `ENGINES=chromium` (para no exigir
WebKit).

## Qué comprueba cada archivo

Columna «Dónde»: **test** = `npm test`; **reglas** = `npm run test:reglas` (emulador);
**navegador** = Playwright, en `zoom-visual.yml` o a mano.

| Archivo | Dónde | Qué comprueba |
| --- | --- | --- |
| `accesibilidad.mjs` | test | Foco tras repintar, capas como diálogos, región viva, contraste de bandas y de los temas Claro y Oscuro. |
| `actualizar.mjs` | test | La página «Actualizar Continuum» descarta el service worker y su caché sin borrar el perfil ni las partidas. |
| `apple-auth-rules.mjs` | reglas | Una cuenta de Apple se trata como un invitado y `appleBetaTesters` está cerrada. |
| `apple-auth.mjs` | test | Iniciar sesión con Apple: vinculación, reentrada, cierre de sesión y borrado con revocación. |
| `arte-catalogo.mjs` | test | Cada mazo de la página real tiene sus ilustraciones, sin mazos repetidos ni identificadores duplicados. |
| `atlas-aciertos.mjs` | test | Solo los aciertos propios desbloquean láminas del Atlas, también desde Gran mezcla y duelos. |
| `avatar-propio.mjs` | test | El avatar elegido en el Atlas es el que aparece en las partidas. |
| `avatares-duelos.mjs` | test | Un mismo UID conserva su avatar entre partidas, tamaños y cambios de alias. |
| `board-fit-browser.mjs` | navegador | La mesa cabe al 100 % en móviles de distintos tamaños en todos los formatos. |
| `build-movil.mjs` | test | `npm run build` deja un `dist/` completo y sincronizado con `capacitor.config.json`. |
| `camera-permissions.mjs` | test | Las declaraciones de cámara de iOS y Android que necesita leer un QR. |
| `card-text.mjs` | test | El texto de las cartas se ajusta sin partir palabras y recupera su tamaño. |
| `cartera.mjs` | test | La cartera: un mazo cerrado a mano se respeta en todos los rincones del juego. |
| `cifras.mjs` | test | Duelo de cifras: puntos por cercanía y rapidez, carga útil recalculada y reloj que no se para. |
| `config-remota.mjs` | test | El cartel remoto: pide actualizar, pausa el online, levanta la pausa y no hace nada si no puede leerse. |
| `config-remota-reglas.mjs` | reglas | `appConfig/current`: lectura con sesión, ninguna escritura ni listado desde clientes. |
| `compartir-local.mjs` | test | La señal de la sala Wi-Fi viaja por «compartir» del sistema o por el portapapeles. |
| `compatibilidad-version-anterior.mjs` | reglas | Las reglas nuevas aceptan las salas y escrituras de la versión anterior de la app. |
| `competicion-turnos.mjs` | test | Competición de varios temas dentro de un duelo por turnos. |
| `competicion-wifi.mjs` | test | Competición por rondas en la sala Wi-Fi, con las mismas reglas que la sala online. |
| `conexion-nativa.mjs` | test | Entrada en salas desde enlaces nativos y antiguos, y fallos de red o del servidor. |
| `confirmacion-extremos.mjs` | test | El botón de confirmar se ve y recibe el foco en los dos extremos de la línea. |
| `cuentas-reglas.mjs` | reglas | Invitados, aislamiento, nombres, revisiones, privacidad del ranking y borrado. |
| `cuentas.mjs` | test | Alta automática, reentrada, fallo de red, cambio de nombre, ranking, aislamiento y conflictos. |
| `diagnostico.mjs` | test | Un error sin capturar enseña un aviso con versión, pantalla y mazo en vez de una pantalla en blanco. |
| `duelo-layout.mjs` | navegador | Maquetación de los duelos por turnos en móvil y escritorio, sin desbordamiento. |
| `duelo-policy.cjs` | test (y `functions.yml`) | Recordatorios a las 48 h, uno por turno, caducidad a los 7 días y textos de los avisos. |
| `duelo-state.mjs` | test | Duelo por turnos sin pantalla de listo: envío pendiente, reintento e idempotencia. |
| `duelo-turnos-reglas.mjs` | reglas | Reglas de los duelos por turnos: cuota, tiempo por carta, turnos, bloqueo y archivo. |
| `duelo.mjs` | test | Duelo por enlace: mismas cartas en dos móviles, carga útil y enlaces manipulados o de otra versión. |
| `duelos-amigos-browser.mjs` | navegador | La lista de duelos a 360 y 393 px, sin desbordamiento ni texto cortado. |
| `duelos-amigos-regresion.mjs` | test | Compatibilidad de los duelos de Retos rápidos con la huella del catálogo. |
| `edicion.mjs` | test | Temas Claro y Oscuro, migración de preferencias antiguas y la portada animada. |
| `efectos.mjs` | test | Sonidos, vibración y efectos opcionales, fallos de audio y foco al ampliar. |
| `enciclopedia.mjs` | test | Búsqueda y filtros de la enciclopedia, láminas selladas hasta jugar la carta y que no aparezca en partida. |
| `entrada-multijugador.mjs` | test | La entrada a una sala prioriza unirse con invitación y los avisos son coherentes. |
| `entrada-por-enlace.mjs` | reglas | La primera instantánea al entrar por enlace llega de la caché y no se confunde con una expulsión. |
| `entry-board-browser.mjs` | navegador | Recorre las puertas del inicio hasta la mesa jugable o la sala de espera. |
| `estabilizacion.mjs` | test | Competición guardada, versiones de guardado, almacenamiento lleno y actualizaciones en partida. |
| `fantasma-online.mjs` | reglas | `online.js` real con dos clientes: Fantasma y Pulso contra las reglas, y escrituras tramposas rechazadas. |
| `fantasma.mjs` | test | 90.000 repartos deterministas del Fantasma, su uso, duración y dificultades del solitario. |
| `final-helper.mjs` | (auxiliar) | Ayuda compartida para terminar una final numérica local en otras pruebas. |
| `final-reglas.mjs` | reglas | Final privada: respuestas secretas, recibos atómicos, inmutabilidad y nueve finalistas. |
| `final.mjs` | test | La cifra correcta de la final se comprueba contra la carta. |
| `game-fixture.mjs` | (auxiliar) | Prepara `index.html` para arrancar las pruebas después del acceso y la bienvenida. |
| `identidad-fixture.js` | (auxiliar) | Identidad de prueba ya elegida para las suites que no prueban la bienvenida. |
| `identidad.mjs` | test | La bienvenida: el avatar del invitado y el nombre editable sin perderlo. |
| `imagenes-retos-rapidos.mjs` | test | Cada carta de Retos rápidos usa una ilustración propia que existe y coincide con su posición. |
| `imagenes-unicas.mjs` | test | Ninguna ilustración de carta repite exactamente los píxeles de otra. |
| `integridad-reglas.mjs` | reglas | Conservación de cartas, victoria, salidas, desempates y cuota de altas en las salas. |
| `interfaz-atlas.mjs` | test | Barra inferior, Atlas y títulos legibles. |
| `invitaciones-app.mjs` | test | «Unirme» acepta el enlace entero, su parte final o el código suelto. |
| `jugadores-recientes.mjs` | test | Un solo móvil recuerda los nombres de los jugadores recientes. |
| `marca.mjs` | test | Nombre Continuum en la web, iOS, manifiesto, paquete, documentación y pantallas, sin la marca antigua. |
| `mazos.mjs` | test | Integridad de todos los mazos: repeticiones, huecos, espaciado y cifras que el redondeo no confunda. |
| `motor-enlaces.mjs` | test | Los enlaces del dominio propio y de GitHub se aceptan, con y sin `www`; otras rutas no. |
| `motor-invariantes.mjs` | test | Motor puro: inmutabilidad, conservación de cartas, Pulso e índices inválidos. |
| `movimiento.mjs` | test | Navegación, arrastre con el dedo, deslizar para volver, foco y movimiento reducido. |
| `multijugador-cercano.mjs` | test | Salas cercanas entre iPhones con un sistema simulado, incluido el código de 4 cifras. |
| `multijugador-local.mjs` | test | La sala Wi-Fi sobre el DOM real: crear, vestíbulo y partida entera con transporte simulado. |
| `navegacion-volver-browser.mjs` | navegador | En cada pantalla se ve la flecha de volver y lleva a la anterior. |
| `navegacion-volver.mjs` | test | La flecha de volver lleva a la pantalla inmediatamente anterior, también en Retos rápidos. |
| `online-e2e-harness.mjs` | (auxiliar) | Arnés de `online-e2e.mjs`: la app real en Chromium contra los emuladores. |
| `online-e2e.mjs` | `test:online-e2e` | «Jugar online» con varias personas a la vez: mesas, sala de espera, salida y relevo. |
| `orden-salida-online.mjs` | reglas | Minijuego de quién empieza y relevo del anfitrión en mesas públicas, con `online.js` real. |
| `partida-local.mjs` | test | Partidas completas de un solo móvil sobre el DOM real. |
| `partidas-al-azar.mjs` | test | Partidas reproducibles en cuatro mazos: sin bloqueos y sin cartas creadas ni perdidas. |
| `presencia-reglas.mjs` | reglas | Presencia privada, reloj del servidor y relevo tras inactividad. |
| `preview.html` | (`npm run dev`) | Página para revisar la interfaz a 360, 390, 430, 768 y 1080 px. |
| `progreso.mjs` | test | Estadísticas, logros y la pantalla del perfil con almacenamiento vacío, dañado o antiguo. |
| `public-matchmaking-rules.mjs` | reglas | Colas y mesas públicas: carreras, capacidad, versiones y cuota. |
| `public-matchmaking.mjs` | test | Claves de cola, capacidad de 2 a 4 y compatibilidad de mesas. |
| `pulso.mjs` | test | El Pulso: cuándo se ofrece, aciertos y fallos, escudo de ronda y cartas que no se pierden. |
| `qr-local.mjs` | test | El QR de invitación se genera y se decodifica de verdad con `jsQR`. |
| `quick-challenges-browser.mjs` | navegador | Retos rápidos en un solo móvil, en Chromium. |
| `quick-challenges.mjs` | test | Catálogo de Retos rápidos: curiosidades, fuentes trazables y motor. |
| `quick-duelo.mjs` | test | Duelo de Retos rápidos por enlace con los mismos mazos. |
| `quick-formats-browser.mjs` | navegador | Formatos de Retos rápidos con varios móviles, cada uno con su nombre. |
| `quick-online-rules.mjs` | reglas | Salas de Retos rápidos: cuota, comandos firmados, turnos y salida. |
| `quick-permissions.mjs` | test | Aviso de permisos en español y conservación de la jugada pendiente. |
| `quick-room.mjs` | test | Sala de Retos rápidos: capacidad, identidad, turnos, revisiones y quién empieza. |
| `ranking-inicio.mjs` | test | El marcador del inicio y lo que suma cada reto diario al ranking. |
| `recarga.mjs` | test | Una vista guardada por una versión anterior se abre en la pantalla correcta. |
| `referencias-animales.mjs` | test | Empates reales y cifras próximas de los mazos de animales sobre el DOM. |
| `referencias-idiomas.mjs` | test | Las 50 cartas de idiomas tienen su lámina WebP vertical, ligera y bien enlazada. |
| `referencias-paises.mjs` | test | Huellas de las láminas de países revisadas a mano. |
| `referencias-poblacion.mjs` | test | Referencias y láminas del mazo de población. |
| `reglas-firestore.mjs` | reglas | Quién puede escribir en una sala y qué: entrar, empezar, colocar, saltar, expulsar y trampas. |
| `result-preview.mjs` | test | La pantalla de resultado: acierto, corrección del fallo, foco y movimiento reducido. |
| `push-apagado.mjs` | test | Los avisos push del móvil siguen apagados (`deployment.nativePush`): sin él, `push.start()` no pide permiso ni llama a `register()`. |
| `borrado-cuenta.mjs` | test | El borrado de cuenta del servidor (`functions/account-purge.js`) con una base en memoria: borra todo lo de la cuenta, incluidas las filas de ranking y subcolecciones, sin tocar otras cuentas. |
| `legal.mjs` | test | Condiciones de uso, aviso legal, soporte y página de borrado: enlaces y anclas, caché, app móvil, coherencia con la política y lista de huecos `[PENDIENTE: …]` por rellenar. |
| `edad.mjs` | test | La pregunta de edad (14 años, permiso de los padres), el modo sin conexión de un menor sin permiso y el cambio desde Ajustes. |
| `moderacion.mjs` | test | El filtro de nombres (ofensivos y reservados bloqueados, nombres normales intactos) y el botón de denuncia. |
| `moderacion-reglas.mjs` | reglas | Nombres reservados, el nombre se libera al borrar el perfil, denuncias de solo escritura y topes de tamaño. |
| `retencion.mjs` | test | Los plazos de `functions/retention.js` coinciden con la política, y `PRIVACIDAD.md` y `privacidad.html` tienen las mismas secciones. |
| `revancha-local.mjs` | test | La revancha en un solo móvil recupera la mesa anterior. |
| `reverso-mano.mjs` | test | La mano enseña el reverso de la colección en todos los modos. |
| `ritmo.mjs` | test | Los poderes se eligen con sus interruptores en la configuración. |
| `sala-local.mjs` | test | El reductor puro de la sala Wi-Fi: una partida entera en Node. |
| `service-worker.mjs` | test | Qué versión ve el móvil: caché por versión, refresco y precarga de todo lo que pide `index.html`. |
| `sesion-local.mjs` | test | La sesión que une sala y transporte Wi-Fi, sin WebRTC real. |
| `sintaxis.mjs` | test | Que todos los archivos del juego parsean; la única red que cubre `online.js`. |
| `solitario.mjs` | test | Solitario, reto diario, confirmación al colocar y llegada animada de las cartas automáticas. |
| `sorteo-online-reglas.mjs` | reglas | El sorteo de quién empieza en las salas online contra las reglas. |
| `tiempo.mjs` | test | Tiempo por carta (sin tiempo, 15, 20 o 30 s) en todas las configuraciones; al agotarse, fallo. |
| `tournament.mjs` | test | Competición por rondas desde un solo móvil y sus ajustes. |
| `transitions-browser.mjs` | navegador | Transiciones en Chromium móvil, con y sin movimiento reducido. |
| `transporte-local.mjs` | test | Señal WebRTC compacta para el QR y mensajes del canal. |
| `turn-duel-layout-browser.mjs` | navegador | Maquetación de un turno activo de duelo. |
| `valores-repetidos.mjs` | test | Un reparto no lleva dos cartas con el mismo valor, y con semilla es reproducible. |
| `wow.mjs` | test | Pantalla final del Atlas: abanico, logros nuevos y movimiento reducido. |
| `zoom-browser.mjs` | navegador | El zoom de la mesa en un navegador real: las imágenes no se encogen. |
| `zoom.mjs` | test | Zoom simulado: escala, desplazamiento, límites y conservación del DOM. |

Además, `npm test` ejecuta `scripts/check-assets.mjs` (dimensiones, decodificación y presupuesto
de peso de las imágenes) y `scripts/audit-content.mjs` (inventario de fuentes; ver
`CONTENIDO_Y_DERECHOS.md`).

## Notas sobre algunas suites

`reglas-firestore.mjs` cubre entrar, empezar, colocar carta, cerrar turno, saltar turno,
expulsar, marcharse y una docena de intentos de trampa (vaciarse la mano, repartirse cartas,
declararse ganador con cartas, expulsar al anfitrión). Si alguna denegación se debe al límite de
1000 expresiones de Firestore en vez de a la propia regla, el emulador lo imprime: esa señal no
debe aparecer. Ninguna prueba de reglas toca Firebase de producción.

`entrada-por-enlace.mjs` fija el comportamiento del SDK del que depende `connectToRoom()`: al
entrar por una invitación, la primera instantánea de `onSnapshot` llega de la caché y todavía no
incluye a quien acaba de entrar. Comprueba el SDK y la condición, no `online.js`, que no se puede
importar desde Node porque carga Firebase desde gstatic.

`service-worker.mjs` ejecuta el archivo real con un entorno de service worker simulado: se
responde con la copia guardada pero se pide la del servidor por detrás, así que un archivo nuevo
llega en el siguiente arranque aunque se olvide subir el número de la caché. La instalación fuerza
una descarga actual y el refresco revalida la caché HTTP.

`movimiento.mjs` y las demás pruebas sobre DOM simulado son contratos: no miden fluidez ni
sustituyen la inspección en un navegador o un iPhone. Para revisar a mano, `npm run dev` sirve los
archivos con Vite (Node 20.19+ o 22.12+) y `/tests/preview.html` enseña la interfaz a varios
anchos; la web publicada sigue siendo estática.

Las pruebas de efectos y Fantasma usan relojes y azar deterministas; la comprobación
auditiva y la prueba en Safari de un iPhone físico siguen siendo necesarias.
