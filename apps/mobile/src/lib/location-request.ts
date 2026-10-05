import * as Location from "expo-location";

import {
  acquireLocationFix,
  locationRequestMaxAgeMs,
  type LocationFix,
  type LocationRequestMode,
} from "@/lib/location-tracking";

export class LocationAccessError extends Error {
  status: "idle" | "off";

  constructor(status: "idle" | "off", message: string) {
    super(message);
    this.status = status;
  }
}

export async function checkLocationAccess(askPermission: boolean) {
  const [servicesEnabled, existingPermission] = await Promise.all([
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
  ]);
  if (!servicesEnabled) throw new LocationAccessError("off", "Location Services are turned off.");
  const permission =
    askPermission && !existingPermission.granted && existingPermission.canAskAgain
      ? await Location.requestForegroundPermissionsAsync()
      : existingPermission;
  if (!permission.granted) {
    throw new LocationAccessError(
      permission.canAskAgain ? "idle" : "off",
      "Location permission was not granted.",
    );
  }
}

/**
 * Fast requests race recent OS positions against balanced-accuracy acquisition.
 * Stationary checks request high accuracy, accepting the first recent fix without an accuracy gate.
 * Acquisition can be cancelled on backgrounding or timeout.
 * It is removed after the fix, leaving no continuous GPS watch between scheduled requests.
 */
export async function requestLocationFix(
  signal: AbortSignal,
  mode: LocationRequestMode = "fast",
): Promise<LocationFix> {
  await checkLocationAccess(false);
  const precise = mode === "precise";
  return acquireLocationFix(
    (onPosition, onError) =>
      Location.watchPositionAsync(
        {
          accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
          distanceInterval: 0,
          // Keep Android's native cadence short while waiting for the first usable fix.
          timeInterval: 1_000,
          // A watch is only alive while acquiring one fix, on both iOS and Android.
          mayShowUserSettingsDialog: false,
        },
        onPosition,
        onError,
      ),
    signal,
    () => Location.getLastKnownPositionAsync({ maxAge: locationRequestMaxAgeMs }),
  );
}
