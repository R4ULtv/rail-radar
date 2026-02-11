import Link from "next/link";
import type { Station } from "@repo/data";
import { SquareMIcon, TrainFrontIcon } from "lucide-react";

interface NearbyStationsProps {
  currentStation: Station;
  allStations: Station[];
  limit?: number;
}

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

type StationWithDistance = Station & { distance: number };

function calculateNearbyStations(
  currentStation: Station,
  allStations: Station[],
  limit: number,
): StationWithDistance[] {
  if (!currentStation.geo) {
    return [];
  }

  const { lat, lng } = currentStation.geo;
  const result: StationWithDistance[] = [];
  let maxDistance = Infinity;

  for (const station of allStations) {
    if (station.id === currentStation.id || !station.geo) continue;

    const distance = haversineDistance(
      lat,
      lng,
      station.geo.lat,
      station.geo.lng,
    );

    if (result.length < limit || distance < maxDistance) {
      // Binary insert to maintain sorted order
      let lo = 0;
      let hi = result.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (result[mid]!.distance < distance) lo = mid + 1;
        else hi = mid;
      }
      result.splice(lo, 0, { ...station, distance });
      if (result.length > limit) result.pop();
      maxDistance = result[result.length - 1]!.distance;
    }
  }

  return result;
}

export function NearbyStations({
  currentStation,
  allStations,
}: NearbyStationsProps) {
  if (!currentStation.geo || allStations.length === 0) {
    return null;
  }

  const railStations = allStations.filter((s) => s.type === "rail");
  const metroStations = allStations.filter((s) => s.type === "metro");
  const nearbyRail = calculateNearbyStations(currentStation, railStations, 4);
  const nearbyMetro = calculateNearbyStations(currentStation, metroStations, 2);
  const combined = [...nearbyRail, ...nearbyMetro].sort(
    (a, b) => a.distance - b.distance,
  );
  // Max 4 total, max 2 metro — pick closest, skipping excess metro
  const nearbyStations: typeof combined = [];
  let metroCount = 0;
  for (const station of combined) {
    if (station.type === "metro") {
      if (metroCount >= 2) continue;
      metroCount++;
    }
    nearbyStations.push(station);
    if (nearbyStations.length >= 4) break;
  }

  if (nearbyStations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Nearby Stations
      </h2>
      <ul className="space-y-2">
        {nearbyStations.map((station) => {
          const isMetro = station.type === "metro";
          const Icon = isMetro ? SquareMIcon : TrainFrontIcon;
          const href = isMetro
            ? `/?lat=${station.geo!.lat}&lng=${station.geo!.lng}&zoom=15`
            : `/station/${station.id}`;
          return (
            <li key={station.id}>
              <Link
                href={href}
                className="flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors group"
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  <span className="truncate">{station.name}</span>
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {formatDistance(station.distance)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
