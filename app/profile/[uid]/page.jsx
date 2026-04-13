"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import styles from "./page.module.css";

const SOCIALS = [
  { key: "linkedin",  label: "LinkedIn",    icon: "in", color: "#0077b5" },
  { key: "twitter",   label: "Twitter / X", icon: "𝕏",  color: "#ffffff" },
  { key: "instagram", label: "Instagram",   icon: "Ig", color: "#e1306c" },
  { key: "whatsapp",  label: "WhatsApp",    icon: "📱", color: "#25d366", isWhatsapp: true },
  { key: "website",   label: "Website",     icon: "🌐", color: "#22d3ee" },
];

function SocialLink({ href, color, icon, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.socialBtn}
      style={{ borderColor: color, color }}
    >
      <span className={styles.socialIcon}>{icon}</span>
      {label}
    </a>
  );
}

export default function ProfilePage() {
  const { uid } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/"); return; }
    if (uid === user.uid) { router.replace("/radar"); return; }

    getDoc(doc(db, "profiles", uid))
      .then((snap) => {
        if (snap.exists()) setProfile(snap.data());
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [uid, user, authLoading, router]);

  if (loading || authLoading) {
    return <div className={styles.loading}>// loading profile...</div>;
  }

  if (notFound) {
    return (
      <div className={styles.loading}>
        // profile not found
        <br /><br />
        <button className={styles.backBtn} onClick={() => router.back()}>← go back</button>
      </div>
    );
  }

  const initials = profile.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← back</button>
        <span className={styles.brand}>ENTRERADAR</span>
      </header>

      <div className={styles.hero}>
        <div className={styles.avatar}>{initials}</div>
        <h1 className={styles.name}>{profile.name}</h1>
        <div className={styles.title}>{profile.title || "entrepreneur"}</div>
        <div className={`${styles.badge} ${profile.role === "entrepreneur" ? styles.badgeGreen : styles.badgeAmber}`}>
          {profile.role === "entrepreneur" ? "🚀 Entrepreneur" : "👤 Explorer"}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>// connect</div>
        <div className={styles.socials}>
          {SOCIALS.map(({ key, label, icon, color, isWhatsapp }) => {
            const val = profile[key];
            if (!val) return null;
            const href = isWhatsapp
              ? `https://wa.me/${val.replace(/\D/g, "")}`
              : val.startsWith("http") ? val : `https://${val}`;
            return (
              <SocialLink
                key={key}
                href={href}
                color={color}
                icon={icon}
                label={label}
              />
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>// message</div>
        <button
          className={styles.messageBtn}
          onClick={() => router.push(`/chat/${uid}`)}
        >
          💬 Send a Message
        </button>
      </div>
    </main>
  );
}