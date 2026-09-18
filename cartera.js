// La cartera: el único sitio del juego que responde a «¿tiene derecho este jugador a este
// mazo?».
//
// Hoy la respuesta es siempre que sí, porque no hay nada a la venta. El trabajo que hace
// este archivo no es cerrar mazos: es que todo el juego pregunte por aquí en vez de dar
// por hecho que el catálogo entero está abierto. El día que haya tienda se enchufa en un
// sitio —`concede`— y no hay que ir rincón por rincón repasando la portada, el menú de
// mazos, la enciclopedia, la competición y los duelos.
//
// Dos reglas que no conviene romper:
//
// 1. Lo que hay guardado en el móvil NUNCA manda sobre lo comprado. Sirve para poder
//    jugar sin conexión y nada más. Quien manda es la tienda —Apple o Google llevan ellas
//    el registro de lo que cada cuenta ha comprado— y se le pregunta al abrir. Si se
//    invierte esto, el día que alguien borre los datos del navegador le habremos quitado
//    un mazo a un cliente que pagó.
// 2. La cartera decide qué se puede JUGAR, nunca qué se ha jugado. El progreso, los
//    logros y las cartas descubiertas son del jugador y no se tocan aunque un mazo deje
//    de estar a su alcance.
(function () {
  "use strict";
  const CT = window.CONTINUUM;

  // Lo que se vendería, si algún día se vende. Los paquetes son los bloques que ya
  // existen —un bloque es una colección temática con sus mazos dentro—, más un paquete
  // que lo incluye todo. Declararlo ahora no compromete ningún precio ni ninguna
  // decisión: es el esqueleto sobre el que colgar las fichas de las tiendas.
  const PAQUETE_TODO = "todo";

  // Los mazos que serían gratis siempre, estén o no compradas las demás cosas. Está
  // vacío a propósito: esa decisión —qué prueba alguien que acaba de instalar el juego—
  // todavía no está tomada, y no es mía. Cuando se tome, se escribe aquí y el resto del
  // juego se entera solo.
  const LIBRES = [];

  // Quién concede lo que hay abierto ahora mismo, y qué concede. `mazos: null` significa
  // «todo el catálogo», que es la situación de hoy: una beta sin tienda donde nadie ha
  // pagado nada y nadie tiene nada cerrado.
  let concesion = { origen: "beta", mazos: null };

  function paquetes() {
    const bloques = Object.values(CT.BLOCKS).map(bloque => ({
      clave: bloque.key, nombre: bloque.name, mazos: bloque.games.slice()
    }));
    return [
      ...bloques,
      { clave: PAQUETE_TODO, nombre: "Todos los mazos", mazos: bloques.flatMap(bloque => bloque.mazos) }
    ];
  }

  // El paquete al que pertenece un mazo: el bloque que lo contiene. Es lo que habría que
  // comprar para desbloquearlo, y lo que hay que nombrarle a quien se encuentre la puerta
  // cerrada, porque «compra Geografía» se entiende y «compra el mazo 3001» no.
  function paquete(modeKey) {
    if (!CT.has(modeKey)) return null;
    const bloque = CT.blockOf(modeKey);
    return bloque ? { clave: bloque.key, nombre: bloque.name } : null;
  }

  function tiene(modeKey) {
    if (!CT.has(modeKey)) return false;
    if (LIBRES.includes(modeKey)) return true;
    return concesion.mazos === null || concesion.mazos.includes(modeKey);
  }

  // Un bloque está abierto cuando lo están todos sus mazos. Se usa para decidir si la
  // portada tiene que enseñar algo en esa colección.
  function tieneBloque(blockKey) {
    return CT.hasBlock(blockKey) && CT.block(blockKey).games.every(tiene);
  }

  function cerrados(blockKey) {
    const mazos = CT.hasBlock(blockKey) ? CT.block(blockKey).games : Object.keys(CT.MODES);
    return mazos.filter(modeKey => !tiene(modeKey));
  }

  function abiertos() {
    return Object.keys(CT.MODES).filter(tiene);
  }

  // Por qué no se puede jugar a un mazo, dicho de manera que se pueda enseñar. Devuelve
  // `null` cuando sí se puede, que es el caso de hoy para todos.
  function motivo(modeKey) {
    if (tiene(modeKey)) return null;
    const suyo = paquete(modeKey);
    return {
      mazo: modeKey,
      paquete: suyo?.clave || PAQUETE_TODO,
      texto: suyo ? `Este mazo viene con ${suyo.nombre}.` : "Este mazo todavía no está disponible."
    };
  }

  // La única puerta por la que se cambia lo que hay abierto. Hoy la llama el arranque con
  // la concesión de la beta; mañana la llamaría la respuesta de la tienda, después de
  // preguntarle qué tiene comprado esta cuenta. Nadie más debería tocar `concesion`.
  function concede({ origen, mazos = null }) {
    if (typeof origen !== "string" || !origen) throw Error("Una concesión necesita saber de dónde viene");
    concesion = { origen, mazos: Array.isArray(mazos) ? mazos.filter(CT.has) : null };
    return concesion;
  }

  function origen() { return concesion.origen; }
  function todoAbierto() { return concesion.mazos === null; }

  CT.Cartera = {
    PAQUETE_TODO, LIBRES,
    tiene, tieneBloque, cerrados, abiertos, motivo, paquete, paquetes,
    concede, origen, todoAbierto
  };
})();
