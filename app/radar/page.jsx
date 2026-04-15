"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import { useLocationContext } from "@/context/LocationContext";
import { signOutUser } from "@/lib/firebase";
import { useNearby } from "@/hooks/useNearby";
import NearbyList from "@/components/NearbyList";
import EditProfileModal from "@/components/EditProfileModal";
import styles from "./page.module.css";

const RadarCanvas = dynamic(() => import("@/components/RadarCanvas"), { ssr: false });

const RANGE_MIN = 100;
const RANGE_MAX = 5000;
const RANGE_DEFAULT = 1000;

export default function RadarPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const {
    lat,
    lng,
    error: locError,
    permissionState,
    isRequesting: isRequestingLocation,
    requestLocationAccess,
  } = useLocationContext();
  const [rangeMeters, setRangeMeters] = useState(RANGE_DEFAULT);
  const [notifGranted, setNotifGranted] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!profile) {
      router.replace("/setup");
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setNotifGranted(true);
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => setNotifGranted(p === "granted"));
    }
  }, []);

  const { nearby } = useNearby(
    lat && lng ? { lat, lng, uid: user?.uid } : null,
    rangeMeters
  );

  async function handleSignOut() {
    await signOutUser();
    router.replace("/");
  }

  const rangeLabel =
    rangeMeters < 1000
      ? `${rangeMeters} m`
      : `${(rangeMeters / 1000).toFixed(1)} km`;

  const isVisibleOnRadar = profile?.radarActive ?? true;
  const shouldShowLocationAction =
    permissionState === "prompt" ||
    permissionState === "denied" ||
    permissionState === "unsupported" ||
    (!lat && !lng);

  if (loading || !profile) {
    return <div className={styles.loading}>// initializing radar...</div>;
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.brand}>SYNKEDIN</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className={`${styles.pill} ${isVisibleOnRadar ? styles.pillGreen : styles.pillAmber}`}>
            <span className={styles.pillDot} />
            {isVisibleOnRadar ? "VISIBLE" : "HIDDEN"}
          </div>
          <button className={styles.editBtn} onClick={() => setShowEdit(true)}>profile</button>
          <button className={styles.inboxBtn} onClick={() => router.push("/inbox")}>inbox</button>
        </div>
      </header>

      {locError && (
        <div className={styles.errorBanner}>
          <span>Location issue: {locError}</span>
          {shouldShowLocationAction && permissionState !== "unsupported" && (
            <button
              type="button"
              className={styles.bannerBtn}
              onClick={() => requestLocationAccess()}
              disabled={isRequestingLocation}
            >
              {isRequestingLocation ? "Requesting..." : "Retry"}
            </button>
          )}
        </div>
      )}

      {!locError && shouldShowLocationAction && (
        <div className={styles.notifBanner}>
          <span>
            {permissionState === "denied"
              ? "Location access is blocked. Enable it in your browser settings to appear on radar."
              : permissionState === "unsupported"
                ? "This browser does not support geolocation."
                : "Enable location access to discover nearby professionals in real time."}
          </span>
          {permissionState !== "unsupported" && (
            <button
              className={styles.notifBtn}
              onClick={() => requestLocationAccess()}
              disabled={isRequestingLocation}
            >
              {isRequestingLocation ? "Requesting..." : "Allow"}
            </button>
          )}
        </div>
      )}

      {!notifGranted && !locError && (
        <div className={styles.notifBanner}>
          Enable notifications to get alerted when professionals are nearby.
          <button
            className={styles.notifBtn}
            onClick={() => Notification.requestPermission().then((p) => setNotifGranted(p === "granted"))}
          >
            Allow
          </button>
        </div>
      )}

      <div className={styles.radarWrap}>
        <div className={styles.radarCanvas}>
          {lat && lng ? (
            <RadarCanvas userLat={lat} userLng={lng} peers={nearby} rangeMeters={rangeMeters} />
          ) : (
            <div className={styles.loading}>// acquiring signal...</div>
          )}
        </div>
        <div className={styles.coords}>
          {lat ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "acquiring signal..."}
        </div>
      </div>

      <div className={styles.sliderWrap}>
        <div className={styles.sliderHeader}>
          <span className={styles.sliderLabel}>// detection range</span>
          <span className={styles.sliderValue}>{rangeLabel}</span>
        </div>
        <input
          type="range"
          min={RANGE_MIN}
          max={RANGE_MAX}
          step={100}
          value={rangeMeters}
          onChange={(e) => setRangeMeters(Number(e.target.value))}
          className={styles.slider}
        />
        <div className={styles.sliderTicks}>
          <span>100 m</span><span>1 km</span><span>2 km</span><span>5 km</span>
        </div>
      </div>

      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          // nearby professionals
          <span className={styles.listCount}>
            {nearby.length > 0 ? ` (${nearby.length})` : ""}
          </span>
        </div>
        <NearbyList nearby={nearby} />
      </div>

      <div className={styles.footer}>
        hello, {profile?.name || "user"} ·{" "}
        <button className={styles.logoutBtn} onClick={handleSignOut}>sign out</button>
      </div>

      {showEdit && (
        <EditProfileModal
          user={user}
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={refreshProfile}
        />
      )}
    </main>
  );
}
