import stationsData from "./stations.json" with { type: "json" };
import type { Station } from "./types";

/** Original station data */
export const stations: Station[] = stationsData.map((station) => ({
  ...station,
  type: station.type as "rail" | "metro",
  importance: (station.importance ?? 4) as 1 | 2 | 3 | 4,
}));

/** Station lookup by ID - O(1) instead of O(n) */
export const stationById = new Map<string, Station>(
  stations.map((s) => [s.id, s]),
);
