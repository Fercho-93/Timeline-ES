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

  // El reparto de un duelo: la primera carta abre la línea y el resto se van jugando.
  // Dos móviles con el mismo mazo, la misma semilla y el mismo número reciben esto
  // idéntico, que es lo único que hace falta para que el duelo sea comparable.
  function reparto(modeKey, seed, total = CARTAS) {
    const ids = CT.cards(modeKey).map(card => card.id);
    return CT.shuffleWith(ids, CT.seededRandom(CT.seedFrom(`${seed}:${modeKey}`))).slice(0, total + 1);
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
  //   1 | mazo | semilla | cartas | aciertos | secuencia | huella | nombre
  function codificar({ mode, seed, total, hits, sequence, nombre }) {
    const campos = [
      "1", mode, seed, total, hits,
      sequence.map(acierto => (acierto ? "1" : "0")).join(""),
      huella(mode), limpiaNombre(nombre)
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
    const [version, mode, seed, textoTotal, textoHits, bits, huellaRival, nombre] = campos;

    if (version !== "1") return { ok: false, motivo: "version" };
    if (!CT.has(mode)) return { ok: false, motivo: "mazo" };
    if (!/^[a-z0-9]{1,12}$/.test(seed)) return { ok: false, motivo: "roto" };

    const total = Number(textoTotal);
    const hits = Number(textoHits);
    if (!Number.isInteger(total) || total < 1 || total > MAX_CARTAS) return { ok: false, motivo: "roto" };
    if (!Number.isInteger(hits) || hits < 0 || hits > total) return { ok: false, motivo: "roto" };
    // Hace falta una carta más que las jugadas: la que abre la línea temporal.
    if (total + 1 > CT.cards(mode).length) return { ok: false, motivo: "roto" };
    if (!/^[01]+$/.test(bits) || bits.length !== total) return { ok: false, motivo: "roto" };
    const secuencia = [...bits].map(bit => bit === "1");
    if (secuencia.filter(Boolean).length !== hits) return { ok: false, motivo: "roto" };

    if (huellaRival !== huella(mode)) return { ok: false, motivo: "mazo-distinto" };

    return {
      ok: true,
      duelo: { mode, seed, total, rival: { nombre: limpiaNombre(nombre), hits, sequence: secuencia } }
    };
  }

  function enlace(payload) {
    const base = `${location.origin}${location.pathname}`;
    return `${base}?duelo=${payload}`;
  }

  // El texto que se manda. Lleva el enlace y la marca a batir, pero ninguna carta: quien
  // lo recibe tiene que jugarlo sin saber qué le va a salir.
  function invitacion({ modeName, nombre, hits, total, payload }) {
    const quien = nombre ? `${nombre} te reta` : "Te retan";
    return `${quien} en Continuum · ${modeName}\n📊 ${hits}/${total} — a ver si lo superas\n${enlace(payload)}`;
  }

  // El cara a cara, para compartir el resultado. Las dos cuadrículas, una debajo de otra,
  // al estilo de lo que ya comparte el reto diario.
  function marcador({ modeName, rival, mio }) {
    const rejilla = sec => sec.map(acierto => (acierto ? "🟩" : "⬜")).join("");
    const veredicto = mio.hits > rival.hits ? "Gano yo" : mio.hits < rival.hits ? `Gana ${rival.nombre || "quien retaba"}` : "Empate";
    return `Duelo en Continuum · ${modeName}\n${veredicto} — ${mio.hits} a ${rival.hits}\n${rival.nombre || "Quien retaba"} ${rejilla(rival.sequence)}\nYo ${rejilla(mio.sequence)}`;
  }

  CT.Duelo = { CARTAS, MAX_CARTAS, MAX_NOMBRE, huella, crearSemilla, reparto, codificar, descodificar, enlace, invitacion, marcador, limpiaNombre };
})();
