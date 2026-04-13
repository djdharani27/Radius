"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import styles from "./page.module.css";

export default function InboxPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/"); return; }

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const chatDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Fetch the other person's profile for each chat
      const enriched = await Promise.all(
        chatDocs.map(async (chat) => {
          const otherUid = chat.participants?.find((p) => p !== user.uid);
          if (!otherUid) return { ...chat, otherName: "Unknown", otherTitle: "" };

          try {
            const profileSnap = await getDoc(doc(db, "profiles", otherUid));
            const profile = profileSnap.exists() ? profileSnap.data() : null;
            return {
              ...chat,
              otherUid,
              otherName: profile?.name || "Unknown",
              otherTitle: profile?.title || "entrepreneur",
            };
          } catch {
            return { ...chat, otherUid, otherName: "Unknown", otherTitle: "" };
          }
        })
      );

      setChats(enriched);
    });

    return () => unsub();
  }, [user, authLoading, router]);

  if (authLoading) return <div className={styles.loading}>// loading...</div>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/radar")}>← radar</button>
        <span className={styles.brand}>INBOX</span>
        <span className={styles.count}>{chats.length > 0 ? `(${chats.length})` : ""}</span>
      </header>

      <div className={styles.list}>
        {chats.length === 0 ? (
          <div className={styles.empty}>
            // no conversations yet
            <br /><br />
            tap a person on the radar to start chatting
          </div>
        ) : (
          chats.map((chat) => {
            const initials = chat.otherName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={chat.id}
                className={styles.chatRow}
                onClick={() => router.push(`/chat/${chat.otherUid}`)}
              >
                <div className={styles.avatar}>{initials}</div>
                <div className={styles.info}>
                  <div className={styles.name}>{chat.otherName}</div>
                  <div className={styles.lastMsg}>{chat.lastMessage || "..."}</div>
                </div>
                <div className={styles.arrow}>→</div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}