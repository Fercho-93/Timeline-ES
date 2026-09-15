// Las cuentas.
//
// Hasta ahora una persona era su `uid` anónimo: servía para jugar una sala y se perdía
// al cambiar de móvil o al borrar los datos del navegador. El perfil de `progreso.js`
// vivía solo en el aparato y se movía copiando un texto a mano. Con una cuenta el perfil
// deja de ser del móvil y pasa a ser de quien juega, que es lo que hace posible un
// ranking en el que cada nombre signifique siempre a la misma persona.
//
// La pieza importante es que registrarse **no estrena identidad**: la sesión anónima que
// ya había se convierte en una cuenta con `linkWithCredential` y conserva el mismo `uid`.
// Las salas jugadas antes de registrarse siguen siendo tuyas y no hay nada que migrar.
//
// Qué se guarda en la nube y dónde:
//
//   users/{uid}              Lo público: el nombre visible y desde cuándo. Cualquiera
//                            con sesión puede leerlo, porque el ranking enseña nombres.
//   users/{uid}/datos/perfil Lo privado: la copia del perfil de `progreso.js`. Solo la
//                            lee y la escribe su dueño.
//   nicks/{nickEnMinusculas} La reserva del nombre. Existir es lo que lo hace único:
//                            las reglas no dejan crear uno que ya esté.
import { EmailAuthProvider, createUserWithEmailAndPassword, linkWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { auth, db, ensureAuth, observarSesion } from "./nube.js";

export const NICK_MIN = 3;
export const NICK_MAX = 18;

// Letras (con acentos y ñ), cifras, espacio y los tres signos que la gente usa en un
// apodo. Nada de comas, comillas ni símbolos: el nombre se enseña en la tabla del
// ranking y cuanto menos quepa dentro, menos hay que recordar al pintarlo.
const NICK_PERMITIDO = /^[\p{L}\p{N} ._-]+$/u;

export function normalizarNick(texto) {
  return String(texto ?? "").trim().replace(/\s+/g, " ");
}

// La clave de unicidad. Dos nombres que solo se distinguen por mayúsculas o por acentos
// son el mismo a efectos de confundir a quien mira la tabla, así que se pliegan los dos:
// `normalize("NFD")` separa la tilde de la letra y el rango la borra.
export function claveNick(texto) {
  return normalizarNick(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Devuelve el motivo por el que no vale, o cadena vacía si vale.
export function motivoNickInvalido(texto) {
  const nick = normalizarNick(texto);
  if (nick.length < NICK_MIN) return `El nombre necesita al menos ${NICK_MIN} caracteres.`;
  if (nick.length > NICK_MAX) return `El nombre no puede pasar de ${NICK_MAX} caracteres.`;
  if (!NICK_PERMITIDO.test(nick)) return "El nombre solo admite letras, cifras, espacio y los signos . _ -";
  return "";
}

export function motivoClaveInvalida(clave) {
  // Firebase rechaza por debajo de seis. Pedimos ocho: una contraseña de seis cifras
  // en un juego acaba siendo la fecha de nacimiento de quien la escribe.
  if (String(clave ?? "").length < 8) return "La contraseña necesita al menos 8 caracteres.";
  return "";
}

export function motivoCorreoInvalido(correo) {
  // No se valida el correo a fondo aquí: el único juez de si existe es el mensaje de
  // verificación que llega o no llega. Esto solo atrapa el despiste evidente.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(correo ?? "").trim())) return "Revisa la dirección de correo.";
  return "";
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export function sesion() {
  const actual = auth.currentUser;
  if (!actual) return { uid: null, registrada: false, correo: "", nick: "", verificado: false };
  return {
    uid: actual.uid,
    // `isAnonymous` deja de ser cierto en cuanto la sesión se vincula a un correo, sin
    // recargar nada: es el mismo objeto de usuario, con proveedor nuevo.
    registrada: !actual.isAnonymous,
    correo: actual.email || "",
    nick: actual.displayName || "",
    verificado: !!actual.emailVerified
  };
}

export function observar(listener) {
  return observarSesion(() => listener(sesion()));
}

// ---------------------------------------------------------------------------
// El nombre visible
// ---------------------------------------------------------------------------

async function reservarNick(uid, nick, anterior = "") {
  const clave = claveNick(nick);
  const mismaReserva = anterior && claveNick(anterior) === clave;
  const lote = writeBatch(db);
  // Cambiar de «Lucia» a «Lucía» no es cambiar de nombre: la reserva es la misma y
  // tocarla dentro del mismo lote —borrarla y volver a crearla— sería pedirle a
  // Firestore dos escrituras sobre el mismo documento. Solo cambia la grafía guardada.
  if (anterior && !mismaReserva) lote.delete(doc(db, "nicks", claveNick(anterior)));
  if (!mismaReserva) lote.set(doc(db, "nicks", clave), { uid });
  lote.set(doc(db, "users", uid), {
    nick: normalizarNick(nick),
    nickLower: clave,
    updatedAt: serverTimestamp(),
    ...(anterior ? {} : { createdAt: serverTimestamp() })
  }, { merge: true });
  await lote.commit();
}

export async function cambiarNick(texto) {
  const motivo = motivoNickInvalido(texto);
  if (motivo) throw Error(motivo);
  await ensureAuth();
  const actual = auth.currentUser;
  const nick = normalizarNick(texto);
  if (claveNick(actual.displayName || "") === claveNick(nick) && actual.displayName) {
    // Mismo nombre con otra grafía: se guarda igual, porque lo que se enseña es la
    // grafía. Si es idéntico, no hay nada que escribir.
    if (actual.displayName === nick) return nick;
  }
  try {
    await reservarNick(actual.uid, nick, actual.displayName || "");
  } catch (error) {
    throw Error(error?.code === "permission-denied" ? "Ese nombre ya está cogido. Prueba con otro." : mensaje(error));
  }
  await updateProfile(actual, { displayName: nick });
  return nick;
}

// ---------------------------------------------------------------------------
// Registro y entrada
// ---------------------------------------------------------------------------

// Registrarse desde una sesión anónima la convierte; desde ninguna, la crea. En los dos
// casos se acaba con la misma persona que entró: el `uid` no cambia nunca aquí.
export async function registrar({ correo, clave, nick }) {
  for (const motivo of [motivoNickInvalido(nick), motivoCorreoInvalido(correo), motivoClaveInvalida(clave)]) {
    if (motivo) throw Error(motivo);
  }
  await ensureAuth();
  const previo = auth.currentUser;
  // Primero el nombre. Si estuviera cogido y lo descubriéramos después de crear la
  // cuenta, quedaría una cuenta sin nombre que el ranking no sabría enseñar.
  await cambiarNick(nick);
  const credencial = EmailAuthProvider.credential(String(correo).trim(), clave);
  try {
    if (previo?.isAnonymous) await linkWithCredential(previo, credencial);
    else await createUserWithEmailAndPassword(auth, String(correo).trim(), clave);
  } catch (error) {
    throw Error(mensaje(error));
  }
  await setDoc(doc(db, "users", auth.currentUser.uid), { registered: true, updatedAt: serverTimestamp() }, { merge: true });
  // Que el correo no llegue no impide jugar: la verificación se pide, no se exige.
  try { await sendEmailVerification(auth.currentUser); } catch { /* se puede reenviar desde la cuenta */ }
  return sesion();
}

export async function entrar({ correo, clave }) {
  const motivo = motivoCorreoInvalido(correo);
  if (motivo) throw Error(motivo);
  try {
    await signInWithEmailAndPassword(auth, String(correo).trim(), clave);
  } catch (error) {
    throw Error(mensaje(error));
  }
  return sesion();
}

export async function salir() {
  await signOut(auth);
  // No se abre otra sesión anónima aquí: la abrirá `ensureAuth` la próxima vez que se
  // entre en una sala. Abrirla ahora crearía una identidad por cada cierre de sesión.
}

export async function recuperarClave(correo) {
  const motivo = motivoCorreoInvalido(correo);
  if (motivo) throw Error(motivo);
  try { await sendPasswordResetEmail(auth, String(correo).trim()); }
  catch (error) { throw Error(mensaje(error)); }
}

export async function reenviarVerificacion() {
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw Error("Antes hay que registrarse.");
  try { await sendEmailVerification(auth.currentUser); }
  catch (error) { throw Error(mensaje(error)); }
}

// ---------------------------------------------------------------------------
// El perfil en la nube
//
// Es una copia, no la fuente: quien manda sigue siendo `progreso.js` en este móvil, que
// funciona sin conexión. Subirla permite recuperarla en otro aparato; bajarla no borra
// nada por su cuenta, devuelve el texto y quien decide es `app.js` con su confirmación.
// ---------------------------------------------------------------------------

function refPerfil(uid) { return doc(db, "users", uid, "datos", "perfil"); }

export async function subirPerfil(json) {
  await ensureAuth();
  const actual = auth.currentUser;
  if (actual.isAnonymous) throw Error("Regístrate para guardar el perfil en la nube.");
  // Se guarda como texto: el perfil es un JSON con claves que cambian entre versiones y
  // Firestore no tiene por qué entenderlas. Solo hace falta que vuelva tal cual salió.
  await setDoc(refPerfil(actual.uid), { json: String(json), guardadoEn: serverTimestamp() });
}

export async function bajarPerfil() {
  await ensureAuth();
  const actual = auth.currentUser;
  if (actual.isAnonymous) throw Error("Entra en tu cuenta para recuperar el perfil.");
  const copia = await getDoc(refPerfil(actual.uid));
  if (!copia.exists()) return null;
  const datos = copia.data();
  return { json: String(datos.json || ""), guardadoEn: datos.guardadoEn?.toDate?.() || null };
}

export async function borrarPerfilDeLaNube() {
  await ensureAuth();
  if (auth.currentUser.isAnonymous) return;
  await deleteDoc(refPerfil(auth.currentUser.uid));
}

// ---------------------------------------------------------------------------

// Los códigos de Firebase llegan en inglés y con nombres de API dentro. Se traducen los
// que una persona puede provocar sin hacer nada raro; el resto cae en el texto genérico,
// que al menos no promete una causa equivocada.
function mensaje(error) {
  switch (error?.code) {
    case "auth/email-already-in-use": return "Ya hay una cuenta con ese correo. Entra con ella o recupera la contraseña.";
    case "auth/credential-already-in-use": return "Ese correo ya pertenece a otra cuenta.";
    case "auth/invalid-email": return "Revisa la dirección de correo.";
    case "auth/weak-password": return "La contraseña es demasiado corta.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "El correo o la contraseña no coinciden.";
    case "auth/too-many-requests": return "Demasiados intentos seguidos. Espera un momento y vuelve a probar.";
    case "auth/network-request-failed": return "Sin conexión. Vuelve a intentarlo cuando tengas internet.";
    case "auth/operation-not-allowed": return "Falta activar el acceso con correo y contraseña en Firebase.";
    case "permission-denied": return "La operación no está permitida.";
    default: return error?.message || "No se ha podido completar la operación.";
  }
}
