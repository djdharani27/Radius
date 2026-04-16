"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, authReady, db } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let profileUnsub = null;
    let authUnsub = null;

    async function start() {
      await authReady;
      if (!active) return;

      authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
    }

    start();

    return () => {
      active = false;
      if (profileUnsub) {
        profileUnsub();
      }
      authUnsub?.();
    };
  }, []);

  function refreshProfile(updated) {
    setProfile(updated);
  }

  return { user, profile, loading, refreshProfile };
}
