# Continuum

Juego de ordenar para 2–9 personas, diseñado para jugarse pasando un solo móvil o mediante una sala compartida. Funciona sin conexión después de instalarse como aplicación web, salvo cuando se utiliza el modo de varios móviles.

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
  por décadas, para que ninguna carta sea una moneda al aire entre dos estrenos del mismo año.
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

- **Peso de animales:** 38 especies ordenadas por masa típica adulta, desde una abeja hasta una
  ballena azul. Las cifras son orientativas: sexo, edad y población cambian el peso real.

**Geografía**

- **Superficie de países:** 59 países ordenados de menor a mayor, de la Ciudad del Vaticano a Rusia.
  Aquí la línea no es temporal: se ordena por tamaño. Ningún país está a menos de un 8% de otro,
  así que las cartas cercanas siempre se pueden razonar.
- **Población de países:** 49 países ordenados de menos a más gente, del Vaticano a la India,
  con las cifras de la ONU a 1 de enero de 2026. Mismo margen del 8%: por eso falta China, que
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
- **Competición:** un tema al azar tras otro, sin repetirse, hasta pasar por los doce juegos.

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
- **Competición:** una ronda de 5 cartas por cada uno de los doce juegos, en un orden al azar
  distinto cada vez y sin repetir ninguno, con tres vidas nuevas en cada ronda. Al terminar la
  última se ve el marcador de todas las rondas juntas. No se puede dejar a medias y continuar
  después: cada ronda cambia de juego, y por tanto de dónde se guardaría la partida.

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

> **Al desplegar el Pulso hay que volver a publicar `firestore.rules`.** Es la única jugada
> que toca la mano de dos personas a la vez, así que trae reglas nuevas; sin republicarlas,
> el servidor rechazará los Pulsos de las salas compartidas.

## Comprobaciones

`tests/` contiene once comprobaciones automáticas: la sintaxis de todos los archivos,
partidas completas sobre un DOM simulado, cuarenta partidas al azar que vigilan bloqueos y el
conteo de cartas, la calidad de todos los mazos, el modo solitario, el Pulso, la accesibilidad con teclado y lector de pantalla, el service worker y las
reglas de Firestore contra el emulador oficial. Se lanzan con `npm install` y `npm test`, y se ejecutan solas en cada propuesta de
cambio. Las instrucciones están en `tests/README.md`.

## Reglas implementadas

- La persona más joven comienza y el turno avanza en el orden de los jugadores.
- Cada persona recibe cuatro cartas por defecto; se puede elegir entre una y seis.
- La fecha (o la superficie) permanece oculta hasta colocar la carta en un hueco de la línea.
- Hay dos formas de colocar: tocar la carta y luego el hueco, o arrastrar la carta hasta cualquiera
  de los huecos. Con el dedo, el arrastre empieza tras una pulsación breve, para que deslizar sobre
  una carta siga desplazando la pantalla.
- Al elegir un hueco hay que confirmarlo antes de revelar, se haya llegado tocando o arrastrando:
  en un móvil el dedo falla y la jugada no debería depender de eso.
- Las cifras grandes se expresan en millones con tres cifras significativas («83,6 millones»). El
  redondeo no puede estropear ninguna jugada porque entre dos cartas contiguas siempre hay un 8%.
- Un acierto permanece en la línea. Un fallo se descarta y obliga a robar una carta.
- La victoria se comprueba al final de cada ronda completa.
- Gana quien sea la única persona sin cartas. Si varias personas llegan a cero en la misma ronda, cada una recibe una carta para desempatar.
- Si al desempatar ya no quedan cartas que repartir, la partida termina y ganan todas ellas.
- Si al fallar no queda nada que robar, la carta vuelve a la mano en lugar de descartarse.

## El Pulso

Se activa con un interruptor al montar la partida; sin él, el juego es exactamente el de
siempre. Es la única jugada que toca la mano de otra persona:

- **Una vez por partida y jugador**, y sustituye al turno en vez de sumarse a él.
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
