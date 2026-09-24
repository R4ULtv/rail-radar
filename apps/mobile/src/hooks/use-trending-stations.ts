import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";

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

/** Most visited stations over the last 7 days, refreshed every 5 minutes. */
export function useTrendingStations() {
  const [stations, setStations] = useState<TrendingStation[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetchApi("/stations/trending?period=week", {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = (await response.json()) as TrendingStationsResponse;
        if (!Array.isArray(data.stations)) return;

        setStations(
          data.stations.map((station) => ({
            id: station.stationId,
            name: station.stationName,
            type: station.type,
            importance: station.importance,
            geo: station.geo ?? undefined,
            visits: station.visits,
            uniqueVisitors: station.uniqueVisitors,
          })),
        );
      } catch {
        // Trending is optional; keep the last list if a refresh fails.
      }
    }

    void load();
    const interval = setInterval(load, refreshIntervalMs);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  return stations;
}
