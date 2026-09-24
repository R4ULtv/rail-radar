import { File, Paths } from "expo-file-system";

// Mirrors apps/web/src/lib/user-location.ts: the last known position opens the map for a day.
export type UserLocation = {
  latitude: number;
  longitude: number;
};

type StoredUserLocation = UserLocation & {
  savedAt: number;
  version: 1;
};

const USER_LOCATION_MAX_AGE = 24 * 60 * 60 * 1000;
const COORDINATE_DECIMAL_PLACES = 7;
const file = new File(Paths.document, "user-location.json");

function roundCoordinate(coordinate: number) {
  return Number(coordinate.toFixed(COORDINATE_DECIMAL_PLACES));
}

function isValidLocation(location: unknown): location is StoredUserLocation {
  if (!location || typeof location !== "object") return false;

  const candidate = location as Partial<StoredUserLocation>;

  return (
    candidate.version === 1 &&
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude) &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180 &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt)
  );
}

export function loadLastUserLocation(): UserLocation | null {
  try {
    if (!file.exists) return null;

    const parsedLocation: unknown = JSON.parse(file.textSync());
    if (
      !isValidLocation(parsedLocation) ||
      parsedLocation.savedAt > Date.now() ||
      Date.now() - parsedLocation.savedAt > USER_LOCATION_MAX_AGE
    ) {
      file.delete();
      return null;
    }

    return {
      latitude: parsedLocation.latitude,
      longitude: parsedLocation.longitude,
    };
  } catch {
    return null;
  }
}

export function saveLastUserLocation(location: UserLocation) {
  try {
    const storedLocation: StoredUserLocation = {
      latitude: roundCoordinate(location.latitude),
      longitude: roundCoordinate(location.longitude),
      savedAt: Date.now(),
      version: 1,
    };

    if (!file.exists) file.create();
    file.write(JSON.stringify(storedLocation));
  } catch {
    // Location caching should never block the live map experience.
  }
}
