"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle } from "@/lib/firebase";
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
      await signInWithGoogle();
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
        <div className={styles.badge}>Synkedin Pro</div>
        <h1 className={styles.title}>A more polished space for high-intent professional discovery.</h1>
        <p className={styles.copy}>
          Meet nearby founders, operators, investors, and specialists with a calmer interface built for deliberate networking.
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
            <h3>Professional radar</h3>
            <p>Cleaner discovery cards, better range controls, and a calmer dashboard for scanning relevant people nearby.</p>
          </article>
          <article className={styles.card}>
            <h3>Meetup planning</h3>
            <p>Chat flows support Synk requests, collaborative plan proposals, confirmations, and shared updates in real time.</p>
          </article>
          <article className={styles.card}>
            <h3>Profile polish</h3>
            <p>Descriptions, profile photos, and social links are presented in a format that feels closer to a real professional platform.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
