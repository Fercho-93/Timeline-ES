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

  // Los hablantes se publican en millones con un decimal y ese decimal hace falta: entre
  // el turco y el télugu hay dos décimas de millón, y `compact()` los redondearía a la
  // misma cifra por encima de los cien millones. Por debajo del millón manda `compact()`,
  // que ahí ya da la cifra exacta.
  function compactSpeakers(value) {
    if (value < 1e6) return `${compact(value)} hablantes`;
    const millones = (value / 1e6).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${millones} millones`;
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
      // El duelo de cifras no ordena: pide el número. Cada eje dice cómo se pregunta, en
      // qué unidad se responde y con cuánta precisión. Las fechas se apartan de los demás
      // en dos cosas: admiten negativos —los años antes de Cristo— y se puntúan por años
      // de diferencia y no por porcentaje, porque errar un siglo es errar un siglo tanto
      // en el año 200 como en el 1900.
      cifra: { pregunta: "¿En qué año fue?", unidad: "año", decimales: 0, anos: true, negativos: true,
        unidades: [["d. C.", 1]], ejemplo: "1492",
        pista: "El año. Los anteriores a Cristo, con un menos delante: −218" },
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
      cifra: { pregunta: "¿Cuántos habitantes tiene?", unidad: "habitantes", decimales: 0,
        unidades: [["habitantes", 1], ["mil", 1e3], ["millones", 1e6], ["millón", 1e6], ["M", 1e6]], ejemplo: "47 millones",
        pista: "Vale «47 millones» o el número entero: 47000000" },
      bands: [
        { limit: 100000, key: "minusculo", name: "Minúsculo", symbol: "·" },
        { limit: 2000000, key: "muypequeno", name: "Muy pequeño", symbol: "▪" },
        { limit: 12000000, key: "pequeno", name: "Pequeño", symbol: "◈" },
        { limit: 50000000, key: "medio", name: "Medio", symbol: "◆" },
        { limit: 150000000, key: "grande", name: "Grande", symbol: "★" },
        { limit: Infinity, key: "gigante", name: "Gigante", symbol: "⬢" }
      ]
    },
    speakers: {
      sortValue: card => card.value,
      format: card => compactSpeakers(card.value),
      shortValue: card => shortMillions(card.value),
      hiddenLabel: "Hablantes ocultos",
      timelineTitle: "De menos a más hablado",
      question: "¿Menos o más hablantes?",
      cifra: { pregunta: "¿Cuántos hablantes tiene?", unidad: "hablantes", decimales: 0,
        unidades: [["hablantes", 1], ["mil", 1e3], ["millones", 1e6], ["millón", 1e6], ["M", 1e6]], ejemplo: "93 millones",
        pista: "Vale «93 millones» o el número entero: 93000000" },
      // Los cortes están puestos sobre el rango real del mazo, que va del aragonés (25.000)
      // al chino mandarín (929 millones). Con estos siete tramos caen 5, 6, 10, 7, 13, 5 y
      // 4 cartas, sin ninguna banda vacía.
      bands: [
        { limit: 1000000, key: "minoritario", name: "Minoritario", symbol: "·" },
        { limit: 10000000, key: "pequeno", name: "Pequeño", symbol: "▪" },
        { limit: 35000000, key: "medio", name: "Medio", symbol: "◈" },
        { limit: 60000000, key: "grande", name: "Grande", symbol: "◆" },
        { limit: 90000000, key: "muygrande", name: "Muy grande", symbol: "★" },
        { limit: 250000000, key: "gigante", name: "Gigante", symbol: "⬢" },
        { limit: Infinity, key: "colosal", name: "Colosal", symbol: "◉" }
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
      cifra: { pregunta: "¿Cuántos kilómetros cuadrados tiene?", unidad: "km²", decimales: 0,
        unidades: [["km²", 1], ["millones de km²", 1e6], ["ha", 0.01], ["m²", 1e-6]], ejemplo: "505.000 km²",
        pista: "En km². Vale «17 millones de km²» para los enormes" },
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
      cifra: { pregunta: "¿Cuánto pesa?", unidad: "kg", decimales: 6,
        unidades: [["kg", 1], ["g", 1e-3], ["mg", 1e-6], ["t", 1e3], ["toneladas", 1e3]], ejemplo: "2,5 t",
        pista: "Con su unidad: «40 g», «2,5 t», «1 mg». Sin unidad se entiende en kg" },
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
      cifra: { pregunta: "¿Cuántos años vive?", unidad: "años", decimales: 6,
        unidades: [["años", 1], ["meses", 1 / 12], ["semanas", 7 / 365], ["días", 1 / 365], ["horas", 1 / 8760], ["minutos", 1 / 525600]], ejemplo: "18 meses",
        pista: "Con su unidad: «3 días», «18 meses», «40 minutos». Sin unidad se entiende en años" },
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
      cifra: { pregunta: "¿A qué velocidad llega?", unidad: "km/h", decimales: 6,
        unidades: [["km/h", 1], ["m/s", 3.6], ["m/h", 1e-3], ["cm/s", 0.036], ["mm/s", 0.0036]], ejemplo: "30 m/s",
        pista: "Con su unidad: «30 m/s», «5 cm/s». Sin unidad se entiende en km/h" },
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
      cifra: { pregunta: "¿A cuántos kilómetros está?", unidad: "km", decimales: 3,
        unidades: [["km", 1], ["m", 1e-3]], ejemplo: "1.800 km",
        pista: "En kilómetros: 1800. Sin unidad se entiende en km" },
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

  // El mazo de Inventos ya no duplica hitos de los mazos de Astronomía o Medicina.
  // Se conserva la constante para mantener estable la interfaz de CONTINUUM.
  const MIXED_DUPLICATE_INVENTION_IDS = new Set();

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
      ]
        // Inventos conserva los hitos tecnológicos propios; los descubrimientos
        // médicos y astronómicos duplicados viven en sus mazos específicos.
        .flatMap(([sourceMode, deck]) => deck
          .filter(card => sourceMode !== "inventions" || !MIXED_DUPLICATE_INVENTION_IDS.has(card.id))
          .map(card => ({ ...card, sourceMode }))),
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
      cardLabel: "hitos", blurb: "Hitos históricos de ciencia, tecnología y conocimiento: de la escritura al teléfono inteligente.", cards: window.INVENTION_CARDS,
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
      cardLabel: "animales", blurb: "Edades de referencia, con contexto sobre su medición.", cards: window.ANIMAL_LIFESPAN_CARDS,
      axis: "lifespan"
    },
    speed: {
      key: "speed", name: "Velocidad de animales",
      cardLabel: "animales", blurb: "Movimiento y tipo de medición indicados en cada referencia.", cards: window.ANIMAL_SPEED_CARDS,
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
    languages: {
      key: "languages", name: "Idiomas por hablantes nativos",
      cardLabel: "idiomas", blurb: "Hablantes de lengua materna, no totales.", cards: window.LANGUAGE_CARDS,
      axis: "speakers"
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
    geografia: { key: "geografia", name: "Geografía", icon: "🌍", art: "globe", tagline: "Ordena el mundo.", games: ["countries", "population", "languages", "distances"] },
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

  // Las tablas de ilustración por ID (una por mazo) viven en mode-art.js, que se carga
  // justo antes que este fichero: es solo dato, con mucho el bloque más largo, y
  // compartido entre los dos motores —`app.js` para un móvil, `online.js` para varios—.
  const {
    ANIMAL_ART_MODES, ANIMAL_ART_BY_ID, ASTRONOMY_ART_BY_ID, MOVIE_ART_BY_ID, HISTORY_ART_BY_ID,
    INVENTION_ART_BY_ID, VIDEOGAME_ART_BY_ID, VIDEOGAME_ART_READY, COUNTRY_ART_IDS,
    POPULATION_ART_BY_ID, LANGUAGE_ART_BY_ID, DISTANCE_ART_BY_ID, MEDICINE_ART_BY_ID,
    MUSIC_ART_BY_ID, WORLD_ART_BY_ID
  } = window.MODE_ART;

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

  // Historia se activa cuando su lote esté completo; mientras tanto no se ocultan
  // accidentalmente las bandas de las cartas que aún no tienen lámina.
  function usesAnimalArt(modeKey) { return ANIMAL_ART_MODES.includes(modeKey) || modeKey === "astronomy" || modeKey === "medicine" || modeKey === "countries" || modeKey === "population" || modeKey === "languages" || modeKey === "distances" || modeKey === "history" || modeKey === "movies" || modeKey === "music" || modeKey === "inventions" || modeKey === "world" || (modeKey === "videogames" && VIDEOGAME_ART_READY) || modeKey === "mixed"; }

  function cardArt(modeKey, card) { const sourceMode = modeKey === "mixed" && card.sourceMode ? card.sourceMode : modeKey;
    if (sourceMode === "astronomy") return ASTRONOMY_ART_BY_ID[card.id] || null;
    if (sourceMode === "medicine") return MEDICINE_ART_BY_ID[card.id] || null;
    if (sourceMode === "countries") return COUNTRY_ART_IDS.has(card.id) ? String(card.id) : null;
    if (sourceMode === "population") return POPULATION_ART_BY_ID[card.id] || null;
    if (sourceMode === "languages") return LANGUAGE_ART_BY_ID[card.id] || null;
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
    const folder = sourceMode === "astronomy" ? "astronomy-cards" : sourceMode === "medicine" ? "medicine-cards" : sourceMode === "countries" ? "country-cards" : sourceMode === "population" ? "population-cards" : sourceMode === "languages" ? "language-cards" : sourceMode === "distances" ? "distance-cards" : sourceMode === "history" ? "history-cards" : sourceMode === "movies" ? "movie-cards" : sourceMode === "music" ? "music-cards" : sourceMode === "inventions" ? "invention-cards" : sourceMode === "world" ? "world-cards" : sourceMode === "videogames" ? "videogame-cards" : "animal-cards";
    const extension = sourceMode === "history" ? "jpg" : "webp";
    return `<img class="animal-card-art" src="assets/${folder}/${plate}.${extension}" alt="" width="512" height="768" decoding="async" loading="lazy">`;
  }

  // Todas las cartas de una colección comparten portada: el reverso no revela
  // la ilustración individual ni el valor de la carta pendiente.
  function cardBack(modeKey) {
    const art = blockOf(modeKey).art;
    const cover = art === 'globe' ? 'geography' : art;
    return `<span class="carta-reverso" aria-hidden="true"><img class="reverso-coleccion" src="assets/hero-${cover}-400.webp" alt="" width="400" height="560" decoding="async"></span>`;
  }

  // La huella detecta versiones distintas del contenido; no es una validación del
  // servidor ni una protección contra trampas. Permite detectar que dos móviles no llevan el
  // mismo mazo. Cuenta el orden, no solo el conjunto: el reparto depende de en qué
  // posición está cada identificador, así que dos mazos con las mismas cartas
  // recolocadas no son el mismo. La usan el duelo por enlace —para no comparar dos
  // partidas que no son la misma— y las salas compartidas —para no repartir ni empezar
  // con un móvil que lleva una versión distinta del juego.
  const PULSE_RULES = "Los dos colocáis la misma carta a ciegas. Si acertáis los dos, no cambia ninguna mano. Si solo acierta quien reta, pasa una carta suya al defensor. Si solo acierta quien defiende, quien reta roba una carta. Si falláis los dos, la carta se descarta y quien reta roba una. Si no quedan cartas en el mazo ni en el descarte, no hay robo. Una vez por persona.";
  function deckFingerprint(modeKey, deck = cards(modeKey)) {
    let hash = 2166136261;
    // Incluye el eje, el protocolo, el orden y los datos que se ven y se comparan.
    // Una corrección conservando el ID también debe cambiar la huella.
    const content = JSON.stringify([3, modeKey, mode(modeKey).axis, deck.map(card =>
      [card.id, sortValue(modeKey, card), card.title, card.detail, card.source || "", card.sourceMode || ""])]);
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `v3.${deck.length}.${(hash >>> 0).toString(36)}`;
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

  // La primera jugada se aprende haciéndola. Las tres cartas se toman de puntos separados
  // del mazo y la central encaja de verdad entre las otras dos; no hay una respuesta
  // amañada que contradiga luego las reglas del tablero.
  function guideDemo(modeKey) {
    const deck = cards(modeKey);
    if (deck.length < 3) return "";
    const ordenadas = [...deck].sort((a, b) => sortValue(modeKey, a) - sortValue(modeKey, b));
    const en = fraccion => ordenadas[Math.floor(ordenadas.length * fraccion)];
    const [izquierda, medio, derecha] = [en(0.2), en(0.5), en(0.8)];
    const mini = card => `${animalArt(modeKey, card)}<b>${escapeHtml(shortValue(modeKey, card))}</b><small>${escapeHtml(card.title)}</small>`;
    return `<section class="guide-practice" data-guide-practice data-correct="1">
      <div class="guide-practice-head"><span>Tu primera colocación</span><small>Prueba sin gastar ninguna carta</small></div>
      <div class="gp-card" data-guide-card>${animalArt(modeKey, medio)}<i>${escapeHtml(hiddenLabel(modeKey))}</i><b data-guide-hidden>?</b><small>${escapeHtml(medio.title)}</small><em data-guide-value hidden>${escapeHtml(shortValue(modeKey, medio))}</em></div>
      <p>¿Dónde encaja esta carta?</p>
      <div class="gp-line">
        <button type="button" data-guide-place="0" aria-label="Colocar antes de ${escapeHtml(izquierda.title)}">+</button>
        <div class="gp-reference">${mini(izquierda)}</div>
        <button type="button" data-guide-place="1" aria-label="Colocar entre las dos cartas">+</button>
        <div class="gp-reference">${mini(derecha)}</div>
        <button type="button" data-guide-place="2" aria-label="Colocar después de ${escapeHtml(derecha.title)}">+</button>
      </div>
      <div class="gp-feedback" data-guide-feedback role="status">Toca uno de los tres huecos.</div>
      <button type="button" class="gp-reset" data-guide-reset hidden>Probar otra vez</button>
    </section>`;
  }

  if(typeof document!=='undefined')document.addEventListener('click', event => {
    const place=event.target.closest('[data-guide-place]'), resetTarget=event.target.closest('[data-guide-reset]');
    if(!place&&!resetTarget)return;
    const practice=event.target.closest('[data-guide-practice]');
    if(!practice)return;
    const reset=practice.querySelector('[data-guide-reset]');
    if(resetTarget){
      practice.classList.remove('is-correct','is-wrong');
      practice.querySelectorAll('[data-guide-place]').forEach(button=>{button.disabled=false;button.removeAttribute('aria-pressed');});
      practice.querySelector('[data-guide-value]').hidden=true;
      practice.querySelector('[data-guide-hidden]').hidden=false;
      practice.querySelector('[data-guide-feedback]').textContent='Toca uno de los tres huecos.';
      reset.hidden=true;return;
    }
    const correct=Number(place.dataset.guidePlace)===Number(practice.dataset.correct);
    practice.classList.toggle('is-correct',correct);practice.classList.toggle('is-wrong',!correct);
    practice.querySelectorAll('[data-guide-place]').forEach(button=>button.setAttribute('aria-pressed',String(button===place)));
    const feedback=practice.querySelector('[data-guide-feedback]');
    if(correct){
      practice.querySelectorAll('[data-guide-place]').forEach(button=>button.disabled=true);
      practice.querySelector('[data-guide-value]').hidden=false;
      practice.querySelector('[data-guide-hidden]').hidden=true;
      feedback.textContent='¡Exacto! La carta revela su valor y se queda entre las dos.';
      reset.hidden=false;
    } else {
      practice.querySelector('[data-guide-value]').hidden=false;
      practice.querySelector('[data-guide-hidden]').hidden=true;
      const references=[...practice.querySelectorAll('.gp-reference > b')].map(node=>node.textContent);
      feedback.textContent=`Prueba otro hueco: ${practice.querySelector('[data-guide-value]').textContent} va entre ${references[0]} y ${references[1]}. Aquí no pierdes vidas.`;
    }
  });

  function guideStep(numero, titulo, texto) {
    return `<li class="guide-step"><span class="gs-num" aria-hidden="true">${numero}</span><b>${titulo}</b><small>${texto}</small></li>`;
  }

  function guideCard(icono, titulo, estado, texto) {
    return `<div class="guide-card"><i aria-hidden="true">${icono}</i><span class="gc-body"><b>${titulo}</b>${estado ? `<em>${estado}</em>` : ""}<small>${texto}</small></span></div>`;
  }

  function guideDrawing(kind) {
    const paths = {
      line: '<rect x="12" y="20" width="44" height="62" rx="5"/><rect x="78" y="10" width="44" height="62" rx="5"/><rect x="144" y="20" width="44" height="62" rx="5"/><path d="M18 96h164m-8-6 8 6-8 6M64 48h8m-4-4v8m58-4h10m-5-5v10"/>',
      result: '<rect x="24" y="16" width="56" height="76" rx="6"/><path d="m38 52 10 10 20-25M122 37l34 34m0-34-34 34"/><circle cx="139" cy="54" r="33"/>',
      modes: '<rect x="18" y="14" width="50" height="82" rx="8"/><path d="M36 86h14"/><circle cx="128" cy="36" r="14"/><circle cx="168" cy="43" r="11"/><path d="M101 89v-9a27 27 0 0 1 54 0v9m2-27q24 0 24 27"/>',
      powers: '<path d="M38 82V44a26 26 0 0 1 52 0v38l-13-9-13 9-13-9-13 9m18-41v7m16-7v7M143 14l-26 44h23l-7 35 39-53h-26l8-26Z"/>',
      chapters: '<path d="M24 55h152"/><circle cx="30" cy="55" r="17"/><circle cx="100" cy="55" r="17"/><circle cx="170" cy="55" r="17"/><path d="m21 55 6 6 12-13M95 48l10 7-10 7m-83 23h36m34 0h36m34 0h36"/>',
      atlas: '<path d="M100 26Q59 8 20 22v70q39-14 80 4 41-18 80-4V22q-39-14-80 4v70M36 38h44m-44 14h44m-44 14h30"/><rect x="118" y="38" width="44" height="34" rx="3"/><path d="m124 66 12-15 10 10 8-7"/>'
    };
    return '<svg class="guide-drawing" viewBox="0 0 200 110" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind]+'</svg>';
  }
  function guideChapter(key, title, caption, drawing, content) {
    return '<details class="guide-chapter" data-guide-chapter="'+key+'"><summary><span class="guide-chapter-number" aria-hidden="true">'+key+'</span><span><b>'+title+'</b><small>'+caption+'</small></span><i aria-hidden="true">+</i></summary><div class="guide-chapter-body">'+guideDrawing(drawing)+content+'</div></details>';
  }
  // Un capítulo abierto cada vez; navegación nativa con teclado y lector de pantalla.
  if (typeof document !== 'undefined') document.addEventListener('toggle', event => {
    const chapter = event.target;
    if (!chapter.matches?.('[data-guide-chapter]') || !chapter.open) return;
    chapter.closest('.guide-handbook')?.querySelectorAll('[data-guide-chapter]').forEach(other => {
      if (other !== chapter) other.open = false;
    });
  }, true);

  function guideMarkup(modeKey, context = "local", { pulse = false, ghost = true } = {}) {
    const selectedMode = mode(modeKey);
    const order = selectedMode.axis === "time" ? "de antes a después" : "de menor a mayor";
    const pending = cards(modeKey).some(card => card.reviewStatus === "pending");
    const shared = context === "local" || context === "online";
    const here = context === 'competition' ? 'Competición en solitario' : context === 'solo' ? 'Solitario' : context === 'online' ? 'Varios móviles' : 'Un solo móvil';
    const difficulty = '<div class="guide-levels">'+Object.values(window.CONTINUUM.Ghost?.LEVELS || {}).map(level => '<div><b>'+escapeHtml(level.name)+'</b><span>'+escapeHtml(level.description)+'</span></div>').join('')+'</div>';
    const result = '<div class="guide-cards">'+
      guideCard('✓','Si aciertas','','La carta revela su valor y se queda en la línea. En multijugador tienes una carta menos; en solitario sumas un acierto.')+
      guideCard('↺','Si fallas','','La corrección enseña dónde encajaba, pero la carta fallada no se añade a la línea. En multijugador la sustituyes por otra; si no queda ninguna para robar, conservas la fallada. En solitario pierdes una vida, excepto en el duelo por enlace.')+'</div>'+
      '<h4>Cómo se gana</h4><p>En multijugador se completa la ronda para que todos tengan su turno. Gana quien termine como única persona sin cartas. Los poderes que guardes no cuentan como cartas pendientes.</p>'+
      '<h4>La final de desempate</h4><p>Si varias personas quedan sin cartas, cada finalista escribe una cifra secreta para una carta neutral, en la unidad indicada. Se revelan juntas: gana la más cercana, por encima o por debajo. Si persiste el empate, solo quienes empataron repiten con otra carta. Sin poderes en la final.</p>';
    const formats = '<div class="guide-cards">'+
      guideCard('☼','Reto diario','15 cartas · 3 vidas','Las mismas cartas del mazo para todos, un intento al día. En Fácil; termina al completar las cartas o agotar las vidas.')+
      guideCard('∞','Partida libre','3 vidas','Elige dificultad y juega hasta completar el mazo o agotar las vidas. Puedes continuar más tarde la partida guardada.')+
      guideCard('↗','Duelo por enlace','Sin límite de vidas','Comparte un enlace: la otra persona juega las mismas 15 cartas, sin coincidir a la vez. Compara los aciertos al terminar.')+
      guideCard('⇄','Duelo por turnos','Cada uno desde su móvil','La partida se guarda entre turnos. Juega cuando sea tu turno, deja la partida y vuelve desde «Continuar»; el perfil muestra quién tiene la jugada.')+
      guideCard('≈','Duelo de cifras','Escribe el valor','En cada carta escribe el número en la unidad que se indica. Se valora la cercanía y el acierto; revisa la unidad antes de confirmar.')+
      guideCard('♟','Un solo móvil','2–9 personas','Elegid cartas iniciales y quién empieza. Pasad el teléfono a la persona indicada; mantened en secreto las manos ajenas.')+
      guideCard('⌁','Varios móviles','Sala con conexión','El anfitrión crea la sala y comparte código, enlace o QR. Los demás entran y se preparan. El anfitrión elige cartas y reloj: sin límite, 20, 30 o 45 segundos. Si se agota el tiempo, el turno pasa.')+'</div><p class="guide-first-game"><b>Primera partida:</b> empieza por «Un solo móvil» con el mazo que ya aparece seleccionado. Así puedes practicar sin crear una sala.</p><h4>Dificultad: libre y competición en solitario</h4>'+difficulty+
      '<p>Las cartas automáticas hacen crecer la línea después de tu jugada; no suman aciertos tuyos. El reto diario y el duelo por enlace se juegan en Fácil.</p>';
    const powers = '<p>Opcionales en multijugador: se activan antes de empezar; en una sala decide el anfitrión. Se consiguen al azar al recibir cartas: no todos tendrán uno. Cada poder recibido tiene un uso y no ocupa la mano.</p><div class="guide-cards">'+
      guideCard('◌','Fantasma',shared?(ghost?'en juego':'opcional'):'Multijugador','Necesitas el poder, alguna carta en la mano y cinco cartas en la línea. Oculta los valores durante una vuelta completa. No se superpone a otro Fantasma; después hay una vuelta con valores visibles.')+
      guideCard('ϟ','Pulso',shared?(pulse?'en juego':'opcional'):'Multijugador','Necesitas el poder y dos cartas en la mano. Elige rival y la carta que podrías pasarle. Los dos colocáis la misma carta del mazo a ciegas, sin ver la elección del otro.')+'</div>'+
      '<table class="guide-pulse-table"><caption>Resultado del Pulso</caption><thead><tr><th scope="col">Quién acierta</th><th scope="col">Qué ocurre</th></tr></thead><tbody><tr><td>Los dos</td><td>Ninguna mano cambia.</td></tr><tr><td>Solo quien reta</td><td>Pasa su carta elegida al defensor.</td></tr><tr><td>Solo quien defiende</td><td>Quien reta roba una carta.</td></tr><tr><td>Ninguno</td><td>Se descarta la carta del reto; quien reta roba una.</td></tr></tbody></table><p>Si se agota el mazo se reutiliza el descarte; si ambos están vacíos se omite el robo. Quien recibe una carta por Pulso queda protegido de recibir otra por Pulso durante esa ronda. En Difícil y Experto el ocultamiento es parte de la dificultad: no necesitas recibir un poder.</p>';
    const chapters = '<p>Elige uno o varios jugadores, rondas y cartas. Cada capítulo propone un mazo aleatorio distinto que se presenta antes de empezar.</p><div class="guide-cards">'+
      guideCard('1','En solitario','','Cinco cartas por ronda por defecto, o las que elijas. Recuperas tres vidas en cada tema y acumulas los aciertos del recorrido.')+
      guideCard('2','En multijugador','','Puntos por ronda: sin cartas, +1; con una, 0; con tres, −2. Se resta el número de cartas restantes menos uno. Al final gana la puntuación mayor; puede haber empate en el total.')+'</div><p>«Siguiente ronda» abre el nuevo tema. La competición no puntúa en el ranking diario.</p>';
    const controls = '<div class="guide-cards">'+
      guideCard('↔','Explora la línea','','Desliza a los lados para ver las cartas. También puedes colocar en los extremos. Desliza sobre una carta para desplazar la pantalla; mantén pulsado para arrastrarla.')+
      guideCard('＋','Acerca el tablero','80 % · 100 % · 120 %','El zoom está junto al título de la línea. Amplía las ilustraciones y vuelve al 100 % cuando quieras.')+
      guideCard('⋯','Pausa y salida','','El menú de partida reúne guía y opciones de salida. En partidas guardadas usa «Continuar». Salir de una sala online no pausa a los demás; el anfitrión puede cerrarla.')+'</div>';
    const progress = '<div class="guide-cards">'+
      guideCard('▤','Enciclopedia','','Explora mazos, busca cartas y filtra. Descubres las ilustraciones al jugar sus cartas, también si fallas. Los descubrimientos recientes aparecen arriba.')+
      guideCard('☆','Perfil, ranking y logros','','Consulta aciertos, marcas y logros. Solo los aciertos de retos diarios completados suman al ranking, una vez por día y mazo. Al terminar puedes repasar los fallos; tu colección se completa al jugar las cartas.')+
      guideCard('☼','A tu gusto','','En Ajustes prueba tema y tamaño del texto antes de aplicarlos. Música ambiente y vibración son independientes; la vibración depende del dispositivo.')+'</div><p>Tu perfil invitado pertenece a esta instalación: cambiar de móvil o borrar sus datos puede hacerte perder el progreso.</p>';
    return '<div class="guide-handbook"><header class="atlas-page-heading"><div class="eyebrow">Una carta. Su lugar.</div><h1>Guía</h1><p>Lo esencial para empezar. Los detalles, cuando los necesites.</p></header><section class="guide-start"><h2>Aprende en tres pasos</h2>'+
      '<p class="guide-context">'+here+' · Ejemplo: '+escapeHtml(selectedMode.name)+'</p><p class="guide-lead">Ordena las cartas '+order+'. La partida empieza con una carta de referencia. Tu carta tiene el valor oculto: elige su lugar y confirma para descubrirlo.</p>'+
      '<ol class="guide-steps">'+guideStep(1,'Elige','Toca una carta de tu mano.')+guideStep(2,'Sitúa','Toca un hueco o arrastra la carta. Puedes cambiar de idea.')+guideStep(3,'Confirma','Pulsa «Confirmar posición» para resolver.')+'</ol>'+
      guideDemo(modeKey)+'<p class="guide-note">El ensayo se resuelve al tocar el hueco; en la partida debes confirmar. No gasta vidas ni modifica tu progreso.</p>'+
      '<p class="guide-note">¿Dos cartas con el mismo valor? Valen los dos órdenes.'+(selectedMode.axis==='time'?' Las fechas a. C. van antes que las d. C.; 500 a. C. va antes que 100 a. C.':' Compara la cifra y su unidad, no el tamaño del dibujo.')+(pending?' Las cartas «en revisión» se juegan con el valor mostrado.':'')+'</p>'+
      '</section><div class="atlas-section-heading"><h2>El juego, capítulo a capítulo</h2><p class="guide-index-hint">Abre el tema que quieras consultar.</p></div>'+
      guideChapter('01','Aciertos, fallos y victoria','Qué cambia después de confirmar','result',result)+
      guideChapter('02','Elige cómo jugar','Solo, con amigos o por enlace','modes',formats)+
      guideChapter('03','Fantasma y Pulso','Poderes opcionales y sus consecuencias','powers',powers)+
      guideChapter('04','Competición por capítulos','Rondas, vidas y puntuación','chapters',chapters)+
      guideChapter('05','Muévete por el tablero','Gestos, zoom y salir de la partida','line',controls)+
      guideChapter('06','Tu colección y tu progreso','Álbum, ranking, logros y ajustes','atlas',progress)+'</div>';
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
    MODES, BLOCKS, DEFAULT_MODE, DEFAULT_BLOCK, MIXED_DUPLICATE_INVENTION_IDS,
    has, mode, axis, cards,
    pulseRules: PULSE_RULES,
    usesAnimalArt, cardArt, animalArt, cardBack, deckFingerprint, categoryFor, categoryBadge,
    hasBlock, block, blockOf, blockGames,
    formatValue, shortValue, sortValue, hiddenLabel, timelineTitle, question, eraForCard,
    correctIndex, placementHint, guideMarkup,
    escapeHtml, initials, shuffle, seedFrom, seededRandom, shuffleWith
  };
})();
