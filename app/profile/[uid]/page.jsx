"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import ProfileAvatar from "@/components/ProfileAvatar";
import styles from "./page.module.css";

const SOCIALS = [
  { key: "linkedin", label: "LinkedIn", icon: "in", color: "#0077b5" },
  { key: "twitter", label: "Twitter / X", icon: "X", color: "#ffffff" },
  { key: "instagram", label: "Instagram", icon: "Ig", color: "#e1306c" },
  { key: "whatsapp", label: "WhatsApp", icon: "WA", color: "#25d366", isWhatsapp: true },
  { key: "website", label: "Website", icon: "Web", color: "#22d3ee" },
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
    if (!user) {
      router.replace("/");
      return;
    }
    if (uid === user.uid) {
      router.replace("/radar");
      return;
    }

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
        <button className={styles.backBtn} onClick={() => router.back()}>back</button>
      </div>
    );
  }

  const isVisibleOnRadar = profile.radarActive ?? true;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>back</button>
        <span className={styles.brand}>SYNKEDIN</span>
      </header>

      <div className={styles.hero}>
        <ProfileAvatar
          name={profile.name}
          photoURL={profile.photoURL}
          size="lg"
          className={styles.avatar}
        />
        <h1 className={styles.name}>{profile.name}</h1>
        <div className={styles.title}>{profile.title || "professional"}</div>
        <div className={`${styles.badge} ${isVisibleOnRadar ? styles.badgeGreen : styles.badgeAmber}`}>
          {isVisibleOnRadar ? "Professional" : "Invisible Mode"}
        </div>
      </div>

      {profile.description && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>// about</div>
          <p className={styles.description}>{profile.description}</p>
        </div>
      )}

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
          Send a Message
        </button>
      </div>
    </main>
  );
}
