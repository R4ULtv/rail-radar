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
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Nearby Stations</h2>
      <ul className="flex flex-col gap-1">
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
                className="group -mx-3 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
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
