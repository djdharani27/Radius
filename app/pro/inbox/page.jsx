"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import ProfileAvatar from "@/components/ProfileAvatar";
import styles from "./page.module.css";

export default function ProInboxPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/pro");
      return;
    }

    const inboxQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(inboxQuery, async (snapshot) => {
      const chatDocs = snapshot.docs.map((chatDoc) => ({ id: chatDoc.id, ...chatDoc.data() }));
      const enriched = await Promise.all(
        chatDocs.map(async (chat) => {
          const otherUid = chat.participants?.find((participant) => participant !== user.uid);
          if (!otherUid) {
            return { ...chat, otherUid: null, otherName: "Unknown", otherPhotoURL: "" };
          }

          try {
            const profileSnap = await getDoc(doc(db, "profiles", otherUid));
            const profile = profileSnap.exists() ? profileSnap.data() : null;
            return {
              ...chat,
              otherUid,
              otherName: profile?.name || "Unknown",
              otherTitle: profile?.title || "Professional",
              otherPhotoURL: profile?.photoURL || "",
            };
          } catch {
            return { ...chat, otherUid, otherName: "Unknown", otherTitle: "Professional", otherPhotoURL: "" };
          }
        })
      );

      setChats(enriched);
    });

    return () => unsub();
  }, [user, authLoading, router]);

  if (authLoading) return <div className={styles.loading}>Loading conversations...</div>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/pro/radar")}>Back to radar</button>
        <div>
          <div className={styles.eyebrow}>Synkedin Pro</div>
          <h1 className={styles.title}>Inbox</h1>
        </div>
      </header>

      <section className={styles.panel}>
        {chats.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No conversations yet</div>
            <div className={styles.emptyText}>Message someone from radar to start a more deliberate professional exchange.</div>
          </div>
        ) : (
          <div className={styles.list}>
            {chats.map((chat) => (
              <article key={chat.id} className={styles.row} onClick={() => chat.otherUid && router.push(`/pro/chat/${chat.otherUid}`)}>
                <ProfileAvatar name={chat.otherName} photoURL={chat.otherPhotoURL} size="md" className={styles.avatar} />
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <h2 className={styles.name}>{chat.otherName}</h2>
                    <span className={styles.arrow}>Open</span>
                  </div>
                  <div className={styles.titleText}>{chat.otherTitle || "Professional"}</div>
                  <div className={styles.preview}>{chat.lastMessage || "No recent message"}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
