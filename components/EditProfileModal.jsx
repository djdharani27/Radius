"use client";

import { useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import ProfileAvatar from "@/components/ProfileAvatar";
import { compressProfileImage } from "@/lib/profile";
import styles from "./EditProfileModal.module.css";

const SOCIAL_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourhandle" },
  { key: "twitter", label: "Twitter / X", placeholder: "x.com/yourhandle" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourhandle" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+91 98765 43210" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

export default function EditProfileModal({ user, profile, onClose, onSaved }) {
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

  function updateSocial(key, val) {
    setSocials((prev) => ({ ...prev, [key]: val }));
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
      setError("Radar title is required.");
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
        ...Object.fromEntries(
          Object.entries(socials).map(([k, v]) => [k, v.trim()])
        ),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "profiles", user.uid), updated);
      onSaved(updated);
      onClose();
    } catch {
      setError("Save failed. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>// edit profile</span>
          <button className={styles.closeBtn} onClick={onClose}>x</button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Profile Picture</label>
            <div className={styles.photoCard}>
              <ProfileAvatar name={name} photoURL={photoURL} size="lg" />
              <div className={styles.photoActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </button>
                {photoURL && (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={() => setPhotoURL("")}
                  >
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

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              maxLength={40}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Radar Title</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              placeholder="e.g. Product Designer"
              maxLength={50}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>About You</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError("");
              }}
              placeholder="Tell people what you do, what you are building, or what kind of connections you want to make."
              maxLength={280}
            />
            <div className={styles.helperText}>{description.length}/280</div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Socials</label>
            {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className={styles.socialRow}>
                <span className={styles.socialLabel}>{label}</span>
                <input
                  className={styles.input}
                  value={socials[key]}
                  placeholder={placeholder}
                  onChange={(e) => updateSocial(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
