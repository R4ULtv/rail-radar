import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";

import { useIsOnline } from "@/hooks/use-is-online";
import { fetchApi, fetchWithUserAgent } from "@/lib/api";
import { findNearbyStations, loadStations, type NearbyStation } from "@/lib/stations";

const webBaseUrl = "https://www.railradar24.com";
const statsMaxAgeMs = 5 * 60 * 1000;

interface Cached<T> {
  value: Promise<T>;
  loadedAt: number;
}

/**
 * Keeps each station's details while the app runs, so reopening a station shows them at once.
 * Failed loads are dropped, so they're tried again the next time.
 */
function createCache<T>(load: (stationId: string) => Promise<T>, maxAgeMs = Infinity) {
  const cache = new Map<string, Cached<T>>();
  return (stationId: string) => {
    const cached = cache.get(stationId);
    if (cached && Date.now() - cached.loadedAt < maxAgeMs) return cached.value;

    const value = load(stationId);
    const entry = { value, loadedAt: Date.now() };
    cache.set(stationId, entry);
    value.catch(() => {
      if (cache.get(stationId) === entry) cache.delete(stationId);
    });
    return value;
  };
}

/**
 * Loads a station's details while `enabled`; null until they arrive or if they fail. A failed
 * load is tried again once the connection comes back.
 */
function useStationResource<T>(
  stationId: string,
  enabled: boolean,
  load: (stationId: string) => Promise<T>,
) {
  const isOnline = useIsOnline();
  const [state, setState] = useState<{ stationId: string; value: T } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    load(stationId)
      .then((value) => {
        if (!cancelled) setState({ stationId, value });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stationId, enabled, isOnline, load]);

  return state?.stationId === stationId ? state.value : null;
}

export interface StationStats {
  station: { visits: number; uniqueVisitors: number } | null;
  topStation: { stationId: string; stationName: string; uniqueVisitors: number } | null;
  comparison: { percentage: number | null; isTopStation: boolean };
}

const loadStats = createCache(async (stationId) => {
  const response = await fetchApi(`/stations/${encodeURIComponent(stationId)}/stats?period=week`);
  if (!response.ok) throw new Error("Station stats could not be loaded.");
  return (await response.json()) as StationStats;
}, statsMaxAgeMs);

/** Visits in the last 7 days, compared with the week's most visited station. */
export function useStationStats(stationId: string, enabled: boolean) {
  return useStationResource(stationId, enabled, loadStats);
}

export interface StationPhoto {
  key: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  attribution?: { author?: string; license?: string; origin?: string; sourceUrl?: string | null };
}

const loadPhotos = createCache(async (stationId): Promise<StationPhoto[]> => {
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
  return useStationResource(station.id, enabled && station.importance === 1, loadPhotos) ?? [];
}

/** The closest stations, found in the same station file the map shows. */
export function useNearbyStations(station: Station, stationsUrl: string | null) {
  const [state, setState] = useState<{ stationId: string; stations: NearbyStation[] } | null>(null);

  useEffect(() => {
    if (!stationsUrl) return;
    let cancelled = false;
    loadStations(stationsUrl)
      .then((stations) => {
        if (!cancelled) {
          setState({ stationId: station.id, stations: findNearbyStations(stations, station) });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [station, stationsUrl]);

  return state?.stationId === station.id ? state.stations : [];
}
