// src/lib/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// log config (only keys, not secrets) to confirm Vite env read correctly
console.log('Firebase config read:', {
  projectId: firebaseConfig.projectId,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});
console.log('VAPID (env):', import.meta.env.VITE_FIREBASE_VAPID_KEY?.slice?.(0, 8) ?? '(missing)');

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Initialize messaging once and export it
let messaging;
try {
  messaging = getMessaging(firebaseApp);
  console.log('Messaging initialized');
} catch (err) {
  console.error('Messaging init error:', err);
}

export { messaging };
