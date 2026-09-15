// El ranking del reto diario.
//
// Por qué el reto diario y no los puntos de todo lo demás: es el único formato en el que
// todo el mundo juega exactamente las mismas cartas en el mismo orden. La semilla es
// `día:mazo` (ver `startSolo` en `app.js`), así que dos personas que juegan el reto de
// hoy en Historia reciben el mismo reparto. Comparar eso es justo; comparar partidas
// libres, donde cada mazo se baraja al azar y cada cual elige dificultad, no lo sería.
//
// Qué se envía y por qué tan poco:
//
//   El cliente **no manda sus puntos**. Manda las jugadas —en qué hueco puso cada carta—
//   y los aciertos que él cree tener. Quien decide los puntos es la función de
//   `functions/`, que vuelve a repartir el mazo del día a partir de la misma semilla,
//   repite las quince jugadas y cuenta. Si el número no cuadra, la entrada se marca
//   inválida y no puntúa.
//
//   Mientras esa función no esté desplegada, las entradas se quedan en `verificada:
//   false` y la tabla lo dice en pantalla. El formato de los documentos es el mismo en
//   los dos casos: desplegar la función más tarde no obliga a migrar nada ni a cambiar
//   este archivo.
//
// Lo que esto **no** resuelve: el mazo del día se calcula en el móvil a partir de la
// fecha, así que es público y cualquiera puede averiguar de antemano dónde va cada
// carta. La función impide inventarse un resultado —hay que mandar jugadas coherentes
// con el mazo de hoy—, no impide que alguien las calcule en vez de jugarlas. Cerrar esa
// puerta exige que el mazo lo reparta un servidor y el móvil no conozca las fechas: es
// el punto 6 del `ROADMAP.md`, no esto.
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { auth, db, ensureAuth } from "./nube.js";

export const CARTAS_RETO = 15;
const TOPE_TABLA = 50;

// El día del reto es el del móvil, no el del servidor: la semilla del mazo ya se calcula
// con la fecha local (`toLocaleDateString("sv-SE")` en `app.js`), así que quien juega en
// Canarias a las 23:30 está jugando su reto y no el del día siguiente peninsular.
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

// La semana ISO, que es la que hace que el acumulado empiece en lunes. `2026-W38`.
export function semanaDe(dia) {
  const fecha = new Date(`${dia}T00:00:00Z`);
  const jueves = new Date(fecha);
  // El jueves de esa semana decide a qué año pertenece: una semana a caballo entre dos
  // años es del año en el que caen cuatro o más de sus días, y eso es su jueves.
  jueves.setUTCDate(jueves.getUTCDate() + 3 - ((jueves.getUTCDay() + 6) % 7));
  const enero4 = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
  const semana = 1 + Math.round(((jueves - enero4) / 86400000 - 3 + ((enero4.getUTCDay() + 6) % 7)) / 7);
  return `${jueves.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

// Un documento por persona, día y mazo. El identificador lo dice todo, y por eso las
// reglas pueden exigir que acabe en el `uid` de quien escribe: nadie puede enviar el
// resultado de otro, ni enviar dos veces el suyo.
export function idEntrada(dia, mazo, uid) { return `${dia}__${mazo}__${uid}`; }

/**
 * Envía el reto de hoy. Devuelve `{ enviada, motivo }`: no lanza cuando el envío es
 * rechazado por ser repetido, porque repetir es lo normal —se juega una vez al día y la
 * pantalla de resultado se puede recargar— y no es un error que merezca un aviso rojo.
 */
export async function enviarReto({ dia, mazo, aciertos, total = CARTAS_RETO, jugadas = [], cartas = [], ms = 0, huella = "" }) {
  if (!FORMATO_DIA.test(String(dia))) throw Error("Día inválido.");
  await ensureAuth();
  const usuario = auth.currentUser;
  if (usuario.isAnonymous) return { enviada: false, motivo: "sin-cuenta" };
  const nick = usuario.displayName || "";
  if (!nick) return { enviada: false, motivo: "sin-nombre" };

  const entrada = {
    uid: usuario.uid,
    nick,
    dia: String(dia),
    mazo: String(mazo),
    semana: semanaDe(dia),
    aciertos: Math.max(0, Math.min(total, Math.trunc(aciertos))),
    total: Math.trunc(total),
    // Las jugadas: el hueco elegido para cada carta y la carta que tocaba. La función
    // las repite contra el mazo del día; sin ellas no habría nada que comprobar.
    jugadas: jugadas.map(valor => Math.trunc(valor)),
    cartas: cartas.map(valor => Math.trunc(valor)),
    // Cuánto se tardó en total. Desempata en la tabla y le da a la función una manera
    // de descartar lo imposible: quince cartas bien colocadas en dos segundos no las
    // ha jugado nadie.
    ms: Math.max(0, Math.trunc(ms)),
    // La huella del mazo, la misma que usan las salas. Si el móvil lleva una versión con
    // otras cartas, su reto no es el de los demás y la función lo sabrá.
    huella: String(huella),
    creadaEn: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "retosDiarios", idEntrada(dia, mazo, usuario.uid)), entrada);
    return { enviada: true, motivo: "" };
  } catch (error) {
    // `permission-denied` aquí es casi siempre el envío repetido: las reglas no dejan
    // reescribir una entrada que ya existe, que es justo lo que hace que valga un intento.
    if (error?.code === "permission-denied") return { enviada: false, motivo: "ya-enviada" };
    throw error;
  }
}

/** La tabla de un día y un mazo, de más aciertos a menos y, a igualdad, de menos tiempo. */
export async function tabla({ dia, mazo, tope = TOPE_TABLA, soloVerificadas = false }) {
  const filtros = [where("dia", "==", String(dia)), where("mazo", "==", String(mazo))];
  if (soloVerificadas) filtros.push(where("verificada", "==", true));
  const consulta = query(collection(db, "retosDiarios"), ...filtros, orderBy("aciertos", "desc"), orderBy("ms", "asc"), limit(tope));
  const resultado = await getDocs(consulta);
  return resultado.docs.map((documento, indice) => fila(documento.data(), indice + 1));
}

/**
 * En qué puesto va alguien sin traerse la tabla entera. Se cuenta cuánta gente lleva más
 * aciertos: es una sola consulta agregada —no descarga documentos— y deja los empates
 * compartiendo puesto, que es como se leen las tablas de toda la vida.
 */
export async function puesto({ dia, mazo, aciertos }) {
  const consulta = query(collection(db, "retosDiarios"),
    where("dia", "==", String(dia)), where("mazo", "==", String(mazo)), where("aciertos", ">", Math.trunc(aciertos)));
  const cuenta = await getCountFromServer(consulta);
  return cuenta.data().count + 1;
}

/** Cuánta gente ha jugado ese reto. Sirve para que un puesto signifique algo. */
export async function participantes({ dia, mazo }) {
  const consulta = query(collection(db, "retosDiarios"), where("dia", "==", String(dia)), where("mazo", "==", String(mazo)));
  const cuenta = await getCountFromServer(consulta);
  return cuenta.data().count;
}

/** Mi entrada de ese día, si la envié. */
export async function miEntrada({ dia, mazo }) {
  await ensureAuth();
  if (auth.currentUser.isAnonymous) return null;
  const documento = await getDoc(doc(db, "retosDiarios", idEntrada(dia, mazo, auth.currentUser.uid)));
  return documento.exists() ? fila(documento.data(), 0) : null;
}

/**
 * El acumulado de la semana. Lo escribe solo la función al verificar cada reto, así que
 * sin función desplegada esta tabla está vacía: es la diferencia visible entre tener la
 * verificación puesta y no tenerla.
 */
export async function tablaSemanal({ semana, tope = TOPE_TABLA }) {
  const consulta = query(collection(db, "retosSemanales"),
    where("semana", "==", String(semana)), orderBy("puntos", "desc"), limit(tope));
  const resultado = await getDocs(consulta);
  return resultado.docs.map((documento, indice) => {
    const datos = documento.data();
    return {
      puesto: indice + 1,
      uid: String(datos.uid || ""),
      nick: String(datos.nick || ""),
      puntos: Number(datos.puntos) || 0,
      dias: Number(datos.dias) || 0
    };
  });
}

function fila(datos, puesto) {
  return {
    puesto,
    uid: String(datos.uid || ""),
    nick: String(datos.nick || ""),
    aciertos: Number(datos.aciertos) || 0,
    total: Number(datos.total) || CARTAS_RETO,
    ms: Number(datos.ms) || 0,
    // `verificada` solo existe cuando la función ha pasado por ahí. Indefinido no es
    // lo mismo que falso y la pantalla los distingue: «pendiente» frente a «rechazada».
    verificada: datos.verificada === undefined ? null : !!datos.verificada,
    motivo: String(datos.motivo || "")
  };
}
