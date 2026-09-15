// La conexión con Firebase, en un solo sitio.
//
// `online.js` la estrenó cuando era el único módulo que hablaba con la nube. Desde que
// hay cuentas y ranking son tres los que necesitan los mismos tres objetos —aplicación,
// autenticación y base de datos— y `initializeApp` no admite dos llamadas con la misma
// configuración: la segunda devuelve la primera aplicación si los datos coinciden y
// lanza un error si no. Peor que el error sería que colara: cada módulo tendría su
// propia sesión y una cuenta creada en la pantalla de registro no existiría para la sala.
//
// Es un módulo ES, como `online.js`, y por la misma razón: Firebase se descarga de una
// CDN y solo se pide cuando de verdad hace falta. Quien juega sin conexión no paga nada
// por que este archivo exista.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Configuración pública del proyecto. No es un secreto: identifica al proyecto, no
// autoriza nada. Quien decide qué se puede leer y escribir es `firestore.rules`.
const firebaseConfig = {
  apiKey: "AIzaSyAT-ELQvHrBdMaCdxJNUJzDRwq1jOOwI44",
  authDomain: "timeline-es.firebaseapp.com",
  projectId: "timeline-es",
  storageBucket: "timeline-es.firebasestorage.app",
  messagingSenderId: "572227626442",
  appId: "1:572227626442:web:f7c1ad0d66de6f02d79b33"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let protectionReady;

// App Check, cuando hay clave configurada. En la app nativa no se activa: reCAPTCHA
// Enterprise es del navegador y ahí haría falta el proveedor propio de cada plataforma.
export async function ensureProtection() {
  const config = window.CONTINUUM.Deployment;
  if (!config?.appCheckSiteKey || window.Capacitor?.isNativePlatform?.()) {
    if (config?.audience === 'public') throw Error('Falta configurar la protección de las salas para esta plataforma.');
    return;
  }
  protectionReady ||= import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js').then(({initializeAppCheck,ReCaptchaEnterpriseProvider}) => {
    initializeAppCheck(firebaseApp,{provider:new ReCaptchaEnterpriseProvider(config.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  }).catch(error => { protectionReady=null; throw error; });
  await protectionReady;
}

// Deja una sesión abierta y devuelve quién es. Si no hay ninguna, abre una anónima:
// para entrar en una sala nunca ha hecho falta una cuenta y sigue sin hacer falta.
//
// Cuando esa sesión anónima se convierte después en una cuenta con correo, Firebase
// conserva el mismo `uid` —ver `cuenta.js`—, así que las salas jugadas antes de
// registrarse siguen siendo de la misma persona.
export async function ensureAuth() {
  await ensureProtection();
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    let signingIn = false;
    const stop = onAuthStateChanged(auth, async current => {
      if (current) { stop(); resolve(current); }
      else if (!signingIn) {
        signingIn = true;
        try { await signInAnonymously(auth); }
        catch (error) { stop(); reject(error); }
      }
    }, reject);
  });
}

// Avisa de cada cambio de sesión: registrarse, entrar, salir o que Firebase restaure
// la sesión guardada al abrir la aplicación. Devuelve la función que deja de escuchar.
export function observarSesion(listener) {
  return onAuthStateChanged(auth, listener);
}
