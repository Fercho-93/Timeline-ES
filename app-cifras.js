// El duelo de cifras, aparte de app.js: es el subsistema más autocontenido del motor
// local (estado propio en `cifras`, sin mezclarse con `game` ni `solo`), así que es el
// primer trozo que sale del fichero grande. Lo que sigue siendo genuinamente compartido
// con el resto del juego —el reloj de las cartas, la pantalla "duelo listo", leer una
// cifra escrita— se queda en app.js y entra aquí como dependencia inyectada; así no hay
// dos copias de esa lógica ni un acoplamiento oculto por variables globales.
//
// Diez cartas, el mismo plazo que el duelo de orden, y en vez de colocar se escribe el
// valor. Lo que viaja en el enlace está en duelo.js; aquí está lo que se ve.
window.CONTINUUM = window.CONTINUUM || {};
window.CONTINUUM.createCifrasMode = function createCifrasMode(deps) {
  "use strict";
  const {
    CT, app, paint, header, overlay,
    escapeHtml, categoryBadge, relojMarkup, arrancaReloj, paraReloj,
    anotaLogros, logrosMarkup, reglaCifra, leeCifra, duelName, soloHome,
    modeKey, setScreen, setLastDuelShare
  } = deps;
  const Cifras = CT.Duelo.Cifras;
  let cifras = null;

  function cifrasKey() { return `hilo-cifras-${modeKey()}-v1`; }

  // El plazo de esta partida de cifras: el de hoy si se estrenó aquí, o el que traía el
  // enlace si llegó de fuera. Los puntos por rapidez se miden contra él, así que una
  // partida jugada con otro plazo hay que seguir puntuándola con el suyo.
  function plazoCifras() { return Number(cifras?.ms) || Cifras.MS; }

  // La carta que se tiene delante. Mientras se enseña el resultado de una, la de delante
  // sigue siendo esa y no la siguiente: revelar la siguiente por detrás de la capa sería
  // regalar un plazo entero de ventaja.
  function indiceCifra() { return cifras.jugadas.length - (cifras.pendiente ? 1 : 0); }
  function cartaCifra() { return cifras.cartas[indiceCifra()]; }

  function guardaCifras() {
    if (!cifras) { CT.Storage.removeItem(cifrasKey()); return; }
    const { mode, seed, total, ms, jugadas, empezadaEn, rival, finished } = cifras;
    try { CT.Storage.setItem(cifrasKey(), JSON.stringify({ mode, seed, total, ms, jugadas, empezadaEn, rival, finished })); }
    catch { /* almacenamiento lleno */ }
  }

  // Al recuperar una partida no se guardan las cartas: se vuelven a repartir con la
  // semilla. Si el mazo ha cambiado de versión entre medias, el reparto ya no cuadra y la
  // partida se descarta en vez de comparar cosas distintas.
  function cargaCifras() {
    try {
      const guardado = JSON.parse(CT.Storage.getItem(cifrasKey()) || "null");
      if (!guardado || guardado.finished || guardado.mode !== modeKey() || !CT.has(guardado.mode)) return null;
      if (!reglaCifra(guardado.mode)) return null;
      const total = Number(guardado.total);
      if (!Number.isInteger(total) || total < 1 || total > Cifras.CARTAS) return null;
      if (!Array.isArray(guardado.jugadas) || guardado.jugadas.length > total) return null;
      const cartas = Cifras.cartas(guardado.mode, guardado.seed, total);
      if (cartas.length !== total || cartas.some(card => !card)) return null;
      return { ...guardado, total, cartas, pendiente: null };
    } catch { return null; }
  }

  function abreCarta() {
    cifras.pendiente = null;
    cifras.empezadaEn = Date.now();
    guardaCifras();
    cifrasView();
  }

  // Cerrar una carta es lo único que resuelve una jugada, y las tres maneras de llegar
  // aquí acaban en el mismo sitio: responder, agotar el plazo o salirse de la
  // aplicación. Solo la tercera anula la respuesta; agotar el tiempo con algo escrito
  // sigue puntuando, pero sin la parte que premia la prisa.
  function cierraCarta(motivo) {
    if (!cifras || cifras.empezadaEn === null || cifras.pendiente) return;
    paraReloj();
    const salida = motivo === "salida";
    const campo = app.querySelector("#cifra-input");
    const respuesta = salida ? null : leeCifra(campo ? campo.value : "", cifras.mode);
    const jugada = {
      respuesta,
      ms: Math.min(Math.max(Date.now() - cifras.empezadaEn, 0), plazoCifras()),
      salida
    };
    const card = cartaCifra();
    cifras.jugadas.push(jugada);
    cifras.empezadaEn = null;
    const puntos = Cifras.puntosCarta(cifras.mode, card, jugada, plazoCifras());
    cifras.pendiente = { jugada, motivo, puntos };
    anotaLogros(CT.Progreso.record({ mode: cifras.mode, cardId: card.id, correct: puntos > 0, kind: "cifras" }));
    CT.Effects.feedback(puntos > 0);
    guardaCifras();
    cifrasView();
    cifrasRevelado();
  }

  function startCifras(duel = null) {
    const duelo = duel || { seed: CT.Duelo.crearSemilla(), total: Cifras.CARTAS, rival: null, ms: Cifras.MS };
    cifras = {
      mode: modeKey(), seed: duelo.seed, total: duelo.total, ms: Number(duelo.ms) || Cifras.MS,
      cartas: Cifras.cartas(modeKey(), duelo.seed, duelo.total),
      jugadas: [], empezadaEn: null, rival: duelo.rival, finished: false, pendiente: null
    };
    abreCarta();
  }

  // Reanudar: si la carta seguía abierta, el tiempo que ha pasado por fuera cuenta igual,
  // así que salirse y volver más tarde —o cerrar la aplicación del todo— cierra esa
  // carta en vez de regalar un reloj nuevo.
  function resumeCifras() {
    cifras = cargaCifras();
    if (!cifras) return soloHome();
    if (cifras.jugadas.length >= cifras.total) return cifrasFinish();
    if (cifras.empezadaEn === null) return abreCarta();
    // La carta seguía abierta. Si se ha estado fuera más que el margen de gracia se
    // cierra como salida, sin pasar antes por la pantalla: pintarla arrancaría el reloj,
    // que al encontrar el tiempo gastado lo contaría como un simple agotarse el plazo y
    // la carta dejaría de aparecer como lo que fue.
    if (Date.now() - cifras.empezadaEn > Cifras.GRACIA_MS) return cierraCarta("salida");
    cifrasView();
  }

  function cifrasView() {
    setScreen("cifras");
    const regla = reglaCifra(cifras.mode);
    const card = cartaCifra();
    const indice = indiceCifra();
    const cerrada = !!cifras.pendiente;
    const puntos = Cifras.puntosPartida(cifras.mode, cifras.seed, cifras.total, cifras.jugadas, plazoCifras());
    const restante = cerrada ? 0 : Math.max(0, plazoCifras() - (Date.now() - cifras.empezadaEn));
    const marcaRival = cifras.rival ? `<span><b>${cifras.rival.puntos}</b><small>${escapeHtml(cifras.rival.nombre || "quien te reta")}</small></span>` : "";
    paint(`<div class="shell">${header('<button class="icon-btn" data-action="rules">Guía</button><button class="icon-btn" data-action="cifras-exit">Salir</button>')}
      <h1 class="solo-lectores" data-focus tabindex="-1">Carta ${indice + 1} de ${cifras.total}. ${escapeHtml(regla.pregunta)} ${escapeHtml(card.title)}. Tienes ${Cifras.SEGUNDOS} segundos.</h1>
      <div class="game-head"><div><div class="turn-label" aria-hidden="true">Duelo de cifras</div><div class="turn-name" aria-hidden="true">${puntos} ${puntos === 1 ? "punto" : "puntos"}</div></div><div class="deck-count"><strong>${cifras.total - indice}</strong><span>por responder</span></div></div>
      ${marcaRival ? `<div class="solo-stats cifra-rival">${marcaRival}</div>` : ""}
      <section class="cifra-panel">
        ${relojMarkup(restante, plazoCifras())}
        <div class="cifra-card" id="cifra-pregunta">${categoryBadge(card)}<strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(regla.pregunta)}</span></div>
        <div class="field cifra-field">
          <label for="cifra-input">Tu cifra${regla.unidad ? ` <span class="cifra-unidad">en ${escapeHtml(regla.unidad)} si no pones otra</span>` : ""}</label>
          <input id="cifra-input" type="text" inputmode="${regla.decimales ? "decimal" : "numeric"}" autocomplete="off" enterkeyhint="send" aria-describedby="cifra-pregunta cifra-unidades" placeholder="${escapeHtml(regla.unidad || "")}" ${cerrada ? "disabled" : "data-autofocus"}>
          <p class="hint" id="cifra-unidades">${escapeHtml(regla.pista || "")}${unidadesMarkup(cifras.mode)}</p>
        </div>
        <button class="btn btn-primary btn-block" data-action="cifra-answer" ${cerrada ? "disabled" : ""}>Responder <span>→</span></button>
        <p class="hint cifra-aviso">El reloj no se para. Si sales de la aplicación, la carta se cierra.</p>
      </section>
    </div>`);
    const campo = app.querySelector("#cifra-input");
    if (campo && !cerrada) campo.addEventListener("keydown", evento => { if (evento.key === "Enter") { evento.preventDefault(); cierraCarta("respuesta"); } });
    if (!cerrada) arrancaReloj();
  }

  // Las unidades que admite el mazo, tal cual las declara su eje. No es decoración: en
  // peso, longevidad y velocidad el valor interno está en una unidad y las cartas se
  // enseñan en otra, así que sin esto no hay manera de saber en qué se responde.
  function unidadesMarkup(modeKeyArg) {
    const lista = Cifras.unidades(modeKeyArg);
    if (lista.length < 2) return "";
    return `<span class="cifra-unidades">Se aceptan: ${lista.map(u => escapeHtml(u.nombre)).join(" · ")}</span>`;
  }

  // El resultado de una carta: lo que valía, lo que se respondió y lo que suma. Aquí ya
  // se puede enseñar el detalle de la carta, que antes de responder muchas veces lleva la
  // cifra dentro.
  function cifrasRevelado() {
    const { jugada, motivo, puntos } = cifras.pendiente;
    const card = cartaCifra();
    const banda = Cifras.banda(cifras.mode, card, jugada.respuesta);
    const acabada = cifras.jugadas.length >= cifras.total;
    const suya = cifras.rival ? cifras.rival.jugadas[indiceCifra()] : null;
    const titulo = jugada.salida ? "Carta cerrada" : banda.nombre;
    const explicacion = jugada.salida
      ? "Has salido de la aplicación con la carta abierta, así que esta no puntúa."
      : jugada.respuesta === null
        ? motivo === "tiempo" ? `Se acabaron los ${Cifras.SEGUNDOS} segundos sin ninguna cifra escrita.` : "No has escrito ninguna cifra."
        : `Tu respuesta: <strong>${escapeHtml(Cifras.formato(cifras.mode, jugada.respuesta))}</strong>${motivo === "tiempo" ? " — llegó con el tiempo agotado, así que no suma la prisa." : ` — has tardado ${(jugada.ms / 1000).toFixed(1)} s.`}`;
    overlay(`<div class="overlay" data-result-card="${puntos > 0 ? card.id : ""}"><div class="modal ${puntos > 0 ? "success" : "failure"}">
      <div class="result-mark" aria-hidden="true">${puntos >= 70 ? "✓" : puntos > 0 ? "≈" : "×"}</div>
      <div class="eyebrow" aria-hidden="true">${escapeHtml(titulo)}</div>
      <h2><span class="solo-lectores">${escapeHtml(titulo)}: </span>${escapeHtml(card.title)}</h2>
      <div class="reveal">${categoryBadge(card)}${CT.Art.button(cifras.mode, card)}<div class="year">${escapeHtml(CT.formatValue(cifras.mode, card))}</div><p>${escapeHtml(card.detail)}</p></div>
      <p>${explicacion}</p>
      <p class="cifra-puntos"><b>+${puntos}</b> ${puntos === 1 ? "punto" : "puntos"}</p>
      ${suya ? `<p class="hint">${escapeHtml(cifras.rival.nombre || "Quien te reta")} respondió ${escapeHtml(suya.salida ? "nada: salió de la aplicación" : Cifras.formato(cifras.mode, suya.respuesta))} y sumó ${Cifras.puntosCarta(cifras.mode, card, suya, plazoCifras())}.</p>` : ""}
      <button class="btn btn-primary btn-block" data-dialog-focus data-action="cifras-next">${acabada ? "Ver el resultado" : "Siguiente carta"} <span>→</span></button>
    </div></div>`);
  }

  function cifrasNext() {
    if (!cifras?.pendiente) return;
    CT.closeDialog?.();
    if (cifras.jugadas.length >= cifras.total) return cifrasFinish();
    abreCarta();
  }

  // Las dos caras del final, como en el otro duelo: quien lo crea manda el enlace y quien
  // lo acepta ve el cara a cara.
  function cifrasFinish() {
    paraReloj();
    setScreen("cifras-end");
    const { mode, seed, total, jugadas, rival } = cifras;
    const modeName = CT.mode(mode).name;
    const plazo = plazoCifras();
    const mios = { puntos: Cifras.puntosPartida(mode, seed, total, jugadas, plazo), jugadas };
    const aciertos = jugadas.filter((jugada, i) => Cifras.puntosCarta(mode, cifras.cartas[i], jugada, plazo) > 0).length;
    const salidas = jugadas.filter(jugada => jugada.salida).length;
    const payload = Cifras.codificar({ mode, seed, total, jugadas, nombre: duelName() });
    const gano = !!rival && mios.puntos > rival.puntos;
    const logros = CT.Progreso.finishGame({ mode, kind: "duel", hits: aciertos, total, won: gano });
    const sessionLogros = [...new Map(logros.map(item => [item.id || item.name, item])).values()];

    let icono = "🎯", eyebrow = "Duelo de cifras listo", titular = `<strong>${mios.puntos}</strong> puntos en ${total} cartas.`, cuerpo = "", acciones = "";
    if (!rival) {
      setLastDuelShare(Cifras.invitacion({ modeName, nombre: duelName(), puntos: mios.puntos, total, payload }));
      cuerpo = `<p class="lead" style="margin-inline:auto">Manda el enlace a quien quieras: recibirá estas mismas ${total} cartas, con los mismos ${Cifras.SEGUNDOS} segundos para cada una.</p>`;
      acciones = `<button class="btn btn-primary" data-action="share-duel">Mandar el reto <span>→</span></button>`;
    } else {
      const empate = mios.puntos === rival.puntos;
      const quien = rival.nombre || "quien te retaba";
      setLastDuelShare(Cifras.marcador({ modeName, mode, seed, total, rival, mio: mios, ms: plazo }));
      icono = empate ? "🤝" : gano ? "🏆" : "🎯";
      eyebrow = empate ? "Empate" : gano ? "Has ganado el duelo" : "Duelo perdido";
      titular = `${mios.puntos} <span style="opacity:.6">a</span> ${rival.puntos}`;
      cuerpo = `<p class="lead" style="margin-inline:auto">${empate ? `Habéis sumado lo mismo que ${escapeHtml(quien)}.` : gano ? `Has superado a ${escapeHtml(quien)}.` : `${escapeHtml(quien)} te ha ganado esta vez.`}</p>
        ${cifrasGridMarkup(quien, rival.jugadas, jugadas, mode, cifras.cartas, plazo)}`;
      acciones = `<button class="btn btn-primary" data-action="start-cifras">Devolver el reto <span>→</span></button><button class="btn btn-secondary" data-action="share-duel">Compartir el resultado</button>`;
    }

    cifras.finished = true;
    guardaCifras();
    cifras = null;
    paint(`<div class="shell">${header()}<section class="pass-screen"><div class="panel">
      <div class="big-icon">${icono}</div><div class="eyebrow">${eyebrow}</div>
      <h1 data-focus tabindex="-1" style="font-size:clamp(2rem,9vw,3.4rem)">${titular}</h1>
      ${cuerpo}
      ${salidas ? `<p class="hint">${salidas === 1 ? "Una carta se cerró" : `${salidas} cartas se cerraron`} por salir de la aplicación.</p>` : ""}
      ${logrosMarkup(sessionLogros)}
      <div class="actions" style="justify-content:center">${acciones}<button class="btn btn-secondary" data-action="solo">Volver a solitario</button><button class="btn btn-secondary" data-action="home">Ir al inicio</button></div>
    </div></section></div>`);
  }

  // Verde lo clavado o casi, amarillo lo que se acercó, blanco lo que no puntuó y negro
  // la carta que se cerró por salir de la aplicación.
  function cifrasGridMarkup(quien, suyas, mias, mode, cartas, plazo) {
    const puntosDe = (jugada, i) => Cifras.puntosCarta(mode, cartas[i], jugada, plazo);
    const clase = (jugada, i) => {
      if (jugada.salida) return "out";
      const puntos = puntosDe(jugada, i);
      return puntos >= 70 ? "ok" : puntos > 0 ? "mid" : "ko";
    };
    const fila = lista => lista.map((jugada, i) => `<i class="${clase(jugada, i)}" aria-hidden="true"></i>`).join("");
    const cuenta = lista => `${lista.filter(puntosDe).length} de ${lista.length}`;
    return `<div class="duel-grid">
      <div><b>${escapeHtml(quien)}</b><div class="duel-row" role="img" aria-label="${escapeHtml(quien)}: puntúa en ${cuenta(suyas)}">${fila(suyas)}</div></div>
      <div><b>Tú</b><div class="duel-row" role="img" aria-label="Tú: puntúas en ${cuenta(mias)}">${fila(mias)}</div></div>
    </div>`;
  }

  // La carta abierta de cifras, si la hay, en el mismo formato que espera el reloj
  // compartido (`cartaEnReloj` en app.js): quién empezó y qué cierra la carta al agotarse.
  function abierta() {
    if (cifras && cifras.empezadaEn !== null && !cifras.pendiente) {
      return { empezadaEn: cifras.empezadaEn, ms: plazoCifras(), cierra: cierraCarta };
    }
    return null;
  }

  function salir() {
    paraReloj();
    if (cifras) { guardaCifras(); cifras = null; }
    soloHome();
  }

  return { startCifras, resumeCifras, cierraCarta, cifrasNext, cargaCifras, abierta, salir };
};
