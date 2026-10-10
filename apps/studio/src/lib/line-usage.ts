import type { Line } from "@repo/data";

/** Why a station can't be deleted, or null when no line route stops there. */
export function getStationInUseError(lines: Line[], stationId: string): string | null {
  const names = lines
    .filter((line) => line.routes.some((route) => route.stations.includes(stationId)))
    .map((line) => line.name);
  return names.length
    ? `Station is used by ${names.join(", ")}. Remove it from those routes before deleting it.`
    : null;
}
