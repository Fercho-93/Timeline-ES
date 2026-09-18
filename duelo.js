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
  // Las cartas de un duelo. Las mismas quince del reto diario: bastantes para que el
  // resultado signifique algo y pocas para jugarlo de una sentada.
  const CARTAS = 15;
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
  // Lo que dura cada número de la cuenta atrás de antes de empezar. Vive aquí, con el
  // resto de las reglas del duelo, para poder acortarlo en las pruebas y no gastar tres
  // segundos de reloj real en cada partida que se juega.
  const CUENTA_PASO_MS = 700;

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
    "5": { cifras: true, ms: MS }
  };
  const VERSION_ORDEN = "4";
  const VERSION_CIFRAS = "5";

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
    const ids = CT.cards(modeKey).map(card => card.id);
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
  // carta que el de orden, y gana quien sume más puntos.
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
    const usado = Math.min(Math.max(Number(jugada.ms) || 0, 0), plazo);
    return acierto + Math.round(PUNTOS_PRISA * ((plazo - usado) / plazo));
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

  // Base64url sobre UTF-8. `btoa` solo entiende bytes, así que el texto se codifica antes:
  // los nombres llevan tildes y eñes y `btoa` a secas se atragantaría con ellas.
  function aBase64url(texto) {
    const bytes = new TextEncoder().encode(texto);
    let binario = "";
    for (const byte of bytes) binario += String.fromCharCode(byte);
    return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function deBase64url(texto) {
    const relleno = texto.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(relleno + "=".repeat((4 - (relleno.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
  }

  // Ocho campos separados por barras. Compacto a propósito: el enlace entero cabe de
  // sobra en un mensaje, que es por donde va a viajar.
  //
  //   4 | mazo | semilla | cartas | aciertos | secuencia | huella | nombre
  //
  // El primer campo es la versión de las reglas —véase `REGLAS`—, no la del formato. Una
  // aplicación que no la conozca pide actualizar en vez de comparar dos partidas que se
  // jugaron con plazos distintos. Es la misma idea que la huella del mazo, aplicada a las
  // reglas en vez de a las cartas.
  function codificar({ mode, seed, total, hits, sequence, nombre, deck }) {
    const campos = [
      VERSION_ORDEN, mode, seed, total, hits,
      sequence.map(acierto => (acierto ? "1" : "0")).join(""),
      huella(mode, deck), limpiaNombre(nombre)
    ];
    return aBase64url(campos.join("|"));
  }

  // El duelo de cifras usa los mismos ocho campos y cambia los dos del medio: en vez de
  // aciertos y cuadrícula lleva los puntos y una jugada por carta.
  //
  //   2 | mazo | semilla | cartas | puntos | respuesta:ms:salida,… | huella | nombre
  function codificarCifras({ mode, seed, total, jugadas, nombre, deck }) {
    const datos = jugadas.map(jugada => [
      textoCifra(mode, jugada.respuesta),
      Math.min(Math.max(Math.round(Number(jugada.ms) || 0), 0), CIFRAS_MS),
      jugada.salida ? 1 : 0
    ].join(":")).join(",");
    const campos = [
      VERSION_CIFRAS, mode, seed, total, puntosPartida(mode, seed, total, jugadas),
      datos, huella(mode, deck), limpiaNombre(nombre)
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
    if (campos.length !== 8) return { ok: false, motivo: "roto" };
    const [version, mode, seed, textoTotal, textoMarca, cuerpo, huellaRival, nombre] = campos;

    const reglas = REGLAS[version];
    if (!reglas) return { ok: false, motivo: "version" };
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
      if (!Number.isInteger(ms) || ms < 0 || ms > plazo) return { ok: false, motivo: "roto" };
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
      duelo: { mode, seed, total, cifras: true, ms: plazo, rival: { nombre: limpiaNombre(nombre), puntos, jugadas } }
    };
  }

  function enlace(payload) {
    const base = CT.Links.base();
    return `${base}#duelo=${encodeURIComponent(payload)}`;
  }

  // El texto que se manda. Lleva el enlace y la marca a batir, pero ninguna carta: quien
  // lo recibe tiene que jugarlo sin saber qué le va a salir.
  function invitacion({ modeName, nombre, hits, total, payload }) {
    const quien = nombre ? `${nombre} te reta` : "Te retan";
    return `${quien} en Continuum · ${modeName}\n📊 ${hits}/${total}, a ${SEGUNDOS} segundos por carta — a ver si lo superas\n${enlace(payload)}`;
  }

  // El cara a cara, para compartir el resultado. Las dos cuadrículas, una debajo de otra,
  // al estilo de lo que ya comparte el reto diario.
  function marcador({ modeName, rival, mio }) {
    const rejilla = sec => sec.map(acierto => (acierto ? "🟩" : "⬜")).join("");
    const veredicto = mio.hits > rival.hits ? "Gano yo" : mio.hits < rival.hits ? `Gana ${rival.nombre || "quien retaba"}` : "Empate";
    return `Duelo en Continuum · ${modeName}\n${veredicto} — ${mio.hits} a ${rival.hits}\n${rival.nombre || "Quien retaba"} ${rejilla(rival.sequence)}\nYo ${rejilla(mio.sequence)}`;
  }

  function invitacionCifras({ modeName, nombre, puntos, total, payload }) {
    const quien = nombre ? `${nombre} te reta` : "Te retan";
    return `${quien} en Continuum · Cifras · ${modeName}\n🎯 ${puntos} puntos en ${total} cartas, a ${CIFRAS_SEGUNDOS} segundos por carta\n${enlace(payload)}`;
  }

  // La cuadrícula de un duelo de cifras dice cuánto se acercó cada carta, no si se
  // acertó: verde lo clavado o casi, amarillo lo razonable, blanco lo que no puntuó.
  // Las cartas cerradas por salir de la aplicación se cuentan aparte, que es la única
  // manera honrada de dejarlas a la vista sin llamar tramposo a nadie.
  function rejillaCifras(modeKey, seed, total, jugadas, plazo = CIFRAS_MS) {
    const cartas = cartasCifras(modeKey, seed, total);
    return jugadas.map((jugada, i) => {
      if (jugada.salida) return "⬛";
      const puntos = puntosCarta(modeKey, cartas[i], jugada, plazo);
      return puntos >= 70 ? "🟩" : puntos > 0 ? "🟨" : "⬜";
    }).join("");
  }

  function marcadorCifras({ modeName, mode, seed, total, rival, mio, ms = CIFRAS_MS }) {
    const veredicto = mio.puntos > rival.puntos ? "Gano yo" : mio.puntos < rival.puntos ? `Gana ${rival.nombre || "quien retaba"}` : "Empate";
    const salidas = [rival, mio].map(quien => quien.jugadas.filter(jugada => jugada.salida).length);
    const aviso = salidas[0] + salidas[1]
      ? `\n⬛ cartas cerradas por salir de la app: ${rival.nombre || "quien retaba"} ${salidas[0]}, yo ${salidas[1]}`
      : "";
    return `Duelo de cifras en Continuum · ${modeName}\n${veredicto} — ${mio.puntos} a ${rival.puntos}\n${rival.nombre || "Quien retaba"} ${rejillaCifras(mode, seed, total, rival.jugadas, ms)}\nYo ${rejillaCifras(mode, seed, total, mio.jugadas, ms)}${aviso}`;
  }

  CT.Duelo = {
    CARTAS, MAX_CARTAS, MAX_NOMBRE, SEGUNDOS, MS, GRACIA_MS, CUENTA_PASO_MS,
    huella, crearSemilla, reparto, codificar, descodificar,
    enlace, invitacion, marcador, limpiaNombre,
    Cifras: {
      CARTAS: CIFRAS_CARTAS, SEGUNDOS: CIFRAS_SEGUNDOS, MS: CIFRAS_MS, GRACIA_MS,
      PUNTOS_CARTA, PUNTOS_TINO, PUNTOS_PRISA, MAX_CIFRA,
      regla: reglaCifra, unidades, factorDe, reparto: repartoCifras, cartas: cartasCifras,
      banda, puntosCarta, puntosPartida, formato: formatoCifra, texto: textoCifra,
      codificar: codificarCifras, invitacion: invitacionCifras, marcador: marcadorCifras, rejilla: rejillaCifras
    }
  };
})();
