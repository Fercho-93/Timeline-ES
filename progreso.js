// El perfil: qué has jugado, qué se te da bien y qué no. Vive en su propia clave y solo
// agrega — `hilo-retos-v1` sigue guardando el reto diario, la racha y los récords por mazo
// exactamente igual que antes, así que una instalación vieja no pierde nada al actualizar
// y una instalación nueva empieza con el perfil a cero sin que nada más se entere.
//
// Aquí no se pinta nada: este archivo cuenta y decide qué logros hay desbloqueados. La
// pantalla la monta `app.js`, igual que hace con la enciclopedia.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  const KEY = "hilo-perfil-v1";
  // El identificador anónimo del jugador. Nació en `app.js` para el récord del reto
  // diario y vive aquí desde que hay perfil, para no tener dos sitios que lo generen.
  const PLAYER_KEY = "hilo-jugador-v1";
  const VERSION = 1;
  // Las cartas falladas se guardan una a una para poder decir cuáles se atragantan. Son
  // como mucho las 961 del juego, pero no hace falta arrastrarlas todas: con las peores
  // basta para lo que enseña la pantalla, y el almacenamiento de un móvil no es infinito.
  const MAX_MISSES = 300;

  function today() { return new Date().toLocaleDateString("sv-SE"); }

  function emptyProfile() {
    return {
      version: VERSION,
      playerId: null,
      createdAt: new Date().toISOString(),
      // `run` es la tirada de aciertos en curso; `bestRun`, la mejor que se ha tenido.
      totals: { games: 0, cards: 0, hits: 0, wins: 0, run: 0, bestRun: 0 },
      // Los hitos que no se deducen de los totales: hacen falta para los logros y son
      // más baratos de contar en el momento que de reconstruir después.
      marks: { perfectDaily: 0, bestStreak: 0, ghostHits: 0, pulseHits: 0, expertClears: 0, comps: 0, bigWins: 0, onlineWins: 0 },
      byMode: {},
      byBand: {},
      misses: {},
      achievements: {},
      // Las últimas jugadas de sala ya contadas, como `CÓDIGO:versión`. Ver `recordOnline`.
      seenOnline: [],
      lastOnline: ""
    };
  }

  // Se rellenan los huecos en vez de confiar en lo guardado: un perfil escrito por una
  // versión anterior puede no traer un contador que aquí ya se lee, y leerlo de menos
  // rompería la pantalla entera en vez de enseñar un cero.
  function normalize(stored) {
    const base = emptyProfile();
    if (!stored || typeof stored !== "object") return base;
    return {
      ...base, ...stored,
      totals: { ...base.totals, ...stored.totals },
      marks: { ...base.marks, ...stored.marks },
      byMode: { ...stored.byMode },
      byBand: { ...stored.byBand },
      misses: { ...stored.misses },
      achievements: { ...stored.achievements },
      seenOnline: Array.isArray(stored.seenOnline) ? stored.seenOnline.slice(-SEEN_ONLINE) : []
    };
  }

  function read() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch { return emptyProfile(); }
  }

  function save(profile) {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* almacenamiento lleno */ }
    return profile;
  }

  function playerId() {
    try {
      let id = localStorage.getItem(PLAYER_KEY);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(PLAYER_KEY, id);
      }
      return id;
    } catch { return null; }
  }

  // Un mapa por mazo, construido la primera vez que se pide: registrar una carta necesita
  // su banda, y buscarla recorriendo las 167 del mazo en cada jugada sería tirar trabajo.
  const cardCache = new Map();

  function cardById(modeKey, cardId) {
    if (!cardCache.has(modeKey)) cardCache.set(modeKey, new Map(CT.cards(modeKey).map(card => [card.id, card])));
    return cardCache.get(modeKey).get(cardId) || null;
  }

  function modeEntry(profile, modeKey) {
    return profile.byMode[modeKey] || (profile.byMode[modeKey] = { games: 0, cards: 0, hits: 0, byKind: {} });
  }

  // Solo se conservan las cartas que más se fallan: las que se fallaron una vez y hace
  // meses no dicen nada que la pantalla vaya a enseñar.
  function pruneMisses(profile) {
    const entries = Object.entries(profile.misses);
    if (entries.length <= MAX_MISSES) return;
    entries.sort((a, b) => b[1].count - a[1].count || String(b[1].lastDay).localeCompare(String(a[1].lastDay)));
    profile.misses = Object.fromEntries(entries.slice(0, MAX_MISSES));
  }

  // ---------------------------------------------------------------------------
  // Los logros
  //
  // Cada uno dice cuánto llevas (`have`) y cuánto hace falta (`goal`), y de ahí salen las
  // dos cosas que la pantalla necesita: si está desbloqueado y qué barra pintar mientras
  // no lo esté. Se evalúan solo al registrar una jugada o al terminar una partida, nunca
  // al repintar, así que un logro no puede desbloquearse dos veces ni saltar sin motivo.
  // ---------------------------------------------------------------------------
  const TOTAL_MAZOS = Object.keys(CT.MODES).length;

  function bestModeCards(profile) {
    return Math.max(0, ...Object.values(profile.byMode).map(entry => entry.cards));
  }

  function fineDecks(profile) {
    return Object.values(profile.byMode).filter(entry => entry.cards >= 50 && entry.hits / entry.cards >= 0.9).length;
  }

  const ACHIEVEMENTS = [
    { key: "primera", group: "Constancia", name: "La primera", desc: "Termina una partida, la que sea.", have: p => p.totals.games, goal: 1 },
    { key: "semana", group: "Constancia", name: "Una semana", desc: "Encadena 7 retos diarios seguidos.", have: p => p.marks.bestStreak, goal: 7 },
    { key: "mes", group: "Constancia", name: "Un mes entero", desc: "Encadena 30 retos diarios seguidos.", have: p => p.marks.bestStreak, goal: 30 },

    { key: "pleno", group: "Puntería", name: "Reto perfecto", desc: "Acierta las quince cartas de un reto diario.", have: p => p.marks.perfectDaily, goal: 1 },
    { key: "tirada", group: "Puntería", name: "Veinticinco seguidas", desc: "Coloca 25 cartas seguidas sin fallar ninguna.", have: p => p.totals.bestRun, goal: 25 },
    { key: "finura", group: "Puntería", name: "Nueve de cada diez", desc: "Llega al 90 % de aciertos en un mazo con 50 cartas jugadas.", have: fineDecks, goal: 1 },

    { key: "coleccion", group: "Recorrido", name: "Coleccionista", desc: `Juega al menos una carta de los ${TOTAL_MAZOS} mazos.`, have: p => Object.keys(p.byMode).length, goal: TOTAL_MAZOS },
    { key: "competicion", group: "Recorrido", name: "Vuelta completa", desc: "Termina una competición entera, tema a tema.", have: p => p.marks.comps, goal: 1 },
    { key: "centenario", group: "Recorrido", name: "Cien en un mazo", desc: "Juega 100 cartas de un mismo mazo.", have: bestModeCards, goal: 100 },
    { key: "maraton", group: "Recorrido", name: "Quinientas cartas", desc: "Coloca 500 cartas en total.", have: p => p.totals.cards, goal: 500 },

    { key: "mesa", group: "Oficio", name: "Mesa llena", desc: "Termina una partida de 5 personas o más en un solo móvil.", have: p => p.marks.bigWins, goal: 1 },
    { key: "pulso", group: "Oficio", name: "Pulso firme", desc: "Acierta la carta de un Pulso que hayas lanzado tú.", have: p => p.marks.pulseHits, goal: 1 },
    { key: "fantasma", group: "Oficio", name: "A ciegas", desc: "Acierta una carta con los valores ocultos por el Fantasma.", have: p => p.marks.ghostHits, goal: 1 },
    { key: "experto", group: "Oficio", name: "Nivel experto", desc: "Completa un mazo en partida libre y en Experto.", have: p => p.marks.expertClears, goal: 1 },
    { key: "sala", group: "Oficio", name: "Ganar en sala", desc: "Gana una partida de varios móviles.", have: p => p.marks.onlineWins, goal: 1 },
    { key: "habitual", group: "Oficio", name: "Cincuenta partidas", desc: "Termina cincuenta partidas, del formato que sea.", have: p => p.totals.games, goal: 50 }
  ];

  // Devuelve los que se acaban de desbloquear, para anunciarlos. Los ya desbloqueados no
  // se vuelven a mirar: su fecha es la del día en que se consiguieron, no la de hoy.
  function unlock(profile) {
    const nuevos = [];
    for (const item of ACHIEVEMENTS) {
      if (profile.achievements[item.key]) continue;
      if (item.have(profile) < item.goal) continue;
      profile.achievements[item.key] = { unlockedAt: new Date().toISOString() };
      nuevos.push({ key: item.key, name: item.name, desc: item.desc, group: item.group });
    }
    return nuevos;
  }

  // ---------------------------------------------------------------------------
  // Registro
  // ---------------------------------------------------------------------------

  // Una colocación resuelta. `hidden` es que el tablero estuviera oculto (Fantasma o
  // Experto) y `pulse`, que la carta viniera de un Pulso lanzado por quien registra.
  function apply(profile, { mode, cardId, correct, kind = "free", hidden = false, pulse = false }) {
    if (!CT.has(mode)) return;
    profile.playerId = profile.playerId || playerId();
    profile.totals.cards += 1;
    const entry = modeEntry(profile, mode);
    entry.cards += 1;
    entry.byKind[kind] = (entry.byKind[kind] || 0) + 1;

    const card = cardById(mode, cardId);
    if (card) {
      const band = CT.eraForCard(mode, card);
      // La clave lleva el mazo delante: «antigua» existe en varios ejes y sin él se
      // sumarían en el mismo saco las épocas de Historia y las magnitudes de Peso.
      const bandKey = `${mode}:${band.key}`;
      const stats = profile.byBand[bandKey] || (profile.byBand[bandKey] = { mode, band: band.key, hits: 0, misses: 0 });
      stats[correct ? "hits" : "misses"] += 1;
    }

    if (correct) {
      profile.totals.hits += 1;
      entry.hits += 1;
      profile.totals.run += 1;
      profile.totals.bestRun = Math.max(profile.totals.bestRun, profile.totals.run);
      if (hidden) profile.marks.ghostHits += 1;
      if (pulse) profile.marks.pulseHits += 1;
    } else {
      profile.totals.run = 0;
      if (card) {
        const miss = profile.misses[cardId] || (profile.misses[cardId] = { mode, count: 0, lastDay: "" });
        miss.mode = mode;
        miss.count += 1;
        miss.lastDay = today();
      }
    }
  }

  function record(event) {
    const profile = read();
    apply(profile, event);
    pruneMisses(profile);
    const nuevos = unlock(profile);
    save(profile);
    return nuevos;
  }

  // Fin de partida. `won` solo llega de una sala: es el único formato donde el juego sabe
  // cuál de las personas eres tú. En un móvil compartido gana alguien de la mesa, pero no
  // hay manera de saber quién lo sostiene, así que esa partida se cuenta como jugada y no
  // como ganada — apuntarse una victoria ajena sería inventarse el dato.
  function finishGame({ mode, kind = "free", hits = 0, total = 0, won = false, difficulty = "easy", players = 0, streak = 0, lives = 0 }) {
    const profile = read();
    if (!CT.has(mode)) return [];
    profile.playerId = profile.playerId || playerId();
    profile.totals.games += 1;
    modeEntry(profile, mode).games += 1;
    if (won && kind === "online") profile.totals.wins += 1;
    if (kind === "daily") {
      if (total > 0 && hits === total) profile.marks.perfectDaily += 1;
      profile.marks.bestStreak = Math.max(profile.marks.bestStreak, streak);
    }
    // Completar el mazo en Experto, no simplemente jugarlo: el logro es terminar con
    // vidas, que es lo que distingue haberlo hecho de haberlo intentado.
    if (kind === "free" && difficulty === "expert" && lives > 0) profile.marks.expertClears += 1;
    if (kind === "local" && players >= 5) profile.marks.bigWins += 1;
    if (kind === "online" && won) profile.marks.onlineWins += 1;
    const nuevos = unlock(profile);
    save(profile);
    return nuevos;
  }

  // La competición se cuenta aparte: cada ronda ya pasó por `finishGame` con su propio
  // mazo, y lo que premia el logro es haberlas jugado todas de seguido.
  function finishCompetition() {
    const profile = read();
    profile.marks.comps += 1;
    const nuevos = unlock(profile);
    save(profile);
    return nuevos;
  }

  // Una jugada de sala llega por instantánea de Firestore, y la misma instantánea puede
  // llegar más de una vez: al reconectar, al volver a primer plano, o porque la caché
  // local entrega su copia antes que el servidor la suya. `version` la mantienen las
  // transacciones de la sala y es distinta en cada cambio de estado, así que
  // `CÓDIGO:versión` identifica una jugada sin ambigüedad.
  //
  // No basta con recordar la última contada: dos instantáneas pueden llegar desordenadas
  // y entonces la anterior volvería a parecer nueva. Se guarda una lista corta de las
  // últimas vistas, que es lo que de verdad hace que una repetición no sume dos veces.
  const SEEN_ONLINE = 40;

  function alreadySeen(profile, stamp) {
    const seen = Array.isArray(profile.seenOnline) ? profile.seenOnline : [];
    if (seen.includes(stamp)) return true;
    profile.seenOnline = [...seen, stamp].slice(-SEEN_ONLINE);
    // Se sigue escribiendo la última vista, que es lo que se enseña al depurar y lo que
    // leería una versión anterior de este archivo.
    profile.lastOnline = stamp;
    return false;
  }

  // Solo se cuenta lo propio: cada móvil registra sus cartas, no las de la mesa entera.
  function recordOnline({ code, version, mine, mode, cardId, correct, hidden = false, pulse = false }) {
    if (!mine) return [];
    const profile = read();
    if (alreadySeen(profile, `${code}:${version}`)) return [];
    apply(profile, { mode, cardId, correct, kind: "online", hidden, pulse });
    pruneMisses(profile);
    const nuevos = unlock(profile);
    save(profile);
    return nuevos;
  }

  // El final de una sala, con la misma guarda: la instantánea de «terminada» se reenvía
  // igual que cualquier otra, y sin esto una reconexión sumaría otra partida.
  function finishOnline({ code, version, mode, won }) {
    const profile = read();
    if (alreadySeen(profile, `${code}:${version}`)) return [];
    save(profile);
    return finishGame({ mode, kind: "online", won });
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch { /* nada que borrar */ }
    return emptyProfile();
  }

  // ---------------------------------------------------------------------------
  // Vistas: lo que la pantalla necesita, ya calculado
  // ---------------------------------------------------------------------------

  function summary(profile = read()) {
    const { games, cards, hits, wins, bestRun } = profile.totals;
    return {
      games, cards, hits, wins, bestRun,
      bestStreak: profile.marks.bestStreak,
      accuracy: cards ? Math.round((hits / cards) * 100) : 0,
      unlocked: Object.keys(profile.achievements).length,
      total: ACHIEVEMENTS.length
    };
  }

  // Una fila por mazo jugado, de más jugado a menos. Los mazos sin estrenar no salen: la
  // lista es lo que llevas hecho, no un inventario de lo que falta.
  function modeRows(profile = read()) {
    return Object.entries(profile.byMode)
      .filter(([modeKey]) => CT.has(modeKey))
      .map(([modeKey, entry]) => ({
        mode: modeKey,
        name: CT.mode(modeKey).name,
        games: entry.games,
        cards: entry.cards,
        hits: entry.hits,
        accuracy: entry.cards ? Math.round((entry.hits / entry.cards) * 100) : 0
      }))
      .sort((a, b) => b.cards - a.cards || a.name.localeCompare(b.name, "es"));
  }

  // Las bandas donde más se falla. Se piden al menos cinco intentos: con dos cartas
  // jugadas, un 50 % de aciertos no es un punto débil, es no haber jugado todavía.
  function weakBands(limit = 5, profile = read()) {
    const MIN = 5;
    return Object.values(profile.byBand)
      .filter(stats => CT.has(stats.mode) && stats.hits + stats.misses >= MIN && stats.misses > 0)
      .map(stats => {
        const played = stats.hits + stats.misses;
        const band = bandInfo(stats.mode, stats.band);
        return {
          mode: stats.mode,
          modeName: CT.mode(stats.mode).name,
          band: stats.band,
          name: band ? band.name : stats.band,
          symbol: band ? band.symbol : "·",
          played,
          misses: stats.misses,
          accuracy: Math.round((stats.hits / played) * 100)
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy || b.misses - a.misses)
      .slice(0, limit);
  }

  function bandInfo(modeKey, bandKey) {
    const bands = CT.mode(modeKey).bands || CT.axis(modeKey).bands;
    return bands.find(band => band.key === bandKey) || null;
  }

  // Las cartas que más se atragantan, para poder ir a verlas a la enciclopedia.
  function weakCards(limit = 5, profile = read()) {
    return Object.entries(profile.misses)
      .filter(([, miss]) => CT.has(miss.mode))
      .map(([id, miss]) => {
        const card = cardById(miss.mode, Number(id));
        return card ? { id: Number(id), mode: miss.mode, title: card.title, modeName: CT.mode(miss.mode).name, count: miss.count, lastDay: miss.lastDay } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "es"))
      .slice(0, limit);
  }

  function achievements(profile = read()) {
    return ACHIEVEMENTS.map(item => {
      const have = Math.min(item.have(profile), item.goal);
      return {
        key: item.key, group: item.group, name: item.name, desc: item.desc,
        goal: item.goal, have,
        unlocked: !!profile.achievements[item.key],
        unlockedAt: profile.achievements[item.key]?.unlockedAt || null
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Copia de seguridad
  //
  // Todo esto vive en un solo móvil: un borrado de datos del navegador, un cambio de
  // teléfono o un modo privado se lo llevan sin remedio y sin aviso. Poder sacarlo y
  // volver a meterlo es lo mínimo antes de pedirle a alguien que juegue treinta días
  // seguidos para conseguir un logro.
  // ---------------------------------------------------------------------------

  function exportJson() {
    return JSON.stringify(read(), null, 2);
  }

  // Se acepta lo que se pueda leer y se descarta el resto: un perfil ajeno o de otra
  // versión es preferible a medias que un error. Lo que no se toca nunca es el
  // identificador del móvil, que es de este móvil y no del archivo.
  function importJson(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return { ok: false, error: "El texto no es un perfil válido." }; }
    if (!parsed || typeof parsed !== "object" || !parsed.totals) return { ok: false, error: "El texto no es un perfil de Continuum." };
    const profile = normalize(parsed);
    profile.version = VERSION;
    profile.playerId = playerId();
    pruneMisses(profile);
    save(profile);
    return { ok: true, summary: summary(profile) };
  }

  CT.Progreso = {
    KEY, ACHIEVEMENTS,
    read, record, recordOnline, finishGame, finishOnline, finishCompetition, reset, playerId,
    summary, modeRows, weakBands, weakCards, achievements,
    exportJson, importJson
  };
})();
