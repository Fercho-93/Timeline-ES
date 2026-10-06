// Tablón de mesas públicas, como el vestíbulo de Risk: cada mesa que espera jugadores
// tiene aquí una ficha con su configuración (contenido, plazas y tiempo) y quién hay
// sentado. Solo la escribe el móvil que lleva la mesa; el resto la lista para elegir
// dónde entrar. La sala sigue siendo la fuente de verdad: la ficha solo sirve para verla.
import { db } from './firebase-client.js';
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

// Quien lleva la mesa renueva la ficha cada 45 s; sin renovar en dos minutos, la mesa
// está abandonada y deja de enseñarse (las reglas permiten entonces borrarla a cualquiera).
export const TABLE_STALE_MS = 120000;
const RENEW_MS = 40000;
const written = new Map();

export function tableFresh(table, now = Date.now()) {
  const at = table?.updatedAt?.toMillis?.();
  // Una ficha recién escrita desde este móvil aún no tiene la hora del servidor.
  if (table?.updatedAt == null) return true;
  return Number.isFinite(at) && now - at < TABLE_STALE_MS;
}

// Publica o pone al día la ficha. Si nada ha cambiado, solo se reescribe para renovarla.
export async function publishTable(entry) {
  const sig = JSON.stringify(entry), previous = written.get(entry.code);
  if (previous?.sig === sig && Date.now() - previous.at < RENEW_MS) return;
  written.set(entry.code, { sig, at: Date.now() });
  try { await setDoc(doc(db, 'publicTables', entry.code), { ...entry, updatedAt: serverTimestamp() }); }
  catch (error) { written.delete(entry.code); console.warn('PUBLIC_TABLE', error?.code || error); }
}

export async function removeTable(code) {
  written.delete(code);
  try { await deleteDoc(doc(db, 'publicTables', code)); }
  catch (error) { if (error?.code !== 'not-found') console.warn('PUBLIC_TABLE_REMOVE', error?.code || error); }
}

export async function readTable(code) {
  try { const snap = await getDoc(doc(db, 'publicTables', code)); return snap.exists() ? snap.data() : null; }
  catch { return null; }
}

// Las fichas más recientes primero; quien mira decide cuáles puede usar (mazo, versión).
export function watchTables(onChange, onError) {
  const tables = query(collection(db, 'publicTables'), orderBy('updatedAt', 'desc'), limit(50));
  return onSnapshot(tables, snap => {
    const list = snap.docs.map(d => ({ ...d.data(), code: d.id }));
    onChange(list);
    // Las abandonadas se retiran del tablón al verlas (unas pocas cada vez).
    list.filter(t => !tableFresh(t)).slice(0, 3).forEach(t => { void removeTable(t.code); });
  }, onError);
}
