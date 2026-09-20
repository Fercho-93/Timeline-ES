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
  // Cuántas cartas se pintan de golpe en el catálogo antes de dejar los mazos plegados.
  const MAX_ABIERTAS = 120;

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
      ? `<span class="enc-sello">${CANDADO}<span class="solo-lectores">Lámina por descubrir (bloqueada). Juega esta carta para verla.</span></span>`
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
  function catalogGroups(query = "", { lock = "all", descubiertas = null } = {}) {
    // Las ya colocadas en su temática, para no repetirlas cuando otra las reutilice.
    const puestas = new Set();
    // Y una sola lectura de las descubiertas para los treinta y pico mazos de abajo.
    const vistas = lock === "all" ? null : (descubiertas || seen());
    // Un mazo cerrado no enseña sus cartas: las cartas son justo lo que se vendería, y
    // un álbum que las enseña todas gratis deja la compra sin sentido. Que exista ya se
    // ve en la portada, con su candado. Esto no toca el progreso de nadie: lo que se
    // descubrió sigue descubierto, solo deja de poder consultarse.
    return Object.values(CT.BLOCKS).map(block => ({
      ...block,
      decks: block.games.filter(key => key !== 'mixed' && CT.Cartera.tiene(key)).map(key => ({
        key, name: CT.mode(key).name,
        cards: filterCards(key, { query, lock, descubiertas: vistas }).filter(card => {
          if (puestas.has(card.id)) return false;
          puestas.add(card.id);
          return true;
        })
      })).filter(deck => deck.cards.length)
    })).filter(block => block.decks.length);
  }

  // `seen` conserva el orden en que se descubrió cada carta. Se recorre al revés y se
  // resuelve contra su mazo original para abrir el álbum con las últimas láminas, no con
  // una lista administrativa de filtros. Gran mezcla no duplica aquí sus cartas.
  function recentDiscoveries(limit = 6) {
    const ids = (CT.Progreso?.read?.().seen || []).slice().reverse();
    if (!ids.length) return [];
    const origin = new Map();
    for (const block of Object.values(CT.BLOCKS)) for (const modeKey of block.games) {
      if (modeKey === "mixed" || !CT.Cartera.tiene(modeKey)) continue;
      for (const card of CT.cards(modeKey)) if (!origin.has(card.id)) origin.set(card.id, { modeKey, card });
    }
    return ids.map(id => origin.get(id)).filter(item => item && CT.cardArt(item.modeKey, item.card)).slice(0, limit);
  }

  function recentMarkup(limit = 6) {
    const latest = recentDiscoveries(limit);
    return `<section class="enc-recent" aria-labelledby="enc-recent-title"><div class="enc-album-heading"><div><span>Recién incorporadas</span><h2 id="enc-recent-title">Últimos descubrimientos</h2></div><small>${latest.length ? `${latest.length} láminas` : "Tu álbum empieza aquí"}</small></div>${latest.length
      ? `<div class="enc-recent-strip">${latest.map(({modeKey, card}) => `<article class="enc-recent-card"><div class="enc-recent-art">${CT.animalArt(modeKey, card)}</div><div><small>${CT.escapeHtml(CT.mode(modeKey).name)}</small><b>${CT.escapeHtml(card.title)}</b><span>${CT.formatValue(modeKey, card)}</span></div></article>`).join("")}</div>`
      : `<div class="enc-recent-empty"><span aria-hidden="true">✦</span><p>Juega una carta con ilustración para colocar tu primera lámina.</p></div>`}</section>`;
  }

  const COVER = { history:"hero-history", entertainment:"hero-entertainment", science:"hero-science", nature:"hero-nature", globe:"hero-geography", mixed:"hero-mixed" };
  function deckCover(block, index) {
    const file = COVER[block.art] || COVER.history;
    return `<span class="enc-deck-cover" style="--cover-position:${18 + (index % 4) * 21}%" aria-hidden="true"><img src="assets/${file}-400.webp" alt="" width="400" height="560" loading="lazy" decoding="async"><i>${block.icon}</i></span>`;
  }

  function catalogMarkup(query = "", { lock = "all" } = {}) {
    // Una sola lectura de las descubiertas para todo el catálogo, que son treinta mazos.
    const descubiertas = seen();
    const groups = catalogGroups(query, { lock, descubiertas });
    if (!groups.length) {
      return `<p class="enc-empty">${lock === "locked" ? "No queda ninguna lámina por descubrir." : lock === "seen" ? "Todavía no has descubierto ninguna lámina." : "Ninguna carta coincide con la búsqueda."}</p>`;
    }
    // Con una búsqueda o un filtro puesto, los mazos se abren solos: si no, lo único que
    // se vería es una lista de nombres. Pero solo mientras quepan: «bloqueadas» sobre el
    // catálogo entero son casi mil cartas, y pintarlas de una vez cuesta más de un
    // segundo en un móvil modesto. Pasado el tope se enseñan los mazos con su recuento,
    // que es la misma respuesta —cuántas faltan y dónde— sin la espera.
    const encontradas = groups.reduce((suma, block) => suma + block.decks.reduce((n, deck) => n + deck.cards.length, 0), 0);
    const searching = (!!query.trim() || lock !== "all") && encontradas <= MAX_ABIERTAS;
    const plegados = !searching && (query.trim() || lock !== "all")
      ? `<p class="hint">${encontradas} cartas: son muchas para abrirlas de golpe. Despliega el mazo que quieras ver.</p>`
      : "";
    return plegados + groups.map((block, blockIndex) => `<section class="enc-topic" aria-labelledby="enc-topic-${block.key}">
      <div class="enc-topic-divider"><span>Cuaderno ${String(blockIndex + 1).padStart(2, "0")}</span><h2 id="enc-topic-${block.key}"><i aria-hidden="true">${block.icon}</i> ${CT.escapeHtml(block.name)}</h2></div>
      ${block.decks.map((deck, deckIndex) => `<details class="enc-deck" data-enc-deck="${deck.key}"${searching ? ' open data-loaded="true"' : ''}>
        <summary>${deckCover(block, deckIndex)}<span class="enc-deck-copy"><b>${CT.escapeHtml(deck.name)}</b><small>${deck.cards.length} ${deck.cards.length === 1 ? "carta" : "cartas"}${laminaResumen(deck.key, descubiertas)}</small></span><i class="enc-deck-chevron" aria-hidden="true">⌄</i></summary>
        <div class="enc-deck-cards">${searching ? resultsMarkup(deck.key, deck.cards, { descubiertas }) : ''}</div>
      </details>`).join('')}
    </section>`).join('');
  }

  CT.Enciclopedia = { bands, filterCards, cardMarkup, resultsMarkup, catalogGroups, catalogMarkup, seenProgress, recentDiscoveries, recentMarkup };
})();
