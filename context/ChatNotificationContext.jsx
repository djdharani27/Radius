"use client";

import { createContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

export const ChatNotificationContext = createContext(null);
const TOAST_MS = 4500;

export function ChatNotificationProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const lastMsgRef = useRef({});
  const innerUnsubsRef = useRef({});
  const chatsHydratedRef = useRef(false);
  const toastTimersRef = useRef({});
  const [toasts, setToasts] = useState([]);

  function dismissToast(id) {
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushToast(toast) {
    setToasts((current) => {
      const next = [toast, ...current.filter((item) => item.id !== toast.id)];
      return next.slice(0, 4);
    });

    if (toastTimersRef.current[toast.id]) {
      clearTimeout(toastTimersRef.current[toast.id]);
    }

    toastTimersRef.current[toast.id] = setTimeout(() => {
      dismissToast(toast.id);
    }, TOAST_MS);
  }

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let outerUnsub = null;
    let currentUid = null;

    const authUnsub = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser || currentUid === firebaseUser.uid) return;
      currentUid = firebaseUser.uid;
      chatsHydratedRef.current = false;
      await setupListeners(firebaseUser.uid);
    });

    async function setupListeners(uid) {
      const supportsBrowserNotifications =
        typeof window !== "undefined" && "Notification" in window;

      if (
        supportsBrowserNotifications &&
        Notification.permission === "default"
      ) {
        await Notification.requestPermission();
      }

      const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", uid)
      );

      outerUnsub = onSnapshot(chatsQuery, (chatSnap) => {
        const seedOnFirstLoad = !chatsHydratedRef.current;

        chatSnap.docChanges().forEach((change) => {
          const chatId = change.doc.id;

          if (change.type === "removed") {
            innerUnsubsRef.current[chatId]?.();
            delete innerUnsubsRef.current[chatId];
            delete lastMsgRef.current[chatId];
            return;
          }

          if (change.type !== "added" || innerUnsubsRef.current[chatId]) return;

          const chatData = change.doc.data();
          const otherUid = chatData.participants?.find((participant) => participant !== uid);
          const latestMessageQuery = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("createdAt", "desc"),
            limit(1)
          );

          let shouldSeedFirstSnapshot = seedOnFirstLoad;

          innerUnsubsRef.current[chatId] = onSnapshot(latestMessageQuery, async (msgSnap) => {
            if (msgSnap.empty) return;

            const latestDoc = msgSnap.docs[0];
            const latestMessage = latestDoc.data();

            if (shouldSeedFirstSnapshot) {
              shouldSeedFirstSnapshot = false;
              lastMsgRef.current[chatId] = latestDoc.id;
              return;
            }

            if (lastMsgRef.current[chatId] === latestDoc.id) return;
            if (latestMessage.senderId === uid) return;
            if (!latestMessage.createdAt) return;
            if (pathnameRef.current === `/chat/${otherUid}`) return;

            lastMsgRef.current[chatId] = latestDoc.id;

            let senderName = "Someone";
            try {
              const senderSnap = await getDoc(doc(db, "profiles", latestMessage.senderId));
              if (senderSnap.exists()) {
                senderName = senderSnap.data().name || "Someone";
              }
            } catch (_) {}

            pushToast({
              id: `${chatId}-${latestDoc.id}`,
              chatId,
              otherUid,
              senderName,
              text: latestMessage.text,
            });

            if (
              supportsBrowserNotifications &&
              Notification.permission === "granted"
            ) {
              try {
                new Notification(`Message from ${senderName}`, {
                  body: latestMessage.text,
                  tag: `chat-${chatId}`,
                  renotify: true,
                });
              } catch (error) {
                console.error("Notification error:", error);
              }
            }
          });
        });

        chatsHydratedRef.current = true;
      });
    }

    return () => {
      authUnsub();
      outerUnsub?.();
      Object.values(innerUnsubsRef.current).forEach((unsubscribe) => unsubscribe());
      innerUnsubsRef.current = {};
      lastMsgRef.current = {};
      chatsHydratedRef.current = false;
      Object.values(toastTimersRef.current).forEach((timer) => clearTimeout(timer));
      toastTimersRef.current = {};
    };
  }, []);

  return (
    <ChatNotificationContext.Provider value={null}>
      {children}
      <div className="toastStack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className="toastCard">
            <button
              type="button"
              className="toastMain"
              onClick={() => {
                dismissToast(toast.id);
                router.push(`/chat/${toast.otherUid}`);
              }}
            >
              <span className="toastEyebrow">New message</span>
              <span className="toastTitle">{toast.senderName}</span>
              <span className="toastBody">{toast.text}</span>
            </button>
            <button
              type="button"
              className="toastClose"
              onClick={() => dismissToast(toast.id)}
            >
              close
            </button>
          </div>
        ))}
      </div>
    </ChatNotificationContext.Provider>
  );
}
