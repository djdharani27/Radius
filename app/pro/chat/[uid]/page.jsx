"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { getChatId } from "@/lib/chat";
import styles from "./page.module.css";

function getSynkMetaState(synk, currentUid) {
  if (!synk?.status || !currentUid) return "idle";
  if (synk.status === "active") return "active";
  if (synk.status === "pending") {
    return synk.requestedBy === currentUid ? "pending_outgoing" : "pending_incoming";
  }
  return "idle";
}

export default function ProChatPage() {
  const { uid: otherUid } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherProfile, setOtherProfile] = useState(null);
  const [sending, setSending] = useState(false);
  const [chatMeta, setChatMeta] = useState(null);
  const [synkBusy, setSynkBusy] = useState(false);
  const [planForm, setPlanForm] = useState({ place: "", date: "", time: "", note: "" });
  const bottomRef = useRef(null);

  const chatId = user ? getChatId(user.uid, otherUid) : null;
  const synkState = getSynkMetaState(chatMeta?.synk, user?.uid);
  const synkPlan = chatMeta?.synkPlan || null;
  const hasSynkPlan = Boolean(synkPlan?.place && synkPlan?.date && synkPlan?.time);
  const planStatus = synkPlan?.status || "draft";
  const isMyPlanUpdate = synkPlan?.updatedBy === user?.uid;
  const canConfirmPlan = hasSynkPlan && planStatus === "pending" && !isMyPlanUpdate;

  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, "profiles", otherUid)).then((snapshot) => {
      if (snapshot.exists()) setOtherProfile(snapshot.data());
    });
  }, [otherUid]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/pro");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!chatId) return;

    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snapshot) => {
      setChatMeta(snapshot.exists() ? snapshot.data() : null);
    });

    const messageQuery = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(messageQuery, (snapshot) => {
      setMessages(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() })));
    });

    return () => {
      unsubChat();
      unsubMessages();
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, synkState]);

  useEffect(() => {
    if (!synkPlan) {
      setPlanForm({ place: "", date: "", time: "", note: "" });
      return;
    }

    setPlanForm({
      place: synkPlan.place || "",
      date: synkPlan.date || "",
      time: synkPlan.time || "",
      note: synkPlan.note || "",
    });
  }, [synkPlan?.place, synkPlan?.date, synkPlan?.time, synkPlan?.note]);

  async function ensureChatShell() {
    if (!chatId || !user) return;
    await setDoc(
      doc(db, "chats", chatId),
      {
        participants: [user.uid, otherUid],
        [`names.${user.uid}`]: user.displayName || "You",
        [`names.${otherUid}`]: otherProfile?.name || "User",
      },
      { merge: true }
    );
  }

  async function pushSystemMessage(textValue) {
    if (!chatId || !user) return;

    await setDoc(
      doc(db, "chats", chatId),
      {
        participants: [user.uid, otherUid],
        lastMessage: textValue,
        lastMessageAt: serverTimestamp(),
        [`names.${user.uid}`]: user.displayName || "You",
        [`names.${otherUid}`]: otherProfile?.name || "User",
      },
      { merge: true }
    );

    await addDoc(collection(db, "chats", chatId, "messages"), {
      type: "system",
      senderId: user.uid,
      text: textValue,
      createdAt: serverTimestamp(),
    });
  }

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
    } catch (error) {
      console.error("Send failed:", error);
      setText(msgText);
    }

    setSending(false);
  }

  async function requestSynk() {
    if (!chatId || !user || synkBusy || synkState !== "idle") return;
    setSynkBusy(true);

    try {
      await ensureChatShell();
      await setDoc(doc(db, "chats", chatId), {
        synk: {
          status: "pending",
          requestedBy: user.uid,
          requestedTo: otherUid,
          requestedAt: serverTimestamp(),
        },
      }, { merge: true });
      await pushSystemMessage(`${user.displayName || "Someone"} sent a Synk request.`);
    } catch (error) {
      console.error("Synk request failed:", error);
    }

    setSynkBusy(false);
  }

  async function acceptSynk() {
    if (!chatId || !user || synkBusy || synkState !== "pending_incoming") return;
    setSynkBusy(true);

    try {
      await setDoc(doc(db, "chats", chatId), {
        synk: {
          status: "active",
          requestedBy: chatMeta?.synk?.requestedBy || otherUid,
          requestedTo: user.uid,
          activeAt: serverTimestamp(),
        },
      }, { merge: true });
      await pushSystemMessage(`${user.displayName || "Someone"} accepted the Synk request. Start planning the meetup.`);
    } catch (error) {
      console.error("Accept Synk failed:", error);
    }

    setSynkBusy(false);
  }

  async function clearSynk(nextMessage) {
    if (!chatId || !user || synkBusy) return;
    setSynkBusy(true);

    try {
      await setDoc(doc(db, "chats", chatId), {
        synk: {
          status: "idle",
          updatedAt: serverTimestamp(),
        },
        synkPlan: null,
      }, { merge: true });

      if (nextMessage) {
        await pushSystemMessage(nextMessage);
      }
    } catch (error) {
      console.error("Clear Synk failed:", error);
    }

    setSynkBusy(false);
  }

  async function clearSynkPlan() {
    if (!chatId || !user || synkBusy || !hasSynkPlan) return;
    setSynkBusy(true);

    try {
      await setDoc(doc(db, "chats", chatId), { synkPlan: null }, { merge: true });
      await pushSystemMessage(`${user.displayName || "Someone"} cleared the Synk plan.`);
    } catch (error) {
      console.error("Clear Synk plan failed:", error);
    }

    setSynkBusy(false);
  }

  async function saveSynkPlan() {
    if (!chatId || !user || synkBusy || synkState !== "active") return;
    if (!planForm.place.trim() || !planForm.date || !planForm.time) return;
    setSynkBusy(true);

    try {
      await setDoc(doc(db, "chats", chatId), {
        synkPlan: {
          place: planForm.place.trim(),
          date: planForm.date,
          time: planForm.time,
          note: planForm.note.trim(),
          status: "pending",
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true });

      await pushSystemMessage(`${user.displayName || "Someone"} proposed a meetup at ${planForm.place.trim()} on ${planForm.date} at ${planForm.time}.`);
    } catch (error) {
      console.error("Save Synk plan failed:", error);
    }

    setSynkBusy(false);
  }

  async function confirmSynkPlan() {
    if (!chatId || !user || synkBusy || !canConfirmPlan) return;
    setSynkBusy(true);

    try {
      await setDoc(doc(db, "chats", chatId), {
        synkPlan: {
          ...synkPlan,
          status: "confirmed",
          confirmedBy: user.uid,
          confirmedAt: serverTimestamp(),
        },
      }, { merge: true });
      await pushSystemMessage(`${user.displayName || "Someone"} confirmed the meetup plan.`);
    } catch (error) {
      console.error("Confirm Synk plan failed:", error);
    }

    setSynkBusy(false);
  }

  function updatePlanField(key, value) {
    setPlanForm((current) => ({ ...current, [key]: value }));
  }

  function handleKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  if (authLoading) return <div className={styles.loading}>Loading chat...</div>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>Back</button>
        <div className={styles.headerCenter}>
          <div className={styles.name}>{otherProfile?.name || "..."}</div>
          <div className={styles.subtitle}>{otherProfile?.title || "Professional"}</div>
        </div>
        <div className={styles.headerActions}>
          <button className={`${styles.synkBtn} ${synkState === "active" ? styles.synkBtnActive : ""}`} onClick={requestSynk} disabled={synkBusy || synkState !== "idle"}>
            {synkState === "active" ? "Synked" : synkState === "pending_outgoing" ? "Pending" : synkState === "pending_incoming" ? "Reply" : "Synk"}
          </button>
          <button className={styles.profileBtn} onClick={() => router.push(`/pro/profile/${otherUid}`)}>Profile</button>
        </div>
      </header>

      <div className={styles.messages}>
        {synkState === "pending_outgoing" && (
          <div className={styles.synkBanner}>
            <div>
              <div className={styles.synkTitle}>Synk request sent</div>
              <div className={styles.synkText}>Waiting for {otherProfile?.name || "them"} to accept while you continue chatting.</div>
            </div>
            <button className={styles.synkGhost} onClick={() => clearSynk(`${user?.displayName || "Someone"} cancelled the Synk request.`)} disabled={synkBusy}>Cancel</button>
          </div>
        )}

        {synkState === "pending_incoming" && (
          <div className={styles.synkBanner}>
            <div>
              <div className={styles.synkTitle}>Incoming Synk request</div>
              <div className={styles.synkText}>{otherProfile?.name || "This professional"} wants to coordinate a real-world meeting.</div>
            </div>
            <div className={styles.synkActions}>
              <button className={styles.synkPrimary} onClick={acceptSynk} disabled={synkBusy}>Accept</button>
              <button className={styles.synkGhost} onClick={() => clearSynk(`${user?.displayName || "Someone"} declined the Synk request.`)} disabled={synkBusy}>Decline</button>
            </div>
          </div>
        )}

        {synkState === "active" && (
          <div className={styles.planCard}>
            <div className={styles.planHeader}>
              <div>
                <div className={styles.synkTitle}>Active Synk</div>
                <div className={styles.synkText}>
                  {hasSynkPlan
                    ? planStatus === "confirmed"
                      ? "Your meetup plan is confirmed. You can still revise it if needed."
                      : isMyPlanUpdate
                        ? "Your proposal is waiting for the other person to confirm or revise."
                        : "A meetup plan is waiting for your response."
                    : "Set a place, date, and time for the meetup."}
                </div>
              </div>
              <button className={styles.synkGhost} onClick={() => clearSynk(`${user?.displayName || "Someone"} cancelled the Synk session.`)} disabled={synkBusy}>Cancel Synk</button>
            </div>

            <div className={styles.planGrid}>
              <input className={styles.planInput} value={planForm.place} onChange={(event) => updatePlanField("place", event.target.value)} placeholder="Place" />
              <input className={styles.planInput} type="date" value={planForm.date} onChange={(event) => updatePlanField("date", event.target.value)} />
              <input className={styles.planInput} type="time" value={planForm.time} onChange={(event) => updatePlanField("time", event.target.value)} />
              <input className={styles.planInput} value={planForm.note} onChange={(event) => updatePlanField("note", event.target.value)} placeholder="Optional note" />
            </div>

            <div className={styles.planActions}>
              {hasSynkPlan && <button className={styles.synkGhost} onClick={clearSynkPlan} disabled={synkBusy}>Clear plan</button>}
              {canConfirmPlan && <button className={styles.synkGhost} onClick={confirmSynkPlan} disabled={synkBusy}>Confirm plan</button>}
              <button className={styles.synkPrimary} onClick={saveSynkPlan} disabled={synkBusy || !planForm.place.trim() || !planForm.date || !planForm.time}>
                {hasSynkPlan ? "Update plan" : "Save plan"}
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 && <div className={styles.empty}>No messages yet. Start the conversation.</div>}

        {messages.map((message) => {
          if (message.type === "system") {
            return <div key={message.id} className={styles.systemMessage}>{message.text}</div>;
          }

          const isMine = message.senderId === user?.uid;
          return (
            <div key={message.id} className={`${styles.bubble} ${isMine ? styles.mine : styles.theirs}`}>
              {message.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Write a thoughtful message..."
        />
        <button className={styles.sendBtn} onClick={sendMessage} disabled={!text.trim() || sending}>
          Send
        </button>
      </div>
    </main>
  );
}
