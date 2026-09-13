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

  // Qué cartas tienen la lámina a la vista. Se pide una vez por pantalla y se pasa a cada
  // tarjeta, en vez de consultarlo carta a carta: la enciclopedia pinta cientos de golpe.
  function seen() {
    return CT.Progreso?.seenCards?.() || new Set();
  }

  // Igual que las cartas de la partida, pero siempre reveladas y con la fuente cuando la
  // carta la lleva: el valor, la época y la explicación se leen sin haber jugado nunca.
  //
  // Lo único que se gana jugando es la lámina: hasta que la carta pasa por tu mano se ve
  // velada. La enciclopedia sigue sirviendo para consultar —que es para lo que está—,
  // pero las ilustraciones se descubren, que es lo que invita a volver a ella.
  function cardMarkup(modeKey, card, { highlight = false, descubiertas = null } = {}) {
    const era = CT.eraForCard(modeKey, card);
    const art = CT.animalArt(modeKey, card);
    const velada = !!art && !(descubiertas || seen()).has(card.id);
    const visual = art
      ? `${art}${velada ? '<span class="enc-veil"><b aria-hidden="true">◌</b><small>Descúbrela jugándola</small></span>' : ""}`
      : `<span>${era.symbol}</span><small>${era.name}</small>`;
    const fuente = card.source
      ? `<p class="enc-source"><a href="${CT.escapeHtml(card.source)}" target="_blank" rel="noopener noreferrer">Fuente <span aria-hidden="true">↗</span><span class="solo-lectores"> (se abre en una pestaña nueva)</span></a></p>`
      : "";
    return `<article class="timeline-card enc-card${art ? " enc-card-illustrated" : ""}${velada ? " enc-card-velada" : ""}${highlight ? " enc-card-highlight" : ""}" data-enc-card="${card.id}"><div class="card-visual era-${era.key}">${visual}</div><div class="card-content">${CT.categoryBadge(modeKey, card)}${art ? `<div class="enc-era">${era.symbol} ${CT.escapeHtml(era.name)}</div>` : ""}<div class="year">${CT.formatValue(modeKey, card)}</div><h3>${CT.escapeHtml(card.title)}</h3><p>${CT.escapeHtml(card.detail)}</p>${fuente}</div></article>`;
  }

  function resultsMarkup(modeKey, cards, { highlight = null, descubiertas = null } = {}) {
    if (!cards.length) return `<p class="enc-empty">Ninguna carta coincide con la búsqueda.</p>`;
    const mode = CT.mode(modeKey);
    descubiertas = descubiertas || seen();
    return `<div class="review-grid enc-grid" role="group" aria-label="Cartas de ${CT.escapeHtml(mode.name)}">${cards.map(card => cardMarkup(modeKey, card, { highlight: highlight === card.id, descubiertas })).join("")}</div>`;
  }

  // Cuántas cartas de un mazo están ya descubiertas. Solo cuentan las que tienen lámina:
  // las demás no esconden nada, y meterlas en el recuento haría creer que faltan cartas
  // por descubrir en un mazo que ya está entero a la vista.
  function seenProgress(modeKey, descubiertas = seen()) {
    const conLamina = CT.cards(modeKey).filter(card => CT.animalArt(modeKey, card));
    return { total: conLamina.length, seen: conLamina.filter(card => descubiertas.has(card.id)).length };
  }

  // «· 12 de 40 láminas», o nada en un mazo sin ilustraciones.
  function laminaResumen(modeKey, descubiertas) {
    const { total, seen: vistas } = seenProgress(modeKey, descubiertas);
    return total ? ` · ${vistas} de ${total} láminas` : "";
  }

  // Gran mezcla reutiliza cartas de otros mazos: el catálogo las muestra una sola
  // vez, dentro de su temática original.
  function catalogGroups(query = "") {
    const seen = new Set();
    return Object.values(CT.BLOCKS).map(block => ({
      ...block,
      decks: block.games.filter(key => key !== 'mixed').map(key => ({
        key, name: CT.mode(key).name,
        cards: filterCards(key, {query}).filter(card => {
          if (seen.has(card.id)) return false;
          seen.add(card.id);
          return true;
        })
      })).filter(deck => deck.cards.length)
    })).filter(block => block.decks.length);
  }

  function catalogMarkup(query = "") {
    const groups = catalogGroups(query);
    if (!groups.length) return '<p class="enc-empty">Ninguna carta coincide con la búsqueda.</p>';
    const searching = !!query.trim();
    // Una sola lectura de las descubiertas para todo el catálogo, que son treinta mazos.
    const descubiertas = seen();
    return groups.map(block => `<section class="enc-topic" aria-labelledby="enc-topic-${block.key}">
      <h2 id="enc-topic-${block.key}"><span aria-hidden="true">${block.icon}</span> ${CT.escapeHtml(block.name)}</h2>
      ${block.decks.map(deck => `<details class="enc-deck" data-enc-deck="${deck.key}"${searching ? ' open data-loaded="true"' : ''}>
        <summary><span>${CT.escapeHtml(deck.name)}</span><small>${deck.cards.length} cartas${laminaResumen(deck.key, descubiertas)}</small></summary>
        <div class="enc-deck-cards">${searching ? resultsMarkup(deck.key, deck.cards, { descubiertas }) : ''}</div>
      </details>`).join('')}
    </section>`).join('');
  }

  CT.Enciclopedia = { bands, filterCards, cardMarkup, resultsMarkup, catalogGroups, catalogMarkup, seenProgress };
})();
