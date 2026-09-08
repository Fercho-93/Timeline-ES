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
      // Cada carta se etiqueta con la modalidad de la que viene (`sourceMode`): al
      // mezclar ocho mazos distintos, el título y el año solos no bastan para ubicarse
      // —«Se estrena tal película» y «Cae tal ciudad» pueden caer en el mismo siglo—, así
      // que la carta lleva consigo de qué tema es. Se copian los objetos en vez de
      // reutilizar los del mazo original para no contaminar `history.cards` y compañía,
      // que no llevan `sourceMode` porque en su propio mazo ya se sabe de sobra el tema.
      cards: [
        ["history", window.HISTORY_CARDS], ["world", window.WORLD_CARDS], ["inventions", window.INVENTION_CARDS],
        ["movies", window.MOVIE_CARDS], ["music", window.MUSIC_CARDS], ["videogames", window.VIDEOGAME_CARDS],
        ["astronomy", window.ASTRONOMY_CARDS], ["medicine", window.MEDICINE_CARDS]
      ].flatMap(([sourceMode, deck]) => deck.map(card => ({ ...card, sourceMode }))),
      axis: "time",
      bands: WORLD_BANDS
    },
    history: {
      key: "history", name: "Historia de España", tag: "España",
      cardLabel: "hechos", blurb: "De Hispania a la democracia.", cards: window.HISTORY_CARDS,
      axis: "time"
    },
    movies: {
      key: "movies", name: "Estrenos de cine", tag: "Cine",
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
      key: "music", name: "Hitos de la música", tag: "Música",
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
      key: "videogames", name: "Historia de los videojuegos", tag: "Videojuegos",
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
      key: "inventions", name: "Inventos y descubrimientos", tag: "Inventos",
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
      key: "world", name: "Historia mundial", tag: "Mundo",
      cardLabel: "hechos", blurb: "De los faraones a hoy.", cards: window.WORLD_CARDS,
      axis: "time",
      bands: WORLD_BANDS
    },
    astronomy: {
      key: "astronomy", name: "Astronomía y espacio", tag: "Astronomía",
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
      key: "medicine", name: "Historia de la medicina", tag: "Medicina",
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
    historia: { key: "historia", name: "Historia", icon: "🏛️", art: "history", tagline: "Recorre grandes acontecimientos.", games: ["history", "world", "inventions"] },
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

  // Las láminas de los mazos de animales. No llevan cifras, así que pueden verse en la
  // mano sin revelar el peso, la longevidad o la velocidad que hay que ordenar. Un id
  // por carta y no una tabla por mazo: los tres comparten ilustraciones —el mismo león
  // pesa, vive y corre— y así no hace falta repetir la lámina en cada uno.
  //
  // Se comparte entre los dos motores —`app.js` para un móvil, `online.js` para varios—
  // para que una lámina se vea igual en los dos y una carta nueva solo se dé de alta aquí.
  const ANIMAL_ART_MODES = ["animals", "lifespan", "speed"];
  const ANIMAL_ART_BY_ID = {
    10001: "bee", 10002: "monarch-butterfly", 10003: "mantis", 10004: "green-tree-frog",
    10005: "house-mouse", 10007: "rock-pigeon", 10008: "guinea-pig", 10009: "european-hare",
    10010: "cat", 10011: "fox", 10012: "european-beaver", 10013: "iberian-lynx",
    10014: "great-dane", 10015: "gray-wolf", 10016: "capybara", 10017: "chimpanzee",
    10018: "giant-panda", 10019: "american-black-bear", 10020: "lion", 10021: "bengal-tiger",
    10022: "grevys-zebra", 10023: "domestic-horse", 10024: "alaska-moose", 10025: "american-bison",
    10026: "giraffe", 10027: "common-hippopotamus", 10028: "white-rhinoceros",
    10029: "southern-elephant-seal", 10030: "elephant", 10031: "whale-shark", 10032: "orca",
    10034: "humpback-whale", 10035: "sperm-whale", 10038: "blue-whale", 10039: "octopus",
    10040: "flamingo", 10041: "penguin", 10042: "kangaroo", 10043: "nile-crocodile",
    10044: "polar-bear", 10045: "dromedary-camel",
    12001: "dolania-mayfly", 12002: "domestic-horse", 12003: "common-mosquito",
    12004: "fruit-fly", 12005: "bee", 12006: "monarch-butterfly", 12007: "house-mouse",
    12008: "brown-rat", 12009: "domestic-hamster", 12010: "domestic-gerbil",
    12011: "guinea-pig", 12012: "european-rabbit", 12013: "european-hedgehog",
    12014: "red-squirrel", 12015: "fox", 12016: "domestic-dog", 12017: "cat",
    12018: "iberian-lynx", 12019: "komodo-dragon", 12020: "harpy-eagle",
    12021: "american-bison", 12022: "common-hippopotamus", 12023: "elephant",
    12024: "blue-whale", 12025: "galapagos-giant-tortoise", 12026: "scarlet-macaw",
    12027: "japanese-koi", 12028: "bowhead-whale", 12029: "greenland-shark",
    12030: "ocean-quahog", 12031: "black-coral", 12032: "red-sea-urchin",
    12033: "jonathan-tortoise", 12034: "freshwater-pearl-mussel",
    12035: "cookie-cockatoo", 12036: "gold-coral", 12037: "monorhaphis-chuni",
    12038: "giant-barrel-sponge",
    13001: "tiger-beetle", 13002: "ghost-crab", 13003: "sunflower-sea-star",
    13004: "galapagos-giant-tortoise", 13005: "three-toed-sloth", 13006: "dwarf-seahorse",
    13007: "koala", 13008: "black-mamba", 13009: "gentoo-penguin", 13010: "florida-manatee",
    13011: "hermit-crab", 13012: "solifuge", 13013: "australian-dragonfly", 13014: "polar-bear",
    13015: "common-hippopotamus", 13016: "elephant", 13017: "giraffe", 13018: "emu",
    13019: "spiny-tailed-iguana", 13020: "ostrich", 13021: "reindeer", 13022: "blue-wildebeest",
    13023: "american-pronghorn", 13024: "cheetah", 13025: "henslow-swimming-crab",
    13026: "brazilian-free-tailed-bat", 13027: "golden-eagle", 13028: "gyrfalcon",
    13029: "common-swift", 13030: "peregrine-falcon", 13031: "saharan-silver-ant",
    13032: "common-limpet", 13033: "california-sea-lion", 13034: "grevys-zebra",
    13035: "moroccan-flic-flac-spider", 13036: "european-mole",
    13037: "american-cockroach", 13038: "bee"
  };

  // Láminas del mazo de Astronomía y espacio, enlazadas por el ID de cada carta.
  const ASTRONOMY_ART_BY_ID = {
    8001: "copernicus-heliocentric", 8002: "tycho-supernova", 8003: "galileo-telescope", 8004: "jupiter-moons",
    8005: "kepler-third-law", 8006: "titan-discovery", 8007: "greenwich-observatory", 8008: "newton-principia",
    8009: "halley-comet", 8010: "uranus-discovery", 8011: "ceres-discovery", 8012: "stellar-parallax",
    8013: "neptune-discovery", 8014: "helium-sun", 8015: "special-relativity", 8016: "general-relativity",
    8017: "andromeda-galaxy", 8018: "expanding-universe", 8019: "pluto-discovery", 8020: "dark-matter",
    8021: "first-earth-photo", 8022: "sputnik", 8023: "luna-2",
    8024: "8024_yuri-gagarin", 8025: "8025-valentina-tereshkova", 8026: "8026-first-spacewalk",
    8027: "8027-apollo-8", 8028: "8028-apollo-11", 8029: "8029-salyut-1", 8030: "8030-pioneer-10",
    8031: "8031-viking-1", 8032: "8032-voyager", 8033: "8033-space-shuttle", 8034: "8034-giotto-halley",
    8035: "8035-hubble", 8036: "8036-first-exoplanets", 8037: "8037-sunlike-exoplanet",
    8038: "8038-sojourner", 8039: "8039-cassini", 8040: "8040-pluto-dwarf-planet",
    8041: "8041-curiosity", 8042: "8042-philae", 8043: "8043-new-horizons",
    8044: "8044-gravitational-waves", 8045: "8045-black-hole", 8046: "8046-james-webb-launch",
    8047: "8047-james-webb-first-images", 8048: "8048-osiris-rex-bennu", 8049: "8049-change-6"
  };
  // Láminas del mazo de cine, enlazadas por el ID de cada estreno.
  const MOVIE_ART_BY_ID = {
    1001: "1001-moon", 1002: "1002-caligari", 1003: "1003-potemkin", 1004: "1004-metropolis",
    1005: "1005-city-lights", 1006: "1006-king-kong", 1007: "1007-modern-times", 1008: "1008-snow-white",
    1009: "1009-gone-with-the-wind", 1010: "1010-great-dictator", 1011: "1011-citizen-kane", 1012: "1012-casablanca",
    1013: "1013-its-a-wonderful-life", 1014: "1014-bicycle-thieves", 1015: "1015-cinderella", 1016: "1016-singing-in-rain",
    1017: "1017-welcome-mr-marshall", 1018: "1018-rear-window", 1019: "1019-rebel", 1020: "1020-ten-commandments",
    1021: "1021-twelve-angry-men", 1022: "1022-vertigo", 1023: "1023-some-like-it-hot", 1024: "1024-psycho",
    1025: "1025-viridiana", 1026: "1026-lawrence-arabia", 1027: "1027-executioner", 1028: "1028-mary-poppins",
    1029: "1029-sound-of-music", 1030: "1030-western-cemetery", 1031: "1031-jungle-book", 1032: "1032-2001",
    1033: "1033-tristana", 1034: "1034-clockwork-orange", 1035: "1035-godfather", 1036: "1036-exorcist",
    1037: "1037-godfather-part-two", 1038: "1038-jaws", 1039: "1039-rocky", 1040: "1040-star-wars",
    1041: "1041-grease", 1042: "1042-alien", 1043: "1043-shining", 1044: "1044-raiders",
    1045: "1045-et", 1046: "1046-return-jedi", 1047: "1047-innocent-saints", 1048: "1048-back-to-future",
    1049: "1049-top-gun", 1050: "1050-dirty-dancing", 1051: "1051-women-on-verge", 1052: "1052-little-mermaid",
    1053: "1053-home-alone", 1054: "1054-silence-lambs", 1055: "1055-aladdin", 1056: "1056-jurassic-park",
    1057: "1057-lion-king", 1058: "1058-toy-story", 1059: "1059-independence-day", 1060: "1060-titanic",
    1061: "1061-saving-private-ryan", 1062: "1062-matrix", 1063: "1063-gladiator", 1064: "1064-fellowship",
    1065: "1065-spider-man", 1066: "1066-finding-nemo", 1067: "1067-mar-adentro", 1068: "1068-batman-begins",
    1069: "1069-pan-labyrinth", 1070: "1070-orphanage", 1071: "1071-dark-knight", 1072: "1072-avatar",
    1073: "1073-inception", 1074: "1074-harry-potter", 1075: "1075-avengers", 1076: "1076-frozen",
    1077: "1077-basque-comedy", 1078: "1078-inside-out", 1079: "1079-la-la-land", 1080: "1080-coco",
    1081: "1081-champions", 1082: "1082-parasites", 1083: "1083-soul", 1084: "1084-good-boss",
    1085: "1085-as-bestas", 1086: "1086-barbie", 1087: "1087-inside-out-2"
  };
  // Láminas disponibles del mazo de Historia de España, enlazadas por ID.
  const HISTORY_ART_BY_ID = {
    1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
    11: "11", 12: "12", 13: "13", 14: "14", 15: "15", 16: "16", 17: "17", 18: "18", 19: "19", 20: "20",
    21: "21", 22: "22", 23: "23", 24: "24", 25: "25"
  };
  // Todos los IDs del mazo tienen una lámina con el mismo nombre de archivo.
  Object.assign(HISTORY_ART_BY_ID, Object.fromEntries(window.HISTORY_CARDS.map(card => [card.id, String(card.id)])));
  const INVENTION_ART_BY_ID = {
    4001: "4001-la-escritura-cuneiforme-fecha-aproximada", 4002: "4002-la-rueda-de-alfarero-fecha-aproximada",
    4003: "4003-el-papiro-egipcio-fecha-aproximada", 4004: "4004-el-codigo-de-hammurabi",
    4005: "4005-las-primeras-monedas-acunadas-fecha-aproximada", 4006: "4006-eratostenes-mide-la-tierra",
    4007: "4007-muere-arquimedes-estudioso-de-la-palanca", 4008: "4008-julio-cesar-decreta-la-reforma-del-calendario",
    4009: "4009-el-papel-en-china", 4010: "4010-el-almagesto-de-ptolomeo",
    4011: "4011-el-astrolabio-en-el-mundo-islamico-siglo-viii-fecha-aproximada",
    4012: "4012-el-tratado-de-algebra-de-al-juarismi-fecha-aproximada", 4013: "4013-la-primera-formula-escrita-de-la-polvora",
    4014: "4014-el-reloj-astronomico-de-su-song", 4015: "4015-las-primeras-gafas-fecha-aproximada",
    4016: "4016-la-imprenta-de-tipos-moviles-de-gutenberg", 4017: "4017-copernico-pone-el-sol-en-el-centro",
    4018: "4018-el-calendario-gregoriano", 4019: "4019-gilbert-explica-el-iman",
    4020: "4020-lippershey-solicita-una-patente-para-el-telescopio", 4021: "4021-galileo-publica-lo-que-ve-en-el-cielo",
    4022: "4022-harvey-descubre-la-circulacion-de-la-sangre", 4023: "4023-la-calculadora-de-pascal",
    4024: "4024-el-reloj-de-pendulo", 4025: "4025-hooke-ve-la-celula",
    4026: "4026-romer-mide-la-velocidad-de-la-luz", 4027: "4027-los-principia-de-newton",
    4028: "4028-la-primera-maquina-de-vapor-comercial", 4029: "4029-la-maquina-atmosferica-de-newcomen",
    4030: "4030-el-termometro-de-mercurio", 4031: "4031-linneo-publica-la-primera-edicion-de-systema-naturae",
    4032: "4032-el-pararrayos-de-franklin", 4033: "4033-watt-patenta-el-condensador-separado",
    4034: "4034-el-descubrimiento-del-oxigeno", 4035: "4035-el-globo-de-los-hermanos-montgolfier",
    4036: "4036-la-vacuna-de-la-viruela", 4037: "4037-la-pila-de-volta", 4038: "4038-la-primera-locomotora-de-vapor",
    4039: "4039-el-estetoscopio", 4040: "4040-el-primer-motor-electrico",
    4041: "4041-la-primera-fotografia-conservada-fecha-aproximada", 4042: "4042-la-induccion-electromagnetica",
    4043: "4043-morse-desarrolla-su-telegrafo-electrico", 4044: "4044-el-daguerrotipo",
    4045: "4045-la-vulcanizacion-del-caucho", 4046: "4046-la-anestesia-con-eter",
    4047: "4047-otis-vende-sus-primeros-ascensores-de-seguridad", 4048: "4048-el-convertidor-bessemer",
    4049: "4049-el-origen-de-las-especies", 4050: "4050-la-primera-fotografia-en-color",
    4051: "4051-mendel-presenta-sus-experimentos-sobre-la-herencia", 4052: "4052-la-dinamita",
    4053: "4053-la-tabla-periodica", 4054: "4054-la-patente-del-telefono",
    4055: "4055-la-lampara-incandescente-duradera", 4056: "4056-la-patente-del-automovil",
    4057: "4057-el-neumatico-hinchable", 4058: "4058-los-rayos-x",
    4059: "4059-se-descubren-el-polonio-y-el-radio", 4060: "4060-la-primera-senal-de-radio-transatlantica",
    4061: "4061-el-primer-vuelo-de-los-hermanos-wright", 4062: "4062-la-relatividad-especial",
    4063: "4063-la-baquelita-el-primer-plastico-sintetico", 4064: "4064-el-proceso-haber-para-el-amoniaco",
    4065: "4065-rutherford-propone-el-modelo-nuclear-del-atomo", 4066: "4066-la-cadena-de-montaje-de-ford",
    4067: "4067-la-relatividad-general", 4068: "4068-la-insulina",
    4069: "4069-la-primera-demostracion-de-la-television", 4070: "4070-la-penicilina",
    4071: "4071-la-patente-del-motor-a-reaccion", 4072: "4072-el-radar",
    4073: "4073-la-fision-nuclear", 4074: "4074-las-medias-de-nailon-salen-a-la-venta-en-todo-estados-unidos",
    4075: "4075-la-primera-reaccion-nuclear-en-cadena", 4076: "4076-el-eniac",
    4077: "4077-el-transistor", 4078: "4078-la-estructura-del-adn",
    4079: "4079-la-vacuna-de-la-polio", 4080: "4080-el-sputnik",
    4081: "4081-el-circuito-integrado", 4082: "4082-el-laser",
    4083: "4083-el-primer-humano-en-el-espacio", 4084: "4084-el-primer-trasplante-de-corazon",
    4085: "4085-la-llegada-a-la-luna", 4086: "4086-el-primer-microprocesador",
    4087: "4087-la-primera-llamada-desde-un-movil", 4088: "4088-el-primer-bebe-por-fecundacion-in-vitro",
    4089: "4089-el-walkman", 4090: "4090-el-ibm-pc",
    4091: "4091-el-protocolo-tcp-ip", 4092: "4092-la-huella-genetica",
    4093: "4093-la-propuesta-de-la-world-wide-web", 4094: "4094-el-telescopio-espacial-hubble",
    4095: "4095-la-oveja-dolly", 4096: "4096-deep-blue-gana-a-kasparov",
    4097: "4097-el-primer-borrador-del-genoma-humano", 4098: "4098-el-iphone",
    4099: "4099-crispr-como-herramienta-de-edicion-genetica", 4100: "4100-la-deteccion-de-ondas-gravitacionales",
    4101: "4101-la-primera-imagen-de-un-agujero-negro", 4102: "4102-las-vacunas-de-arn-mensajero",
    4103: "4103-las-primeras-imagenes-del-james-webb"
  };
  // Láminas del mazo de videojuegos, enlazadas por el ID de cada carta.
  const VIDEOGAME_ART_BY_ID = {
    7001: "oxo", 7002: "tennis-for-two", 7003: "spacewar", 7004: "computer-space",
    7005: "pong", 7006: "atari-2600", 7007: "space-invaders", 7008: "pac-man",
    7009: "donkey-kong", 7010: "commodore-64", 7011: "famicom", 7012: "tetris",
    7013: "super-mario-bros", 7014: "legend-of-zelda", 7015: "final-fantasy",
    7016: "mega-drive", 7017: "game-boy", 7018: "secret-of-monkey-island",
    7019: "sonic-the-hedgehog", 7020: "mortal-kombat", 7021: "doom", 7022: "playstation",
    7023: "chrono-trigger", 7024: "pokemon-red-green", 7025: "final-fantasy-vii",
    7026: "half-life", 7027: "dreamcast", 7028: "the-sims", 7029: "halo",
    7030: "gta-vice-city", 7031: "steam", 7032: "world-of-warcraft",
    7033: "shadow-of-the-colossus", 7034: "nintendo-wii", 7035: "bioshock",
    7036: "gta-iv", 7037: "minecraft", 7038: "red-dead-redemption", 7039: "skyrim",
    7040: "candy-crush-saga", 7041: "gta-v", 7042: "hearthstone", 7043: "the-witcher-3",
    7044: "pokemon-go", 7045: "nintendo-switch", 7046: "god-of-war", 7047: "disco-elysium",
    7048: "animal-crossing-new-horizons", 7049: "elden-ring", 7050: "zelda-tears-of-the-kingdom",
    7051: "balatro"
  };
  // La vista ilustrada se activa solo cuando el lote está completo; así las cartas
  // pendientes conservan su vista tipográfica y nunca generan referencias rotas.
  const VIDEOGAME_ART_READY = Object.keys(VIDEOGAME_ART_BY_ID).length === (window.VIDEOGAME_CARDS || []).length;
  const COUNTRY_ART_IDS = new Set([2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047, 2048, 2049, 2050, 2051, 2052, 2053, 2054, 2055, 2056, 2057, 2058, 2059, 2060, 2061, 2062, 2063, 2064, 2065, 2066, 2067, 2068, 2069, 2070, 2071, 2072]);
  const POPULATION_ART_BY_ID = Object.fromEntries((window.POPULATION_CARDS || []).map(card => [card.id, String(card.id)]));
  const DISTANCE_ART_BY_ID = {
    11001: "11001-paris-versailles", 11002: "11002-berlin-potsdam", 11003: "11003-madrid-alcala-de-henares",
    11004: "11004-amsterdam-utrecht", 11005: "11005-madrid-toledo", 11006: "11006-londres-brighton",
    11007: "11007-barcelona-girona", 11008: "11008-paris-ruan", 11009: "11009-paris-reims",
    11010: "11010-roma-napoles", 11011: "11011-paris-lille", 11012: "11012-madrid-zaragoza",
    11013: "11013-madrid-valencia", 11014: "11014-paris-londres", 11015: "11015-madrid-sevilla",
    11016: "11016-roma-milan", 11017: "11017-paris-barcelona", 11018: "11018-madrid-paris",
    11019: "11019-nueva-york-chicago", 11020: "11020-madrid-londres", 11021: "11021-madrid-berlin",
    11022: "11022-madrid-atenas", 11023: "11023-madrid-reikiavik", 11024: "11024-madrid-el-cairo",
    11025: "11025-madrid-teheran", 11026: "11026-singapur-tokio", 11027: "11027-paris-nueva-york",
    11028: "11028-roma-zurich", 11029: "11029-londres-bombay", 11030: "11030-estambul-nueva-york",
    11031: "11031-londres-edimburgo", 11032: "11032-madrid-los-angeles", 11033: "11033-madrid-santiago",
    11034: "11034-johannesburgo-pekin", 11035: "11035-madrid-honolulu", 11036: "11036-madrid-perth",
    11037: "11037-madrid-sidney", 11038: "11038-madrid-auckland", 11039: "11039-san-francisco-los-angeles",
    11040: "11040-rio-sao-paulo", 11041: "11041-buenos-aires-montevideo", 11042: "11042-el-cairo-jerusalen",
    11043: "11043-nairobi-kampala", 11044: "11044-delhi-bombay", 11045: "11045-pekin-shanghai",
    11046: "11046-tokio-seul", 11047: "11047-sidney-melbourne", 11048: "11048-auckland-wellington",
    11049: "11049-ciudad-de-mexico-guadalajara", 11050: "11050-toronto-montreal"
  };

  // El contexto de una carta en «Gran mezcla»: de qué tema viene, con el icono de su
  // bloque para reconocerlo de un vistazo. En cualquier otra modalidad no hace falta —ya
  // se sabe qué se está jugando— así que devuelve `null` y quien pinte la carta no añade
  // nada.
  //
  // Va el nombre corto (`tag`) y no el del mazo: el sello se pinta también en las cartas
  // de la línea, que miden 130 px en un móvil estrecho, y ahí «Inventos y
  // descubrimientos» no cabe de ninguna manera. «Inventos» sí, y dice lo mismo.
  function categoryFor(modeKey, card) {
    if (modeKey !== "mixed" || !card.sourceMode || !has(card.sourceMode)) return null;
    const source = MODES[card.sourceMode];
    return { icon: blockOf(card.sourceMode).icon, name: source.tag || source.name };
  }

  function categoryBadge(modeKey, card) {
    const category = categoryFor(modeKey, card);
    if (!category) return "";
    return `<span class="card-category"><span aria-hidden="true">${category.icon}</span>${escapeHtml(category.name)}</span>`;
  }

  // Láminas del mazo de Historia de la medicina, enlazadas por el ID de cada hito.
  const MEDICINE_ART_BY_ID = {
    9001: "9001-hippocratic-corpus", 9002: "9002-avicenna-canon", 9003: "9003-ibn-al-nafis-pulmonary-circulation",
    9004: "9004-vesalius-fabrica", 9005: "9005-harvey-circulation", 9006: "9006-hooke-micrographia",
    9007: "9007-leeuwenhoek-microorganisms", 9008: "9008-variolization", 9009: "9009-lind-scurvy",
    9010: "9010-morgagni-pathology", 9011: "9011-jenner-vaccine", 9012: "9012-laennec-stethoscope",
    9013: "9013-ether-anesthesia", 9014: "9014-semmelweis-handwashing", 9015: "9015-snow-cholera",
    9016: "9016-lister-antisepsis", 9017: "9017-koch-tuberculosis", 9018: "9018-pasteur-rabies",
    9019: "9019-rontgen-x-rays", 9020: "9020-landsteiner-blood-groups", 9021: "9021-insulin",
    9022: "9022-fleming-penicillin", 9023: "9023-prontosil", 9024: "9024-blood-bank",
    9025: "9025-kolff-artificial-kidney", 9026: "9026-penicillin-mass-production", 9027: "9027-dna-double-helix",
    9028: "9028-kidney-transplant", 9029: "9029-salk-polio", 9030: "9030-pacemaker",
    9031: "9031-oral-contraceptive", 9032: "9032-heart-transplant", 9033: "9033-ct-scanner",
    9034: "9034-ivf", 9035: "9035-smallpox-eradication", 9036: "9036-hiv-virus",
    9037: "9037-azt", 9038: "9038-human-genome-project-begins", 9039: "9039-dolly",
    9040: "9040-herceptin", 9041: "9041-human-genome-project-complete", 9042: "9042-hpv-vaccine",
    9043: "9043-synthetic-genome-cell", 9044: "9044-crispr-cas9", 9045: "9045-mrna-vaccine",
    9046: "9046-pig-heart-transplant", 9047: "9047-crispr-therapy", 9048: "9048-pig-kidney-transplant"
  };

  // Láminas del mazo de Hitos de la música, enlazadas por el ID de cada carta.
  const MUSIC_ART_BY_ID = {
    6001: "monteverdi-orfeo", 6002: "bach-brandenburg", 6003: "goldberg-variations",
    6004: "mozart-don-giovanni", 6005: "beethoven-heroica", 6006: "beethoven-ninth",
    6007: "berlioz-symphonie-fantastique", 6008: "wagner-tristan-isolde",
    6009: "edison-phonograph", 6010: "crystal-palace-recording", 6011: "dvorak-new-world",
    6012: "caruso-milan-recording", 6013: "rite-of-spring", 6014: "commercial-radio",
    6015: "electrical-recording", 6016: "rickenbacker-frying-pan", 6017: "magnetophon",
    6018: "long-playing-record", 6019: "rock-around-the-clock", 6020: "elvis-debut",
    6021: "kind-of-blue", 6022: "love-me-do", 6023: "like-a-rolling-stone",
    6024: "sgt-peppers", 6025: "woodstock", 6026: "whats-going-on",
    6027: "dark-side-moon", 6028: "bohemian-rhapsody", 6029: "rumours",
    6030: "rappers-delight", 6031: "mtv-starts", 6032: "thriller",
    6033: "purple-rain", 6034: "graceland", 6035: "joshua-tree",
    6036: "like-a-prayer", 6037: "nevermind", 6038: "automatic-people",
    6039: "definitely-maybe", 6040: "ok-computer", 6041: "napster",
    6042: "ipod", 6043: "itunes-store", 6044: "youtube-music-video",
    6045: "in-rainbows", 6046: "spotify", 6047: "21-album",
    6048: "gangnam-style", 6049: "despacito", 6050: "last-tour-world",
    6051: "eras-tour"
  };

  // Láminas del mazo de Historia mundial, enlazadas por el ID de cada acontecimiento.
  const WORLD_ART_BY_ID = {
    5001: "5001-egypt-unification", 5002: "5002-great-pyramid-giza", 5003: "5003-battle-kadesh", 5004: "5004-bronze-age-collapse",
    5005: "5005-foundation-rome", 5006: "5006-first-temple-destruction", 5007: "5007-cyrus-conquers-babylon", 5008: "5008-roman-republic",
    5009: "5009-battle-marathon", 5010: "5010-thermopylae-salamis", 5011: "5011-peloponnesian-war", 5012: "5012-socrates-trial",
    5013: "5013-battle-gaugamela", 5014: "5014-alexander-final-illness", 5015: "5015-first-punic-war", 5016: "5016-battle-cannae",
    5017: "5017-destruction-carthage", 5018: "5018-assassination-julius-caesar", 5019: "5019-battle-actium", 5020: "5020-augustus-first-emperor",
    5021: "5021-great-fire-rome", 5022: "5022-vesuvius-eruption", 5023: "5023-roman-empire-maximum", 5024: "5024-edict-milan",
    5025: "5025-council-nicaea", 5026: "5026-constantinople-new-rome", 5027: "5027-division-roman-empire", 5028: "5028-sack-rome-visigoths",
    5029: "5029-fall-western-rome", 5030: "5030-code-justinian", 5031: "5031-hejira", 5032: "5032-battle-poitiers",
    5033: "5033-charlemagne-emperor", 5034: "5034-treaty-verdun", 5035: "5035-east-west-schism", 5036: "5036-battle-hastings",
    5037: "5037-urban-preaches-crusade", 5038: "5038-crusaders-take-jerusalem", 5039: "5039-genghis-kan-unifies", 5040: "5040-magna-carta",
    5041: "5041-mongols-sack-baghdad", 5042: "5042-fall-acre", 5043: "5043-hundred-years-war", 5044: "5044-black-death-europe",
    5045: "5045-joan-of-arc-rouen", 5046: "5046-fall-constantinople", 5047: "5047-columbus-caribbean", 5048: "5048-luther-theses",
    5049: "5049-fall-tenochtitlan", 5050: "5050-first-circumnavigation", 5051: "5051-atahualpa-captured", 5052: "5052-peace-augsburg",
    5053: "5053-thirty-years-war", 5054: "5054-peace-westphalia", 5055: "5055-english-bill-rights", 5056: "5056-act-union",
    5057: "5057-peter-great-emperor", 5058: "5058-seven-years-war", 5059: "5059-us-declaration-independence", 5060: "5060-storm-bastille",
    5061: "5061-execution-louis-xvi", 5062: "5062-haiti-independence", 5063: "5063-battle-austerlitz", 5064: "5064-latin-american-independence",
    5065: "5065-battle-waterloo", 5066: "5066-mexico-independence", 5067: "5067-july-revolution-france", 5068: "5068-abolition-slavery-britain",
    5069: "5069-first-opium-war", 5070: "5070-springtime-peoples", 5071: "5071-perry-japan", 5072: "5072-sepoy-rebellion",
    5073: "5073-american-civil-war", 5074: "5074-assassination-lincoln", 5075: "5075-suez-canal-opens", 5076: "5076-german-empire-proclaimed",
    5077: "5077-berlin-conference", 5078: "5078-dreyfus-affair", 5079: "5079-boxer-rebellion", 5080: "5080-bloody-sunday-russia",
    5081: "5081-mexican-revolution", 5082: "5082-titanic-sinking", 5083: "5083-first-world-war", 5084: "5084-october-revolution",
    5085: "5085-treaty-versailles", 5086: "5086-march-rome", 5087: "5087-crash-1929", 5088: "5088-new-chancellor-1933",
    5089: "5089-european-war-begins-1939", 5090: "5090-pearl-harbor", 5091: "5091-normandy-landing", 5092: "5092-hiroshima-nagasaki",
    5093: "5093-india-partition", 5094: "5094-israel-founded", 5095: "5095-peoples-china", 5096: "5096-korean-armistice",
    5097: "5097-rosa-parks", 5098: "5098-suez-crisis", 5099: "5099-cuban-revolution", 5100: "5100-africa-independence",
    5101: "5101-cuban-missile-crisis", 5102: "5102-kennedy-dallas", 5103: "5103-prague-spring", 5104: "5104-chile-coup",
    5105: "5105-saigon-fall", 5106: "5106-iranian-revolution", 5107: "5107-gorbachev-perestroika", 5108: "5108-berlin-wall-fall",
    5109: "5109-mandela-president", 5110: "5110-hong-kong-handover", 5111: "5111-september-eleven", 5112: "5112-iraq-invasion",
    5113: "5113-lehman-collapse", 5114: "5114-arab-spring", 5115: "5115-brexit-referendum", 5116: "5116-pandemic-declared",
    5117: "5117-ukraine-invasion"
  };

  // Historia se activa cuando su lote esté completo; mientras tanto no se ocultan
  // accidentalmente las bandas de las cartas que aún no tienen lámina.
  function usesAnimalArt(modeKey) { return ANIMAL_ART_MODES.includes(modeKey) || modeKey === "astronomy" || modeKey === "medicine" || modeKey === "countries" || modeKey === "population" || modeKey === "distances" || modeKey === "history" || modeKey === "movies" || modeKey === "music" || modeKey === "inventions" || modeKey === "world" || (modeKey === "videogames" && VIDEOGAME_ART_READY) || modeKey === "mixed"; }

  function cardArt(modeKey, card) { const sourceMode = modeKey === "mixed" && card.sourceMode ? card.sourceMode : modeKey;
    if (sourceMode === "astronomy") return ASTRONOMY_ART_BY_ID[card.id] || null;
    if (sourceMode === "medicine") return MEDICINE_ART_BY_ID[card.id] || null;
    if (sourceMode === "countries") return COUNTRY_ART_IDS.has(card.id) ? String(card.id) : null;
    if (sourceMode === "population") return POPULATION_ART_BY_ID[card.id] || null;
    if (sourceMode === "distances") return DISTANCE_ART_BY_ID[card.id] || null;
    if (sourceMode === "history") return HISTORY_ART_BY_ID[card.id] || null;
    if (sourceMode === "inventions") return INVENTION_ART_BY_ID[card.id] || null;
    if (sourceMode === "movies") return MOVIE_ART_BY_ID[card.id] || null;
    if (sourceMode === "music") return MUSIC_ART_BY_ID[card.id] || null;
    if (sourceMode === "world") return WORLD_ART_BY_ID[card.id] || null;
    if (sourceMode === "videogames") return VIDEOGAME_ART_BY_ID[card.id] || null;
    return ANIMAL_ART_MODES.includes(sourceMode) ? ANIMAL_ART_BY_ID[card.id] || null : null;
  }

  function animalArt(modeKey, card) { const sourceMode = modeKey === "mixed" && card.sourceMode ? card.sourceMode : modeKey;
    const plate = cardArt(modeKey, card);
    if (!plate) return "";
    const folder = sourceMode === "astronomy" ? "astronomy-cards" : sourceMode === "medicine" ? "medicine-cards" : sourceMode === "countries" ? "country-cards" : sourceMode === "population" ? "population-cards" : sourceMode === "distances" ? "distance-cards" : sourceMode === "history" ? "history-cards" : sourceMode === "movies" ? "movie-cards" : sourceMode === "music" ? "music-cards" : sourceMode === "inventions" ? "invention-cards" : sourceMode === "world" ? "world-cards" : sourceMode === "videogames" ? "videogame-cards" : "animal-cards";
    const extension = sourceMode === "history" ? "jpg" : sourceMode === "inventions" ? "png" : "webp";
    return `<img class="animal-card-art" src="assets/${folder}/${plate}.${extension}" alt="" width="512" height="768" decoding="async" loading="lazy">`;
  }

  // La huella de un mazo: no el contenido —eso vive en el cliente y las reglas nunca han
  // podido comprobarlo—, sino una forma barata de detectar que dos móviles no llevan el
  // mismo mazo. Cuenta el orden, no solo el conjunto: el reparto depende de en qué
  // posición está cada identificador, así que dos mazos con las mismas cartas
  // recolocadas no son el mismo. La usan el duelo por enlace —para no comparar dos
  // partidas que no son la misma— y las salas compartidas —para no repartir ni empezar
  // con un móvil que lleva una versión distinta del juego.
  function deckFingerprint(modeKey) {
    const deck = cards(modeKey);
    let hash = 2166136261;
    for (const card of deck) {
      hash ^= card.id;
      hash = Math.imul(hash, 16777619);
    }
    return `${deck.length}.${(hash >>> 0).toString(36)}`;
  }

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

  // La demostración con la que abre la guía: una jugada entera, en bucle y con cartas de
  // verdad del mazo que se va a jugar. Enseñar la mecánica cuesta menos que contarla —una
  // carta sube a su hueco, se da la vuelta y descubre su valor— y de paso presenta el
  // mazo. Las tres cartas se toman repartidas por el orden del mazo para que la del medio
  // encaje de verdad entre las otras dos: la demostración no enseña una jugada falsa.
  //
  // Es decorativa para quien usa lector de pantalla (`aria-hidden`): lo que cuenta lo
  // dicen los tres pasos de debajo, que sí se leen.
  function guideDemo(modeKey) {
    const deck = cards(modeKey);
    if (deck.length < 3) return "";
    const ordenadas = [...deck].sort((a, b) => sortValue(modeKey, a) - sortValue(modeKey, b));
    const en = fraccion => ordenadas[Math.floor(ordenadas.length * fraccion)];
    const [izquierda, medio, derecha] = [en(0.2), en(0.5), en(0.8)];
    const mini = card => `<b>${escapeHtml(shortValue(modeKey, card))}</b><small>${escapeHtml(card.title)}</small>`;
    return `<div class="guide-demo" aria-hidden="true">
      <div class="gd-line">
        <div class="gd-card">${mini(izquierda)}</div>
        <div class="gd-slot"><span>+</span></div>
        <div class="gd-card">${mini(derecha)}</div>
      </div>
      <div class="gd-play"><div class="gd-flip">
        <div class="gd-face gd-front"><i>${escapeHtml(hiddenLabel(modeKey))}</i><small>${escapeHtml(medio.title)}</small></div>
        <div class="gd-face gd-back">${mini(medio)}</div>
      </div></div>
      <div class="gd-mark"><span>✓</span> ¡En su sitio!</div>
    </div>`;
  }

  function guideStep(numero, titulo, texto) {
    return `<li class="guide-step"><span class="gs-num" aria-hidden="true">${numero}</span><b>${titulo}</b><small>${texto}</small></li>`;
  }

  function guideCard(icono, titulo, estado, texto) {
    return `<div class="guide-card"><i aria-hidden="true">${icono}</i><span class="gc-body"><b>${titulo}</b>${estado ? `<em>${estado}</em>` : ""}<small>${texto}</small></span></div>`;
  }

  // La guía la lee quien quiere jugar ya, no quien quiere estudiarse un reglamento: una
  // jugada de ejemplo, tres pasos y una ficha de una línea por cada cosa que de verdad
  // hay que decidir. Lo que no hace falta para la primera partida se queda fuera a
  // propósito — el detalle fino de cada poder ya lo explica la pantalla donde se usa.
  //
  // Se comparte entre los dos motores —`app.js` y `online.js`— y el último bloque cambia
  // según la forma de jugar, para no presentar como regla universal algo que solo existe
  // en solitario o en una sala compartida.
  function guideMarkup(modeKey, context = "local", { pulse = false, ghost = true } = {}) {
    const selectedMode = mode(modeKey);
    const order = selectedMode.axis === "time" ? "de antes a después" : "de menor a mayor";
    const pending = cards(modeKey).some(card => card.reviewStatus === "pending");
    const shared = context === "local" || context === "online";
    // Un poder apagado se explica igual —hay que saber qué te estás dejando—, pero
    // diciendo además quién lo enciende, que en una sala es solo el anfitrión.
    const seActiva = context === "online" ? " La activa el anfitrión antes de empezar." : " Se activa antes de empezar.";

    const poderes = shared ? `<h3>Poderes</h3><div class="guide-cards">
      ${guideCard("◌", "Fantasma", ghost ? "en juego" : "opcional", `Una vuelta a ciegas: durante toda ella nadie ve ningún valor. Una vez por persona, con cinco cartas ya en la línea.${ghost ? "" : seActiva}`)}
      ${guideCard("⚡", "Pulso", pulse ? "en juego" : "opcional", `Un duelo: el mazo saca una carta y la colocáis los dos, a ciegas. Si solo aciertas tú, le pasas una carta tuya; si acierta quien defiende, o si falláis los dos, robas tú. Una vez por persona.${pulse ? "" : seActiva}`)}
    </div>` : "";

    const dificultad = `<h3>Dificultad</h3><div class="guide-levels">
      <div><b>Fácil</b><span>Ves todos los valores de la línea.</span></div>
      <div><b>Normal</b><span>Cada turno se coloca sola una carta más.</span></div>
      <div><b>Difícil</b><span>Dos, y algún turno a ciegas.</span></div>
      <div><b>Experto</b><span>Dos, y la línea siempre a ciegas.</span></div>
    </div>`;

    const contextGuide = context === "solo"
      ? `<h3>Tú contra el mazo</h3><p class="guide-lead">Tienes tres vidas: cada fallo cuesta una.</p><div class="guide-cards">
          ${guideCard("☼", "Reto diario", "", "Quince cartas, las mismas para todo el mundo. Un intento al día.")}
          ${guideCard("∞", "Partida libre", "", "El mazo entero, a tu ritmo. Se guarda para seguir luego.")}
          ${guideCard("⚔", "Duelo por enlace", "", "Mandas un enlace y quien lo abra juega tus mismas cartas. Al final, cara a cara.")}
        </div>${dificultad}`
      : context === "competition"
        ? `<h3>🏆 Competición</h3><p class="guide-lead">Cinco cartas de cada tema, uno tras otro y sin repetir. Tres vidas nuevas en cada ronda, y los aciertos se van sumando.</p>${dificultad}`
        : context === "online"
          ? `<h3>Varios móviles</h3><p class="guide-lead">El anfitrión abre la sala y reparte el código, el enlace o el QR. Cada cual juega desde su pantalla, con conexión. Cada turno tiene 20 segundos para colocar la carta; si se agotan, el turno pasa solo a la siguiente persona.</p>`
          : `<h3>Un solo móvil</h3><p class="guide-lead">De 2 a 9 personas, pasándoos el teléfono en cada turno. Antes de empezar elegís cuántas cartas lleva cada uno y quién comienza.</p>`;

    return `<div class="eyebrow">Guía · ${escapeHtml(selectedMode.name)}</div>
      <h2>Cómo se juega</h2>
      ${guideDemo(modeKey)}
      <p class="guide-lead">Ordena las cartas en una sola línea, ${order}. El valor va oculto: solo se descubre al confirmar.</p>
      <ol class="guide-steps">
        ${guideStep(1, "Elige una carta", "Tócala, o arrástrala hasta la línea.")}
        ${guideStep(2, "Marca el hueco", "Entre qué dos cartas crees que encaja.")}
        ${guideStep(3, "Confirma", "Se descubre el valor. Si aciertas, se queda en la línea.")}
      </ol>
      <p class="guide-note">¿Dos cartas con el mismo valor? Entonces valen los dos órdenes.${pending ? " Las cartas «en revisión» se juegan igual, con el valor que muestran." : ""}</p>
      ${shared ? `<h3>Cómo se gana</h3><p class="guide-lead">Gana quien se quede sin cartas al acabar la ronda. Cada fallo te hace robar otra.</p>` : ""}
      ${poderes}${contextGuide}`;
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

  // Barajar con semilla: dos móviles que parten del mismo texto reciben exactamente las
  // mismas cartas en el mismo orden, sin hablar entre ellos y sin servidor. Es lo que
  // sostiene el reto diario —la semilla es la fecha— y el duelo por enlace, donde la
  // semilla viaja dentro del propio enlace.
  function seedFrom(text) {
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    return seed >>> 0;
  }

  function seededRandom(seed) {
    let state = seed;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWith(items, random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  window.CONTINUUM = {
    MODES, BLOCKS, DEFAULT_MODE, DEFAULT_BLOCK,
    has, mode, axis, cards,
    usesAnimalArt, cardArt, animalArt, deckFingerprint, categoryFor, categoryBadge,
    hasBlock, block, blockOf, blockGames,
    formatValue, shortValue, sortValue, hiddenLabel, timelineTitle, question, eraForCard,
    correctIndex, placementHint, guideMarkup,
    escapeHtml, initials, shuffle, seedFrom, seededRandom, shuffleWith
  };
})();
