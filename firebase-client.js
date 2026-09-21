import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
export const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyAT-ELQvHrBdMaCdxJNUJzDRwq1jOOwI44',
  authDomain: 'timeline-es.firebaseapp.com', projectId: 'timeline-es',
  storageBucket: 'timeline-es.firebasestorage.app', messagingSenderId: '572227626442',
  appId: '1:572227626442:web:f7c1ad0d66de6f02d79b33'
});
export const auth = getAuth(firebaseApp);
// Caché local (IndexedDB) compartida entre pestañas: los datos ya vistos (salas propias,
// perfil, duelos) siguen disponibles al recargar sin red, y varias pestañas de la misma
// persona no compiten por la misma caché. Si el navegador no la soporta (privado, cuota
// agotada), se cae al cliente sin persistencia en vez de romper el arranque.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  firestoreDb = getFirestore(firebaseApp);
}
export const db = firestoreDb;
auth.languageCode = 'es';
