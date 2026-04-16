"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let profileUnsub = null;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;

      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      setUser(firebaseUser ?? null);

      try {
        if (firebaseUser) {
          setLoading(true);

          const profileRef = doc(db, "profiles", firebaseUser.uid);
          const initialProfile = await getDoc(profileRef);
          if (!active) return;

          setProfile(initialProfile.exists() ? initialProfile.data() : null);
          setLoading(false);

          profileUnsub = onSnapshot(
            profileRef,
            (snap) => {
              if (!active) return;
              setProfile(snap.exists() ? snap.data() : null);
              setLoading(false);
            },
            (error) => {
              console.error("Failed to subscribe auth profile:", error);
              if (!active) return;
              setProfile(null);
              setLoading(false);
            }
          );
          return;
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
      if (profileUnsub) {
        profileUnsub();
      }
      unsub();
    };
  }, []);

  function refreshProfile(updated) {
    setProfile(updated);
  }

  return { user, profile, loading, refreshProfile };
}
