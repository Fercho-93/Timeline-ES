import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
export const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyAT-ELQvHrBdMaCdxJNUJzDRwq1jOOwI44',
  authDomain: 'timeline-es.firebaseapp.com', projectId: 'timeline-es',
  storageBucket: 'timeline-es.firebasestorage.app', messagingSenderId: '572227626442',
  appId: '1:572227626442:web:f7c1ad0d66de6f02d79b33'
});
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
auth.languageCode = 'es';
