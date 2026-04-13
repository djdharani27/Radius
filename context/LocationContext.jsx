"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
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
  const userRef = useRef(null);
  const profileUnsubRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function writeLiveLocation(user, profile, lat, lng) {
      if (!user?.uid || !profile) return;

      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            name: profile.name || "",
            role: profile.role || "professional",
            title: profile.title || "",
            linkedin: profile.linkedin || "",
            twitter: profile.twitter || "",
            instagram: profile.instagram || "",
            whatsapp: profile.whatsapp || "",
            website: profile.website || "",
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
    }

    async function removeLiveLocation(uid) {
      if (!uid) return;
      try {
        await deleteDoc(doc(db, "users", uid));
      } catch (_) {}
    }

    async function start() {
      const user = await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((u) => {
          unsub();
          resolve(u);
        });
      });

      if (!user || cancelled) return;
      userRef.current = user;

      profileUnsubRef.current = onSnapshot(doc(db, "profiles", user.uid), async (snap) => {
        if (!snap.exists() || cancelled) return;

        const profile = snap.data();
        const wasActive = radarActiveRef.current;
        const isActive = profile.radarActive ?? true;

        profileRef.current = profile;
        radarActiveRef.current = isActive;

        // Radar turned ON -> write current position immediately
        if (!wasActive && isActive && positionRef.current.lat != null && positionRef.current.lng != null) {
          await writeLiveLocation(
            user,
            profile,
            positionRef.current.lat,
            positionRef.current.lng
          );
        }

        // Radar turned OFF -> remove from live users immediately
        if (wasActive && !isActive) {
          await removeLiveLocation(user.uid);
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

          setPosition({ lat, lng });
          positionRef.current = { lat, lng };

          if (!radarActiveRef.current) return;

          const profile = profileRef.current;
          if (!profile) return;

          await writeLiveLocation(user, profile, lat, lng);
        },
        (err) => setError("Location error: " + err.message),
        {
          enableHighAccuracy: false,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    }

    start();

    function syncCleanup() {
      cancelled = true;

      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }

      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      const uid = userRef.current?.uid;
      if (uid) {
        deleteDoc(doc(db, "users", uid)).catch(() => {});
      }
    }

    window.addEventListener("beforeunload", syncCleanup);

    return () => {
      syncCleanup();
      window.removeEventListener("beforeunload", syncCleanup);
    };
  }, []);

  return (
    <LocationContext.Provider value={{ ...position, error }}>
      {children}
    </LocationContext.Provider>
  );
}
