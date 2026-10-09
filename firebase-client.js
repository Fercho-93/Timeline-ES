import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, initializeFirestore } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
export const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyAT-ELQvHrBdMaCdxJNUJzDRwq1jOOwI44',
  authDomain: 'timeline-es.firebaseapp.com', projectId: 'timeline-es',
  storageBucket: 'timeline-es.firebasestorage.app', messagingSenderId: '572227626442',
  appId: '1:572227626442:web:f7c1ad0d66de6f02d79b33'
});
// App Check: cada petición a Firestore y Auth lleva una prueba de que sale de Continuum, no
// de un script. En la web, con reCAPTCHA Enterprise (clave pública en `deployment.js`); en la
// app de iPhone, con App Attest a través del plugin nativo `AppAttestation`. Se inicia antes
// de abrir Firestore para que ninguna petición salga sin ella. Android aún no lo lleva: Play
// Integrity exige que la app esté en Google Play.
const deployment = window.CONTINUUM?.Deployment;
const capacitor = window.Capacitor;
const native = !!capacitor?.isNativePlatform?.();
const attestation = native && capacitor?.getPlatform?.() === 'ios' ? capacitor?.Plugins?.AppAttestation : null;
const iosAppCheck = deployment?.iosAppCheck;
if ((!native && deployment?.appCheckSiteKey) || (attestation && iosAppCheck?.appId && iosAppCheck?.apiKey)) {
  try {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider } = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js');
    const provider = native
      ? new CustomProvider({ getToken: async () => {
          const { token, expireTimeMillis } = await attestation.getToken({ ...iosAppCheck, projectId: 'timeline-es', senderId: '572227626442' });
          return { token, expireTimeMillis };
        } })
      : new ReCaptchaEnterpriseProvider(deployment.appCheckSiteKey);
    initializeAppCheck(firebaseApp, { provider, isTokenAutoRefreshEnabled: true });
  } catch (error) { console.warn('App Check no disponible', error); }
}
export const auth = getAuth(firebaseApp);
// En la app instalada (pantalla de inicio) de iOS el canal de streaming de Firestore puede
// quedarse colgado sin fallar, y toda lectura espera para siempre. Con la detección
// automática, si el canal no responde se pasa a long-polling.
function openDb() {
  try { return initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true }); }
  catch { return getFirestore(firebaseApp); }
}
export const db = openDb();
auth.languageCode = 'es';
