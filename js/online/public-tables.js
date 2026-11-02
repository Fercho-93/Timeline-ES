// Tablón de mesas públicas, como el vestíbulo de Risk: cada mesa que espera jugadores
// tiene aquí una ficha con su configuración (contenido, plazas y tiempo) y quién hay
// sentado. Solo la escribe el móvil que lleva la mesa; el resto la lista para elegir
// dónde entrar. La sala sigue siendo la fuente de verdad: la ficha solo sirve para verla.
import { db } from '../nube/firebase-client.js';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from '../../vendor/firebase/firebase-firestore.js';
import { STALE_MS } from './public-matchmaking.js';

// Quien lleva la mesa renueva la ficha cada 45 s; sin renovar en `STALE_MS` (dos minutos), la
// mesa está abandonada y deja de enseñarse (las reglas permiten entonces borrarla a cualquiera).
// Una ficha idéntica a la última que se escribió no se reescribe hasta pasados `RENEW_MS`.
const RENEW_MS = 40000;
const written = new Map();

export function tableFresh(table, now = Date.now()) {
  const at = table?.updatedAt?.toMillis?.();
  // Una ficha recién escrita desde este móvil aún no tiene la hora del servidor.
  if (table?.updatedAt == null) return true;
  return Number.isFinite(at) && now - at < STALE_MS;
}

// Publica o pone al día la ficha. Si nada ha cambiado, solo se reescribe para renovarla.
export async function publishTable(entry) {
  const sig = JSON.stringify(entry), previous = written.get(entry.code);
  if (previous?.sig === sig && Date.now() - previous.at < RENEW_MS) return;
  written.set(entry.code, { sig, at: Date.now() });
  try { await setDoc(doc(db, 'publicTables', entry.code), { ...entry, updatedAt: serverTimestamp() }); }
  // Si la mesa acaba de llenarse o empezar, la regla ya no deja anunciarla: es lo esperado, no un fallo.
  catch (error) { written.delete(entry.code); if (error?.code !== 'permission-denied') console.warn('PUBLIC_TABLE', error?.code || error); }
}

export async function removeTable(code) {
  written.delete(code);
  try { await deleteDoc(doc(db, 'publicTables', code)); }
  catch (error) { if (error?.code !== 'not-found' && error?.code !== 'permission-denied') console.warn('PUBLIC_TABLE_REMOVE', error?.code || error); }
}

export async function readTable(code) {
  try { const snap = await getDoc(doc(db, 'publicTables', code)); return snap.exists() ? snap.data() : null; }
  catch { return null; }
}

// Cada cuánto se vuelve a mirar el tablón mientras está a la vista.
export const POLL_MS = 20000;
// Las fichas vivas, las renovadas más recientemente primero; quien mira decide cuáles puede usar (mazo, versión).
// Se consulta cada `POLL_MS` en vez de escuchar en directo: cada mesa se renueva cada 40 s, así que escuchar hacía
// que cada persona mirando recibiera todas las renovaciones de todas las mesas (lecturas que crecían con mesas ×
// personas). Así cuesta como mucho 50 lecturas cada 20 s por persona, haya las mesas que haya. Las abandonadas no
// llegan (el filtro de hora va en el servidor, con un minuto de margen por si el reloj del móvil va adelantado) y
// las borra la limpieza diaria, no quien mira.
export function watchTables(onChange, onError, every = POLL_MS) {
  let stopped = false, timer = null, loading = false;
  const load = async () => {
    clearTimeout(timer);
    if (stopped) return;
    if (document.visibilityState === 'hidden') { timer = setTimeout(load, every); return; }
    if (!loading) {
      loading = true;
      try {
        const since = Timestamp.fromMillis((window.CONTINUUM?.Session?.now?.() ?? Date.now()) - STALE_MS - 60000);
        const snap = await getDocs(query(collection(db, 'publicTables'), where('updatedAt', '>', since), orderBy('updatedAt', 'desc'), limit(50)));
        if (!stopped) onChange(snap.docs.map(d => ({ ...d.data(), code: d.id })));
      } catch (error) { if (!stopped) onError?.(error); }
      finally { loading = false; }
    }
    if (!stopped) timer = setTimeout(load, every);
  };
  // Al volver a la app se mira enseguida, sin esperar al siguiente turno.
  const wake = () => { if (document.visibilityState === 'visible') void load(); };
  document.addEventListener('visibilitychange', wake);
  void load();
  return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
}
