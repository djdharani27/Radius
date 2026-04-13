"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const LocationContext = createContext({ lat: null, lng: null, error: null });

export function useLocationContext() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }) {
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [error, setError] = useState(null);
  const watchRef = useRef(null);
  const profileRef = useRef(null);

  // Listen to auth + profile changes from outside
  // We read directly from Firestore when auth is ready
  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Wait for auth to be ready
      await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((user) => {
          unsub();
          resolve(user);
        });
      });

      const user = auth.currentUser;
      if (!user) return;

      // Load profile
      const { doc: firestoreDoc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(firestoreDoc(db, "profiles", user.uid));
      if (!snap.exists() || cancelled) return;

      profileRef.current = snap.data();

      if (!navigator.geolocation) {
        setError("Geolocation not supported.");
        return;
      }

      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          if (cancelled) return;
          const { latitude: lat, longitude: lng } = pos.coords;
          setPosition({ lat, lng });

          const profile = profileRef.current;
          if (!profile) return;

          try {
            await setDoc(
              doc(db, "users", user.uid),
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
            console.warn("Location write failed:", e.message);
          }
        },
        (err) => setError("Location error: " + err.message),
        { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
      );
    }

    start();

    async function cleanup() {
      cancelled = true;
      const user = auth.currentUser;
      if (user) {
        try { await deleteDoc(doc(db, "users", user.uid)); } catch (_) {}
      }
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    }

    window.addEventListener("beforeunload", cleanup);
    return () => {
      cancelled = true;
      cleanup();
      window.removeEventListener("beforeunload", cleanup);
    };
  }, []);

  return (
    <LocationContext.Provider value={{ ...position, error }}>
      {children}
    </LocationContext.Provider>
  );
}