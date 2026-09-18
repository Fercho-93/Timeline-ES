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
  //
  // Hay dos casos dentro a propósito, porque no se ven igual: «Gran mezcla temporal» es un
  // mazo suelto —su bloque solo lo tiene a él—, mientras que Ciencia es una colección
  // entera, con su carátula bloqueada y sus dos mazos diciendo que vienen juntos.
  const SIMULACION = ["mixed", "astronomy", "medicine"];

  // ── Lo que se puede comprar ────────────────────────────────────────────────────────
  //
  // Dos maneras de llegar al mismo mazo, y conviven:
  //
  //   · el mazo suelto, a su precio;
  //   · la colección entera, con todos sus mazos, más barata que llevárselos uno a uno.
  //
  // Un bloque de un solo mazo —«Gran mezcla temporal»— no tiene colección que vender: su
  // colección y su mazo serían la misma cosa con dos precios distintos, y eso no se
  // entiende. Ahí solo hay una manera de entrar.
  //
  // Precios de mentira, solo para que la puerta cerrada enseñe una cifra en vez de un
  // hueco. No comprometen ningún precio real: eso se decide al registrar los productos en
  // las tiendas, y es entonces cuando la cifra deja de estar aquí y pasa a venir de
  // ellas, que son las que saben la moneda y los impuestos de cada país. En céntimos para
  // no arrastrar decimales.
  const PRECIO_MAZO = 399;

  // Lo que se ahorra cada mazo a partir del primero cuando se lleva dentro de su
  // colección. Con esto el precio de una colección no hay que inventárselo uno a uno:
  // sale de cuántos mazos tiene. Ciencia, con dos, son 5,99 €; una de tres, 7,99 €.
  const AHORRO_POR_MAZO = 199;
  const precioColeccion = mazos => PRECIO_MAZO + (mazos - 1) * (PRECIO_MAZO - AHORRO_POR_MAZO);

  // El catálogo entero se sale de esa cuenta a propósito: con dieciséis mazos daría una
  // cifra que nadie paga. Llevárselo todo de golpe es el mejor trato que hay, y por eso
  // su precio se pone a mano.
  const PRECIO_TODO = 1499;

  // Las claves de los paquetes de un mazo suelto llevan prefijo para no chocar nunca con
  // la clave de un bloque.
  const MAZO = "mazo:";

  function euros(centimos) {
    return typeof centimos === "number" ? `${(centimos / 100).toFixed(2).replace(".", ",")} €` : null;
  }

  // Quién concede lo que hay abierto ahora mismo, y qué concede. `mazos: null` significa
  // «todo el catálogo»; una lista, exactamente esos.
  let concesion = { origen: "beta", mazos: null };

  // El paquete de un mazo suelto.
  function paqueteDeMazo(modeKey) {
    if (!CT.has(modeKey)) return null;
    return {
      clave: MAZO + modeKey, tipo: "mazo", nombre: CT.mode(modeKey).name,
      mazos: [modeKey], precio: euros(PRECIO_MAZO)
    };
  }

  // Y el de una colección, que solo existe cuando de verdad agrupa varios mazos.
  function paqueteDeColeccion(blockKey) {
    if (!CT.hasBlock(blockKey)) return null;
    const bloque = CT.block(blockKey);
    if (bloque.games.length < 2) return null;
    return {
      clave: bloque.key, tipo: "coleccion", nombre: bloque.name,
      mazos: bloque.games.slice(), precio: euros(precioColeccion(bloque.games.length))
    };
  }

  function paquetes() {
    const bloques = Object.values(CT.BLOCKS);
    return [
      ...Object.keys(CT.MODES).map(paqueteDeMazo),
      ...bloques.map(bloque => paqueteDeColeccion(bloque.key)).filter(Boolean),
      {
        clave: PAQUETE_TODO, tipo: "todo", nombre: "Todos los mazos",
        mazos: bloques.flatMap(bloque => bloque.games), precio: euros(PRECIO_TODO)
      }
    ];
  }

  // Las maneras de conseguir un mazo, de la más barata a la más completa: siempre el mazo
  // suelto, y además su colección cuando la haya.
  //
  // La colección solo se ofrece si todavía abre más de un mazo. Si ya tienes los demás y
  // solo te falta este, ofrecerte la colección entera sería cobrarte por lo que ya es
  // tuyo, y encima más caro que el mazo que buscas.
  function opciones(modeKey) {
    const suelto = paqueteDeMazo(modeKey);
    if (!suelto) return [];
    const bloque = CT.blockOf(modeKey);
    const coleccion = bloque ? paqueteDeColeccion(bloque.key) : null;
    return coleccion && cerrados(bloque.key).length > 1 ? [suelto, coleccion] : [suelto];
  }

  // El bloque al que pertenece un mazo, para nombrar la colección de la que forma parte.
  function paquete(modeKey) {
    if (!CT.has(modeKey)) return null;
    const bloque = CT.blockOf(modeKey);
    return bloque ? { clave: bloque.key, nombre: bloque.name, solo: bloque.games.length === 1 } : null;
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
  // `null` cuando sí se puede. `texto` es la línea corta de la lista de mazos, donde no
  // cabe más que el precio; la pantalla de la puerta cerrada no la usa, se hace la suya a
  // partir de `opciones`, que es donde están las dos maneras de entrar.
  function motivo(modeKey) {
    if (tiene(modeKey)) return null;
    const vias = opciones(modeKey);
    if (!vias.length) return { mazo: modeKey, opciones: [], paquete: PAQUETE_TODO, precio: null, texto: "Este mazo todavía no está disponible." };
    const [suelto, coleccion] = vias;
    return {
      mazo: modeKey,
      opciones: vias,
      paquete: suelto.clave,
      precio: suelto.precio,
      texto: coleccion
        ? `${suelto.precio} suelto · ${coleccion.precio} toda la colección ${coleccion.nombre}`
        : `Se desbloquea por ${suelto.precio}`
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
    tiene, tieneBloque, cerrados, abiertos, motivo, opciones, paquete, paquetes,
    concede, arranque, compraSimulada, origen, todoAbierto
  };

  // La cartera se deja lista al cargarse, no al arrancar la interfaz: `app.js` decide qué
  // mazo tenía elegido el jugador antes de pintar nada, y para eso ya necesita saber a
  // cuáles tiene derecho.
  arranque();
})();
