"use client";

import { useRouter } from "next/navigation";
import { formatDistance } from "@/lib/geo";
import ProfileAvatar from "@/components/ProfileAvatar";
import styles from "./NearbyList.module.css";

const SOCIAL_ICONS = [
  { key: "linkedin", label: "Li" },
  { key: "twitter", label: "X" },
  { key: "instagram", label: "Ig" },
  { key: "website", label: "Web" },
];

export default function NearbyList({ nearby }) {
  const router = useRouter();

  if (!nearby || nearby.length === 0) {
    return (
      <div className={styles.empty}>
        scanning for professionals...
        <br /><br />
        adjust range or wait for others to join
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {nearby.map((person) => (
        <div
          key={person.id}
          className={styles.card}
          onClick={() => router.push(`/profile/${person.id}`)}
          style={{ cursor: "pointer" }}
        >
          <ProfileAvatar
            name={person.name}
            photoURL={person.photoURL}
            size="sm"
            className={styles.avatar}
          />

          <div className={styles.info}>
            <div className={styles.name}>{person.name}</div>

            <div className={styles.dist}>
              {formatDistance(person.dist)} away · {person.title || "professional"}
            </div>

            <div className={styles.socials}>
              {SOCIAL_ICONS.map(({ key, label }) =>
                person[key] ? (
                  <a
                    key={key}
                    href={person[key].startsWith("http") ? person[key] : `https://${person[key]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    title={key}
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
                  title="whatsapp"
                  onClick={(event) => event.stopPropagation()}
                >
                  WA
                </a>
              )}
            </div>
          </div>

          <button
            type="button"
            className={styles.chatBtn}
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/chat/${person.id}`);
            }}
          >
            chat
          </button>

          <div className={styles.ping} />
        </div>
      ))}
    </div>
  );
}
