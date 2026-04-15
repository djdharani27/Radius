"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const DEFAULT_CONTEXT = {
  lat: null,
  lng: null,
  error: null,
  permissionState: "unknown",
  isRequesting: false,
  requestLocationAccess: async () => false,
};

const LocationContext = createContext(DEFAULT_CONTEXT);

export function useLocationContext() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }) {
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState("unknown");
  const [isRequesting, setIsRequesting] = useState(false);

  const watchRef = useRef(null);
  const profileRef = useRef(null);
  const radarActiveRef = useRef(true);
  const positionRef = useRef({ lat: null, lng: null });
  const userRef = useRef(null);
  const profileUnsubRef = useRef(null);
  const permissionStatusRef = useRef(null);
  const requestTokenRef = useRef(0);

  async function writeLiveLocation(user, profile, lat, lng) {
    if (!user?.uid || !profile) return;

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: profile.name || "",
          role: profile.role || "professional",
          title: profile.title || "",
          description: profile.description || "",
          photoURL: profile.photoURL || "",
          linkedin: profile.linkedin || "",
          twitter: profile.twitter || "",
          instagram: profile.instagram || "",
          whatsapp: profile.whatsapp || "",
          website: profile.website || "",
          lat,
          lng,
          lastSeen: serverTimestamp(),
          active: true,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Location write failed:", e.message);
    }
  }

  async function removeLiveLocation(uid) {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (_) {}
  }

  function resetLocationState() {
    setPosition({ lat: null, lng: null });
    positionRef.current = { lat: null, lng: null };
  }

  function stopWatchingLocation() {
    if (watchRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    setIsRequesting(false);
  }

  async function syncPermissionState() {
    if (typeof window === "undefined") return "unknown";

    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      return "unsupported";
    }

    if (!navigator.permissions?.query) {
      setPermissionState((current) =>
        current === "granted" || current === "denied" ? current : "prompt"
      );
      return "prompt";
    }

    try {
      if (!permissionStatusRef.current) {
        const status = await navigator.permissions.query({ name: "geolocation" });
        permissionStatusRef.current = status;
        status.onchange = () => {
          const nextState = status.state;
          setPermissionState(nextState);

          if (nextState === "granted" && userRef.current) {
            requestLocationAccess({ forcePrompt: false });
          }

          if (nextState === "denied") {
            stopWatchingLocation();
            resetLocationState();
            removeLiveLocation(userRef.current?.uid);
            setError("Location access is blocked. Enable it in your browser settings.");
          }
        };
      }

      const next = permissionStatusRef.current.state;
      setPermissionState(next);
      return next;
    } catch (_) {
      setPermissionState((current) =>
        current === "granted" || current === "denied" ? current : "prompt"
      );
      return "prompt";
    }
  }

  async function requestLocationAccess(options = {}) {
    const { forcePrompt = true } = options;
    const user = userRef.current;

    if (typeof window === "undefined") return false;

    if (!user) {
      setError("Sign in to share your location.");
      return false;
    }

    if (!navigator.geolocation) {
      setPermissionState("unsupported");
      setError("Geolocation is not supported by this browser.");
      return false;
    }

    const currentState = await syncPermissionState();

    if (currentState === "denied") {
      stopWatchingLocation();
      resetLocationState();
      await removeLiveLocation(user.uid);
      setError("Location access is blocked. Enable it in your browser settings.");
      return false;
    }

    if (!forcePrompt && currentState !== "granted" && watchRef.current !== null) {
      return false;
    }

    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    setError(null);
    setIsRequesting(true);
    const requestToken = ++requestTokenRef.current;

    const positionOptions = {
      enableHighAccuracy: false,
      maximumAge: 5000,
      timeout: 15000,
    };

    return await new Promise((resolve) => {
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (requestTokenRef.current === requestToken) {
          setIsRequesting(false);
        }
        resolve(result);
      };

      const handleSuccess = async (pos) => {
        if (requestTokenRef.current !== requestToken) {
          finish(false);
          return;
        }

        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition({ lat, lng });
        positionRef.current = { lat, lng };
        setPermissionState("granted");
        setError(null);

        const profile = profileRef.current;
        if (radarActiveRef.current && profile) {
          await writeLiveLocation(userRef.current, profile, lat, lng);
        }

        if (watchRef.current === null && navigator.geolocation) {
          watchRef.current = navigator.geolocation.watchPosition(
            async (nextPos) => {
              const { latitude, longitude } = nextPos.coords;
              setPosition({ lat: latitude, lng: longitude });
              positionRef.current = { lat: latitude, lng: longitude };
              setError(null);

              if (!radarActiveRef.current) return;

              const nextProfile = profileRef.current;
              if (!nextProfile) return;

              await writeLiveLocation(userRef.current, nextProfile, latitude, longitude);
            },
            async (watchError) => {
              if (watchError.code === 1) {
                setPermissionState("denied");
                setError("Location access is blocked. Enable it in your browser settings.");
                stopWatchingLocation();
                resetLocationState();
                await removeLiveLocation(userRef.current?.uid);
                return;
              }

              if (watchError.code === 2) {
                setError("Unable to determine your location right now.");
                return;
              }

              if (watchError.code === 3) {
                setError("Location request timed out. Retry when your connection is stable.");
                return;
              }

              setError("Location error: " + watchError.message);
            },
            positionOptions
          );
        }

        finish(true);
      };

      const handleError = async (geoError) => {
        if (requestTokenRef.current !== requestToken) {
          finish(false);
          return;
        }

        if (geoError.code === 1) {
          setPermissionState("denied");
          setError("Location access is blocked. Enable it in your browser settings.");
          stopWatchingLocation();
          resetLocationState();
          await removeLiveLocation(userRef.current?.uid);
          finish(false);
          return;
        }

        if (geoError.code === 2) {
          setPermissionState((current) => (current === "unknown" ? "prompt" : current));
          setError("Unable to determine your location right now.");
          finish(false);
          return;
        }

        if (geoError.code === 3) {
          setPermissionState((current) => (current === "unknown" ? "prompt" : current));
          setError("Location request timed out. Retry when your connection is stable.");
          finish(false);
          return;
        }

        setError("Location error: " + geoError.message);
        finish(false);
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos);
        },
        (geoError) => {
          handleError(geoError);
        },
        positionOptions
      );
    });
  }

  useEffect(() => {
    let active = true;

    syncPermissionState();

    const authUnsub = auth.onAuthStateChanged(async (user) => {
      if (!active) return;

      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      stopWatchingLocation();

      const previousUid = userRef.current?.uid;

      if (!user) {
        if (previousUid) {
          await removeLiveLocation(previousUid);
        }
        userRef.current = null;
        profileRef.current = null;
        radarActiveRef.current = true;
        resetLocationState();
        setError(null);
        await syncPermissionState();
        return;
      }

      userRef.current = user;
      await syncPermissionState();

      profileUnsubRef.current = onSnapshot(
        doc(db, "profiles", user.uid),
        async (snap) => {
          if (!active || !snap.exists()) return;

          const profile = snap.data();
          const wasActive = radarActiveRef.current;
          const isActive = profile.radarActive ?? true;

          profileRef.current = profile;
          radarActiveRef.current = isActive;

          if (!wasActive && isActive && positionRef.current.lat != null && positionRef.current.lng != null) {
            await writeLiveLocation(
              userRef.current,
              profile,
              positionRef.current.lat,
              positionRef.current.lng
            );
          }

          if (wasActive && isActive && positionRef.current.lat != null && positionRef.current.lng != null) {
            await writeLiveLocation(
              userRef.current,
              profile,
              positionRef.current.lat,
              positionRef.current.lng
            );
          }

          if (wasActive && !isActive) {
            await removeLiveLocation(user.uid);
          }
        },
        () => {}
      );

      requestLocationAccess({ forcePrompt: false });
    });

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible" || !userRef.current) return;
      syncPermissionState().then((state) => {
        if (state === "granted") {
          requestLocationAccess({ forcePrompt: false });
        }
      });
    }

    window.addEventListener("beforeunload", stopWatchingLocation);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      authUnsub();
      stopWatchingLocation();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      if (permissionStatusRef.current) {
        permissionStatusRef.current.onchange = null;
        permissionStatusRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", stopWatchingLocation);
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        ...position,
        error,
        permissionState,
        isRequesting,
        requestLocationAccess,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}
