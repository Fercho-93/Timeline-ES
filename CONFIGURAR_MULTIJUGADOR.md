# Activar el modo multijugador

El código de Firebase ya está incluido en `online.js`. Solo falta publicar las reglas de seguridad antes de probar una sala.

## 1. Publicar las reglas de Firestore

> Publica esta versión de `firestore.rules` una vez. A partir de ella, **añadir juegos ya no
> obliga a republicarlas**: las reglas dejaron de llevar dentro la lista de juegos permitidos,
> porque nunca pudieron validar el contenido de un mazo (las cartas viven en el cliente) y esa
> lista solo servía para obligar a una publicación manual con cada juego nuevo.

1. Abre en Firebase el proyecto conectado a **Continuum**. Puedes identificarlo por el `projectId` de `online.js`, aunque su nombre en la consola todavía sea el anterior.
2. Entra en **Firestore**.
3. Abre la pestaña **Reglas**.
4. Borra el contenido del editor.
5. Copia todo el contenido del archivo `firestore.rules`.
6. Pégalo en el editor y pulsa **Publicar**.

Cada escritura entra por una sola rama de las reglas, según lo que intente cambiar: entrar
en el vestíbulo, repartir, colocar una carta, cerrar el turno, saltar un turno, expulsar o
marcharse. Las reglas comprueban quién escribe, en qué fase está la sala, qué campos toca y
que las cartas ni se creen ni se dupliquen:

- Solo el participante de turno coloca carta, y solo puede tocar su propia mano.
- Al acertar, la carta sale de la mano y entra en la línea temporal; no se roba nada de paso.
- Nadie puede vaciarse la mano sin jugar, repartir cartas a otras personas fuera del
  desempate de final de ronda ni declararse ganador con cartas en la mano.
- El juego tiene que ser un identificador corto, y no cambia después de crear la sala, igual
  que el código y el anfitrión. Cuál sea en concreto lo decide el cliente: un valor que no
  conozca hace que caiga en el mazo por defecto.
- Expulsar es cosa del anfitrión; marcharse, de cada cual. El anfitrión no puede ser
  expulsado: cierra la sala.
- La sala guarda también una huella del mazo —el mismo mecanismo del duelo por enlace—,
  igual de inmutable que el juego. Si un móvil se actualiza mientras espera en el vestíbulo
  y el mazo ha cambiado entretanto, entrar o repartir se rechaza con un aviso claro en vez
  de repartir cartas que no significan lo mismo en cada pantalla.

**Lo que las reglas no pueden comprobar:** si el año de la carta encaja de verdad en el hueco
elegido. Las fechas viven en `cards.js` y `movies.js`, dentro del propio navegador, así que esa
parte la decide el cliente. Quien sepa manipular su navegador puede declarar acertada una
jugada fallida en su turno, aunque no puede robar cartas ajenas, saltarse turnos ni forzar la
victoria. Cerrar también esa puerta exige mover la jugada a una Cloud Function, con las manos
en subcolecciones privadas; para un juego de sobremesa entre conocidos no compensa.

Las reglas toleran las salas creadas por la versión anterior de la aplicación, así que se
pueden publicar sin esperar a que todos los móviles hayan recargado la web. Las pruebas de
`tests/reglas-firestore.mjs` y `tests/compatibilidad-version-anterior.mjs` ejecutan estas
reglas contra el emulador oficial antes de publicarlas. Consulta `tests/README.md`.

### Limpiar salas antiguas

Las salas abandonadas se quedan guardadas para siempre. En **Firestore → Copia de seguridad y
TTL → Directivas de TTL**, crea una directiva sobre la colección `rooms` con el campo
`updatedAt`: Firestore borrará solas las salas sin actividad reciente y el proyecto se
mantiene dentro del plan gratuito.

## 2. Comprobar Authentication

### Nombre del proyecto

Para unificar la denominación, cambia el nombre visible del proyecto a **Continuum** en
**Configuración del proyecto → General → Nombre del proyecto**. Este es un paso pendiente
en la consola, no un cambio que aplique el código de este repositorio.

El nombre visible y el identificador son distintos: conserva el `projectId`, `authDomain`
y `storageBucket` actuales de `online.js`. El identificador de un proyecto existente no
se puede renombrar; reemplazarlo por un nombre inventado desconecta las salas y las cuentas.
Eliminar también la denominación histórica de esos identificadores exige un proyecto nuevo
y una migración planificada de configuración y datos.

### Proveedor y dominios

En **Authentication → Método de inicio de sesión**, el proveedor **Anónimo** debe aparecer como habilitado.

Si Firebase muestra un error de dominio al probar desde GitHub Pages:

1. Abre **Authentication → Configuración → Dominios autorizados**.
2. Añade el dominio `TU-USUARIO.github.io`, sustituyendo `TU-USUARIO` por el nombre de tu cuenta.

## 3. Actualizar GitHub Pages

Sube todos los archivos de esta versión. En especial deben estar:

- `app.js`
- `online.js`
- `styles.css`
- `service-worker.js`
- `cards.js`
- `movies.js`
- la carpeta `assets`

El archivo `firestore.rules` no es ejecutado por GitHub Pages; se incluye como copia de seguridad de las reglas publicadas en Firebase.

Al cambiar cualquier archivo conviene subir el número de `CACHE` en `service-worker.js`
(`hilo-modos-v10`, `v11`…): eso hace que el navegador reinstale el service worker y
descarte de golpe la versión anterior. Si se olvida, la actualización llega igualmente,
pero un arranque más tarde. La portada muestra abajo la versión que tiene guardada ese
móvil, que es la forma rápida de comprobar si un cambio ha llegado o no.

## 4. Probar con dos móviles

1. Abre la web actualizada con conexión a internet.
2. Elige **Varios móviles → Crear una sala**.
3. Escribe el nombre del anfitrión.
4. Comparte el enlace generado o pulsa **Mostrar QR** para que el resto lo escanee con la cámara.
5. Abre el enlace desde un segundo móvil e introduce otro nombre.
6. El anfitrión selecciona las cartas iniciales y la persona más joven.
7. Pulsa **Barajar y empezar**.

Durante la partida, el botón **Sala** abre la gestión: compartir el enlace, mostrar el QR y,
si eres el anfitrión, **saltar el turno** de quien se haya quedado sin batería o **expulsar**
a quien ya no juegue. Sus cartas vuelven al descarte y la partida sigue. Quien no sea
anfitrión puede salir por su cuenta desde ese mismo menú.

El orden de entrada en la sala determina el orden de los turnos; la persona marcada como más joven realiza el primero.

## Privacidad y límites

- No se solicitan correos, teléfonos ni contraseñas.
- Las cuentas anónimas las administra Firebase.
- Las salas utilizan códigos aleatorios de ocho caracteres.
- Los códigos QR se generan dentro del propio dispositivo y no envían la invitación a servicios externos.
- La interfaz solo enseña a cada participante su propia mano.
- Es un juego doméstico: el documento de la sala viaja entero a cada móvil, así que quien
  sepa inspeccionar el navegador puede ver las manos ajenas y el orden del mazo. Las reglas
  impiden manipular la partida, no mirar.
- El modo compartido necesita internet. El modo de un móvil continúa funcionando sin conexión.

## Fantasma y Pulso

Publica el contenido completo de `firestore.rules` en Firebase Console → Firestore Database
→ Reglas → Publicar antes de activar Fantasma o Pulso. Si utilizas la CLI autenticada, usa
`firebase deploy --only firestore:rules --project timeline-es` con `firebase.json` apuntando
a este archivo. No hace falta modificar los mazos. Las reglas validan tanto la obtención
privada como el uso de la Carta Pulso, y recolocan un Fantasma duplicado solo tras un robo
válido. Las salas nuevas incluyen de 1 a 3 poderes de cada tipo activado según el número de
jugadores. Fantasma y Pulso utilizan el reparto 50/50 entre las primeras 12 cartas por
jugador y el mazo completo, sin compartir posiciones.

Hasta publicar las reglas, desmarca **Cartas Fantasma** y **Cartas Pulso** en la
configuración de la sala. La app no puede publicar reglas con la clave pública de Firebase:
hace falta la cuenta propietaria o una cuenta de servicio autorizada. El poder sí funciona
sin Firebase al pasar un solo móvil.
