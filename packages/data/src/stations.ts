import stationsData from "./stations.json" with { type: "json" };
import type { Station } from "./types";

/** Original station data */
export const stations: Station[] = stationsData.map((station) => ({
  ...station,
  type: station.type as "rail" | "metro" | "light",
  importance: (station.importance ?? 4) as 1 | 2 | 3 | 4,
}));

/** Station lookup by ID - O(1) instead of O(n) */
export const stationById = new Map<string, Station>(stations.map((s) => [s.id, s]));

export type CountryCode = "it" | "ch" | "fi" | "be";
export type CountryName = "italy" | "switzerland" | "finland" | "belgium";

const COUNTRY_MAP: Record<CountryCode, CountryName> = {
  it: "italy",
  ch: "switzerland",
  fi: "finland",
  be: "belgium",
};

const ID_PREFIX_TO_COUNTRY: Record<string, CountryCode> = {
  IT: "it",
  ITM: "it", // Metro
  ITL: "it", // Local-Light
  CH: "ch",
  FI: "fi",
  FIM: "fi",
  BE: "be",
  BEM: "be",
};

/** Get country from a station ID. Returns code by default, or full name with `format: "name"` */
export function getCountry(stationId: string, options: { format: "name" }): CountryName | null;
export function getCountry(stationId: string, options?: { format: "code" }): CountryCode | null;
export function getCountry(
  stationId: string,
  options?: { format: "code" | "name" },
): CountryCode | CountryName | null {
  const prefix = stationId.match(/^[A-Z]+/)?.[0];
  const code = prefix ? (ID_PREFIX_TO_COUNTRY[prefix] ?? null) : null;
  if (!code) return null;
  return options?.format === "name" ? COUNTRY_MAP[code] : code;
}
