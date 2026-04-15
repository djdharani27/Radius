"use client";

import { getInitials } from "@/lib/profile";
import styles from "./ProfileAvatar.module.css";

export default function ProfileAvatar({ name, photoURL, size = "md", className = "" }) {
  const initials = getInitials(name);
  const classes = [styles.avatar, styles[size], className].filter(Boolean).join(" ");

  if (photoURL) {
    return <img src={photoURL} alt={name || "Profile picture"} className={classes} />;
  }

  return <div className={classes}>{initials}</div>;
}
