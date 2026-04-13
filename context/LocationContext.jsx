"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc, setDoc, deleteDoc, serverTimestamp, onSnapshot,
} from "firebase/firestore";

const LocationContext = createContext({ lat: null, lng: null, error: null });

export function useLocationContext() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }) {
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [error, setError] = useState(null);
  const watchRef = useRef(null);
  const profileRef = useRef(null);
  const radarActiveRef = useRef(true);
  const positionRef = useRef({ lat: null, lng: null });

  useEffect(() => {
    let cancelled = false;
    let profileUnsub = null;

    async function start() {
      const user = await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
      });

      if (!user || cancelled) return;

      // Listen to profile in real-time so radarActive changes are picked up
      profileUnsub = onSnapshot(doc(db, "profiles", user.uid), async (snap) => {
        if (!snap.exists() || cancelled) return;

        const profile = snap.data();
        const wasInactive = !radarActiveRef.current;
        const isNowActive = profile.radarActive ?? true;

        profileRef.current = profile;
        radarActiveRef.current = isNowActive;

        // Radar just turned ON — immediately write current position
        if (wasInactive && isNowActive && positionRef.current.lat) {
          try {
            await setDoc(
              doc(db, "users", user.uid),
              {
                name: profile.name,
                role: profile.role,
                title: profile.title || "",
                lat: positionRef.current.lat,
                lng: positionRef.current.lng,
                lastSeen: serverTimestamp(),
                active: true,
              },
              { merge: true }
            );
          } catch (e) {
            console.warn("Re-activate write failed:", e.message);
          }
        }

        // Radar just turned OFF — remove from users
        if (!wasInactive && !isNowActive) {
          try {
            await deleteDoc(doc(db, "users", user.uid));
          } catch (_) {}
        }
      });

      if (!navigator.geolocation) {
        setError("Geolocation not supported.");
        return;
      }

      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          if (cancelled) return;
          const { latitude: lat, longitude: lng } = pos.coords;

          // Always track position locally
          setPosition({ lat, lng });
          positionRef.current = { lat, lng };

          // Only write to Firestore if radar is active
          if (!radarActiveRef.current) return;

          const p = profileRef.current;
          if (!p) return;

          try {
            await setDoc(
              doc(db, "users", user.uid),
              {
                name: p.name,
                role: p.role,
                title: p.title || "",
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
      // Only remove from radar on tab close if radarActive is false
      if (!radarActiveRef.current) {
        const user = auth.currentUser;
        if (user) {
          try { await deleteDoc(doc(db, "users", user.uid)); } catch (_) {}
        }
      }
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (profileUnsub) profileUnsub();
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