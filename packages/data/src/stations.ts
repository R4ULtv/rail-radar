import stationsData from "./stations.json" with { type: "json" };
import stationsWithCoordinatesData from "./stations-with-coords.json" with { type: "json" };
import type { Station } from "./types";

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Original station data */
export const stations: Station[] = stationsData;

/** Station data with coordinates */
export const stationsCoords: Station[] = stationsWithCoordinatesData;
