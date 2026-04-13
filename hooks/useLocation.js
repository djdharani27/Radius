"use client";

import { useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

export function useLocation(profile) {
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [error, setError] = useState(null);
  const [uid, setUid] = useState(null);
  const watchRef = useRef(null);
  const uidRef = useRef(null);

  useEffect(() => {
    if (!profile?.name) return;

    let cancelled = false;

    const user = auth.currentUser;
    if (!user) { setError("Not authenticated."); return; }
    uidRef.current = user.uid;
    setUid(user.uid);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        if (cancelled) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition({ lat, lng });
        try {
          await setDoc(
            doc(db, "users", uidRef.current),
            {
              name: profile.name,
              role: profile.role,
              title: profile.title || "",
              lat,
              lng,
              lastSeen: serverTimestamp(),
              active: true,
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Firestore write failed:", e.message);
        }
      },
      (err) => { setError("Location error: " + err.message); },
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
    );

    async function cleanup() {
      if (uidRef.current) {
        try {
          await deleteDoc(doc(db, "users", uidRef.current));
        } catch (_) {}
      }
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    }

    window.addEventListener("beforeunload", cleanup);

    return () => {
      cancelled = true;
      cleanup();
      window.removeEventListener("beforeunload", cleanup);
    };
  }, [profile?.name, profile?.role, profile?.title]);

  return { ...position, error, uid };
}