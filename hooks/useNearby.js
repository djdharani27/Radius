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
    // Guard — user is null until location + auth are ready
    if (!user?.lat || !user?.lng || !user?.uid) return;

    const box = getBoundingBox(user.lat, user.lng, rangeMeters);

    const q = query(
      collection(db, "users"),
      where("role", "==", "entrepreneur"),
      where("lat", ">=", box.minLat),
      where("lat", "<=", box.maxLat)
    );

    if (unsubRef.current) unsubRef.current();

    unsubRef.current = onSnapshot(q, (snapshot) => {
      const results = [];

      snapshot.forEach((docSnap) => {
        if (docSnap.id === user.uid) return;

        const data = docSnap.data();
        if (!data.active) return;

        const dist = haversineMeters(user.lat, user.lng, data.lat, data.lng);
        if (dist > rangeMeters) return;

        if (data.lng < box.minLng || data.lng > box.maxLng) return;

        results.push({ id: docSnap.id, ...data, dist });

        if (!notifiedRef.current.has(docSnap.id)) {
          notifiedRef.current.add(docSnap.id);
          fireNotification(data.name, Math.round(dist));
        }
      });

      const currentIds = new Set(results.map((r) => r.id));
      for (const id of notifiedRef.current) {
        if (!currentIds.has(id)) notifiedRef.current.delete(id);
      }

      results.sort((a, b) => a.dist - b.dist);
      setNearby(results);
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [user?.lat, user?.lng, user?.uid, rangeMeters]);

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

  new Notification("🚀 Entrepreneur nearby!", {
    body: `${name} is an entrepreneur near you — ${dist} away`,
    tag: "er-" + name,
    renotify: false,
  });
}