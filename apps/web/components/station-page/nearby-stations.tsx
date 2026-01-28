import Link from "next/link";
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
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function NearbyStations({
  currentStation,
  allStations,
  limit = 5,
}: NearbyStationsProps) {
  if (!currentStation.geo) {
    return null;
  }

  const { lat, lng } = currentStation.geo;

  const nearbyStations = allStations
    .filter((station) => station.id !== currentStation.id && station.geo)
    .map((station) => ({
      ...station,
      distance: haversineDistance(lat, lng, station.geo!.lat, station.geo!.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Nearby Stations
      </h2>
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
    </div>
  );
}
