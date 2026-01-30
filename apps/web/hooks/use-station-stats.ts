import useSWR from "swr";
import { apiFetcher, buildApiUrl, endpoints } from "@/lib/api";
import type { StationStatsResponse } from "@/lib/api";

/**
 * Hook for fetching station statistics
 * Fetches visit and trending data for a specific station
 *
 * @param stationId - Station ID to fetch stats for
 * @param period - Time period for stats (default: "week")
 * @returns Station statistics data, loading state, and error
 */
export function useStationStats(stationId: number, period: string = "week") {
  const { data, error, isLoading } = useSWR<StationStatsResponse>(
    buildApiUrl(endpoints.stationStats(stationId, period)),
    apiFetcher,
    {
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      revalidateOnFocus: false,
    },
  );

  return {
    data,
    error,
    isLoading,
  };
}
