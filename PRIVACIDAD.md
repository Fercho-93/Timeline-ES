# Privacidad de Continuum

Versión 2 · Actualizada el 17 de octubre de 2026.

Esta página explica qué datos trata Continuum, para qué, con quién se comparten, cuánto tiempo se guardan y cómo puedes decidir sobre ellos. Continuum no tiene publicidad, no usa analítica de terceros y no vende ni cede datos a nadie con fines comerciales.

## Lo esencial

- Puedes jugar sin dar correo, contraseña ni nombre real: el juego te crea un invitado con un identificador aleatorio.
- Tu progreso y las partidas online se guardan en servidores de Google (Firebase). Las partidas sin conexión y entre móviles cercanos no pasan por nuestros servidores.
- Aparecer en el ranking es opcional y lo decides tú; puedes dejarlo cuando quieras.
- No hay publicidad, ni analítica de terceros, ni compras. No vendemos ni cedemos tus datos.
- No se envían informes de errores automáticos: solo mandas un comentario si tú quieres.
- Puedes borrar tu cuenta y tus datos desde el juego en cualquier momento.

## Qué datos tratamos

| Qué | Ejemplos | Dónde se guarda | ¿Sale de tu dispositivo? |
| --- | --- | --- | --- |
| Tu invitado | Un identificador aleatorio y un alias y avatar que eliges tú | Firebase (Google) y tu dispositivo | Sí |
| Tu progreso | Estadísticas, logros, cartas descubiertas, récords, rachas y retos diarios de los últimos 60 días | Firebase (Google) y tu dispositivo | Sí |
| Cuenta de Apple (opcional) | El identificador que Apple asigna a esta app | Firebase (Google) | Sí, solo si la vinculas |
| Ranking (opcional) | Alias, avatar, aciertos, tiempo y cartas descubiertas | Firebase (Google) | Sí; lo ven otros jugadores |
| Partidas online | Alias, avatar, jugadas y resultados de salas, mesas, Retos rápidos y duelos | Firebase (Google) | Sí; lo ven quienes juegan contigo |
| Denuncias de nombres | Quién denuncia, a quién, el motivo, dónde y cuándo | Firebase (Google) | Sí; solo las lee el responsable |
| Límite de altas | La hora de la última partida que creaste | Firebase (Google) | Sí |
| Partidas entre móviles cercanos | Nombre de la sala y dirección IP local | Directo entre los móviles | No pasa por nuestros servidores |
| Verificación de la app | Señales técnicas del navegador o de la app y la dirección IP | Google (reCAPTCHA) o Apple (App Attest) | Sí |
| Comentarios (opcional) | Tu texto y un diagnóstico de versión y dispositivo | Tu correo | Solo si tú lo envías |
| Avisos del móvil (si se activan) | Un identificador del dispositivo | Firebase (Google) y Apple | Sí |
| Ajustes y copia de seguridad | Ajustes, sesión y copias del progreso | Tu dispositivo | No |

Cada dato se explica con más detalle, con su base jurídica, en las secciones siguientes.

## Responsable y contacto

Continuum es un proyecto personal. El responsable del tratamiento es **Fernando Sirvent Merino**, a título individual y no como empresa. Para cualquier asunto de privacidad (acceso a tus datos, rectificación, borrado u otra petición) escribe a **feedbackcontinuum@gmail.com**. Antes de ofrecer contenido de pago en el juego se añadirán aquí el NIF y el domicilio del responsable que exige la normativa. Los datos del titular están también en el [aviso legal](aviso-legal.html).

## Tu invitado y tu progreso

Al abrir el juego se crea automáticamente un invitado mediante Firebase Authentication (de Google), sin pedir correo, contraseña ni nombre real. Tiene un identificador aleatorio y un alias como «Jugador 4821», que puedes cambiar en la bienvenida o en el Atlas: usa un apodo, no tu nombre real. El identificador va unido a esta instalación o navegador; no es un identificador del aparato.

Se guardan en Firestore (de Google) y en el propio dispositivo: el alias y el avatar elegidos, las estadísticas (incluido cada acierto y fallo por carta al terminar o guardar una partida), logros, cartas descubiertas, récords, rachas y los retos diarios de los últimos 60 días, con los aciertos, el tiempo empleado y la fecha y hora en que se terminaron. Sirven para que no pierdas tu progreso y puedas seguir en otra sesión.

**Base jurídica:** la prestación del servicio que pides al jugar (art. 6.1.b del RGPD).

## Acceso con Apple (opcional)

En la app de iPhone puedes entrar con tu cuenta de Apple para conservar el progreso si cambias de móvil. El juego no pide a Apple tu nombre ni tu correo: solo recibe el identificador que Apple asigna a esta app. Si vinculaste tu cuenta antes del 10 de octubre de 2026, Apple pudo facilitar entonces un correo (el real o uno de reenvío privado) que Firebase conserva en el registro de acceso; el juego no lo usa ni lo muestra, y se borra al eliminar la cuenta. Los tokens de Apple no se guardan en el dispositivo.

Si al vincular una cuenta de Apple esta ya tenía progreso, eliges cuál conservar; el invitado descartado se borra del servidor. Al eliminar tu cuenta, Apple te pide confirmar y el juego revoca su acceso a tu cuenta de Apple.

## Ranking (opcional)

Al terminar tu primer reto diario se te pregunta si quieres aparecer en el ranking; puedes cambiarlo cuando quieras en Ajustes o en el Atlas. Sin aceptar no se publica nada. Si aceptas, cualquier jugador puede ver tu alias, tu avatar, tus aciertos y el tiempo que tardaste en el reto diario, del día y de la semana, y cuántas cartas has descubierto (en total, en Grandes colecciones y en Retos rápidos). Si dejas de aparecer, se retiran todas tus filas, también las de días y semanas anteriores. Los resultados los declara el juego en el dispositivo; no son una clasificación competitiva validada.

**Base jurídica:** tu consentimiento (art. 6.1.a del RGPD), que puedes retirar en cualquier momento.

## Partidas online

Las salas con amigos, las mesas públicas, los Retos rápidos y los duelos por turnos funcionan con Firebase. Se tratan el identificador seudónimo de tu cuenta, el nombre que eliges para jugar, tu avatar, la versión del juego, el código y el estado de la sala, las cartas y jugadas, los resultados y, mientras juegas en una sala, si tienes la app abierta en pantalla (se actualiza cada 45 segundos).

- Los participantes de una sala o de un duelo ven estos datos durante la partida.
- En el tablón de **mesas públicas**, cualquier jugador puede ver el nombre y el avatar de quien abre la mesa y los nombres de quienes esperan en ella.
- Al retar a alguien a un duelo, la invitación guarda tu alias y el suyo, y le puede llegar un aviso con tu alias.
- Si bloqueas a alguien, el juego guarda su alias en tu lista de bloqueados, que solo ves tú.
- Internamente, el ranking, las salas y los duelos usan el identificador seudónimo de cada cuenta, que otra persona podría ver con herramientas técnicas. No revela quién eres, pero no equivale a anonimato absoluto.

Evita poner información privada en los nombres. No se admiten nombres ofensivos ni que se hagan pasar por el juego o por quien lo gestiona. Junto al nombre de otras personas hay un botón «Denunciar»: al usarlo se guardan tu identificador seudónimo, el de la persona denunciada, su nombre, el motivo que eliges, dónde lo viste y la fecha. Solo las lee el responsable del proyecto para revisar el caso, y se borran a los **90 días**. **Base jurídica:** el interés legítimo en mantener un juego seguro (art. 6.1.f del RGPD). Para evitar abusos, el juego anota la hora de la última partida que creaste y limita las altas a una cada pocos segundos. **Base jurídica:** la prestación del servicio (art. 6.1.b del RGPD) y, para los límites contra el abuso, el interés legítimo en proteger el juego y su coste (art. 6.1.f).

## Partidas entre móviles cercanos

Las salas Wi-Fi y las salas cercanas de iPhone conectan los móviles directamente entre sí, sin pasar por nuestros servidores. Para que se encuentren, el código QR o la invitación de la sala incluye la dirección IP local del móvil que invita dentro de vuestra red (no su dirección pública de internet). Por eso, mientras se prepara ese código, el juego puede abrir la cámara unos segundos: los navegadores solo dan la dirección local real a una página que tiene la cámara en uso. No se graba, no se muestra ni se envía ninguna imagen, y la cámara se cierra en cuanto el código está listo. Si no das permiso, la sala intenta conectarse igualmente, aunque puede fallar más entre Android e iPhone. La cámara también se usa para escanear los códigos QR de invitación.

En las salas cercanas de iPhone, el nombre de quien crea la sala se anuncia por Bluetooth y Wi-Fi a los iPhone cercanos que buscan salas; para entrar hace falta el código de 4 cifras que ve el anfitrión. Comparte los códigos solo con quien vaya a jugar contigo.

## Enlaces de invitación

Algunos enlaces de duelo llevan dentro el nombre y el resultado de quien reta, y cualquier persona con el enlace puede leerlos. Los enlaces nuevos los llevan en la parte de la dirección que no se envía al servidor; los antiguos pueden incluirlos en la parte que sí recibe el alojamiento. Compartir un enlace es siempre una acción tuya, por la app que elijas.

## Comentarios y diagnóstico

Desde Ajustes puedes enviar un comentario: se abre un correo dirigido a feedbackcontinuum@gmail.com con tu texto y un diagnóstico de la versión del juego, la pantalla y el mazo en uso, el modelo y la versión de tu navegador o sistema y la hora. También puedes descargarlo en un archivo. Revísalo antes de enviarlo: enviarlo es voluntario. No se envían informes de errores automáticos.

## Seguridad y prevención de abuso

Para comprobar que las peticiones llegan del juego y no de un programa automático, se usa Firebase App Check. En la web funciona con reCAPTCHA Enterprise de Google, que analiza señales técnicas del navegador y la dirección IP; en la app de iPhone, con App Attest de Apple, que certifica que la app es la original. **Base jurídica:** el interés legítimo en proteger el juego y a quienes juegan (art. 6.1.f del RGPD).

## Avisos

Si das permiso al crear o aceptar un duelo, el navegador puede mostrar un aviso cuando te toca y no tienes la pestaña a la vista; se genera en tu dispositivo. Si en el futuro se activan los avisos del móvil, se guardará un identificador del dispositivo para enviarlos a través de Google (Firebase Cloud Messaging) y, en iPhone, de Apple; ese identificador se borra con tu cuenta.

## Datos en tu dispositivo

El juego guarda en el almacenamiento del navegador o de la app tu progreso, tus ajustes, la sesión de Firebase y, si juegas en un solo móvil, los nombres de los jugadores recientes. También puede guardar los nombres e identificadores de tus rivales para los duelos. Las copias de seguridad del sistema (de Google en Android o de iCloud en iPhone) pueden incluir estos datos y restaurarlos. Si el guardado falla, el juego te ofrece descargar una copia de tu progreso en un archivo.

## Alojamiento y servicios técnicos

La web se aloja en GitHub Pages, que recibe las peticiones necesarias para servirla (dirección IP, navegador y página solicitada) y puede conservar registros técnicos. El código de Firebase se descarga de servidores de Google, también desde la app, por lo que Google recibe la dirección IP.

## Con quién se comparten los datos

- **Google** (Firebase Authentication, Firestore, Cloud Functions, App Check con reCAPTCHA Enterprise y, si se activan, los avisos del móvil), como encargado del tratamiento.
- **Apple**, si entras con Apple (acceso), en la app de iPhone (App Attest) y, si se activan, para los avisos del móvil.
- **GitHub**, como alojamiento de la web.
- **Otros jugadores**, solo en lo descrito en «Partidas online», «Ranking» y «Partidas entre móviles cercanos».
- Las apps que tú elijas para compartir enlaces o enviar comentarios (por ejemplo, WhatsApp o tu correo).

Los datos de Firestore se almacenan en servidores de la Unión Europea. Aun así, Google, Apple y GitHub pueden tratar datos en Estados Unidos u otros países fuera del Espacio Económico Europeo. Esas transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo de la Comisión Europea que ofrecen estos proveedores.

## Cuánto tiempo se guardan

- Tu perfil y tu progreso: mientras exista tu cuenta. Un invitado sin vincular que lleve **un año** sin abrir el juego se borra.
- Las filas del ranking del reto diario: **90 días**. La de cartas descubiertas, mientras sigas en el ranking y exista tu cuenta.
- Las salas online, con su presencia y sus respuestas: **siete días** sin actividad.
- Los duelos por turnos y las salas de Retos rápidos: **30 días** sin actividad (un duelo sin jugar caduca a los siete días).
- Las mesas del tablón público y las colas de partida rápida: un día.
- Las denuncias de nombres: **90 días**.
- Los registros del límite de altas: siete días; los registros técnicos de los avisos: 30 días.

Una tarea automática diaria aplica estos plazos. Los datos caducados se borran en la siguiente pasada.

## Borrar tu cuenta

Desde el Atlas («Tu cuenta y tus datos») puedes eliminar tu invitado o tu cuenta: se borran tu perfil, tu alias, tu progreso, todas tus filas del ranking, tus listas de bloqueados y archivados, tus registros técnicos y la copia en este dispositivo. La acción pide confirmación y no se puede deshacer. Lo que compartiste con otras personas (tu nombre y tus jugadas en salas y duelos con ellas, o tu alias si alguien te bloqueó) se mantiene hasta que esas partidas caducan, y las denuncias de nombres hasta cumplir sus 90 días según los plazos de arriba. Desinstalar la app o borrar los datos del navegador no borra el invitado del servidor: se borra solo pasado un año sin uso, o antes si nos lo pides. Si no puedes entrar en el juego, [aquí se explica cómo pedir el borrado por correo](borrar-cuenta.html).

## Tus derechos

Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar en cualquier momento tu consentimiento para aparecer en el ranking. Muchos los puedes ejercer tú mismo en el juego (cambiar el alias, dejar el ranking, eliminar la cuenta); para el resto, como pedir una copia de tus datos, escribe a feedbackcontinuum@gmail.com. Responderemos en el plazo de un mes que marca el RGPD. Si crees que no se han atendido bien tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos ([www.aepd.es](https://www.aepd.es)) o ante la autoridad de protección de datos de tu país.

## Menores

Si tienes menos de 14 años, necesitas el permiso de tu madre, padre o tutor para jugar online y para aparecer en el ranking. El juego no pide la edad: usa siempre un apodo y no compartas datos personales.

## Lo que no hacemos

- No mostramos publicidad ni usamos analítica de terceros.
- No pedimos datos de pago: el juego no tiene compras.
- No tomamos decisiones automatizadas que te afecten de forma significativa.
- No vendemos ni cedemos tus datos.

## Cambios en esta política

Si cambia algo importante, se actualizará esta página y su fecha.

## Procedencia del arte

Las ilustraciones de las cartas, portadas, icono, logo, splash y demás recursos visuales de Continuum fueron generados con ChatGPT/OpenAI, según declaración del titular del proyecto. El juego no presenta estas imágenes como dibujadas manualmente ni como recursos descargados de terceros. La procedencia y las huellas de los archivos se documentan en [PROCEDENCIA_ARTE_IA.md](PROCEDENCIA_ARTE_IA.md). La generación con IA no elimina la necesidad de revisar marcas, personajes, textos, datos o elementos de terceros que pudieran aparecer representados. Esta información no sustituye asesoramiento jurídico ni las condiciones aplicables del servicio utilizado.

[Información de privacidad de Firebase](https://firebase.google.com/support/privacy)

[Condiciones de uso](terminos.html) · [Aviso legal](aviso-legal.html) · [Soporte](soporte.html) · [Borrar mi cuenta](borrar-cuenta.html) · [Licencias de terceros](licencias.html)
