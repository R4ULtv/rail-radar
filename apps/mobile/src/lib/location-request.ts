import * as Location from "expo-location";

import { acquireLocationFix, type LocationFix } from "@/lib/location-tracking";

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
 * A short-lived watch gives us a fresh fix and can be cancelled on backgrounding or timeout.
 * It is removed after the fix, leaving no continuous GPS watch between scheduled requests.
 */
export async function requestLocationFix(signal: AbortSignal): Promise<LocationFix> {
  await checkLocationAccess(false);
  return acquireLocationFix(
    (onPosition, onError) =>
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 0,
          // A watch is only alive while acquiring one fix, on both iOS and Android.
          mayShowUserSettingsDialog: false,
        },
        onPosition,
        onError,
      ),
    signal,
  );
}
