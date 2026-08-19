import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBrMXmmxyUwGJYBD_ww3-qT9uDCiI8tZFo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sunny-cf80c.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sunny-cf80c",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sunny-cf80c.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "684641283346",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:684641283346:web:630f5cd7b43d60f8df17cb",
};

// Initialize Firebase safely for SSR/Client
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Ensures Firebase Auth is resolved before any Firestore operation.
 * On first call: waits for onAuthStateChanged, auto-signs-in anonymously if needed.
 * On subsequent calls: returns the cached promise immediately.
 */
let _authReadyPromise: Promise<FirebaseUser | null> | null = null;

export function ensureAuth(): Promise<FirebaseUser | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (!_authReadyPromise) {
    _authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          try {
            const credential = await signInAnonymously(auth);
            resolve(credential.user);
          } catch (err) {
            console.warn('Firebase anonymous sign-in failed:', err);
            resolve(null);
          }
        }
      });
    });
  }
  return _authReadyPromise;
}

export default app;
