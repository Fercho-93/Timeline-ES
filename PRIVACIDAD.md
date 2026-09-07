# Política de privacidad de Continuum

Borrador inicial para la fase de beta, redactado a partir de lo que el código
realmente hace (`online.js`, `settings.js`, `service-worker.js`). Antes de
publicar en App Store o Google Play conviene una revisión profesional para los
aspectos legales (aviso legal, jurisdicción, RGPD si aplica), tal como señala
`CONFIGURAR_MULTIJUGADOR.md`.

## Qué datos recoge Continuum

Continuum no pide nombre real, correo, teléfono ni contraseña para jugar.

- **Modo de un solo móvil (local o solitario):** no envía ningún dato a
  ningún servidor. Todo se guarda únicamente en el dispositivo (ver más abajo).
- **Modo de varios móviles (online):** usa Firebase (Google) para conectar a
  las personas que juegan la misma partida. Ver el apartado siguiente.
- **Duelo por enlace:** la partida entera viaja codificada dentro del propio
  enlace que se comparte; no pasa por ningún servidor de Continuum.

## Qué utiliza Firebase

El modo de varios móviles usa dos servicios de Firebase:

- **Authentication (anónimo):** al entrar en una sala, Firebase asigna un
  identificador anónimo (`uid`) al dispositivo. No está vinculado a ningún
  dato personal ni requiere iniciar sesión.
- **Firestore:** guarda el documento de la sala mientras dura la partida:
  el código de sala, el nombre que cada participante escribe para esa
  partida, el mazo elegido, el mazo de cartas y la línea temporal en curso.
  Ese nombre lo elige libremente quien juega en cada partida y no tiene por
  qué ser su nombre real.

Google procesa esos datos como proveedor de infraestructura; consulta la
política de privacidad de Firebase/Google para más detalle sobre su parte.

## Cómo funcionan los identificadores

- El `uid` anónimo de Firebase se genera por dispositivo/instalación, no por
  persona. Reinstalar la aplicación o borrar sus datos genera uno nuevo.
- El código de sala es una cadena aleatoria de 8 caracteres sin relación con
  ninguna persona.

## Qué datos de partidas se almacenan y dónde

- **En el dispositivo (`localStorage`):** el perfil, las estadísticas, los
  logros, la racha del reto diario, el tema elegido y qué nombre se usó la
  última vez en cada sala. Nada de esto sale del dispositivo salvo que la
  persona lo exporte ella misma (por ejemplo, para pasarlo a otro móvil).
- **En Firestore (mientras la sala está activa):** el documento de la sala
  descrito arriba. Se borra cuando el anfitrión cierra la sala; las salas
  abandonadas sin actividad quedan pendientes de una directiva de limpieza
  automática por antigüedad (ver `CONFIGURAR_MULTIJUGADOR.md`, aún por
  configurar en la consola de Firebase en el momento de escribir esto).

## Cuánto tiempo se conservan

- Los datos en el dispositivo se conservan hasta que la propia persona
  desinstala la aplicación, borra los datos del sitio o los borra a mano
  desde Ajustes.
- Las salas de Firestore se conservan mientras están activas y, una vez
  configurada la directiva de TTL mencionada arriba, un plazo limitado tras
  su último uso.

## Cómo contactar

Desde **Ajustes → Enviar comentario** se puede escribir directamente. Esa
dirección de contacto está pendiente de configurarse antes de repartir la
beta (ver `settings.js`, `FEEDBACK_EMAIL`).

## Cómo solicitar la eliminación de datos

- Los datos guardados en el propio dispositivo se eliminan borrando los
  datos de la aplicación o desinstalándola.
- Para pedir el borrado anticipado de una sala concreta en Firestore, basta
  con escribir a la dirección de contacto indicando el código de sala.

## Lo que Continuum no hace

- No incluye anuncios ni compras dentro de la aplicación.
- No usa cookies de seguimiento ni analítica de terceros.
- No comparte datos con nadie salvo la infraestructura de Firebase necesaria
  para que funcione el modo de varios móviles.
