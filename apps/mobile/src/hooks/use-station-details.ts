import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";

import { useIsOnline } from "@/hooks/use-is-online";
import { fetchApi, fetchWithUserAgent } from "@/lib/api";
import { findNearbyStations, loadStations, type NearbyStation } from "@/lib/stations";

const webBaseUrl = "https://www.railradar24.com";
const statsMaxAgeMs = 5 * 60 * 1000;
const noNearbyStations: NearbyStation[] = [];

interface Cached<T> {
  value: Promise<T>;
  loadedAt: number;
  /** Set once the load has succeeded. */
  result?: { value: T };
}

interface StationCache<T> {
  load: (stationId: string) => Promise<T>;
  /** The last loaded value, even if it's being refreshed, so reopening skips the skeleton. */
  peek: (stationId: string) => { value: T } | undefined;
}

/**
 * Keeps each station's details while the app runs, so reopening a station shows them at once.
 * Failed loads are dropped, so they're tried again the next time.
 */
function createCache<T>(
  load: (stationId: string) => Promise<T>,
  maxAgeMs = Infinity,
): StationCache<T> {
  const cache = new Map<string, Cached<T>>();
  return {
    load: (stationId) => {
      const cached = cache.get(stationId);
      if (cached && Date.now() - cached.loadedAt < maxAgeMs) return cached.value;

      const value = load(stationId);
      const entry: Cached<T> = { value, loadedAt: Date.now(), result: cached?.result };
      cache.set(stationId, entry);
      value.then(
        (result) => {
          entry.result = { value: result };
        },
        () => {
          if (cache.get(stationId) === entry) cache.delete(stationId);
        },
      );
      return value;
    },
    peek: (stationId) => cache.get(stationId)?.result,
  };
}

interface StationResource<T> {
  /** Null until it arrives, or if it failed. */
  value: T | null;
  /** Nothing has arrived yet, and the load hasn't failed. */
  isLoading: boolean;
}

/**
 * Loads a station's details while `enabled`. A failed load is tried again once the connection
 * comes back.
 */
function useStationResource<T>(
  stationId: string,
  enabled: boolean,
  cache: StationCache<T>,
): StationResource<T> {
  const isOnline = useIsOnline();
  // A null value is a failed load.
  const [state, setState] = useState<{ stationId: string; value: T | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    cache
      .load(stationId)
      .then((value) => {
        if (!cancelled) setState({ stationId, value });
      })
      .catch(() => {
        if (!cancelled) {
          // Keep what was shown if a refresh fails.
          setState((current) =>
            current?.stationId === stationId && current.value !== null
              ? current
              : { stationId, value: null },
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stationId, enabled, isOnline, cache]);

  if (state?.stationId === stationId) return { value: state.value, isLoading: false };
  const cached = cache.peek(stationId);
  return cached ? { value: cached.value, isLoading: false } : { value: null, isLoading: true };
}

export interface StationStats {
  station: { visits: number; uniqueVisitors: number } | null;
  topStation: { stationId: string; stationName: string; uniqueVisitors: number } | null;
  comparison: { percentage: number | null; isTopStation: boolean };
}

const statsCache = createCache(async (stationId) => {
  const response = await fetchApi(`/stations/${encodeURIComponent(stationId)}/stats?period=week`);
  if (!response.ok) throw new Error("Station stats could not be loaded.");
  return (await response.json()) as StationStats;
}, statsMaxAgeMs);

/** Visits in the last 7 days, compared with the week's most visited station. */
export function useStationStats(stationId: string, enabled: boolean) {
  return useStationResource(stationId, enabled, statsCache);
}

export interface StationPhoto {
  key: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  attribution?: { author?: string; license?: string; origin?: string; sourceUrl?: string | null };
}

const photosCache = createCache(async (stationId): Promise<StationPhoto[]> => {
  const response = await fetchWithUserAgent(
    `${webBaseUrl}/media/stations/${encodeURIComponent(stationId)}/photos`,
  );
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("Station photos could not be loaded.");

  const manifest = (await response.json()) as { stationId: string; images: StationPhoto[] };
  if (manifest.stationId !== stationId || !Array.isArray(manifest.images)) return [];
  return manifest.images.map((photo) => ({ ...photo, url: `${webBaseUrl}${photo.url}` }));
});

/** The web's station photos. Like the web, only the main stations have them. */
export function useStationPhotos(station: Station, enabled: boolean) {
  const hasPhotos = station.importance === 1;
  const { value, isLoading } = useStationResource(station.id, enabled && hasPhotos, photosCache);
  return { photos: value ?? [], isLoading: hasPhotos && isLoading };
}

/** The closest stations, found in the same station file the map shows. */
export function useNearbyStations(station: Station, stationsUrl: string | null) {
  // Null stations are a failed load.
  const [state, setState] = useState<{
    stationId: string;
    stations: NearbyStation[] | null;
  } | null>(null);

  useEffect(() => {
    if (!stationsUrl) return;
    let cancelled = false;
    loadStations(stationsUrl)
      .then((stations) => {
        if (!cancelled) {
          setState({ stationId: station.id, stations: findNearbyStations(stations, station) });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ stationId: station.id, stations: null });
      });
    return () => {
      cancelled = true;
    };
  }, [station, stationsUrl]);

  const current = state?.stationId === station.id ? state : null;
  return {
    stations: current?.stations ?? noNearbyStations,
    // A station without coordinates has no nearby stations to find.
    isLoading: !!station.geo && current === null,
  };
}
