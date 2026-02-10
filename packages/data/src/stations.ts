import stationsData from "./stations.json" with { type: "json" };
import type { Station } from "./types";

/** Original station data */
export const stations: Station[] = stationsData.map((station) => ({
  ...station,
  type: station.type as "rail" | "metro",
  importance: (station.importance ?? 4) as 1 | 2 | 3 | 4,
}));
