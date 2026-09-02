# Continuum

Juego de ordenar para 2–9 personas, diseñado para jugarse pasando un solo móvil o mediante una sala compartida. Funciona sin conexión después de instalarse como aplicación web, salvo cuando se utiliza el modo de varios móviles.

## Nombre y destino del producto

El nombre del juego es **Continuum**, tanto en la aplicación como en su instalación móvil,
documentación y futuras fichas comerciales. El objetivo es comercializarlo como juego móvil
en App Store; la versión actual es una aplicación web instalable, no una app iOS publicada.

El nombre del repositorio y el nombre visible del proyecto de Firebase se administran fuera
del código. Sigue pendiente unificarlos a **Continuum** desde sus respectivas configuraciones.
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

- **Peso de animales:** 38 referencias de masa. Los títulos distinguen sexo, ejemplares grandes,
  medias publicadas y extremos de rangos cuando corresponde; no son promedios universales.
- **Longevidad de animales:** 38 referencias de edad. Se distingue fase adulta, vida en libertad,
  cuidado humano, estadísticos y edades de ejemplares o colonias. Por eso el mazo ya no se
  presenta como «esperanza de vida», que implicaría una medida estadística homogénea.
- **Velocidad de animales:** 38 referencias que identifican movimiento y tipo de medición:
  esprint, nado, picado, crucero o media de una carrera. No es una tabla de récords absolutos.
- **Datos pendientes:** 25 cartas de longevidad y velocidad llevan «en revisión» en el título,
  visible antes de colocarlas, y explican qué falta contrastar. Se conservan sus valores
  provisionales, sin certificarlos ni sustituirlos por estimaciones inventadas.
  Véase [correcciones, fuentes y pendientes](VERIFICACION_CORRECCIONES.md).

**Geografía**

- **Superficie de países:** 59 países ordenados de menor a mayor, de la Ciudad del Vaticano a Rusia.
  Aquí la línea no es temporal: se ordena por tamaño. Ningún país está a menos de un 8% de otro,
  así que las cartas cercanas siempre se pueden razonar.
- **Población de países:** 49 países ordenados de menos a más gente, del Vaticano a la India,
  con la proyección de la ONU a 1 de julio de 2026 (WPP 2024, vía Worldometer). Mismo margen del 8%: por eso falta China, que
  queda a un 4% de la India.
- **Distancias entre ciudades:** 38 pares urbanos de París–Versalles a Madrid–Auckland. Se mide
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
- **Competición:** un tema al azar tras otro, sin repetirse, hasta pasar por los catorce juegos.

Al terminar una partida —local, en solitario o de competición— si hubo alguna carta mal
colocada aparece un botón para repasarlas: dónde iban de verdad, con su época y su
explicación completa, en vez de perderse en el descarte sin más. Y en el momento mismo del
fallo, mientras se ve el aviso, la línea de detrás señala el hueco exacto donde iba —con una
frase para quien usa un lector de pantalla— en vez de dejar que se pierda en el descarte sin
que nadie aprenda de él.

## Ajustes

Un botón de «Ajustes» en la cabecera, disponible en cualquier pantalla, elige el tema:
automático (según la preferencia del móvil), claro u oscuro. La elección se guarda y se
aplica al instante, sin recargar.

## Jugar en solitario

Tres formatos, los tres sin conexión y con la marca guardada en el propio móvil:

- **Reto diario:** las mismas 15 cartas para todo el mundo ese día y un solo intento. Las cartas se
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
- **Competición:** una ronda de 5 cartas por cada uno de los catorce juegos, en un orden al azar
  distinto cada vez y sin repetir ninguno, con tres vidas nuevas en cada ronda. Al terminar la
  última se ve el marcador de todas las rondas juntas. No se puede dejar a medias y continuar
  después: cada ronda cambia de juego, y por tanto de dónde se guardaría la partida.

## Fantasma, Pulso y dificultades (poderes v38)

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
suman aciertos ni cambian vidas. En Difícil se sortea, con probabilidad del 70%, un turno
Fantasma en cada bloque de cuatro turnos a partir del cuarto; nunca son consecutivos.
El calendario se guarda al iniciar, no al repintar. En Experto el resultado sigue revelando
el valor y la explicación de la carta jugada para aprender de ella.

La partida libre permite los cuatro niveles, conserva partidas y separa récords por mazo
y dificultad. Los récords antiguos se mantienen en Fácil. La competición individual también
elige un nivel, conserva cinco decisiones humanas por tema y reserva cartas adicionales
para el tablero. El reto diario permanece en Fácil para no cambiar las quince cartas ni las
marcas existentes. En las partidas compartidas, Pulso conserva su efecto pero se obtiene
como poder secreto al encontrar la carta normal a la que quedó asociado.

**Salas nuevas: publicar `firestore.rules` v38 antes de activar Fantasma o Pulso.** Todos los móviles
deben actualizar la app a v38 y crear una sala nueva; se comprueba la versión de cada participante. Las reglas v38 mantienen las salas anteriores. Sin esas reglas, desmarcar ambos poderes permite seguir iniciando
salas con las reglas anteriores. Las reglas nuevas mantienen compatibles las salas antiguas.

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

El modo local no utiliza backend ni cuentas y guarda la partida únicamente en el dispositivo. Ningún modo incluye anuncios, compras ni servicios de pago.

El modo multijugador utiliza el proyecto gratuito de Firebase configurado para esta aplicación. Consulta `CONFIGURAR_MULTIJUGADOR.md` antes de publicarlo: las reglas de seguridad solo hay que volver a publicarlas cuando cambia su contenido, no al añadir un juego nuevo.

> **Para los poderes v38 hay que volver a publicar `firestore.rules`.** Valida tanto la
> obtención privada como el uso de Pulso; sin republicarlas, las salas nuevas rechazarán
> el reparto aunque las reglas v37 de Fantasma ya estuvieran publicadas.

## Comprobaciones

`tests/` contiene once comprobaciones automáticas: la sintaxis de todos los archivos,
partidas completas sobre un DOM simulado, cuarenta partidas al azar que vigilan bloqueos y el
conteo de cartas, la calidad de todos los mazos, el modo solitario, el Pulso, la accesibilidad con teclado y lector de pantalla, el service worker y las
reglas de Firestore contra el emulador oficial. Se lanzan con `npm install` y `npm test`, y se ejecutan solas en cada propuesta de
cambio. Las instrucciones están en `tests/README.md`.

## Reglas implementadas

El botón **Guía** está disponible en la portada, la configuración, una partida local, el
solitario y las salas compartidas. Explica primero el eje del mazo abierto y después solo
las funciones de la modalidad activa: Pulso, reto diario, partida libre, competición o
gestión de sala.

- La persona más joven comienza y el turno avanza en el orden de los jugadores.
- Cada persona recibe cuatro cartas por defecto; se puede elegir entre una y seis.
- El dato que ordena el mazo —fecha, superficie, población, peso, longevidad, velocidad o
  distancia— permanece oculto hasta colocar la carta en un hueco de la línea.
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
- Gana quien sea la única persona sin cartas. Si varias personas llegan a cero en la misma ronda, cada una recibe una carta para desempatar.
- Si al desempatar ya no quedan cartas que repartir, la partida termina y ganan todas ellas.
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
- **Si aciertas**, la carta se queda en la línea y le pasas una carta al azar de tu mano.
  Al azar y no a elección: si pudieras escogerla soltarías siempre la que no sabes colocar,
  y el Pulso dejaría de ser una apuesta para ser un vertedero.
- **Si fallas**, la carta va al descarte y robas tú una. A la otra persona no le pasa nada.
  El castigo recae solo en quien reta a propósito: si además le quitara una carta al rival,
  alguien ya sin opciones podría fallar aposta para regalarle la partida a quien quisiera.
- Hacen falta **dos cartas** para lanzarlo. Con una sola, ganar el Pulso te dejaría a cero
  regalándola, sin haberla colocado nunca en la línea.
- Quien recibe una carta **no puede volver a ser retado esa ronda**.
- Sí se puede retar a quien ya está **a cero cartas** esperando ganar al final de la ronda:
  acertar le quita la victoria, y es la jugada más tensa del mecanismo.

Funciona en los dos modos. En un solo móvil, quien recibe la carta se entera al recoger el
teléfono, en la pantalla de pasar el turno. En varios móviles todo el mundo ve el Pulso en
directo, pero el título de la carta que cambia de mano solo lo ven las dos personas
implicadas: el resto se entera de que hubo trasvase, no de cuál era la carta.

En el modo de varios móviles, el anfitrión puede saltar el turno de quien se haya quedado sin
batería o expulsar a quien ya no juegue, y cualquier participante puede marcharse: sus cartas
vuelven al descarte y la partida continúa.
