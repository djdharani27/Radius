"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import styles from "./EditProfileModal.module.css";

const SOCIAL_FIELDS = [
  { key: "linkedin",  label: "LinkedIn",    placeholder: "linkedin.com/in/yourhandle" },
  { key: "twitter",   label: "Twitter / X", placeholder: "x.com/yourhandle" },
  { key: "instagram", label: "Instagram",   placeholder: "instagram.com/yourhandle" },
  { key: "whatsapp",  label: "WhatsApp",    placeholder: "+91 98765 43210" },
  { key: "website",   label: "Website",     placeholder: "https://yoursite.com" },
];

export default function EditProfileModal({ user, profile, onClose, onSaved }) {
  const [name, setName]   = useState(profile.name || "");
  const [role, setRole]   = useState(profile.role || "entrepreneur");
  const [title, setTitle] = useState(profile.title || "");
  const [socials, setSocials] = useState({
    linkedin:  profile.linkedin  || "",
    twitter:   profile.twitter   || "",
    instagram: profile.instagram || "",
    whatsapp:  profile.whatsapp  || "",
    website:   profile.website   || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function updateSocial(key, val) {
    setSocials((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!title.trim()) { setError("Radar title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const updated = {
        name: name.trim(),
        role,
        title: title.trim(),
        ...Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v.trim()])),
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
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Name</label>
            <input className={styles.input} value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              maxLength={40} />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Radar Mode</label>
            <div className={styles.roleRow}>
              {[
                { value: "entrepreneur", icon: "🚀", label: "Entrepreneur" },
                { value: "explorer",     icon: "👤", label: "Explorer" },
              ].map((r) => (
                <button
                  key={r.value}
                  className={`${styles.roleBtn} ${role === r.value ? styles.roleSelected : ""}`}
                  onClick={() => setRole(r.value)}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Radar Title</label>
            <input className={styles.input} value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="e.g. Startup Founder"
              maxLength={50} />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Socials</label>
            {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className={styles.socialRow}>
                <span className={styles.socialLabel}>{label}</span>
                <input className={styles.input} value={socials[key]}
                  placeholder={placeholder}
                  onChange={(e) => updateSocial(key, e.target.value)} />
              </div>
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}