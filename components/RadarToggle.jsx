"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import styles from "./RadarToggle.module.css";

// Don't show on landing or setup pages
const HIDDEN_ON = ["/", "/setup"];

export default function RadarToggle() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [uid, setUid] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { setReady(false); return; }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, "profiles", user.uid));
        if (snap.exists()) {
          setActive(snap.data().radarActive ?? true);
        }
      } catch (_) {}
      setReady(true);
    });
    return unsub;
  }, []);

  async function toggle() {
    if (!uid) return;
    const next = !active;
    setActive(next);
    try {
      await updateDoc(doc(db, "profiles", uid), { radarActive: next });

      // If turning off — remove from live users immediately
      if (!next) {
        const { deleteDoc, doc: firestoreDoc } = await import("firebase/firestore");
        await deleteDoc(firestoreDoc(db, "users", uid));
      }
    } catch (e) {
      console.warn("Toggle failed:", e.message);
      setActive(!next); // revert on error
    }
  }

  if (!ready || HIDDEN_ON.includes(pathname)) return null;

  return (
    <button
      className={`${styles.btn} ${active ? styles.active : styles.inactive}`}
      onClick={toggle}
      title={active ? "You are visible on radar — click to hide" : "You are hidden — click to appear on radar"}
    >
      <span className={styles.dot} />
      {active ? "ON RADAR" : "OFF RADAR"}
    </button>
  );
}