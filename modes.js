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

  function formatArea(value) {
    if (value < 10) return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
    return Math.round(value).toLocaleString("es-ES");
  }

  // Un eje dice cómo se ordenan las cartas, cómo se muestra el dato una vez revelado y
  // cómo se llama mientras está oculto. Es lo que permite que la línea no sea siempre
  // temporal: la de países ordena por tamaño con el mismo motor.
  const AXES = {
    time: {
      sortValue: card => card.year,
      format: card => card.label || (card.year < 0 ? `${Math.abs(card.year)} a. C.` : String(card.year)),
      hiddenLabel: "Fecha oculta",
      timelineTitle: "Línea temporal",
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
    area: {
      sortValue: card => card.value,
      format: card => `${formatArea(card.value)} km²`,
      hiddenLabel: "Superficie oculta",
      timelineTitle: "De menor a mayor",
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

  // Una modalidad hereda las bandas de su eje salvo que declare las suyas, como el cine:
  // comparte el eje del tiempo con la historia, pero no las mismas épocas.
  const MODES = {
    history: {
      key: "history", name: "Historia de España", shortName: "España", icon: "🏛️",
      eyebrow: "Historia · intuición · sobremesa",
      description: "Construid una línea del tiempo de España. Escucha tu intuición, arriesga y sé la única persona que se queda sin cartas.",
      cardLabel: "hechos", caption: "De Hispania a la democracia", cards: window.HISTORY_CARDS,
      headline: "¿Antes o<br><em>después?</em>", axis: "time"
    },
    movies: {
      key: "movies", name: "Estrenos de cine", shortName: "Cine", icon: "🎬",
      eyebrow: "Cine · memoria · palomitas",
      description: "Ordenad grandes películas por su año de estreno. De los pioneros del cine a los éxitos más recientes.",
      cardLabel: "películas", caption: "De Méliès a nuestros días", cards: window.MOVIE_CARDS,
      headline: "¿Antes o<br><em>después?</em>", axis: "time",
      bands: [
        { limit: 1930, key: "pioneros", name: "Cine pionero", symbol: "▥" },
        { limit: 1960, key: "clasico", name: "Cine clásico", symbol: "★" },
        { limit: 1980, key: "nuevocine", name: "Nuevo cine", symbol: "◉" },
        { limit: 2000, key: "blockbuster", name: "Era blockbuster", symbol: "◆" },
        { limit: 2010, key: "milenio", name: "Nuevo milenio", symbol: "✦" },
        { limit: Infinity, key: "actual", name: "Cine actual", symbol: "▷" }
      ]
    },
    countries: {
      key: "countries", name: "Superficie de países", shortName: "Países", icon: "🌍",
      eyebrow: "Geografía · escala · discusión",
      description: "Ordenad países por su superficie, del más pequeño al más extenso. Nadie tiene tan claro como cree lo que ocupa cada país.",
      cardLabel: "países", caption: "Del Vaticano a Rusia", cards: window.COUNTRY_CARDS,
      headline: "¿Más pequeño o<br><em>más grande?</em>", axis: "area"
    }
  };

  const DEFAULT_MODE = "history";

  function has(modeKey) { return Object.prototype.hasOwnProperty.call(MODES, modeKey); }

  // Una modalidad desconocida cae en la de historia: llega de `localStorage` o del
  // documento de una sala, y ninguno de los dos es de fiar.
  function mode(modeKey) { return has(modeKey) ? MODES[modeKey] : MODES[DEFAULT_MODE]; }

  function axis(modeKey) { return AXES[mode(modeKey).axis]; }

  function cards(modeKey) { return mode(modeKey).cards; }

  function formatValue(modeKey, card) { return axis(modeKey).format(card); }

  function sortValue(modeKey, card) { return axis(modeKey).sortValue(card); }

  function hiddenLabel(modeKey) { return axis(modeKey).hiddenLabel; }

  function timelineTitle(modeKey) { return axis(modeKey).timelineTitle; }

  function eraForCard(modeKey, card) {
    const bands = mode(modeKey).bands || axis(modeKey).bands;
    const value = sortValue(modeKey, card);
    return bands.find(band => value < band.limit) || bands[bands.length - 1];
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

  window.HILO = {
    MODES, DEFAULT_MODE, has, mode, axis, cards,
    formatValue, sortValue, hiddenLabel, timelineTitle, eraForCard,
    escapeHtml, initials, shuffle
  };
})();
