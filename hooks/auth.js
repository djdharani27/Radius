"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * Listens to Firebase auth state and loads the user's Firestore profile.
 * user === undefined  → still loading
 * user === null       → not signed in
 * profile === null    → signed in but no profile yet → redirect to /setup
 */
export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "profiles", firebaseUser.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Call this after saving profile so radar page refreshes without re-mount
  function refreshProfile(updated) {
    setProfile(updated);
  }

  return { user, profile, loading, refreshProfile };
}