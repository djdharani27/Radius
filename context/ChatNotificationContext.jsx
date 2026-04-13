"use client";

import { createContext, useEffect, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  orderBy, limit,
} from "firebase/firestore";
import { usePathname } from "next/navigation";

export const ChatNotificationContext = createContext(null);

export function ChatNotificationProvider({ children }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastMsgRef = useRef({});
  const innerUnsubsRef = useRef({});

  // Keep pathnameRef in sync without re-running the effect
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let outerUnsub = null;

    // Wait for Firebase auth to resolve
    const authUnsub = auth.onAuthStateChanged((user) => {
      if (!user) return;

      if (Notification.permission !== "granted") return;

      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid)
      );

      outerUnsub = onSnapshot(q, (snap) => {
        snap.docs.forEach((chatDoc) => {
          const chatId = chatDoc.id;
          const data = chatDoc.data();

          // Already listening to this chat — skip
          if (innerUnsubsRef.current[chatId]) return;

          const otherUid = data.participants?.find((p) => p !== user.uid);

          const msgQ = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("createdAt", "desc"),
            limit(1)
          );

          innerUnsubsRef.current[chatId] = onSnapshot(msgQ, (msgSnap) => {
            if (msgSnap.empty) return;

            const latest = msgSnap.docs[0];
            const msg = latest.data();

            // Skip own messages
            if (msg.senderId === user.uid) return;

            // Skip already notified
            if (lastMsgRef.current[chatId] === latest.id) return;
            lastMsgRef.current[chatId] = latest.id;

            // Skip optimistic writes (no timestamp yet)
            if (!msg.createdAt) return;

            // Skip if user is currently viewing this chat
            if (pathnameRef.current === `/chat/${otherUid}`) return;

            const senderName = data.names?.[msg.senderId] || "Someone";

            new Notification("💬 New message", {
              body: `${senderName}: ${msg.text}`,
              tag: `chat-${chatId}`,
              renotify: true,
            });
          });
        });
      });
    });

    return () => {
      authUnsub();
      if (outerUnsub) outerUnsub();
      // Clean up all inner listeners
      Object.values(innerUnsubsRef.current).forEach((fn) => fn());
      innerUnsubsRef.current = {};
    };
  }, []); // runs once — pathnameRef handles pathname changes

  return (
    <ChatNotificationContext.Provider value={null}>
      {children}
    </ChatNotificationContext.Provider>
  );
}