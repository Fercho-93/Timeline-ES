// El mapa de la línea: una tira de paradas, una por carta colocada, con su época y su
// dato en corto.
//
// La línea temporal es más ancha que cualquier móvil. Cada carta ocupa 174 px y cada
// hueco 54, así que en una pantalla de 390 no caben ni dos: en una partida avanzada,
// buscar dónde va la tuya es desplazarse a ciegas de un extremo a otro sin ver nunca el
// conjunto. Y no se arregla encogiendo las cartas, porque los huecos son botones y por
// debajo de 44 px dejan de ser pulsables con el dedo.
//
// Por eso el mapa no coloca nada: solo enseña de un vistazo qué años hay puestos y lleva
// la línea hasta el que elijas. Las cartas y los huecos siguen con su tamaño de siempre.
//
// Las paradas se colocan a escala real dentro del rango que abarcan las cartas puestas,
// no repartidas a partes iguales: así se ve la forma de verdad de la línea, con sus
// racimos apretados y sus huecos de siglos, que es justo lo que un índice a partes
// iguales no puede enseñar. Pero a escala real dos paradas seguidas pueden caer
// prácticamente encima si sus cartas están muy cerca en el tiempo, y por debajo de 44 px
// un botón deja de ser pulsable con el dedo — así que, tras calcular la posición
// proporcional de cada una, se empuja hacia la derecha a la que quede demasiado cerca de
// la anterior. El orden nunca cambia, la tira solo se alarga donde hace falta.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  // Con cuatro cartas o menos la línea ya cabe casi entera y el mapa sobra.
  const MINIMO = 5;
  const ANCHO_PARADA = 44;

  function timelineMap(modeKey, cards) {
    if (cards.length < MINIMO) return "";
    const valores = cards.map(card => CT.sortValue(modeKey, card));
    const minimo = Math.min(...valores), maximo = Math.max(...valores);
    const rango = maximo - minimo || 1;
    // El lienzo de partida es tan ancho como si las paradas ya fueran a partes iguales;
    // a partir de ahí, solo crece si un racimo lo necesita.
    const lienzo = Math.max(320, cards.length * ANCHO_PARADA);
    let anterior = -Infinity;
    const paradas = cards.map((card, i) => {
      const era = CT.eraForCard(modeKey, card);
      const nombre = `${card.title}, ${CT.formatValue(modeKey, card)}`;
      const proporcional = ((valores[i] - minimo) / rango) * (lienzo - ANCHO_PARADA);
      const izquierda = Math.max(proporcional, anterior + ANCHO_PARADA);
      anterior = izquierda;
      return { izquierda, html: `<button class="map-stop era-${era.key}" style="left:${izquierda}px" data-goto="${i}" data-id="${card.id}" aria-label="Ir a ${CT.escapeHtml(nombre)}"><span>${CT.escapeHtml(CT.shortValue(modeKey, card))}</span></button>` };
    });
    const anchoTotal = Math.max(lienzo, paradas[paradas.length - 1].izquierda + ANCHO_PARADA);
    // +36: el relleno lateral de 18px a cada lado, que con box-sizing: border-box cuenta
    // dentro del ancho y si no se suma le roba sitio a la última parada.
    return `<div class="timeline-map" role="group" aria-label="Recorrer la línea: ${cards.length} cartas colocadas" style="width:${anchoTotal + 36}px;min-width:100%">${paradas.map(p => p.html).join("")}</div>`;
  }

  // Llevar la línea hasta una carta no necesita saber nada de la partida, así que se
  // resuelve aquí y ningún motor tiene que enterarse.
  document.addEventListener("click", event => {
    const parada = event.target.closest("[data-goto]");
    if (!parada) return;
    const wrap = document.querySelector(".timeline-wrap");
    const carta = wrap?.querySelectorAll(".timeline-card")[Number(parada.dataset.goto)];
    if (!carta) return;
    // Con rectángulos y no con offsetLeft: la carta no cuelga del contenedor que se
    // desplaza, así que su offsetLeft se mide desde otro sitio.
    const caja = carta.getBoundingClientRect();
    const marco = wrap.getBoundingClientRect();
    wrap.scrollBy({ left: caja.left - marco.left - (marco.width - caja.width) / 2, behavior: "smooth" });
  });

  CT.timelineMap = timelineMap;
})();
