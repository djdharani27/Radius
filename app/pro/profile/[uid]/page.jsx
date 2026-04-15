"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import ProfileAvatar from "@/components/ProfileAvatar";
import styles from "./page.module.css";

const SOCIALS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "Twitter / X" },
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp", isWhatsapp: true },
  { key: "website", label: "Website" },
];

export default function ProProfilePage() {
  const { uid } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/pro");
      return;
    }
    if (uid === user.uid) {
      router.replace("/pro/radar");
      return;
    }

    getDoc(doc(db, "profiles", uid))
      .then((snapshot) => {
        if (snapshot.exists()) setProfile(snapshot.data());
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [uid, user, authLoading, router]);

  if (loading || authLoading) return <div className={styles.loading}>Loading profile...</div>;

  if (notFound) {
    return (
      <div className={styles.loading}>
        <div>Profile not found.</div>
        <button className={styles.backBtn} onClick={() => router.push("/pro/radar")}>Return to radar</button>
      </div>
    );
  }

  const isVisibleOnRadar = profile.radarActive ?? true;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>Back</button>
        <button className={styles.messageBtn} onClick={() => router.push(`/pro/chat/${uid}`)}>Message</button>
      </header>

      <section className={styles.hero}>
        <ProfileAvatar name={profile.name} photoURL={profile.photoURL} size="lg" className={styles.avatar} />
        <div className={styles.identity}>
          <div className={styles.eyebrow}>Synkedin Pro profile</div>
          <h1 className={styles.name}>{profile.name}</h1>
          <p className={styles.title}>{profile.title || "Professional"}</p>
          <div className={`${styles.badge} ${isVisibleOnRadar ? styles.badgeVisible : styles.badgeHidden}`}>
            {isVisibleOnRadar ? "Visible on radar" : "Currently hidden"}
          </div>
        </div>
      </section>

      {profile.description && (
        <section className={styles.panel}>
          <div className={styles.panelTitle}>About</div>
          <p className={styles.description}>{profile.description}</p>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelTitle}>Contact points</div>
        <div className={styles.socials}>
          {SOCIALS.map(({ key, label, isWhatsapp }) => {
            const value = profile[key];
            if (!value) return null;
            const href = isWhatsapp
              ? `https://wa.me/${value.replace(/\D/g, "")}`
              : value.startsWith("http")
                ? value
                : `https://${value}`;

            return (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                {label}
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
