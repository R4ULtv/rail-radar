import type { Station } from "@repo/data";
import { MegaphoneIcon } from "lucide-react";
import { StationWarning } from "@/components/station-warning";
import { StationActions } from "@/components/station-page/station-actions";

interface StationHeaderProps {
  station: Station;
  info?: string | null;
}

function formatDms(value: number, type: "lat" | "lng") {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  const hemisphere = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";

  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = seconds.toFixed(1).padStart(4, "0");

  return `${degrees}°${paddedMinutes}'${paddedSeconds}"${hemisphere}`;
}

export function StationHeader({ station, info }: StationHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{station.name}</h1>
          {station.geo && (
            <p className="text-sm text-muted-foreground mt-2 tabular-nums">
              {formatDms(station.geo.lat, "lat")} {formatDms(station.geo.lng, "lng")}
            </p>
          )}
        </div>
        <div className="hidden md:block shrink-0">
          <StationActions station={station} />
        </div>
      </div>

      {info && (
        <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
          <MegaphoneIcon className="size-4 inline mr-2" />
          <span>{info}</span>
        </div>
      )}

      <StationWarning stationId={station.id} />
    </div>
  );
}
