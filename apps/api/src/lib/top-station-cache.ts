import { COUNTRY_CODES, type CountryCode } from "@repo/data/countries";

import type { Period } from "../constants";

export const TOP_STATION_CACHE_NAME = "top-station-aggregate";
export const TOP_STATION_CACHE_TTL_SECONDS = 150;
export const STATION_STATS_CACHE_CONTROL = "public, max-age=150";

export interface CachedTopStation {
  stationId: string;
  stationName: string;
  country: CountryCode | null;
  visits: number;
  uniqueVisitors: number;
}

export type TopStationCache = Pick<Cache, "match" | "put">;

function createCacheKey(accountId: string, period: Period): string {
  const encodedAccountId = encodeURIComponent(accountId);
  return `https://api.railradar24.com/__internal/cache/top-station/v1/${encodedAccountId}/${period}/global/unique-visitors/limit-1`;
}

function isCachedTopStation(value: unknown): value is CachedTopStation | null {
  if (value === null) {
    return true;
  }
  if (!value || typeof value !== "object") {
    return false;
  }

  const station = value as Record<string, unknown>;
  return (
    typeof station.stationId === "string" &&
    typeof station.stationName === "string" &&
    (station.country === null ||
      (typeof station.country === "string" &&
        COUNTRY_CODES.includes(station.country as CountryCode))) &&
    typeof station.visits === "number" &&
    Number.isFinite(station.visits) &&
    typeof station.uniqueVisitors === "number" &&
    Number.isFinite(station.uniqueVisitors)
  );
}

export async function getCachedTopStationAggregate(
  cache: TopStationCache,
  accountId: string,
  period: Period,
  load: () => Promise<CachedTopStation | null>,
): Promise<CachedTopStation | null> {
  const key = createCacheKey(accountId, period);

  try {
    const cached = await cache.match(key);
    if (cached?.ok) {
      const value: unknown = await cached.json();
      if (isCachedTopStation(value)) {
        return value;
      }
    }
  } catch {
    // Cache availability and malformed entries must not make analytics fail.
  }

  const value = await load();

  try {
    await cache.put(
      key,
      Response.json(value, {
        headers: {
          "Cache-Control": `public, max-age=${TOP_STATION_CACHE_TTL_SECONDS}`,
        },
      }),
    );
  } catch {
    // The successful Analytics Engine result remains usable when cache writes fail.
  }

  return value;
}
