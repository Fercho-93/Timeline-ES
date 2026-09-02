// La enciclopedia deja consultar cualquier mazo fuera de partida: valor, época y
// explicación de cada carta, sin esperar a fallarla para conocerla. Es solo lectura y
// solo lógica pura de filtrado — la pantalla que la usa vive en app.js, igual que
// `ghost.js` da la aritmética de los poderes y deja la pantalla a quien la pide.
(function () {
  "use strict";

  const CT = window.CONTINUUM;

  // Comparación sin tildes ni mayúsculas: quien busca «cordoba» debe encontrar «Córdoba».
  function normalize(text) {
    return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Las bandas de una modalidad son las suyas propias si las declara, o si no las de su
  // eje — el mismo criterio que ya usa `eraForCard` en modes.js.
  function bands(modeKey) {
    const mode = CT.mode(modeKey);
    return mode.bands || CT.axis(modeKey).bands;
  }

  function matches(modeKey, card, query) {
    if (!query) return true;
    const texto = normalize(`${card.title} ${card.detail} ${card.source || ""}`);
    return texto.includes(query);
  }

  function filterCards(modeKey, { query = "", band = "all" } = {}) {
    const q = normalize(query.trim());
    return CT.cards(modeKey)
      .filter(card => band === "all" || CT.eraForCard(modeKey, card).key === band)
      .filter(card => matches(modeKey, card, q))
      .slice()
      .sort((a, b) => CT.sortValue(modeKey, a) - CT.sortValue(modeKey, b));
  }

  // Igual que las cartas de la partida, pero siempre reveladas y con la fuente cuando la
  // carta la lleva: aquí no hay nada que ocultar hasta confirmar una jugada.
  function cardMarkup(modeKey, card, { highlight = false } = {}) {
    const era = CT.eraForCard(modeKey, card);
    const fuente = card.source
      ? `<p class="enc-source"><a href="${CT.escapeHtml(card.source)}" target="_blank" rel="noopener noreferrer">Fuente <span aria-hidden="true">↗</span><span class="solo-lectores"> (se abre en una pestaña nueva)</span></a></p>`
      : "";
    return `<article class="timeline-card enc-card${highlight ? " enc-card-highlight" : ""}" data-enc-card="${card.id}"><div class="card-visual era-${era.key}"><span>${era.symbol}</span><small>${era.name}</small></div><div class="card-content"><div class="year">${CT.formatValue(modeKey, card)}</div><h3>${CT.escapeHtml(card.title)}</h3><p>${CT.escapeHtml(card.detail)}</p>${fuente}</div></article>`;
  }

  function resultsMarkup(modeKey, cards, { highlight = null } = {}) {
    if (!cards.length) return `<p class="enc-empty">Ninguna carta coincide con la búsqueda.</p>`;
    const mode = CT.mode(modeKey);
    return `<div class="review-grid enc-grid" role="group" aria-label="Cartas de ${CT.escapeHtml(mode.name)}">${cards.map(card => cardMarkup(modeKey, card, { highlight: highlight === card.id })).join("")}</div>`;
  }

  CT.Enciclopedia = { bands, filterCards, cardMarkup, resultsMarkup };
})();
