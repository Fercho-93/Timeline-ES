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
- Público: jóvenes y adultos, también para jugar en familia o con amigos (no dirigido a niños pequeños; ver «Clasificación por edades»).
- Modelo: gratuita, **sin compras, sin publicidad y sin seguimiento**.
- Política de privacidad: `https://continuumjuego.es/privacidad.html` (misma información que
  [PRIVACIDAD.md](../PRIVACIDAD.md)). Soporte: `feedbackcontinuum@gmail.com`.
- URL de soporte (ficha de App Store y Play): `https://continuumjuego.es/soporte.html`.
- URL pública de borrado de cuenta (la pide Google Play; Apple pide el borrado dentro de la app, que
  existe): `https://continuumjuego.es/borrar-cuenta.html`.
- Condiciones de uso: `https://continuumjuego.es/terminos.html`. Aviso legal (identificación del titular,
  LSSI art. 10): `https://continuumjuego.es/aviso-legal.html`.
- Responsable: Fernando Sirvent Merino, a título individual.

### Decisión del titular (21 de octubre de 2026): gratis al lanzar, ventas más adelante

**Fase 1, lanzamiento: gratis, sin publicidad, compras ni ingresos.** En App Store Connect (Negocio → Estado de
comerciante) y en Play Console se declara **«no comerciante»**: es verdad mientras no haya ingresos. Las fichas
no muestran dirección ni teléfono y las páginas legales actuales siguen siendo ciertas. No hay que cambiar nada.
No se prometerá «gratis para siempre» en ninguna ficha ni texto (hoy no figura en ninguno).

**Estado a 21 de octubre de 2026 (Apple):** declaración de comerciante completada como «no comerciante»,
contrato del Apple Developer Program aceptado y tarjeta de la membresía anual actualizada (si caduca, Apple
puede retirar las apps). Pendiente: la ficha de Google Play con «no comerciante».

**Fase 2, cuando el juego tenga tráfico: ventas de colecciones y mazos dentro del juego.** Antes de la primera
venta, en este orden:
1. Consulta con un Punto de Atención al Emprendedor o un asesor: alta en Hacienda, IVA e IRPF, si corresponde
   cuota de autónomo con ingresos bajos, y si el aviso legal debe llevar NIF y domicilio (ver abajo).
2. Declararse **comerciante** en las dos tiendas, **con semanas de antelación**: Apple verifica los datos y hay
   desarrolladores que cuentan apps bloqueadas en toda la UE mientras el cambio estaba «en revisión» (relatos
   sueltos, no cifras oficiales). En Apple: App Store Connect → Negocio → Acuerdos → Cumplimiento →
   Reglamento de Servicios Digitales (se puede indicar app por app). En Google Play: **procedimiento sin
   confirmar**; buscar «estado de comerciante» o «Ley de Servicios Digitales» en la ayuda de Play Console al
   llegar. No se venderá con la declaración «no comerciante»: Apple
   considera comerciante a quien gana dinero con la app y la declaración recae en quien la hace (hay apps de
   pago que figuran como «no comerciante», pero eso no las hace correctas).
3. Contratos y datos de cobro: «Apps de pago» y formularios fiscales y bancarios en App Store Connect, y perfil
   de pagos en Play Console.
4. Desarrollar las compras con las **compras oficiales de cada tienda** (en iOS, obligatorias para contenido
   digital). La versión web no puede usarlas: o no vende, o necesita otra pasarela de pago. Incluye restaurar
   compras, validación en servidor, reembolsos y qué hacen las cuentas de menores de 14 años.
5. Mantener gratis lo que ya es gratis; lo de pago serán colecciones nuevas.
6. En la misma versión que active la primera compra: textos legales y de privacidad, ficha, cuestionarios de
   privacidad de las tiendas y declaración de comerciante (ver «Todavía no se ha cambiado ningún texto»).

Datos de comerciante en la Fase 2 (decisión del titular): qué se publica y dónde.

| Dato | Dónde se ve | Quién lo ve |
| --- | --- | --- |
| Nombre, dirección, teléfono y correo | Ficha de la App Store y de Google Play (UE) | Cualquiera que abra la ficha |
| DNI/NIF, datos fiscales y bancarios | Solo se entregan a Apple, Google y Hacienda | Nadie más |
| Nombre y `feedbackcontinuum@gmail.com` | `aviso-legal.html`, política de privacidad y resto de páginas legales | Cualquiera |

- Los datos de la ficha se introducen directamente en App Store Connect y Play Console. **No se escriben en
  el repositorio** (se publica en GitHub Pages).
- Dirección de la ficha: la que el titular decida dar (otros estudios españoles independientes muestran solo
  calle y número). Apple y Google pueden pedir justificar nombre y dirección.
- En las páginas legales se mantiene solo el nombre y el correo de contacto de Continuum, sin NIF ni domicilio,
  como hacen los estudios independientes que ha mirado el titular. **Riesgo asumido y sin confirmar:** el art. 10
  de la LSSI puede exigir NIF y domicilio en el aviso legal (infracción leve, multa de hasta 30.000 €). Pendiente
  de consultar en un Punto de Atención al Emprendedor o con un asesor.
- Obligaciones fiscales pendientes de confirmar con un asesor: alta en Hacienda por la actividad, IVA e IRPF
  y si corresponde cuota de autónomo con ingresos bajos (según recuerdo, no hay obligación de cotizar al RETA
  por debajo del salario mínimo anual; no verificado).

**Todavía no se ha cambiado ningún texto publicado:** `aviso-legal.html`, `terminos.html`, `privacidad.html` y
`PRIVACIDAD.md` dicen «gratuito, sin compras, sin ingresos» y son ciertos mientras no haya ventas. Al activar
la primera compra hay que, en la misma versión, quitar «gratuito / sin compras», añadir una sección «Compras»
(precio, desistimiento, restauración de compras, pagos a cargo de Apple/Google), cambiar la ficha a «comerciante»
y actualizar el cuestionario de privacidad de las tiendas. Se usarán las compras oficiales de cada tienda.

### Referencia: cómo lo publican otros estudios españoles

Estudios con juegos de pago publican datos de identificación completos (ejemplo revisado: Toro Games, SL, en
torogames.es). El titular ha elegido un criterio más mínimo, descrito arriba.

| Dato | Como autónomo | Como sociedad (SL) |
| --- | --- | --- |
| Titular | Fernando Sirvent Merino | Denominación social |
| Identificación fiscal | NIF | CIF |
| Domicilio | Dirección física para notificaciones | Domicilio social |
| Registro | — | Registro Mercantil (tomo, folio, hoja) |
| Contacto | Correo y, como hacen la mayoría, teléfono | Igual |

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

La app se declara para iPhone y iPad (`TARGETED_DEVICE_FAMILY = "1,2"`): App Store Connect exige además capturas de iPad de 13" (y las de iPhone de 6,9"), y Google Play pide capturas de tableta si se publica para tabletas. En iPad, la partida en horizontal usa dos columnas (`tablet.css`) y en vertical la mesa a escala; hacer capturas de las dos orientaciones desde un iPad real o el simulador, no desde el navegador.

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
- Al abrirse, el juego pregunta si se tienen 14 años o más. Para revisar todo, responder «Sí»: con
  menos de 14 y sin permiso de los padres, el juego funciona solo sin conexión.
- Sin publicidad, sin compras, sin seguimiento ni analítica de terceros.
- Lo único que los jugadores ven de otros es el alias, el avatar ilustrado (elegido entre 36
  del propio juego) y los resultados. No hay chat. Se puede bloquear a alguien en los duelos.
- La política de privacidad y el soporte están en las URL de arriba.

**Moderación (guía 1.2 de Apple):** el único contenido creado por usuarios son los alias, y la
app tiene las piezas que pide la guía: un filtro de nombres ofensivos y reservados (`moderacion.js`,
también al cambiar de nombre), un botón «Denunciar o bloquear» junto a los nombres ajenos (ranking,
tablón y plazas de las mesas, menú de la sala durante la partida y al terminar, rivales de los duelos)
y el bloqueo. Bloquear es privado y se guarda en `duelPreferences/{uid}/blocked`, la misma lista que
usan los duelos (y que sus reglas hacen valer en los dos sentidos): quien bloquea deja de ver las mesas de
esa persona y su nombre en el ranking, no entra en mesas públicas donde ya esté sentada y no puede retarla
ni ser retado. Se deshace en Atlas → «Tu cuenta y tus datos» → «Personas bloqueadas». Tras denunciar se
ofrece «Bloquear también». Las denuncias llegan a la colección `reports` y las revisa el responsable en la
consola de Firebase (ver «Denuncias de nombres» en [CONFIGURAR_MULTIJUGADOR.md](../CONFIGURAR_MULTIJUGADOR.md)).
Apple también espera un contacto publicado (el correo de soporte) y responder a las denuncias con rapidez:
comprométete a revisarlas en un plazo razonable (los rechazos que se ven en los foros piden actuar en 24 horas)
antes de enviar la app. Límites conocidos: el bloqueo no impide que la persona bloqueada entre después en una
mesa en la que ya estás; en las partidas por Wi-Fi o en el mismo móvil no hay nombres de desconocidos; no hay
chat, así que no hace falta moderarlo. Notas para App Review: «Los nombres se filtran, se pueden denunciar y
bloquear desde cualquier lista; las denuncias las revisa el equipo.»

## App Store: «Privacidad de la app»

Respuestas para App Store Connect → la app → «Privacidad de la app», tal como está el juego en
octubre de 2026 (sin anuncios, compras ni avisos del móvil activos). Si algo de eso cambia, cambian
las respuestas.

**Pregunta inicial.** «¿Usted o sus socios externos recopilan datos de esta app?» → **Sí.**

**Tipos de datos que hay que marcar** (los demás, sin marcar):

| Categoría → tipo | Qué es en Continuum |
| --- | --- |
| Identificadores → **ID de usuario** | El identificador de Firebase del invitado o de la cuenta de Apple |
| Contenido del usuario → **Contenido de juego** | Progreso, estadísticas por carta, récords, rachas, retos diarios (aciertos y tiempo), jugadas y resultados de salas y duelos, presencia en la sala |
| Contenido del usuario → **Otro contenido del usuario** | Alias y avatar elegidos, lista de bloqueados y archivados, denuncias de nombres |

**Para cada uno de los tres**, las mismas respuestas:
- «¿Para qué se usan?» → solo **Funcionalidad de la app**. (Las denuncias y la cuota de altas
  sirven también contra el abuso, que Apple cuenta como funcionalidad.)
- «¿Están vinculados a la identidad del usuario?» → **Sí** (van unidos al identificador de la
  cuenta, aunque no se sepa quién es).
- «¿Se usan para rastrear?» → **No.**

**Lo que no se marca, y por qué:**
- *Información de contacto* (nombre, correo, teléfono, dirección): el juego no la pide. Con Apple
  se recibe solo el identificador, no el nombre ni el correo. Excepción a decidir con la revisión
  legal: las cuentas de Apple vinculadas antes del 10 de octubre de 2026 pudieron entregar un correo
  que Firebase conserva y el juego no usa.
- *Identificador del dispositivo*: no mientras los avisos del móvil sigan apagados. Si se activan,
  marcar «Identificadores → ID del dispositivo» (funcionalidad, vinculado, sin rastreo).
- *Diagnóstico*: no hay informes automáticos. El comentario de Ajustes abre un correo que la
  persona revisa y envía: es voluntario y visible, y Apple no lo exige. Si se prefiere prudencia,
  «Diagnóstico → Otros datos de diagnóstico».
- *Ubicación, salud, finanzas, contactos, historial, compras, datos sensibles*: no se recogen.
- *Uso de la app*: no hay analítica. La presencia en una sala se declara como contenido de juego.
- App Attest (App Check) lo gestiona Apple y no entrega datos personales al juego.

**Rastreo:** sin SDK publicitario ni identificador de publicidad: no hace falta el aviso de
App Tracking Transparency.

## Google Play: «Seguridad de los datos»

Respuestas para Play Console → Política de la app → «Seguridad de los datos». La versión de Android
no lleva App Check (Play Integrity exige estar publicada) ni avisos activos.

**Preguntas generales:**
- «¿Tu app recoge o comparte alguno de los tipos de datos de usuario obligatorios?» → **Sí.**
- «¿Todos los datos de usuario que recoge tu app están cifrados en tránsito?» → **Sí** (HTTPS de Firebase).
- «¿Ofreces una forma de que los usuarios soliciten que se eliminen sus datos?» → **Sí**: desde
  la app (Atlas → «Tu cuenta y tus datos» → Eliminar) y en `https://continuumjuego.es/borrar-cuenta.html`.
  Esa misma URL va en el campo «Enlace para eliminar la cuenta».
- «¿Tu app permite crear una cuenta?» → **Sí** (el invitado se crea solo y es una cuenta).

**Tipos de datos que hay que marcar** (todos: *recogidos* sí, *compartidos* no, *procesados de
forma efímera* no):

| Tipo de Google | Qué es en Continuum | ¿Obligatorio? | Finalidades |
| --- | --- | --- | --- |
| Información personal → **Nombre** | El alias (Google incluye los apodos) | Obligatorio | Funcionalidad de la app; Gestión de la cuenta |
| Información personal → **ID de usuario** | Identificador de Firebase | Obligatorio | Funcionalidad de la app; Gestión de la cuenta; Prevención de fraudes, seguridad y cumplimiento |
| Actividad en la app → **Interacciones con la app** | Jugadas, resultados, presencia en salas, retos diarios | Obligatorio | Funcionalidad de la app |
| Actividad en la app → **Otro contenido generado por el usuario** | Avatar elegido, bloqueados, denuncias de nombres | Opcional | Funcionalidad de la app; Prevención de fraudes, seguridad y cumplimiento |

- **Compartidos: no.** Google (Firebase) trata los datos por encargo del responsable, y Google Play
  no cuenta eso como «compartir». Lo que ven otros jugadores (alias, resultados) tampoco es
  «compartir» con terceros en el sentido del formulario.
- **No se marcan:** ubicación, información financiera, salud, mensajes (no hay chat), fotos o
  vídeos (la cámara solo lee códigos QR en el dispositivo), audio, archivos, calendario, contactos,
  información y rendimiento de la app (sin informes automáticos), identificadores del dispositivo
  (los avisos están apagados).
- No marcar «no se recogen datos»: el invitado anónimo ya es un dato de usuario.

**Otras declaraciones de Play Console → Contenido de la app:**
- Anuncios → **No contiene anuncios.**
- ID de publicidad → **No** (el manifiesto no declara `AD_ID`; confirmarlo en el manifiesto final del AAB).
- Acceso a la app → **Toda la funcionalidad está disponible sin restricciones** (no hace falta
  iniciar sesión: el invitado se crea solo).
- Política de privacidad → `https://continuumjuego.es/privacidad.html`.
- Aplicaciones de Gobierno, finanzas, salud, noticias → **No.**

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

El contenido de la versión actual, para responder cualquier cuestionario: sin violencia gráfica
(las cartas de guerras son informativas; si alguna ilustración muestra combates, contarla como
violencia realista leve e infrecuente), sin sexo ni desnudos, sin lenguaje soez (los nombres
ofensivos se filtran), sin drogas, alcohol ni tabaco más allá de datos históricos, sin apuestas ni
casino, sin compras, sin anuncios. Hay **contenido creado por usuarios** (alias visibles) y juego
**online con desconocidos** en las mesas públicas, **sin chat** ni mensajes. Pregunta la edad al
abrirse: con menos de 14 años y sin permiso de los padres, funciona solo sin conexión.

**App Store Connect → la app → Clasificación por edades:**

| Pregunta | Respuesta |
| --- | --- |
| Violencia de dibujos animados o fantasía | Ninguna |
| Violencia realista | Ninguna (o «Infrecuente/leve» si alguna ilustración muestra combates) |
| Violencia prolongada, gráfica o sádica | Ninguna |
| Blasfemias o humor crudo | Ninguno |
| Contenido sexual o desnudos | Ninguno |
| Temas para adultos o sugerentes / de terror | Ninguno |
| Alcohol, tabaco o drogas | Ninguno (o «Infrecuente/leve» si una carta trata su historia) |
| Juegos de azar simulados / apuestas / concursos | No |
| Contenido médico o de tratamiento | No |
| Acceso web sin restricciones | No (solo abre las páginas propias del juego) |
| Contenido generado por usuarios | **Sí** (nombres visibles; hay filtro, denuncia y bloqueo) |
| Mensajería y chat | No |
| Controles parentales | No |
| Verificación de la edad | No (solo una pregunta, sin comprobación) |
| Anuncios | No |

Apple calcula la edad con esas respuestas; lo esperable es 9+ o 13+ por el contenido de usuarios.
Si da más, revisar la respuesta de contenido generado por usuarios.

**Google Play → Contenido de la app → Clasificación del contenido** (cuestionario IARC): categoría
**Juego** (preguntas y respuestas). Violencia, miedo, sexo, lenguaje, drogas, apuestas: **no**.
«¿Los usuarios pueden interactuar o intercambiar contenido?» → **Sí** (nombres visibles en partidas
con desconocidos, sin chat). «¿Comparte la ubicación del usuario?» → **No.** «¿Compras digitales?» →
**No.** Lo esperable es PEGI 3 o PEGI 7 con el aviso «Interacción de usuarios».

**Google Play → Público objetivo:** marcar **13 a 15, 16 a 17 y 18 o más**. No marcar edades por
debajo de 13: obligaría a cumplir la política de Familias (anuncios, SDK y datos especiales) y el
juego no está pensado para niños pequeños. A «¿Puede atraer a niños?» → **No**, y que la ficha y
las capturas no se dirijan a niños (por eso en «Público» de la ficha conviene «jóvenes y adultos,
también en familia» en vez de solo «familias»).

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
