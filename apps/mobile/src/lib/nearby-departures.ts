import type { Station } from "@repo/data/types";

import { distanceKm } from "@/lib/distance";
import type { NearbyStation } from "@/lib/stations";
import type { UserLocation } from "@/lib/user-location";

/** Three rail stations closest to the user, independent of search popularity or map position. */
export function findNearbyDepartures(stations: Station[], from: UserLocation): NearbyStation[] {
  const nearest: NearbyStation[] = [];
  for (const station of stations) {
    if (station.type !== "rail" || !station.geo) continue;
    const distance = distanceKm(from, station.geo);
    if (!Number.isFinite(distance)) continue;
    if (nearest.length === 3 && distance >= nearest[2]!.distance) continue;
    const index = nearest.findIndex((candidate) => distance < candidate.distance);
    nearest.splice(index === -1 ? nearest.length : index, 0, { ...station, distance });
    if (nearest.length > 3) nearest.pop();
  }
  return nearest;
}
