import stationsData from "./stations.json" with { type: "json" };
import type { Station } from "./types";

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Original station data (names in CAPS) */
export const stationsRaw: Station[] = stationsData;

/** Station data with formatted names (Title Case) */
export const stations: Station[] = stationsData.map((s) => ({
  ...s,
  name: toTitleCase(s.name),
}));
