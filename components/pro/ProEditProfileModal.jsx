"use client";

import { useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { compressProfileImage } from "@/lib/profile";
import ProfileAvatar from "@/components/ProfileAvatar";
import styles from "./ProEditProfileModal.module.css";

const SOCIAL_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourhandle" },
  { key: "twitter", label: "Twitter / X", placeholder: "x.com/yourhandle" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourhandle" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+91 98765 43210" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

export default function ProEditProfileModal({ user, profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.name || "");
  const [title, setTitle] = useState(profile.title || "");
  const [description, setDescription] = useState(profile.description || "");
  const [photoURL, setPhotoURL] = useState(profile.photoURL || "");
  const [socials, setSocials] = useState({
    linkedin: profile.linkedin || "",
    twitter: profile.twitter || "",
    instagram: profile.instagram || "",
    whatsapp: profile.whatsapp || "",
    website: profile.website || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function updateSocial(key, value) {
    setSocials((current) => ({ ...current, [key]: value }));
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Select an image file for your profile picture.");
      event.target.value = "";
      return;
    }

    try {
      const compressed = await compressProfileImage(file);
      setPhotoURL(compressed);
      setError("");
    } catch (uploadError) {
      setError(uploadError.message || "Failed to process the selected image.");
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
      const updated = {
        name: name.trim(),
        role: "professional",
        title: title.trim(),
        description: description.trim(),
        photoURL: photoURL || "",
        ...Object.fromEntries(Object.entries(socials).map(([key, value]) => [key, value.trim()])),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "profiles", user.uid), updated);
      onSaved(updated);
      onClose();
    } catch {
      setError("Unable to save profile changes.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Professional profile</div>
            <h2 className={styles.title}>Edit your presence</h2>
          </div>
          <button className={styles.close} onClick={onClose}>Close</button>
        </div>

        <div className={styles.body}>
          <div className={styles.photoCard}>
            <ProfileAvatar name={name} photoURL={photoURL} size="lg" />
            <div className={styles.photoContent}>
              <div className={styles.photoTitle}>Profile photo</div>
              <div className={styles.photoText}>Use a clean headshot so nearby professionals can recognize you quickly.</div>
              <div className={styles.photoActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()}>
                  Upload
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

          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Professional title</label>
              <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={50} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>About</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
            />
            <div className={styles.helper}>{description.length}/280</div>
          </div>

          <div className={styles.socialSection}>
            <div className={styles.sectionTitle}>Contact links</div>
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

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.ghostBtn} onClick={onClose}>Cancel</button>
            <button className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
