import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBrMXmmxyUwGJYBD_ww3-qT9uDCiI8tZFo",
  authDomain: "sunny-cf80c.firebaseapp.com",
  projectId: "sunny-cf80c",
  storageBucket: "sunny-cf80c.firebasestorage.app",
  messagingSenderId: "684641283346",
  appId: "1:684641283346:web:630f5cd7b43d60f8df17cb"
};

// Initialize Firebase safely for SSR/Client
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
