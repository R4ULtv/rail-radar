import type { Station } from "@repo/data/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppIsActive } from "@/hooks/use-app-is-active";
import { fetchApi } from "@/lib/api";

const refreshIntervalMs = 5 * 60 * 1000;

interface TrendingStationsResponse {
  timestamp: string;
  period: string;
  stations: {
    stationId: string;
    stationName: string;
    visits: number;
    uniqueVisitors: number;
    geo: { lat: number; lng: number } | null;
    type: Station["type"];
    importance: Station["importance"];
  }[];
}

export interface TrendingStation extends Station {
  visits: number;
  uniqueVisitors: number;
}

async function loadTrendingStations(): Promise<TrendingStation[] | null> {
  const response = await fetchApi("/stations/trending?period=week");
  if (!response.ok) return null;

  const data = (await response.json()) as TrendingStationsResponse;
  if (!Array.isArray(data.stations)) return null;

  return data.stations.map((station) => ({
    id: station.stationId,
    name: station.stationName,
    type: station.type,
    importance: station.importance,
    geo: station.geo ?? undefined,
    visits: station.visits,
    uniqueVisitors: station.uniqueVisitors,
  }));
}

/**
 * Most visited stations over the last 7 days. Loaded on launch, so the list is ready the first
 * time it's shown, then refreshed every 5 minutes only while it's `visible` and the app is active.
 */
export function useTrendingStations(visible: boolean) {
  const [stations, setStations] = useState<TrendingStation[]>([]);
  const appIsActive = useAppIsActive();
  const loadedAt = useRef(0);
  const isLoading = useRef(false);

  const refresh = useCallback(async () => {
    if (isLoading.current) return;
    isLoading.current = true;
    try {
      const next = await loadTrendingStations();
      if (next) {
        loadedAt.current = Date.now();
        setStations(next);
      }
    } catch {
      // Trending is optional; keep the last list if a refresh fails.
    } finally {
      isLoading.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!visible || !appIsActive) return;

    // Showing the list again only reloads it once it's older than the refresh interval.
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(
      () => {
        void refresh();
        interval = setInterval(refresh, refreshIntervalMs);
      },
      Math.max(0, loadedAt.current + refreshIntervalMs - Date.now()),
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [visible, appIsActive, refresh]);

  return stations;
}
