import Link from "next/link";
import { useMemo } from "react";
import type { Station } from "@repo/data";
import { MapPinIcon } from "lucide-react";

interface NearbyStationsProps {
  currentStation: Station;
  allStations: Station[];
  limit?: number;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

function calculateNearbyStations(
  currentStation: Station,
  allStations: Station[],
  limit: number,
) {
  if (!currentStation.geo) {
    return [];
  }

  const { lat, lng } = currentStation.geo;

  return allStations
    .filter((station) => station.id !== currentStation.id && station.geo)
    .map((station) => ({
      ...station,
      distance: haversineDistance(lat, lng, station.geo!.lat, station.geo!.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export function NearbyStations({
  currentStation,
  allStations,
  limit = 5,
}: NearbyStationsProps) {
  if (!currentStation.geo || allStations.length === 0) {
    return null;
  }

  const nearbyStations = useMemo(
    () => calculateNearbyStations(currentStation, allStations, limit),
    [currentStation, allStations, limit],
  );

  if (nearbyStations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Nearby stations">
      <h2 className="text-sm font-medium text-muted-foreground">Nearby Stations</h2>
      <ul className="space-y-2">
        {nearbyStations.map((station) => (
          <li key={station.id}>
            <Link
              href={`/station/${station.id}`}
              className="flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors group"
            >
              <span className="flex items-center gap-2 truncate">
                <MapPinIcon className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                <span className="truncate">{station.name}</span>
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {formatDistance(station.distance)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
