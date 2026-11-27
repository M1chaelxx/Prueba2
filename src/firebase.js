import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// El proyecto Firebase original fue eliminado. La sincronización en la nube queda
// desactivada hasta definir las variables VITE_FIREBASE_* (archivo .env) de un proyecto nuevo.
// Sin ellas la app funciona 100% local (localStorage).
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function init() {
  if (!config.apiKey || !config.projectId) return null;
  try {
    return getFirestore(initializeApp(config));
  } catch (e) {
    console.warn('Firebase init failed:', e);
    return null;
  }
}

export const db = init();
export const firebaseReady = !!db;
