"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import styles from "./page.module.css";

const TITLE_SUGGESTIONS = [
  "Startup Founder", "Software Engineer", "Product Manager",
  "Investor / VC", "Designer", "Marketing Lead",
  "Consultant", "Business Developer",
];

const SOCIAL_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourhandle" },
  { key: "twitter", label: "Twitter / X", placeholder: "x.com/yourhandle" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourhandle" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+91 98765 43210" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

export default function SetupPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [socials, setSocials] = useState({
    linkedin: "",
    twitter: "",
    instagram: "",
    whatsapp: "",
    website: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (profile) {
      router.replace("/radar");
      return;
    }
    setName(user.displayName || "");
  }, [user, profile, loading, router]);

  function updateSocial(key, val) {
    setSocials((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!title.trim()) {
      setError("Tell us how you want to appear on radar.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = {
        name: name.trim(),
        role: "professional",
        title: title.trim(),
        ...Object.fromEntries(
          Object.entries(socials).map(([k, v]) => [k, v.trim()])
        ),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "profiles", user.uid), data);
      refreshProfile(data);
      router.replace("/radar");
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.loading}>// loading...</div>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.brand}>RADIUS</span>
        <span className={styles.step}>// setup profile</span>
      </header>

      <div className={styles.scroll}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Your Name</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="How people know you"
            maxLength={40}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>How you will appear on radar</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            placeholder="e.g. Product Designer, Doctor, Software Engineer"
            maxLength={50}
          />
          <div className={styles.chips}>
            {TITLE_SUGGESTIONS.map((s) => (
              <button key={s} className={styles.chip} onClick={() => setTitle(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            Socials <span className={styles.optional}>(optional - shown to nearby people)</span>
          </label>
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className={styles.socialRow}>
              <span className={styles.socialLabel}>{label}</span>
              <input
                className={styles.input}
                value={socials[key]}
                onChange={(e) => updateSocial(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Launch Radar ->"}
        </button>
      </div>
    </main>
  );
}
