export type UserLocation = {
  latitude: number;
  longitude: number;
};

type StoredUserLocation = UserLocation & {
  savedAt: number;
  version: 1;
};

const USER_LOCATION_STORAGE_KEY = "user-location";
const USER_LOCATION_MAX_AGE = 24 * 60 * 60 * 1000;
const COORDINATE_DECIMAL_PLACES = 7;

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
    const storedLocation = localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!storedLocation) return null;

    const parsedLocation: unknown = JSON.parse(storedLocation);
    if (
      !isValidLocation(parsedLocation) ||
      parsedLocation.savedAt > Date.now() ||
      Date.now() - parsedLocation.savedAt > USER_LOCATION_MAX_AGE
    ) {
      localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
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

    localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(storedLocation));
  } catch {
    // Location caching should never block the live map experience.
  }
}
