// Registro de notificaciones push para las versiones nativas de las Stores.
// En navegador se conserva el aviso local que ya ofrece duelo-turnos.js.
import { auth, db } from './firebase-client.js';
import { doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const CT = window.CONTINUUM;
let started = false;
const native = () => window.Capacitor?.isNativePlatform?.() === true;
const plugin = () => window.Capacitor?.registerPlugin?.('PushNotifications');
const tokenId = token => String(token || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'device';

async function saveToken(token) {
  const uid = auth.currentUser?.uid || CT.Accounts?.user?.uid;
  if (!uid || !token) return;
  const platform = /ios/i.test(navigator.userAgent) ? 'ios' : 'android';
  await setDoc(doc(db, 'playerProfiles', uid, 'pushTokens', tokenId(token)), { token, platform, updatedAt: serverTimestamp() }, { merge: true });
}

export async function start() {
  if (started || !native()) return false;
  const push = plugin();
  if (!push) return false;
  started = true;
  const permission = await push.checkPermissions();
  const granted = permission.receive === 'granted' ? permission : await push.requestPermissions();
  if (granted.receive !== 'granted') return false;
  await push.addListener('registration', event => saveToken(event.value).catch(() => {}));
  await push.addListener('registrationError', () => {});
  await push.addListener('pushNotificationActionPerformed', event => {
    const duelId = event.notification?.data?.duelId;
    if (duelId) window.dispatchEvent(new CustomEvent('continuum:turn-duel-open', { detail: { duelId } }));
  });
  await push.register();
  return true;
}

CT.PushNotifications = { start };
