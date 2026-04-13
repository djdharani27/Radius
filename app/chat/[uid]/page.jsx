"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, setDoc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { getChatId } from "@/lib/chat";
import styles from "./page.module.css";

export default function ChatPage() {
  const { uid: otherUid } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherProfile, setOtherProfile] = useState(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const chatId = user ? getChatId(user.uid, otherUid) : null;

  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, "profiles", otherUid)).then((snap) => {
      if (snap.exists()) setOtherProfile(snap.data());
    });
  }, [otherUid]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || !chatId || sending) return;
    setSending(true);
    const msgText = text.trim();
    setText("");

    try {
      await setDoc(
        doc(db, "chats", chatId),
        {
          participants: [user.uid, otherUid],
          lastMessage: msgText,
          lastMessageAt: serverTimestamp(),
          [`names.${user.uid}`]: user.displayName || "You",
          [`names.${otherUid}`]: otherProfile?.name || "User",
        },
        { merge: true }
      );

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: user.uid,
        text: msgText,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Send failed:", e);
      setText(msgText);
    }

    setSending(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (authLoading) return <div className={styles.loading}>// loading...</div>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>back</button>
        <div className={styles.headerCenter}>
          <div className={styles.headerName}>{otherProfile?.name || "..."}</div>
          <div className={styles.headerTitle}>{otherProfile?.title || "professional"}</div>
        </div>
        <button
          className={styles.profileBtn}
          onClick={() => router.push(`/profile/${otherUid}`)}
        >
          view
        </button>
      </header>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            // no messages yet
            <br />
            say hello
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === user?.uid;
          return (
            <div
              key={m.id}
              className={`${styles.bubble} ${isMine ? styles.mine : styles.theirs}`}
            >
              {m.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          aria-label={sending ? "Sending message" : "Send message"}
        >
          <svg
            className={styles.sendIcon}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M4 11.5L19.5 4l-3.4 16-4.9-5-4.4 1.8 2-5.3L4 11.5z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </main>
  );
}
