import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { LocationStatus } from "@/components/map-controls";
import { distanceKm } from "@/lib/distance";
import {
  checkLocationAccess,
  LocationAccessError,
  requestLocationFix,
} from "@/lib/location-request";
import {
  createLocationTracker,
  locationFixMaxAgeMs,
  type LocationFix,
} from "@/lib/location-tracking";
import { saveLastUserLocation, type UserLocation } from "@/lib/user-location";

function distanceMeters(from: UserLocation, to: UserLocation) {
  return distanceKm(from, { lat: to.latitude, lng: to.longitude }) * 1_000;
}

type LocationAction = "getLocation" | "locate";

export function useUserLocation(enabled: boolean) {
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const requestLocation = useRef<((action: LocationAction) => Promise<LocationFix>) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let active = AppState.currentState === "active";
    let lastSavedAt: number | null = null;
    const tracker = createLocationTracker({
      requestFix: requestLocationFix,
      distanceMeters,
      onFix(fix) {
        setStatus("located");
        setMessage(null);
        // GPS jitter should not redraw the map and its sheets on every stationary sample.
        setLocation((previous) =>
          previous && distanceMeters(previous, fix) < Math.max(5, Math.min(fix.accuracy ?? 25, 25))
            ? previous
            : fix,
        );
        if (lastSavedAt === null || Date.now() - lastSavedAt >= 60_000) {
          saveLastUserLocation(fix, fix.timestamp);
          lastSavedAt = Date.now();
        }
      },
      onError(error) {
        if (error instanceof LocationAccessError) {
          setStatus(error.status);
          setLocation(null);
          tracker.stop();
        } else {
          setStatus("idle");
          const last = tracker.getLatestFix();
          if (!last || Date.now() - last.timestamp > locationFixMaxAgeMs) setLocation(null);
        }
      },
    });

    async function activate(askPermission: boolean) {
      await checkLocationAccess(askPermission);
      // Permission dialogs can temporarily make iOS inactive. Resuming also calls activate;
      // tracker.start is idempotent, so it must not cancel the user's pending Locate request.
      if (cancelled || !active) {
        throw new Error("Location request was cancelled.");
      }
      tracker.start();
    }

    function handleActivationError(error: unknown) {
      if (cancelled || !active) return;
      setStatus(error instanceof LocationAccessError ? error.status : "idle");
      if (error instanceof LocationAccessError) setLocation(null);
    }

    requestLocation.current = async (action) => {
      await activate(true);
      return tracker[action]();
    };
    void activate(true).catch(handleActivationError);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        active = false;
        tracker.stop();
      } else if (!active) {
        active = true;
        void activate(false).catch(handleActivationError);
      }
    });

    return () => {
      cancelled = true;
      requestLocation.current = null;
      tracker.stop();
      subscription.remove();
    };
  }, [enabled]);

  const requestPosition = useCallback(async (action: LocationAction) => {
    if (action === "locate") setStatus("locating");
    setMessage(null);
    const request = requestLocation.current;
    try {
      if (!request) throw new Error("Your location is unavailable right now.");
      const fix = await request(action);
      if (requestLocation.current !== request) return null;
      // Reading a cached fix for Nearby must not finish a separate pending Locate request.
      setStatus((current) =>
        action === "getLocation" && current === "locating" ? current : "located",
      );
      return fix;
    } catch (error) {
      if (
        requestLocation.current !== request ||
        (error instanceof Error && error.message.includes("cancelled"))
      )
        return null;
      setStatus(error instanceof LocationAccessError ? error.status : "idle");
      if (error instanceof LocationAccessError) setLocation(null);
      setMessage(
        error instanceof LocationAccessError
          ? error.message
          : "Your location is unavailable right now.",
      );
      return null;
    }
  }, []);

  const getLocation = useCallback(() => requestPosition("getLocation"), [requestPosition]);
  const locate = useCallback(() => requestPosition("locate"), [requestPosition]);

  return { location, status, message, getLocation, locate };
}
