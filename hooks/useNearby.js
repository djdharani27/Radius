"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { haversineMeters, getBoundingBox } from "@/lib/geo";

export function useNearby(user, rangeMeters) {
  const [nearby, setNearby] = useState([]);
  const notifiedRef = useRef(new Set());
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || user?.lat == null || user?.lng == null) {
      setNearby([]);
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      return;
    }

    const box = getBoundingBox(user.lat, user.lng, rangeMeters);

    const q = query(
      collection(db, "users"),
      where("lat", ">=", box.minLat),
      where("lat", "<=", box.maxLat)
    );

    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    unsubRef.current = onSnapshot(q, (snapshot) => {
      const unique = new Map();

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();

        if (id === user.uid || data.uid === user.uid) return;
        if (!data.active) return;
        if (typeof data.lat !== "number" || typeof data.lng !== "number") return;
        if (data.lng < box.minLng || data.lng > box.maxLng) return;

        const dist = haversineMeters(user.lat, user.lng, data.lat, data.lng);
        if (dist > rangeMeters) return;

        unique.set(id, {
          id,
          ...data,
          dist,
        });
      });

      const results = Array.from(unique.values()).sort((a, b) => a.dist - b.dist);
      const currentIds = new Set(results.map((r) => r.id));

      results.forEach((person) => {
        if (!notifiedRef.current.has(person.id)) {
          notifiedRef.current.add(person.id);
          fireNotification(person.name, Math.round(person.dist));
        }
      });

      for (const id of notifiedRef.current) {
        if (!currentIds.has(id)) {
          notifiedRef.current.delete(id);
        }
      }

      setNearby(results);
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [user?.uid, user?.lat, user?.lng, rangeMeters]);

  return { nearby };
}

function fireNotification(name, distMeters) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const dist =
    distMeters < 1000
      ? `${distMeters} m`
      : `${(distMeters / 1000).toFixed(1)} km`;

  new Notification("Professional nearby", {
    body: `${name} is nearby on Synkedin - ${dist} away`,
    tag: "synkedin-" + name,
    renotify: false,
  });
}
