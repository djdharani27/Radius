"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle } from "@/lib/firebase";
import styles from "./page.module.css";

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (profile) {
      router.replace("/radar");
      return;
    }

    router.replace("/setup");
  }, [user, profile, loading, router]);

  async function handleSignIn() {
    setBusy(true);
    setError("");

    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Sign-in failed:", e);
      setError("Sign-in failed. Please try again.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      setBusy(false);
    }
  }, [loading]);

  if (loading) {
    return <div className={styles.boot}>// initializing...</div>;
  }

  return (
    <main className={styles.main}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <div className={styles.logoPulse} />
        </div>
        <h1 className={styles.logoTitle}>RADIUS</h1>
        <p className={styles.logoSub}>professional proximity network</p>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>// sign in to continue</div>
        <p className={styles.cardDesc}>
          Discover professionals around you in real time.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.googleBtn}
          onClick={handleSignIn}
          disabled={busy}
        >
          <GoogleIcon />
          {busy ? "Redirecting..." : "Continue with Google"}
        </button>

        <p className={styles.terms}>
          By continuing you allow Radius to use your approximate location while active.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
