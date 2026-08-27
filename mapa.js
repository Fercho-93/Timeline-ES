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
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  // Con cuatro cartas o menos la línea ya cabe casi entera y el mapa sobra.
  const MINIMO = 5;

  function timelineMap(modeKey, cards) {
    if (cards.length < MINIMO) return "";
    const paradas = cards.map((card, i) => {
      const era = CT.eraForCard(modeKey, card);
      const nombre = `${card.title}, ${CT.formatValue(modeKey, card)}`;
      return `<button class="map-stop era-${era.key}" data-goto="${i}" aria-label="Ir a ${CT.escapeHtml(nombre)}"><span>${CT.escapeHtml(CT.shortValue(modeKey, card))}</span></button>`;
    }).join("");
    return `<div class="timeline-map" role="group" aria-label="Recorrer la línea: ${cards.length} cartas colocadas">${paradas}</div>`;
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
