// Quién juega en este móvil: su nombre. Se pide una vez, al entrar por primera vez, y
// se cambia después desde el Atlas. Es el mismo que usa la cuenta (y con él el ranking y
// los duelos). El avatar queda ligado al invitado, no a este nombre.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const CLAVE = "continuum-identidad-v1";
  const NOMBRE_ANTIGUO = "hilo-nombre-v1";
  // Los nombres que pone el juego por su cuenta no cuentan como elegidos: el invitado
  // nace como «Player 1234» y el duelo usaba «Explorador» mientras no hubiera otro.
  const PUESTO_POR_EL_JUEGO = /^(Player \d{4}|Explorador|Jugador \d+)$/i;
  // 18 caracteres: lo que admiten los nombres de las salas y de la partida en un móvil.
  const MAX = 18;

  function limpia(nombre) { return String(nombre ?? "").replace(/\s+/g, " ").trim(); }

  // Devuelve el motivo si el nombre no vale, o `null` si vale. Las mismas letras que
  // acepta la cuenta, para que lo que se escribe aquí se pueda guardar también allí.
  function problema(nombre) {
    const n = limpia(nombre);
    if (n.length < 2) return "Escribe al menos 2 letras.";
    if (n.length > MAX) return `Como mucho ${MAX} caracteres.`;
    if (!/^[a-z0-9áéíóúüñ_-](?:[a-z0-9áéíóúüñ _-]*[a-z0-9áéíóúüñ_-])?$/i.test(n)) return "Usa letras, números, espacios, guion o guion bajo.";
    if (PUESTO_POR_EL_JUEGO.test(n)) return "Elige un nombre tuyo.";
    return null;
  }

  function leer() {
    try {
      const guardada = JSON.parse(CT.Storage.getItem(CLAVE));
      if (guardada && !problema(guardada.nombre)) return { nombre: guardada.nombre };
    } catch { /* se vuelve a pedir */ }
    return null;
  }

  function guarda({ nombre }) {
    const identidad = { nombre: limpia(nombre) };
    if (problema(identidad.nombre)) throw Error("Identidad no válida");
    CT.Storage.setItem(CLAVE, JSON.stringify(identidad));
    CT.Storage.setItem(NOMBRE_ANTIGUO, identidad.nombre);
    return identidad;
  }

  // Quien ya había elegido nombre antes de que existiera esta pantalla —en su cuenta o
  // en un duelo— no tiene que volver a escribirlo: se le reconoce. Devuelve si ya hay
  // identidad.
  function reconoce() {
    if (leer()) return true;
    // Sin almacenamiento (navegación privada estricta, datos bloqueados) no hay dónde
    // guardar el nombre: pedirlo dejaría a quien juega atascado en la bienvenida.
    if (!disponible()) return true;
    const candidatos = [CT.Accounts?.profile?.alias, CT.Storage.getItem(NOMBRE_ANTIGUO)];
    const nombre = candidatos.map(limpia).find(n => n && !problema(n));
    if (!nombre) return false;
    try { guarda({ nombre }); return true; } catch { return false; }
  }

  function disponible() {
    try { const prueba = `${CLAVE}-prueba`; CT.Storage.setItem(prueba, "1"); const ok = CT.Storage.getItem(prueba) === "1"; CT.Storage.removeItem(prueba); return ok; }
    catch { return false; }
  }

  CT.Identidad = {
    MAX, leer, guarda, reconoce, problema, limpia,
    hecha: () => !!leer(),
    nombre: () => leer()?.nombre || ""
  };
})();
