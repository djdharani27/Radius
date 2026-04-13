import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

// Use redirect on mobile, popup on desktop
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function signInWithGoogle() {
  if (isMobile()) {
    await signInWithRedirect(auth, googleProvider);
    return null; // page will reload, result handled below
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Call this on app load to capture the redirect result on mobile
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

export async function signOutUser() {
  await signOut(auth);
}