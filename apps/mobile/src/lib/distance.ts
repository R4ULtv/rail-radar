import type { Station } from "@repo/data/types";

import type { UserLocation } from "@/lib/user-location";

const earthRadiusKm = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Straight-line (great-circle) distance in km, like the web's nearby stations. */
export function distanceKm(from: UserLocation, to: NonNullable<Station["geo"]>) {
  const dLat = toRadians(to.lat - from.latitude);
  const dLng = toRadians(to.lng - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Meters under 1 km and one decimal under 10 km, like the web; whole km beyond that. */
export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const digits = km < 10 ? 1 : 0;
  return `${km.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}
