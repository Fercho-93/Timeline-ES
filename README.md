# Hilo

Juego de cronología para 2–9 personas, diseñado para jugarse pasando un solo móvil o mediante una sala compartida. Funciona sin conexión después de instalarse como aplicación web, salvo cuando se utiliza el modo de varios móviles.

## Modalidades

- **Historia de España:** 190 hechos históricos verificados, desde la Antigüedad hasta la actualidad.
- **Estrenos de cine:** 87 películas conocidas, de *Viaje a la Luna* (1902) a *Del revés 2* (2024),
  con trece títulos del cine español. Cada año aparece una sola vez y el reparto está equilibrado
  por décadas, para que ninguna carta sea una moneda al aire entre dos estrenos del mismo año.
- **Superficie de países:** 59 países ordenados de menor a mayor, de la Ciudad del Vaticano a Rusia.
  Aquí la línea no es temporal: se ordena por tamaño. Ningún país está a menos de un 8% de otro,
  así que las cartas cercanas siempre se pueden razonar.

Cada modalidad conserva su propia partida local. La modalidad elegida también se guarda en las salas multijugador para que todos los participantes utilicen el mismo mazo.

La aplicación ofrece tres formas de jugar:

- **Un solo móvil:** de 2 a 9 personas pasándose el teléfono. No necesita conexión y conserva las partidas localmente.
- **Varios móviles:** crea una sala compartida con Firebase, invita por enlace o código QR y permite que cada persona juegue su mano mientras todos ven la cronología en directo.
- **En solitario:** una persona contra el mazo, con tres vidas.

## Jugar en solitario

Dos formatos, los dos sin conexión y con la marca guardada en el propio móvil:

- **Reto diario:** las mismas 15 cartas para todo el mundo ese día y un solo intento. Las cartas se
  barajan con la fecha como semilla, así que no hace falta ningún servidor para que dos móviles
  reciban exactamente el mismo reto. Completar el reto un día detrás de otro encadena una racha.
- **Partida libre:** el mazo entero y sin límite de cartas, hasta perder las tres vidas. Guarda tu
  mejor marca de cada modalidad y se puede dejar a medias y continuar después.

## Probarlo en un ordenador

La carpeta debe abrirse mediante un servidor web local (no haciendo doble clic en `index.html`). Por ejemplo, con la extensión gratuita **Live Server** de Visual Studio Code, usa **Open with Live Server** sobre `index.html`.

## Instalarlo en el móvil sin coste

1. Publica esta carpeta en cualquier alojamiento estático HTTPS gratuito (por ejemplo, GitHub Pages o Cloudflare Pages).
2. Abre la dirección una sola vez desde el móvil.
3. En Android/Chrome, elige **Añadir a pantalla de inicio**. En iPhone/Safari, pulsa **Compartir → Añadir a pantalla de inicio**.
4. Desde ese momento se abre como una app y la partida funciona sin conexión.

El modo local no utiliza backend ni cuentas y guarda la partida únicamente en el dispositivo. Ningún modo incluye anuncios, compras ni servicios de pago.

El modo multijugador utiliza el proyecto gratuito de Firebase configurado para esta aplicación. Consulta `CONFIGURAR_MULTIJUGADOR.md` antes de publicarlo: las reglas de seguridad hay que volver a publicarlas cuando cambian.

## Comprobaciones

`tests/` contiene tres comprobaciones automáticas: una partida completa del modo local sobre un
DOM simulado, cuarenta partidas al azar que vigilan bloqueos y el conteo de cartas, y las reglas
de Firestore contra el emulador oficial. Las instrucciones están en `tests/README.md`.

## Reglas implementadas

- La persona más joven comienza y el turno avanza en el orden de los jugadores.
- Cada persona recibe cuatro cartas por defecto; se puede elegir entre una y seis.
- La fecha (o la superficie) permanece oculta hasta colocar la carta en un hueco de la línea.
- Al elegir un hueco hay que confirmarlo antes de revelar: en un móvil el dedo falla y la jugada
  no debería depender de eso.
- Un acierto permanece en la línea. Un fallo se descarta y obliga a robar una carta.
- La victoria se comprueba al final de cada ronda completa.
- Gana quien sea la única persona sin cartas. Si varias personas llegan a cero en la misma ronda, cada una recibe una carta para desempatar.
- Si al desempatar ya no quedan cartas que repartir, la partida termina y ganan todas ellas.
- Si al fallar no queda nada que robar, la carta vuelve a la mano en lugar de descartarse.

En el modo de varios móviles, el anfitrión puede saltar el turno de quien se haya quedado sin
batería o expulsar a quien ya no juegue, y cualquier participante puede marcharse: sus cartas
vuelven al descarte y la partida continúa.
