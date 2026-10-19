# Continuum en las tiendas

Ficha, notas de revisión, declaraciones de privacidad y preparación comercial para App Store
y Google Play. El estado general está en [ROADMAP.md](../ROADMAP.md); la beta y sus pruebas, en
[BETA_CHECKLIST.md](../BETA_CHECKLIST.md); la firma y la subida de compilaciones, en
[DISTRIBUCION_MOVIL.md](../DISTRIBUCION_MOVIL.md).

Estado a 11 de octubre de 2026: la app de iPhone se distribuye por TestFlight; Google Play
todavía no tiene ficha. Nada de este documento se ha enviado aún a revisión. Todo lo que se
envíe a una tienda debe describir exactamente la compilación enviada: si una función cambia,
se revisa aquí antes de enviarla.

## Identidad

- Nombre: **Continuum**.
- Identificador: `com.continuum.game` (estable: cambiarlo equivale a publicar otra app).
- Versión de la beta: `0.1.1` (`versionName` en `android/app/build.gradle` y
  `MARKETING_VERSION` en el proyecto de Xcode).
- Categoría propuesta: Juegos / Trivia. Secundaria posible: Educación o Juegos de mesa.
- Público: familias y grupos de amigos.
- Modelo: gratuita, **sin compras, sin publicidad y sin seguimiento**.
- Política de privacidad: `https://continuumjuego.es/privacidad.html` (misma información que
  [PRIVACIDAD.md](../PRIVACIDAD.md)). Soporte: `feedbackcontinuum@gmail.com`.
- URL de soporte (ficha de App Store y Play): `https://continuumjuego.es/soporte.html`.
- URL pública de borrado de cuenta (la pide Google Play; Apple pide el borrado dentro de la app, que
  existe): `https://continuumjuego.es/borrar-cuenta.html`.
- Condiciones de uso: `https://continuumjuego.es/terminos.html`. Aviso legal (identificación del titular,
  LSSI art. 10): `https://continuumjuego.es/aviso-legal.html`.
- Responsable: Fernando Sirvent Merino, a título individual. **El juego se publica gratis, sin publicidad,
  compras ni ingresos**, así que en App Store Connect (Negocio → Estado de comerciante) y en Play Console hay
  que declararse **«no comerciante»**: las fichas no muestran dirección ni teléfono, y en la web solo constan el
  nombre y el correo (sin NIF ni domicilio). Decisión del titular (octubre de 2026): no vender por ahora, porque
  vender obliga a publicar NIF y una dirección física y, con los ingresos esperados (unos cientos de euros), no
  compensa el alta, las cuotas ni la exposición.

### Si algún día se vende algo dentro del juego

Vender (también anuncios o donaciones) convierte al titular en comerciante, y entonces hace falta **antes de
la primera venta**: declararse comerciante en las dos tiendas (muestran dirección, teléfono y correo en la UE),
completar el aviso legal (art. 10 de la LSSI) y pasar por una gestoría (alta, IVA, cuotas, depósito legal). Los
estudios españoles con juegos de pago lo publican así (ejemplo revisado: Toro Games, SL, en torogames.es):

| Dato | Como autónomo | Como sociedad (SL) |
| --- | --- | --- |
| Titular | Fernando Sirvent Merino | Denominación social |
| Identificación fiscal | NIF | CIF |
| Domicilio | Dirección física para notificaciones (sin domiciliación contratada, sería la de casa) | Domicilio social |
| Registro | — | Registro Mercantil (tomo, folio, hoja) |
| Contacto | Correo y, como hacen la mayoría, teléfono | Igual |

Además: condiciones de venta (precio, desistimiento, restauración de compras), una sección «Compras» en la
política y quitar «gratuito / sin compras» de `terminos.html`, la política y la ficha. Vender sin publicar
estos datos incumple la LSSI (infracción leve, multa de hasta 30.000 €).

## Textos de la ficha

Revisar el límite de caracteres de cada campo al rellenarlo; los de abajo son el contenido.

**Subtítulo:** Cartas para descubrir y ordenar el mundo

**Descripción corta (Google Play):** Coloca cada carta en su lugar y descubre la historia,
la ciencia y la naturaleza que hay detrás.

**Descripción larga:**

> Continuum es un juego de cartas para ordenar hechos, lugares, animales, inventos y
> acontecimientos. Coloca cada carta en su sitio de la línea y descubre su explicación: cada
> error es una ocasión para aprender.
>
> Juega solo, a tu ritmo, o con amigos: pasando un mismo móvil, cada uno en el suyo en una
> sala privada, por la misma Wi-Fi sin internet, o en duelos por turnos que se juegan cuando
> cada uno puede. En Jugar online te sientas en una mesa pública de 2 a 4 personas.
>
> Incluye grandes colecciones de Historia, Entretenimiento, Ciencia, Naturaleza y Geografía,
> Retos rápidos de temas cortos, un reto diario igual para todo el mundo y poderes opcionales
> como Pulso y Fantasma.
>
> Sin registro: al abrir el juego se crea un invitado con un alias. En iPhone puedes, si
> quieres, entrar con Apple para conservar tu progreso al cambiar de móvil. Aparecer en el
> ranking del reto diario es opcional.
>
> Sin anuncios, sin compras y sin seguimiento.

**Palabras clave:** cartas, trivia, historia, ciencia, geografía, animales, cultura, juego,
aprender, amigos, cronología, reto diario.

No anunciar: competición pública arbitrada, protección completa contra trampas, avisos en el
móvil (aún no activos) ni cifras «totalmente verificadas».

## Capturas

Generarlas desde una compilación final, en dispositivos reales o en los tamaños que pida cada
tienda, sin nombres ni salas reales y sin simular funciones que la versión no tenga:

1. Portada.
2. Elección de colección y mazo.
3. Tablero con una mano y la línea (con un título largo).
4. Explicación de una carta tras colocarla.
5. Retos rápidos o reto diario.
6. Sala con amigos o mesa pública.
7. Ajustes con el texto ampliado.

Las imágenes del navegador durante el desarrollo no valen como capturas aprobadas. El icono
actual es el candidato, sujeto a la elección del titular.

## Notas para App Review

- No hace falta cuenta de prueba: al abrir con conexión, el juego crea automáticamente un
  invitado anónimo de Firebase Authentication, sin correo, contraseña ni nombre real.
- **Iniciar sesión con Apple** es opcional y solo vincula el invitado para conservar el
  progreso en otro iPhone. El juego no pide a Apple ni nombre ni correo.
- **Eliminar la cuenta**: Atlas → «Tu cuenta y tus datos» → eliminar. Pide confirmación; en una
  cuenta de Apple, además, reautentica y revoca el acceso de la app (`revokeAccessToken`).
- El ranking del reto diario es opcional (se pregunta al terminar el primer reto y se cambia
  en Ajustes o en el Atlas). Sus resultados los declara el propio dispositivo: es un marcador
  social, no una competición con premios.
- Funciones online (salas, mesas públicas, Retos rápidos en red y duelos por turnos) usan
  Firebase (Authentication, Firestore, Cloud Functions). Firebase App Check con App Attest
  comprueba que las peticiones vienen de la app.
- Las partidas en un solo móvil y en solitario funcionan sin conexión una vez abierto el juego.
- Sin publicidad, sin compras, sin seguimiento ni analítica de terceros.
- Lo único que los jugadores ven de otros es el alias, el avatar ilustrado (elegido entre 36
  del propio juego) y los resultados. No hay chat. Se puede bloquear a alguien en los duelos.
- La política de privacidad y el soporte están en las URL de arriba.

**Moderación (guía 1.2 de Apple):** el único contenido creado por usuarios son los alias, y la
app ya tiene las tres piezas que pide la guía: un filtro de nombres ofensivos y reservados
(`moderacion.js`, también al cambiar de nombre), un botón «Denunciar» junto a los nombres ajenos
(ranking, tablón y plazas de las mesas, rivales de los duelos) y el bloqueo de retos en los duelos.
Las denuncias llegan a la colección `reports` y las revisa el responsable en la consola de Firebase
(ver «Denuncias de nombres» en [CONFIGURAR_MULTIJUGADOR.md](../CONFIGURAR_MULTIJUGADOR.md)). Apple
también espera un contacto publicado (el correo de soporte) y responder a las denuncias con rapidez:
comprométete a revisarlas en un plazo razonable antes de enviar la app. Lo que no existe: bloqueo en
las mesas públicas (solo en los duelos) y chat (no lo hay, así que no hace falta moderarlo).
Notas para App Review: «Los nombres se filtran, se pueden denunciar desde cualquier lista y se
bloquean los retos de quien abusa; las denuncias las revisa el equipo.»

## App Store: «Privacidad de la app»

Respuestas preparadas a partir de [privacidad.html](../privacidad.html) para la app de iPhone tal
como está. Confirmar contra la compilación enviada.

- **¿Se recogen datos?** Sí.
- **Seguimiento (tracking):** No. No se combinan datos con los de otras empresas ni se usan para
  publicidad; no hay SDK publicitario ni identificador de publicidad.

| Tipo de dato (Apple) | Qué es en Continuum | Finalidad | ¿Vinculado al usuario? | ¿Seguimiento? |
| --- | --- | --- | --- | --- |
| Identificadores → ID de usuario | UID de Firebase del invitado o de la cuenta de Apple | Funcionalidad de la app | Sí | No |
| Contenido del usuario → Contenido de juego | Progreso, estadísticas por carta, récords, rachas, retos diarios, jugadas y resultados de salas y duelos | Funcionalidad de la app | Sí | No |
| Contenido del usuario → Otro contenido del usuario | Alias y avatar elegidos; lista de bloqueados | Funcionalidad de la app | Sí | No |

- **No se recogen:** datos de contacto (correo, teléfono, dirección), salud, finanzas,
  ubicación, contactos, historial de navegación o búsqueda, compras, identificador del
  dispositivo ni datos de diagnóstico automáticos.
- **Notas:**
  - Los avisos del móvil aún no están activos; si se activan, el token del dispositivo pasa a
    declararse como «Identificadores → ID del dispositivo» (funcionalidad, vinculado).
  - El comentario desde Ajustes abre un correo que la persona revisa y envía; encaja en el
    criterio de declaración opcional de Apple (voluntario, infrecuente y visible al enviarlo).
    Si se prefiere prudencia, declararlo como «Diagnóstico → Otros datos de diagnóstico».
  - Las cuentas de Apple vinculadas antes del 10 de octubre de 2026 pudieron entregar un correo
    que Firebase conserva en el registro de acceso y que el juego no usa. Decidir con la revisión
    legal si eso obliga a declarar «Dirección de correo electrónico».
  - App Attest lo gestiona Apple y no aporta datos personales al juego.

## Google Play: «Seguridad de los datos»

Borrador para cuando exista la ficha de Android. La compilación Android actual no lleva App
Check (Play Integrity exige estar publicada en Google Play) ni avisos activos.

- **Datos recogidos:** sí. **Compartidos con terceros:** no (Google actúa como encargado del
  tratamiento, lo que Google Play no cuenta como «compartir»).
- **Información personal → Nombre:** el alias (Google incluye los apodos). Funcionalidad de la
  app y gestión de la cuenta; obligatorio para jugar online.
- **Información personal → ID de usuario:** UID de Firebase. Funcionalidad de la app.
- **Actividad en la app → Otro contenido generado por el usuario / interacciones en la app:**
  progreso, estadísticas, retos diarios, jugadas y resultados. Funcionalidad de la app.
- **Cifrado en tránsito:** sí (HTTPS / TLS de Firebase).
- **Borrado:** sí, desde el juego (Atlas → «Tu cuenta y tus datos») o escribiendo al correo de
  soporte. La URL pública para pedir el borrado sin instalar la app es `borrar-cuenta.html` (ver arriba).
- No marcar «no se recogen datos»: la autenticación anónima también es un dato de usuario.

## Inventario de datos

- **En el dispositivo:** partidas guardadas, progreso, ajustes, perfil y estadísticas, racha y
  retos diarios, sesión de Firebase, jugadores recientes de un solo móvil y datos de los duelos
  (rivales, jugadas pendientes).
- **En Firestore:** perfil, alias, progreso y retos diarios (`playerProfiles`, `playerNames`,
  `playerProgress`); ranking si se acepta (`dailyScores`, `weeklyScores`); salas, mesas, colas y
  duelos con alias, avatar, jugadas y presencia; bloqueados y archivados; registros técnicos de
  cuota y de avisos. El mapa completo, con quién lee y escribe y cuánto se conserva, está en
  [MODELO_DE_DATOS.md](MODELO_DE_DATOS.md).
- **Acciones voluntarias:** abrir un correo de comentarios, descargar un diagnóstico, compartir
  un enlace de duelo o de sala, copiar o recuperar el perfil.

Antes de enviar: confirmar los SDK presentes en el binario, qué llega realmente a Firebase en
producción y que la limpieza diaria (`purgeExpiredData`) funciona (publicada el 11 de octubre de 2026).

## Clasificación por edades

Sin violencia, sexo, apuestas, compras ni publicidad. Hay contenido creado por usuarios (alias
visibles) y juego online con desconocidos en las mesas públicas, sin chat. Algunas cartas tratan
guerras o hechos históricos de forma informativa. La política pide permiso de madre, padre o
tutor por debajo de 14 años para jugar online y aparecer en el ranking. Completar los
cuestionarios de cada tienda con el contenido real de la versión enviada.

## Preparación comercial

**Alcance de la primera versión:** solitario, reto diario, Retos rápidos, partidas en un solo
móvil, salas con amigos (internet y Wi-Fi), duelos, mesas públicas y ranking opcional. Fuera de
alcance mientras no exista un servidor autoritativo: competición pública arbitrada, premios y
clasificaciones certificadas.

**Monetización:** pendiente del feedback de la beta. Comparar pago único y ampliaciones de
contenido con personas reales antes de implementar cobros. La cartera (`cartera.js`) ya separa
qué se puede jugar; si algún día se venden mazos, hará falta usar las compras oficiales de cada
tienda, restauración, reembolsos, validación de recibos en servidor y pruebas en sandbox. No
añadir un sistema de pago ficticio.

**Marca y derechos:** el nombre «Continuum» no se declara libre ni registrado: comprobar OEPM,
EUIPO y las propias tiendas. Conservar la procedencia del arte
([PROCEDENCIA_ARTE_IA.md](../PROCEDENCIA_ARTE_IA.md)) y las licencias de terceros. Una URL de una
fuente factual no da licencia para copiar su texto o sus imágenes. Decidir la licencia definitiva
del código.

**Pendiente externo:**

- Google Play Console y la primera ficha de Android.
- Dirección postal del responsable.
- Revisión legal de la política de privacidad y de las declaraciones de cada tienda.
- Búsqueda de marca.
- Pruebas en Android real y con testers externos de TestFlight.
- Capturas finales.

## Criterio de publicación

No enviar una compilación como definitiva hasta que:

1. Se haya probado en un iPhone y un Android reales.
2. No queden bloqueos P0/P1 (ver [BETA_CHECKLIST.md](../BETA_CHECKLIST.md)).
3. La política de privacidad tenga responsable, contacto, dirección y URL definitivos.
4. La ficha y las declaraciones describan exactamente las funciones de la versión enviada.
5. Firebase (reglas, Functions y App Check) esté activo y verificado para la revisión.
6. Se hayan guardado la compilación enviada, su número, su hash y sus notas de cambios.
