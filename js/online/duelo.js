// El duelo por enlace: retar a alguien sin servidor, sin cuentas y sin que los dos
// móviles tengan que estar encendidos a la vez.
//
// La idea es la misma que sostiene el reto diario: dos móviles que barajan con la misma
// semilla reciben exactamente las mismas cartas. Ahí la semilla es la fecha; aquí viaja
// dentro del enlace, junto con la marca de quien reta. Por eso un duelo funciona con la
// aplicación instalada y sin conexión: no hay nada que consultar, todo lo que hace falta
// está en la propia dirección.
//
// Aquí no se pinta ni se juega nada: esto codifica, descodifica y valida. La partida la
// lleva el motor del solitario tal cual, con `solo.kind = "duel"`.
(function () {
  "use strict";

  const CT = window.CONTINUUM;
  // Las cartas de un duelo: diez, como el reto diario, el duelo de cifras y los Retos rápidos
  // con varias personas, para que todas las marcas del juego sean del mismo tamaño. Cada
  // enlace lleva su `total`, así que los duelos de quince que ya circulan se siguen jugando.
  const CARTAS = 10;
  // Un tope por encima de lo que genera la aplicación, para que un enlace manipulado no
  // pueda pedir un reparto desmesurado.
  const MAX_CARTAS = 40;
  const MAX_NOMBRE = 18;

  // Los dos duelos se juegan a reloj, por la misma razón: sin un plazo por carta no hay
  // nada que impida ir a buscar la respuesta a otra parte, y quien la busca gana. El
  // plazo es el mismo en las dos modalidades, que es lo que las hace una sola cosa con
  // dos maneras de jugarla en vez de dos juegos.
  const SEGUNDOS = 15;
  const MS = SEGUNDOS * 1000;
  // Salir de la aplicación cierra la carta abierta, pero no a la primera: por debajo de
  // este margen caben un aviso que se cuela, una llamada entrante o un roce en el gesto
  // de multitarea, y ninguna de esas tres cosas puede costar una carta. Por debajo de él
  // tampoco da tiempo a consultar nada en ninguna parte.
  const GRACIA_MS = 1500;

  // Qué reglas lleva cada versión de la carga útil. La versión no numera el formato:
  // numera las reglas con las que se jugó, porque dos partidas con plazos distintos no se
  // pueden comparar y el marcador mentiría sin avisar. Por eso las versiones viejas no se
  // rechazan: se leen con su propio plazo y se juegan como se jugaron. `ms: 0` es un
  // duelo de antes de que hubiera reloj.
  const REGLAS = {
    "1": { cifras: false, ms: 0 },
    "2": { cifras: true, ms: 10000 },
    "3": { cifras: false, ms: 20000 },
    "4": { cifras: false, ms: MS },
    "5": { cifras: true, ms: MS },
    // El plazo ya se elige al crear el duelo: sin tiempo, 15, 20 o 30 segundos por carta.
    "6": { cifras: false, ms: 30000 },
    "7": { cifras: true, ms: 0 },
    "8": { cifras: true, ms: 20000 },
    "9": { cifras: true, ms: 30000 },
    // La competición con las mismas cartas: varios temas seguidos de Grandes colecciones, siempre
    // de ordenar. Lleva sus propias versiones, una por plazo, porque se lee distinto (varios
    // mazos, una huella por mazo y una cuadrícula que cubre todos los temas). La carga útil
    // conserva los ocho campos, así que una aplicación anterior no la da por rota: no conoce la
    // versión y pide actualizar.
    "10": { cifras: false, ms: 0, comp: true },
    "11": { cifras: false, ms: MS, comp: true },
    "12": { cifras: false, ms: 20000, comp: true },
    "13": { cifras: false, ms: 30000, comp: true }
  };
  // La versión que corresponde a una prueba y un plazo. Un plazo que no tiene versión se
  // juega con el de siempre, 15 segundos.
  function versionDe(cifras, ms = MS) {
    // La «2» (cifras a 10 s) es de antes y ya no se crea.
    const clave = Object.keys(REGLAS).find(v => v !== "2" && !REGLAS[v].comp && REGLAS[v].cifras === cifras && REGLAS[v].ms === Number(ms));
    return clave || (cifras ? "5" : "4");
  }
  function versionCompeticion(ms = MS) {
    return Object.keys(REGLAS).find(v => REGLAS[v].comp && REGLAS[v].ms === Number(ms)) || "11";
  }
  // Una competición por enlace: de uno a cinco temas (la aplicación ofrece 3 o 5) y de una a seis
  // cartas por tema, como el resto de competiciones con amigos. Con cinco temas y seis cartas son
  // 30, el mismo tope que la competición por turnos.
  const COMP_TEMAS = 5;
  const COMP_CARTAS = 6;
  // Sin reloj, la rapidez sigue desempatando las cifras: se mide contra un tope amplio
  // (diez minutos por carta) en vez de contra el plazo.
  const SIN_RELOJ_MS = 600000;
  const tope = ms => Number(ms) > 0 ? Number(ms) : SIN_RELOJ_MS;

  // La huella del mazo —compartida con las salas, en modes.js—. No es opcional: si los
  // dos móviles llevan versiones distintas de la aplicación, el mazo puede haber
  // cambiado —ha pasado con animales, países y distancias— y entonces la misma semilla
  // reparte cartas distintas. El duelo parecería ir bien y estaría comparando dos
  // partidas que no son la misma. Antes de repartir se comprueba, y si no cuadra se
  // avisa en vez de jugar.
  const huella = CT.deckFingerprint;

  function crearSemilla() {
    return Math.random().toString(36).slice(2, 10);
  }

  function baraja(modeKey, seed) {
    // Se aparta una carta de cada grupo con el mismo valor, al azar pero con la semilla del
    // duelo: los dos móviles excluyen exactamente las mismas.
    const ids = CT.uniqueValueIds(modeKey, CT.cards(modeKey).map(card => card.id), CT.seededRandom(CT.seedFrom(`${seed}:${modeKey}:iguales`)));
    return CT.shuffleWith(ids, CT.seededRandom(CT.seedFrom(`${seed}:${modeKey}`)));
  }

  // El reparto de un duelo: la primera carta abre la línea y el resto se van jugando.
  // Dos móviles con el mismo mazo, la misma semilla y el mismo número reciben esto
  // idéntico, que es lo único que hace falta para que el duelo sea comparable.
  function reparto(modeKey, seed, total = CARTAS) {
    return baraja(modeKey, seed).slice(0, total + 1);
  }

  // ——— El duelo de cifras ———
  //
  // El otro duelo ordena cartas; este pide el número: diez cartas, el mismo plazo por
  // carta que el de orden, y gana quien tenga más aciertos (la rapidez desempata).
  //
  // El plazo no es un adorno. Es lo único que hace que no compense buscar la
  // respuesta en otro sitio, y por eso el reloj se cuenta siempre restando marcas de
  // `Date.now()` y nunca con un contador que vaya bajando solo: una pestaña escondida
  // congela sus temporizadores, y un contador ingenuo se pararía justo mientras alguien
  // busca la respuesta —premiando exactamente lo que se quiere evitar—. La misma razón
  // obliga a guardar el instante en que empezó la carta: si la partida se reanuda, el
  // tiempo transcurrido se mide contra el reloj de verdad, no contra lo que quedaba.
  const CIFRAS_CARTAS = 10;
  const CIFRAS_SEGUNDOS = SEGUNDOS;
  const CIFRAS_MS = MS;
  const PUNTOS_TINO = 60;
  const PUNTOS_PRISA = 40;
  const PUNTOS_CARTA = PUNTOS_TINO + PUNTOS_PRISA;
  // Un tope para las respuestas: por encima de esto no hay cifra que valga en ningún
  // mazo, y sí hay números que dejarían de caber en la carga útil.
  const MAX_CIFRA = 1e15;

  // Acertar de lejos también puntúa. La escala es ancha a propósito: el juego premia
  // tener una idea del orden de magnitud, no clavar dígitos que nadie puede saber.
  const FUERA = { puntos: 0, nombre: "Fuera" };
  const BANDAS_RELATIVAS = [
    { limite: 0.05, puntos: 60, nombre: "Clavado" },
    { limite: 0.10, puntos: 50, nombre: "Muy cerca" },
    { limite: 0.25, puntos: 38, nombre: "Cerca" },
    { limite: 0.50, puntos: 24, nombre: "A medias" },
    { limite: 1, puntos: 12, nombre: "Lejos" }
  ];
  // Las fechas no se puntúan por porcentaje: errar un siglo es errar un siglo tanto en
  // el año 200 como en el 1900, y un 10% de error sobre el año 15 a. C. no significa nada.
  const BANDAS_ANOS = [
    { limite: 1, puntos: 60, nombre: "Clavado" },
    { limite: 3, puntos: 50, nombre: "Muy cerca" },
    { limite: 7, puntos: 38, nombre: "Cerca" },
    { limite: 15, puntos: 24, nombre: "A medias" },
    { limite: 30, puntos: 12, nombre: "Lejos" }
  ];

  function reglaCifra(modeKey) { return CT.axis(modeKey).cifra || {}; }

  // Lo que escribe una persona, que puede traer su unidad detrás: «40 g», «2,5 t»,
  // «3 días», «47 millones». El número se lee a la española —puntos de millar, coma
  // decimal— y la unidad se convierte a la del mazo, que es la que ordena las cartas.
  // Una unidad que no se reconoce no se ignora: la respuesta entera se descarta, porque
  // dar por buenos «40 lunas» como si fueran cuarenta kilos sería puntuar otra cosa.
  // Compartida por el duelo de cifras, el reto diario y el sorteo de quién empieza —local
  // y online—, que son los tres sitios donde alguien escribe una cifra a mano.
  function leerCifra(modeKey, texto) {
    const crudo = String(texto || "").trim().replace(/[−–—]/g, "-");
    if (!crudo) return null;
    // El número es lo que va delante; lo que quede detrás, si algo queda, es la unidad.
    const partido = crudo.match(/^(-?[\d.,\s ]*\d)\s*(.*)$/);
    if (!partido) return null;
    const [, numero, unidad] = partido;

    let limpio = numero.replace(/[\s ]/g, "");
    if (limpio.includes(",")) limpio = limpio.replace(/\./g, "").replace(",", ".");
    else {
      const trozos = limpio.split(".");
      if (trozos.length > 1 && trozos.slice(1).every(parte => parte.length === 3)) limpio = trozos.join("");
    }
    if (!/^-?\d*\.?\d*$/.test(limpio) || !/\d/.test(limpio)) return null;

    const factor = factorDe(modeKey, unidad);
    if (factor === null) return null;
    const valor = Number(limpio) * factor;
    if (!Number.isFinite(valor) || Math.abs(valor) > MAX_CIFRA) return null;
    if (valor < 0 && !reglaCifra(modeKey).negativos) return null;
    return valor;
  }

  // Diez cartas del mazo, sin la que abre la línea: aquí no hay línea que abrir.
  function repartoCifras(modeKey, seed, total = CIFRAS_CARTAS) {
    return baraja(modeKey, seed).slice(0, total);
  }

  function cartasCifras(modeKey, seed, total = CIFRAS_CARTAS) {
    const porId = new Map(CT.cards(modeKey).map(card => [card.id, card]));
    return repartoCifras(modeKey, seed, total).map(id => porId.get(id));
  }

  // Cuánto se ha acercado una respuesta, sin contar la prisa.
  function banda(modeKey, card, respuesta) {
    if (respuesta === null || !Number.isFinite(respuesta) || !card) return FUERA;
    const real = CT.sortValue(modeKey, card);
    if (!Number.isFinite(real)) return FUERA;
    const porAnos = !!reglaCifra(modeKey).anos;
    const bandas = porAnos ? BANDAS_ANOS : BANDAS_RELATIVAS;
    const error = porAnos || real === 0
      ? Math.abs(respuesta - real)
      : Math.abs(respuesta - real) / Math.abs(real);
    return bandas.find(tramo => error <= tramo.limite) || FUERA;
  }

  // Los puntos de una carta. Salir de la aplicación la deja a cero entera; agotar el
  // tiempo con algo escrito no: la respuesta cuenta, pero se queda sin la parte de la
  // prisa, que es justo lo que se pierde por tardar.
  //
  // El plazo entra como argumento y no como constante porque la parte de la prisa se
  // mide contra él: una partida jugada con otro plazo hay que volver a puntuarla con el
  // suyo, o sus puntos no cuadrarían al recalcularlos.
  function puntosCarta(modeKey, card, jugada, plazo = CIFRAS_MS) {
    if (!jugada || jugada.salida) return 0;
    const acierto = banda(modeKey, card, jugada.respuesta).puntos;
    if (!acierto) return 0;
    plazo = tope(plazo);
    const usado = Math.min(Math.max(Number(jugada.ms) || 0, 0), plazo);
    return acierto + Math.round(PUNTOS_PRISA * ((plazo - usado) / plazo));
  }

  // Lo que se enseña y lo que decide quién gana: cada carta es un acierto o no. Es acierto quedarse en
  // «Cerca» o mejor (un 25 % en las cifras, 7 años en las fechas). La rapidez no suma: solo desempata,
  // y gana quien haya tardado menos en total. Los puntos de arriba siguen viajando en el enlace, porque
  // con ellos se comprueba que la marca no se ha tocado, pero ya no se enseñan.
  const UMBRAL_ACIERTO = 38;
  function acierto(modeKey, card, jugada) {
    return !!jugada && !jugada.salida && banda(modeKey, card, jugada.respuesta).puntos >= UMBRAL_ACIERTO;
  }
  function aciertosPartida(modeKey, seed, total, jugadas) {
    const cartas = cartasCifras(modeKey, seed, total);
    return jugadas.filter((jugada, i) => acierto(modeKey, cartas[i], jugada)).length;
  }
  function tiempoPartida(jugadas, plazo = CIFRAS_MS) {
    plazo = tope(plazo);
    return jugadas.reduce((suma, jugada) => suma + (jugada.salida ? plazo : Math.min(Math.max(Number(jugada.ms) || 0, 0), plazo)), 0);
  }
  // 1 si gana `a`, -1 si gana `b`, 0 si empatan en aciertos y en tiempo.
  function comparaCifras(a, b) {
    if (a.aciertos !== b.aciertos) return a.aciertos > b.aciertos ? 1 : -1;
    if (a.tiempo !== b.tiempo) return a.tiempo < b.tiempo ? 1 : -1;
    return 0;
  }

  function puntosPartida(modeKey, seed, total, jugadas, plazo = CIFRAS_MS) {
    const cartas = cartasCifras(modeKey, seed, total);
    return jugadas.reduce((suma, jugada, i) => suma + puntosCarta(modeKey, cartas[i], jugada, plazo), 0);
  }

  // La respuesta escrita, con la unidad del mazo. El eje formatea cartas, así que se le
  // pasa una carta de mentira con el valor dentro: es el mismo dato en los dos campos
  // porque unos ejes leen `value` y el de fechas lee `year`.
  function formatoCifra(modeKey, valor) {
    if (valor === null || !Number.isFinite(valor)) return "sin respuesta";
    try { return CT.formatValue(modeKey, { value: valor, year: valor }); }
    catch { return String(valor); }
  }

  // ——— Las unidades ———
  //
  // Cada mazo ordena sus cartas por un número en una sola unidad —kilos, años, km/h—,
  // pero las cartas se enseñan en la que toque: la hormiga en miligramos y la ballena en
  // toneladas. Pedir las dos «en kilos» obligaría a escribir 0,0000001 para una y sería
  // injugable, así que la respuesta admite su unidad y aquí se convierte a la del mazo.
  //
  // No se acepta una unidad por carta, que sería regalar el orden de magnitud: se
  // aceptan todas las del mazo, y elegir la correcta sigue siendo parte de saberlo.
  const SIN_TILDES = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u", "²": "2", "³": "3" };

  function normaliza(texto) {
    return String(texto || "").trim().toLowerCase()
      .replace(/[áéíóúü²³]/g, letra => SIN_TILDES[letra])
      .replace(/\s+/g, " ")
      .replace(/\.$/, "");
  }

  // Las unidades del mazo, de la más grande a la más pequeña, para enseñarlas y para
  // buscarlas. La primera de la lista es siempre la del propio mazo.
  function unidades(modeKey) {
    return (reglaCifra(modeKey).unidades || []).map(([nombre, factor]) => ({ nombre, factor }));
  }

  // A cuánto equivale una unidad escrita. Devuelve `null` si no la reconoce, que es lo
  // que distingue «2 lunas» —que no significa nada aquí— de «2», que son las del mazo.
  function factorDe(modeKey, escrita) {
    const busca = normaliza(escrita);
    if (!busca) return 1;
    for (const { nombre, factor } of unidades(modeKey)) {
      const clave = normaliza(nombre);
      // El plural y el singular valen igual: «3 dias» y «1 dia», «40 g» y «40 gramos».
      if (busca === clave || busca + "s" === clave || busca === clave + "s" || busca === clave.replace(/es$/, "")) return factor;
    }
    // Unos cuantos sinónimos que la gente escribe y que no merecen una fila en el eje.
    const sinonimos = {
      kilo: "kg", kilos: "kg", kilogramos: "kg", gramos: "g", miligramos: "mg",
      tonelada: "t", toneladas: "t", ano: "años", anos: "años", "año": "años",
      dia: "días", hectareas: "ha", hectarea: "ha", metros: "m", kilometros: "km",
      millon: "millones", "millon de": "millones", habitante: "habitantes", hablante: "hablantes"
    };
    const alias = sinonimos[busca];
    return alias ? factorDe(modeKey, alias) : null;
  }

  // ——— El campo donde se escribe una cifra ———
  //
  // Una sola pieza para todos los sitios donde alguien teclea una cifra —el sorteo de quién empieza, el
  // duelo de cifras, el duelo por turnos—, para que la etiqueta, el teclado y la ayuda digan lo mismo. La
  // etiqueta da la unidad que se entiende cuando no se escribe ninguna; el teclado es el numérico, que no
  // deja escribir «días» ni un menos; así que las demás unidades del mazo van debajo como botones: se teclea
  // «3», se toca «días» y queda «3 días». Lo que la ayuda promete se hace tocando, no tecleando.
  function opcionesCifra(modeKey) {
    const vistas = new Set(), lista = [];
    // Los sinónimos de una misma unidad («millones» y «M», «t» y «toneladas») no necesitan un botón cada uno.
    for (const { nombre, factor } of unidades(modeKey)) {
      if (!vistas.has(factor)) { vistas.add(factor); lista.push({ tipo: "unidad", texto: nombre }); }
    }
    // Con una sola unidad no hay nada que elegir (en fechas, un año es un año).
    if (lista.length < 2) lista.length = 0;
    // Antes de Cristo es un menos delante, que el teclado numérico tampoco tiene.
    if (reglaCifra(modeKey).negativos) lista.push({ tipo: "signo", texto: "a. C." });
    return lista;
  }

  // Lo que queda escrito al tocar un botón: la unidad detrás del número (cambiando la que hubiera) o el
  // menos delante (poniéndolo o quitándolo). Sin número todavía, la unidad queda a la espera: al teclear
  // la cifra delante se completa sola.
  function aplicaOpcion(texto, tipo, valor) {
    const escrito = String(texto || "").trim().replace(/[−–—]/g, "-");
    if (tipo === "signo") return escrito.startsWith("-") ? escrito.slice(1).trim() : "-" + escrito;
    const partido = escrito.match(/^(-?[\d.,\s ]*\d)\s*(.*)$/);
    if (partido) return `${partido[1].trim()} ${valor}`;
    return escrito || ` ${valor}`;
  }

  function botonesCifra(modeKey, id) {
    const lista = opcionesCifra(modeKey);
    if (!lista.length) return "";
    const esc = CT.escapeHtml;
    return `<div class="cifra-chips" role="group" aria-label="Unidad de la respuesta" data-cifra-para="${esc(id)}">${lista.map(opcion => `<button type="button" class="cifra-chip" data-cifra-${opcion.tipo}="${esc(opcion.texto)}">${esc(opcion.texto)}</button>`).join("")}</div>`;
  }

  // `attrs` son atributos extra del campo (desactivado, enfoque automático…) y `hintId`, el id de la ayuda.
  function campoCifra(modeKey, id, { attrs = "", hintId = "" } = {}) {
    const regla = reglaCifra(modeKey), esc = CT.escapeHtml;
    return `<div class="field cifra-field"><label for="${id}">Tu respuesta${regla.unidad && !regla.anos ? ` <span class="cifra-unidad">(en ${esc(regla.unidad)})</span>` : ""}</label>`
      + `<input id="${id}" type="text" inputmode="${regla.decimales ? "decimal" : "numeric"}" autocomplete="off" enterkeyhint="send"${attrs ? ` ${attrs}` : ""}>`
      + `${botonesCifra(modeKey, id)}<p class="hint"${hintId ? ` id="${hintId}"` : ""}>${esc(regla.pista || "")}</p></div>`;
  }

  // Un solo oyente para todos los botones, vengan de la pantalla que vengan: se repintan a menudo y así no
  // hay que volver a engancharlos. Al tocarlos el teclado no se cierra.
  if (typeof document !== "undefined") {
    const botonDe = evento => evento.target?.closest?.(".cifra-chip");
    document.addEventListener("pointerdown", evento => { if (botonDe(evento)) evento.preventDefault(); });
    document.addEventListener("click", evento => {
      const boton = botonDe(evento);
      if (!boton) return;
      const campo = document.getElementById(boton.closest(".cifra-chips")?.dataset.cifraPara || "");
      if (!campo || campo.disabled) return;
      const signo = boton.hasAttribute("data-cifra-signo");
      campo.value = aplicaOpcion(campo.value, signo ? "signo" : "unidad", boton.dataset.cifraUnidad);
      campo.focus({ preventScroll: true });
      if (campo.value.startsWith(" ")) campo.setSelectionRange?.(0, 0);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  // Un número tal cual se guarda en el enlace: sin notación científica, que no pasaría
  // la validación al volver, y con los decimales que admita el mazo.
  function textoCifra(modeKey, valor) {
    if (valor === null || !Number.isFinite(valor)) return "";
    const decimales = Math.min(Math.max(reglaCifra(modeKey).decimales ?? 0, 0), 6);
    return String(Number(valor.toFixed(decimales)));
  }

  function limpiaNombre(nombre) {
    // Sin barras verticales, que son el separador de la carga útil, y sin saltos: el
    // nombre es lo único del enlace que escribe una persona.
    return String(nombre || "").replace(/[|\r\n]/g, " ").trim().slice(0, MAX_NOMBRE);
  }

  // Base64url sobre UTF-8 (los nombres llevan tildes y eñes, que `btoa` a secas no admite). Es
  // el mismo que usan los duelos de Retos rápidos y la señal del modo sin conexión: vive en
  // local-transport.js, que carga después que este archivo, así que se busca al usarlo.
  const aBase64url = texto => CT.LocalTransport.encodeText(texto);
  const deBase64url = texto => CT.LocalTransport.decodeText(texto);

  // Ocho campos separados por barras. Compacto a propósito: el enlace entero cabe de
  // sobra en un mensaje, que es por donde va a viajar.
  //
  //   versión | mazo | semilla | cartas | aciertos | secuencia | huella | nombre
  //
  // El primer campo es la versión de las reglas —véase `REGLAS`—, no la del formato. Una
  // aplicación que no la conozca pide actualizar en vez de comparar dos partidas que se
  // jugaron con plazos distintos. Es la misma idea que la huella del mazo, aplicada a las
  // reglas en vez de a las cartas.
  function codificar({ mode, seed, total, hits, sequence, nombre, deck, ms = MS, grupo = 2, previos = [] }) {
    const campos = [
      versionDe(false, ms), mode, seed, total, hits,
      sequence.map(acierto => (acierto ? "1" : "0")).join(""),
      huella(mode, deck), limpiaNombre(nombre), ...colaGrupo(grupo, previos)
    ];
    return aBase64url(campos.join("|"));
  }

  // «Mismas cartas» en grupo (de 3 a 10 personas): dos campos más al final, el tamaño del grupo y lo que sacaron
  // quienes jugaron antes que quien manda el enlace («nombre~marca;…»). Cada uno se lo pasa al siguiente, y el
  // último ve la clasificación entera. La marca de quien manda el enlace es la de siempre, comprobada carta a carta;
  // las anteriores viajan tal cual. Los enlaces de dos siguen teniendo ocho campos.
  const MAX_GRUPO = 10;
  function colaGrupo(grupo, previos) {
    if (!(Number(grupo) > 2)) return [];
    const limpio = nombre => limpiaNombre(nombre).replace(/[~;]/g, " ").trim() || "Jugador";
    return [String(Math.min(Number(grupo), MAX_GRUPO)), (previos || []).slice(0, Number(grupo) - 2)
      .map(([nombre, marca]) => `${limpio(nombre)}~${Math.max(0, Math.min(99, Math.round(Number(marca) || 0)))}`).join(";")];
  }
  function leeGrupo(textoGrupo, textoPrevios) {
    const grupo = Number(textoGrupo);
    if (!Number.isInteger(grupo) || grupo < 3 || grupo > MAX_GRUPO) return null;
    const previos = String(textoPrevios || "").split(";").filter(Boolean).map(item => {
      const [nombre, marca] = item.split("~");
      return [limpiaNombre(nombre) || "Jugador", Number(marca)];
    });
    if (previos.length > grupo - 2 || previos.some(([, marca]) => !Number.isInteger(marca) || marca < 0 || marca > 99)) return null;
    return { grupo, previos };
  }

  // El duelo de cifras usa los mismos ocho campos y cambia los dos del medio: en vez de
  // aciertos y cuadrícula lleva los puntos y una jugada por carta.
  //
  //   versión | mazo | semilla | cartas | puntos | respuesta:ms:salida,… | huella | nombre
  function codificarCifras({ mode, seed, total, jugadas, nombre, deck, ms = CIFRAS_MS, grupo = 2, previos = [] }) {
    const datos = jugadas.map(jugada => [
      textoCifra(mode, jugada.respuesta),
      Math.min(Math.max(Math.round(Number(jugada.ms) || 0), 0), tope(ms)),
      jugada.salida ? 1 : 0
    ].join(":")).join(",");
    const campos = [
      versionDe(true, ms), mode, seed, total, puntosPartida(mode, seed, total, jugadas, ms),
      datos, huella(mode, deck), limpiaNombre(nombre), ...colaGrupo(grupo, previos)
    ];
    return aBase64url(campos.join("|"));
  }

  // La competición usa los mismos ocho campos. El mazo pasa a ser la lista de temas, las
  // cartas son las de cada tema, la cuadrícula los cubre todos seguidos y la huella es una
  // por mazo, en el mismo orden que los temas:
  //
  //   versión | tema,tema,… | semilla | cartas por tema | aciertos | 0101… | huella,huella,… | nombre
  //
  // Cada tema reparte con `reparto(tema, semilla, cartas)`, que ya mezcla el mazo con la
  // semilla, así que una sola semilla da un reparto distinto en cada tema.
  function codificarCompeticion({ temas, seed, porTema, sequence, nombre, decks = {}, ms = MS }) {
    const campos = [
      versionCompeticion(ms), temas.join(","), seed, porTema, sequence.filter(Boolean).length,
      sequence.map(acierto => (acierto ? "1" : "0")).join(""),
      temas.map(mode => huella(mode, decks[mode])).join(","), limpiaNombre(nombre)
    ];
    return aBase64url(campos.join("|"));
  }

  // Se rechaza cualquier cosa rara sin lanzar una excepción: un enlace cortado al
  // reenviarlo, uno de una versión con otro mazo, o uno tocado a mano. Lo que no puede
  // pasar nunca es que la aplicación se rompa al abrir una dirección.
  function descodificar(texto) {
    let plano;
    try {
      plano = deBase64url(String(texto || ""));
    } catch { return { ok: false, motivo: "roto" }; }

    const campos = plano.split("|");
    if (campos.length !== 8 && campos.length !== 10) return { ok: false, motivo: "roto" };
    const [version, mode, seed, textoTotal, textoMarca, cuerpo, huellaRival, nombre] = campos;
    const enGrupo = campos.length === 10 ? leeGrupo(campos[8], campos[9]) : null;
    if (campos.length === 10 && !enGrupo) return { ok: false, motivo: "roto" };

    const reglas = REGLAS[version];
    if (!reglas) return { ok: false, motivo: "version" };
    if (enGrupo && reglas.comp) return { ok: false, motivo: "roto" };
    if (enGrupo) {
      const leido = descodificar(aBase64url(campos.slice(0, 8).join("|")));
      if (leido.ok) Object.assign(leido.duelo, enGrupo);
      return leido;
    }
    // La competición lleva una lista de temas donde el duelo lleva un mazo: se lee aparte.
    if (reglas.comp) return leeCompeticion({ textoTemas: mode, seed, textoTotal, textoMarca, cuerpo, textoHuellas: huellaRival, nombre, ms: reglas.ms });
    if (!CT.has(mode)) return { ok: false, motivo: "mazo" };
    // Un reto puede llegar de alguien que tiene un mazo que quien lo abre todavía no.
    // Se distingue de «este mazo no existe»: uno es un enlace roto y el otro una puerta
    // cerrada, y no se explican igual.
    if (!CT.Cartera.tiene(mode)) return { ok: false, motivo: "mazo-cerrado", mode };
    if (!/^[a-z0-9]{1,12}$/.test(seed)) return { ok: false, motivo: "roto" };

    const total = Number(textoTotal);
    if (!Number.isInteger(total) || total < 1 || total > MAX_CARTAS) return { ok: false, motivo: "roto" };
    // El duelo de orden necesita una carta más que las jugadas: la que abre la línea.
    // El de cifras no abre ninguna línea, así que le bastan las suyas.
    if (total + (reglas.cifras ? 0 : 1) > CT.cards(mode).length) return { ok: false, motivo: "roto" };

    if (huellaRival !== huella(mode)) return { ok: false, motivo: "mazo-distinto" };

    return reglas.cifras
      ? leeCifras({ mode, seed, total, textoMarca, cuerpo, nombre, ms: reglas.ms })
      : leeOrden({ mode, seed, total, textoMarca, cuerpo, nombre, ms: reglas.ms });
  }

  function leeOrden({ mode, seed, total, textoMarca, cuerpo, nombre, ms }) {
    const hits = Number(textoMarca);
    if (!Number.isInteger(hits) || hits < 0 || hits > total) return { ok: false, motivo: "roto" };
    if (!/^[01]+$/.test(cuerpo) || cuerpo.length !== total) return { ok: false, motivo: "roto" };
    const secuencia = [...cuerpo].map(bit => bit === "1");
    if (secuencia.filter(Boolean).length !== hits) return { ok: false, motivo: "roto" };
    return {
      ok: true,
      duelo: { mode, seed, total, cifras: false, ms, rival: { nombre: limpiaNombre(nombre), hits, sequence: secuencia } }
    };
  }

  // Lo mismo que el duelo de ordenar, tema a tema: que existan, que no se repitan, que sean
  // tuyos y que cada mazo sea el mismo que tenía quien reta. Si falta un mazo se dice cuál.
  function leeCompeticion({ textoTemas, seed, textoTotal, textoMarca, cuerpo, textoHuellas, nombre, ms }) {
    const roto = { ok: false, motivo: "roto" };
    const temas = textoTemas.split(",");
    if (!temas.length || temas.length > COMP_TEMAS || new Set(temas).size !== temas.length) return roto;
    if (temas.some(mode => !CT.has(mode))) return { ok: false, motivo: "mazo" };
    // Gran mezcla no es un tema de competición: combina los demás mazos (ver app.js).
    if (temas.includes("mixed")) return roto;
    const cerrado = temas.find(mode => !CT.Cartera.tiene(mode));
    if (cerrado) return { ok: false, motivo: "mazo-cerrado", mode: cerrado };
    if (!/^[a-z0-9]{1,12}$/.test(seed)) return roto;

    const porTema = Number(textoTotal);
    if (!Number.isInteger(porTema) || porTema < 1 || porTema > COMP_CARTAS) return roto;
    // Cada tema necesita sus cartas más la que abre su línea.
    if (temas.some(mode => porTema + 1 > CT.cards(mode).length)) return roto;

    const huellas = textoHuellas.split(",");
    if (huellas.length !== temas.length) return roto;
    if (temas.some((mode, i) => huellas[i] !== huella(mode))) return { ok: false, motivo: "mazo-distinto" };

    const total = temas.length * porTema;
    const hits = Number(textoMarca);
    if (!Number.isInteger(hits) || hits < 0 || hits > total) return roto;
    if (!/^[01]+$/.test(cuerpo) || cuerpo.length !== total) return roto;
    const secuencia = [...cuerpo].map(bit => bit === "1");
    if (secuencia.filter(Boolean).length !== hits) return roto;
    return {
      ok: true,
      duelo: { competicion: true, temas, seed, porTema, total, cifras: false, ms, rival: { nombre: limpiaNombre(nombre), hits, sequence: secuencia } }
    };
  }

  function leeCifras({ mode, seed, total, textoMarca, cuerpo, nombre, ms: plazo }) {
    // Un duelo de cifras son siempre estas cartas y no más: la aplicación no crea otros
    // tamaños, y aceptar uno mayor desde un enlace sería jugar algo que luego ni siquiera
    // se podría reanudar.
    if (total > CIFRAS_CARTAS) return { ok: false, motivo: "roto" };
    const puntos = Number(textoMarca);
    if (!Number.isInteger(puntos) || puntos < 0 || puntos > total * PUNTOS_CARTA) return { ok: false, motivo: "roto" };

    const trozos = cuerpo.split(",");
    if (trozos.length !== total) return { ok: false, motivo: "roto" };
    const jugadas = [];
    for (const trozo of trozos) {
      const partes = trozo.split(":");
      if (partes.length !== 3) return { ok: false, motivo: "roto" };
      const [escrita, textoMs, textoSalida] = partes;
      // Vacío es una carta sin responder, que es distinto de responder cero.
      if (escrita !== "" && !/^-?\d{1,16}(\.\d{1,6})?$/.test(escrita)) return { ok: false, motivo: "roto" };
      const respuesta = escrita === "" ? null : Number(escrita);
      if (respuesta !== null && (!Number.isFinite(respuesta) || Math.abs(respuesta) > MAX_CIFRA)) return { ok: false, motivo: "roto" };
      const ms = Number(textoMs);
      if (!Number.isInteger(ms) || ms < 0 || ms > tope(plazo)) return { ok: false, motivo: "roto" };
      if (textoSalida !== "0" && textoSalida !== "1") return { ok: false, motivo: "roto" };
      jugadas.push({ respuesta, ms, salida: textoSalida === "1" });
    }

    // Los puntos que vienen en el enlace no se creen: se recalculan con las mismas cartas
    // —las reparte la semilla y las garantiza la huella— y tienen que coincidir. Así una
    // marca inflada a mano no llega a comparar nada. Lo que sigue sin poder comprobarse
    // desde aquí son las respuestas en sí: el reloj vive en el otro móvil.
    if (puntosPartida(mode, seed, total, jugadas, plazo) !== puntos) return { ok: false, motivo: "roto" };

    return {
      ok: true,
      duelo: { mode, seed, total, cifras: true, ms: plazo, rival: { nombre: limpiaNombre(nombre), puntos, jugadas,
        aciertos: aciertosPartida(mode, seed, total, jugadas), tiempo: tiempoPartida(jugadas, plazo) } }
    };
  }

  function enlace(payload) {
    return CT.Links.invitation({duelo:payload});
  }

  // El texto que se manda. Lleva el enlace y la marca a batir, pero ninguna carta: quien
  // lo recibe tiene que jugarlo sin saber qué le va a salir.
  const ritmoTexto = ms => Number(ms) > 0 ? `a ${Math.round(ms / 1000)} segundos por carta` : "sin tiempo";
  function invitacion({ modeName, nombre, hits, total, payload, ms = MS }) {
    const quien = nombre ? `${nombre} te reta` : "Te retan";
    return `${quien} en Continuum · ${modeName}\n📊 ${hits}/${total}, ${ritmoTexto(ms)}. ¿Lo superas?\n${enlace(payload)}`;
  }

  // El cara a cara, para compartir el resultado. Las dos cuadrículas, una debajo de otra,
  // al estilo de lo que ya comparte el reto diario.
  function marcador({ modeName, rival, mio }) {
    const rejilla = sec => sec.map(acierto => (acierto ? "🟩" : "⬜")).join("");
    const veredicto = mio.hits > rival.hits ? "Gano yo" : mio.hits < rival.hits ? `Gana ${rival.nombre || "quien retaba"}` : "Empate";
    return `Duelo en Continuum · ${modeName}\n${veredicto}: ${mio.hits} a ${rival.hits}\n${rival.nombre || "Quien retaba"} ${rejilla(rival.sequence)}\nYo ${rejilla(mio.sequence)}`;
  }

  // La competición no nombra sus temas, ni al retar ni al compartir el resultado: cada tema se
  // descubre en su cartel, como en el resto de competiciones, y en un grupo puede haber quien
  // todavía no la ha jugado.
  function invitacionCompeticion({ nombre, temas, hits, total, payload, ms = MS }) {
    const quien = nombre ? `${nombre} te reta` : "Te retan";
    return `${quien} en Continuum · Competición de ${temas} temas\n📊 ${hits}/${total}, ${ritmoTexto(ms)}. ¿Lo superas?\n${enlace(payload)}`;
  }

  // Las cuadrículas van partidas por temas, con un espacio entre uno y otro.
  function marcadorCompeticion({ temas, porTema, rival, mio }) {
    const rejilla = sec => Array.from({ length: temas }, (_, i) => sec.slice(i * porTema, (i + 1) * porTema).map(acierto => (acierto ? "🟩" : "⬜")).join("")).join(" ");
    const veredicto = mio.hits > rival.hits ? "Gano yo" : mio.hits < rival.hits ? `Gana ${rival.nombre || "quien retaba"}` : "Empate";
    return `Competición en Continuum · ${temas} temas\n${veredicto}: ${mio.hits} a ${rival.hits}\n${rival.nombre || "Quien retaba"} ${rejilla(rival.sequence)}\nYo ${rejilla(mio.sequence)}`;
  }

  function invitacionCifras({ modeName, nombre, aciertos, total, payload, ms = CIFRAS_MS }) {
    const quien = nombre ? `${nombre} te reta` : "Te retan";
    return `${quien} en Continuum · Cifras · ${modeName}\n🎯 ${aciertos}/${total} aciertos, ${ritmoTexto(ms)}\n${enlace(payload)}`;
  }

  // La cuadrícula de un duelo de cifras dice cuánto se acercó cada carta, no si se
  // acertó: verde lo clavado o casi, amarillo lo razonable, blanco lo que no puntuó.
  // Las cartas cerradas por salir de la aplicación se cuentan aparte, que es la única
  // manera honrada de dejarlas a la vista sin llamar tramposo a nadie.
  function rejillaCifras(modeKey, seed, total, jugadas, plazo = CIFRAS_MS) {
    const cartas = cartasCifras(modeKey, seed, total);
    return jugadas.map((jugada, i) => {
      if (jugada.salida) return "⬛";
      return acierto(modeKey, cartas[i], jugada) ? "🟩" : "⬜";
    }).join("");
  }

  function marcadorCifras({ modeName, mode, seed, total, rival, mio, ms = CIFRAS_MS }) {
    const resultado = comparaCifras(mio, rival);
    const veredicto = resultado > 0 ? "Gano yo" : resultado < 0 ? `Gana ${rival.nombre || "quien retaba"}` : "Empate";
    const porTiempo = resultado && mio.aciertos === rival.aciertos ? " (por rapidez)" : "";
    const salidas = [rival, mio].map(quien => quien.jugadas.filter(jugada => jugada.salida).length);
    const aviso = salidas[0] + salidas[1]
      ? `\n⬛ cartas cerradas por salir de la app: ${rival.nombre || "quien retaba"} ${salidas[0]}, yo ${salidas[1]}`
      : "";
    return `Duelo de cifras en Continuum · ${modeName}\n${veredicto}${porTiempo}: ${mio.aciertos} a ${rival.aciertos} aciertos\n${rival.nombre || "Quien retaba"} ${rejillaCifras(mode, seed, total, rival.jugadas, ms)}\nYo ${rejillaCifras(mode, seed, total, mio.jugadas, ms)}${aviso}`;
  }

  // En qué punto está un duelo por turnos, contado desde quien mira (`yo`, su uid): a
  // quién le toca, por qué carta van y cómo va el marcador. Es lo que enseña la lista de
  // duelos; vive aquí, fuera del módulo de Firebase, para poder probarlo sin red.
  function estadoTurnos(partida, yo) {
    const rivalUid = (partida.playersOrder || []).find(uid => uid !== yo) || partida.invitedUid;
    const rival = partida.players?.[rivalUid]?.alias || partida.invitedAlias || "Rival pendiente";
    const total = Number(partida.total) || 0;
    const carta = Math.min(total, (Number(partida.turnIndex) || 0) + 1);
    const mios = partida.scores?.[yo] || 0, suyos = partida.scores?.[rivalUid] || 0;
    const unidad = "aciertos";
    const marcadorTexto = `Tú ${mios} · ${rival} ${suyos} ${unidad}`;
    const invitado = partida.status === "waiting" && partida.invitedUid === yo;
    // Quien crea el duelo juega primero, antes de que entre el rival.
    const creadorEmpieza = partida.status === "waiting" && (partida.playersOrder || []).length === 1 && partida.playersOrder[0] === yo && !partida.turnIndex && !partida.starter;
    if (creadorEmpieza) return { grupo: "tu-turno", rival, estado: "Te toca", detalle: `Carta 1 de ${total} · empiezas tú`, marcador: "", pendiente: true };
    if (partida.status === "playing") {
      const mio = partida.turnUid === yo;
      return { grupo: mio ? "tu-turno" : "su-turno", rival, estado: mio ? "Te toca" : `Turno de ${rival}`,
        detalle: `Carta ${carta} de ${total}`, marcador: marcadorTexto, pendiente: mio };
    }
    if (partida.status === "waiting") {
      return invitado
        ? { grupo: "retado", rival, estado: `${rival} te ha retado`, detalle: "Acéptalo para empezar", marcador: "", pendiente: true }
        : { grupo: "enviada", rival, estado: partida.invitedUid ? `Esperando a que ${rival} acepte` : "Esperando a que tu rival abra el enlace", detalle: partida.turnIndex ? `Ya has jugado · carta ${carta} de ${total}` : "Invitación enviada", marcador: "", pendiente: false };
    }
    const estado = partida.status === "resigned" ? (partida.winnerUid === yo ? "Ganaste: tu rival se rindió" : "Te rendiste")
      : partida.status === "expired" ? "Caducado por inactividad"
      : partida.status === "cancelled" ? "Invitación cancelada"
      : mios > suyos ? "Ganaste" : mios < suyos ? "Perdiste" : "Empate";
    return { grupo: "historial", rival, estado, detalle: "Terminado", marcador: ["finished", "resigned"].includes(partida.status) ? marcadorTexto : "", pendiente: false };
  }

  CT.Duelo = {
    CARTAS, MAX_CARTAS, MAX_NOMBRE, SEGUNDOS, MS, GRACIA_MS,
    huella, crearSemilla, reparto, codificar, descodificar,
    enlace, invitacion, marcador, limpiaNombre, estadoTurnos,
    Competicion: { TEMAS: COMP_TEMAS, CARTAS: COMP_CARTAS, codificar: codificarCompeticion, invitacion: invitacionCompeticion, marcador: marcadorCompeticion },
    Cifras: {
      CARTAS: CIFRAS_CARTAS, SEGUNDOS: CIFRAS_SEGUNDOS, MS: CIFRAS_MS, GRACIA_MS, SIN_RELOJ_MS, tope,
      PUNTOS_CARTA, PUNTOS_TINO, PUNTOS_PRISA, MAX_CIFRA,
      regla: reglaCifra, unidades, factorDe, leer: leerCifra, campo: campoCifra, opciones: opcionesCifra, aplica: aplicaOpcion, reparto: repartoCifras, cartas: cartasCifras,
      banda, puntosCarta, puntosPartida, acierto, aciertos: aciertosPartida, tiempo: tiempoPartida, compara: comparaCifras, formato: formatoCifra, texto: textoCifra,
      codificar: codificarCifras, invitacion: invitacionCifras, marcador: marcadorCifras, rejilla: rejillaCifras
    }
  };
})();
