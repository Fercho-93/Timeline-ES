import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, initializeFirestore } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
export const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyAT-ELQvHrBdMaCdxJNUJzDRwq1jOOwI44',
  authDomain: 'timeline-es.firebaseapp.com', projectId: 'timeline-es',
  storageBucket: 'timeline-es.firebasestorage.app', messagingSenderId: '572227626442',
  appId: '1:572227626442:web:f7c1ad0d66de6f02d79b33'
});
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
