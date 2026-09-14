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

  // `lock` reparte por lámina: «seen» son las desbloqueadas y «locked» las que faltan. Una
  // carta sin ilustración no es ni una cosa ni la otra, así que solo sale en «all»; los
  // mazos que no tienen ninguna tampoco enseñan el filtro, y no hay dónde perderse.
  function filterCards(modeKey, { query = "", band = "all", lock = "all", descubiertas = null } = {}) {
    const q = normalize(query.trim());
    const vistas = lock === "all" ? null : (descubiertas || seen());
    return CT.cards(modeKey)
      .filter(card => band === "all" || CT.eraForCard(modeKey, card).key === band)
      .filter(card => !vistas || (!!CT.cardArt(modeKey, card) && vistas.has(card.id) === (lock === "seen")))
      .filter(card => matches(modeKey, card, q))
      .slice()
      .sort((a, b) => CT.sortValue(modeKey, a) - CT.sortValue(modeKey, b));
  }

  // Qué cartas tienen la lámina a la vista. Se pide una vez por pantalla y se pasa a cada
  // tarjeta, en vez de consultarlo carta a carta: la enciclopedia pinta cientos de golpe.
  function seen() {
    return CT.Progreso?.seenCards?.() || new Set();
  }

  // El candado del sello. Va dibujado y no como emoji: se ve igual en los dos temas, toma
  // el color de la tinta y no depende de la fuente de cada móvil.
  const CANDADO = `<svg class="enc-candado" viewBox="0 0 24 24" width="46" height="46" aria-hidden="true" focusable="false">
    <path d="M7.4 10.5V7.6a4.6 4.6 0 0 1 9.2 0v2.9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <rect x="4.3" y="10.3" width="15.4" height="11.2" rx="2.4" fill="currentColor"/>
    <circle cx="12" cy="15" r="1.6" fill="var(--enc-sello-hueco)"/>
    <path d="M12 15.9v2.4" stroke="var(--enc-sello-hueco)" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`;

  // Igual que las cartas de la partida, pero siempre reveladas y con la fuente cuando la
  // carta la lleva: el valor, la época y la explicación se leen sin haber jugado nunca.
  //
  // Lo único que se gana jugando es la lámina: hasta que la carta pasa por tu mano, en su
  // sitio hay un sello cerrado. La enciclopedia sigue sirviendo para consultar —que es
  // para lo que está—, pero las ilustraciones se descubren, que es lo que invita a volver.
  function cardMarkup(modeKey, card, { highlight = false, descubiertas = null } = {}) {
    const era = CT.eraForCard(modeKey, card);
    // `cardArt` solo dice si hay lámina; el `<img>` se monta únicamente si se va a ver.
    // Una carta bloqueada no descarga su ilustración ni la difumina: un mazo entero por
    // descubrir son cuarenta imágenes que el móvil se ahorra bajar y componer, que es
    // justo lo que dejaba la enciclopedia pesada al abrirla.
    const tieneLamina = !!CT.cardArt(modeKey, card);
    const velada = tieneLamina && !(descubiertas || seen()).has(card.id);
    // Solo el candado: en una tarjeta estrecha, el rótulo se partía en dos líneas y el
    // sello acababa pareciendo un aviso de error. Lo que dice el candado sin decirlo va
    // igualmente para quien no lo ve, en el texto que solo leen los lectores de pantalla.
    const visual = velada
      ? `<span class="enc-sello">${CANDADO}<span class="solo-lectores">Lámina bloqueada. Descúbrela jugando esta carta.</span></span>`
      : tieneLamina ? CT.animalArt(modeKey, card) : `<span>${era.symbol}</span><small>${era.name}</small>`;
    const art = tieneLamina;
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
    // Un mazo sin ilustraciones se descarta de una vez, y los demás se cuentan con
    // `cardArt`, que devuelve el nombre de la lámina: `animalArt` montaría el `<img>`
    // entero de cada carta solo para contarla, y el catálogo son casi mil.
    if (!CT.usesAnimalArt(modeKey)) return { total: 0, seen: 0 };
    const conLamina = CT.cards(modeKey).filter(card => CT.cardArt(modeKey, card));
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
