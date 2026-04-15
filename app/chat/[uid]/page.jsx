"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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

export default function ChatPage() {
  const { uid: otherUid } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherProfile, setOtherProfile] = useState(null);
  const [sending, setSending] = useState(false);
  const [chatMeta, setChatMeta] = useState(null);
  const [synkBusy, setSynkBusy] = useState(false);
  const [planForm, setPlanForm] = useState({
    place: "",
    date: "",
    time: "",
    note: "",
  });
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

    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
      setChatMeta(snap.exists() ? snap.data() : null);
    });

    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubMessages = onSnapshot(messagesQuery, (snap) => {
      setMessages(snap.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() })));
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
      await setDoc(
        doc(db, "chats", chatId),
        {
          synk: {
            status: "pending",
            requestedBy: user.uid,
            requestedTo: otherUid,
            requestedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
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
      await setDoc(
        doc(db, "chats", chatId),
        {
          synk: {
            status: "active",
            requestedBy: chatMeta?.synk?.requestedBy || otherUid,
            requestedTo: user.uid,
            activeAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      await pushSystemMessage(`${user.displayName || "Someone"} accepted the Synk request. You're both live now.`);
    } catch (error) {
      console.error("Accept Synk failed:", error);
    }

    setSynkBusy(false);
  }

  async function clearSynk(nextMessage) {
    if (!chatId || !user || synkBusy) return;
    setSynkBusy(true);

    try {
      await setDoc(
        doc(db, "chats", chatId),
        {
          synk: {
            status: "idle",
            updatedAt: serverTimestamp(),
          },
          synkPlan: null,
        },
        { merge: true }
      );

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
      await setDoc(
        doc(db, "chats", chatId),
        {
          synkPlan: null,
        },
        { merge: true }
      );

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
      await setDoc(
        doc(db, "chats", chatId),
        {
          synkPlan: {
            place: planForm.place.trim(),
            date: planForm.date,
            time: planForm.time,
            note: planForm.note.trim(),
            status: "pending",
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );

      await pushSystemMessage(
        `${user.displayName || "Someone"} proposed a Synk plan: ${planForm.place.trim()} on ${planForm.date} at ${planForm.time}.`
      );
    } catch (error) {
      console.error("Save Synk plan failed:", error);
    }

    setSynkBusy(false);
  }

  async function confirmSynkPlan() {
    if (!chatId || !user || synkBusy || !canConfirmPlan) return;
    setSynkBusy(true);

    try {
      await setDoc(
        doc(db, "chats", chatId),
        {
          synkPlan: {
            ...synkPlan,
            status: "confirmed",
            confirmedBy: user.uid,
            confirmedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );

      await pushSystemMessage(
        `${user.displayName || "Someone"} confirmed the Synk plan for ${synkPlan.place} on ${synkPlan.date} at ${synkPlan.time}.`
      );
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

  if (authLoading) return <div className={styles.loading}>// loading...</div>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>back</button>
        <div className={styles.headerCenter}>
          <div className={styles.headerName}>{otherProfile?.name || "..."}</div>
          <div className={styles.headerTitle}>{otherProfile?.title || "professional"}</div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.synkBtn} ${synkState === "active" ? styles.synkBtnActive : ""}`}
            onClick={requestSynk}
            disabled={synkBusy || synkState !== "idle"}
          >
            {synkState === "active" ? "Synked" : synkState === "pending_outgoing" ? "Pending" : synkState === "pending_incoming" ? "Reply" : "Synk"}
          </button>
          <button
            className={styles.profileBtn}
            onClick={() => router.push(`/profile/${otherUid}`)}
          >
            view
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        {synkState === "pending_outgoing" && (
          <div className={styles.synkBanner}>
            <div>
              <div className={styles.synkTitle}>Synk request sent</div>
              <div className={styles.synkText}>Waiting for {otherProfile?.name || "them"} to agree. You can still keep chatting below.</div>
            </div>
            <button
              className={styles.synkActionSecondary}
              onClick={() => clearSynk(`${user?.displayName || "Someone"} cancelled the Synk request.`)}
              disabled={synkBusy}
            >
              Cancel
            </button>
          </div>
        )}

        {synkState === "pending_incoming" && (
          <div className={styles.synkBanner}>
            <div>
              <div className={styles.synkTitle}>Incoming Synk request</div>
              <div className={styles.synkText}>{otherProfile?.name || "This user"} wants to meet and connect in real time.</div>
            </div>
            <div className={styles.synkActions}>
              <button
                className={styles.synkActionPrimary}
                onClick={acceptSynk}
                disabled={synkBusy}
              >
                Accept
              </button>
              <button
                className={styles.synkActionSecondary}
                onClick={() => clearSynk(`${user?.displayName || "Someone"} declined the Synk request.`)}
                disabled={synkBusy}
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {synkState === "active" && (
          <>
            <div className={`${styles.synkBanner} ${styles.synkBannerActive}`}>
              <div>
                <div className={styles.synkTitle}>You are Synked</div>
                <div className={styles.synkText}>
                  {hasSynkPlan
                    ? planStatus === "confirmed"
                      ? "The meetup plan is confirmed. You can still chat and revise it if needed."
                      : isMyPlanUpdate
                        ? "Your plan is waiting for the other person to confirm or revise."
                        : "A plan was proposed. Confirm it or update it with your own schedule."
                    : "Both of you agreed. Set a place, date, and time to meet."}
                </div>
              </div>
              <button
                className={styles.synkActionSecondary}
                onClick={() => clearSynk(`${user?.displayName || "Someone"} cancelled the Synk session.`)}
                disabled={synkBusy}
              >
                Cancel Synk
              </button>
            </div>

            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <div className={styles.planTitle}>// synk plan</div>
                {hasSynkPlan && (
                  <div className={styles.planMeta}>
                    {planStatus === "confirmed"
                      ? "Confirmed"
                      : isMyPlanUpdate
                        ? "Awaiting confirmation"
                        : "Needs your response"}
                  </div>
                )}
              </div>

              <div className={styles.planGrid}>
                <div className={styles.planField}>
                  <label className={styles.planLabel}>Place</label>
                  <input
                    className={styles.planInput}
                    value={planForm.place}
                    onChange={(event) => updatePlanField("place", event.target.value)}
                    placeholder="Cafe, lobby, hall number, gate..."
                  />
                </div>

                <div className={styles.planField}>
                  <label className={styles.planLabel}>Date</label>
                  <input
                    className={styles.planInput}
                    type="date"
                    value={planForm.date}
                    onChange={(event) => updatePlanField("date", event.target.value)}
                  />
                </div>

                <div className={styles.planField}>
                  <label className={styles.planLabel}>Time</label>
                  <input
                    className={styles.planInput}
                    type="time"
                    value={planForm.time}
                    onChange={(event) => updatePlanField("time", event.target.value)}
                  />
                </div>

                <div className={styles.planField}>
                  <label className={styles.planLabel}>Note</label>
                  <input
                    className={styles.planInput}
                    value={planForm.note}
                    onChange={(event) => updatePlanField("note", event.target.value)}
                    placeholder="Optional detail like what to bring or where exactly to wait"
                  />
                </div>
              </div>

              <div className={styles.planActions}>
                {hasSynkPlan && (
                  <button
                    className={styles.synkActionSecondary}
                    onClick={clearSynkPlan}
                    disabled={synkBusy}
                  >
                    Clear Plan
                  </button>
                )}
                {canConfirmPlan && (
                  <button
                    className={styles.synkActionSecondary}
                    onClick={confirmSynkPlan}
                    disabled={synkBusy}
                  >
                    Confirm Plan
                  </button>
                )}
                <button
                  className={styles.synkActionPrimary}
                  onClick={saveSynkPlan}
                  disabled={synkBusy || !planForm.place.trim() || !planForm.date || !planForm.time}
                >
                  {hasSynkPlan ? "Update Plan" : "Save Plan"}
                </button>
              </div>
            </div>
          </>
        )}

        {messages.length === 0 && (
          <div className={styles.empty}>
            // no messages yet
            <br />
            say hello
          </div>
        )}
        {messages.map((message) => {
          if (message.type === "system") {
            return (
              <div key={message.id} className={styles.systemMessage}>
                {message.text}
              </div>
            );
          }

          const isMine = message.senderId === user?.uid;
          return (
            <div
              key={message.id}
              className={`${styles.bubble} ${isMine ? styles.mine : styles.theirs}`}
            >
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
