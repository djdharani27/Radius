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
    let active = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;

      setUser(firebaseUser ?? null);

      try {
        if (firebaseUser) {
          const snap = await getDoc(doc(db, "profiles", firebaseUser.uid));
          if (!active) return;
          setProfile(snap.exists() ? snap.data() : null);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Failed to load auth profile:", error);
        if (!active) return;
        setProfile(null);
      }

      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Call this after saving profile so radar page refreshes without re-mount
  function refreshProfile(updated) {
    setProfile(updated);
  }

  return { user, profile, loading, refreshProfile };
}
