// La cartera: el único sitio del juego que responde a «¿tiene derecho este jugador a este
// mazo?».
//
// No hay nada a la venta todavía. El trabajo que hace este archivo no es cerrar mazos: es
// que todo el juego pregunte por aquí en vez de dar por hecho que el catálogo entero está
// abierto. El día que haya tienda se enchufa en un sitio —`concede`— y no hay que ir
// rincón por rincón repasando la portada, el menú de mazos, la enciclopedia, la
// competición y los duelos.
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

  // ── La simulación ──────────────────────────────────────────────────────────────────
  //
  // Mientras esta lista tenga algo dentro, el juego se comporta como si esos mazos
  // estuvieran esperando un pago: la portada los marca con un candado, el menú explica lo
  // que haría falta, la competición no los sortea, la enciclopedia no enseña sus cartas y
  // un enlace de duelo suyo se rechaza con una explicación en vez de romperse.
  //
  // Es una maqueta para poder verlo antes de que exista ninguna tienda. No hay cobro, no
  // hay ficha de producto en App Store Connect ni en Play Console, y no hay nada
  // guardado: una compra simulada dura lo que dure la sesión y al recargar el mazo vuelve
  // a estar cerrado, que es justo lo que interesa para poder mirarlo tantas veces como
  // haga falta. Para quitar la simulación basta con dejar la lista vacía.
  const SIMULACION = ["mixed"];

  // Precios de mentira, solo para que la puerta cerrada enseñe una cifra en vez de un
  // hueco. No comprometen ningún precio real: eso se decide al registrar los productos en
  // las tiendas, y es entonces cuando la cifra deja de estar aquí y pasa a venir de
  // ellas, que son las que saben la moneda y los impuestos de cada país. En céntimos para
  // no arrastrar decimales.
  const PRECIOS = { mezcla: 299, [PAQUETE_TODO]: 999 };

  function euros(centimos) {
    return typeof centimos === "number" ? `${(centimos / 100).toFixed(2).replace(".", ",")} €` : null;
  }

  // Quién concede lo que hay abierto ahora mismo, y qué concede. `mazos: null` significa
  // «todo el catálogo»; una lista, exactamente esos.
  let concesion = { origen: "beta", mazos: null };

  function paquetes() {
    const bloques = Object.values(CT.BLOCKS).map(bloque => ({
      clave: bloque.key, nombre: bloque.name, mazos: bloque.games.slice(),
      precio: euros(PRECIOS[bloque.key])
    }));
    return [
      ...bloques,
      {
        clave: PAQUETE_TODO, nombre: "Todos los mazos",
        mazos: bloques.flatMap(bloque => bloque.mazos), precio: euros(PRECIOS[PAQUETE_TODO])
      }
    ];
  }

  // El paquete al que pertenece un mazo: el bloque que lo contiene. Es lo que habría que
  // comprar para desbloquearlo, y lo que hay que nombrarle a quien se encuentre la puerta
  // cerrada, porque «compra Geografía» se entiende y «compra el mazo 3001» no. `solo`
  // distingue el bloque que no es una colección sino un mazo suelto —«Gran mezcla
  // temporal» es su propio bloque—, porque a ese no se le puede decir «viene con» sin
  // repetir su nombre dos veces en la misma frase.
  function paquete(modeKey) {
    if (!CT.has(modeKey)) return null;
    const bloque = CT.blockOf(modeKey);
    if (!bloque) return null;
    return {
      clave: bloque.key, nombre: bloque.name,
      precio: euros(PRECIOS[bloque.key]), solo: bloque.games.length === 1
    };
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
  // `null` cuando sí se puede.
  function motivo(modeKey) {
    if (tiene(modeKey)) return null;
    const suyo = paquete(modeKey);
    if (!suyo) return { mazo: modeKey, paquete: PAQUETE_TODO, precio: null, texto: "Este mazo todavía no está disponible." };
    const porPrecio = suyo.precio ? ` por ${suyo.precio}` : "";
    return {
      mazo: modeKey,
      paquete: suyo.clave,
      precio: suyo.precio,
      texto: suyo.solo ? `Este mazo se desbloquea aparte${porPrecio}.` : `Este mazo viene con ${suyo.nombre}${porPrecio}.`
    };
  }

  // La única puerta por la que se cambia lo que hay abierto. Hoy la llama el arranque;
  // mañana la llamaría la respuesta de la tienda, después de preguntarle qué tiene
  // comprado esta cuenta. Nadie más debería tocar `concesion`.
  function concede({ origen, mazos = null }) {
    if (typeof origen !== "string" || !origen) throw Error("Una concesión necesita saber de dónde viene");
    concesion = { origen, mazos: Array.isArray(mazos) ? mazos.filter(CT.has) : null };
    return concesion;
  }

  // Lo que hay abierto al abrir el juego. Sin tienda a la que preguntar, lo concede la
  // beta: el catálogo entero, menos lo que la simulación tenga cerrado. El día que haya
  // tienda, este es el sitio donde se le pregunta qué tiene comprado la cuenta —y se
  // pregunta en cada apertura, porque quien manda es ella y no lo que quedó guardado en
  // el móvil.
  function arranque() {
    const cerradosPorSimulacion = SIMULACION.filter(CT.has);
    if (!cerradosPorSimulacion.length) return concede({ origen: "beta", mazos: null });
    return concede({
      origen: "simulacion",
      mazos: Object.keys(CT.MODES).filter(modeKey => !cerradosPorSimulacion.includes(modeKey))
    });
  }

  // Una compra que no cobra nada. Añade los mazos del paquete a lo que ya había abierto,
  // sin guardar nada en ninguna parte: al recargar vuelve a mandar `arranque` y la puerta
  // se cierra otra vez. Es a propósito —una maqueta que se pudiera dejar desbloqueada
  // para siempre dejaría de servir para mirarla.
  function compraSimulada(clave) {
    const suyo = paquetes().find(uno => uno.clave === clave);
    if (!suyo) return false;
    concede({ origen: "compra-simulada", mazos: [...new Set([...abiertos(), ...suyo.mazos])] });
    return true;
  }

  function origen() { return concesion.origen; }
  function todoAbierto() { return cerrados().length === 0; }

  CT.Cartera = {
    PAQUETE_TODO, LIBRES, SIMULACION,
    tiene, tieneBloque, cerrados, abiertos, motivo, paquete, paquetes,
    concede, arranque, compraSimulada, origen, todoAbierto
  };

  // La cartera se deja lista al cargarse, no al arrancar la interfaz: `app.js` decide qué
  // mazo tenía elegido el jugador antes de pintar nada, y para eso ya necesita saber a
  // cuáles tiene derecho.
  arranque();
})();
