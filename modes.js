// Todo lo que define una modalidad vive aquí. Los dos motores del juego leen de este
// archivo — `app.js` para uno o varios jugadores en el mismo móvil y `online.js` para
// varios móviles — así que una modalidad se declara una sola vez y ninguno de los dos
// puede quedarse atrás.
//
// Se carga como los mazos, con una etiqueta <script> normal y antes que `app.js`, para
// que funcione igual en el script clásico y en el módulo que se descarga al entrar en
// el modo compartido.
(function () {
  "use strict";

  // Un número entero largo no dice nada: 1.476.625.576 no se lee, se mira. A partir del
  // millón se expresa en millones con tres cifras significativas. Redondear no puede
  // estropear el juego porque entre dos cartas contiguas siempre hay al menos un 8%: el
  // orden se mantiene y nunca salen dos cartas con la misma cifra.
  function compact(value) {
    if (value < 1e6) {
      if (value < 10) return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
      return Math.round(value).toLocaleString("es-ES");
    }
    const millions = value / 1e6;
    const decimals = millions >= 100 ? 0 : millions >= 10 ? 1 : 2;
    const cifra = millions.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    // «1,00 millones» no lo dice nadie; justo por encima del millón se dice «1 millón».
    return Math.round(millions * 100) === 100 ? "1 millón" : `${cifra} millones`;
  }

  // Además del dato completo, cada eje sabe decirlo en corto. Es lo que cabe en el mapa
  // de la línea, donde solo hay sitio para cuatro o cinco caracteres por carta.
  function shortMillions(value) {
    if (value >= 1e6) {
      const millones = value / 1e6;
      const cifra = millones >= 100 ? Math.round(millones) : Number(millones.toPrecision(3));
      return `${cifra.toLocaleString("es-ES")} M`;
    }
    // «402 mil» se lee de un vistazo; «402.329», en un hueco de cuarenta píxeles, no.
    if (value >= 10000) return `${Math.round(value / 1000).toLocaleString("es-ES")} mil`;
    return compact(value);
  }

  // Un eje dice cómo se ordenan las cartas, cómo se muestra el dato una vez revelado y
  // cómo se llama mientras está oculto. Es lo que permite que la línea no sea siempre
  // temporal: la de países ordena por tamaño con el mismo motor.
  const AXES = {
    time: {
      sortValue: card => card.year,
      format: card => card.label || (card.year < 0 ? `${Math.abs(card.year)} a. C.` : String(card.year)),
      shortValue: card => card.year < 0 ? `${Math.abs(card.year)} a.C.` : String(card.year),
      hiddenLabel: "Fecha oculta",
      timelineTitle: "Línea temporal",
      question: "¿Antes o después?",
      bands: [
        { limit: 711, key: "antigua", name: "Hispania antigua", symbol: "Ⅻ" },
        { limit: 1492, key: "medieval", name: "Edad Media", symbol: "♜" },
        { limit: 1700, key: "imperio", name: "Monarquía Hispánica", symbol: "✦" },
        { limit: 1808, key: "ilustracion", name: "Ilustración", symbol: "☼" },
        { limit: 1931, key: "moderna", name: "España contemporánea", symbol: "⌁" },
        { limit: 1975, key: "sigloxx", name: "Siglo XX", symbol: "◈" },
        { limit: Infinity, key: "democracia", name: "Democracia", symbol: "◎" }
      ]
    },
    population: {
      sortValue: card => card.value,
      // Con la cifra en millones el «hab.» sobra y no cabe; abajo sí aclara.
      format: card => card.value >= 1e6 ? compact(card.value) : `${compact(card.value)} hab.`,
      shortValue: card => shortMillions(card.value),
      hiddenLabel: "Población oculta",
      timelineTitle: "De menos a más",
      question: "¿Menos o más gente?",
      bands: [
        { limit: 100000, key: "minusculo", name: "Minúsculo", symbol: "·" },
        { limit: 2000000, key: "muypequeno", name: "Muy pequeño", symbol: "▪" },
        { limit: 12000000, key: "pequeno", name: "Pequeño", symbol: "◈" },
        { limit: 50000000, key: "medio", name: "Medio", symbol: "◆" },
        { limit: 150000000, key: "grande", name: "Grande", symbol: "★" },
        { limit: Infinity, key: "gigante", name: "Gigante", symbol: "⬢" }
      ]
    },
    area: {
      sortValue: card => card.value,
      // «de km²» solo cuando la cifra va en millones: «17,1 millones de km²».
      format: card => card.value >= 1e6 ? `${compact(card.value)} de km²` : `${compact(card.value)} km²`,
      shortValue: card => shortMillions(card.value),
      hiddenLabel: "Superficie oculta",
      timelineTitle: "De menor a mayor",
      question: "¿Más pequeño o más grande?",
      bands: [
        { limit: 1000, key: "diminuto", name: "Diminuto", symbol: "·" },
        { limit: 50000, key: "pequeno", name: "Pequeño", symbol: "▪" },
        { limit: 300000, key: "mediano", name: "Mediano", symbol: "◈" },
        { limit: 1000000, key: "grande", name: "Grande", symbol: "◆" },
        { limit: 5000000, key: "enorme", name: "Enorme", symbol: "★" },
        { limit: Infinity, key: "gigante", name: "Gigante", symbol: "⬢" }
      ]
    }
  };

  // Las bandas de Historia mundial, aparte: son la periodización más general de las
  // cuatro modalidades por fecha, así que «Gran mezcla» las reutiliza en vez de llevar su
  // propia copia que podría quedarse desactualizada si estas cambiaran alguna vez.
  const WORLD_BANDS = [
    { limit: 476, key: "antigua", name: "Antigüedad", symbol: "⚱" },
    { limit: 1453, key: "medieval", name: "Edad Media", symbol: "♜" },
    { limit: 1789, key: "edadmoderna", name: "Edad Moderna", symbol: "⚜" },
    { limit: 1914, key: "revoluciones", name: "Siglo de las revoluciones", symbol: "⚑" },
    { limit: 1945, key: "guerras", name: "Guerras mundiales", symbol: "✚" },
    { limit: 1991, key: "friaguerra", name: "Guerra Fría", symbol: "☢" },
    { limit: Infinity, key: "global", name: "Mundo global", symbol: "◍" }
  ];

  // Una modalidad hereda las bandas de su eje salvo que declare las suyas, como el cine:
  // comparte el eje del tiempo con la historia, pero no las mismas épocas.
  const MODES = {
    // Historia de España, Historia mundial, Inventos y Estrenos de cine comparten el eje
    // del tiempo aunque estén en bloques distintos, así que mezclarlas es concatenar sus
    // mazos: ninguna carta cambia y `eraForCard` sigue funcionando igual porque las
    // bandas de esta modalidad son las mismas que las de Historia mundial (`WORLD_BANDS`),
    // el mazo con la periodización más general de los cuatro.
    mixed: {
      key: "mixed", name: "Gran mezcla",
      cardLabel: "hechos", blurb: "Historia, mundo, inventos y cine, todo junto.",
      cards: [...window.HISTORY_CARDS, ...window.WORLD_CARDS, ...window.INVENTION_CARDS, ...window.MOVIE_CARDS],
      axis: "time",
      bands: WORLD_BANDS
    },
    history: {
      key: "history", name: "Historia de España",
      cardLabel: "hechos", blurb: "De Hispania a la democracia.", cards: window.HISTORY_CARDS,
      axis: "time"
    },
    movies: {
      key: "movies", name: "Estrenos de cine",
      cardLabel: "películas", blurb: "De Méliès a nuestros días.", cards: window.MOVIE_CARDS,
      axis: "time",
      bands: [
        { limit: 1930, key: "pioneros", name: "Cine pionero", symbol: "▥" },
        { limit: 1960, key: "clasico", name: "Cine clásico", symbol: "★" },
        { limit: 1980, key: "nuevocine", name: "Nuevo cine", symbol: "◉" },
        { limit: 2000, key: "blockbuster", name: "Era blockbuster", symbol: "◆" },
        { limit: 2010, key: "milenio", name: "Nuevo milenio", symbol: "✦" },
        { limit: Infinity, key: "actual", name: "Cine actual", symbol: "▷" }
      ]
    },
    inventions: {
      key: "inventions", name: "Inventos y descubrimientos",
      cardLabel: "inventos", blurb: "De la escritura a la edición genética.", cards: window.INVENTION_CARDS,
      axis: "time",
      bands: [
        { limit: 500, key: "antigua", name: "Mundo antiguo", symbol: "☉" },
        { limit: 1400, key: "medieval", name: "Edad Media", symbol: "♜" },
        { limit: 1700, key: "cientifica", name: "Revolución científica", symbol: "✧" },
        { limit: 1830, key: "industrial", name: "Revolución industrial", symbol: "⚙" },
        { limit: 1900, key: "electrica", name: "Era eléctrica", symbol: "⚡" },
        { limit: 1970, key: "atomica", name: "Siglo de los átomos", symbol: "⚛" },
        { limit: Infinity, key: "digital", name: "Era digital", symbol: "⌘" }
      ]
    },
    world: {
      key: "world", name: "Historia mundial",
      cardLabel: "hechos", blurb: "De los faraones a hoy.", cards: window.WORLD_CARDS,
      axis: "time",
      bands: WORLD_BANDS
    },
    countries: {
      key: "countries", name: "Superficie de países",
      cardLabel: "países", blurb: "Del Vaticano a Rusia.", cards: window.COUNTRY_CARDS,
      axis: "area"
    },
    population: {
      key: "population", name: "Población de países",
      cardLabel: "países", blurb: "Del Vaticano a la India.", cards: window.POPULATION_CARDS,
      axis: "population"
    }
  };

  // Los juegos se agrupan en bloques. La portada enseña el bloque y no el juego, así que
  // añadir uno nuevo es declararlo aquí y sumarlo a `games`.
  //
  // «Gran mezcla» es un bloque más, pero no temático: agrupa por eje del tiempo en vez de
  // por tema, con Historia y Cine a la vez dentro. Es el único bloque sin carátula
  // fotográfica —no hay una imagen que valga para «un poco de los otros tres»—, así que
  // `art: "mixed"` no aparece en `BLOCK_ART` (`app.js`) y `blockArt` lo resuelve entero
  // con CSS: el mismo icono que ya llevan todos los bloques en el lomo, sobre un fondo
  // ilustrado en vez de una fotografía.
  //
  // La clave de cada juego viaja en el documento de la sala compartida, así que cambiar
  // una rompe las partidas en curso de ese juego. Añadir juegos, en cambio, ya no obliga
  // a tocar `firestore.rules`: dejaron de llevar dentro la lista.
  const BLOCKS = {
    historia: { key: "historia", name: "Historia", icon: "🏛️", art: "history", tagline: "Ordena el pasado.", games: ["history", "world", "inventions"] },
    cine: { key: "cine", name: "Cine", icon: "🎬", art: "cinema", tagline: "Ordena la pantalla.", games: ["movies"] },
    geografia: { key: "geografia", name: "Geografía", icon: "🌍", art: "globe", tagline: "Ordena el mundo.", games: ["countries", "population"] },
    mezcla: { key: "mezcla", name: "Gran mezcla", icon: "⏳", art: "mixed", tagline: "Ordena el tiempo.", games: ["mixed"] }
  };

  const DEFAULT_MODE = "history";
  const DEFAULT_BLOCK = "historia";

  function has(modeKey) { return Object.prototype.hasOwnProperty.call(MODES, modeKey); }

  function hasBlock(blockKey) { return Object.prototype.hasOwnProperty.call(BLOCKS, blockKey); }

  function block(blockKey) { return hasBlock(blockKey) ? BLOCKS[blockKey] : BLOCKS[DEFAULT_BLOCK]; }

  // De un juego a su bloque, para saber qué carátula toca desde una partida guardada.
  function blockOf(modeKey) {
    return Object.values(BLOCKS).find(item => item.games.includes(modeKey)) || BLOCKS[DEFAULT_BLOCK];
  }

  function blockGames(blockKey) { return block(blockKey).games.map(mode); }

  // Una modalidad desconocida cae en la de historia: llega de `localStorage` o del
  // documento de una sala, y ninguno de los dos es de fiar.
  function mode(modeKey) { return has(modeKey) ? MODES[modeKey] : MODES[DEFAULT_MODE]; }

  function axis(modeKey) { return AXES[mode(modeKey).axis]; }

  function cards(modeKey) { return mode(modeKey).cards; }

  function formatValue(modeKey, card) { return axis(modeKey).format(card); }

  // El dato en corto, para el mapa de la línea.
  function shortValue(modeKey, card) { return axis(modeKey).shortValue(card); }

  function sortValue(modeKey, card) { return axis(modeKey).sortValue(card); }

  function hiddenLabel(modeKey) { return axis(modeKey).hiddenLabel; }

  function timelineTitle(modeKey) { return axis(modeKey).timelineTitle; }

  function question(modeKey) { return axis(modeKey).question; }

  function eraForCard(modeKey, card) {
    const bands = mode(modeKey).bands || axis(modeKey).bands;
    const value = sortValue(modeKey, card);
    return bands.find(band => value < band.limit) || bands[bands.length - 1];
  }

  // Dónde iba de verdad una carta fallada: el hueco más a la izquierda de todos los que
  // habrían sido válidos. Con empates —dos cartas con el mismo valor— hay más de un
  // hueco correcto, y `placeCard` los acepta todos; este es solo el que se señala.
  function correctIndex(modeKey, timelineCards, card) {
    const value = sortValue(modeKey, card);
    const index = timelineCards.findIndex(other => sortValue(modeKey, other) > value);
    return index === -1 ? timelineCards.length : index;
  }

  // La frase que explica dónde iba, para el aviso de fallo: quien juega con lector de
  // pantalla no puede simplemente «ver» el hueco resaltado en la línea.
  function placementHint(modeKey, timelineCards, card) {
    const index = correctIndex(modeKey, timelineCards, card);
    const before = timelineCards[index - 1];
    const after = timelineCards[index];
    if (!before && !after) return "Era la única carta de la línea.";
    if (!before) return `Iba al principio, antes de «${escapeHtml(after.title)}».`;
    if (!after) return `Iba al final, después de «${escapeHtml(before.title)}».`;
    return `Iba entre «${escapeHtml(before.title)}» y «${escapeHtml(after.title)}».`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  window.CONTINUUM = {
    MODES, BLOCKS, DEFAULT_MODE, DEFAULT_BLOCK,
    has, mode, axis, cards,
    hasBlock, block, blockOf, blockGames,
    formatValue, shortValue, sortValue, hiddenLabel, timelineTitle, question, eraForCard,
    correctIndex, placementHint,
    escapeHtml, initials, shuffle
  };
})();
