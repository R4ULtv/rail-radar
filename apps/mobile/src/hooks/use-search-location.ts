import { useEffect, useState } from "react";

import { distanceKm } from "@/lib/distance";
import { refreshSearchLocation, searchLocationDelay } from "@/lib/location-tracking";
import type { UserLocation } from "@/lib/user-location";

/** A visible search uses fresh positions on new queries, and re-ranks slowly between them. */
export function useSearchLocation(location: UserLocation | null, query: string, visible: boolean) {
  const [snapshot, setSnapshot] = useState(() => ({
    location,
    query,
    visible,
    updatedAt: Date.now(),
  }));
  // Warm the distance labels on the first fix, then refresh before opening/typing commits.
  const current = refreshSearchLocation(snapshot, location, query, visible);
  if (current !== snapshot) setSnapshot(current);

  useEffect(() => {
    if (!visible || !location || !current.location) return;
    const distance = distanceKm(location, {
      lat: current.location.latitude,
      lng: current.location.longitude,
    });
    const delay = searchLocationDelay(current, distance * 1_000);
    if (delay === null) return;
    const timeout = setTimeout(
      () => setSnapshot({ location, query, visible, updatedAt: Date.now() }),
      delay,
    );
    return () => clearTimeout(timeout);
  }, [location, query, visible, current]);

  return current.location;
}
