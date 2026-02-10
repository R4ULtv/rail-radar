import stationsData from "./stations.json" with { type: "json" };
import type { Station } from "./types";

/** Original station data */
export const stations = stationsData as Station[];
