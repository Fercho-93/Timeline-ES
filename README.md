# Continuum

## Cómo está organizado el juego

La portada tiene tres puertas y nada más:

- **Reto diario.** Uno para todo el mundo: cada día se sortea un mazo con la fecha como
  semilla y de él salen las mismas 15 cartas en todos los móviles. La portada enseña el
  mazo de hoy, la racha y, una vez jugado, el resultado para compartirlo.
- **Jugar.** Primero se elige *qué*: **Grandes colecciones** (los mazos completos, por
  colección), **Retos rápidos** (temas cortos y concretos, como las redes sociales por
  fecha de aparición) o **Competición** (un tema distinto en cada ronda). Después, *cómo*:
  solo, multijugador (uno o varios móviles) o **retando a un amigo**.
- **Atlas.** Lo que antes eran el perfil y la enciclopedia: la colección de cartas con la
  puerta a todas ellas, la racha del reto diario con su calendario, los duelos, las
  estadísticas y los logros.

Encima de las tres puertas, y solo cuando hay algo pendiente, un aviso de **duelos por
turnos**: si es uno, lleva directo a él; si son varios, a la lista con el estado de cada
uno (tu turno, esperando al rival, retos recibidos, invitaciones enviadas, historial).

La barra inferior sigue el mismo orden: Inicio, Jugar, Atlas, Guía y Ajustes.

## Retos rápidos y ¿Cuántos hay…?

**Retos rápidos** funciona igual que las grandes colecciones, con temas cortos: se juega
solo (partida libre por duración), en multijugador de 2–4 participantes en un móvil, por
internet o por Wi-Fi local, o retando a un amigo en un duelo por turnos. No usa el
marcador de Competición: mantiene su propia partida guardada.

Cada conjunto tiene como máximo diez cartas, incluida una referencia inicial que
no puntúa. En cada turno se elige una carta común y se confirma su hueco en la
línea. Acertar suma un punto provisional y pasa el turno; fallar pierde los puntos
de ese reto y retira al participante hasta el siguiente. Plantarse asegura los
puntos y también retira al participante. Los puntos de retos anteriores nunca se
pierden. Una carta fallada se coloca correctamente como referencia.

Al agotarse las cartas se aseguran los puntos pendientes; también termina el reto
si nadie sigue activo. La última persona activa puede continuar o plantarse. El
primer turno rota entre retos. Gana la mayor puntuación acumulada y los empates
finales se comparten. La rotación reduce la ventaja inicial, pero no garantiza el
mismo número de intentos: depende de los fallos, retiradas y cartas disponibles.

El catálogo inicial contiene redes sociales (6 cartas), películas por Óscar (10),
graduación de bebidas concretas (6) y categorías de manos del póker (9). Cada carta
incluye dato, explicación y fuente, accesible al revelar y al repasar el orden
completo. En póker, la escalera real forma parte de la categoría escalera de color.
La colocación admite empates reales y retos de orden ascendente o descendente.

**¿Cuántos hay…?** queda reservado como gran mazo de cantidades, con el contenido
pendiente de selección. Se anuncia como «En preparación» y no se incorpora como
mazo vacío a partidas, enciclopedia, compras o rotación de Competición.

`quick-challenges-data.js` contiene el catálogo independiente y la reserva del
mazo futuro. `quick-challenges-engine.js` reutiliza la comparación de `engine.js`;
`quick-challenges.js` presenta los turnos y guarda una configuración y un historial
de acciones en el almacenamiento de la cuenta. La recuperación reproduce acciones
válidas en vez de aceptar puntuaciones guardadas. Si cambia el significado de los
datos o las reglas, debe incrementarse `QuickCatalog.version`.

Validación: `node tests/quick-challenges.mjs`. La prueba visual
`node tests/quick-challenges-browser.mjs` necesita Playwright/Chromium y acepta
`PLAYWRIGHT_MODULE` y `CHROME_PATH`, igual que las otras pruebas de navegador.

## Competición por rondas

Desde la portada se abre Modo competición. En la siguiente hoja se elige Jugar solo o Multijugador; este último se despliega para escoger un móvil o varios móviles. Se configuran 3, 5 o todas las temáticas y entre 1 y 6 cartas por ronda. Cada ronda usa un mazo aleatorio diferente; Gran mezcla se excluye porque combina otros mazos.

En solitario se suman los aciertos. En multijugador se reparten las cartas elegidas a cada participante (ajustadas si el mazo es pequeño), gana quien termine una vuelta completa sin cartas y se usa la final numérica secreta si hay varios. Ganar una ronda suma un punto; quedarse con cartas en la mano al terminarla penaliza con su número menos uno (una carta no resta nada, dos cartas restan un punto, tres restan dos, y así sucesivamente). Al terminar, el marcador muestra el ganador o el empate global en puntos.

En un móvil se conserva la competición por separado de las partidas normales. En varios móviles, el anfitrión pasa al siguiente mazo dentro de la misma sala; se conservan participantes e historial y se preparan nuevas manos. Se puede reconectar con el mismo código. El multijugador online necesita las reglas actualizadas para el cliente 42.

## Documentación de beta y lanzamiento

- [Hoja de ruta consolidada](ROADMAP.md): estado actual, prioridades y criterios para avanzar.
- [Checklist de beta y lanzamiento](BETA_CHECKLIST.md): pruebas automáticas, móviles, testers y tiendas.

Juego de ordenar para 2–9 personas, diseñado para jugarse pasando un solo móvil o mediante una sala compartida. Funciona sin conexión después de instalarse como aplicación web, salvo cuando se utiliza el modo de varios móviles.

## Nombre y destino del producto

El nombre del juego es **Continuum**, tanto en la aplicación como en su instalación móvil,
documentación y futuras fichas comerciales. El objetivo es comercializarlo como juego móvil
en App Store; la versión actual es una aplicación web instalable, no una app iOS publicada.

El nombre del repositorio y el nombre visible del proyecto de Firebase se administran fuera
del código. Sigue pendiente unificar el nombre visible del repositorio y del proyecto de Firebase a **Continuum** desde sus respectivas configuraciones.
Al renombrar el repositorio, hay que comprobar de nuevo GitHub Pages y actualizar enlaces de
invitación e instalaciones existentes: el sitio publicado no hereda automáticamente las
redirecciones del repositorio. No se cambia ninguna dirección de servicio hasta que exista
su destino real.

Los identificadores técnicos como `timeline` describen la línea de cartas, no la marca.
Se conservan para mantener compatibles las partidas guardadas y las reglas de las salas.
Las URL y los títulos de fuentes externas tampoco se renombran como si fueran propios.

`tests/marca.mjs` comprueba el nombre de la web, del acceso directo de iOS, del manifiesto y
de las pantallas locales. Este cambio de denominación no modifica la licencia del código.

## Bloques y juegos

Los juegos se agrupan en seis bloques. La portada enseña el bloque y lista sus juegos debajo,
así que añadir uno es declararlo en `modes.js` y sumarlo a `games`.

**Historia**

- **Historia de España:** 167 hechos históricos verificados, desde la Antigüedad hasta la actualidad,
  sin dos cartas a un año de distancia salvo un puñado de hitos que de verdad lo son.
- **Historia mundial:** 117 hechos de los faraones a hoy, mirando más allá de España y
  dejando los hitos técnicos al mazo de al lado. Mismo criterio de fechas que aquel.
- **Inventos y descubrimientos:** 103 hitos de la técnica y la ciencia, de la escritura cuneiforme
  a las imágenes del telescopio James Webb. Cada carta se fecha por un hecho concreto y datable
  —una patente, una publicación, una primera demostración— y ningún año se repite, así que dos
  cartas nunca son una moneda al aire.

**Entretenimiento**

- **Estrenos de cine:** 87 películas conocidas, de *Viaje a la Luna* (1902) a *Del revés 2* (2024),
  con trece títulos del cine español. Cada año aparece una sola vez y el reparto está equilibrado
  por décadas para ofrecer una selección variada de estrenos.
- **Hitos de la música:** 51 estrenos, obras, discos y cambios de formato, de *L'Orfeo* (1607)
  a *The Eras Tour* (2023). El recorrido cruza música clásica, jazz, rock, pop, hip-hop y la
  transición del fonógrafo al streaming.
- **Historia de los videojuegos:** 51 hitos de *OXO* (1952) a *Balatro* (2024), repartidos entre
  laboratorio, recreativas, ordenadores, consolas, juego en línea y móvil. En lanzamientos
  regionales se toma siempre el primero que la propia carta especifica.

**Ciencia**

- **Astronomía y espacio:** 49 descubrimientos y misiones, del modelo heliocéntrico de Copérnico
  (1543) a las primeras muestras traídas de la cara oculta de la Luna (2024).
- **Historia de la medicina:** 48 hitos, del corpus hipocrático a los primeros xenotrasplantes
  modernos. Las explicaciones reconocen los procesos colectivos y distinguen descubrimiento,
  demostración, aprobación y aplicación clínica.

**Naturaleza**

- **Peso de animales:** 41 referencias de masa. Los títulos distinguen sexo, ejemplares grandes,
  medias publicadas y extremos de rangos cuando corresponde; no son promedios universales.
- **Longevidad de animales:** 38 referencias de edad. Se distingue fase adulta, vida en libertad,
  cuidado humano, estadísticos y edades de ejemplares o colonias. Por eso el mazo ya no se
  presenta como «esperanza de vida», que implicaría una medida estadística homogénea.
- **Velocidad de animales:** 38 referencias que identifican movimiento y tipo de medición:
  esprint, nado, picado, crucero o media de una carrera. No es una tabla de récords absolutos.
- **Revisión de datos:** los mazos actuales ya no llevan etiquetas «en revisión». La cobertura de fuentes estructuradas todavía es desigual; esto no equivale a certificar todos los datos.
  Véase el historial de [correcciones y fuentes](VERIFICACION_CORRECCIONES.md).

**Geografía**

- **Superficie de países:** 72 países ordenados de menor a mayor, de la Ciudad del Vaticano a Rusia.
  Aquí la línea no es temporal: se ordena por tamaño.
- **Población de países:** 77 países ordenados de menos a más gente, del Vaticano a la India,
  con la proyección de la ONU a 1 de julio de 2026 (WPP 2024, vía Worldometer).
- **Idiomas por hablantes nativos:** 47 lenguas del chino mandarín (929 millones) al feroés
  (69.000), ordenadas por hablantes de lengua materna. No es la lista de «idiomas más hablados
  del mundo»: quien aprende un idioma de adulto no cuenta aquí, y por eso el inglés aparece por
  detrás del español. Del chino y del árabe solo están las variedades principales. Las cifras
  grandes son de Ethnologue 2022 a través de una recopilación de Wikipedia; las ocho lenguas por
  debajo de los seis millones llegan aparte y con otro corte temporal.
  Véase [la verificación del mazo](VERIFICACION_IDIOMAS.md).
- **Distancias entre ciudades:** 50 pares urbanos de París–Versalles a Madrid–Auckland. Se mide
  la distancia geodésica en línea recta entre centros urbanos, no una ruta por carretera, tren o avión.

**Gran mezcla temporal** no es de ningún bloque temático, a propósito: concatena los ocho mazos
cronológicos —673 cartas en total— y los ordena sobre un único eje. Se presenta aparte en la
portada como modalidad transversal, reutiliza las épocas generales de Historia mundial y no
entra en la rotación del modo Competición, que sí cambia de tema.

Cada juego conserva su propia partida local. El juego elegido también se guarda en las salas multijugador para que todos los participantes utilicen el mismo mazo.

La aplicación ofrece cuatro formas de jugar:

- **Un solo móvil:** de 2 a 9 personas pasándose el teléfono. No necesita conexión y conserva las partidas localmente.
- **Varios móviles:** crea una sala compartida con Firebase, invita por enlace o código QR y permite que cada persona juegue su mano mientras todos ven la cronología en directo.
- **En solitario:** una persona contra el mazo, con tres vidas.
- **Competición:** un tema al azar tras otro, sin repetirse, hasta pasar por los quince juegos.

Al terminar una partida —local, en solitario o de competición— si hubo alguna carta mal
colocada aparece un botón para repasarlas: dónde iban de verdad, con su época y su
explicación completa, en vez de perderse en el descarte sin más. Y en el momento mismo del
fallo, mientras se ve el aviso, la línea de detrás señala el hueco exacto donde iba —con una
frase para quien usa un lector de pantalla— en vez de dejar que se pierda en el descarte sin
que nadie aprenda de él.

## Enciclopedia

Al elegir un mazo, debajo de los formatos de juego, «Enciclopedia» lo abre fuera de partida:
todas sus cartas, ya con el
valor revelado, ordenadas por el eje del juego y con su explicación completa. Se puede
buscar por título, explicación o fuente —sin distinguir tildes ni mayúsculas— y filtrar por
época o magnitud. Las cartas de Peso, Longevidad, Velocidad y Superficie que llevan una
fuente documentada enlazan directamente a ella. Cada carta fallada en el repaso de fin de
partida también lleva a su ficha en la enciclopedia, ya con esa carta destacada. No aparece
en ninguna pantalla de partida: vería el mazo entero y volvería trivial cualquier jugada
pendiente.

Lo único que hay que ganarse son las láminas: hasta que una carta pasa por tu mano, en el
sitio de su ilustración hay un sello cerrado —papel tramado y un candado, sin rótulo, que
en una tarjeta estrecha se partía en dos líneas y parecía un aviso de error; lo que el
candado dice sin decirlo va en el texto que solo leen los lectores de pantalla—. La
ilustración no se difumina: no se pinta siquiera, así que un mazo entero por descubrir no
baja ni compone cuarenta imágenes, que es lo que dejaba la enciclopedia pesada al abrirla.

El filtro **Todas · Desbloqueadas · Bloqueadas** está tanto en el catálogo completo —la
enciclopedia del menú principal— como en cada mazo con ilustraciones. Empieza siempre en
«todas» y vuelve ahí al cambiar de mazo: llegar a uno nuevo con media colección escondida
y sin saber por qué es la manera más rápida de perderse. Se combina con la búsqueda y con
el filtro de épocas, y no aparece en los mazos sin ilustraciones, donde no habría nada que
bloquear.

En el catálogo, un filtro o una búsqueda abren los mazos para enseñar lo que han
encontrado, pero solo mientras quepa: por encima de 120 cartas se enseñan los mazos con su
recuento y se despliega el que se quiera. «Bloqueadas» sobre el catálogo entero son casi
mil cartas, y pintarlas de una vez cuesta más de un segundo en un móvil modesto; con los
mazos plegados, cincuenta milisegundos y la misma respuesta: cuántas faltan y dónde.
Descubre tanto acertarla como fallarla: en los dos casos la pantalla de resultado te la ha
enseñado entera, y esconder justo las que se fallan sería esconder las que más interesa
repasar. El texto no se vela nunca —valor, época, explicación y fuente se leen desde el
primer día—, así que la enciclopedia sigue sirviendo para consultar; lo que se colecciona
es el dibujo. Cada mazo lleva su recuento («12 de 41 láminas descubiertas») y las cartas
descubiertas viajan en el perfil, así que se conservan al exportarlo e importarlo. Los
identificadores no se repiten entre mazos: descubrir una carta en «Gran mezcla» la
descubre también en su mazo de origen.

## La cartera

`cartera.js` es el único sitio del juego que responde a **«¿tiene derecho este jugador a
este mazo?»**. Hoy la respuesta es siempre que sí: no hay nada a la venta y la concesión de
arranque —`CT.Cartera.concede({ origen: "beta" })`— abre el catálogo entero.

El trabajo que hace no es cerrar mazos, es que **todo el juego pregunte**: la portada, la
lista de mazos de cada colección, `setMode` —por donde pasa cualquier camino que lleve a
jugar—, la rotación de temas de competición, la enciclopedia y los duelos que llegan por
enlace. El día que haya tienda se cambia un sitio y el resto se entera solo.

Dos reglas que conviene no romper:

1. **Lo guardado en el móvil nunca manda sobre lo comprado.** Sirve para jugar sin
   conexión y nada más. Quien lleva el registro de lo comprado es la tienda —Apple y
   Google lo atan a la cuenta del cliente, no a la instalación— y se le pregunta al abrir.
   Invertir esto significa que el día que alguien borre los datos del navegador le habremos
   quitado un mazo a un cliente que pagó.
2. **La cartera decide qué se puede jugar, nunca qué se ha jugado.** El progreso, los
   logros y las cartas descubiertas son del jugador y no se tocan aunque un mazo deje de
   estar a su alcance; si vuelve, vuelve con todo lo que había.

Un mazo cerrado **se sigue viendo**, con su candado y con el nombre de lo que haría falta
para abrirlo: esconderlo significaría que nadie sabe que existe. Lo que no enseña son sus
cartas, ni en la enciclopedia ni en la partida, porque las cartas son justo lo que se
vendería.

`CT.Cartera.paquetes()` declara lo que se vendería —un paquete por colección más uno que lo
incluye todo—, y `LIBRES` es la lista, hoy vacía, de lo que sería gratis siempre. El reto
diario solo sortea entre esos gratuitos (`CT.Cartera.diarios()`), nunca entre lo que ha
comprado cada cuenta, para que todo el mundo juegue el mismo; mientras `LIBRES` esté vacía,
la beta los cuenta todos. `SIMULACION` está vacía durante la beta: todo el catálogo abierto. Ninguna de
las dos compromete precio ni decisión: son el esqueleto sobre el que colgar las fichas de
las tiendas cuando se decida.

`node tests/cartera.mjs` cierra un mazo a mano y recorre el juego entero comprobando que
todos los rincones lo respetan. Sin esa mitad, la cartera sería una función que nadie llama.

## Duelo por enlace

«Retar a un amigo», la tercera manera de jugar un mazo junto a «Jugar solo» y «Multijugador». Juegas unas cartas al azar del mazo abierto y
mandas un enlace: quien lo abra recibe exactamente esas mismas cartas, en el mismo orden, y
al terminar ve el cara a cara —el marcador y las dos tiradas carta a carta— con un botón
para devolver el reto con semilla nueva.

Tiene **dos modalidades**, que se eligen dentro del mismo formato porque comparten casi
todo —las mismas cartas en los dos móviles, el enlace, el nombre, el reloj y lo que pasa al
salirse de la aplicación— y solo se diferencian en qué se hace con cada carta:

- **Ordenar las cartas.** 15 cartas que se colocan en la línea. Gana quien más acierte.
- **Escribir la cifra.** 10 cartas de las que se responde el número —los habitantes, los
  años, los kilómetros—. Gana quien más puntos sume: puntúa lo cerca que se quede uno (por
  porcentaje, o por años de diferencia en los mazos de fechas) y lo rápido que responda.
  Los puntos que trae un enlace no se creen: se recalculan con las mismas cartas y tienen
  que coincidir.

Las dos se eligen con un control de dos pastillas, no con un desplegable: así se ve que hay
dos maneras y cuál está elegida, en vez de enseñar una y esconder la otra.

### Las unidades

Cada mazo ordena sus cartas por un número en una sola unidad —kilos, años, km/h—, pero las
cartas se enseñan en la que toque: la hormiga en miligramos y la ballena en toneladas. Pedir
las dos «en kilos» obligaría a escribir `0,0000001` para una de ellas, así que **la respuesta
admite su unidad** y se convierte a la del mazo: «40 g», «2,5 t», «3 días», «30 m/s»,
«47 millones». Sin unidad se entiende la del mazo, y una que no se reconoce descarta la
respuesta entera en vez de colarse como si fuera la básica.

Las unidades las declara cada eje en `modes.js`, y el campo de respuesta las lista debajo:
sin eso no hay manera de saber en qué se responde. Lo que no se hace es elegir la unidad por
carta —«¿cuánto pesa, en gramos?»—, porque eso regalaría el orden de magnitud, que es justo
lo que había que adivinar.

### Antes de empezar

Un duelo va a reloj desde la primera carta, así que entrar directamente castigaba a quien
todavía estaba leyendo de qué iba. Entre elegir la modalidad y jugar hay una pantalla que
explica cómo funciona, con una demostración animada del mazo que se va a jugar —su pregunta,
su eje, sus unidades, pero ninguna carta de verdad: eso sería destripar una de las diez— y un
botón para empezar. Al pulsarlo, tres segundos de cuenta atrás. La partida no se crea hasta
que termina, así que el reloj de la primera carta empieza cuando de verdad se ve la carta.

### El reloj

Las dos modalidades van a reloj por la misma razón: sin un plazo por carta, cualquiera
puede ir a buscar la respuesta a otra parte, y quien la busca gana. El plazo es **el mismo
en las dos** —lo dice una sola constante, `SEGUNDOS` en `duelo.js`— y no se puede parar.

Eso obliga a medirlo **restando marcas de `Date.now()`, nunca descontando de un contador**.
No es una preferencia de estilo: una pestaña escondida congela sus temporizadores, así que
un contador ingenuo se pararía justo mientras alguien consulta la respuesta, premiando
exactamente lo que se quiere evitar. Por la misma razón se guarda con la partida el instante
en que empezó la carta: recargar la página o cerrar la aplicación no devuelven el plazo.

Salir de la aplicación con una carta delante la cierra —en cifras deja la carta sin puntuar;
en orden la da por fallada—, con un margen de gracia de segundo y medio para que un aviso
que se cuela, una llamada entrante o un roce en el gesto de multitarea no cuesten una carta.
No se llama tramposo a nadie: se dice lo que ha pasado, y en el duelo de cifras las cartas
cerradas así salen aparte en el marcador que os mandáis. Lo que nada de esto tapa es un
segundo dispositivo, que no hay manera de detectar desde aquí.

Sin servidor, sin cuentas y sin que los dos móviles tengan que estar encendidos a la vez.
Se apoya en lo mismo que el reto diario: dos móviles que barajan con la misma semilla
reciben las mismas cartas. Allí la semilla es la fecha; aquí viaja dentro del enlace, junto
con el mazo, el número de cartas, la marca de quien reta y su cuadrícula de aciertos, todo
en base64url. La versión que abre la carga útil no numera el formato: **numera las reglas
con las que se jugó**, y la tabla `REGLAS` de `duelo.js` dice cuáles son. Dos partidas con
plazos distintos no se pueden comparar, así que un enlace viejo no se rechaza ni se
reinterpreta: se lee con su propio plazo y se juega como se jugó, avisando de ello en la
pantalla de invitación. En el duelo de cifras eso además es obligatorio para que cuadren los
puntos, porque la parte de la prisa se mide contra el plazo. Una aplicación que no conozca
una versión pide actualizar en vez de comparar dos partidas con reglas distintas.

Cambiar el plazo, por tanto, es añadir una fila a `REGLAS` y estrenar versión, no editar un
número: los enlaces que ya estén circulando siguen siendo válidos y siguen significando lo
que significaban. Por eso un duelo funciona con la aplicación instalada y sin conexión.

El duelo no gasta vidas: las dos partes juegan todas las cartas de principio a fin. Si a una
se le acabaran a la séptima, el marcador estaría comparando siete cartas contra quince.

El enlace lleva una **huella del mazo** —su número de cartas y un hash de sus
identificadores en orden—. No es opcional: si los dos móviles llevan versiones distintas de
la aplicación, el mazo puede haber cambiado y la misma semilla repartiría cartas distintas.
El duelo parecería ir bien y estaría comparando dos partidas que no son la misma, sin que
nadie se enterara. Si la huella no cuadra se avisa y no se reparte. Un enlace cortado,
manipulado o de una versión más nueva se rechaza con una explicación, nunca con un error.

Es un duelo entre amigos, no una competición arbitrada: el enlace es legible y la marca de
quien reta la afirma su propio móvil. Se dice así en la Guía, con la misma franqueza con que
`firestore.rules` reconoce que el servidor no puede validar una colocación.

## Atlas: perfil, estadísticas y logros

«Atlas», en la barra de la portada, reúne la colección —con la entrada a la enciclopedia—,
el reto diario y los duelos, y lo que hasta ahora no se veía: partidas jugadas,
cartas colocadas, porcentaje de aciertos, mejor tirada seguida y racha de retos diarios. Por
debajo, una fila por mazo jugado y dos listas de puntos débiles —los tramos donde más se
falla y las cartas que más se atragantan—, cada una enlazando a la enciclopedia del mazo
correspondiente, ya filtrada o con la carta destacada.

Los diecisiete logros van en cuatro grupos (Constancia, Puntería, Recorrido y Oficio). Los que
piden repetición enseñan cuánto llevas; los demás, solo si están o no. Se comprueban al
resolver una carta o al terminar una partida, nunca al repintar, así que ninguno se
desbloquea dos veces. Los que caen a mitad de partida se avisan y ya está; los de una
pantalla de fin se enseñan ahí, con su nombre y su condición.

El perfil se guarda en `hilo-perfil-v1`, aparte del reto diario y los récords de
`hilo-retos-v1`. El reto diario guarda su racha dentro de `hilo-retos-v1`, en el campo
`retoDiario` (no es ningún mazo), porque esa es la clave que la cuenta sincroniza. Las
rachas del antiguo reto diario por mazo se borraron al llegar el reto para todos; las
mejores marcas de la partida libre se conservan. Como todo vive en un solo móvil, la pantalla permite copiar el
perfil en JSON y recuperarlo en otro, y borrarlo entero previa confirmación.

Dos cosas se cuentan con cuidado. En una partida a un solo móvil gana alguien de la mesa,
pero el juego no sabe quién sostiene el teléfono: esa partida se cuenta como jugada, no como
ganada. Solo una sala y un duelo apuntan una victoria como tuya, porque son los dos formatos
con una marca ajena identificable enfrente. Y en una sala cada móvil registra solo sus propias cartas, descartando las
instantáneas de Firestore que ya vio —se recuerdan las últimas cuarenta por `CÓDIGO:versión`—
para que una reconexión o una instantánea que llega desordenada no sume dos veces.

## Ajustes

Un botón de «Ajustes» en la cabecera, disponible en cualquier pantalla, elige cómo se ve
la aplicación. La elección se guarda y se aplica al instante, sin recargar, y con ella van
también las dos etiquetas de color de la barra del navegador.

| Aspecto | Para qué |
| --- | --- |
| **Claro** | El papel de la edición: crema frío, tinta carbón y latón. |
| **Oscuro** | Cuero entintado, marfil cálido y latón, con capas diferenciadas para la navegación, los modales y el tablero. |

Los dos temas viven en variables CSS: las de la interfaz en `edition.css` (`--edition-*`)
y las de la mesa en `styles.css`. Un tema que
cambie el fondo tiene que traer **todas** las superficies, no solo el papel: si una se
queda con su valor claro, el texto de encima —que sí cambia— deja de leerse. Eso lo
vigila `tests/accesibilidad.mjs`, que además comprueba que los seis colores de cada
tema llegan a 4,5:1 en los pares que llevan texto.

Al actualizar desde una versión anterior, Pergamino y Alto contraste pasan a Claro;
Noche profunda pasa a Oscuro; y Automático conserva el aspecto que indique el sistema
en ese primer arranque. La migración guarda el resultado sin tocar el tamaño de texto ni
los efectos opcionales.

El mismo panel lleva un botón de comentarios que abre un correo con la versión instalada
y la pantalla en la que se estaba, para no tener que describirlo de memoria. Si algo se
rompe de verdad, en vez de una pantalla en blanco aparece un aviso con ese mismo informe
y un botón para copiarlo.

## Jugar en solitario

Tres formatos, los tres sin conexión y con la marca guardada en el propio móvil:

- **Reto diario:** se entra desde la portada, no desde un mazo. Cada día sale un mazo —sorteado
  con la fecha entre los gratuitos, sin repetir el del día anterior— y de él las mismas 15 cartas
  para todo el mundo, con un solo intento. Tiene su propio guardado, así que empezarlo no pisa una
  partida libre a medias del mismo mazo. Las cartas se
  barajan con la fecha como semilla, así que no hace falta ningún servidor para que dos móviles
  reciban exactamente el mismo reto. Completar el reto un día detrás de otro encadena una racha,
  que además se ve como un calendario de las últimas cuatro semanas, no solo como un número. Al
  terminar se puede compartir el resultado —puntuación y una cuadrícula de aciertos al estilo
  Wordle, sin desvelar ninguna carta— por donde el móvil ofrezca o copiado al portapapeles. La
  partida guarda además un identificador anónimo y estable por dispositivo y la secuencia exacta
  de aciertos de cada día: nada de eso sale del móvil todavía, pero es lo que un marcador entre
  amigos necesitaría el día que exista, sin tener que rehacer partidas ya jugadas para tenerlo.
- **Partida libre:** el mazo entero y sin límite de cartas, hasta perder las tres vidas. Guarda tu
  mejor marca de cada juego y se puede dejar a medias y continuar después.
- **Competición:** una ronda de 5 cartas por cada uno de los quince juegos, en un orden al azar
  distinto cada vez y sin repetir ninguno, con tres vidas nuevas en cada ronda. Al terminar la
  última se ve el marcador de todas las rondas juntas. No se puede dejar a medias y continuar
  después: cada ronda cambia de juego, y por tanto de dónde se guardaría la partida.

## Fantasma, Pulso y dificultades

El poder Fantasma puede acompañar al reparto o a un robo. Tanto en partidas de un solo
móvil como en salas se activa o desactiva con «Cartas Fantasma» al configurar la partida,
igual que «Cartas Pulso»; ambos interruptores parten marcados o desmarcados según su valor
por defecto y se pueden cambiar antes de barajar. Fantasma está separado de las cartas a
ordenar: conservarlo no impide ganar, no sustituye un robo de penalización, no se pasa
con el Pulso y no se recicla con el descarte. El poder solo se muestra a su propietario,
sin aumentar el contador público de cartas. Máximo un uso por persona. Si encuentra otro,
se recoloca al azar entre las cartas pendientes sin Fantasma; si no quedan posiciones
libres, se consume sin conceder otro uso. Las partidas antiguas conservan su reparto y
su comportamiento anterior, sin añadir poderes ni volver a sortearlos.

Con al menos cinco cartas en la línea y alguna en la mano, se puede activar al comienzo
del propio turno; no reemplaza la colocación. Afecta a quien lo activa y a cada rival una
vez. Después hay una vuelta completa con valores visibles antes de otro Fantasma. No se
pueden acumular ni combinar su activación con el Pulso en ese mismo turno. Un rival sí
puede usar Pulso durante el efecto. Saltar un turno o abandonar la sala descuenta al
participante afectado sin alargar la duración. Los empates y la victoria siguen comprobándose
al final de la ronda, sin contar poderes.

Se ocultan cifras, explicaciones y bandas de época/magnitud del tablero. El minimapa usa
posiciones uniformes y números de orden, también en sus etiquetas accesibles. Los títulos
—incluidas las condiciones de medición y avisos «en revisión»— siguen visibles. El resultado
revela la carta recién resuelta a todos, sin destapar las anteriores. Es una regla de interfaz,
no protección contra un cliente modificado: los datos de los mazos ya están en el navegador.

### Aparición matemática

Sean P los jugadores, H la mano inicial efectiva y N las cartas disponibles, excluida
la que inicia el tablero:

- Siempre se incluyen min(3, ceil(P/3)) poderes: 1 con 2–3 personas, 2 con 4–6 y 3 con 7–9.
  Solo se limita esa cantidad si no quedan suficientes posiciones elegibles.
- Cada poder se sortea al 50% entre las primeras W=min(N, 12×P) cartas elegibles y al
  50% entre todo el mazo. La primera zona incluye las cartas del reparto inicial.
- Para una posición i, el peso es 0.5/N + (i<W ? 0.5/W : 0). Se muestrea sin reemplazo,
  equivalente a repetir el sorteo completo si la posición ya está ocupada. Si W=N,
  todas las posiciones tienen el mismo peso. Nunca se marca la carta inicial del tablero.
- La primera y la última carta siguen siendo posibles. Se favorece la zona inicial de
  los mazos grandes sin garantizar que el poder llegue a salir durante la partida.
- La aparición se asocia al identificador de la carta normal de esa posición y entrega
  el poder aparte al recibirla. Una aparición que nadie llegue a robar no se entrega.
  Los duplicados de una misma persona se recolocan uniformemente entre las posiciones
  pendientes libres, sin cambiar las cartas normales. Robar para el Pulso también puede
  entregar un poder, que solo se podrá usar en un turno posterior.
- El sorteo inicial y cada recolocación se guardan/sincronizan. Recargar no vuelve a sortear.
- Si no caben P×H cartas más la inicial, H se reduce por igual para todos a floor(N/P).

Con 5 jugadores, 2 poderes y 20 cartas extraídas, la probabilidad de encontrar al menos
uno es aproximadamente 64% para N=50, 39% para N=200 y 34% para N=500, frente al 64%,
19% y 8% de un reparto uniforme. Son probabilidades, no cuotas de aparición por partida.

La simulación determinista de `tests/fantasma.mjs` recorre 90.000 repartos: todos los
números de jugadores de 2 a 9 con 38, 167 y 673 cartas, más los tres ejemplos anteriores.
Se comprueba cantidad fija, variación de posiciones, posibilidad de aparición tardía,
ausencia de posiciones duplicadas, recolocación y conservación de las cartas normales.

### Solitario

| Nivel | Cartas automáticas tras cada turno | Visibilidad |
|---|---:|---|
| Fácil | 0 | Visible |
| Normal | 1 | Visible |
| Difícil | 2 | Fantasma ocasional durante una jugada |
| Experto | 2 | Oculto en todas las jugadas |

Las incorporaciones se hacen al continuar, tras acierto o fallo, antes de la nueva decisión.
Primero se reserva la siguiente carta del jugador; si faltan cartas se añaden menos. No
suman aciertos ni cambian vidas. Y se ven llegar: la carta entra desde el centro de la
pantalla hasta su sitio, y la vista va con ella —una detrás de otra si son dos, porque la
segunda suele caer en otro punto de la línea y sin mover la vista se colocaría fuera de la
pantalla—. Son cartas que nadie ha jugado y que cambian el tablero, así que se ve de dónde
salen y dónde caen en vez de aparecer ya puestas. El aviso de texto sigue estando, para
quien no mire en ese momento, y con «reducir movimiento» la carta aparece sin recorrido. En Difícil se sortea, con probabilidad del 70%, un turno
Fantasma en cada bloque de cuatro turnos a partir del cuarto; nunca son consecutivos.
El calendario se guarda al iniciar, no al repintar. En Experto el resultado sigue revelando
el valor y la explicación de la carta jugada para aprender de ella.

La partida libre permite los cuatro niveles, conserva partidas y separa récords por mazo
y dificultad. Los récords antiguos se mantienen en Fácil. La competición individual también
elige un nivel, conserva cinco decisiones humanas por tema y reserva cartas adicionales
para el tablero. El reto diario permanece en Fácil para no cambiar las quince cartas ni las
marcas existentes. En las partidas compartidas, Pulso conserva su efecto pero se obtiene
como poder secreto al encontrar la carta normal a la que quedó asociado.

**Publicar `firestore.rules` antes de activar Fantasma o Pulso.** Sin esas reglas, desmarcar
ambos poderes permite seguir jugando en salas compartidas con normalidad.

## Probarlo en un ordenador

La carpeta debe abrirse mediante un servidor web local (no haciendo doble clic en `index.html`). Por ejemplo, con la extensión gratuita **Live Server** de Visual Studio Code, usa **Open with Live Server** sobre `index.html`.

## Instalarlo en el móvil sin coste

1. Publica esta carpeta en cualquier alojamiento estático HTTPS gratuito (por ejemplo, GitHub Pages o Cloudflare Pages).
2. Abre la dirección una sola vez desde el móvil.
3. En Android/Chrome, elige **Añadir a pantalla de inicio**. En iPhone/Safari, pulsa **Compartir → Añadir a pantalla de inicio**.
4. Desde ese momento se abre como una app y la partida funciona sin conexión.

Pensado para el dedo. Sobre la línea temporal hay un mapa —una tira con una parada por
carta colocada, con su época y su año— porque en una pantalla de 390 px no caben ni dos
cartas de la línea: el mapa no coloca nada, solo lleva la vista hasta donde le digas. Las
paradas se sitúan a escala real dentro del rango de lo ya colocado, no repartidas a
partes iguales, así que de un vistazo se ve la forma de verdad de la línea —sus racimos y
sus huecos— y no solo un índice; cuando dos paradas caen demasiado cerca para pulsarlas
por separado, se separan lo justo para seguir siendo un botón de dedo.
Ningún control baja de los 44 px que necesita una yema, y las
carátulas se sirven en dos tamaños —una para el lomo y otra para la portada desplegada—,
así que la primera visita baja unos 150 KB de imagen en vez de los 698 KB de antes.

Colocar una carta se puede hacer de dos maneras, y las dos acaban en la misma
confirmación: tocar la carta y después el hueco «+», o **mantener pulsada la carta y
arrastrarla** hasta el hueco. Con el dedo, el arrastre pide esa espera corta a propósito:
mientras la carta no se ha levantado, el gesto es del navegador y deslizar sigue
desplazando la página como siempre; solo cuando se levanta —la carta se encoge y el móvil
da un toque— se le quita el gesto al navegador, y para entonces no había ningún
desplazamiento en marcha que interrumpir. Con ratón se arrastra desde el primer
movimiento, sin espera.

Junto a **Volver** hay un atajo al inicio, con la rosa de los vientos del emblema: «Volver»
retrocede un paso y la rosa salta al inicio de una vez (y gira al pulsarla). Va dibujada en
línea, no como imagen: se recorta al tamaño de un botón sin emborronarse, toma la tinta de
cada aspecto y no pide ninguna descarga. No aparece durante una partida, que se abandona
por su propio menú para que haya una pregunta de por medio.

Deslizar de izquierda a derecha vuelve a la pantalla de detrás, exactamente igual que el
botón **Volver** de esa pantalla: cierra el diálogo que haya encima (la guía, los ajustes,
la enciclopedia) o retrocede un paso en la navegación. Funciona en la web y en las dos
tiendas, no solo en Android. El gesto pide un recorrido claramente horizontal y hacia la
derecha (`swipe.js`), y no navega en tres sitios a propósito: dentro de una partida —una
partida se abandona por su menú, que pregunta antes, y no por un gesto que se puede hacer
sin querer al mirar la mesa—, encima de una tira que se desplaza a los lados, como la línea
temporal o el marcador, y sobre un campo de texto o un desplegable. Desde el inicio no hace
nada: cerrar la aplicación sigue siendo cosa del botón Atrás de Android.

## Preparación para App Store / Google Play (beta móvil)

Continuum se sigue sirviendo como PWA (la sección anterior), y en paralelo se está
preparando una capa móvil con [Capacitor](https://capacitorjs.com/) alrededor del mismo
núcleo, sin reescribir el juego ni duplicarlo por plataforma:

- `npm run build` genera `dist/`, una copia literal de los archivos que el juego necesita
  para funcionar (el juego se sirve como scripts clásicos, no como módulos, así que el
  build no empaqueta ni transforma nada: solo copia y comprueba que no falte nada de lo
  que pide `service-worker-258.js`).
- `capacitor.config.json` apunta `webDir` a `dist/`. El `appId` (`com.continuum.game`) ya
  está aprobado y es el que hay que mantener estable de aquí en adelante: las tiendas lo
  usan para reconocer la aplicación de forma permanente, así que cambiarlo después de
  publicar equivaldría a crear una aplicación nueva desde cero.
- `android/` e `ios/` son los proyectos nativos generados por `npx cap add`. Se mantienen en
  el repositorio (con el propio `.gitignore` de Capacitor, que excluye la copia de `dist/`
  que se sincroniza dentro) porque ahí es donde vivirán ajustes específicos de cada
  plataforma: iconos, splash, firma, permisos.
- Los iconos y la pantalla de apertura nativos ya están generados en todos los tamaños que
  piden Android e iOS, a partir de `icon.svg` (el mismo icono de la PWA) y del emblema de la
  portada, con `npm run icons` (usa `sharp`; las fuentes en alta resolución
  viven en `resources/`). Vuelve a ejecutarlo si cambia el logo definitivo.
- El botón/gesto Atrás de Android cierra el diálogo abierto, pregunta antes de abandonar
  una partida en curso, o vuelve al inicio; ambos comportamientos están en `a11y.js`
  (`backPressed`) y `app.js`, y solo se activan dentro del contenedor nativo de Capacitor
  (`window.Capacitor`), así que no tocan la versión web ni iOS. El deslizamiento de
  izquierda a derecha comparte con él ese mismo «atrás» y sí funciona en las tres versiones;
  la diferencia es que no interrumpe una partida ni cierra la aplicación.
- `npm run build && npx cap sync` deja `android/` e `ios/` al día con el último `dist/`
  antes de abrirlos en Android Studio o Xcode.
- El número de versión de la beta (`0.1.1`, distinto del número interno de caché del
  service worker) vive en `android/app/build.gradle` (`versionName`) y en
  `ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`).
- Ya probada en iPhone real (compilada sin firma vía GitHub Actions e instalada con
  Sideloadly, sin necesitar un Mac). `.github/workflows/ios-beta-sin-firmar.yml` reproduce
  ese build bajo demanda. Pendiente de un dispositivo Android para repetir la prueba ahí.
- `PRIVACIDAD.md` es un primer borrador de la política de privacidad y `TESTERS.md` la
  guía para elegir testers y qué preguntarles; ambos listos para cuando toque repartir la
  beta, sin que haga falta tocarlos hasta entonces.
- Sigue pendiente (decisiones o pasos que necesitan intervención humana): revisión
  profesional de `PRIVACIDAD.md` antes de publicar, y la cuenta de pago de Apple
  Developer (con TestFlight) cuando llegue el momento de repartir la beta más allá de
  este repositorio.

El modo local no utiliza backend ni cuentas y guarda la partida únicamente en el dispositivo. Ningún modo incluye anuncios, compras ni servicios de pago.

El modo multijugador utiliza el proyecto gratuito de Firebase configurado para esta aplicación. Consulta `CONFIGURAR_MULTIJUGADOR.md` antes de publicarlo: las reglas de seguridad solo hay que volver a publicarlas cuando cambia su contenido, no al añadir un juego nuevo.

> **Para Fantasma y Pulso hay que publicar `firestore.rules`.** Valida tanto la obtención
> privada como el uso de Pulso; sin publicarlas, las salas nuevas rechazan el reparto con
> cualquiera de los dos poderes activado.

## Comprobaciones

`tests/` contiene treinta y dos suites automáticas: veinticinco que corren en cualquier
ordenador con `npm test` —la sintaxis de todos los archivos, partidas completas sobre un DOM
simulado, cuarenta partidas al azar que vigilan bloqueos y el conteo de cartas, la calidad de
todos los mazos, el modo solitario, el Pulso, el Fantasma, el movimiento, las referencias de
los animales, la marca, el service worker, la página que fuerza una actualización, la
pantalla de fallo, la enciclopedia, el perfil, el duelo por enlace, la accesibilidad con
teclado y lector de pantalla, y el build móvil (`npm run build`, `dist/` completo y
sincronizado con `capacitor.config.json`)— y siete más que necesitan el emulador oficial de Firestore y
se lanzan aparte con `npm run test:reglas`. Se instalan con `npm install` y se ejecutan solas
en cada propuesta de cambio. Las instrucciones están en `tests/README.md`.

## Reglas implementadas

El botón **Guía** está disponible en la portada, la configuración, una partida local, el
solitario y las salas compartidas. Explica primero el eje del mazo abierto y después solo
las funciones de la modalidad activa: Pulso, reto diario, partida libre, competición o
gestión de sala.

- La persona más joven comienza y el turno avanza en el orden de los jugadores.
- Cada persona recibe cuatro cartas por defecto; se puede elegir entre una y seis.
- El dato que ordena el mazo —fecha, superficie, población, peso, longevidad, velocidad o
  distancia— permanece oculto hasta colocar la carta en un hueco de la línea.
- La ilustración también. En la mano, todas las cartas enseñan el reverso de su colección
  —el cuero con su filete de oro y el emblema del bloque, el mismo para todas—, y la
  lámina aparece cuando la carta ya está colocada y su valor está a la vista. Una lámina
  cuenta demasiado antes de tiempo: por los ropajes, por las naves del fondo o por el color
  de un grabado se sitúa una carta en su siglo sin saber nada del hecho que cuenta, y eso
  valía por igual en los treinta y pico mazos. De paso, una mano de cuatro cartas deja de
  bajar cuatro imágenes y la dirección de la lámina —que lleva el nombre del hecho— ya no
  viaja al documento.
- Hay dos formas de colocar: tocar la carta y luego el hueco, o arrastrar la carta hasta cualquiera
  de los huecos. Con el dedo, el arrastre empieza tras una pulsación breve, para que deslizar sobre
  una carta siga desplazando la pantalla.
- Al elegir un hueco hay que confirmarlo antes de revelar, se haya llegado tocando o arrastrando:
  en un móvil el dedo falla y la jugada no debería depender de eso.
- Las cifras grandes se expresan en millones con tres cifras significativas («83,6 millones»). El
  formato se comprueba para no confundir valores distintos. En animales se permiten empates
  reales y referencias próximas: no se alteran las cifras para imponer una distancia del 8%.
- Cuando dos cartas tienen exactamente el mismo valor, cualquiera de los dos órdenes es válido.
  Las cartas «en revisión» indican antes de jugar que su referencia sigue pendiente de contraste;
  mientras permanezcan en el mazo se resuelven con el valor mostrado.
- Un acierto permanece en la línea. Un fallo se descarta y obliga a robar una carta.
- La victoria se comprueba al final de cada ronda completa.
- Gana quien sea la única persona sin cartas al acabar la ronda. Si hay varias, pasan a una final numérica con una carta neutral y cifras secretas.
- Se revelan las cifras cuando todos los finalistas responden. Gana la menor diferencia absoluta; si empatan, solo quienes comparten la mejor respuesta repiten con otra carta. La final no usa poderes ni reparte cartas a las manos.
- Si al fallar no queda nada que robar, la carta vuelve a la mano en lugar de descartarse.

## El Pulso

Se incluye con el interruptor «Cartas Pulso» al montar la partida. El mazo esconde siempre
1 con 2–3 jugadores, 2 con 4–6 y 3 con 7–9, usando exactamente la misma posición 50/50
que Fantasma. Fantasma y Pulso nunca comparten una carta normal. Puede salir al repartir,
al robar o quedarse sin descubrir al final. Cuando aparece se guarda en privado, fuera de
la mano y de su contador; no elimina un robo de penalización ni impide ganar. Si la misma
persona encuentra otra Carta Pulso, se recoloca entre las posiciones pendientes libres.

Su efecto sigue siendo la única jugada que toca la mano de otra persona:

- **Una vez por cada persona que encuentre el poder**, y sustituye al turno en vez de sumarse a él.
- Retas a quien elijas. **El mazo saca una carta que tú no eliges** y la colocas sin prisa:
  no hay cronómetro, la dificultad la pone lo llena que esté la línea. Al principio los
  huecos son anchos y aciertas casi seguro, pero es cuando menos daño haces; al final son
  estrechos y es cuando el Pulso decide la partida.
- Después coloca quien defiende, sin ver la posición elegida por quien reta.
- **Aciertan los dos:** la carta queda en la línea y ninguna mano cambia.
- **Solo acierta quien reta:** la carta queda en la línea y pasa al defensor la carta de su mano sorteada al lanzar el Pulso.
- **Solo acierta quien defiende:** la carta queda en la línea y quien reta roba una.
- **Fallan los dos:** la carta se descarta y quien reta roba una.
- **Mazo y descarte agotados:** si corresponde robar pero no queda ninguna carta, no hay robo y el turno continúa. Si ambos fallaron, la carta del reto sí puede reciclarse.
- Hacen falta **dos cartas** para lanzarlo. Con una sola, ganar el Pulso te dejaría a cero
  regalándola, sin haberla colocado nunca en la línea.
- Quien recibe una carta **no puede volver a ser retado esa ronda**.
- Sí se puede retar a quien ya está **a cero cartas** esperando ganar al final de la ronda:
  acertar mientras esa persona falla le quita la victoria, y es la jugada más tensa del mecanismo.

Funciona en los dos modos. En un solo móvil, quien recibe la carta se entera al recoger el
teléfono, en la pantalla de pasar el turno. En varios móviles todo el mundo ve el Pulso en
directo, pero el título de la carta que cambia de mano solo lo ven las dos personas
implicadas: el resto se entera de que hubo trasvase, no de cuál era la carta.

En el modo de varios móviles, el anfitrión puede saltar el turno de quien se haya quedado sin
batería o expulsar a quien ya no juegue, y cualquier participante puede marcharse: sus cartas
vuelven al descarte y la partida continúa.

## Guardado y actualizaciones (v74)

Competición se guarda en una clave propia: conserva dificultad, orden de temas, marcador,
ronda y resultado pendiente. «Salir» la deja en pausa; «Continuar competición guardada»
la recupera sin repetir la carta resuelta ni sobrescribir el solitario de otro mazo.

Las partidas usan formato de guardado 2 con una copia del mazo. Las partidas anteriores
se migran usando el catálogo disponible; no es posible reconstruir valores históricos
que nunca se guardaron. Un formato desconocido o dañado se conserva para recuperación.
Los errores de almacenamiento dejan el progreso en memoria y muestran un aviso con
reintento y descarga de copia (recuperable desde Ajustes); cerrar sin resolverlos puede perder los cambios pendientes.

La huella compartida incluye orden, identificadores y valores de las cartas, además de
su texto. Los enlaces y salas con otra huella requieren usar la misma versión del juego.

El trabajador mantiene una caché estable por versión. Avisa de una actualización y solo
la aplica mediante «Actualizar ahora», fuera de una partida y sin guardados pendientes.
Hay que cerrar las otras pestañas de Continuum antes de aplicarla. Los errores del modo
sin conexión muestran un aviso y permiten seguir jugando. Subir CACHE y APP_VERSION
juntos al publicar cambios. La primera transición desde v73 puede seguir el comportamiento
de recarga del código antiguo que ya estuviera abierto.

La corrección del Pulso online requiere publicar también firestore.rules; no basta con
actualizar los archivos web. Las pruebas del emulador no modifican Firebase de producción.

## Inicio y continuidad de salas (v75)

La portada ofrece Jugar, Continuar y volver a la última sala. Solitario se abre
directamente. La primera partida se propone sin poderes; el ajuste avanzado activa
Pulso y Fantasma. Competición permite 3, 5 o todos los temas.

Las salas nuevas ofrecen turnos sin límite, de 20, 30 o 45 segundos. El reloj se ancla
con una confirmación del servidor y avanza con un contador monotónico: cambiar la hora
del teléfono no cambia el turno. Antes de sincronizar, muestra «…» y no salta turnos.
La latencia puede introducir una pequeña diferencia entre contadores visibles.

Cada participante envía una señal de actividad cada 45 segundos mientras está visible;
la interfaz distingue segundo plano, falta de actividad y pérdida de red local. Esto
añade lecturas y escrituras de Firestore y debe incluirse en el seguimiento de costes.
Tras 90 segundos sin señales del anfitrión, o 15 segundos desde una señal de segundo
plano, otro participante puede tomar el relevo. El servidor comprueba el plazo y la
pertenencia a la sala; el relevo conserva cartas y turno. No es presencia instantánea.

Publicar las reglas v39 junto con el cliente. Las subcolecciones de presencia deben
incluirse en la limpieza de salas; borrar el documento padre no las elimina.

Retos rápidos utiliza las mismas cartas, tamaños, arrastre, confirmación, giro, zoom y ajustes del tablero compartido. Ofrece partida libre en solitario; partidas de 2–4 participantes en un móvil, por internet o por Wi-Fi local; y, como «Retar a un amigo», duelos por turnos en salas para dos. El reto diario es el de la portada, común a todo el juego. Conserva el guardado local y recupera la última sala por internet. Tiene una portada propia; «¿Cuántos hay…?» aparece en otro bloque del mismo tamaño, pendiente de contenido.

Las salas de Retos usan `quickRooms`, con turnos transaccionales e historial de comandos que cada cliente reconstruye. Publicar las reglas junto con el cliente. Los resultados son de juego casual, sin clasificación competitiva del servidor. En Wi-Fi local, quien crea la sala debe mantenerla abierta; las invitaciones se intercambian mediante Compartir/copiar. El diario se fija por fecha local y conserva un intento por perfil. El duelo de seguidos incluye las cartas y el resultado en el enlace.
