// La función que verifica el reto diario.
//
// Se dispara cuando alguien crea su entrada en `retosDiarios`, vuelve a repartir el mazo
// de ese día, repite las jugadas y escribe el veredicto en el mismo documento. Las reglas
// de Firestore no dejan al cliente tocar `verificada`, `puntos` ni `motivo`: esos tres
// campos solo pueden venir de aquí, que escribe con credenciales de administrador.
//
// Coste: se ejecuta una vez por reto enviado, no por partida jugada ni por visita. Con
// mil personas jugando el reto de cada día son mil invocaciones diarias, unas treinta mil
// al mes, muy por debajo de los dos millones que el nivel gratuito de Cloud Functions
// incluye cada mes. `maxInstances` está bajo a propósito: no hay ninguna avalancha
// legítima que necesite más, y es el freno que impide que un fallo se convierta en una
// factura.
//
// Mientras esta función no esté desplegada, las entradas se quedan sin `verificada` y la
// aplicación las enseña como «sin verificar». Nada se rompe y no hay que migrar nada
// cuando se despliegue: las entradas nuevas se verificarán solas.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { cargarJuego, revisar } from "./juego.mjs";

setGlobalOptions({ region: "europe-west1", maxInstances: 10, memory: "512MiB" });

initializeApp();
const db = getFirestore();

// Los mazos se cargan una vez por instancia, no por invocación: son unos cuantos cientos
// de kilobytes de JavaScript y volver a interpretarlos en cada reto sería pagar el
// arranque mil veces al día.
const DIRECTORIO = path.join(path.dirname(fileURLToPath(import.meta.url)), "juego");
let juego = null;
const catalogo = () => (juego ||= cargarJuego(DIRECTORIO));

export const verificarReto = onDocumentCreated("retosDiarios/{entrada}", async evento => {
  const documento = evento.data;
  if (!documento) return;
  const entrada = documento.data();

  let veredicto;
  try {
    veredicto = revisar(catalogo(), entrada);
  } catch (error) {
    // Un fallo aquí no puede dejar la entrada en el limbo: se marca como no verificada
    // con un motivo que se distingue de un rechazo por las jugadas.
    logger.error("No se ha podido revisar el reto", { entrada: evento.params.entrada, error: error.message });
    await documento.ref.update({ verificada: false, puntos: 0, motivo: "error-al-revisar", revisadaEn: FieldValue.serverTimestamp() });
    return;
  }

  await documento.ref.update({
    verificada: veredicto.valida,
    puntos: veredicto.puntos,
    motivo: veredicto.motivo,
    // Los aciertos declarados se sustituyen por los que salen de repetir la partida.
    // Cuando coinciden no cambia nada; cuando no, la tabla deja de ordenar por un
    // número inventado, que es el punto de todo esto.
    aciertos: veredicto.aciertos,
    revisadaEn: FieldValue.serverTimestamp()
  });

  if (!veredicto.valida) {
    logger.info("Reto rechazado", { entrada: evento.params.entrada, motivo: veredicto.motivo });
    return;
  }

  // El acumulado de la semana. Solo suman los retos verificados, y cada reto suma una
  // vez: el disparador es `onCreate` y las reglas impiden borrar una entrada para
  // volver a enviarla, así que no hay forma de sumar dos veces el mismo día.
  const semanal = db.collection("retosSemanales").doc(`${entrada.semana}__${entrada.uid}`);
  await semanal.set({
    uid: entrada.uid,
    nick: entrada.nick,
    semana: entrada.semana,
    puntos: FieldValue.increment(veredicto.puntos),
    dias: FieldValue.increment(1),
    actualizadaEn: FieldValue.serverTimestamp()
  }, { merge: true });
});
