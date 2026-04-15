"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import ProfileAvatar from "@/components/ProfileAvatar";
import { compressProfileImage } from "@/lib/profile";
import styles from "./page.module.css";

const TITLE_SUGGESTIONS = [
  "Founder",
  "Software Engineer",
  "Product Manager",
  "Investor",
  "Business Operator",
  "Designer",
];

const SOCIAL_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourhandle" },
  { key: "twitter", label: "Twitter / X", placeholder: "x.com/yourhandle" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourhandle" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+91 98765 43210" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

export default function ProSetupPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoURL, setPhotoURL] = useState("");
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
      router.replace("/pro");
      return;
    }
    if (profile) {
      router.replace("/pro/radar");
      return;
    }
    setName(user.displayName || "");
    setPhotoURL(user.photoURL || "");
  }, [user, profile, loading, router]);

  function updateSocial(key, value) {
    setSocials((current) => ({ ...current, [key]: value }));
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      event.target.value = "";
      return;
    }

    try {
      const compressed = await compressProfileImage(file);
      setPhotoURL(compressed);
      setError("");
    } catch (uploadError) {
      setError(uploadError.message || "Unable to process that image.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!title.trim()) {
      setError("Professional title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = {
        name: name.trim(),
        role: "professional",
        title: title.trim(),
        description: description.trim(),
        photoURL: photoURL || "",
        ...Object.fromEntries(Object.entries(socials).map(([key, value]) => [key, value.trim()])),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "profiles", user.uid), data);
      refreshProfile(data);
      router.replace("/pro/radar");
    } catch {
      setError("Unable to save your profile. Please try again.");
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.loading}>Preparing your workspace...</div>;

  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Synkedin Pro</div>
            <h1 className={styles.title}>Create a polished professional profile</h1>
          </div>
          <button className={styles.backBtn} onClick={() => router.push("/pro")}>Back</button>
        </div>

        <div className={styles.grid}>
          <div className={styles.primaryColumn}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Identity</div>
              <div className={styles.photoCard}>
                <ProfileAvatar name={name || user?.displayName} photoURL={photoURL} size="lg" />
                <div>
                  <div className={styles.photoTitle}>Profile picture</div>
                  <div className={styles.photoText}>Choose a clear headshot to improve recognition nearby.</div>
                  <div className={styles.photoActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()}>
                      Upload photo
                    </button>
                    {photoURL && (
                      <button type="button" className={styles.ghostBtn} onClick={() => setPhotoURL("")}>
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Professional title</label>
                <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={50} />
                <div className={styles.chips}>
                  {TITLE_SUGGESTIONS.map((item) => (
                    <button key={item} type="button" className={styles.chip} onClick={() => setTitle(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>About</label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={280}
                  placeholder="What do you do, what are you building, and what kind of conversations do you want to have?"
                />
                <div className={styles.helper}>{description.length}/280</div>
              </div>
            </div>
          </div>

          <div className={styles.sideColumn}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Contact links</div>
              {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className={styles.field}>
                  <label className={styles.label}>{label}</label>
                  <input
                    className={styles.input}
                    value={socials[key]}
                    placeholder={placeholder}
                    onChange={(event) => updateSocial(key, event.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Launch when ready</div>
              <p className={styles.cardText}>Your profile will immediately power radar discovery, inbox identity, and chat collaboration in the pro experience.</p>
              {error && <div className={styles.error}>{error}</div>}
              <button className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Enter Synkedin Pro"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
