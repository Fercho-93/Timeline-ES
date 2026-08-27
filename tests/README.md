# Comprobaciones

Las versiones de las dependencias están fijadas en `package-lock.json`, así que se instalan
siempre las mismas. `node_modules` no se guarda en el repositorio.

```sh
npm install

# Sintaxis, juego, mazos, service worker y accesibilidad: siete suites, sin nada más que Node.
npm test

# Reglas de Firestore y entrada en sala, contra el emulador oficial (necesita Java).
npm run test:reglas

# Las diez de una vez.
npm run test:todo
```

Las mismas comprobaciones se ejecutan solas en cada propuesta de cambio y en cada subida a
`main` (`.github/workflows/pruebas.yml`), sobre un clon limpio. El resultado aparece como un
tick verde o una cruz roja en la propia propuesta, antes de fusionar.

Cada suite se puede lanzar por separado con `node tests/<archivo>.mjs`:

| Archivo | Qué comprueba |
| --- | --- |
| `sintaxis.mjs` | Que todos los archivos del juego parsean. Es la única red que cubre `online.js`. Sin dependencias. |
| `partida-local.mjs` | Partida completa del modo de un solo móvil sobre un DOM simulado. |
| `partidas-al-azar.mjs` | 40 partidas al azar sobre cinco juegos: bloqueos, conteo de cartas y orden de la línea. |
| `service-worker.mjs` | Qué versión de la aplicación acaba viendo el móvil, y que ni un guion de `index.html` ni una carátula se queden sin precargar. Sin dependencias. |
| `mazos.mjs` | Calidad de los seis mazos: repeticiones, huecos, cartas demasiado juntas y cifras que el redondeo no confunda. Sin dependencias. |
| `solitario.mjs` | Solitario, reto diario, confirmación al colocar, modalidad de países y el mapa de la línea. |
| `accesibilidad.mjs` | Que el foco no se pierda al repintar, que las capas sean diálogos, que lo invisible se anuncie y que las bandas tengan contraste. |
| `reglas-firestore.mjs` | Quién puede escribir en una sala y qué puede escribir. Necesita el emulador. |
| `compatibilidad-version-anterior.mjs` | Que las reglas nuevas aceptan las salas de la versión anterior. Necesita el emulador. |
| `entrada-por-enlace.mjs` | La secuencia del SDK al entrar por una invitación. Necesita el emulador. |

`reglas-firestore.mjs` cubre quién puede escribir en una sala y qué puede escribir:
entrar, empezar, colocar carta, cerrar turno, saltar turno, expulsar, marcharse y una
docena de intentos de trampa (vaciarse la mano, repartirse cartas, declararse ganador
con cartas, expulsar al anfitrión). Si alguna denegación se explica por el límite de
1000 expresiones de Firestore en vez de por la propia regla, el emulador lo imprime:
esa señal no debe aparecer.

`compatibilidad-version-anterior.mjs` comprueba que las reglas nuevas siguen aceptando las
salas y las escrituras de la versión anterior de la aplicación, que no conocía el campo
`winners`. Así se pueden publicar las reglas sin esperar a que todos los móviles hayan
recargado la aplicación.

`entrada-por-enlace.mjs` fija el comportamiento del SDK del que depende `connectToRoom()`:
al entrar por una invitación, la primera instantánea de `onSnapshot` llega de la caché y
todavía no incluye a quien acaba de entrar. Comprueba el SDK y la condición, no el propio
`online.js`, que no se puede importar desde Node porque carga Firebase desde gstatic.

`accesibilidad.mjs` juega con teclado sobre el DOM simulado: comprueba que tras cada
repintado el foco vuelve donde debe, que las capas se anuncian como diálogos y devuelven
el foco al cerrarse, que elegir carta y hueco pasa por la región viva, y que el texto de
las bandas de época llega a 4,5:1 de contraste. Ese último es puro dato: no necesita
navegador y avisa en cuanto alguien añade una banda demasiado clara.

`service-worker.mjs` ejecuta el archivo real con un entorno de service worker simulado.
Comprueba lo que decide qué versión ve cada móvil: se responde con la copia guardada,
pero se pide la del servidor por detrás, así que un archivo nuevo llega en el siguiente
arranque aunque se olvide subir el número de la caché.
