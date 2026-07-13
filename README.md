# Hilo

Juego de cronología para 2–9 personas, diseñado para jugarse pasando un solo móvil o mediante una sala compartida. Funciona sin conexión después de instalarse como aplicación web, salvo cuando se utiliza el modo de varios móviles.

## Modalidades

- **Historia de España:** 190 hechos históricos verificados, desde la Antigüedad hasta la actualidad.
- **Estrenos de cine:** 103 películas internacionales y españolas, desde los pioneros del cine hasta 2024.

Cada modalidad conserva su propia partida local. La modalidad elegida también se guarda en las salas multijugador para que todos los participantes utilicen el mismo mazo.

La aplicación ofrece dos alternativas:

- **Un solo móvil:** no necesita conexión y conserva las partidas localmente.
- **Varios móviles:** crea una sala compartida con Firebase, invita por enlace o código QR y permite que cada persona juegue su mano mientras todos ven la cronología en directo.

## Probarlo en un ordenador

La carpeta debe abrirse mediante un servidor web local (no haciendo doble clic en `index.html`). Por ejemplo, con la extensión gratuita **Live Server** de Visual Studio Code, usa **Open with Live Server** sobre `index.html`.

## Instalarlo en el móvil sin coste

1. Publica esta carpeta en cualquier alojamiento estático HTTPS gratuito (por ejemplo, GitHub Pages o Cloudflare Pages).
2. Abre la dirección una sola vez desde el móvil.
3. En Android/Chrome, elige **Añadir a pantalla de inicio**. En iPhone/Safari, pulsa **Compartir → Añadir a pantalla de inicio**.
4. Desde ese momento se abre como una app y la partida funciona sin conexión.

El modo local no utiliza backend ni cuentas y guarda la partida únicamente en el dispositivo. Ningún modo incluye anuncios, compras ni servicios de pago.

El modo multijugador utiliza el proyecto gratuito de Firebase configurado para esta aplicación. Consulta `CONFIGURAR_MULTIJUGADOR.md` antes de publicarlo.

## Reglas implementadas

- La persona más joven comienza y el turno avanza en el orden de los jugadores.
- Cada persona recibe cuatro cartas por defecto; se puede elegir entre una y seis.
- La fecha permanece oculta hasta colocar la carta en un hueco de la línea temporal.
- Un acierto permanece en la línea. Un fallo se descarta y obliga a robar una carta.
- La victoria se comprueba al final de cada ronda completa.
- Gana quien sea la única persona sin cartas. Si varias personas llegan a cero en la misma ronda, cada una recibe una carta para desempatar.

