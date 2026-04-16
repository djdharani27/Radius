"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { db, signInWithGoogle } from "@/lib/firebase";
import styles from "./page.module.css";

export default function ProLandingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    router.replace(profile ? "/pro/radar" : "/pro/setup");
  }, [user, profile, loading, router]);

  async function handleSignIn() {
    setBusy(true);
    setError("");

    try {
      const signedInUser = await signInWithGoogle();

      if (signedInUser) {
        const profileSnap = await getDoc(doc(db, "profiles", signedInUser.uid));
        router.replace(profileSnap.exists() ? "/pro/radar" : "/pro/setup");
      }
    } catch (signinError) {
      console.error("Sign-in failed:", signinError);
      setError("Unable to sign in right now. Please try again.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      setBusy(false);
    }
  }, [loading]);

  if (loading) {
    return <div className={styles.loading}>Preparing Synkedin Pro...</div>;
  }

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.badge}>Synkedin</div>
        <h1 className={styles.title}>Meet the right people nearby.</h1>
        <p className={styles.copy}>
          Discover, chat, and Synk with people around you.
        </p>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleSignIn} disabled={busy}>
            {busy ? "Connecting..." : "Continue with Google"}
          </button>
          <button className={styles.secondaryBtn} onClick={() => router.push("/")}>
            Open classic app
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelEyebrow}>What changes in Pro</div>
            <h2 className={styles.panelTitle}>Same network. Sharper experience.</h2>
          </div>
        </div>

        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>Radar</h3>
            <p>See who is nearby in real time.</p>
          </article>
          <article className={styles.card}>
            <h3>Synk</h3>
            <p>Plan a meeting together inside chat.</p>
          </article>
          <article className={styles.card}>
            <h3>Profile</h3>
            <p>Show who you are and why people should network with you.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
