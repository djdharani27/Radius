"use client";

import { useRouter } from "next/navigation";
import { formatDistance } from "@/lib/geo";
import ProfileAvatar from "@/components/ProfileAvatar";
import styles from "./ProNearbyList.module.css";

const SOCIAL_ICONS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "website", label: "Website" },
];

export default function ProNearbyList({ nearby }) {
  const router = useRouter();

  if (!nearby || nearby.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No professionals in range yet</div>
        <div className={styles.emptyText}>Try widening the radius or wait for nearby members to appear.</div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {nearby.map((person) => (
        <article
          key={person.id}
          className={styles.card}
          onClick={() => router.push(`/pro/profile/${person.id}`)}
        >
          <div className={styles.top}>
            <ProfileAvatar
              name={person.name}
              photoURL={person.photoURL}
              size="md"
              className={styles.avatar}
            />

            <div className={styles.identity}>
              <div className={styles.nameRow}>
                <h3 className={styles.name}>{person.name}</h3>
                <span className={styles.distance}>{formatDistance(person.dist)}</span>
              </div>
              <p className={styles.title}>{person.title || "Professional"}</p>
              {person.description && <p className={styles.description}>{person.description}</p>}
            </div>
          </div>

          <div className={styles.footer}>
            <div className={styles.socials}>
              {SOCIAL_ICONS.map(({ key, label }) =>
                person[key] ? (
                  <a
                    key={key}
                    href={person[key].startsWith("http") ? person[key] : `https://${person[key]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {label}
                  </a>
                ) : null
              )}
              {person.whatsapp && (
                <a
                  href={`https://wa.me/${person.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  onClick={(event) => event.stopPropagation()}
                >
                  WhatsApp
                </a>
              )}
            </div>

            <button
              type="button"
              className={styles.chatBtn}
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/pro/chat/${person.id}`);
              }}
            >
              Message
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
