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
  // estropear el orden de las superficies y poblaciones seleccionadas. Los ejes de
  // animales tienen su propio formato; pueden existir empates reales.
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

  function compactMass(value) {
    if (value < 0.001) return `${Math.round(value * 1e6).toLocaleString("es-ES")} mg`;
    if (value < 1) return `${Math.round(value * 1000).toLocaleString("es-ES")} g`;
    if (value < 1000) return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg`;
    const tonnes = value / 1000;
    const decimals = tonnes >= 100 ? 0 : tonnes >= 10 ? 0 : 1;
    return `${tonnes.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} t`;
  }

  function compactDistance(value) {
    return `${Math.round(value).toLocaleString("es-ES")} km`;
  }

  function compactLifespan(value) {
    const dias = value * 365;
    // Hay vidas adultas que se miden en minutos. Redondearlas a días las enseñaba como
    // «0 días», así que la escala baja hasta donde llega el dato en vez de aplastarlo.
    if (dias < 1) {
      const horas = dias * 24;
      if (horas < 1) return `${Math.round(horas * 60)} min`;
      return `${horas.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;
    }
    if (value < 1 / 12) {
      const enteros = Math.round(dias);
      return `${enteros} ${enteros === 1 ? "día" : "días"}`;
    }
    if (value < 1) {
      const meses = Math.round(value * 12);
      return `${meses} ${meses === 1 ? "mes" : "meses"}`;
    }
    return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} años`;
  }

  function compactSpeed(value) {
    // Hay animales que se miden en centímetros por minuto. En km/h el redondeo los
    // enseñaba como «0», así que por debajo de 0,01 la escala baja a metros por hora.
    if (value < 0.01) {
      const metros = value * 1000;
      return `${metros.toLocaleString("es-ES", { maximumFractionDigits: metros < 1 ? 2 : 1 })} m/h`;
    }
    const decimals = value < 1 ? 3 : 2;
    return `${value.toLocaleString("es-ES", { maximumFractionDigits: decimals })} km/h`;
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
    },
    mass: {
      sortValue: card => card.value,
      format: card => compactMass(card.value),
      shortValue: card => compactMass(card.value),
      hiddenLabel: "Peso oculto",
      timelineTitle: "De más ligero a más pesado",
      question: "¿Más ligero o más pesado?",
      bands: [
        { limit: 0.01, key: "microscopico", name: "Minúsculo", symbol: "·" },
        { limit: 1, key: "pequenisimo", name: "Muy pequeño", symbol: "▪" },
        { limit: 10, key: "ligero", name: "Ligero", symbol: "◈" },
        { limit: 100, key: "medianoanimal", name: "Mediano", symbol: "◆" },
        { limit: 1000, key: "grananimal", name: "Grande", symbol: "★" },
        { limit: 10000, key: "giganteanimal", name: "Gigante", symbol: "⬢" },
        { limit: Infinity, key: "colosal", name: "Colosal", symbol: "◉" }
      ]
    },
    lifespan: {
      sortValue: card => card.value,
      format: card => compactLifespan(card.value),
      shortValue: card => compactLifespan(card.value),
      hiddenLabel: "Vida oculta",
      timelineTitle: "De menos a más longevos",
      question: "¿Vive menos o más?",
      bands: [
        { limit: 1, key: "fugaz", name: "Fugaz", symbol: "·" },
        { limit: 10, key: "breve", name: "Breve", symbol: "▪" },
        { limit: 50, key: "duradero", name: "Duradero", symbol: "◈" },
        { limit: 100, key: "veterano", name: "Veterano", symbol: "◆" },
        { limit: 300, key: "centenario", name: "Centenario", symbol: "★" },
        { limit: Infinity, key: "milenario", name: "Milenario", symbol: "◉" }
      ]
    },
    speed: {
      sortValue: card => card.value,
      format: card => compactSpeed(card.value),
      shortValue: card => compactSpeed(card.value),
      hiddenLabel: "Velocidad oculta",
      timelineTitle: "De más lento a más rápido",
      question: "¿Más lento o más rápido?",
      bands: [
        { limit: 1, key: "pausado", name: "Pausado", symbol: "·" },
        { limit: 20, key: "tranquilo", name: "Tranquilo", symbol: "▪" },
        { limit: 70, key: "veloz", name: "Veloz", symbol: "◈" },
        { limit: 130, key: "rapido", name: "Rápido", symbol: "◆" },
        { limit: 200, key: "fulgurante", name: "Fulgurante", symbol: "★" },
        { limit: Infinity, key: "vertiginoso", name: "Vertiginoso", symbol: "◉" }
      ]
    },
    distance: {
      sortValue: card => card.value,
      format: card => compactDistance(card.value),
      shortValue: card => compactDistance(card.value),
      hiddenLabel: "Distancia oculta",
      timelineTitle: "De más cerca a más lejos",
      question: "¿Más cerca o más lejos?",
      bands: [
        { limit: 100, key: "cercana", name: "Cercana", symbol: "·" },
        { limit: 500, key: "regional", name: "Regional", symbol: "▪" },
        { limit: 2000, key: "nacional", name: "Entre países cercanos", symbol: "◈" },
        { limit: 6000, key: "continental", name: "Intercontinental", symbol: "◆" },
        { limit: 12000, key: "oceanica", name: "Transoceánica", symbol: "★" },
        { limit: Infinity, key: "antipoda", name: "Casi antípoda", symbol: "⬢" }
      ]
    }
  };

  // Las bandas de Historia mundial, aparte: son la periodización más general de las
  // modalidades por fecha, así que «Gran mezcla» las reutiliza en vez de llevar su
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
    // Todos los mazos cronológicos comparten el eje del tiempo
    // del tiempo aunque estén en bloques distintos, así que mezclarlas es concatenar sus
    // mazos: ninguna carta cambia y `eraForCard` sigue funcionando igual porque las
    // bandas de esta modalidad son las mismas que las de Historia mundial (`WORLD_BANDS`),
    // el mazo con la periodización más general de los cuatro.
    mixed: {
      key: "mixed", name: "Gran mezcla temporal",
      cardLabel: "hitos", blurb: "Todos los mazos de línea temporal, juntos.",
      cards: [
        ...window.HISTORY_CARDS, ...window.WORLD_CARDS, ...window.INVENTION_CARDS,
        ...window.MOVIE_CARDS, ...window.MUSIC_CARDS, ...window.VIDEOGAME_CARDS,
        ...window.ASTRONOMY_CARDS, ...window.MEDICINE_CARDS
      ],
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
    music: {
      key: "music", name: "Hitos de la música",
      cardLabel: "hitos", blurb: "De Monteverdi al streaming.", cards: window.MUSIC_CARDS,
      axis: "time",
      bands: [
        { limit: 1750, key: "barroco", name: "Barroco", symbol: "♫" },
        { limit: 1820, key: "clasica", name: "Clasicismo", symbol: "♩" },
        { limit: 1900, key: "romantica", name: "Romanticismo y grabación", symbol: "♪" },
        { limit: 1950, key: "electrica", name: "Radio y sonido eléctrico", symbol: "⚡" },
        { limit: 1980, key: "popular", name: "Música popular", symbol: "★" },
        { limit: 2000, key: "videoclip", name: "Era del videoclip", symbol: "▶" },
        { limit: Infinity, key: "streaming", name: "Era digital", symbol: "⌁" }
      ]
    },
    videogames: {
      key: "videogames", name: "Historia de los videojuegos",
      cardLabel: "juegos", blurb: "Del laboratorio a los mundos abiertos.", cards: window.VIDEOGAME_CARDS,
      axis: "time",
      bands: [
        { limit: 1972, key: "laboratorio", name: "Pioneros", symbol: "⌨" },
        { limit: 1983, key: "arcade", name: "Era arcade", symbol: "●" },
        { limit: 1990, key: "ochobits", name: "Consolas de 8 y 16 bits", symbol: "◆" },
        { limit: 2000, key: "tresd", name: "Salto a las 3D", symbol: "△" },
        { limit: 2010, key: "online", name: "Juego conectado", symbol: "◎" },
        { limit: Infinity, key: "actual", name: "Juego actual", symbol: "✦" }
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
    astronomy: {
      key: "astronomy", name: "Astronomía y espacio",
      cardLabel: "hitos", blurb: "De Copérnico al otro lado de la Luna.", cards: window.ASTRONOMY_CARDS,
      axis: "time",
      bands: [
        { limit: 1700, key: "revolucion", name: "Revolución astronómica", symbol: "☉" },
        { limit: 1900, key: "telescopio", name: "Universo telescópico", symbol: "◉" },
        { limit: 1957, key: "cosmologia", name: "Nueva física", symbol: "∞" },
        { limit: 1970, key: "carreraespacial", name: "Carrera espacial", symbol: "▲" },
        { limit: 1990, key: "sondas", name: "Sondas y estaciones", symbol: "✦" },
        { limit: 2010, key: "observatorios", name: "Nuevos observatorios", symbol: "✧" },
        { limit: Infinity, key: "espacioactual", name: "Exploración actual", symbol: "◍" }
      ]
    },
    medicine: {
      key: "medicine", name: "Historia de la medicina",
      cardLabel: "hitos", blurb: "De Hipócrates a la edición genética.", cards: window.MEDICINE_CARDS,
      axis: "time",
      bands: [
        { limit: 1500, key: "medicinaantigua", name: "Medicina antigua", symbol: "⚕" },
        { limit: 1800, key: "anatomia", name: "Anatomía y observación", symbol: "◉" },
        { limit: 1900, key: "microbios", name: "Cirugía y microbios", symbol: "✚" },
        { limit: 1950, key: "terapias", name: "Primeras terapias modernas", symbol: "⚗" },
        { limit: 1980, key: "tecnologia", name: "Medicina tecnológica", symbol: "◆" },
        { limit: 2000, key: "molecular", name: "Medicina molecular", symbol: "⌬" },
        { limit: Infinity, key: "genomica", name: "Era genómica", symbol: "∞" }
      ]
    },
    animals: {
      key: "animals", name: "Peso de animales",
      cardLabel: "animales", blurb: "Masas de referencia; consulta el sexo y el rango.", cards: window.ANIMAL_WEIGHT_CARDS,
      axis: "mass"
    },
    lifespan: {
      key: "lifespan", name: "Longevidad de animales",
      cardLabel: "animales", blurb: "Edades de referencia, con contexto y casos en revisión.", cards: window.ANIMAL_LIFESPAN_CARDS,
      axis: "lifespan"
    },
    speed: {
      key: "speed", name: "Velocidad de animales",
      cardLabel: "animales", blurb: "Movimiento y medición indicados; hay datos en revisión.", cards: window.ANIMAL_SPEED_CARDS,
      axis: "speed"
    },
    countries: {
      key: "countries", name: "Superficie de países",
      cardLabel: "países", blurb: "Del Vaticano a Rusia.", cards: window.COUNTRY_CARDS,
      axis: "area"
    },
    population: {
      key: "population", name: "Población de países",
      cardLabel: "países", blurb: "Proyección ONU a 1 de julio de 2026.", cards: window.POPULATION_CARDS,
      axis: "population"
    },
    distances: {
      key: "distances", name: "Distancias entre ciudades",
      cardLabel: "pares", blurb: "En línea recta, de París a Auckland.", cards: window.CITY_DISTANCE_CARDS,
      axis: "distance"
    }
  };

  // Los juegos se agrupan en bloques. La portada enseña el bloque y no el juego, así que
  // añadir uno nuevo es declararlo aquí y sumarlo a `games`.
  //
  // «Gran mezcla» es un bloque más, pero no temático: agrupa por eje del tiempo en vez de
  // por tema, con todos los mazos cronológicos a la vez dentro.
  //
  // La clave de cada juego viaja en el documento de la sala compartida, así que cambiar
  // una rompe las partidas en curso de ese juego. Añadir juegos, en cambio, ya no obliga
  // a tocar `firestore.rules`: dejaron de llevar dentro la lista.
  const BLOCKS = {
    historia: { key: "historia", name: "Historia", icon: "🏛️", art: "history", tagline: "Ordena el pasado.", games: ["history", "world", "inventions"] },
    cine: { key: "cine", name: "Entretenimiento", icon: "🎭", art: "entertainment", tagline: "Ordena la cultura popular.", games: ["movies", "music", "videogames"] },
    ciencia: { key: "ciencia", name: "Ciencia", icon: "🔬", art: "science", tagline: "Ordena los descubrimientos.", games: ["astronomy", "medicine"] },
    naturaleza: { key: "naturaleza", name: "Naturaleza", icon: "🦋", art: "nature", tagline: "Ordena la vida.", games: ["animals", "lifespan", "speed"] },
    geografia: { key: "geografia", name: "Geografía", icon: "🌍", art: "globe", tagline: "Ordena el mundo.", games: ["countries", "population", "distances"] },
    mezcla: { key: "mezcla", name: "Gran mezcla temporal", icon: "⏳", art: "mixed", tagline: "Solo mazos de línea temporal.", games: ["mixed"] }
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

  // La guía se comparte entre los motores local y multijugador. El primer bloque explica
  // el mazo abierto; el segundo cambia según la forma de jugar, para no presentar como
  // regla universal una función que solo existe en solitario o en una sala compartida.
  function guideMarkup(modeKey, context = "local", { pulse = false } = {}) {
    const selectedMode = mode(modeKey);
    const datum = hiddenLabel(modeKey).replace(/\s+oculta$/i, "").toLowerCase();
    const order = selectedMode.axis === "time" ? "de antes a después" : "de menor a mayor";
    const pending = cards(modeKey).some(card => card.reviewStatus === "pending");
    const shared = context === "local" || context === "online";
    const pulseGuide = shared ? `<section class="guide-section"><h3>⚡ Carta Pulso ${pulse ? "activa" : "opcional"}</h3><p>${pulse ? "El mazo esconde de 1 a 3 Pulsos según los jugadores, con el mismo reparto 50/50 que Fantasma." : "El anfitrión puede incluir Cartas Pulso antes de empezar."} Si la encuentras, se guarda en privado fuera de la mano y puedes lanzarla cuando te convenga. Necesitas al menos dos cartas y eliges a otra persona. El mazo saca una carta que no eliges: si aciertas, le pasas una carta tuya al azar; si fallas, robas tú una. Quien recibe carta queda protegido hasta la siguiente ronda.</p></section>` : "";
    const ghostGuide = shared ? `<section class="guide-section"><h3>◌ Carta Fantasma</h3><p>El mazo incluye 1 Fantasma con 2–3 jugadores, 2 con 4–6 y 3 con 7–9. Puede acompañar una carta del reparto o de un robo, sin sustituir la penalización. Cada uno se sortea al 50 % entre las primeras 12 cartas por jugador y al 50 % entre todo el mazo; puede quedar al final sin descubrirse. Se guarda en privado, aparte de la mano y de su contador: no cuenta para ganar y cada persona puede usarlo una vez. Si encuentras otro, se recoloca al azar entre las cartas pendientes sin Fantasma; si no queda sitio, se consume sin otro uso. Con cinco cartas en el tablero, actívala antes de colocar en tu turno. Todos jugáis sin valores durante una vuelta, incluido quien la activa. Al resolver se enseña solo el valor de la carta jugada. No se acumulan Fantasmas: entre dos debe pasar una vuelta con valores visibles. No puedes activar Fantasma y lanzar Pulso en el mismo turno.</p></section>` : `<section class="guide-section"><h3>Dificultad</h3><p>Fácil: valores visibles, sin cartas automáticas. Normal: una carta automática por turno. Difícil: dos y turnos Fantasma ocasionales. Experto: dos y tablero siempre oculto. Las incorporaciones automáticas van en su sitio correcto, no dan puntos y nunca consumen la siguiente carta que debes jugar. Los valores se enseñan al resolver tu carta. La partida libre guarda una marca por dificultad. El reto diario mantiene Fácil y las mismas quince cartas para todos.</p></section>`;
    const contextGuide = context === "solo"
      ? `<section class="guide-section"><h3>Jugar en solitario</h3><p>Tienes tres vidas: cada fallo consume una. El reto diario propone las mismas 15 cartas a todo el mundo y solo admite un intento al día; puedes compartir el resultado sin revelar cartas. La partida libre usa todo el mazo, guarda tu mejor marca y se puede continuar más tarde. Al final, «Ver lo que se falló» permite repasarlas.</p></section>`
      : context === "competition"
        ? `<section class="guide-section"><h3>🏆 Competición</h3><p>Juegas cinco cartas de cada tema en un orden al azar, sin repetir temas. Cada ronda empieza con tres vidas nuevas y los aciertos se acumulan. La competición no se guarda si sales o cierras la aplicación a mitad.</p></section>`
        : context === "online"
          ? `<section class="guide-section"><h3>Varios móviles</h3><p>Requiere conexión durante la partida. El anfitrión crea la sala, comparte código, enlace o QR, y elige de una a seis cartas, quién empieza y el Pulso. Puede saltar un turno si alguien se desconecta. Si una persona sale, sus cartas vuelven al mazo; el anfitrión puede cerrar la sala para todos.</p></section>`
          : `<section class="guide-section"><h3>Un solo móvil</h3><p>De 2 a 9 personas se pasan el teléfono en cada turno. Elegid de una a seis cartas por persona y quién comienza; por defecto, empieza la persona más joven.</p></section>`;
    return `<div class="eyebrow">Guía del juego · ${escapeHtml(selectedMode.name)}</div><h2>Cómo se juega</h2><section class="guide-section"><h3>Objetivo</h3><p>Coloca las cartas en una sola línea, ordenadas ${order}. El ${escapeHtml(datum)} no se ve hasta confirmar la jugada.</p></section><section class="guide-section"><h3>Tu jugada</h3><p>Toca una carta y un hueco, o arrástrala hasta él. Confirma la posición antes de revelar. Un acierto queda en la línea; un fallo se descarta y, en una partida compartida, robas otra carta si queda alguna.</p><p>Si dos cartas tienen exactamente el mismo valor, cualquiera de los dos órdenes es válido.</p>${pending ? `<p>Las cartas «en revisión» siguen siendo jugables con el valor mostrado, pero señalan que su referencia está pendiente de contraste.</p>` : ""}</section>${shared ? `<section class="guide-section"><h3>Final de la partida</h3><p>La victoria se comprueba al acabar una ronda completa. Gana quien sea la única persona sin cartas; si varias terminan a cero, reciben una carta para desempatar. Si no quedan cartas para repartir, comparten la victoria.</p></section>` : ""}${pulseGuide}${ghostGuide}${contextGuide}`;
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
    correctIndex, placementHint, guideMarkup,
    escapeHtml, initials, shuffle
  };
})();
