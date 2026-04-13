"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
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

    const unsub = onSnapshot(q, (snap) => {
      setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [user, authLoading, router]);

  function getOtherUid(chat) {
    return chat.participants.find((p) => p !== user?.uid);
  }

  function getOtherName(chat) {
    const otherUid = getOtherUid(chat);
    return chat.names?.[otherUid] || "Unknown";
  }

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
            const otherUid = getOtherUid(chat);
            const name = getOtherName(chat);
            const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div
                key={chat.id}
                className={styles.chatRow}
                onClick={() => router.push(`/chat/${otherUid}`)}
              >
                <div className={styles.avatar}>{initials}</div>
                <div className={styles.info}>
                  <div className={styles.name}>{name}</div>
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