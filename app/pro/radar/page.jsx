"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLocationContext } from "@/context/LocationContext";
import { signOutUser } from "@/lib/firebase";
import { useNearby } from "@/hooks/useNearby";
import ProNearbyList from "@/components/pro/ProNearbyList";
import ProEditProfileModal from "@/components/pro/ProEditProfileModal";
import ProRadarCanvas from "@/components/pro/ProRadarCanvas";
import styles from "./page.module.css";

const RANGE_MIN = 100;
const RANGE_SLIDER_MAX = 10000;
const RANGE_DEFAULT = 1000;
const RANGE_BUTTONS = [50000, 100000, 250000];

export default function ProRadarPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { lat, lng, error: locError, permissionState, isRequesting, requestLocationAccess } = useLocationContext();
  const [rangeMeters, setRangeMeters] = useState(RANGE_DEFAULT);
  const [notifGranted, setNotifGranted] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/pro");
      return;
    }
    if (!profile) {
      router.replace("/pro/setup");
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setNotifGranted(true);
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => setNotifGranted(permission === "granted"));
    }
  }, []);

  const { nearby } = useNearby(lat && lng ? { lat, lng, uid: user?.uid } : null, rangeMeters);

  async function handleSignOut() {
    await signOutUser();
    router.replace("/pro");
  }

  const rangeLabel = rangeMeters < 1000 ? `${rangeMeters} m` : `${(rangeMeters / 1000).toFixed(1)} km`;
  const isVisibleOnRadar = profile?.radarActive ?? true;
  const shouldShowLocationAction =
    permissionState === "prompt" ||
    permissionState === "denied" ||
    permissionState === "unsupported" ||
    (!lat && !lng);

  if (loading || !profile) {
    return <div className={styles.loading}>Preparing your radar...</div>;
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Synkedin</div>
          <h1 className={styles.title}>Radar</h1>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={() => setShowEdit(true)}>Edit profile</button>
          <button className={styles.secondaryBtn} onClick={() => router.push("/pro/inbox")}>Inbox</button>
          <button className={styles.ghostBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCard}>
          <div className={styles.metricLabel}>Visibility</div>
          <div className={styles.metricValue}>{isVisibleOnRadar ? "Visible" : "Hidden"}</div>
          <div className={styles.metricHint}>
            {isVisibleOnRadar ? "You can be discovered by the right people nearby." : "You are off radar right now."}
          </div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.metricLabel}>Current radius</div>
          <div className={styles.metricValue}>{rangeLabel}</div>
          <div className={styles.metricHint}>{nearby.length} people currently in range.</div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.metricLabel}>Location signal</div>
          <div className={styles.metricValue}>{lat && lng ? "Live" : "Waiting"}</div>
          <div className={styles.metricHint}>{lat && lng ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : "Waiting for location access."}</div>
        </div>
      </section>

      {locError && (
        <div className={styles.alertError}>
          <span>{locError}</span>
          {shouldShowLocationAction && permissionState !== "unsupported" && (
            <button className={styles.inlineBtn} onClick={() => requestLocationAccess()} disabled={isRequesting}>
              {isRequesting ? "Requesting..." : "Retry"}
            </button>
          )}
        </div>
      )}

      {!locError && shouldShowLocationAction && (
        <div className={styles.alertWarn}>
          <span>
            {permissionState === "denied"
              ? "Location access is blocked. Enable it in browser settings to appear on radar."
              : permissionState === "unsupported"
                ? "This browser does not support geolocation."
                : "Enable location to discover the right people in real time."}
          </span>
          {permissionState !== "unsupported" && (
            <button className={styles.inlineBtn} onClick={() => requestLocationAccess()} disabled={isRequesting}>
              {isRequesting ? "Requesting..." : "Allow"}
            </button>
          )}
        </div>
      )}

      {!notifGranted && !locError && (
        <div className={styles.alertInfo}>
          <span>Enable notifications so Synkedin can alert you when the right people enter range.</span>
          <button className={styles.inlineBtn} onClick={() => Notification.requestPermission().then((permission) => setNotifGranted(permission === "granted"))}>
            Allow
          </button>
        </div>
      )}

      <section className={styles.grid}>
        <div className={styles.leftColumn}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Radar map</div>
                <h2 className={styles.panelTitle}>See who is nearby</h2>
              </div>
            </div>
            <div className={styles.radarCanvas}>
              {lat && lng ? (
                <ProRadarCanvas peers={nearby} rangeMeters={rangeMeters} />
              ) : (
                <div className={styles.canvasEmpty}>Waiting for your location signal...</div>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Discovery controls</div>
                <h2 className={styles.panelTitle}>Adjust your radius</h2>
              </div>
              <div className={styles.rangeValue}>{rangeLabel}</div>
            </div>

            <input
              type="range"
              min={RANGE_MIN}
              max={RANGE_SLIDER_MAX}
              step={100}
              value={Math.min(rangeMeters, RANGE_SLIDER_MAX)}
              onChange={(event) => setRangeMeters(Number(event.target.value))}
              className={styles.slider}
            />
            <div className={styles.sliderTicks}>
              <span>100 m</span>
              <span>2.5 km</span>
              <span>5 km</span>
              <span>10 km</span>
            </div>

            <div className={styles.extendedRange}>
              <div className={styles.extendedLabel}>Extended range</div>
              <div className={styles.rangeButtons}>
                {RANGE_BUTTONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.rangeBtn} ${rangeMeters === preset ? styles.rangeBtnActive : ""}`}
                    onClick={() => setRangeMeters(preset)}
                  >
                    {preset / 1000} km
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Nearby people</div>
                <h2 className={styles.panelTitle}>People you can reach now</h2>
              </div>
              <div className={styles.countPill}>{nearby.length}</div>
            </div>
            <ProNearbyList nearby={nearby} />
          </div>
        </div>
      </section>

      {showEdit && (
        <ProEditProfileModal
          user={user}
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={refreshProfile}
        />
      )}
    </main>
  );
}
