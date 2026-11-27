import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuración del proyecto Firebase "toma-de-tiempo". Estas claves son públicas por diseño
// (van en el bundle web); la seguridad real la dan las reglas de Firestore.
// Se pueden sobreescribir con variables VITE_FIREBASE_* (archivo .env).
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCtlEKGQfaIWAPOzwcUfXV6yfXDRVhpIks',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'toma-de-tiempo-6291c.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'toma-de-tiempo-6291c',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'toma-de-tiempo-6291c.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '44491002729',
  appId: env.VITE_FIREBASE_APP_ID || '1:44491002729:web:a5046c17a504d9844923f8',
};

function init() {
  if (env.VITE_DISABLE_FIREBASE || !config.apiKey || !config.projectId) return null;
  try {
    return getFirestore(initializeApp(config));
  } catch (e) {
    console.warn('Firebase init failed:', e);
    return null;
  }
}

export const db = init();
export const firebaseReady = !!db;
