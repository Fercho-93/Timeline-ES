// Repetir el reto diario fuera del móvil.
//
// Este archivo no sabe nada de Firebase a propósito: recibe unas jugadas, vuelve a
// repartir el mazo de ese día y cuenta los aciertos. Así lo puede ejecutar tanto la
// función de `index.js` como `tests/ranking.mjs`, que es donde se comprueba que el
// reparto de aquí y el de `app.js` son de verdad el mismo.
//
// El reparto tiene que coincidir carta por carta con `startSolo`, en `app.js`:
//
//     barajado = shuffleWith(ids, seededRandom(seedFrom(`${día}:${mazo}`))).slice(0, 16)
//     timeline = [barajado.shift()]   ← la carta de salida, ya colocada
//     el resto se juega en ese orden
//
// Si alguna vez cambia esa línea, cambia el mazo del día y esta comprobación empezaría a
// rechazar partidas legítimas. La prueba las compara precisamente para que no pase.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const CARTAS_RETO = 15;
export const VIDAS = 3;

// Colocar una carta son tres gestos: arrastrarla, confirmar el hueco y cerrar el aviso
// del resultado. Menos de medio segundo por carta no lo hace una persona; es el suelo
// más bajo que se puede poner sin castigar a quien juega rápido y ya conoce el mazo.
const MS_MINIMO_POR_CARTA = 500;
const MS_MAXIMO = 6 * 3600 * 1000;

/**
 * Carga los mazos y `modes.js` en un contexto sin navegador y devuelve `window.CONTINUUM`.
 * Los archivos son los mismos del juego, copiados tal cual por `preparar.mjs`: no hay una
 * segunda copia de las fechas que pudiera quedarse atrás.
 */
export function cargarJuego(directorio) {
  const lista = JSON.parse(fs.readFileSync(path.join(directorio, "lista.json"), "utf8"));
  const contexto = vm.createContext({ window: {} });
  for (const archivo of lista) {
    vm.runInContext(fs.readFileSync(path.join(directorio, archivo), "utf8"), contexto, { filename: archivo });
  }
  const CT = contexto.window.CONTINUUM;
  if (!CT?.cards) throw Error("Los mazos no se han cargado.");
  return CT;
}

/** El reparto del reto de un día: la carta de salida y las que se juegan, en orden. */
export function mazoDelDia(CT, dia, mazo, cartas = CARTAS_RETO) {
  const ids = CT.cards(mazo).map(carta => carta.id);
  const barajado = CT.shuffleWith(ids, CT.seededRandom(CT.seedFrom(`${dia}:${mazo}`))).slice(0, cartas + 1);
  return { salida: barajado[0], porJugar: barajado.slice(1) };
}

/**
 * Repite una partida y dice si el resultado declarado se sostiene.
 *
 * Devuelve `{ valida, aciertos, puntos, motivo }`. `aciertos` es siempre el número que
 * sale de repetir las jugadas, no el que venía en el documento: cuando los dos no
 * coinciden, el que se guarda es este y la entrada queda marcada como inválida.
 */
export function revisar(CT, entrada) {
  const { dia, mazo, jugadas = [], cartas = [], aciertos: declarados = 0, total = CARTAS_RETO, ms = 0, huella = "" } = entrada || {};

  if (!CT.has(mazo)) return rechazo("mazo-desconocido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia))) return rechazo("dia-invalido");
  if (!Number.isInteger(total) || total < 1 || total > 50) return rechazo("total-invalido");
  if (!Array.isArray(jugadas) || !Array.isArray(cartas) || jugadas.length !== cartas.length) return rechazo("jugadas-invalidas");
  if (jugadas.length > total) return rechazo("jugadas-de-mas");
  // Una huella distinta es un móvil con otras cartas: su reto no es el de los demás y
  // compararlos sería mezclar dos mazos en la misma tabla.
  if (huella && huella !== CT.deckFingerprint(mazo)) return rechazo("mazo-distinto");
  if (!Number.isInteger(ms) || ms < 0 || ms > MS_MAXIMO) return rechazo("tiempo-invalido");
  if (jugadas.length && ms < jugadas.length * MS_MINIMO_POR_CARTA) return rechazo("demasiado-rapido");

  const { salida, porJugar } = mazoDelDia(CT, dia, mazo, total);
  if (porJugar.length < total) return rechazo("mazo-corto");

  const valor = new Map(CT.cards(mazo).map(carta => [carta.id, CT.sortValue(mazo, carta)]));
  const linea = [salida];
  let aciertos = 0;
  let vidas = VIDAS;

  for (let turno = 0; turno < jugadas.length; turno++) {
    if (!vidas) return rechazo("seguia-sin-vidas", aciertos);
    // La carta de cada turno la decide el reparto, no quien envía: mandar otra es
    // haber jugado un mazo que no es el de hoy.
    if (cartas[turno] !== porJugar[turno]) return rechazo("carta-fuera-de-orden", aciertos);
    const hueco = jugadas[turno];
    if (!Number.isInteger(hueco) || hueco < 0 || hueco > linea.length) return rechazo("hueco-invalido", aciertos);

    const numero = valor.get(porJugar[turno]);
    const anterior = hueco > 0 ? valor.get(linea[hueco - 1]) : null;
    const siguiente = hueco < linea.length ? valor.get(linea[hueco]) : null;
    const acierto = (anterior === null || numero >= anterior) && (siguiente === null || numero <= siguiente);

    if (acierto) { linea.splice(hueco, 0, porJugar[turno]); aciertos++; }
    else vidas--;
  }

  // La partida tiene que haber terminado: o se jugaron las quince cartas o se acabaron
  // las vidas. Una partida cortada a la mitad no es un resultado, es un abandono, y
  // dejarla puntuar permitiría enviar solo los aciertos y callarse los fallos.
  if (jugadas.length < total && vidas > 0) return rechazo("partida-incompleta", aciertos);
  if (declarados !== aciertos) return rechazo("aciertos-no-coinciden", aciertos);

  return { valida: true, aciertos, puntos: aciertos, motivo: "" };
}

function rechazo(motivo, aciertos = 0) {
  return { valida: false, aciertos, puntos: 0, motivo };
}
