import { Link } from "@tanstack/react-router";
import type { Station } from "@repo/data";
import { SquareMIcon, TrainFrontIcon } from "lucide-react";

interface NearbyStationsProps {
  stations: Array<Station & { distance: number }>;
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function NearbyStations({ stations }: NearbyStationsProps) {
  if (stations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Nearby Stations</h2>
      <ul className="space-y-2">
        {stations.map((station) => {
          const isMetro = station.type === "metro";
          const Icon = isMetro ? SquareMIcon : TrainFrontIcon;
          const href = isMetro
            ? `/?lat=${station.geo!.lat}&lng=${station.geo!.lng}&zoom=15`
            : `/station/${station.id}`;
          return (
            <li key={station.id}>
              <Link
                to={href}
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
