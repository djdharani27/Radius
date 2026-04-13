"use client";

import { useRouter } from "next/navigation";
import { formatDistance } from "@/lib/geo";
import styles from "./NearbyList.module.css";

const SOCIAL_ICONS = [
  { key: "linkedin", label: "Li" },
  { key: "twitter", label: "𝕏" },
  { key: "instagram", label: "Ig" },
  { key: "website", label: "🌐" },
];

export default function NearbyList({ nearby }) {
  const router = useRouter();

  if (!nearby || nearby.length === 0) {
    return (
      <div className={styles.empty}>
        scanning for entrepreneurs...
        <br /><br />
        adjust range or wait for others to join
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {nearby.map((p) => (
        <div
          key={p.id}
          className={styles.card}
          onClick={() => router.push(`/profile/${p.id}`)}
          style={{ cursor: "pointer" }}
        >
          <div className={styles.avatar}>
            {p.name
              ?.split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className={styles.info}>
            <div className={styles.name}>{p.name}</div>

            <div className={styles.dist}>
              {formatDistance(p.dist)} away · {p.title || "entrepreneur"}
            </div>

            <div className={styles.socials}>
              {SOCIAL_ICONS.map(({ key, label }) =>
                p[key] ? (
                  <a
                    key={key}
                    href={
                      p[key].startsWith("http")
                        ? p[key]
                        : `https://${p[key]}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    title={key}
                    onClick={(e) => e.stopPropagation()} // 🔥 IMPORTANT
                  >
                    {label}
                  </a>
                ) : null
              )}

              {p.whatsapp && (
                <a
                  href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  title="whatsapp"
                  onClick={(e) => e.stopPropagation()} // 🔥 IMPORTANT
                >
                  📱
                </a>
              )}
            </div>
          </div>

          <div className={styles.ping} />
        </div>
      ))}
    </div>
  );
}