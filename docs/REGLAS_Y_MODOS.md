# Reglas y modos de juego

Cómo se juega a Continuum y por qué funciona así: los mazos, las reglas comunes, cada forma de
jugar, los poderes, la colección y el perfil. La presentación del juego está en el
[README](../README.md); qué archivo hace cada cosa, en el [mapa del proyecto](../MAPA_DEL_PROYECTO.md).
Lo que pasa por el servidor tiene su propio documento: cuentas y ranking en
[CUENTAS_Y_RANKING.md](CUENTAS_Y_RANKING.md), duelos por turnos en
[DUELOS-ASINCRONOS.md](DUELOS-ASINCRONOS.md), mesas públicas en
[MATCHMAKING_PUBLICO.md](MATCHMAKING_PUBLICO.md) y salas online en
[CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md).

## Los mazos

Los juegos se agrupan en seis bloques. La portada enseña el bloque y lista sus juegos debajo,
así que añadir uno es declararlo en `js/juego/modes.js` y sumarlo a `games`. En total son 15 mazos
y 1.272 cartas (recuento de octubre de 2026; la cifra exacta la da `CT.cards(mazo)`).

**Historia**

- **Historia de España:** 167 hechos, de la fundación griega de Emporion a la pandemia de 2020.
- **Historia mundial:** 117 hechos, de la unificación de Egipto a la invasión rusa de Ucrania,
  mirando más allá de España y dejando los hitos técnicos al mazo de al lado. Donde la fecha es
  tradicional o aproximada, lo dice el propio título.
- **Inventos y descubrimientos:** 67 hitos de la técnica y la ciencia, de la rueda de alfarero
  al iPhone. Cada carta se fecha por un hecho concreto y datable: una patente, una publicación,
  una primera demostración.

**Entretenimiento**

- **Estrenos de cine:** 120 películas, de *Viaje a la Luna* (1902) a *La odisea* (2026), con títulos
  del cine español y un reparto variado por décadas.
- **Hitos de la música:** 99 estrenos, obras, discos y cambios de formato, de *L'Orfeo* (1607)
  a *The Eras Tour* (2023), de la música clásica al streaming.
- **Historia de los videojuegos:** 90 hitos de *OXO* (1952) a *Balatro* (2024), entre
  laboratorio, recreativas, ordenadores, consolas, juego en línea y móvil. En lanzamientos
  regionales se toma siempre el primero que la propia carta especifica.

**Ciencia**

- **Astronomía y espacio:** 55 descubrimientos y misiones, de Eratóstenes midiendo la Tierra a las
  primeras muestras traídas de la cara oculta de la Luna (2024), cada una con su fuente.
- **Historia de la medicina:** 54 hitos, del corpus hipocrático al primer riñón de cerdo
  modificado trasplantado a una persona viva. Las explicaciones distinguen descubrimiento,
  demostración, aprobación y aplicación clínica.

**Naturaleza**

- **Peso de animales:** 80 referencias de masa, de la abeja melífera a la ballena azul. Los
  títulos distinguen sexo, ejemplares grandes, medias publicadas y extremos de rangos cuando
  corresponde; no son promedios universales.
- **Longevidad de animales:** 85 referencias de edad. Se distingue fase adulta, vida en libertad,
  cuidado humano, estadísticos y edades de ejemplares o colonias; por eso no se presenta como
  «esperanza de vida».
- **Velocidad de animales:** 69 referencias que identifican movimiento y tipo de medición:
  esprint, nado, picado, crucero o media de una carrera. No es una tabla de récords absolutos.
- Todas las cartas de Naturaleza llevan su fuente (ver
  [CONTENIDO_Y_DERECHOS.md](CONTENIDO_Y_DERECHOS.md)); eso no equivale a certificar cada dato.

**Geografía**

- **Superficie de países:** 72 países ordenados de menor a mayor, de la Ciudad del Vaticano a Rusia.
  Aquí la línea no es temporal: se ordena por tamaño.
- **Población de países:** 77 países ordenados de menos a más gente, del Vaticano a la India,
  con la proyección de la ONU a 1 de julio de 2026 (WPP 2024, vía Worldometer).
- **Idiomas por hablantes nativos:** 50 lenguas, del aragonés al chino mandarín (929 millones),
  ordenadas por hablantes de lengua materna. No es la lista de «idiomas más hablados del mundo»:
  quien aprende un idioma de adulto no cuenta, y por eso el inglés aparece por detrás del
  español. Del chino y del árabe solo están las variedades principales. Las cifras grandes son de
  Ethnologue 2022 a través de una recopilación de Wikipedia; las lenguas pequeñas llegan aparte y
  con otro corte temporal, una mezcla de fuentes asumida a conciencia (explicada en `mazos/idiomas.js`).
- **Distancias entre ciudades:** 70 pares urbanos de París–Versalles a Madrid–Auckland. Se mide
  la distancia geodésica en línea recta entre centros urbanos, no una ruta por carretera, tren o avión.

**Gran mezcla temporal** no es de ningún bloque temático, a propósito: concatena los ocho mazos
cronológicos —769 cartas en total— y los ordena sobre un único eje. Se presenta aparte en la
portada como modalidad transversal, reutiliza las épocas generales de Historia mundial y no
entra en la rotación de la Competición, que sí cambia de tema.

Los Retos rápidos tienen su propio catálogo de temas cortos (ver [Retos rápidos](#retos-rápidos)).

## Formas de jugar

- **Jugar solo:** una persona contra el mazo: reto diario (sin vidas), ronda de 10 cartas,
  maratón o competición, estas tres con tres vidas (ver [Jugar solo](#jugar-solo)).
- **Un solo móvil:** de 2 a 9 jugadores (8 en Retos rápidos) pasándose el móvil. No necesita conexión y conserva las
  partidas localmente.
- **Cada uno en su móvil:** en directo en una sala (por internet con Firebase, o por la misma
  Wi-Fi sin internet), por turnos en un duelo que cada uno juega cuando puede, o con las mismas
  cartas por enlace. Se invita por enlace, código o QR.
- **Jugar online:** mesas públicas de 2 a 4 personas, eligiendo mesa en el tablón o con partida
  rápida (ver [MATCHMAKING_PUBLICO.md](MATCHMAKING_PUBLICO.md)).
- **Competición:** un tema al azar tras otro, sin repetirse, con 3, 5 o todas las temáticas a elegir
  (ver [Competición](#competición)).

Cada juego conserva su propia partida local. El juego elegido también se guarda en las salas
para que todos los jugadores utilicen el mismo mazo.

## Reglas comunes de una partida

El botón **Guía** está disponible en la portada, la configuración, una partida local, el
solitario y las salas compartidas. Explica primero el eje del mazo abierto y después solo
las funciones de la modalidad activa: Pulso, reto diario, partida libre, competición o
gestión de sala.

- Antes de repartir se juega el minijuego de quién empieza: todos dicen la cifra de la misma
  carta y la mesa se sienta por orden de cercanía (`CT.Starter`, en `js/juego/final.js`). Empieza
  quien más se acerca y el turno avanza en ese orden.
- Cada persona recibe cuatro cartas por defecto (cinco por tema en la competición); se puede elegir
  entre una y seis.
- El tiempo por carta se elige al preparar una partida en grupo, un duelo o Retos rápidos: sin
  tiempo, 15, 20 o 30 segundos (`js/juego/tiempo.js`). Jugando solo en Grandes colecciones (ronda,
  maratón y competición) lo fija la dificultad (ver [Dificultades](#dificultades)), y el reto
  diario no tiene reloj.
- El dato que ordena el mazo —fecha, superficie, población, peso, longevidad, velocidad o
  distancia— permanece oculto hasta colocar la carta en un hueco de la línea.
- La ilustración también. En la mano, todas las cartas enseñan el reverso de su colección
  —el cuero con su filete de oro y el emblema del bloque, el mismo para todas—, y la
  lámina aparece cuando la carta ya está colocada y su valor está a la vista. Una lámina
  cuenta demasiado antes de tiempo: por los ropajes, por las naves del fondo o por el color
  de un grabado se sitúa una carta en su siglo sin saber nada del hecho que cuenta. Además,
  una mano de cuatro cartas no descarga cuatro imágenes y la dirección de la lámina —que lleva
  el nombre del hecho— no viaja al documento.
- Hay dos formas de colocar, y las dos acaban en la misma confirmación (ver
  [Manejo en el móvil](#manejo-en-el-móvil)): tocar la carta y después el hueco «+», o arrastrar
  la carta hasta cualquiera de los huecos.
- Al elegir un hueco hay que confirmarlo antes de revelar, se haya llegado tocando o arrastrando:
  en un móvil el dedo falla y la jugada no debería depender de eso.
- Las cifras grandes se expresan en millones con tres cifras significativas («83,6 millones»). El
  formato se comprueba para no confundir valores distintos. En animales se permiten empates
  reales y referencias próximas: no se alteran las cifras para imponer una distancia del 8%.
- Cuando dos cartas tienen exactamente el mismo valor, cualquiera de los dos órdenes es válido.
  Al repartir, un mazo no lleva dos cartas con el mismo valor: de cada grupo se deja una al azar.
  Si una carta se marcara «en revisión», lo indicaría antes de jugar y se resolvería con el valor
  mostrado (hoy ninguna lo está).
- Un acierto permanece en la línea. En multijugador, un fallo se descarta y obliga a robar una
  carta; si al fallar no queda nada que robar, la carta vuelve a la mano en lugar de descartarse.
- En solitario (también en la competición en solitario) y en Retos rápidos, una carta fallada no
  se pierde: tras ver el hueco donde iba, al continuar pasa a su lugar correcto y queda en la línea
  como referencia (cuesta la vida y no suma acierto). El duelo por enlace queda aparte: sus reglas
  viajan numeradas en el enlace para que las dos marcas sean comparables, y ahí la carta fallada
  no entra.
- En el momento del fallo, mientras se ve el aviso, la línea de detrás señala el hueco exacto
  donde iba la carta, con una frase para quien usa un lector de pantalla.
- La victoria se comprueba al final de cada vuelta completa. Gana quien sea la única persona sin
  cartas al acabar la vuelta. Si hay varias, pasan a una final numérica con una carta neutral y
  cifras secretas.
- En la final se revelan las cifras cuando todos los finalistas responden. Gana la menor
  diferencia absoluta; si empatan, solo quienes comparten la mejor respuesta repiten con otra
  carta. La final no usa poderes ni reparte cartas a las manos.
- Al terminar una partida —local, en solitario, de competición o en una sala online o por Wi‑Fi—
  si hubo alguna carta mal colocada aparece un botón para repasarlas: dónde iban de verdad, con su
  época y su explicación completa (en un solo móvil y en solitario, también con un enlace a su
  ficha en la [enciclopedia](#enciclopedia)).

## Jugar solo

Cuatro formatos, todos sin conexión y con la marca guardada en el propio móvil:

- **Reto diario:** se entra desde la portada, no desde un mazo. Cada día sale un mazo —un día de
  Grandes colecciones y al siguiente de Retos rápidos, alternando sin falta (`CT.RetoDiario.familia`)— y de él las mismas 10 cartas
  para todo el mundo, con un solo intento por perfil. Las cartas se barajan con la fecha local como
  semilla, así que no hace falta ningún servidor para que dos móviles reciban exactamente el mismo
  reto. Tiene su propio guardado, así que empezarlo no pisa una partida libre a medias del mismo
  mazo. Completar el reto un día detrás de otro encadena una racha, que además se ve como un
  calendario de las últimas cuatro semanas, no solo como un número. Al terminar se puede compartir
  el resultado —puntuación y una cuadrícula de aciertos al estilo Wordle, sin desvelar ninguna
  carta— por donde el móvil ofrezca o copiado al portapapeles. Con cuenta, el resultado se guarda
  en el progreso y, si se acepta, entra en el ranking diario y semanal (ver
  [CUENTAS_Y_RANKING.md](CUENTAS_Y_RANKING.md)). Siempre se juega en Fácil, para que sus 10 cartas
  y sus marcas sean iguales para todo el mundo.
- **Ronda:** 10 cartas sacadas con preferencia de las que aún no están en el álbum y ordenadas de la
  más holgada a la más apretada respecto a la línea. Acabarla con vidas la supera y cada vida que
  queda es una estrella; se guarda la mejor ronda por juego y dificultad. Se puede dejar a medias.
- **Maratón:** el mazo entero y sin límite de cartas, hasta perder las tres vidas. Guarda tu
  mejor marca de cada juego y dificultad, y se puede dejar a medias y continuar después.
- **Competición:** varios temas seguidos; ver [Competición](#competición).

### Dificultades

| Nivel | Cartas automáticas tras cada acierto | Visibilidad | Tiempo por carta |
|---|---:|---|---:|
| Fácil | 0 | Visible | Sin tiempo |
| Normal | 1 | Visible | 30 s |
| Difícil | 2 | Fantasma ocasional durante una jugada | 20 s |
| Experto | 2 | Oculto en todas las jugadas | 15 s |

Las cartas automáticas entran al continuar y solo tras un acierto: cuando vas bien, el tablero se
complica. Tras un fallo no entran, porque ya se pierde una vida y la carta fallada pasa a la línea.
Primero se reserva la siguiente carta del jugador; si faltan cartas se añaden menos. No suman
aciertos ni cambian vidas. Y se ven llegar: la carta entra desde el centro de la pantalla hasta su
sitio, y la vista va con ella —una detrás de otra si son dos, porque la segunda suele caer en otro
punto de la línea y sin mover la vista se colocaría fuera de la pantalla—. Son cartas que nadie ha
jugado y que cambian el tablero, así que se ve de dónde salen y dónde caen en vez de aparecer ya
puestas. El aviso de texto sigue estando, para quien no mire en ese momento, y con «reducir
movimiento» la carta aparece sin recorrido.

En Difícil se sortea, con probabilidad del 70%, un turno Fantasma en cada bloque de cuatro turnos
a partir del cuarto; nunca son consecutivos. El calendario se guarda al iniciar, no al repintar.
En Experto el resultado sigue revelando el valor y la explicación de la carta jugada para aprender
de ella.

La ronda y la maratón permiten los cuatro niveles, conservan partidas y separan récords por mazo y
dificultad. La competición individual también elige un nivel.

Con reloj, «Guardar y salir» es una pausa: la carta que estaba abierta (o el turno, en un solo
móvil) estrena plazo entero al volver. Cerrar la aplicación sin pasar por el menú no pausa nada.
El duelo por enlace es la excepción: su reloj no se para nunca, y el propio aviso de salida lo dice.

## Competición

La Competición es el último panel de la lista de Grandes colecciones, en Jugar solo, Un solo móvil
y Cada uno en su móvil. Se configuran 3, 5 o todas las temáticas y entre 1 y 6 cartas por tema.
Cada tema usa un mazo al azar distinto, sin repetir ninguno; Gran mezcla se excluye porque combina
otros mazos.

- **En solitario** se suman los aciertos, con tres vidas nuevas en cada tema. La competición
  individual elige un nivel de dificultad (que fija el tiempo por carta), juega en cada tema las
  cartas elegidas (cinco si no se cambia) y reserva cartas adicionales para el tablero. Al terminar
  el último tema se ve el marcador de todos juntos.
- **En grupo** se reparten las cartas elegidas a cada jugador (ajustadas si el mazo es
  pequeño), gana el tema quien termine una vuelta completa sin cartas y se usa la final numérica
  secreta si hay varios. Ganar un tema suma un punto; quedarse con cartas en la mano al
  terminarlo penaliza con su número menos uno (una carta no resta nada, dos cartas restan un punto,
  tres restan dos, y así sucesivamente). Quien acaba sin cartas pero pierde la final numérica no
  suma ni resta. Al terminar, el marcador muestra el ganador o el empate global en puntos.
- **Guardado.** En un móvil, la competición se guarda en una clave propia, aparte de las partidas
  normales de cada mazo (`continuum-competition-v1` en solitario, `continuum-multi-competition-v1`
  en un solo móvil): conserva dificultad, orden de temas, marcador, tema y resultado pendiente.
  «Salir» la deja en pausa, y «Continuar competición en solitario» (o «Continuar la competición
  guardada», en un solo móvil) la recupera sin repetir la carta resuelta ni sobrescribir el solitario
  de otro mazo.
- **Cada uno en su móvil**, el anfitrión pasa al siguiente tema dentro de la misma sala; se conservan
  jugadores e historial y se preparan nuevas manos. Se puede reconectar con el mismo código.
  En la sala online lo admiten las reglas publicadas desde el cliente 42; en la sala Wi-Fi,
  `js/sin-conexion/local-room.js`.

## Poderes: Fantasma y Pulso

Los dos poderes se activan o desactivan con los interruptores «Cartas Fantasma» y «Cartas Pulso»
al configurar la partida, tanto en un solo móvil como en salas; parten marcados o desmarcados
según su valor por defecto y se pueden cambiar antes de barajar. La competición no los ofrece:
se juega siempre sin poderes, en un solo móvil, en la sala online y en la de Wi‑Fi.

### Fantasma

El poder Fantasma puede acompañar al reparto o a un robo. Está separado de las cartas a ordenar:
conservarlo no impide ganar, no sustituye un robo de penalización, no se pasa con el Pulso y no se
recicla con el descarte. El poder solo se muestra a su propietario, sin aumentar el contador público
de cartas. Máximo un uso por persona. Si encuentra otro, se recoloca al azar entre las cartas
pendientes sin Fantasma; si no quedan posiciones libres, se consume sin conceder otro uso.

Con al menos cinco cartas en la línea y alguna en la mano, se puede activar al comienzo del propio
turno; no reemplaza la colocación. Afecta a quien lo activa y a cada rival una vez. Después hay una
vuelta completa con valores visibles antes de otro Fantasma. No se pueden acumular ni combinar su
activación con el Pulso en ese mismo turno. Un rival sí puede usar Pulso durante el efecto. Saltar
un turno o abandonar la sala descuenta al participante afectado sin alargar la duración. Los empates
y la victoria siguen comprobándose al final de la vuelta, sin contar poderes.

Mientras dura, se ocultan cifras, explicaciones y bandas de época/magnitud del tablero. El minimapa
usa posiciones uniformes y números de orden, también en sus etiquetas accesibles. Los títulos
—incluidas las condiciones de medición y avisos «en revisión»— siguen visibles. El resultado revela
la carta recién resuelta a todos, sin destapar las anteriores. Es una regla de interfaz, no
protección contra un cliente modificado: los datos de los mazos ya están en el navegador.

### Pulso

El mazo esconde siempre 1 Carta Pulso con 2–3 jugadores, 2 con 4–6 y 3 con 7–9, usando
exactamente la misma posición 50/50 que Fantasma (ver
[Cómo aparecen los poderes](#cómo-aparecen-los-poderes)). En las partidas compartidas, el Pulso
conserva su efecto pero se obtiene como poder secreto al encontrar la carta normal a la que quedó
asociado. Fantasma y Pulso
nunca comparten una carta normal. Puede salir al repartir, al robar o quedarse sin descubrir al
final. Cuando aparece se guarda en privado, fuera de la mano y de su contador; no elimina un robo
de penalización ni impide ganar. Si la misma persona encuentra otra Carta Pulso, se recoloca entre
las posiciones pendientes libres.

Su efecto es la única jugada que toca la mano de otra persona:

- **Una vez por cada persona que encuentre el poder**, y sustituye al turno en vez de sumarse a él.
- Retas a quien elijas. **El mazo saca una carta que tú no eliges** y la colocas sin prisa:
  no hay cronómetro, la dificultad la pone lo llena que esté la línea. Al principio los
  huecos son anchos y aciertas casi seguro, pero es cuando menos daño haces; al final son
  estrechos y es cuando el Pulso decide la partida.
- Después coloca quien defiende, sin ver la posición elegida por quien reta.
- **Aciertan los dos:** la carta queda en la línea y ninguna mano cambia.
- **Solo acierta quien reta:** la carta queda en la línea y pasa al defensor la carta de su mano
  que eligió al lanzar el Pulso.
- **Solo acierta quien defiende:** la carta queda en la línea y quien reta roba una.
- **Fallan los dos:** la carta se descarta y quien reta roba una.
- **Mazo y descarte agotados:** si corresponde robar pero no queda ninguna carta, no hay robo y el
  turno continúa. Si ambos fallaron, la carta del reto sí puede reciclarse.
- Hacen falta **dos cartas** para lanzarlo. Con una sola, ganar el Pulso te dejaría a cero
  regalándola, sin haberla colocado nunca en la línea.
- Quien recibe una carta **no puede volver a ser retado en esa vuelta**.
- Sí se puede retar a quien ya está **a cero cartas** esperando ganar al final de la vuelta:
  acertar mientras esa persona falla le quita la victoria, y es la jugada más tensa del mecanismo.

Funciona en los dos modos. En un solo móvil, quien recibe la carta se entera al recoger el
móvil, en la pantalla de pasar el turno. Cada uno en su móvil, todo el mundo ve el Pulso en
directo, pero el título de la carta que cambia de mano solo lo ven las dos personas
implicadas: el resto se entera de que hubo trasvase, no de cuál era la carta.

### Cómo aparecen los poderes

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

## Retos rápidos

**Retos rápidos** funciona igual que las grandes colecciones, con temas cortos: se juega solo
(cuatro mazos del día que rotan, o una partida sorpresa por duración), en un solo móvil, por
internet o por Wi-Fi local, en mesas públicas, o retando a un amigo en un duelo (por turnos o con
las mismas cartas por enlace). No usa el marcador de Competición: mantiene su propia partida
guardada. Usa las mismas cartas, tamaños, arrastre, confirmación, giro, zoom y ajustes del
tablero compartido.

En solitario, cada día se ofrecen cuatro retos distintos, iguales para todo el mundo: el
catálogo se baraja una vez con semilla fija y cada día toma el tramo siguiente, así que en ocho
días salen todos sin repetir de un día a otro. Cada carta que quien juega coloca bien entra en su
**colección** de Retos rápidos (`quickMastered` en `hilo-perfil-v1`, que viaja con el progreso de
la cuenta): la pantalla de solitario enseña lo descubierto de cada mazo y «Ver tu colección» lista
las cartas conseguidas y las que faltan. Cuentan las de solitario, el reto diario, el duelo por
enlace y, en salas, las de la propia plaza; no las de un móvil compartido entre varios.

Con varias personas (sala, mesa pública, un solo móvil o duelo), cada reto se juega con 10 cartas
al azar de su mazo (`QuickEngine.MULTI_CARDS`); la primera hace de referencia y no puntúa.
En cada turno se elige una carta y se confirma su hueco en la línea. Acertar suma un punto
provisional y pasa el turno. Qué pasa al fallar se elige al preparar la partida («Si alguien
falla»):

- **Arriesgar o plantarse:** fallar pierde los puntos provisionales de ese reto y retira al
  participante hasta el siguiente; plantarse los asegura y también le retira.
- **Seguir hasta el final:** un fallo no suma, pero se juega todo el reto y gana quien acierte más.

Los puntos de retos anteriores nunca se pierden. Una carta fallada se coloca correctamente como
referencia: al fallar se ve el hueco donde iba y, al continuar, entra en la línea. Al agotarse
las cartas se aseguran los puntos pendientes; también termina el reto si nadie sigue activo. El
primer turno rota entre retos. Gana la mayor puntuación acumulada y los empates finales se
comparten. La rotación reduce la ventaja inicial, pero no garantiza el mismo número de intentos.

El catálogo tiene **29 retos y 567 cartas**, de 9 a 34 por reto: deportes por jugadores,
graduación de bebidas, festividades, redes sociales, Segunda Guerra Mundial, Guerra Civil, reyes
de España, consolas, películas por Óscar, empresas por fundación y por facturación, husos
horarios, ciudades de oeste a este y de sur a norte, partes del cuerpo, series por temporadas,
edificios, ríos de España, alimentos por calorías, discos, estadios, capitales por altitud,
Eurovisión, unidades de almacenamiento, aeropuertos, metros, programas españoles, salarios
mínimos y manos del póker. Cada carta tiene su ilustración, dato, curiosidad y fuente,
accesibles al revelar y al repasar el orden completo; las cifras que cambian con el tiempo
indican su fecha de referencia («Datos a 2026»). La colocación admite empates reales y retos de
orden ascendente o descendente.

`mazos/quick-challenges-data.js` contiene el catálogo. `js/retos/quick-challenges-engine.js`
reutiliza la comparación de `js/juego/engine.js`; `js/retos/quick-challenges.js` presenta los
turnos y guarda una configuración y un historial de acciones en el almacenamiento de la cuenta.
La recuperación reproduce acciones válidas en vez de aceptar puntuaciones guardadas. Si cambia el
significado de los datos o las reglas, debe incrementarse `QuickCatalog.version`.

Con varias personas, las salas usan `quickRooms`, con turnos transaccionales e historial de
comandos firmados que cada cliente reconstruye y valida (`js/retos/quick-room.js`). Los resultados
son de juego casual, sin clasificación competitiva del servidor. En Wi-Fi local, quien crea la sala
debe mantenerla abierta.

## Jugar con otras personas

### Un solo móvil

De 2 a 9 jugadores (8 en Retos rápidos) se pasan el móvil; no necesita conexión y conserva la partida en el propio
móvil. El juego no sabe quién sostiene el móvil, así que una partida en un solo móvil cuenta
como jugada, no como ganada (ver [Atlas](#atlas-perfil-estadísticas-y-logros)), y sus cartas no
entran en la colección de Retos rápidos.

### Salas online: reloj, presencia y relevo

En las salas online el reloj del turno se ancla con una confirmación del servidor y avanza con un
contador monotónico: cambiar la hora del teléfono no cambia el turno. Antes de sincronizar,
muestra «…» y no salta turnos. La latencia puede introducir una pequeña diferencia entre
contadores visibles.

Cada participante envía una señal de actividad cada 45 segundos mientras está visible; la
interfaz distingue segundo plano, falta de actividad y pérdida de red local. Esto añade
lecturas y escrituras de Firestore y cuenta en los costes. Tras 90 segundos sin señales del
anfitrión, o 15 segundos desde una señal de segundo plano, otro participante puede tomar el
relevo. Las reglas comprueban el plazo y la pertenencia a la sala; el relevo conserva cartas y
turno. No es presencia instantánea. La limpieza diaria borra cada sala con su presencia y sus
demás subcolecciones a los siete días sin actividad.

El anfitrión puede saltar el turno de quien se haya quedado sin batería o expulsar a quien ya no
juegue, y cualquier participante puede marcharse: sus cartas vuelven al descarte y la partida
continúa. Cómo se prueban con dos móviles y qué validan las reglas, en
[CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md).

### Duelo por enlace

Es el ritmo «Mismas cartas» de **Cada uno en su móvil → Crear partida**. Juegas unas cartas al
azar del mazo elegido y mandas un enlace: quien lo abra recibe exactamente esas mismas cartas, en
el mismo orden, y al terminar ve el cara a cara —el marcador y las dos tiradas carta a carta— con
un botón para devolver el reto con semilla nueva. El enlace lleva las cartas y el resultado de
quien reta.

Tiene **dos modalidades**, que se eligen dentro del mismo formato porque comparten casi
todo —las mismas cartas en los dos móviles, el enlace, el nombre, el reloj y lo que pasa al
salirse de la aplicación— y solo se diferencian en qué se hace con cada carta:

- **Ordenar las cartas.** 15 cartas que se colocan en la línea. Gana quien más acierte.
- **Escribir la cifra.** 10 cartas de las que se responde el número —los habitantes, los
  años, los kilómetros—. Una respuesta es un acierto si se queda lo bastante cerca (por
  porcentaje, o por años de diferencia en los mazos de fechas). Gana quien tenga más aciertos;
  si empatan, quien haya respondido más rápido. Los resultados que trae un enlace no se creen:
  se recalculan con las mismas cartas y tienen que coincidir.

Las dos se eligen con un control de dos pastillas, no con un desplegable: así se ve que hay
dos maneras y cuál está elegida, en vez de enseñar una y esconder la otra.

**Las unidades.** Cada mazo ordena sus cartas por un número en una sola unidad —kilos, años,
km/h—, pero las cartas se enseñan en la que toque: la hormiga en miligramos y la ballena en
toneladas. Pedir las dos «en kilos» obligaría a escribir `0,0000001` para una de ellas, así que
**la respuesta admite su unidad** y se convierte a la del mazo: «40 g», «2,5 t», «3 días»,
«30 m/s», «47 millones». Sin unidad se entiende la del mazo, y una que no se reconoce descarta la
respuesta entera en vez de colarse como si fuera la básica. Las unidades las declara cada eje en
`js/juego/modes.js`, y el campo de respuesta las lista debajo: sin eso no hay manera de saber en
qué se responde. Lo que no se hace es elegir la unidad por carta —«¿cuánto pesa, en gramos?»—,
porque eso regalaría el orden de magnitud, que es justo lo que había que adivinar.

**Antes de empezar.** Como un duelo va a reloj desde la primera carta, entre elegir la modalidad y
jugar hay una pantalla que explica cómo funciona, con una demostración animada del mazo que se va
a jugar —su pregunta, su eje, sus unidades, pero ninguna carta de verdad: eso sería destripar una
de las diez— y un botón para empezar. Al pulsarlo, tres segundos de cuenta atrás. La partida no se
crea hasta que termina, así que el reloj de la primera carta empieza cuando de verdad se ve la carta.

**El reloj.** Sin un plazo por carta, cualquiera puede ir a buscar la respuesta a otra parte, y
quien la busca gana. Por eso el plazo se elige al crear el duelo —**sin tiempo, 15, 20 o 30
segundos**, las mismas opciones de todo el juego— y, una vez elegido, no se puede parar. Sin
tiempo, en cifras la rapidez sigue desempatando contra un tope amplio de diez minutos por carta.

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

**Sin servidor.** Sin cuentas y sin que los dos móviles tengan que estar encendidos a la vez: se
apoya en lo mismo que el reto diario, dos móviles que barajan con la misma semilla reciben las
mismas cartas. Allí la semilla es la fecha; aquí viaja dentro del enlace, junto con el mazo, el
número de cartas, la marca de quien reta y su cuadrícula de aciertos, todo en base64url. Por eso
un duelo funciona con la aplicación instalada y sin conexión.

**Versiones de las reglas.** La versión que abre la carga útil no numera el formato: **numera las
reglas con las que se jugó**, y la tabla `REGLAS` de `js/online/duelo.js` dice cuáles son. Dos
partidas con plazos distintos no se pueden comparar, así que un enlace viejo no se rechaza ni se
reinterpreta: se lee con su propio plazo y se juega como se jugó, avisando de ello en la pantalla
de invitación. En el duelo de cifras eso además es obligatorio para que cuadren los puntos, porque
la parte de la prisa se mide contra el plazo. Una aplicación que no conozca una versión pide
actualizar en vez de comparar dos partidas con reglas distintas. Cambiar el plazo, por tanto, es
añadir una fila a `REGLAS` y estrenar versión, no editar un número: los enlaces que ya estén
circulando siguen siendo válidos y siguen significando lo que significaban.

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

### Duelos por turnos y mesas públicas

Los duelos por turnos entre dos cuentas se explican en [DUELOS-ASINCRONOS.md](DUELOS-ASINCRONOS.md);
las mesas públicas y la partida rápida con desconocidos, en
[MATCHMAKING_PUBLICO.md](MATCHMAKING_PUBLICO.md).

## Enciclopedia

Al elegir un mazo, debajo de los formatos de juego, «Enciclopedia» lo abre fuera de partida:
todas sus cartas, ya con el valor revelado, ordenadas por el eje del juego y con su explicación
completa. Se puede buscar por título, explicación o fuente —sin distinguir tildes ni mayúsculas— y
filtrar por época o magnitud. Las cartas de Peso, Longevidad, Velocidad y Superficie que llevan una
fuente documentada enlazan directamente a ella. Cada carta fallada en el repaso de fin de partida
también lleva a su ficha en la enciclopedia, ya con esa carta destacada. No aparece en ninguna
pantalla de partida: vería el mazo entero y volvería trivial cualquier jugada pendiente.

Lo único que hay que ganarse son las láminas: hasta que una carta pasa por tu mano, en el sitio de
su ilustración hay un sello cerrado —papel tramado y un candado, sin rótulo; lo que el candado
dice sin decirlo va en el texto que solo leen los lectores de pantalla—. La ilustración no se
difumina: no se pinta siquiera, así que un mazo entero por descubrir no descarga ni compone sus
imágenes al abrir la enciclopedia.

Descubre tanto acertarla como fallarla: en los dos casos la pantalla de resultado te la ha
enseñado entera, y esconder justo las que se fallan sería esconder las que más interesa repasar.
El texto no se vela nunca —valor, época, explicación y fuente se leen desde el primer día—, así que
la enciclopedia sigue sirviendo para consultar; lo que se colecciona es el dibujo. Cada mazo lleva
su recuento («12 de 41 láminas descubiertas») y las cartas descubiertas viajan en el perfil, así
que se conservan al exportarlo e importarlo. Los identificadores no se repiten entre mazos:
descubrir una carta en «Gran mezcla» la descubre también en su mazo de origen.

El filtro **Todas · Desbloqueadas · Bloqueadas** está tanto en el catálogo completo —la
enciclopedia del menú principal— como en cada mazo con ilustraciones. Empieza siempre en «todas»
y vuelve ahí al cambiar de mazo: llegar a uno nuevo con media colección escondida y sin saber por
qué es la manera más rápida de perderse. Se combina con la búsqueda y con el filtro de épocas, y
no aparece en los mazos sin ilustraciones, donde no habría nada que bloquear.

En el catálogo, un filtro o una búsqueda abren los mazos para enseñar lo que han encontrado, pero
solo mientras quepa: por encima de 120 cartas se enseñan los mazos con su recuento y se despliega
el que se quiera. «Bloqueadas» sobre el catálogo entero son más de mil cartas, y pintarlas de una
vez cuesta más de un segundo en un móvil modesto; con los mazos plegados, cincuenta milisegundos y
la misma respuesta: cuántas faltan y dónde.

## Atlas: perfil, estadísticas y logros

«Atlas», en la barra de la portada, reúne la colección —con la entrada a la enciclopedia—, el reto
diario y los duelos, y las estadísticas: partidas jugadas, cartas colocadas, porcentaje de
aciertos, mejor tirada seguida y racha de retos diarios. Por debajo, una fila por mazo jugado y dos
listas de puntos débiles —los tramos donde más se falla y las cartas que más se atragantan—, cada
una enlazando a la enciclopedia del mazo correspondiente, ya filtrada o con la carta destacada.

### Tu nombre y tu avatar

La bienvenida propone un alias y un avatar; los dos se pueden cambiar después en el Atlas, y
cambiar el nombre no cambia el avatar. Hay 36 medallones originales en `assets/avatars/`,
dibujados con el mismo papel y color que el resto del juego (`js/jugador/avatares.js`). Al entrar
se asigna uno a partir del UID, y la elección propia se guarda en el perfil de la cuenta: ese mismo
jugador se ve igual en el Atlas, las salas, los duelos, las mesas y el ranking, sin guardar ni
transmitir una imagen. En salas por Wi-Fi viaja el identificador del avatar; en partidas en un
solo móvil se usa el nombre disponible.

`js/jugador/identidad.js` guarda el nombre en `continuum-identidad-v1` y lo copia en
`hilo-nombre-v1`, usado por duelos y salas. Con cuenta se guarda también en ella, y un nombre
ocupado por otra cuenta se rechaza con aviso (ver [CUENTAS_Y_RANKING.md](CUENTAS_Y_RANKING.md)).

### Logros

Los diecisiete logros van en cuatro grupos (Constancia, Puntería, Recorrido y Oficio). Los que
piden repetición enseñan cuánto llevas; los demás, solo si están o no. Se comprueban al resolver
una carta o al terminar una partida, nunca al repintar, así que ninguno se desbloquea dos veces.
Los que caen a mitad de partida se avisan y ya está; los de una pantalla de fin se enseñan ahí, con
su nombre y su condición.

### Dónde se guarda

El perfil se guarda en `hilo-perfil-v1`, aparte del reto diario y los récords de
`hilo-retos-v1`. El reto diario guarda su racha dentro de `hilo-retos-v1`, en el campo
`retoDiario` (no es ningún mazo), porque esa es la clave que la cuenta sincroniza. Con cuenta,
`hilo-perfil-v1` y `hilo-retos-v1` se sincronizan en Firestore (`playerProgress`), así que el
progreso no depende del móvil. Aun así, la pantalla permite copiar el perfil en JSON y recuperarlo
en otro sitio (útil sin cuenta de Apple o al cambiar de dirección web), y borrarlo entero previa
confirmación.

Dos cosas se cuentan con cuidado. En una partida a un solo móvil gana alguien de la mesa, pero el
juego no sabe quién sostiene el teléfono: esa partida se cuenta como jugada, no como ganada. Solo
una sala y un duelo apuntan una victoria como tuya, porque son los dos formatos con una marca ajena
identificable enfrente. Y en una sala cada móvil registra solo sus propias cartas, descartando las
instantáneas de Firestore que ya vio —se recuerdan las últimas cuarenta por `CÓDIGO:versión`—
para que una reconexión o una instantánea que llega desordenada no sume dos veces.

## La cartera

`js/jugador/cartera.js` es el único sitio del juego que responde a **«¿tiene derecho este jugador a
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
la beta los cuenta todos. `SIMULACION` está vacía durante la beta: todo el catálogo abierto.
Ninguna de las dos compromete precio ni decisión: son el esqueleto sobre el que colgar las fichas
de las tiendas cuando se decida (ver [TIENDAS.md](TIENDAS.md)).

`node tests/cartera.mjs` cierra un mazo a mano y recorre el juego entero comprobando que
todos los rincones lo respetan. Sin esa mitad, la cartera sería una función que nadie llama.

## Ajustes

La pestaña «Ajustes» de la barra inferior, disponible en cualquier pantalla, elige cómo se ve
la aplicación. La elección se guarda y se aplica al instante, sin recargar, y con ella van
también las dos etiquetas de color de la barra del navegador.

| Aspecto | Para qué |
| --- | --- |
| **Claro** | El papel de la edición: crema frío, tinta carbón y latón. |
| **Oscuro** | Cuero entintado, marfil cálido y latón, con capas diferenciadas para la navegación, los modales y el tablero. |

Los dos temas viven en variables CSS: las de la interfaz en `css/edition.css` (`--edition-*`)
y las de la mesa en `css/styles.css`. Un tema que cambie el fondo tiene que traer **todas** las
superficies, no solo el papel: si una se queda con su valor claro, el texto de encima —que sí
cambia— deja de leerse. Eso lo vigila `tests/accesibilidad.mjs`, que además comprueba que los
seis colores de cada tema llegan a 4,5:1 en los pares que llevan texto.

El mismo panel lleva un botón de comentarios que abre un correo con la versión instalada
y la pantalla en la que se estaba, para no tener que describirlo de memoria. Si algo se
rompe de verdad, en vez de una pantalla en blanco aparece un aviso con ese mismo informe
y un botón para copiarlo.

Los sonidos de cada acción y cuándo suenan están en [SONIDOS_TRANSICIONES.md](SONIDOS_TRANSICIONES.md).

## Manejo en el móvil

Pensado para el dedo. Ningún control baja de los 44 px que necesita una yema.

- **El mapa de la línea.** Sobre la línea temporal hay un mapa —una tira con una parada por carta
  colocada, con su época y su año— porque en una pantalla de 390 px no caben ni dos cartas de la
  línea: el mapa no coloca nada, solo lleva la vista hasta donde le digas. Las paradas se sitúan a
  escala real dentro del rango de lo ya colocado, no repartidas a partes iguales, así que de un
  vistazo se ve la forma de verdad de la línea —sus racimos y sus huecos— y no solo un índice;
  cuando dos paradas caen demasiado cerca para pulsarlas por separado, se separan lo justo para
  seguir siendo un botón de dedo.
- **Colocar.** Tocar la carta y después el hueco «+», o **mantener pulsada la carta y
  arrastrarla** hasta el hueco; las dos acaban en la misma confirmación. Con el dedo, el arrastre
  pide esa espera corta a propósito: mientras la carta no se ha levantado, el gesto es del
  navegador y deslizar sigue desplazando la página como siempre; solo cuando se levanta —la carta
  se encoge y el móvil da un toque— se le quita el gesto al navegador, y para entonces no había
  ningún desplazamiento en marcha que interrumpir. Con ratón se arrastra desde el primer
  movimiento, sin espera.
- **Volver e Inicio.** Junto a **Volver** hay un atajo al inicio, con la rosa de los vientos del
  emblema: «Volver» retrocede un paso y la rosa salta al inicio de una vez (y gira al pulsarla). Va
  dibujada en línea, no como imagen: se recorta al tamaño de un botón sin emborronarse, toma la
  tinta de cada aspecto y no pide ninguna descarga. No aparece durante una partida, que se abandona
  por su propio menú para que haya una pregunta de por medio.
- **Deslizar para volver.** Deslizar de izquierda a derecha vuelve a la pantalla de detrás,
  exactamente igual que el botón **Volver** de esa pantalla: cierra el diálogo que haya encima (la
  guía, los ajustes, la enciclopedia) o retrocede un paso en la navegación. Funciona en la web y en
  las dos tiendas, no solo en Android. El gesto pide un recorrido claramente horizontal y hacia la
  derecha (`js/interfaz/swipe.js`), y no navega en tres sitios a propósito: dentro de una partida
  —una partida se abandona por su menú, que pregunta antes, y no por un gesto que se puede hacer
  sin querer al mirar la mesa—, encima de una tira que se desplaza a los lados, como la línea
  temporal o el marcador, y sobre un campo de texto o un desplegable. Desde el inicio no hace
  nada: cerrar la aplicación sigue siendo cosa del botón Atrás de Android.
  La flecha **Volver** se ve también en las pantallas táctiles: deslizar es un atajo, no la
  única forma de volver. Las capas (Guía, Ajustes, Enciclopedia) se cierran con esa flecha o con
  el botón **Volver** de abajo.
- **Botón Atrás de Android.** Solo dentro de la app (Capacitor): cierra el diálogo abierto,
  pregunta antes de abandonar una partida o vuelve al inicio (`js/interfaz/a11y.js`,
  `backPressed`, y `js/juego/app.js`). El deslizamiento comparte ese mismo «atrás».
- **Carátulas.** Se sirven en dos tamaños —una para el lomo y otra para la portada desplegada—,
  así que la primera visita descarga unos 150 KB de imagen.

## Guardado y actualizaciones

Las partidas usan formato de guardado 2 con una copia del mazo. Un formato desconocido o dañado
se conserva para recuperación. Los errores de almacenamiento dejan el progreso en memoria y
muestran un aviso con reintento y descarga de copia (recuperable desde Ajustes); cerrar sin
resolverlos puede perder los cambios pendientes.

La huella compartida incluye orden, identificadores y valores de las cartas, además de
su texto. Los enlaces y salas con otra huella requieren usar la misma versión del juego.

El service worker mantiene una caché estable por versión. Avisa de una actualización y solo
la aplica mediante «Actualizar ahora», fuera de una partida y sin guardados pendientes.
Hay que cerrar las otras pestañas de Continuum antes de aplicarla. Los errores del modo
sin conexión muestran un aviso y permiten seguir jugando. Si alguien se queda atascado en una
versión vieja, `actualizar.html` descarta el service worker y su caché sin borrar su progreso.
Cómo se publica una versión nueva (y por qué hay que subir la versión de caché) está en
[CLAUDE.md](../CLAUDE.md) y en [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#web).

### Compatibilidad con versiones anteriores

- Las partidas guardadas con el formato anterior se migran usando el catálogo disponible; no es
  posible reconstruir valores históricos que nunca se guardaron.
- Las partidas antiguas conservan su reparto y su comportamiento anterior, sin añadir poderes ni
  volver a sortearlos.
- Los récords antiguos de la partida libre pasan a la maratón, en Fácil. Las rachas del antiguo
  reto diario por mazo se borraron al llegar el reto para todos; las mejores marcas de la partida
  libre se conservan.
- Aspectos antiguos: Pergamino y Alto contraste pasan a Claro; Noche profunda pasa a Oscuro; y
  Automático conserva el aspecto que indique el sistema en ese primer arranque. La migración
  guarda el resultado sin tocar el tamaño de texto ni los efectos opcionales.
